export async function onRequestGet(context) {
  const { env } = context;
  const db = env.D1_DATABASE;
  
  try {
    // 获取多级分类
    const categories = await db.prepare(`
      WITH RECURSIVE category_tree AS (
        SELECT id, name, parent_id, sort_order, 0 as level
        FROM categories 
        WHERE parent_id IS NULL
        UNION ALL
        SELECT c.id, c.name, c.parent_id, c.sort_order, ct.level + 1
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
      )
      SELECT * FROM category_tree ORDER BY sort_order, name
    `).all();
    
    return new Response(JSON.stringify(categories), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
