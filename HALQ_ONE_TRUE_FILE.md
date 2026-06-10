# HALQ — The One True File

> **RULE: This file is append-only. Never delete. Never rewrite history. Only append new entries, updates, or corrections with a timestamp.**
> 
> **Paste this file at the start of every HALQ-related conversation.**

---

## Project Overview

| Property | Value |
|----------|-------|
| **Name** | HALQ (Housing & Asset Logistics Queue) |
| **Architecture** | Vanilla JS SPA, Electron-ready |
| **Namespace** | `window.HALQ` |
| **Total Files** | 16 |
| **Status** | Refactor Complete |
| **Last Updated** | 2026-06-10 |

---

## File Index

### CSS Files (8)

| # | File | Size | Description | Depends On |
|---|------|------|-------------|------------|
| 1 | `css/app.css` | ~9,200 chars | Root CSS variables, body, titlebar, sidebar, top-nav, section-tabs, main layout, bottombar, shared buttons, filter chips, detail patterns, debug bar, error dialog, drop overlay | Nothing |
| 2 | `css/wo-panel.css` | ~7,800 chars | WO panel: search, filters, filter dropdown, WO list items, age rings, category strips, section headers, detail drawer, follow-up dropdown, category dropdown | `app.css` |
| 3 | `css/af-panel.css` | ~2,200 chars | AppFolio tabs, toolbar, webview container | `app.css` |
| 4 | `css/email-panel.css` | ~200 chars | Outlook webview (mirrors AF, minimal) | `app.css` |
| 5 | `css/notes-panel.css` | ~8,500 chars | Notes: topbar, 3-panel body, notebook/section tree, pages list, editor toolbar, page area, canvas, contenteditable styles, export modal, prompt modal | `app.css` |
| 6 | `css/settings.css` | ~5,800 chars | Settings overlay, panel, tabs, theme grid, layout options, toggles, font picker, PIN modal, message templates, vendor directory table | `app.css` |
| 7 | `css/context-menu.css` | ~1,800 chars | Right-click context menu, flyout submenus, date input | `app.css` |
| 8 | `css/category-manager.css` | ~3,200 chars | Category manager modal, drag-drop list, color picker, form inputs | `app.css` |

### JS Files (8)

| # | File | Size | Module | Key Exports / Functions | Depends On |
|---|------|------|--------|------------------------|------------|
| 9 | `js/app.js` | ~10,500 chars | `HALQ.app` | `init()`, `switchView()`, nav/layout/theme/font toggles, resize dividers, settings load/save, preferences, clock, profile info, startup checks, auto-updater, utilities (`fmtDate`, `nextBizDay`, `calendarAgeToBizDays`, `escapeHtml`, `showDebug`, `showErrorDialog`, `showFieldStatus`) | Nothing |
| 10 | `js/wo-panel.js` | ~12,000 chars | `HALQ.wo` | `wos[]` array, `renderWOList()`, `filterWOs()`, `selectWO()`, `saveWODetail()`, category chips, follow-up logic, `autoTagNewWOs()`, `updateBottomBar()`, context menu handlers (`showWOCtxMenu`, `ctxSetFollowup`, `ctxToggleCat`, etc.) | `app.js`, `messages.js` |
| 11 | `js/af-panel.js` | ~4,500 chars | `HALQ.af` | `afBaseUrl`, `navTo/Back/Forward/Reload`, tab management (`addTab`, `switchToTab`, `closeTab`, `scrollTabs`), URL tracking, auto-fill login script injection, `tryAutoFill()` | `app.js` |
| 12 | `js/email-panel.js` | ~2,000 chars | `HALQ.email` | `emInit()`, `emRefresh/NavBack/NavForward/NavTo`, email tabs (mirror AF pattern) | `app.js` |
| 13 | `js/notes-panel.js` | ~8,000 chars | `HALQ.notes` | Notes state (`ntMeta`, `ntCurrent`), tree render, pages panel, `openPage/savePage`, toolbar commands (`nFmt`, `nBlock`, `nList`, etc.), paste/drop, drawing canvas, export modal, prompt/confirm modals | `app.js` |
| 14 | `js/messages.js` | ~6,000 chars | `HALQ.messages` | `_msgTemplates`, `_vendorDir`, `msgResolveTokens()`, `renderMsgTemplates()`, `ctxSendMsg()`, `_doSendMsg()`, `msgInjectAction()`, vendor modal (`showVendorModal`), vendor directory UI functions | `app.js` |
| 15 | `js/settings.js` | ~7,000 chars | `HALQ.settings` | `openSettings()`, `closeSettings()`, `switchSettingsTab()`, PIN lock (`pinKey`, `verifyPin`, `savePin`, `clearPin`), credentials (`saveCreds`, `loadCredsToUI`), Excel path, message template UI, vendor dir UI, category manager UI bridge | `app.js`, `messages.js` |
| 16 | `js/categories.js` | — | `HALQ.categories` | *(Reserved — category manager logic extracted from inline handlers)* | `app.js` |

