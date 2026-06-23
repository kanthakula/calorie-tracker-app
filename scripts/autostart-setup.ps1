# Sets up the K21 stack to start automatically when you log in to Windows.
#
# What it does:
#   1. Ensures Postgres (Docker) is up and the schema is migrated + seeded.
#   2. Builds the workspace (production artifacts).
#   3. Installs PM2 + the Windows startup hook (globally).
#   4. Starts the 3 app processes under PM2 and saves the process list.
#   5. Registers PM2 to "resurrect" that list on every login.
#
# Postgres itself comes back via Docker's `restart: unless-stopped` policy, as
# long as Docker Desktop starts on login (Settings -> General -> "Start Docker
# Desktop when you sign in"). This script reminds you to enable that.
#
# Re-runnable. To undo: pnpm autostart:remove
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> K21 auto-start setup" -ForegroundColor Cyan

# Resolve pnpm (via corepack) and npm.
function Invoke-Pnpm { corepack pnpm @args }

Write-Host "`n[1/5] Starting Postgres (Docker)..." -ForegroundColor Green
docker compose up -d postgres
Write-Host "      Waiting for Postgres to be healthy..."
for ($i = 0; $i -lt 30; $i++) {
  $ok = docker exec k21-postgres pg_isready -U k21 -d k21_calorie_tracker 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Host "      Postgres ready."; break }
  Start-Sleep -Seconds 2
}

Write-Host "`n[2/5] Migrating + seeding the database..." -ForegroundColor Green
Invoke-Pnpm db:migrate:deploy
Invoke-Pnpm db:seed

Write-Host "`n[3/5] Building the workspace (production artifacts)..." -ForegroundColor Green
Invoke-Pnpm build

Write-Host "`n[4/5] Installing PM2 + Windows startup hook (global)..." -ForegroundColor Green
npm install -g pm2 pm2-windows-startup
pm2-startup install

Write-Host "`n[5/5] Starting processes under PM2 and saving..." -ForegroundColor Green
pm2 start ecosystem.config.cjs
pm2 save

Write-Host "`n==> Done." -ForegroundColor Cyan
Write-Host "    App:        http://localhost:3000"
Write-Host "    Node API:   http://localhost:4000/api/health"
Write-Host "    AI service: http://localhost:8000/health"
Write-Host ""
Write-Host "    IMPORTANT: enable Docker Desktop auto-start so Postgres returns after reboot:" -ForegroundColor Yellow
Write-Host "      Docker Desktop -> Settings -> General -> 'Start Docker Desktop when you sign in'"
Write-Host ""
Write-Host "    Useful: pm2 status | pm2 logs | pnpm pm2:restart | pnpm autostart:remove"
