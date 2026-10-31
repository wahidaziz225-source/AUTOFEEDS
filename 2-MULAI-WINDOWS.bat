@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
 echo Jalankan 1-INSTAL-WINDOWS.bat terlebih dahulu.
 pause
 exit /b 1
)
echo === AUTOFEEDS ===
echo Tunggu tulisan Ready, lalu buka http://localhost:3000
echo Biarkan terminal ini terbuka. Untuk berhenti tekan Ctrl+C.
call npm run dev
pause
