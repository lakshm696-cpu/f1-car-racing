param(
    [switch]$Reconfigure
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Reconfigure) { $arguments += '-Reconfigure' }
    $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
    exit $process.ExitCode
}

$source = Join-Path $PSScriptRoot "SeeleReceiver.bundle"
$manifest = Join-Path $source "PackageContents.xml"
if (-not (Test-Path -LiteralPath $manifest)) {
    throw "Plugin payload is incomplete: $manifest"
}

$targetRoot = Join-Path $env:ProgramData "Autodesk\ApplicationPlugins"
$target = Join-Path $targetRoot "SeeleReceiver.bundle"
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
if (Test-Path -LiteralPath $target) {
    $backup = "$target.backup.$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
    Move-Item -LiteralPath $target -Destination $backup
    Write-Host "Previous plugin backed up: $backup"
}
Copy-Item -LiteralPath $source -Destination $target -Recurse
Write-Host "Plugin installed: $target"

$maxProfilesRoot = Join-Path $env:LOCALAPPDATA "Autodesk\3dsMax"
$startupTargets = @()
if (Test-Path -LiteralPath $maxProfilesRoot) {
    $versionProfiles = Get-ChildItem -LiteralPath $maxProfilesRoot -Directory | Where-Object { $_.Name -match '^20[0-9]{2} - 64bit$' }
    foreach ($versionProfile in $versionProfiles) {
        $languageProfiles = Get-ChildItem -LiteralPath $versionProfile.FullName -Directory | Where-Object { $_.Name -match '^[A-Za-z]{3}$' }
        foreach ($languageProfile in $languageProfiles) {
            $startupDirectory = Join-Path $languageProfile.FullName "scripts\startup"
            New-Item -ItemType Directory -Path $startupDirectory -Force | Out-Null
            $startupFile = Join-Path $startupDirectory "SeeleReceiverStartup.ms"
            Copy-Item -LiteralPath (Join-Path $PSScriptRoot "SeeleReceiverStartup.ms") -Destination $startupFile -Force
            $startupTargets += $startupFile
            Write-Host "3ds Max startup loader installed: $startupFile"
        }
    }
}
if ($startupTargets.Count -eq 0) {
    throw "No 3ds Max user profile was found under $maxProfilesRoot. Start 3ds Max once, close it, and run Install.cmd again."
}

$legacyTargets = @(
    (Join-Path $env:LOCALAPPDATA "Autodesk\ApplicationPlugins\SeeleReceiver"),
    (Join-Path $env:APPDATA "Autodesk\ApplicationPlugins\SeeleReceiver"),
    (Join-Path $env:APPDATA "Autodesk\ApplicationPlugins\SeeleReceiver.bundle")
)
foreach ($legacyTarget in $legacyTargets) {
    if (Test-Path -LiteralPath $legacyTarget) {
        Write-Warning "An older non-bundle copy exists and is ignored by 3ds Max: $legacyTarget"
        Write-Warning "It is safe to remove that older copy after this installation is verified."
    }
}

$configPath = Join-Path $env:LOCALAPPDATA "Seele\3dsMaxReceiver\config.json"
if ($Reconfigure -or -not (Test-Path -LiteralPath $configPath)) {
    $bundledConfig = Join-Path $PSScriptRoot "config.json"
    if (Test-Path -LiteralPath $bundledConfig) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $configPath) -Force | Out-Null
        Copy-Item -LiteralPath $bundledConfig -Destination $configPath -Force
        Write-Host "Bundled environment configuration installed: $configPath"
    } else {
        & (Join-Path $PSScriptRoot "Configure.ps1")
    }
} else {
    Write-Host "Existing configuration preserved: $configPath"
    Write-Host "Run Configure.cmd if you need to change it."
}

Write-Host ""
Write-Host "Installation complete. Restart 3ds Max, then open:"
Write-Host "http://127.0.0.1:9880/healthz"
