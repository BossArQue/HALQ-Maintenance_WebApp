# HALQ v2.2.3 — ERROR LOG (Battle Scars & Gotchas)

> **Purpose:** This file tracks bugs found, fixes applied, and gotchas discovered during development.
> **Rule:** Append only. Every bug fixed gets one line minimum.

---

## 2026-06-14 — v2.1.0 Build Phase

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 1 | notes.js saveMeta SQL injection risk | functions/api/notes.js | Building dynamic SQL with NOT IN | Used parameterized queries with .bind(...Array.from(touchedPgIds)) |
| 2 | category_ids must be strings in JSON | functions/api/wos.js, functions/api/tags.js | Frontend sends string IDs, D1 stores as TEXT JSON | Always JSON.stringify(["1","2"]) never [1,2] |
| 3 | notes.js new notebook ID is string from frontend, needs parseInt | functions/api/notes.js | Frontend generates n123abc UIDs, D1 uses INTEGER autoincrement | parseInt(nb.id) returns NaN for new items -> insert with auto-increment, return new ID |
| 4 | wo_tags UNIQUE constraint on (wo_number, category_id) | db/schema.sql | Duplicate tag insert throws SQLite error | tags.js catches e.message.includes("UNIQUE") and returns 409 |
| 5 | Inline base64 images in notes content bloat D1 | functions/api/notes.js | Phase 0 uses data:image/png;base64,... in pages.content | Acceptable for MVP. Migrate to R2 in v2.2 |
| 6 | HALQ.apiGet/Post/Put/Delete must use relative /api/ paths | public/js/app.js | Hardcoded URLs break on different domains | Pattern: fetch(`/api${endpoint}`) |
| 7 | wrangler.toml D1 binding name is halq-prod but code uses env.DB | wrangler.toml | Binding alias in wrangler config | [[env.production.d1_databases]] binding = "DB" maps to env.DB |
| 8 | CORS preflight handled in _middleware.js, not per-endpoint | functions/_middleware.js | OPTIONS requests were 404ing on individual API files | Global middleware catches all OPTIONS before routing |
| 9 | Audit log details column is TEXT, must JSON.stringify objects | All API files | Passing objects to TEXT column causes [object Object] | Always JSON.stringify(details) before binding |
| 10 | work_orders.is_active is INTEGER (0/1), not BOOLEAN | db/schema.sql | SQLite has no native BOOLEAN | Frontend maps !!row.is_active, backend sets 1 or 0 |
| 11 | notes-panel.js _saveMeta sends FULL tree every time | public/js/notes-panel.js | Any change triggers full tree POST | Backend saveMeta does upsert + cleanup. Acceptable for <100 notebooks |
| 12 | af-panel.js navBack/Forward are no-ops in v2 | public/js/af-panel.js | Browser handles history in new-tab mode, no webview API | Functions exist as stubs to prevent frontend errors |
| 13 | email-panel.js $.$view typo from v1 refactor | public/js/email-panel.js | Variable name was $.$view instead of $.view | Fixed in v2.1.0 rewrite |
| 14 | messages.js clipboard copy fallback _showCopyModal | public/js/messages.js | navigator.clipboard fails in some browsers | Modal with manual copy button as fallback |
| 15 | settings.js no longer stores PIN or credentials | public/js/settings.js | Cloudflare Access SSO handles auth | Removed all PIN/credential logic. UI prefs only |
| 16 | AI assumed CSS files existed because OTF showed checkmark | HALQ_ONE_TRUE_FILE.md | OTF listed 8 CSS files as "From v1 refactor" with checkmarks | AI FAULT: Did not verify files actually existed. CSS files NEVER existed. |
| 17 | OTF falsely claims CSS files are complete | HALQ_ONE_TRUE_FILE.md | Historical v1->v2 refactor description copied without verification | Mark ALL CSS entries as X NOT BUILT. Build CSS from scratch. |

---

