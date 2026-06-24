/* ============================================
   FILE: af-panel.js
   PATH: public/js/af-panel.js
   VERSION: 2.5.7
   DESCRIPTION: Browser panel — extension bridge for split view. v2.5.7: Uses chrome.runtime.sendMessage to extension for cross-tab navigation in split views.
   ============================================ */
(function () {
  'use strict';

  // ── State ──
  const S = {
    baseUrl: '',
    activeTab: 'appfolio',
    useIframe: false,
    currentWONote: null,
    extId: null
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

  // ── Extension Bridge ──
  function detectExtension() {
    const el = document.getElementById('halq-extension-data');
    const id = el?.dataset.extensionId;
    if (id && id !== S.extId) {
      S.extId = id;
      console.log('[HALQ AF] Extension detected from DOM, ID:', S.extId);
    }
    return S.extId;
  }

  function sendToExtension(url, target) {
    const extId = detectExtension();
    if (!extId) {
      console.log('[HALQ AF] Extension not found, falling back to window.open');
      window.open(url, '_blank');
      return;
    }
    console.log('[HALQ AF] Sending to extension:', extId, 'url:', url, 'target:', target);
    chrome.runtime.sendMessage(extId, {
      action: 'navigate',
      data: { url: url, target: target || 'appfolio' }
    }, (res) => {
      if (chrome.runtime.lastError) {
        console.error('[HALQ AF] Extension error:', chrome.runtime.lastError.message);
        window.open(url, '_blank');
        return;
      }
      console.log('[HALQ AF] Extension response:', res);
      if (res && res.ok) {
        console.log('[HALQ AF] Extension navigated tab', res.tabId, res.created ? '(created)' : '(updated)');
      } else {
        console.error('[HALQ AF] Extension failed:', res?.error);
        window.open(url, '_blank');
      }
    });
  }

  // ── Init ──
  function init() {
    cache();
    _load();
    attachListeners();

    // Poll for extension ID (in case extension loads after page)
    detectExtension();
    const poll = setInterval(() => {
      if (detectExtension()) {
        clearInterval(poll);
      }
    }, 500);
    setTimeout(() => clearInterval(poll), 10000);

    if ($.overlay) {
      setTimeout(() => {
        if ($.iframe && $.iframe.src !== 'about:blank') {
          hideOverlay();
        }
      }, 2000);
    }

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
    if ($.urlBar) {
      $.urlBar.addEventListener('keydown', e => {
        if (e.key === 'Enter') navTo($.urlBar.value);
      });
    }

    if ($.btnGo) {
      $.btnGo.addEventListener('click', () => navTo($.urlBar.value));
    }

    if ($.btnOpenNew) {
      $.btnOpenNew.addEventListener('click', () => {
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        sendToExtension(url, S.activeTab);
      });
    }

    if ($.btnDismiss) {
      $.btnDismiss.addEventListener('click', () => {
        hideOverlay();
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        window.open(url, '_blank');
      });
    }

    if ($.btnBack) {
      $.btnBack.addEventListener('click', () => {
        if (S.activeTab === 'notes') return;
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

        sendToExtension(url || 'about:blank', S.activeTab);
      });
    });

    if ($.previewEdit) {
      $.previewEdit.addEventListener('click', () => {
        HALQ.app.switchView('notes');
        if (S.currentWONote && HALQ.notes && HALQ.notes.openWO) {
          HALQ.notes.openWO(S.currentWONote);
        }
      });
    }
  }

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

  function navTo(url) {
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    S.baseUrl = url;
    _persist();
    if ($.urlBar) $.urlBar.value = url;
    sendToExtension(url, S.activeTab);
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

    sendToExtension(url, 'appfolio');
  }

  async function showWONote(woNum) {
    if (!woNum) return;
    S.currentWONote = woNum;

    showNotesPreview();
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
    const paragraphs = box.querySelectorAll('div');
    if (paragraphs[2]) {
      paragraphs[2].innerHTML = message;
    }
    if (paragraphs[3]) paragraphs[3].style.display = 'none';
    const btn = document.getElementById('btn-dismiss-extension-overlay');
    if (btn) {
      btn.textContent = 'Open AppFolio in New Tab';
      btn.onclick = () => {
        const url = S.baseUrl || 'https://talley.appfolio.com/search/advanced_search';
        window.open(url, '_blank');
      };
    }
  }

  function startIframeMonitor() {
    if (!$.iframe) return;
    let lastSrc = $.iframe.src;
    let blankCount = 0;
    let redirectLoopDetected = false;

    const iv = setInterval(() => {
      if (!$.iframe) { clearInterval(iv); return; }

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
      } catch (e) {}
    }, 1500);
  }

})();
