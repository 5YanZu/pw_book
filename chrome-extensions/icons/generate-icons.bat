@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🔐 密码管理器图标生成器
echo ==========================

REM 检查ImageMagick是否安装
where magick >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到ImageMagick
    echo 请先安装ImageMagick:
    echo   下载地址: https://imagemagick.org/script/download.php#windows
    echo   或使用Chocolatey: choco install imagemagick
    pause
    exit /b 1
)

REM 检查SVG文件是否存在
set SVG_FILE=icon-simple.svg
if not exist "%SVG_FILE%" (
    echo ❌ 错误: 未找到SVG文件 %SVG_FILE%
    echo 请确保在icons目录中运行此脚本
    pause
    exit /b 1
)

echo 📁 使用SVG文件: %SVG_FILE%
echo 🔨 开始生成图标...

REM 生成不同尺寸的图标
set sizes=16 32 48 128

for %%s in (%sizes%) do (
    set output_file=icon%%s.png
    echo    生成 %%sx%%s -^> !output_file!
    
    magick "%SVG_FILE%" -resize "%%sx%%s" -background transparent "!output_file!"
    
    if exist "!output_file!" (
        echo    ✅ 成功生成 !output_file!
    ) else (
        echo    ❌ 生成失败 !output_file!
    )
)

echo.
echo 🎉 图标生成完成！
echo 生成的文件:

REM 列出生成的文件
for %%s in (%sizes%) do (
    set file=icon%%s.png
    if exist "!file!" (
        for %%A in ("!file!") do (
            echo    ✅ !file! (%%~zA bytes)
        )
    ) else (
        echo    ❌ !file! (缺失)
    )
)

echo.
echo 📋 下一步:
echo 1. 检查生成的图标文件
echo 2. 确保文件在插件的icons目录中
echo 3. 重新加载Chrome扩展

echo.
echo 按任意键退出...
pause >nul 