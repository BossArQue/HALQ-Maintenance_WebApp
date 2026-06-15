# ╔══════════════════════════════════════════════════════════════════════╗
# ║  HALQ v2.1.0 — ERROR LOG (Battle Scars & Gotchas)                  ║
# ╚══════════════════════════════════════════════════════════════════════╝

> **Purpose:** This file tracks bugs found, fixes applied, and gotchas
> discovered during development. A new chat reads this to avoid repeating
> the same mistakes.
>
> **Rule:** Append only. Every bug fixed gets one line minimum.
> Include: what broke, why it broke, how it was fixed, which file.

---

## 2026-06-14 — v2.1.0 Build Phase

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 1 | `notes.js` saveMeta SQL injection risk | `functions/api/notes.js` | Building dynamic SQL with `NOT IN (${placeholders})` | Used parameterized queries with `.bind(...Array.from(touchedPgIds))` |
| 2 | `category_ids` must be strings in JSON | `functions/api/wos.js`, `functions/api/tags.js` | Frontend sends string IDs, D1 stores as TEXT JSON | Always `JSON.stringify(["1","2"])` never `[1,2]` |
| 3 | `notes.js` new notebook ID is string from frontend, needs parseInt | `functions/api/notes.js` | Frontend generates `n123abc` UIDs, D1 uses INTEGER autoincrement | `parseInt(nb.id)` returns NaN for new items → insert with auto-increment, return new ID |
| 4 | `wo_tags` UNIQUE constraint on (wo_number, category_id) | `db/schema.sql` | Duplicate tag insert throws SQLite error | `tags.js` catches `e.message.includes('UNIQUE')` and returns 409 |
| 5 | Inline base64 images in notes content bloat D1 | `functions/api/notes.js` | Phase 0 uses `data:image/png;base64,...` in `pages.content` | Acceptable for MVP. Migrate to R2 in v2.2 |
| 6 | `HALQ.apiGet/Post/Put/Delete` must use relative `/api/` paths | `public/js/app.js` | Hardcoded URLs break on different domains | Pattern: `fetch(\`/api${endpoint}\`)` |
| 7 | `wrangler.toml` D1 binding name is `halq-prod` but code uses `env.DB` | `wrangler.toml` | Binding alias in wrangler config | `[[env.production.d1_databases]] binding = "DB"` maps to `env.DB` |
| 8 | CORS preflight handled in `_middleware.js`, not per-endpoint | `functions/_middleware.js` | OPTIONS requests were 404ing on individual API files | Global middleware catches all OPTIONS before routing |
| 9 | Audit log `details` column is TEXT, must JSON.stringify objects | All API files | Passing objects to TEXT column causes `[object Object]` | Always `JSON.stringify(details)` before binding |
| 10 | `work_orders.is_active` is INTEGER (0/1), not BOOLEAN | `db/schema.sql` | SQLite has no native BOOLEAN | Frontend maps `!!row.is_active`, backend sets `1` or `0` |
| 11 | `notes-panel.js` `_saveMeta` sends FULL tree every time | `public/js/notes-panel.js` | Any change (rename, reorder, delete) triggers full tree POST | Backend `saveMeta` does upsert + cleanup. Acceptable for <100 notebooks |
| 12 | `af-panel.js` `navBack/Forward` are no-ops in v2 | `public/js/af-panel.js` | Browser handles history in new-tab mode, no webview API | Functions exist as stubs to prevent frontend errors |
| 13 | `email-panel.js` `$.$view` typo from v1 refactor | `public/js/email-panel.js` | Variable name was `$.$view` instead of `$.view` | Fixed in v2.1.0 rewrite |
| 14 | `messages.js` clipboard copy fallback `_showCopyModal` | `public/js/messages.js` | `navigator.clipboard` fails in some browsers | Modal with manual copy button as fallback |
| 15 | `settings.js` no longer stores PIN or credentials | `public/js/settings.js` | Cloudflare Access SSO handles auth | Removed all PIN/credential logic. UI prefs only |

---