### HTML Shell

| # | File | Size | Description |
|---|------|------|-------------|
| 17 | `index.html` | ~3,000 chars | Shell only: `<head>` with CSS links, body layout containers for all 4 views, settings overlay with 6 tabs, modals (prompt, confirm, export, category manager, error), debug bar, drop overlay, context menu template, JS script tags in order. Only inline script: `DOMContentLoaded` init block. |

---

## Module Dependency Graph

```
                    ┌─────────────────┐
                    │   index.html    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
   │app.css  │          │app.js   │         │modals   │
   │(vars)   │          │(core)   │         │(shell)  │
   └────┬────┘          └────┬────┘         └─────────┘
        │                    │
   ┌────┴────┬───────────────┼───────────────┐
   │         │               │               │
┌──▼───┐ ┌───▼───┐     ┌────▼────┐    ┌────▼────┐
│wo    │ │af     │     │notes    │    │settings │
│panel │ │panel  │     │panel    │    │panel    │
│.css  │ │.css   │     │.css     │    │.css     │
└──┬───┘ └───┬───┘     └────┬────┘    └────┬────┘
   │         │              │              │
┌──▼───┐ ┌───▼───┐     ┌────▼────┐    ┌────▼────┐
│wo    │ │af     │     │notes    │    │settings │
│panel │ │panel  │     │panel    │    │panel    │
│.js   │ │.js    │     │.js      │    │.js      │
└──┬───┘ └───┬───┘     └────┬────┘    └────┬────┘
   │         │              │              │
   │    ┌────┴────┐         │         ┌────┴────┐
   │    │email    │         │         │messages │
   │    │panel    │         │         │.js      │
   │    │.js/.css │         │         └────┬────┘
   │    └─────────┘         │              │
   │                        │         ┌────┴────┐
   │                        │         │categories
   │                        │         │.js/.css │
   │                        │         └─────────┘
   │                        │
   └────────┬───────────────┘
            │
      ┌─────▼─────┐
      │context-   │
      │menu.css   │
      └───────────┘
```

---

## LocalStorage Keys

| Key | Set By | Purpose |
|-----|--------|---------|
| `halq_theme` | `app.js`, `settings.js` | Current theme: `dark` / `light` / `midnight` |
| `halq_layout` | `app.js`, `settings.js` | Layout density: `compact` / `standard` / `comfortable` |
| `halq_font` | `app.js`, `settings.js` | Font family: `system` / `inter` / `roboto` / `mono` |
| `halq_pin` | `settings.js` | PIN code (plaintext — consider hashing if security critical) |
| `halq_creds` | `settings.js` | AppFolio credentials (base64-encoded JSON) |
| `halq_excel_path` | `settings.js` | Path to Excel data file |
| `halq_msg_templates` | `messages.js` | Custom message templates JSON |
| `halq_vendor_dir` | `messages.js` | Vendor directory JSON |
| `halq_categories` | `categories.js` | User-defined categories with colors |
| `halq_notes_data` | `notes-panel.js` | Notebook/section/page tree structure |
| `halq_preferences` | `app.js` | Misc preferences (sidebar collapsed, etc.) |

---

## Naming Conventions

