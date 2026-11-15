@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 第一次运行，正在安装依赖...
  call npm install
)
echo 正在启动暖光积木屋...
call npm run dev -- --open
