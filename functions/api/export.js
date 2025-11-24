export async function onRequestGet(context) {
    const { env } = context;
    const db = env.D1_DATABASE;
    
    try {
        // 获取所有数据
        const categories = await db.prepare('SELECT * FROM categories').all();
        const articles = await db.prepare('SELECT * FROM articles').all();
        const tags = await db.prepare('SELECT * FROM tags').all();
        const articleTags = await db.prepare('SELECT * FROM article_tags').all();
        
        const exportData = {
            categories: categories.results,
            articles: articles.results,
            tags: tags.results,
            article_tags: articleTags.results,
            exported_at: new Date().toISOString()
        };
        
        return new Response(JSON.stringify(exportData), {
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