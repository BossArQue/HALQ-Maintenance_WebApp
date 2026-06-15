# ╔══════════════════════════════════════════════════════════════════════╗
# ║  HALQ v2.1.0 — CODE INDEX (Auto-Generated Reference)                ║
# ╚══════════════════════════════════════════════════════════════════════╝

> **Purpose:** This file is a machine-readable index of every function,
> class, endpoint, and CSS selector in HALQ. A new chat reads this first
> to understand what exists without uploading source files.
>
> **Rule:** Update this file after EVERY code change. It is the contract
> between architecture (OTF) and implementation (source files).
>
> **How to use:** Upload this file + OTF at the start of every chat.
> The AI reads this to know exact function names, signatures, and endpoints.

---

## INDEX BY FILE

### public/js/app.js (v2.1.0)
| Export | Type | Signature | Used By |
|--------|------|-----------|---------|
| `HALQ.app.init` | function | `()` | index.html bootstrap |
| `HALQ.app.switchView` | function | `(viewName)` | All panels |
| `HALQ.apiGet` | function | `(endpoint)` | All modules |
| `HALQ.apiPost` | function | `(endpoint, body)` | All modules |
| `HALQ.apiPut` | function | `(endpoint, body)` | wo-panel.js |
| `HALQ.apiDelete` | function | `(endpoint)` | notes-panel.js |
| `HALQ.showDebug` | function | `(msg)` | All modules |
| `HALQ.showErrorDialog` | function | `(title, msg)` | All modules |
| `APP_VERSION` | const | `"2.1.0"` | — |

### public/js/wo-panel.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| `HALQ.wo.renderList` | function | `()` | GET /api/wos |
| `HALQ.wo.filter` | function | `(filterType)` | GET /api/wos?filter= |
| `HALQ.wo.select` | function | `(wo)` | — |
| `HALQ.wo.handleUploadFile` | function | `(file)` | POST /api/upload |
| `HALQ.wo.loadWOs` | function | `()` | GET /api/wos |
| `HALQ.wo.updateBottomBar` | function | `()` | — |

### public/js/notes-panel.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| `HALQ.notes.init` | function | `()` | GET /api/notes/meta |
| `HALQ.notes.renderTree` | function | `()` | — |
| `HALQ.notes.renderPgPanel` | function | `()` | — |
| `HALQ.notes.openPage` | function | `(nbId, secId, pageId)` | GET /api/notes/pages/:id |
| `HALQ.notes.savePage` | function | `()` | POST /api/notes/pages/:id |
| `HALQ.notes.addNotebook` | function | `()` | POST /api/notes/meta |
| `HALQ.notes.addSection` | function | `(nbId)` | POST /api/notes/meta |
| `HALQ.notes.addPage` | function | `(nbId, secId)` | POST /api/notes/meta |
| `HALQ.notes.rename` | function | `(type, id, ...)` | POST /api/notes/meta |
| `HALQ.notes.delete` | function | `(type, id, ...)` | DELETE /api/notes/pages/:id + POST /api/notes/meta |
| `HALQ.notes.toolbar.fmt` | function | `(cmd, val)` | — |
| `HALQ.notes.toolbar.image` | function | `()` | POST /api/notes/assets |
| `HALQ.notes.toolbar.file` | function | `()` | POST /api/notes/assets |
| `HALQ.notes.draw.toggle` | function | `()` | — |
| `HALQ.notes.draw.save` | function | `()` | POST /api/notes/assets |
| `HALQ.notes.export.modal` | function | `()` | — |
| `HALQ.notes.export.run` | function | `()` | POST /api/notes/export |

### public/js/af-panel.js (v2.1.0)
| Export | Type | Signature |
|--------|------|-----------|
| `HALQ.af.init` | function | `()` |
| `HALQ.af.navTo` | function | `(url)` |
| `HALQ.af.autoSearchWO` | function | `(wo)` |
| `HALQ.af.addTab` | function | `(url)` |
| `HALQ.af.baseUrl` | getter/setter | — |

