export async function onRequestPost(context) {
    const { env, request } = context;
    const db = env.D1_DATABASE;
    
    try {
        const { categories, articles, tags, article_tags } = await request.json();
        
        // 开始事务
        await db.prepare('BEGIN TRANSACTION').run();
        
        try {
            // 导入分类
            for (const category of categories) {
                await db.prepare(
                    'INSERT OR IGNORE INTO categories (id, name, parent_id, sort_order) VALUES (?, ?, ?, ?)'
                ).bind(category.id, category.name, category.parent_id, category.sort_order || 0).run();
            }
            
            // 导入标签
            for (const tag of tags) {
                await db.prepare(
                    'INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)'
                ).bind(tag.id, tag.name).run();
            }
            
            // 导入文章
            for (const article of articles) {
                await db.prepare(
                    'INSERT OR IGNORE INTO articles (id, title, content, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(
                    article.id, 
                    article.title, 
                    article.content, 
                    article.category_id,
                    article.created_at,
                    article.updated_at
                ).run();
            }
            
            // 导入文章标签关联
            for (const at of article_tags) {
                await db.prepare(
                    'INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)'
                ).bind(at.article_id, at.tag_id).run();
            }
            
            // 提交事务
            await db.prepare('COMMIT').run();
            
            return new Response(JSON.stringify({ success: true }), {
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