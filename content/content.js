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

// 增强版表单选择器
const ENHANCED_FORM_SELECTORS = {
    username: {
        high: [
            'input[type="text"][name*="user"]',
            'input[type="text"][name*="account"]',
            'input[type="email"][name*="email"]',
            'input[type="text"][id*="user"]',
            'input[type="text"][id*="account"]',
            'input[type="text"][autocomplete="username"]',
            'input[name="username"]',
            'input[name="account"]',
            'input[id="username"]',
            'input[id="account"]'
        ],
        medium: [
            'input[placeholder*="用户名"]',
            'input[placeholder*="账号"]', 
            'input[placeholder*="手机号"]',
            'input[placeholder*="邮箱"]',
            'input[placeholder*="username"]',
            'input[placeholder*="account"]',
            'input[placeholder*="email"]',
            'input[placeholder*="phone"]',
            'input[placeholder*="mobile"]'
        ],
        low: [
            'input[type="text"]',
            'input[type="email"]',
            'input[type="tel"]',
            'input:not([type])'
        ]
    },
    password: {
        high: [
            'input[type="password"]',
            'input[autocomplete="current-password"]',
            'input[autocomplete="new-password"]',
            'input[name*="pass"]',
            'input[id*="pass"]'
        ],
        medium: [
            'input[placeholder*="密码"]',
            'input[placeholder*="password"]',
            'input[placeholder*="pwd"]',
            'input[class*="password"]',
            'input[class*="pwd"]'
        ]
    },
    submit: {
        high: [
            'button[type="submit"]',
            'input[type="submit"]',
            'button[class*="login"]',
            'button[class*="signin"]',
            'input[class*="login"]'
        ],
        medium: [
            'button',
            'a[class*="login"]',
            'div[class*="login"][role="button"]',
            'input[type="button"]'
        ]
    }
};

/**
 * 智能表单检测器
 */
class SmartFormDetector {
    constructor() {
        this.confidence = {
            HIGH: 0.9,
            MEDIUM: 0.7,
            LOW: 0.4
        };
        this.detectedForms = new Map();
    }

    /**
     * 检测登录表单
     */
    detectLoginForm() {
        const forms = this.getAllPossibleForms();
        const scoredForms = forms.map(form => ({
            form,
            score: this.calculateFormScore(form)
        }));
        
        // 过滤有效表单
        const validForms = scoredForms.filter(item => item.score > this.confidence.LOW);
        
        // 只在找到有效表单时输出详细日志
        if (validForms.length > 0) {
            console.log('🔍 表单检测结果:');
            validForms.forEach((item, index) => {
                const formId = item.form.container.id || `form-${index}`;
                const formTitle = item.form.container.querySelector('h2')?.textContent || '未知表单';
                console.log(`📝 ${formTitle} (${formId}): 评分 ${item.score.toFixed(2)}`);
                if (item.score >= this.confidence.HIGH) {
                    console.log('  - 用户名字段:', item.form.username?.id || item.form.username?.name || '未找到');
                    console.log('  - 密码字段:', item.form.password?.id || item.form.password?.name || '未找到');
                    console.log('  - 提交按钮:', item.form.submit?.textContent?.trim() || '未找到');
                }
            });
        }
        const bestForm = validForms.sort((a, b) => b.score - a.score)[0]?.form;
        
        if (bestForm) {
            const formId = bestForm.container.id || 'unknown';
            const formTitle = bestForm.container.querySelector('h2')?.textContent || '未知表单';
            console.log(`✅ 选择最佳表单: ${formTitle} (${formId}), 评分: ${scoredForms.find(s => s.form === bestForm)?.score.toFixed(2)}`);
        } else {
            console.log('❌ 未找到符合条件的表单');
        }
        
        return bestForm;
    }

