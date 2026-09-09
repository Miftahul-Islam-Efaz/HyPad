@echo off
rem Bootstrap used inside HyPad-Setup.exe. IExpress extracts every packaged
rem file to a temp folder and runs this, so PowerShell execution policy and
rem the "how do you want to open this file" prompt are both bypassed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-HyPad.ps1"
exit /b %errorlevel%
