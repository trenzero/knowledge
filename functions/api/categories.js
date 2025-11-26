export async function onRequestGet(context) {
    const { env } = context;
    const db = env.D1_DATABASE;
    
    try {
        // 获取分类及其文章数量
        const categories = await db.prepare(`
            WITH RECURSIVE category_tree AS (
                SELECT 
                    id, 
                    name, 
                    parent_id, 
                    sort_order,
                    0 as level
                FROM categories 
                WHERE parent_id IS NULL
                
                UNION ALL
                
                SELECT 
                    c.id, 
                    c.name, 
                    c.parent_id, 
                    c.sort_order,
                    ct.level + 1 as level
                FROM categories c
                INNER JOIN category_tree ct ON c.parent_id = ct.id
            )
            SELECT 
                ct.*,
                COUNT(a.id) as article_count
            FROM category_tree ct
            LEFT JOIN articles a ON ct.id = a.category_id
            GROUP BY ct.id, ct.name, ct.parent_id, ct.sort_order, ct.level
            ORDER BY ct.sort_order, ct.name
        `).all();
        
        // 构建树形结构
        const buildTree = (categories, parentId = null) => {
            return categories
                .filter(cat => cat.parent_id === parentId)
                .map(cat => ({
                    ...cat,
                    children: buildTree(categories, cat.id)
                }));
        };
        
        const categoryTree = buildTree(categories);
        
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
        
        if (!name) {
            return new Response(JSON.stringify({ error: '分类名称不能为空' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const result = await db.prepare(
            'INSERT INTO categories (name, parent_id) VALUES (?, ?)'
        ).bind(name, parent_id).run();
        
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
