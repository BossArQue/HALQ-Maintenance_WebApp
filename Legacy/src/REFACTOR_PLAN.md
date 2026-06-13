# HALQ Code Refactoring — V1 Source Extraction

**Status:** Extraction Complete — All source files documented  
**Source:** v1.2.2 Electron Desktop App  
**Goal:** Document every file, selector, function, and state object for V2 preparation  
**Rule:** This is extraction only. Migration decisions belong in V2 planning.

---

## File Inventory

### CSS Files (8)

| # | File | Lines | Bytes | Description | Sections |
|---|------|-------|-------|-------------|----------|
| 1 | `css/app.css` | 275 | 13,845 | Root variables, body, titlebar, sidebar, nav, layout, bottombar, shared components | `:root`, `TITLEBAR`, `INLINE NAV`, `APP LAYOUT`, `SIDEBAR`, `TOP NAV`, `SECTION TABS`, `MAIN`, `CONTENT`, `RESIZABLE DIVIDER`, `BOTTOM BAR`, `SHARED: FILTER CHIPS`, `SHARED: DETAIL LABEL/VAL`, `SHARED: CRED INPUTS`, `SHARED: DROPDOWN BASE`, `UPDATE BANNER`, `DEBUG BAR`, `ERROR DIALOG`, `DROP OVERLAY` |
| 2 | `css/wo-panel.css` | 207 | 11,296 | WO list panel, search, filters, filter dropdown, WO cards, age rings, category strips, section headers, detail drawer, follow-up dropdown, category dropdown | `WO PANEL`, `Filters`, `WO List`, `Age Ring`, `WO Card Layout`, `Category Strips`, `Section Headers`, `DETAIL DRAWER`, `Follow-up Dropdown`, `Category Dropdown` |
| 3 | `css/af-panel.css` | 64 | 2,904 | AppFolio tabs, toolbar, webview container | `APPFOLIO PANEL`, `Tabs`, `Toolbar`, `Content` |
| 4 | `css/email-panel.css` | 4 | 274 | Outlook webview (mirrors AF, minimal) | `EMAIL PANEL` |
| 5 | `css/notes-panel.css` | 229 | 11,759 | Notes 3-panel tree, editor toolbar, page area, canvas, contenteditable, export/prompt modals | `NOTES PANEL`, `3-Panel Body`, `Notebook Panel`, `Pages Panel`, `Tree Buttons`, `Notebook Row`, `Section Row`, `Editor Area`, `Toolbar`, `Page Area`, `Canvas`, `Content Editable`, `Export Modal`, `Prompt Modal` |
| 6 | `css/settings.css` | 174 | 9,241 | Settings slide-in panel, tabs, theme grid, toggles, font picker, PIN modal, message templates, vendor directory table | `SETTINGS OVERLAY`, `Settings Tabs`, `Theme Grid`, `Layout Options`, `Toggle Row`, `Font Options`, `PIN MODAL`, `MESSAGE TEMPLATES`, `VENDOR DIRECTORY TABLE` |
| 7 | `css/context-menu.css` | 33 | 1,749 | Right-click context menu, flyout submenus, date input | `WO RIGHT-CLICK CONTEXT MENU`, `Flyout Submenus` |
| 8 | `css/category-manager.css` | 76 | 3,973 | Category manager modal, drag-drop list, color picker, form inputs | `CATEGORY MANAGER MODAL` |

**Total CSS:** 1,062 lines | 55,041 bytes

### JS Files (7)

| # | File | Lines | Bytes | Module | Header |
|---|------|-------|-------|--------|--------|
| 1 | `js/app.js` | 543 | 21,317 | `HALQ.app` | HALQ APP — Shell Bootstrap & Global Utilities |
| 2 | `js/wo-panel.js` | 874 | 34,324 | `HALQ.wo` | WO PANEL — Work Order List, Filtering, Detail Drawer, Context Menu |
| 3 | `js/af-panel.js` | 219 | 6,935 | `HALQ.af` | APPFOLIO PANEL — Webview, Tabs, Navigation, Auto-fill |
| 4 | `js/email-panel.js` | 133 | 4,071 | `HALQ.email` | EMAIL PANEL — Outlook Web Webview |
| 5 | `js/notes-panel.js` | 800 | 28,178 | `HALQ.notes` | NOTES PANEL — Notebook/Section/Page Tree, Editor, Drawing, Export |
| 6 | `js/messages.js` | 533 | 22,354 | `HALQ.msg` | MESSAGES — Templates, Vendor Directory, Context Menu Send, Injection |
| 7 | `js/settings.js` | 254 | 9,299 | `HALQ.settings` | HALQ — Settings Panel & PIN / Credentials / Config |

**Total JS:** 3,356 lines | 126,458 bytes

### HTML Shell

