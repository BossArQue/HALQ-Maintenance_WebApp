// ==UserScript==
// @name         HALQ AppFolio Auto-Click
// @namespace    halq
// @version      1.0
// @description  Auto-click the first WO result when HALQ opens AppFolio search
// @match        *://talley.appfolio.com/search/advanced_search*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // Only auto-click if HALQ triggered this search
  const url = new URL(window.location.href);
  const search = url.searchParams.get('full_text_search');
  if (!search) return;

  // Wait for results to appear
  const observer = new MutationObserver(() => {
    const link = document.querySelector('a[href*="/service_requests/"]');
    if (link) {
      link.click();
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Fallback: after 5 seconds, try once more
  setTimeout(() => {
    const link = document.querySelector('a[href*="/service_requests/"]');
    if (link) link.click();
  }, 5000);

})();