### public/js/email-panel.js (v2.1.0)
| Export | Type | Signature |
|--------|------|-----------|
| `HALQ.email.init` | function | `()` |
| `HALQ.email.navTo` | function | `(url)` |
| `HALQ.email.addTab` | function | `(url)` |

### public/js/messages.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| `HALQ.msg.ctxSend` | function | `(wo, templateKey)` | GET /api/vendors, GET /api/templates |
| `HALQ.msg.resolveTokens` | function | `(body, wo)` | — |
| `HALQ.msg.showCopyModal` | function | `(title, body)` | — |

### public/js/categories.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| `HALQ.categories.renderManager` | function | `()` | GET /api/categories |
| `HALQ.categories.save` | function | `()` | POST /api/categories |
| `HALQ.categories.delete` | function | `(id)` | DELETE /api/categories/:id |

### public/js/settings.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| `HALQ.settings.init` | function | `()` | GET /api/settings |
| `HALQ.settings.save` | function | `()` | POST /api/settings |

---

## API ENDPOINT INDEX

| Endpoint | Method | Request | Response | Handler File |
|----------|--------|---------|----------|--------------|
| `/api/wos` | GET | `?filter=&search=&cat=` | `{ok, data: [WO]}` | wos.js:getAll |
| `/api/wos/:id` | GET | — | `{ok, data: WO}` | wos.js:getOne |
| `/api/wos` | POST | `[{wo_number, ...}]` or `{...}` | `{ok, inserted, updated}` | wos.js:upsert |
| `/api/wos/:id` | PUT | `{follow_up_date, category_ids, ...}` | `{ok}` | wos.js:update |
| `/api/wos/:id` | DELETE | — | `{ok}` | wos.js:remove |
| `/api/upload` | POST | `{wos: [...]}` | `{ok, counts}` | upload.js |
| `/api/tags` | GET | `?wo=&cat=` | `{ok, data: [tag]}` | tags.js:getTags |
| `/api/tags` | POST | `{wo_number, category_id}` | `{ok}` | tags.js:addTag |
| `/api/tags` | DELETE | `{wo_number, category_id}` | `{ok}` | tags.js:removeTag |
| `/api/categories` | GET | — | `{ok, data: [cat]}` | categories.js:getAll |
| `/api/categories` | POST | `{name, color, sort_order}` | `{ok, id}` | categories.js:create |
| `/api/categories/:id` | PUT | `{name, color, sort_order}` | `{ok}` | categories.js:update |
| `/api/categories/:id` | DELETE | — | `{ok}` | categories.js:remove |
| `/api/vendors` | GET | `?search=` | `{ok, data: [vendor]}` | vendors.js:getAll |
| `/api/vendors` | POST | `{name, phone1, phone2, email}` | `{ok, id, action}` | vendors.js:upsert |
| `/api/vendors/:id` | PUT | `{name, phone1, phone2, email}` | `{ok}` | vendors.js:update |
| `/api/vendors/:id` | DELETE | — | `{ok}` | vendors.js:remove |
| `/api/templates` | GET | `?group=&type=` | `{ok, data: [tmpl]}` | templates.js:getAll |
| `/api/templates` | POST | `{group_name, type, name, body, sort_order}` | `{ok, id}` | templates.js:create |
| `/api/templates/:id` | PUT | `{group_name, type, name, body, sort_order}` | `{ok}` | templates.js:update |
| `/api/templates/:id` | DELETE | — | `{ok}` | templates.js:remove |
| `/api/settings` | GET | `?key=` | `{ok, data: {key, value}}` | settings.js:getAll |
| `/api/settings` | POST | `{key, value}` | `{ok}` | settings.js:save |
| `/api/settings/:key` | DELETE | — | `{ok}` | settings.js:remove |
| `/api/notes/meta` | GET | — | `{ok, data: {notebooks}}` | notes.js:getMeta |
| `/api/notes/meta` | POST | `{notebooks: [...]}` | `{ok, data: {notebooks}}` | notes.js:saveMeta |
| `/api/notes/pages/:id` | GET | — | `{ok, data: {id, title, content}}` | notes.js:getPage |
| `/api/notes/pages/:id` | POST | `{content}` | `{ok}` | notes.js:savePage |
| `/api/notes/pages/:id` | DELETE | — | `{ok}` | notes.js:deletePage |
| `/api/notes/assets` | POST | `{pageId, fileName, base64}` | `{ok, src}` | notes.js:saveAsset |
| `/api/notes/export` | POST | `{type, nbId, secId, pgId}` | `{ok, fileName, downloadUrl, html}` | notes.js:doExport |

