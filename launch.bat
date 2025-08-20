@echo off
cd %~dp0
start "" http://localhost:3000/
node backend\advancedServer2.js
