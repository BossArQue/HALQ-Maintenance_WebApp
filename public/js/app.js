/* ============================================
   FILE: app.js
   PATH: public/js/app.js
   VERSION: 2.3.4
   DESCRIPTION: HALQ core namespace, API helpers, theme/font utilities, view router.
   ============================================ */

window.HALQ = {
  app: {
    init,
    switchView,
    setTheme,
    setAppFont,
    setAppFontSize,
    closeAllDropdowns,
    utils: {
      fmtDate, fmtDateISO, nextBizDay, nextNextBizDay, getNextFriday,
      getWeekStart, calendarAgeToBizDays, skipWeekend, escapeHtml,
      showDebug, showErrorDialog
    }
  },
  wo: {},
  af: {},
  email: {},
  notes: {},
  messages: {},
  settings: {},
  cat: { list: [], getById: (id) => HALQ.cat.list.find(c => c.id === id) || null },
  catMgr: { open: () => {} },
  msg: { templates: {}, ctxSend: () => {} },
  woTags: {}
};

const APP_VERSION = '2.3.4';
let _currentView = 'wo';
let _navMode = 'sidebar';

// =====================
// API HELPERS (v2 — Fetch API replaces window.halq IPC)
// =====================

async function apiGet(endpoint) {
  const res = await fetch(`/api${endpoint}`);
  return res.json();
}

