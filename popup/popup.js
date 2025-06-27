/**
 * 密码管理器 Popup 脚本
 * 处理弹窗界面的所有交互逻辑
 */

class PopupManager {
    constructor() {
        this.storage = new StorageManager();
        this.domain = DomainUtils;
        this.crypto = cryptoManager; // 使用全局实例
        
        this.currentSite = null;
        this.currentAccounts = [];
        this.tempData = [];
        
        this.init();
    }

    /**
     * 初始化弹窗
     */
    async init() {
        try {
            // 检查扩展上下文是否有效
            if (!this.checkExtensionContext()) {
                this.showToast('扩展上下文无效，请重新加载扩展', 'error');
                return;
            }
            
            // 获取当前网站信息
            await this.loadCurrentSite();
            
            // 加载暂存数据
            await this.loadTempData();
            
            // 加载账号数据
            await this.loadAccounts();
            
            // 绑定事件
            this.bindEvents();
            
            console.log('Popup 初始化完成');
        } catch (error) {
            console.error('Popup 初始化失败:', error);
            if (error.message.includes('Extension context invalidated')) {
                this.showToast('扩展上下文无效，请重新加载扩展', 'error');
            } else {
                this.showToast('初始化失败', 'error');
            }
        }
    }

    /**
     * 检查扩展上下文是否有效
     */
    checkExtensionContext() {
        try {
            return typeof chrome !== 'undefined' && 
                   chrome.runtime && 
                   chrome.runtime.id && 
                   !chrome.runtime.lastError;
        } catch (error) {
            console.error('扩展上下文检查失败:', error);
            return false;
        }
    }

