# HALQ Staging Cleanup — fix the messy git status
# Run this in VS Code terminal, then re-stage properly

$ErrorActionPreference = "Stop"
Write-Host "=== Cleaning Up Git Staging ===" -ForegroundColor Cyan

# ─── 1. UNSTAGE EVERYTHING ───
Write-Host "`n[1] Unstaging all files..." -ForegroundColor Yellow
git reset HEAD

# ─── 2. REMOVE JUNK FROM WORKING TREE ───
Write-Host "`n[2] Removing junk files from disk..." -ForegroundColor Yellow
$junk = @(
    "main-backup.js",
    "preload-backup.js",
    "index-backup.html",
    "filetree.txt",
    "restructure.ps1",
    "CODE RULES.txt",
    "links.txt",
    "version.json"
)
foreach ($file in $junk) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  [-] Deleted: $file" -ForegroundColor DarkGray
    }
}

# Also remove empty launcher folder if it somehow came back
if (Test-Path "launcher") {
    $remaining = Get-ChildItem "launcher" -Recurse -ErrorAction SilentlyContinue
    if (-not $remaining) {
        Remove-Item "launcher" -Force -Recurse
        Write-Host "  [-] Deleted empty: launcher/" -ForegroundColor DarkGray
    }
}

# ─── 3. VERIFY STRUCTURE ───
Write-Host "`n[3] Current working tree:" -ForegroundColor Cyan
Get-ChildItem | Where-Object { $_.Name -notmatch "^\.git$|^node_modules$" } | ForEach-Object {
    if ($_.PSIsContainer) {
        Write-Host "  $($_.Name)/" -ForegroundColor Blue
    } else {
        Write-Host "  $($_.Name)" -ForegroundColor White
    }
}

# ─── 4. STAGE CLEANLY ───
Write-Host "`n[4] Staging clean files..." -ForegroundColor Green
git add .

# ─── 5. VERIFY STAGING ───
Write-Host "`n[5] Git status:" -ForegroundColor Cyan
git status

Write-Host "`n=== DONE ===" -ForegroundColor Cyan
Write-Host "If status looks clean, run:" -ForegroundColor White
Write-Host "  git commit -m 'restructure: organize src/, remove artifacts, clean root'" -ForegroundColor Green
Write-Host "  git push" -ForegroundColor Green
