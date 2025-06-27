/**
 * 密码加密解密工具类
 * 使用Web Crypto API进行AES-GCM加密
 */
class CryptoManager {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.isSecure = this.checkSecureContext();
    }
    
    /**
     * 检查是否为安全上下文
     * @returns {boolean} 是否支持Web Crypto API
     */
    checkSecureContext() {
        return typeof crypto !== 'undefined' && 
               crypto.subtle && 
               (window.isSecureContext || 
                window.location.protocol === 'https:' || 
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'chrome-extension:');
    }
    
    /**
     * 生成加密密钥
     * @returns {Promise<CryptoKey|object>} 生成的密钥
     */
    async generateKey() {
        if (!this.isSecure) {
            console.warn('非HTTPS环境，使用简单加密方案');
            return this.generateSimpleKey();
        }
        
        return await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true, // 可导出
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 生成简单密钥（用于非HTTPS环境）
     * @returns {object} 简单密钥对象
     */
    generateSimpleKey() {
        const key = [];
        for (let i = 0; i < 32; i++) {
            key.push(Math.floor(Math.random() * 256));
        }
        return {
            type: 'simple',
            key: new Uint8Array(key)
        };
    }
    
    /**
     * 从密码派生密钥
     * @param {string} password - 主密码
     * @param {Uint8Array} salt - 盐值
     * @returns {Promise<CryptoKey>} 派生的密钥
     */
    async deriveKeyFromPassword(password, salt) {
        // 将密码转换为密钥材料
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        // 使用PBKDF2派生密钥
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            false, // 不可导出
            ['encrypt', 'decrypt']
        );
    }
    
    /**
     * 加密文本
     * @param {string} plaintext - 明文
     * @param {CryptoKey|object} key - 加密密钥
     * @returns {Promise<string>} 加密后的Base64字符串
     */
    async encrypt(plaintext, key) {
        try {
            // 如果是简单密钥，使用简单加密
            if (key && key.type === 'simple') {
                return this.simpleEncrypt(plaintext, key.key);
            }
            
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            // 生成随机IV
            const iv = this.isSecure ? 
                crypto.getRandomValues(new Uint8Array(12)) : 
                this.generateSimpleIV();
            
            // 加密数据
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                data
            );
            
            // 将IV和加密数据组合
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            // 转换为Base64
            return this.arrayBufferToBase64(combined);
        } catch (error) {
            console.error('加密失败:', error);
            throw new Error('密码加密失败');
        }
    }

    /**
     * 简单加密（用于非HTTPS环境）
     * @param {string} plaintext - 明文
     * @param {Uint8Array} key - 密钥
     * @returns {string} 加密后的Base64字符串
     */
    simpleEncrypt(plaintext, key) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        const encrypted = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            encrypted[i] = data[i] ^ key[i % key.length];
        }
        
        return this.arrayBufferToBase64(encrypted);
    }

    /**
     * 生成简单IV
     * @returns {Uint8Array} IV
     */
    generateSimpleIV() {
        const iv = new Uint8Array(12);
        for (let i = 0; i < 12; i++) {
            iv[i] = Math.floor(Math.random() * 256);
        }
        return iv;
    }
    
    /**
     * 解密文本
     * @param {string} encryptedData - 加密的Base64字符串
     * @param {CryptoKey|object} key - 解密密钥
     * @returns {Promise<string>} 解密后的明文
     */
    async decrypt(encryptedData, key) {
        try {
            // 如果是简单密钥，使用简单解密
            if (key && key.type === 'simple') {
                return this.simpleDecrypt(encryptedData, key.key);
            }
            
            // 从Base64转换
            const combined = this.base64ToArrayBuffer(encryptedData);
            
            // 分离IV和加密数据
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            
            // 解密数据
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                encrypted
            );
            
            // 转换为字符串
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('解密失败:', error);
            throw new Error('密码解密失败');
        }
    }

    /**
     * 简单解密（用于非HTTPS环境）
     * @param {string} encryptedData - 加密的Base64字符串
     * @param {Uint8Array} key - 密钥
     * @returns {string} 解密后的明文
     */
    simpleDecrypt(encryptedData, key) {
        const encrypted = this.base64ToArrayBuffer(encryptedData);
        const decrypted = new Uint8Array(encrypted.length);
        
        for (let i = 0; i < encrypted.length; i++) {
            decrypted[i] = encrypted[i] ^ key[i % key.length];
        }
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }
    
    /**
     * 导出密钥为Base64字符串
     * @param {CryptoKey|object} key - 要导出的密钥
     * @returns {Promise<string>} Base64格式的密钥
     */
    async exportKey(key) {
        if (key && key.type === 'simple') {
            return JSON.stringify({
                type: 'simple',
                key: this.arrayBufferToBase64(key.key)
            });
        }
        
        const exported = await crypto.subtle.exportKey('raw', key);
        return this.arrayBufferToBase64(new Uint8Array(exported));
    }
    
    /**
     * 从Base64字符串导入密钥
     * @param {string} keyData - Base64格式的密钥
     * @returns {Promise<CryptoKey|object>} 导入的密钥
     */
    async importKey(keyData) {
        try {
            // 尝试解析为简单密钥
            const parsed = JSON.parse(keyData);
            if (parsed.type === 'simple') {
                return {
                    type: 'simple',
                    key: this.base64ToArrayBuffer(parsed.key)
                };
            }
        } catch (e) {
            // 不是JSON，继续使用标准导入
        }
        
        if (!this.isSecure) {
            // 在非安全环境下，转换为简单密钥
            const keyBuffer = this.base64ToArrayBuffer(keyData);
            return {
                type: 'simple',
                key: keyBuffer
            };
        }
        
        const keyBuffer = this.base64ToArrayBuffer(keyData);
        return await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );
    }
    
    /**
     * 生成随机盐值
     * @param {number} length - 盐值长度，默认32字节
     * @returns {Uint8Array} 随机盐值
     */
    generateSalt(length = 32) {
        if (this.isSecure) {
            return crypto.getRandomValues(new Uint8Array(length));
        }
        
        // 简单随机生成
        const salt = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            salt[i] = Math.floor(Math.random() * 256);
        }
        return salt;
    }
    
    /**
     * 计算文本的SHA-256哈希值
     * @param {string} text - 要哈希的文本
     * @returns {Promise<string>} 哈希值的Base64字符串
     */
    async hash(text) {
        if (this.isSecure) {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return this.arrayBufferToBase64(new Uint8Array(hashBuffer));
        }
        
        // 简单哈希实现（非安全环境）
        return this.simpleHash(text);
    }

    /**
     * 简单哈希实现
     * @param {string} text - 要哈希的文本
     * @returns {string} 哈希值的Base64字符串
     */
    simpleHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        // 将hash转换为字节数组
        const bytes = new Uint8Array(4);
        bytes[0] = (hash >>> 24) & 0xFF;
        bytes[1] = (hash >>> 16) & 0xFF;
        bytes[2] = (hash >>> 8) & 0xFF;
        bytes[3] = hash & 0xFF;
        
        return this.arrayBufferToBase64(bytes);
    }
    
    /**
     * ArrayBuffer转Base64
     * @param {Uint8Array} buffer - 字节数组
     * @returns {string} Base64字符串
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Base64转ArrayBuffer
     * @param {string} base64 - Base64字符串
     * @returns {Uint8Array} 字节数组
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    
    /**
     * 生成随机密码
     * @param {number} length - 密码长度
     * @param {object} options - 密码选项
     * @returns {string} 生成的随机密码
     */
    generateRandomPassword(length = 12, options = {}) {
        const {
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = false,
            excludeSimilar = true
        } = options;
        
        let charset = '';
        
        if (includeUppercase) {
            charset += excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        }
        
        if (includeLowercase) {
            charset += excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
        }
        
        if (includeNumbers) {
            charset += excludeSimilar ? '23456789' : '0123456789';
        }
        
        if (includeSymbols) {
            charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        }
        
        if (!charset) {
            throw new Error('至少需要选择一种字符类型');
        }
        
        let password = '';
        const randomValues = crypto.getRandomValues(new Uint8Array(length));
        
        for (let i = 0; i < length; i++) {
            password += charset[randomValues[i] % charset.length];
        }
        
        return password;
    }
}

// 创建全局实例
const cryptoManager = new CryptoManager();

// 添加别名以保持兼容性
const CryptoUtils = CryptoManager;

// 如果在浏览器环境中，将类和实例挂载到window对象
if (typeof window !== 'undefined') {
    window.CryptoManager = CryptoManager;
    window.CryptoUtils = CryptoUtils; // 添加别名
    window.cryptoManager = cryptoManager;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CryptoManager, CryptoUtils, cryptoManager };
} 