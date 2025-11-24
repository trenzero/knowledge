export async function onRequestGet(context) {
    const { env } = context;
    const db = env.D1_DATABASE;
    
    try {
        const tags = await db.prepare(`
            SELECT 
                t.*,
                COUNT(at.article_id) as count
            FROM tags t
            LEFT JOIN article_tags at ON t.id = at.tag_id
            GROUP BY t.id, t.name
            ORDER BY count DESC, t.name
        `).all();
        
        return new Response(JSON.stringify(tags.results), {
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