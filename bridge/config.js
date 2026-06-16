/* ============================================
   FILE: config.js
   PATH: bridge/config.js
   VERSION: 2.2.2
   DESCRIPTION: Config manager — loads from HALQ API, validates, CLI setup dialog.
   ============================================ */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { apiGet, apiPost, setBaseUrl } = require('./api');

const CONFIG_KEY = 'bridge_config';
const LOCAL_CONFIG_PATH = path.join(__dirname, '.bridge-config.json');

let _config = null;

async function load(apiBaseUrl) {
  // Ensure base URL is set BEFORE any API call
  const targetUrl = apiBaseUrl || _config?.apiBaseUrl || _config?.apiUrl || 'http://localhost:8787';
  setBaseUrl(targetUrl);

  // Try HALQ API first
  try {
    const res = await apiGet('/settings', { key: CONFIG_KEY });
    if (res.ok && res.data?.value) {
      let val = res.data.value;
      if (typeof val === 'string') val = JSON.parse(val);
      _config = { 
        ...val, 
        apiBaseUrl: apiBaseUrl || val.apiBaseUrl || val.apiUrl || targetUrl
      };
      _saveLocal();
      return _config;
    }
  } catch (e) {
    console.log('[CONFIG] API load failed, trying local cache:', e.message);
  }

  // Fallback to local cache
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
      _config = JSON.parse(raw);
      _config.apiBaseUrl = apiBaseUrl || _config.apiBaseUrl || _config.apiUrl || targetUrl;
      setBaseUrl(_config.apiBaseUrl);
      return _config;
    } catch (e) {
      console.log('[CONFIG] Local cache corrupt');
    }
  }

  return null;
}

async function save(config) {
  _config = { ...config };
  _saveLocal();

  // Push to HALQ API — FIX 4: use consistent key names
  try {
    const payload = {
      excelPath: config.excelPath || '',
      vaultPath: config.vaultPath || '',
      apiBaseUrl: config.apiBaseUrl || config.apiUrl || ''  // FIX 4: consistent key
    };
    await apiPost('/settings', { key: CONFIG_KEY, value: payload });
    console.log('[CONFIG] Saved to HALQ API');
  } catch (e) {
    console.log('[CONFIG] API save failed (cached locally):', e.message);
  }
  return _config;
}

function _saveLocal() {
  try {
    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(_config, null, 2));
  } catch (e) {
    console.log('[CONFIG] Local cache write failed:', e.message);
  }
}

function get() {
  return _config;
}

function validate(cfg) {
  const errors = [];
  if (!cfg.excelPath || !fs.existsSync(cfg.excelPath)) {
    errors.push('Excel watch path does not exist: ' + (cfg.excelPath || '(empty)'));
  }
  if (!cfg.vaultPath || !fs.existsSync(cfg.vaultPath)) {
    errors.push('Obsidian vault path does not exist: ' + (cfg.vaultPath || '(empty)'));
  }
  if (!cfg.apiUrl && !cfg.apiBaseUrl) {
    errors.push('HALQ API URL is required');
  }
  return errors;
}

async function promptSetup() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  HALQ Bridge — First-Time Setup                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const apiUrl = await ask('HALQ API base URL [http://localhost:8787]: ');
  const excelPath = await ask('Excel watch folder path: ');
  const vaultPath = await ask('Obsidian vault path: ');

  rl.close();

  const cfg = {
    apiBaseUrl: apiUrl.trim() || 'http://localhost:8787',
    excelPath: excelPath.trim(),
    vaultPath: vaultPath.trim()
  };

  const errors = validate(cfg);
  if (errors.length) {
    console.log('\n❌ Validation errors:');
    errors.forEach(e => console.log('   • ' + e));
    return null;
  }

  setBaseUrl(cfg.apiBaseUrl);
  await save(cfg);
  console.log('\n✅ Config saved. Starting Bridge...\n');
  return cfg;
}

module.exports = { load, save, get, validate, promptSetup };