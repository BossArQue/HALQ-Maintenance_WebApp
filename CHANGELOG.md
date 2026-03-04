# HALQ — Maintenance Command
## Changelog

> **Project path:** `D:\OneDrive\DEEH\Project\HALQ - Maintenance`
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