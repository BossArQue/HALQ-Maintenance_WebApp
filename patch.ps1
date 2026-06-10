# HALQ Quick Patch — repacks app.asar without full rebuild
# Usage: .\patch.ps1 -InstallPath "D:\OneDrive\DEEH\Project\HALQ\resources"

param(
    [string]$InstallPath = "D:\OneDrive\DEEH\Project\HALQ\resources"
)

$SourcePath = "$PSScriptRoot\src"
$appAsar    = Join-Path $InstallPath "app.asar"
$tempDir    = Join-Path $InstallPath "app_src"

# Verify asar CLI
$asar = Get-Command asar -ErrorAction SilentlyContinue
if (-not $asar) {
    Write-Host "asar not found. Install: npm install -g @electron/asar" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $appAsar)) {
    Write-Host "app.asar not found at: $appAsar" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "Extracting app.asar..." -ForegroundColor Cyan
    asar extract $appAsar $tempDir

    Write-Host "Copying updated source files..." -ForegroundColor Cyan
    Copy-Item "$SourcePath\index.html"          "$tempDir\index.html"          -Force
    Copy-Item "$SourcePath\main.js"             "$tempDir\main.js"             -Force
    Copy-Item "$SourcePath\preload.js"          "$tempDir\preload.js"          -Force
    Copy-Item "$SourcePath\launcher\index.html"  "$tempDir\launcher\index.html"  -Force
    Copy-Item "$SourcePath\launcher\preload.js" "$tempDir\launcher\preload.js" -Force

    Write-Host "Repacking app.asar..." -ForegroundColor Cyan
    asar pack $tempDir $appAsar

    Write-Host "`nPatch complete!" -ForegroundColor Green
} finally {
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir
        Write-Host "Cleaned up temp files." -ForegroundColor DarkGray
    }
}
