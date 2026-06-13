// =====================
// HALQ APP — Shell Bootstrap & Global Utilities
// =====================

window.HALQ = {
  app: {
    init,
    switchView,
    settings: { load: loadAppSettings, save: saveAppSettings },
    utils: {
      fmtDate, fmtDateISO, nextBizDay, nextNextBizDay, getNextFriday,
      getWeekStart, calendarAgeToBizDays, skipWeekend, escapeHtml,
      showDebug, showErrorDialog, showFieldStatus
    }
  },
  wo: {},
  af: {},
  email: {},
  notes: {},
  messages: {},
  settings: {}
};

let _navMode = 'sidebar';
let _currentView = 'wo';

// =====================
// INIT
// =====================
function init() {
  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Resizable divider for WO panel
  const woPanel = document.querySelector('.wo-panel');
  const afPanel = document.querySelector('.af-panel');
  if (woPanel && afPanel) initResizeDivider('wo-resize-divider', woPanel, afPanel, 'v');

  // Wait for IPC then bootstrap
  waitForHalq(() => {
    console.log('[HALQ] window.halq ready');
    window.halq.onNewTab(url => HALQ.af.tabs.add(url));

    // Load all data
    HALQ.wo.categories.load();
    loadProfileInfo();
    loadAppSettings();
    checkStartupRequirements();
    setTimeout(checkForUpdate, 3000);
  }, 40);

  // Drag/drop prevent default
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => e.preventDefault());
}

function waitForHalq(fn, attempts) {
  if (window.halq) { fn(); return; }
  if (attempts <= 0) { console.error('[HALQ] window.halq never available'); return; }
  setTimeout(() => waitForHalq(fn, attempts - 1), 50);
}

// =====================
// VIEW ROUTER
// =====================
function switchView(view) {
  _currentView = view;
  const isNotes = view === 'notes';
  const isEmail = view === 'email';
  const isWO = view === 'wo';

  document.getElementById('panel-layout').style.display = isWO ? 'flex' : 'none';
  document.getElementById('email-panel').style.display = isEmail ? 'flex' : 'none';
  document.getElementById('notes-panel').style.display = isNotes ? 'flex' : 'none';

  const meta = { wo: { title: 'Work Orders', icon: '📋' },
    email: { title: 'Email', icon: '✉' },
    notes: { title: 'Notes', icon: '📝' } };
  const m = meta[view] || meta.wo;

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = m.title;

  const actionsEl = document.getElementById('topbar-actions');
  if (actionsEl) {
    if (isWO) actionsEl.innerHTML = `<button class="btn btn-primary" onclick="HALQ.af.navReload()">↻ Refresh</button>`;
    else if (isEmail) actionsEl.innerHTML = `<button class="btn btn-ghost" onclick="HALQ.email.refresh()" title="Reload folders">↻ Refresh</button>`;
    else actionsEl.innerHTML = '';
  }

  // Nav active states
  ['wo','email','notes'].forEach(v => {
    document.getElementById('nav-' + v)?.classList.toggle('active', v === view);
    document.getElementById('topnav-' + v)?.classList.toggle('active', v === view);
    document.getElementById('sectab-' + v)?.classList.toggle('active', v === view);
    document.getElementById('tb-nav-' + v)?.classList.toggle('active', v === view);
  });

  if (isNotes) HALQ.notes.renderInPanel?.();
  if (isEmail) HALQ.email.init?.();
}

// =====================
// NAVIGATION STYLE
// =====================
function toggleNav(mode) {
  document.getElementById('sidebar').className = 'sidebar hidden';
  document.getElementById('top-nav').classList.remove('visible');
  document.getElementById('section-tabs').classList.remove('visible');

  if (mode === 'sidebar') document.getElementById('sidebar').className = 'sidebar';
  else if (mode === 'topnav') document.getElementById('top-nav').classList.add('visible');
  else if (mode === 'tabs') document.getElementById('section-tabs').classList.add('visible');

  document.body.classList.toggle('nav-compact', mode === 'topnav' || mode === 'tabs');
  _navMode = mode;
}

function setNavOpt(mode, el) {
  el.parentElement.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  _navMode = mode;
  if (mode === 'none') {
    document.getElementById('sidebar').className = 'sidebar hidden';
    document.getElementById('top-nav').classList.remove('visible');
    document.getElementById('section-tabs').classList.remove('visible');
    document.body.classList.remove('nav-compact');
  } else {
    toggleNav(mode);
  }
  window.halq.settingsSave({ navStyle: mode }).catch(() => {});
}

