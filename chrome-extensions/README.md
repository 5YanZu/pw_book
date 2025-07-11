# 智能密码管理器 Chrome 插件

一个安全、智能的Chrome浏览器密码管理插件，可以自动检测网站登录表单，安全存储密码，并提供便捷的自动填充功能。

## ✨ 功能特性

### 🔍 智能表单检测
- **多层次表单识别**：支持标准form表单和无form标签的登录区域
- **智能评分算法**：综合分析表单元素，准确识别用户名和密码字段
- **多语言支持**：支持中文、英文等多种语言的表单识别
- **动态检测**：实时监听页面变化，支持异步加载的表单

### 🔒 安全存储
- **本地加密存储**：使用AES-256加密算法保护密码数据
- **基础域名分组**：按基础域名自动分组，支持子域名间数据共享
- **防重复机制**：自动检测重复账号，避免数据冗余

### ⚡ 便捷操作
- **自动暂存**：登录时自动检测并暂存账号信息
- **一键保存**：在插件弹窗中确认保存暂存的账号
- **快速填充**：自动显示填充按钮，支持多账号选择
- **触屏优化**：适配移动设备和触屏操作

### 📊 数据管理
- **账号查看**：在弹窗中查看当前网站的所有保存账号
- **密码复制**：一键复制用户名或密码到剪贴板
- **账号编辑**：支持修改和删除已保存的账号
- **数据导出**：支持导出备份数据

## 🚀 安装方法

### 开发者模式安装

1. **下载源码**
   ```bash
   git clone <repository-url>
   cd password-manager
   ```

2. **打开Chrome扩展管理页面**
   - 在Chrome地址栏输入 `chrome://extensions/`
   - 或者通过菜单：设置 → 更多工具 → 扩展程序

3. **启用开发者模式**
   - 点击页面右上角的"开发者模式"开关

4. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹
   - 确认安装

### 打包安装

1. **打包扩展**
   - 在扩展管理页面点击"打包扩展程序"
   - 选择项目文件夹
   - 生成.crx文件

2. **安装.crx文件**
   - 将.crx文件拖拽到扩展管理页面
   - 确认安装

## 📖 使用说明

### 首次使用

1. **安装插件后**，会在浏览器工具栏显示密码管理器图标 🔐
2. **访问任意登录页面**，插件会自动检测登录表单
3. **输入用户名密码并点击登录**，插件会自动检测并暂存账号信息
4. **点击插件图标**，在弹窗中确认保存或忽略暂存的账号

### 日常使用

#### 登录检测与保存
1. 在任意网站进行登录操作
2. 插件检测到登录信息后会显示暂存通知
3. 点击插件图标，在"暂存提示区"点击"保存"按钮
4. 账号信息会被加密保存到本地存储

#### 自动填充
1. 访问已保存账号的网站
2. 插件会自动显示"自动填充"按钮
3. 点击按钮选择要填充的账号
4. 用户名和密码会自动填入表单

#### 账号管理
1. 点击插件图标打开管理界面
2. 查看当前网站的所有保存账号
3. 点击账号项可以：
   - 复制用户名或密码
   - 查看账号详情
   - 编辑账号信息
   - 删除账号
   - 填充到当前页面

#### 手动添加账号
1. 点击插件图标
2. 点击"+"按钮打开添加账号对话框
3. 输入用户名和密码
4. 点击"保存"即可

### 高级功能

#### 密码生成
- 在添加账号时点击"生成密码"按钮
- 或在快捷操作区点击"生成密码"
- 支持自定义密码长度和字符类型

#### 数据导出
- 在快捷操作区点击"导出"按钮
- 可以导出加密的备份数据
- 用于备份或迁移到其他设备

## 🏗️ 技术架构

