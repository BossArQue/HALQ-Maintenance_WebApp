# HALQ — Maintenance Command App
## Changelog

> All times are UTC. Project: `D:\OneDrive\DEEH\Project\HALQ - Maintenance`
> Stack: Electron + Node.js | Files: `main.js`, `preload.js`, `index.html`

---

## Session 1 — 2026-03-03 (Chat: halq-electron-autofill-implementation)

### [2026-03-03 20:48] Project Start
- Initial HALQ app already working with: Electron window, Appfolio webview, WO click-to-search, session persistence, hidden menu bar, import button (file picker + drag & drop), 5 macro buttons (UI only), themes, layout toggles, sidebar/topnav/tabs

### [2026-03-03 20:49] Feature: Secure Credential Storage
- **main.js**: Added `safeStorage` — IPC handlers `creds-save`, `creds-load`, `creds-clear`, encrypts to `userdata/creds.enc`
- **index.html**: Added Settings UI — email/password inputs, Save/Clear buttons, status feedback
- Applied AI_for_Coding.txt rules: meaningful names, no hardcoding, error handling, logical sections, DRY

### [2026-03-03 20:54] Fix: `require is not defined`
- **Root cause**: `require('electron')` in renderer blocked by `contextIsolation: true`
- **preload.js**: Created — exposes `window.halq` API via `contextBridge`
- **main.js**: Set `contextIsolation: true`, `nodeIntegration: false`, added `preload` path
- **index.html**: Removed all `require()` calls, replaced with `window.halq.*`

### [2026-03-03 20:58] Fix: ERR_ABORTED (-3) Webview Navigation
- **Root cause**: `persist:appfolio` partition had no permission handlers
- **main.js**: Added `setupAppfolioSession()` — registers permission handlers for webview partition
- **index.html**: Added `webpreferences` attribute to `<webview>` tag

### [2026-03-03 21:02] Fix: Auto-fill Not Triggering
- **Root cause 1**: URL pattern didn't match `/users/sign_in`
- **Root cause 2**: `did-finish-load` fires before React renders form fields
- **main.js**: Updated URL patterns, added `tryFill()` retry loop (250ms × 20 attempts)
- **main.js**: Used `nativeInputSetter` to bypass React's property descriptor

---

## Session 2 — 2026-03-03 (Chat: current)

### [2026-03-03 ~21:30] Fix: Auto-fill Still Not Working
- **Root cause**: Main-process `executeJavaScript` into webview silently blocked by `contextIsolation`
- **index.html**: Moved auto-fill to renderer side — `did-stop-loading` → `tryAutoFill(view)` → `view.executeJavaScript()`
- **main.js**: Removed broken main-process auto-fill block and unused constants

### [2026-03-03 ~21:35] Debug: Visible Debug Bar
- **index.html**: Added `showDebug()` — blue status bar showing auto-fill progress at each step
- **Result**: Revealed credentials were not saved — user saved creds, auto-fill confirmed working

### [2026-03-03 ~21:45] Feature: Settings PIN Lock
- **main.js**: Added `pin-save`, `pin-load`, `pin-clear` IPC handlers — 4-digit PIN encrypted to `userdata/pin.enc`
- **preload.js**: Exposed `pinSave`, `pinLoad`, `pinClear`
- **index.html**: PIN lock numpad modal — 4 dot indicators, shake-red on wrong PIN
- **index.html**: `openSettings()` now async — checks PIN before opening settings
- **index.html**: PIN setup section in Settings panel

### [2026-03-03 ~21:50] Feature: 2FA Detection
- **index.html**: `tryAutoFill()` detects 2FA URLs (`two_factor`, `otp`, `mfa`, etc.) — shows warning, skips gracefully

