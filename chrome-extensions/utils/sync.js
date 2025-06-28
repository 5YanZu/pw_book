/**
 * 极简同步管理器
 * 基于时间戳的冲突解决，无认证，非对称加密
 */
class SimpleSyncManager {
    constructor() {
        this.serverUrl = null;
        this.cryptoManager = new SimpleCryptoManager();
        this.syncState = 'idle';
        this.syncTimer = null;
    }
    
    /**
     * 初始化同步管理器
     */
    async init() {
        try {
            const settings = await this.getSyncSettings();
            this.serverUrl = settings.serverUrl;
            
            if (settings.publicKey && settings.privateKey) {
                await this.cryptoManager.importKeys(settings.publicKey, settings.privateKey);
            }
            
            if (settings.autoSync && settings.enabled) {
                this.startPeriodicSync(settings.syncInterval);
            }
            
            console.log('极简同步管理器初始化完成');
        } catch (error) {
            console.error('同步管理器初始化失败:', error);
        }
    }
    
    /**
     * 生成并配置密钥
     */
    async generateAndSetupKeys() {
        const keyPair = await this.cryptoManager.generateKeyPair();
        
        const settings = await this.getSyncSettings();
        settings.publicKey = keyPair.publicKey;
        settings.privateKey = keyPair.privateKey;
        await this.saveSyncSettings(settings);
        
        await this.cryptoManager.importKeys(keyPair.publicKey, keyPair.privateKey);
        
        return keyPair;
    }
    
    /**
     * 同步指定域名组
     */
    async syncDomain(domain) {
        try {
            // 获取本地数据
            const localData = await this.getLocalDomainData(domain);
            
            if (!localData) {
                // 本地无数据，尝试从服务端下载
                await this.downloadDomainData(domain);
                return;
            }
            
            // 上传到服务端
            const response = await this.uploadDomainData(domain, localData);
            
            if (response.status === 'conflict_resolved') {
                // 服务端数据更新，应用服务端数据
                const serverData = await this.cryptoManager.decrypt(response.data.encryptedData);
                await this.saveLocalDomainData(domain, serverData, response.data.lastModified);
                console.log(`域名 ${domain}: 应用服务端最新数据`);
                
                // 通知UI数据已更新
                this.notifyDataUpdate(domain, 'server_newer');
            } else {
                console.log(`域名 ${domain}: 同步成功`);
            }
            
        } catch (error) {
            console.error(`域名 ${domain} 同步失败:`, error);
            throw error;
        }
    }
    
    /**
     * 上传域名数据
     */
    async uploadDomainData(domain, data) {
        const encryptedData = await this.cryptoManager.encrypt(data);
        const hash = await this.calculateHash(JSON.stringify(data));
        
        const response = await fetch(`${this.serverUrl}/api/sync/${domain}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                encryptedData,
                lastModified: data.lastModified,
                hash
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    /**
     * 下载域名数据
     */
    async downloadDomainData(domain) {
        try {
            const response = await fetch(`${this.serverUrl}/api/sync/${domain}`);
            
            if (response.status === 404) {
                console.log(`域名 ${domain}: 服务端无数据`);
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                const decryptedData = await this.cryptoManager.decrypt(result.data.encryptedData);
                await this.saveLocalDomainData(domain, decryptedData, result.data.lastModified);
                console.log(`域名 ${domain}: 下载成功`);
                
                // 通知UI数据已更新
                this.notifyDataUpdate(domain, 'downloaded');
            }
            
        } catch (error) {
            console.error(`下载域名 ${domain} 失败:`, error);
            throw error;
        }
    }
    
    /**
     * 获取本地域名数据
     */
    async getLocalDomainData(domain) {
        const allAccounts = await storageManager.getAllAccounts();
        const domainData = allAccounts[domain];
        
        if (!domainData || !domainData.accounts || domainData.accounts.length === 0) {
            return null;
        }
        
        // 添加最后修改时间
        return {
            ...domainData,
            lastModified: this.getLatestModifyTime(domainData.accounts)
        };
    }
    
    /**
     * 保存本地域名数据
     */
    async saveLocalDomainData(domain, data, lastModified) {
        // 清除现有数据
        try {
            const existingAccounts = await storageManager.getAccountsByDomain(domain);
            for (const account of existingAccounts) {
                await storageManager.deleteAccount(domain, account.username, account.subDomain);
            }
        } catch (error) {
            console.warn('清除现有数据失败:', error);
        }
        
        // 保存新数据
        for (const account of data.accounts || []) {
            await storageManager.saveAccount(domain, account, account.password, account.subDomain);
        }
        
        console.log(`域名 ${domain}: 本地数据已更新`);
    }
    
    /**
     * 获取最新修改时间
     */
    getLatestModifyTime(accounts) {
        let latest = new Date(0);
        for (const account of accounts) {
            const modifyTime = new Date(account.modifyTime);
            if (modifyTime > latest) {
                latest = modifyTime;
            }
        }
        return latest.toISOString();
    }
    
    /**
     * 计算数据哈希
     */
    async calculateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * 同步所有域名
     */
    async syncAll() {
        if (this.syncState === 'syncing') {
            console.log('同步已在进行中');
            return;
        }
        
        this.syncState = 'syncing';
        this.notifySyncStateChange('syncing');
        
        try {
            const allAccounts = await storageManager.getAllAccounts();
            const domains = Object.keys(allAccounts);
            
            console.log(`开始同步 ${domains.length} 个域名组`);
            
            for (const domain of domains) {
                await this.syncDomain(domain);
            }
            
            // 检查服务端是否有本地没有的数据
            await this.checkServerOnlyDomains();
            
            this.notifySyncStateChange('success');
            console.log('全量同步完成');
            
        } catch (error) {
            console.error('全量同步失败:', error);
            this.notifySyncStateChange('error', error);
        } finally {
            this.syncState = 'idle';
        }
    }
    
    /**
     * 检查服务端独有的域名
     */
    async checkServerOnlyDomains() {
        try {
            const response = await fetch(`${this.serverUrl}/api/sync`);
            
            if (!response.ok) {
                console.warn('获取服务端域名列表失败');
                return;
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                const allAccounts = await storageManager.getAllAccounts();
                const localDomains = Object.keys(allAccounts);
                
                for (const serverDomain of result.data) {
                    if (!localDomains.includes(serverDomain.domainGroup)) {
                        console.log(`发现服务端独有域名: ${serverDomain.domainGroup}`);
                        await this.downloadDomainData(serverDomain.domainGroup);
                    }
                }
            }
            
        } catch (error) {
            console.error('检查服务端域名失败:', error);
        }
    }
    
    /**
     * 启动定时同步
     */
    startPeriodicSync(interval = 300000) {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        this.syncTimer = setInterval(async () => {
            try {
                await this.syncAll();
            } catch (error) {
                console.error('定时同步失败:', error);
            }
        }, interval);
        
        console.log(`启动定时同步，间隔: ${interval}ms`);
    }
    
    /**
     * 停止定时同步
     */
    stopPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('停止定时同步');
        }
    }
    
    /**
     * 测试连接
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.serverUrl}/api/sync`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    message: '连接成功',
                    data: result
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            return {
                success: false,
                message: `连接失败: ${error.message}`,
                error: error
            };
        }
    }
    
