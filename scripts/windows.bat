@echo off
setlocal
:: Usage: windows.bat <local-file-path>
:: Sets the desktop wallpaper on Windows.

set "FILE=%~f1"

if "%FILE%"=="" (
    echo Error: no file path provided
    exit /b 1
)

if not exist "%FILE%" (
    echo Error: file does not exist: %FILE%
    exit /b 1
)

set "PS_SCRIPT=%TEMP%\wallpaper-manager-%RANDOM%-%RANDOM%.ps1"

> "%PS_SCRIPT%" (
    echo param^([string]$Path^)
    echo Add-Type -TypeDefinition @'
    echo using System;
    echo using System.Runtime.InteropServices;
    echo public static class Wallpaper {
    echo     [DllImport^("user32.dll", SetLastError = true, CharSet = CharSet.Unicode^)]
    echo     public static extern bool SystemParametersInfo^(int uAction, int uParam, string lpvParam, int fuWinIni^);
    echo }
    echo '@
    echo $resolvedPath = [System.IO.Path]::GetFullPath^($Path^)
    echo Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name Wallpaper -Value $resolvedPath
    echo $ok = [Wallpaper]::SystemParametersInfo^(0x0014, 0, $resolvedPath, 0x0003^)
    echo if ^(-not $ok^) { exit 1 }
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Path "%FILE%"
set "EXIT_CODE=%ERRORLEVEL%"
del "%PS_SCRIPT%" >nul 2>nul
exit /b %EXIT_CODE%