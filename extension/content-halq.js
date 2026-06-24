// content-halq.js — Injected into HALQ page to expose extension ID
// v1.0.5b: DOM element approach (bypasses CSP). Content script creates a hidden div
// with data-extension-id, page reads it. No script injection needed.
(function() {
  'use strict';

  function inject() {
    const el = document.createElement('div');
    el.id = 'halq-extension-data';
    el.style.display = 'none';
    el.dataset.extensionId = chrome.runtime.id;
    (document.body || document.documentElement).appendChild(el);
    console.log('[HALQ Bridge] Extension ID set in DOM:', chrome.runtime.id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
