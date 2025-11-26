// 温馨提示：你需要将下方代码中`你的密码`替换为你自己设定的密码。

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionKey = 'user-authenticated';

  // 检查静态资源或API请求，避免拦截
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/public/')) {
    // 但对于/api/的请求，我们也需要验证，除了登录接口本身
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/login') {
      const session = await env.KV_NAMESPACE.get(sessionKey);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
    }
    return await context.next();
  }

  // 检查会话
  const session = await env.KV_NAMESPACE.get(sessionKey);
  if (session) {
    return await context.next();
  }

  // 如果是提交登录请求
  if (url.pathname === '/login' && request.method === 'POST') {
    const formData = await request.formData();
    const password = formData.get('password');
    
    if (password === '你的密码') { // 请务必更改这个密码
      await env.KV_NAMESPACE.put(sessionKey, 'true', { expirationTtl: 60 * 60 * 24 }); // 24小时过期
      return Response.redirect(url.origin);
    } else {
      return new Response(`
        <html><body>
          <form method="post">
            <input type="password" name="password" placeholder="密码">
            <button type="submit">登录</button>
            <p style="color: red;">密码错误</p>
          </form>
        </body></html>
      `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  }

  // 显示登录页面
  if (!session && url.pathname !== '/login') {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>知识库登录</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: system-ui; background: #1a1a1a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; }
          form { display: flex; flex-direction: column; gap: 1rem; }
          input, button { padding: 0.75rem; border-radius: 0.5rem; border: none; }
          button { background: #4f46e5; color: white; cursor: pointer; }
        </style>
      </head>
      <body>
        <form method="post" action="/login">
          <h2>知识库登录</h2>
          <input type="password" name="password" placeholder="请输入访问密码" required>
          <button type="submit">进入知识库</button>
        </form>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return await context.next();
}
