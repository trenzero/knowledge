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
        
        this.init();
    }
    
    async init() {
        // 初始化懒加载观察器
        this.initLazyLoading();
        
        // 检查PWA支持
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('SW registered'))
                .catch(error => console.log('SW registration failed'));
        }
        
        // 加载初始数据
        await Promise.all([
            this.loadCategories(),
            this.loadTags(),
            this.loadArticles()
        ]);
        
        // 绑定事件
        this.bindEvents();
        
        // 应用保存的主题
        this.applySavedTheme();
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
    }
    
    // 防抖函数
    debounce(func, wait) {
        return (...args) => {
            clearTimeout(this.debounceTimers.get(func));
            this.debounceTimers.set(func, setTimeout(() => func.apply(this, args), wait));
        };
    }
    
    // 缓存数据函数
    async cachedFetch(url, options = {}, cacheKey = url, ttl = 60000) { // 默认缓存1分钟
        const now = Date.now();
        const cached = this.cache.get(cacheKey);
        
        if (cached && (now - cached.timestamp < ttl)) {
            return cached.data;
        }
        
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            this.cache.set(cacheKey, {
                data,
                timestamp: now
            });
            
            return data;
        } catch (error) {
            // 如果网络请求失败但缓存中有数据，使用缓存数据
            if (cached) {
                console.warn('Using cached data due to network error:', error);
                return cached.data;
            }
            throw error;
        }
    }
    
    async loadCategories() {
        try {
            this.showCategoriesLoading();
            
            this.categories = await this.cachedFetch('/api/categories');
            console.log('加载的分类数据:', this.categories);
            this.renderCategories();
            this.renderCategorySelects();
        } catch (error) {
            console.error('加载分类失败:', error);
            this.showError('加载分类失败: ' + error.message);
        }
    }
    
    async loadTags() {
        try {
            this.tags = await this.cachedFetch('/api/tags');
            this.renderTags();
        } catch (error) {
            console.error('加载标签失败:', error);
        }
    }
    
    async loadArticles(categoryId = null, tag = null) {
        try {
            this.showArticlesLoading();
            
            let url = '/api/articles';
            const params = new URLSearchParams();
            
            if (categoryId) params.append('category', categoryId);
            if (tag) params.append('tag', tag);
            
            if (params.toString()) url += '?' + params.toString();
            
            this.articles = await this.cachedFetch(url, {}, `articles-${categoryId}-${tag}`);
            this.renderArticles(this.articles);
            
            // 更新内容标题
            this.updateContentTitle(categoryId, tag);
        } catch (error) {
            console.error('加载文章失败:', error);
            this.showError('加载文章失败: ' + error.message);
        }
    }
    
    showCategoriesLoading() {
        const container = document.getElementById('categoriesTree');
        container.innerHTML = `
            <div class="category-item">
                <div class="skeleton skeleton-text" style="width: 80%"></div>
                <div class="skeleton skeleton-text" style="width: 60%"></div>
            </div>
        `;
    }
    
    showArticlesLoading() {
        const container = document.getElementById('articlesList');
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
    
    showError(message) {
        // 可以替换为更友好的错误提示UI
        console.error('Error:', message);
        // 临时使用alert，建议替换为自定义Toast组件
        alert(message);
    }
    
    renderCategories() {
        const container = document.getElementById('categoriesTree');
        container.innerHTML = '';
        
        if (this.categories.length === 0) {
            container.innerHTML = '<div class="category-item">暂无分类</div>';
            return;
        }
        
        const renderCategory = (category, level = 0) => {
            const div = document.createElement('div');
            div.className = `category-item ${this.currentCategory === category.id ? 'active' : ''}`;
            div.style.paddingLeft = `${level * 20 + 12}px`;
            div.dataset.id = category.id;
            div.innerHTML = `
                <span>${this.escapeHtml(category.name)}</span>
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
            if (category.children && category.children.length > 0) {
                category.children.forEach(child => renderCategory(child, level + 1));
            }
        };
        
        this.categories.forEach(category => renderCategory(category));
    }
    
    // 编辑分类
    editCategory(category) {
        document.getElementById('editCategoryModal').style.display = 'flex';
        document.getElementById('editCategoryId').value = category.id;
        document.getElementById('editCategoryName').value = category.name;
        document.getElementById('editCategoryParent').value = category.parent_id || '';
        
        // 填充父分类选择器（排除自己及其子分类）
        this.renderEditCategoryParentSelect(category.id);
    }
    
    // 更新分类
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
                // 清除分类缓存
                this.cache.delete('/api/categories');
                await this.loadCategories();
                this.showSuccess('分类更新成功！');
            } else {
                throw new Error(result.error || '更新失败');
            }
        } catch (error) {
            console.error('更新分类失败:', error);
            this.showError('更新分类失败: ' + error.message);
        }
    }
    
    // 删除分类
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
                // 清除相关缓存
                this.cache.delete('/api/categories');
                this.cache.forEach((value, key) => {
                    if (key.startsWith('articles-')) this.cache.delete(key);
                });
                
                await this.loadCategories();
                await this.loadArticles();
                this.showSuccess('分类删除成功！');
            } else {
                throw new Error(result.error || '删除失败');
            }
        } catch (error) {
            console.error('删除分类失败:', error);
            this.showError('删除分类失败: ' + error.message);
        }
    }
    
    // 渲染编辑分类时的父分类选择器（排除自己及其子分类）
    renderEditCategoryParentSelect(excludeId) {
        const select = document.getElementById('editCategoryParent');
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
    
    // 检查分类是否是另一个分类的后代
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
    
    hideEditCategoryModal() {
        document.getElementById('editCategoryModal').style.display = 'none';
    }
    
    showSuccess(message) {
        // 可以替换为更友好的成功提示UI
        console.log('Success:', message);
        // 临时使用alert，建议替换为自定义Toast组件
        alert(message);
    }
    
    // 其他现有方法保持不变...
    // [保留所有其他现有方法]
}

// 初始化应用
let knowledgeBase;
document.addEventListener('DOMContentLoaded', () => {
    knowledgeBase = new KnowledgeBase();
});
