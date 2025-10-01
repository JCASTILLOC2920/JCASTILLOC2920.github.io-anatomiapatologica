@echo off
setlocal

REM --- CONFIGURATION ---
set PROJECT_DIR="%~dp0"

REM --- SCRIPT ---
echo =================================================
echo      DEPLOYMENT AUTOMATION SCRIPT (v3)
echo =================================================
echo.

REM 1. Kill any stale ngrok processes
echo [1/8] Stopping any old ngrok processes...
taskkill /f /im ngrok.exe > nul 2>&1
echo OK.
echo.

REM 2. Navigate to project directory
echo [2/8] Navigating to project directory...
cd /d %PROJECT_DIR%
if %errorlevel% neq 0 (
    echo ERROR: Could not change to project directory.
    goto :eof
)
echo OK.
echo.

REM 3. Start Docker containers
echo [3/8] Starting Docker containers...
docker-compose up -d
echo OK.
echo.

REM 4. Start ngrok in the background
echo [4/8] Starting ngrok...
start /b ngrok.exe http 3000
echo OK.
echo.

REM 5. Wait for ngrok to initialize
echo [5/8] Waiting for ngrok to initialize (10 seconds)...
timeout /t 10 /nobreak > nul
echo OK.
echo.

REM 6. Get the new ngrok URL
echo [6/8] Getting new ngrok URL...
for /f "delims=" %%i in ('powershell -command "try { (curl http://127.0.0.1:4040/api/tunnels | ConvertFrom-Json).tunnels[0].public_url } catch { Write-Output 'ERROR' }"') do set NEW_NGROK_URL=%%i

if "%NEW_NGROK_URL%"=="ERROR" (
    echo ERROR: Could not get ngrok URL. Is ngrok running correctly?
    goto :eof
)
if not defined NEW_NGROK_URL (
    echo ERROR: Could not get ngrok URL. Is ngrok running?
    goto :eof
)
echo New URL: %NEW_NGROK_URL%
echo OK.
echo.

REM 7. Replace the old URL in HTML files
echo [7/8] Updating URLs in HTML files...
set "FILES_TO_UPDATE=index.html pagina2.html plantillas.html resultados.html"
for %%f in (%FILES_TO_UPDATE%) do (
    echo   - Updating %%f...
    powershell -Command "(Get-Content -Path '%%f') -replace 'https://[a-z0-9\-]+\.ngrok-free\.dev', '%NEW_NGROK_URL%' | Set-Content -Path '%%f'"
)
echo OK.
echo.

REM 8. Commit and push to GitHub
echo [8/8] Committing and pushing changes to GitHub...
git add .
git commit -m "Automated URL update to %NEW_NGROK_URL%"
git push
echo OK.
echo.


echo =================================================
echo      DEPLOYMENT COMPLETE!
echo =================================================
echo.
echo Your application is now live with the new URL.
echo You can close this window.

pause
