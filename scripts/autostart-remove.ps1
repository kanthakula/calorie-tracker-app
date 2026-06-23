# Tears down the K21 auto-start setup created by autostart-setup.ps1.
# Stops/removes the PM2 processes, unregisters the Windows startup hook.
# Does NOT remove Postgres data; run `docker compose down -v` separately to wipe it.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> Removing K21 auto-start" -ForegroundColor Cyan

Write-Host "[1/3] Stopping + deleting PM2 processes..." -ForegroundColor Green
pm2 delete ecosystem.config.cjs
pm2 save --force

Write-Host "[2/3] Unregistering PM2 Windows startup hook..." -ForegroundColor Green
pm2-startup uninstall

Write-Host "[3/3] (Optional) Stop Postgres with: docker compose down" -ForegroundColor Green

Write-Host "==> Auto-start removed. The code and database are untouched." -ForegroundColor Cyan
