/* ============================================
   FILE: af-panel.js
   PATH: public/js/af-panel.js
   VERSION: 2.3.0
   DESCRIPTION: Remote Browser panel — tab controller for external browser windows.
                No webview. Uses window.open() with named windows.
   ============================================ */
(function () {
  'use strict';

  // ── State ──
  const S = {
    baseUrl: '',
    activeTab: 'appfolio',
    winRef: null,   // Reference to window.open() result
    pollTimer: null
  };

  // ── DOM refs ──
  let $ = {};

  function cache() {
    $ = {
      urlBar:     document.getElementById('browser-url'),
      status:     document.getElementById('browser-status'),
      remoteUrl:  document.getElementById('browser-remote-url'),
      remoteTitle: document.getElementById('browser-remote-title'),
      btnOpen:    document.getElementById('browser-remote-open'),
      btnSearch:  document.getElementById('browser-remote-search'),
      btnCopy:    document.getElementById('browser-remote-copy'),
      btnClose:   document.getElementById('browser-remote-close'),
      tabs:       document.querySelectorAll('.browser-tab'),
      btnBack:    document.getElementById('browser-back'),
      btnForward: document.getElementById('browser-forward'),
      btnReload:  document.getElementById('browser-reload'),
      btnGo:      document.getElementById('browser-go'),
      btnOpenNew: document.getElementById('browser-open-new'),
      tmLink:     document.getElementById('tm-setup-link')
    };
  }

  // ── Exports ──
  const API = {
    get baseUrl() { return S.baseUrl; },
    set baseUrl(v) { S.baseUrl = v; _persist(); },
    init, navTo, navReload, openTab, closeTab, autoSearchWO,
    getWinRef() { return S.winRef; }
  };

  HALQ.af = API;

  // ── Init ──
  function init() {
    cache();
    _load();
    attachListeners();
    updateStatus();
    // Poll window status every 2 seconds
    S.pollTimer = setInterval(updateStatus, 2000);
  }

  function _persist() {
    try { localStorage.setItem('halq_af_baseurl', S.baseUrl); } catch (_) {}
  }

  function _load() {
    try {
      S.baseUrl = localStorage.getItem('halq_af_baseurl') || '';
      if ($.urlBar) $.urlBar.value = S.baseUrl;
    } catch (_) {}
  }

  function attachListeners() {
    // URL bar
    if ($.urlBar) {
      $.urlBar.addEventListener('keydown', e => {
        if (e.key === 'Enter') navTo($.urlBar.value);
      });
    }

    // Go button
    if ($.btnGo) {
      $.btnGo.addEventListener('click', () => navTo($.urlBar.value));
    }

    // Open in new tab
    if ($.btnOpen) {
      $.btnOpen.addEventListener('click', () => {
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        S.winRef = window.open(url, 'appfolio');
        updateStatus();
      });
    }

    // Search WO
    if ($.btnSearch) {
      $.btnSearch.addEventListener('click', () => {
        const wo = HALQ.wo.selected;
        if (wo) autoSearchWO(wo);
      });
    }

    // Copy URL
    if ($.btnCopy) {
      $.btnCopy.addEventListener('click', () => {
        const url = S.baseUrl || '';
        if (url) {
          navigator.clipboard.writeText(url).then(() => {
            HALQ.showDebug('URL copied to clipboard');
          }).catch(() => {});
        }
      });
    }

    // Close tab
    if ($.btnClose) {
      $.btnClose.addEventListener('click', () => {
        if (S.winRef && !S.winRef.closed) {
          try { S.winRef.close(); } catch (e) {}
        }
        S.winRef = null;
        updateStatus();
      });
    }

    // Back / Forward / Reload (limited — cannot control cross-origin)
    if ($.btnBack) {
      $.btnBack.addEventListener('click', () => {
        if (S.winRef && !S.winRef.closed) {
          try { S.winRef.history.back(); } catch (e) {}
        }
      });
    }
    if ($.btnForward) {
      $.btnForward.addEventListener('click', () => {
        if (S.winRef && !S.winRef.closed) {
          try { S.winRef.history.forward(); } catch (e) {}
        }
      });
    }
    if ($.btnReload) {
      $.btnReload.addEventListener('click', navReload);
    }
    if ($.btnOpenNew) {
      $.btnOpenNew.addEventListener('click', () => {
        const url = S.baseUrl || '';
        if (url) window.open(url, '_blank');
      });
    }

    // Tab switching
    $.tabs?.forEach(tab => {
      tab.addEventListener('click', () => {
        $.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        S.activeTab = tab.dataset.name;
        const url = tab.dataset.url || '';
        if (url) {
          S.baseUrl = url;
          _persist();
          if ($.urlBar) $.urlBar.value = url;
        }
        const title = tab.textContent || 'Browser';
        if ($.remoteTitle) $.remoteTitle.textContent = title;
      });
    });

    // Tampermonkey link
    if ($.tmLink) {
      $.tmLink.addEventListener('click', e => {
        e.preventDefault();
        showTampermonkeyModal();
      });
    }
  }

  // =====================
  // NAVIGATION
  // =====================

  function navTo(url) {
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    S.baseUrl = url;
    _persist();
    if ($.urlBar) $.urlBar.value = url;

    if (S.winRef && !S.winRef.closed) {
      try {
        S.winRef.location = url;
      } catch (e) {
        S.winRef = window.open(url, 'appfolio');
      }
    } else {
      S.winRef = window.open(url, 'appfolio');
    }
    updateStatus();
  }

  function navReload() {
    if (S.winRef && !S.winRef.closed) {
      try { S.winRef.location.reload(); } catch (e) {}
    }
  }

  function openTab(name, url) {
    // Switch to named tab
    $.tabs?.forEach(tab => {
      if (tab.dataset.name === name) {
        tab.classList.add('active');
        S.activeTab = name;
        if (url) {
          S.baseUrl = url;
          _persist();
        }
      } else {
        tab.classList.remove('active');
      }
    });
  }

  function closeTab() {
    if (S.winRef && !S.winRef.closed) {
      try { S.winRef.close(); } catch (e) {}
    }
    S.winRef = null;
    updateStatus();
  }

  // =====================
  // AUTO-SEARCH WO
  // =====================

  function autoSearchWO(wo) {
    if (!wo) return;
    const woSearch = String(wo.wo || '').split('-')[0];
    if (!woSearch) return;

    const url = S.baseUrl
      ? `${S.baseUrl}?full_text_search=${encodeURIComponent(woSearch)}&section_keys=work_orders`
      : `https://talley.appfolio.com/search/advanced_search?full_text_search=${encodeURIComponent(woSearch)}&section_keys=work_orders`;

    if (!S.baseUrl) {
      S.baseUrl = 'https://talley.appfolio.com/search/advanced_search';
      _persist();
    }

    if (S.winRef && !S.winRef.closed) {
      try {
        S.winRef.location = url;
      } catch (e) {
        S.winRef = window.open(url, 'appfolio');
      }
    } else {
      S.winRef = window.open(url, 'appfolio');
    }
    updateStatus();
  }

  // =====================
  // STATUS POLLING
  // =====================

  function updateStatus() {
    if (!$.status) return;
    if (!S.winRef) {
      $.status.textContent = 'Closed';
      $.status.classList.remove('open');
      if ($.remoteUrl) $.remoteUrl.textContent = '—';
      return;
    }
    if (S.winRef.closed) {
      $.status.textContent = 'Closed';
      $.status.classList.remove('open');
      if ($.remoteUrl) $.remoteUrl.textContent = '—';
      S.winRef = null;
      return;
    }
    $.status.textContent = 'Open';
    $.status.classList.add('open');
    // Cannot read URL due to SOP — show base URL
    if ($.remoteUrl) $.remoteUrl.textContent = S.baseUrl || '—';
  }

  // =====================
  // TAMPERMONKEY MODAL
  // =====================

  function showTampermonkeyModal() {
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

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px 24px;width:520px;max-width:90vw;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:14px">Tampermonkey Script</span>
          <span id="tm-modal-close" style="cursor:pointer;color:var(--text3);font-size:16px">✕</span>
        </div>
        <div style="font-size:11px;color:var(--text3);line-height:1.5">
          1. Install <a href="https://www.tampermonkey.net/" target="_blank" style="color:var(--accent)">Tampermonkey</a><br>
          2. Click "Create a new script"<br>
          3. Paste the code below and save (Ctrl+S)
        </div>
        <textarea readonly style="background:var(--surface2);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:monospace;font-size:11px;padding:10px;width:100%;height:220px;resize:none;outline:none;white-space:pre">${script.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="tm-copy-btn" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">📋 Copy Script</button>
          <button id="tm-close-btn" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#tm-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#tm-close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('#tm-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(script).then(() => {
        modal.querySelector('#tm-copy-btn').textContent = '✓ Copied';
      }).catch(() => {});
    });
  }

})();