$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $pythonPath)) { $pythonPath = 'python' }
    if (-not (Test-Path -LiteralPath '.secrets\credentials.json')) { throw 'Run scripts/setup.py first.' }
    & $pythonPath scripts/sync-config.py
    if ($LASTEXITCODE -ne 0) { throw 'Configuration sync failed.' }
    docker compose up -d --wait --wait-timeout 300
    if ($LASTEXITCODE -ne 0) { throw 'Docker startup failed.' }
    & $pythonPath scripts/manage.py migrate
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
    & $pythonPath scripts/configure_backend.py
    if ($LASTEXITCODE -ne 0) { throw 'Backend configuration failed.' }
    docker compose ps
} finally { Pop-Location }
