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


| 18 | CSS files built from scratch (8 files, 70,523 chars) | `public/css/*.css` | v1 had inline styles only — no CSS files ever existed. AI previously assumed they did. | Built all 8 from actual DOM structure in uploaded `index.html`, `app.js`, `wo-panel.js`. Verified every selector against real source. | 2026-06-15 |
| 19 | CSS build used 3-batch approach by code size | `HALQ_ONE_TRUE_FILE.md` | Large files need batching to manage token budget and review quality | Batch 1: app.css + wo-panel.css (~33K). Batch 2: settings + context-menu + category-manager (~14K). Batch 3: af-panel + email-panel + notes-panel (~24K). | 2026-06-15 |

---

## CSS Build Verification Checklist (2026-06-15)

| # | Check | Status |
|---|-------|--------|
| 1 | All 4 themes (dark/light/midnight/forest) have full color palette | ✅ |
| 2 | All selectors match actual DOM from uploaded source files | ✅ |
| 3 | No assumed selectors — verified against index.html, app.js, wo-panel.js | ✅ |
| 4 | Responsive breakpoints at 900px and 700px | ✅ |
| 5 | Hover states, active states, transitions on all interactive elements | ✅ |
| 6 | Fixed-position dropdowns (followup, cat, filter, context menu) with z-index layering | ✅ |
| 7 | Scrollbar styling (thin, theme-aware) | ✅ |
| 8 | Font import (Inter from Google Fonts) | ✅ |
| 9 | Standard file headers on all 8 files | ✅ |
| 10 | No hardcoded colors outside CSS variables | ✅ |

---

*Last updated: 2026-06-15. Append only.*
