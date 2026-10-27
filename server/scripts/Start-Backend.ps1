param([switch]$Restart)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backendRoot = Join-Path $repoRoot 'backend\backend_java'
$jar = Join-Path $backendRoot 'build\libs\backend_java-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $jar)) { throw 'Build the backend first: cd backend/backend_java; .\gradlew.bat build' }
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'server\.secrets\backend.properties'))) {
    throw 'Run server/scripts/configure_backend.py first.'
}
$listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    if (-not $Restart) { throw 'Port 8000 is occupied. Use -Restart to restart this RepairCalc backend.' }
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    if ($existing.Name -ne 'java.exe' -or $existing.CommandLine -notlike "*$backendRoot*") {
        throw 'Port 8000 does not belong to this checkout; process was not stopped.'
    }
    Stop-Process -Id $existing.ProcessId
    Wait-Process -Id $existing.ProcessId -Timeout 20 -ErrorAction SilentlyContinue
}
$logRoot = Join-Path $repoRoot '.cache'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$java = (Get-Command java.exe).Source
$process = Start-Process -FilePath $java -WorkingDirectory $backendRoot -ArgumentList '-jar',"`"$jar`"" -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logRoot 'backend.out.log') -RedirectStandardError (Join-Path $logRoot 'backend.err.log')
$deadline = (Get-Date).AddSeconds(50)
do {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) { throw 'Backend exited; inspect .cache/backend.err.log and .cache/backend.out.log locally.' }
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 2
        if ($health.status -eq 'UP' -and $health.database -like 'PostgreSQL*') {
            Write-Output "Backend ready on port 8000 with $($health.database); PID $($process.Id)."
            exit 0
        }
    } catch { }
} while ((Get-Date) -lt $deadline)
throw 'Backend did not become ready within 50 seconds; inspect the local logs.'
