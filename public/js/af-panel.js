/* ============================================
   FILE: af-panel.js
   PATH: public/js/af-panel.js
   VERSION: 2.5.6
   DESCRIPTION: Browser panel — named window mode for split view. v2.5.6: iframe disabled, uses window.open('appfolio') for SSO compatibility.
   ============================================ */
(function () {
  'use strict';

  // ── State ──
  const S = {
    baseUrl: '',
    activeTab: 'appfolio',
    useIframe: false,   // v2.5.6: iframe is dead for SSO; use named window.open()
    currentWONote: null
  };

  // ── DOM refs ──
  let $ = {};

  function cache() {
    $ = {
      iframe:       document.getElementById('browser-iframe'),
      overlay:      document.getElementById('browser-extension-overlay'),
      notesPreview: document.getElementById('browser-notes-preview'),
      previewTitle: document.getElementById('bn-preview-title'),
      previewBody:  document.getElementById('bn-preview-body'),
      previewEdit:  document.getElementById('bn-preview-edit'),
      urlBar:       document.getElementById('browser-url'),
      tabs:         document.querySelectorAll('.browser-tab'),
      btnBack:      document.getElementById('browser-back'),
      btnForward:   document.getElementById('browser-forward'),
      btnReload:    document.getElementById('browser-reload'),
      btnGo:        document.getElementById('browser-go'),
      btnOpenNew:   document.getElementById('browser-open-new'),
      btnDismiss:   document.getElementById('btn-dismiss-extension-overlay')
    };
  }

  // ── Exports ──
  const API = {
    get baseUrl() { return S.baseUrl; },
    set baseUrl(v) { S.baseUrl = v; _persist(); },
    init, navTo, navReload, autoSearchWO, showOverlay, hideOverlay,
    showWONote, showNotesPreview, showBrowser
  };

  HALQ.af = API;

  // ── Init ──
  function init() {
    cache();
    _load();
    attachListeners();

    // Check if extension is installed by trying a test load
    if ($.overlay) {
      setTimeout(() => {
        if ($.iframe && $.iframe.src !== 'about:blank') {
          hideOverlay();
        }
      }, 2000);
    }

    // Watch for iframe blanking (AppFolio iframe-busting)
    startIframeMonitor();
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

    // Open in new tab (named window for split view reuse)
    if ($.btnOpenNew) {
      $.btnOpenNew.addEventListener('click', () => {
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        const winName = S.activeTab === 'appfolio' ? 'appfolio' : S.activeTab === 'outlook' ? 'outlook' : 'appfolio';
        window.open(url, winName);
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
        if (S.activeTab === 'notes') return; // no-op for notes tab
        if ($.iframe) {
          try { $.iframe.contentWindow.history.back(); } catch (e) {}
        }
      });
    }
    if ($.btnForward) {
      $.btnForward.addEventListener('click', () => {
        if (S.activeTab === 'notes') return;
        if ($.iframe) {
          try { $.iframe.contentWindow.history.forward(); } catch (e) {}
        }
      });
    }
    if ($.btnReload) {
      $.btnReload.addEventListener('click', () => {
        if (S.activeTab === 'notes') {
          if (S.currentWONote) showWONote(S.currentWONote);
          return;
        }
        navReload();
      });
    }

    // Tab switching
    $.tabs?.forEach(tab => {
      tab.addEventListener('click', () => {
        $.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        S.activeTab = tab.dataset.name;
        const url = tab.dataset.url || '';

        if (S.activeTab === 'notes') {
          showNotesPreview();
          return;
        }

        showBrowser();
        if (url) {
          S.baseUrl = url;
          _persist();
          if ($.urlBar) $.urlBar.value = url;
        }

        // v2.5.6: Use named window instead of iframe (SSO dead)
        if (!S.useIframe) {
          const winName = S.activeTab === 'appfolio' ? 'appfolio' : S.activeTab;
          if (winName) window.open(url || 'about:blank', winName);
          return;
        }

        if ($.iframe) {
          $.iframe.src = url || 'about:blank';
          hideOverlay();
        }
      });
    });

    // Edit button in notes preview → open full Notes view
    if ($.previewEdit) {
      $.previewEdit.addEventListener('click', () => {
        HALQ.app.switchView('notes');
        if (S.currentWONote && HALQ.notes && HALQ.notes.openWO) {
          HALQ.notes.openWO(S.currentWONote);
        }
      });
    }
  }

  // =====================
  // TAB DISPLAY
  // =====================

  function showBrowser() {
    if ($.iframe) $.iframe.style.display = '';
    if ($.overlay) $.overlay.style.display = 'none';
    if ($.notesPreview) $.notesPreview.style.display = 'none';
    if ($.urlBar) $.urlBar.disabled = false;
  }

  function showNotesPreview() {
    if ($.iframe) $.iframe.style.display = 'none';
    if ($.overlay) $.overlay.style.display = 'none';
    if ($.notesPreview) $.notesPreview.style.display = '';
    if ($.urlBar) $.urlBar.disabled = true;
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

    // v2.5.6: iframe is dead; always use named window.open
    if (S.useIframe && $.iframe) {
      $.iframe.src = url;
      hideOverlay();
    } else {
      window.open(url, 'appfolio');
    }
  }

  // =====================
  // WO NOTE PREVIEW
  // =====================

  async function showWONote(woNum) {
    if (!woNum) return;
    S.currentWONote = woNum;

    // Ensure notes preview is visible
    showNotesPreview();
    // Activate notes tab
    $.tabs?.forEach(t => t.classList.remove('active'));
    const notesTab = document.querySelector('.browser-tab[data-name="notes"]');
    if (notesTab) notesTab.classList.add('active');
    S.activeTab = 'notes';

    if ($.previewTitle) $.previewTitle.textContent = woNum;
    if ($.previewBody) {
      $.previewBody.innerHTML = '<div class="bn-preview-loading">⏳ Loading note…</div>';
    }

    try {
      const res = await HALQ.apiGet(`/notes/wo/${encodeURIComponent(woNum)}`);
      if (res.ok && res.data) {
        const content = res.data.content || '';
        if ($.previewBody) {
          $.previewBody.innerHTML = content
            ? `<div class="bn-preview-content">${content}</div>`
            : '<div class="bn-preview-empty">No note yet. Click ✎ to add one.</div>';
        }
      } else {
        if ($.previewBody) $.previewBody.innerHTML = '<div class="bn-preview-empty">Failed to load note</div>';
      }
    } catch (e) {
      console.error('[AF] showWONote error:', e);
      if ($.previewBody) $.previewBody.innerHTML = '<div class="bn-preview-empty">Error loading note</div>';
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

  function showExtensionOverlay(message) {
    showOverlay();
    const box = $.overlay.querySelector('.browser-extension-box');
    if (!box) return;
    // Find the message area and replace with custom message
    const paragraphs = box.querySelectorAll('div');
    // The 3rd div (index 2) is the main message, index 3 is the install steps
    if (paragraphs[2]) {
      paragraphs[2].innerHTML = message;
    }
    // Hide the install steps
    if (paragraphs[3]) paragraphs[3].style.display = 'none';
    // Change button text
    const btn = document.getElementById('btn-dismiss-extension-overlay');
    if (btn) {
      btn.textContent = 'Open AppFolio in New Tab';
      btn.onclick = () => {
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        window.open(url, 'appfolio');
      };
    }
  }

  // =====================
  // IFRAME HEALTH MONITOR
  // =====================
  function startIframeMonitor() {
    if (!$.iframe) return;
    let lastSrc = $.iframe.src;
    let blankCount = 0;
    let redirectLoopDetected = false;

    const iv = setInterval(() => {
      if (!$.iframe) { clearInterval(iv); return; }

      // Check 1: src changed to about:blank after having content
      const current = $.iframe.src;
      if (current === 'about:blank' && lastSrc !== 'about:blank') {
        blankCount++;
        if (blankCount >= 2) {
          showExtensionOverlay('AppFolio blocked the iframe. SSO login in iframes is limited by modern browser security.');
          clearInterval(iv);
          return;
        }
      } else if (current !== 'about:blank') {
        blankCount = 0;
      }
      lastSrc = current;

      // Check 2: Chrome net-error page (ERR_TOO_MANY_REDIRECTS)
      try {
        const iframeDoc = $.iframe.contentDocument || $.iframe.contentWindow?.document;
        if (iframeDoc) {
          const body = iframeDoc.body;
          if (body && body.classList.contains('neterror')) {
            const errorCode = iframeDoc.querySelector('.error-code');
            const errorText = errorCode ? errorCode.textContent : '';
            if (!redirectLoopDetected) {
              redirectLoopDetected = true;
              console.log('[HALQ AF] Detected Chrome net-error:', errorText);
              showExtensionOverlay(
                '<strong>AppFolio login requires a new tab</strong><br>' +
                '<span style="font-size:11px">' +
                'Chrome blocks third-party cookies in iframes, causing a redirect loop.<br>' +
                'Open AppFolio in a new tab, log in, then return here.' +
                '</span>'
              );
              clearInterval(iv);
            }
          }
        }
      } catch (e) {
        // cross-origin access error — expected for AppFolio before extension strips headers
      }
    }, 1500);
  }

})();
