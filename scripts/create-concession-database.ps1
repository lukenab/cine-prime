$ErrorActionPreference = "Stop"

$containerName = "postgres"
$databaseName = "concession_db"

$running = docker inspect -f "{{.State.Running}}" $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
    throw "PostgreSQL container '$containerName' is not running. Run: docker compose up -d postgres"
}

[string] $exists = docker exec $containerName psql -U postgres -d postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
if ($LASTEXITCODE -ne 0) {
    throw "Could not query PostgreSQL in container '$containerName'."
}

if ($exists.Trim() -eq "1") {
    Write-Host "$databaseName already exists."
    exit 0
}

docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c `
    "CREATE DATABASE $databaseName"
if ($LASTEXITCODE -ne 0) {
    throw "Could not create database '$databaseName'."
}
Write-Host "Created $databaseName."
