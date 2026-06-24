# HALQ — Next Chat Summary

> **Session:** 2026-06-24
> **Version:** v2.5.5
> **Status:** Browser panel dead → Rebuilding as WO Context Panel
> **Ponytail:** ON — Laziest solution that works. See Rule 8 in HALQ_ONE_TRUE_FILE.md.
> **Repo:** https://github.com/BossArQue/HALQ-Maintenance_WebApp
> **Branch:** `main`
> **Commit:** `3badd0b` (PIN fix) + `2.5.5` bump pending push
> **Deploy:** Cloudflare Pages auto-deploys on push.

---

## What Was Done

### v2.5.3 → v2.5.5 — Browser Panel Fix Attempt

**Goal:** Make the embedded browser panel (middle panel) load AppFolio inside an iframe.

**Result:** FAILED. Chrome's third-party cookie blocking makes SSO login impossible in a cross-origin iframe. The iframe loads AppFolio but enters an infinite redirect loop (`ERR_TOO_MANY_REDIRECTS`) because the login session cookie is blocked.

**What was tried (all failed):**

| Attempt | What | Why It Failed |
|---------|------|---------------|
| 1 | Extension strips `X-Frame-Options` and `CSP` headers | AppFolio redirects to `account.appfolio.com` for SSO; the extension only covered `talley.appfolio.com` |
| 2 | Extension broadened to `*.appfolio.com` | Extension works, but Chrome blocks third-party cookies in cross-origin iframes. AppFolio sets session cookie on login → redirect back → cookie missing → redirect to login again → infinite loop |
| 3 | Content script patches `window.self`, `window.parent`, `window.frameElement` | AppFolio's JavaScript iframe-busting was patched, but the redirect loop is a **cookie policy issue**, not a JavaScript issue |
| 4 | Content script + MutationObserver + aggressive CSS | Same root cause: cookies blocked |
| 5 | Net-error detection in `af-panel.js` | Shows overlay with "Open in New Tab" button. This is the honest fallback, but the iframe itself still doesn't work for SSO sites |
| 6 | Cache-busting query params (`?v=2.5.4`) | Ensures browsers load fresh JS. Didn't fix the fundamental issue |

**The Real Problem:** Chrome's third-party cookie blocking is a **deliberate security feature**. No extension, no script, no hack can bypass it for SSO login flows. The iframe approach is fundamentally incompatible with modern SaaS platforms that use OAuth/SSO.

**Lesson:** Don't try to embed SSO sites in iframes. Use a launcher or integrate at the data level instead.

---

### v2.5.5 — PIN Overlay Removed

**Bug:** Broken PIN lock overlay appeared as raw unstyled HTML in random positions when clicking work orders. The PIN had no CSS styling and the auto-lock logic was unreliable.

**Fix:** Removed auto-lock behavior from `settings.js`. Added `display: none !important` to `.pin-overlay` in CSS. The PIN feature can be re-implemented properly later if needed.

---

## Current State (Before Context Panel Rebuild)

| Panel | Status | Purpose |
|-------|--------|---------|
| **Left** | ✅ Working | WO list, search, filters, categories |
| **Middle** | ❌ Dead | Browser iframe — white screen for AppFolio (SSO redirect loop) |
| **Right** | ✅ Working | Detail drawer — edit follow-up, categories, save |

---

## What We're Building Now

**The middle panel is being rebuilt as a "Work Order Context Panel."**

When you click a work order, instead of a useless white iframe, the middle panel shows:

1. **WO Summary** — Property, resident, vendor, status, job summary (read-only)
2. **Quick Actions** — Open AppFolio (new tab), email vendor, set follow-up
3. **Notes Preview** — The selected WO's Obsidian note, fetched from API

The detail drawer on the right stays for editing (follow-up dates, categories, save button).

**Why this works:**
- No cross-origin iframe issues
- No SSO cookie problems
- Notes come from HALQ's own API (same origin)
- AppFolio opens in a new tab (honest, no iframe lie)
- Actually useful information at a glance

---

## Files Changed in This Session

| File | Change |
|------|--------|
| `public/js/app.js` | Added `HALQ.af.init()` call; version bump to `2.5.5` |
| `public/js/af-panel.js` | Added `showExtensionOverlay()`, `startIframeMonitor()`, net-error detection |
| `public/js/wo-panel.js` | Auto-search only if AppFolio tab already active (protects login flow) |
| `public/js/settings.js` | Removed PIN auto-lock behavior |
| `public/css/settings.css` | Added `display: none !important` for `.pin-overlay` |
| `public/index.html` | Cache-busting `?v=2.5.4` on all JS/CSS assets; version bump |
| `extension/manifest.json` | Added `host_permissions`, `content_scripts`, `web_accessible_resources` |
| `extension/rules.json` | Broadened `urlFilter` to `||appfolio.com` (all subdomains) |
| `extension/content.js` | Content script patches for iframe-busting (ultimately unnecessary) |
| `extension/patch.js` | Inline script patches (unused, removed in later commit) |
| `extension/README.md` | Documented SSO iframe limitation and "Open in New Tab" workaround |

---

## Git Status

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   public/js/app.js (version bump 2.5.5)

Untracked files:
  dev-server.js
```

**Next commit:** Context panel rebuild (replaces browser iframe with WO details + notes + actions).

---

*End of summary. Start next chat with the context panel rebuild or any other priority.*
