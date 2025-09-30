@echo off
setlocal

REM --- CONFIGURATION ---
set PROJECT_DIR="c:\Users\josehp\Desktop\informes web"

REM --- SCRIPT ---
echo =================================================
echo      DEPLOYMENT AUTOMATION SCRIPT (v2)
echo =================================================
echo.

REM 1. Navigate to project directory
echo [1/7] Navigating to project directory...
cd /d %PROJECT_DIR%
if %errorlevel% neq 0 (
    echo ERROR: Could not change to project directory.
    goto :eof
)
echo OK.
echo.

REM 2. Start Docker containers
echo [2/7] Starting Docker containers...
docker-compose up -d
echo OK.
echo.

REM 3. Start ngrok in the background
echo [3/7] Starting ngrok...
start /b ngrok.exe http 3000
echo OK.
echo.

REM 4. Wait for ngrok to initialize
echo [4/7] Waiting for ngrok to initialize (10 seconds)...
timeout /t 10 /nobreak > nul
echo OK.
echo.

REM 5. Get the new ngrok URL
echo [5/7] Getting new ngrok URL...
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

REM 6. Replace the old URL in HTML files
echo [6/7] Updating URLs in HTML files...
set "FILES_TO_UPDATE=index.html pagina2.html plantillas.html resultados.html"
for %%f in (%FILES_TO_UPDATE%) do (
    echo   - Updating %%f...
    powershell -Command "(Get-Content -Path '%%f') -replace 'https://[a-z0-9\-]+\.ngrok-free\.dev', '%NEW_NGROK_URL%' | Set-Content -Path '%%f'"
)
echo OK.
echo.

REM 7. Commit and push to GitHub
echo [7/7] Committing and pushing changes to GitHub...
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