    /**
     * 获取所有可能的表单
     */
    getAllPossibleForms() {
        const forms = [];
        
        // 1. 标准form元素
        document.querySelectorAll('form').forEach(form => {
            const formData = this.analyzeForm(form);
            if (formData) forms.push(formData);
        });
        
        // 2. 无form标签的表单区域
        this.detectFormlessLogin().forEach(formArea => {
            forms.push(formArea);
        });
        
        return forms;
    }

    /**
     * 分析form元素
     */
    analyzeForm(form) {
        const username = this.findBestField(form, 'username');
        const password = this.findBestField(form, 'password');
        const submit = this.findBestField(form, 'submit');

        if (username || password) {
            return {
                container: form,
                username,
                password,
                submit,
                type: 'form'
            };
        }
        return null;
    }

    /**
     * 查找最佳字段
     */
    findBestField(container, fieldType) {
        const selectors = ENHANCED_FORM_SELECTORS[fieldType];
        let bestField = null;
        let bestScore = 0;

        // 按优先级查找
        for (const [priority, selectorList] of Object.entries(selectors)) {
            for (const selector of selectorList) {
                try {
                    const elements = container.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (this.isElementVisible(element) && !element.disabled) {
                            let score = this.getFieldScore(element, fieldType, priority);
                            
                            // 对提交按钮进行文本内容检查
                            if (fieldType === 'submit') {
                                score = this.adjustSubmitScore(element, score);
                            }
                            
                            if (score > bestScore) {
                                bestScore = score;
                                bestField = element;
                            }
                        }
                    });
                } catch (e) {
                    console.warn('选择器错误:', selector, e);
                }
            }
        }

        return bestField;
    }

    /**
     * 调整提交按钮评分（基于文本内容）
     */
    adjustSubmitScore(element, baseScore) {
        const text = (element.textContent || element.value || element.title || '').toLowerCase().trim();
        const submitKeywords = [
            '登录', '登陆', 'login', 'sign in', 'signin', 'log in',
            '提交', 'submit', '确定', 'ok', 'confirm',
            '进入', 'enter', '继续', 'continue',
            '邮箱登录', 'email login',
            '手机登录', 'phone login', 'mobile login',
            '安全登录', 'secure login',
            '注册', 'register', 'sign up', 'signup',
            '动态登录', 'dynamic login'
        ];

        // 如果文本包含登录相关关键词，提高评分
        for (const keyword of submitKeywords) {
            if (text.includes(keyword)) {
                return Math.min(baseScore + 0.3, 1.0);
            }
        }

        // 特殊情况：type="submit" 的按钮即使没有关键词也应该有不错的评分
        if (element.type === 'submit') {
            return Math.min(baseScore + 0.2, 1.0);
        }

        // 如果是通用按钮但没有相关文本，降低评分
        if (element.tagName.toLowerCase() === 'button' && baseScore >= 0.7) {
            return Math.max(baseScore - 0.1, 0.3);
        }

        return baseScore;
    }

    /**
     * 获取字段评分
     */
    getFieldScore(element, fieldType, priority) {
        let score = 0;

        switch (priority) {
            case 'high': score = 0.9; break;
            case 'medium': score = 0.7; break;
            case 'low': score = 0.4; break;
            default: score = 0.2;
        }

        // 对用户名字段进行特殊评分调整
        if (fieldType === 'username') {
            score = this.adjustUsernameScore(element, score);
        }

        // 额外加分因素
        if (element.required) score += 0.1;
        if (element.autocomplete) score += 0.05;
        
        return Math.min(score, 1);
    }

    /**
     * 调整用户名字段评分
     */
    adjustUsernameScore(element, baseScore) {
        const type = element.type ? element.type.toLowerCase() : '';
        const name = (element.name || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const placeholder = (element.placeholder || '').toLowerCase();
        
        // 根据input类型调整评分
        if (type === 'email') {
            // 邮箱类型输入框在邮箱登录表单中应该得到高分
            if (placeholder.includes('邮箱') || placeholder.includes('email') ||
                name.includes('email') || id.includes('email')) {
                return Math.min(baseScore + 0.2, 1.0);
            }
        }
        
        if (type === 'tel') {
            // 电话类型输入框在手机登录表单中应该得到高分
            if (placeholder.includes('手机') || placeholder.includes('电话') || 
                placeholder.includes('phone') || placeholder.includes('mobile') ||
                name.includes('phone') || id.includes('phone') ||
                name.includes('mobile') || id.includes('mobile')) {
                return Math.min(baseScore + 0.2, 1.0);
            }
        }
        
        if (type === 'text' || type === '' || !type) {
            // 检查是否有明确的用户名标识
            const usernameKeywords = ['user', 'account', '用户', '账号'];
            for (const keyword of usernameKeywords) {
                if (name.includes(keyword) || id.includes(keyword) || 
                    placeholder.includes(keyword)) {
                    return Math.min(baseScore + 0.1, 1.0);
                }
            }
        }
        
        return baseScore;
    }

    /**
     * 检测无form标签的登录表单
     */
    detectFormlessLogin() {
        const formAreas = [];
        const usernameFields = this.findAllFields('username');
        const passwordFields = this.findAllFields('password');
        
        usernameFields.forEach(userField => {
            passwordFields.forEach(passField => {
                const commonContainer = this.findCommonContainer(userField, passField);
                if (commonContainer && this.isValidFormArea(commonContainer)) {
                    const submitButton = this.findSubmitInContainer(commonContainer);
                    formAreas.push({
                        container: commonContainer,
                        username: userField,
                        password: passField,
                        submit: submitButton,
                        type: 'formless'
                    });
                }
            });
        });
        
        return formAreas;
    }

    /**
     * 查找所有可能的字段
     */
    findAllFields(type) {
        const fields = [];
        const selectors = ENHANCED_FORM_SELECTORS[type];
        
        Object.values(selectors).flat().forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(element => {
                    if (this.isElementVisible(element) && !element.disabled && !fields.includes(element)) {
                        fields.push(element);
                    }
                });
            } catch (e) {
                // 忽略无效选择器
            }
        });
        
        return fields;
    }

    /**
     * 查找公共容器
     */
    findCommonContainer(element1, element2) {
        let parent1 = element1.parentElement;
        
        while (parent1) {
            if (parent1.contains(element2)) {
                return parent1;
            }
            parent1 = parent1.parentElement;
        }
        
        return document.body;
    }

    /**
     * 验证是否为有效表单区域
     */
    isValidFormArea(container) {
        const rect = container.getBoundingClientRect();
        return rect.width > 100 && rect.height > 50;
    }

    /**
     * 在容器中查找提交按钮
     */
    findSubmitInContainer(container) {
        return this.findBestField(container, 'submit');
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

    /**
     * 计算表单评分
     */
    calculateFormScore(formData) {
        let score = 0;
        
        if (formData.username) score += 0.4;
        if (formData.password) score += 0.4;
        if (formData.submit) score += 0.2;
        
        // 上下文分析加分
        score += this.analyzeContext(formData.container) * 0.1;
        
        return Math.min(score, 1);
    }

    /**
     * 上下文分析
     */
    analyzeContext(container) {
        let contextScore = 0;
        const containerText = container.textContent.toLowerCase();
        
        const loginKeywords = [
            '登录', '登陆', 'login', 'sign in', 'signin', 
            '账号', 'account', '用户', 'user',
            '密码', 'password', 'pwd',
            '邮箱', 'email', 'mail',
            '手机', 'phone', 'mobile', 'tel',
            '注册', 'register', 'sign up', 'signup',
            '验证', 'verify', 'validation',
            '安全', 'secure', 'security'
        ];
        
        // 特殊表单类型加分
        const specialFormTypes = [
            { keywords: ['邮箱登录', 'email login'], bonus: 0.05 },
            { keywords: ['手机登录', 'phone login', 'mobile login'], bonus: 0.05 },
            { keywords: ['注册', 'register', 'sign up'], bonus: 0.03 },
            { keywords: ['复杂', 'complex', '安全', 'secure'], bonus: 0.03 }
        ];
        
        loginKeywords.forEach(keyword => {
            if (containerText.includes(keyword)) {
                contextScore += 0.02;
            }
        });
        
        specialFormTypes.forEach(({ keywords, bonus }) => {
            keywords.forEach(keyword => {
                if (containerText.includes(keyword)) {
                    contextScore += bonus;
                }
            });
        });

        return Math.min(contextScore, 0.15);
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
     * 定位触发按钮
     */
    positionTriggerButton(targetForm) {
        if (!targetForm.username) return;

        const usernameRect = targetForm.username.getBoundingClientRect();
        const button = this.triggerButton;
        
        button.style.position = 'fixed';
        button.style.top = (usernameRect.top - 35) + 'px';
        button.style.left = usernameRect.left + 'px';
        button.style.zIndex = '999998';
        
        // 确保不超出视口
        const viewportWidth = window.innerWidth;
        if (usernameRect.left + 120 > viewportWidth) {
            button.style.left = (viewportWidth - 130) + 'px';
        }
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
     * 定位下拉框
     */
    positionDropdown() {
        if (!this.triggerButton || !this.dropdown) return;

        const buttonRect = this.triggerButton.getBoundingClientRect();
        const dropdown = this.dropdown;
        
        dropdown.style.position = 'fixed';
        dropdown.style.top = (buttonRect.bottom + 5) + 'px';
        dropdown.style.left = buttonRect.left + 'px';
        dropdown.style.zIndex = '999999';
        
        // 确保不超出视口
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (buttonRect.left + 280 > viewportWidth) {
            dropdown.style.left = (viewportWidth - 290) + 'px';
        }
        
        if (buttonRect.bottom + 250 > viewportHeight) {
            dropdown.style.top = (buttonRect.top - 255) + 'px';
        }
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
     * 填充输入框
     */
    fillInput(element, value) {
        // 聚焦元素
        element.focus();
        
        // 清空原有内容
        element.value = '';
        
        // 模拟用户输入
        element.value = value;
        
        // 触发相关事件
        ['input', 'change', 'keyup'].forEach(eventType => {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        // 失焦
        element.blur();
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

        // 监听提交按钮点击
        if (form.submit) {
            form.submit.addEventListener('click', (e) => {
                this.handleLoginAttempt(form, e);
            });
        }

        // 监听表单提交
        if (form.container.tagName === 'FORM') {
            form.container.addEventListener('submit', (e) => {
                this.handleLoginAttempt(form, e);
            });
        }

        // 监听回车键
        [form.username, form.password].forEach(field => {
            if (field) {
                field.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        setTimeout(() => this.handleLoginAttempt(form, e), 100);
                    }
                });
            }
        });
    }

    /**
     * 处理登录尝试
     */
    async handleLoginAttempt(form, event) {
        const now = Date.now();
        
        // 防重复提交
        if (now - this.lastSubmitTime < 1000) return;
        this.lastSubmitTime = now;

        try {
            const username = form.username?.value?.trim();
            const password = form.password?.value?.trim();

            if (!username || !password) {
                console.log('⚠️ 登录数据不完整，跳过暂存');
                return;
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
                // 通知background script
                chrome.runtime.sendMessage({
                    type: 'SHOW_LOGIN_DETECTED',
                    data: {
                        domain: domainInfo.baseDomain,
                        username: username,
                        subDomain: domainInfo.subDomain
                    }
                });
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
        formDetector = new SmartFormDetector();
        
        // 创建填充组件
        fillWidget = new AutoFillWidget();
        
        // 创建登录监听器
        const loginListener = new LoginListener();
        
        // 检测表单
        await detectAndSetupForms(loginListener);
        
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
            currentDetectedForm = newDetectedForm;
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

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
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