async function apiPost(endpoint, body) {
  const res = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function apiPut(endpoint, body) {
  const res = await fetch(`/api${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const contentType = res.headers.get('content-type');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText || 'Unknown error'}`);
  }
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON, got: ${text.substring(0, 100)}`);
  }
  return res.json();
}

async function apiDelete(endpoint) {
  const res = await fetch(`/api${endpoint}`, { method: 'DELETE' });
  return res.json();
}

// Attach to namespace for module access
HALQ.apiGet = apiGet;
HALQ.apiPost = apiPost;
HALQ.apiPut = apiPut;
HALQ.apiDelete = apiDelete;

// =====================
// INIT
// =====================

function init() {
  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Version labels
  const verEls = document.querySelectorAll('#app-version-label, #bb-version');
  verEls.forEach(el => { if (el) el.textContent = 'v' + APP_VERSION; });

  // ── Auth: fetch user, wire logout ──
  (async function initAuth() {
    try {
      const res = await fetch('/api/auth?action=me', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.data?.authenticated) {
        const userDisplay = document.getElementById('user-display-name');
        if (userDisplay) userDisplay.textContent = data.data.username || 'User';
      } else {
        // Not authenticated — middleware will redirect, but this catches edge cases
        window.location.href = '/login.html';
        return;
      }
    } catch (e) {
      // If API is unreachable, let middleware handle it
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await fetch('/api/auth?action=logout', { method: 'POST', credentials: 'include' });
        } catch (e) {}
        window.location.href = '/login.html';
      });
    }
  })();

  // Attach nav events (no inline onclick)
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });

  // Settings button — delegate to settings.js if available
  const settingsBtn = document.getElementById('tb-nav-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (HALQ.settings && HALQ.settings.open) HALQ.settings.open();
      else {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.classList.add('open');
      }
    });
  }
  const sidebarSettingsBtn = document.getElementById('sidebar-nav-settings');
  if (sidebarSettingsBtn) {
    sidebarSettingsBtn.addEventListener('click', () => {
      if (HALQ.settings && HALQ.settings.open) HALQ.settings.open();
      else {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.classList.add('open');
      }
    });
  }

  // Load categories from API
  loadCategories().then(() => {
    // Bootstrap WO panel
    if (HALQ.wo.init) HALQ.wo.init();
  });

  // Drag/drop prevent default on body (upload handled by wo-panel)
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => e.preventDefault());

  // Global click to close dropdowns
  document.addEventListener('click', e => {
    if (!e.target.closest('.followup-dropdown') && !e.target.closest('.cat-dropdown') &&
        !e.target.closest('.wo-filter-dropdown') && !e.target.closest('#wo-ctx-menu')) {
      closeAllDropdowns();
    }
  });
}

// =====================
// VIEW ROUTER
// =====================

function switchView(view) {
  _currentView = view;
  const isNotes = view === 'notes';
  const isEmail = view === 'email';
  const isWO = view === 'wo';

  const pl = document.getElementById('panel-layout');
  const np = document.getElementById('notes-panel');
  const ep = document.getElementById('email-panel');
  if (pl) pl.style.display = isWO ? 'flex' : 'none';
  if (np) np.style.display = isNotes ? 'flex' : 'none';
  if (ep) ep.style.display = isEmail ? 'flex' : 'none';

  const meta = {
    wo: { title: 'Work Orders', icon: '📋' },
    email: { title: 'Email', icon: '✉' },
    notes: { title: 'Notes', icon: '📝' }
  };
  const m = meta[view] || meta.wo;

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = m.title;

  const actionsEl = document.getElementById('topbar-actions');
  if (actionsEl) {
    if (isWO) actionsEl.innerHTML = `<button class="btn btn-primary" id="btn-upload-excel">📤 Upload Excel</button>`;
    else if (isEmail) actionsEl.innerHTML = `<button class="btn btn-ghost" id="btn-open-outlook" title="Open Outlook">✉ Outlook</button>`;
    else actionsEl.innerHTML = '';

    // Re-attach listeners to new buttons
    const uploadBtn = document.getElementById('btn-upload-excel');
    if (uploadBtn) uploadBtn.addEventListener('click', () => HALQ.wo.uploadExcel?.());

    const outlookBtn = document.getElementById('btn-open-outlook');
    if (outlookBtn) outlookBtn.addEventListener('click', () => HALQ.email.openOutlook?.());
  }

  // Nav active states
  ['wo', 'email', 'notes'].forEach(v => {
    document.getElementById('nav-' + v)?.classList.toggle('active', v === view);
    document.getElementById('tb-nav-' + v)?.classList.toggle('active', v === view);
  });
  // Home nav uses 'wo' view
  const navHome = document.getElementById('nav-home');
  if (navHome) navHome.classList.toggle('active', view === 'wo');

  if (isNotes && HALQ.notes.renderInPanel) HALQ.notes.renderInPanel();
  if (isEmail && HALQ.email.init) HALQ.email.init();
}

// =====================
// CATEGORIES (v2 — Fetch API)
// =====================

async function loadCategories() {
  try {
    const result = await apiGet('/categories');
    if (result.ok && result.data) {
      HALQ.cat.list = result.data;
      console.log('[CAT] loaded', HALQ.cat.list.length, 'categories from API');
    }
  } catch (e) {
    console.error('[CAT] load error:', e);
    // Fallback to defaults if API fails (Phase 0 dev mode)
    HALQ.cat.list = [
      { id: 1, name: 'Follow-up', color: '#5b9cf6' },
      { id: 2, name: 'Urgent', color: '#ff453a' },
      { id: 3, name: 'Waiting on Vendor', color: '#ff9f0a' },
      { id: 4, name: 'Waiting on Tenant', color: '#34c759' },
      { id: 5, name: 'Waiting on Owner', color: '#bf5af2' },
      { id: 6, name: 'Inspection', color: '#00c7be' },
      { id: 7, name: 'Recurring', color: '#ffd93d' }
    ];
  }
}

// =====================
// THEME
// =====================

function setTheme(theme, el) {
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
  if (el) el.classList.add('active');
  // Persist to API (non-blocking)
  apiPost('/settings', { key: 'theme', value: theme }).catch(() => {});
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
  if (el) el.classList.add('active');
  _applyFont(fontName);
  apiPost('/settings', { key: 'appFont', value: fontName }).catch(() => {});
}

function setAppFontSize(size) {
  size = parseInt(size);
  document.documentElement.style.setProperty('--app-font-size', size + 'px');
  const valEl = document.getElementById('font-size-val');
  if (valEl) valEl.textContent = size + 'px';
  apiPost('/settings', { key: 'appFontSize', value: size }).catch(() => {});
}

// =====================
// LAYOUT
// =====================

function setLayoutOpt(mode, el) {
  if (el) {
    el.parentElement.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
  }
  const pl = document.getElementById('panel-layout');
  if (pl) pl.className = 'panel-layout' + (mode === 'vertical' ? ' vertical' : '');
  apiPost('/settings', { key: 'layoutMode', value: mode }).catch(() => {});
}

// =====================
// NAVIGATION STYLE
// =====================

function toggleNav(mode) {
  const sb = document.getElementById('sidebar');
  if (sb) sb.className = mode === 'sidebar' ? 'sidebar' : 'sidebar hidden';
  _navMode = mode;
}

function setNavOpt(mode, el) {
  if (el) {
    el.parentElement.querySelectorAll('.layout-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
  }
  toggleNav(mode);
  apiPost('/settings', { key: 'navStyle', value: mode }).catch(() => {});
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
// PREFERENCES
// =====================

async function togglePref(el, key) {
  el.classList.toggle('on');
  const val = el.classList.contains('on');
  apiPost('/settings', { key, value: val }).catch(() => {});
  if (key === 'showBottomBar') {
    const bb = document.querySelector('.bottombar');
    if (bb) bb.style.display = val ? '' : 'none';
  }
  if (key === 'colorCodeWOs' && HALQ.wo.renderList) HALQ.wo.renderList();
}

// =====================
// CLOCK
// =====================

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// =====================
// CLOSE ALL DROPDOWNS
// =====================

function closeAllDropdowns() {
  const ids = ['followup-dropdown', 'followup-custom-row', 'cat-dropdown', 'wo-filter-dropdown'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    // Clear inline positioning styles to prevent stale coords on next open
    el.style.top = '';
    el.style.left = '';
    el.style.right = '';
    el.style.bottom = '';
    el.style.width = '';
  });
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
        <span style="color:var(--red);font-weight:600;font-size:13px">✗ ${escapeHtml(title)}</span>
        <span id="err-dialog-close" style="cursor:pointer;color:var(--text3);font-size:16px;line-height:1">✕</span>
      </div>
      <textarea readonly style="background:var(--surface2);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:monospace;font-size:11px;padding:10px;width:100%;height:120px;resize:none;outline:none;user-select:text">${escapeHtml(message)}</textarea>
      <div style="font-size:10px;color:var(--text3)">Click inside and Ctrl+A, then Ctrl+C</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="err-dialog-copy" data-msg="${escapeHtml(message)}" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Copy</button>
        <button id="err-dialog-close-btn" style="background:var(--red);border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Attach listeners
  overlay.querySelector('#err-dialog-close')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#err-dialog-close-btn')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#err-dialog-copy')?.addEventListener('click', function() {
    navigator.clipboard.writeText(this.dataset.msg).then(() => this.textContent = '✓ Copied');
  });

  setTimeout(() => { const ta = overlay.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } }, 50);
}

// =====================
// PROMPT DATE HELPER
// =====================

HALQ.promptDate = function (label, callback) {
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.style.cssText = 'width:100%;padding:7px;border:1px solid var(--border2);border-radius:6px;background:var(--surface2);color:var(--text);font-size:13px;outline:none';
  inp.onchange = () => {
    if (inp.value) { callback(inp.value); overlay.remove(); }
  };
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:20px 22px;width:320px">
      <div style="font-weight:600;font-size:13px;color:var(--text);margin-bottom:10px">${escapeHtml(label)}</div>
    </div>
  `;
  overlay.firstElementChild.appendChild(inp);
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'background:none;border:1px solid var(--border2);color:var(--text2);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px';
  cancelBtn.addEventListener('click', () => overlay.remove());
  btns.appendChild(cancelBtn);
  overlay.firstElementChild.appendChild(btns);
  document.body.appendChild(overlay);
  setTimeout(() => { try { inp.showPicker(); } catch (_) {} inp.focus(); }, 60);
};

