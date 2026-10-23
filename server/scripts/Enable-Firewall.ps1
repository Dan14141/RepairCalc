# Run in elevated PowerShell. Restricts the change to the three RepairCalc ports.
param([string[]]$RemoteAddress = @('Any'))
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator and rerun this script.'
}
foreach ($port in @(5433,6380,5443)) {
    $ruleName = "RepairCalc-TCP-$port"
    if (-not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name $ruleName -DisplayName "RepairCalc TCP $port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -RemoteAddress $RemoteAddress -Profile Any -ErrorAction Stop | Out-Null
    }
}
Write-Output 'RepairCalc firewall rules are present.'
