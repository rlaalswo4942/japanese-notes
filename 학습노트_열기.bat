@echo off
cd /d "%~dp0"
start "Study Note Server" python server.py
timeout /t 2 /nobreak >nul
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (start "" "%CHROME%" http://localhost:8780) else (start "" http://localhost:8780)