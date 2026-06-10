# HALQ Code Refactoring — Split Plan

**Status:** In Progress  
**Started:** 2026-06-10  
**Goal:** Split monolithic `index.html` into modular files

---

## File Structure

```
HALQ-Maintenance/
├── css/
│   ├── app.css              (base layout, theme, shared components)
│   ├── wo-panel.css         (work order list, filters, detail drawer)
│   ├── af-panel.css         (appfolio webview, tabs, toolbar)
│   ├── email-panel.css      (outlook webview)
│   ├── notes-panel.css      (notes tree, editor, toolbar)
│   ├── settings.css         (settings overlay, PIN, modals)
│   └── context-menu.css     (right-click context menu)
├── js/
│   ├── app.js               (shell bootstrap, router, globals, utilities)
│   ├── wo-panel.js          (WO list, filters, detail drawer, categories)
│   ├── af-panel.js          (appfolio webview, tabs, nav)
│   ├── email-panel.js       (outlook webview)
│   ├── notes-panel.js       (notes tree, pages, editor, drawing)
│   ├── messages.js          (templates, vendor dir, send injection)
│   └── settings.js          (settings overlay, PIN, credentials, prefs)
├── index.html               (shell only — no inline styles/scripts)
├── main.js                  (unchanged)
├── preload.js               (unchanged)
└── package.json             (update files array)
```

---

## CSS Split Strategy

| File | Contents | Lines (est) |
|------|----------|-------------|
| `app.css` | Root vars, body, titlebar, sidebar, top-nav, section-tabs, main layout, bottombar, shared animations, status dots, buttons | ~400 |
| `wo-panel.css` | WO panel, search, filters, filter dropdown, WO list items, age rings, cat strips, detail drawer, followup dropdown, cat dropdown | ~350 |
| `af-panel.css` | AF tabs, toolbar, webview container | ~120 |
| `email-panel.css` | Email tabs, toolbar (mirrors AF) | ~80 |
| `notes-panel.css` | Notes topbar, tree, pages panel, editor toolbar, page area, canvas, contenteditable styles | ~280 |
| `settings.css` | Settings overlay, panel, tabs, theme grid, layout options, toggles, font picker, credentials, PIN modal | ~250 |
| `context-menu.css` | Context menu, flyouts, submenus | ~120 |

**Total CSS:** ~1,600 lines (was ~1,200 in one file, but cleaner organization)

---

## JS Split Strategy

| File | Contents | Lines (est) |
|------|----------|-------------|
| `app.js` | HALQ namespace, init, view router, DOMContentLoaded, IPC wait, clock, resize dividers, layout toggle, nav toggle, theme, font, bottom bar, debug bar, error dialog, shared utilities (fmtDate, nextBizDay, etc.) | ~350 |
| `wo-panel.js` | WO data array, renderWOList, filterWOs, toggleChip, selectWO, openInAppfolio, saveWODetail, category chips, followup logic, autoTagNewWOs, updateBottomBar | ~450 |
| `af-panel.js` | afBaseUrl, navBack/Forward/Reload/To, tab management (add/switch/close/scroll), URL tracking, auto-fill login | ~200 |
| `email-panel.js` | Email view init, nav, tabs (mirror AF pattern) | ~120 |
| `notes-panel.js` | Notes state, tree render, pages panel, editor, toolbar commands, paste/drop, drawing, export modal, prompt/confirm modals | ~500 |
| `messages.js` | Message templates, vendor directory, lookup, token resolution, context menu send, injection chain, modal | ~300 |
| `settings.js` | Settings open/close, tabs, PIN lock, credentials, Excel path, preferences, message template UI, vendor dir UI, category manager | ~400 |

**Total JS:** ~2,320 lines (was ~2,000 in one file)

---

## Global Namespace Contract

