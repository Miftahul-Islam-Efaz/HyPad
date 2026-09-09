<#
  HyPad installer (per-user, no admin needed).

  A plain .exe never appears in Start / "Installed apps" because Windows only
  lists things that registered themselves. This script does that registration:
    * copies HyPad to %LOCALAPPDATA%\Programs\HyPad
    * creates a Start menu shortcut (so it shows in the app list and search)
    * writes an Uninstall entry (so it shows in Settings > Apps > Installed apps)
    * registers HyPad as an "Open with" handler for .txt / .md / .log files

  Usage:  right-click > Run with PowerShell     (or)     powershell -ExecutionPolicy Bypass -File Install-HyPad.ps1
#>

$ErrorActionPreference = 'Stop'
$AppName  = 'HyPad'
$Version  = '1.0.1'
$Publisher = 'Miftahul Islam Efaz'
$Source   = $PSScriptRoot
$Target   = Join-Path $env:LOCALAPPDATA "Programs\$AppName"
$Exe      = Join-Path $Target 'HyPad-win_x64.exe'

Write-Host "Installing $AppName $Version..." -ForegroundColor Cyan

Get-Process 'HyPad-win_x64' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 400

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Get-ChildItem -Path $Source -File |
  Where-Object { $_.Name -notlike '*.ps1' } |
  Copy-Item -Destination $Target -Force

if (-not (Test-Path $Exe)) { throw "HyPad-win_x64.exe was not found next to this script." }
Copy-Item (Join-Path $PSScriptRoot 'Uninstall-HyPad.ps1') $Target -Force -ErrorAction SilentlyContinue

# --- Start menu shortcut: this is what puts it in the Windows app list ---
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$lnk = Join-Path $startMenu "$AppName.lnk"
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath       = $Exe
$s.WorkingDirectory = $Target
$s.IconLocation     = "$Exe,0"
$s.Description      = 'HyPad - a fast, modern notepad'
$s.Save()

# --- Installed apps entry ---
$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"
New-Item -Path $key -Force | Out-Null
$size = [int]((Get-ChildItem $Target -Recurse -File | Measure-Object Length -Sum).Sum / 1KB)
$props = @{
  DisplayName     = $AppName
  DisplayVersion  = $Version
  Publisher       = $Publisher
  DisplayIcon     = $Exe
  InstallLocation = $Target
  EstimatedSize   = $size
  NoModify        = 1
  NoRepair        = 1
  URLInfoAbout    = 'https://github.com/Miftahul-Islam-Efaz/HyPad'
  UninstallString = "powershell -ExecutionPolicy Bypass -File `"$Target\Uninstall-HyPad.ps1`""
}
foreach ($k in $props.Keys) {
  $type = if ($props[$k] -is [int]) { 'DWord' } else { 'String' }
  New-ItemProperty -Path $key -Name $k -Value $props[$k] -PropertyType $type -Force | Out-Null
}

# --- "Open with > HyPad" for common text files ---
$cls = 'HKCU:\Software\Classes'
New-Item -Path "$cls\Applications\HyPad-win_x64.exe\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$cls\Applications\HyPad-win_x64.exe\shell\open\command" -Name '(default)' -Value "`"$Exe`" `"%1`""
Set-ItemProperty -Path "$cls\Applications\HyPad-win_x64.exe" -Name 'FriendlyAppName' -Value $AppName
foreach ($ext in '.txt', '.md', '.markdown', '.log') {
  New-Item -Path "$cls\$ext\OpenWithList\HyPad-win_x64.exe" -Force | Out-Null
}

Write-Host "Done. $AppName is in your Start menu and in Settings > Apps > Installed apps." -ForegroundColor Green
Start-Process $Exe
