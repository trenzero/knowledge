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
