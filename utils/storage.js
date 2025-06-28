/**
 * 数据存储管理工具类
 * 处理账号数据的增删改查、暂存等操作
 */
class StorageManager {
    constructor() {
        this.storageType = 'local'; // 使用chrome.storage.local
        this.tempStorageKey = 'temp_accounts'; // 暂存数据的key
        this.accountsKey = 'password_accounts'; // 正式账号数据的key
        this.settingsKey = 'password_settings'; // 设置数据的key
        this.encryptionKey = null; // 加密密钥
    }
    
    /**
     * 初始化存储管理器
     */
    async init() {
        try {
            // 检查扩展上下文状态
            this.checkExtensionStatus();
            
            // 获取或生成加密密钥
            await this.initEncryptionKey();
        } catch (error) {
            console.error('存储管理器初始化失败:', error);
        }
    }

    /**
     * 检查扩展上下文状态
     */
    checkExtensionStatus() {
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.warn('⚠️ Chrome扩展API不可用');
                this.showExtensionStatusNotification();
                return false;
            }
            
            if (!chrome.runtime.id) {
                console.warn('⚠️ 扩展上下文可能已失效');
                this.showExtensionStatusNotification();
                return false;
            }
            
            console.log('✅ 扩展上下文正常');
            return true;
        } catch (error) {
            console.warn('⚠️ 扩展状态检查失败:', error);
            this.showExtensionStatusNotification();
            return false;
        }
    }

    /**
     * 显示扩展状态提示
     */
    showExtensionStatusNotification() {
        // 防止重复显示
        if (document.querySelector('.pw-manager-status-notification')) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = 'pw-manager-status-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 20px;
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                max-width: 350px;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 20px;">🔧</div>
                    <div>
                        <div style="font-weight: bold; margin-bottom: 5px;">扩展需要重新加载</div>
                        <div style="opacity: 0.9; font-size: 12px;">
                            当前使用降级模式，部分功能受限<br>
                            建议重新加载扩展以获得完整功能
                        </div>
                    </div>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: auto;">×</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 10秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }
    
    /**
     * 初始化加密密钥
     */
    async initEncryptionKey() {
        try {
            const settings = await this.getSettings();
            
            if (settings.encryptionKey) {
                // 导入已存在的密钥
                this.encryptionKey = await cryptoManager.importKey(settings.encryptionKey);
            } else {
                // 生成新密钥
                this.encryptionKey = await cryptoManager.generateKey();
                const keyData = await cryptoManager.exportKey(this.encryptionKey);
                
                // 保存密钥
                await this.saveSettings({
                    ...settings,
                    encryptionKey: keyData,
                    createdTime: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('密钥初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 暂存账号数据
     * @param {string} domain - 基础域名
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @param {string} subDomain - 子域名
     * @returns {Promise<boolean>} 是否成功暂存
     */
    async tempStore(domain, username, password, subDomain) {
        try {
            if (!domain || !username || !password) {
                throw new Error('域名、用户名和密码不能为空');
            }
            
            // 首先尝试使用扩展存储，失败时降级到localStorage
            let tempData;
            try {
                tempData = await this.getTempData();
            } catch (error) {
                console.warn('扩展存储失效，使用localStorage降级方案:', error);
                tempData = this.getTempDataFromLocalStorage();
            }
            
            // 检查是否已存在相同的临时数据
            const existingTempIndex = tempData.findIndex(item => 
                item.domain === domain && 
                item.username === username &&
                item.subDomain === subDomain
            );
            
            let shouldUpdate = false;
            let updateType = '';
            
            if (existingTempIndex >= 0) {
                // 临时数据已存在，检查密码是否相同
                const existingTemp = tempData[existingTempIndex];
                if (existingTemp.password === password) {
                    console.log('临时数据已存在且密码相同，跳过暂存');
                    return false;
                } else {
                    console.log('临时数据已存在但密码不同，更新临时数据');
                    shouldUpdate = true;
                    updateType = 'temp';
                }
            } else {
                // 检查正式数据中是否已存在（这里也要处理上下文失效）
                let accounts = [];
                try {
                    accounts = await this.getAccountsByDomain(domain);
                } catch (error) {
                    console.warn('无法检查正式数据，继续暂存:', error);
                }
                
                const existingAccount = accounts.find(account => 
                    account.username === username && 
                    account.subDomain === subDomain
                );
                
                if (existingAccount) {
                    // 正式数据存在，需要对比密码
                    try {
                        const decryptedPassword = await cryptoManager.decrypt(
                            existingAccount.password, 
                            this.encryptionKey || await this.initEncryptionKey()
                        );
                        
                        if (decryptedPassword === password) {
                            console.log('账号已存在于正式数据中且密码相同，跳过暂存');
                            return false;
                        } else {
                            console.log('账号已存在于正式数据中但密码不同，创建临时数据');
                            shouldUpdate = false; // 创建新的临时数据
                            updateType = 'formal_diff';
                        }
                    } catch (error) {
                        console.warn('解密正式数据密码失败，创建临时数据:', error);
                        shouldUpdate = false;
                        updateType = 'formal_decrypt_error';
                    }
                } else {
                    console.log('未找到相同的账号数据，创建新的临时数据');
                    shouldUpdate = false;
                    updateType = 'new';
                }
            }
            
            // 创建或更新临时数据
            const newTempData = {
                domain,
                subDomain,
                username,
                password, // 临时存储不加密，确认后再加密
                timestamp: Date.now(),
                url: window.location.href,
                updateType: updateType
            };
            
            if (shouldUpdate && existingTempIndex >= 0) {
                // 更新现有临时数据
                tempData[existingTempIndex] = newTempData;
                console.log(`🔄 更新临时数据: ${username}@${domain}`);
            } else {
                // 添加新的临时数据
                tempData.push(newTempData);
                console.log(`➕ 创建新临时数据: ${username}@${domain} (${updateType})`);
            }
            
            // 尝试保存到扩展存储，失败时保存到localStorage
            let saveSuccess = false;
            try {
                await this.setStorageData(this.tempStorageKey, tempData);
                saveSuccess = true;
            } catch (error) {
                console.warn('扩展存储失效，使用localStorage保存:', error);
                this.saveTempDataToLocalStorage(tempData);
                saveSuccess = true;
            }
            
            if (saveSuccess) {
                // 尝试通知background script更新徽章
                this.tryNotifyBackgroundScript(tempData.length);
                
                // 显示用户友好的暂存成功提示
                this.showTempStoreSuccessNotification(username, domain, updateType, shouldUpdate);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('暂存失败:', error);
            // 显示用户友好的错误提示
            this.showTempStoreErrorNotification(error.message);
            return false;
        }
    }

    /**
     * 从localStorage获取暂存数据
     */
    getTempDataFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.tempStorageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('从localStorage获取暂存数据失败:', error);
            return [];
        }
    }

    /**
     * 保存暂存数据到localStorage
     */
    saveTempDataToLocalStorage(tempData) {
        try {
            localStorage.setItem(this.tempStorageKey, JSON.stringify(tempData));
        } catch (error) {
            console.error('保存暂存数据到localStorage失败:', error);
            throw error;
        }
    }

    /**
     * 尝试通知background script
     */
    tryNotifyBackgroundScript(count) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage({
                    type: 'TEMP_DATA_UPDATED',
                    count: count
                });
            }
        } catch (error) {
            console.warn('无法通知background script:', error);
        }
    }

    /**
     * 显示暂存成功通知
     */
    showTempStoreSuccessNotification(username, domain, updateType, isUpdate) {
        try {
            // 根据操作类型确定通知内容
            let title, description, icon;
            
            switch (updateType) {
                case 'temp':
                    title = '临时数据已更新';
                    description = `账号 "${username}" 的临时数据已更新<br>检测到密码变更，请确认保存`;
                    icon = '🔄';
                    break;
                case 'formal_diff':
                    title = '检测到密码变更';
                    description = `账号 "${username}" 的密码与已保存版本不同<br>新密码已暂存，请确认是否更新`;
                    icon = '🔐';
                    break;
                case 'formal_decrypt_error':
                    title = '账号已暂存';
                    description = `无法验证已保存的密码，新登录信息已暂存<br>请在扩展中确认处理`;
                    icon = '⚠️';
                    break;
                case 'new':
                default:
                    title = '账号已暂存';
                    description = `账号 "${username}" 已保存到待确认列表<br>点击浏览器扩展图标确认保存`;
                    icon = '✅';
                    break;
            }
            
            // 创建成功通知
            const notification = document.createElement('div');
            notification.className = 'pw-manager-success-notification';
            notification.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #27ae60, #229954);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 14px;
                    max-width: 350px;
                    animation: slideInRight 0.3s ease;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-size: 20px;">${icon}</div>
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
                            <div style="opacity: 0.9; font-size: 12px;">
                                ${description}
                            </div>
                        </div>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: auto;">×</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 根据重要性调整显示时间
            const displayTime = updateType === 'formal_diff' ? 8000 : 5000;
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, displayTime);
            
        } catch (error) {
            console.error('显示成功通知失败:', error);
        }
    }

    /**
     * 显示暂存错误通知
     */
    showTempStoreErrorNotification(errorMessage) {
        try {
            const notification = document.createElement('div');
            notification.className = 'pw-manager-error-notification';
            notification.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 14px;
                    max-width: 350px;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-size: 20px;">⚠️</div>
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">暂存失败</div>
                            <div style="opacity: 0.9; font-size: 12px;">
                                ${errorMessage.includes('Extension context') ? 
                                  '扩展需要重新加载<br>请前往扩展管理页面刷新插件' : 
                                  `错误: ${errorMessage}`}
                            </div>
                        </div>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: auto;">×</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 8秒后自动移除（错误通知显示时间长一些）
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 8000);
            
        } catch (error) {
            console.error('显示错误通知失败:', error);
        }
    }
    
    /**
     * 获取暂存数据
     * @returns {Promise<Array>} 暂存的账号数组
     */
    async getTempData() {
        try {
            const data = await this.getStorageData(this.tempStorageKey);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.warn('扩展存储获取失败，尝试localStorage:', error);
            
            // 降级到localStorage
            try {
                return this.getTempDataFromLocalStorage();
            } catch (localStorageError) {
                console.error('localStorage也获取失败:', localStorageError);
                return [];
            }
        }
    }
    
    /**
     * 清除暂存数据
     * @param {string} domain - 指定域名，不传则清除所有
     * @returns {Promise<boolean>} 是否成功
     */
    async clearTempData(domain = null) {
        try {
            if (domain) {
                const tempData = await this.getTempData();
                const filteredData = tempData.filter(item => item.domain !== domain);
                await this.setStorageData(this.tempStorageKey, filteredData);
            } else {
                await this.removeStorageData(this.tempStorageKey);
            }
            
            // 更新徽章
            const remainingData = await this.getTempData();
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'TEMP_DATA_UPDATED',
                    count: remainingData.length
                });
            }
            
            return true;
        } catch (error) {
            console.error('清除暂存数据失败:', error);
            return false;
        }
    }
    
    /**
     * 保存账号（从暂存转为正式）
     * @param {string} domain - 基础域名
     * @param {object|string} accountData - 账号数据对象或用户名
     * @param {string} password - 密码 (当第二个参数是用户名时)
     * @param {string} subDomain - 子域名 (当第二个参数是用户名时)
     * @returns {Promise<boolean>} 是否成功
     */
    async saveAccount(domain, accountData, password = null, subDomain = null) {
        // 处理重载：saveAccount(domain, username, password, subDomain)
        if (typeof accountData === 'string' && password !== null) {
            accountData = {
                username: accountData,
                password: password,
                subDomain: subDomain
            };
        }
        try {
            if (!this.encryptionKey) {
                await this.initEncryptionKey();
            }
            
            const allAccounts = await this.getAllAccounts();
            
            if (!allAccounts[domain]) {
                allAccounts[domain] = {
                    groupKey: domain,
                    appPackages: [],
                    accounts: []
                };
            }
            
            // 加密密码
            const encryptedPassword = await cryptoManager.encrypt(
                accountData.password, 
                this.encryptionKey
            );
            
            const now = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const newAccount = {
                subDomain: accountData.subDomain,
                appPackage: null,
                username: accountData.username,
                password: encryptedPassword,
                source: '插件',
                createdTime: now,
                modifyTime: now
            };
            
            // 检查是否已存在，存在则更新
            const existingIndex = allAccounts[domain].accounts.findIndex(
                account => account.username === accountData.username && 
                          account.subDomain === accountData.subDomain
            );
            
            if (existingIndex >= 0) {
                // 更新现有账号
                allAccounts[domain].accounts[existingIndex] = {
                    ...allAccounts[domain].accounts[existingIndex],
                    password: encryptedPassword,
                    modifyTime: now
                };
            } else {
                // 添加新账号
                allAccounts[domain].accounts.push(newAccount);
            }
            
            await this.setStorageData(this.accountsKey, allAccounts);
            
            // 从暂存中移除
            await this.removeTempAccount(domain, accountData.username, accountData.subDomain);
            
            return true;
        } catch (error) {
            console.error('保存账号失败:', error);
            return false;
        }
    }
    
    /**
     * 获取指定域名的所有账号
     * @param {string} domain - 基础域名
     * @returns {Promise<Array>} 账号数组
     */
    async getAccountsByDomain(domain) {
        try {
            const allAccounts = await this.getAllAccounts();
            
            if (!allAccounts[domain] || !allAccounts[domain].accounts) {
                return [];
            }
            
            // 解密密码
            const accounts = [];
            for (const account of allAccounts[domain].accounts) {
                try {
                    if (!this.encryptionKey) {
                        await this.initEncryptionKey();
                    }
                    
                    const decryptedPassword = await cryptoManager.decrypt(
                        account.password, 
                        this.encryptionKey
                    );
                    
                    accounts.push({
                        ...account,
                        password: decryptedPassword
                    });
                } catch (error) {
                    console.error('解密密码失败:', error);
                    // 保留原始加密数据，但标记为解密失败
                    accounts.push({
                        ...account,
                        password: '[解密失败]',
                        decryptError: true
                    });
                }
            }
            
            return accounts;
        } catch (error) {
            console.error('获取账号失败:', error);
            return [];
        }
    }
    
    /**
     * 删除账号
     * @param {string} domain - 基础域名
     * @param {string} username - 用户名
     * @param {string} subDomain - 子域名
     * @returns {Promise<boolean>} 是否成功
     */
    async deleteAccount(domain, username, subDomain = null) {
        try {
            const allAccounts = await this.getAllAccounts();
            
            if (!allAccounts[domain] || !allAccounts[domain].accounts) {
                return false;
            }
            
            const accounts = allAccounts[domain].accounts;
            const index = accounts.findIndex(account => 
                account.username === username && 
                (subDomain === null || account.subDomain === subDomain)
            );
            
            if (index >= 0) {
                accounts.splice(index, 1);
                
                // 如果该域名下没有账号了，删除整个域名条目
                if (accounts.length === 0) {
                    delete allAccounts[domain];
                }
                
                await this.setStorageData(this.accountsKey, allAccounts);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('删除账号失败:', error);
            return false;
        }
    }
    
    /**
     * 更新账号
     * @param {string} domain - 基础域名
     * @param {string} username - 用户名
     * @param {object} newData - 新数据
     * @returns {Promise<boolean>} 是否成功
     */
    async updateAccount(domain, username, newData) {
        try {
            const allAccounts = await this.getAllAccounts();
            
            if (!allAccounts[domain] || !allAccounts[domain].accounts) {
                return false;
            }
            
            const accounts = allAccounts[domain].accounts;
            const index = accounts.findIndex(account => 
                account.username === username && 
                account.subDomain === newData.subDomain
            );
            
            if (index >= 0) {
                const now = new Date().toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // 如果密码有更新，需要重新加密
                if (newData.password) {
                    if (!this.encryptionKey) {
                        await this.initEncryptionKey();
                    }
                    newData.password = await cryptoManager.encrypt(
                        newData.password, 
                        this.encryptionKey
                    );
                }
                
                accounts[index] = {
                    ...accounts[index],
                    ...newData,
                    modifyTime: now
                };
                
                await this.setStorageData(this.accountsKey, allAccounts);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('更新账号失败:', error);
            return false;
        }
    }
    
    /**
     * 获取所有账号数据
     * @returns {Promise<object>} 所有账号数据
     */
    async getAllAccounts() {
        try {
            const data = await this.getStorageData(this.accountsKey);
            return data || {};
        } catch (error) {
            console.error('获取所有账号失败:', error);
            return {};
        }
    }
    
    /**
     * 获取账号数据 (别名方法，兼容popup.js)
     * @returns {Promise<object>} 所有账号数据
     */
    async getAccounts() {
        return this.getAllAccounts();
    }
    
    /**
     * 获取暂存账号数据 (别名方法，兼容popup.js)
     * @returns {Promise<Array>} 暂存的账号数组
     */
    async getTempAccounts() {
        const tempData = await this.getTempData();
        // 为兼容popup.js，添加baseDomain字段
        return tempData.map(item => ({
            ...item,
            baseDomain: item.domain
        }));
    }
    
    /**
     * 按域名删除暂存账号 (兼容popup.js)
     * @param {string} domain - 域名
     */
    async removeTempAccountsByDomain(domain) {
        return this.clearTempData(domain);
    }
    
    /**
     * 从暂存中移除特定账号
     * @param {string} domain - 域名
     * @param {string} username - 用户名
     * @param {string} subDomain - 子域名
     */
    async removeTempAccount(domain, username, subDomain) {
        try {
            const tempData = await this.getTempData();
            const filteredData = tempData.filter(item => !(
                item.domain === domain && 
                item.username === username && 
                item.subDomain === subDomain
            ));
            
            await this.setStorageData(this.tempStorageKey, filteredData);
            
            // 更新徽章
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'TEMP_DATA_UPDATED',
                    count: filteredData.length
                });
            }
        } catch (error) {
            console.error('移除临时账号失败:', error);
        }
    }
    
    /**
     * 获取设置
     * @returns {Promise<object>} 设置对象
     */
    async getSettings() {
        try {
            const data = await this.getStorageData(this.settingsKey);
            return data || {};
        } catch (error) {
            console.error('获取设置失败:', error);
            return {};
        }
    }
    
    /**
     * 保存设置
     * @param {object} settings - 设置对象
     * @returns {Promise<boolean>} 是否成功
     */
    async saveSettings(settings) {
        try {
            await this.setStorageData(this.settingsKey, settings);
            return true;
        } catch (error) {
            console.error('保存设置失败:', error);
            return false;
        }
    }
    
    /**
     * 存储数据的底层方法
     * @param {string} key - 存储键
     * @param {any} data - 数据
     */
    async setStorageData(key, data) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && !chrome.runtime.lastError) {
            try {
                return new Promise((resolve, reject) => {
                    chrome.storage.local.set({ [key]: data }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Storage set error:', chrome.runtime.lastError);
                            reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.error('Extension context error:', error);
                // fallback to localStorage
                localStorage.setItem(key, JSON.stringify(data));
            }
        } else {
            // fallback to localStorage for testing or when extension context is invalid
            console.warn('Chrome storage not available, using localStorage fallback');
            localStorage.setItem(key, JSON.stringify(data));
        }
    }
    
    /**
     * 获取存储数据的底层方法
     * @param {string} key - 存储键
     * @returns {Promise<any>} 数据
     */
    async getStorageData(key) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && !chrome.runtime.lastError) {
            try {
                return new Promise((resolve, reject) => {
                    chrome.storage.local.get([key], (result) => {
                        if (chrome.runtime.lastError) {
                            console.error('Storage get error:', chrome.runtime.lastError);
                            reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
                        } else {
                            resolve(result[key]);
                        }
                    });
                });
            } catch (error) {
                console.error('Extension context error:', error);
                // fallback to localStorage
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            }
        } else {
            // fallback to localStorage for testing or when extension context is invalid
            console.warn('Chrome storage not available, using localStorage fallback');
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }
    }
    
    /**
     * 删除存储数据的底层方法
     * @param {string} key - 存储键
     */
    async removeStorageData(key) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && !chrome.runtime.lastError) {
            try {
                return new Promise((resolve, reject) => {
                    chrome.storage.local.remove([key], () => {
                        if (chrome.runtime.lastError) {
                            console.error('Storage remove error:', chrome.runtime.lastError);
                            reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.error('Extension context error:', error);
                // fallback to localStorage
                localStorage.removeItem(key);
            }
        } else {
            // fallback to localStorage for testing or when extension context is invalid
            console.warn('Chrome storage not available, using localStorage fallback');
            localStorage.removeItem(key);
        }
    }

    /**
     * 保存域名手动标记配置
     */
    async saveDomainMarking(domain, markingConfig) {
        try {
            const key = `domain_marking_${domain}`;
            await this.setStorageData(key, markingConfig);
            console.log(`✅ 域名标记已保存: ${domain}`, markingConfig);
        } catch (error) {
            console.error('保存域名标记失败:', error);
            throw error;
        }
    }

    /**
     * 获取域名手动标记配置
     */
    async getDomainMarking(domain) {
        try {
            const key = `domain_marking_${domain}`;
            const result = await this.getStorageData(key);
            return result || null;
        } catch (error) {
            console.error('获取域名标记失败:', error);
            return null;
        }
    }

    /**
     * 删除域名手动标记配置
     */
    async removeDomainMarking(domain) {
        try {
            const key = `domain_marking_${domain}`;
            await this.removeStorageData(key);
            console.log(`✅ 域名标记已删除: ${domain}`);
        } catch (error) {
            console.error('删除域名标记失败:', error);
            throw error;
        }
    }
}

// 创建全局实例
const storageManager = new StorageManager();

// 添加别名以保持兼容性
const StorageUtils = StorageManager;

// 如果在浏览器环境中，将类和实例挂载到window对象
if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    window.StorageUtils = StorageUtils; // 添加别名
    window.storageManager = storageManager;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, StorageUtils, storageManager };
}