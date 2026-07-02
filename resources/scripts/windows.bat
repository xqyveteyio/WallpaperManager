@echo off
:: Usage: windows.bat <local-file-path>
:: Sets the desktop wallpaper on Windows.

set "FILE=%~1"

if "%FILE%"=="" (
    echo Error: no file path provided
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Wallpaper { [DllImport(\"user32.dll\", CharSet=CharSet.Auto) ] public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni); }';" ^
    "[Wallpaper]::SystemParametersInfo(0x0014, 0, '%FILE%', 0x0003);"