| 16 | AI assumed CSS files existed because OTF showed ✅ | `HALQ_ONE_TRUE_FILE.md` | OTF listed 8 CSS files as "From v1 refactor" and "already v2-compatible" with ✅ marks | **AI FAULT:** Did not verify files actually existed. Assumed description = reality. CSS files NEVER existed — v1 was monolithic inline, v2 split never created them. | 2026-06-14 |
| 17 | OTF falsely claims CSS files are complete | `HALQ_ONE_TRUE_FILE.md` lines 260-267, 702-706, 886-893, 1028-1035 | Historical v1→v2 refactor description was copied forward without verification | Mark ALL CSS entries as ❌ NOT BUILT. Build CSS from scratch. | 2026-06-14 |
## Known Issues (Not Yet Fixed)

| # | Issue | File | Impact | Planned Fix |
|---|-------|------|--------|-------------|
| 1 | `notes.js` export generates HTML server-side but no ZIP | `functions/api/notes.js` | Large exports are single HTML files | v2.2: Use R2 + ZIP library |
| 2 | `notes.js` asset storage inline base64 has ~1MB practical limit | `functions/api/notes.js` | Very large images may fail | v2.2: R2 presigned URLs |
| 3 | No rate limiting in API endpoints | All `functions/api/*.js` | Open to abuse | Phase 1: KV-based rate limiting in `_middleware.js` |
| 4 | No auth on API endpoints | All `functions/api/*.js` | Anyone can call API | Phase 1: Cloudflare Access JWT verification |
| 5 | `wo-panel.js` Excel upload uses SheetJS CDN | `public/index.html` | External dependency | Acceptable. Can vendor if needed |
| 6 | `notes-panel.js` `document.execCommand` is deprecated | `public/js/notes-panel.js` | May break in future browsers | v2.3: Migrate to `contenteditable` + modern APIs |
| 7 | No real-time sync between users | All | Single-user only | v2.4: WebSocket or SSE |
| 8 | Bridge app not built | — | Manual Excel upload only | Post-v2.1.0: Node.js + chokidar + SheetJS |

---

## Frontend ↔ Backend Contract Mismatches (Prevented)

| Frontend Sends | Backend Expects | File Pair | Status |
|---------------|-----------------|-----------|--------|
| `HALQ.apiPost('/notes/meta', {notebooks})` | `{notebooks: [{id, name, open, sections:[]}]} ` | notes-panel.js ↔ notes.js | ✅ Verified |
| `HALQ.apiPost('/notes/pages/' + id, {content})` | `{content: '<html>string</html>'}` | notes-panel.js ↔ notes.js | ✅ Verified |
| `HALQ.apiPost('/notes/assets', {pageId, fileName, base64})` | `{pageId, fileName, base64}` | notes-panel.js ↔ notes.js | ✅ Verified |
| `HALQ.apiPost('/notes/export', {type, nbId, secId, pgId})` | `{type: 'notebook'|'section'|'page', nbId, secId, pgId}` | notes-panel.js ↔ notes.js | ✅ Verified |
| `HALQ.apiPost('/tags', {wo_number, category_id})` | `{wo_number: 'WO-123', category_id: 1}` | wo-panel.js ↔ tags.js | ✅ Verified |
| `HALQ.apiGet('/wos?filter=overdue&search=&cat=1')` | `filter: 'overdue'|'today'|'all', search: string, cat: string` | wo-panel.js ↔ wos.js | ✅ Verified |

---

*Last updated: 2026-06-14. Append only.*


---

## 2026-06-15 — PROJECT STATUS & DECISION LOG

| # | Event | Decision | Impact |
|---|-------|----------|--------|
| 1 | CSS files built from scratch | 8 files, 70K chars, all selectors verified | v2.1.0 frontend now renders correctly |
| 2 | Bridge app spec defined | Node.js + chokidar + SheetJS + fetch | P0 next task |
| 3 | Bridge config storage | HALQ settings API (`bridge_config` key) | No hardcoded paths — user-configurable from web app |
| 4 | Excel column mapping | Headers from `work_order-20260615.xlsx` | Parser must use header names, not positions (safer) |
| 5 | Property header rows | Rows with empty WO# are group headers, skip | Parser must filter `Work Order Number` != empty |
| 6 | Obsidian vault path | `D:\OneDrive\DEEH\Obsidian\Talley Properties Work Order` | Stored in settings, not hardcoded |
| 7 | Excel watch path | `D:\OneDrive\Talley Properties\Work Orders` | Stored in settings, not hardcoded |

