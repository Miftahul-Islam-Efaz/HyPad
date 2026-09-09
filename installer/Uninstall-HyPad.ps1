<#  Removes HyPad: shortcut, Installed-apps entry, file handlers and program folder.  #>
$ErrorActionPreference = 'SilentlyContinue'
$AppName = 'HyPad'
$Target  = Join-Path $env:LOCALAPPDATA "Programs\$AppName"

Get-Process 'HyPad-win_x64' | Stop-Process -Force
Start-Sleep -Milliseconds 400

Remove-Item (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$AppName.lnk") -Force
Remove-Item "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName" -Recurse -Force
Remove-Item 'HKCU:\Software\Classes\Applications\HyPad-win_x64.exe' -Recurse -Force
foreach ($ext in '.txt', '.md', '.markdown', '.log') {
  Remove-Item "HKCU:\Software\Classes\$ext\OpenWithList\HyPad-win_x64.exe" -Recurse -Force
}

# delete the folder from outside itself so the running script isn't locked
Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -Command Start-Sleep 2; Remove-Item -Recurse -Force '$Target'"
Write-Host "$AppName has been uninstalled." -ForegroundColor Green
