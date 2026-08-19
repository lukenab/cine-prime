    param([string]$ContainerName = "postgres")

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "seed-payment-operations.sql"

$running = docker inspect -f "{{.State.Running}}" $ContainerName 2>$null
if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
    throw "PostgreSQL container '$ContainerName' is not running. Run: docker compose up -d postgres"
}

Get-Content -Raw $scriptPath | docker exec -i $ContainerName psql -U postgres -d payment_db -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
    throw "Could not seed payment demo records. Ensure payment-service has applied Flyway V5."
}

Write-Host "Payment demo records seeded. Open /admin/refunds-reconciliation as an Admin." -ForegroundColor Green
