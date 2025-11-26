// 极简版本的知识库应用
(function() {
    'use strict';
    
    console.log('开始加载极简知识库应用');
    
    // 等待DOM完全加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSimpleApp);
    } else {
        setTimeout(initSimpleApp, 100);
    }
    
    function initSimpleApp() {
        console.log('初始化极简应用');
        
        try {
            // 隐藏加载状态，显示应用
            const loadingState = document.getElementById('loadingState');
            const appContainer = document.querySelector('.app-container');
            
            if (loadingState) loadingState.style.display = 'none';
            if (appContainer) {
                appContainer.style.display = 'flex';
                appContainer.style.opacity = '1';
            }
            
            // 检查必要元素
            const requiredElements = [
                'categoriesTree',
                'articlesList', 
                'newArticleBtn',
                'searchInput'
            ];
            
            const missingElements = [];
            requiredElements.forEach(id => {
                if (!document.getElementById(id)) {
                    missingElements.push(id);
                }
            });
            
            if (missingElements.length > 0) {
                console.error('缺少元素:', missingElements);
                showError('页面元素加载不完整: ' + missingElements.join(', '));
                return;
            }
            
            console.log('所有必要元素都存在');
            
            // 绑定基础事件
            bindSimpleEvents();
            
            // 加载数据
            loadSimpleData();
            
        } catch (error) {
            console.error('初始化失败:', error);
            showError('应用初始化失败: ' + error.message);
        }
    }
    
    function bindSimpleEvents() {
        try {
            // 新建文章按钮
            const newArticleBtn = document.getElementById('newArticleBtn');
            if (newArticleBtn) {
                newArticleBtn.addEventListener('click', function() {
                    alert('新建文章功能');
                });
            }
            
            // 搜索框
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    console.log('搜索:', e.target.value);
                });
            }
            
            // 主题切换
            const themeBtn = document.getElementById('toggleDarkMode');
            if (themeBtn) {
                themeBtn.addEventListener('click', toggleSimpleTheme);
            }
            
            console.log('基础事件绑定完成');
        } catch (error) {
            console.error('事件绑定失败:', error);
        }
    }
    
    function toggleSimpleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const button = document.getElementById('toggleDarkMode');
        if (button) {
            button.textContent = newTheme === 'dark' ? '切换浅色' : '切换深色';
        }
    }
    
    async function loadSimpleData() {
        try {
            console.log('开始加载数据...');
            
            // 加载分类
            await loadSimpleCategories();
            
            // 加载文章
            await loadSimpleArticles();
            
            console.log('数据加载完成');
            
        } catch (error) {
            console.error('数据加载失败:', error);
            showError('数据加载失败: ' + error.message);
        }
    }
    
    async function loadSimpleCategories() {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            
            const categories = await response.json();
            console.log('加载的分类:', categories);
            
            renderSimpleCategories(categories);
            
        } catch (error) {
            console.error('加载分类失败:', error);
            document.getElementById('categoriesTree').innerHTML = `
                <div class="error-message">
                    <p>加载分类失败</p>
                    <button onclick="window.simpleApp.loadSimpleCategories()">重试</button>
                </div>
            `;
        }
    }
    
    function renderSimpleCategories(categories) {
        const container = document.getElementById('categoriesTree');
        if (!container) return;
        
        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="category-item">暂无分类</div>';
            return;
        }
        
        let html = '';
        
        function renderCategory(category, level = 0) {
            const padding = level * 20 + 12;
            return `
                <div class="category-item" style="padding-left: ${padding}px" data-id="${category.id}">
                    <span>${escapeHtml(category.name)}</span>
                    <span class="category-count">${category.article_count || 0}</span>
                </div>
                ${(category.children || []).map(child => renderCategory(child, level + 1)).join('')}
            `;
        }
        
        categories.forEach(category => {
            html += renderCategory(category);
        });
        
        container.innerHTML = html;
        
        // 添加点击事件
        container.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', function() {
                const categoryId = this.dataset.id;
                loadArticlesByCategory(categoryId);
            });
        });
    }
    
    async function loadSimpleArticles(categoryId = null) {
        try {
            let url = '/api/articles';
            if (categoryId) url += '?category=' + categoryId;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            
            const articles = await response.json();
            console.log('加载的文章:', articles);
            
            renderSimpleArticles(articles);
            
        } catch (error) {
            console.error('加载文章失败:', error);
            document.getElementById('articlesList').innerHTML = `
                <div class="error-message">
                    <p>加载文章失败</p>
                    <button onclick="window.simpleApp.loadSimpleArticles()">重试</button>
                </div>
            `;
        }
    }
    
    function renderSimpleArticles(articles) {
        const container = document.getElementById('articlesList');
        if (!container) return;
        
        if (!articles || articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>没有找到文章</p>
                </div>
            `;
            return;
        }
        
        const html = articles.map(article => `
            <div class="article-item">
                <h3>${escapeHtml(article.title)}</h3>
                <div class="article-meta">
                    <span>${new Date(article.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>${article.category_name || '未分类'}</span>
                </div>
                <div class="article-content-preview">
                    ${escapeHtml(article.content.substring(0, 200))}...
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    async function loadArticlesByCategory(categoryId) {
        await loadSimpleArticles(categoryId);
    }
    
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ef4444;
            color: white;
            padding: 1rem;
            z-index: 10000;
            text-align: center;
            font-family: system-ui;
        `;
        errorDiv.innerHTML = `
            <strong>错误:</strong> ${message}
            <button onclick="this.parentElement.remove()" style="margin-left: 1rem; background: white; color: #ef4444; border: none; padding: 0.25rem 0.5rem; border-radius: 0.25rem; cursor: pointer;">×</button>
        `;
        document.body.appendChild(errorDiv);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 暴露到全局，便于调试
    window.simpleApp = {
        loadSimpleCategories,
        loadSimpleArticles,
        loadArticlesByCategory
    };
    
})();
