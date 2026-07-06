@echo off
setlocal EnableExtensions
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

set "WM_WALLPAPER_FILE=%FILE%"

echo Setting wallpaper: %FILE%

reg add "HKCU\Control Panel\Desktop" /v Wallpaper /t REG_SZ /d "%FILE%" /f >nul
reg add "HKCU\Control Panel\Desktop" /v WallpaperStyle /t REG_SZ /d "10" /f >nul
reg add "HKCU\Control Panel\Desktop" /v TileWallpaper /t REG_SZ /d "0" /f >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $path=$env:WM_WALLPAPER_FILE; $q=[char]34; $signature='[DllImport('+$q+'user32.dll'+$q+', EntryPoint='+$q+'SystemParametersInfoW'+$q+', SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);'; Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition $signature; $ok=[Win32.NativeMethods]::SystemParametersInfo(20, 0, $path, 3); $lastError=[Runtime.InteropServices.Marshal]::GetLastWin32Error(); Write-Host ('SystemParametersInfo result: ' + $ok + ', lastError: ' + $lastError); if (-not $ok) { exit 1 }"
if errorlevel 1 (
    echo Error: SystemParametersInfo failed
    exit /b 1
)

rundll32.exe user32.dll,UpdatePerUserSystemParameters 1, True
echo Wallpaper updated successfully.
exit /b %ERRORLEVEL%