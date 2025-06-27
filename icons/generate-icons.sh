#!/bin/bash

# Chrome扩展图标生成脚本
# 需要安装ImageMagick: brew install imagemagick (macOS) 或 sudo apt-get install imagemagick (Ubuntu)

echo "🔐 密码管理器图标生成器"
echo "=========================="

# 检查ImageMagick是否安装
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "❌ 错误: 未找到ImageMagick"
    echo "请先安装ImageMagick:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo "  Windows: 下载并安装 https://imagemagick.org/script/download.php#windows"
    exit 1
fi

# 确定使用的命令
if command -v magick &> /dev/null; then
    CONVERT_CMD="magick"
else
    CONVERT_CMD="convert"
fi

# 检查SVG文件是否存在
SVG_FILE="icon-simple.svg"
if [ ! -f "$SVG_FILE" ]; then
    echo "❌ 错误: 未找到SVG文件 $SVG_FILE"
    echo "请确保在icons目录中运行此脚本"
    exit 1
fi

echo "📁 使用SVG文件: $SVG_FILE"
echo "🔨 开始生成图标..."

# 生成不同尺寸的图标
sizes=(16 32 48 128)

for size in "${sizes[@]}"; do
    output_file="icon${size}.png"
    echo "   生成 ${size}x${size} -> $output_file"
    
    if [ "$CONVERT_CMD" = "magick" ]; then
        magick "$SVG_FILE" -resize "${size}x${size}" -background transparent "$output_file"
    else
        convert "$SVG_FILE" -resize "${size}x${size}" -background transparent "$output_file"
    fi
    
    if [ $? -eq 0 ]; then
        echo "   ✅ 成功生成 $output_file"
    else
        echo "   ❌ 生成失败 $output_file"
    fi
done

echo ""
echo "🎉 图标生成完成！"
echo "生成的文件:"
ls -la icon*.png 2>/dev/null || echo "   未找到生成的PNG文件"

echo ""
echo "📋 下一步:"
echo "1. 检查生成的图标文件"
echo "2. 确保文件在插件的icons目录中"
echo "3. 重新加载Chrome扩展"

# 验证文件
echo ""
echo "🔍 文件验证:"
for size in "${sizes[@]}"; do
    file="icon${size}.png"
    if [ -f "$file" ]; then
        file_size=$(ls -lh "$file" | awk '{print $5}')
        echo "   ✅ $file ($file_size)"
    else
        echo "   ❌ $file (缺失)"
    fi
done 