const { app, BrowserWindow, ipcMain, safeStorage, session, dialog, shell } = require('electron')
const path         = require('path')
const fs           = require('fs')
const https        = require('https')
const { exec, spawn } = require('child_process')
const XLSX         = require('xlsx')

// =====================
// MODE DETECTION
// No --profile arg → Launcher mode (shows profile picker)
// --profile=<id>  → HALQ mode (opens the maintenance app for that profile)
// =====================
const _profileArg  = process.argv.find(a => a.startsWith('--profile='))
const IS_LAUNCHER  = !_profileArg
const PROFILE_ID   = _profileArg ? _profileArg.split('=')[1] : null

// =====================
// UPDATER CONFIG
// =====================
const APP_VERSION = '1.0.0'
const UPDATE_URL  = 'https://raw.githubusercontent.com/BossArQue/HALQ-Maintenance/main/releases'

// =====================
// PATHS
// BASE_DIR is the shared userdata root for all profiles
// USER_DATA_DIR is profile-scoped (only set in HALQ mode)
// =====================
const BASE_DIR    = path.join(app.isPackaged ? path.dirname(process.execPath) : __dirname, 'userdata')
const PROFILES_DB = path.join(BASE_DIR, 'profiles-db.json')   // shared across all profiles

// Profile data dir (HALQ mode only — scoped per profile)
const USER_DATA_DIR = IS_LAUNCHER
  ? BASE_DIR
  : path.join(BASE_DIR, 'profiles', PROFILE_ID)

const CRED_PATH = path.join(USER_DATA_DIR, 'creds.enc')
const PIN_PATH  = path.join(USER_DATA_DIR, 'pin.enc')

// Electron's internal userData/sessionData must be in their OWN subfolders.
// Launcher gets userdata/launcher/electron  — avoids ENOTDIR collision with profiles.json
// HALQ profiles get userdata/profiles/<id>/electron
const ELECTRON_DATA_DIR = IS_LAUNCHER
  ? path.join(BASE_DIR, 'launcher')
  : USER_DATA_DIR

app.setPath('userData',    path.join(ELECTRON_DATA_DIR, 'electron'))
app.setPath('sessionData', path.join(ELECTRON_DATA_DIR, 'session'))

// Session partition names scoped so two profiles never share cookies
const AF_PARTITION      = IS_LAUNCHER ? 'persist:af-launcher'      : `persist:appfolio-${PROFILE_ID}`
const OUTLOOK_PARTITION = IS_LAUNCHER ? 'persist:outlook-launcher'  : `persist:outlook-${PROFILE_ID}`

let win

// =====================
// WINDOW — LAUNCHER MODE
// Small profile-picker window
// =====================
function createLauncherWindow () {
  win = new BrowserWindow({
    width:     520,
    height:    620,
    minWidth:  420,
    minHeight: 480,
    resizable: true,
    frame:     true,
    title:     'HALQ Launcher',
    webPreferences: {
      preload:          path.join(__dirname, 'launcher', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    }
  })
  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, 'launcher', 'index.html'))
}

// =====================
// WINDOW — HALQ MODE
// Full maintenance app window, scoped to a profile
// =====================
function createHalqWindow () {
  let profileName = PROFILE_ID
  try {
    if (fs.existsSync(PROFILES_DB)) {
      const db = JSON.parse(fs.readFileSync(PROFILES_DB, 'utf8'))
      const p  = (db.profiles || []).find(x => x.id === PROFILE_ID)
      if (p) profileName = p.name
    }
  } catch (_) {}

  win = new BrowserWindow({
    width:    1400,
    height:   900,
    minWidth:  900,
    minHeight: 600,
    frame:     true,
    title:     profileName === 'default' ? 'HALQ' : `HALQ — ${profileName}`,
    webPreferences: {
      preload:             path.join(__dirname, 'preload.js'),
      contextIsolation:    true,
      nodeIntegration:     false,
      webviewTag:          true,
      additionalArguments: [`--halq-profile=${PROFILE_ID}`, `--halq-profile-name=${profileName}`]
    }
  })

  win.setMenuBarVisibility(false)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('mailto:')) { shell.openExternal(url); return { action: 'deny' } }
    if (url && url !== 'about:blank') win.webContents.send('open-new-tab', url)
    return { action: 'deny' }
  })

  win.loadFile('index.html')
}

