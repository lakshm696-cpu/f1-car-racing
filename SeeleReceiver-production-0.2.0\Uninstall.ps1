$ErrorActionPreference = "Stop"
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"") -Wait -PassThru
    exit $process.ExitCode
}

$target = Join-Path $env:ProgramData "Autodesk\ApplicationPlugins\SeeleReceiver.bundle"
if (-not (Test-Path -LiteralPath $target)) {
    Write-Host "Seele Receiver is not installed."
    exit 0
}
$backup = "$target.removed.$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
Move-Item -LiteralPath $target -Destination $backup
Write-Host "Plugin disabled and moved to: $backup"
$maxProfilesRoot = Join-Path $env:LOCALAPPDATA "Autodesk\3dsMax"
if (Test-Path -LiteralPath $maxProfilesRoot) {
    Get-ChildItem -LiteralPath $maxProfilesRoot -Filter "SeeleReceiverStartup.ms" -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
        Write-Host "Removed startup loader: $($_.FullName)"
    }
}
Write-Host "Configuration and cache were preserved. Restart 3ds Max to finish."