// =====================
// LAYOUT
// =====================
function setLayoutOpt(mode, el) {
  el.parentElement.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  const pl = document.getElementById('panel-layout');
  pl.className = 'panel-layout' + (mode === 'vertical' ? ' vertical' : '');
  window.halq.settingsSave({ layoutMode: mode }).catch(() => {});
}

// =====================
// THEME
// =====================
function setTheme(theme, el) {
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  window.halq.settingsSave({ theme }).catch(() => {});
}

// =====================
// FONT
// =====================
function _applyFont(fontName, size) {
  const stack = fontName === 'system-ui' ? 'system-ui, sans-serif'
    : fontName === 'Georgia' ? 'Georgia, serif'
    : fontName === 'Courier New' ? "'Courier New', monospace"
    : `'${fontName}', sans-serif`;
  document.documentElement.style.setProperty('--app-font', stack);
  if (size) document.documentElement.style.setProperty('--app-font-size', size + 'px');
}

function setAppFont(fontName, el) {
  document.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  _applyFont(fontName);
  window.halq.settingsSave({ appFont: fontName }).catch(() => {});
}

function setAppFontSize(size) {
  size = parseInt(size);
  document.documentElement.style.setProperty('--app-font-size', size + 'px');
  const valEl = document.getElementById('font-size-val');
  if (valEl) valEl.textContent = size + 'px';
  window.halq.settingsSave({ appFontSize: size }).catch(() => {});
}

// =====================
// RESIZABLE DIVIDERS
// =====================
function initResizeDivider(dividerId, prevEl, nextEl, dir) {
  const divider = document.getElementById(dividerId);
  if (!divider) return;
  let dragging = false, startPos = 0, startSizePrev = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startPos = dir === 'h' ? e.clientY : e.clientX;
    startSizePrev = dir === 'h' ? prevEl.offsetHeight : prevEl.offsetWidth;
    divider.classList.add('dragging');
    document.body.style.cursor = dir === 'h' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = (dir === 'h' ? e.clientY : e.clientX) - startPos;
    const newSize = Math.max(120, startSizePrev + delta);
    if (dir === 'h') prevEl.style.height = newSize + 'px';
    else prevEl.style.width = newSize + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// =====================
// SETTINGS LOAD/SAVE
// =====================
async function loadAppSettings() {
  try {
    const result = await window.halq.settingsLoad();
    if (!result.ok) return;
    const s = result.settings || {};

    if (s.excelPath) document.getElementById('excel-path-input').value = s.excelPath;
    if (s.navStyle) { _navMode = s.navStyle; toggleNav(s.navStyle); }
    if (s.colorCodeWOs === false) document.getElementById('pref-color-code')?.classList.remove('on');
    if (s.autoSearch === false) document.getElementById('pref-auto-search')?.classList.remove('on');
    if (s.showBottomBar === false) {
      document.getElementById('pref-bottom-bar')?.classList.remove('on');
      document.querySelector('.bottombar').style.display = 'none';
    }
    if (s.theme) {
      document.body.setAttribute('data-theme', s.theme);
      document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${s.theme}'`));
      });
    }
    if (s.appFont) {
      _applyFont(s.appFont, s.appFontSize || 13);
      document.querySelectorAll('.font-option').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-font') === s.appFont);
      });
    }
    if (s.appFontSize) {
      const slider = document.getElementById('font-size-slider');
      const valEl = document.getElementById('font-size-val');
      if (slider) slider.value = s.appFontSize;
      if (valEl) valEl.textContent = s.appFontSize + 'px';
      document.documentElement.style.setProperty('--app-font-size', s.appFontSize + 'px');
    }
    if (s.layoutMode) {
      const pl = document.getElementById('panel-layout');
      pl.className = 'panel-layout' + (s.layoutMode === 'vertical' ? ' vertical' : '');
    }
  } catch (e) { console.error('[SETTINGS] load error:', e); }
}

