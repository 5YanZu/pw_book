/**
 * 极简密钥管理器
 * 仅用于管理加密密钥，无需用户认证
 */
class SimpleKeyManager {
    constructor() {
        this.keyPair = null;
    }
    
    /**
     * 初始化密钥管理器
     */
    async init() {
        try {
            const settings = await this.getKeySettings();
            if (settings.publicKey && settings.privateKey) {
                await this.loadKeys(settings.publicKey, settings.privateKey);
                console.log('密钥加载成功');
            } else {
                console.log('未配置密钥，需要生成或导入密钥');
            }
        } catch (error) {
            console.error('密钥管理器初始化失败:', error);
        }
    }
    
    /**
     * 生成新的密钥对
     */
    async generateKeyPair() {
        try {
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
            
            const publicKeyPem = await this.exportKey(keyPair.publicKey, 'spki');
            const privateKeyPem = await this.exportKey(keyPair.privateKey, 'pkcs8');
            
            // 保存密钥
            await this.saveKeys(publicKeyPem, privateKeyPem);
            
            // 加载到内存
            await this.loadKeys(publicKeyPem, privateKeyPem);
            
            console.log('新密钥对生成成功');
            
            return {
                publicKey: publicKeyPem,
                privateKey: privateKeyPem,
                fingerprint: await this.getKeyFingerprint(publicKeyPem)
            };
            
        } catch (error) {
            console.error('生成密钥对失败:', error);
            throw error;
        }
    }
    
    /**
     * 导入密钥对
     */
    async importKeyPair(publicKeyPem, privateKeyPem) {
        try {
            // 验证密钥格式
            await this.validateKeys(publicKeyPem, privateKeyPem);
            
            // 保存密钥
            await this.saveKeys(publicKeyPem, privateKeyPem);
            
            // 加载到内存
            await this.loadKeys(publicKeyPem, privateKeyPem);
            
            console.log('密钥导入成功');
            
            return {
                fingerprint: await this.getKeyFingerprint(publicKeyPem)
            };
            
        } catch (error) {
            console.error('导入密钥失败:', error);
            throw error;
        }
    }
    
    /**
     * 导出密钥对
     */
    async exportKeyPair() {
        const settings = await this.getKeySettings();
        
        if (!settings.publicKey || !settings.privateKey) {
            throw new Error('未配置密钥');
        }
        
        return {
            publicKey: settings.publicKey,
            privateKey: settings.privateKey,
            fingerprint: await this.getKeyFingerprint(settings.publicKey),
            exportTime: new Date().toISOString()
        };
    }
    
    /**
     * 加载密钥到内存
     */
    async loadKeys(publicKeyPem, privateKeyPem) {
        this.keyPair = {
            publicKey: await crypto.subtle.importKey(
                'spki',
                this.pemToBuffer(publicKeyPem),
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['encrypt']
            ),
            privateKey: await crypto.subtle.importKey(
                'pkcs8',
                this.pemToBuffer(privateKeyPem),
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['decrypt']
            )
        };
    }
    
    /**
     * 验证密钥格式
     */
    async validateKeys(publicKeyPem, privateKeyPem) {
        try {
            // 尝试导入密钥
            const publicKey = await crypto.subtle.importKey(
                'spki',
                this.pemToBuffer(publicKeyPem),
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['encrypt']
            );
            
            const privateKey = await crypto.subtle.importKey(
                'pkcs8',
                this.pemToBuffer(privateKeyPem),
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['decrypt']
            );
            
            // 测试加密解密
            const testData = 'test message';
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(testData);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                publicKey,
                dataBuffer
            );
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                privateKey,
                encrypted
            );
            
            const decoder = new TextDecoder();
            const decryptedText = decoder.decode(decrypted);
            
            if (decryptedText !== testData) {
                throw new Error('密钥对不匹配');
            }
            
            return true;
            
        } catch (error) {
            throw new Error(`密钥验证失败: ${error.message}`);
        }
    }
    
    /**
     * 获取密钥指纹
     */
    async getKeyFingerprint(publicKeyPem) {
        const encoder = new TextEncoder();
        const keyBuffer = encoder.encode(publicKeyPem);
        const hashBuffer = await crypto.subtle.digest('SHA-256', keyBuffer);
        
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return fingerprint.substring(0, 16).toUpperCase();
    }
    
    /**
     * 获取公钥
     */
    getPublicKey() {
        return this.keyPair?.publicKey;
    }
    
    /**
     * 获取私钥
     */
    getPrivateKey() {
        return this.keyPair?.privateKey;
    }
    
    /**
     * 检查是否已配置密钥
     */
    isKeyConfigured() {
        return this.keyPair !== null;
    }
    
    /**
     * 删除密钥
     */
    async deleteKeys() {
        const settings = await storageManager.getSettings();
        delete settings.keySettings;
        await storageManager.saveSettings(settings);
        
        this.keyPair = null;
        
        console.log('密钥已删除');
    }
    
    /**
     * 保存密钥到本地存储
     */
    async saveKeys(publicKey, privateKey) {
        const settings = await storageManager.getSettings();
        settings.keySettings = {
            publicKey,
            privateKey,
            createdAt: new Date().toISOString(),
            fingerprint: await this.getKeyFingerprint(publicKey)
        };
        await storageManager.saveSettings(settings);
    }
    
    /**
     * 获取密钥设置
     */
    async getKeySettings() {
        const settings = await storageManager.getSettings();
        return settings.keySettings || {};
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
const simpleKeyManager = new SimpleKeyManager(); 