/* ============================================
   FILE: index.js
   PATH: bridge/index.js
   VERSION: 2.5.3
   DESCRIPTION: Main entry — config load, Excel watcher, webapp API sync loop, graceful shutdown. Added /api/bridge/ping on sync loop.
                Excel → Webapp → Obsidian. Webapp is the source of truth for Obsidian sync.
   ============================================ */

const chokidar = require('chokidar');
const path = require('path');
const config = require('./config');
const parser = require('./parser');
const obsidian = require('./obsidian');
const api = require('./api');
const tray = require('./tray');

const POLL_INTERVAL_MS = 30000; // 30s
let _watcher = null;
let _syncTimer = null;
let _isRunning = false;
let _lastExcelPath = null;

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  HALQ Bridge v2.2.4                                  ║');
  console.log('║  Excel → Webapp → Obsidian Sync                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

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

  _isRunning = true;
  console.log('[MAIN] Bridge is running. Press Ctrl+C to exit.');
  console.log('');

  // Graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
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
    if (val === undefined) continue; // skip undefined entirely
    out[key] = val === null ? '' : val;
  }
  return out;
}

async function _processExcel(filePath) {
  _lastExcelPath = filePath;
  const cfg = config.get();

  try {
    // Parse Excel
    console.log('[PROCESS] Starting Excel parse...');
    const parsed = parser.parseFile(filePath);
    console.log('[PROCESS] Parse complete. Active: ' + parsed.active.length + ', Closed: ' + parsed.closed.length);

    // Sanitize payload — ensure no undefined values
    const activeWos = parsed.active.map(_sanitizePayload);
    const closedWos = parsed.closed.map(_sanitizePayload);

    // Upload to HALQ API
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

    // 4. Fetch from Webapp (source of truth) and sync to Obsidian
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

    // Resolve category IDs → names
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
    // Sync from webapp (source of truth) — NOT from Excel
    await _syncToObsidian(cfg.vaultPath);
    // Ping HALQ webapp so it knows Bridge is alive
    await api.apiPost('/bridge/ping', {});
  } catch (e) {
    // Silent fail on poll — API may be down
  }
}

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

  tray.stopTray();

  // Clean up temp files
  const fs = require('fs');
  const tmpFiles = ['.tray.ps1', '.tray-status.json', '.tray-icon.ico'];
  tmpFiles.forEach(f => {
    try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {}
  });

  console.log('[MAIN] Goodbye.');
  console.log('');
  process.exit(0);
}

// Run
main().catch(err => {
  console.error('[MAIN] Fatal error:', err);
  tray.setStatus('error', 'Fatal: ' + err.message);
  process.exit(1);
});