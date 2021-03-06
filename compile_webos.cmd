@echo off
setlocal EnableExtensions EnableDelayedExpansion
echo Check NPM packets
rem call npm install coffee-script google-closure-compiler http-server minify --save-dev

echo Get latest nmake in system
set pf=%PROGRAMFILES(X86)%
if not defined PROGRAMFILES(X86) set pf=%PROGRAMFILES%
for /f "usebackq delims==" %%g in (`dir "!pf!\Microsoft Visual Studio 1*" /O-N /B /AD`) do (
  set nmake_exe=!pf!\%%g\VC\bin\nmake.exe
  if exist "!nmake_exe!" goto run_nmake 
)
echo nmake was not found
exit /b

:run_nmake 
echo Build
"!nmake_exe!" clean
"!nmake_exe!" all
if %errorlevel% neq 0 (
  pause
  exit /b
)

echo Start server
taskkill /fi "windowtitle eq http-server"
start npx http-server ./dist/ -p 6321 -o ?debug_print=on -c-1 -S -C 127.0.0.1.cert -K 127.0.0.1.key