# Opens the Windows Firewall for the K21 web (3000) and API (4000) ports so other
# devices on the same LAN can reach the app. Run this ONCE, elevated.
#
#   Right-click this file -> "Run with PowerShell"  (accept the admin prompt), OR
#   open an elevated PowerShell and run:
#     powershell -ExecutionPolicy Bypass -File scripts\open-firewall.ps1
#
# Scoped to the Private network profile (home/work Wi-Fi), not Public.
# To undo: see the Remove-NetFirewallRule lines at the bottom.
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$rules = @(
  @{ Name = 'K21 Web HTTPS (3443)'; Port = 3443 },  # camera/voice work here
  @{ Name = 'K21 Web (3000)'; Port = 3000 },          # plain http (no camera/voice)
  @{ Name = 'K21 API (4000)'; Port = 4000 }           # direct API (mobile app)
)

foreach ($r in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Already present: $($r.Name)" -ForegroundColor Yellow
  } else {
    New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $r.Port -Profile Private | Out-Null
    Write-Host "Added inbound rule: $($r.Name) (TCP $($r.Port), Private)" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Done. From other devices on your Wi-Fi:" -ForegroundColor Cyan
Write-Host "  https://<this-PC-IP>:3443   <- use this (camera + voice work; accept the one-time warning)"
Write-Host "  http://<this-PC-IP>:3000    <- plain http (tracking works; camera/voice do not)"
Write-Host "Find this PC's IP with:  ipconfig  (look for the Wi-Fi IPv4 Address)"
Write-Host ""
Write-Host "To undo later (elevated):"
Write-Host "  Remove-NetFirewallRule -DisplayName 'K21 Web HTTPS (3443)'"
Write-Host "  Remove-NetFirewallRule -DisplayName 'K21 Web (3000)'"
Write-Host "  Remove-NetFirewallRule -DisplayName 'K21 API (4000)'"
