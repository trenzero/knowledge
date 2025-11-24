export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const sessionKey = 'user-authenticated';

    // 允许静态资源和API请求通过（除了需要认证的API）
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/public/') ||
        url.pathname === '/sw.js' ||
        url.pathname === '/manifest.json') {
        
        // 检查API请求是否需要认证（除了登录和导出导入）
        if (url.pathname.startsWith('/api/') && 
            !url.pathname.includes('/api/auth/') &&
            !url.pathname.includes('/api/export') &&
            !url.pathname.includes('/api/import')) {
            
            const session = await env.KV_NAMESPACE.get(sessionKey);
            if (!session) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        return await context.next();
    }

    // 检查会话
    const session = await env.KV_NAMESPACE.get(sessionKey);
    if (session) {
        return await context.next();
    }

    // 处理登录请求
    if (url.pathname === '/login' && request.method === 'POST') {
        const formData = await request.formData();
        const password = formData.get('password');
        
        // 这里使用环境变量中的密码，你需要在Cloudflare Pages设置中添加 PASSWORD 环境变量
        if (password === env.PASSWORD) {
            await env.KV_NAMESPACE.put(sessionKey, 'true', { expirationTtl: 60 * 60 * 24 }); // 24小时过期
            return Response.redirect(url.origin);
        } else {
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>知识库登录</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: system-ui; 
                            background: #1a1a1a; 
                            color: white; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100vh; 
                            margin: 0;
                        }
                        .login-container {
                            background: #2d2d2d;
                            padding: 2rem;
                            border-radius: 0.5rem;
                            border: 1px solid #404040;
                            width: 90%;
                            max-width: 400px;
                        }
                        h2 {
                            margin-bottom: 1.5rem;
                            text-align: center;
                        }
                        form {
                            display: flex;
                            flex-direction: column;
                            gap: 1rem;
                        }
                        input {
                            padding: 0.75rem;
                            border-radius: 0.5rem;
                            border: 1px solid #404040;
                            background: #1a1a1a;
                            color: white;
                        }
                        button {
                            padding: 0.75rem;
                            border-radius: 0.5rem;
                            border: none;
                            background: #4f46e5;
                            color: white;
                            cursor: pointer;
                            font-weight: 500;
                        }
                        button:hover {
                            background: #4338ca;
                        }
                        .error {
                            color: #ef4444;
                            text-align: center;
                            margin-top: 0.5rem;
                        }
                    </style>
                </head>
                <body>
                    <div class="login-container">
                        <h2>知识库登录</h2>
                        <form method="post" action="/login">
                            <input type="password" name="password" placeholder="请输入访问密码" required>
                            <button type="submit">进入知识库</button>
                            <div class="error">密码错误，请重试</div>
                        </form>
                    </div>
                </body>
                </html>
            `, { 
                headers: { 'Content-Type': 'text/html; charset=utf-8' } 
            });
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
                    body { 
                        font-family: system-ui; 
                        background: #1a1a1a; 
                        color: white; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0;
                    }
                    .login-container {
                        background: #2d2d2d;
                        padding: 2rem;
                        border-radius: 0.5rem;
                        border: 1px solid #404040;
                        width: 90%;
                        max-width: 400px;
                    }
                    h2 {
                        margin-bottom: 1.5rem;
                        text-align: center;
                    }
                    form {
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                    }
                    input {
                        padding: 0.75rem;
                        border-radius: 0.5rem;
                        border: 1px solid #404040;
                        background: #1a1a1a;
                        color: white;
                    }
                    button {
                        padding: 0.75rem;
                        border-radius: 0.5rem;
                        border: none;
                        background: #4f46e5;
                        color: white;
                        cursor: pointer;
                        font-weight: 500;
                    }
                    button:hover {
                        background: #4338ca;
                    }
                </style>
            </head>
            <body>
                <div class="login-container">
                    <h2>知识库登录</h2>
                    <form method="post" action="/login">
                        <input type="password" name="password" placeholder="请输入访问密码" required>
                        <button type="submit">进入知识库</button>
                    </form>
                </div>
            </body>
            </html>
        `, { 
            headers: { 'Content-Type': 'text/html; charset=utf-8' } 
        });
    }

    return await context.next();
}