### [2026-03-03 ~22:00] Feature: Excel Macro Wiring
- Analyzed all 6 VBA macros — mapped exact names, embedded rules, column dependencies
- **main.js**: Added `macro-run` IPC handler — PowerShell COM trigger via temp `.ps1` file
- **main.js**: Added `excel-load` IPC handler — reads `Active Monitoring` via `xlsx`, returns WO array
- **main.js**: Added `MACRO` constants (exact VBA names) and `AM_COL` column map
- **preload.js**: Exposed `macroRun`, `excelLoad`
- **index.html**: Wired macro buttons to correct VBA names
- **index.html**: `② Quick Transfer` — two-step with Excel selection reminder
- **index.html**: `▶ Run All` — chains ①③④⑤, excludes ②
- **index.html**: `loadExcelData()` — loads live Active Monitoring data on startup

### [2026-03-03 ~22:15] Feature: Excel Import (Appfolio Export → AppFolio Data Sheet)
- Raw Appfolio export: rows 1–17 = metadata, row 18 = headers, row 19+ = data + merged group rows
- Import replicates manual process: skip rows 1–17, copy everything from row 18 down
- **main.js**: Added `dialog-open` IPC handler — native Windows file picker (fixes `file.path = undefined`)
- **main.js**: Added `excel-import` — reads export, writes temp CSV, PowerShell COM pastes into open Excel
- **preload.js**: Exposed `dialogOpen`, `excelImport`
- **index.html**: `triggerImport()` uses native dialog, `handleImportFile()` takes file path string

### [2026-03-03 ~22:20] Fix: PowerShell Inline Script Escaping
- **Root cause**: `-Command` with multiline script mangles quotes/newlines
- **Fix**: Both `macro-run` and `excel-import` write to temp `.ps1`, run with `-ExecutionPolicy Bypass -File`

### [2026-03-03 ~22:25] Fix: PowerShell Workbook Lookup Null
- **Root cause**: `Where-Object FullName` fails — OneDrive paths resolve differently
- **Fix**: Changed to `foreach` loop matching `$_.Name`, fallback to `Workbooks.Open()`
- **Root cause 2**: `GetActiveObject` creating new empty Excel instead of attaching
- **Fix**: `$excel = $null` init + explicit null check

### [2026-03-03 ~22:30] Feature: Copyable Error Dialog
- **Root cause**: `alert()` text cannot be selected or copied
- **index.html**: `showErrorDialog()` — modal with selectable textarea, Copy button, Close button

### [2026-03-03 ~22:45] Git + GitHub Setup
- Installed Git 2.53.0, configured user identity
- `git init` in project folder, created `.gitignore`
- Initial commit: 6 files committed
- Created private repo: `github.com/BossArQue/HALQ-Maintenance`
- Pushed to `main` branch

---

## Outstanding / In Progress
- Excel import PowerShell still failing — workbook null lookup being debugged
- Active Monitoring live data load not yet tested end-to-end
- Macro buttons not yet tested (depend on import working first)

## Workflow (once working)
1. **⬆ Import** — pick raw `work_order-[date].xlsx` from Appfolio
2. **① Scan New WOs** — populates Work Queue in Excel
3. **② Quick Transfer** — select rows in Work Queue, click Run Transfer
4. **③ Refresh** — validate and refresh Active Monitoring
5. **④ Sync Outlook** — sync tasks
6. **⑤ Summary** — update vendor summary (skips weekends)

---

## File Reference
| File | Purpose |
|---|---|
| `main.js` | Electron main process — IPC handlers, window, session, PowerShell |
| `preload.js` | contextBridge — exposes `window.halq` API |
| `index.html` | All UI — HTML, CSS, JS |
| `userdata/creds.enc` | Encrypted Appfolio credentials |
| `userdata/pin.enc` | Encrypted settings PIN |

## Key Constants (main.js)
| Constant | Value |
|---|---|
| `EXCEL_PATH` | `D:\OneDrive\Talley Properties\Work Order Status Update.xlsm` |
| `EXCEL_SHEET` | `Active Monitoring` |
| `MACRO.scanNewWOs` | `ScanForNewWorkOrders` |
| `MACRO.refresh` | `RefreshFormulasActiveMonitoring` |
| `MACRO.syncOutlook` | `SyncOutlookTasksOnly` |
| `MACRO.transferToSummary` | `TransferToSummary` |