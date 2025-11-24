export async function onRequestGet(context) {
    const { env } = context;
    const db = env.D1_DATABASE;
    
    try {
        // 获取所有分类和文章数量
        const categories = await db.prepare(`
            SELECT 
                c.*,
                COUNT(a.id) as article_count
            FROM categories c
            LEFT JOIN articles a ON c.id = a.category_id
            GROUP BY c.id, c.name, c.parent_id, c.sort_order
            ORDER BY c.sort_order, c.name
        `).all();

        // 构建树形结构
        const buildTree = (parentId = null) => {
            return categories.results
                .filter(cat => {
                    if (parentId === null) {
                        return cat.parent_id === null;
                    }
                    return cat.parent_id === parentId;
                })
                .map(cat => ({
                    ...cat,
                    children: buildTree(cat.id)
                }));
        };
        
        const categoryTree = buildTree();

        return new Response(JSON.stringify(categoryTree), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
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
        const { name, parent_id } = await request.json();
        
        if (!name || name.trim() === '') {
            return new Response(JSON.stringify({ error: '分类名称不能为空' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 检查父分类是否存在
        if (parent_id) {
            const parent = await db.prepare(
                'SELECT id FROM categories WHERE id = ?'
            ).bind(parent_id).first();
            
            if (!parent) {
                return new Response(JSON.stringify({ error: '父分类不存在' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        const result = await db.prepare(
            'INSERT INTO categories (name, parent_id) VALUES (?, ?)'
        ).bind(name.trim(), parent_id).run();
        
        return new Response(JSON.stringify({ 
            success: true, 
            id: result.meta.last_row_id 
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
    const categoryId = url.searchParams.get('id');
    
    try {
        const { name, parent_id } = await request.json();
        
        if (!categoryId || !name || name.trim() === '') {
            return new Response(JSON.stringify({ error: '参数不完整' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 检查分类是否存在
        const existingCategory = await db.prepare(
            'SELECT id FROM categories WHERE id = ?'
        ).bind(categoryId).first();
        
        if (!existingCategory) {
            return new Response(JSON.stringify({ error: '分类不存在' }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 检查父分类是否存在且不能形成循环引用
        if (parent_id) {
            if (parseInt(parent_id) === parseInt(categoryId)) {
                return new Response(JSON.stringify({ error: '不能将分类设置为自己的父分类' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            const parent = await db.prepare(
                'SELECT id FROM categories WHERE id = ?'
            ).bind(parent_id).first();
            
            if (!parent) {
                return new Response(JSON.stringify({ error: '父分类不存在' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 检查循环引用
            const wouldCreateCycle = await this.checkCategoryCycle(db, categoryId, parent_id);
            if (wouldCreateCycle) {
                return new Response(JSON.stringify({ error: '不能设置此父分类，因为会形成循环引用' }), { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 更新分类
        const result = await db.prepare(
            'UPDATE categories SET name = ?, parent_id = ? WHERE id = ?'
        ).bind(name.trim(), parent_id, categoryId).run();
        
        return new Response(JSON.stringify({ 
            success: true,
            changes: result.meta.changes
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

export async function onRequestDelete(context) {
    const { env, request } = context;
    const db = env.D1_DATABASE;
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('id');
    
    try {
        if (!categoryId) {
            return new Response(JSON.stringify({ error: '分类ID不能为空' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 检查分类是否存在
        const existingCategory = await db.prepare(
            'SELECT id FROM categories WHERE id = ?'
        ).bind(categoryId).first();
        
        if (!existingCategory) {
            return new Response(JSON.stringify({ error: '分类不存在' }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 检查是否有子分类
        const childCategories = await db.prepare(
            'SELECT id FROM categories WHERE parent_id = ?'
        ).bind(categoryId).all();
        
        if (childCategories.results.length > 0) {
            return new Response(JSON.stringify({ 
                error: '请先删除或移动该分类下的子分类'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 开始事务
        await db.prepare('BEGIN TRANSACTION').run();
        
        try {
            // 获取该分类下的所有文章ID
            const articles = await db.prepare(
                'SELECT id FROM articles WHERE category_id = ?'
            ).bind(categoryId).all();
            
            const articleIds = articles.results.map(article => article.id);
            
            if (articleIds.length > 0) {
                // 删除文章标签关联
                await db.prepare(
                    `DELETE FROM article_tags WHERE article_id IN (${articleIds.map(() => '?').join(',')})`
                ).bind(...articleIds).run();
                
                // 删除文章
                await db.prepare(
                    `DELETE FROM articles WHERE id IN (${articleIds.map(() => '?').join(',')})`
                ).bind(...articleIds).run();
            }
            
            // 删除分类
            await db.prepare(
                'DELETE FROM categories WHERE id = ?'
            ).bind(categoryId).run();
            
            // 提交事务
            await db.prepare('COMMIT').run();
            
            return new Response(JSON.stringify({ 
                success: true,
                deleted_articles: articleIds.length
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            // 回滚事务
            await db.prepare('ROLLBACK').run();
            throw error;
        }
    } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 检查分类循环引用的辅助函数
async function checkCategoryCycle(db, categoryId, potentialParentId) {
    let currentId = potentialParentId;
    const visited = new Set([categoryId]);
    
    while (currentId) {
        if (visited.has(currentId)) {
            return true; // 发现循环
        }
        visited.add(currentId);
        
        const parent = await db.prepare(
            'SELECT parent_id FROM categories WHERE id = ?'
        ).bind(currentId).first();
        
        if (!parent || !parent.parent_id) {
            break; // 到达根节点
        }
        
        currentId = parent.parent_id;
    }
    
    return false; // 无循环
}