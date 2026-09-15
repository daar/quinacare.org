@echo off
REM QuinaCare Blog Editor - starts the local server, which then opens the
REM editor in your browser. Equivalent to: node editor\server.mjs
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js was not found on your PATH.
  echo Install it from https://nodejs.org and run this script again.
  pause
  exit /b 1
)

echo Starting the QuinaCare Blog Editor...
node server.mjs
pause
