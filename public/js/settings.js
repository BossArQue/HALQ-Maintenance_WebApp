/* ============================================
   FILE: settings.js
   PATH: public/js/settings.js
   VERSION: 2.2.3
   DESCRIPTION: Settings panel UI — theme, font, layout, nav, message templates, vendor directory, bridge config, PIN.
   ============================================ */

(function () {
  'use strict';

  /* ---------- DOM refs ---------- */
  let _overlay = null;
  let _currentTab = 'appearance';
  let _pinState = { digits: '', confirmed: '', mode: 'verify' };

  /* ---------- init ---------- */
  function init() {
    _overlay = document.getElementById('settings-overlay');

    _overlay?.addEventListener('click', e => {
      if (e.target === _overlay) close();
    });

    document.getElementById('settings-close')?.addEventListener('click', close);

    // Tab switching
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    // Theme options
    document.querySelectorAll('.theme-option').forEach(el => {
      el.addEventListener('click', () => setTheme(el.getAttribute('data-theme')));
    });

    // Layout options
    document.querySelectorAll('.layout-option[data-layout]').forEach(el => {
      el.addEventListener('click', () => setLayout(el.getAttribute('data-layout')));
    });

    // Nav style options
    document.querySelectorAll('.layout-option[data-nav]').forEach(el => {
      el.addEventListener('click', () => setNavStyle(el.getAttribute('data-nav')));
    });

    // Font options
    document.querySelectorAll('.font-option').forEach(el => {
      el.addEventListener('click', () => setFont(el.getAttribute('data-font')));
    });

    // Font size slider
    const fontSlider = document.getElementById('font-size-slider');
    if (fontSlider) {
      fontSlider.addEventListener('input', e => {
        const size = parseInt(e.target.value, 10);
        const valEl = document.getElementById('font-size-val');
        if (valEl) valEl.textContent = size + 'px';
        setFontSize(size);
      });
    }

    // Preference toggles
    document.querySelectorAll('.toggle-switch[data-pref]').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.getAttribute('data-pref');
        togglePref(key, el);
      });
    });

    // Bridge config
    document.getElementById('bridge-save-btn')?.addEventListener('click', saveBridgeConfig);

    // Accounts — AppFolio URL
    document.getElementById('btn-save-appfolio-url')?.addEventListener('click', saveAppfolioUrl);
    document.getElementById('btn-copy-tampermonkey')?.addEventListener('click', copyTampermonkeyScript);

    // Excel browse (hidden file input)
    const browseBtn = document.getElementById('btn-browse-excel');
    const fileInput = document.getElementById('excel-file-input');
    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
          const pathInput = document.getElementById('bridge-excel-path');
          if (pathInput) pathInput.value = file.name;
        }
        // Reset so the same file can be selected again
        e.target.value = '';
      });
    }

    // Message template add buttons
    const templateGroups = [
      ['tenant', 'email'], ['tenant', 'text'],
      ['vendor', 'email'], ['vendor', 'text'],
      ['owner', 'email'], ['owner', 'text']
    ];
    templateGroups.forEach(([group, type]) => {
      const btn = document.getElementById(`btn-add-template-${group}-${type}`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (HALQ.msg && HALQ.msg.addTemplate) HALQ.msg.addTemplate(group, type);
        });
      }
    });

    // Message template save buttons
    ['tenant', 'vendor', 'owner'].forEach(group => {
      const btn = document.getElementById(`btn-save-templates-${group}`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (HALQ.msg && HALQ.msg.saveTemplates) HALQ.msg.saveTemplates();
        });
      }
    });

    // Vendor directory buttons
    document.getElementById('btn-vendor-import')?.addEventListener('click', () => {
      if (HALQ.msg && HALQ.msg.dirImportExcel) HALQ.msg.dirImportExcel();
    });
    document.getElementById('btn-vendor-add')?.addEventListener('click', () => {
      if (HALQ.msg && HALQ.msg.dirAddManual) HALQ.msg.dirAddManual();
    });

    // Vendor search
    const vendorSearch = document.getElementById('vendor-dir-search');
    if (vendorSearch) {
      vendorSearch.addEventListener('input', e => {
        if (HALQ.msg && HALQ.msg.dirRenderTable) HALQ.msg.dirRenderTable(e.target.value);
      });
    }

    // PIN overlay listeners
    initPinListeners();

    loadSettingsToUI();
  }

  /* ---------- PIN handlers ---------- */
  function initPinListeners() {
    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', () => pinKey(key.getAttribute('data-key')));
    });

    const pinInput = document.getElementById('pin-keyboard-input');
    if (pinInput) {
      pinInput.addEventListener('input', e => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        e.target.value = val;
        _pinState.digits = val;
        updatePinDots();
        if (val.length === 4) checkPin();
      });
      pinInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') pinKey('cancel');
      });
    }
  }

  function updatePinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById('pd' + i);
      if (dot) dot.classList.toggle('filled', i < _pinState.digits.length);
    }
  }

  function checkPin() {
    const stored = localStorage.getItem('halq_pin');
    const pinInput = document.getElementById('pin-keyboard-input');

    if (stored) {
      // Verify mode
      if (_pinState.digits === stored) {
        closePin();
        open();
      } else {
        showPinError('Incorrect PIN');
        _pinState.digits = '';
        if (pinInput) pinInput.value = '';
        updatePinDots();
      }
    } else {
      // Set mode
      if (!_pinState.confirmed) {
        _pinState.confirmed = _pinState.digits;
        _pinState.digits = '';
        if (pinInput) pinInput.value = '';
        updatePinDots();
        const sub = document.getElementById('pin-sub');
        if (sub) sub.textContent = 'Confirm your PIN';
      } else {
        if (_pinState.digits === _pinState.confirmed) {
          savePin(_pinState.digits);
          closePin();
          open();
        } else {
          showPinError('PINs do not match');
          _pinState.confirmed = '';
          _pinState.digits = '';
          if (pinInput) pinInput.value = '';
          updatePinDots();
          const sub = document.getElementById('pin-sub');
          if (sub) sub.textContent = 'Enter a new PIN (4 digits)';
        }
      }
    }
  }

  function showPinError(msg) {
    const err = document.getElementById('pin-error');
    if (err) {
      err.textContent = msg;
      setTimeout(() => { err.textContent = ''; }, 2000);
    }
  }

  function pinKey(key) {
    if (key === 'cancel') {
      closePin();
      return;
    }
    if (key === 'back') {
      _pinState.digits = _pinState.digits.slice(0, -1);
    } else if (/^\d$/.test(key)) {
      _pinState.digits = (_pinState.digits + key).slice(0, 4);
    }

    const pinInput = document.getElementById('pin-keyboard-input');
    if (pinInput) pinInput.value = _pinState.digits;
    updatePinDots();
    if (_pinState.digits.length === 4) checkPin();
  }

  function openPin() {
    _pinState.digits = '';
    _pinState.confirmed = '';
    const pinInput = document.getElementById('pin-keyboard-input');
    if (pinInput) pinInput.value = '';
    updatePinDots();

    const stored = localStorage.getItem('halq_pin');
    const sub = document.getElementById('pin-sub');
    if (sub) sub.textContent = stored ? 'Enter your PIN to continue' : 'Enter a new PIN (4 digits)';

    const pinOverlay = document.getElementById('pin-overlay');
    if (pinOverlay) pinOverlay.style.display = '';
    pinInput?.focus();
  }

  function closePin() {
    const pinOverlay = document.getElementById('pin-overlay');
    if (pinOverlay) pinOverlay.style.display = 'none';
    _pinState.digits = '';
    _pinState.confirmed = '';
  }

  function savePin(pin) {
    localStorage.setItem('halq_pin', pin);
    HALQ.apiPost('/settings', { key: 'pin', value: pin }).catch(() => {});
  }

  function clearPin() {
    localStorage.removeItem('halq_pin');
    HALQ.apiPost('/settings', { key: 'pin', value: '' }).catch(() => {});
  }

  /* ---------- Tab switching ---------- */
  function switchTab(tabName) {
    _currentTab = tabName;
    document.querySelectorAll('.settings-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.settings-tab-panel').forEach(p => {
      p.classList.toggle('hidden', p.getAttribute('data-panel') !== tabName);
    });

    if (tabName === 'messages') {
      if (HALQ.msg && HALQ.msg.renderTemplates) HALQ.msg.renderTemplates();
      if (HALQ.msg && HALQ.msg.dirRenderTable) HALQ.msg.dirRenderTable();
    }
  }

  /* ---------- Open / Close ---------- */
  function open() {
    // PIN auto-lock disabled — feature was unreliable and caused unexpected overlays
    loadSettingsToUI();
    _overlay?.classList.add('open');
  }

  function close() {
    _overlay?.classList.remove('open');
  }

  /* ---------- Load all settings into UI ---------- */
  async function loadSettingsToUI() {
    // Apply localStorage values first for responsiveness
    applySettingsToUI();

    // Then sync from API
    try {
      const result = await HALQ.apiGet('/settings');
      if (result.ok && result.data) {
        const settings = Array.isArray(result.data) ? result.data : [];
        settings.forEach(s => {
          if (!s || !s.key) return;
          switch (s.key) {
            case 'theme':
              if (s.value) localStorage.setItem('halq_theme', s.value);
              break;
            case 'appFont':
              if (s.value) localStorage.setItem('halq_font', s.value);
              break;
            case 'appFontSize':
              if (s.value != null) localStorage.setItem('halq_fontSize', String(s.value));
              break;
            case 'layoutMode':
              if (s.value) localStorage.setItem('halq_layout', s.value);
              break;
            case 'navStyle':
              if (s.value) localStorage.setItem('halq_navStyle', s.value);
              break;
            case 'colorCodeWOs':
            case 'autoSearch':
            case 'showBottomBar':
            case 'showMenuBar':
              localStorage.setItem('halq_' + s.key, String(s.value));
              break;
            case 'bridge_config':
              if (s.value) {
                const cfg = typeof s.value === 'object' ? s.value : JSON.parse(s.value);
                const excelInput = document.getElementById('bridge-excel-path');
                const vaultInput = document.getElementById('bridge-vault-path');
                const apiInput = document.getElementById('bridge-api-url');
                if (excelInput) excelInput.value = cfg.excelPath || '';
                if (vaultInput) vaultInput.value = cfg.vaultPath || '';
                if (apiInput) apiInput.value = cfg.apiUrl || '';
              }
              break;
            case 'af_baseurl':
              if (s.value) localStorage.setItem('halq_af_baseurl', s.value);
              break;
          }
        });
        // Re-apply after API sync
        applySettingsToUI();
      }
    } catch (e) {
      console.log('[SETTINGS] API load failed, using localStorage');
    }
  }

  function applySettingsToUI() {
    // Theme
    const theme = localStorage.getItem('halq_theme') || 'light';
    document.body.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-theme') === theme);
    });

    // Font
    const font = localStorage.getItem('halq_font') || 'Inter';
    document.querySelectorAll('.font-option').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-font') === font);
    });

    // Font size
    const fontSize = localStorage.getItem('halq_fontSize') || '13';
    const slider = document.getElementById('font-size-slider');
    const valEl = document.getElementById('font-size-val');
    if (slider) slider.value = fontSize;
    if (valEl) valEl.textContent = fontSize + 'px';
    document.documentElement.style.setProperty('--app-font-size', fontSize + 'px');

    // Layout
    const layout = localStorage.getItem('halq_layout') || 'side';
    document.querySelectorAll('.layout-option[data-layout]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-layout') === layout);
    });
    const pl = document.getElementById('panel-layout');
    if (pl) pl.className = 'panel-layout' + (layout === 'vertical' ? ' vertical' : '');

    // Nav style
    const navStyle = localStorage.getItem('halq_navStyle') || 'sidebar';
    document.querySelectorAll('.layout-option[data-nav]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-nav') === navStyle);
    });
    applyNavStyle(navStyle);

    // Preferences
    ['colorCodeWOs', 'autoSearch', 'showBottomBar', 'showMenuBar'].forEach(key => {
      const val = localStorage.getItem('halq_' + key) === 'true';
      const el = document.querySelector(`.toggle-switch[data-pref="${key}"]`);
      if (el) el.classList.toggle('on', val);
    });
    applyBottomBar();

    // AppFolio URL
    const afUrl = localStorage.getItem('halq_af_baseurl') || '';
    const afInput = document.getElementById('appfolio-url-input');
    if (afInput) afInput.value = afUrl;
  }

  /* ---------- Theme ---------- */
  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('halq_theme', theme);
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-theme') === theme);
    });
    HALQ.apiPost('/settings', { key: 'theme', value: theme }).catch(() => {});
  }

  /* ---------- Font ---------- */
  function setFont(fontName) {
    localStorage.setItem('halq_font', fontName);
    document.querySelectorAll('.font-option').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-font') === fontName);
    });
    if (HALQ.app && HALQ.app.setAppFont) HALQ.app.setAppFont(fontName);
    HALQ.apiPost('/settings', { key: 'appFont', value: fontName }).catch(() => {});
  }

  /* ---------- Font Size ---------- */
  function setFontSize(size) {
    size = parseInt(size, 10);
    localStorage.setItem('halq_fontSize', String(size));
    document.documentElement.style.setProperty('--app-font-size', size + 'px');
    if (HALQ.app && HALQ.app.setAppFontSize) HALQ.app.setAppFontSize(size);
    HALQ.apiPost('/settings', { key: 'appFontSize', value: size }).catch(() => {});
  }

  /* ---------- Layout ---------- */
  function setLayout(mode) {
    localStorage.setItem('halq_layout', mode);
    document.querySelectorAll('.layout-option[data-layout]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-layout') === mode);
    });
    const pl = document.getElementById('panel-layout');
    if (pl) pl.className = 'panel-layout' + (mode === 'vertical' ? ' vertical' : '');
    HALQ.apiPost('/settings', { key: 'layoutMode', value: mode }).catch(() => {});
  }

  /* ---------- Nav Style ---------- */
  function setNavStyle(mode) {
    localStorage.setItem('halq_navStyle', mode);
    document.querySelectorAll('.layout-option[data-nav]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-nav') === mode);
    });
    applyNavStyle(mode);
    HALQ.apiPost('/settings', { key: 'navStyle', value: mode }).catch(() => {});
  }

  function applyNavStyle(mode) {
    document.body.setAttribute('data-nav', mode);
    const sidebar = document.getElementById('sidebar');
    const topNav = document.getElementById('top-nav');
    const sectionTabs = document.getElementById('section-tabs');
    if (sidebar) sidebar.style.display = (mode === 'sidebar') ? '' : 'none';
    if (topNav) topNav.style.display = (mode === 'topnav') ? '' : 'none';
    if (sectionTabs) sectionTabs.style.display = (mode === 'tabs') ? '' : 'none';
  }

  /* ---------- Toggle Preference ---------- */
  async function togglePref(key, el) {
    el.classList.toggle('on');
    const val = el.classList.contains('on');
    localStorage.setItem('halq_' + key, String(val));
    HALQ.apiPost('/settings', { key, value: val }).catch(() => {});

    if (key === 'showBottomBar') applyBottomBar();
    if (key === 'showMenuBar') applyMenuBar();
    if (key === 'colorCodeWOs' && HALQ.wo && HALQ.wo.renderList) HALQ.wo.renderList();
  }

  function applyBottomBar() {
    const val = localStorage.getItem('halq_showBottomBar') === 'true';
    const bb = document.querySelector('.bottombar');
    if (bb) bb.style.display = val ? '' : 'none';
  }

  function applyMenuBar() {
    const val = localStorage.getItem('halq_showMenuBar') === 'true';
    document.body.classList.toggle('menu-bar-visible', val);
  }

  /* ---------- Bridge Config ---------- */
  async function saveBridgeConfig() {
    const excelPath = document.getElementById('bridge-excel-path')?.value?.trim();
    const vaultPath = document.getElementById('bridge-vault-path')?.value?.trim();
    const apiUrl = document.getElementById('bridge-api-url')?.value?.trim();

    const config = {
      excelPath: excelPath || '',
      vaultPath: vaultPath || '',
      apiUrl: apiUrl || window.location.origin
    };

    try {
      const res = await HALQ.apiPost('/settings', { key: 'bridge_config', value: config });
      if (res.ok) {
        showBridgeStatus('Saved successfully', 'success');
      } else {
        showBridgeStatus('Save failed: ' + (res.error || 'Unknown'), 'error');
      }
    } catch (e) {
      showBridgeStatus('Save failed: ' + (e && e.message ? e.message : 'Network error'), 'error');
    }
  }

  function showBridgeStatus(msg, type) {
    const el = document.getElementById('bridge-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'bridge-status ' + (type || '');
    setTimeout(() => { el.textContent = ''; el.className = 'bridge-status'; }, 3000);
  }

  /* ---------- Accounts / AppFolio ---------- */
  async function saveAppfolioUrl() {
    const urlInput = document.getElementById('appfolio-url-input');
    const status = document.getElementById('appfolio-url-status');
    const url = urlInput?.value?.trim() || '';

    localStorage.setItem('halq_af_baseurl', url);
    if (HALQ.af) HALQ.af.baseUrl = url;

    try {
      const res = await HALQ.apiPost('/settings', { key: 'af_baseurl', value: url });
      if (res.ok) {
        if (status) { status.textContent = '✓ Saved'; status.className = 'creds-status ok'; }
      } else {
        if (status) { status.textContent = '✗ ' + (res.error || 'Failed'); status.className = 'creds-status err'; }
      }
    } catch (e) {
      if (status) { status.textContent = '✗ Saved locally (API offline)'; status.className = 'creds-status ok'; }
    }
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'creds-status'; } }, 3000);
  }

  async function copyTampermonkeyScript() {
    const status = document.getElementById('tm-status');
    const script = `// ==UserScript==
// @name         HALQ AppFolio Auto-Click
// @namespace    halq
// @version      1.0
// @description  Auto-click the first WO result when HALQ opens AppFolio search
// @match        *://talley.appfolio.com/search/advanced_search*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  const url = new URL(window.location.href);
  const search = url.searchParams.get('full_text_search');
  if (!search) return;

  const observer = new MutationObserver(() => {
    const link = document.querySelector('a[href*="/service_requests/"]');
    if (link) { link.click(); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    const link = document.querySelector('a[href*="/service_requests/"]');
    if (link) link.click();
  }, 5000);
})();`;

    try {
      await navigator.clipboard.writeText(script);
      if (status) { status.textContent = '✓ Script copied to clipboard'; status.className = 'creds-status ok'; }
    } catch (e) {
      if (status) { status.textContent = '✗ Copy failed — select and copy manually'; status.className = 'creds-status err'; }
    }
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'creds-status'; } }, 3000);
  }

  /* ---------- Public API ---------- */
  HALQ.settings = {
    init,
    open,
    close,
    switchTab,
    setTheme,
    setLayout,
    setNavStyle,
    setFont,
    setFontSize,
    togglePref,
    saveBridgeConfig,
    showBridgeStatus,
    saveAppfolioUrl,
    copyTampermonkeyScript,
    loadSettingsToUI,

    // PIN (legacy compat)
    pinKey,
    savePin,
    clearPin,
    onPinKeyboardInput: (input) => {
      const val = input.value.replace(/\D/g, '').slice(0, 4);
      input.value = val;
      _pinState.digits = val;
      updatePinDots();
      if (val.length === 4) checkPin();
    }
  };
})();
