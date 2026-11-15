@echo off
title SkinCheck Launcher
echo ======================================================
echo           MEMBUKA APLIKASI SKINCHECK
echo ======================================================
echo.

cd /d "c:\xampp\htdocs\Project Skin Chek"

:: Cek apakah server sudah berjalan di port 3000
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Server SkinCheck sudah aktif di latar belakang.
) else (
    echo [INFO] Menyalakan server SkinCheck...
    start /min "SkinCheck Server" cmd /c "node server.js"
    timeout /t 2 /nobreak >nul
)

echo [INFO] Membuka http://localhost:3000 di browser...
start http://localhost:3000

echo.
echo ======================================================
echo   Aplikasi berhasil dibuka! Jendela ini dapat ditutup.
echo ======================================================
timeout /t 3 >nul
exit
