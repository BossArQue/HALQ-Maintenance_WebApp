# HALQ v2.2.3 — CODE INDEX (Auto-Generated Reference)

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

### public/js/app.js (v2.1.4)
| Export | Type | Signature | Used By |
|--------|------|-----------|---------|
| HALQ.app.init | function | () | index.html bootstrap |
| HALQ.app.switchView | function | (viewName) | All panels |
| HALQ.apiGet | function | (endpoint) | All modules |
| HALQ.apiPost | function | (endpoint, body) | All modules |
| HALQ.apiPut | function | (endpoint, body) | wo-panel.js |
| HALQ.apiDelete | function | (endpoint) | notes-panel.js |
| HALQ.showDebug | function | (msg) | All modules |
| HALQ.showErrorDialog | function | (title, msg) | All modules |
| HALQ.nextBizDay | function | (date) | wo-panel.js |
| HALQ.nextNextBizDay | function | (date) | wo-panel.js |
| HALQ.getNextFriday | function | (date, weeks) | wo-panel.js |
| HALQ.fmtDate | function | (date) | wo-panel.js, messages.js |
| HALQ.fmtDateISO | function | (date) | notes-panel.js |
| HALQ.getWeekStart | function | (date) | wo-panel.js |
| HALQ.calendarAgeToBizDays | function | (days) | wo-panel.js |
| HALQ.skipWeekend | function | (date) | app.js internal |
| HALQ.escapeHtml | function | (string) | app.js internal |
| APP_VERSION | const | "2.1.1" | — |

### public/js/wo-panel.js (v2.1.4)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| HALQ.wo.renderList | function | () | GET /api/wos |
| HALQ.wo.filter | function | (filterType) | GET /api/wos?filter= |
| HALQ.wo.select | function | (wo) | — |
| HALQ.wo.handleUploadFile | function | (file) | POST /api/upload |
| HALQ.wo.loadWOs | function | () | GET /api/wos |
| HALQ.wo.updateBottomBar | function | () | — |
| HALQ.wo.uploadExcel | function | () | — (opens upload modal) |


**Note (v2.1.3):** All inline `onclick`/`onchange`/`oninput` attributes removed from HTML.
Events attached via `addEventListener()` in JS `init()` to bypass transform-containing-block
issues and CSP restrictions. Portal dropdown pattern: `#followup-dropdown` and `#cat-dropdown`
live at `<body>` level, positioned via `getBoundingClientRect()` + `position: fixed`.

### public/js/notes-panel.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| HALQ.notes.init | function | () | GET /api/notes/meta |
| HALQ.notes.renderTree | function | () | — |
| HALQ.notes.renderPgPanel | function | () | — |
| HALQ.notes.openPage | function | (nbId, secId, pageId) | GET /api/notes/pages/:id |
| HALQ.notes.savePage | function | () | POST /api/notes/pages/:id |
| HALQ.notes.addNotebook | function | () | POST /api/notes/meta |
| HALQ.notes.addSection | function | (nbId) | POST /api/notes/meta |
| HALQ.notes.addPage | function | (nbId, secId) | POST /api/notes/meta |
| HALQ.notes.rename | function | (type, id, ...) | POST /api/notes/meta |
| HALQ.notes.delete | function | (type, id, ...) | DELETE /api/notes/pages/:id + POST /api/notes/meta |
| HALQ.notes.toolbar.fmt | function | (cmd, val) | — |
| HALQ.notes.toolbar.image | function | () | POST /api/notes/assets |
| HALQ.notes.toolbar.file | function | () | POST /api/notes/assets |
| HALQ.notes.draw.toggle | function | () | — |
| HALQ.notes.draw.save | function | () | POST /api/notes/assets |
| HALQ.notes.export.modal | function | () | — |
| HALQ.notes.export.run | function | () | POST /api/notes/export |

### public/js/af-panel.js (v2.1.0)
| Export | Type | Signature |
|--------|------|-----------|
| HALQ.af.init | function | () |
| HALQ.af.navTo | function | (url) |
| HALQ.af.autoSearchWO | function | (wo) |
| HALQ.af.addTab | function | (url) |
| HALQ.af.baseUrl | getter/setter | — |

