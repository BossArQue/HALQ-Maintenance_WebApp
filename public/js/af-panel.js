/* ============================================
   FILE: af-panel.js
   PATH: public/js/af-panel.js
   VERSION: 2.5.0
   DESCRIPTION: Browser panel — iframe-based with extension support.
                Navigates iframe via src changes. Falls back to window.open().
   ============================================ */
(function () {
  'use strict';

  // ── State ──
  const S = {
    baseUrl: '',
    activeTab: 'appfolio',
    useIframe: true
  };

  // ── DOM refs ──
  let $ = {};

  function cache() {
    $ = {
      iframe:     document.getElementById('browser-iframe'),
      overlay:    document.getElementById('browser-extension-overlay'),
      urlBar:     document.getElementById('browser-url'),
      tabs:       document.querySelectorAll('.browser-tab'),
      btnBack:    document.getElementById('browser-back'),
      btnForward: document.getElementById('browser-forward'),
      btnReload:  document.getElementById('browser-reload'),
      btnGo:      document.getElementById('browser-go'),
      btnOpenNew: document.getElementById('browser-open-new'),
      btnDismiss: document.getElementById('btn-dismiss-extension-overlay')
    };
  }

  // ── Exports ──
  const API = {
    get baseUrl() { return S.baseUrl; },
    set baseUrl(v) { S.baseUrl = v; _persist(); },
    init, navTo, navReload, autoSearchWO, showOverlay, hideOverlay
  };

  HALQ.af = API;

  // ── Init ──
  function init() {
    cache();
    _load();
    attachListeners();

    // Check if extension is installed by trying a test load
    // (We can't detect it reliably, so show overlay until user dismisses or loads successfully)
    if ($.overlay) {
      // Show overlay briefly; hide if iframe has loaded content after 2s
      setTimeout(() => {
        if ($.iframe && $.iframe.src !== 'about:blank') {
          hideOverlay();
        }
      }, 2000);
    }
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
    if ($.btnOpenNew) {
      $.btnOpenNew.addEventListener('click', () => {
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        window.open(url, '_blank');
      });
    }

    // Dismiss overlay → fallback to window.open mode
    if ($.btnDismiss) {
      $.btnDismiss.addEventListener('click', () => {
        S.useIframe = false;
        hideOverlay();
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        window.open(url, 'appfolio');
      });
    }

    // Back / Forward / Reload
    if ($.btnBack) {
      $.btnBack.addEventListener('click', () => {
        if ($.iframe) {
          try { $.iframe.contentWindow.history.back(); } catch (e) {}
        }
      });
    }
    if ($.btnForward) {
      $.btnForward.addEventListener('click', () => {
        if ($.iframe) {
          try { $.iframe.contentWindow.history.forward(); } catch (e) {}
        }
      });
    }
    if ($.btnReload) {
      $.btnReload.addEventListener('click', navReload);
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
        // Navigate iframe
        if ($.iframe) {
          $.iframe.src = url || 'about:blank';
          hideOverlay();
        }
      });
    });
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

    if (S.useIframe && $.iframe) {
      $.iframe.src = url;
      hideOverlay();
    } else {
      window.open(url, 'appfolio');
    }
  }

  function navReload() {
    if ($.iframe) {
      try { $.iframe.contentWindow.location.reload(); } catch (e) {
        // Fallback: reset src
        const current = $.iframe.src;
        $.iframe.src = 'about:blank';
        setTimeout(() => { $.iframe.src = current; }, 50);
      }
    }
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

    if (S.useIframe && $.iframe) {
      $.iframe.src = url;
      hideOverlay();
    } else {
      window.open(url, 'appfolio');
    }
  }

  // =====================
  // OVERLAY
  // =====================

  function showOverlay() {
    if ($.overlay) $.overlay.style.display = '';
  }

  function hideOverlay() {
    if ($.overlay) $.overlay.style.display = 'none';
  }

})();