## 2026-06-15 — v2.2.0 Bridge App Build Session

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 18 | node bridge/index.js path error | User command | Already inside bridge/ folder, ran node bridge/index.js | User error — correct command is node index.js |
| 19 | rm -rf fails in PowerShell | PowerShell terminal | rm in PowerShell is Remove-Item, -rf are bash flags | User error — use Remove-Item -Recurse -Force |
| 20 | tray.js regex syntax error | bridge/tray.js | __dirname.replace(/\\/g, "\\\\") inside template string parsed as JS regex literal | Pre-computed path escaping outside template string, v2.2.1 |
| 21 | xlsx npm package deprecated | bridge/package.json | xlsx on npm is deprecated; SheetJS distributes via CDN tarball | Changed dep to "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz" |
| 22 | D1 tables missing on first Bridge run | functions/api/settings.js | D1 schema not yet applied to production DB | Ran wrangler d1 execute halq-prod --file=db/schema.sql --remote |
| 23 | D1_TYPE_ERROR: undefined not supported | functions/api/upload.js v2.0.0 | Bridge sends WOs with undefined values for empty Excel cells; D1 SQLite rejects undefined bindings | Added _sanitizeWO() in upload.js v2.2.0 — converts all undefined/null to empty string |
| 24 | Parser found 0 WOs from Excel | bridge/parser.js v2.2.0 | Excel file Sheet1 has duplicate header row (row 1 == row 0) | Added duplicate header detection — skips row 1 if it matches row 0 exactly, v2.2.2 |
| 25 | wrangler deploy warning on Pages project | User command | Cloudflare Pages projects use wrangler pages deploy or git auto-deploy | User error — use git push for Pages projects with git integration |
| 26 | wrangler pages deploy asks to create new project | User command | Project name mismatch — wrangler.toml name does not match Pages project name | User error — Pages with git integration auto-deploys on git push |

---

## 2026-06-16 — v2.2.3 Bridge + WebApp Fix Session

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 27 | Website showed no WOs | public/js/app.js v2.1.0 | HALQ.nextBizDay not in root namespace — only exposed as HALQ.app.utils.nextBizDay | app.js v2.1.1: attached all utils directly to HALQ root namespace |
| 28 | JSON.parse crash on WOs | functions/api/wos.js v2.0.0 | category_ids was null in D1 for newly inserted WOs; wo-panel.js called JSON.parse(null) which works, but JSON.parse(undefined) throws | wos.js v2.1.0: row.category_ids || "[]" ensures always valid JSON string |
| 29 | D1_TYPE_ERROR: undefined on upload | functions/api/upload.js v2.0.0 | Deployed backend lacked _sanitizeWO fix from v2.2.0; Bridge sent undefined values | upload.js v2.3.0: added _sanitizeWO + Bridge index.js v2.2.3 added _sanitizePayload as belt-and-suspenders |
| 30 | Bridge sent flat wos array | bridge/index.js v2.2.0 | Backend upload.js v2.3.0 expects {wos, closedWos} split for explicit closed handling | index.js v2.2.1: separate parsed.active and parsed.closed in upload payload |
| 31 | Config key mismatch | bridge/config.js v2.2.0 | save() used apiUrl, load() read apiBaseUrl — inconsistent | config.js v2.2.1: unified on apiBaseUrl key name |
| 32 | Bridge hung on upload | bridge/api.js v2.2.0 | node-fetch has no default timeout; Cloudflare Worker 30s limit caused hang | api.js v2.2.1: added abort-controller with 30s timeout + 3 retry attempts |
| 33 | is_active not set per sheet | bridge/parser.js v2.2.0 | All WOs got is_active = 1 regardless of source sheet | parser.js v2.2.3: active sheet -> is_active = 1, closed sheet -> is_active = 0 |
| 34 | wos.js v2.0.0 never updated | functions/api/wos.js | File dated 6/13, not updated during v2.1.0 API layer build | wos.js v2.1.0: rebuilt with null-safe category_ids, filter/search/cat params, audit logging |
| 35 | Python string escaping broke JS | bridge/index.js v2.2.1 | backslash-n in Python string was interpreted as newline instead of literal backslash-n | Used raw string r for JS generation; verified no broken string literals |
| 36 | wo-panel.js dropdown functions not exported | public/js/wo-panel.js v2.1.0 | `toggleCatDropdown` not in `HALQ.wo` API; `HALQ.closeAllDropdowns()` should be `HALQ.app.closeAllDropdowns()` | wo-panel.js v2.1.1: exported `toggleCatDropdown`, `toggleFollowup`, `setFollowup`, `setFollowupCustom`, `closeCatDropdown`, `setCatDropdown`; fixed `closeAllDropdowns` refs to `HALQ.app.closeAllDropdowns()` |
| 37 | Detail panel dropdowns clipped invisible | public/css/wo-panel.css v2.1.0 | `.wo-detail` has `overflow:hidden` + `transform:translateX(0)` which creates a containing block. `position:fixed` dropdowns (Follow-up, Categories) are clipped by parent's overflow even with `.open` class | wo-panel.css v2.1.1: removed `overflow:hidden` from `.wo-detail`. `.wo-detail-body` already has `overflow-y:auto` for scrolling |