    /**
     * 获取当前网站信息
     */
    async loadCurrentSite() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_ACTIVE_TAB_INFO'
            });
            
            if (response && !response.error) {
                this.currentSite = {
                    hostname: response.hostname,
                    title: response.title,
                    baseDomain: this.domain.getBaseDomain(response.hostname)
                };
                
                // 更新界面显示
                this.updateSiteDisplay();
            } else {
                throw new Error(response?.error || '获取网站信息失败');
            }
        } catch (error) {
            console.error('获取当前网站信息失败:', error);
            this.currentSite = {
                hostname: 'unknown',
                title: '未知网站',
                baseDomain: 'unknown'
            };
            this.updateSiteDisplay();
        }
    }

    /**
     * 更新网站显示
     */
    updateSiteDisplay() {
        const siteNameEl = document.getElementById('siteName');
        if (siteNameEl && this.currentSite) {
            siteNameEl.textContent = this.currentSite.baseDomain;
            siteNameEl.title = this.currentSite.hostname;
        }
    }

    /**
     * 加载暂存数据
     */
    async loadTempData() {
        try {
            this.tempData = await this.storage.getTempAccounts();
            this.updateTempDisplay();
        } catch (error) {
            console.error('加载暂存数据失败:', error);
            this.tempData = [];
        }
    }

    /**
     * 更新暂存数据显示
     */
    updateTempDisplay() {
        const tempSection = document.getElementById('tempSection');
        const tempDetails = document.getElementById('tempDetails');
        
        if (!tempSection || !tempDetails) return;
        
        // 过滤当前网站的暂存数据
        const currentSiteTempData = this.tempData.filter(item => 
            item.domain === this.currentSite?.baseDomain || 
            item.baseDomain === this.currentSite?.baseDomain
        );
        
        if (currentSiteTempData.length > 0) {
            // 按时间排序，显示最新的
            currentSiteTempData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            const tempHtml = currentSiteTempData.map((item, index) => {
                const updateTypeInfo = this.getUpdateTypeInfo(item.updateType);
                const timeAgo = this.getTimeAgo(item.timestamp);
                
                return `
                    <div class="temp-item ${index === 0 ? 'latest' : ''}" data-index="${index}">
                        <div class="temp-icon">${updateTypeInfo.icon}</div>
                        <div class="temp-info">
                            <div class="temp-username">${this.escapeHtml(item.username)}</div>
                            <div class="temp-meta">
                                <span class="temp-type">${updateTypeInfo.title}</span>
                                <span class="temp-time">${timeAgo}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            tempDetails.innerHTML = tempHtml;
            tempSection.style.display = 'block';
        } else {
            tempSection.style.display = 'none';
        }
    }

    /**
     * 获取更新类型信息
     */
    getUpdateTypeInfo(updateType) {
        switch (updateType) {
            case 'temp':
                return { icon: '🔄', title: '密码已更新' };
            case 'formal_diff':
                return { icon: '🔐', title: '检测到密码变更' };
            case 'formal_decrypt_error':
                return { icon: '⚠️', title: '需要确认' };
            case 'new':
            default:
                return { icon: '✨', title: '新账号' };
        }
    }

    /**
     * 获取相对时间
     */
    getTimeAgo(timestamp) {
        if (!timestamp) return '刚刚';
        
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        return `${days}天前`;
    }

    /**
     * 加载账号数据
     */
    async loadAccounts() {
        try {
            if (!this.currentSite?.baseDomain) {
                this.currentAccounts = [];
                this.updateAccountsDisplay();
                return;
            }
            
            // 使用StorageManager的getAccountsByDomain方法，它已经处理了解密
            this.currentAccounts = await this.storage.getAccountsByDomain(this.currentSite.baseDomain);
            
            this.updateAccountsDisplay();
        } catch (error) {
            console.error('加载账号数据失败:', error);
            this.currentAccounts = [];
            this.updateAccountsDisplay();
        }
    }

    /**
     * 更新账号列表显示
     */
    updateAccountsDisplay() {
        const accountsList = document.getElementById('accountsList');
        const emptyState = document.getElementById('emptyState');
        const accountCount = document.getElementById('accountCount');
        
        if (!accountsList || !emptyState || !accountCount) return;
        
        // 更新计数
        accountCount.textContent = this.currentAccounts.length;
        
        // 控制自动填充按钮显示
        const showFillBtn = document.getElementById('showFillOptionsBtn');
        if (showFillBtn) {
            showFillBtn.style.display = this.currentAccounts.length > 0 ? 'flex' : 'none';
        }
        
        if (this.currentAccounts.length === 0) {
            accountsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }
        
        accountsList.style.display = 'block';
        emptyState.style.display = 'none';
        
        // 生成账号列表HTML
        accountsList.innerHTML = this.currentAccounts.map((account, index) => {
            const avatar = account.username.charAt(0).toUpperCase();
            const createTime = account.createdTime || '未知时间';
            
            return `
                <div class="account-item" data-index="${index}">
                    <div class="account-avatar">${avatar}</div>
                    <div class="account-info">
                        <div class="account-username">${this.escapeHtml(account.username)}</div>
                        <div class="account-meta">
                            <div class="account-source">
                                <span>📱</span>
                                <span>${account.source || '插件'}</span>
                            </div>
                            <div class="account-time">${createTime}</div>
                        </div>
                    </div>
                    <div class="account-actions">
                        <button class="action-btn fill-btn" data-action="fill" data-index="${index}" title="填充到页面">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                            </svg>
                        </button>
                        <button class="action-btn delete-btn" data-action="delete" data-index="${index}" title="删除账号">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 绑定账号项的事件
        this.bindAccountEvents();
    }

    /**
     * 绑定账号相关事件
     */
    bindAccountEvents() {
        const accountItems = document.querySelectorAll('.account-item');
        
        accountItems.forEach(item => {
            // 点击账号项显示详情
            item.addEventListener('click', (e) => {
                if (e.target.closest('.account-actions')) return;
                
                const index = parseInt(item.dataset.index);
                this.showAccountModal(index);
            });
        });
        
        // 绑定操作按钮事件
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);
                
                if (action === 'fill') {
                    this.fillAccount(index);
                } else if (action === 'delete') {
                    this.deleteAccount(index);
                }
            });
        });
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 暂存数据操作
        document.getElementById('btnSave')?.addEventListener('click', () => {
            this.saveTempData();
        });
        
        document.getElementById('btnIgnore')?.addEventListener('click', () => {
            this.ignoreTempData();
        });
        
        // 添加账号
        document.getElementById('addAccountBtn')?.addEventListener('click', () => {
            this.showAddAccountModal();
        });
        
        // 快捷操作
        document.getElementById('showFillOptionsBtn')?.addEventListener('click', () => {
            this.showFillOptions();
        });
        
        document.getElementById('generatePasswordBtn')?.addEventListener('click', () => {
            this.generatePassword();
        });
        
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.exportData();
        });
        
        // 模态框事件
        this.bindModalEvents();
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents() {
        // 账号详情模态框
        document.getElementById('modalClose')?.addEventListener('click', () => {
            this.hideAccountModal();
        });
        
        document.getElementById('modalFillBtn')?.addEventListener('click', () => {
            this.fillCurrentModalAccount();
        });
        
        document.getElementById('modalDeleteBtn')?.addEventListener('click', () => {
            this.deleteCurrentModalAccount();
        });
        
        // 添加账号模态框
        document.getElementById('addModalClose')?.addEventListener('click', () => {
            this.hideAddAccountModal();
        });
        
        document.getElementById('addModalCancel')?.addEventListener('click', () => {
            this.hideAddAccountModal();
        });
        
        document.getElementById('addModalSave')?.addEventListener('click', () => {
            this.saveNewAccount();
        });
        
        // 密码可见性切换
        document.getElementById('togglePassword')?.addEventListener('click', () => {
            this.togglePasswordVisibility('modalPassword');
        });
        
        document.getElementById('addTogglePassword')?.addEventListener('click', () => {
            this.togglePasswordVisibility('addPassword');
        });
        
        // 生成密码按钮
        document.getElementById('generatePasswordInModal')?.addEventListener('click', () => {
            this.generatePasswordForInput('addPassword');
        });
        
        // 复制按钮
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.copy;
                this.copyToClipboard(type);
            });
        });
        
        // 点击遮罩关闭模态框
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        });
    }

    /**
     * 保存暂存数据
     */
    async saveTempData() {
        try {
            const currentSiteTempData = this.tempData.filter(item => 
                item.baseDomain === this.currentSite?.baseDomain
            );
            
            if (currentSiteTempData.length === 0) {
                this.showToast('没有待保存的数据', 'warning');
                return;
            }
            
            for (const tempItem of currentSiteTempData) {
                await this.storage.saveAccount(
                    tempItem.domain || tempItem.baseDomain,
                    tempItem.username,
                    tempItem.password,
                    tempItem.subDomain
                );
            }
            
            // 删除已保存的暂存数据
            await this.storage.removeTempAccountsByDomain(this.currentSite.baseDomain);
            
            // 刷新数据
            await this.loadTempData();
            await this.loadAccounts();
            
            this.showToast('账号保存成功', 'success');
        } catch (error) {
            console.error('保存暂存数据失败:', error);
            this.showToast('保存失败', 'error');
        }
    }

    /**
     * 忽略暂存数据
     */
    async ignoreTempData() {
        try {
            await this.storage.removeTempAccountsByDomain(this.currentSite.baseDomain);
            await this.loadTempData();
            this.showToast('已忽略', 'success');
        } catch (error) {
            console.error('忽略暂存数据失败:', error);
            this.showToast('操作失败', 'error');
        }
    }

    /**
     * 显示填充选项
     */
    async showFillOptions() {
        try {
            // 发送消息到content script显示填充选项
            const response = await chrome.runtime.sendMessage({
                type: 'SHOW_FILL_OPTIONS'
            });
            
            if (response?.success) {
                this.showToast('已显示填充选项', 'success');
                window.close();
            } else {
                this.showToast('无法显示填充选项', 'error');
            }
        } catch (error) {
            console.error('显示填充选项失败:', error);
            this.showToast('显示填充选项失败', 'error');
        }
    }

    /**
     * 填充账号到页面
     */
    async fillAccount(index) {
        try {
            const account = this.currentAccounts[index];
            if (!account) return;
            
            // 发送填充命令到content script
            const response = await chrome.runtime.sendMessage({
                type: 'FILL_FORM',
                data: {
                    username: account.username,
                    password: account.password
                }
            });
            
            if (response?.success) {
                this.showToast('填充成功', 'success');
                window.close();
            } else {
                this.showToast('填充失败', 'error');
            }
        } catch (error) {
            console.error('填充账号失败:', error);
            this.showToast('填充失败', 'error');
        }
    }

    /**
     * 删除账号
     */
    async deleteAccount(index) {
        try {
            const account = this.currentAccounts[index];
            if (!account) return;
            
            if (!confirm(`确定要删除账号 "${account.username}" 吗？`)) {
                return;
            }
            
            await this.storage.deleteAccount(this.currentSite.baseDomain, account.username);
            await this.loadAccounts();
            
            this.showToast('账号删除成功', 'success');
        } catch (error) {
            console.error('删除账号失败:', error);
            this.showToast('删除失败', 'error');
        }
    }

    /**
     * 显示账号详情模态框
     */
    showAccountModal(index) {
        const account = this.currentAccounts[index];
        if (!account) return;
        
        document.getElementById('modalUsername').value = account.username;
        document.getElementById('modalPassword').value = account.password;
        document.getElementById('modalSource').value = account.source || '插件';
        document.getElementById('modalCreateTime').value = account.createdTime || '未知时间';
        
        document.getElementById('accountModal').style.display = 'flex';
        
        // 存储当前模态框账号索引
        this.currentModalIndex = index;
    }

    /**
     * 隐藏账号详情模态框
     */
    hideAccountModal() {
        document.getElementById('accountModal').style.display = 'none';
        this.currentModalIndex = null;
    }

    /**
     * 从模态框填充账号
     */
    fillCurrentModalAccount() {
        if (this.currentModalIndex !== null) {
            this.fillAccount(this.currentModalIndex);
            this.hideAccountModal();
        }
    }

    /**
     * 从模态框删除账号
     */
    deleteCurrentModalAccount() {
        if (this.currentModalIndex !== null) {
            this.deleteAccount(this.currentModalIndex);
            this.hideAccountModal();
        }
    }

    /**
     * 显示添加账号模态框
     */
    showAddAccountModal() {
        document.getElementById('addUsername').value = '';
        document.getElementById('addPassword').value = '';
        document.getElementById('addAccountModal').style.display = 'flex';
    }

    /**
     * 隐藏添加账号模态框
     */
    hideAddAccountModal() {
        document.getElementById('addAccountModal').style.display = 'none';
    }

    /**
     * 保存新账号
     */
    async saveNewAccount() {
        try {
            const username = document.getElementById('addUsername').value.trim();
            const password = document.getElementById('addPassword').value;
            
            if (!username || !password) {
                this.showToast('请填写完整信息', 'warning');
                return;
            }
            
            await this.storage.saveAccount(
                this.currentSite.baseDomain,
                username,
                password,
                this.currentSite.hostname
            );
            
            this.hideAddAccountModal();
            await this.loadAccounts();
            
            this.showToast('账号添加成功', 'success');
        } catch (error) {
            console.error('保存新账号失败:', error);
            this.showToast('保存失败', 'error');
        }
    }

    /**
     * 切换密码可见性
     */
    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        if (input.type === 'password') {
            input.type = 'text';
        } else {
            input.type = 'password';
        }
    }

    /**
     * 生成随机密码
     */
    generatePassword() {
        const password = this.crypto.generateRandomPassword();
        
        // 复制到剪贴板
        this.copyText(password);
        this.showToast(`已生成密码: ${password}`, 'success');
    }

    /**
     * 为输入框生成密码
     */
    generatePasswordForInput(inputId) {
        const password = this.crypto.generateRandomPassword();
        const input = document.getElementById(inputId);
        
        if (input) {
            input.value = password;
            input.type = 'text'; // 临时显示生成的密码
            
            // 3秒后隐藏
            setTimeout(() => {
                input.type = 'password';
            }, 3000);
        }
        
        this.showToast('密码已生成', 'success');
    }

    /**
     * 复制到剪贴板
     */
    async copyToClipboard(type) {
        let text = '';
        
        if (type === 'username') {
            text = document.getElementById('modalUsername').value;
        } else if (type === 'password') {
            text = document.getElementById('modalPassword').value;
        }
        
        if (text) {
            await this.copyText(text);
            this.showToast(`${type === 'username' ? '用户名' : '密码'}已复制`, 'success');
        }
    }

    /**
     * 复制文本
     */
    async copyText(text) {
        try {
            await chrome.runtime.sendMessage({
                type: 'COPY_TO_CLIPBOARD',
                text: text
            });
        } catch (error) {
            console.error('复制失败:', error);
        }
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
            const allAccounts = await this.storage.getAccounts();
            const dataStr = JSON.stringify(allAccounts, null, 2);
            
            // 创建下载链接
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `password-manager-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showToast('数据导出成功', 'success');
        } catch (error) {
            console.error('导出数据失败:', error);
            this.showToast('导出失败', 'error');
        }
    }

    /**
     * 显示Toast通知
     */
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastIcon || !toastMessage) return;
        
        // 设置图标
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠'
        };
        
        toastIcon.textContent = icons[type] || icons.success;
        toastMessage.textContent = message;
        
        // 清除之前的类型样式
        toast.classList.remove('success', 'error', 'warning');
        toast.classList.add(type);
        
        toast.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});