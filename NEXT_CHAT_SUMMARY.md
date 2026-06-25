# HALQ — Next Chat Summary

> **Session:** 2026-06-24
> **Version:** v2.5.8
> **Status:** Browser panel REMOVED. Extension bridge for Chrome Split View is the workflow.
> **Ponytail:** ON — Laziest solution that works. See Rule 8 in HALQ_ONE_TRUE_FILE.md.
> **Repo:** https://github.com/BossArQue/HALQ-Maintenance_WebApp
> **Branch:** `main`
> **Commit:** `973a976` (extension bridge) + `2.5.8` bump pending push
> **Deploy:** Cloudflare Pages auto-deploys on push.

---

## What Was Done

### v2.5.5 → v2.5.8 — Extension Bridge + Browser Panel Removal

**Goal:** Make clicking a WO update the AppFolio tab in a Chrome Split View, instead of opening a new tab every time.

**Result:** WORKS. The extension bridge tracks tab IDs per window and updates the correct AppFolio tab.

**How it works:**

1. Click a WO in HALQ → `af-panel.js` sends `chrome.runtime.sendMessage` to the extension
2. Extension `background.js` receives the message, looks up the tracked AppFolio tab for that window
3. If no tracked tab exists, creates a new one. If it exists, updates its URL via `chrome.tabs.update`
4. User manually splits the AppFolio tab with HALQ once
5. Every subsequent WO click updates the AppFolio half automatically

**What was tried (and why earlier attempts failed):**

| Attempt | What | Why It Failed |
|---------|------|---------------|
| v2.5.6 | `window.open(url, 'appfolio')` with named window | Chrome Split View isolates the named window reference. Once a tab is moved into a split group, `window.open(name)` can't find it. Creates a new tab instead. |
| v2.5.7a | Extension `chrome.tabs.query` to find AppFolio tab | Finds the wrong tab (multiple AppFolio tabs, picks the first/oldest, not the one in the split). |
| v2.5.7b | Extension tracks tab IDs in `chrome.storage.local` | Works, but service worker startup cleared the storage every time it restarted. First click after any restart created a new tab. |
| v2.5.7c | Extension tracks tab IDs keyed by `windowId` + `target` | **THIS WORKS.** Each window gets its own tracked tab. The extension uses `sender.tab.windowId` to know which HALQ window sent the message, and updates/creates the AppFolio tab in that same window. |

**Key insight:** Chrome Split View groups tabs into the same window. The extension's `sender.tab.windowId` tells us which window HALQ is in. By tracking `tabId` per `windowId`, we always update the correct AppFolio tab in the same split group.

---

### v2.5.8 — Browser Panel Removed

**Why:** The middle browser panel (iframe for AppFolio) was dead weight. AppFolio is now in a split tab. The iframe showed a white screen because of Chrome's third-party cookie blocking for SSO. The panel had no purpose.

**What changed:**
- Removed `browser-panel` div from `index.html` (tabs, toolbar, iframe, overlay, notes preview)
- Removed `resize-divider` between WO panel and the (now removed) browser panel
- Made `wo-panel` wider (`flex: 1.5` instead of `1`) to use the freed space
- `af-panel.js` still exists for the extension bridge logic, but no longer references the dead iframe DOM elements

**Current layout:**
- Left: WO list (wider now)
- Right: Detail drawer (follow-up, categories, save)
- AppFolio: In a Chrome Split View tab (updated by extension bridge)

---

### Extension Files

| File | Purpose |
|------|---------|
| `extension/manifest.json` | `tabs` + `storage` + `declarativeNetRequest` permissions. `externally_connectable` matches HALQ URLs. Background service worker. |
| `extension/background.js` | Service worker. Listens for `navigate` messages from HALQ. Tracks `tabId` per `windowId` in `chrome.storage.local`. Updates or creates AppFolio tab. |
| `extension/content-halq.js` | Injected into HALQ page. Creates a hidden `<div id="halq-extension-data" data-extension-id="...">` so HALQ can read the extension ID from the DOM (CSP-safe, no script injection). |
| `extension/content.js` | Injected into AppFolio pages. Iframe-busting patches (now mostly irrelevant since AppFolio is in a real tab, not iframe). |
| `extension/rules.json` | DeclarativeNetRequest rules to strip `X-Frame-Options` and CSP headers from AppFolio (now mostly irrelevant). |

---

## Files Changed in This Session

| File | Change |
|------|--------|
| `public/js/app.js` | Version bump to `2.5.8` |
| `public/js/af-panel.js` | Extension bridge via `chrome.runtime.sendMessage`. Detects extension ID from DOM element. Falls back to `window.open` if extension not found. |
| `public/js/wo-panel.js` | Auto-search always triggers (no longer checks if AppFolio tab is active). |
| `public/css/wo-panel.css` | `.wo-panel` flex changed from `1` to `1.5` to use freed space. |
| `public/index.html` | Removed `browser-panel` div (tabs, toolbar, iframe, overlay). Removed `resize-divider`. Cache-busting `?v=2.5.8` on all assets. |
| `extension/manifest.json` | Added `tabs`, `storage`, `background` service worker, `externally_connectable`, `content_scripts` for HALQ page. |
| `extension/background.js` | Tab tracking per `windowId` in `chrome.storage.local`. `chrome.tabs.update` / `chrome.tabs.create`. |
| `extension/content-halq.js` | DOM element approach to expose extension ID (CSP-safe). |

---

## Git Status

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   public/js/app.js (version bump 2.5.8)
  modified:   public/js/af-panel.js (extension bridge)
  modified:   public/js/wo-panel.js (auto-search always on)
  modified:   public/css/wo-panel.css (flex: 1.5)
  modified:   public/index.html (remove browser panel, version bump)
  modified:   extension/background.js (tab tracking per windowId)
  modified:   extension/content-halq.js (DOM element approach)
  modified:   extension/manifest.json (tabs, storage, background)
```

**Next commit:** v2.5.8 — Remove dead browser panel, extension bridge for split view.

---

## Current State

| Panel | Status | Purpose |
|-------|--------|---------|
| **Left** | ✅ Working | WO list, search, filters, categories (wider now) |
| **Middle** | 🗑️ REMOVED | Was dead browser iframe — AppFolio is now in a split tab |
| **Right** | ✅ Working | Detail drawer — edit follow-up, categories, save |
| **Extension** | ✅ Working | Bridges HALQ → AppFolio tab updates in Chrome Split View |

---

*End of summary. Start next chat with any priority — the extension bridge and split view workflow are solid.*
