@echo off
title Order Center ERP Server
echo ====================================================
echo Starting Order Center ERP (Node.js + SQLite Database)...
echo ====================================================
cd /d "C:\Users\shang\.gemini\antigravity-ide\scratch\ordercenter-erp"
start http://localhost:3000
node server.js
pause
