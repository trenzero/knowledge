// 简化版本，避免复杂的类结构
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化知识库');
    
    // 简单的数据加载函数
    async function loadData() {
        console.log('开始加载数据...');
        
        try {
            // 加载分类
            console.log('加载分类...');
            const categoriesResponse = await fetch('/api/categories');
            if (!categoriesResponse.ok) throw new Error('分类加载失败: ' + categoriesResponse.status);
            const categories = await categoriesResponse.json();
            console.log('分类加载成功:', categories);
            
            // 加载文章
            console.log('加载文章...');
            const articlesResponse = await fetch('/api/articles');
            if (!articlesResponse.ok) throw new Error('文章加载失败: ' + articlesResponse.status);
            const articles = await articlesResponse.json();
            console.log('文章加载成功:', articles);
            
            // 简单渲染
            renderCategories(categories);
            renderArticles(articles);
            
            console.log('数据加载和渲染完成');
            
        } catch (error) {
            console.error('数据加载失败:', error);
            showError('数据加载失败: ' + error.message);
        }
    }
    
    function renderCategories(categories) {
        const container = document.getElementById('categoriesTree');
        if (!container) {
            console.error('分类容器未找到');
            return;
        }
        
        if (!categories || categories.length === 0) {
            container.innerHTML = '<div class="category-item">暂无分类</div>';
            return;
        }
        
        let html = '';
        
        function renderCategory(category, level = 0) {
            if (!category) return '';
            
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
    
    function renderArticles(articles) {
        const container = document.getElementById('articlesList');
        if (!container) {
            console.error('文章容器未找到');
            return;
        }
        
        if (!articles || articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>没有找到文章</p>
                </div>
            `;
            return;
        }
        
        const html = articles.map(article => `
            <div class="article-item" data-id="${article.id}">
                <h3>${escapeHtml(article.title)}</h3>
                <div class="article-meta">
                    <span>${new Date(article.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>${article.category_name || '未分类'}</span>
                </div>
                ${article.tags ? `
                <div class="article-tags">
                    ${article.tags.split(',').map(tag => 
                        `<span class="article-tag">${escapeHtml(tag.trim())}</span>`
                    ).join('')}
                </div>
                ` : ''}
                <div class="article-content-preview">
                    ${escapeHtml(article.content.substring(0, 200))}...
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    async function loadArticlesByCategory(categoryId) {
        try {
            const response = await fetch(`/api/articles?category=${categoryId}`);
            if (!response.ok) throw new Error('文章加载失败');
            const articles = await response.json();
            renderArticles(articles);
        } catch (error) {
            console.error('加载分类文章失败:', error);
            showError('加载文章失败: ' + error.message);
        }
    }
    
    function showError(message) {
        // 简单的错误显示
        alert('错误: ' + message);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 绑定基本事件
    function bindEvents() {
        const newArticleBtn = document.getElementById('newArticleBtn');
        if (newArticleBtn) {
            newArticleBtn.addEventListener('click', function() {
                alert('新建文章功能');
            });
        }
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                console.log('搜索:', e.target.value);
            });
        }
    }
    
    // 启动
    bindEvents();
    loadData();
});
