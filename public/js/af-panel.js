/* ============================================
   FILE: af-panel.js
   PATH: public/js/af-panel.js
   VERSION: 2.5.3
   DESCRIPTION: Browser panel — iframe-based with extension support. Tab switching (AppFolio/Outlook/Notes). WO note preview in middle panel.
   ============================================ */
(function () {
  'use strict';

  // ── State ──
  const S = {
    baseUrl: '',
    activeTab: 'appfolio',
    useIframe: true,
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

    // Switch to AppFolio tab if not already there
    const afTab = document.querySelector('.browser-tab[data-name="appfolio"]');
    if (afTab && S.activeTab !== 'appfolio') {
      afTab.click();
    }

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

})();
