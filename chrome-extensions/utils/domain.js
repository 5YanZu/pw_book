/**
 * 域名处理工具类
 * 用于提取基础域名、子域名等操作
 */
class DomainManager {
    /**
     * 从URL中提取基础域名
     * 例如: map.baidu.com -> baidu.com
     * @param {string} url - 完整URL或域名
     * @returns {string} 基础域名
     */
    static getBaseDomain(url) {
        try {
            let hostname;
            
            // 如果是完整URL，提取hostname
            if (url.includes('://')) {
                hostname = new URL(url).hostname;
            } else {
                hostname = url;
            }
            
            // 去除www前缀
            hostname = hostname.replace(/^www\./, '');
            
            // 处理IP地址
            if (this.isIP(hostname)) {
                return hostname;
            }
            
            // 分割域名部分
            const parts = hostname.split('.');
            
            // 处理特殊的二级域名后缀
            const specialSuffixes = [
                'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
                'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
                'co.jp', 'or.jp', 'ne.jp', 'ac.jp',
                'com.au', 'net.au', 'org.au', 'edu.au'
            ];
            
            // 检查是否有特殊后缀
            for (const suffix of specialSuffixes) {
                if (hostname.endsWith('.' + suffix)) {
                    const suffixParts = suffix.split('.');
                    const remainingParts = parts.slice(0, -(suffixParts.length));
                    if (remainingParts.length > 0) {
                        return remainingParts.slice(-1)[0] + '.' + suffix;
                    }
                    return hostname;
                }
            }
            
            // 普通域名处理
            if (parts.length >= 2) {
                return parts.slice(-2).join('.');
            }
            
            return hostname;
        } catch (error) {
            console.error('提取基础域名失败:', error);
            return url;
        }
    }
    
    /**
     * 获取子域名
     * 例如: https://pan.baidu.com -> pan.baidu.com
     * @param {string} url - 完整URL
     * @returns {string} 子域名
     */
    static getSubDomain(url) {
        try {
            let hostname;
            
            if (url.includes('://')) {
                hostname = new URL(url).hostname;
            } else {
                hostname = url;
            }
            
            return hostname;
        } catch (error) {
            console.error('获取子域名失败:', error);
            return '';
        }
    }
    
    /**
     * 验证域名是否有效
     * @param {string} domain - 域名
     * @returns {boolean} 是否有效
     */
    static isValidDomain(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }
        
        // 域名正则表达式
        const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
        
        // 检查长度和格式
        if (domain.length > 253 || !domainRegex.test(domain)) {
            return false;
        }
        
        // 检查每个部分的长度
        const parts = domain.split('.');
        return parts.every(part => part.length <= 63);
    }
    
    /**
     * 检查是否为IP地址
     * @param {string} str - 字符串
     * @returns {boolean} 是否为IP地址
     */
    static isIP(str) {
        // IPv4正则
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        
        // IPv6正则（简化版）
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        return ipv4Regex.test(str) || ipv6Regex.test(str);
    }
    
    /**
     * 获取当前页面的域名信息
     * @returns {object} 包含baseDomain和subDomain的对象
     */
    static getCurrentDomainInfo() {
        const currentUrl = window.location.href;
        return {
            baseDomain: this.getBaseDomain(currentUrl),
            subDomain: this.getSubDomain(currentUrl),
            fullUrl: currentUrl
        };
    }
    
    /**
     * 检查两个域名是否属于同一基础域名
     * @param {string} domain1 - 域名1
     * @param {string} domain2 - 域名2
     * @returns {boolean} 是否属于同一基础域名
     */
    static isSameBaseDomain(domain1, domain2) {
        return this.getBaseDomain(domain1) === this.getBaseDomain(domain2);
    }
}

// 添加别名以保持兼容性
const DomainUtils = DomainManager;

// 如果在浏览器环境中，将类挂载到window对象
if (typeof window !== 'undefined') {
    window.DomainManager = DomainManager;
    window.DomainUtils = DomainUtils; // 添加别名
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomainManager;
} 