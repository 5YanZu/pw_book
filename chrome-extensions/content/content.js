/**
 * Content Script - 页面内容脚本
 * 实现表单检测、登录监听、自动填充等功能
 */

// 全局变量
let formDetector = null;
let currentDetectedForm = null;
let fillWidget = null;
let isInitialized = false;
let isDetecting = false;
let lastDetectionTime = 0;
let detectionTimeoutId = null;
let observedMutations = new Set();

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ACTIVATE_MANUAL_MARKING') {
        if (window.manualMarkingMode) {
            window.manualMarkingMode.activate();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Manual marking mode not initialized' });
        }
    }
    return true; // 保持消息通道开放
});

// 增强版表单选择器 - 完善版
const ENHANCED_FORM_SELECTORS = {
    username: {
        high: [
            // 标准属性
            'input[type="text"][name*="user"]',
            'input[type="text"][name*="account"]',
            'input[type="email"][name*="email"]',
            'input[type="text"][id*="user"]',
            'input[type="text"][id*="account"]',
            'input[type="text"][autocomplete="username"]',
            'input[name="username"]',
            'input[name="account"]',
            'input[id="username"]',
            'input[id="account"]',
            
            // 企业级字段
            'input[name*="employee"]',
            'input[name*="工号"]',
            'input[id*="employee"]',
            'input[name*="login"]',
            'input[id*="login"]',
            'input[name*="admin"]',
            'input[id*="admin"]',
            'input[name*="manager"]',
            'input[id*="manager"]',
            
            // 现代框架支持
            'input[data-testid*="username"]',
            'input[data-testid*="user"]',
            'input[data-testid*="email"]',
            'input[data-field="username"]',
            'input[data-field="user"]',
            'input[data-field="email"]',
            'input[data-field="account"]',
            
            // 自定义元素和混合组件支持
            '[role="textbox"][data-field="username"]',
            '[role="textbox"][data-field="user"]',
            '[role="textbox"][data-field="email"]',
            '[role="textbox"][data-field="account"]',
            '[contenteditable="true"][data-field="username"]',
            '[contenteditable="true"][data-field="user"]',
            '[contenteditable="true"][data-field="email"]',
            '[contenteditable="true"][data-field="account"]',
            'user-input',
            'username-input',
            'account-input',
            
            // 多语言支持
            'input[name*="utilisateur"]', // 法语
            'input[name*="usuario"]',     // 西班牙语
            'input[name*="utente"]',      // 意大利语
            'input[placeholder*="ユーザー"]' // 日语
        ],
        medium: [
            // 中文placeholder
            'input[placeholder*="用户名"]',
            'input[placeholder*="账号"]', 
            'input[placeholder*="手机号"]',
            'input[placeholder*="邮箱"]',
            'input[placeholder*="工号"]',
            'input[placeholder*="员工号"]',
            
            // 英文placeholder
            'input[placeholder*="username"]',
            'input[placeholder*="account"]',
            'input[placeholder*="email"]',
            'input[placeholder*="phone"]',
            'input[placeholder*="mobile"]',
            'input[placeholder*="employee"]',
            'input[placeholder*="login"]',
            
            // CSS类名
            'input[class*="username"]',
            'input[class*="user-input"]',
            'input[class*="email-input"]',
            'input[class*="account-input"]',
            'input[class*="login-input"]',
            
            // 百度特有类名和属性
            'input[class*="pass-text-input-userName"]',
            'input[class*="userName"]',
            'input[name="userName"]',
            'input[id*="userName"]',
            
            // 百度特有类名
            'input[class*="pass-text-input-userName"]',
            'input[class*="userName"]',
            'input[name="userName"]',
            
            // Vue/React属性
            'input[v-model*="user"]',
            'input[v-model*="email"]',
            'input[v-model*="account"]',
            
            // 自定义元素支持
            '[role="textbox"][data-placeholder*="用户"]',
            '[role="textbox"][data-placeholder*="账号"]',
            '[role="textbox"][data-placeholder*="邮箱"]',
            '[role="textbox"][data-placeholder*="user"]',
            '[role="textbox"][data-placeholder*="account"]',
            '[role="textbox"][data-placeholder*="email"]',
            '[contenteditable="true"][data-placeholder*="用户"]',
            '[contenteditable="true"][data-placeholder*="账号"]',
            '[contenteditable="true"][data-placeholder*="user"]',
            '[contenteditable="true"][data-placeholder*="account"]',
            
            // 多语言placeholder
            'input[placeholder*="nom d\'utilisateur"]', // 法语
            'input[placeholder*="nombre de usuario"]',  // 西班牙语
            'input[placeholder*="nome utente"]',        // 意大利语
            'input[placeholder*="benutzername"]',       // 德语
            
            // 自定义元素支持
            '[role="textbox"][data-placeholder*="用户"]',
            '[role="textbox"][data-placeholder*="账号"]',
            '[role="textbox"][data-placeholder*="邮箱"]',
            '[role="textbox"][data-placeholder*="user"]',
            '[role="textbox"][data-placeholder*="account"]',
            '[role="textbox"][data-placeholder*="email"]',
            '[contenteditable="true"][data-placeholder*="用户"]',
            '[contenteditable="true"][data-placeholder*="账号"]',
            '[contenteditable="true"][data-placeholder*="user"]',
            '[contenteditable="true"][data-placeholder*="account"]'
        ],
        low: [
            'input[type="text"]',
            'input[type="email"]',
            'input[type="tel"]',
            'input:not([type])',
            
            // 自定义组件
            '[contenteditable="true"]',
            'div[data-field="username"]',
            'div[data-field="user"]',
            'div[data-field="account"]',
            'div[data-field="email"]',
            '[role="textbox"]',
            'div[data-role="input"]',
            'user-input',
            'username-input',
            'account-input'
        ]
    },
    password: {
        high: [
            'input[type="password"]',
            'input[autocomplete="current-password"]',
            'input[autocomplete="new-password"]',
            'input[name*="pass"]',
            'input[id*="pass"]',
            'input[name*="admin"]',
            'input[id*="admin"]',
            
            // 多语言支持
            'input[name*="mot_de_passe"]',  // 法语
            'input[name*="contraseña"]',    // 西班牙语
            'input[name*="password"]',      // 英语
            'input[name*="senha"]',         // 葡萄牙语
            
            // 现代框架
            'input[data-testid*="password"]',
            'input[data-field="password"]',
            'input[data-field*="pass"]',
            
            // 自定义元素支持
            '[role="textbox"][data-field="password"]',
            '[role="textbox"][data-field*="pass"]',
            '[role="textbox"][data-type="password"]',
            '[contenteditable="true"][data-field="password"]',
            '[contenteditable="true"][data-type="password"]',
            'pass-input',
            'password-input'
        ],
        medium: [
            // 中文
            'input[placeholder*="密码"]',
            'input[placeholder*="口令"]',
            
            // 英文
            'input[placeholder*="password"]',
            'input[placeholder*="pwd"]',
            'input[placeholder*="pass"]',
            
            // CSS类名
            'input[class*="password"]',
            'input[class*="pwd"]',
            'input[class*="pass-input"]',
            
            // 百度特有类名
            'input[class*="pass-text-input-password"]',
            
            // Vue/React
            'input[v-model*="password"]',
            'input[v-model*="pass"]',
            
            // 多语言
            'input[placeholder*="mot de passe"]',   // 法语
            'input[placeholder*="contraseña"]',     // 西班牙语
            'input[placeholder*="passwort"]',       // 德语
            'input[placeholder*="パスワード"]',       // 日语
            
            // 自定义元素支持
            '[role="textbox"][data-placeholder*="密码"]',
            '[role="textbox"][data-placeholder*="password"]',
            '[role="textbox"][data-placeholder*="pass"]',
            '[contenteditable="true"][data-placeholder*="密码"]',
            '[contenteditable="true"][data-placeholder*="password"]'
        ],
        low: [
            // 自定义组件
            'div[data-field="password"]',
            'div[data-type="password"]',
            '[role="textbox"][data-field="password"]',
            '[role="textbox"][data-type="password"]',
            '[contenteditable="true"][data-type="password"]',
            'pass-input',
            'password-input'
        ]
    },
    submit: {
        high: [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[class*="login"]',
            'button[class*="signin"]',
            'input[class*="login"]',
            
            // 现代框架
            'button[data-testid*="submit"]',
            'button[data-testid*="login"]',
            'button[data-action="login"]',
            'button[data-action="submit"]',
            'button[data-action*="login"]',
            'button[data-action*="complex"]',
            'button[data-action*="hybrid"]',
            'button[data-action*="editable"]',
            'button[data-action*="custom"]',
            
            // 百度特有提交按钮
            'input[class*="pass-button-submit"]',
            'button[class*="pass-button"]',
            'input[id*="submit"]',
            'input[class*="pass-button"]',
            'button[id*="submit"]',
            '.pass-button-submit',
            '#TANGRAM__PSP_11__submit',
            
            // 自定义提交元素
            'submit-btn',
            'login-btn',
            '[data-action*="login"]',
            '[data-action*="submit"]',
            
            // 多语言按钮文本 (通过CSS属性选择器无法直接匹配文本内容，在后续逻辑中处理)
        ],
        medium: [
            'button',
            'a[class*="login"]',
            'div[class*="login"][role="button"]',
            'input[type="button"]',
            
            // 自定义组件
            'div[onclick]',
            '[data-role="button"]',
            '[role="button"]',
            'submit-btn',
            'login-btn',
            
            // Vue/React事件绑定
            'button[onclick]',
            'div[onclick*="login"]',
            // Vue事件绑定在实际DOM中会被编译，这里不需要特殊处理
        ],
        low: [
            // 任何可能的按钮元素
            'div[class*="btn"]',
            'span[class*="button"]',
            'a[href="#"]'
        ]
    }
};