### public/js/email-panel.js (v2.1.0)
| Export | Type | Signature |
|--------|------|-----------|
| HALQ.email.init | function | () |
| HALQ.email.navTo | function | (url) |
| HALQ.email.addTab | function | (url) |
| HALQ.email.openOutlook | function | () | Opens outlook.office.com in new tab |

### public/js/messages.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| HALQ.msg.ctxSend | function | (wo, templateKey) | GET /api/vendors, GET /api/templates |
| HALQ.msg.resolveTokens | function | (body, wo) | — |
| HALQ.msg.showCopyModal | function | (title, body) | — |

### public/js/categories.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| HALQ.categories.renderManager | function | () | GET /api/categories |
| HALQ.categories.save | function | () | POST /api/categories |
| HALQ.categories.delete | function | (id) | DELETE /api/categories/:id |

### public/js/settings.js (v2.1.0)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| HALQ.settings.init | function | () | GET /api/settings |
| HALQ.settings.save | function | () | POST /api/settings |

---

## API ENDPOINT INDEX

| Endpoint | Method | Request | Response | Handler File |
|----------|--------|---------|----------|--------------|
| /api/wos | GET | ?filter=&search=&cat= | {ok, data: [WO]} | wos/[[id]].js:getAll |
| /api/wos/:id | GET | — | {ok, data: WO} | wos/[[id]].js:getOne |
| /api/wos | POST | [{wo_number, ...}] or {...} | {ok, inserted, updated} | wos/[[id]].js:upsert |
| /api/wos/:id | PUT | {follow_up_date, category_ids, ...} | {ok} | wos/[[id]].js:update |
| /api/wos/:id | DELETE | — | {ok} | wos/[[id]].js:remove |
| /api/upload | POST | {wos: [...], closedWos: [...]} | {ok, counts} | upload.js |
| /api/tags | GET | ?wo=&cat= | {ok, data: [tag]} | tags.js:getTags |
| /api/tags | POST | {wo_number, category_id} | {ok} | tags.js:addTag |
| /api/tags | DELETE | {wo_number, category_id} | {ok} | tags.js:removeTag |
| /api/categories | GET | — | {ok, data: [cat]} | categories.js:getAll |
| /api/categories | POST | {name, color, sort_order} | {ok, id} | categories.js:create |
| /api/categories/:id | PUT | {name, color, sort_order} | {ok} | categories.js:update |
| /api/categories/:id | DELETE | — | {ok} | categories.js:remove |
| /api/vendors | GET | ?search= | {ok, data: [vendor]} | vendors.js:getAll |
| /api/vendors | POST | {name, phone1, phone2, email} | {ok, id, action} | vendors.js:upsert |
| /api/vendors/:id | PUT | {name, phone1, phone2, email} | {ok} | vendors.js:update |
| /api/vendors/:id | DELETE | — | {ok} | vendors.js:remove |
| /api/templates | GET | ?group=&type= | {ok, data: [tmpl]} | templates.js:getAll |
| /api/templates | POST | {group_name, type, name, body, sort_order} | {ok, id} | templates.js:create |
| /api/templates/:id | PUT | {group_name, type, name, body, sort_order} | {ok} | templates.js:update |
| /api/templates/:id | DELETE | — | {ok} | templates.js:remove |
| /api/settings | GET | ?key= | {ok, data: {key, value}} | settings.js:getAll |
| /api/settings | POST | {key, value} | {ok} | settings.js:save |
| /api/settings/:key | DELETE | — | {ok} | settings.js:remove |
| /api/notes/meta | GET | — | {ok, data: {notebooks}} | notes.js:getMeta |
| /api/notes/meta | POST | {notebooks: [...]} | {ok, data: {notebooks}} | notes.js:saveMeta |
| /api/notes/pages/:id | GET | — | {ok, data: {id, title, content}} | notes.js:getPage |
| /api/notes/pages/:id | POST | {content} | {ok} | notes.js:savePage |
| /api/notes/pages/:id | DELETE | — | {ok} | notes.js:deletePage |
| /api/notes/assets | POST | {pageId, fileName, base64} | {ok, src} | notes.js:saveAsset |
| /api/notes/export | POST | {type, nbId, secId, pgId} | {ok, fileName, downloadUrl, html} | notes.js:doExport |

