// content.js — Injected into AppFolio pages at document_start
// Runs in the extension's isolated world, then injects code into the page context

(function() {
  'use strict';

  // Only run inside iframes
  if (window.top === window.self) return;

  const LOG = '[HALQ Extension]';
  const PATCH = '[HALQ Patch]';
  const url = window.location.href;

  console.log(`${LOG} Content script running in iframe:`, url);
  console.log(`${LOG} frameElement:`, window.frameElement);
  console.log(`${LOG} parent === self:`, window.parent === window.self);
  console.log(`${LOG} top === self:`, window.top === window.self);
  console.log(`${LOG} opener:`, window.opener);

  // ── Inject a script directly into the page context (main world) ──
  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
    (function() {
      'use strict';

      if (window.self === window.top) return;

      const PATCH = '[HALQ Patch]';
      const url = window.location.href;

      function log(label, detail) {
        console.log(PATCH, label, detail !== undefined ? detail : '');
      }
      function warn(label, detail) {
        console.warn(PATCH, label, detail !== undefined ? detail : '');
      }

      log('Running in page context for iframe', url);

      // ── Patch 1: Override window.self so window.self === window.top ──
      try {
        Object.defineProperty(window, 'self', {
          get: () => window.top,
          configurable: true
        });
        log('window.self override applied');
      } catch (e) {
        warn('window.self override failed:', e.message);
      }

      // ── Patch 2: Override window.parent to return self ──
      try {
        Object.defineProperty(window, 'parent', {
          get: () => window,
          configurable: true
        });
        log('window.parent override applied');
      } catch (e) {
        warn('window.parent override failed:', e.message);
      }

      // ── Patch 2b: Override window.frameElement to return null ──
      try {
        Object.defineProperty(window, 'frameElement', {
          get: () => null,
          configurable: true
        });
        log('window.frameElement override applied (returns null)');
      } catch (e) {
        warn('window.frameElement override failed:', e.message);
      }

      // ── Patch 2c: Override window.opener to return null ──
      try {
        Object.defineProperty(window, 'opener', {
          get: () => null,
          configurable: true
        });
        log('window.opener override applied (returns null)');
      } catch (e) {
        warn('window.opener override failed:', e.message);
      }

      // ── Patch 3: Block document.body setter from nullifying ──
      try {
        const orig = Object.getOwnPropertyDescriptor(Document.prototype, 'body');
        if (orig && orig.set) {
          Object.defineProperty(Document.prototype, 'body', {
            set: function(val) {
              if (val === null || val === '') {
                warn('BLOCKED body nullification');
                return;
              }
              return orig.set.call(this, val);
            },
            get: orig.get,
            configurable: true
          });
          log('document.body setter patched');
        }
      } catch (e) {
        warn('body setter patch failed:', e.message);
      }

      // ── Patch 4: Block innerHTML blanking on documentElement and body ──
      try {
        const orig = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (orig && orig.set) {
          ['documentElement', 'body', 'head'].forEach(function(prop) {
            try {
              const target = document[prop] || document.documentElement;
              Object.defineProperty(target, 'innerHTML', {
                set: function(val) {
                  if (val === null || val === '' || (typeof val === 'string' && val.trim() === '')) {
                    warn('BLOCKED innerHTML blanking on ' + prop);
                    return;
                  }
                  return orig.set.call(this, val);
                },
                get: orig.get,
                configurable: true
              });
            } catch (e2) {
              warn('innerHTML patch on ' + prop + ' failed:', e2.message);
            }
          });
          log('innerHTML blanking patches applied');
        }
      } catch (e) {
        warn('innerHTML patch failed:', e.message);
      }

      // ── Patch 5: Block top.location redirects ──
      try {
        Object.defineProperty(window.top, 'location', {
          get: () => window.location,
          set: (val) => { window.location = val; },
          configurable: true
        });
        log('top.location redirect patch applied');
      } catch (e) {
        warn('top.location patch failed:', e.message);
      }

      // ── Patch 6: Block removeChild / remove on body/documentElement ──
      try {
        const origRemove = Element.prototype.remove;
        Element.prototype.remove = function() {
          if (this === document.body || this === document.documentElement) {
            warn('BLOCKED remove() on', this.tagName);
            return;
          }
          return origRemove.call(this);
        };

        const origRemoveChild = Node.prototype.removeChild;
        Node.prototype.removeChild = function(child) {
          if (child === document.body || child === document.documentElement) {
            warn('BLOCKED removeChild on', child.tagName);
            return child;
          }
          return origRemoveChild.call(this, child);
        };
        log('remove/removeChild patches applied');
      } catch (e) {
        warn('remove/removeChild patch failed:', e.message);
      }

      // ── Patch 7: Aggressive visibility CSS ──
      try {
        const style = document.createElement('style');
        style.id = 'halq-anti-blank-css';
        style.textContent = \`
          /* Force visibility on ALL elements */
          * { visibility: visible !important; opacity: 1 !important; }
          html, body {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            height: auto !important;
            min-height: 100vh !important;
            overflow: auto !important;
          }
          /* Force common hidden root containers visible */
          #root, #app, #__next, #__nuxt, [data-reactroot], [data-react-app], [id*="root" i], [id*="app" i] {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            height: auto !important;
            min-height: 100vh !important;
          }
        \`;
        document.head.appendChild(style);
        log('Aggressive visibility CSS injected');
      } catch (e) {
        warn('CSS injection failed:', e.message);
      }

      // ── Patch 8: MutationObserver that actively restores content ──
      try {
        let lastGoodBody = '';
        let lastGoodHtml = '';
        let blankDetectedAt = 0;
        const RESTORE_DELAY = 50; // ms

        function saveSnapshot() {
          try {
            if (document.body) lastGoodBody = document.body.innerHTML;
            lastGoodHtml = document.documentElement.innerHTML;
          } catch (e) {}
        }

        function forceRootVisible() {
          const selectors = ['#root', '#app', '#__next', '#__nuxt', '[data-reactroot]', '[data-react-app]'];
          selectors.forEach(function(sel) {
            try {
              const el = document.querySelector(sel);
              if (el) {
                el.style.setProperty('display', 'block', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.style.setProperty('opacity', '1', 'important');
                el.style.setProperty('height', 'auto', 'important');
                el.style.setProperty('min-height', '100vh', 'important');
              }
            } catch (e) {}
          });
        }

        function restoreContent() {
          try {
            if (document.body && document.body.innerHTML === '' && lastGoodBody && lastGoodBody !== '') {
              warn('RESTORING body content from snapshot');
              document.body.innerHTML = lastGoodBody;
              forceRootVisible();
            }
            if (document.documentElement && document.documentElement.innerHTML === '' && lastGoodHtml && lastGoodHtml !== '') {
              warn('RESTORING documentElement from snapshot');
              document.documentElement.innerHTML = lastGoodHtml;
              forceRootVisible();
            }
            // Also re-inject CSS if <head> was wiped
            if (!document.getElementById('halq-anti-blank-css')) {
              warn('Re-injecting anti-blank CSS');
              const s = document.createElement('style');
              s.id = 'halq-anti-blank-css';
              s.textContent = \`
                * { visibility: visible !important; opacity: 1 !important; }
                html, body { display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important; min-height: 100vh !important; overflow: auto !important; }
                #root, #app, #__next, #__nuxt, [data-reactroot], [data-react-app], [id*="root" i], [id*="app" i] { display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important; min-height: 100vh !important; }
              \`;
              (document.head || document.documentElement).appendChild(s);
            }
          } catch (e) {
            warn('restoreContent failed:', e.message);
          }
        }

        const observer = new MutationObserver(function(mutations) {
          let hasRemoval = false;
          let hasBlankRoot = false;

          mutations.forEach(function(m) {
            if (m.type === 'childList') {
              if (m.removedNodes.length > 0) hasRemoval = true;
            }
          });

          // Detect if body or root containers became empty
          try {
            const body = document.body;
            if (body && body.innerHTML === '') hasBlankRoot = true;
            const root = document.getElementById('root') || document.getElementById('app');
            if (root && root.innerHTML === '') hasBlankRoot = true;
          } catch (e) {}

          if (hasRemoval || hasBlankRoot) {
            if (!blankDetectedAt) blankDetectedAt = Date.now();
            warn('Detected content removal/blanking, will restore in ' + RESTORE_DELAY + 'ms');
            setTimeout(restoreContent, RESTORE_DELAY);
          } else {
            saveSnapshot();
            blankDetectedAt = 0;
          }

          forceRootVisible();
        });

        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        log('MutationObserver active: restores content on blanking');

        // Periodic re-check every 500ms for the first 10 seconds
        let checkCount = 0;
        const interval = setInterval(function() {
          checkCount++;
          try {
            const body = document.body;
            const html = document.documentElement;
            if (body && body.innerHTML === '' && lastGoodBody && lastGoodBody !== '') {
              warn('Periodic check: body is blank, restoring');
              restoreContent();
            }
            if (html && html.innerHTML === '' && lastGoodHtml && lastGoodHtml !== '') {
              warn('Periodic check: html is blank, restoring');
              restoreContent();
            }
            forceRootVisible();
          } catch (e) {}
          if (checkCount >= 20) clearInterval(interval);
        }, 500);
      } catch (e) {
        warn('MutationObserver setup failed:', e.message);
      }

      // ── Patch 9: Fallback visible message after 5 seconds if still blank ──
      try {
        setTimeout(function() {
          try {
            const body = document.body;
            const html = document.documentElement;
            const isBlank = (!body || body.innerHTML === '') && (!html || html.innerHTML === '');
            if (isBlank) {
              warn('Page still blank after 5s — injecting fallback visible message');
              const fallback = document.createElement('div');
              fallback.id = 'halq-fallback-message';
              fallback.innerHTML = '<div style="padding:40px; text-align:center; font-family:sans-serif; background:#fff; color:#333; border:2px solid #9333ea; border-radius:8px; max-width:600px; margin:40px auto;"><h2 style="color:#9333ea; margin-bottom:12px;">AppFolio loaded in iframe</h2><p style="font-size:16px; line-height:1.5;">The page is running inside an iframe. If you see a blank page, the site may be using frame-busting detection. The HALQ extension has applied anti-blanking patches.</p><p style="font-size:14px; color:#666; margin-top:12px;">URL: ' + url + '</p></div>';
              fallback.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:2147483647; background:#f8f9fa; overflow:auto;';
              (document.body || document.documentElement).appendChild(fallback);
              log('Fallback message injected');
            } else {
              log('Page has content after 5s — no fallback needed');
            }
          } catch (e) {
            warn('Fallback injection failed:', e.message);
          }
        }, 5000);
      } catch (e) {
        warn('Fallback timer setup failed:', e.message);
      }

      log('All patches applied successfully');
    })();
  `;
  inlineScript.onload = () => inlineScript.remove();
  (document.head || document.documentElement).appendChild(inlineScript);

  // ── Isolated-world fallback CSS and periodic checks ──
  try {
    const extStyle = document.createElement('style');
    extStyle.id = 'halq-ext-css';
    extStyle.textContent = `
      * { visibility: visible !important; opacity: 1 !important; }
      html, body {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        min-height: 100vh !important;
        overflow: auto !important;
      }
      #root, #app, #__next, #__nuxt, [data-reactroot], [data-react-app], [id*="root" i], [id*="app" i] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        min-height: 100vh !important;
      }
      body:empty::before {
        content: "AppFolio is loading…";
        display: block;
        text-align: center;
        padding-top: 100px;
        color: #333;
        font-family: sans-serif;
        font-size: 18px;
      }
    `;
    document.head.appendChild(extStyle);
    console.log(`${LOG} Isolated-world CSS injected`);
  } catch (e) {
    console.warn(`${LOG} Isolated-world CSS failed:`, e.message);
  }

  // Isolated-world periodic re-check for root visibility
  try {
    let checks = 0;
    const iv = setInterval(() => {
      checks++;
      try {
        const selectors = ['#root', '#app', '#__next', '#__nuxt', '[data-reactroot]', '[data-react-app]'];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const computed = getComputedStyle(el);
            if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
              console.warn(`${LOG} Isolated world detected hidden root element: ${sel}`);
              el.style.setProperty('display', 'block', 'important');
              el.style.setProperty('visibility', 'visible', 'important');
              el.style.setProperty('opacity', '1', 'important');
              el.style.setProperty('height', 'auto', 'important');
              el.style.setProperty('min-height', '100vh', 'important');
            }
          }
        }
      } catch (e) {}
      if (checks >= 20) clearInterval(iv);
    }, 500);
  } catch (e) {}

})();
