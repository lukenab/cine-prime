$ErrorActionPreference = "Stop"

$containerName = "postgres"
$databaseName = "user_db"

$running = docker inspect -f "{{.State.Running}}" $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $running -ne "true") {
    throw "PostgreSQL container '$containerName' is not running. Run: docker compose up -d postgres"
}

$sql = @"
BEGIN;

ALTER TABLE public.employee
    DROP CONSTRAINT IF EXISTS employee_department_check;
ALTER TABLE public.employee
    ADD CONSTRAINT employee_department_check CHECK (
        department IS NULL OR department IN (
            'GENERAL_OPERATIONS',
            'BOX_OFFICE',
            'FOOD_BEVERAGE',
            'FLOOR_GUEST_SERVICES',
            'PROJECTION_TECHNICAL',
            'FACILITIES_MAINTENANCE',
            'CONTENT_PROGRAMMING',
            'CONCESSION',
            'FLOOR',
            'PROJECTION',
            'CUSTOMER_SERVICE',
            'MANAGEMENT'
        )
    );

ALTER TABLE public.employee
    DROP CONSTRAINT IF EXISTS employee_position_check;
ALTER TABLE public.employee
    ADD CONSTRAINT employee_position_check CHECK (
        position IS NULL OR position IN (
            'TEAM_MEMBER',
            'SUPERVISOR',
            'ASSISTANT_MANAGER',
            'CINEMA_MANAGER',
            'PROGRAMMING_OPERATOR',
            'STAFF',
            'MANAGER'
        )
    );

ALTER TABLE public.employee
    DROP CONSTRAINT IF EXISTS employee_employment_type_check;
ALTER TABLE public.employee
    ADD CONSTRAINT employee_employment_type_check CHECK (
        employment_type IS NULL OR employment_type IN (
            'FULL_TIME',
            'PART_TIME',
            'FIXED_TERM',
            'SEASONAL',
            'PROBATION',
            'INTERN',
            'CONTRACT'
        )
    );

COMMIT;
"@

$sql | docker exec -i $containerName psql -U postgres -d $databaseName -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
    throw "Could not migrate employee classification constraints in '$databaseName'."
}

Write-Host "Updated employee classification constraints in $databaseName."