---


---

## CLOUDFLARE PAGES ROUTING NOTES

| File Pattern | Matches URL | params Behavior |
|-------------|-------------|-----------------|
| `functions/api/wos.js` | `/api/wos` ONLY | No params |
| `functions/api/wos/[id].js` | `/api/wos/:id` | `params.id` = string |
| `functions/api/wos/[[id]].js` | `/api/wos` + `/api/wos/:id` + `/api/wos/a/b/c` | `params.id` = array or undefined |

**HALQ uses `[[id]].js` (double brackets)** for `/api/wos` catchall routing.
- `/api/wos` → `params.id` is `undefined`
- `/api/wos/49638-1` → `params.id` = `["49638-1"]`
- `/api/wos/anything/deeper` → `params.id` = `["anything", "deeper"]`

---
## D1 SCHEMA QUICK REF

| Table | Key Columns | Relationships |
|-------|-------------|---------------|
| work_orders | wo_number (UNIQUE), category_ids (JSON), is_active | — |
| categories | id, name (UNIQUE), color, sort_order | — |
| wo_tags | wo_number, category_id (UNIQUE pair) | FK -> work_orders, categories |
| vendors | id, name (UNIQUE), phone1, phone2, email | — |
| message_templates | id, group_name, type, name, body, sort_order | — |
| notebooks | id, name, open | — |
| sections | id, notebook_id, name, color, open, sort_order | FK -> notebooks |
| pages | id, section_id, title, content, sort_order | FK -> sections |
| audit_log | id, action, entity_type, entity_id, details (JSON) | — |
| user_settings | id, key (UNIQUE), value | — |

---

## CSS SELECTOR INDEX (Key Classes)

| Selector | File | Purpose |
|----------|------|---------|
| .af-tab | af-panel.css, email-panel.css | Tab element |
| .af-tab.active | af-panel.css, email-panel.css | Active tab |
| .af-tab.loading | af-panel.css, email-panel.css | Loading state |
| .nt-nb | notes-panel.css | Notebook tree node |
| .nt-nb.open | notes-panel.css | Expanded notebook |
| .nt-sec-row.active | notes-panel.css | Selected section |
| .notes-pg-item.active | notes-panel.css | Selected page |
| .notes-pg-item | notes-panel.css | Page list item (draggable) |
| #notes-tb.enabled | notes-panel.css | Toolbar active state |
| #notes-canvas-wrap.on | notes-panel.css | Drawing mode on |
| #notes-draw-bar.on | notes-panel.css | Draw bar visible |

---

## NAMESPACE TREE

```
window.HALQ
├── .app        -> init(), switchView(), themes, fonts
├── .apiGet     -> (endpoint) -> fetch GET
├── .apiPost    -> (endpoint, body) -> fetch POST
├── .apiPut     -> (endpoint, body) -> fetch PUT
├── .apiDelete  -> (endpoint) -> fetch DELETE
├── .nextBizDay -> (date) -> next business day
├── .nextNextBizDay -> (date) -> next next business day
├── .getNextFriday -> (date, weeks) -> next Friday
├── .fmtDate    -> (date) -> formatted date string
├── .fmtDateISO -> (date) -> YYYY-MM-DD
├── .getWeekStart -> (date) -> Monday of week
├── .calendarAgeToBizDays -> (days) -> business days
├── .showDebug  -> (msg) -> console + toast
├── .showErrorDialog -> (title, msg) -> modal
├── .wo         -> renderList(), filter(), select(), handleUploadFile(), toggleFollowup(), setFollowup(), setFollowupCustom(), toggleCatDropdown(), closeCatDropdown(), applyCategories()
├── .af         -> init(), navTo(), autoSearchWO(), addTab(), baseUrl
├── .email      -> init(), navTo(), addTab(), openOutlook()
├── .notes      -> init(), renderTree(), openPage(), savePage(), addNotebook(), etc.
│   ├── .toolbar -> fmt(), block(), list(), checklist(), table(), image(), file()
│   ├── .draw    -> toggle(), eraser(), clear(), save()
│   └── .export  -> modal(), close(), setScope(), run()
├── .msg        -> ctxSend(), resolveTokens(), showCopyModal()
├── .categories -> renderManager(), save(), delete(), openManager()
├── .settings   -> init(), save()
└── .showDebug / .showErrorDialog
```

