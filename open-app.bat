@echo off
cd /d "%~dp0"
start "Google Ads Audit Generator" /D "%~dp0" cmd /k npm.cmd run dev
