# HALQ Patch Script
# Run this from your project folder:
#   D:\OneDrive\DEEH\Project\HALQ - Maintenance\
# It will update the installed app.asar with your latest source files

$installDir  = "D:\OneDrive\DEEH\Project\HALQ\resources"
$projectDir  = "D:\OneDrive\DEEH\Project\HALQ - Maintenance"
$asarPath    = "$installDir\app.asar"
$srcDir      = "$installDir\app_src"

Write-Host "=== HALQ Patcher ===" -ForegroundColor Cyan

# Step 1 — clean up any previous failed attempt
if (Test-Path $srcDir) {
    Write-Host "Cleaning up previous app_src..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $srcDir
}

# Step 2 — extract
Write-Host "Extracting app.asar..." -ForegroundColor Yellow
asar extract $asarPath $srcDir

# Step 3 — copy updated files
Write-Host "Copying updated files..." -ForegroundColor Yellow
Copy-Item "$projectDir\main.js"             -Destination "$srcDir\main.js"             -Force
Copy-Item "$projectDir\preload.js"          -Destination "$srcDir\preload.js"          -Force
Copy-Item "$projectDir\index.html"          -Destination "$srcDir\index.html"          -Force
Copy-Item "$projectDir\launcher_index.html"  -Destination "$srcDir\launcher\index.html" -Force
Copy-Item "$projectDir\launcher\preload.js" -Destination "$srcDir\launcher\preload.js" -Force

# Step 4 — repack
Write-Host "Repacking app.asar..." -ForegroundColor Yellow
asar pack $srcDir $asarPath

# Step 5 — cleanup
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $srcDir

Write-Host "=== Done! Launch HALQ to verify. ===" -ForegroundColor Green