---

*Status log added 2026-06-15. Append only.*


---

## 2026-06-15 — v2.2.0 Bridge App Build Session

| # | Bug / Gotcha | File | Why It Happened | Fix Applied |
|---|-------------|------|----------------|-------------|
| 18 | `node bridge/index.js` path error | User command | Already inside `bridge/` folder, ran `node bridge/index.js` → `bridge/bridge/index.js` | **User error** — correct command is `node index.js` |
| 19 | `rm -rf` fails in PowerShell | PowerShell terminal | `rm` in PowerShell is `Remove-Item`, `-rf` are bash flags | **User error** — use `Remove-Item -Recurse -Force` or `rm -r -fo` |
| 20 | `tray.js` regex syntax error | `bridge/tray.js` | `__dirname.replace(/\/g, '\')` inside template string parsed as JS regex literal | Pre-computed path escaping outside template string, v2.2.1 |
| 21 | `xlsx` npm package deprecated | `bridge/package.json` | `xlsx` on npm is deprecated; SheetJS distributes via CDN tarball | Changed dep to `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` |
| 22 | D1 tables missing on first Bridge run | `functions/api/settings.js` | D1 schema not yet applied to production DB | Ran `wrangler d1 execute halq-prod --file=db/schema.sql --remote` |
| 23 | `D1_TYPE_ERROR: undefined not supported` | `functions/api/upload.js` v2.0.0 | Bridge sends WOs with `undefined` values for empty Excel cells; D1 SQLite rejects `undefined` bindings | Added `_sanitizeWO()` in `upload.js` v2.2.0 — converts all `undefined`/`null` → `''` |
| 24 | Parser found 0 WOs from Excel | `bridge/parser.js` v2.2.0 | Excel file `Sheet1` has duplicate header row (row 1 == row 0); parser started data read at wrong row | Added duplicate header detection — skips row 1 if it matches row 0 exactly, v2.2.2 |
| 25 | `wrangler deploy` warning on Pages project | User command | Cloudflare Pages projects use `wrangler pages deploy` or git auto-deploy, not `wrangler deploy` | **User error** — use `git push` for Pages projects with git integration |
| 26 | `wrangler pages deploy` asks to create new project | User command | Project name mismatch — `wrangler.toml` name doesn't match Pages project name | **User error** — Pages with git integration auto-deploys on `git push`; no manual deploy needed |

## Known Issues (Not Yet Fixed)

| # | Issue | File | Impact | Planned Fix |
|---|-------|------|--------|-------------|
| 9 | Bridge API upload not yet verified | `bridge/index.js` → `functions/api/upload.js` | Git push pending, upload success unconfirmed | **Next chat** — run Bridge after deploy |
| 10 | Obsidian vault sync not yet verified | `bridge/obsidian.js` | Needs API upload working first | **Next chat** — check `📁 Active Monitoring/` folders |
| 11 | Bridge only parses raw `.xlsx` export | `bridge/parser.js` | Full `.xlsm` workbook with "Active Monitoring"/"Closed" sheets not yet tested | Add `.xlsm` test file with multiple sheets |
| 12 | Bridge closed detection not tested | `bridge/obsidian.js` | "Closed" sheet parsing + moving WOs to `📁 Closed WOs/` untested | **Next chat** — need Excel file with Closed data |
| 13 | Tag-based folder sync (poll loop) untested | `bridge/index.js` `_syncLoop` | 30s poll fetches tags from API, updates Obsidian | **Next chat** — needs API upload + categories seeded |
| 14 | Tray icon temp files on crash | `bridge/tray.js` | `.tray.ps1`, `.tray-status.json`, `.tray-icon.ico` may persist if Bridge crashes before `shutdown()` | Low priority — cleanup on next startup |

---

*Last updated: 2026-06-15. Append only.*
