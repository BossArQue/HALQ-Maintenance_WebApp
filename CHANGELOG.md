# HALQ — Maintenance Command
## Changelog

> **Stack:** Electron + Node.js
> **Files:** `main.js` · `preload.js` · `index.html`
> **Times:** UTC

---

## Session 1 — 2026-03-03

---

### [2026-03-03 20:30] Project Baseline — App Already Working

Starting state before any changes in this session.

**Working at baseline:**
- Electron window opens and loads `index.html`
- Appfolio embedded in `<webview>` tag — loads `talley.appfolio.com`
- Click a WO → auto-searches `talley.appfolio.com/search/advanced_search?full_text_search=[WO#]` (strips `-1` suffix)
- Session persists while app is open (`partition="persist:appfolio"`)
- Menu bar hidden on startup via `win.setMenuBarVisibility(false)`
- Toggle menu bar from Settings (IPC: `toggle-menubar`)
- Import button — file picker (`.xlsx`) and drag & drop overlay
- 5 macro buttons — UI only, not yet wired
- Themes: Gray Dark, Light, Midnight, Forest
- Layout toggles: Side by Side, Stacked
- Navigation toggles: Left Sidebar, Top Bar, Tabs, Hidden
- WO detail drawer — slides in from right on WO click
- Filter chips: All, Overdue, Due Today, Assigned, Waiting, Urgent, BH, Talley
- Bottom status bar with clock
- Sample WO data hardcoded in `index.html`
- `nodeIntegration: true`, `contextIsolation: false` (original setup)

---

### [2026-03-03 20:48] Feature — Secure Credential Storage

**Goal:** Store Appfolio login credentials encrypted at rest using OS keychain.

**`main.js`**
- Added `safeStorage` import from `electron`
- Added `fs` and `path` imports
- Added `CRED_PATH` → `userdata/creds.enc`
- Added IPC handler `creds-save` — JSON-encodes `{ email, password }`, encrypts with `safeStorage.encryptString()`, writes to `creds.enc`
- Added IPC handler `creds-load` — reads `creds.enc`, decrypts, returns parsed object
- Added IPC handler `creds-clear` — deletes `creds.enc`
- `app.setPath('userData', ...)` set to `userdata/` subfolder inside project root

**`index.html`**
- Added Credentials section to Settings panel — email input, password input, Save / Clear buttons
- Added `saveCreds()`, `clearCreds()`, `loadCredsToUI()` JS functions
- `loadCredsToUI()` called on `DOMContentLoaded` — pre-fills email field, leaves password blank
- Used `require('electron')` directly (pre-contextIsolation)
- Status feedback label with OK / error styling

---

### [2026-03-03 20:54] Fix — `require is not defined` in Renderer

**Root cause:** `require('electron')` in renderer JS is blocked when `contextIsolation: true`. Even with `contextIsolation: false`, the pattern is unreliable in newer Electron.

**New file: `preload.js`**
- Created `preload.js` using `contextBridge.exposeInMainWorld('halq', { ... })`
- Exposed: `credsSave`, `credsLoad`, `credsClear`, `toggleMenuBar`

**`main.js`**
- Set `contextIsolation: true`
- Set `nodeIntegration: false`
- Added `preload: path.join(__dirname, 'preload.js')` to `webPreferences`

**`index.html`**
- Removed all `require('electron')` calls
- Replaced all IPC calls with `window.halq.*` equivalents

---

### [2026-03-03 20:58] Fix — ERR_ABORTED (-3) Webview Navigation

**Root cause:** The `persist:appfolio` webview partition had no permission handlers registered. Electron rejects permission requests by default — this caused navigations to abort silently.

**`main.js`**
- Added `setupAppfolioSession()` function
- Registers `setPermissionRequestHandler` and `setPermissionCheckHandler` on `session.fromPartition('persist:appfolio')`
- Allowed permission set: `media`, `geolocation`, `notifications`, `fullscreen`, `pointerLock`, `openExternal`
- `setupAppfolioSession()` called in `app.whenReady()` before `createWindow()`

**`index.html`**
- Added `webpreferences="contextIsolation=yes"` attribute to `<webview>` tag

---

### [2026-03-03 21:02] Fix — Auto-fill Not Triggering

**Root cause 1:** URL pattern check only matched `/login` — Appfolio uses `/users/sign_in`.
**Root cause 2:** `did-finish-load` fires before React hydrates the form fields, so `querySelector` returns null on first attempt.

**`main.js`**
- Updated login URL detection to match `/users/sign_in`, `/login`, `/user_session`
- Replaced single-shot fill attempt with `tryFill()` retry loop: 250ms interval × 20 attempts (5 seconds total)
- Used `nativeInputSetter` — `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` — to bypass React's controlled input property descriptor so value changes are picked up by React state

---

## Session 2 — 2026-03-03

---

### [2026-03-03 21:30] Fix — Auto-fill Still Not Working After Session 1

**Root cause:** `executeJavaScript()` called from the main process into a webview is silently blocked when `contextIsolation: true`. The script runs in the wrong context and cannot access the page DOM.

**`index.html`**
- Moved all auto-fill logic to the renderer process
- `did-stop-loading` event on the webview → calls `tryAutoFill(view)`
- `tryAutoFill()` calls `view.executeJavaScript()` directly from the renderer — this works correctly with `contextIsolation`
- Retry loop moved inside the injected script: `MAX_ATTEMPTS = 20`, `POLL_INTERVAL = 300ms`

**`main.js`**
- Removed broken main-process auto-fill block (`app.on('web-contents-created', ...)`)
- Removed unused `CRED_PATH` reference from that block (still defined at top)

---

### [2026-03-03 21:35] Debug — Visible Debug Bar Added

**Goal:** Make auto-fill progress visible without opening DevTools.

**`index.html`**
- Added `showDebug(msg)` function — renders a floating blue status bar pinned above the bottom bar
- Bar auto-dismisses after 6 seconds
- Inserted `showDebug()` calls at every step of `tryAutoFill()`: page load detected, creds check, inject start, fill result
- **Result:** Debug bar revealed credentials had not been saved yet — user saved creds via Settings, auto-fill confirmed working end-to-end

---

### [2026-03-03 21:45] Feature — Settings PIN Lock

**Goal:** Require a 4-digit PIN to open the Settings panel.

**`main.js`**
- Added `PIN_PATH` → `userdata/pin.enc`
- Added IPC handler `pin-save` — encrypts PIN string via `safeStorage`, writes to `pin.enc`
- Added IPC handler `pin-load` — decrypts and returns stored PIN
- Added IPC handler `pin-clear` — deletes `pin.enc`

**`preload.js`**
- Exposed `pinSave`, `pinLoad`, `pinClear` on `window.halq`

**`index.html`**
- Added PIN lock modal (`#pin-overlay`) — full-screen overlay with 4 dot indicators and numpad (0–9, backspace, cancel)
- Dots fill as digits are entered; shake red + show "Incorrect PIN" message on wrong entry, auto-clear after 900ms
- `openSettings()` converted to `async` — calls `window.halq.pinLoad()` first:
  - If no PIN stored → opens Settings directly
  - If PIN stored → shows PIN modal; correct entry opens Settings
- Added PIN Setup section in Settings panel — 4-digit input, Set PIN / Remove PIN buttons with status feedback
- `savePin()` — validates `/^\d{4}$/` before saving
- `clearPin()` — removes `pin.enc`

---

### [2026-03-03 21:50] Feature — 2FA Detection in Auto-fill

**Goal:** Gracefully skip auto-fill when Appfolio redirects to a 2FA/MFA page instead of crashing or filling the wrong fields.

**`index.html`**
- Added 2FA URL pattern check inside `tryAutoFill()` before login detection
- Patterns: `two_factor`, `otp`, `verification`, `challenge`, `mfa`, `authenticate`
- If matched: calls `showDebug('⚠ 2FA required — enter your code manually')` and returns early — no fill attempted

---

### [2026-03-03 22:00] Feature — Excel Macro Wiring

**Goal:** Wire the 5 macro buttons to their actual VBA macro names in `Work Order Status Update.xlsm` via PowerShell COM.

**Analysis:** All 6 VBA macros mapped — names, dependencies, and column requirements confirmed:

| Button | VBA Macro Name | Notes |
|--------|---------------|-------|
| ① Scan New WOs | `ScanForNewWorkOrders` | Populates Work Queue |
| ② Quick Transfer | `QuickTransferHighlightedWO` | Requires manual row selection in Excel first |
| ③ Refresh | `RefreshFormulasActiveMonitoring` | Validates + refreshes Active Monitoring |
| ④ Sync Outlook | `SyncOutlookTasksOnly` | Syncs tasks to Outlook |
| ⑤ Summary | `TransferToSummary` | Skips weekends |
| ▶ Run All | Chains ①③④⑤ | ② excluded — needs manual selection |

**`main.js`**
- Added `EXCEL_PATH` constant → `D:\OneDrive\Talley Properties\Work Order Status Update.xlsm`
- Added `EXCEL_SHEET` constant → `Active Monitoring`
- Added `MACRO` constants object with all 4 auto-runnable VBA names
- Added `AM_COL` column map (1-based) for Active Monitoring sheet: `property(C)`, `unit(D)`, `wo(E)`, `resident(F)`, `age(H)`, `job(I)`, `status(K)`, `vendor(L)`, `notified(O)`
- Added IPC handler `macro-run` — writes temp `.ps1` file, runs with `powershell -ExecutionPolicy Bypass -File`; attaches to running Excel via `GetActiveObject`, falls back to opening workbook; runs named macro; returns `{ ok, error }`
- Added IPC handler `excel-load` — reads `Active Monitoring` sheet via `xlsx` npm package; filters empty/invalid WO rows; maps columns using `AM_COL`; returns `{ ok, wos[] }`

**`preload.js`**
- Exposed `macroRun`, `excelLoad` on `window.halq`

**`index.html`**
- Macro buttons wired: `onclick="runMacro(this, 'VBAName', 'Label')"` for ①③④⑤
- `② Quick Transfer` → `runQuickTransfer()` — shows instruction alert, changes button to "▶ Run Transfer Now", then calls `confirmQuickTransfer()` which runs `QuickTransferHighlightedWO`
- `▶ Run All` → `runAllMacros()` — chains ①③④⑤ in sequence, stops on first failure
- `setMacroRunning(el, label)` / `setMacroDone(el, ok)` — visual state helpers (⏳ running → ✓ done / ✗ failed, auto-resets after 2.5s)
- `loadExcelData()` — calls `window.halq.excelLoad()`, replaces sample `wos[]` array with live data, updates WO count and overdue count in UI
- `loadExcelData()` called on init with `renderWOList()` fallback if Excel unavailable
- After ① or ③ macro completes successfully, `loadExcelData()` auto-reloads WO panel

---

### [2026-03-03 22:15] Feature — Excel Import (Appfolio Export → AppFolio Data Sheet)

**Goal:** Replace manual copy-paste process — pick raw Appfolio export, strip metadata rows, paste clean data into `AppFolio Data` sheet of the `.xlsm`.

**Raw export format:**
- Rows 1–17: Appfolio report metadata (title, filters, date range, etc.)
- Row 18: Column headers
- Row 19+: WO data rows (may include merged group header rows)

**`main.js`**
- Added IPC handler `dialog-open` — wraps `dialog.showOpenDialog(win, options)` and returns result; needed because `contextIsolation: true` means `file.path` is `undefined` in the renderer — only the main process can get real filesystem paths
- Added IPC handler `excel-import`:
  - Reads export file with `xlsx.readFile()`
  - Slices from index 17 (row 18) down — `allRows.slice(17)`
  - Validates at least 2 rows present
  - Writes clean data to temp CSV at `userdata/import_tmp.csv`
  - Writes PowerShell script to `userdata/import.ps1`
  - PS script: attaches to Excel COM, finds workbook by name, opens temp CSV, copies range value-by-value into `AppFolio Data` sheet (clears first), closes temp, saves workbook
  - Returns `{ ok: true, count: rowCount }` or `{ ok: false, error }`
  - Cleans up both temp files after PS exits

**`preload.js`**
- Exposed `dialogOpen`, `excelImport` on `window.halq`

**`index.html`**
- `triggerImport()` now calls `window.halq.dialogOpen()` instead of creating a hidden `<input type=file>` — gets real file path string
- Drag & drop `drop` handler changed to use `file.path` (available in renderer for drag events)
- `handleImportFile(filePath)` takes a path string, not a File object
- Warns user if filename doesn't contain `work_order` — asks to confirm before proceeding
- On success: shows debug message with row count, pulses the ① Scan button to guide next step
- On failure: calls `showErrorDialog()` with full error text

---

### [2026-03-03 22:20] Fix — PowerShell Inline Script Escaping

**Root cause:** Using `powershell -Command "..."` with multiline scripts mangles quotes and newlines — backslash escaping inside the command string is fragile and environment-dependent.

**`main.js`** (both `macro-run` and `excel-import`)
- Changed both handlers to write the full PS script to a `.ps1` temp file first
- Execute with `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "path\to\script.ps1"`
- `-File` runs the script verbatim with no shell string interpolation — all quotes and newlines preserved exactly

---

### [2026-03-03 22:25] Fix — PowerShell Workbook Lookup Returning Null

**Root cause 1:** `$excel.Workbooks | Where-Object { $_.FullName -eq $targetPath }` — OneDrive paths resolve differently at the COM level vs. the filesystem. `FullName` may return a cloud path or a local sync path depending on OneDrive state.

**Fix:** Changed lookup to match on `$_.Name` (filename only, no path) — `Where-Object { $_.Name -eq 'Work Order Status Update.xlsm' }`.

**Root cause 2:** `[Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')` was throwing when no Excel instance was running, but the catch block was creating a new instance and then the workbook loop found nothing — resulting in an empty Excel with no workbooks open.

**Fix:**
- Initialize `$excel = $null` before the try block
- Explicit null check after `GetActiveObject` attempt
- If null or throws → `New-Object -ComObject Excel.Application` + `$excel.Visible = $true`
- Then `Workbooks.Open(EXCEL_PATH)` as fallback if workbook not found in open list

---

### [2026-03-03 22:30] Feature — Copyable Error Dialog

**Root cause:** `alert()` dialog text cannot be selected, highlighted, or copied — errors from PowerShell are long and users couldn't report them.

**`index.html`**
- Added `showErrorDialog(title, message)` function
- Creates a fixed-position modal overlay (z-index 9999) with:
  - Title bar with ✕ close button
  - Read-only `<textarea>` with `user-select: text` — auto-focused and auto-selected on open
  - Helper text: "Click inside the box and Ctrl+A to select all, then Ctrl+C to copy"
  - Copy button — uses `navigator.clipboard.writeText()`, changes to "✓ Copied" on success
  - Close button (red)
- Replaces all `alert()` calls for error conditions in `handleImportFile()` and macro error paths

---

### [2026-03-03 22:45] Setup — Git + GitHub

- Installed Git 2.53.0 on development machine
- Configured `user.name` and `user.email` for commits
- `git init` in `D:\OneDrive\DEEH\Project\HALQ - Maintenance`
- Created `.gitignore`: `node_modules/`, `userdata/`, `*.enc`, `*.ps1`, `*.csv`
- Initial commit: 6 files — `main.js`, `preload.js`, `index.html`, `package.json`, `.gitignore`, `CHANGELOG.md`
- Created private repository: `github.com/BossArQue/HALQ-Maintenance`
- Pushed to `main` branch

---

## Session 3 — 2026-03-04

---

### [2026-03-04 08:45] Fix — Excel Import Workbook Null (Ongoing Debug)

**Status:** Still failing intermittently. Workbook lookup via `$_.Name` improved reliability but PowerShell COM attach still fails in some machine states.

**Known remaining issue:** When OneDrive is syncing or Excel is in a protected state, `GetActiveObject` returns an instance but `Workbooks` collection is empty or inaccessible.

**Outstanding:** Full end-to-end import → scan → data load flow not yet tested successfully.

---

### [2026-03-04 ~09:00] Feature — PIN Keyboard Mode

**Goal:** Allow typing PIN from physical keyboard instead of only the on-screen numpad.

**`index.html`**
- Added "Use keyboard instead" toggle link below the numpad
- Keyboard mode shows a password `<input>` field — auto-focused on switch, auto-submits on 4th digit
- Wrong PIN in keyboard mode: input shakes red + dots flash, clears after 900ms, re-focuses
- "Use numpad instead" link switches back
- PIN modal always resets to numpad mode on open
- `setPinMode(mode)` — switches between `numpad` and `keyboard` sections
- `onPinKeyboardInput(input)` — strips non-digits, triggers `verifyPin()` at 4 digits
- `verifyPin()` updated to handle both modes for error flash

---

### [2026-03-04 ~09:15] Feature — Follow-up Date Predefined Picker

**Goal:** Replace plain date input with smart predefined options so follow-up dates can be set in one click.

