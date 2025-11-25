export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const sessionKey = 'user-authenticated';

    console.log('中间件处理请求:', url.pathname, request.method);

    // 允许静态资源和API请求通过
    if (url.pathname.startsWith('/api/') || 
        url.pathname.startsWith('/public/') ||
        url.pathname === '/sw.js' ||
        url.pathname === '/manifest.json' ||
        url.pathname === '/debug.html') {
        
        console.log('允许访问API或静态资源:', url.pathname);
        
        // 对于API请求，检查会话（除了登录接口）
        if (url.pathname.startsWith('/api/') && 
            !url.pathname.includes('/api/auth/login')) {
            
            const session = await env.KV_NAMESPACE.get(sessionKey);
            console.log('API请求会话状态:', session ? '已认证' : '未认证');
            
            if (!session) {
                console.log('API请求未认证，返回401');
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                    status: 401,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    }
                });
            }
        }
        
        // 添加CORS头
        const response = await next();
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return newResponse;
    }

    // 检查会话
    const session = await env.KV_NAMESPACE.get(sessionKey);
    console.log('页面请求会话状态:', session ? '已认证' : '未认证');

    if (session) {
        console.log('会话有效，允许访问页面');
        return await next();
    }

    // 处理登录请求
    if (url.pathname === '/login' && request.method === 'POST') {
        console.log('处理登录请求');
        const formData = await request.formData();
        const password = formData.get('password');
        
        // 这里使用环境变量中的密码
        if (password === env.PASSWORD) {
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

    console.log('允许访问页面:', url.pathname);
    return await next();
}
