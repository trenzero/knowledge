class KnowledgeBase {
    constructor() {
        this.currentArticle = null;
        this.currentCategory = null;
        this.currentTag = null;
        this.categories = [];
        this.tags = [];
        this.articles = [];
        
        // 性能优化相关
        this.cache = new Map();
        this.debounceTimers = new Map();
        this.intersectionObserver = null;
        
        console.log('KnowledgeBase 构造函数调用');
        
        // 延迟初始化，确保DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            setTimeout(() => this.init(), 100);
        }
    }
    
    async init() {
        console.log('KnowledgeBase init() 开始执行');
        
        try {
            // 检查必要的DOM元素是否存在
            if (!this.checkRequiredElements()) {
                console.error('必要的DOM元素未找到，初始化失败');
                return;
            }
            
            // 初始化懒加载观察器
            this.initLazyLoading();
            
            // 检查PWA支持
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => console.log('SW registered'))
                    .catch(error => console.log('SW registration failed'));
            }
            
            console.log('开始加载数据...');
            
            // 顺序加载数据，确保依赖关系
            await this.loadCategories();
            await this.loadTags();
            await this.loadArticles();
            
            console.log('所有数据加载完成');
            
            // 绑定事件
            this.bindEvents();
            
            // 应用保存的主题
            this.applySavedTheme();
            
        } catch (error) {
            console.error('初始化过程中出错:', error);
            this.showGlobalError('系统初始化失败: ' + error.message);
        }
    }
    
    checkRequiredElements() {
        const requiredElements = [
            'categoriesTree',
            'articlesList',
            'newArticleBtn',
            'searchInput'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('缺少必要的DOM元素:', missingElements);
            return false;
        }
        
        return true;
    }
    
    showGlobalError(message) {
        // 在页面顶部显示全局错误
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
    
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add('loaded');
                        this.intersectionObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });
        }
    }
    
    bindEvents() {
        try {
            // 文章操作
            document.getElementById('newArticleBtn').addEventListener('click', () => this.showEditor());
            document.getElementById('saveArticleBtn').addEventListener('click', () => this.saveArticle());
            document.getElementById('cancelEditBtn').addEventListener('click', () => this.hideEditor());
            
            // 分类操作
            document.getElementById('newCategoryBtn').addEventListener('click', () => this.showCategoryModal());
            document.getElementById('saveCategoryBtn').addEventListener('click', () => this.saveCategory());
            document.getElementById('cancelCategoryBtn').addEventListener('click', () => this.hideCategoryModal());
            
            // 分类编辑操作
            document.getElementById('updateCategoryBtn').addEventListener('click', () => this.updateCategory());
            document.getElementById('deleteCategoryBtn').addEventListener('click', () => this.deleteCategory());
            document.getElementById('cancelEditCategoryBtn').addEventListener('click', () => this.hideEditCategoryModal());
            
            // 数据管理
            document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
            document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
            document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
            
            // 主题切换
            document.getElementById('toggleDarkMode').addEventListener('click', () => this.toggleTheme());
            
            // 防抖搜索
            document.getElementById('searchInput').addEventListener('input', 
                this.debounce((e) => this.searchArticles(e.target.value), 300)
            );
            
            console.log('所有事件绑定完成');
        } catch (error) {
            console.error('事件绑定失败:', error);
        }
    }
    
    // 防抖函数
    debounce(func, wait) {
        return (...args) => {
            clearTimeout(this.debounceTimers.get(func));
            this.debounceTimers.set(func, setTimeout(() => func.apply(this, args), wait));
        };
    }
    
    async loadCategories() {
        try {
            console.log('开始加载分类...');
            this.showCategoriesLoading();
            
            const response = await fetch('/api/categories');
            console.log('分类API响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('分类API错误响应:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('分类API返回数据:', data);
            
            // 检查返回的数据结构
            if (data && data.error) {
                throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
            }
            
            if (!Array.isArray(data)) {
                console.warn('分类API返回非数组数据:', data);
                this.categories = [];
            } else {
                this.categories = data;
                console.log(`成功加载 ${data.length} 个分类`);
            }
            
            this.renderCategories();
            this.renderCategorySelects();
            
        } catch (error) {
            console.error('加载分类失败:', error);
            this.showCategoriesError(error.message);
            throw error;
        }
    }
    
    async loadTags() {
        try {
            console.log('开始加载标签...');
            
            const response = await fetch('/api/tags');
            console.log('标签API响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('标签API错误响应:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
            }
            
            const data = await response.json();
            console.log('标签API返回数据:', data);
            
            if (data && data.error) {
                throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
            }
            
            if (!Array.isArray(data)) {
                console.warn('标签API返回非数组数据:', data);
                this.tags = [];
            } else {
                this.tags = data;
                console.log(`成功加载 ${data.length} 个标签`);
            }
            
            this.renderTags();
            
        } catch (error) {
            console.error('加载标签失败:', error);
            // 不阻止应用继续运行
        }
    }
    
    async loadArticles(categoryId = null, tag = null) {
        try {
            console.log('开始加载文章...', { categoryId, tag });
            this.showArticlesLoading();
            
            let url = '/api/articles';
            const params = new URLSearchParams();
            
            if (categoryId) params.append('category', categoryId);
            if (tag) params.append('tag', tag);
            
            if (params.toString()) url += '?' + params.toString();
            
            console.log('请求URL:', url);
            
            const response = await fetch(url);
            console.log('文章API响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('文章API错误响应:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
            }
            
            const articles = await response.json();
            console.log('文章API返回数据:', articles);
            
            if (articles && articles.error) {
                throw new Error(articles.error + (articles.details ? `: ${articles.details}` : ''));
            }
            
            if (!Array.isArray(articles)) {
                console.warn('文章API返回非数组数据:', articles);
                this.articles = [];
            } else {
                this.articles = articles;
                console.log(`成功加载 ${articles.length} 篇文章`);
            }
            
            this.renderArticles(this.articles);
            this.updateContentTitle(categoryId, tag);
            
        } catch (error) {
            console.error('加载文章失败:', error);
            this.showArticlesError(error.message);
            throw error;
        }
    }
    
    showCategoriesLoading() {
        const container = document.getElementById('categoriesTree');
        if (!container) return;
        
        container.innerHTML = `
            <div class="category-item">
                <div class="skeleton skeleton-text" style="width: 80%"></div>
            </div>
            <div class="category-item">
                <div class="skeleton skeleton-text" style="width: 60%"></div>
            </div>
        `;
    }
    
    showArticlesLoading() {
        const container = document.getElementById('articlesList');
        if (!container) return;
        
        container.innerHTML = `
            <div class="article-item">
                <div class="skeleton skeleton-text" style="width: 70%"></div>
                <div class="skeleton skeleton-text" style="width: 50%"></div>
                <div class="skeleton skeleton-text" style="width: 90%"></div>
                <div class="skeleton skeleton-text" style="width: 90%"></div>
            </div>
            <div class="article-item">
                <div class="skeleton skeleton-text" style="width: 60%"></div>
                <div class="skeleton skeleton-text" style="width: 40%"></div>
                <div class="skeleton skeleton-text" style="width: 85%"></div>
                <div class="skeleton skeleton-text" style="width: 85%"></div>
            </div>
        `;
    }
    
    showCategoriesError(message) {
        const container = document.getElementById('categoriesTree');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-message">
                <p>加载分类失败</p>
                <p style="font-size: 0.875rem; opacity: 0.8;">${message}</p>
                <button class="btn-secondary" onclick="knowledgeBase.loadCategories()" style="margin-top: 0.5rem;">
                    重试加载
                </button>
            </div>
        `;
    }
    
    showArticlesError(message) {
        const container = document.getElementById('articlesList');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-message">
                <p>加载文章失败</p>
                <p style="font-size: 0.875rem; opacity: 0.8;">${message}</p>
                <button class="btn-secondary" onclick="knowledgeBase.loadArticles()" style="margin-top: 0.5rem;">
                    重试加载
                </button>
            </div>
        `;
    }
    
    renderCategories() {
        const container = document.getElementById('categoriesTree');
        if (!container) {
            console.error('分类容器未找到');
            return;
        }
        
        container.innerHTML = '';
        
        if (!this.categories || this.categories.length === 0) {
            container.innerHTML = `
                <div class="category-item">
                    <span>暂无分类</span>
                    <button class="btn-category-edit" onclick="knowledgeBase.showCategoryModal()" title="添加分类">➕</button>
                </div>
            `;
            return;
        }
        
        const renderCategory = (category, level = 0) => {
            if (!category || typeof category !== 'object') {
                console.warn('无效的分类数据:', category);
                return;
            }
            
            const div = document.createElement('div');
            div.className = `category-item ${this.currentCategory === category.id ? 'active' : ''}`;
            div.style.paddingLeft = `${level * 20 + 12}px`;
            div.dataset.id = category.id;
            div.innerHTML = `
                <span>${this.escapeHtml(category.name || '未命名分类')}</span>
                <div class="category-actions">
                    <span class="category-count">${category.article_count || 0}</span>
                    <button class="btn-category-edit" title="编辑分类">✏️</button>
                </div>
            `;
            
            // 分类点击事件
            div.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-category-edit')) {
                    e.stopPropagation();
                    this.editCategory(category);
                    return;
                }
                
                this.currentCategory = category.id;
                this.currentTag = null;
                this.loadArticles(category.id);
                this.highlightActiveCategory();
            });
            
            container.appendChild(div);
            
            // 渲染子分类
            if (category.children && Array.isArray(category.children) && category.children.length > 0) {
                category.children.forEach(child => renderCategory(child, level + 1));
            }
        };
        
        this.categories.forEach(category => renderCategory(category));
    }
    
    renderTags() {
        const container = document.getElementById('tagsCloud');
        if (!container) {
            console.error('标签容器未找到');
            return;
        }
        
        container.innerHTML = '';
        
        if (!this.tags || this.tags.length === 0) {
            container.innerHTML = '<div>暂无标签</div>';
            return;
        }
        
        this.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = `tag ${this.currentTag === tag.name ? 'active' : ''}`;
            span.textContent = `${tag.name} (${tag.count || 0})`;
            
            span.addEventListener('click', () => {
                this.currentTag = tag.name;
                this.currentCategory = null;
                this.loadArticles(null, tag.name);
                this.highlightActiveTag();
            });
            
            container.appendChild(span);
        });
    }
    
    renderArticles(articles) {
        const container = document.getElementById('articlesList');
        if (!container) {
            console.error('文章容器未找到');
            return;
        }
        
        if (!articles || articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>没有找到文章</p>
                    <button class="btn-primary" onclick="knowledgeBase.showEditor()" style="margin-top: 1rem;">
                        创建第一篇文章
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = articles.map(article => `
            <div class="article-item" data-id="${article.id}">
                <h3>${this.escapeHtml(article.title)}</h3>
                <div class="article-meta">
                    <span>${new Date(article.created_at).toLocaleDateString('zh-CN')}</span>
                    <span>${article.category_name || '未分类'}</span>
                </div>
                ${article.tags ? `
                <div class="article-tags">
                    ${article.tags.split(',').map(tag => 
                        `<span class="article-tag">${this.escapeHtml(tag.trim())}</span>`
                    ).join('')}
                </div>
                ` : ''}
                <div class="article-content-preview">
                    ${this.escapeHtml(article.content.substring(0, 200))}...
                </div>
            </div>
        `).join('');
        
        // 添加点击事件
        container.querySelectorAll('.article-item').forEach(item => {
            item.addEventListener('click', () => {
                const articleId = item.dataset.id;
                this.editArticle(articleId);
            });
        });
    }
    
    renderCategorySelects() {
        const articleSelect = document.getElementById('articleCategory');
        const categorySelect = document.getElementById('categoryParent');
        const editCategorySelect = document.getElementById('editCategoryParent');
        
        if (!articleSelect || !categorySelect) {
            console.error('分类选择器未找到');
            return;
        }
        
        const renderOptions = (select, categories, level = 0) => {
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = ' '.repeat(level * 2) + category.name;
                select.appendChild(option);
                
                if (category.children && category.children.length > 0) {
                    renderOptions(select, category.children, level + 1);
                }
            });
        };
        
        articleSelect.innerHTML = '<option value="">选择分类</option>';
        categorySelect.innerHTML = '<option value="">无父分类（顶级分类）</option>';
        if (editCategorySelect) {
            editCategorySelect.innerHTML = '<option value="">无父分类（顶级分类）</option>';
        }
        
        renderOptions(articleSelect, this.categories);
        renderOptions(categorySelect, this.categories);
        if (editCategorySelect) {
            renderOptions(editCategorySelect, this.categories);
        }
    }
    
    async editArticle(articleId) {
        try {
            const response = await fetch(`/api/articles?id=${articleId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const article = await response.json();
            
            this.currentArticle = article;
            this.showEditor();
            
            document.getElementById('articleTitle').value = article.title;
            document.getElementById('articleContent').value = article.content;
            document.getElementById('articleCategory').value = article.category_id;
            document.getElementById('articleTags').value = article.tags || '';
        } catch (error) {
            console.error('加载文章失败:', error);
            alert('加载文章失败: ' + error.message);
        }
    }
    
    async saveArticle() {
        const title = document.getElementById('articleTitle').value.trim();
        const content = document.getElementById('articleContent').value.trim();
        const categoryId = document.getElementById('articleCategory').value;
        const tags = document.getElementById('articleTags').value.split(',').map(t => t.trim()).filter(t => t);
        
        if (!title || !content || !categoryId) {
            alert('请填写标题、内容和选择分类');
            return;
        }
        
        try {
            const articleData = {
                title,
                content,
                category_id: parseInt(categoryId),
                tags
            };
            
            let url = '/api/articles';
            let method = 'POST';
            
            if (this.currentArticle) {
                url += `?id=${this.currentArticle.id}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(articleData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.hideEditor();
                await this.loadArticles(this.currentCategory, this.currentTag);
                await this.loadCategories();
                await this.loadTags();
                this.showSuccess('保存成功！');
            } else {
                throw new Error(result.error || '保存失败');
            }
        } catch (error) {
            console.error('保存文章失败:', error);
            alert('保存文章失败: ' + error.message);
        }
    }
    
    async saveCategory() {
        const name = document.getElementById('categoryName').value.trim();
        const parentId = document.getElementById('categoryParent').value || null;
        
        if (!name) {
            alert('请输入分类名称');
            return;
        }
        
        try {
            const categoryData = { 
                name, 
                parent_id: parentId ? parseInt(parentId) : null 
            };
            
            const response = await fetch('/api/categories', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(categoryData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.hideCategoryModal();
                await this.loadCategories();
                this.showSuccess('分类创建成功！');
            } else {
                throw new Error(result.error || '保存失败');
            }
        } catch (error) {
            console.error('保存分类失败:', error);
            alert('保存分类失败: ' + error.message);
        }
    }
    
    editCategory(category) {
        document.getElementById('editCategoryModal').style.display = 'flex';
        document.getElementById('editCategoryId').value = category.id;
        document.getElementById('editCategoryName').value = category.name;
        document.getElementById('editCategoryParent').value = category.parent_id || '';
        
        // 填充父分类选择器（排除自己及其子分类）
        this.renderEditCategoryParentSelect(category.id);
    }
    
    async updateCategory() {
        const id = document.getElementById('editCategoryId').value;
        const name = document.getElementById('editCategoryName').value.trim();
        const parentId = document.getElementById('editCategoryParent').value || null;
        
        if (!name) {
            alert('请输入分类名称');
            return;
        }
        
        try {
            const categoryData = { 
                name, 
                parent_id: parentId ? parseInt(parentId) : null 
            };
            
            const response = await fetch(`/api/categories?id=${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(categoryData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.hideEditCategoryModal();
                await this.loadCategories();
                this.showSuccess('分类更新成功！');
            } else {
                throw new Error(result.error || '更新失败');
            }
        } catch (error) {
            console.error('更新分类失败:', error);
            alert('更新分类失败: ' + error.message);
        }
    }
    
    async deleteCategory() {
        const id = document.getElementById('editCategoryId').value;
        const categoryName = document.getElementById('editCategoryName').value;
        
        if (!confirm(`确定要删除分类 "${categoryName}" 吗？此操作将同时删除该分类下的所有文章，且无法恢复。`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/categories?id=${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.hideEditCategoryModal();
                await this.loadCategories();
                await this.loadArticles();
                this.showSuccess('分类删除成功！');
            } else {
                throw new Error(result.error || '删除失败');
            }
        } catch (error) {
            console.error('删除分类失败:', error);
            alert('删除分类失败: ' + error.message);
        }
    }
    
    renderEditCategoryParentSelect(excludeId) {
        const select = document.getElementById('editCategoryParent');
        if (!select) return;
        
        select.innerHTML = '<option value="">无父分类（顶级分类）</option>';
        
        const renderOptions = (categories, level = 0, parentId = null) => {
            categories.forEach(category => {
                // 跳过要排除的分类及其子分类
                if (category.id == excludeId) return;
                
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = ' '.repeat(level * 2) + category.name;
                option.disabled = this.isDescendantOf(category, excludeId);
                select.appendChild(option);
                
                if (category.children && category.children.length > 0) {
                    renderOptions(category.children, level + 1, category.id);
                }
            });
        };
        
        renderOptions(this.categories);
    }
    
    isDescendantOf(category, targetId) {
        if (category.id == targetId) return true;
        
        if (category.children && category.children.length > 0) {
            for (const child of category.children) {
                if (this.isDescendantOf(child, targetId)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    async exportData() {
        try {
            const response = await fetch('/api/export');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `knowledge-base-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出数据失败: ' + error.message);
        }
    }
    
    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!confirm(`确定要导入数据吗？这将添加 ${data.articles?.length || 0} 篇文章、${data.categories?.length || 0} 个分类和 ${data.tags?.length || 0} 个标签。`)) {
                return;
            }
            
            const response = await fetch('/api/import', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                alert('导入成功！');
                await this.loadCategories();
                await this.loadTags();
                await this.loadArticles();
            } else {
                throw new Error(result.error || '导入失败');
            }
        } catch (error) {
            console.error('导入失败:', error);
            alert('导入数据失败: ' + error.message);
        } finally {
            event.target.value = '';
        }
    }
    
    searchArticles(query) {
        if (!query.trim()) {
            this.loadArticles(this.currentCategory, this.currentTag);
            return;
        }
        
        // 简单的客户端搜索
        const articles = document.querySelectorAll('.article-item');
        let found = false;
        
        articles.forEach(article => {
            const title = article.querySelector('h3').textContent.toLowerCase();
            const content = article.querySelector('.article-content-preview').textContent.toLowerCase();
            const matches = title.includes(query.toLowerCase()) || content.includes(query.toLowerCase());
            article.style.display = matches ? 'block' : 'none';
            if (matches) found = true;
        });
        
        if (!found) {
            document.getElementById('articlesList').innerHTML = `
                <div class="empty-state">
                    <p>没有找到包含 "${query}" 的文章</p>
                </div>
            `;
        }
    }
    
    updateContentTitle(categoryId, tag) {
        const titleElement = document.getElementById('contentTitle');
        if (!titleElement) return;
        
        if (categoryId) {
            const category = this.findCategoryById(categoryId);
            titleElement.textContent = category ? `分类: ${category.name}` : '分类文章';
        } else if (tag) {
            titleElement.textContent = `标签: ${tag}`;
        } else {
            titleElement.textContent = '所有文章';
        }
    }
    
    findCategoryById(id) {
        const findInCategories = (categories, targetId) => {
            for (const category of categories) {
                if (category.id === targetId) return category;
                if (category.children) {
                    const found = findInCategories(category.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };
        
        return findInCategories(this.categories, parseInt(id));
    }
    
    showEditor() {
        document.getElementById('articlesList').style.display = 'none';
        document.getElementById('articleEditor').style.display = 'flex';
        document.getElementById('contentTitle').textContent = this.currentArticle ? '编辑文章' : '新建文章';
        
        if (!this.currentArticle) {
            // 新建文章
            document.getElementById('articleTitle').value = '';
            document.getElementById('articleContent').value = '';
            document.getElementById('articleCategory').value = '';
            document.getElementById('articleTags').value = '';
        }
    }
    
    hideEditor() {
        document.getElementById('articlesList').style.display = 'block';
        document.getElementById('articleEditor').style.display = 'none';
        this.currentArticle = null;
        this.updateContentTitle(this.currentCategory, this.currentTag);
    }
    
    showCategoryModal() {
        document.getElementById('categoryModal').style.display = 'flex';
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryParent').value = '';
        document.getElementById('categoryModalTitle').textContent = '新建分类';
    }
    
    hideCategoryModal() {
        document.getElementById('categoryModal').style.display = 'none';
    }
    
    hideEditCategoryModal() {
        document.getElementById('editCategoryModal').style.display = 'none';
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // 更新按钮文本
        const button = document.getElementById('toggleDarkMode');
        if (button) {
            button.textContent = newTheme === 'dark' ? '切换浅色' : '切换深色';
        }
    }
    
    applySavedTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // 更新按钮文本
        const button = document.getElementById('toggleDarkMode');
        if (button) {
            button.textContent = savedTheme === 'dark' ? '切换浅色' : '切换深色';
        }
    }
    
    highlightActiveCategory() {
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (this.currentCategory) {
            const activeItem = document.querySelector(`.category-item[data-id="${this.currentCategory}"]`);
            if (activeItem) activeItem.classList.add('active');
        }
    }
    
    highlightActiveTag() {
        document.querySelectorAll('.tag').forEach(tag => {
            tag.classList.remove('active');
        });
        
        if (this.currentTag) {
            document.querySelectorAll('.tag').forEach(tag => {
                if (tag.textContent.includes(this.currentTag)) {
                    tag.classList.add('active');
                }
            });
        }
    }
    
    showSuccess(message) {
        // 简单的成功提示
        console.log('Success:', message);
        // 可以替换为更友好的Toast通知
        alert(message);
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
let knowledgeBase;

// 确保DOM完全加载后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM完全加载，初始化KnowledgeBase');
        knowledgeBase = new KnowledgeBase();
    });
} else {
    console.log('DOM已加载，直接初始化KnowledgeBase');
    knowledgeBase = new KnowledgeBase();
}
