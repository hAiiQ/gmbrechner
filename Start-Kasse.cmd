@echo off
title Gentlemans Bar - Kasse
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js 22 installieren: https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\express\package.json" (
  call npm.cmd ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo Die Kasse ist nach dem Start unter http://localhost:3000 erreichbar.
echo Dieses Fenster offen lassen. Beenden mit Strg+C.
echo.
call npm.cmd start
pause