---

## Known Issues (Not Yet Fixed)

| # | Issue | File | Impact | Planned Fix |
|---|-------|------|--------|-------------|
| 1 | notes.js export generates HTML server-side but no ZIP | functions/api/notes.js | Large exports are single HTML files | v2.2: Use R2 + ZIP library |
| 2 | notes.js asset storage inline base64 has ~1MB practical limit | functions/api/notes.js | Very large images may fail | v2.2: R2 presigned URLs |
| 3 | No rate limiting in API endpoints | All functions/api/*.js | Open to abuse | Phase 1: KV-based rate limiting in _middleware.js |
| 4 | No auth on API endpoints | All functions/api/*.js | Anyone can call API | Phase 1: Cloudflare Access JWT verification |
| 5 | wo-panel.js Excel upload uses SheetJS CDN | public/index.html | External dependency | Acceptable. Can vendor if needed |
| 6 | notes-panel.js document.execCommand is deprecated | public/js/notes-panel.js | May break in future browsers | v2.3: Migrate to contenteditable + modern APIs |
| 7 | No real-time sync between users | All | Single-user only | v2.4: WebSocket or SSE |
| 8 | Bridge config UI not in webapp | public/js/settings.js | User must set env var or edit .bridge-config.json | Add Bridge config section to settings panel |
| 9 | Bridge auto-start with Windows not implemented | bridge/index.js | Manual start only | Add registry/startup folder logic |
| 10 | .xlsm workbook with multiple sheets not fully tested | bridge/parser.js | Only tested with raw .xlsx export | Add .xlsm test with Active Monitoring + Closed sheets |
| 11 | Tray icon temp files on crash | bridge/tray.js | .tray.ps1, .tray-status.json, .tray-icon.ico may persist | Low priority — cleanup on next startup |
| 12 | tray.js hardcoded localhost URL | bridge/tray.js | Open HALQ WebApp menu item opens localhost:8787 | Read from config or env var |

---

## Frontend <-> Backend Contract Mismatches (Prevented)

| Frontend Sends | Backend Expects | File Pair | Status |
|---------------|-----------------|-----------|--------|
| HALQ.apiPost("/notes/meta", {notebooks}) | {notebooks: [{id, name, open, sections:[]}]} | notes-panel.js <-> notes.js | Verified |
| HALQ.apiPost("/notes/pages/" + id, {content}) | {content: "<html>string</html>"} | notes-panel.js <-> notes.js | Verified |
| HALQ.apiPost("/notes/assets", {pageId, fileName, base64}) | {pageId, fileName, base64} | notes-panel.js <-> notes.js | Verified |
| HALQ.apiPost("/notes/export", {type, nbId, secId, pgId}) | {type: "notebook"|"section"|"page", nbId, secId, pgId} | notes-panel.js <-> notes.js | Verified |
| HALQ.apiPost("/tags", {wo_number, category_id}) | {wo_number: "WO-123", category_id: 1} | wo-panel.js <-> tags.js | Verified |
| HALQ.apiGet("/wos?filter=overdue&search=&cat=1") | filter: "overdue"|"today"|"all", search: string, cat: string | wo-panel.js <-> wos.js | Verified |
| HALQ.apiPost("/upload", {wos, closedWos}) | {wos: [WO], closedWos: [WO]} | bridge/index.js <-> upload.js | Verified v2.2.3 |

---

*Last updated: 2026-06-16. Append only.*

## 2026-06-16 — v2.1.3 addEventListener Fix Session

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 38 | Inline onclick handlers not firing inside transformed parent | public/index.html, public/js/wo-panel.js | `.wo-detail` has `transform: translateX()` which creates containing block; inline `onclick` silently fails in some browser conditions | Replaced ALL inline onclick with `addEventListener()` in JS init(). Portal dropdowns at body level. |
| 39 | `HALQ.categories` is undefined — should be `HALQ.cat` | public/js/wo-panel.js | Namespace mismatch: `app.js` registers `HALQ.cat`, but `wo-panel.js` calls `HALQ.categories.openManager()` | PENDING FIX: Change to `HALQ.catMgr.open?.()` or unify namespace |
| 40 | PUT /api/wos/:id returns 405 Method Not Allowed | functions/api/wos.js | Cloudflare Pages Functions only auto-routes GET/POST/OPTIONS by default. PUT requires explicit `onRequestPut` export OR `export default` handler that checks request.method | PENDING FIX: Verify wos.js exports onRequestPut; check _middleware.js CORS allows PUT |
| 41 | `apiPut` crashes on empty 405 response body | public/js/app.js | `res.json()` called on empty body throws "Unexpected end of JSON input" | PENDING FIX: Add response.ok check and content-type guard before res.json() |

---

*Last updated: 2026-06-16. Append only.*
## 2026-06-16 — v2.1.4 Troubleshooting Session

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 42 | PUT 405 on /api/wos/:id | functions/api/wos.js | Cloudflare Pages Functions file-based routing: `functions/api/wos.js` only matches `/api/wos` exactly, not `/api/wos/49638-1`. Internal regex never executed because router never invoked the file. | Moved to `functions/api/wos/[[id]].js` catchall route; changed `WHERE id = ?` to `WHERE wo_number = ?` |
| 43 | HALQ.categories undefined | public/index.html | `categories.js` script tag missing from HTML. OTF described init order but actual `index.html` only loaded `app.js` + `wo-panel.js`. | Added all 6 missing script tags (`af-panel.js`, `email-panel.js`, `notes-panel.js`, `messages.js`, `categories.js`, `settings.js`) with absolute `/js/` paths |
| 44 | "All Categories..." click silent no-op | public/js/wo-panel.js | `HALQ.catMgr.open?.()` called empty stub `{open: () => {}}` from `app.js`. Optional chaining `?.` suppressed error, making failure silent. | Changed to `HALQ.categories?.openManager?.()` which calls the real `categories.js` function |
| 45 | Relative asset paths break on API URLs | public/index.html | `src="js/app.js"` resolves to `/api/wos/js/app.js` when browser is on `/api/wos/...`, causing MIME type errors and `HALQ is not defined` | Changed all `src="js/..."` → `src="/js/..."` and `href="css/..."` → `href="/css/..."` |
| 46 | AI generated code without verifying file existence | HALQ_ONE_TRUE_FILE.md + AI | OTF listed files as "✅ From v1 refactor" but AI assumed they existed without asking. Generated fixes based on reconstructed code instead of actual files. | **New Priority Rule:** Always do proper troubleshooting with diagnostics before coding. Verify root cause with browser console, network tab, and file inspection. Never assume file contents match descriptions. |

---

*Last updated: 2026-06-16. Append only.*
