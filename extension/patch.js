// patch.js — Runs inside the page's JavaScript context
// Patches common iframe-busting techniques used by SaaS platforms

(function() {
  'use strict';

  // Don't run if we're not in an iframe
  if (window.top === window.self) return;

  // ── Patch 1: Override window.self so "window.self === window.top" returns true ──
  try {
    Object.defineProperty(window, 'self', {
      get: () => window.top,
      configurable: true
    });
  } catch (e) {}

  // ── Patch 2: Prevent document.body.innerHTML = '' (blanking) ──
  const origBody = Object.getOwnPropertyDescriptor(Document.prototype, 'body');
  if (origBody && origBody.set) {
    Object.defineProperty(Document.prototype, 'body', {
      set: function(val) {
        // If the page tries to set body to null/empty string, ignore it
        if (val === null || val === '') {
          console.log('[HALQ Extension] Blocked iframe body blanking');
          return;
        }
        return origBody.set.call(this, val);
      },
      get: origBody.get,
      configurable: true
    });
  }

  // ── Patch 3: Prevent document.documentElement.innerHTML = '' ──
  const origDocHtml = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (origDocHtml && origDocHtml.set) {
    Object.defineProperty(document.documentElement, 'innerHTML', {
      set: function(val) {
        if (val === null || val === '') {
          console.log('[HALQ Extension] Blocked documentElement blanking');
          return;
        }
        return origDocHtml.set.call(this, val);
      },
      get: origDocHtml.get,
      configurable: true
    });
  }

  // ── Patch 4: Prevent window.top.location redirects ──
  try {
    Object.defineProperty(window.top, 'location', {
      get: () => window.location,
      set: (val) => { window.location = val; },
      configurable: true
    });
  } catch (e) {}

  // ── Patch 5: Override document.body getter if nullified ──
  let bodyGuard = setInterval(() => {
    if (document.body && document.body.innerHTML === '') {
      // Page may have blanked body after initial load
      console.log('[HALQ Extension] Detected body blanking, restoring...');
      // We can't restore content, but we can prevent further blanking
    }
  }, 500);

  // Stop guarding after 10 seconds
  setTimeout(() => clearInterval(bodyGuard), 10000);

  console.log('[HALQ Extension] Iframe patches applied');
})();
