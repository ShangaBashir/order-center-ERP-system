@echo off
title Order Center ERP Server
echo ====================================================
echo Starting Order Center ERP (Node.js + SQLite Database)...
echo ====================================================
cd /d "%~dp0"
start http://localhost:3000
node server.js
pause
