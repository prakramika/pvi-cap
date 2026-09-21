$ErrorActionPreference = "Stop"

$root = "D:\pvi\tools\mailpit"
New-Item -ItemType Directory -Force -Path $root | Out-Null

$exe = Join-Path $root "mailpit.exe"
if (-not (Test-Path $exe)) {
  $zip = Join-Path $root "mailpit-windows-amd64.zip"
  Write-Host "Downloading Mailpit to $root ..."
  Invoke-WebRequest -Uri "https://github.com/axllent/mailpit/releases/latest/download/mailpit-windows-amd64.zip" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $root -Force
  Remove-Item $zip -ErrorAction SilentlyContinue
}

Write-Host "Mailpit SMTP  localhost:1025"
Write-Host "Mailpit inbox http://localhost:8025"
Write-Host "Ctrl+C to stop."
& $exe --db-file (Join-Path $root "mailpit.db")