### 文件结构
```
password-manager/
├── manifest.json           # 插件配置文件
├── background/
│   └── background.js       # 后台脚本
├── content/
│   ├── content.js          # 内容脚本
│   └── content.css         # 内容脚本样式
├── popup/
│   ├── popup.html          # 弹窗页面
│   ├── popup.js            # 弹窗逻辑
│   └── popup.css           # 弹窗样式
├── utils/
│   ├── crypto.js           # 加密工具
│   ├── storage.js          # 存储工具
│   └── domain.js           # 域名工具
├── icons/                  # 插件图标
└── README.md              # 说明文档
```

### 核心模块

#### 表单检测模块 (content.js)
- **SmartFormDetector**：智能表单检测器
- **多层次选择器策略**：高/中/低优先级匹配
- **评分算法**：综合分析表单可信度
- **动态监听**：实时检测页面变化

#### 存储管理模块 (storage.js)
- **StorageManager**：数据存储管理器
- **加密存储**：密码AES-256加密
- **基础域名分组**：智能域名处理
- **临时存储**：登录检测暂存机制

#### 加密模块 (crypto.js)
- **CryptoManager**：加密管理器
- **Web Crypto API**：浏览器原生加密
- **AES-GCM算法**：高安全性加密
- **密钥管理**：安全密钥生成和存储

#### 域名处理模块 (domain.js)
- **DomainManager**：域名工具类
- **基础域名提取**：智能识别主域名
- **特殊后缀支持**：支持.com.cn等复合后缀
- **子域名处理**：准确提取子域名信息

### 数据存储结构

```json
{
    "baidu.com": {
        "groupKey": "baidu.com",
        "appPackages": [],
        "accounts": [{
            "subDomain": "pan.baidu.com",
            "appPackage": null,
            "username": "admin",
            "password": "[encrypted]",
            "source": "插件",
            "createdTime": "2025-01-01 12:00",
            "modifyTime": "2025-01-01 12:00"
        }]
    }
}
```

## 🔒 安全性

### 数据加密
- 使用浏览器原生Web Crypto API
- AES-256-GCM加密算法
- 本地生成和存储加密密钥
- 密码数据全程加密处理

### 隐私保护
- 所有数据仅存储在本地
- 不上传到任何服务器
- 不收集用户个人信息
- 支持完全离线使用

### 安全特性
- 防止页面样式冲突
- 避免密码明文传输
- 安全的剪贴板操作
- 自动清理过期临时数据

## 🛠️ 开发说明

### 开发环境要求
- Chrome 88+ (支持Manifest V3)
- 现代JavaScript ES2020+
- Web Crypto API支持

### 调试方法
1. **查看控制台日志**
   - Content Script: 网页控制台
   - Background Script: 扩展程序控制台
   - Popup: 右键检查弹窗

2. **存储数据查看**
   - 在扩展程序页面点击"background页面"
   - 控制台执行：`chrome.storage.local.get(console.log)`

### 自定义配置
在相应文件中修改以下配置：
- 表单选择器：`content.js` 中的 `ENHANCED_FORM_SELECTORS`
- 加密算法：`crypto.js` 中的算法配置
- 存储键名：`storage.js` 中的存储键配置
- 界面样式：`popup.css` 和 `content.css`

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 常见问题

### Q: 插件无法检测到登录表单？
A: 确保页面已完全加载，某些网站使用异步加载表单，插件会持续监听页面变化。如果仍有问题，可以手动添加账号。

### Q: 密码无法自动填充？
A: 检查网站是否有特殊的安全限制，某些网站禁止程序自动填充密码。可以尝试手动复制密码。

### Q: 数据会丢失吗？
A: 所有数据都加密存储在浏览器本地，不会丢失。建议定期导出备份数据。

### Q: 支持同步到其他设备吗？
A: 当前版本仅支持本地存储，可以通过导出/导入功能在设备间迁移数据。

---

**注意**：本插件仅用于个人密码管理，请勿在企业环境或处理敏感信息时使用。使用前请评估安全风险。 