// =====================
// LAUNCHER IPC HANDLERS
// Only meaningful when running in launcher mode
// =====================

// Running process tracking: Map<profileId, { pid }>
const running = new Map()

function isAlive (pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function cleanupDead () {
  for (const [id, info] of running.entries()) {
    if (!isAlive(info.pid)) running.delete(id)
  }
}

function dbLoad () {
  try {
    if (!fs.existsSync(PROFILES_DB)) return { profiles: [] }
    return JSON.parse(fs.readFileSync(PROFILES_DB, 'utf8'))
  } catch { return { profiles: [] } }
}

function dbSave (db) {
  fs.mkdirSync(path.dirname(PROFILES_DB), { recursive: true })
  fs.writeFileSync(PROFILES_DB, JSON.stringify(db, null, 2), 'utf8')
}

function launchProfile (profileId) {
  cleanupDead()
  if (running.has(profileId) && isAlive(running.get(profileId).pid)) {
    return { ok: true, alreadyRunning: true }
  }

  const profileArg = `--profile=${profileId}`
  let child

  if (app.isPackaged) {
    // Production: re-run the same .exe with --profile flag
    child = spawn(process.execPath, [profileArg], {
      detached: true,
      stdio:    'ignore'
    })
  } else {
    // Dev: re-run electron on project root with --profile flag
    const projectRoot = __dirname
    child = spawn(process.execPath, [projectRoot, profileArg], {
      detached: true,
      stdio:    'ignore',
      cwd:      projectRoot
    })
  }

  child.unref()
  running.set(profileId, { pid: child.pid })
  return { ok: true, pid: child.pid }
}

function deleteProfileData (profileId) {
  const profileDir = path.join(BASE_DIR, 'profiles', profileId)
  try {
    if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

ipcMain.handle('profiles-load', () => {
  cleanupDead()
  const db = dbLoad()
  const profiles = (db.profiles || []).map(p => ({
    ...p,
    running: running.has(p.id) && isAlive(running.get(p.id).pid)
  }))
  return { ok: true, profiles }
})

ipcMain.handle('profiles-save', (_e, profiles) => {
  try {
    const db = dbLoad()
    db.profiles = profiles
    dbSave(db)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('profile-launch', (_e, profileId) => {
  try {
    const result = launchProfile(profileId)
    // Auto-close launcher 1.5s after a successful launch
    if (result.ok && win) setTimeout(() => { if (win && !win.isDestroyed()) win.close() }, 1500)
    return result
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('profile-running-state', () => {
  cleanupDead()
  const state = {}
  for (const [id, info] of running.entries()) state[id] = isAlive(info.pid)
  return { ok: true, state }
})

ipcMain.handle('profile-delete-data', (_e, profileId) => {
  if (running.has(profileId)) {
    try { process.kill(running.get(profileId).pid) } catch (_) {}
    running.delete(profileId)
  }
  return deleteProfileData(profileId)
})

// Poll running state every 5s and push to launcher renderer
setInterval(() => {
  if (IS_LAUNCHER && win && !win.isDestroyed()) {
    cleanupDead()
    const state = {}
    for (const [id, info] of running.entries()) state[id] = isAlive(info.pid)
    win.webContents.send('running-state-update', state)
  }
}, 5000)

// =====================
// HALQ IPC HANDLERS
// Only active in HALQ (profile) mode
// =====================

// --- Credentials ---
ipcMain.handle('creds-save', async (_event, { email, password }) => {
  try {
    const payload   = JSON.stringify({ email, password })
    const encrypted = safeStorage.encryptString(payload)
    fs.mkdirSync(path.dirname(CRED_PATH), { recursive: true })
    fs.writeFileSync(CRED_PATH, encrypted)
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('creds-load', async () => {
  try {
    if (!fs.existsSync(CRED_PATH)) return { ok: false }
    const encrypted = fs.readFileSync(CRED_PATH)
    const decrypted = safeStorage.decryptString(encrypted)
    return { ok: true, ...JSON.parse(decrypted) }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('creds-clear', async () => {
  try {
    if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH)
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

// --- Profile info ---
ipcMain.handle('profile-info', () => {
  try {
    let name = PROFILE_ID, color = null
    if (fs.existsSync(PROFILES_DB)) {
      const db = JSON.parse(fs.readFileSync(PROFILES_DB, 'utf8'))
      const p  = (db.profiles || []).find(x => x.id === PROFILE_ID)
      if (p) { name = p.name; color = p.color || null }
    }
    return { ok: true, id: PROFILE_ID, name, color }
  } catch (err) { return { ok: false, id: PROFILE_ID, name: PROFILE_ID } }
})

// --- PIN ---
ipcMain.handle('pin-save', async (_event, { pin }) => {
  try {
    const encrypted = safeStorage.encryptString(pin)
    fs.mkdirSync(path.dirname(PIN_PATH), { recursive: true })
    fs.writeFileSync(PIN_PATH, encrypted)
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('pin-load', async () => {
  try {
    if (!fs.existsSync(PIN_PATH)) return { ok: false }
    const encrypted = fs.readFileSync(PIN_PATH)
    const pin       = safeStorage.decryptString(encrypted)
    return { ok: true, pin }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('pin-clear', async () => {
  try {
    if (fs.existsSync(PIN_PATH)) fs.unlinkSync(PIN_PATH)
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

// --- Dialog ---
ipcMain.handle('dialog-open', async (_event, options) => {
  return dialog.showOpenDialog(win, options)
})

// --- Menu bar ---
ipcMain.on('toggle-menubar', (_event, visible) => {
  if (win && !win.isDestroyed()) win.setMenuBarVisibility(visible)
})

// =====================
// CONSTANTS (HALQ mode)
// =====================
const ALLOWED_PERMISSION_SET = new Set([
  'media', 'geolocation', 'notifications',
  'fullscreen', 'pointerLock', 'openExternal'
])

const EXCEL_SHEET = 'Active Monitoring'

const MACRO = {
  scanNewWOs:        'ScanForNewWorkOrders',
  refresh:           'RefreshFormulasActiveMonitoring',
  transferToSummary: 'TransferToSummary'
}

const AM_COL = {
  property: 3,   // C — Property street address
  unit:     4,   // D — Unit number
  wo:       5,   // E — Work Order #
  resident: 6,   // F — Primary resident
  age:      8,   // H — Age in days (formula result)
  job:      9,   // I — Job summary
  status:   11,  // K — Status
  vendor:   12   // L — Vendor name
}

// =====================
// SETTINGS PERSISTENCE
// =====================
const SETTINGS_PATH = path.join(USER_DATA_DIR, 'settings.json')

function loadSettings () {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return {}
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
  } catch { return {} }
}

function saveSettings (data) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  const current = loadSettings()
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ ...current, ...data }, null, 2), 'utf8')
}

ipcMain.handle('settings-load', async () => {
  try   { return { ok: true, settings: loadSettings() } }
  catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('settings-save', async (_event, data) => {
  try   { saveSettings(data); return { ok: true } }
  catch (err) { return { ok: false, error: err.message } }
})

// =====================
// WO TAGS PERSISTENCE
// =====================
const WO_TAGS_PATH = path.join(USER_DATA_DIR, 'wo-tags.json')

ipcMain.handle('wo-tags-save', async (_event, tags) => {
  try {
    fs.mkdirSync(path.dirname(WO_TAGS_PATH), { recursive: true })
    fs.writeFileSync(WO_TAGS_PATH, JSON.stringify(tags, null, 2), 'utf8')
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wo-tags-load', async () => {
  try {
    if (!fs.existsSync(WO_TAGS_PATH)) return { ok: false }
    const data = JSON.parse(fs.readFileSync(WO_TAGS_PATH, 'utf8'))
    return { ok: true, tags: data }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// CATEGORIES PERSISTENCE
// =====================
const CAT_PATH = path.join(USER_DATA_DIR, 'categories.json')

ipcMain.handle('categories-save', async (_event, categories) => {
  try {
    fs.mkdirSync(path.dirname(CAT_PATH), { recursive: true })
    fs.writeFileSync(CAT_PATH, JSON.stringify(categories, null, 2), 'utf8')
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('categories-load', async () => {
  try {
    if (!fs.existsSync(CAT_PATH)) return { ok: false }
    const data = JSON.parse(fs.readFileSync(CAT_PATH, 'utf8'))
    return { ok: true, categories: data }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// EXCEL IMPORT
// =====================
ipcMain.handle('excel-import', async (_event, exportFilePath) => {
  try {
    if (!fs.existsSync(exportFilePath)) {
      return { ok: false, error: 'Export file not found: ' + exportFilePath }
    }

    const exportWb = XLSX.readFile(exportFilePath, { cellDates: true, sheetStubs: true })
    const exportWs = exportWb.Sheets[exportWb.SheetNames[0]]
    const allRows  = XLSX.utils.sheet_to_json(exportWs, { header: 1, defval: '' })

    const HEADER_KEYWORDS = ['work order', 'property', 'status', 'vendor', 'unit', 'resident']
    let headerIdx = -1
    for (let i = 0; i < Math.min(allRows.length, 30); i++) {
      const rowText = allRows[i].join(' ').toLowerCase()
      if (HEADER_KEYWORDS.filter(k => rowText.includes(k)).length >= 3) {
        headerIdx = i; break
      }
    }
    if (headerIdx === -1) return { ok: false, error: 'Could not detect header row in export file' }

    const pasteData = allRows.slice(headerIdx)
    if (pasteData.length < 2) return { ok: false, error: 'No data rows found after header' }

    const tmpPath = path.join(USER_DATA_DIR, 'import_tmp.csv')
    const csvWb   = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(csvWb, XLSX.utils.aoa_to_sheet(pasteData), 'Data')
    XLSX.writeFile(csvWb, tmpPath)

    const cfgPath = path.join(USER_DATA_DIR, 'import_cfg.txt')
    fs.writeFileSync(cfgPath, tmpPath, 'utf8')

    const psPath   = path.join(USER_DATA_DIR, 'import.ps1')
    const psScript = [
      `$ErrorActionPreference = 'Stop'`,
      `try {`,
      `  try {`,
      `    $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')`,
      `  } catch {`,
      `    Write-Output "ERR:Excel is not open. Please open Work Order Status Update.xlsm first."`,
      `    exit`,
      `  }`,
      `  $wb = $null`,
      `  for ($i = 1; $i -le $excel.Workbooks.Count; $i++) {`,
      `    try { $w = $excel.Workbooks.Item($i); if ($w.Name -like '*Work Order Status Update*') { $wb = $w; break } } catch {}`,
      `  }`,
      `  if (-not $wb) {`,
      `    Write-Output "ERR:Work Order Status Update.xlsm is not open in Excel."`,
      `    exit`,
      `  }`,
      `  $excel.Run("'" + $wb.Name + "'!ImportFromCSV")`,
      `  Write-Output "OK"`,
      `} catch {`,
      `  Write-Output ('ERR:' + $_.Exception.Message)`,
      `}`
    ].join('\n')

    fs.writeFileSync(psPath, psScript, 'utf8')

    return new Promise((resolve) => {
      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psPath}"`,
        { timeout: 120000 },
        (err, stdout, stderr) => {
          try { fs.unlinkSync(psPath) } catch (_) {}
          const output   = (stdout || '').trim()
          const lines    = output.split('\n').map(l => l.trim()).filter(Boolean)
          const result   = lines.find(l => l.startsWith('OK') || l.startsWith('ERR:')) || ''
          const dbgLines = lines.filter(l => l.startsWith('DBG:')).join(' | ')
          if (dbgLines) console.log('[IMPORT]', dbgLines)
          if (err || result.startsWith('ERR:')) {
            const msg = result.startsWith('ERR:') ? result.slice(4) : (stderr || err?.message || output)
            resolve({ ok: false, error: msg })
          } else {
            resolve({ ok: true, count: pasteData.length - 1 })
          }
        }
      )
    })
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// EXCEL LOAD
// HALQ never writes to the sheet — all writes done by VBA macros
// =====================
ipcMain.handle('excel-load', async () => {
  try {
    const settings  = loadSettings()
    const excelPath = settings.excelPath || ''
    if (!excelPath) {
      return { ok: false, error: 'Excel file path not configured. Go to Settings → Accounts to set it.' }
    }
    if (!fs.existsSync(excelPath)) {
      return { ok: false, error: 'Excel file not found at: ' + excelPath }
    }

    const workbook  = XLSX.readFile(excelPath, { cellDates: true, sheetStubs: true })
    const worksheet = workbook.Sheets[EXCEL_SHEET]
    if (!worksheet) {
      return { ok: false, error: `Sheet "${EXCEL_SHEET}" not found in workbook` }
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    const wos  = rows.slice(1)
      .filter(row => {
        const wo = String(row[AM_COL.wo - 1] || '').trim()
        return wo !== '' && wo !== '0' && wo.length >= 2
      })
      .map(row => ({
        wo:     String(row[AM_COL.wo       - 1] || '').trim(),
        prop:   String(row[AM_COL.property - 1] || '').trim(),
        unit:   String(row[AM_COL.unit     - 1] || '').trim(),
        res:    String(row[AM_COL.resident - 1] || '').trim(),
        age:    Number(row[AM_COL.age      - 1]) || 0,
        job:    String(row[AM_COL.job      - 1] || '').trim(),
        status: String(row[AM_COL.status   - 1] || '').trim(),
        vendor: String(row[AM_COL.vendor   - 1] || '').trim()
      }))

    return { ok: true, wos }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// MACRO RUN
// Triggers VBA macro in .xlsm via PowerShell COM
// =====================
ipcMain.handle('macro-run', async (_event, macroName) => {
  return new Promise((resolve) => {
    const settings  = loadSettings()
    const excelPath = settings.excelPath || ''
    const psPath    = path.join(USER_DATA_DIR, 'macro.ps1')
    const psScript  = [
      `$ErrorActionPreference = 'Stop'`,
      `try {`,
      `  try {`,
      `    $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')`,
      `  } catch {`,
      `    $excel = New-Object -ComObject Excel.Application`,
      `    $excel.Visible = $true`,
      `  }`,
      `  $targetName = 'Work Order Status Update.xlsm'`,
      `  $wb = $excel.Workbooks | Where-Object { $_.Name -eq $targetName }`,
      `  if (-not $wb) { $wb = $excel.Workbooks.Open('${excelPath}') }`,
      `  $excel.Run('${macroName}')`,
      `  Write-Output 'OK'`,
      `} catch {`,
      `  Write-Output ('ERR:' + $_.Exception.Message)`,
      `}`
    ].join('\n')

    fs.writeFileSync(psPath, psScript, 'utf8')

    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psPath}"`,
      { timeout: 120000 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(psPath) } catch (_) {}
        const output = (stdout || '').trim()
        if (err || output.startsWith('ERR:')) {
          const msg = output.startsWith('ERR:') ? output.slice(4) : (stderr || err.message)
          resolve({ ok: false, error: msg })
        } else {
          resolve({ ok: true })
        }
      }
    )
  })
})

// =====================
// SESSION SETUP
// =====================
function setupAppfolioSession () {
  const afSession = session.fromPartition(AF_PARTITION)
  afSession.setPermissionRequestHandler((_wc, permission, cb) => cb(ALLOWED_PERMISSION_SET.has(permission)))
  afSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSION_SET.has(permission))
  afSession.webRequest.onBeforeRequest((_details, cb) => cb({ cancel: false }))
}

function setupOutlookSession () {
  const olSession = session.fromPartition(OUTLOOK_PARTITION)
  olSession.setPermissionRequestHandler((_wc, permission, cb) => cb(ALLOWED_PERMISSION_SET.has(permission)))
  olSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSION_SET.has(permission))
  olSession.webRequest.onBeforeRequest((_details, cb) => cb({ cancel: false }))
}

// =====================
// WEBVIEW LINK HANDLING
// =====================
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('mailto:')) { shell.openExternal(url); return { action: 'deny' } }
    if (win && !win.isDestroyed()) win.webContents.send('open-new-tab', url)
    return { action: 'deny' }
  })
})

// =====================
// NOTES
// Storage: userdata/profiles/<id>/notes/notebooks.json
//          userdata/profiles/<id>/notes/pages/[id].html
//          userdata/profiles/<id>/notes/assets/[id]/
// =====================
const NOTES_DIR    = path.join(USER_DATA_DIR, 'notes')
const NOTES_META   = path.join(NOTES_DIR, 'notebooks.json')
const NOTES_PAGES  = path.join(NOTES_DIR, 'pages')
const NOTES_ASSETS = path.join(NOTES_DIR, 'assets')

function notesEnsureDirs () {
  ;[NOTES_DIR, NOTES_PAGES, NOTES_ASSETS].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  })
}

function notesLoadMeta () {
  notesEnsureDirs()
  if (!fs.existsSync(NOTES_META)) return { notebooks: [] }
  try { return JSON.parse(fs.readFileSync(NOTES_META, 'utf8')) }
  catch { return { notebooks: [] } }
}

ipcMain.handle('notes-meta-load', () => {
  try   { return { ok: true, data: notesLoadMeta() } }
  catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-meta-save', (_e, data) => {
  try   { notesEnsureDirs(); fs.writeFileSync(NOTES_META, JSON.stringify(data, null, 2), 'utf8'); return { ok: true } }
  catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-page-load', (_e, pageId) => {
  try {
    const p = path.join(NOTES_PAGES, `${pageId}.html`)
    return { ok: true, content: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '' }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-page-save', (_e, pageId, content) => {
  try {
    notesEnsureDirs()
    fs.writeFileSync(path.join(NOTES_PAGES, `${pageId}.html`), content, 'utf8')
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-page-delete', (_e, pageId) => {
  try {
    const p = path.join(NOTES_PAGES, `${pageId}.html`)
    const a = path.join(NOTES_ASSETS, pageId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
    if (fs.existsSync(a)) fs.rmSync(a, { recursive: true, force: true })
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-asset-save', (_e, pageId, fileName, base64Data) => {
  try {
    notesEnsureDirs()
    const dir      = path.join(NOTES_ASSETS, pageId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = path.join(dir, safeName)
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
    return { ok: true, src: `file://${filePath.replace(/\\/g, '/')}` }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-file-read', (_e, filePath) => {
  try   { return { ok: true, base64: fs.readFileSync(filePath).toString('base64') } }
  catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('notes-asset-open', (_e, filePath) => {
  try   { shell.openPath(filePath); return { ok: true } }
  catch (err) { return { ok: false, error: err.message } }
})

// =====================
// NOTES — EXPORT
// =====================
ipcMain.handle('notes-export', async (_e, opts) => {
  try {
    notesEnsureDirs()
    const meta = notesLoadMeta()
    const { type, nbId, secId, pgId } = opts || {}

    async function embedPage (pg) {
      const pagePath = path.join(NOTES_PAGES, `${pg.id}.html`)
      const html     = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : ''
      const assets   = {}
      const assetDir = path.join(NOTES_ASSETS, pg.id)
      if (fs.existsSync(assetDir)) {
        for (const f of fs.readdirSync(assetDir))
          assets[f] = fs.readFileSync(path.join(assetDir, f)).toString('base64')
      }
      return { ...pg, html, assets }
    }

    let payload, defaultName

    if (type === 'page') {
      const nb  = meta.notebooks.find(n => n.id === nbId)
      const sec = nb?.sections?.find(s => s.id === secId)
      const pg  = sec?.pages?.find(p => p.id === pgId)
      if (!pg) return { ok: false, error: 'Page not found' }
      defaultName = (pg.title || 'Untitled').replace(/[^a-zA-Z0-9_-]/g, '_')
      payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(),
        exportType: 'page', notebookName: nb?.name, sectionName: sec?.name,
        page: await embedPage(pg) }, null, 2)

    } else if (type === 'section') {
      const nb  = meta.notebooks.find(n => n.id === nbId)
      const sec = nb?.sections?.find(s => s.id === secId)
      if (!sec) return { ok: false, error: 'Section not found' }
      defaultName = sec.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(),
        exportType: 'section', notebookName: nb?.name,
        section: { ...sec, pages: await Promise.all((sec.pages || []).map(embedPage)) } }, null, 2)

    } else {
      const nb = meta.notebooks.find(n => n.id === nbId)
      if (!nb) return { ok: false, error: 'Notebook not found' }
      defaultName = nb.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(),
        exportType: 'notebook',
        notebook: { ...nb, sections: await Promise.all((nb.sections || []).map(async sec => ({
          ...sec, pages: await Promise.all((sec.pages || []).map(embedPage))
        }))) } }, null, 2)
    }

    const res = await dialog.showSaveDialog({
      title: 'Export Notes',
      defaultPath: `${defaultName}.halqnote`,
      filters: [{ name: 'HALQ Note', extensions: ['halqnote'] }, { name: 'All Files', extensions: ['*'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, canceled: true }
    fs.writeFileSync(res.filePath, payload, 'utf8')
    return { ok: true, filePath: res.filePath }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// NOTES — IMPORT
// Supports: .halqnote, .html, .htm, .txt
// =====================
ipcMain.handle('notes-import', async (_e) => {
  try {
    const dlg = await dialog.showOpenDialog({
      title: 'Import Notes',
      filters: [
        { name: 'All Supported', extensions: ['halqnote','html','htm','txt'] },
        { name: 'HALQ Note',     extensions: ['halqnote'] },
        { name: 'HTML',          extensions: ['html','htm'] },
        { name: 'Text',          extensions: ['txt'] },
        { name: 'All Files',     extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (dlg.canceled || !dlg.filePaths.length) return { ok: false, canceled: true }

    const filePath = dlg.filePaths[0]
    const ext      = path.extname(filePath).toLowerCase()
    notesEnsureDirs()
    const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2,5)

    function writePage (pg, newId) {
      let html = pg.html || ''
      if (pg.assets && Object.keys(pg.assets).length) {
        const dir = path.join(NOTES_ASSETS, newId)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        for (const [n, b64] of Object.entries(pg.assets)) {
          const safe = n.replace(/[^a-zA-Z0-9._-]/g,'_')
          fs.writeFileSync(path.join(dir, safe), Buffer.from(b64, 'base64'))
          html = html.replaceAll(pg.id, newId)
        }
      }
      fs.writeFileSync(path.join(NOTES_PAGES, `${newId}.html`), html, 'utf8')
    }

    if (ext === '.halqnote') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      const meta = notesLoadMeta()

      if (data.exportType === 'page' && data.page) {
        return { ok: true, type: 'page', name: data.page.title || 'Imported Page', html: data.page.html || '' }
      }

      if (data.exportType === 'section' && data.section) {
        const sec      = data.section
        const newSecId = uid()
        const newPages = (sec.pages || []).map(pg => {
          const nid = uid(); writePage(pg, nid); return { id: nid, title: pg.title || 'Untitled' }
        })
        let nb = meta.notebooks.find(n => n.name === data.notebookName)
        if (!nb) { nb = { id: uid(), name: data.notebookName || 'Imported', open: true, sections: [] }; meta.notebooks.push(nb) }
        nb.sections.push({ id: newSecId, name: sec.name, color: sec.color, open: false, pages: newPages })
        fs.writeFileSync(NOTES_META, JSON.stringify(meta, null, 2), 'utf8')
        return { ok: true, type: 'halqnote', notebookName: nb.name }
      }

      const nb = data.notebook || data
      if (!nb?.sections) return { ok: false, error: 'Invalid .halqnote file' }
      const newSecs = (nb.sections || []).map(sec => {
        const sid = uid()
        const pgs = (sec.pages || []).map(pg => { const nid = uid(); writePage(pg, nid); return { id: nid, title: pg.title || 'Untitled' } })
        return { id: sid, name: sec.name, color: sec.color, open: false, pages: pgs }
      })
      meta.notebooks.push({ id: uid(), name: (nb.name || 'Imported') + ' (imported)', open: true, sections: newSecs })
      fs.writeFileSync(NOTES_META, JSON.stringify(meta, null, 2), 'utf8')
      return { ok: true, type: 'halqnote', notebookName: (nb.name || 'Imported') + ' (imported)' }
    }

    if (ext === '.html' || ext === '.htm') {
      return { ok: true, type: 'page', name: path.basename(filePath, ext), html: fs.readFileSync(filePath, 'utf8') }
    }

    if (ext === '.txt') {
      const txt  = fs.readFileSync(filePath, 'utf8')
      const name = path.basename(filePath, ext)
      const html = txt.split('\n').map(l =>
        l.trim() === '' ? '<br>' : `<p>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
      ).join('\n')
      return { ok: true, type: 'page', name, html }
    }

    if (ext === '.one' || ext === '.onepkg') {
      return { ok: false, error: 'OneNote files cannot be imported directly.\n\nIn OneNote: File → Export → Export As → HTML (*.htm).\nThen import the .htm file here.' }
    }

    return { ok: false, error: `Unsupported file type: ${ext || '(none)'}.\nSupported formats: .halqnote  .html  .txt` }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// NOTES — CLEANUP
// =====================
ipcMain.handle('notes-cleanup', async () => {
  try {
    notesEnsureDirs()
    const meta     = notesLoadMeta()
    const validIds = new Set()
    for (const nb of (meta.notebooks || []))
      for (const sec of (nb.sections || []))
        for (const pg of (sec.pages || []))
          if (pg?.id) validIds.add(pg.id)

    let orphanCount = 0
    for (const f of fs.readdirSync(NOTES_PAGES).filter(f => f.endsWith('.html'))) {
      const id = f.replace(/\.html$/, '')
      if (!validIds.has(id)) { fs.unlinkSync(path.join(NOTES_PAGES, f)); orphanCount++ }
    }

    let assetCount = 0
    if (fs.existsSync(NOTES_ASSETS)) {
      for (const d of fs.readdirSync(NOTES_ASSETS)) {
        if (!validIds.has(d)) { fs.rmSync(path.join(NOTES_ASSETS, d), { recursive: true, force: true }); assetCount++ }
      }
    }

    return { ok: true, orphanCount, assetCount, validPageCount: validIds.size }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// AUTO-UPDATER
// =====================
function httpsGet (url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HALQ-Updater' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return httpsGet(res.headers.location).then(resolve).catch(reject)
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function httpsDownload (url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    function get (u) {
      https.get(u, { headers: { 'User-Agent': 'HALQ-Updater' } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return get(res.headers.location)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
      }).on('error', err => { fs.unlink(destPath, () => {}); reject(err) })
    }
    get(url)
  })
}

function isNewer (local, remote) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number)
  const [la, lb, lc] = parse(local)
  const [ra, rb, rc] = parse(remote)
  if (ra !== la) return ra > la
  if (rb !== lb) return rb > lb
  return rc > lc
}

ipcMain.handle('update-check', async () => {
  try {
    const body = await httpsGet(`${UPDATE_URL}/version.json`)
    const info = JSON.parse(body)
    if (isNewer(APP_VERSION, info.version)) return { available: true, current: APP_VERSION, ...info }
    return { available: false, current: APP_VERSION }
  } catch (err) { return { available: false, error: err.message } }
})

ipcMain.handle('update-download', async (_event, asarUrl) => {
  try {
    const asarPath = path.join(process.resourcesPath || __dirname, 'app.asar')
    const tmpPath  = asarPath + '.update'
    await httpsDownload(asarUrl, tmpPath)
    const bakPath = asarPath + '.bak'
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath)
    if (fs.existsSync(asarPath)) fs.renameSync(asarPath, bakPath)
    fs.renameSync(tmpPath, asarPath)
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('update-restart', () => { app.relaunch(); app.exit(0) })
ipcMain.handle('update-version', () => APP_VERSION)

// =====================
// APP LIFECYCLE
// =====================
app.whenReady().then(() => {
  if (!IS_LAUNCHER) {
    setupAppfolioSession()
    setupOutlookSession()
  }
  IS_LAUNCHER ? createLauncherWindow() : createHalqWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})