| Scope | Pattern | Example |
|-------|---------|---------|
| CSS class | kebab-case | `.detail-drawer`, `.wo-toolbar` |
| CSS ID | camelCase | `#woDetailDrawer`, `#afUrlBar` |
| JS module | PascalCase on namespace | `HALQ.settings`, `HALQ.messages` |
| JS private | leading underscore | `_pin`, `_msgTemplates`, `_vendorDir` |
| JS internal | leading underscore + lowercase | `_doSendMsg()`, `_overlay` |
| DOM getter | `$` alias for `getElementById` | `const $ = id => document.getElementById(id)` |
| Event handlers | `on` prefix or verb-noun | `onSaveClick`, `handleResize` |
| Boolean state | `is` / `has` prefix | `isOpen`, `hasPin` |

---

## Init Order (index.html)

```javascript
// 1. Core app (registers namespace, utilities)
<script src="js/app.js"></script>

// 2. Feature panels (depend on HALQ.app)
<script src="js/wo-panel.js"></script>
<script src="js/af-panel.js"></script>
<script src="js/email-panel.js"></script>
<script src="js/notes-panel.js"></script>

// 3. Shared services (used by panels + settings)
<script src="js/messages.js"></script>

// 4. Settings (depends on everything above)
<script src="js/settings.js"></script>

// 5. Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  HALQ.app.init();
  HALQ.settings.init();
});
```

---

## Known Patterns & Decisions

| Decision | Rationale | Files Affected |
|----------|-----------|----------------|
| Single namespace `window.HALQ` | Prevents global pollution, enables module communication | All JS |
| CSS component-scoped files | Easier maintenance, no specificity wars | All CSS |
| No build step / bundler | Electron app, file:// protocol, simplicity | All |
| `contenteditable` for notes | Native rich text without heavy dependency | `notes-panel.js` |
| Canvas overlay for drawing | Separate layer avoids contenteditable conflicts | `notes-panel.js` |
| Base64 obfuscation for creds | Not secure, just not plaintext in LS | `settings.js` |
| IIFE modules | Self-contained, no module loader needed | All JS |
| `data-view` attributes for nav | Declarative view switching | `app.js`, `index.html` |
| Template `<template>` tags | Reusable modal/content shells | `index.html` |

---

## Changelog (Append Only)

| Date | Entry |
|------|-------|
| 2026-06-10 | Refactor initiated. Split from monolith into 16 files. CSS extracted into 8 component files. JS extracted into 7 module files. `index.html` reduced to shell only. |
| 2026-06-10 | Batch 1 complete: `css/app.css`, `css/wo-panel.css`, `css/af-panel.css`, `css/email-panel.css`, `css/notes-panel.css`, `css/settings.css`, `css/context-menu.css`, `css/category-manager.css`. |
| 2026-06-10 | Batch 2 complete: `js/app.js`, `js/wo-panel.js`, `js/af-panel.js`, `js/email-panel.js`, `js/notes-panel.js`, `js/messages.js`. |
| 2026-06-10 | Final batch complete: `js/settings.js`, `index.html`. Refactor finished. This One True File created. |

---

## How to Use This File

1. **Start of every HALQ conversation**: Paste this file in full.
2. **Before asking about a file**: Check the File Index above to locate it.
3. **Before proposing changes**: Check the Dependency Graph to understand impact.
4. **When adding a new file**: Append to File Index, update Dependency Graph, add to Changelog.
5. **When changing conventions**: Append to Naming Conventions or Known Patterns, do not delete old rules.

---

## Future Append Candidates

- [ ] Add `js/categories.js` module if category manager logic grows
- [ ] Add Electron main process file (`main.js`) documentation
- [ ] Add preload script (`preload.js`) API surface
- [ ] Add build/packaging notes (electron-builder config)
- [ ] Add testing strategy / test file index
- [ ] Add data migration notes (Excel ↔ LocalStorage sync)
- [ ] Add keyboard shortcuts reference table
- [ ] Add IPC channel documentation (renderer ↔ main)

---

*End of One True File. Append below this line only.*


---

## 2026-06-10 — Git Repository Established & Version Bump Protocol

| Property | Value |
|----------|-------|
| **Repository** | https://github.com/BossArQue/HALQ-Maintenance.git |
| **Rule** | Push to git after every update |
| **Rule** | Bump version of main files when appending to One True File |

