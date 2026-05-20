@echo off
cd /d "%~dp0"
if exist ".next" rmdir /s /q ".next"
npm.cmd run dev
pause
