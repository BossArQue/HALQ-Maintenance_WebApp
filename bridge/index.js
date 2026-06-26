/* ============================================
   FILE: index.js
   PATH: bridge/index.js
   VERSION: 2.6.0
   DESCRIPTION: Main entry — config load, Excel watcher, webapp API sync loop, graceful shutdown,
                HTTP control server, Windows startup registration. Excel → Webapp → Obsidian.
   ============================================ */

const chokidar = require('chokidar');
const path = require('path');
const http = require('http');
const config = require('./config');
const parser = require('./parser');
const obsidian = require('./obsidian');
const api = require('./api');
const tray = require('./tray');

const POLL_INTERVAL_MS = 30000; // 30s
const CONTROL_PORT = 9876;
let _watcher = null;
let _syncTimer = null;
let _isRunning = false;
let _lastExcelPath = null;
let _controlServer = null;

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  HALQ Bridge v2.6.0                                  ║');
  console.log('║  Excel → Webapp → Obsidian Sync                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // CLI flags
  const args = process.argv.slice(2);
  if (args.includes('--register-startup')) {
    registerWindowsStartup();
    return;
  }
  if (args.includes('--unregister-startup')) {
    unregisterWindowsStartup();
    return;
  }

  // Load config
  const cfg = await config.load(process.env.HALQ_API_URL);
  if (!cfg) {
    const newCfg = await config.promptSetup();
    if (!newCfg) {
      console.error('Setup cancelled. Exiting.');
      process.exit(1);
    }
    api.setBaseUrl(newCfg.apiBaseUrl);
  } else {
    api.setBaseUrl(cfg.apiBaseUrl || cfg.apiUrl || 'http://localhost:8787');
    console.log('[MAIN] Config loaded from HALQ API');
    console.log('       Excel:', cfg.excelPath);
    console.log('       Vault:', cfg.vaultPath);
    console.log('       API:  ', cfg.apiBaseUrl || cfg.apiUrl);
  }

  const currentCfg = config.get();
  const errors = config.validate(currentCfg);
  if (errors.length) {
    console.error('Config validation failed:');
    errors.forEach(e => console.error('   •', e));
    process.exit(1);
  }

  // Set tray webapp URL
  tray.setWebappUrl(currentCfg.apiBaseUrl || currentCfg.apiUrl || 'http://localhost:8787');

  // Start tray
  tray.startTray();
  tray.setStatus('ready', 'HALQ Bridge ready');

  // Ensure Obsidian folders exist
  try {
    const cats = await api.apiGet('/categories');
    const tags = cats.ok ? (cats.data || []) : [];
    obsidian.ensureFolders(currentCfg.vaultPath, tags);
    console.log('[MAIN] Obsidian folders ensured');
  } catch (e) {
    console.log('[MAIN] Could not fetch categories for folder setup:', e.message);
  }

  // Find and parse initial Excel
  const excelFile = parser.findNewestExcel(currentCfg.excelPath);
  if (excelFile) {
    console.log('[MAIN] Initial Excel found:', path.basename(excelFile));
    await _processExcel(excelFile);
  } else {
    console.log('[MAIN] No Excel files found in:', currentCfg.excelPath);
  }

  // Start watcher
  _startWatcher(currentCfg.excelPath);

  // Start sync loop — polls webapp, NOT Excel
  _syncTimer = setInterval(() => _syncLoop(), POLL_INTERVAL_MS);

  // Start HTTP control server for webapp start/stop
  startControlServer();

  _isRunning = true;
  console.log('[MAIN] Bridge is running. Press Ctrl+C to exit.');
  console.log('');

  // Graceful shutdown + crash handlers
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', handleCrash);
  process.on('unhandledRejection', handleCrash);
}

function _startWatcher(watchPath) {
  const pattern = path.join(watchPath, '*.{xlsx,xlsm}');
  _watcher = chokidar.watch(pattern, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
  });

  _watcher
    .on('add', async (filePath) => {
      console.log('[WATCH] New file detected:', path.basename(filePath));
      tray.setStatus('syncing', 'Processing ' + path.basename(filePath));
      await _processExcel(filePath);
      tray.setStatus('ready', 'Sync complete');
    })
    .on('change', async (filePath) => {
      console.log('[WATCH] File changed:', path.basename(filePath));
      tray.setStatus('syncing', 'Processing ' + path.basename(filePath));
      await _processExcel(filePath);
      tray.setStatus('ready', 'Sync complete');
    })
    .on('error', (err) => {
      console.error('[WATCH] Error:', err);
      tray.setStatus('error', 'Watcher error: ' + err.message);
    });
}

// Sanitize WO object — remove undefined, convert null to empty string
function _sanitizePayload(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return obj;
  const out = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) continue;
    out[key] = val === null ? '' : val;
  }
  return out;
}

async function _processExcel(filePath) {
  _lastExcelPath = filePath;
  const cfg = config.get();

  try {
    console.log('[PROCESS] Starting Excel parse...');
    const parsed = parser.parseFile(filePath);
    console.log('[PROCESS] Parse complete. Active: ' + parsed.active.length + ', Closed: ' + parsed.closed.length);

    const activeWos = parsed.active.map(_sanitizePayload);
    const closedWos = parsed.closed.map(_sanitizePayload);

    console.log('[PROCESS] Preparing upload payload...');
    const uploadPayload = { 
      wos: activeWos, 
      closedWos: closedWos 
    };
    console.log('[PROCESS] Upload payload: ' + uploadPayload.wos.length + ' active, ' + uploadPayload.closedWos.length + ' closed');

    console.log('[PROCESS] Calling API /upload...');
    const uploadRes = await api.apiPost('/upload', uploadPayload);
    console.log('[PROCESS] API /upload responded');

    if (uploadRes.ok) {
      console.log('[API] Upload OK:', JSON.stringify(uploadRes.counts || uploadRes));
      tray.notify('HALQ Bridge', 'Uploaded ' + parsed.active.length + ' active, ' + parsed.closed.length + ' closed to HALQ');
    } else {
      console.error('[API] Upload failed:', uploadRes.error);
      tray.setStatus('error', 'Upload failed: ' + uploadRes.error);
      return;
    }

    console.log('[PROCESS] Fetching current WOs from Webapp...');
    await _syncToObsidian(cfg.vaultPath);

  } catch (err) {
    console.error('[PROCESS] Error:', err.message);
    console.error('[PROCESS] Stack:', err.stack);
    tray.setStatus('error', err.message);
    tray.notify('HALQ Bridge Error', err.message);
  }
}