```javascript
window.HALQ = {
  // app.js
  app: {
    init(),
    switchView(viewName),
    settings: { load(), save() },
    utils: { fmtDate(d), fmtDateISO(d), nextBizDay(d), nextNextBizDay(d), getNextFriday(d, weeks), calendarAgeToBizDays(age), escapeHtml(s), showDebug(msg), showErrorDialog(title, msg) }
  },

  // wo-panel.js
  wo: {
    data: [],           // wos array
    currentFilter: 'all',
    selected: null,     // selectedWO
    renderList(data),
    filter(query),
    select(woNum),
    saveDetail(),
    tags: { load(), save() },
    categories: { renderChips(), selectFilter(catId) }
  },

  // af-panel.js
  af: {
    baseUrl: '',
    navTo(url), navBack(), navForward(), navReload(),
    tabs: { add(url), switch(tabEl), close(e, btn), scroll(dir) }
  },

  // email-panel.js
  email: {
    init(), refresh(), navBack(), navForward(), navTo(url),
    tabs: { add(url), switch(tabEl), close(e, btn), scroll(dir) }
  },

  // notes-panel.js
  notes: {
    init(), renderInPanel(), renderTree(), renderPgPanel(),
    openPage(nbId, secId, pgId), savePage(), saveMeta(),
    toolbar: { format(cmd, val), block(tag), list(type), checklist(), table(), image(), file() },
    draw: { toggle(), eraser(), clear(), save() },
    export: { modal(), run() }
  },

  // messages.js
  messages: {
    templates: {},      // _msgTemplates
    vendorDir: [],      // _vendorDir
    resolveTokens(body, wo, vendorOverride),
    send(group, type, tplIdx, woNum),
    renderTemplates(), addTemplate(group, type), deleteTemplate(group, type, idx), saveTemplates()
  },

  // settings.js
  settings: {
    open(), close(), switchTab(tab),
    pin: { open(), verify(), save(), clear() },
    creds: { loadToUI(), save(), clear() },
    excel: { browse(), savePath() },
    vendorDir: { renderTable(filter), importExcel(), addManual(), edit(idx), delete(idx) },
    catMgr: { open(), close(), renderList(), select(id), saveEdit(), delete(), add() }
  }
}
```

---

## Event System (decoupled communication)

```javascript
// View switch
document.dispatchEvent(new CustomEvent('halq:viewSwitch', { detail: { view: 'wo' } }))

// WO selected
document.dispatchEvent(new CustomEvent('halq:woSelected', { detail: { wo: woObj } }))

// Settings changed
document.dispatchEvent(new CustomEvent('halq:settingsChanged', { detail: { key, value } }))

// Tags saved
document.dispatchEvent(new CustomEvent('halq:tagsSaved', { detail: { woNum } }))
```

---

## Migration Checklist

### Phase 1: CSS Extraction
- [x] Create `css/app.css` — base styles
- [ ] Create `css/wo-panel.css` — WO specific
- [ ] Create `css/af-panel.css` — Appfolio webview
- [ ] Create `css/email-panel.css` — Outlook
- [ ] Create `css/notes-panel.css` — Notes
- [ ] Create `css/settings.css` — Settings overlay
- [ ] Create `css/context-menu.css` — Context menu
- [ ] Update `index.html` to link all CSS files

### Phase 2: JS Extraction
- [ ] Create `js/app.js` — shell + globals
- [ ] Create `js/wo-panel.js` — work orders
- [ ] Create `js/af-panel.js` — appfolio panel
- [ ] Create `js/email-panel.js` — email panel
- [ ] Create `js/notes-panel.js` — notes
- [ ] Create `js/messages.js` — messages + vendor dir
- [ ] Create `js/settings.js` — settings

### Phase 3: Shell Update
- [ ] Strip all `<style>` from `index.html`
- [ ] Strip all `<script>` from `index.html`
- [ ] Add `<link>` tags for CSS
- [ ] Add `<script>` tags for JS (in dependency order)
- [ ] Add bootstrap `HALQ.app.init()` call

### Phase 4: Package Update
- [ ] Update `package.json` files array
- [ ] Test build
- [ ] Verify all features work

---

## Notes for Continuation

**If this session ends before completion:**

1. Check which phase items are checked above
2. Continue from the first unchecked item
3. Always generate the tracking MD first when resuming
4. Export files in batches of 3 max to avoid truncation
5. Each file should be complete and functional on its own

**Critical dependencies:**
- `app.js` MUST be loaded first (defines `window.HALQ`)
- `wo-panel.js` before `messages.js` (messages depends on WO data)
- `app.js` before any panel (panels register themselves on `HALQ`)

**Testing after each batch:**
```bash
npm start
# Verify: no console errors, layout renders, can switch views
```

---

## Current Batch: Phase 1 — CSS Files 1-3

Exporting now:
1. `css/app.css` — Base styles (trimmed comments)
2. `css/wo-panel.css` — WO panel styles
3. `css/af-panel.css` — Appfolio panel styles