/**
 * 简单登录表单检测器
 */
class SimpleFormDetector {
    /**
     * 检测基础登录表单
     */
    detectLoginForm() {
        console.log('🔍 开始基础表单检测...');
        
        // 1. 优先检测标准form元素
        const standardForm = this.detectStandardForm();
        if (standardForm) {
            console.log('✅ 检测到标准表单:', standardForm);
            return standardForm;
        }
        
        // 2. 检测无form容器
        const formlessLogin = this.detectFormlessLogin();
        if (formlessLogin) {
            console.log('✅ 检测到无表单登录:', formlessLogin);
            return formlessLogin;
        }
        
        console.log('❌ 未检测到登录表单');
        return null;
    }
    
    /**
     * 检测标准form表单
     */
    detectStandardForm() {
        const forms = document.querySelectorAll('form');
        
        for (const form of forms) {
            if (!this.isElementVisible(form)) continue;
            
            const username = this.findUsernameField(form);
            const password = form.querySelector('input[type="password"]');
            
            if (username && password && this.isElementVisible(password)) {
                const submit = this.findSubmitButton(form);
                
                return {
                    container: form,
                    username: username,
                    password: password,
                    submit: submit,
                    type: 'standard-form'
                };
            }
        }
        
        return null;
    }
    
    /**
     * 检测无表单登录
     */
    detectFormlessLogin() {
        // 查找所有可见的密码字段
        const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'))
            .filter(field => this.isElementVisible(field));
        
        if (passwordFields.length === 0) return null;
        
        // 为每个密码字段寻找用户名字段
        for (const passwordField of passwordFields) {
            const container = this.findContainer(passwordField);
            const username = this.findUsernameField(container);
            
            if (username) {
                const submit = this.findSubmitButton(container);
                
                return {
                    container: container,
                    username: username,
                    password: passwordField,
                    submit: submit,
                    type: 'formless'
                };
            }
        }
        
        return null;
    }
    
    /**
     * 查找用户名字段
     */
    findUsernameField(container) {
        // 按优先级顺序查找
        const selectors = [
            'input[type="email"]',
            'input[type="tel"]',
            'input[name*="user"], input[id*="user"]',
            'input[name*="name"], input[id*="name"]', 
            'input[placeholder*="用户"], input[placeholder*="邮箱"]',
            'input[name*="account"], input[id*="account"]',
            'input[type="text"]',
            'input:not([type])'
        ];
        
        for (const selector of selectors) {
            const field = container.querySelector(selector);
            if (field && this.isElementVisible(field) && field.type !== 'password') {
                return field;
            }
        }
        
        return null;
    }
    
    /**
     * 查找提交按钮
     */
    findSubmitButton(container) {
        // 扩展的按钮选择器，包含自定义元素
        const selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[id*="submit"], button[class*="submit"]',
            'button[id*="login"], button[class*="login"]',
            'submit-btn',
            'login-btn',
            'auth-btn',
            '[onclick*="login"]',
            '[onclick*="submit"]',
            '[data-action*="login"]',
            '[data-action*="submit"]',
            '[class*="submit"]',
            '[class*="login"]',
            'button'
        ];
        
        // 先在容器内查找
        for (const selector of selectors) {
            const button = container.querySelector(selector);
            if (button && this.isElementVisible(button)) {
                return button;
            }
        }
        
        // 如果容器内没找到，在整个页面查找
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button && this.isElementVisible(button)) {
                const text = button.textContent?.toLowerCase() || button.value?.toLowerCase() || '';
                if (text.includes('登录') || text.includes('login') || text.includes('提交') || text.includes('submit')) {
                    return button;
                }
            }
        }
        
        return null;
    }
    
    /**
     * 查找合适的容器
     */
    findContainer(element) {
        let container = element.parentElement;
        let depth = 0;
        
        // 向上查找，最多5层
        while (container && depth < 5) {
            const inputs = container.querySelectorAll('input');
            
            // 如果容器包含2个以上输入框，认为是合适的容器
            if (inputs.length >= 2) {
                return container;
            }
            
            container = container.parentElement;
            depth++;
        }
        
        return document.body;
    }
    
    /**
     * 检查元素是否可见
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 && 
               rect.height > 0;
    }

}

/**
 * 自动填充组件
 */
class AutoFillWidget {
    constructor() {
        this.triggerButton = null;
        this.dropdown = null;
        this.isDropdownVisible = false;
        this.accounts = [];
        this.targetForm = null;
    }

    /**
     * 显示填充触发按钮
     */
    async show(targetForm, accounts) {
        // 先清理现有的UI元素（但不清空数据）
        this.cleanupUI();
        
        // 设置新的数据
        this.accounts = accounts;
        this.targetForm = targetForm;

        // 创建触发按钮
        this.triggerButton = this.createTriggerButton(accounts.length);
        this.positionTriggerButton(targetForm);
        document.body.appendChild(this.triggerButton);

        console.log(`🔐 自动填充按钮已显示，找到 ${accounts.length} 个账号`);
    }

    /**
     * 创建触发按钮
     */
    createTriggerButton(accountCount) {
        const button = document.createElement('div');
        button.className = 'password-manager-trigger-button';
        button.innerHTML = `
            <div class="pw-trigger-content">
                <span class="pw-trigger-icon">🔐</span>
                <span class="pw-trigger-text">自动填充</span>
                <span class="pw-trigger-count">${accountCount}</span>
                <span class="pw-trigger-arrow">▼</span>
            </div>
        `;

        // 绑定点击事件
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // 添加样式
        this.addTriggerButtonStyles();

        return button;
    }

    /**
     * 定位触发按钮 - 固定在右上角
     */
    positionTriggerButton(targetForm) {
        const button = this.triggerButton;
        
        // 固定在右上角，避免滚动问题
        button.style.position = 'fixed';
        button.style.top = '20px';
        button.style.right = '20px';
        button.style.zIndex = '999998';
        
        // 添加悬浮效果
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        button.style.borderRadius = '8px';
        
        console.log('🔐 填充按钮已固定在右上角');
    }

    /**
     * 切换下拉框显示状态
     */
    toggleDropdown() {
        if (this.isDropdownVisible) {
            this.hideDropdown();
        } else {
            this.showDropdown();
        }
    }

