param(
    [string]$CdnHosts,
    [string]$CallbackHosts,
    [string]$AuthToken,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$configRoot = Join-Path $env:LOCALAPPDATA "Seele\3dsMaxReceiver"
$configPath = Join-Path $configRoot "config.json"

function ConvertTo-HostList([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return @()
    }
    $result = @()
    foreach ($item in ($Value -split '[,;\s]+' | Where-Object { $_ })) {
        $hostName = $item.Trim().ToLowerInvariant().TrimEnd('.')
        if ($hostName.Contains('://')) {
            try {
                $hostName = ([Uri]$hostName).DnsSafeHost.ToLowerInvariant().TrimEnd('.')
            } catch {
                throw "Invalid host or URL: $item"
            }
        }
        if ($hostName -notmatch '^[a-z0-9.-]+$' -or $hostName.Contains('..')) {
            throw "Invalid host: $item"
        }
        $result += $hostName
    }
    return @($result | Select-Object -Unique)
}

function New-ReceiverToken {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    return [Convert]::ToBase64String($bytes)
}

$existing = $null
if (Test-Path -LiteralPath $configPath) {
    try {
        $existing = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    } catch {
        throw "Existing configuration is invalid JSON: $configPath"
    }
}

$currentCdn = if ($existing) { @($existing.allowedCdnHosts) -join ',' } else { '' }
$currentCallbacks = if ($existing) { @($existing.allowedCallbackHosts) -join ',' } else { '' }

if (-not $NonInteractive) {
    if ([string]::IsNullOrWhiteSpace($CdnHosts)) {
        $label = if ($currentCdn) { "CDN hosts, comma separated [$currentCdn]" } else { "CDN hosts, comma separated" }
        $entered = Read-Host $label
        $CdnHosts = if ([string]::IsNullOrWhiteSpace($entered)) { $currentCdn } else { $entered }
    }
    if ([string]::IsNullOrWhiteSpace($CallbackHosts)) {
        $label = if ($currentCallbacks) { "Server callback hosts, comma separated [$currentCallbacks]" } else { "Server callback hosts, comma separated (optional)" }
        $entered = Read-Host $label
        $CallbackHosts = if ([string]::IsNullOrWhiteSpace($entered)) { $currentCallbacks } else { $entered }
    }
    if ([string]::IsNullOrWhiteSpace($AuthToken) -and $existing -and $existing.authToken) {
        $regenerate = Read-Host "Generate a new receiver token? [y/N]"
        if ($regenerate -match '^[Yy]') {
            $AuthToken = New-ReceiverToken
        }
    }
}

if ([string]::IsNullOrWhiteSpace($AuthToken)) {
    $AuthToken = if ($existing -and $existing.authToken) { [string]$existing.authToken } else { New-ReceiverToken }
}

$cdnList = ConvertTo-HostList $CdnHosts
$callbackList = ConvertTo-HostList $CallbackHosts
$config = [ordered]@{
    host = '127.0.0.1'
    port = 9880
    authToken = $AuthToken
    allowedCdnHosts = @($cdnList)
    allowedCallbackHosts = @($callbackList)
    allowHttp = $false
    maxAssetBytes = 2147483648
    cacheQuotaBytes = 10737418240
    maxWorkers = 2
    queueCapacity = 32
    cacheTtlSeconds = 604800
}

New-Item -ItemType Directory -Path $configRoot -Force | Out-Null
$json = $config | ConvertTo-Json -Depth 4
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($configPath, $json, $utf8)
$connectionPath = Join-Path $configRoot "receiver-connection.txt"
$connectionText = "Receiver URL: http://127.0.0.1:9880`r`nBearer token: $AuthToken`r`n"
[System.IO.File]::WriteAllText($connectionPath, $connectionText, $utf8)

Write-Host ""
Write-Host "Configuration saved: $configPath"
Write-Host "Receiver token (copy this to the sending Server):"
Write-Host $AuthToken -ForegroundColor Yellow
Write-Host "Connection details saved: $connectionPath"
if ($cdnList.Count -eq 0) {
    Write-Warning "No CDN host is configured. The receiver will reject asset downloads until one is added."
}