---

## D1 SCHEMA QUICK REF

| Table | Key Columns | Relationships |
|-------|-------------|---------------|
| `work_orders` | `wo_number` (UNIQUE), `category_ids` (JSON), `is_active` | — |
| `categories` | `id`, `name` (UNIQUE), `color`, `sort_order` | — |
| `wo_tags` | `wo_number`, `category_id` (UNIQUE pair) | FK → work_orders, categories |
| `vendors` | `id`, `name` (UNIQUE), `phone1`, `phone2`, `email` | — |
| `message_templates` | `id`, `group_name`, `type`, `name`, `body`, `sort_order` | — |
| `notebooks` | `id`, `name`, `open` | — |
| `sections` | `id`, `notebook_id`, `name`, `color`, `open`, `sort_order` | FK → notebooks |
| `pages` | `id`, `section_id`, `title`, `content`, `sort_order` | FK → sections |
| `audit_log` | `id`, `action`, `entity_type`, `entity_id`, `details` (JSON) | — |
| `user_settings` | `id`, `key` (UNIQUE), `value` | — |

---

## CSS SELECTOR INDEX (Key Classes)

| Selector | File | Purpose |
|----------|------|---------|
| `.af-tab` | af-panel.css, email-panel.css | Tab element |
| `.af-tab.active` | af-panel.css, email-panel.css | Active tab |
| `.af-tab.loading` | af-panel.css, email-panel.css | Loading state |
| `.nt-nb` | notes-panel.css | Notebook tree node |
| `.nt-nb.open` | notes-panel.css | Expanded notebook |
| `.nt-sec-row.active` | notes-panel.css | Selected section |
| `.notes-pg-item.active` | notes-panel.css | Selected page |
| `.notes-pg-item` | notes-panel.css | Page list item (draggable) |
| `#notes-tb.enabled` | notes-panel.css | Toolbar active state |
| `#notes-canvas-wrap.on` | notes-panel.css | Drawing mode on |
| `#notes-draw-bar.on` | notes-panel.css | Draw bar visible |

---

## NAMESPACE TREE

```
window.HALQ
├── .app        → init(), switchView(), themes, fonts
├── .apiGet     → (endpoint) → fetch GET
├── .apiPost    → (endpoint, body) → fetch POST
├── .apiPut     → (endpoint, body) → fetch PUT
├── .apiDelete  → (endpoint) → fetch DELETE
├── .wo         → renderList(), filter(), select(), handleUploadFile()
├── .af         → init(), navTo(), autoSearchWO(), addTab(), baseUrl
├── .email      → init(), navTo(), addTab()
├── .notes      → init(), renderTree(), openPage(), savePage(), addNotebook(), etc.
│   ├── .toolbar → fmt(), block(), list(), checklist(), table(), image(), file()
│   ├── .draw    → toggle(), eraser(), clear(), save()
│   └── .export  → modal(), close(), setScope(), run()
├── .msg        → ctxSend(), resolveTokens(), showCopyModal()
├── .categories → renderManager(), save(), delete()
├── .settings   → init(), save()
└── .showDebug / .showErrorDialog
```

---

## CRITICAL PATTERNS (Do Not Break)

1. **All API calls use `HALQ.apiGet/Post/Put/Delete`** — never raw `fetch()`
2. **All API responses are `{ok, data/error}`** — never bare arrays or strings
3. **D1 binding is `env.DB`** — not `env.D1`, not `env.halq-prod`
4. **Audit log on every mutation** — `INSERT INTO audit_log (...)`
5. **Category IDs are strings in JSON** — `category_ids: '["1","2"]'` not `[1,2]`
6. **Notes tree sync sends FULL tree** — backend upserts + deletes missing
7. **Asset storage is inline base64 (Phase 0)** — `data:image/png;base64,...`
8. **AppFolio/Outlook open in new tabs** — no webview, no injection
9. **No localStorage for WO data** — D1 only. localStorage OK for theme/font/baseUrl
10. **No credential storage in HALQ** — Cloudflare Access SSO handles auth

