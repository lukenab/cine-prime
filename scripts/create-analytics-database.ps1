$ErrorActionPreference = "Stop"

$containerName = "postgres"
$databaseName = "analytics_db"

$running = docker inspect -f "{{.State.Running}}" $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
    throw "PostgreSQL container '$containerName' is not running. Run: docker compose up -d postgres"
}

$existsRaw = docker exec $containerName psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
$exists = if ($null -eq $existsRaw) { "" } else { $existsRaw.ToString().Trim() }
if ($LASTEXITCODE -ne 0) {
    throw "Could not query PostgreSQL in container '$containerName'."
}

if ($exists -eq "1") {
    Write-Host "$databaseName already exists."
    exit 0
}

docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $databaseName"
if ($LASTEXITCODE -ne 0) {
    throw "Could not create database '$databaseName'."
}
Write-Host "Created $databaseName."