async function saveAppSettings(data) {
  try { await window.halq.settingsSave(data); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
}

// =====================
// PREFERENCES
// =====================
async function togglePref(el, key) {
  el.classList.toggle('on');
  const val = el.classList.contains('on');
  await window.halq.settingsSave({ [key]: val });
  if (key === 'showBottomBar') document.querySelector('.bottombar').style.display = val ? '' : 'none';
  if (key === 'colorCodeWOs') HALQ.wo.renderList?.();
}

// =====================
// CLOCK
// =====================
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// =====================
// PROFILE INFO
// =====================
async function loadProfileInfo() {
  try {
    const info = await window.halq.profileInfo();
    const badge = document.getElementById('profile-badge');
    if (!info.ok || info.id === 'default') return;
    if (badge) {
      const color = info.color || 'var(--accent)';
      badge.textContent = info.name;
      badge.style.background = color + '22';
      badge.style.border = `1px solid ${color}55`;
      badge.style.color = color;
      badge.style.display = '';
    }
  } catch (e) { console.warn('[PROFILE] info load failed:', e); }
}

// =====================
// STARTUP CHECKS
// =====================
async function checkStartupRequirements() {
  try {
    const creds = await window.halq.credsLoad();
    if (!creds.ok || !creds.email) { showSetupPrompt('appfolio'); return; }
    const settings = await window.halq.settingsLoad();
    if (!settings.ok || !settings.settings?.excelPath) { showSetupPrompt('excel'); }
  } catch (e) { console.error('[STARTUP] check error:', e); }
}

async function showSetupPrompt(type) {
  await new Promise(r => setTimeout(r, 600));
  const overlay = document.getElementById('settings-overlay');
  if (overlay.classList.contains('open')) return;
  overlay.classList.add('open');
  if (type === 'excel') {
    HALQ.settings.switchTab?.('accounts');
    showDebug('⚠ Excel file path not set — configure in Settings → Accounts');
  } else if (type === 'appfolio') {
    HALQ.settings.switchTab?.('accounts');
    showDebug('⚠ Appfolio credentials not saved — configure in Settings → Accounts');
  }
}

// =====================
// AUTO-UPDATER
// =====================
let _pendingAsarUrl = null;

async function checkForUpdate() {
  try {
    const ver = await window.halq.updateVersion();
    document.getElementById('app-version-label').textContent = 'v' + ver;
    document.getElementById('bb-version').textContent = 'v' + ver;

    const result = await window.halq.updateCheck();
    if (!result.available) return;
    _pendingAsarUrl = result.asarUrl;
    document.getElementById('update-version-label').textContent = 'v' + result.version;
    document.getElementById('update-banner-msg').textContent = result.notes ? ` — ${result.notes}` : ' is available';
    document.getElementById('update-banner').classList.add('visible');
  } catch (e) { console.warn('[UPDATE] check failed:', e); }
}

async function updateInstall() {
  if (!_pendingAsarUrl) return;
  const btn = document.getElementById('update-install-btn');
  const progress = document.getElementById('update-progress');
  btn.style.display = 'none'; progress.style.display = '';
  try {
    const result = await window.halq.updateDownload(_pendingAsarUrl);
    if (!result.ok) { progress.textContent = '✗ Download failed: ' + result.error; btn.style.display = ''; return; }
    progress.textContent = '✓ Done — restarting…';
    setTimeout(() => window.halq.updateRestart(), 1200);
  } catch (e) { progress.textContent = '✗ Error: ' + e.message; btn.style.display = ''; }
}

function updateDismiss() {
  document.getElementById('update-banner').classList.remove('visible');
}

// =====================
// MENU BAR
// =====================
function toggleMenuBar(el) {
  el.classList.toggle('on');
  window.halq.toggleMenuBar(el.classList.contains('on'));
}

// =====================
// UTILITIES
// =====================
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateISO(d) {
  return d.toISOString().split('T')[0];
}

function skipWeekend(d) {
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

function nextBizDay(d) {
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return skipWeekend(next);
}

function nextNextBizDay(d) {
  return nextBizDay(nextBizDay(d));
}

function getNextFriday(fromDate, weeksAhead) {
  const d = new Date(fromDate);
  const day = d.getDay();
  let diff = 5 - day;
  if (diff <= 0) diff += 7;
  diff += (weeksAhead || 0) * 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekStart(d) {
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const mon = new Date(day);
  mon.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return mon;
}

function calendarAgeToBizDays(calendarAge) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const created = new Date(today); created.setDate(today.getDate() - calendarAge);
  let bizDays = 0;
  const cursor = new Date(created);
  while (cursor < today) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) bizDays++;
  }
  return bizDays;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showDebug(msg) {
  console.log('[HALQ]', msg);
  let bar = document.getElementById('autofill-debug');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'autofill-debug';
    bar.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#5b9cf6;font-size:11px;font-family:monospace;padding:4px 14px;border-radius:6px;border:1px solid #5b9cf6;z-index:9999;pointer-events:none;';
    document.body.appendChild(bar);
  }
  bar.textContent = '[HALQ] ' + msg;
  clearTimeout(bar._t);
  bar._t = setTimeout(() => bar.remove(), 6000);
}

