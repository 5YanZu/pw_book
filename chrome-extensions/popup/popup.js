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
        
        document.getElementById('syncBtn')?.addEventListener('click', () => {
            this.showSyncSettings();
        });
        
        // 设置按钮事件
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.showSyncSettings();
        });
        
        document.getElementById('settingsBtn2')?.addEventListener('click', () => {
            this.showSyncSettings();
        });
        
        // 模态框事件
        this.bindModalEvents();
        
        // 同步设置事件
        this.bindSyncEvents();

        // 手动标记按钮
        const manualMarkBtn = document.getElementById('manualMarkBtn');
        if (manualMarkBtn) {
            manualMarkBtn.addEventListener('click', async () => {
                try {
                    // 获取当前活跃的标签页
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    
                    // 向content script发送消息触发手动标记模式
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'ACTIVATE_MANUAL_MARKING'
                    });
                    
                    // 关闭弹窗
                    window.close();
                } catch (error) {
                    console.error('激活手动标记模式失败:', error);
                    this.showToast('激活手动标记模式失败', 'error');
                }
            });
        }
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

    /**
     * 显示同步设置
     */
    async showSyncSettings() {
        try {
            const settings = await simpleSyncManager.getSyncSettings();
            
            const modalHtml = `
                <div class="modal-overlay" id="syncModal" style="display: block;">
                    <div class="modal-content sync-modal">
                        <div class="modal-header">
                            <h3>同步设置</h3>
                            <button class="modal-close" id="syncModalClose">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="sync-status">
                                <div class="status-indicator" id="syncStatusIndicator"></div>
                                <span id="syncStatusText">未配置</span>
                            </div>
                            
                            <div class="form-group">
                                <label for="serverUrl">服务器地址:</label>
                                <input type="url" id="serverUrl" placeholder="https://your-sync-server.com" 
                                       value="${settings.serverUrl || ''}">
                            </div>
                            
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="autoSync" ${settings.autoSync ? 'checked' : ''}> 
                                    自动同步
                                </label>
                            </div>
                            
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="syncEnabled" ${settings.enabled ? 'checked' : ''}> 
                                    启用同步
                                </label>
                            </div>
                            
                            <div class="key-section">
                                <h4>加密密钥</h4>
                                <div class="key-actions">
                                    <button class="btn btn-secondary" id="generateKeysBtn">生成新密钥</button>
                                    <button class="btn btn-secondary" id="importKeysBtn">导入密钥</button>
                                    <button class="btn btn-secondary" id="exportKeysBtn">导出密钥</button>
                                </div>
                                
                                <div class="key-info" id="keyInfo" style="display: ${settings.publicKey ? 'block' : 'none'};">
                                    指纹: <span id="keyFingerprint">计算中...</span>
                                </div>
                            </div>
                            
                            <div class="sync-actions">
                                <button class="btn btn-primary" id="saveSyncSettings">保存设置</button>
                                <button class="btn btn-secondary" id="testConnection">测试连接</button>
                                <button class="btn btn-secondary" id="syncNow">立即同步</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到页面
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // 更新密钥指纹
            if (settings.publicKey) {
                this.updateKeyFingerprint(settings.publicKey);
            }
            
            // 更新同步状态
            this.updateSyncStatus();
            
        } catch (error) {
            console.error('显示同步设置失败:', error);
            this.showToast('显示同步设置失败', 'error');
        }
    }

    /**
     * 绑定同步设置事件
     */
    bindSyncEvents() {
        // 使用事件委托处理动态添加的元素
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'syncModalClose') {
                this.hideSyncSettings();
            } else if (e.target.id === 'generateKeysBtn') {
                await this.generateKeys();
            } else if (e.target.id === 'importKeysBtn') {
                this.importKeys();
            } else if (e.target.id === 'exportKeysBtn') {
                await this.exportKeys();
            } else if (e.target.id === 'saveSyncSettings') {
                await this.saveSyncSettings();
            } else if (e.target.id === 'testConnection') {
                await this.testSyncConnection();
            } else if (e.target.id === 'syncNow') {
                await this.syncNow();
            }
        });
    }

    /**
     * 隐藏同步设置
     */
    hideSyncSettings() {
        const modal = document.getElementById('syncModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * 生成密钥
     */
    async generateKeys() {
        try {
            this.showToast('正在生成密钥...', 'info');
            
            const keyPair = await simpleSyncManager.generateAndSetupKeys();
            
            // 更新界面
            document.getElementById('keyInfo').style.display = 'block';
            await this.updateKeyFingerprint(keyPair.publicKey);
            
            this.showToast('密钥生成成功', 'success');
            
        } catch (error) {
            console.error('生成密钥失败:', error);
            this.showToast('密钥生成失败: ' + error.message, 'error');
        }
    }

    /**
     * 导入密钥
     */
    importKeys() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                const text = await file.text();
                const keyData = JSON.parse(text);
                
                if (!keyData.publicKey || !keyData.privateKey) {
                    throw new Error('密钥文件格式错误');
                }
                
                const settings = await simpleSyncManager.getSyncSettings();
                settings.publicKey = keyData.publicKey;
                settings.privateKey = keyData.privateKey;
                await simpleSyncManager.saveSyncSettings(settings);
                
                await simpleSyncManager.cryptoManager.importKeys(
                    keyData.publicKey, 
                    keyData.privateKey
                );
                
                // 更新界面
                document.getElementById('keyInfo').style.display = 'block';
                await this.updateKeyFingerprint(keyData.publicKey);
                
                this.showToast('密钥导入成功', 'success');
                
            } catch (error) {
                console.error('密钥导入失败:', error);
                this.showToast('密钥导入失败: ' + error.message, 'error');
            }
        };
        
        input.click();
    }

    /**
     * 导出密钥
     */
    async exportKeys() {
        try {
            const settings = await simpleSyncManager.getSyncSettings();
            if (!settings.publicKey || !settings.privateKey) {
                this.showToast('请先生成密钥', 'warning');
                return;
            }
            
            const keyData = {
                publicKey: settings.publicKey,
                privateKey: settings.privateKey,
                exportTime: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(keyData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sync-keys-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showToast('密钥已导出', 'success');
            
        } catch (error) {
            console.error('密钥导出失败:', error);
            this.showToast('密钥导出失败: ' + error.message, 'error');
        }
    }

    /**
     * 保存同步设置
     */
    async saveSyncSettings() {
        try {
            const serverUrl = document.getElementById('serverUrl').value.trim();
            const autoSync = document.getElementById('autoSync').checked;
            const enabled = document.getElementById('syncEnabled').checked;
            
            if (enabled && !serverUrl) {
                this.showToast('请输入服务器地址', 'warning');
                return;
            }
            
            const settings = await simpleSyncManager.getSyncSettings();
            settings.serverUrl = serverUrl;
            settings.autoSync = autoSync;
            settings.enabled = enabled;
            settings.syncInterval = 300000; // 5分钟
            
            await simpleSyncManager.saveSyncSettings(settings);
            
            // 重新初始化同步管理器
            if (enabled) {
                await simpleSyncManager.init();
            } else {
                simpleSyncManager.stopPeriodicSync();
            }
            
            this.updateSyncStatus();
            this.showToast('设置保存成功', 'success');
            
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showToast('保存设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 测试连接
     */
    async testSyncConnection() {
        try {
            const serverUrl = document.getElementById('serverUrl').value.trim();
            if (!serverUrl) {
                this.showToast('请输入服务器地址', 'warning');
                return;
            }
            
            this.showToast('正在测试连接...', 'info');
            
            // 临时更新服务器地址进行测试
            const oldUrl = simpleSyncManager.serverUrl;
            simpleSyncManager.serverUrl = serverUrl;
            
            const result = await simpleSyncManager.testConnection();
            
            // 恢复原来的地址
            simpleSyncManager.serverUrl = oldUrl;
            
            if (result.success) {
                this.showToast('连接成功', 'success');
            } else {
                this.showToast(result.message, 'error');
            }
            
        } catch (error) {
            console.error('测试连接失败:', error);
            this.showToast('测试连接失败: ' + error.message, 'error');
        }
    }

    /**
     * 立即同步
     */
    async syncNow() {
        try {
            this.showToast('正在同步...', 'info');
            
            await simpleSyncManager.syncAll();
            
            this.showToast('同步完成', 'success');
            this.updateSyncStatus();
            
            // 刷新账号数据
            await this.loadAccounts();
            
        } catch (error) {
            console.error('同步失败:', error);
            this.showToast('同步失败: ' + error.message, 'error');
        }
    }

    /**
     * 更新密钥指纹
     */
    async updateKeyFingerprint(publicKey) {
        try {
            const encoder = new TextEncoder();
            const keyBuffer = encoder.encode(publicKey);
            const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
            
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            const fingerprintEl = document.getElementById('keyFingerprint');
            if (fingerprintEl) {
                fingerprintEl.textContent = fingerprint.substring(0, 16).toUpperCase();
            }
            
        } catch (error) {
            console.error('计算密钥指纹失败:', error);
            const fingerprintEl = document.getElementById('keyFingerprint');
            if (fingerprintEl) {
                fingerprintEl.textContent = '计算失败';
            }
        }
    }

    /**
     * 更新同步状态
     */
    async updateSyncStatus() {
        try {
            const settings = await simpleSyncManager.getSyncSettings();
            const indicator = document.getElementById('syncStatusIndicator');
            const text = document.getElementById('syncStatusText');
            
            if (!indicator || !text) return;
            
            if (!settings.enabled) {
                indicator.className = 'status-indicator status-disabled';
                text.textContent = '已禁用';
            } else if (!settings.serverUrl || !settings.publicKey) {
                indicator.className = 'status-indicator status-warning';
                text.textContent = '未配置';
            } else {
                indicator.className = 'status-indicator status-success';
                text.textContent = '已启用';
            }
            
        } catch (error) {
            console.error('更新同步状态失败:', error);
        }
    }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});