---

## CRITICAL PATTERNS (Do Not Break)

1. **All API calls use HALQ.apiGet/Post/Put/Delete** — never raw fetch()
2. **All API responses are {ok, data/error}** — never bare arrays or strings
3. **D1 binding is env.DB** — not env.D1, not env.halq-prod
4. **Audit log on every mutation** — INSERT INTO audit_log (...)
5. **Category IDs are strings in JSON** — category_ids: "[\"1\",\"2\"]" not [1,2]
6. **Notes tree sync sends FULL tree** — backend upserts + deletes missing
7. **Asset storage is inline base64 (Phase 0)** — data:image/png;base64,...
8. **AppFolio/Outlook open in new tabs** — no webview, no injection
9. **No localStorage for WO data** — D1 only. localStorage OK for theme/font/baseUrl
10. **No credential storage in HALQ** — Cloudflare Access SSO handles auth

---

*Generated: 2026-06-16. Version: 2.2.3 → 2.1.4. Update after every code change.*

---

## BRIDGE APP INDEX (v2.2.3)

### bridge/index.js (v2.2.3)
| Export | Type | Signature | Calls |
|--------|------|-----------|-------|
| main | function | () | config.load, watcher.start, sync.loop |
| shutdown | function | () | watcher.stop, cleanup |
| _sanitizePayload | function | (obj) | Strips undefined, converts null to empty string |

### bridge/config.js (v2.2.1)
| Export | Type | Signature | Calls API |
|--------|------|-----------|-----------|
| load | function | () | GET /api/settings?key=bridge_config |
| save | function | (config) | POST /api/settings |
| validate | function | (config) | — |
| promptSetup | function | () | — (CLI dialog) |

### bridge/parser.js (v2.2.3)
| Export | Type | Signature |
|--------|------|-----------|
| parseFile | function | (filePath) -> {wos: [], closed: []} |
| findNewestExcel | function | (folderPath) -> string or null |
| _extractWOs | function | (rows, isActive) -> [WO] |
| _excelSerialToDate | function | (serial) -> Date |

### bridge/obsidian.js (v2.2.1)
| Export | Type | Signature |
|--------|------|-----------|
| syncWOs | function | (vaultPath, wos, tagsMap) |
| ensureFolders | function | (vaultPath, tags) |
| generateMarkdown | function | (wo, tags, isClosed) -> string |
| sanitizeFolderName | function | (name) -> string |
| sanitizeFileName | function | (name) -> string |

### bridge/api.js (v2.2.1)
| Export | Type | Signature |
|--------|------|-----------|
| apiGet | function | (endpoint, params) |
| apiPost | function | (endpoint, body) |
| apiPut | function | (endpoint, body) |
| setBaseUrl | function | (url) |
| setToken | function | (token) |
| setRetry | function | (count, delayMs) |

---

## SETTINGS API EXTENSION (v2.2.3)

| Endpoint | Method | Request | Response | Handler |
|----------|--------|---------|----------|---------|
| /api/settings | GET | ?key=bridge_config | {ok, data: {key, value}} | settings.js:getAll (existing) |
| /api/settings | POST | {key: "bridge_config", value: JSON.stringify({...})} | {ok} | settings.js:save (existing — handles JSON stringify) |

**Note:** settings.js backend already auto-JSON-stringifies objects. Frontend must JSON.stringify() before sending, backend stores as TEXT. On GET, backend returns raw string — Bridge app must JSON.parse().

---

## UPLOAD API CONTRACT (v2.3.0)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| wos | Array<WO> | Yes | Active WOs to upsert |
| closedWos | Array<WO> | No | Explicitly closed WOs |

**Backend behavior:**
1. Upsert all wos with is_active = 1
2. Mark all closedWos with is_active = 0, status = "Completed"
3. Auto-detect: any DB active WO not in wos -> mark closed
4. Return {ok, inserted, updated, closed, autoClosed, total}

---

*Bridge App Index updated 2026-06-16. Version: 2.2.3.*