export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const sessionKey = 'user-authenticated';

    console.log('中间件处理:', url.pathname);

    // 允许静态资源和API请求通过
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/public/') ||
        url.pathname === '/sw.js' ||
        url.pathname === '/manifest.json' ||
        url.pathname === '/debug.html' ||
        url.pathname === '/check-setup.html' ||
        url.pathname === '/diagnose.html') {
        
        console.log('允许访问静态资源或API:', url.pathname);
        return await context.next();
    }

    // 检查会话
    const session = await env.KV_NAMESPACE.get(sessionKey);
    console.log('会话状态:', session ? '已认证' : '未认证');

    if (session) {
        console.log('会话有效，允许访问');
        return await context.next();
    }

    // 处理登录请求
    if (url.pathname === '/login' && request.method === 'POST') {
        console.log('处理登录请求');
        const formData = await request.formData();
        const password = formData.get('password');
        
        // 使用环境变量中的密码
        const expectedPassword = env.PASSWORD;
        console.log('密码验证:', { 
            provided: password ? '***' : '空', 
            expected: expectedPassword ? '***' : '未设置' 
        });
        
        if (!expectedPassword) {
            console.error('环境变量PASSWORD未设置');
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>系统配置错误</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: system-ui; background: #1a1a1a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                        .error-container { background: #2d2d2d; padding: 2rem; border-radius: 0.5rem; border: 1px solid #404040; text-align: center; }
                        h2 { color: #ef4444; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <h2>系统配置错误</h2>
                        <p>管理员未设置访问密码，请联系系统管理员。</p>
                    </div>
                </body>
                </html>
            `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        if (password === expectedPassword) {
            console.log('密码正确，创建会话');
            await env.KV_NAMESPACE.put(sessionKey, 'true', { expirationTtl: 60 * 60 * 24 }); // 24小时过期
            return Response.redirect(url.origin);
        } else {
            console.log('密码错误');
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
                            font-size: 1rem;
                        }
                        button {
                            padding: 0.75rem;
                            border-radius: 0.5rem;
                            border: none;
                            background: #4f46e5;
                            color: white;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: 1rem;
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
                            <input type="password" name="password" placeholder="请输入访问密码" required autofocus>
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
        console.log('显示登录页面');
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
                        font-size: 1rem;
                    }
                    button {
                        padding: 0.75rem;
                        border-radius: 0.5rem;
                        border: none;
                        background: #4f46e5;
                        color: white;
                        cursor: pointer;
                        font-weight: 500;
                        font-size: 1rem;
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
                        <input type="password" name="password" placeholder="请输入访问密码" required autofocus>
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