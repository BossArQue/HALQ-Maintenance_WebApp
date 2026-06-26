/* ============================================
   FILE: tray.js
   PATH: bridge/tray.js
   VERSION: 2.6.0
   DESCRIPTION: System tray icon, menu, status notifications for Windows. Dynamic webapp URL.
   ============================================ */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let _trayProcess = null;
let _status = 'idle';
let _lastMessage = 'HALQ Bridge ready';
let _webappUrl = 'http://localhost:8787';

function setWebappUrl(url) {
  _webappUrl = (url || 'http://localhost:8787').replace(/\/$/, '');
}

function startTray() {
  if (_trayProcess) return;

  const psScript = _buildTrayScript();
  const psPath = path.join(__dirname, '.tray.ps1');
  fs.writeFileSync(psPath, psScript, 'utf8');

  _trayProcess = spawn('powershell.exe', [
    '-WindowStyle', 'Hidden',
    '-ExecutionPolicy', 'Bypass',
    '-File', psPath
  ], { detached: true, stdio: 'ignore' });

  _trayProcess.on('error', (err) => {
    console.log('[TRAY] Tray process error:', err.message);
    _trayProcess = null;
  });

  console.log('[TRAY] System tray started');
}

function stopTray() {
  if (_trayProcess) {
    try { _trayProcess.kill(); } catch (e) {}
    _trayProcess = null;
  }
  console.log('[TRAY] System tray stopped');
}

function setStatus(status, message) {
  _status = status;
  _lastMessage = message || _lastMessage;

  const statusFile = path.join(__dirname, '.tray-status.json');
  try {
    fs.writeFileSync(statusFile, JSON.stringify({
      status: _status,
      message: _lastMessage,
      timestamp: Date.now()
    }), 'utf8');
  } catch (e) {}
}

function notify(title, message) {
  try {
    const notifier = require('node-notifier');
    notifier.notify({ title, message, sound: false });
  } catch (e) {
    spawn('powershell.exe', [
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; ` +
      `$n = New-Object System.Windows.Forms.NotifyIcon; ` +
      `$n.Icon = [System.Drawing.SystemIcons]::Information; ` +
      `$n.BalloonTipTitle = '${_escapePs(title)}'; ` +
      `$n.BalloonTipText = '${_escapePs(message)}'; ` +
      `$n.Visible = $true; ` +
      `$n.ShowBalloonTip(3000); ` +
      `Start-Sleep -Seconds 4; ` +
      `$n.Dispose()`
    ], { detached: true, stdio: 'ignore' });
  }
}

function _buildTrayScript() {
  const dirEsc = __dirname.replace(/\\/g, '\\\\');
  const statusFile = dirEsc + '\\.tray-status.json';
  const iconPath = dirEsc + '\\.tray-icon.ico';

  return `
# HALQ Bridge Tray
$statusFile = "${statusFile}"
$iconPath = "${iconPath}"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Create default icon if missing
if (-not (Test-Path $iconPath)) {
    $bmp = New-Object System.Drawing.Bitmap 16,16
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(30,30,30))
    $g.FillRectangle([System.Drawing.Brushes]::DodgerBlue, 4,4,8,8)
    $g.Dispose()
    $bmp.Save($iconPath)
    $bmp.Dispose()
}

$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($iconPath)
$n.Text = "HALQ Bridge"
$n.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.Items.Add("Status: Ready", $null, $null).Enabled = $false
$menu.Items.Add("-", $null, $null)
$openItem = $menu.Items.Add("Open HALQ WebApp", $null, {
    Start-Process "${_webappUrl}"
})
$menu.Items.Add("-", $null, $null)
$exitItem = $menu.Items.Add("Exit", $null, {
    $n.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$n.ContextMenuStrip = $menu

# Status polling
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({
    if (Test-Path $statusFile) {
        try {
            $s = Get-Content $statusFile -Raw | ConvertFrom-Json
            $n.Text = "HALQ Bridge — " + $s.message
            if ($s.status -eq "error") { $n.Icon = [System.Drawing.SystemIcons]::Error }
            elseif ($s.status -eq "syncing") { $n.Icon = [System.Drawing.SystemIcons]::Warning }
            else { $n.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($iconPath) }
        } catch {}
    }
})
$timer.Start()

[System.Windows.Forms.Application]::Run()
`.trim();
}

function _escapePs(str) {
  return String(str).replace(/'/g, "''").replace(/`/g, '``');
}

module.exports = { startTray, stopTray, setStatus, notify, setWebappUrl };
