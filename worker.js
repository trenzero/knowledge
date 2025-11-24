export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 处理
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // API 路由
    if (path.startsWith('/api/')) {
      return handleApiRequest(request, env, path, method);
    }

    // 服务前端静态文件
    return await env.ASSETS.fetch(request);
  },
};

async function handleApiRequest(request, env, path, method) {
  const authHeader = request.headers.get('Authorization');
  let currentUser = null;

  // 验证用户（除了注册和登录端点）
  if (!path.includes('/auth/register') && !path.includes('/auth/login') && !path.includes('/auth/admin')) {
    currentUser = await verifyToken(authHeader, env);
    if (!currentUser) {
      return jsonResponse({ error: '未授权访问' }, 401);
    }
  }

  try {
    // 认证路由
    if (path.includes('/auth/')) {
      return await handleAuthRoutes(request, env, path, method);
    }

    // 文章路由
    if (path.includes('/articles/')) {
      return await handleArticleRoutes(request, env, path, method, currentUser);
    }

    // 管理路由
    if (path.includes('/admin/')) {
      return await handleAdminRoutes(request, env, path, method, currentUser);
    }

    // AI 路由
    if (path.includes('/ai/')) {
      return await handleAiRoutes(request, env, path, method, currentUser);
    }

    return jsonResponse({ error: '接口不存在' }, 404);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// 认证路由处理
async function handleAuthRoutes(request, env, path, method) {
  if (path.endsWith('/auth/register') && method === 'POST') {
    const { email, username, password } = await request.json();
    
    // 检查用户是否已存在
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (existingUser) {
      return jsonResponse({ error: '用户已存在' }, 400);
    }

    // 创建新用户（待审核状态）
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    
    await env.DB.prepare(
      'INSERT INTO users (id, email, username, password_hash, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, email, username, passwordHash, 'pending').run();

    return jsonResponse({ 
      message: '注册成功，请等待管理员审核',
      userId 
    });
  }

  if (path.endsWith('/auth/login') && method === 'POST') {
    const { email, password } = await request.json();
    
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return jsonResponse({ error: '邮箱或密码错误' }, 401);
    }

    if (user.status !== 'approved') {
      return jsonResponse({ error: '账户待管理员审核，请耐心等待' }, 401);
    }

    // 创建会话令牌
    const token = await createSessionToken(user, env);
    return jsonResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  }

  if (path.endsWith('/auth/me') && method === 'GET') {
    const user = await verifyToken(authHeader, env);
    return jsonResponse({ user });
  }

  return jsonResponse({ error: '认证接口不存在' }, 404);
}

// 文章路由处理
async function handleArticleRoutes(request, env, path, method, user) {
  // 获取文章列表
  if (path.endsWith('/articles') && method === 'GET') {
    const { page = 1, category, search } = Object.fromEntries(new URL(request.url).searchParams);
    const limit = 10;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, u.username as author_name 
      FROM articles a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE a.is_public = TRUE OR a.user_id = ?
    `;
    let params = [user.id];

    if (category) {
      query += ' AND a.category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY a.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const articles = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse({ articles: articles.results });
  }

  // 创建文章
  if (path.endsWith('/articles') && method === 'POST') {
    const { title, content, category, tags, is_public = true } = await request.json();
    const articleId = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO articles (id, title, content, category, tags, user_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(articleId, title, content, category, JSON.stringify(tags || []), user.id, is_public ? 1 : 0).run();

    // 保存初始版本
    await env.DB.prepare(
      'INSERT INTO article_versions (id, article_id, title, content, version) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), articleId, title, content, 1).run();

    return jsonResponse({ articleId, message: '文章创建成功' });
  }

  // 获取单个文章
  if (path.match(/\/articles\/[^\/]+$/) && method === 'GET') {
    const articleId = path.split('/').pop();
    
    const article = await env.DB.prepare(`
      SELECT a.*, u.username as author_name 
      FROM articles a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE a.id = ? AND (a.is_public = TRUE OR a.user_id = ?)
    `).bind(articleId, user.id).first();

    if (!article) {
      return jsonResponse({ error: '文章不存在或无权访问' }, 404);
    }

    return jsonResponse({ article });
  }

  // 更新文章
  if (path.match(/\/articles\/[^\/]+$/) && method === 'PUT') {
    const articleId = path.split('/').pop();
    const { title, content, category, tags, is_public } = await request.json();

    // 检查文章所有权
    const existingArticle = await env.DB.prepare(
      'SELECT * FROM articles WHERE id = ? AND user_id = ?'
    ).bind(articleId, user.id).first();

    if (!existingArticle) {
      return jsonResponse({ error: '文章不存在或无权编辑' }, 404);
    }

    // 获取当前版本号
    const latestVersion = await env.DB.prepare(
      'SELECT MAX(version) as max_version FROM article_versions WHERE article_id = ?'
    ).bind(articleId).first();

    const newVersion = (latestVersion.max_version || 0) + 1;

    // 更新文章
    await env.DB.prepare(
      'UPDATE articles SET title = ?, content = ?, category = ?, tags = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(title, content, category, JSON.stringify(tags || []), is_public ? 1 : 0, articleId).run();

    // 保存新版本
    await env.DB.prepare(
      'INSERT INTO article_versions (id, article_id, title, content, version) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), articleId, title, content, newVersion).run();

    return jsonResponse({ message: '文章更新成功' });
  }

  return jsonResponse({ error: '文章接口不存在' }, 404);
}

// AI 路由处理 - DeepSeek 集成
async function handleAiRoutes(request, env, path, method, user) {
  if (path.endsWith('/ai/generate') && method === 'POST') {
    const { prompt, context } = await request.json();

    // 使用 Cloudflare Workers AI 调用 DeepSeek 模型
    const response = await env.AI.run('@cf/deepseek-ai/deepseek-math-7b-instruct', {
      prompt: `${context}\n\n基于以上内容，请回答或扩展：${prompt}`,
      max_tokens: 1000,
      temperature: 0.7
    });

    return jsonResponse({ 
      response: response.response,
      usage: response.usage 
    });
  }

  if (path.endsWith('/ai/summarize') && method === 'POST') {
    const { content } = await request.json();

    const response = await env.AI.run('@cf/deepseek-ai/deepseek-math-7b-instruct', {
      prompt: `请总结以下内容：\n\n${content}\n\n总结：`,
      max_tokens: 500,
      temperature: 0.5
    });

    return jsonResponse({ 
      summary: response.response 
    });
  }

  return jsonResponse({ error: 'AI接口不存在' }, 404);
}

// 管理员路由处理
async function handleAdminRoutes(request, env, path, method, user) {
  // 检查管理员权限（这里简化处理，实际应用中需要更严格的权限检查）
  const isAdmin = await checkAdminPermission(user.id, env);
  if (!isAdmin) {
    return jsonResponse({ error: '需要管理员权限' }, 403);
  }

  // 获取待审核用户列表
  if (path.endsWith('/admin/pending-users') && method === 'GET') {
    const users = await env.DB.prepare(
      'SELECT id, email, username, created_at FROM users WHERE status = ? ORDER BY created_at DESC'
    ).bind('pending').all();

    return jsonResponse({ users: users.results });
  }

  // 审核用户
  if (path.endsWith('/admin/approve-user') && method === 'POST') {
    const { userId, action } = await request.json(); // action: 'approve' or 'reject'

    const status = action === 'approve' ? 'approved' : 'rejected';
    await env.DB.prepare(
      'UPDATE users SET status = ?, approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?'
    ).bind(status, user.id, userId).run();

    return jsonResponse({ message: `用户已${action === 'approve' ? '通过' : '拒绝'}` });
  }

  // 数据导出
  if (path.endsWith('/admin/export') && method === 'GET') {
    const articles = await env.DB.prepare(
      'SELECT * FROM articles ORDER BY created_at DESC'
    ).all();

    const users = await env.DB.prepare(
      'SELECT id, email, username, status, created_at FROM users'
    ).all();

    const exportData = {
      exported_at: new Date().toISOString(),
      articles: articles.results,
      users: users.results
    };

    return jsonResponse(exportData);
  }

  // 数据导入
  if (path.endsWith('/admin/import') && method === 'POST') {
    const importData = await request.json();

    if (importData.articles) {
      for (const article of importData.articles) {
        await env.DB.prepare(
          `INSERT OR REPLACE INTO articles (id, title, content, category, tags, user_id, is_public, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          article.id,
          article.title,
          article.content,
          article.category,
          JSON.stringify(article.tags || []),
          article.user_id,
          article.is_public ? 1 : 0,
          article.created_at,
          article.updated_at
        ).run();
      }
    }

    return jsonResponse({ message: '数据导入成功' });
  }

  return jsonResponse({ error: '管理接口不存在' }, 404);
}

// 工具函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function hashPassword(password) {
  // 实际应用中应该使用 bcrypt 等安全哈希算法
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

async function createSessionToken(user, env) {
  const token = crypto.randomUUID();
  const sessionData = {
    userId: user.id,
    email: user.email,
    username: user.username,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24小时
  };
  
  await env.KV.put(`session:${token}`, JSON.stringify(sessionData), {
    expirationTtl: 24 * 60 * 60 // 24小时
  });
  
  return token;
}

async function verifyToken(authHeader, env) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const sessionData = await env.KV.get(`session:${token}`, 'json');
  
  if (!sessionData || sessionData.expiresAt < Date.now()) {
    return null;
  }
  
  return sessionData;
}

async function checkAdminPermission(userId, env) {
  // 简化处理：第一个注册的用户自动成为管理员
  // 实际应用中应该有更完善的权限系统
  const userCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  return userCount.count === 1;
}