**`index.html`**
- Replaced `<input type="date">` with a dropdown trigger showing current selection
- Options: **Tomorrow** (today+1), **The Next Day** (today+2), **This Week** (next Friday of current week), **Next Week** (Friday of following week) — each shows computed date label beside the name
- **Custom** → reveals inline date picker inside the dropdown
- `getNextFriday(fromDate, weeksAhead)` — calculates correct Friday; if today is already Friday or past, advances to next week
- `initFollowupDates()` — recomputes all date labels fresh each time dropdown opens
- Dropdown renders as `position: fixed` overlay — positioned via `getBoundingClientRect()` so it floats above page flow; auto-detects space above/below and opens in correct direction
- `setFollowup(key)` — sets selection and updates trigger label
- `setFollowupCustom(isoVal)` — handles calendar picker selection

---

### [2026-03-04 ~09:30] Feature — Categorize (replaces Category Tag)

**Goal:** Full category management system with colors, replacing the static dropdown.

**`index.html`**
- Renamed "Category Tag" → "Categorize"
- Replaced `<select>` with custom dropdown trigger showing color dot + label
- Dropdown: **Clear tag** at top → separator → category list with color dots → separator → **⚙ All Categories...**
- Dropdown renders as `position: fixed` overlay — same fixed positioning pattern as follow-up, scrolls internally, page never moves
- **Category Manager Modal** (`#catmgr-overlay`):
  - Left panel: scrollable list of all categories (name + color dot), click to select
  - Right panel: rename input + color palette, Save + Delete buttons
  - Footer: new category name input + Add button (Enter key works)
  - Default categories: Low Monitoring (blue), For Invoice (yellow), Urgent (red)
- **Color palette** — 68 colors grouped by family: reds → oranges → yellows → greens → teals → blues → purples → neutrals
- **Auto-assign color** — new categories get first unused color from palette; only cycles if all colors taken
- `CAT_COLORS[]` — full 68-color palette array
- `categories[]` — runtime array, persists within session
- `renderCatDropdown()`, `toggleCatDropdown()`, `selectCat(id)`
- `openCatMgr()`, `closeCatMgr()`, `catmgrSelect(id)`, `catmgrSaveEdit()`, `catmgrDelete()`, `catmgrAdd()`
- `closeAllDropdowns()` — shared utility, closes both follow-up and category dropdowns
- Click-outside listener on `document` closes both dropdowns

---

### [2026-03-04 ~10:00] Fix — Appfolio Session Persists Across Restarts

**Root cause:** `sessionData` path not explicitly set — Electron stored webview cookies in a default temp location that varied between runs, forcing re-login on every restart.

**`main.js`**
- Added `app.setPath('sessionData', path.join(USER_DATA_DIR, 'session'))` immediately after `app.setPath('userData', ...)`
- Session folder: `userdata/session/` — cookies, localStorage, login state all persist here permanently
- One-time full restart required after applying; subsequent restarts stay logged in

---

### [2026-03-04 ~10:15] Fix — Ctrl+R Reloads Without Restarting

**Confirmed behavior:** Since session 3 changes were `index.html`-only (PIN keyboard, follow-up dates, categories), pressing **Ctrl+R** inside the app window reloads the renderer without restarting Electron — Appfolio session stays alive. Full restart only required when `main.js` or `preload.js` changes.

---

### [2026-03-04 ~10:30] Fix — New Tab Opens Separate Electron Window Instead of Tab

**Root cause (identified via debug logs):** `web-contents-created` log showed type `window` loading `index.html` — meaning Electron was spawning a full second copy of the HALQ app. This happened at the `BrowserWindow` level before any webview handler could intercept it. The webview's `setWindowOpenHandler` was never reached.

**Secondary root cause:** `allowpopups` attribute on the `<webview>` tag allowed Appfolio's `window.open()` calls to bypass `setWindowOpenHandler` entirely.

**`main.js`**
- Added `win.webContents.setWindowOpenHandler()` directly on the main `BrowserWindow` after creation — intercepts new-window requests at the window level before they spawn
- `mailto:` → `shell.openExternal()` → Outlook
- All other URLs → `win.webContents.send('open-new-tab', url)` → denied
- Kept `app.on('web-contents-created')` webview handler as secondary catch

**`index.html`**
- Removed `allowpopups` attribute from `<webview>` tag

**`preload.js`**
- Added `onNewTab: (callback) => ipcRenderer.on('open-new-tab', ...)` to expose new-tab event to renderer

---

### [2026-03-04 ~11:00] Fix — Tab Bar UX Overhaul

**Issues:**
1. Clicking tab 1 (Appfolio) after opening a new tab did nothing — `#tab-main` had no `dataset.url`
2. Too many tabs created a large scrollbar
3. Closing a tab didn't navigate to another tab

**`index.html`**
- Wrapped tab bar in `af-tabs-wrap` container with ◀ ▶ arrow buttons on each side
- `af-tabs` changed from `overflow-x: auto` to `overflow: hidden` — no scrollbar ever shown
- ◀ ▶ arrows call `scrollTabs(dir)` — `scrollBy` with `behavior: smooth`
- Arrow buttons auto-disable (`.disabled`) when scrolled to either end via `updateTabArrows()`
- `#tab-main` given `data-url="https://talley.appfolio.com"` and `onclick="switchToTab(this)"` — clicking it now navigates back to Appfolio home
- `switchToTab(tab)` — sets active class, calls `navTo(tab.dataset.url)`, updates arrows
- `addTab(url)` — wraps URL parse in try/catch for safety; calls `switchToTab` + `scrollIntoView`
- `closeTab(e, btn)` — `e.stopPropagation()` prevents tab click from firing; activates nearest remaining tab after close
- `did-start-loading` → adds `.loading` class (accent color) to active tab as visual indicator
- `did-stop-loading` → removes `.loading`, updates `dataset.url` on active tab to reflect in-page navigations
- Merged tab-related `DOMContentLoaded` listener into existing one — no duplicate listeners

---

## Outstanding / In Progress

- `excel-import` PowerShell workbook null lookup — still intermittent, being debugged
- Active Monitoring live data load (`loadExcelData`) — not yet tested end-to-end
- Macro buttons — depend on import working first; untested
- `② Quick Transfer` two-step flow — UI implemented, not yet tested
- `sessionData` path fix — discussed and written but missing from current `main.js`, Appfolio re-login on restart still occurring
- Categories — runtime only, resets on every app restart (persistence to `userdata/` pending)
- Follow-up date — saves to UI only, not persisted or written back to Excel
- WO detail fields (Follow-up, Category) — not written back to Excel
- Send Notification button — UI only
- Add Note button — UI only
- Tab labels — show hostname, not actual page title

---

### [2026-03-04 ~11:30] Fix — PIN Both Keyboard and Numpad Simultaneously

**Goal:** Instead of toggling between keyboard and numpad modes, show both at all times. Keyboard is default/focused, numpad is always available below.

**`index.html`**
- Removed `#pin-numpad-section` and `#pin-keyboard-section` wrapper divs and all mode-toggle logic
- Keyboard `<input>` now always rendered directly in modal, auto-focused on open
- Numpad always rendered below keyboard input — no toggle
- `pinKey()` updated to call `syncPinInput()` after every numpad press — keeps keyboard field in sync with `pinBuffer`
- `syncPinInput()` — writes `pinBuffer` value to keyboard input field so both stay in sync regardless of which is used
- Typing on keyboard and clicking numpad can be mixed freely — both feed same `pinBuffer`
- `verifyPin()` simplified — always flashes both dots and keyboard input on wrong PIN, always refocuses keyboard input after clear
- `openSettings()` simplified — no mode reset needed, just clears buffer, clears input, focuses keyboard input
- Removed `setPinMode()` function entirely
- Removed `pinMode` variable entirely
- Removed `.pin-mode-toggle` CSS

---

### [2026-03-04 ~11:45] Review — Full Code Audit

**Confirmed working:**
- App shell, window, menu bar toggle
- `contextIsolation` + `preload.js` + `window.halq` API
- Appfolio webview loads, permissions, no ERR_ABORTED
- Auto-login: credentials encrypted, auto-fill retry loop, nativeInputSetter, 2FA detection, debug bar
- PIN lock: keyboard + numpad simultaneously, dots sync, shake on wrong PIN
- Tabs: middle-click opens tab (not new window), ◀▶ arrows, tab switching, close navigates to neighbour, loading indicator
- `mailto:` links → Outlook
- Themes, layout, nav toggles
- WO list: filters, search, color coding, detail drawer
- Follow-up date picker: Tomorrow / Next Day / This Week / Next Week / Custom
- Categorize: full manager modal, 68 colors, auto-assign unused color
- Copyable error dialog
- Macro bar UI wired

**Identified missing fix:**
- `app.setPath('sessionData', ...)` was written in session but never applied to `main.js` — Appfolio re-login on restart still active

---

## Workflow (Once Working)

| Step | Action | Macro |
|------|--------|-------|
| 1 | **⬆ Import** — pick raw `work_order-[date].xlsx` from Appfolio | — |
| 2 | **① Scan New WOs** — populates Work Queue in Excel | `ScanForNewWorkOrders` |
| 3 | **② Quick Transfer** — select rows in Work Queue, click Run Transfer | `QuickTransferHighlightedWO` |
| 4 | **③ Refresh** — validate and refresh Active Monitoring | `RefreshFormulasActiveMonitoring` |
| 5 | **④ Sync Outlook** — sync tasks | `SyncOutlookTasksOnly` |
| 6 | **⑤ Summary** — update vendor summary (skips weekends) | `TransferToSummary` |

---

## File Reference

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — IPC handlers, window, session, PowerShell |
| `preload.js` | contextBridge — exposes `window.halq` API to renderer |
| `index.html` | All UI — HTML, CSS, JS in one file |
| `userdata/creds.enc` | Encrypted Appfolio credentials (safeStorage / Windows DPAPI) |
| `userdata/pin.enc` | Encrypted settings PIN (safeStorage / Windows DPAPI) |

## Key Constants (`main.js`)

| Constant | Value |
|----------|-------|
| `EXCEL_PATH` | `D:\OneDrive\Talley Properties\Work Order Status Update.xlsm` |
| `EXCEL_SHEET` | `Active Monitoring` |
| `MACRO.scanNewWOs` | `ScanForNewWorkOrders` |
| `MACRO.refresh` | `RefreshFormulasActiveMonitoring` |
| `MACRO.syncOutlook` | `SyncOutlookTasksOnly` |
| `MACRO.transferToSummary` | `TransferToSummary` |

---

### [2026-03-04 ~11:30] Fix — WO Detail Save Button + Per-WO Tag Persistence

**Issues:**
- Follow-up date and category changes had no save action — nothing committed
- Switching WOs reset the drawer to blank — no per-WO memory
- Tags wiped on every Ctrl+R or restart — stored in memory only

**`main.js`**
- Added `wo-tags-save` IPC handler — writes `userdata/wo-tags.json` keyed by WO number
- Added `wo-tags-load` IPC handler — reads and returns saved tags object
- Added `categories-save` IPC handler — writes `userdata/categories.json`
- Added `categories-load` IPC handler — reads and returns saved categories array

**`preload.js`**
- Exposed `woTagsSave`, `woTagsLoad`, `categoriesSave`, `categoriesLoad` on `window.halq`
- Exposed `onNewTab` for tab routing

**`index.html`**
- Added **💾 Save Changes** button at top of detail actions
- `saveWODetail()` — commits `_followup` and `_catId` to the WO object, writes to `woTags{}` dict keyed by WO#, calls `saveWOTags()`, re-renders list
- `woTags{}` — runtime dict persisted to `userdata/wo-tags.json`
- `saveWOTags()` / `loadWOTags()` — async save/load via `window.halq.woTagsSave/Load`
- `loadWOTags()` — on load, applies saved tags back onto `wos[]` array then re-renders
- `selectWO()` updated — restores correct followup date and category for each WO on click
- Category color dot shows on WO list card after save
- Followup date label shows on WO list card after save

---

### [2026-03-04 ~12:00] Feature — WO List Grouped by Follow-up Date

**Goal:** Sort WOs into date-based sections so priority is visually clear.

**`index.html`**
- `getWeekStart(d)` — returns Monday of any given week
- `renderWOList()` fully replaced with section-grouped renderer:
  - **Due / No Date** — WOs without followup, sorted by age descending (oldest first)
  - **This Week** — followup Mon–Fri of current week, sorted by date ascending
  - **Next Week** — following Mon–Fri
  - **Week After** — two weeks out
  - **Later** — 3+ weeks out
- Section headers show label + WO count; empty sections are hidden
- WO card updated — shows category color dot + followup date label inline

---

### [2026-03-04 ~12:15] Fix — Auto-submit Removed (Appfolio 401 Bot Detection)

**Root cause:** Auto-clicking the Login button after filling credentials triggered Appfolio's bot detection, returning a 401 Unauthorized instead of the dashboard.

**`index.html`**
- Removed `submitBtn.click()` from `tryAutoFill()`
- Fields are still auto-filled (email + password) — user presses Enter or clicks Login manually
- One human action is enough to satisfy Appfolio's bot check

---

### [2026-03-04 ~12:20] Fix — window.halq Timing (waitForHalq)

**Root cause:** `DOMContentLoaded` fires before Electron's `contextBridge` finishes injecting `window.halq`, causing all IPC calls to fail silently.

**`index.html`**
- Added `waitForHalq(fn, attempts)` — polls every 50ms up to 2 seconds for `window.halq` to become available
- All IPC-dependent init calls (`onNewTab`, `loadCategories`, `loadWOTags`) moved inside `waitForHalq` callback
- `loadCredsToUI` kept in INIT (was already working, rule 10 — do not change established code)

---

## Outstanding / In Progress

- `excel-import` PowerShell workbook null lookup — still intermittent
- Active Monitoring live data load — untested end-to-end
- Macro buttons — untested
- `② Quick Transfer` — untested
- WO tags — runtime only until full restart confirmed working with new `main.js`/`preload.js`
- `portfolio` field — not mapped in `excel-load` (shows blank when live data loads)

---

## File Reference

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — IPC handlers, window, session, PowerShell |
| `preload.js` | contextBridge — exposes `window.halq` API to renderer |
| `index.html` | All UI — HTML, CSS, JS in one file |
| `userdata/creds.enc` | Encrypted Appfolio credentials |
| `userdata/pin.enc` | Encrypted settings PIN |
| `userdata/session/` | Appfolio session cookies — persists login across restarts |
| `userdata/categories.json` | Saved category list with colors |
| `userdata/wo-tags.json` | Per-WO followup dates and category assignments |

## `window.halq` API (`preload.js`)

| Method | IPC Channel | Description |
|--------|-------------|-------------|
| `credsSave(email, password)` | `creds-save` | Encrypt + save credentials |
| `credsLoad()` | `creds-load` | Decrypt + return credentials |
| `credsClear()` | `creds-clear` | Delete credentials |
| `pinSave(pin)` | `pin-save` | Encrypt + save PIN |
| `pinLoad()` | `pin-load` | Decrypt + return PIN |
| `pinClear()` | `pin-clear` | Delete PIN |
| `dialogOpen(options)` | `dialog-open` | Native file open dialog |
| `excelLoad()` | `excel-load` | Read Active Monitoring sheet |
| `excelImport(filePath)` | `excel-import` | Import Appfolio export → AppFolio Data sheet |
| `macroRun(macroName)` | `macro-run` | Run VBA macro via PowerShell COM |
| `toggleMenuBar(visible)` | `toggle-menubar` | Show/hide Electron menu bar |
| `woTagsSave(tags)` | `wo-tags-save` | Save per-WO tags to disk |
| `woTagsLoad()` | `wo-tags-load` | Load per-WO tags from disk |
| `categoriesSave(cats)` | `categories-save` | Save category list to disk |
| `categoriesLoad()` | `categories-load` | Load category list from disk |
| `onNewTab(callback)` | `open-new-tab` | Listen for new tab requests from webview |

---

## Session 4 — 2026-03-04

---

### [2026-03-04 ~13:00] Fix — Excel Import Rewritten to Use VBA Macro

**Root cause:** All COM-based approaches to write to the `.xlsm` from PowerShell were blocked by Office 365 Apps for Business session isolation — `GetActiveObject` returned instances with `Count=0` workbooks, and `New-Object -ComObject` couldn't open OneDrive-hosted files.