| # | File | Description |
|---|------|-------------|
| 17 | `index.html` | Shell: `<head>` with CSS links, body layout containers for all 4 views, settings overlay with 6 tabs, modals (prompt, confirm, export, category manager, error), debug bar, drop overlay, context menu template, JS script tags in dependency order. Inline script: `DOMContentLoaded` init block. |

---

## File Status: What We Have vs What Is Missing

This refactor extracted the `index.html` monolith into separate files. Below is the exact inventory.

### ✅ WE HAVE (Uploaded — Extracted from Monolith)

**CSS Files (8):**
| # | File | Lines | Bytes |
|---|------|-------|-------|
| 1 | `css/app.css` | 275 | 13,845 |
| 2 | `css/wo-panel.css` | 207 | 11,296 |
| 3 | `css/af-panel.css` | 64 | 2,904 |
| 4 | `css/email-panel.css` | 4 | 274 |
| 5 | `css/notes-panel.css` | 229 | 11,759 |
| 6 | `css/settings.css` | 174 | 9,241 |
| 7 | `css/context-menu.css` | 33 | 1,749 |
| 8 | `css/category-manager.css` | 76 | 3,973 |

**JS Files (7):**
| # | File | Lines | Bytes |
|---|------|-------|-------|
| 9 | `js/app.js` | 543 | 21,317 |
| 10 | `js/wo-panel.js` | 874 | 34,324 |
| 11 | `js/af-panel.js` | 219 | 6,935 |
| 12 | `js/email-panel.js` | 133 | 4,071 |
| 13 | `js/notes-panel.js` | 800 | 28,178 |
| 14 | `js/messages.js` | 533 | 22,354 |
| 15 | `js/settings.js` | 254 | 9,299 |

**Total: 15 files | 4,261 lines | ~178,499 bytes**

---

### ❌ WE DO NOT HAVE (Part of the Monolith Refactor)

| File | Status | Notes |
|------|--------|-------|
| `index.html` | **MISSING** | The shell HTML was never uploaded. The monolith was already split into CSS/JS files before upload. The HTML shell that links them together is not present. |

---

### ⚠️ PLACEHOLDER (Planned but Never Created)

| File | Status |
|------|--------|
| `js/categories.js` | Listed in OTF as "Reserved" but never created. Category manager logic remained in `settings.js`. |

---

## Detailed CSS Extraction

### 1. `css/app.css` — Root Styles & Layout Foundation (275 lines, 13,845 bytes)

