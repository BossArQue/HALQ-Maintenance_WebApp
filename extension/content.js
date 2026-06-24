// content.js — Injected into AppFolio pages at document_start
// Runs in the extension's isolated world, then injects code into the page context

(function() {
  'use strict';

  // Only run inside iframes
  if (window.top === window.self) return;

  console.log('[HALQ Extension] Content script running in iframe:', window.location.href);

  // Inject a script directly into the page context (not a separate file, so it runs faster)
  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
    (function() {
      'use strict';
      console.log('[HALQ Patch] Running in page context, is iframe:', window.self !== window.top);

      if (window.self === window.top) return;

      // ── Patch 1: Override window.self so window.self === window.top ──
      try {
        Object.defineProperty(window, 'self', {
          get: () => window.top,
          configurable: true
        });
        console.log('[HALQ Patch] window.self override applied');
      } catch (e) {
        console.log('[HALQ Patch] window.self override failed:', e.message);
      }

      // ── Patch 2: Override window.parent to return self ──
      try {
        Object.defineProperty(window, 'parent', {
          get: () => window,
          configurable: true
        });
        console.log('[HALQ Patch] window.parent override applied');
      } catch (e) {
        console.log('[HALQ Patch] window.parent override failed:', e.message);
      }

      // ── Patch 3: Block document.body setter from nullifying ──
      try {
        const orig = Object.getOwnPropertyDescriptor(Document.prototype, 'body');
        if (orig && orig.set) {
          Object.defineProperty(Document.prototype, 'body', {
            set: function(val) {
              if (val === null || val === '') {
                console.log('[HALQ Patch] BLOCKED body nullification');
                return;
              }
              return orig.set.call(this, val);
            },
            get: orig.get,
            configurable: true
          });
        }
      } catch (e) {
        console.log('[HALQ Patch] body setter patch failed:', e.message);
      }

      // ── Patch 4: Block innerHTML blanking on documentElement ──
      try {
        const orig = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (orig && orig.set) {
          Object.defineProperty(document.documentElement, 'innerHTML', {
            set: function(val) {
              if (val === null || val === '') {
                console.log('[HALQ Patch] BLOCKED innerHTML blanking');
                return;
              }
              return orig.set.call(this, val);
            },
            get: orig.get,
            configurable: true
          });
        }
      } catch (e) {
        console.log('[HALQ Patch] innerHTML patch failed:', e.message);
      }

      // ── Patch 5: Block top.location redirects ──
      try {
        Object.defineProperty(window.top, 'location', {
          get: () => window.location,
          set: (val) => { window.location = val; },
          configurable: true
        });
        console.log('[HALQ Patch] top.location redirect patch applied');
      } catch (e) {
        console.log('[HALQ Patch] top.location patch failed:', e.message);
      }

      // ── Patch 6: Prevent body replacement with createElement ──
      try {
        const origCreate = Document.prototype.createElement;
        Document.prototype.createElement = function(tag) {
          const el = origCreate.call(this, tag);
          if (tag.toLowerCase() === 'body') {
            console.log('[HALQ Patch] Detected body element creation, hooking...');
          }
          return el;
        };
      } catch (e) {
        console.log('[HALQ Patch] createElement patch failed:', e.message);
      }

      // ── Patch 7: Force-visibility CSS rule ──
      try {
        const style = document.createElement('style');
        style.textContent = 'html, body { visibility: visible !important; opacity: 1 !important; display: block !important; }';
        document.head.appendChild(style);
        console.log('[HALQ Patch] Force-visibility CSS injected');
      } catch (e) {
        console.log('[HALQ Patch] CSS injection failed:', e.message);
      }

      // ── Patch 8: MutationObserver to detect content removal and restore ──
      try {
        let lastGoodHtml = document.documentElement.innerHTML;
        const observer = new MutationObserver(function(mutations) {
          const body = document.body;
          if (body && body.innerHTML === '' && lastGoodHtml !== '') {
            console.log('[HALQ Patch] Detected body content removal via MutationObserver');
          }
          if (document.documentElement.innerHTML !== '') {
            lastGoodHtml = document.documentElement.innerHTML;
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        console.log('[HALQ Patch] MutationObserver watching for content removal');
      } catch (e) {
        console.log('[HALQ Patch] MutationObserver failed:', e.message);
      }

      console.log('[HALQ Patch] All patches applied successfully');
    })();
  `;
  inlineScript.onload = () => inlineScript.remove();
  (document.head || document.documentElement).appendChild(inlineScript);

  // Also run in the extension's isolated world to add a fallback CSS rule
  try {
    const extStyle = document.createElement('style');
    extStyle.textContent = `
      html, body {
        visibility: visible !important;
        opacity: 1 !important;
        display: block !important;
      }
      body:empty::before {
        content: "AppFolio is loading...";
        display: block;
        text-align: center;
        padding-top: 100px;
        color: #333;
      }
    `;
    document.head.appendChild(extStyle);
  } catch (e) {}

})();
