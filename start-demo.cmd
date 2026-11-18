@echo off
cd /d "%~dp0"
node scripts\portable.js demo
if errorlevel 1 pause