**CSS Variables (`:root`):**
- Colors: `--bg`, `--surface`, `--surface2`, `--border`, `--border2`, `--accent` (#5b9cf6), `--accent2` (#a78bfa), `--green`, `--orange`, `--red`, `--yellow`
- Text: `--text`, `--text2`, `--text3`
- Layout: `--sidebar-w` (220px), `--app-font` (Inter), `--app-font-size` (13px)
- Themes: `dark` (default), `light`, `midnight`, `forest`

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.titlebar` | App title bar (36px, gradient accent line, drag region) |
| `.tb-inline-nav` | Compact nav mode (hidden, shown via `body.nav-compact`) |
| `.sidebar` | Left sidebar (220px, collapsible via `hidden` class) |
| `.sidebar-logo` | Logo area with gradient icon + text |
| `.sidebar-nav` | Scrollable nav sections with labels and items |
| `.nav-item` | Nav item with left accent border, hover, active states |
| `.nav-badge` | Counter badge (blue/red variants) |
| `.top-nav` / `.section-tabs` | Alternative nav modes (compact) |
| `.main` | Main content flex container |
| `.topbar` | View toolbar (44px, title + actions) |
| `.btn-primary` / `.btn-ghost` | Button variants |
| `.content` / `.panel-layout` / `.view-panel` | Content area containers |
| `.resize-divider` / `.resize-divider-h` | Draggable dividers (5px, hover → accent color) |
| `.bottombar` | Status bar (26px, WO count, clock, version) |
| `.filter-chip` | Reusable filter chip (active/hover states) |
| `.detail-row` / `.detail-label` / `.detail-val` | Detail view pattern |
| `.creds-input` / `.creds-status` | Credential input with validation states |
| `.dropdown-base` | Shared dropdown component (fixed position, z-index 350) |
| `#autofill-debug` | Debug toast (fixed bottom, auto-dismiss 6s) |
| `#halq-error-dialog` | Error modal (copy button, close button) |
| `.drop-overlay` | File drop zone (dashed border, accent color) |

**Electron-Specific Selectors:**
- `-webkit-app-region: drag` / `-webkit-app-region: no-drag` — Title bar drag behavior
- `webview` — Electron webview element styling

---

### 2. `css/wo-panel.css` — Work Order Panel (207 lines, 11,296 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.wo-panel` | WO list panel (340px fixed, resizable, min 200px) |
| `.wo-panel-header` | Search bar container |
| `.wo-search` | Search input (28px clear button, focus border accent) |
| `.wo-filters-wrap` | Filter chips row with gap |
| `.wo-filter-more-btn` | Category filter trigger (▾ dropdown) |
| `.wo-filter-dropdown` | Category dropdown (fixed, z-index 600, max-height 260px) |
| `.wo-filter-dd-item` | Category option with color dot and count badge |
| `.wo-list` | Scrollable WO list (custom scrollbar 4px) |
| `.wo-item` | WO card (hover translateX, active left border accent, overdue/due-today/on-track states) |
| `.wo-age-ring` | SVG circular progress indicator (36px, stroke-dasharray based on age/90) |
| `.wo-age-ring-label` | Age text inside ring (8px monospace) |
| `.wo-num` | WO number (monospace, accent color) |
| `.wo-status-dot` | Status indicator (assigned=blue, scheduled=yellow, waiting=orange) |
| `.wo-prop` | Property name (truncated) |
| `.wo-vendor` | Vendor name (truncated, text3 color) |
| `.wo-age` | Age badge (old=red, mid=yellow, new=green backgrounds) |
| `.wo-tag` | Tag badge (surface2 background) |
| `.wo-cat-strips` | Category color strip container (flex gap 2px) |
| `.wo-cat-strip` | Individual category strip (8.5px uppercase, brightness hover) |
| `.wo-section-header` | Group header (sticky top, accent bar, count badge) |
| `.wo-detail` | Detail drawer (0→280px width transition, slide-in) |
| `.wo-detail-header` / `.wo-detail-title` / `.wo-detail-close` | Drawer header |
| `.followup-trigger` / `.followup-dropdown` | Follow-up date picker dropdown |
| `.followup-opt-date` | Date label in dropdown (monospace) |
| `.followup-custom-row` / `.followup-custom-input` | Custom date input (hidden by default) |
| `.cat-trigger` / `.cat-dropdown` | Category multi-select trigger and dropdown |
| `.cat-opt` / `.cat-checkbox` | Category option with checkbox indicator |
| `.cat-opt-clear` / `.cat-opt-manage` | Special options (clear all, manage categories) |

---

### 3. `css/af-panel.css` — AppFolio Panel (64 lines, 2,904 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.af-panel` | AppFolio panel (flex: 1, column layout) |
| `.af-tabs-wrap` | Tab bar container (36px height, scrollable) |
| `.af-tabs-arrow` | Scroll arrows (left/right, disabled state) |
| `.af-tabs` | Tab container (flex, gap 2px, overflow hidden) |
| `.af-tab` | Individual tab (max-width 160px, ellipsis, active/loading states) |
| `.af-tab-close` | Tab close button (✕, hover red) |
| `.af-new-tab` | New tab button (+) |
| `.af-toolbar` | Navigation toolbar (back/forward/reload, URL bar, Go button) |
| `.af-nav-btn` | Navigation buttons (26px square, surface2 background) |
| `.af-url` | URL input (monospace, focus accent border) |
| `.af-go-btn` | Go button (accent background, brightness hover) |
| `.af-content` | Webview container (flex: 1, relative) |
| `webview` | Electron webview element (100% width/height, no border) |

---

### 4. `css/email-panel.css` — Email Panel (4 lines, 274 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `#email-panel .af-panel` | Reuses AF panel structure |
| `#email-panel .af-tabs-wrap` | Email tab styling |
| `#email-panel .af-tab[data-url*="outlook"]` | Outlook icon prefix (✉) |

**Note:** Minimal file — heavily reuses `af-panel.css` classes.

---

### 5. `css/notes-panel.css` — Notes Panel (229 lines, 11,759 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.notes-topbar` | Notes view tabs container (40px height) |
| `.notes-nav-tab` | Tab item (border-bottom active indicator) |
| `.notes-topbar-actions` | Action buttons area (margin-left: auto) |
| `.nt-topbar-btn` | Topbar button (ghost style, accent variant) |
| `.notes-body-wrap` | 3-panel flex container |
| `.notes-nb-panel` | Notebook tree panel (200px, min 120px) |
| `.notes-nb-hd` / `.notes-nb-hd-title` | Notebook panel header |
| `.notes-tree` | Scrollable notebook/section tree (no scrollbar) |
| `.notes-pg-panel` | Pages list panel (180px, border-right) |
| `.notes-pg-hd` / `.notes-pg-hd-title` | Pages panel header (ellipsis) |
| `.notes-pg-list` | Scrollable pages list (no scrollbar) |
| `.notes-pg-item` | Page item (active left border accent, hover actions) |
| `.nt-nb-row` / `.nt-sec-row` | Notebook/section rows (arrow rotation, active states) |
| `.ntree-btn` | Tree action buttons (+, ✎, 🗑 — hover reveal) |
| `.notes-editor` | Editor container (white background, flex column) |
| `.notes-tb` | Formatting toolbar (enabled/disabled states, flex wrap) |
| `.nbt` | Toolbar button (hover background, active state with accent) |
| `.nbt-sel` | Toolbar select dropdown (max-width 85px) |
| `.notes-draw-bar` | Drawing toolbar (hidden by default, accent background when on) |
| `.notes-page-area` | Page scroll area (max-width 840px centered) |
| `.notes-empty` | Empty state (centered, icon + text) |
| `.notes-page-inner` | Page content wrapper (padding 28px 44px 80px) |
| `.notes-pg-title` | Editable page title (22px, border-bottom accent on focus) |
| `.notes-canvas-wrap` / `#notes-canvas` | Drawing canvas overlay (pointer-events toggle) |
| `.notes-body` | `contenteditable` area (min-height 480px, caret-color accent) |
| `.notes-body h1/h2/h3` / `.notes-body ul/ol` / `.notes-body table` | Rich text element styles |
| `.notes-body .nt-file` | File attachment inline element (hover border accent) |
| `.nt-export-overlay` / `.nt-export-box` | Export modal (scope buttons, format select) |
| `.nt-prompt-overlay` / `.nt-prompt-box` | Prompt modal (label, input, cancel/ok buttons) |

---

### 6. `css/settings.css` — Settings Panel (174 lines, 9,241 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.settings-overlay` | Full-screen overlay (flex, align right) |
| `.settings-panel` | Slide-in panel (340px, 100vh, border-left) |
| `.settings-header` / `.settings-title` / `.settings-close` | Header with close button |
| `.settings-body` / `.settings-section` / `.settings-section-title` | Body with sections |
| `.settings-tab` | Tab navigation (flex: 1, text-align center, border-bottom active) |
| `.theme-grid` / `.theme-option` / `.theme-dot` | 2-column theme picker |
| `.layout-options` / `.layout-option` | Layout mode picker (vertical list) |
| `.toggle-row` / `.toggle` | Toggle switch (32px width, 18px height, sliding dot) |
| `.font-options` / `.font-option` / `.font-size-slider` | Font family list + size slider |
| `.pin-overlay` / `.pin-modal` | PIN entry modal (centered, 280px width) |
| `.pin-dots` / `.pin-dot` | Visual PIN dots (filled/error states) |
| `.pin-keypad` / `.pin-key` | 3x3+1 keypad grid (hover/active states) |
| `.pin-keyboard-input` | Alternative text input for PIN (centered, monospace) |
| `.msg-template-list` / `.msg-template-row` | Template editor list |
| `.msg-template-name` / `.msg-template-body` | Template fields (name input, body textarea) |
| `.msg-add-btn` / `.msg-del-btn` | Add/delete template buttons |
| `#vendor-dir-table-wrap` / `#vendor-dir-table` | Vendor directory table (sticky header, scrollable) |

---

### 7. `css/context-menu.css` — Right-Click Context Menu (33 lines, 1,749 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.wo-ctx-menu` | Fixed position menu (z-index 9500, min-width 260px, radius 10px) |
| `.wo-ctx-section` | Section header (uppercase, monospace, text3 color) |
| `.wo-ctx-item` | Menu item (padding 9px 14px, hover surface2) |
| `.wo-ctx-sep` | Separator (1px, margin 5px 6px) |
| `.wo-ctx-item.has-flyout` | Item with submenu (▶ indicator) |
| `.wo-ctx-flyout` | Submenu (fixed, z-index 9600, min-width 240px) |
| `.wo-ctx-item.has-flyout:hover > .wo-ctx-flyout` | Hover-triggered submenu display |
| `.ctx-date-inp` | Date input inside context menu (radius 7px, focus accent) |

---

### 8. `css/category-manager.css` — Category Manager Modal (76 lines, 3,973 bytes)

**Major Components:**
| Selector | Purpose |
|----------|---------|
| `.catmgr-overlay` / `.catmgr-modal` | Modal (480px width, max-height 520px, flex column) |
| `.catmgr-header` / `.catmgr-title` / `.catmgr-close` | Header |
| `.catmgr-body` | Two-column flex (list 200px + actions flex:1) |
| `.catmgr-list` | Scrollable category list (border-right) |
| `.catmgr-item` | Category row (selected, drag-over outline, dragging opacity) |
| `.catmgr-item-dot` | Color dot (10px circle) |
| `.catmgr-drag-handle` | Drag handle (⋮⋮, cursor grab/grabbing) |
| `.catmgr-actions` | Right panel (padding 16px, flex column, gap 12px) |
| `.catmgr-field-label` / `.catmgr-input` | Form label and input (focus accent) |
| `.catmgr-colors` / `.catmgr-color` | Color picker grid (22px circles, selected border white) |
| `.catmgr-btn-row` / `.catmgr-btn` | Action buttons (Save primary, Delete danger) |
| `.catmgr-footer` / `.catmgr-new-input` | Add new category input (flex:1) |
| `.catmgr-status` | Status message (ok/err, monospace) |

---

## Detailed JS Extraction

### 1. `js/app.js` — Shell Bootstrap & Global Utilities (543 lines, 21,317 bytes)

**Namespace:** `window.HALQ.app`

**State:**
- `_navMode` — Current navigation style ('sidebar')
- `_currentView` — Current view ('wo')
- `_pendingAsarUrl` — Update download URL

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `init` | function | Bootstrap: clock, dividers, IPC wait, data load |
| `switchView` | function | Route between 'wo', 'email', 'notes' |
| `settings.load` | function | `loadAppSettings()` — load from IPC |
| `settings.save` | function | `saveAppSettings(data)` — save via IPC |
| `utils.fmtDate` | function | Format date as "Jun 11, 2026" |
| `utils.fmtDateISO` | function | Format date as "2026-06-11" |
| `utils.nextBizDay` | function | Next business day (skip weekends) |
| `utils.nextNextBizDay` | function | Day after next business day |
| `utils.getNextFriday` | function | Get upcoming Friday (with weeks ahead) |
| `utils.getWeekStart` | function | Monday of current week |
| `utils.calendarAgeToBizDays` | function | Convert calendar days to business days |
| `utils.skipWeekend` | function | Skip Saturday/Sunday |
| `utils.escapeHtml` | function | HTML entity encoding |
| `utils.showDebug` | function | Toast notification (6s auto-dismiss) |
| `utils.showErrorDialog` | function | Error modal with copy button |
| `utils.showFieldStatus` | function | Inline form validation status |

**Key Functions:**
- `waitForHalq(fn, attempts)` — Poll for `window.halq` availability
- `toggleNav(mode)` — Switch nav style (sidebar/topnav/tabs)
- `setNavOpt(mode, el)` — Set nav option with visual active state
- `setLayoutOpt(mode, el)` — Set panel layout (horizontal/vertical)
- `setTheme(theme, el)` — Set theme (dark/light/midnight/forest)
- `setAppFont(fontName, el)` / `setAppFontSize(size)` — Font controls
- `initResizeDivider(dividerId, prevEl, nextEl, dir)` — Draggable resize
- `togglePref(el, key)` — Toggle preference (colorCodeWOs, autoSearch, showBottomBar)
- `updateClock()` — Live clock update every second
- `loadProfileInfo()` — Load user profile badge from IPC
- `checkStartupRequirements()` — Check creds/Excel path, show setup prompt
- `checkForUpdate()` / `updateInstall()` / `updateDismiss()` — Auto-updater flow
- `toggleMenuBar(el)` — Toggle native menu bar visibility

**Stub Registrations (filled by other modules):**
- `HALQ.cat` — Category data (`list`, `getById`)
- `HALQ.catMgr` — Category manager (`open`)
- `HALQ.msg` — Message templates (`templates`, `ctxSend`)
- `HALQ.woTags` — WO tag storage (global object)
- `HALQ.autoFill` — AppFolio auto-fill (`tryFill`)
- `HALQ.excel` — Excel loader (`loadData`)
- `HALQ.promptDate(label, callback)` — Date picker prompt helper
- `HALQ.closeAllDropdowns()` — Close all open dropdowns helper
- `HALQ.updateSearchClear(input)` — Toggle search clear button

---

### 2. `js/wo-panel.js` — Work Order Panel (874 lines, 34,324 bytes)

**Namespace:** `window.HALQ.wo`

**State (`S`):**
| Property | Type | Description |
|----------|------|-------------|
| `wos` | array | All work order objects |
| `currentFilter` | string | Active filter ('all', 'overdue', 'today', 'cat:{id}') |
| `selected` | object | Currently selected WO |
| `currentFollowup` | string | Selected WO's follow-up date (ISO) |
| `selectedCatIds` | array | Selected WO's category IDs |
| `_ctxWoNum` | string | Right-click context menu target WO number |

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `wos` | getter | Access `S.wos` |
| `currentFilter` | getter | Access `S.currentFilter` |
| `selected` | getter | Access `S.selected` |
| `selectedCatIds` | getter/setter | Access/modify selected categories |
| `currentFollowup` | getter/setter | Access/modify follow-up date |
| `init` | function | Initialize panel |
| `renderList` | function | Render WO list with section grouping |
| `filter` | function | Text search across WO fields |
| `select` | function | Select WO, populate detail, auto-search AppFolio |
| `saveDetail` | function | Persist WO tags and follow-up |
| `toggleDetail` | function | Show/hide detail drawer |
| `updateBottomBar` | function | Update status bar counts |
| `loadTags` | function | Load persisted tags from storage |
| `saveTags` | function | Save tags to storage |
| `renderCategoryChips` | function | Render category filter dropdown |
| `selectCatFilter` | function | Filter by category ID |
| `closeCatDropdown` | function | Close category dropdown |
| `toggleFilterCatDropdown` | function | Toggle category filter dropdown |
| `toggleFollowup` | function | Toggle follow-up date picker |
| `setFollowup` | function | Set follow-up by key (tomorrow/nextday/thisweek/nextweek/custom) |
| `setFollowupCustom` | function | Set custom follow-up date |
| `initFollowupDates` | function | Pre-calculate follow-up date labels |
| `showCtxMenu` | function | Build and show right-click context menu |
| `closeCtxMenu` | function | Hide context menu |
| `ctxSetFollowup` | function | Context menu: set follow-up |
| `ctxSetFollowupCustom` | function | Context menu: set custom follow-up |
| `ctxToggleCat` | function | Context menu: toggle category |
| `ctxClearCats` | function | Context menu: clear all categories |
| `getAgeClass` | function | Get age visual class (old/mid/new) |
| `getItemClass` | function | Get item border class (overdue/due-today/on-track) |
| `getStatusClass` | function | Get status dot class (assigned/scheduled/waiting) |
| `getFilteredWOs` | function | Apply current filter to WO array |

**Internal Helpers:**
- `woCard(w)` — Generate WO card HTML (age ring, status dot, property, vendor, tags, follow-up)
- `sectionHeader(label, count)` — Generate section header HTML (sticky, accent bar, count badge)
- `autoTagNewWOs()` — Auto-assign +3 business days to new WOs (≤2 biz days old)
- `_ctxSave(woNum, patch)` — Persist context menu changes to storage

**Section Grouping Logic:**
1. No Date (no follow-up, sorted by age desc)
2. ⚠ Overdue (follow-up before current week start)
3. This Week (follow-up Mon–Fri current week)
4. Next Week (follow-up Mon–Fri next week)
5. Week After (follow-up 2 weeks out)
6. Later (follow-up 3+ weeks out)

---

### 3. `js/af-panel.js` — AppFolio Panel (219 lines, 6,935 bytes)

**Namespace:** `window.HALQ.af`

**State (`S`):**
| Property | Type | Description |
|----------|------|-------------|
| `baseUrl` | string | AppFolio base URL |
| `viewReady` | boolean | Webview initialization flag |

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `baseUrl` | getter/setter | AppFolio base URL |
| `init` | function | Initialize webview and event listeners |
| `navTo` | function | Navigate to URL |
| `navBack` | function | Webview goBack |
| `navForward` | function | Webview goForward |
| `navReload` | function | Webview reload |
| `addTab` | function | Add new tab |
| `switchToTab` | function | Switch to tab |
| `closeTab` | function | Close tab |
| `scrollTabs` | function | Scroll tab bar |
| `updateTabArrows` | function | Update scroll arrow visibility |
| `autoSearchWO` | function | Search WO in AppFolio, auto-navigate to detail |
| `applyUrl` | function | Set base URL and initialize main tab |

**Auto-Search Flow:**
1. Build search URL: `{baseUrl}/search/advanced_search?full_text_search={WO#}&section_keys=work_orders`
2. Navigate to search
3. Poll for WO detail link (15 attempts, 150ms interval)
4. Execute JavaScript in webview to find `a[href*="/service_requests/"]`
5. Navigate to detail page
6. Trigger auto-fill

**Webview Events:**
- `did-navigate` — Update URL bar
- `did-navigate-in-page` — Update URL bar
- `did-start-loading` — Show loading on active tab
- `did-stop-loading` — Hide loading, update tab URL, trigger auto-fill
- `focus` — Close WO context menu

---

### 4. `js/email-panel.js` — Email Panel (133 lines, 4,071 bytes)

**Namespace:** `window.HALQ.email`

**State:**
- `emViewReady` — Email webview initialization flag

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `init` | function | Initialize email webview |
| `refresh` | function | Reload webview |
| `navBack` | function | Webview goBack |
| `navForward` | function | Webview goForward |
| `navTo` | function | Navigate to URL |
| `addTab` | function | Add email tab |
| `switchToTab` | function | Switch to tab |
| `closeTab` | function | Close tab |
| `scrollTabs` | function | Scroll tab bar |

**Note:** Mirrors `af-panel.js` exactly but for Outlook web. Default URL: `https://outlook.office.com/mail`

---

### 5. `js/notes-panel.js` — Notes Panel (800 lines, 28,178 bytes)

**Namespace:** `window.HALQ.notes`

**State (`S`):**
| Property | Type | Description |
|----------|------|-------------|
| `meta` | object | Notebook/section/page tree (`{ notebooks: [] }`) |
| `current` | object | Active page `{ nbId, secId, pageId }` |
| `dirty` | boolean | Unsaved changes flag |
| `drawMode` | boolean | Drawing mode active |
| `drawDown` | boolean | Mouse is down on canvas |
| `eraser` | boolean | Eraser mode active |
| `drawCtx` | CanvasRenderingContext2D | Canvas 2D context |
| `saveTimer` | timeout | Auto-save debounce timer |
| `promptRes` | function | Prompt modal resolve callback |
| `confirmRes` | function | Confirm modal resolve callback |
| `dragIdx` | number | Page drag-and-drop source index |
| `panelMounted` | boolean | Template mounted flag |
| `dividersInit` | boolean | Resizable dividers initialized |

**Color Palette (`NT_COLORS`):**
`#5b9cf6`, `#34c759`, `#ff9f0a`, `#ff453a`, `#bf5af2`, `#00c7be`, `#ff6b6b`, `#ffd93d`

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `init` | function | Load notes metadata |
| `renderInPanel` | function | Mount notes template into DOM |
| `renderTree` | function | Render notebook/section tree |
| `renderPgPanel` | function | Render pages list for active section |
| `openPage` | function | Load page content |
| `savePage` | function | Persist page content and metadata |
| `showEmpty` | function | Show empty state |
| `toolbar.fmt` | function | `document.execCommand` formatting |
| `toolbar.block` | function | Block formatting (H1, H2, H3, P) |
| `toolbar.list` | function | Bullet/numbered lists |
| `toolbar.checklist` | function | Checkbox list item |
| `toolbar.table` | function | Insert table (prompts rows/cols) |
| `toolbar.image` | function | Insert image from file |
| `toolbar.file` | function | Attach file inline |
| `draw.toggle` | function | Toggle drawing mode |
| `draw.eraser` | function | Toggle eraser |
| `draw.clear` | function | Clear canvas |
| `draw.save` | function | Save drawing as image, insert into page |
| `export.modal` | function | Open export scope picker |
| `export.close` | function | Close export modal |
| `export.setScope` | function | Set export scope |
| `export.run` | function | Execute export |

**CRUD Operations:**
- `addNotebook()` — Prompt for name, create notebook
- `addSection(nbId)` — Prompt for name, create section with auto-color
- `addPage(nbId, secId)` — Prompt for title, create page, open it
- `rename(type, id, parentId, gpId)` — Rename notebook/section/page
- `del(type, id, parentId, gpId)` — Delete with confirmation, cascade cleanup

**Drag & Drop:**
- `_pgDragStart(e, idx)` — Set drag source
- `_pgDragOver(e, idx)` — Show drop indicator
- `_pgDrop(e, nbId, secId)` — Reorder pages in array

**Paste & Drop Handlers:**
- `paste(e)` — Clipboard image → base64 → asset save → inline image
- `drop(e)` — File drop → images inline, files as attachment links

**Export Scopes:**
- `notebook` — Export entire notebook
- `section` — Export single section
- `page` — Export single page

---

### 6. `js/messages.js` — Messages, Templates & Vendor Directory (533 lines, 22,354 bytes)

**Namespace:** `window.HALQ.msg`

**State (`S`):**
| Property | Type | Description |
|----------|------|-------------|
| `templates` | object | `{ tenant: { email: [], text: [] }, vendor: { email: [], text: [] }, owner: { email: [], text: [] } }` |
| `vendorDir` | array | Vendor objects `{ name, phone1, phone2, email }` |

**Default Templates:**
| Group | Type | Templates |
|-------|------|-----------|
| tenant | email | "Not heard from contractor", "Vendor trying to reach you" |
| tenant | text | "Not heard from contractor", "Vendor trying to reach you" |
| vendor | email | "Follow up", "Invoice" |
| vendor | text | "Follow up", "Invoice" |
| owner | email | (empty) |
| owner | text | (empty) |

**Token Placeholders:** `{wo}`, `{prop}`, `{res}`, `{vendor}`, `{vendor_phone}`, `{vendor_email}`, `{vendor_details}`

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `templates` | getter/setter | Message templates |
| `vendorDir` | getter/setter | Vendor directory |
| `init` | function | Load vendor directory |
| `resolveTokens` | function | Replace tokens in template body |
| `renderTemplates` | function | Render template editor UI |
| `addTemplate` | function | Add new template |
| `deleteTemplate` | function | Delete template |
| `saveTemplates` | function | Persist templates |
| `ctxSend` | function | Context menu send action |
| `vendorLookup` | function | Find vendor by name (case-insensitive) |
| `vendorDetailsStr` | function | Format vendor as multi-line string |
| `showVendorModal` | function | Add/edit vendor modal |
| `dirImportExcel` | function | Import vendors from Excel |
| `dirAddManual` | function | Add vendor manually |
| `dirEdit` | function | Edit vendor |
| `dirDelete` | function | Delete vendor |
| `dirRenderTable` | function | Render vendor table with search |
| `dirLoad` | function | Load vendor directory from storage |
| `dirSave` | function | Save vendor directory to storage |

**Send Flow (`ctxSend` → `_doSend` → `_injectAction`):**
1. Get WO data
2. Check if vendor details needed → prompt if missing
3. Resolve tokens in template
4. Switch to WO view
5. Navigate to AppFolio search
6. Poll for WO detail link (20 attempts, 200ms)
7. Navigate to detail page
8. Inject message based on group/type:
   - tenant + email → Click "Notify Tenant" → fill `email_options_body` textarea
   - vendor + email → Click "Notify Vendor" → fill `email_options_body` textarea
   - text (any group) → Click messaging launcher → find SMS textarea → fill with native setter

**Vendor Modal:**
- Fields: Name, Phone 1, Phone 2, Email
- Modes: Prompt (missing vendor, forces save) vs Edit (optional save)
- Auto-sorts directory by name after save

---

### 7. `js/settings.js` — Settings Panel (254 lines, 9,299 bytes)

**Namespace:** `window.HALQ.settings`

**State:**
- `_overlay`, `_panel` — DOM refs
- `_tabBtns`, `_tabBodies` — Tab elements
- `_pin` — PIN state object `{ digits, confirmed, mode }`
  - `mode`: 'verify' | 'set' | 'confirm'

**Exports:**
| Export | Type | Description |
|--------|------|-------------|
| `init` | function | Attach all event listeners |
| `openSettings` | function | Show slide-in panel |
| `closeSettings` | function | Hide slide-in panel |
| `switchSettingsTab` | function | Switch active tab |
| `verifyPin` | function | Verify PIN against stored value |
| `pinKey` | function | Handle keypad digit/back/clear |
| `savePin` | function | Save PIN (verify → set → confirm flow) |
| `clearPin` | function | Remove PIN protection |
| `saveCreds` | function | Save AppFolio credentials (base64 obfuscated) |
| `loadCredsToUI` | function | Load credentials into form |
| `pickExcelPath` | function | Browse for Excel file |
| `resetTemplates` | function | Reset message templates to defaults |
| `importVendors` | function | Toggle vendor import textarea |
| `exportVendors` | function | Export vendor directory as JSON |
| `loadSettingsToUI` | function | Load all settings into form fields |

**Settings Tabs:**
1. **General** — Theme, layout, font, bottom bar toggle
2. **Appearance** — Theme grid (dark/light/midnight/forest), layout options (standard/compact/comfortable), font family (system/inter/roboto/mono), font size slider (10–18px)
3. **Accounts** — AppFolio credentials (username/password), Excel file path
4. **Security** — PIN lock (4–6 digits, keypad + text input)
5. **Messages** — Template editor (tenant/vendor/owner × email/text)
6. **Vendors** — Directory table, import from Excel, export JSON, add manual
7. **Categories** — Category manager bridge button

**PIN Flow:**
1. No PIN stored → enter new PIN → confirm → save
2. PIN stored → verify old → enter new → confirm → save
3. Minimum 4 digits
4. Visual dots (••••) + error shake animation

**Credential Storage:**
- Base64-encoded JSON: `{ u, p, t: Date.now() }`
- Not secure, just not plaintext in localStorage

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
┌──▼───┐ ┌───▼───┐     ┌────▼────┐    ┌────┴────┐
│wo    │ │af     │     │notes    │    │messages │
│panel │ │panel  │     │panel    │    │.js      │
│.js   │ │.js    │     │.js      │    └────┬────┘
└──┬───┘ └───┬───┘     └────┬────┘         │
   │    ┌────┴────┐         │         ┌────┴────┐
   │    │email    │         │         │settings │
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

**Load Order (Critical):**
```html
<!-- 1. Core app (registers namespace, utilities) -->
<script src="js/app.js"></script>

<!-- 2. Feature panels (depend on HALQ.app) -->
<script src="js/wo-panel.js"></script>
<script src="js/af-panel.js"></script>
<script src="js/email-panel.js"></script>
<script src="js/notes-panel.js"></script>

<!-- 3. Shared services (used by panels + settings) -->
<script src="js/messages.js"></script>

<!-- 4. Settings (depends on everything above) -->
<script src="js/settings.js"></script>

<!-- 5. Bootstrap -->
<script>
document.addEventListener('DOMContentLoaded', () => {
  HALQ.app.init();
  HALQ.settings.init();
});
</script>
```

---

## Changelog

| Date | Entry |
|------|-------|
| 2026-06-10 | Refactor initiated. Split from monolith into modular files. |
| 2026-06-10 | Batch 1: CSS files extracted (`app.css`, `wo-panel.css`, `af-panel.css`). |
| 2026-06-10 | Batch 2: CSS files extracted (`email-panel.css`, `notes-panel.css`, `settings.css`, `context-menu.css`, `category-manager.css`). |
| 2026-06-10 | Batch 3: JS files extracted (`app.js`, `wo-panel.js`, `af-panel.js`, `email-panel.js`). |
| 2026-06-10 | Batch 4: JS files extracted (`notes-panel.js`, `messages.js`, `settings.js`). |
| 2026-06-10 | `index.html` reduced to shell only. Refactor structure complete. |
| 2026-06-11 | **Complete V1 extraction pass.** All 8 CSS + 7 JS files fully documented with every selector, function, state object, and dependency. No migration info — extraction only. |

---

*End of Refactor Plan. Append below this line only.*