// =====================
// SEARCH CLEAR HELPER
// =====================

HALQ.updateSearchClear = function (input) {
  const btn = document.getElementById('wo-search-clear');
  if (btn) btn.classList.toggle('visible', input.value.length > 0);
};

// =====================
// APPFOLIO AUTO-SEARCH (v2 — new tab, no webview)
// =====================

HALQ.af.autoSearchWO = function (wo) {
  if (!wo || !wo.wo) return;
  const woSearch = wo.wo.split('-')[0];
  const baseUrl = 'https://talley.appfolio.com';
  const url = `${baseUrl}/search/advanced_search?full_text_search=${encodeURIComponent(woSearch)}&section_keys=work_orders`;
  window.open(url, '_blank');
};

// =====================
// APPFOLIO PANEL (v2 — minimal new-tab launcher)
// =====================

HALQ.af.navTo = function (url) {
  if (!url) return;
  if (!url.startsWith('http')) url = 'https://' + url;
  window.open(url, '_blank');
};

HALQ.af.applyUrl = function (url) {
  if (!url) return;
  HALQ.af.baseUrl = url;
};

// =====================
// EMAIL PANEL (v2 — minimal new-tab launcher)
// =====================

HALQ.email.openOutlook = function () {
  window.open('https://outlook.office.com/mail', '_blank');
};

// =====================
// FIX: Attach utility functions to HALQ root namespace
// so wo-panel.js and other modules can access them directly
// =====================
HALQ.fmtDate = fmtDate;
HALQ.fmtDateISO = fmtDateISO;
HALQ.nextBizDay = nextBizDay;
HALQ.nextNextBizDay = nextNextBizDay;
HALQ.getNextFriday = getNextFriday;
HALQ.getWeekStart = getWeekStart;
HALQ.calendarAgeToBizDays = calendarAgeToBizDays;
HALQ.skipWeekend = skipWeekend;
HALQ.escapeHtml = escapeHtml;
HALQ.showDebug = showDebug;
HALQ.showErrorDialog = showErrorDialog;