function showErrorDialog(title, message) {
  const existing = document.getElementById('halq-error-dialog');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'halq-error-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--red);border-radius:10px;padding:20px 24px;width:480px;max-width:90vw;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:var(--red);font-weight:600;font-size:13px">✗ ${title}</span>
        <span onclick="document.getElementById('halq-error-dialog').remove()" style="cursor:pointer;color:var(--text3);font-size:16px;line-height:1">✕</span>
      </div>
      <textarea readonly style="background:var(--surface2);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:monospace;font-size:11px;padding:10px;width:100%;height:120px;resize:none;outline:none;user-select:text">${message}</textarea>
      <div style="font-size:10px;color:var(--text3)">Click inside and Ctrl+A, then Ctrl+C</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="navigator.clipboard.writeText('${message.replace(/'/g, "\'")}').then(()=>this.textContent='✓ Copied')" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Copy</button>
        <button onclick="document.getElementById('halq-error-dialog').remove()" style="background:var(--red);border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => { const ta = overlay.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } }, 50);
}

function showFieldStatus(el, msg, ok) {
  el.textContent = msg;
  el.className = 'creds-status ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.className = 'creds-status'; }, 3500);
}

// =====================
// NAMESPACE REGISTRATIONS (stubs — filled by feature modules)
// =====================
window.HALQ = window.HALQ || {}

// Category module stub (filled by settings.js)
HALQ.cat = HALQ.cat || {
  list: [],
  getById: (id) => HALQ.cat.list.find(c => c.id === id) || null
}

// Category manager stub (filled by settings.js)
HALQ.catMgr = HALQ.catMgr || { open: () => {} }

// Message module stub (filled by messages.js)
HALQ.msg = HALQ.msg || { templates: {}, ctxSend: () => {} }

// WO tags global
HALQ.woTags = HALQ.woTags || {}

// Auto-fill stub (filled by app.js or af-panel.js)
HALQ.autoFill = HALQ.autoFill || { tryFill: () => {} }

// Excel loader stub (filled by app.js)
HALQ.excel = HALQ.excel || { loadData: () => Promise.resolve() }

// Prompt date helper
HALQ.promptDate = HALQ.promptDate || function (label, callback) {
  const inp = document.createElement('input')
  inp.type = 'date'
  inp.style.cssText = 'width:100%;padding:7px;border:1px solid var(--border2);border-radius:6px;background:var(--surface2);color:var(--text);font-size:13px;outline:none'
  inp.onchange = () => {
    if (inp.value) { callback(inp.value); overlay.remove() }
  }
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center'
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:20px 22px;width:320px">
      <div style="font-weight:600;font-size:13px;color:var(--text);margin-bottom:10px">${label}</div>
    </div>
  `
  overlay.firstElementChild.appendChild(inp)
  const btns = document.createElement('div')
  btns.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end'
  btns.innerHTML = `<button style="background:none;border:1px solid var(--border2);color:var(--text2);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px" onclick="this.closest('.nt-prompt-overlay')?.remove()">Cancel</button>`
  overlay.firstElementChild.appendChild(btns)
  document.body.appendChild(overlay)
  setTimeout(() => { try { inp.showPicker() } catch (_) {}; inp.focus() }, 60)
}

// Close all dropdowns helper
HALQ.closeAllDropdowns = HALQ.closeAllDropdowns || function () {
  document.getElementById('followup-dropdown')?.classList.remove('open')
  document.getElementById('followup-custom-row')?.classList.remove('open')
  document.getElementById('cat-dropdown')?.classList.remove('open')
  document.getElementById('wo-filter-dropdown')?.classList.remove('open')
}

// Update search clear button visibility
HALQ.updateSearchClear = HALQ.updateSearchClear || function (input) {
  const btn = document.getElementById('wo-search-clear')
  if (btn) btn.classList.toggle('visible', input.value.length > 0)
}