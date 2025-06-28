@echo off
echo 正在启动密码管理器测试服务器...
echo.
echo 项目目录: %CD%
echo 服务器地址: http://localhost:8000
echo 测试页面: http://localhost:8000/test.html
echo.
echo 按 Ctrl+C 停止服务器
echo.

REM 尝试不同的Python命令
python -m http.server 8000 2>nul
if errorlevel 1 (
    py -m http.server 8000 2>nul
    if errorlevel 1 (
        python3 -m http.server 8000 2>nul
        if errorlevel 1 (
            echo 错误: 未找到Python或Python未正确安装
            echo 请确保Python已安装并添加到PATH环境变量中
            pause
        )
    )
) 