    /**
     * 通知同步状态变化
     */
    notifySyncStateChange(state, error = null) {
        const event = new CustomEvent('syncStateChange', {
            detail: { state, error, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 通知数据更新
     */
    notifyDataUpdate(domain, type) {
        const event = new CustomEvent('dataUpdate', {
            detail: { domain, type, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 获取同步设置
     */
    async getSyncSettings() {
        const settings = await storageManager.getSettings();
        return settings.syncSettings || {
            enabled: false,
            serverUrl: '',
            autoSync: true,
            syncInterval: 300000,
            publicKey: null,
            privateKey: null
        };
    }
    
    /**
     * 保存同步设置
     */
    async saveSyncSettings(syncSettings) {
        const settings = await storageManager.getSettings();
        settings.syncSettings = syncSettings;
        await storageManager.saveSettings(settings);
    }
}

/**
 * 极简加密管理器
 * 使用非对称加密（RSA + AES混合加密）
 */
class SimpleCryptoManager {
    constructor() {
        this.publicKey = null;
        this.privateKey = null;
    }
    
    /**
     * 生成密钥对
     */
    async generateKeyPair() {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
        );
        
        return {
            publicKey: await this.exportKey(keyPair.publicKey, 'spki'),
            privateKey: await this.exportKey(keyPair.privateKey, 'pkcs8')
        };
    }
    
    /**
     * 导入密钥
     */
    async importKeys(publicKeyPem, privateKeyPem) {
        this.publicKey = await crypto.subtle.importKey(
            'spki',
            this.pemToBuffer(publicKeyPem),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
        );
        
        this.privateKey = await crypto.subtle.importKey(
            'pkcs8', 
            this.pemToBuffer(privateKeyPem),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['decrypt']
        );
    }
    
    /**
     * 加密数据（混合加密）
     */
    async encrypt(data) {
        const jsonString = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(jsonString);
        
        // 生成AES密钥
        const aesKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        // 用AES加密数据
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            dataBuffer
        );
        
        // 导出AES密钥
        const exportedKey = await crypto.subtle.exportKey('raw', aesKey);
        
        // 用RSA加密AES密钥
        const encryptedKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            this.publicKey,
            exportedKey
        );
        
        return {
            type: 'hybrid',
            encryptedKey: this.arrayBufferToBase64(encryptedKey),
            encryptedData: this.arrayBufferToBase64(encryptedData),
            iv: this.arrayBufferToBase64(iv)
        };
    }
    
    /**
     * 解密数据
     */
    async decrypt(encryptedPackage) {
        if (typeof encryptedPackage !== 'object' || encryptedPackage.type !== 'hybrid') {
            throw new Error('Invalid encrypted data format');
        }
        
        // 解密AES密钥
        const encryptedKey = this.base64ToArrayBuffer(encryptedPackage.encryptedKey);
        const keyBuffer = await crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            this.privateKey,
            encryptedKey
        );
        
        // 导入AES密钥
        const aesKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        // 解密数据
        const encryptedData = this.base64ToArrayBuffer(encryptedPackage.encryptedData);
        const iv = this.base64ToArrayBuffer(encryptedPackage.iv);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            encryptedData
        );
        
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(decrypted);
        return JSON.parse(jsonString);
    }
    
    // 工具方法
    pemToBuffer(pem) {
        const base64 = pem
            .replace(/-----BEGIN.*?-----/, '')
            .replace(/-----END.*?-----/, '')
            .replace(/\s/g, '');
        return this.base64ToArrayBuffer(base64);
    }
    
    async exportKey(key, format) {
        const exported = await crypto.subtle.exportKey(format, key);
        const base64 = this.arrayBufferToBase64(exported);
        const type = format === 'spki' ? 'PUBLIC' : 'PRIVATE';
        return `-----BEGIN ${type} KEY-----\n${base64}\n-----END ${type} KEY-----`;
    }
    
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// 全局实例
const simpleSyncManager = new SimpleSyncManager(); 