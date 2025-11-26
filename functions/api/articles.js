export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.D1_DATABASE;
  const url = new URL(request.url);
  const articleId = url.searchParams.get('id');
  
  try {
    if (articleId) {
      // 获取单篇文章及其标签
      const article = await db.prepare(`
        SELECT a.*, c.name as category_name, 
               GROUP_CONCAT(t.name) as tags
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN article_tags at ON a.id = at.article_id
        LEFT JOIN tags t ON at.tag_id = t.id
        WHERE a.id = ?
        GROUP BY a.id
      `).bind(articleId).first();
      
      if (!article) {
        return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404 });
      }
      
      return new Response(JSON.stringify(article));
    } else {
      // 获取文章列表
      const categoryId = url.searchParams.get('category');
      const tag = url.searchParams.get('tag');
      
      let query = `
        SELECT a.*, c.name as category_name,
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
      
      return new Response(JSON.stringify(articles), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
