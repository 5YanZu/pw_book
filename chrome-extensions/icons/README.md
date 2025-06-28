# 图标文件说明

本目录包含Chrome扩展所需的图标文件。

## 所需图标尺寸

根据 `manifest.json` 配置，需要以下尺寸的图标：

- `icon16.png` - 16x16 像素 (工具栏小图标)
- `icon32.png` - 32x32 像素 (扩展管理页面)
- `icon48.png` - 48x48 像素 (扩展管理页面)
- `icon128.png` - 128x128 像素 (Chrome网上应用店)

## 图标设计要求

### 设计原则
- 简洁明了，易于识别
- 在小尺寸下依然清晰可见
- 符合密码管理器的主题
- 与Chrome扩展的设计规范一致

### 主题元素
- 🔐 锁或钥匙图标 (安全性)
- 盾牌图标 (保护)
- 密码相关符号
- 现代简约风格

### 颜色建议
- 主色：深蓝色 (#1a365d) 或深绿色 (#2d5a27)
- 辅色：浅蓝色 (#3182ce) 或浅绿色 (#38a169)
- 背景：白色或透明
- 确保在浅色和深色背景下都清晰可见

## 生成方法

### 方法一：使用在线图标生成器
1. 访问 [Favicon Generator](https://www.favicon-generator.org/)
2. 上传设计好的SVG图标
3. 选择所需尺寸并下载PNG文件

### 方法二：使用设计软件
1. **Adobe Illustrator/Photoshop**
   - 创建正方形画布
   - 按需要的尺寸导出PNG文件
   - 确保使用透明背景

2. **Figma (免费)**
   - 在线设计工具
   - 支持SVG和PNG导出
   - 有丰富的图标库

3. **Canva (免费)**
   - 选择图标设计模板
   - 自定义颜色和样式
   - 导出不同尺寸

### 方法三：使用命令行工具
如果有SVG源文件，可以使用ImageMagick转换：

```bash
# 安装ImageMagick
# Windows: choco install imagemagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

# 从SVG转换为PNG
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 32x32 icon32.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png
```

## 快速解决方案

如果您急需临时图标，可以：

1. 使用emoji转图标在线工具
2. 将🔐表情符号转换为图标
3. 或者使用以下Unicode字符：
   - 🔒 (U+1F512) - 锁
   - 🛡️ (U+1F6E1) - 盾牌  
   - 🔑 (U+1F511) - 钥匙

## 版权说明

确保使用的图标素材符合以下要求：
- 有商业使用权限
- 无版权争议
- 符合Chrome扩展商店政策

建议使用：
- 自己设计的原创图标
- CC0许可的免费图标
- 购买的商业图标 