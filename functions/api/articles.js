export async function onRequestGet(context) {
    const { env, request } = context;
    const db = env.D1_DATABASE;
    const url = new URL(request.url);
    const articleId = url.searchParams.get('id');
    
    try {
        if (articleId) {
            // 获取单篇文章
            const article = await db.prepare(`
                SELECT 
                    a.*, 
                    c.name as category_name,
                    GROUP_CONCAT(t.name) as tags
                FROM articles a
                LEFT JOIN categories c ON a.category_id = c.id
                LEFT JOIN article_tags at ON a.id = at.article_id
                LEFT JOIN tags t ON at.tag_id = t.id
                WHERE a.id = ?
                GROUP BY a.id
            `).bind(articleId).first();
            
            if (!article) {
                return new Response(JSON.stringify({ error: '文章未找到' }), { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            return new Response(JSON.stringify(article), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // 获取文章列表
            const categoryId = url.searchParams.get('category');
            const tag = url.searchParams.get('tag');
            
            let query = `
                SELECT 
                    a.*, 
                    c.name as category_name,
                    GROUP_CONCAT(t.name) as tags
                FROM articles a
                LEFT JOIN categories c ON a.category_id = c.id
                LEFT JOIN article_tags at ON a.id = at.article_id
                LEFT JOIN tags t ON at.tag_id = t.id
            `;
            
            const conditions = [];
            const params = [];
            
            if (categoryId) {
                conditions.push('a.category_id = ?');
                params.push(categoryId);
            }
            
            if (tag) {
                conditions.push('t.name = ?');
                params.push(tag);
            }
            
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
            
            query += ` GROUP BY a.id ORDER BY a.created_at DESC`;
            
            const articles = await db.prepare(query).bind(...params).all();
            
            return new Response(JSON.stringify(articles.results), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
        }
    } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const db = env.D1_DATABASE;
    
    try {
        const { title, content, category_id, tags = [] } = await request.json();
        
        if (!title || !content || !category_id) {
            return new Response(JSON.stringify({ error: '标题、内容和分类不能为空' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 插入文章
        const articleResult = await db.prepare(
            'INSERT INTO articles (title, content, category_id) VALUES (?, ?, ?)'
        ).bind(title, content, category_id).run();
        
        const articleId = articleResult.meta.last_row_id;
        
        // 处理标签
        if (tags.length > 0) {
            for (const tagName of tags) {
                if (!tagName.trim()) continue;
                
                // 查找或创建标签
                let tag = await db.prepare(
                    'SELECT id FROM tags WHERE name = ?'
                ).bind(tagName).first();
                
                if (!tag) {
                    const tagResult = await db.prepare(
                        'INSERT INTO tags (name) VALUES (?)'
                    ).bind(tagName).run();
                    tag = { id: tagResult.meta.last_row_id };
                }
                
                // 关联文章和标签
                await db.prepare(
                    'INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)'
                ).bind(articleId, tag.id).run();
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            id: articleId 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPut(context) {
    const { env, request } = context;
    const db = env.D1_DATABASE;
    const url = new URL(request.url);
    const articleId = url.searchParams.get('id');
    
    try {
        const { title, content, category_id, tags = [] } = await request.json();
        
        if (!articleId || !title || !content || !category_id) {
            return new Response(JSON.stringify({ error: '参数不完整' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 更新文章
        await db.prepare(
            'UPDATE articles SET title = ?, content = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(title, content, category_id, articleId).run();
        
        // 删除旧的标签关联
        await db.prepare(
            'DELETE FROM article_tags WHERE article_id = ?'
        ).bind(articleId).run();
        
        // 添加新的标签关联
        if (tags.length > 0) {
            for (const tagName of tags) {
                if (!tagName.trim()) continue;
                
                let tag = await db.prepare(
                    'SELECT id FROM tags WHERE name = ?'
                ).bind(tagName).first();
                
                if (!tag) {
                    const tagResult = await db.prepare(
                        'INSERT INTO tags (name) VALUES (?)'
                    ).bind(tagName).run();
                    tag = { id: tagResult.meta.last_row_id };
                }
                
                await db.prepare(
                    'INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)'
                ).bind(articleId, tag.id).run();
            }
        }
        
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}