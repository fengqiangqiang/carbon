@echo off
setlocal

cd /d "%~dp0"

echo Starting Carbon dev services...
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-carbon.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Carbon startup exited with code %EXIT_CODE%.
  echo Check the messages above for details.
) else (
  echo Carbon startup command finished.
)

echo.
pause
exit /b %EXIT_CODE%
