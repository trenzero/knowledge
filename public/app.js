class KnowledgeBase {
    constructor() {
        this.currentArticle = null;
        this.currentCategory = null;
        this.currentTag = null;
        this.categories = [];
        this.tags = [];
        
        this.init();
    }
    
    async init() {
        // 检查PWA支持
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('SW registered'))
                .catch(error => console.log('SW registration failed'));
        }
        
        // 加载初始数据
        await this.loadCategories();
        await this.loadTags();
        await this.loadArticles();
        
        // 绑定事件
        this.bindEvents();
        
        // 应用保存的主题
        this.applySavedTheme();
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
        
        // 数据管理
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
        
        // 主题切换
        document.getElementById('toggleDarkMode').addEventListener('click', () => this.toggleTheme());
        
        // 搜索
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchArticles(e.target.value));
    }
    
    async loadCategories() {
        try {
            console.log('正在加载分类...');
            const response = await fetch('/api/categories');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.categories = await response.json();
            console.log('加载的分类数据:', this.categories);
            this.renderCategories();
            this.renderCategorySelects();
        } catch (error) {
            console.error('加载分类失败:', error);
            alert('加载分类失败: ' + error.message);
        }
    }
    
    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.tags = await response.json();
            this.renderTags();
        } catch (error) {
            console.error('加载标签失败:', error);
        }
    }
    
    async loadArticles(categoryId = null, tag = null) {
        try {
            let url = '/api/articles';
            const params = new URLSearchParams();
            
            if (categoryId) params.append('category', categoryId);
            if (tag) params.append('tag', tag);
            
            if (params.toString()) url += '?' + params.toString();
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const articles = await response.json();
            this.renderArticles(articles);
            
            // 更新内容标题
            this.updateContentTitle(categoryId, tag);
        } catch (error) {
            console.error('加载文章失败:', error);
        }
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
                <span class="category-count">${category.article_count || 0}</span>
            `;
            
            div.addEventListener('click', () => {
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
    
    renderTags() {
        const container = document.getElementById('tagsCloud');
        container.innerHTML = '';
        
        if (this.tags.length === 0) {
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
        
        if (articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>没有找到文章</p>
                    <button class="btn-primary" onclick="knowledgeBase.showEditor()">创建第一篇文章</button>
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
        
        renderOptions(articleSelect, this.categories);
        renderOptions(categorySelect, this.categories);
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
            alert('加载文章失败');
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
                alert('保存成功！');
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
                alert('分类创建成功！');
            } else {
                throw new Error(result.error || '保存失败');
            }
        } catch (error) {
            console.error('保存分类失败:', error);
            alert('保存分类失败: ' + error.message);
        }
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
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // 更新按钮文本
        const button = document.getElementById('toggleDarkMode');
        button.textContent = newTheme === 'dark' ? '切换浅色' : '切换深色';
    }
    
    applySavedTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // 更新按钮文本
        const button = document.getElementById('toggleDarkMode');
        button.textContent = savedTheme === 'dark' ? '切换浅色' : '切换深色';
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
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
let knowledgeBase;
document.addEventListener('DOMContentLoaded', () => {
    knowledgeBase = new KnowledgeBase();
});
