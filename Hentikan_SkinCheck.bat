@echo off
title Hentikan Server SkinCheck
echo ======================================================
echo          MENGHENTIKAN SERVER SKINCHECK
echo ======================================================
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Menghentikan proses dengan PID: %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Server SkinCheck telah dimatikan.
timeout /t 2 >nul
exit
