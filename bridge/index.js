/* ============================================
   FILE: index.js
   PATH: bridge/index.js
   VERSION: 2.2.0
   DESCRIPTION: Main entry — config load, file watcher, sync loop, graceful shutdown.
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
  console.log('║  HALQ Bridge v2.2.0                                ║');
  console.log('║  Excel Watcher + Obsidian Vault Sync               ║');
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
    console.error('❌ Config validation failed:');
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

  // Start sync loop
  _syncTimer = setInterval(() => _syncLoop(), POLL_INTERVAL_MS);

  _isRunning = true;
  console.log('[MAIN] Bridge is running. Press Ctrl+C to exit.\n');

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

async function _processExcel(filePath) {
  _lastExcelPath = filePath;
  const cfg = config.get();

  try {
    // Parse Excel
    const parsed = parser.parseFile(filePath);
    console.log(`[PARSE] Active: ${parsed.active.length}, Closed: ${parsed.closed.length}`);

    // Upload to HALQ API
    const uploadRes = await api.apiPost('/upload', { wos: parsed.all });
    if (uploadRes.ok) {
      console.log('[API] Upload OK:', JSON.stringify(uploadRes.counts || {}));
      tray.notify('HALQ Bridge', `Uploaded ${parsed.all.length} WOs to HALQ`);
    } else {
      console.error('[API] Upload failed:', uploadRes.error);
      tray.setStatus('error', 'Upload failed: ' + uploadRes.error);
      return;
    }

    // Fetch tags for Obsidian sync
    let tagsMap = {};
    try {
      const wosRes = await api.apiGet('/wos');
      if (wosRes.ok && wosRes.data) {
        wosRes.data.forEach(wo => {
          tagsMap[wo.wo_number] = (wo.category_ids || [])
            .map(id => String(id))
            .filter(Boolean);
        });
      }
    } catch (e) {
      console.log('[API] Could not fetch tags:', e.message);
    }

    // Sync to Obsidian
    obsidian.syncWOs(cfg.vaultPath, parsed, tagsMap);
    console.log('[OBSIDIAN] Vault synced');

  } catch (err) {
    console.error('[PROCESS] Error:', err.message);
    tray.setStatus('error', err.message);
    tray.notify('HALQ Bridge Error', err.message);
  }
}

async function _syncLoop() {
  if (!_lastExcelPath) return;
  // Re-process the last known Excel to catch tag changes from webapp
  const cfg = config.get();
  try {
    const parsed = parser.parseFile(_lastExcelPath);

    // Fetch latest tags from HALQ
    let tagsMap = {};
    try {
      const wosRes = await api.apiGet('/wos');
      if (wosRes.ok && wosRes.data) {
        wosRes.data.forEach(wo => {
          tagsMap[wo.wo_number] = (wo.category_ids || [])
            .map(id => String(id))
            .filter(Boolean);
        });
      }
    } catch (e) {
      return; // API down, skip this cycle
    }

    // Fetch category names
    let catNames = {};
    try {
      const catsRes = await api.apiGet('/categories');
      if (catsRes.ok && catsRes.data) {
        catsRes.data.forEach(c => { catNames[String(c.id)] = c.name; });
      }
    } catch (e) {}

    // Resolve tag IDs to names
    const resolvedTags = {};
    Object.entries(tagsMap).forEach(([woNum, ids]) => {
      resolvedTags[woNum] = ids.map(id => catNames[id] || id);
    });

    obsidian.syncWOs(cfg.vaultPath, parsed, resolvedTags);
  } catch (e) {
    // Silent fail on poll — file may be locked
  }
}

async function shutdown() {
  console.log('\n[MAIN] Shutting down...');
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

  console.log('[MAIN] Goodbye.\n');
  process.exit(0);
}

// Run
main().catch(err => {
  console.error('[MAIN] Fatal error:', err);
  tray.setStatus('error', 'Fatal: ' + err.message);
  process.exit(1);
});