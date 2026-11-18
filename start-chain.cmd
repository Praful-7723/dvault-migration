@echo off
cd /d "%~dp0"
node scripts\portable.js node
if errorlevel 1 pause