---

*Generated: 2026-06-14. Version: 2.1.0. Update after every code change.*


---

## CSS SELECTOR INDEX (v2.1.0 — Added 2026-06-15)

### public/css/app.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `:root` | CSS custom properties: fonts, sizes, 4 theme color palettes, shadows |
| `body[data-theme="light"]` | Light theme override |
| `body[data-theme="midnight"]` | Midnight theme override |
| `body[data-theme="forest"]` | Forest theme override |
| `.titlebar` | Top app bar with drag region |
| `.tb-btn` / `.tb-btn.active` | Titlebar nav buttons |
| `.app` | Main flex layout (sidebar + content) |
| `.sidebar` / `.sidebar.hidden` | Left nav sidebar with collapse |
| `.sidebar-logo` | HALQ logo block |
| `.nav-item` / `.nav-item.active` | Sidebar nav items with badge |
| `.nav-badge` | WO count badge on nav |
| `.status-pill` / `.status-dot` | Footer clock with pulsing green dot |
| `.main` | Main content area |
| `.topbar` | Page title bar with actions |
| `.panel-layout` / `.panel-layout.vertical` | WO view flex/vertical layout |
| `.resize-divider` / `.resize-divider.dragging` | Draggable splitter with grip |
| `.btn` / `.btn-primary` / `.btn-ghost` | Shared button styles |
| `.upload-overlay` / `.upload-box` / `.upload-dropzone` | Excel upload modal |
| `.upload-dropzone.drag-over` | Drag active state |
| `.settings-overlay` / `.settings-overlay.open` | Settings panel with transition |
| `.settings-panel` | Settings modal content |
| `.theme-grid` / `.theme-option` / `.theme-option.active` | 4-theme picker grid |
| `.font-options` / `.font-option` / `.font-option.active` | Font family picker |
| `.font-size-slider` | Styled range input |
| `.catmgr-overlay` / `.catmgr-overlay.open` | Category manager modal |
| `.catmgr-modal` / `.catmgr-header` / `.catmgr-body` | Split-pane manager layout |
| `.catmgr-list` / `.catmgr-actions` / `.catmgr-footer` | Manager panes |
| `#autofill-debug` | Debug toast bar |
| `#halq-error-dialog` | Error dialog overlay |

