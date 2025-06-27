@echo off
echo 启动测试服务器...
echo 测试页面将在 http://localhost:8000/test/ 可用
echo.
echo 可用的测试页面:
echo - http://localhost:8000/test/index.html (测试中心)
echo - http://localhost:8000/test/standard-login.html (标准登录)
echo - http://localhost:8000/test/email-login.html (邮箱登录)
echo - http://localhost:8000/test/phone-login.html (手机号登录)
echo - http://localhost:8000/test/complex-login.html (复杂登录)
echo - http://localhost:8000/test/register-form.html (注册表单)
echo - http://localhost:8000/test/dynamic-form.html (动态表单)
echo.
echo 按 Ctrl+C 停止服务器
echo.

cd /d "%~dp0"
python -m http.server 8000 