### Version Bump Protocol

| File Type | Version Location | Format | Bump Trigger |
|-----------|------------------|--------|--------------|
| `js/app.js` | `HALQ.app.version` or `const APP_VERSION` | `v{major}.{minor}.{patch}` | Any core change |
| `index.html` | `<span id="version">` | same as app.js | Any file change |
| `css/*.css` | Top comment block | `/* HALQ CSS v{x.y.z} */` | Any style change |
| `js/*.js` | Top comment block | `/* HALQ {module} v{x.y.z} */` | Any module change |
| `HALQ_ONE_TRUE_FILE.md` | `Last Updated` field + Changelog | ISO date | Every append |

### Current Versions (Post-Refactor)

| File | Version |
|------|---------|
| `js/app.js` | v1.0.0 |
| `js/wo-panel.js` | v1.0.0 |
| `js/af-panel.js` | v1.0.0 |
| `js/email-panel.js` | v1.0.0 |
| `js/notes-panel.js` | v1.0.0 |
| `js/messages.js` | v1.0.0 |
| `js/settings.js` | v1.0.0 |
| `css/app.css` | v1.0.0 |
| `css/wo-panel.css` | v1.0.0 |
| `css/af-panel.css` | v1.0.0 |
| `css/email-panel.css` | v1.0.0 |
| `css/notes-panel.css` | v1.0.0 |
| `css/settings.css` | v1.0.0 |
| `css/context-menu.css` | v1.0.0 |
| `css/category-manager.css` | v1.0.0 |
| `index.html` | v1.0.0 |
| `HALQ_ONE_TRUE_FILE.md` | v1.0.0 |

### Git Commit Message Convention

```
[{module}] {action}: {brief description}

- Files changed: {list}
- Version bumps: {list}
- One True File: appended
```

**Examples:**
```
[WO] fix: age ring calculation off by one business day

- Files changed: js/wo-panel.js, css/wo-panel.css
- Version bumps: wo-panel.js v1.0.0 → v1.0.1, wo-panel.css v1.0.0 → v1.0.1
- One True File: appended
```

```
[Global] feat: add keyboard shortcuts for nav

- Files changed: js/app.js, css/app.css
- Version bumps: app.js v1.0.0 → v1.1.0, app.css v1.0.0 → v1.1.0
- One True File: appended
```

---

*End of One True File. Append below this line only.*


---

## 2026-06-10 — GitHub Repository Review: CRITICAL DISCOVERY

**Repository:** https://github.com/BossArQue/HALQ-Maintenance.git

### ⚠️ ARCHITECTURE MISMATCH DETECTED

The GitHub repository does **NOT** contain the 16-file refactor. It contains the **original monolith architecture**.

### What is actually on GitHub

| File | Status | Notes |
|------|--------|-------|
| `main.js` | ✅ Present | Electron main process, IPC, updater, multi-profile launcher |
| `preload.js` | ✅ Present | Bridge API (`window.halq`) |
| `index.html` | ✅ Present | **MONOLITH** — all UI, styles, JS in one file |
| `package.json` | ✅ Present | Electron-builder config, dependencies |
| `patch.ps1` | ✅ Present | Quick asar patch script |
| `launcher/` | ✅ Present | `index.html` + `preload.js` for profile picker |
| `releases/` | ✅ Present | `version.json` + `app.asar` for auto-updater |
| `css/*.css` | ❌ **MISSING** | Not in repo — styles are inline in `index.html` |
| `js/*.js` | ❌ **MISSING** | Not in repo — scripts are inline in `index.html` |

### Current GitHub Version: `1.2.2`

| Version | Change |
|---------|--------|
| `1.1.1` | Fix: web tab counter resets correctly when all tabs closed |
| `1.1.2` | UI: filter bar — categories moved to dropdown flyout |
| `1.1.3` | Fix: context menu Send Message dead URL |
| `1.1.4` | UI: context menu redesigned — two-panel slide layout |
| `1.1.5` | Feature: SMS self-learning selector discovery |
| `1.2.0` | Fix+UI: tab counter scoped fix; context menu two-panel redesign; category manager arrow-sort; version in bottom bar |
| `1.2.1` | UI: context menu enlarged — bigger text, padding, flyout widths |
| `1.2.2` | Feature: font family + font size picker in Settings → Appearance; persisted per-profile via `settings.json` |

