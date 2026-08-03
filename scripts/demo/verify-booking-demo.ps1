param(
    [string]$GatewayBaseUrl = "http://localhost:8080",
    [string]$FrontendBaseUrl = "http://localhost:3000",
    [string]$NgrokBaseUrl = "",
    [string]$BusinessDate = (Get-Date -Format "yyyy-MM-dd")
)

$ErrorActionPreference = "Stop"
$script:FailureCount = 0
$script:WarningCount = 0

function Write-Check {
    param(
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Level,
        [string]$Message
    )

    $color = switch ($Level) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
    }

    Write-Host ("[{0}] {1}" -f $Level, $Message) -ForegroundColor $color

    if ($Level -eq "FAIL") {
        $script:FailureCount++
    }
    elseif ($Level -eq "WARN") {
        $script:WarningCount++
    }
}

function Join-Url {
    param([string]$BaseUrl, [string]$Path)
    return $BaseUrl.TrimEnd("/") + "/" + $Path.TrimStart("/")
}

function Get-HttpStatus {
    param([string]$Uri)

    try {
        $response = Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing -TimeoutSec 10
        return [int]$response.StatusCode
    }
    catch {
        if ($null -ne $_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

Write-Host ""
Write-Host "CinePrime booking demo preflight" -ForegroundColor Cyan
Write-Host ("Business date: {0}" -f $BusinessDate)
Write-Host ""

try {
    $frontendStatus = Get-HttpStatus -Uri $FrontendBaseUrl
    if ($frontendStatus -ge 200 -and $frontendStatus -lt 400) {
        Write-Check "PASS" ("Frontend reachable at {0}." -f $FrontendBaseUrl)
    }
    else {
        Write-Check "FAIL" ("Frontend returned HTTP {0}." -f $frontendStatus)
    }
}
catch {
    Write-Check "FAIL" ("Frontend is unavailable: {0}" -f $_.Exception.Message)
}

$schedules = @()
try {
    $scheduleUrl = Join-Url $GatewayBaseUrl "/api/schedules"
    $scheduleEnvelope = Invoke-RestMethod -Uri $scheduleUrl -Method Get -TimeoutSec 15
    $schedules = @($scheduleEnvelope.result)

    if ($schedules.Count -eq 0) {
        Write-Check "FAIL" "Public schedule API returned no showtimes."
    }
    else {
        Write-Check "PASS" ("Public schedule API returned {0} showtimes." -f $schedules.Count)
    }

    $nonOnSale = @($schedules | Where-Object { $_.status -ne "ON_SALE" })
    if ($nonOnSale.Count -eq 0) {
        Write-Check "PASS" "Every public showtime is ON_SALE."
    }
    else {
        Write-Check "FAIL" ("Public API exposed {0} showtimes that are not ON_SALE." -f $nonOnSale.Count)
    }
}
catch {
    Write-Check "FAIL" ("Cannot load public schedules through API Gateway: {0}" -f $_.Exception.Message)
}

$candidate = $null
if ($schedules.Count -gt 0) {
    $futureCandidates = @(
        $schedules |
            Where-Object {
                $_.status -eq "ON_SALE" -and
                [string]$_.showDate -ge $BusinessDate -and
                [int]$_.availableSeats -gt 0
            } |
            Sort-Object showDate, startTime
    )

    if ($futureCandidates.Count -eq 0) {
        Write-Check "FAIL" ("No ON_SALE showtime with available inventory exists on or after {0}." -f $BusinessDate)
    }
    else {
        $preferred = @(
            $futureCandidates |
                Where-Object {
                    $_.movieName -eq "Obsession" -and
                    $_.clusterName -eq "CinePrime Landmark 81"
                }
        ) | Select-Object -First 1

        $candidate = if ($null -ne $preferred) {
            $preferred
        }
        else {
            $futureCandidates | Select-Object -First 1
        }

        Write-Check "PASS" (
            "Demo candidate: #{0}, {1}, {2} {3}, {4}, {5}, {6} seats reported available." -f
            $candidate.showTimeId,
            $candidate.movieName,
            $candidate.showDate,
            $candidate.startTime,
            $candidate.clusterName,
            $candidate.cinemaRoomName,
            $candidate.availableSeats
        )
    }
}

if ($null -ne $candidate) {
    try {
        $seatMapUrl = Join-Url $GatewayBaseUrl ("/api/showtimes/{0}/seat-map" -f $candidate.showTimeId)
        $seatMapEnvelope = Invoke-RestMethod -Uri $seatMapUrl -Method Get -TimeoutSec 15
        $seats = @($seatMapEnvelope.result.seats)

        if ($seats.Count -eq 0) {
            Write-Check "FAIL" "Seat map contains no materialized sellable seats."
        }
        else {
            Write-Check "PASS" ("Seat map contains {0} materialized sellable seats." -f $seats.Count)
        }

        $availableSeats = @($seats | Where-Object { $_.status -eq "AVAILABLE" })
        if ($availableSeats.Count -eq 0) {
            Write-Check "FAIL" "Seat map has no AVAILABLE seat for the demo."
        }
        else {
            Write-Check "PASS" ("Seat map has {0} AVAILABLE seats." -f $availableSeats.Count)
        }

        $invalidPrices = @(
            $seats |
                Where-Object {
                    $null -eq $_.price -or [decimal]$_.price -le 0
                }
        )
        if ($invalidPrices.Count -gt 0) {
            Write-Check "FAIL" ("{0} materialized seats have a missing or non-positive final price." -f $invalidPrices.Count)
        }
        elseif ($seats.Count -gt 0) {
            $prices = @($seats | ForEach-Object { [decimal]$_.price })
            $minimumPrice = ($prices | Measure-Object -Minimum).Minimum
            $maximumPrice = ($prices | Measure-Object -Maximum).Maximum
            Write-Check "PASS" ("Final seat price snapshots are valid ({0:N0} - {1:N0} VND)." -f $minimumPrice, $maximumPrice)
        }
    }
    catch {
        Write-Check "FAIL" ("Cannot load the candidate seat map: {0}" -f $_.Exception.Message)
    }
}

try {
    $policyUrl = Join-Url $GatewayBaseUrl "/api/showtimes/seat-hold-policy"
    $policyEnvelope = Invoke-RestMethod -Uri $policyUrl -Method Get -TimeoutSec 10
    $policy = $policyEnvelope.result
    $policyJson = $policy | ConvertTo-Json -Compress
    Write-Check "PASS" ("Seat-hold policy is reachable: {0}" -f $policyJson)
}
catch {
    Write-Check "FAIL" ("Seat-hold policy is unavailable: {0}" -f $_.Exception.Message)
}

if (-not [string]::IsNullOrWhiteSpace($NgrokBaseUrl)) {
    try {
        $ipnUrl = Join-Url $NgrokBaseUrl "/api/payments/vnpay/ipn"
        $ipnStatus = Get-HttpStatus -Uri $ipnUrl
        if ($ipnStatus -in @(404, 502, 503, 504)) {
            Write-Check "FAIL" ("Public VNPAY IPN route returned HTTP {0}: {1}" -f $ipnStatus, $ipnUrl)
        }
        else {
            Write-Check "PASS" ("Public VNPAY IPN route is reachable (HTTP {0})." -f $ipnStatus)
        }
    }
    catch {
        Write-Check "FAIL" ("Cannot reach the public VNPAY IPN route: {0}" -f $_.Exception.Message)
    }
}
else {
    Write-Check "WARN" "NgrokBaseUrl was not provided; public VNPAY callback routing was not checked."
}

Write-Check "WARN" "A signed VNPAY Sandbox payment round-trip is a mandatory manual rehearsal."

Write-Host ""
if ($script:FailureCount -gt 0) {
    Write-Host (
        "NOT READY - {0} blocking check(s), {1} warning(s)." -f
        $script:FailureCount,
        $script:WarningCount
    ) -ForegroundColor Red
    exit 1
}

Write-Host ("READY - 0 blocking checks, {0} warning(s)." -f $script:WarningCount) -ForegroundColor Green
exit 0
