/* ============================================================
   HALQ — Settings Panel & PIN / Credentials / Config
   ============================================================ */

window.HALQ = window.HALQ || {};
HALQ.settings = (function () {
  'use strict';

  /* ---------- DOM refs ---------- */
  const $ = id => document.getElementById(id);
  let _overlay = null, _panel = null, _tabBtns = null, _tabBodies = null;

  /* ---------- PIN state ---------- */
  const _pin = { digits: '', confirmed: '', mode: 'verify' }; // verify | set | confirm

  /* ---------- init ---------- */
  function init() {
    _overlay = $('settingsOverlay');
    _panel   = $('settingsPanel');
    _tabBtns = document.querySelectorAll('.settings-tab-btn');
    _tabBodies = document.querySelectorAll('.settings-tab-body');

    _tabBtns.forEach(btn => btn.addEventListener('click', () => switchSettingsTab(btn.dataset.tab)));
    $('btnCloseSettings').addEventListener('click', closeSettings);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) closeSettings(); });

    /* PIN */
    $('btnPinSave').addEventListener('click', savePin);
    $('btnPinClear').addEventListener('click', clearPin);
    document.querySelectorAll('.pin-key').forEach(k => k.addEventListener('click', () => pinKey(k.dataset.digit)));

    /* Credentials */
    $('btnSaveCreds').addEventListener('click', saveCreds);

    /* Excel path */
    $('btnPickExcel').addEventListener('click', pickExcelPath);
    $('btnClearExcel').addEventListener('click', () => { $('inputExcelPath').value = ''; });

    /* Message templates */
    $('btnAddTemplate').addEventListener('click', () => HALQ.messages.showTemplateEditor(null));
    $('btnResetTemplates').addEventListener('click', resetTemplates);

    /* Vendor directory */
    $('btnAddVendor').addEventListener('click', () => HALQ.messages.showVendorModal(null));
    $('btnImportVendors').addEventListener('click', importVendors);
    $('btnExportVendors').addEventListener('click', exportVendors);

    /* Category manager */
    $('btnOpenCatManager').addEventListener('click', () => HALQ.categories.openManager());

    /* Theme / Layout / Font listeners (live preview) */
    document.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', e => HALQ.app.setTheme(e.target.value)));
    document.querySelectorAll('input[name="layout"]').forEach(r => r.addEventListener('change', e => HALQ.app.setLayout(e.target.value)));
    $('selFontFamily').addEventListener('change', e => HALQ.app.setFont(e.target.value));

    loadSettingsToUI();
  }

  /* ---------- open / close ---------- */
  function openSettings() {
    loadSettingsToUI();
    _overlay.classList.remove('hidden');
    requestAnimationFrame(() => _panel.classList.add('open'));
    switchSettingsTab('general');
  }
  function closeSettings() {
    _panel.classList.remove('open');
    setTimeout(() => _overlay.classList.add('hidden'), 250);
  }

  /* ---------- tab switching ---------- */
  function switchSettingsTab(tabId) {
    _tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    _tabBodies.forEach(b => b.classList.toggle('hidden', b.id !== 'tab-' + tabId));
  }

  /* ---------- PIN ---------- */
  function pinKey(digit) {
    const disp = $('pinDisplay');
    if (digit === 'back') {
      _pin.digits = _pin.digits.slice(0, -1);
    } else if (digit === 'clear') {
      _pin.digits = '';
    } else if (/[0-9]/.test(digit) && _pin.digits.length < 6) {
      _pin.digits += digit;
    }
    disp.textContent = _pin.digits.length ? '•'.repeat(_pin.digits.length) : 'Enter PIN';
    disp.classList.toggle('error', false);
  }

  function verifyPin(attempt) {
    const stored = localStorage.getItem('halq_pin');
    if (!stored) return true; // no PIN set
    return attempt === stored;
  }

  function savePin() {
    const stored = localStorage.getItem('halq_pin');
    const msg = $('pinMsg');

    if (_pin.mode === 'verify') {
      if (!verifyPin(_pin.digits)) {
        $('pinDisplay').classList.add('error');
        msg.textContent = 'Incorrect PIN';
        _pin.digits = '';
        setTimeout(() => { $('pinDisplay').textContent = 'Enter PIN'; $('pinDisplay').classList.remove('error'); msg.textContent = ''; }, 800);
        return;
      }
      if (stored) {
        // changing existing PIN
        _pin.mode = 'set';
        msg.textContent = 'Enter new PIN';
        _pin.digits = '';
        $('pinDisplay').textContent = 'New PIN';
        return;
      }
      // no existing PIN — fall through to set
      _pin.mode = 'set';
    }

    if (_pin.mode === 'set') {
      if (_pin.digits.length < 4) { msg.textContent = 'Minimum 4 digits'; return; }
      _pin.confirmed = _pin.digits;
      _pin.digits = '';
      _pin.mode = 'confirm';
      $('pinDisplay').textContent = 'Confirm PIN';
      msg.textContent = 'Re-enter to confirm';
      return;
    }

    if (_pin.mode === 'confirm') {
      if (_pin.digits !== _pin.confirmed) {
        msg.textContent = 'PINs do not match. Try again.';
        _pin.mode = 'set';
        _pin.digits = '';
        $('pinDisplay').textContent = 'New PIN';
        return;
      }
      localStorage.setItem('halq_pin', _pin.digits);
      msg.textContent = 'PIN saved.';
      _pin.mode = 'verify';
      _pin.digits = '';
      $('pinDisplay').textContent = 'Enter PIN';
      setTimeout(() => msg.textContent = '', 1500);
    }
  }

  function clearPin() {
    if (!confirm('Remove PIN protection?')) return;
    localStorage.removeItem('halq_pin');
    _pin.digits = '';
    _pin.mode = 'verify';
    $('pinDisplay').textContent = 'Enter PIN';
    $('pinMsg').textContent = 'PIN cleared.';
  }

  /* ---------- Credentials ---------- */
  function saveCreds() {
    const u = $('inputUsername').value.trim();
    const p = $('inputPassword').value;
    if (!u || !p) { HALQ.app.showFieldStatus('btnSaveCreds', 'Fill both fields', 'err'); return; }
    // Store obfuscated (not secure, just not plaintext in LS)
    const payload = btoa(JSON.stringify({ u, p, t: Date.now() }));
    localStorage.setItem('halq_creds', payload);
    HALQ.app.showFieldStatus('btnSaveCreds', 'Saved', 'ok');
  }

  function loadCredsToUI() {
    const raw = localStorage.getItem('halq_creds');
    if (!raw) return;
    try {
      const { u } = JSON.parse(atob(raw));
      $('inputUsername').value = u;
      $('inputPassword').placeholder = '••••••••';
    } catch (e) { /* ignore corrupt */ }
  }

  /* ---------- Excel path ---------- */
  function pickExcelPath() {
    // In Electron: HALQ.app.ipc('dialog:open', { filters: [{name:'Excel',extensions:['xlsx','xls']}] })
    // Fallback: manual paste
    const inp = $('inputExcelPath');
    const fake = '/Users/Shared/HALQ/Data/WO_Master.xlsx'; // placeholder
    inp.value = fake;
    localStorage.setItem('halq_excel_path', fake);
  }

  /* ---------- Message templates UI bridge ---------- */
  function resetTemplates() {
    if (!confirm('Reset all message templates to defaults?')) return;
    localStorage.removeItem('halq_msg_templates');
    HALQ.messages.renderMsgTemplates();
    HALQ.app.showFieldStatus('btnResetTemplates', 'Reset', 'ok');
  }

  /* ---------- Vendor directory UI bridge ---------- */
  function importVendors() {
    const ta = $('vendorImportArea');
    ta.classList.toggle('hidden');
    if (!ta.classList.contains('hidden')) ta.querySelector('textarea').focus();
  }
  function exportVendors() {
    const data = HALQ.messages.getVendorDir(); // assumed API
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `halq_vendors_${HALQ.app.fmtDate(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  }

  /* ---------- Load all settings into UI ---------- */
  function loadSettingsToUI() {
    /* Theme */
    const theme = localStorage.getItem('halq_theme') || 'dark';
    (document.querySelector(`input[name="theme"][value="${theme}"]`) || {}).checked = true;

    /* Layout */
    const layout = localStorage.getItem('halq_layout') || 'standard';
    (document.querySelector(`input[name="layout"][value="${layout}"]`) || {}).checked = true;

    /* Font */
    const font = localStorage.getItem('halq_font') || 'system';
    $('selFontFamily').value = font;

    /* Excel */
    $('inputExcelPath').value = localStorage.getItem('halq_excel_path') || '';

    /* PIN hint */
    const hasPin = !!localStorage.getItem('halq_pin');
    $('pinStatus').textContent = hasPin ? 'PIN is set' : 'No PIN set';

    loadCredsToUI();
    HALQ.messages.renderMsgTemplates();
    HALQ.messages.renderVendorDir();
  }

  return {
    init,
    openSettings,
    closeSettings,
    switchSettingsTab,
    verifyPin,
    pinKey,
    savePin,
    clearPin,
    saveCreds,
    loadCredsToUI,
    pickExcelPath,
    resetTemplates,
    importVendors,
    exportVendors,
    loadSettingsToUI
  };
})();