async function _syncToObsidian(vaultPath) {
  try {
    const wosRes = await api.apiGet('/wos');
    const catsRes = await api.apiGet('/categories');

    if (!wosRes.ok || !wosRes.data) {
      console.log('[SYNC] No WOs from webapp, skipping Obsidian sync');
      return;
    }

    let catNames = {};
    if (catsRes.ok && catsRes.data) {
      catsRes.data.forEach(c => { catNames[String(c.id)] = c.name; });
    }

    const wos = wosRes.data;
    const resolvedTags = {};
    wos.forEach(wo => {
      const ids = (wo.category_ids || '[]');
      let catIds;
      try {
        catIds = JSON.parse(ids);
      } catch (e) {
        catIds = [];
      }
      resolvedTags[wo.wo_number] = catIds.map(id => catNames[String(id)] || id).filter(Boolean);
    });

    console.log('[SYNC] Syncing ' + wos.length + ' WOs to Obsidian');
    obsidian.syncWOs(vaultPath, wos, resolvedTags);
    console.log('[OBSIDIAN] Vault synced');
  } catch (e) {
    console.log('[SYNC] Obsidian sync failed:', e.message);
  }
}

async function _syncLoop() {
  const cfg = config.get();
  try {
    await _syncToObsidian(cfg.vaultPath);
    await api.apiPost('/bridge/ping', {});
  } catch (e) {
    // Silent fail on poll
  }
}

// ── HTTP Control Server ──
function startControlServer() {
  _controlServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running: _isRunning, lastExcelPath: _lastExcelPath }));
    } else if (req.url === '/stop' && req.method === 'POST') {
      if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
      _isRunning = false;
      tray.setStatus('stopped', 'Sync stopped');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } else if (req.url === '/start' && req.method === 'POST') {
      if (!_isRunning) {
        _syncTimer = setInterval(() => _syncLoop(), POLL_INTERVAL_MS);
        _isRunning = true;
      }
      tray.setStatus('ready', 'Sync running');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  _controlServer.listen(CONTROL_PORT, () => {
    console.log(`[CONTROL] Server on http://localhost:${CONTROL_PORT}`);
  });
}

// ── Windows Startup Registration ──
function registerWindowsStartup() {
  const { exec } = require('child_process');
  const shortcutPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'HALQ Bridge.lnk');
  const targetPath = process.argv[0];
  const args = `"${process.argv[1]}"`;
  const workDir = __dirname;

  const psCmd = `
    $WshShell = New-Object -ComObject WScript.Shell;
    $Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/\\/g, '\\\\')}');
    $Shortcut.TargetPath = '${targetPath.replace(/\\/g, '\\\\')}';
    $Shortcut.Arguments = '${args}';
    $Shortcut.WorkingDirectory = '${workDir.replace(/\\/g, '\\\\')}';
    $Shortcut.IconLocation = '${path.join(__dirname, '.tray-icon.ico').replace(/\\/g, '\\\\')}';
    $Shortcut.Save()
  `.trim();

  exec(`powershell -Command "${psCmd.replace(/"/g, '\\"')}"`, (err) => {
    if (err) {
      console.error('[STARTUP] Register failed:', err.message);
      process.exit(1);
    } else {
      console.log('[STARTUP] Registered for Windows startup');
      console.log('        Shortcut:', shortcutPath);
      process.exit(0);
    }
  });
}

function unregisterWindowsStartup() {
  const fs = require('fs');
  const shortcutPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'HALQ Bridge.lnk');
  try {
    fs.unlinkSync(shortcutPath);
    console.log('[STARTUP] Unregistered from Windows startup');
    process.exit(0);
  } catch (e) {
    console.error('[STARTUP] Unregister failed:', e.message);
    process.exit(1);
  }
}

// ── Graceful Shutdown ──
async function shutdown() {
  console.log('');
  console.log('[MAIN] Shutting down...');
  _isRunning = false;

  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
  }

  if (_watcher) {
    await _watcher.close();
    _watcher = null;
  }

  if (_controlServer) {
    _controlServer.close();
    _controlServer = null;
  }

  tray.stopTray();
  cleanupTempFiles();
  console.log('[MAIN] Goodbye.');
  console.log('');
  process.exit(0);
}

function handleCrash(err) {
  console.error('[MAIN] Fatal error:', err);
  _isRunning = false;
  if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
  if (_watcher) { _watcher.close(); _watcher = null; }
  if (_controlServer) { _controlServer.close(); _controlServer = null; }
  tray.stopTray();
  cleanupTempFiles();
  process.exit(1);
}

function cleanupTempFiles() {
  const fs = require('fs');
  const tmpFiles = ['.tray.ps1', '.tray-status.json', '.tray-icon.ico'];
  tmpFiles.forEach(f => {
    try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {}
  });
}

// Run
main().catch(err => {
  console.error('[MAIN] Fatal error:', err);
  tray.setStatus('error', 'Fatal: ' + err.message);
  process.exit(1);
});
