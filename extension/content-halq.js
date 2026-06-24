// content-halq.js — Injected into HALQ web app to expose extension ID
(function() {
  'use strict';
  if (window.top !== window.self) return;
  window.__halqExtensionId = chrome.runtime.id;
  console.log('[HALQ Bridge] Extension ID exposed:', chrome.runtime.id);
})();