    /**
     * 显示账号下拉框
     */
    showDropdown() {
        if (this.dropdown) {
            this.hideDropdown();
        }

        console.log('🔽 准备显示下拉列表，账号数据:', this.accounts);
        console.log('🔽 账号数量:', this.accounts.length);
        
        this.dropdown = this.createDropdown(this.accounts);
        this.positionDropdown();
        document.body.appendChild(this.dropdown);
        this.isDropdownVisible = true;

        // 更新按钮状态
        this.triggerButton.classList.add('active');

        // 绑定点击外部关闭事件
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick.bind(this));
        }, 10);

        console.log('🔽 显示账号下拉列表完成');
    }

    /**
     * 创建账号下拉框
     */
    createDropdown(accounts) {
        console.log('📝 创建下拉框，接收到的账号数据:', accounts);
        console.log('📝 账号数组长度:', accounts.length);
        
        const dropdown = document.createElement('div');
        dropdown.className = 'password-manager-dropdown';
        
        const accountsHtml = accounts.map((account, index) => {
            console.log(`📝 处理账号 ${index}:`, account);
            return `
                <div class="pw-account-option" data-index="${index}">
                    <div class="pw-account-avatar">${account.username ? account.username.charAt(0).toUpperCase() : '?'}</div>
                    <div class="pw-account-details">
                        <div class="pw-account-username">${this.escapeHtml(account.username || '未知用户')}</div>
                        <div class="pw-account-domain">${this.escapeHtml(account.subDomain || account.domain || '默认')}</div>
                    </div>
                    <div class="pw-account-action">
                        <span class="pw-fill-icon">🔑</span>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('📝 生成的账号HTML:', accountsHtml);
        
        dropdown.innerHTML = `
            <div class="pw-dropdown-header">
                <span class="pw-dropdown-title">选择要填充的账号</span>
                <button class="pw-dropdown-close" title="关闭">×</button>
            </div>
            <div class="pw-accounts-list">
                ${accountsHtml}
            </div>
        `;

        // 绑定事件
        dropdown.querySelector('.pw-dropdown-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideDropdown();
        });
        
        dropdown.querySelectorAll('.pw-account-option').forEach((option, index) => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fillAccount(accounts[index]);
                this.hideDropdown();
            });
        });

        // 添加样式
        this.addDropdownStyles();

        return dropdown;
    }

    /**
     * 定位下拉框 - 固定在按钮下方右上角
     */
    positionDropdown() {
        if (!this.triggerButton || !this.dropdown) return;

        const dropdown = this.dropdown;
        
        // 固定在右上角，按钮下方
        dropdown.style.position = 'fixed';
        dropdown.style.top = '65px'; // 按钮高度 + 间距
        dropdown.style.right = '20px'; // 与按钮对齐
        dropdown.style.zIndex = '999999';
        
        // 检查是否超出视口高度，如果超出则向上显示
        const viewportHeight = window.innerHeight;
        if (65 + 320 > viewportHeight) {
            // 在按钮上方显示
            dropdown.style.top = 'auto';
            dropdown.style.bottom = (viewportHeight - 20) + 'px';
        }
        
        console.log('📋 下拉框已定位在右上角');
    }

    /**
     * 隐藏下拉框
     */
    hideDropdown() {
        if (this.dropdown && this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
        }
        this.dropdown = null;
        this.isDropdownVisible = false;

        // 更新按钮状态
        if (this.triggerButton) {
            this.triggerButton.classList.remove('active');
        }

        // 移除点击外部关闭事件
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }

    /**
     * 处理点击外部关闭
     */
    handleOutsideClick(e) {
        if (this.triggerButton && !this.triggerButton.contains(e.target) &&
            this.dropdown && !this.dropdown.contains(e.target)) {
            this.hideDropdown();
        }
    }

    /**
     * 添加触发按钮样式
     */
    addTriggerButtonStyles() {
        if (document.getElementById('pw-trigger-styles')) return;

        const style = document.createElement('style');
        style.id = 'pw-trigger-styles';
        style.textContent = `
            .password-manager-trigger-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                transition: all 0.2s ease;
                user-select: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            .password-manager-trigger-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .password-manager-trigger-button.active {
                background: linear-gradient(135deg, #5a67d8 0%, #667eea 100%);
            }
            
            .pw-trigger-content {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .pw-trigger-icon {
                font-size: 14px;
            }
            
            .pw-trigger-text {
                font-size: 11px;
            }
            
            .pw-trigger-count {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 10px;
                min-width: 16px;
                text-align: center;
            }
            
            .pw-trigger-arrow {
                font-size: 8px;
                transition: transform 0.2s ease;
            }
            
            .password-manager-trigger-button.active .pw-trigger-arrow {
                transform: rotate(180deg);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 添加下拉框样式
     */
    addDropdownStyles() {
        if (document.getElementById('pw-dropdown-styles')) return;

        const style = document.createElement('style');
        style.id = 'pw-dropdown-styles';
        style.textContent = `
            .password-manager-dropdown {
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
                border: 1px solid #e2e8f0;
                overflow: hidden;
                width: 280px;
                max-height: 320px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                animation: dropdownSlideIn 0.2s ease;
            }
            
            @keyframes dropdownSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .pw-dropdown-header {
                background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                padding: 12px 16px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .pw-dropdown-title {
                font-size: 13px;
                font-weight: 600;
                color: #2d3748;
            }
            
            .pw-dropdown-close {
                background: none;
                border: none;
                color: #718096;
                font-size: 16px;
                cursor: pointer;
                padding: 2px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .pw-dropdown-close:hover {
                background: #e2e8f0;
                color: #4a5568;
            }
            
            .pw-accounts-list {
                max-height: 260px;
                overflow-y: auto;
            }
            
            .pw-account-option {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.2s ease;
                border-bottom: 1px solid #f7fafc;
            }
            
            .pw-account-option:hover {
                background: linear-gradient(135deg, #f0fff4 0%, #f7fafc 100%);
            }
            
            .pw-account-option:last-child {
                border-bottom: none;
            }
            
            .pw-account-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 600;
                margin-right: 12px;
                flex-shrink: 0;
            }
            
            .pw-account-details {
                flex: 1;
                min-width: 0;
            }
            
            .pw-account-username {
                font-size: 14px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .pw-account-domain {
                font-size: 12px;
                color: #718096;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .pw-account-action {
                margin-left: 8px;
                opacity: 0.6;
                transition: opacity 0.2s ease;
            }
            
            .pw-account-option:hover .pw-account-action {
                opacity: 1;
            }
            
            .pw-fill-icon {
                font-size: 16px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 填充账号
     */
    async fillAccount(account) {
        if (!this.targetForm) return;

        try {
            // 检查是否有解密错误
            if (account.decryptError) {
                this.showNotification('❌ 密码解密失败，请重新设置', 'error');
                return;
            }

            // 填充用户名
            if (this.targetForm.username && account.username) {
                this.fillInput(this.targetForm.username, account.username);
                console.log('✅ 已填充用户名:', account.username);
            }

            // 填充密码（密码已经在getAccountsByDomain中解密）
            if (this.targetForm.password && account.password) {
                this.fillInput(this.targetForm.password, account.password);
                console.log('✅ 已填充密码');
            }

            // 显示成功提示
            this.showNotification('🔑 账号填充成功', 'success');
            
        } catch (error) {
            console.error('填充失败:', error);
            this.showNotification('❌ 填充失败: ' + error.message, 'error');
        }
    }

    /**
     * 填充输入框 - 支持标准input、contenteditable和role="textbox"元素
     */
    fillInput(element, value) {
        // 聚焦元素
        element.focus();
        
        // 检查元素类型
        const isContentEditable = element.contentEditable === 'true' || element.hasAttribute('contenteditable');
        const isRoleTextbox = element.getAttribute('role') === 'textbox';
        const isCustomElement = element.tagName && (element.tagName.toLowerCase().includes('input') || element.tagName.toLowerCase().includes('btn'));
        
        if (isContentEditable || isRoleTextbox || isCustomElement) {
            // 处理contenteditable、role="textbox"和自定义元素
            const elementType = isContentEditable ? 'contenteditable' : 
                               isRoleTextbox ? 'role=textbox' : 'custom';
            console.log(`📝 填充${elementType}元素:`, element.tagName, element.getAttribute('data-field'));
            
            // 清空原有内容
            element.textContent = '';
            
            // 设置新内容
            element.textContent = value;
            
            // 如果元素有value属性，也设置value
            if ('value' in element || element.hasOwnProperty('value')) {
                try {
                    element.value = value;
                } catch (e) {
                    console.warn('设置value属性失败:', e);
                }
            }
            
            // 触发相关事件
            ['input', 'change', 'keyup', 'oninput'].forEach(eventType => {
                const event = new Event(eventType, { bubbles: true, cancelable: true });
                element.dispatchEvent(event);
            });
            
            // 如果有自定义的oninput处理函数，直接调用
            if (element.oninput && typeof element.oninput === 'function') {
                try {
                    element.oninput.call(element, { target: element });
                } catch (e) {
                    console.warn('调用oninput处理函数失败:', e);
                }
            }
            
            // 特殊处理密码字段
            const dataType = element.getAttribute('data-type');
            if (dataType === 'password' && window.handlePasswordInput) {
                try {
                    window.handlePasswordInput(element);
                } catch (e) {
                    console.warn('调用密码处理函数失败:', e);
                }
            }
            
        } else {
            // 处理标准input元素
            console.log('📝 填充标准input元素:', element.tagName, element.type);
            
            // 清空原有内容
            element.value = '';
            
            // 模拟用户输入
            element.value = value;
            
            // 触发相关事件
            ['input', 'change', 'keyup'].forEach(eventType => {
                element.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
        }
        
        // 失焦
        element.blur();
        
        const elementType = isContentEditable ? 'contenteditable' : 
                           isRoleTextbox ? 'role=textbox' : 
                           isCustomElement ? 'custom' : 'input';
        console.log(`✅ 填充完成: ${elementType} 元素`);
    }

    /**
     * 清理UI元素（不清空数据）
     */
    cleanupUI() {
        // 隐藏触发按钮
        if (this.triggerButton && this.triggerButton.parentNode) {
            this.triggerButton.parentNode.removeChild(this.triggerButton);
        }
        this.triggerButton = null;

        // 隐藏下拉框
        this.hideDropdown();
    }

    /**
     * 隐藏组件
     */
    hide() {
        // 清理UI元素
        this.cleanupUI();

        // 清理状态
        this.accounts = [];
        this.targetForm = null;
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `password-manager-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
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

/**
 * 登录监听器
 */
class LoginListener {
    constructor() {
        this.isListening = false;
        this.lastSubmitTime = 0;
    }

    /**
     * 开始监听登录事件
     */
    startListening(form) {
        if (!form || this.isListening) return;

        this.isListening = true;

        console.log('🎯 开始设置登录监听器...', {
            formType: form.type,
            hasContainer: !!form.container,
            hasUsername: !!form.username,
            hasPassword: !!form.password,
            hasSubmit: !!form.submit
        });

        // 监听提交按钮点击
        if (form.submit) {
            console.log('📝 设置提交按钮监听器:', {
                tag: form.submit.tagName,
                id: form.submit.id,
                className: form.submit.className
            });
            
            form.submit.addEventListener('click', (e) => {
                console.log('🖱️ 提交按钮被点击 (click事件)');
                // 延迟处理，让页面的事件先执行
                setTimeout(() => this.handleLoginAttempt(form, e), 200);
            });
            
            // 对于自定义提交函数，也监听mousedown和touchstart
            form.submit.addEventListener('mousedown', (e) => {
                console.log('🖱️ 提交按钮被点击 (mousedown事件)');
                setTimeout(() => this.handleLoginAttempt(form, e), 300);
            });
            
            form.submit.addEventListener('touchstart', (e) => {
                console.log('👆 提交按钮被触摸 (touchstart事件)');
                setTimeout(() => this.handleLoginAttempt(form, e), 300);
            });
            
            // 🎯 移除额外的事件监听，避免误触发
            console.log('📝 只保留click、mousedown、touchstart事件');
        } else {
            console.log('⚠️ 未找到提交按钮，将依赖其他监听机制');
        }

        // 监听表单提交
        if (form.container && form.container.tagName === 'FORM') {
            console.log('📋 设置表单提交监听器');
            form.container.addEventListener('submit', (e) => {
                console.log('📋 表单提交事件被触发');
                this.handleLoginAttempt(form, e);
            });
        }

        // 监听回车键
        [form.username, form.password].forEach((field, index) => {
            if (field) {
                const fieldType = index === 0 ? '用户名' : '密码';
                console.log(`⌨️ 设置${fieldType}字段回车监听器:`, {
                    tag: field.tagName,
                    id: field.id,
                    type: field.type
                });
                
                field.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        console.log(`⌨️ 在${fieldType}字段按下Enter键`);
                        setTimeout(() => this.handleLoginAttempt(form, e), 100);
                    }
                });
            }
        });
        
        // 特殊处理：拦截页面的自定义提交函数
        this.interceptCustomSubmitFunctions(form);
        
        // 增强监听：监听AJAX请求和百度特定事件
        this.setupEnhancedListening(form);
        
        console.log('🎯 LoginListener已设置完成，监听表单:', {
            container: form.container?.tagName + (form.container?.id ? '#' + form.container.id : ''),
            username: form.username?.tagName + (form.username?.id ? '#' + form.username.id : ''),
            password: form.password?.tagName + (form.password?.id ? '#' + form.password.id : ''),
            submit: form.submit?.tagName + (form.submit?.id ? '#' + form.submit.id : ''),
            type: form.type
        });
        
        // 🎯 移除初始检查，避免在用户未主动提交时触发暂存
        console.log('📝 跳过初始检查，等待用户明确的提交动作');
    }
    
        /**
     * 设置增强监听
     */
    setupEnhancedListening(form) {
        console.log('🔧 设置增强监听...');
        const self = this;
        
        // 🎯 移除输入框变化监听，只在明确的提交动作时才暂存
        console.log('📝 跳过输入框变化监听，只在明确提交时暂存');
        
        // 监听按钮点击的额外方式（直接监听百度特定的按钮）
        const baiduSubmitButton = document.querySelector('#TANGRAM__PSP_11__submit');
        if (baiduSubmitButton) {
            // 🎯 只监听click事件，避免误触发
            baiduSubmitButton.addEventListener('click', () => {
                console.log('🎯 百度登录按钮被点击');
                // 🎯 增加延迟，确保页面的登录逻辑先执行
                setTimeout(() => {
                    self.handleLoginAttempt(form, { type: 'baidu-submit-click' });
                }, 500);
            });
            console.log('✅ 百度特定按钮监听已设置');
        }
        
        // 🎯 移除全局按钮监听，避免误触发，依赖具体的提交按钮监听
        console.log('📝 跳过全局按钮监听，依赖具体提交按钮的点击事件');
        
        // 监听键盘事件（Enter键）
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                
                // 如果在密码框或用户名框按Enter
                if (activeElement === form.username || activeElement === form.password) {
                    console.log('🎯 在登录字段中按下Enter键');
                    setTimeout(() => {
                        self.handleLoginAttempt(form, { type: 'enter-submit' });
                    }, 200);
                }
            }
        });
        
        // 🎯 移除页面变化和消息监听，避免误触发
        console.log('📝 跳过页面变化和消息监听，专注于明确的提交动作');
        
        // 🎯 移除定期检查机制，避免在用户未主动提交时触发暂存
        console.log('📝 跳过定期检查机制，只在用户主动提交时暂存');
        
        // 记录原始URL用于比较
        form.originalUrl = window.location.href;
        
        console.log('✅ 增强监听设置完成');
    }
    
    /**
     * 拦截自定义提交函数
     */
    interceptCustomSubmitFunctions(form) {
        console.log('🔧 开始设置自定义提交函数拦截...');
        
        // 延迟执行，确保页面脚本已加载
        setTimeout(() => {
            try {
                console.log('🔧 延迟执行拦截逻辑...');
                
                // 拦截常见的自定义提交函数
                const customFunctions = ['handleEditableSubmit', 'handleSubmit', 'doLogin', 'submitForm', 'login', 'handleHybridLogin', 'handleCustomLogin'];
                
                customFunctions.forEach(funcName => {
                    if (window[funcName] && typeof window[funcName] === 'function') {
                        const originalFunc = window[funcName];
                        window[funcName] = (...args) => {
                            console.log(`🎯 拦截到自定义提交函数: ${funcName}`);
                            // 先执行原函数
                            const result = originalFunc.apply(this, args);
                            // 然后处理登录尝试
                            setTimeout(() => this.handleLoginAttempt(form, { type: 'custom-submit', funcName }), 100);
                            return result;
                        };
                        console.log(`✅ 已拦截自定义提交函数: ${funcName}`);
                    } else {
                        console.log(`⚠️ 未找到函数: ${funcName}`);
                    }
                });
                
                // 查找真正的提交按钮（有onclick属性的）
                const realSubmitButton = document.querySelector('button[onclick*="handleEditableSubmit"], button[onclick*="handleSubmit"], button[onclick*="doLogin"], button[onclick*="handleHybridLogin"], button[onclick*="handleCustomLogin"]');
                if (realSubmitButton && realSubmitButton !== form.submit) {
                    console.log('🔍 发现真正的提交按钮:', realSubmitButton);
                    // 更新form对象中的submit按钮引用
                    form.submit = realSubmitButton;
                    
                    // 重新添加事件监听
                    realSubmitButton.addEventListener('click', (e) => {
                        setTimeout(() => this.handleLoginAttempt(form, e), 200);
                    });
                    
                    realSubmitButton.addEventListener('mousedown', (e) => {
                        setTimeout(() => this.handleLoginAttempt(form, e), 300);
                    });
                }
                
                // 如果提交按钮有onclick属性，也拦截它
                if (form.submit && form.submit.onclick) {
                    const originalOnclick = form.submit.onclick;
                    form.submit.onclick = (e) => {
                        console.log('🎯 拦截到onclick事件');
                        const result = originalOnclick.call(form.submit, e);
                        setTimeout(() => this.handleLoginAttempt(form, e), 100);
                        return result;
                    };
                    console.log('✅ 已拦截onclick事件');
                } else {
                    console.log('⚠️ 提交按钮没有onclick属性');
                }
                
            } catch (error) {
                console.error('拦截自定义提交函数失败:', error);
            }
        }, 1000); // 延迟1秒确保页面脚本加载完成
    }

    /**
     * 处理登录尝试
     */
    async handleLoginAttempt(form, event) {
        const now = Date.now();
        
        console.log('🚀 登录尝试处理开始:', {
            eventType: event?.type || 'unknown',
            formType: form?.type || 'unknown',
            hasForm: !!form,
            hasUsername: !!form?.username,
            hasPassword: !!form?.password,
            timestamp: now
        });
        
        // 防重复提交
        if (now - this.lastSubmitTime < 1000) {
            console.log('⏰ 重复提交防护，跳过处理');
            return;
        }
        this.lastSubmitTime = now;

        try {
            // 详细调试表单字段
            console.log('🔍 表单字段详细信息:', {
                username: {
                    element: form?.username,
                    tagName: form?.username?.tagName,
                    id: form?.username?.id,
                    className: form?.username?.className,
                    type: form?.username?.type,
                    value: form?.username?.value,
                    textContent: form?.username?.textContent,
                    contentEditable: form?.username?.contentEditable,
                    role: form?.username?.getAttribute?.('role')
                },
                password: {
                    element: form?.password,
                    tagName: form?.password?.tagName,
                    id: form?.password?.id,
                    className: form?.password?.className,
                    type: form?.password?.type,
                    value: form?.password?.value,
                    textContent: form?.password?.textContent,
                    contentEditable: form?.password?.contentEditable,
                    role: form?.password?.getAttribute?.('role')
                }
            });
            
            // 获取用户名 - 支持contenteditable、role="textbox"和标准input
            let username = '';
            if (form.username) {
                const isContentEditable = form.username.contentEditable === 'true' || form.username.hasAttribute('contenteditable');
                const isRoleTextbox = form.username.getAttribute('role') === 'textbox';
                
                if (isContentEditable || isRoleTextbox) {
                    username = form.username.textContent?.trim() || '';
                    console.log('📝 从contentEditable/role获取用户名:', username);
                } else {
                    username = form.username.value?.trim() || '';
                    console.log('📝 从value属性获取用户名:', username);
                }
            }
            
            // 获取密码 - 支持contenteditable、role="textbox"和标准input
            let password = '';
            if (form.password) {
                const isContentEditable = form.password.contentEditable === 'true' || form.password.hasAttribute('contenteditable');
                const isRoleTextbox = form.password.getAttribute('role') === 'textbox';
                
                if (isContentEditable || isRoleTextbox) {
                    password = form.password.textContent?.trim() || '';
                    console.log('🔒 从contentEditable/role获取密码长度:', password?.length || 0);
                } else {
                    password = form.password.value?.trim() || '';
                    console.log('🔒 从value属性获取密码长度:', password?.length || 0);
                }
            }

            console.log('📊 获取到的登录数据:', {
                username: username,
                usernameLength: username?.length || 0,
                passwordLength: password?.length || 0,
                hasValidData: !!(username && password)
            });

            if (!username || !password) {
                console.log('⚠️ 登录数据不完整，但继续尝试从其他地方获取...');
                
                // 尝试直接从页面查找填写的值
                const allInputs = document.querySelectorAll('input');
                console.log('🔍 页面所有输入框状态:');
                allInputs.forEach((input, index) => {
                    if (input.value?.trim()) {
                        console.log(`  输入框${index}:`, {
                            id: input.id,
                            type: input.type,
                            value: input.type === 'password' ? `***${input.value.length}字符***` : input.value,
                            className: input.className
                        });
                    }
                });
                
                // 如果还是没有找到有效数据，尝试等待一下再次获取
                if (!username || !password) {
                    console.log('⏳ 延迟500ms后重新尝试获取登录数据...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 重新尝试获取
                    if (form.username) {
                        const isContentEditable = form.username.contentEditable === 'true' || form.username.hasAttribute('contenteditable');
                        const isRoleTextbox = form.username.getAttribute('role') === 'textbox';
                        
                        if (isContentEditable || isRoleTextbox) {
                            username = form.username.textContent?.trim() || '';
                        } else {
                            username = form.username.value?.trim() || '';
                        }
                    }
                    
                    if (form.password) {
                        const isContentEditable = form.password.contentEditable === 'true' || form.password.hasAttribute('contenteditable');
                        const isRoleTextbox = form.password.getAttribute('role') === 'textbox';
                        
                        if (isContentEditable || isRoleTextbox) {
                            password = form.password.textContent?.trim() || '';
                        } else {
                            password = form.password.value?.trim() || '';
                        }
                    }
                    
                    console.log('🔄 延迟重试后的数据:', {
                        username: username,
                        usernameLength: username?.length || 0,
                        passwordLength: password?.length || 0
                    });
                }
                
                if (!username || !password) {
                    console.log('❌ 经过多次尝试仍然无法获取完整登录数据，跳过暂存');
                    console.log('📋 最终状态:', { 
                        username: username || '(空)', 
                        usernameLength: username?.length || 0, 
                        password: password ? '***' : '(空)', 
                        passwordLength: password?.length || 0 
                    });
                    return;
                }
            }

            // 获取域名信息
            const domainInfo = DomainManager.getCurrentDomainInfo();
            
            console.log('🔐 开始暂存登录信息:', {
                domain: domainInfo.baseDomain,
                subDomain: domainInfo.subDomain,
                username: username,
                passwordLength: password?.length || 0,
                formType: form.type || 'unknown'
            });
            
            // 暂存账号信息
            const success = await storageManager.tempStore(
                domainInfo.baseDomain,
                username,
                password,
                domainInfo.subDomain
            );

            console.log('🔐 暂存结果:', success ? '✅ 成功' : '❌ 失败');

            if (success) {
                console.log('🎉 暂存成功，准备通知background script');
                // 通知background script
                chrome.runtime.sendMessage({
                    type: 'SHOW_LOGIN_DETECTED',
                    data: {
                        domain: domainInfo.baseDomain,
                        username: username,
                        subDomain: domainInfo.subDomain
                    }
                });
            } else {
                console.error('❌ 暂存失败，可能是存储问题');
            }

        } catch (error) {
            console.error('处理登录尝试失败:', error);
        }
    }

    /**
     * 显示暂存通知
     */
    showTempStorageNotification(username, domain) {
        const notification = document.createElement('div');
        notification.className = 'password-manager-temp-notification';
        notification.innerHTML = `
            <div class="temp-notification-content">
                <div class="temp-notification-icon">🔐</div>
                <div class="temp-notification-text">
                    <div class="temp-notification-title">检测到登录信息</div>
                    <div class="temp-notification-desc">账号 "${username}" 已暂存，点击插件图标确认保存</div>
                </div>
                <button class="temp-notification-close">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // 关闭按钮
        notification.querySelector('.temp-notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

/**
 * 主初始化函数
 */
async function init() {
    if (isInitialized) return;
    
    console.log('密码管理器 Content Script 初始化...');
    
    try {
        // 初始化存储管理器
        await storageManager.init();
        
        // 创建表单检测器
        formDetector = new SimpleFormDetector();
        
        // 创建填充组件
        fillWidget = new AutoFillWidget();
        
        // 创建登录监听器
        const loginListener = new LoginListener();
        window.loginListener = loginListener; // 🎯 设置为全局变量，供手动标记使用
        
        // 初始化手动标记模式
        window.manualMarkingMode = new ManualMarkingMode();
        
        // 检查是否有已保存的手动标记
        await checkAndApplyDomainMarking();
        
        // 检测表单
        await detectAndSetupForms(loginListener);
        
        // 添加手动标记触发器
        addManualMarkingTrigger();
        
        // 设置动态检测
        setupDynamicDetection(loginListener);
        
        isInitialized = true;
        console.log('密码管理器初始化完成');
        
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

/**
 * 检测并设置表单
 */
async function detectAndSetupForms(loginListener, force = false) {
    // 🎯 如果有手动标记的表单，且不是强制检测，则跳过自动检测
    if (window.isManuallyMarked && !force) {
        console.log('🎯 检测到手动标记的表单，跳过自动检测');
        return;
    }
    
    // 防止重复检测
    const now = Date.now();
    if (!force && (isDetecting || (now - lastDetectionTime) < 2000)) {
        console.log('🔄 跳过重复检测，距离上次检测不足2秒');
        return;
    }
    
    isDetecting = true;
    lastDetectionTime = now;
    
    try {
        console.log('🔍 开始表单检测...');
        
        // 检测登录表单
        const newDetectedForm = formDetector.detectLoginForm();
        
        // 只有在找到新表单或者是强制检测时才进行处理
        if (newDetectedForm && (!currentDetectedForm || force)) {
            // 🎯 如果不是强制检测且已有手动标记，则不覆盖
            if (window.isManuallyMarked && !force) {
                console.log('🎯 已有手动标记表单，不覆盖自动检测结果');
                return;
            }
            
            // 🎯 如果当前表单是手动标记的，则不覆盖
            if (currentDetectedForm && currentDetectedForm.type === 'manual-marked' && !force) {
                console.log('🎯 当前表单是手动标记的，不覆盖', currentDetectedForm);
                return;
            }
            
            currentDetectedForm = newDetectedForm;
            window.currentDetectedForm = newDetectedForm; // 确保全局变量也更新
            console.log('✅ 检测到登录表单:', currentDetectedForm);
            
            // 开始监听登录事件
            loginListener.startListening(currentDetectedForm);
            
            // 检查是否有可填充的账号
            await checkAndShowFillOptions();
        } else if (!newDetectedForm && !currentDetectedForm) {
            console.log('⚠️ 未检测到有效的登录表单，尝试降级方案');
            
            // 降级方案：为有用户名和密码的表单设置监听器
            const allForms = document.querySelectorAll('form');
            let fallbackCount = 0;
            
            allForms.forEach((form, index) => {
                const username = form.querySelector('input[type="text"], input[type="email"], input[type="tel"]');
                const password = form.querySelector('input[type="password"]');
                
                if (username && password && fallbackCount < 3) { // 限制降级表单数量
                    const formId = form.id || `fallback-${index}`;
                    console.log(`📝 设置降级监听器: ${formId}`);
                    
                    const formData = {
                        container: form,
                        username,
                        password,
                        submit: form.querySelector('button[type="submit"], input[type="submit"], button'),
                        type: 'fallback'
                    };
                    
                    loginListener.startListening(formData);
                    fallbackCount++;
                }
            });
            
            if (fallbackCount > 0) {
                console.log(`✅ 设置了 ${fallbackCount} 个降级监听器`);
            }
        }
    } catch (error) {
        console.error('表单检测失败:', error);
    } finally {
        isDetecting = false;
    }
}

/**
 * 检查并显示填充选项
 */
async function checkAndShowFillOptions() {
    if (!currentDetectedForm) {
        console.log('⚠️ 没有检测到表单，跳过填充选项检查');
        return;
    }

    try {
        const formType = window.isManuallyMarked ? '手动标记' : '自动检测';
        console.log(`🔍 检查填充选项 (${formType}表单):`, currentDetectedForm);
        
        const domainInfo = DomainManager.getCurrentDomainInfo();
        console.log('🔍 检查填充选项，域名信息:', domainInfo);
        
        const accounts = await storageManager.getAccountsByDomain(domainInfo.baseDomain);
        console.log('🔍 获取到的账号数据:', accounts);
        console.log('🔍 账号数量:', accounts ? accounts.length : 0);
        
        if (accounts && accounts.length > 0) {
            console.log('✅ 有账号数据，准备显示填充组件');
            // 显示填充组件
            setTimeout(() => {
                fillWidget.show(currentDetectedForm, accounts);
            }, 1000);
        } else {
            console.log('ℹ️ 没有找到账号数据，不显示填充组件');
        }
    } catch (error) {
        console.error('检查填充选项失败:', error);
    }
}

/**
 * 设置动态检测
 */
function setupDynamicDetection(loginListener) {
    // 监听DOM变化
    const observer = new MutationObserver((mutations) => {
        let shouldRedetect = false;
        let hasFormChanges = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 只检查重要的表单相关变化
                        if (node.matches('form') || 
                            node.querySelector('form') ||
                            (node.matches('input[type="password"]') && !currentDetectedForm)) {
                            hasFormChanges = true;
                        }
                    }
                });
            }
        });
        
        // 只有在确实有表单相关变化且当前没有检测到表单时才重新检测
        if (hasFormChanges && !isDetecting) {
            console.log('🔄 检测到表单相关DOM变化，准备重新检测');
            shouldRedetect = true;
        }
        
        if (shouldRedetect) {
            // 清除之前的延时检测
            if (detectionTimeoutId) {
                clearTimeout(detectionTimeoutId);
            }
            
            // 延迟检测，避免频繁触发
            detectionTimeoutId = setTimeout(() => {
                detectAndSetupForms(loginListener);
                detectionTimeoutId = null;
            }, 1000);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * 安全的复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text) {
    // 方法1: 尝试使用Clipboard API（推荐）
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            console.warn('Clipboard API失败，尝试fallback方法:', error);
        }
    }
    
    // 方法2: 使用传统的document.execCommand方法（fallback）
    return new Promise((resolve, reject) => {
        try {
            // 创建临时textarea元素
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            textarea.style.top = '-999999px';
            document.body.appendChild(textarea);
            
            // 选中并复制
            textarea.focus();
            textarea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (successful) {
                resolve();
            } else {
                reject(new Error('execCommand复制失败'));
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 监听来自background script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script收到消息:', request);
    
    switch (request.type) {
        case 'FILL_FORM_DATA':
            if (currentDetectedForm && fillWidget) {
                fillWidget.fillAccount(request.data);
            }
            sendResponse({ success: true });
            break;
            
        case 'SHOW_FILL_OPTIONS':
            checkAndShowFillOptions();
            sendResponse({ success: true });
            break;
            
        case 'COPY_TEXT':
            // 复制文本到剪贴板
            copyTextToClipboard(request.text).then(() => {
                sendResponse({ success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
            
        case 'QUICK_FILL':
            if (currentDetectedForm && fillWidget) {
                fillWidget.fillAccount(request.account);
            }
            sendResponse({ success: true });
            break;
            
        default:
            sendResponse({ success: false, error: '未知消息类型' });
    }
});

/**
 * 检查并应用域名标记
 */
async function checkAndApplyDomainMarking() {
    try {
        const domain = window.location.hostname;
        const markingConfig = await storageManager.getDomainMarking(domain);
        
        if (markingConfig) {
            console.log('🎯 发现域名标记配置:', markingConfig);
            
            // 等待页面加载完成
            setTimeout(() => {
                applyDomainMarking(markingConfig);
            }, 1000);
        }
    } catch (error) {
        console.error('检查域名标记失败:', error);
    }
}

/**
 * 应用域名标记
 */
function applyDomainMarking(markingConfig) {
    try {
        console.log('🔧 开始应用域名标记:', markingConfig);
        
        const usernameElement = markingConfig.username ? document.querySelector(markingConfig.username) : null;
        const passwordElement = markingConfig.password ? document.querySelector(markingConfig.password) : null;
        const submitElement = markingConfig.submit ? document.querySelector(markingConfig.submit) : null;
        
        console.log('🔍 域名标记元素查找结果:', {
            username: usernameElement,
            password: passwordElement,
            submit: submitElement,
            usernameSelector: markingConfig.username,
            passwordSelector: markingConfig.password,
            submitSelector: markingConfig.submit
        });
        
        if (usernameElement || passwordElement) {
            // 验证元素是否有效
            const validateElement = (element, type) => {
                if (!element) return false;
                const stillInDOM = document.contains(element);
                const hasValue = element.value !== undefined ? element.value : element.textContent;
                console.log(`🔍 验证域名标记${type}元素:`, {
                    element: element,
                    stillInDOM: stillInDOM,
                    id: element.id,
                    tagName: element.tagName,
                    value: type === 'password' ? (hasValue ? `***${hasValue.length}字符***` : '(空)') : hasValue,
                    className: element.className
                });
                return stillInDOM;
            };

            const usernameValid = usernameElement ? validateElement(usernameElement, '用户名') : false;
            const passwordValid = passwordElement ? validateElement(passwordElement, '密码') : false;
            
            if (!usernameValid && !passwordValid) {
                console.error('❌ 域名标记的元素已失效');
                return;
            }
            
            // 创建虚拟表单对象
            const manualForm = {
                container: document.body,
                username: usernameElement,
                password: passwordElement,
                submit: submitElement || findNearestSubmitButton(),
                type: 'manual-marked' // 🎯 改为 manual-marked 以保持一致性
            };
            
            console.log('🔍 创建的域名标记表单:', manualForm);
            
            // 🎯 停止现有的监听器，避免冲突
            if (window.loginListener && window.loginListener.isListening) {
                console.log('🔄 停止现有监听器，准备设置域名标记监听器');
                window.loginListener.isListening = false;
            }
            
            // 🎯 设置为当前检测到的表单，并标记为手动标记状态
            window.currentDetectedForm = manualForm;
            currentDetectedForm = manualForm; // 同时设置局部变量
            window.isManuallyMarked = true; // 标记为手动标记状态
            
            // 启动登录监听
            if (window.loginListener) {
                console.log('🔄 重新创建登录监听器实例以确保干净状态');
                // 重新创建监听器实例，确保干净状态
                window.loginListener = new LoginListener();
                
                window.loginListener.startListening(manualForm);
                console.log('🎯 已应用域名标记并开始监听');
                
                console.log('🎯 监听的域名标记表单详情:', {
                    username: manualForm.username?.tagName + '#' + manualForm.username?.id,
                    password: manualForm.password?.tagName + '#' + manualForm.password?.id,
                    submit: manualForm.submit?.tagName + '#' + manualForm.submit?.id,
                    container: manualForm.container?.tagName + (manualForm.container?.id ? '#' + manualForm.container.id : ''),
                    type: manualForm.type
                });
                
                // 检查是否有账号数据可填充
                checkAndShowFillOptions();
                
                console.log('✅ 域名标记已应用，手动标记状态已设置');
            } else {
                console.error('❌ 登录监听器不存在，无法应用域名标记');
            }
        } else {
            console.log('⚠️ 未找到有效的域名标记元素');
        }
    } catch (error) {
        console.error('应用域名标记失败:', error);
    }
}

/**
 * 查找最近的提交按钮
 */
function findNearestSubmitButton() {
    const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'submit-btn',
        'login-btn',
        'auth-btn',
        '[onclick*="login"]',
        '[onclick*="submit"]',
        '[data-action*="login"]',
        '[data-action*="submit"]',
        '[class*="submit"]',
        '[class*="login"]',
        '[class*="auth-btn"]',
        'button:contains("登录")',
        'button:contains("提交")',
        'button:contains("login")',
        '.login-btn',
        '.submit-btn',
        '.pass-button-submit'
    ];

    for (const selector of submitSelectors) {
        const button = document.querySelector(selector);
        if (button && isElementVisible(button)) {
            return button;
        }
    }

    return null;
}

/**
 * 检查元素是否可见
 */
function isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           rect.width > 0 && 
           rect.height > 0;
}

/**
 * 添加手动标记触发器
 */
function addManualMarkingTrigger() {
    // 添加键盘快捷键 Ctrl+Shift+M
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            if (window.manualMarkingMode) {
                window.manualMarkingMode.activate();
            }
        }
    });
    
    // 添加右键菜单（如果可能的话）
    document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (target.matches('input[type="text"], input[type="email"], input[type="tel"], input[type="password"], input:not([type])')) {
            // 可以在这里添加自定义右键菜单
            // 但由于浏览器限制，我们使用键盘快捷键作为主要触发方式
        }
    });
    
    console.log('🎯 手动标记触发器已设置 (快捷键: Ctrl+Shift+M)');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 手动标记模式类
class ManualMarkingMode {
    constructor() {
        this.isActive = false;
        this.markedFields = {
            username: null,
            password: null,
            submit: null
        };
        this.highlightedElements = [];
        this.markingUI = null;
    }

    /**
     * 激活手动标记模式
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.createMarkingUI();
        this.highlightAllInputs();
        this.addEventListeners();
        
        console.log('🎯 手动标记模式已激活');
    }

    /**
     * 创建标记界面
     */
    createMarkingUI() {
        this.markingUI = document.createElement('div');
        this.markingUI.className = 'manual-marking-ui';
        this.markingUI.innerHTML = `
            <div class="marking-header">
                <div class="marking-title">
                    <span class="marking-icon">🎯</span>
                    <span class="marking-text">手动标记登录字段</span>
                </div>
                <div class="marking-status-inline">
                    <span class="status-item">
                        <span class="status-label">用户名:</span>
                        <span class="username-status">未选择</span>
                    </span>
                    <span class="status-item">
                        <span class="status-label">密码:</span>
                        <span class="password-status">未选择</span>
                    </span>
                    <span class="status-item">
                        <span class="status-label">登录按钮:</span>
                        <span class="submit-status">未选择</span>
                    </span>
                </div>
                <div class="marking-actions-inline">
                    <button class="action-btn save-marking" title="保存标记">💾</button>
                    <button class="action-btn clear-marking" title="清除标记">🗑️</button>
                    <button class="action-btn close-marking" title="关闭">✕</button>
                </div>
            </div>
            <div class="marking-instructions">
                📌 点击页面元素进行标记 | 🔵 蓝框=用户名 🔴 红框=密码 🟢 绿框=登录按钮
            </div>
        `;

        // 添加样式
        this.addMarkingStyles();
        
        // 绑定事件
        this.markingUI.querySelector('.close-marking').addEventListener('click', () => this.deactivate());
        this.markingUI.querySelector('.save-marking').addEventListener('click', () => this.saveMarking());
        this.markingUI.querySelector('.clear-marking').addEventListener('click', () => this.clearMarking());

        document.body.appendChild(this.markingUI);
    }

    /**
     * 判断元素是否为按钮类型
     */
    isButtonElement(element) {
        if (!element) return false;
        
        const tagName = element.tagName.toLowerCase();
        const type = element.type;
        const role = element.getAttribute('role');
        const onclick = element.hasAttribute('onclick');
        const dataAction = element.getAttribute('data-action');
        
        // 标准按钮元素
        if (tagName === 'button' || 
            type === 'submit' || 
            type === 'button' || 
            role === 'button') {
            return true;
        }
        
        // 自定义按钮标签（常见的自定义按钮名称）
        if (tagName.includes('btn') || 
            tagName.includes('button') || 
            tagName === 'submit-btn' ||
            tagName === 'login-btn' ||
            tagName === 'auth-btn') {
            return true;
        }
        
        // 基于属性判断的按钮特征
        if (onclick && (
            element.getAttribute('onclick').includes('login') ||
            element.getAttribute('onclick').includes('submit') ||
            element.getAttribute('onclick').includes('Login') ||
            element.getAttribute('onclick').includes('Submit')
        )) {
            return true;
        }
        
        // 基于data-action属性判断
        if (dataAction && (
            dataAction.includes('login') ||
            dataAction.includes('submit') ||
            dataAction.includes('auth')
        )) {
            return true;
        }
        
        // 基于class判断
        const className = element.className || '';
        if (className.includes('submit') ||
            className.includes('login') ||
            className.includes('auth-btn') ||
            className.includes('btn-submit')) {
            return true;
        }
        
        return false;
    }

    /**
     * 高亮所有输入框
     */
    highlightAllInputs() {
        // 高亮输入框
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="password"], input:not([type]), [contenteditable="true"], [role="textbox"]');
        
        inputs.forEach(input => {
            if (this.isElementVisible(input) && !this.isMarkingUIElement(input)) {
                input.classList.add('marking-highlight');
                this.highlightedElements.push(input);
            }
        });

        // 扩展的按钮选择器，包含自定义元素
        const buttonSelectors = [
            'button',
            'input[type="submit"]',
            'input[type="button"]', 
            '[role="button"]',
            'submit-btn',
            'login-btn',
            'auth-btn',
            '[onclick*="login"]',
            '[onclick*="submit"]',
            '[onclick*="Login"]',
            '[onclick*="Submit"]',
            '[data-action*="login"]',
            '[data-action*="submit"]',
            '[data-action*="auth"]',
            '[class*="submit"]',
            '[class*="login"]',
            '[class*="auth-btn"]',
            '[class*="btn-submit"]',
            '*[class*="btn"][onclick]',
            '*[class*="button"][onclick]'
        ];
        
        const buttons = document.querySelectorAll(buttonSelectors.join(', '));
        
        console.log(`🔍 使用扩展选择器发现 ${buttons.length} 个潜在按钮元素`);
        
        // 去重处理，因为扩展选择器可能选中重复元素
        const uniqueButtons = Array.from(new Set(buttons));
        console.log(`🔍 去重后剩余 ${uniqueButtons.length} 个唯一按钮元素`);
        
        uniqueButtons.forEach((button, index) => {
            const isVisible = this.isElementVisible(button);
            const isUIElement = this.isMarkingUIElement(button);
            const isDisabled = button.disabled;
            const isButtonType = this.isButtonElement(button);
            
            console.log(`按钮 ${index + 1}:`, {
                element: button,
                tagName: button.tagName,
                type: button.type,
                className: button.className,
                id: button.id,
                value: button.value,
                textContent: button.textContent?.trim(),
                onclick: button.hasAttribute('onclick') ? button.getAttribute('onclick').substring(0, 50) + '...' : null,
                dataAction: button.getAttribute('data-action'),
                disabled: isDisabled,
                visible: isVisible,
                isUIElement: isUIElement,
                isButtonType: isButtonType
            });
            
            // 对于手动标记，我们允许标记禁用的按钮（只要它们是可见的且被识别为按钮）
            if (isVisible && !isUIElement && isButtonType) {
                button.classList.add('marking-highlight');
                this.highlightedElements.push(button);
                console.log(`✅ 已高亮按钮:`, button);
            } else {
                console.log(`❌ 跳过元素:`, {
                    visible: isVisible,
                    isUIElement: isUIElement,
                    isButtonType: isButtonType
                });
            }
        });
        
        console.log(`🎯 总共高亮了 ${this.highlightedElements.length} 个元素`);
        
        // 特别检查百度登录按钮
        this.debugBaiduSubmitButton();
    }

    /**
     * 调试百度提交按钮
     */
    debugBaiduSubmitButton() {
        const baiduSubmitButtons = document.querySelectorAll('input[class*="pass-button-submit"], input[id*="submit"], [class*="pass-button"]');
        
        console.log(`🔍 发现 ${baiduSubmitButtons.length} 个疑似百度提交按钮:`);
        
        baiduSubmitButtons.forEach((button, index) => {
            const isVisible = this.isElementVisible(button);
            const isUIElement = this.isMarkingUIElement(button);
            const isHighlighted = this.highlightedElements.includes(button);
            
            console.log(`百度按钮 ${index + 1}:`, {
                element: button,
                id: button.id,
                className: button.className,
                value: button.value,
                disabled: button.disabled,
                type: button.type,
                visible: isVisible,
                isUIElement: isUIElement,
                isHighlighted: isHighlighted,
                boundingRect: button.getBoundingClientRect(),
                computedStyle: {
                    display: getComputedStyle(button).display,
                    visibility: getComputedStyle(button).visibility,
                    opacity: getComputedStyle(button).opacity
                }
            });
            
            // 如果按钮没有被高亮，手动尝试高亮它
            if (!isHighlighted && isVisible && !isUIElement) {
                console.log(`🔧 手动高亮百度按钮:`, button);
                button.classList.add('marking-highlight');
                this.highlightedElements.push(button);
            }
        });
    }

    /**
     * 添加事件监听器
     */
    addEventListeners() {
        this.clickHandler = (e) => this.handleInputClick(e);
        document.addEventListener('click', this.clickHandler, true);
    }

    /**
     * 处理输入框点击
     */
    handleInputClick(e) {
        if (!this.isActive) return;

        const target = e.target;
        
        // 检查是否点击的是工具条上的按钮
        if (this.isMarkingUIElement(target)) {
            // 如果是工具条按钮，让它们正常工作
            return;
        }

        if (!this.highlightedElements.includes(target)) return;

        e.preventDefault();
        e.stopPropagation();

        // 显示字段类型选择菜单
        this.showFieldTypeMenu(target, e.clientX, e.clientY);
    }

    /**
     * 显示字段类型选择菜单
     */
    showFieldTypeMenu(element, x, y) {
        // 移除现有菜单
        const existingMenu = document.querySelector('.field-type-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.className = 'field-type-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        // 判断元素类型来显示不同的选项
        const isButton = this.isButtonElement(element);

        if (isButton) {
            menu.innerHTML = `
                <div class="menu-option" data-type="submit">
                    <span class="menu-icon">🔍</span>
                    <span class="menu-text">标记为登录按钮</span>
                </div>
                <div class="menu-option" data-type="remove">
                    <span class="menu-icon">❌</span>
                    <span class="menu-text">取消标记</span>
                </div>
            `;
        } else {
            menu.innerHTML = `
                <div class="menu-option" data-type="username">
                    <span class="menu-icon">👤</span>
                    <span class="menu-text">标记为用户名字段</span>
                </div>
                <div class="menu-option" data-type="password">
                    <span class="menu-icon">🔒</span>
                    <span class="menu-text">标记为密码字段</span>
                </div>
                <div class="menu-option" data-type="remove">
                    <span class="menu-icon">❌</span>
                    <span class="menu-text">取消标记</span>
                </div>
            `;
        }

        // 绑定菜单事件
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.menu-option');
            if (option) {
                const type = option.dataset.type;
                this.markField(element, type);
                menu.remove();
            }
        });

        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 100);

        document.body.appendChild(menu);
    }

    /**
     * 标记字段
     */
    markField(element, type) {
        if (type === 'remove') {
            this.removeFieldMarking(element);
            return;
        }

        // 清除之前的标记
        if (this.markedFields[type]) {
            this.removeFieldMarking(this.markedFields[type]);
        }

        // 添加新标记
        this.markedFields[type] = element;
        element.classList.add(`marked-${type}`);
        
        // 更新UI状态
        this.updateMarkingStatus();
        
        const typeNames = {
            username: '用户名',
            password: '密码',
            submit: '登录按钮'
        };
        console.log(`✅ 已标记${typeNames[type]}:`, element);
    }

    /**
     * 移除字段标记
     */
    removeFieldMarking(element) {
        element.classList.remove('marked-username', 'marked-password', 'marked-submit');
        
        // 从标记字段中移除
        Object.keys(this.markedFields).forEach(key => {
            if (this.markedFields[key] === element) {
                this.markedFields[key] = null;
            }
        });
        
        this.updateMarkingStatus();
    }

    /**
     * 更新标记状态显示
     */
    updateMarkingStatus() {
        if (!this.markingUI) return;

        const usernameStatus = this.markingUI.querySelector('.username-status');
        const passwordStatus = this.markingUI.querySelector('.password-status');
        const submitStatus = this.markingUI.querySelector('.submit-status');

        usernameStatus.textContent = this.markedFields.username ? 
            this.getFieldDescription(this.markedFields.username) : '未选择';
        
        passwordStatus.textContent = this.markedFields.password ? 
            this.getFieldDescription(this.markedFields.password) : '未选择';

        submitStatus.textContent = this.markedFields.submit ? 
            this.getFieldDescription(this.markedFields.submit) : '未选择';
    }

    /**
     * 获取字段描述
     */
    getFieldDescription(element) {
        const placeholder = element.placeholder || '';
        const name = element.name || '';
        const id = element.id || '';
        const text = element.textContent?.trim() || element.value || '';
        
        // 对于按钮，优先显示文本内容
        if (element.tagName.toLowerCase() === 'button' || element.type === 'submit' || element.type === 'button') {
            return text || name || id || '按钮';
        }
        
        return placeholder || name || id || text || `${element.tagName.toLowerCase()}元素`;
    }

    /**
     * 保存标记
     */
    async saveMarking() {
        if (!this.markedFields.username && !this.markedFields.password && !this.markedFields.submit) {
            alert('请至少标记一个元素！');
            return;
        }

        try {
            // 保存到域名配置
            const domain = window.location.hostname;
            const markingConfig = {
                username: this.markedFields.username ? this.getElementSelector(this.markedFields.username) : null,
                password: this.markedFields.password ? this.getElementSelector(this.markedFields.password) : null,
                submit: this.markedFields.submit ? this.getElementSelector(this.markedFields.submit) : null,
                timestamp: Date.now()
            };

            // 保存到本地存储
            await storageManager.saveDomainMarking(domain, markingConfig);

            // 立即应用标记
            this.applyMarking();
            
            this.showNotification('✅ 字段标记已保存！', 'success');
            this.deactivate();
            
        } catch (error) {
            console.error('保存标记失败:', error);
            this.showNotification('❌ 保存失败，请重试', 'error');
        }
    }

    /**
     * 应用标记（开始监听）
     */
    applyMarking() {
        if (!this.markedFields.username && !this.markedFields.password) return;

        console.log('🔧 开始应用手动标记，当前标记字段:', {
            username: this.markedFields.username,
            password: this.markedFields.password,
            submit: this.markedFields.submit,
            usernameValid: !!this.markedFields.username,
            passwordValid: !!this.markedFields.password,
            submitValid: !!this.markedFields.submit
        });

        // 验证元素是否仍然存在于DOM中
        const validateElement = (element, type) => {
            if (!element) return false;
            const stillInDOM = document.contains(element);
            const hasValue = element.value !== undefined ? element.value : element.textContent;
            console.log(`🔍 验证${type}元素:`, {
                element: element,
                stillInDOM: stillInDOM,
                id: element.id,
                tagName: element.tagName,
                value: type === 'password' ? (hasValue ? `***${hasValue.length}字符***` : '(空)') : hasValue,
                className: element.className
            });
            return stillInDOM;
        };

        const usernameValid = validateElement(this.markedFields.username, '用户名');
        const passwordValid = validateElement(this.markedFields.password, '密码');
        const submitValid = this.markedFields.submit ? validateElement(this.markedFields.submit, '提交按钮') : true;

        if (!usernameValid || !passwordValid) {
            console.error('❌ 手动标记的元素已失效，可能需要重新标记');
            return;
        }

        // 创建虚拟表单对象
        const manualForm = {
            container: document.body,
            username: this.markedFields.username,
            password: this.markedFields.password,
            submit: this.markedFields.submit || this.findNearestSubmitButton(),
            type: 'manual-marked'
        };

        // 🎯 停止现有的监听器，避免冲突
        if (window.loginListener && window.loginListener.isListening) {
            console.log('🔄 停止现有监听器，准备设置手动标记监听器');
            window.loginListener.isListening = false;
        }

        // 🎯 设置为当前检测到的表单，防止自动检测覆盖
        window.currentDetectedForm = manualForm;
        currentDetectedForm = manualForm; // 同时设置局部变量
        window.isManuallyMarked = true; // 标记为手动标记状态
        
        console.log('🎯 手动标记表单已生效:', manualForm);

        // 验证manualForm中的元素
        console.log('🔍 最终表单验证:', {
            hasContainer: !!manualForm.container,
            hasUsername: !!manualForm.username,
            hasPassword: !!manualForm.password,
            hasSubmit: !!manualForm.submit,
            usernameId: manualForm.username?.id,
            passwordId: manualForm.password?.id,
            submitId: manualForm.submit?.id,
            type: manualForm.type
        });

        // 启动登录监听
        if (window.loginListener) {
            console.log('🔄 重新创建登录监听器实例以确保干净状态');
            // 重新创建监听器实例，确保干净状态
            window.loginListener = new LoginListener();
            
            window.loginListener.startListening(manualForm);
            console.log('🎯 已开始监听手动标记的字段');
            console.log('🎯 监听的表单详情:', {
                username: manualForm.username?.tagName + '#' + manualForm.username?.id,
                password: manualForm.password?.tagName + '#' + manualForm.password?.id,
                submit: manualForm.submit?.tagName + '#' + manualForm.submit?.id,
                container: manualForm.container?.tagName + (manualForm.container?.id ? '#' + manualForm.container.id : ''),
                type: manualForm.type
            });
        } else {
            console.error('❌ 登录监听器不存在！');
        }

        // 检查是否有账号数据可填充
        checkAndShowFillOptions();
    }

    /**
     * 查找最近的提交按钮
     */
    findNearestSubmitButton() {
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:contains("登录")',
            'button:contains("提交")',
            'button:contains("login")',
            '.login-btn',
            '.submit-btn'
        ];

        for (const selector of submitSelectors) {
            const button = document.querySelector(selector);
            if (button && this.isElementVisible(button)) {
                return button;
            }
        }

        return null;
    }

    /**
     * 获取元素选择器
     */
    getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.name) {
            return `[name="${element.name}"]`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                return `.${classes[0]}`;
            }
        }
        
        // 使用位置选择器作为后备
        const siblings = Array.from(element.parentNode.children);
        const index = siblings.indexOf(element);
        return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
    }

    /**
     * 清除所有标记
     */
    clearMarking() {
        Object.values(this.markedFields).forEach(element => {
            if (element) {
                this.removeFieldMarking(element);
            }
        });
        
        this.markedFields = { username: null, password: null, submit: null };
        this.updateMarkingStatus();
        
        // 🎯 清除手动标记状态，允许自动检测重新开始
        window.isManuallyMarked = false;
        window.currentDetectedForm = null;
        currentDetectedForm = null; // 同时清除局部变量
        console.log('🎯 已清除手动标记，自动检测将重新开始');
    }

    /**
     * 停用标记模式
     */
    deactivate() {
        this.isActive = false;
        
        // 移除高亮
        this.highlightedElements.forEach(element => {
            element.classList.remove('marking-highlight', 'marked-username', 'marked-password', 'marked-submit');
        });
        this.highlightedElements = [];
        
        // 移除事件监听器
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler, true);
        }
        
        // 移除UI
        if (this.markingUI) {
            this.markingUI.remove();
            this.markingUI = null;
        }
        
        // 移除菜单
        const menu = document.querySelector('.field-type-menu');
        if (menu) menu.remove();
        
        // 🎯 如果没有保存标记就关闭，则重置手动标记状态
        if (!this.markedFields.username && !this.markedFields.password) {
            window.isManuallyMarked = false;
            window.currentDetectedForm = null;
            currentDetectedForm = null; // 同时清除局部变量
            console.log('🎯 关闭手动标记模式，自动检测将重新开始');
        }
        
        console.log('🎯 手动标记模式已停用');
    }

    /**
     * 检查是否是标记工具UI的元素
     */
    isMarkingUIElement(element) {
        if (!element) return false;
        
        // 检查是否是工具条或其子元素
        return element.closest('.manual-marking-ui') !== null || 
               element.closest('.field-type-menu') !== null ||
               element.classList.contains('manual-marking-ui') ||
               element.classList.contains('field-type-menu');
    }

    /**
     * 检查元素是否可见
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        const isVisible = style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 && 
               rect.height > 0;
        
        // 为调试添加详细信息
        if (!isVisible && (element.id?.includes('submit') || element.className?.includes('submit'))) {
            console.log(`🔍 按钮可见性检查失败:`, {
                element: element,
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                width: rect.width,
                height: rect.height,
                rect: rect
            });
        }
        
        return isVisible;
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `manual-marking-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * 添加标记模式样式
     */
    addMarkingStyles() {
        if (document.querySelector('#manual-marking-styles')) return;

        const style = document.createElement('style');
        style.id = 'manual-marking-styles';
        style.textContent = `
            .manual-marking-ui {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: white;
                box-shadow: 0 2px 12px rgba(0,0,0,0.15);
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                border-bottom: 3px solid #667eea;
            }

            .marking-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .marking-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                font-size: 16px;
            }

            .marking-status-inline {
                display: flex;
                gap: 24px;
                align-items: center;
            }

            .status-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
            }

            .status-label {
                opacity: 0.9;
            }

            .username-status, .password-status, .submit-status {
                background: rgba(255,255,255,0.2);
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                min-width: 60px;
                text-align: center;
            }

            .marking-actions-inline {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .action-btn {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 16px;
                cursor: pointer;
                padding: 6px 8px;
                border-radius: 4px;
                transition: all 0.2s;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .action-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
            }

            .marking-instructions {
                padding: 8px 20px;
                background: #f8f9fd;
                font-size: 13px;
                color: #495057;
                text-align: center;
                border-bottom: 1px solid #e9ecef;
            }

            .marking-highlight {
                outline: 2px dashed #007bff !important;
                outline-offset: 2px !important;
                cursor: pointer !important;
                transition: all 0.2s !important;
            }

            .marking-highlight:hover {
                outline-color: #0056b3 !important;
                background-color: rgba(0, 123, 255, 0.1) !important;
            }

            .marked-username {
                outline: 3px solid #007bff !important;
                outline-offset: 2px !important;
                background-color: rgba(0, 123, 255, 0.1) !important;
            }

            .marked-password {
                outline: 3px solid #dc3545 !important;
                outline-offset: 2px !important;
                background-color: rgba(220, 53, 69, 0.1) !important;
            }

            .marked-submit {
                outline: 3px solid #28a745 !important;
                outline-offset: 2px !important;
                background-color: rgba(40, 167, 69, 0.1) !important;
            }

            .field-type-menu {
                position: fixed;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                z-index: 2147483647;
                min-width: 200px;
                overflow: hidden;
            }

            .menu-option {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                cursor: pointer;
                transition: background-color 0.2s;
                border-bottom: 1px solid #eee;
            }

            .menu-option:last-child {
                border-bottom: none;
            }

            .menu-option:hover {
                background-color: #f8f9fa;
            }

            .menu-icon {
                margin-right: 8px;
                font-size: 16px;
            }

            .menu-text {
                font-size: 14px;
                color: #495057;
            }

            .manual-marking-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 16px;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 10003;
                animation: slideIn 0.3s ease-out;
            }

            .manual-marking-notification.success {
                background: #28a745;
            }

            .manual-marking-notification.error {
                background: #dc3545;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

// 页面完全加载后再次检测（某些网站延迟加载表单）
window.addEventListener('load', () => {
    setTimeout(init, 1000);
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (fillWidget) {
        fillWidget.hide();
    }
});

console.log('密码管理器 Content Script 已加载');