**Decision:** HALQ no longer attempts to write to Excel directly. Instead:
1. HALQ reads and cleans the Appfolio export, auto-detects header row
2. Writes cleaned data to `userdata/import_tmp.csv`
3. Writes CSV path to `userdata/import_cfg.txt`
4. Triggers `ImportFromCSV` VBA macro via PowerShell `excel.Run()`
5. VBA macro (running inside user's Excel) reads cfg, opens CSV, unmerges, pastes, saves

**`main.js`** — `excel-import` handler rewritten — no more file-open attempts, just CSV write + macro trigger

**VBA** — `ImportFromCSV` macro added to `.xlsm`:
- Reads path from `import_cfg.txt` (same folder as workbook)
- Unmerges AppFolio Data sheet
- Clears contents
- Opens CSV, pastes values, closes CSV
- Saves workbook

---

### [2026-03-04 ~13:15] Fix — WO Count Badge Dynamic + Pending Cleanups

**`index.html`**
- Removed ✉️ Send Notification button from detail panel — no use case defined
- Removed 📝 Add Note button from detail panel — no use case defined
- Removed 🌐 Open in Appfolio button from detail panel — redundant with URL bar Go button
- Sidebar nav sections wrapped in `.sidebar-nav` with `overflow-y: auto` + `-webkit-scrollbar: none` — no visible scrollbar
- Hardcoded `101` replaced with `0` in topbar label, bottom status bar, nav badge
- `nav-wo-badge` now set dynamically from `wos.length` on Excel load and sample data fallback
- `loadExcelData()` updated to set all 3 count elements from single `count` variable

---

### [2026-03-04 ~19:00] Cleanup — Macro Bar Removed

**Decision:** Excel COM automation is permanently blocked by Office 365 Apps for Business session isolation. All approaches failed:
- `GetActiveObject('Excel.Application')` — COM context blocked by Office 365
- `New-Object -ComObject Excel.Application` — cannot resolve OneDrive paths
- VBScript `GetObject` — `ActiveX component can't create object`
- Admin elevation — same error, not a privilege issue
- `xlsx` library with `bookVBA: true` — **destroyed workbook** (formulas, formatting, macros wiped); recovered from OneDrive version history
- Excel `/e` command-line flag — cannot find macros regardless of path or module prefix

**Current import state:** HALQ writes cleaned data to `userdata/import_tmp.xlsx` and `import_cfg.txt`. User runs `ImportFromCSV` macro manually in Excel. VBA macro reads `import_cfg.txt` for path, opens temp file, pastes data into `AppFolio Data` sheet.

**`index.html`**
- Removed `<!-- MACRO BAR -->` HTML block (① Scan, ② Quick Transfer, ③ Refresh, ④ Summary, ▶ Run All)
- Removed `.macro-bar`, `.macro-btn`, `.macro-sep`, `.macro-label`, `.macro-run-all` CSS
- Removed `setMacroRunning()`, `setMacroDone()`, `runMacro()`, `runQuickTransfer()`, `confirmQuickTransfer()`, `runAllMacros()` JS functions
- Removed scan button pulse from import success handler
- Removed "Show Macro Bar" toggle from Settings
- Updated import success message — no longer references macro steps

---

### [2026-03-04 ~19:15] Cleanup — Nav Items Pruned

**`index.html`**
- Removed **Appfolio** from sidebar nav, top nav, and section tabs — no function planned
- Removed **Macros** from sidebar nav, top nav, and section tabs — removed with macro bar
- Removed **Summary** from sidebar nav — no function planned
- Kept **Email** and **Notes** as placeholders for future features
- Added `id="nav-wo"` and `onclick="switchMainView('wo')"` to Work Orders nav item
- Added `id="nav-notes"` and `onclick="switchMainView('notes')"` to Notes nav item

---

### [2026-03-04 ~19:30] Verified — All Core Features Tested and Working

Full test pass confirmed:

| Feature | Status |
|---------|--------|
| WO list loads from Active Monitoring sheet | ✅ |
| Filter chips (Overdue, Due Today, Assigned, Waiting, Urgent, BH, Talley) | ✅ |
| WO detail panel opens on click | ✅ |
| Follow-up date picker (all options + custom) | ✅ |
| Follow-up persists across app restarts | ✅ |
| Categories — create, assign, color, persist | ✅ |
| Save WO Detail — saves tags + followup + category | ✅ |
| Multi-tab browsing — add, close, switch | ✅ |
| Bottom bar clock | ✅ |
| Import file picker — writes import_tmp.xlsx | ✅ |

---

### [2026-03-04 ~20:00] Feature — Notes System (OneNote-style)

**Goal:** Full notebook/section/page note-taking system embedded in HALQ. Left panel shows notebook tree, right panel shows page editor.

**Storage layout:**
```
userdata/notes/
  notebooks.json        ← notebook/section/page tree metadata
  pages/[id].html       ← each page's HTML content
  assets/[id]/          ← images and files attached to each page
```

**`main.js`** — Added NOTES section with 8 IPC handlers:
- `notes-meta-load` — reads `notebooks.json`, returns tree
- `notes-meta-save` — writes updated tree to `notebooks.json`
- `notes-page-load` — reads `pages/[id].html`, returns HTML content
- `notes-page-save` — writes page HTML content to `pages/[id].html`
- `notes-page-delete` — deletes page file and its assets folder
- `notes-asset-save` — saves base64-encoded image/file to `assets/[id]/[filename]`, returns `file://` src path
- `notes-file-read` — reads any file from disk as base64 (for inserting images/files)
- `notes-asset-open` — opens attached file in default system app via `shell.openPath()`

**`preload.js`** — Exposed all 8 notes handlers on `window.halq`

**`index.html`** — Added Notes view (full-screen overlay, `z-index: 100`):

*Left panel — Notebook tree:*
- ← back button returns to Work Orders
- Three-level hierarchy: Notebook → Section → Page
- Each level: expand/collapse arrow, rename (✎), delete (🗑), add child (+)
- Section color dots (8 colors, auto-assigned in rotation)
- Active page highlighted with accent color + left border
- Auto-save triggers re-render to update page title in tree

*Right panel — Page editor:*
- Page title input with accent underline on focus
- Toolbar (disabled/dimmed until a page is open): Bold, Italic, Underline, Strikethrough, H1/H2/H3/¶, Bullet List, Numbered List, Checklist, Table, Insert Image, Insert File, Draw mode, Text Color, Highlight, Font Size, Align Left/Center/Right, Undo/Redo
- `contenteditable` body — `execCommand`-based rich text editing
- Checklist inserts `<input type=checkbox>` inline
- Table — custom row/col count via prompt, renders full `<table>` with header row
- Image insert — file picker → base64 read → asset save → `<img>` injected
- File attach — file picker → asset save → clickable `<span class="nt-file">` injected, click opens in system app
- Paste handler — clipboard images pasted directly into page (saves as asset)
- Drop handler — drag images/files onto page to insert

*Drawing canvas:*
- Canvas overlay (`position: absolute`) sits above content, `pointer-events: none` when inactive
- Draw mode toggle — activates canvas, shows draw sub-toolbar (color picker, size slider, eraser, clear, save)
- Freehand pen drawing with `lineCap: round`
- Eraser mode — `clearRect` 20×20 under cursor
- Save Drawing — flattens canvas to PNG, saves as asset, inserts as `<img>`, clears canvas, exits draw mode

*Auto-save:*
- `ntMarkDirty()` — sets dirty flag, debounces 2-second auto-save timer
- `ntSavePage()` — saves page HTML + updates title in metadata + writes both to disk
- Also triggered on `onblur` of title input

*Custom prompt modal:*
- `window.prompt()` is silently blocked by Electron — replaced with `ntPrompt(label, default)` Promise-based modal
- Used for: notebook name, section name, page title, rename, table rows/cols
- Enter key confirms, Escape cancels

*CSS additions:* `.notes-view`, `.notes-sidebar`, `.notes-editor`, `.notes-tb`, `.notes-page-area`, `.notes-body`, `.notes-canvas-wrap`, `.nt-prompt-overlay` and all tree/toolbar subcomponents

---

### [2026-03-04 ~22:00] Cleanup — UI Declutter Pass

**`index.html`**

*Sidebar nav:*
- Removed Appfolio, Macros, Summary nav items — only Work Orders, Email, Notes, Settings remain

*Macro bar:*
- Removed `<!-- MACRO BAR -->` HTML block entirely (Scan, Quick Transfer, Refresh, Summary, Run All)

*Topbar:*
- Removed Import button from topbar actions
- Removed "Active Monitoring · X open" label from topbar
- JS refs to `wo-count-label` guarded with null-check to avoid runtime error

*Bottom bar:*
- Removed "Excel Connected" pill
- Removed "Appfolio Ready" pill
- Remaining: Active WOs count, Overdue count, clock

*Sidebar footer:*
- Removed hardcoded "Excel connected" status pill

---

### [2026-03-04 ~22:15] Feature — Filter Chip Arrows

**`index.html`**
- Replaced horizontal scroll on filter chips with ◀ ▶ arrow buttons (same pattern as tab bar)
- Added `.wo-filters-wrap` container with arrows on each side
- Added `scrollChips(dir)` — scrolls chips 80px per click
- Added `updateChipArrows()` — toggles `disabled` class on arrows by scroll position
- Called on DOMContentLoaded

---

### [2026-03-04 ~22:20] Feature — Search Clear Button

**`index.html`**
- Wrapped search input in `.wo-search-wrap` (position: relative)
- Added `✕` clear button — shows when input has text, clears and refocuses on click
- `clearSearch()` and `updateSearchClear(input)` added

---

### [2026-03-04 ~22:25] Feature — Resizable Panel Dividers

**`index.html`**
- Added `.resize-divider` CSS — 5px, `cursor: col-resize`, accent highlight on hover/drag
- Added `initResizeDivider(dividerId, prevEl, nextEl, dir)` — drag-resize via mousedown/move/up
- `<div class="resize-divider" id="wo-resize-divider">` between WO panel and Appfolio panel
- WO panel `border-right` removed (divider is the separator)
- Wired in DOMContentLoaded

---

### [2026-03-04 ~22:30] Feature — Notes Redesign (3-Panel Layout)

**`index.html`** — complete Notes view restructure

*Layout:*
- Notes view: `flex-direction: column` (topbar + body)
- `.notes-topbar` — Work Orders / Email / Notes tabs (replaces ← Back button)
- `.notes-body-wrap` — holds 3 panels horizontally

*Panel 1 — Notebook/Section tree (`.notes-nb-panel`, 200px):*
- Notebooks expand to show sections only (pages removed from tree)
- Clicking a section highlights it and populates Panel 2
- Section rows have `.active` state when selected

*Panel 2 — Pages list (`.notes-pg-panel`, 180px):*
- Header shows selected section name + `+` button
- Drag and drop page reordering (`ntPgDragStart`, `ntPgDragOver`, `ntPgDrop`)
- Empty states: "Select a section" / "No pages"

*Panel 3 — Editor (`.notes-editor`):*
- `background: #ffffff` — white editor area
- Toolbar and contenteditable body unchanged

*Resizable dividers:*
- `#notes-divider-1` between Panel 1 and 2
- `#notes-divider-2` between Panel 2 and 3
- Wired on first `switchMainView('notes')` open via `notesDividersInit` flag

*JS additions:*
- `ntActiveSec` — tracks selected section
- `ntSelectSection(nbId, secId)` — sets activeSec, re-renders both panels
- `ntRenderPgPanel()` — renders pages list for active section
- `ntAddPageFromPanel()` — adds page using `ntActiveSec` context
- All `ntRenderTree()` calls paired with `ntRenderPgPanel()`

---

### [2026-03-04 ~22:45] Fix — Syntax Error (Unclosed Brace in ntRename)

**Root cause:** `str_replace` swallowed closing `}` of `ntRename` and `// NOTES — DELETE` comment header when appending `ntRenderPgPanel()`.

**`index.html`**
- Restored closing `}` of `ntRename`
- Restored `// NOTES — DELETE` comment header before `ntDelete`
- Verified brace depth = 0

---

### [2026-03-05 ~14:00] Feature — Notes Export / Import (initial)

**`main.js`**
- Added `ipcMain.handle('notes-export', ...)` — exports full notebook as self-contained `.halqnote` JSON (page HTML + base64 assets embedded)
- Added `ipcMain.handle('notes-import', ...)` — imports `.halqnote` (full restore with new IDs), `.html`, `.txt`
- Added `ipcMain.handle('notes-page-save', ...)` (already existed — confirmed wired)

**`preload.js`**
- Added `notesExport(nbId)` and `notesImport()` to `window.halq`

**`index.html`**
- Added `ntExport(nbId)` — ⬇ button on each notebook row, calls `window.halq.notesExport`
- Added `ntImport()` — ⬆ button in notebook panel header, calls `window.halq.notesImport`
- Import flow: `.halqnote` reloads full meta; `.html`/`.txt` placed into active section or auto-creates notebook

---

### [2026-03-05 ~14:30] Feature — OneNote `.one` Import

**`main.js`**
- Added `parseOneBuffer(buf, baseName)` shared helper — extracts text from OneNote binary
  - Pass 1: ASCII runs (actual field values)
  - Pass 2: UTF-16LE runs (labels and structured text)
  - Sorts all text by file offset (document order)
  - Filters noise: font names, XML metadata, binary garbage strings
  - Deduplicates across revision history blocks
  - Renders to HTML: `<hr>` for separators, `<strong>` labels, `<a href>` email links
- Import handler now accepts `.one` — validates OneNote GUID header, calls `parseOneBuffer`, returns HTML page

**Findings from binary analysis of `March_05__2026.one`:**
- Format: Microsoft OneNote section binary (GUID `E4525C7B-8CD8-A74D-...`)
- Text stored in two encodings: ASCII (values/data) and UTF-16LE (labels/structure)
- File contains 13 revision copies of the same content — deduplicated on import
- Extracted 126 unique content strings: addresses, dates, SR#s, Acc#s, phone numbers, emails

---

### [2026-03-05 ~15:00] Improvement — Export Modal + UI Cleanup

**`index.html`**

*Export modal (replaces per-notebook ⬇ button):*
- `ntExportModal()` — opens modal with 3 scope options
- **Notebook** — full notebook with all sections and pages
- **Section** — one section (notebook → section cascade dropdowns)
- **Page** — single page (notebook → section → page cascade)
- Pre-selects active notebook/section/page context on open
- Saves as `.halqnote` via native save dialog

*Import/Export moved to topbar far-right:*
- Removed ⬆ from notebook panel header
- Removed ⬇ from per-notebook tree row actions
- Added `.notes-topbar-actions` div with `⬆ Import` and `⬇ Export` buttons at far right of notes topbar
- `.nt-topbar-btn` (grey) for Import, `.nt-topbar-btn.accent` (blue) for Export

*Toolbar (B I U H1 H2 H3) color fix:*
- Editor background is hardcoded `#ffffff` — toolbar was using `var(--text2)` which is light in dark theme, invisible against white
- Fixed: toolbar CSS now hardcoded light grey background (`#efefef`) with dark text (`#333`) regardless of app theme
- `.nbt`, `.nbt:hover`, `.nbt.on`, `.nbt-sel`, `.notes-tb-sep` all updated to hardcoded values

**`main.js`**
- `notes-export` updated to accept `{ type, nbId, secId, pgId }` instead of plain `nbId`
- Handles `type: 'notebook'`, `'section'`, `'page'` with appropriate default filename
- `notes-import` `.halqnote` handler updated to handle all 3 export types:
  - `exportType: 'page'` → returns as single page for caller to place
  - `exportType: 'section'` → adds section to matching notebook (or creates new)
  - `exportType: 'notebook'` → full restore with new IDs

**`preload.js`**
- `notesExport(nbId)` → `notesExport(opts)` signature updated

---

### [2026-03-05 ~15:30] Feature — `.onepkg` Import

**Background:** `.onepkg` is a Microsoft Cabinet (`.cab`) file, not ZIP. Contains `.one` section files + `.onetoc2` TOC. Uses LZX compression — not available in Node's `zlib`.

**`main.js`**
- `.onepkg` handler detects `MSCF` (Cabinet) vs `PK` (ZIP) signature
- Cabinet path: calls `expand.exe` (built into every Windows installation at `%SystemRoot%\System32\expand.exe`)
  - Command: `expand.exe "file.onepkg" -F:* "tempDir"`
  - Falls back to `expand` in PATH if full path fails
- ZIP path: extracts `.one` files using `zlib.inflateRawSync` (deflate)
- Each extracted `.one` → parsed via `parseOneBuffer` → becomes one section in a new notebook
- Temp dir cleaned up in `finally` block
- Each `.one` file → separate section (not page) so notebook structure is preserved

**`index.html`**
- `ntImport()` handles `type: 'onepkg'` result — reloads meta, re-renders tree
- Success message shows notebook name + page count

**Limitation:** `.onepkg` import recovers all text content. Images, handwriting, and embedded files inside OneNote cannot be extracted (binary-only data, no text representation).

---

### [2026-03-05 ~15:45] Fix — `.onepkg` ZIP Signature Error

**Root cause:** previous handler checked `buf[0] === 0x50 && buf[1] === 0x4B` (ZIP) only — actual `.onepkg` files are Cabinet format starting with `MSCF` (`4D 53 43 46`).

**`main.js`**
- Added `MSCF` signature check alongside `PK`
- Cabinet format routed to `expand.exe`; ZIP format routed to `zlib`
- Error message updated to reflect both supported container formats

---

## Outstanding / In Progress

- Excel import still requires manual macro run in Excel — COM automation permanently blocked
- Notes — Email section is placeholder only, not yet built
- Tab labels show hostname, not page title
- Notes top nav: Work Orders tab navigates away correctly; Email tab is placeholder only
- `.onepkg` import: images and handwriting inside OneNote cannot be extracted (text only)
- `splitOnePages` heuristic may misclassify some content lines as page titles in notebooks with unusual formatting — needs real-world testing on more `.one` files

---

## File Reference

| File | Purpose |
|------|---------| 
| `main.js` | Electron main process — IPC handlers, window, session |
| `preload.js` | contextBridge — exposes `window.halq` API to renderer |
| `index.html` | All UI — HTML, CSS, JS in one file |
| `userdata/creds.enc` | Encrypted Appfolio credentials |
| `userdata/pin.enc` | Encrypted settings PIN |
| `userdata/session/` | Appfolio session cookies |
| `userdata/categories.json` | Saved category list with colors |
| `userdata/wo-tags.json` | Per-WO followup dates and category assignments |
| `userdata/notes/notebooks.json` | Notes tree metadata |
| `userdata/notes/pages/` | Page HTML content files |
| `userdata/notes/assets/` | Images and files attached to notes pages |

## `window.halq` API (`preload.js`)

| Method | IPC Channel | Description |
|--------|-------------|-------------|
| `credsSave(email, password)` | `creds-save` | Encrypt + save credentials |
| `credsLoad()` | `creds-load` | Decrypt + return credentials |
| `credsClear()` | `creds-clear` | Delete credentials |
| `pinSave(pin)` | `pin-save` | Encrypt + save PIN |
| `pinLoad()` | `pin-load` | Decrypt + return PIN |
| `pinClear()` | `pin-clear` | Delete PIN |
| `dialogOpen(options)` | `dialog-open` | Native file open dialog |
| `excelLoad()` | `excel-load` | Read Active Monitoring sheet |
| `excelImport(filePath)` | `excel-import` | Prep import temp file for manual macro |
| `toggleMenuBar(visible)` | `toggle-menubar` | Show/hide Electron menu bar |
| `woTagsSave(tags)` | `wo-tags-save` | Save per-WO tags to disk |
| `woTagsLoad()` | `wo-tags-load` | Load per-WO tags from disk |
| `categoriesSave(cats)` | `categories-save` | Save category list to disk |
| `categoriesLoad()` | `categories-load` | Load category list from disk |
| `onNewTab(callback)` | `open-new-tab` | Listen for new tab requests from webview |
| `notesMetaLoad()` | `notes-meta-load` | Load notebook tree metadata |
| `notesMetaSave(data)` | `notes-meta-save` | Save notebook tree metadata |
| `notesPageLoad(pageId)` | `notes-page-load` | Load page HTML content |
| `notesPageSave(pageId, html)` | `notes-page-save` | Save page HTML content |
| `notesPageDelete(pageId)` | `notes-page-delete` | Delete page file + assets |
| `notesAssetSave(pageId, name, b64)` | `notes-asset-save` | Save image/file asset, return src |
| `notesFileRead(filePath)` | `notes-file-read` | Read file as base64 for inserting |
| `notesAssetOpen(filePath)` | `notes-asset-open` | Open file in default system app |
| `notesExport(opts)` | `notes-export` | Export notebook/section/page as `.halqnote` |
| `notesImport()` | `notes-import` | Import `.halqnote` `.one` `.onepkg` `.html` `.txt` |
---

### [2026-03-05 ~16:30] Debug — notebooks.json Bloat Diagnosis

**Root cause discovered:** `userdata/notes/notebooks.json` had grown to **10.7MB** containing **108,151 pages**. "Weekly Meeting" section alone had 96,801 pages — `parseOneBuffer` was creating a new page for nearly every extracted text line because `splitOnePages` treated almost every line as a page title (no content threshold, no safety cap).

**Contributing factors:**
- `seen` dedup set in `parseOneBuffer` was scoped per import call only — repeated imports of the same `.one` file multiplied entries
- `splitOnePages` title heuristic was too permissive — short lines with no punctuation all matched, including data values
- No maximum page count guard — an import of a large `.one` could produce thousands of pages with no cap
- `notebooks.json` had no cleanup mechanism — orphaned entries from failed/repeated imports accumulated indefinitely

**Symptom chain:** Large `notebooks.json` → slow tree render on startup → app freeze → "expand.exe failed: unknown error" (timeout, not actually an expand.exe error)

---

### [2026-03-05 ~17:00] Fix — .onepkg Import Overhaul + Progress Bar + Cleanup

**Files changed:** `main.js`, `index.html`, `preload.js`

#### `main.js`

**`parseOneBuffer` refactored:**
- Now returns `{ name, lines[], lineToHtml(), lineCount }` — structured output instead of pre-built HTML blob
- `lineToHtml()` is a closure that captures `esc`, `SEP`, `LABEL` — passed to `splitOnePages` to render lazily per page

**New `splitOnePages(parsed, sectionName)` function:**
- Groups extracted lines into pages using strict OneNote title heuristics:
  - Must be ≤ 60 chars (was 80)
  - No sentence punctuation
  - No `label: value` pattern
  - No date patterns (`3/5/...`)
  - **Positive signals required:** time pattern (`1:29 PM`), Title Case name, ALL CAPS short label
- Safety cap: if splitting produces > 500 pages, collapses everything to 1 page — prevents explosion on malformed or large `.one` files
- Titles with no following content are merged into next page (no empty pages)

**`.onepkg` handler updated:**
- Calls `splitOnePages` per section — creates proper multi-page sections instead of one page per `.one` file
- Sends `notes-import-progress` IPC events to renderer during parse and write stages:
  - `{ stage: 'parse', file, index, total }` — per section while parsing
  - `{ stage: 'write', file, page, pageIndex, pageTotal }` — per page while writing
- Returns `{ sectionCount, pageCount }` in addition to `pkgName`

**`.one` single-file handler updated:**
- Returns `type: 'one-section'` with structured `pages[]` array instead of raw HTML
- Renderer creates a proper named section with all detected pages

**New `notes-cleanup` IPC handler:**
- Scans `userdata/notes/pages/` for `.html` files
- Cross-references against all valid page IDs in `notebooks.json`
- Deletes any `.html` files not referenced by any page entry
- Also removes orphaned `assets/[id]/` folders
- Returns `{ ok, orphanCount, assetCount, validPageCount }`

#### `index.html`

**Progress bar overlay (`ntShowImportProgress` / `ntHideImportProgress`):**
- Fixed-position dark overlay with gradient progress bar
- Appears immediately when import starts ("Opening file… 5%")
- Updates live via `notes-import-progress` events from main process
- Auto-hides on completion or error

**`window.halq.onNotesImportProgress` listener:**
- Registered on init — routes `notes-import-progress` IPC events to `ntShowImportProgress()`
- Shows section name + `index/total` count as import progresses

**New `_ntImportOneSection(result)` handler:**
- Handles `type: 'one-section'` results from `.one` imports
- Creates a new named section in target notebook
- Writes each page individually via `notesPageSave`
- Shows progress overlay during write phase

**`ntImport()` updated:**
- Shows progress overlay immediately before `notesImport()` call
- Hides on cancel, error, or completion
- Routes `onepkg` result to meta reload (pages already written by main)
- Routes `one-section` to `_ntImportOneSection`
- Routes `.html`/`.txt` to original `_ntImportSinglePage`
- `onepkg` success message now includes section count

**New `ntCleanupOrphans()` function:**
- Prompts for confirmation
- Calls `window.halq.notesCleanup()`
- Shows result in debug bar: orphan count, asset folder count, valid page count kept

**🧹 Cleanup button added to Notes topbar:**
- Positioned after Export button
- Calls `ntCleanupOrphans()` — deletes all orphaned page files to restore `notebooks.json` size

#### `preload.js`

- Added `notesCleanup: () => ipcRenderer.invoke('notes-cleanup')`
- Added `onNotesImportProgress: (cb) => ipcRenderer.on('notes-import-progress', (_e, data) => cb(data))`

---

## Outstanding / In Progress

- Excel import still requires manual macro run in Excel — COM automation permanently blocked
- Notes — Email section is placeholder only, not yet built
- Tab labels show hostname, not page title
- `.onepkg` import: images and handwriting inside OneNote cannot be extracted (text only)
- After first install of this fix: run **🧹 Cleanup** immediately to delete the 108k orphaned page files

---

## File Reference

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — IPC handlers, window, session |
| `preload.js` | contextBridge — exposes `window.halq` API to renderer |
| `index.html` | All UI — HTML, CSS, JS in one file |
| `userdata/creds.enc` | Encrypted Appfolio credentials |
| `userdata/pin.enc` | Encrypted settings PIN |
| `userdata/session/` | Appfolio session cookies |
| `userdata/categories.json` | Saved category list with colors |
| `userdata/wo-tags.json` | Per-WO followup dates and category assignments |
| `userdata/notes/notebooks.json` | Notes tree metadata |
| `userdata/notes/pages/` | Page HTML content files |
| `userdata/notes/assets/` | Images and files attached to notes pages |

## `window.halq` API (`preload.js`)

| Method | IPC Channel | Description |
|--------|-------------|-------------|
| `credsSave(email, password)` | `creds-save` | Encrypt + save credentials |
| `credsLoad()` | `creds-load` | Decrypt + return credentials |
| `credsClear()` | `creds-clear` | Delete credentials |
| `pinSave(pin)` | `pin-save` | Encrypt + save PIN |
| `pinLoad()` | `pin-load` | Decrypt + return PIN |
| `pinClear()` | `pin-clear` | Delete PIN |
| `dialogOpen(options)` | `dialog-open` | Native file open dialog |
| `excelLoad()` | `excel-load` | Read Active Monitoring sheet |
| `excelImport(filePath)` | `excel-import` | Prep import temp file for manual macro |
| `toggleMenuBar(visible)` | `toggle-menubar` | Show/hide Electron menu bar |
| `woTagsSave(tags)` | `wo-tags-save` | Save per-WO tags to disk |
| `woTagsLoad()` | `wo-tags-load` | Load per-WO tags from disk |
| `categoriesSave(cats)` | `categories-save` | Save category list to disk |
| `categoriesLoad()` | `categories-load` | Load category list from disk |
| `onNewTab(callback)` | `open-new-tab` | Listen for new tab requests from webview |
| `notesMetaLoad()` | `notes-meta-load` | Load notebook tree metadata |
| `notesMetaSave(data)` | `notes-meta-save` | Save notebook tree metadata |
| `notesPageLoad(pageId)` | `notes-page-load` | Load page HTML content |
| `notesPageSave(pageId, html)` | `notes-page-save` | Save page HTML content |
| `notesPageDelete(pageId)` | `notes-page-delete` | Delete page file + assets |
| `notesAssetSave(pageId, name, b64)` | `notes-asset-save` | Save image/file asset, return src |
| `notesFileRead(filePath)` | `notes-file-read` | Read file as base64 for inserting |
| `notesAssetOpen(filePath)` | `notes-asset-open` | Open file in default system app |
| `notesExport(opts)` | `notes-export` | Export notebook/section/page as `.halqnote` |
| `notesImport()` | `notes-import` | Import `.halqnote` `.one` `.onepkg` `.html` `.txt` |
| `notesCleanup()` | `notes-cleanup` | Delete orphaned page files + asset folders |
| `onNotesImportProgress(cb)` | `notes-import-progress` | Live progress events during import |

---

### [2026-03-05 ~17:30] Fix — `1:29 PM` / `2:39 PM` Phantom Pages + Encoding-Based Title Detection

**Root cause:** `1:29 PM` and `2:39 PM` were OneNote **page modification timestamps** stored as ASCII metadata in the `.one` binary. `parseOneBuffer` was extracting them as printable strings, and the previous `isPageTitle` heuristic specifically matched `HH:MM AM/PM` patterns as *positive* title signals — the exact opposite of correct. At scale (large notebooks), every metadata timestamp became a page, producing thousands of phantom pages.

**Diagnosis method:** Inspected the new `Talley_Properties.onepkg` (6177 bytes, `.one` file grew from 19 KB → 77 KB with real content). Cabinet uses LZX compression — cannot decompress outside Windows. Reasoned from OneNote binary format spec: ASCII byte sequences in `.one` files are structural metadata; UTF-16LE sequences are user-typed content.

**Key insight — encoding is the discriminator:**

| Encoding | Source | Examples |
|----------|--------|---------|
| ASCII | OneNote metadata | Font names, GUIDs, XML attributes, page timestamps, checksums |
| UTF-16LE | User-typed content | Page titles, note text, table cell values |

Previous code treated both encodings identically. The fix tags every extracted string with its encoding and uses that as the primary gate for title detection.

**`main.js` changes (only file modified):**

*`parseOneBuffer` — encoding tags:*
- `collected[]` entries now carry `enc: 'ascii'` or `enc: 'utf16le'`
- `lines[]` now contains `{ text, enc }` objects instead of plain strings
- `lineToHtml()` closure still accepts a plain string (callers pass `item.text`)

*`splitOnePages` — encoding-gated title detection:*
- `isPageTitle(item)` now checks `item.enc !== 'utf16le'` as the **first rule** — if ASCII, immediately return false, no further checks
- Removed the `HH:MM AM/PM` positive-match rule (was backwards — timestamps are noise)
- All other heuristics (length, punctuation, word count, letter ratio, Jr/Sr suffix) still apply as secondary filters on UTF-16LE lines
- Loop updated: iterates `{ text, enc }` items, passes `item.text` to `lineToHtml`

**Result for `Work Order Tracker.one` with real content:**
- `Test`, `Test 2`, `Test 3` → 3 separate pages (UTF-16LE, pass all filters)
- `1:29 PM`, `2:39 PM` → blocked at `isNoise()` in `parseOneBuffer` (timestamp pattern) AND by `enc !== 'utf16le'` backstop in `isPageTitle` — never appear anywhere
- At scale: the 96,801-page "Weekly Meeting" explosion cannot recur — ASCII metadata is permanently excluded from title candidacy


---

### [2026-03-05 ~18:30] Fix — Content on Wrong Pages + Progress Bar Stuck

**Session uploads showed:**
- `Test` page: only `Ar-Rasheed JR. Quilates` (missing `Thursday, March 5, 2026` and `All here should be in test`)
- `Test 2`, `Test 3`: empty
- App visually stuck on "Parsing Work Order Tracker" progress overlay

---

#### Bug 1 — Progress bar frozen on "Parsing Work Order Tracker"

**Root cause (index.html):** `write`-stage events from main process used fields `pageIndex`/`pageTotal`, but the renderer listener read `data.index`/`data.total` — both undefined for write events. `pct` calculated as `NaN`, bar froze at last known position. No feedback during expand.exe decompression (slowest part — could be several seconds on large files).

**`index.html`:**
- Listener now branches on `data.stage`:
  - `extract` → 15%, message: "Extracting: filename…"
  - `parse`   → 15–65%, reads `data.index` / `data.total`
  - `write`   → 65–95%, reads `data.pageIndex` / `data.pageTotal`
- Error path now calls `ntHideImportProgress()` before showing error dialog

**`main.js`:**
- New `extract` stage event fires immediately before expand.exe/ZIP extraction call
- Fields: `{ stage: 'extract', file: path.basename(filePath) }`

---

#### Bug 2 — Content landing on wrong pages / missing

**Root cause:** Previous RevisionManifest boundary scan used `(uint32 & 0x3FF) === 0x08C` scanned at every 4-byte aligned position across the entire file. In a 77 KB `.one` file (~19,250 uint32 values), the probability of any random value matching is 1/1024 — producing ~19 false-positive boundaries alongside the ~3–9 real ones. False splits chopped content regions into tiny fragments; most had no valid title string and were silently discarded, taking their content with them.

**Fix — proper MS-ONE FileNodeList walking (`main.js` only):**

`parseOneBuffer` now reads the actual binary structure instead of scanning:

1. Reads `fcrFileNodeListRoot.stp` from file header offset 72 (uint32 LE, low 32 bits) — exact offset of the root `FileNodeListFragment`
2. Walks `FileNode` entries by following the `Size` field (bits 10–22 of each node's 4-byte `NodeInfo` word) — zero false positives, no guessing
3. Tracks `RevisionManifestStartFND` (FileNodeID `0x08C`) → `RevisionManifestEndFND` (FileNodeID `0x090`) pairs as exact page boundaries
4. Calls `extractStrings(region.start, region.end, seen)` per region — first clean UTF-16LE string = page title, rest = page content
5. Falls back to flat extraction if structure walk finds no valid regions (≤ 0 or > 200 pages)

**MS-ONE header reference:**

| Offset | Size | Field |
|--------|------|-------|
| 0 | 16 | `guidFileType` (OneNote magic GUID) |
| 72 | 8 | `fcrFileNodeListRoot.stp` — offset of root fragment |
| 80 | 4 | `fcrFileNodeListRoot.cb` — size of root fragment |

**FileNode header layout (4 bytes):**

| Bits | Field |
|------|-------|
| 0–9 | `FileNodeID` |
| 10–22 | `Size` (total node size in bytes, including header) |
| 23–24 | `StpFormat` |
| 25–26 | `CbFormat` |
| 27–29 | `BaseType` |
### [2026-03-05 ~20:00] Fix — parseOneBuffer: Fragment-Boundary + Unique-String Algorithm

**Root cause of all previous page-splitting failures:**

The old code read `fcrFileNodeListRoot.stp` from header offset 72. That offset is actually `ffvLastCodeThatWroteToThisFile` (a 4-byte version field = `0x2A = 42`). The real `fcrFileNodeListRoot` is at offset `0xB8` (184), and in this file it is null (`0xFFFFFFFF`) — the file uses the hashed chunk list structure path instead. So the FileNodeList walk produced 0 regions, fell through to flat extraction, and `splitOnePages` heuristics failed to split pages correctly.

Separately: `RevisionManifestEnd` (node ID `0x090`) appears **zero times** in this file — end boundaries span multiple fragments and can't be found with a single-fragment scan. All previous approaches that relied on finding REV_END were fundamentally broken.

**Binary analysis of `March_05__2026.one` (436 KB, used as test proxy):**
- `FileNodeListFragment` magic `0xA4567AB1F5F7F4C4` found at 27 positions
- `RevisionManifestStart6FND` (node ID `0x08C`) found in **15** separate fragments — one per page revision
- `RevisionManifestEnd` (node ID `0x090`) = **0 occurrences** throughout entire file
- Content strings appear at large offsets within each fragment region (+5,000–25,000 bytes from fragment start) — position-based ordering is unreliable for title detection
- Boilerplate strings (`Friday, September 16, 2022`, phone, email, labels) appear in **every** page region
- Unique date strings (`March 05, 2026`, etc.) appear in **exactly one** region each — these are the page titles

**New algorithm (`main.js` — `parseOneBuffer` rewrite):**

1. **Fragment scan**: search entire buffer for `FileNodeListFragment` magic bytes (`C4 F4 F7 F5 B1 7A 56 A4`)
2. **REV_START detection**: walk each fragment's FileNodes (16-byte header skip); flag fragments containing node ID `0x08C`
3. **Page regions**: flagged fragment byte offsets → `revFragOffsets[]`; region = `[fragOffset .. nextFragOffset)`
4. **Pass 1 — per-page string extraction**: extract UTF-16LE strings for each region independently (per-page dedup, no cross-page dedup) → `pageStrings[]`
5. **Pass 2 — cross-page count**: for every string, count how many pages it appears in → `strCount` map
6. **Title selection**: strings with `strCount === 1` = unique to one page = title candidates; pick **shortest** (page titles are typically shorter than content strings)
7. **Revision dedup**: pages with no unique strings = pure revision duplicates → skipped automatically
8. **Body**: all strings in the region except the title → rendered as HTML

**`splitOnePages` simplified:**
- Removed all heuristic title detection (`isPageTitle`, encoding checks, word count, punctuation rules, Jr/Sr suffix etc.)
- Flat fallback: returns all content as a single page — safe catch-all for unknown `.one` formats

**Node.js test result on `March_05__2026.one`:**
```
Pages found: 10
  "January 30, 2026"  — 13 content strings
  "February 05, 2026" — 12 content strings
  ...
  "March 05, 2026"    — 12 content strings
```

**Expected result for `Work Order Tracker.one` (inside `Talley_Properties.onepkg`):**
- `expand.exe` extracts the CAB → `Work Order Tracker.one` (77,262 bytes)
- `parseOneBuffer` finds 3 REV_START fragments (one per page)
- "Test", "Test 2", "Test 3" each appear in exactly one region → selected as titles
- "All here should be in test", etc. appear as unique body content per page
- Result: Notebook "Talley Properties", Section "Work Order Tracker", Pages: Test / Test 2 / Test 3

**Files changed:** `main.js` only

---

## Outstanding / In Progress

- Excel import still requires manual macro run in Excel — COM automation permanently blocked
- Notes — Email section is placeholder only, not yet built
- Tab labels show hostname, not page title
- `.onepkg` import: images and handwriting inside OneNote cannot be extracted (text only)
- `parseOneBuffer` new algorithm proven on `March_05__2026.one` (10 pages correct); `Work Order Tracker.one` cannot be tested locally (requires `expand.exe` to decompress LZX from CAB)
---

## Session — 2026-03-06

---

### [2026-03-06] Major Cleanup & Settings Overhaul

#### Removed — Dead Features
- **Portfolio field** (`BH`/`Talley`) — no Excel column, removed from WO cards, detail drawer, and filter chips
- **`notified` column** — was read from Excel col 15 but never displayed anywhere; removed from `AM_COL` and `excel-load` map
- **Hardcoded sample `wos[]` data** — replaced with empty array; Excel is now the sole source of truth
- **Macro Bar** (`.macro-bar` / `.macro-btn` CSS) — UI was removed previously; CSS/dead code now cleaned up
- **`runAllMacros()`**, **`confirmQuickTransfer()`** — UI-facing wrappers removed (no HTML entry point); core `runMacro()`, `setMacroRunning()`, `setMacroDone()` kept intact since Excel macros still function
- **`triggerImport()`**, **`handleImportFile()`** — drag/drop overlay and file picker removed; drag events stub kept to prevent unhandled window drop behavior
- **Top Nav** — removed Appfolio and Macros items; kept Work Orders and Notes (wired)
- **Section Tabs** — removed Appfolio, Email, Macros; kept Work Orders and Notes (both wired to `switchMainView`)
- **"Tools" sidebar section** — removed Settings nav item from left pane (Settings accessible via titlebar only)
- **Preferences toggles: "Show Macro Bar"** — removed
- **Hardcoded `EXCEL_PATH`** constant in `main.js` — removed; path now loaded dynamically from settings
- **Hardcoded `talley.appfolio.com`** domain — removed from webview src, URL bar, tab data-url, `selectWO`, `openInAppfolio`, `tryAutoFill`; all now use configured Appfolio URL from settings
- **Hardcoded project path** in CHANGELOG header — removed
- **Hardcoded "12" overdue** in bottom bar HTML — fixed to show `—` until Excel loads

#### Fixed
- **Bottom bar numbers** — Active WOs and Overdue now clearly readable: larger font size, bold white numbers, overdue in orange
- **Bottom bar live update** — extracted `updateBottomBar()` helper; called consistently after Excel load and on catch
- **`loadWOTags` re-apply on Excel reload** — tags now re-applied to fresh WO data after `loadExcelData()` succeeds
- **Settings: Preferences toggles wired** — Color Code WOs, Auto-search, Show Bottom Bar, Show Menu Bar now persist via `settings.json`

#### Added — Settings Overhaul
- **Settings split into 3 tabs:** Accounts · Appearance · Preferences
- **Accounts tab:** Appfolio URL + login creds, Email login creds, Excel file location (with Browse button), PIN lock
- **Appearance tab:** Theme, Layout, Navigation style
- **Preferences tab:** Color Code WOs, Auto-search, Show Bottom Bar, Show Menu Bar
- **Excel file path setting** — stored in `userdata/settings.json`; Browse button triggers native file dialog; auto-reloads WO data after save
- **Email credentials** — separate encrypted store (`email-creds.enc`) via `safeStorage`; new IPC handlers `email-creds-save/load/clear`; preload bridge updated
- **App settings IPC** — `settings-load` / `settings-save` handlers added to `main.js`; `settingsLoad`/`settingsSave` added to `preload.js`
- **Startup credential checker** — `checkStartupRequirements()` runs after `window.halq` ready; if Appfolio creds or Excel path are missing, Settings auto-opens to Accounts tab with a debug hint
- **Appfolio URL configurable** — `applyAppfolioUrl()` sets webview src and tab URL from saved settings on startup
- **`loadAppSettings()`** — loads Excel path, Appfolio URL, and preference states from `settings.json` on startup
- **`loadEmailCredsToUI()`** — pre-fills email address field when Settings opens

#### Notes Import / Export (main.js)
- Import and Export IPC handlers remain in `main.js` (Notes feature uses them)
- Notes import/export removed from prior session's UI per user decision; handlers retained for Notes toolbar use
---

### [2026-03-06] Feature — Email View (IMAP Backend + Full Navigation Interconnect)

#### Navigation Overhaul — WO → EMAIL → NOTES
- **Order changed** to: Work Orders · Email · Notes (across all nav surfaces)
- **Top nav** (`#top-nav`): added Email tab with id `topnav-*` for each view
- **Section tabs** (`#section-tabs`): added Email tab with id `sectab-*`
- **Sidebar nav**: added `#nav-email` item between WO and Notes
- **`switchMainView()`** rewritten — handles `'wo'` / `'email'` / `'notes'`; syncs all 3 nav surfaces simultaneously; calls `emInit()` on email view; removed 2-view `!isNotes` pattern
- **Notes topbar** (`notes-nav-tab`): fixed duplicate `active` bug; added Email tab; removed Import/Export buttons per user decision (Cleanup button kept)

#### Email View — UI
- New `#email-view` full-screen panel (mirrors `notes-view` positioning pattern)
- **Topbar**: WO · Email (active) · Notes tabs + Refresh button — identical layout to notes-topbar
- **3-panel layout**: Folder tree (left) · Message list (middle) · Message body (right)
- **Folder panel**: auto-populated from IMAP; smart icons (📥📤📝🗑🚫⭐📁); auto-selects INBOX on load; active folder highlighted
- **Message list**: newest 50 messages; displays sender display name, subject, smart date (time if today, short date otherwise)
- **Message body**: renders HTML emails in sandboxed `<iframe>`; falls back to `<pre>` plain text; shows From/Date header; loading states on all panels
- Error states shown inline (no dialogs) for connection failures

#### Email View — CSS
- `.email-view`, `.email-topbar`, `.email-nav-tab` — mirrors notes-topbar classes
- `.email-folder-panel`, `.email-folder-item` — left pane folder tree
- `.email-msg-panel`, `.email-msg-item` — middle message list
- `.email-body-panel`, `.email-body-content` — right reading pane
- `.email-loading`, `.email-error`, `.email-body-placeholder` — state indicators

#### Email IMAP Backend (`main.js`)
- Added `getEmailCreds()` helper — decrypts and returns full email config
- Added `imapConnect(host, port, user, pass, tls)` — returns a connected IMAP client promise; 10s timeout; `rejectUnauthorized: false` for self-signed certs
- IPC `email-folders` — connects IMAP, calls `getBoxes('')`, walks nested mailbox tree recursively, returns flat `{ name, path, delimiter, attribs }[]`; disconnects after
- IPC `email-messages` — opens folder, fetches `HEADER.FIELDS (FROM TO SUBJECT DATE)` for newest 50 messages via seq range; returns `{ seqno, uid, from, to, subject, date }[]` newest-first
- IPC `email-message-body` — fetches full message by UID; uses `mailparser.simpleParser` if available, falls back to raw text; returns `{ html, text, from, to, subject, date }`
- IPC `email-test` — connects and immediately disconnects; used by Settings Test button to verify credentials before saving
- IPC `email-config-save` — saves full config `{ email, password, host, port, tls }` as single encrypted blob (replaces old `email-creds-save` which only stored email+password)
- IPC `email-config-load` — decrypts and returns full config
- All handlers wrapped in try/catch; errors returned as `{ ok: false, error }` — no unhandled rejections
- **Dependency note**: requires `npm install imap mailparser` in project root

#### Email Settings (`index.html`)
- Replaced placeholder email section with full IMAP config form: Email · Password · IMAP Host · Port · TLS toggle
- **Save** button → `saveEmailConfig()` — validates all required fields, calls `emailConfigSave`
- **Test** button → `testEmailConfig()` — calls `emailTest` with live form values, shows result inline
- **Clear** button → `clearEmailCreds()` — wipes all fields and encrypted store
- `loadEmailCredsToUI()` now populates host/port/TLS fields from saved config
- Helper tips for common providers (Gmail, Outlook, Yahoo) shown below form

#### Preload (`preload.js`)
- Added: `emailConfigSave`, `emailConfigLoad`, `emailTest`, `emailFolders`, `emailMessages`, `emailMessageBody`
- Retained: `emailCredsSave`, `emailCredsLoad`, `emailCredsClear` (legacy channels still handled by `main.js`)

#### Files Changed
- `main.js` — IMAP handlers added
- `preload.js` — 6 new email IPC bridges
- `index.html` — email-view HTML/CSS/JS, nav overhaul, settings update
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Fix — Email Settings: SMTP Fields + Password Retention

#### Added — Outgoing Mail (SMTP) Settings
- Added SMTP sub-section below IMAP in the Email Account settings block
- Fields: SMTP Host, Port (default 587), STARTTLS toggle
- Single shared password for both IMAP and SMTP (one App Password covers both)
- `saveEmailConfig()` now includes `smtpHost`, `smtpPort`, `smtpTls` in the encrypted blob
- `loadEmailCredsToUI()` now restores all SMTP fields on Settings open
- `clearEmailCreds()` now also clears SMTP host/port fields
- Provider reference table updated: Gmail · Outlook · Yahoo — IMAP and SMTP ports side by side

#### Fixed — Password Not Retained After Save
- **Root cause:** `saveEmailConfig()` was clearing the password field after a successful save (pattern copied from Appfolio creds where the password should stay hidden)
- **Fix:** Removed `document.getElementById('email-creds-pass').value = ''` from save handler
- `loadEmailCredsToUI()` now also restores the password field from the decrypted config so reopening Settings always shows the full saved state

#### Files Changed
- `index.html` — Settings HTML (SMTP block), `saveEmailConfig`, `loadEmailCredsToUI`, `clearEmailCreds`
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Fix & Feature — SMTP, Nav Style, Titlebar, Settings in Overlay Views

#### SMTP Backend (`main.js`)
- Added IPC `email-test-smtp` — creates a `nodemailer` transporter, calls `verify()`, returns `{ ok, error }`; port 465 = implicit TLS, port 587 = STARTTLS
- Added IPC `email-send` — reads saved config, creates transporter, sends via `sendMail`; returns `{ ok, messageId, error }`
- **Dependency note**: requires `npm install nodemailer` (alongside existing `npm install imap mailparser`)

#### SMTP Preload (`preload.js`)
- Added `emailTestSmtp(config)` → `email-test-smtp`
- Added `emailSend(opts)` → `email-send`

#### Settings — Email Section (`index.html`)
- **Password retention fix**: `saveEmailConfig()` no longer clears password field; `loadEmailCredsToUI()` populates password from saved config so it re-appears when Settings reopens
- **Test SMTP button** added alongside Test IMAP — calls `testEmailConfig('smtp')` with SMTP-specific fields
- `testEmailConfig(protocol)` — accepts `'imap'` or `'smtp'` arg; reads correct host/port/tls fields for each; shows protocol-specific status message
- Button row uses `flex-wrap:wrap` so 4 buttons fit on smaller settings panels

#### Titlebar in Overlay Views (`index.html`)
- Added `<div class="titlebar">HALQ — Maintenance Command ⚙ Settings</div>` inside both `#email-view` and `#notes-view` — consistent app identity across all 3 views
- Email view: titlebar sits above topbar nav tabs
- Notes view: titlebar sits above topbar nav tabs

#### Buttons — Email & Notes Topbar
- **Email topbar**: removed Refresh button — Settings is now accessible via titlebar ⚙ button
- **Notes topbar**: removed Cleanup button — Settings is now accessible via titlebar ⚙ button
- Cleanup is still callable via JS (`ntCleanupOrphans()`) if needed from console

#### Nav Style applies to all views
- `toggleNav()` stores `window._navMode` — available for future overlay-view nav surface switching
- Overlay views (Email, Notes) always show their topbar tabs regardless of WO nav style (topbar IS the nav in those views); WO nav style is restored correctly when switching back from an overlay

#### Files Changed
- `main.js` — SMTP test + send handlers
- `preload.js` — 2 new SMTP bridges
- `index.html` — titlebar in overlays, Settings buttons, SMTP test button, password retention fix
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Fix — Settings z-index, Nav Style Persistence, Auth Error Messages

#### Settings Overlay — z-index Fix
- `.settings-overlay` raised from `z-index: 100` to `z-index: 10000`
- Root cause: `#email-view` and `#notes-view` are `z-index: 100` fixed overlays; settings panel rendered behind them, making ⚙ Settings appear to do nothing when Email or Notes view was active
- Settings now correctly opens on top of all views from any tab

#### Nav Style — Persist & Restore
- `setNavOpt()` now calls `window.halq.settingsSave({ navStyle: mode })` on every change
- `loadAppSettings()` now reads `s.navStyle` on startup, calls `toggleNav(mode)`, and marks the correct `.layout-option` button active in the Settings Appearance tab
- Nav style choice now survives app restarts and is consistent across all views

#### Microsoft 365 / Outlook SMTP Auth Error — Actionable Message
- Added `friendlyAuthError(err, protocol)` helper in `main.js`
- Detects `SmtpClientAuthentication is disabled` / `smtp_auth_disabled` (Microsoft 365 tenant policy) and returns a clear fix guide:
  - IT admin path: `admin.microsoft.com → Users → Active users → Mail → Manage email apps → Authenticated SMTP`
  - App Password alternative noted
  - OAuth2 roadmap note
- Also detects: IMAP basic auth disabled (M365), Gmail App Password required, generic 535 auth failure
- Applied to `email-test`, `email-test-smtp`, `email-folders`, `email-messages` handlers
- `.email-error` CSS updated: `white-space: pre-wrap` so multi-line instructions render correctly

#### Files Changed
- `main.js` — `friendlyAuthError` helper; applied to all email IPC handlers
- `index.html` — settings z-index fix; nav style persist+restore; `.email-error` pre-wrap CSS
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Architecture Fix — Email & Notes moved inside .app (no more floating overlays)

**Root cause of all UI inconsistency:** Email and Notes were `position:fixed; z-index:100` overlays that floated *on top of* the entire app. This meant they had their own titlebar, their own nav tabs, their own chrome — disconnected from the sidebar, top-nav, section-tabs, and bottombar that WO uses. Any style change to WO nav didn't affect the overlays at all.

**Fix — all three views now live inside `.app → .main → .content`:**
- WO: `#panel-layout` (unchanged, always was here)
- Email: `#email-panel` — new `div.view-panel` inside `.content`
- Notes: `#notes-panel` — new `div.view-panel` inside `.content`, Notes body-wrap moved in via `ntRenderInPanel()` on first switch

**`switchMainView()` rewritten:**
- Shows/hides `#panel-layout`, `#email-panel`, `#notes-panel` via `display` toggle (flex/none)
- Updates `#topbar-title` text ("Work Orders" / "Email" / "Notes")
- Updates `#topbar-actions` with view-appropriate buttons (WO gets Refresh, Email gets Refresh, Notes gets nothing)
- All sidebar, top-nav, section-tab active states still synced exactly as before

**`ntRenderInPanel()` added:**
- Notes 3-panel body (`notes-body-wrap`) lives in a hidden `#notes-body-wrap-template` div until first switch to Notes
- On first call: moves all children into `#notes-panel`, then calls `ntInit()` as before
- Subsequent calls: just calls `ntInit()` (content already in place)

**Removed:**
- `#email-view` floating overlay div and all its chrome (titlebar, topbar tabs, email-topbar CSS)
- `#notes-view` floating overlay div and its titlebar/topbar nav tabs
- `.notes-view`, `.email-view` CSS rules (now dead)
- `notes-topbar`, `email-topbar` CSS and HTML (redundant — the shared WO topbar now serves all views)

**Result:** Sidebar, titlebar, top-nav, section-tabs, bottombar — all shared by WO, Email, and Notes identically. Nav style setting applies once and works everywhere.

#### Files Changed
- `index.html` — architecture rewrite (no JS logic changes in main.js or preload.js)
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Feature — Email switched to Outlook Web embedded (webview)

**Decision:** Microsoft 365 tenant policy blocks IMAP/SMTP basic auth and Azure AD app registration requires admin access. Solution: embed `outlook.office.com` in a webview using the same pattern as Appfolio.

#### What changed
- `#email-panel` now contains a full `<webview>` pointing to `https://outlook.office.com/mail`
- Session: `partition="persist:outlook"` — user logs in once via the Outlook web interface; session persists across app restarts (cookies/session stored in `userdata/session/`)
- Tab bar, toolbar (back/forward/reload/URL/Go), and all navigation mirrors the Appfolio panel exactly
- `emInit()` wires webview events: `did-navigate`, `did-navigate-in-page`, `did-start-loading`, `did-stop-loading`, `new-window`
- `emAddTab()`, `emCloseTab()`, `emSwitchToTab()`, `emScrollTabs()` — identical pattern to Appfolio tab functions
- `emRefresh()` calls `view.reload()` — hooked to topbar Refresh button

**`main.js`:**
- Added `OUTLOOK_PARTITION = 'persist:outlook'` constant
- Added `setupOutlookSession()` — registers permission handlers and `webRequest.onBeforeRequest` for the outlook partition (same as `setupAppfolioSession`)
- `setupOutlookSession()` called in `app.whenReady()`

**Removed (dead code cleanup):**
- All IMAP email CSS (`.email-topbar`, `.email-folder-panel`, `.email-msg-panel`, `.email-body-panel`, `.email-error`, etc.)
- All IMAP JS functions (`emLoadFolders`, `emSelectFolder`, `emOpenMessage`, `emFolderIcon`, `emEsc`, `emParseFrom`, `emFormatDate`, etc.)
- IMAP state variables (`emInitDone`, `emCurrentFolder`, `emCurrentUid`, `emMessages`)

**How to use:** Click Email tab → Outlook Web loads → sign in with your Microsoft 365 account → stays signed in permanently.

#### Files Changed
- `main.js` — `OUTLOOK_PARTITION`, `setupOutlookSession()`
- `index.html` — email panel HTML replaced with webview; email JS replaced; dead CSS removed
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Cleanup — Removed all dead IMAP/SMTP code

#### `main.js`
- Removed entire `EMAIL — IMAP BACKEND` section (~230 lines): `getEmailCreds`, `imapConnect`, `friendlyAuthError`, `email-folders`, `email-messages`, `email-message-body`, `email-test`, `email-config-save`, `email-config-load`, `email-test-smtp`, `email-send`
- Removed `email-creds-save` and `email-creds-load` handlers (no longer needed)
- Kept `email-creds-clear` + `EMAIL_CRED_PATH` — sole purpose: lets users wipe any `email-creds.enc` file left over from previous sessions

#### `preload.js`
- Removed: `emailCredsSave`, `emailCredsLoad`, `emailConfigSave`, `emailConfigLoad`, `emailTest`, `emailFolders`, `emailMessages`, `emailMessageBody`, `emailTestSmtp`, `emailSend`
- Kept: `emailCredsClear` — wires to the `email-creds-clear` handler above

#### `index.html`
- Removed Settings HTML: entire IMAP host/port/TLS, SMTP host/port/TLS, Test IMAP, Test SMTP, Save, Clear buttons
- Replaced with a single info note: "Email is accessed via the Outlook Web tab. Sign in directly in the Email view."
- Removed JS functions: `saveEmailConfig`, `testEmailConfig`, `clearEmailCreds`, `loadEmailCredsToUI` (~84 lines)
- Removed all `loadEmailCredsToUI()` call sites from `openSettings`

#### Files Changed
- `main.js` — dead IMAP/SMTP handlers removed
- `preload.js` — dead IPC bridges removed
- `index.html` — dead settings HTML + JS removed
- `CHANGELOG.md` — this entry

---

### [2026-03-06] Cleanup Pass 2 — Final email dead code removal

#### `main.js`
- Removed `EMAIL CREDENTIALS — cleanup only` block (`EMAIL_CRED_PATH`, `email-creds-clear` handler) — handler was never called from UI

#### `preload.js`
- Removed `emailCredsClear` bridge — `email-creds-clear` IPC handler no longer exists

#### `index.html`
- Removed stale `/* EMAIL VIEW */` CSS comment block (vestige of old overlay architecture)
- Removed orphan `<!-- EMAIL VIEW -->` HTML comment incorrectly placed inside the Notes section

**Net:** 4,841 → 4,816 lines. No email-related dead code or stale comments remain in any file.

---

### [2026-03-06] Fix — WO Selection Bug (Wrong Row Highlighted)

**Bug:** Clicking a WO card highlighted the wrong row. For example, clicking WO `49670-1` would highlight `49706-1`. Clicking the first WO loaded the correct URL but highlighted the bottom card.

**Root cause:** `woCard` passed `wos.indexOf(w)` as the index, and `selectWO(i)` highlighted by matching against `querySelectorAll('.wo-item')` DOM index. When filters were active, DOM indices (visible rows only) didn't match array indices (full `wos[]`), so the wrong card lit up.

**Fix — event delegation + `data-wo` matching:**
- Removed all inline `onclick="selectWO(...)"` from `woCard` — no more string escaping of WO numbers in HTML attributes
- Each `.wo-item` carries only `data-wo="${w.wo}"` (e.g. `data-wo="49670-1"`)
- After `list.innerHTML = html`, a loop wires `addEventListener('click', () => selectWO(el.dataset.wo))` on every rendered card — exact DOM reference, no string parsing
- `selectWO(woNum)` finds the WO with `wos.find(w => w.wo === woNum)` and highlights with `el.classList.toggle('active', el.dataset.wo === woNum)` — correct regardless of filtering or section grouping

#### Files Changed
- `index.html` — `woCard`, `renderWOList`, `selectWO`

---

### [2026-03-06] Fix — `Identifier 'woNum' has already been declared` Syntax Error

**Root cause:** `selectWO(woNum)` declared `woNum` as its parameter, and the function body also contained `const woNum = selectedWO.wo.split('-')[0]` — a duplicate declaration in the same scope, which JavaScript rejects.

**Fix:** Renamed the inner variable to `woSearch` (more descriptive — it's the stripped WO number used for the Appfolio search URL).

#### Files Changed
- `index.html` — `selectWO` inner variable renamed `woNum` → `woSearch`

---

### [2026-03-06] Audit — Full Dead Link & Consistency Check (All 3 Files)

Full cross-file audit pass across `index.html`, `main.js`, and `preload.js`. All checks passed with no broken references.

**Checks performed:**
- All `onclick` function names → confirmed defined as JS functions (72 functions, 0 missing)
- All `window.halq.*` calls in `index.html` → confirmed exposed in `preload.js` (27 methods, 0 missing)
- All `ipcRenderer.invoke` channels in `preload.js` → confirmed handled by `ipcMain.handle` in `main.js` (26 channels, 0 missing)
- All `ipcMain.handle` channels in `main.js` → confirmed called from `preload.js` (0 orphan handlers)
- All `getElementById` call targets → confirmed present in HTML or dynamically created and null-guarded
- No duplicate function declarations
- No duplicate top-level `const`/`let` declarations
- `switchMainView` correctly shows/hides all 3 panels (`#panel-layout`, `#email-panel`, `#notes-panel`)
- `afBaseUrl` initialization chain confirmed: `loadAppSettings` → `applyAppfolioUrl` → `afBaseUrl` set before any WO click
- No remaining IMAP/SMTP/email dead code anywhere

**Known dead functions (not broken, just unreachable from UI):**
- `ntCleanupOrphans()` — defined, no call site (cleanup button was removed from Notes topbar); still callable from DevTools console
- `ntImport()` — defined, no call site; import flow was removed from Notes UI
- `excelImport` in `preload.js` + `excel-import` handler in `main.js` — defined, never called from `index.html`; import flow removed when macro bar was removed

These are harmless and retained in case the features are re-exposed.

---

## Session 3 — 2026-03-09

---

### [2026-03-09] Fix — Functional Gaps & Preference Wiring

#### `index.html`

**Filter chips — Urgent**
- `toggleChip` was filtering by `w.tag === 'Urgent'` — a field that does not exist on WO objects loaded from Excel. Filter always returned empty.
- Fixed to match WOs whose assigned category has the name `"urgent"` (case-insensitive): `getCatById(w._catId)?.name.toLowerCase() === 'urgent'`
- Works automatically with any category the user names "Urgent" in the Category Manager.

**Filter chips — Due Today**
- Was filtering `w.age === 0` — age is an integer from Excel, so same-day WOs could have age 1 depending on when the formula runs.
- Changed to `w.age <= 1` to reliably catch new WOs.

**Preference toggle — Color Code WOs**
- `getAgeClass()` and `getItemClass()` now check the `#pref-color-code` toggle state at render time.
- When the toggle is off: WO items render with no age-based color classes (no red/yellow/green borders or age badges).
- `togglePref()` extended: flipping `colorCodeWOs` now calls `renderWOList()` immediately so the change is visible without a reload.

**Preference toggle — Auto-search on WO Click**
- `selectWO()` now reads the `#pref-auto-search` toggle before firing the Appfolio URL search.
- When off: clicking a WO opens the detail drawer but does not navigate the Appfolio webview.

**Theme persistence**
- `setTheme()` now calls `window.halq.settingsSave({ theme })` on every change.
- `loadAppSettings()` extended: if `s.theme` is set, applies `data-theme` attribute to `<body>` and marks the correct `.theme-option` active.
- Theme now survives app restarts.

**Layout mode persistence**
- `setLayoutOpt()` now calls `window.halq.settingsSave({ layoutMode: mode })` on every change.
- `loadAppSettings()` extended: if `s.layoutMode` is set, calls `toggleLayout()` and marks the correct `.layout-option` active (distinguished from nav-style options by checking for `setLayoutOpt` in the `onclick` attribute).
- Layout mode now survives app restarts.

---

### [2026-03-09] Fix — Minor Issues

#### `index.html`

**Duplicate email reload functions**
- `emNavReload()` and `emRefresh()` were identical (`emGetView()?.reload()`).
- Removed `emNavReload`. The email toolbar reload button updated to call `emRefresh()` directly (already the canonical function used by the topbar Refresh button).

**`confirm()` dialogs in Notes delete — replaced with custom modal**
- `ntDelete()` used three native `confirm()` calls (notebook, section, page). Native `confirm` is blocked/unreliable in Electron.
- Added `ntConfirm(msg)` — a Promise-based helper using the same overlay pattern as the existing `ntPrompt`.
- Added `ntConfirmOK()` and `ntConfirmCancel()` handler functions.
- Added `#nt-confirm-overlay` modal HTML (reuses `.nt-prompt-overlay` / `.nt-prompt-box` CSS; Delete button styled red).
- All three `confirm()` calls in `ntDelete` replaced with `await ntConfirm(...)`.

---

### [2026-03-09] Cleanup — Dead Code Removal

#### `index.html`
- Removed `ntCleanupOrphans()` — no UI call site; was only accessible via DevTools console. Backend `notes-cleanup` IPC handler in `main.js` retained and still invokable if needed.
- Removed `ntImport()` — no UI call site; import flow had been removed from Notes UI. Backend `notes-import` IPC handler and all its logic in `main.js` retained.

#### `preload.js`
- Removed `excelImport` bridge (`ipcRenderer.invoke('excel-import', filePath)`) — never called from `index.html`. Backend `excel-import` handler in `main.js` retained.

#### Files Changed
- `index.html` — all fixes, minor repairs, and dead function removals above
- `preload.js` — `excelImport` bridge removed
- `main.js` — no changes
- `CHANGELOG.md` — this entry

---

## Session 4 — 2026-03-09

---

### [2026-03-09] Feature — HALQ Launcher (Multi-Profile UI)

New standalone launcher UI designed and previewed as a React artifact (`launcher-preview.jsx`). Full Electron implementation is the next milestone.

**Launcher features (preview):**
- Profile cards showing name, Appfolio URL, color avatar, and running state
- Per-card ▶ Launch / ↗ Focus button
- Per-card ⋮ menu: Edit Profile, Delete Profile
- New Profile modal: name, Appfolio URL, color picker
- Edit Profile modal with pre-filled values
- Delete Profile confirmation modal
- Custom checkbox per card with Select All (three-state: unchecked / indeterminate / checked)
- **Launch Selected** — launches only checked profiles that are not yet running; shows count badge; disabled when all selected are already running
- **Launch All** — launches every profile not yet running; disabled when all are running
- Running state pill with animated green dot
- Bottom status bar showing last action and clock
- Fully matches HALQ dark theme (same CSS variables, JetBrains Mono, Inter)

**Architecture plan documented (README.md):**
- Each profile gets `userdata/profiles/<id>/` with its own `creds.enc`, `settings.json`, `wo-tags.json`, `notes/`, and isolated Electron session partitions (`persist:appfolio-<id>`, `persist:outlook-<id>`)
- HALQ main app will accept `--profile=<id>` CLI argument so multiple instances can run simultaneously with completely isolated data

#### Files Changed
- `launcher-preview.jsx` — new file, launcher UI preview

---

### [2026-03-09] Feature — Auto-Updater (asar-swap)

Lightweight update system that lets new versions be pushed to all users without redistributing the installer. Uses HTTPS to fetch a `version.json` manifest from GitHub, downloads a new `app.asar`, swaps it in place, and relaunches.

#### `main.js`
- Added `const APP_VERSION = '1.0.0'` — bump this on every release
- Added `const UPDATE_URL` — points to `releases/` folder in GitHub repo (replace `YOUR_USERNAME`)
- Added `httpsGet(url)` — Promise-based HTTPS GET with redirect following
- Added `httpsDownload(url, destPath)` — Promise-based binary download with redirect following
- Added `isNewer(local, remote)` — semver comparison, returns true if remote > local
- Added IPC handler `update-check` — fetches `version.json`, returns `{ available, version, asarUrl, notes }` or `{ available: false }`
- Added IPC handler `update-download` — downloads new `app.asar` to `.update` temp file, swaps atomically (live → `.bak`, download → live), returns `{ ok }`
- Added IPC handler `update-restart` — calls `app.relaunch()` + `app.exit(0)`
- Added IPC handler `update-version` — returns current `APP_VERSION` string

#### `preload.js`
- Exposed four updater channels: `updateCheck`, `updateDownload`, `updateRestart`, `updateVersion`

#### `index.html`
- Added `.update-banner` CSS — fixed-position toast above bottom bar, slide-up animation, themed to match app
- Added `#app-version-label` to sidebar logo `div` — populated at runtime with live version
- Added `#update-banner` HTML — shows new version label, optional release notes, Install & Restart button, Dismiss button, download progress text
- Added `checkForUpdate()` — called 3 seconds after startup; fetches version, updates sidebar label, shows banner if newer version available
- Added `updateInstall()` — triggers download, shows progress, calls restart on success
- Added `updateDismiss()` — hides banner without installing
- `waitForHalq` block: added `setTimeout(checkForUpdate, 3000)` — non-blocking, fires after app is fully loaded

**Update flow:**
1. Edit source files → bump `APP_VERSION` in `main.js`
2. `npm run build` → copy `dist/win-unpacked/resources/app.asar` → `releases/app.asar`
3. Update `releases/version.json` with new version + notes
4. `git push` → all running instances see update within 3 seconds of next launch

**Alternatively (no recompile):** repack manually with `asar pack` for UI-only changes. See README.

#### Files Changed
- `main.js` — updater constants + 4 IPC handlers added
- `preload.js` — 4 updater bridge methods added
- `index.html` — banner CSS/HTML + `checkForUpdate`, `updateInstall`, `updateDismiss` JS

---

### [2026-03-09] Docs & Infrastructure — README + Git Setup

#### New files
- `README.md` — full project documentation covering: project structure, dev setup, `package.json` template, running in dev mode, building the exe, auto-updater release workflow, multi-profile architecture plan, Git workflow (initial push, day-to-day, release commits, branching), and file reference table
- `.gitignore` — excludes `node_modules/`, `userdata/`, `dist/`, `out/`, `build/`, `*.asar.update`, `*.asar.bak`, OS files, editor files
- `releases/version.json` — update manifest template; hosted in `releases/` folder on GitHub
- `CHANGELOG.md` — this entry

#### Repository
- Remote: `https://github.com/BossArQue/HALQ-Maintenance.git`
- Branch: `main`
- Initial push includes all source files and documentation
---

## Session 5 — 2026-03-09

---

### [2026-03-09] Feature — Multi-Profile Full Implementation

#### Architecture
- All HALQ data is now scoped to `userdata/profiles/<profileId>/`
- Each profile gets its own: `creds.enc`, `pin.enc`, `settings.json`, `wo-tags.json`, `categories.json`, `notes/`, `session/`, `electron/`
- Appfolio and Outlook session partitions scoped per profile: `persist:appfolio-<id>`, `persist:outlook-<id>`
- Shared across all profiles: `userdata/profiles.json` (profile registry)

#### `main.js` — Profile scoping
- Added `BASE_DIR = userdata/`, `PROFILES_DB = userdata/profiles.json`
- Added `--profile=<id>` CLI arg parsing; falls back to `'default'` if not supplied
- `USER_DATA_DIR` now resolves to `userdata/profiles/<PROFILE_ID>/`
- `app.setPath('userData')` and `app.setPath('sessionData')` scoped per profile
- `AF_PARTITION` / `OUTLOOK_PARTITION` constants moved to top, scoped as `persist:appfolio-<id>` / `persist:outlook-<id>`
- `createWindow()`: reads `profiles.json` to get display name → sets window title to `HALQ — <name>`; passes `--halq-profile=<id>` via `additionalArguments`
- Added `UPDATE_URL` corrected to `https://raw.githubusercontent.com/BossArQue/HALQ-Maintenance/main/releases`
- Added `profile-info` IPC handler: returns `{ id, name, color }` from profiles.json

#### `preload.js`
- Added `profileInfo()` bridge → `ipcRenderer.invoke('profile-info')`

#### `index.html`
- Sidebar logo: added `#profile-badge` — shows profile name with profile color when running in a non-default profile
- Added `loadProfileInfo()` function: fetches `profileInfo`, styles and shows the badge
- `waitForHalq` block: calls `loadProfileInfo()` on startup

---

### [2026-03-09] Feature — HALQ Launcher (Real Electron App)

Three new files: `launcher/main.js`, `launcher/preload.js`, `launcher/index.html`

#### `launcher/main.js`
- Reads/writes `userdata/profiles.json` (shared registry)
- Tracks running processes in a `Map<profileId, {pid}>` with `isAlive(pid)` check
- `launchProfile(id)`: spawns `electron . --profile=<id>` (dev) or `HALQ.exe --profile=<id>` (prod), detached + unref'd
- IPC handlers: `profiles-load` (annotates with running state), `profiles-save`, `profile-launch`, `profile-running-state`, `profile-delete-data`
- Polls every 5s, pushes `running-state-update` event to renderer
- Window: 520×620, non-resizable below 420×480, menu bar hidden

#### `launcher/preload.js`
- Exposes `window.launcher`: `profilesLoad`, `profilesSave`, `profileLaunch`, `profileRunningState`, `profileDeleteData`, `onRunningUpdate`

#### `launcher/index.html`
- Full UI converted from React JSX preview to pure HTML/CSS/JS — zero dependencies
- Profile cards: avatar (initials + color), name, Appfolio URL, running pill with animated dot
- Per-card ▶ Launch / ↗ Focus button (Focus when already running)
- Per-card ⋮ kebab menu: Edit Profile, Delete Profile
- Select-all checkbox (three-state: unchecked / indeterminate / all-checked)
- Launch Selected (only shown when ≥1 checked; badge shows count of not-yet-running; disabled if all selected are running)
- Launch All (disabled when all profiles running)
- New Profile modal: name, Appfolio URL, 8-color picker
- Edit Profile modal: pre-filled with existing values
- Delete Profile confirmation modal: warns about permanent data loss
- Live running-state updates: `onRunningUpdate` subscription refreshes cards every 5s
- Bottom status bar: animated green dot when any profile running, status message, clock
- All profile saves call `persistProfiles()` which strips `running` flag before writing

#### Files Changed
- `main.js` — profile scoping, profile-info IPC, corrected UPDATE_URL, exec → execFile import
- `preload.js` — profileInfo bridge added
- `index.html` — profile badge in sidebar, loadProfileInfo() added
- `launcher/main.js` — new file
- `launcher/preload.js` — new file
- `launcher/index.html` — new file
- `package.json` — new file: npm scripts, electron-builder config, both entry points
- `CHANGELOG.md` — this entry

---

## Session 6 — 2026-03-11

---

### [2026-03-11] UI — Compact Single-Row Titlebar (Top Bar & Tabs nav modes)

**Files changed:** `index.html`

**Problem:** In Top Bar and Tabs nav modes, three separate rows consumed vertical space:
- Row 1: Titlebar (HALQ — Maintenance Command + ⚙ Settings)
- Row 2: Top Nav or Section Tabs (tab strip)
- Row 3: Topbar (section title + Refresh button)

**Fix:** For Top Bar and Tabs modes only, all three rows collapse into a single 40px row.

**Layout:** `[📋 Work Orders | ✉ Email | 📝 Notes]  HALQ — Maintenance Command  [↻ Refresh] [⚙ Settings]`

**Implementation:**
- Added `body.nav-compact` CSS class — applied by `toggleNav()` when mode is `topnav` or `tabs`
- `body.nav-compact` hides standalone `top-nav`, `section-tabs`, and `topbar` rows via `display:none !important`
- Added `.tb-inline-nav` groups inside titlebar HTML: `#tb-inline-topnav` (pill-style) and `#tb-inline-tabs` (underline-style)
- Added `#tb-refresh` button inside titlebar `tb-controls` — only visible when `nav-compact` is active
- `toggleNav()` updated: sets `nav-compact` on body, shows correct `tb-inline-nav` group, shows/hides refresh button
- `switchMainView()` updated: syncs active state on both standalone and inline tab elements (`tb-topnav-*`, `tb-sectab-*`)
- Left Sidebar and Hidden modes: completely unaffected, no changes to their behavior

---

### [2026-03-11] UI — Category Color Strips on WO Cards

**Files changed:** `index.html`

**Change:** Replaced the small color dot next to WO cards with a full-width labeled color strip at the bottom of each card.

- Strip height: 16px, border-radius: 3px
- Category name printed inside the strip in uppercase bold dark text
- Multiple categories = multiple equal-width strips side by side (e.g. `|--For Approval--|--BH Properties--|`)
- Single category = full-width strip (e.g. `|------------HVAC Issue------------|`)
- Strip color still comes from the color assigned in Category Manager

---

### [2026-03-11] Feature — Multi-Select Categories

**Files changed:** `index.html`

**Change:** Category assignment upgraded from single-select dropdown to multi-select checkbox list.

- Category dropdown now stays open after each selection (supports picking multiple)
- Each category row shows a checkbox (✓ when selected)
- "Clear all" removes all assigned categories at once
- Data model migrated: `_catId` (single ID) → `_catIds` (array of IDs)
- Full backward compatibility: existing saved `_catId` values are automatically migrated to `_catIds: [id]` on load
- `selectedCatIds[]` replaces `selectedCatId` throughout: `selectCat()`, `saveWODetail()`, `selectWO()`, `renderCatDropdown()`
- `updateCatTrigger()` — new helper, updates the trigger display for multiple selections (color dots + comma-separated names)
- Urgent filter updated to check `_catIds` array

---

### [2026-03-11] UI — Bold Week Section Dividers on WO List

**Files changed:** `index.html`

**Change:** Section dividers between WO groups (Due/No Date, This Week, Next Week, etc.) made significantly more prominent.

- Thicker top border (`2px solid var(--border2)`)
- Sticky positioning — header stays visible while scrolling within a section
- Blue accent left bar (3×12px) inside each header
- Count shown as a pill badge (rounded, bordered) instead of plain text
- Background matches surface color for visual separation from card rows

---

## Session 7 — 2026-03-17

---

### [2026-03-17] Fix — Compact Titlebar (Top Bar & Tabs nav modes) — Rewrite

**Files changed:** `index.html`

**Problem:** The Session 6 implementation of the compact single-row titlebar was broken. The uploaded source file contained orphaned CSS from a prior partial attempt (`#tb-inline-topnav`, `#tb-inline-tabs`, `.tb-inline-nav-item`, `.tb-inline-tab-item`) with no matching HTML elements. A second implementation was layered on top, causing conflicts — `body.nav-compact` was hiding `.topbar` regardless of nav mode, so the topbar disappeared even in Left Sidebar mode.

**Root cause:** Session 6 code was written against a different version of the file than what was actually deployed. The ghost CSS was never cleaned up.

**Fix — clean rewrite from original source:**

- Removed all orphaned Session 6 CSS (`#tb-inline-topnav`, `#tb-inline-tabs`, `.tb-inline-nav-item`, `.tb-inline-tab-item`)
- Single unified inline nav structure: `.tb-inline-nav` container with three `.tb-nav-item` elements (`#tb-nav-wo`, `#tb-nav-email`, `#tb-nav-notes`)
- `body.nav-compact` applied **only** when `mode === 'topnav' || mode === 'tabs'` — never for `sidebar` or `none`
- `toggleNav()` — single `classList.toggle('nav-compact', ...)` call handles both apply and remove
- `setNavOpt()` — `none` branch explicitly calls `classList.remove('nav-compact')`
- `switchMainView()` — tracks `window._currentView`; syncs `.tb-nav-*` active states; hides `#tb-refresh` when on Notes
- `_tbRefresh()` — new helper routing inline Refresh to `emRefresh()` or `navReload()` based on `window._currentView`
- Left Sidebar and Hidden modes: completely unaffected
---

## Session 8 — 2026-03-19

---

### [2026-03-19] Fix — Appfolio Advanced Search URL scoped to Work Orders

**Files changed:** `index.html`

**Problem:** Auto-search and "Open in Appfolio" were firing a full-site search, returning results across all Appfolio record types.

**Fix:** Added `&section_keys=work_orders` to both search URL builders so results are scoped to Work Orders only.

- `setWO()` auto-search URL: `${afBaseUrl}/search/advanced_search?full_text_search=${woSearch}&section_keys=work_orders`
- `openInAppfolio()` URL: `${afBaseUrl}/search/advanced_search?full_text_search=${woNum}&section_keys=work_orders`

---

### [2026-03-19] Fix — Follow-up Date: Weekend Skip for Tomorrow and Next Day

**Files changed:** `index.html`

**Problem:** "Tomorrow" and "Next Day" follow-up options used raw +1/+2 calendar days, landing on Saturday or Sunday in edge cases (e.g. Friday → Saturday, Thursday → Saturday).

**Fix:** Replaced raw date math with business-day-aware helpers.

- Added `skipWeekend(d)` — advances Sat to Mon (+2), Sun to Mon (+1), weekdays unchanged
- Added `nextBizDay(d)` — returns the first business day after `d` (always skips weekends)
- Added `nextNextBizDay(d)` — returns the business day after `nextBizDay(d)` (two hops, each weekend-aware)
- **Tomorrow** now uses `nextBizDay(today)`: Fri → Mon, Thu → Fri, Wed → Thu
- **Next Day** now uses `nextNextBizDay(today)`: Fri → Tue, Thu → Mon, Wed → Fri
- Both `initFollowupDates()` (display labels) and `setFollowup()` (actual date assignment) updated to use the new helpers

**Examples:**

| Today | Tomorrow | Next Day |
|-------|----------|----------|
| Thursday | Friday | Monday |
| Friday | Monday | Tuesday |
| Saturday | Monday | Tuesday |

---

### [2026-03-19] Fix — Follow-up Custom Date: Auto-open Calendar on Click

**Files changed:** `index.html`

**Problem:** Clicking "Custom" expanded the date input row but required a second click on the input to open the calendar picker.

**Fix:** `setFollowup('custom')` now calls `inp.showPicker()` immediately after opening the row and focusing the input — calendar opens on the first click.

---

### [2026-03-19] Feature — Auto Due Date on New Work Orders

**Files changed:** `index.html`

**Behavior:** When the WO list is refreshed and a WO has no entry in `woTags` (never seen before in HALQ) and its age is ≤ 2 business days old, HALQ silently auto-assigns a follow-up due date of **today + 3 business days**, weekend-skipping included.

**Detection logic:**
- "New" = not present in `woTags` AND business-day age ≤ 2
- Business-day age is computed by `calendarAgeToBizDays(w.age)` — counts only Mon–Fri between creation date and today, so a WO created Friday evening and first seen Monday = 1 business day old (not 3 calendar days)
- This correctly handles weekend edge cases: Sat/Sun creation dates count as 0 business days until Monday

**Why business days, not calendar age:** A WO created Friday evening and checked Monday is 3 calendar days old but only 1 business day old — it would be incorrectly skipped by a raw day threshold. Business-day counting gives a reliable 2-day window regardless of weekends.

**Implementation:**
- Added `calendarAgeToBizDays(calendarAge)` — walks day-by-day from `(today - age)` to today, counting only weekdays
- Added `autoTagNewWOs()` — iterates all loaded WOs; if not in `woTags` and biz age ≤ 2, computes `today + 3 biz days` and writes to `woTags[w.wo]._followup`; calls `saveWOTags()` if any were tagged
- `loadExcelData()` calls `autoTagNewWOs()` before re-applying saved tags, so auto-assigned dates are persisted immediately
- Silent — no visual indicator shown to the user

---

### [2026-03-19] Feature — Category Manager: Drag-and-Drop Sort

**Files changed:** `index.html`

**Behavior:** Categories in the Category Manager modal can be reordered by dragging rows up or down. The drag handle (⠿) on the left of each row is the grab target. Order is persisted immediately to `categories.json`.

**Implementation:**
- Each category row renders with `draggable="true"` and a `⠿` handle icon
- `initCatDrag()` attaches `dragstart`, `dragend`, `dragover`, `dragleave`, `drop` listeners to all rows after each render
- On drop: finds `fromIdx` and `toIdx` in the `categories` array by `data-catid`, splices and re-inserts the moved item
- After reorder: calls `renderCatMgrList()`, `renderCatDropdown()`, and `saveCategories()` — the new order is immediately reflected in the category dropdown on WO cards
- Visual feedback: dragged row goes to 35% opacity (`.dragging`), target row gets a 2px accent outline (`.drag-over`)

---

### [2026-03-19] Hotfix — autoTagNewWOs Wiped Existing Tags on Load

**Files changed:** `index.html`

**Bug:** All existing WO follow-up dates and category assignments were erased on first load after the Session 8 update.

**Root cause:** `autoTagNewWOs()` was called inside `loadExcelData()` *before* saved tags were re-applied from disk. At that point `woTags` was still an empty object `{}`, so every WO passed the `if (woTags[w.wo]) return` guard — none were skipped. Every WO was treated as "new" and overwritten with `{ _followup: today+3biz, _catIds: [] }`. `saveWOTags()` then immediately persisted this wiped state to disk.

**Fix:** Swapped the order in `loadExcelData()` — saved tags are now re-applied from `woTags` first, then `autoTagNewWOs()` runs. Existing WOs are already in `woTags` by the time the new-WO check fires, so they are correctly skipped.

---

### [2026-03-19] Hotfix 2 — woTags Still Being Wiped on Startup

**Files changed:** `index.html`

**Bug:** Even after Hotfix 1, pasting a restored `wo-tags.json` had no effect — tags still showed blank on load.

**Root cause:** The startup sequence in `_halqReady()` called `loadExcelData()` first, then `loadWOTags()`. Since `loadExcelData()` calls `autoTagNewWOs()` internally, and `woTags` was still `{}` at that point (file not yet read), every WO was treated as new and overwritten — then `saveWOTags()` persisted the wiped data before `loadWOTags()` ever ran.

**Fix:** Swapped the startup order — `loadWOTags()` now runs before `loadExcelData()`. By the time `autoTagNewWOs()` fires, all existing tags are already in memory and correctly skipped.

**Correct startup order:**
1. `loadAppSettings()`
2. `loadCredsToUI()`
3. `loadWOTags()` ← moved up
4. `loadExcelData()` (which calls `autoTagNewWOs()` internally)

---

### [2026-03-19] Feature — Filter Chips Overhaul

**Files changed:** `index.html`

**Changes:**

**Overdue / Due Today now based on follow-up date (not WO age):**
- `getItemClass()` updated to accept `followup` param — compares `_followup` date against today
- WO card left-border color (red = overdue, yellow = due today) now reflects follow-up date
- `toggleChip('overdue')` filters WOs where `_followup < today`
- `toggleChip('today')` filters WOs where `_followup === today`
- Bottom bar overdue count also updated to use follow-up date
- WOs with no follow-up date set are never shown as overdue

**Removed static chips:** Assigned, Waiting, Urgent removed from the filter bar.

**Dynamic category chips:**
- Added `renderCategoryChips()` — scans all WOs, finds which categories are actually assigned, renders one chip per used category
- Each chip is styled with the category's own color (border + text), turns solid on active
- Chips use `filter = 'cat:<id>'` — `toggleChip()` filters WOs by that category ID
- Chips re-render after every `renderWOList()` call so they stay in sync
- Only categories that have at least one WO assigned appear as chips

---

### [2026-03-19] UI — Visual Interactive Upgrade (index.html + launcher/index.html)

**Scope:** CSS-only overrides appended before `</style>` in both files. Zero changes to HTML structure, JS functions, IPC channels, class names, or existing IDs. All existing features remain intact.

#### What changed

**Shared (both files)**
- Titlebar gets a gradient accent line along the bottom edge (`::after` pseudo-element, `linear-gradient` from `--accent` to `--accent2`). Visible in all 4 nav modes since the titlebar is always rendered.

**index.html — main app**
- `.titlebar` — added `position: relative; overflow: hidden` to support the `::after` line
- `.tb-btn` — added `transition: all 0.18s`; hover now shows accent border + accent text + subtle background tint
- `.tb-nav-item` (compact modes: Top Bar, Tabs) — active state now shows a bordered pill (`border: 1px solid rgba(91,156,246,0.28)`) instead of just a color change; hover is smoother
- `.sidebar` — easing changed from linear to `cubic-bezier(0.4,0,0.2,1)` for show/hide transition
- `.nav-item` — hover and active states retain existing behavior; added `position: relative; overflow: hidden` for future ripple support
- `.top-nav-item` (Top Nav row, sidebar mode) — active state now has bordered pill styling matching inline nav
- `.section-tab` (Section Tabs row, sidebar mode) — unchanged behavior, transition added
- `.wo-item` — added `transform: translateX(2px)` on hover (slide-right effect); `border-left-color` transition added; all overdue/due-today/on-track color states preserved
- `.filter-chip` — hover now shows accent border + text + faint background; active state unchanged
- `.btn-primary` / `.btn-ghost` — hover transitions added; ghost hover shows accent border + text
- `.status-dot` — replaced `animation: blink` with `statusPulse` keyframe that adds a fading ring (`box-shadow`) for a breathing effect
- `.af-tab`, `.af-nav-btn`, `.af-go-btn` — transitions added for hover feedback
- `.bb-item span` — font-weight raised to `700`, size to `13px` for bolder stat numbers
- `.wo-cat-strip` — `filter: brightness(1.12)` applied when parent `.wo-item` is hovered
- `.settings-close`, `.wo-detail-close` — hover turns red
- `.catmgr-color` — hover scale increased slightly; transition added

**launcher/index.html — launcher**
- `.card` — added `::before` pseudo-element (3px left accent bar); transparent by default, animates to `--accent` on hover/selected, `--green` with pulse animation when `running-card`
- `.card:hover` — `transform: translateX(2px)` + border accent tint
- `.avatar` — `transform: scale(1.06)` on parent card hover
- `.running-dot` — replaced `animation: blink` with `runPulse` keyframe (breathing ring)
- `.running-pill` — border opacity increased slightly
- `.btn-card-launch` — `transform: scale(1.03)` + `brightness(1.18)` on hover
- `.btn-card-focus` — hover shows accent border + text
- `.btn-kebab` — hover shows brighter border + surface background
- `.btn-new` — `scale(1.02)` + `brightness(1.14)` on hover
- `.btn-launch-sel` / `.btn-launch-all` — transitions added; Launch All hover shows accent
- `.cb` — hover shows accent border before checking
- `.select-bar` — border brightens on hover
- `.bb-dot.running` — uses same `runPulse` animation as running dot

#### Files changed
- `index.html` — CSS block appended before `</style>`
- `launcher/index.html` — CSS block appended before `</style>`
- `patch.ps1` — updated (see separate entry)
- `CHANGELOG.md` — this entry
---

## Session 9 — 2026-03-20

---

### [2026-03-20] Fix — Overdue WOs Not Rendering in List

**Root cause:** `renderWOList` had no bucket for WOs whose `_followup` date fell before the start of the current week (`thisWeekMon`). These WOs were loaded correctly (counted in the 112 total) but silently dropped from all section groups — `thisWeek`, `nextWeek`, `weekAfter`, and `later` all use `>=` comparisons that exclude past dates. A WO like `50452-1` with `_followup: 2026-03-11` was in `wos` and visible via `wos.filter()` in the console but never appeared in the rendered list.

**`index.html`**
- Added `overdue` bucket: `withDate.filter(w => d < thisWeekMon)` — captures all WOs with a follow-up date before Monday of the current week
- Added `T00:00:00` suffix to all `new Date(w._followup)` calls in section filters — forces local time parsing instead of UTC, preventing timezone off-by-one errors (UTC+8 was at risk of misclassifying dates near midnight)
- Added `⚠ Overdue` section header rendered at the top of the dated groups
- Restored missing `This Week` section — a previous patch accidentally dropped the `if (thisWeek.length)` render line

---

### [2026-03-20] Fix — Search Ignores Active Filter Chip

**Root cause:** `filterWOs()` searched the full `wos` array directly, bypassing `currentFilter`. Typing in the search box while the Overdue chip was active would show all matching WOs across every status — not just overdue ones. Switching chips also left stale search text in the input, causing the next chip's results to be pre-filtered by the old query.

**`index.html`**
- `filterWOs()` now calls `getFilteredWOs()` as its base set instead of `wos` directly — search always operates within the active chip's scope
- Added `|| ''` null guards on `w.prop`, `w.vendor`, `w.res`, `w.job` to prevent crashes on WOs with empty fields
- `toggleChip()` now clears the search input and calls `updateSearchClear()` on every chip switch — prevents stale search text carrying over between filters

---

### [2026-03-20] Feature — Right-Click Context Menu on WO Cards

**Goal:** Quick-save follow-up date or category assignment directly from the WO list without opening the detail drawer or clicking Save.

**`index.html`**

*CSS (`.wo-ctx-menu`, `.wo-ctx-section`, `.wo-ctx-item`, `.wo-ctx-sep`):*
- Fixed-position dark context menu panel, styled to match app surface/border variables
- Section labels in uppercase monospace; items with hover background

*HTML:*
- Added `<div id="wo-ctx-menu">` — empty shell populated dynamically on right-click

*JS:*
- `showWOCtxMenu(e, woNum)` — builds and positions the menu on `contextmenu` event; keeps menu inside viewport bounds via `requestAnimationFrame` position clamp
- Follow-up section: Tomorrow, Next Day, This Week, Next Week (all business-day-aware using existing `nextBizDay` / `getNextFriday` helpers), plus Custom (opens date picker via reused `nt-prompt-overlay`)
- Category section: all saved categories listed with color dots; checkmark shown on currently assigned ones; supports multi-select toggle
- `_ctxSave(woNum, patch)` — applies `_followup` or `_catIds` patch to the WO object, writes to `woTags`, calls `saveWOTags()`, refreshes the detail drawer if that WO is open, calls `renderWOList()`
- `ctxSetFollowup(key)`, `ctxSetFollowupCustom()`, `ctxToggleCat(id)`, `ctxClearCats()` — action handlers
- `closeCtxMenu()` — hides menu; wired to `document click`, `scroll`, and `Escape` key
- `renderWOList` click-wiring block updated: each `.wo-item` now gets both `click` and `contextmenu` listeners

---

### [2026-03-20] Fix — "Categorize" Renamed to "Category"

**`index.html`**
- Detail drawer label changed from `Categorize` to `Category`
---

## Session 13 — 2026-03-25 (continued)

---

### [2026-03-25] Fix — Web Tab Counter Scoped to Appfolio Tabs Only (v1.2.0 patch)

**File:** `index.html`

**Bug:** After closing all Appfolio tabs and reopening, counter resumed from last number (e.g. New Tab 3, 4) instead of resetting to 1.

**Root cause:** `_nextTabNum()` queried `document.querySelectorAll('.af-tab')` — this matched both `#af-tabs` (Appfolio) and `#em-tabs` (Outlook) since both use the `.af-tab` class. If Outlook tabs had been numbered, they inflated the max. More importantly, the permanent `🏠 Appfolio` home tab in `#af-tabs` prevented the array from ever being empty, but the real issue was cross-panel contamination.

**Fix:** Scoped the query to `document.getElementById('af-tabs').querySelectorAll('.af-tab')` — only counts tabs in the Appfolio panel.

---

### [2026-03-25] Fix + UI — Context Menu: Two-Panel Rail Design, No Hover Flyouts (v1.2.0)

**File:** `index.html`

**Bugs fixed:**
1. Context menu disappeared when moving mouse from a WO card to the menu — `document.addEventListener('scroll', closeCtxMenu, true)` fired on any scroll including inside the menu panel itself.
2. Nested hover-flyout submenus (Tenant → Email/Text → templates) disappeared on the microsecond gap between leaving the parent item and entering the child flyout.
3. Tenant/Vendor Email & Text actions were buried 3 levels deep.

**Redesign:**
- **Left rail** (148px fixed): flat list — Tenant Email, Tenant Text, Vendor Email, Vendor Text, Follow-up, Category — always visible, no hover.
- **Right panel**: populated on click of a rail item. Category panel stays open and refreshes in place while toggling (no close/reopen on each toggle).
- `_ctxBuildPanel(key)` — renders right panel content for the selected rail key.
- `ctxSetFollowupByDate(isoDate)` — new direct-date setter used by follow-up panel items.
- `ctxToggleCat(catId)` — now calls `_ctxBuildPanel('category')` to refresh checkmarks in place instead of closing.
- Removed `document.addEventListener('scroll', closeCtxMenu, true)` — replaced with click-outside + Escape only. Scroll inside the right panel works normally.
- Removed all `.wo-ctx-flyout`, `.wo-ctx-item.has-flyout`, and hover-flyout CSS.

---

### [2026-03-25] UI — Category Manager: Arrow-Button Sort Replaces Drag-and-Drop (v1.2.0)

**File:** `index.html`

**Problem:** As category count grew, drag-and-drop reordering required scrolling to find the target position, dragging, then scrolling back — tedious at 10+ categories.

**Change:** Replaced `⠿` drag handle + drag event listeners with **▲ / ▼** arrow buttons inline on each category row. Top item's ▲ and bottom item's ▼ are disabled.

- `catmgrMoveUp(catId)` / `catmgrMoveDown(catId)` — swap adjacent entries in `categories[]`, re-render list, save.
- Removed `initCatDrag()`, `_catDragSrc`, `dragstart/dragend/dragover/dragleave/drop` listeners.
- Removed `.catmgr-drag-handle`, `.catmgr-item.dragging`, `.catmgr-item.drag-over` CSS.
- Added `.catmgr-sort-btns`, `.catmgr-sort-btn` CSS.

---

### [2026-03-25] UI — Version Number in Bottom Bar (v1.2.0)

**File:** `index.html`

**Change:** Added `#bb-version` display element to the bottom bar between Overdue and the clock. Shows `v—` on startup, populated with the live version from `window.halq.updateVersion()` alongside the sidebar label in `checkForUpdate()`.

**Bottom bar now shows:** `📋 N Active WOs · ⚠️ N Overdue · vX.X.X · [clock]`

---

### [2026-03-25] Docs — README + CHANGELOG Updated (v1.2.0)

**README.md**
- Version table updated: added `1.2.0` row.
- Context menu behavior updated to describe two-panel rail design.
- Category sort updated to describe arrow-button reorder (removed drag-and-drop reference).
- Added Category Manager — Reorder section.

**CHANGELOG.md**
- Session 13 continued entries added.

---

**Git commit message:**
```
v1.2.0 — ctx menu two-panel redesign, tab counter fix, cat arrow-sort, version in bottom bar
```

---

### [2026-03-25] Fix — Web Tab Counter Not Resetting (v1.1.1)

**File:** `index.html`

**Bug:** Opening "New Tab 1", "New Tab 2", closing both, then opening again produced "New Tab 3", "New Tab 4" — counter never reset.

**Root cause:** `tabCount` was a plain incrementing integer declared at module scope. Closing tabs decremented no counter, so the number only went up for the lifetime of the session.

**Fix:** Removed `let tabCount`. Replaced with `_nextTabNum()` — scans all currently open `.af-tab` elements, extracts the highest "New Tab N" number from their labels, returns `max + 1`. If no user tabs exist (only the home tab), returns 1. Counter always reflects reality.

---

### [2026-03-25] UI — Filter Bar Overhaul: Dropdown Flyout for Categories (v1.1.2)

**File:** `index.html`

**Change:** Replaced the scrollable arrow/drag filter chip bar with a cleaner two-zone layout.

**Before:** All chips (All, Overdue, Due Today + dynamic category chips) lived in a horizontally scrollable row with ◀ ▶ arrows and drag-to-scroll. As category count grew, navigating to the last chip and back became tedious.

**After:**
- **Fixed chips** — `All`, `Overdue`, `Due Today` always visible, no scroll
- **Categories ▾ button** — appears to the right only when at least one category has WOs assigned; clicking opens a positioned dropdown flyout listing all active categories with color dot and WO count badge
- Selecting a category closes the flyout, highlights the button in the category's color, filters the list
- Switching back to All/Overdue/Due Today resets the button to default
- Closes on outside click

**Removed:** `scrollChips()`, `initChipDragScroll()`, `updateChipArrows()` — no longer needed.

---

### [2026-03-25] Fix — Context Menu Send Message Going to Dead URL (v1.1.3)

**File:** `index.html`

**Bug:** All four message actions (Tenant Email, Tenant Text, Vendor Email, Vendor Text) navigated to `https://talley.appfolio.com/search/advanced_search?section_keys=work_orders` — the `full_text_search=` parameter was always missing, producing a dead/empty search.

**Root cause:** `closeCtxMenu()` sets `_ctxWoNum = null` as cleanup. `ctxSendMsg()` called `closeCtxMenu()` first, then tried to look up the WO using the now-null `_ctxWoNum` — so `wo` was always `undefined`, `woNum` was `''`, and the search URL had no query.

**Fix:** Capture `_ctxWoNum` into `capturedWoNum` before calling `closeCtxMenu()`.

---

### [2026-03-25] Feature — Context Menu Redesigned: Two-Panel Layout (v1.1.4)

**File:** `index.html`

**Change:** Replaced the 3-level hover-flyout context menu with a two-panel slide-in design.

**Before:** Right-click → Tenant → hover → Email/Text → hover → template list. Nested CSS hover flyouts with JS position math were fragile and hard to target precisely.

**After:**
- **Left rail** — flat list of all actions: Tenant Email, Tenant Text, Vendor Email, Vendor Text, Follow-up, Category — always visible, no hover required
- **Right panel** — slides in (CSS transition) when a rail item is clicked, showing the relevant content (template list, date options, category list)
- Active rail item highlighted in accent blue
- No hover-dependent positioning, no nested flyouts

---

### [2026-03-25] Feature — SMS Self-Learning Selector Discovery (v1.1.5)

**File:** `index.html`

**Change:** Replaced guessed CSS selector list for SMS body fill with a one-time self-learning discovery flow.

**How it works:**
1. First SMS send: launcher button fires, then a blue banner appears inside the AppFolio webview: *"Click inside the message text box to teach HALQ"*
2. User clicks the textarea — HALQ captures a unique CSS selector for that element, saves it to `settings.json` via `settingsSave({ smsInputSelector })`
3. Banner dismisses, message body fills immediately
4. All subsequent SMS sends use the saved selector directly — no prompts

**Reset:** Settings → Accounts → SMS Composer → **Reset SMS Selector** clears the saved selector and triggers re-learning on the next send.

**Status display:** Settings panel shows the currently learned selector in green, or "No selector saved yet" in muted text.