### public/css/wo-panel.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.wo-panel` | WO list container |
| `.wo-search-wrap` / `.wo-search` / `.wo-search-clear` | Search with clear button |
| `.wo-search-clear.visible` | Clear button show/hide |
| `.wo-filters-wrap` / `.wo-filters` | Filter chips container |
| `.filter-chip` / `.filter-chip.active` | All/Overdue/Today chips |
| `.wo-filter-more-wrap` / `.wo-filter-more-btn` | Category filter trigger |
| `.wo-filter-more-btn.cat-active` | Active category filter state |
| `.wo-filter-dropdown` / `.wo-filter-dropdown.open` | Category dropdown (fixed pos) |
| `.wo-filter-dd-item` / `.wo-filter-dd-item.active` | Category dropdown items |
| `.wo-list` | Scrollable WO card list |
| `.wo-item` / `.wo-item.active` / `.wo-item:hover` | WO card with hover slide |
| `.wo-item.overdue` / `.wo-item.due-today` / `.wo-item.on-track` | Status left borders |
| `.wo-age-ring` / `.wo-age-ring svg` / `.wo-age-ring-label` | SVG age indicator |
| `.wo-status-dot.assigned` / `.scheduled` / `.waiting` | Status dots with glow |
| `.wo-num` / `.wo-tag` / `.wo-prop` / `.wo-vendor` | Card text elements |
| `.wo-cat-strips` / `.wo-cat-strip` | Category color pills |
| `.bottombar` / `.bb-item` | Footer stats bar |
| `.wo-detail` / `.wo-detail.open` | Slide-in detail drawer |
| `.wo-detail-header` / `.wo-detail-title` / `.wo-detail-close` | Drawer header |
| `.detail-row` / `.detail-label` / `.detail-val` | Detail field rows |
| `.detail-actions` | Save button row |
| `.followup-wrap` / `.followup-trigger` | Follow-up date trigger |
| `.followup-dropdown` / `.followup-dropdown.open` | Follow-up options (fixed pos) |
| `.followup-opt` / `.followup-opt.active` | Date option rows |
| `.followup-custom-row` / `.followup-custom-row.open` | Custom date input |
| `.cat-wrap` / `.cat-trigger` | Category trigger in drawer |
| `.cat-dropdown` / `.cat-dropdown.open` | Category selector (fixed pos) |
| `.cat-opt` / `.cat-opt.active` / `.cat-opt-clear` / `.cat-opt-manage` | Category options |
| `.cat-checkbox` | Check indicator for selected cats |
| `.wo-ctx-menu` | Right-click context menu (fixed pos) |
| `.wo-ctx-section` / `.wo-ctx-sep` | Menu section headers |
| `.wo-ctx-item` / `.wo-ctx-item.has-flyout` | Menu items with submenu |
| `.wo-ctx-flyout` | Nested flyout submenu (fixed pos) |
| `.ctx-dot` | Color dot in context menu |

### public/css/af-panel.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.af-panel` | AppFolio panel container |
| `.af-urlbar` / `.af-url-input` / `.af-url-btn` | URL input bar |
| `.af-nav-btns` / `.af-nav-btn` | Back/forward nav buttons |
| `.af-tabbar` | Tab strip container |
| `.af-tab` / `.af-tab.active` / `.af-tab.loading` | Tab with loading spinner |
| `.af-tab-close` | Tab close button (hover reveal) |
| `.af-tab-add` | New tab button |
| `.af-content` / `.af-content-icon` / `.af-content-title` / `.af-content-desc` | Empty state |
| `.af-quick-links` / `.af-quick-link` | Quick URL shortcuts |
| `.af-search-wo` / `.af-search-wo-input` | WO search input |

### public/css/email-panel.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.email-panel` | Email panel container |
| `.email-urlbar` / `.email-url-input` / `.email-url-btn` | URL input bar |
| `.email-tabbar` / `.email-tab` / `.email-tab.active` / `.email-tab.loading` | Tab system |
| `.email-tab-close` / `.email-tab-add` | Tab controls |
| `.email-content` / `.email-content-icon` / `.email-content-title` / `.email-content-desc` | Empty state |
| `.email-quick-links` / `.email-quick-link` | Quick URL shortcuts |
| `.email-compose-btn` | Compose new email button |
| `.email-account-row` / `.email-account-label` / `.email-account-select` | Account selector |