### GitHub Architecture (Actual)

```
HALQ - Maintenance/          ← Source / raw project
├── main.js                  ← Electron main process
├── preload.js               ← Bridge: window.halq API
├── index.html               ← MONOLITH: All UI + styles + JS in one file
├── package.json             ← Dependencies + electron-builder config
├── patch.ps1                ← Quick asar patch script
├── .gitignore
├── launcher/
│   ├── index.html           ← Launcher UI (profile picker)
│   └── preload.js           ← window.launcher API
├── releases/
│   ├── version.json         ← Update manifest
│   └── app.asar             ← Built archive for auto-updater
└── userdata/                ← Created at runtime — NEVER committed
    ├── profiles-db.json
    ├── launcher/
    └── profiles/<id>/
        ├── creds.enc
        ├── pin.enc
        ├── settings.json
        ├── wo-tags.json
        ├── categories.json
        ├── session/
        └── notes/
```

### Key Behaviors Documented on GitHub (index.html monolith)

| Feature | Behavior |
|---------|----------|
| **Appfolio Advanced Search** | `{{afBaseUrl}}/search/advanced_search?full_text_search={WO#}&section_keys=work_orders` |
| **Follow-up Weekend Skipping** | "Tomorrow" and "Next Day" are business-day-aware (skips Sat/Sun) |
| **Auto Due Date on New WOs** | WOs ≤ 2 business days old with no tag get `today + 3 business days` silently |
| **Category Sort Order** | Arrow buttons (▲/▼) in Category Manager, saved to `categories.json` |
| **WO List Section Groups** | Overdue → This Week → Next Week → Week After → Later → Due/No Date |
| **Search + Filter Chips** | Search operates within active chip; switching chips clears search |
| **Right-Click Context Menu** | Two-panel slide layout; left rail = actions, right panel = options; persists to `wo-tags.json` |
| **SMS Self-Learning** | Discovery mode on first SMS send; saves CSS selector permanently; reset via Settings → Accounts → SMS Composer |

### Data Storage (Per-Profile)

| File | Purpose |
|------|---------|
| `creds.enc` | Encrypted AppFolio credentials (via `safeStorage`) |
| `pin.enc` | Encrypted PIN |
| `settings.json` | Theme, font, layout, preferences |
| `wo-tags.json` | Follow-up dates, categories per WO |
| `categories.json` | Category definitions + sort order |
| `session/` | Electron session partitions (`persist:appfolio-<id>`, `persist:outlook-<id>`) |
| `notes/` | Notes data |

### Version Scheme (GitHub)

`1.MAJOR.MINOR` — `1` is fixed (Electron desktop), `MAJOR` = feature set, `MINOR` = bugfix/small change (1–99, then rolls MAJOR).

### What needs to happen

The 16-file refactor we just created is **local only** (or in our chat history). It has **NOT** been pushed to GitHub. The GitHub repo still has the monolith `index.html`.

**Options:**
1. **Replace** the monolith on GitHub with the 16-file refactor + keep `main.js`/`preload.js`/`launcher/`/`releases/` structure
2. **Keep both** — maintain the monolith on GitHub as "stable" while developing the refactor locally
3. **Merge** — extract the monolith's `index.html` inline CSS/JS into the 16-file structure, preserving all `1.2.2` features

### Recommendation

**Option 3: Merge.** The monolith `index.html` at `v1.2.2` contains working features (SMS self-learning, two-panel context menu, arrow-sort categories, font picker) that the refactor may not have captured. We need to:

1. Compare the monolith `index.html` against our refactored files
2. Port any missing `v1.2.2` features into the 16-file structure
3. Update `main.js`/`preload.js` to work with the new file structure
4. Update `package.json` `files` array to include `css/` and `js/` folders
5. Test the full Electron build
6. Push as `v1.3.0` (major bump for architecture change)

---

*End of One True File. Append below this line only.*
