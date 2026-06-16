/* ============================================
   FILE: settings.js
   PATH: public/js/settings.js
   VERSION: 2.1.1
   DESCRIPTION: Settings panel UI — theme, font, layout, message templates, vendor directory, bridge config.
   ============================================ */

(function () {
  'use strict';

  /* ---------- DOM refs ---------- */
  let _overlay = null, _panel = null;
  let _currentTab = 'appearance';

  /* ---------- init ---------- */
  function init() {
    _overlay = document.getElementById('settings-overlay');
    _panel = document.querySelector('.settings-panel');

    _overlay?.addEventListener('click', e => { if (e.target === _overlay) closeSettings(); });
    document.querySelector('.settings-close')?.addEventListener('click', closeSettings);

    // Tab switching
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    loadSettingsToUI();
  }

  function switchTab(tabName) {
    _currentTab = tabName;
    document.querySelectorAll('.settings-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.settings-tab-panel').forEach(p => {
      p.classList.toggle('hidden', p.getAttribute('data-panel') !== tabName);
    });
  }

  function openSettings() {
    loadSettingsToUI();
    _overlay?.classList.add('open');
  }

  function closeSettings() {
    _overlay?.classList.remove('open');
  }

  /* ---------- Load all settings into UI ---------- */
  async function loadSettingsToUI() {
    // Theme
    const theme = localStorage.getItem('halq_theme') || 'dark';
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
    const layout = localStorage.getItem('halq_layout') || 'standard';
    const pl = document.getElementById('panel-layout');
    if (pl) pl.className = 'panel-layout' + (layout === 'vertical' ? ' vertical' : '');

    // Bridge config from API
    try {
      const result = await HALQ.apiGet('/settings');
      if (result.ok && result.data) {
        result.data.forEach(s => {
          if (s.key === 'theme' && s.value) {
            document.body.setAttribute('data-theme', s.value);
            localStorage.setItem('halq_theme', s.value);
          }
          if (s.key === 'appFont' && s.value) {
            localStorage.setItem('halq_font', s.value);
          }
          if (s.key === 'appFontSize' && s.value) {
            localStorage.setItem('halq_fontSize', String(s.value));
          }
          if (s.key === 'layoutMode' && s.value) {
            localStorage.setItem('halq_layout', s.value);
          }
          if (s.key === 'bridge_config' && s.value) {
            const cfg = typeof s.value === 'object' ? s.value : JSON.parse(s.value);
            const excelInput = document.getElementById('bridge-excel-path');
            const vaultInput = document.getElementById('bridge-vault-path');
            const apiInput = document.getElementById('bridge-api-url');
            if (excelInput) excelInput.value = cfg.excelPath || '';
            if (vaultInput) vaultInput.value = cfg.vaultPath || '';
            if (apiInput) apiInput.value = cfg.apiUrl || '';
          }
        });
      }
    } catch (e) {
      console.log('[SETTINGS] API load failed, using localStorage');
    }
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
    HALQ.app.setAppFont(fontName);
    HALQ.apiPost('/settings', { key: 'appFont', value: fontName }).catch(() => {});
  }

  /* ---------- Font Size ---------- */
  function setFontSize(size) {
    size = parseInt(size);
    localStorage.setItem('halq_fontSize', String(size));
    HALQ.app.setAppFontSize(size);
    HALQ.apiPost('/settings', { key: 'appFontSize', value: size }).catch(() => {});
  }

  /* ---------- Layout ---------- */
  function setLayout(mode) {
    localStorage.setItem('halq_layout', mode);
    const pl = document.getElementById('panel-layout');
    if (pl) pl.className = 'panel-layout' + (mode === 'vertical' ? ' vertical' : '');
    HALQ.apiPost('/settings', { key: 'layoutMode', value: mode }).catch(() => {});
  }

  /* ---------- Toggle Preference ---------- */
  async function togglePref(el, key) {
    el.classList.toggle('on');
    const val = el.classList.contains('on');
    localStorage.setItem('halq_' + key, String(val));
    HALQ.apiPost('/settings', { key, value: val }).catch(() => {});
    if (key === 'showBottomBar') {
      const bb = document.querySelector('.bottombar');
      if (bb) bb.style.display = val ? '' : 'none';
    }
    if (key === 'colorCodeWOs' && HALQ.wo.renderList) HALQ.wo.renderList();
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
      showBridgeStatus('Save failed: ' + e.message, 'error');
    }
  }

  function showBridgeStatus(msg, type) {
    const el = document.getElementById('bridge-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'bridge-status ' + type;
    setTimeout(() => { el.textContent = ''; el.className = 'bridge-status'; }, 3000);
  }

  /* ---------- Message Templates UI bridge ---------- */
  function renderMsgTemplates() {
    if (HALQ.msg.renderTemplates) HALQ.msg.renderTemplates();
  }

  function renderVendorDir() {
    if (HALQ.msg.dirRenderTable) HALQ.msg.dirRenderTable();
  }

  /* ---------- Public API ---------- */
  HALQ.settings = {
    init,
    open: openSettings,
    close: closeSettings,
    setTheme,
    setFont,
    setFontSize,
    setLayout,
    togglePref,
    saveBridgeConfig,
    renderMsgTemplates,
    renderVendorDir,
    loadSettingsToUI
  };

})();