### public/css/notes-panel.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.notes-panel` | Notes 3-pane layout container |
| `.notes-tree` / `.notes-tree-header` / `.notes-tree-scroll` | Left tree sidebar |
| `.nt-nb` / `.nt-nb.open` | Notebook node (expandable) |
| `.nt-nb-header` / `.nt-nb-header.active` | Notebook header row |
| `.nt-nb-chevron` | Expand/collapse arrow (rotates) |
| `.nt-nb-actions` / `.nt-nb-action` | Hover action buttons |
| `.nt-sec-row` / `.nt-sec-row.active` | Section row in tree |
| `.nt-sec-dot` / `.nt-sec-actions` | Section color + hover actions |
| `.notes-pg-list` / `.notes-pg-list-header` | Middle page list pane |
| `.notes-pg-item` / `.notes-pg-item.active` / `.notes-pg-item.dragging` | Page list items |
| `.notes-editor` | Right editor pane |
| `.notes-toolbar` / `.notes-toolbar.enabled` / `.notes-toolbar.disabled` | Rich text toolbar |
| `.notes-tb-btn` / `.notes-tb-btn.active` | Toolbar buttons |
| `.notes-tb-sep` / `.notes-tb-label` | Toolbar dividers |
| `.notes-content` | contenteditable area |
| `.notes-content h1/h2/h3/p/ul/ol/li/blockquote/img/table/th/td` | Editor content styles |
| `#notes-canvas-wrap` / `#notes-canvas-wrap.on` | Drawing canvas overlay |
| `#notes-draw-bar` / `#notes-draw-bar.on` | Drawing toolbar |
| `.notes-draw-btn` / `.notes-draw-btn.active` | Draw tool buttons |
| `.notes-draw-color` / `.notes-draw-color.active` | Color swatches |
| `.notes-draw-slider` | Brush size slider |
| `.notes-export-overlay` / `.notes-export-box` | Export modal |
| `.notes-export-option` / `.notes-export-option.active` | Export scope options |
| `.notes-export-actions` | Export modal buttons |
| `.notes-import-zone` / `.notes-import-zone.drag-over` | Import dropzone |
| `.notes-empty` / `.notes-empty-icon` | Empty state |
| `.nt-rename-input` | Inline rename input |

### public/css/settings.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.settings-tabs` / `.settings-tab` / `.settings-tab.active` | Settings tab bar |
| `.settings-toggle-row` / `.settings-toggle-label` / `.settings-toggle-desc` | Toggle rows |
| `.toggle-switch` / `.toggle-switch.on` | Animated toggle switch |
| `.settings-input-row` / `.settings-input-label` / `.settings-input` | Input fields |
| `.settings-select` | Styled select dropdown |
| `.settings-btn-row` | Button groups |
| `.settings-danger` / `.settings-danger-title` | Danger zone styling |
| `.settings-info` / `.settings-info code` | Info blocks with inline code |
| `.settings-divider` | Section dividers |

### public/css/context-menu.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.ctx-menu` / `@keyframes ctx-fade-in` | Base context menu with animation |
| `.ctx-menu-section` / `.ctx-menu-sep` | Menu headers |
| `.ctx-menu-item` / `.ctx-menu-item.disabled` / `.ctx-menu-item.danger` / `.ctx-menu-item.accent` | Menu items |
| `.ctx-flyout` | Submenu flyout (fixed pos) |
| `.ctx-menu-item.has-flyout` / `::after` | Flyout indicator arrow |
| `.ctx-icon` / `.ctx-dot` / `.ctx-check` | Menu icons |
| `.ctx-shortcut` | Keyboard shortcut labels |
| `.ctx-badge` | Count badges |
| `.dropdown` / `.dropdown.open` | Shared dropdown pattern |
| `.dropdown-item` / `.dropdown-item.active` / `.dropdown-item.disabled` | Dropdown items |
| `.dropdown-sep` / `.dropdown-header` | Dropdown structure |
| `.tooltip` / `.tooltip.visible` | Tooltip pattern |

### public/css/category-manager.css (v2.1.0)
| Selector | Purpose |
|----------|---------|
| `.catmgr-list-item` / `.catmgr-list-item.active` / `.catmgr-list-item.dragging` / `.catmgr-list-item.drag-over` | Category list rows |
| `.catmgr-color-dot` | Color indicator dot |
| `.catmgr-item-name` / `.catmgr-item-count` | Name + WO count |
| `.catmgr-drag-handle` | Drag grip (hover reveal) |
| `.catmgr-color-grid` | Color picker grid |
| `.catmgr-color-swatch` / `.catmgr-color-swatch.active` | Color swatches with checkmark |
| `.catmgr-empty` / `.catmgr-empty-icon` / `.catmgr-empty-text` | Empty state |
| `.catmgr-sort-indicator` | Sort direction indicator |
| `.catmgr-confirm` / `.catmgr-confirm-text` / `.catmgr-confirm-actions` | Delete confirmation |
| `.catmgr-status.success` / `.catmgr-status.error` / `.catmgr-status.warning` | Status message colors |
| `.catmgr-search` | Category search input |

---

*CSS Selector Index added 2026-06-15. Version: 2.1.0.*
