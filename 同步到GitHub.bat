@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ===================================
echo   真名之火 - 同步到 GitHub
echo ===================================
echo.

git add -A
git status

echo.
set /p msg=请输入提交说明（直接回车使用默认）：
if "%msg%"=="" set msg=update: 同步最新规则与美术进度

git commit -m "%msg%"
git push origin main

echo.
if %errorlevel%==0 (
  echo [SUCCESS] 同步完成！
  echo 查看: https://github.com/Moloym00/mythology
) else (
  echo [WARNING] push 遇到问题，请检查网络或手动处理。
)
echo.
pause
