# Chrome密码管理器插件 - 项目速查

## 项目概述
智能Chrome密码管理器插件，支持表单检测、登录监听、密码暂存、自动填充等功能。
- **技术栈**: Manifest V3, JavaScript, Chrome Extension APIs
- **加密方案**: AES-GCM + Web Crypto API（HTTPS）/ XOR简单加密（HTTP）
- **兼容性**: 支持HTTPS和HTTP环境

## 核心架构

### 1. 文件结构
```
pw_book/
├── manifest.json           # 插件配置文件
├── background/
│   └── background.js       # 后台服务脚本
├── content/
│   ├── content.js         # 页面内容脚本（核心逻辑）
│   └── content.css        # 样式文件
├── popup/
│   ├── popup.html         # 弹窗界面
│   ├── popup.js          # 弹窗逻辑
│   └── popup.css         # 弹窗样式
├── utils/
│   ├── crypto.js         # 加密工具类
│   ├── storage.js        # 存储管理类
│   └── domain.js         # 域名处理工具
├── test/                 # 测试页面集合
└── debug.html           # 调试工具页面
```

### 2. 核心组件

#### SmartFormDetector (content.js)
- 智能表单检测算法
- 支持标准form和无form表单
- 评分机制选择最佳表单

#### AutoFillWidget (content.js) 
- 新的自动填充UI组件
- 触发按钮 + 下拉账号列表模式
- 支持多账号选择和填充

#### StorageManager (utils/storage.js)
- 数据存储和加密管理
- 暂存功能和智能更新逻辑
- 多层降级存储策略

#### CryptoManager (utils/crypto.js)
- 安全加密解密
- 环境适配（HTTPS/HTTP）
- 密钥管理和导入导出

## 主要功能

### 1. 表单检测
- 自动检测登录表单（用户名、密码、提交按钮）
- 支持多种输入类型（text, email, tel, password）
- 降级方案处理复杂页面

### 2. 登录监听
- 监听表单提交事件
- 智能暂存登录信息
- 防重复提交和数据验证

### 3. 自动填充
- **交互流程**: 检测表单 → 显示触发按钮 → 点击展开账号列表 → 选择填充
- 支持多账号管理
- 密码自动解密和填充

### 4. 数据管理
- 暂存数据智能处理（新账号、密码更新、变更检测）
- 正式账号的加密存储
- 导入导出功能

## 关键配置

### 表单选择器 (content.js)
```javascript
const ENHANCED_FORM_SELECTORS = {
    username: { high: [...], medium: [...], low: [...] },
    password: { high: [...], medium: [...] },
    submit: { high: [...], medium: [...] }
}
```

### 存储键名 (storage.js)
- `password_accounts`: 正式账号数据
- `temp_accounts`: 暂存数据
- `crypto_key`: 加密密钥

## 测试环境
- 测试服务器: `http://a.local.com:8000`
- 测试页面: `/test/` 目录下6种不同表单类型
- 调试工具: `/debug.html`

## 最近更新
1. 重构AutoFillWidget为触发按钮+下拉列表模式
2. 修复账号数据传递和解密问题
3. 增强表单检测算法和降级方案
4. 完善错误处理和用户通知系统
5. 添加扩展上下文失效处理机制

## 常见问题
1. **Extension context invalidated**: 扩展需要重新加载
2. **表单检测失败**: 使用降级方案或调整选择器
3. **密码解密失败**: 检查加密密钥或环境兼容性
4. **自动填充按钮不显示**: 确认有保存的账号数据

## 开发调试
- 启动测试服务器: `.\test-server.bat`
- 访问调试页面: `http://a.local.com:8000/debug.html`
- 查看控制台日志了解详细执行过程 