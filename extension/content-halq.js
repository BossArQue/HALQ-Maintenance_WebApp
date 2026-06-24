// content-halq.js — Injected into HALQ page to expose extension ID to page scripts
// v1.0.5: Must inject into main world (isolated world vars are NOT visible to page JS)
(function() {
  'use strict';

  const extId = chrome.runtime.id;

  // Inject a script tag into the page's main world so window.__halqExtensionId
  // is visible to HALQ's af-panel.js
  const script = document.createElement('script');
  script.textContent = `window.__halqExtensionId = '${extId}'; console.log('[HALQ Bridge] Extension ID exposed in main world:', '${extId}');`;
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();

  console.log('[HALQ Bridge] content-halq.js injected main-world script, extId:', extId);
})();
