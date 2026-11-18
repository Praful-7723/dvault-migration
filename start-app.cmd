@echo off
cd /d "%~dp0"
node scripts\portable.js app
if errorlevel 1 pause
