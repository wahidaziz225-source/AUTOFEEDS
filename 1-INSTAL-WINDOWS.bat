@echo off
setlocal
cd /d "%~dp0"
echo === INSTAL AUTOFEEDS ===
where node >nul 2>&1
if errorlevel 1 goto missing_node
node -e "if(22 > Number(process.versions.node.split('.')[0]))process.exit(1)"
if errorlevel 1 goto missing_node
where python >nul 2>&1
if errorlevel 1 goto missing_python
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)"
if errorlevel 1 goto missing_python
call npm ci
if errorlevel 1 goto failed
python -m pip install -r requirements.txt
if errorlevel 1 goto failed
echo.
echo Instalasi dasar selesai. Jalankan 2-MULAI-WINDOWS.bat.
echo Model AI foto dan Ollama bersifat opsional untuk fitur tertentu; baca panduan.
pause
exit /b 0
:missing_node
echo Pasang Node.js 22 atau lebih baru, lalu buka kembali file ini.
pause
exit /b 1
:missing_python
echo Pasang Python 3.10 atau lebih baru dengan opsi Add Python to PATH.
pause
exit /b 1
:failed
echo Instalasi belum selesai. Simpan pesan error di atas untuk diperiksa.
pause
exit /b 1
