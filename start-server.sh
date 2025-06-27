#!/bin/bash

echo "正在启动密码管理器测试服务器..."
echo ""
echo "项目目录: $(pwd)"
echo "服务器地址: http://localhost:8000"
echo "测试页面: http://localhost:8000/test.html"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 尝试不同的Python命令
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
else
    echo "错误: 未找到Python"
    echo "请确保Python已安装并添加到PATH环境变量中"
    exit 1
fi 