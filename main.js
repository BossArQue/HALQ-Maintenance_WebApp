const { app, BrowserWindow, ipcMain, safeStorage, session, dialog, shell } = require('electron')
const path     = require('path')
const fs       = require('fs')
const https    = require('https')
const { exec, execFile } = require('child_process')
const XLSX     = require('xlsx')

// =====================
// UPDATER CONFIG
// Set UPDATE_URL to wherever you host version.json + app.asar
// =====================
const APP_VERSION = '1.0.0'
const UPDATE_URL  = 'https://raw.githubusercontent.com/BossArQue/HALQ-Maintenance/main/releases'

// =====================
// MULTI-PROFILE
// Parse --profile=<id> from argv.  If not supplied, fall back to 'default'.
// All data paths are scoped under userdata/profiles/<profileId>/
// =====================
const BASE_DIR    = path.join(__dirname, 'userdata')
const PROFILES_DB = path.join(BASE_DIR, 'profiles.json')   // shared across all profiles

const _profileArg = process.argv.find(a => a.startsWith('--profile='))
const PROFILE_ID  = _profileArg ? _profileArg.split('=')[1] : 'default'

const USER_DATA_DIR = path.join(BASE_DIR, 'profiles', PROFILE_ID)
const CRED_PATH     = path.join(USER_DATA_DIR, 'creds.enc')

// Electron's own userData (cache, devTools) scoped per profile too
app.setPath('userData',     path.join(USER_DATA_DIR, 'electron'))
app.setPath('sessionData',  path.join(USER_DATA_DIR, 'session'))

// Session partition names are scoped so two profiles never share cookies
const AF_PARTITION      = `persist:appfolio-${PROFILE_ID}`
const OUTLOOK_PARTITION = `persist:outlook-${PROFILE_ID}`

let win

// =====================
// CREDENTIALS (safeStorage)
// =====================
ipcMain.handle('creds-save', async (_event, { email, password }) => {
  try {
    const payload   = JSON.stringify({ email, password })
    const encrypted = safeStorage.encryptString(payload)
    fs.mkdirSync(path.dirname(CRED_PATH), { recursive: true })
    fs.writeFileSync(CRED_PATH, encrypted)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('creds-load', async () => {
  try {
    if (!fs.existsSync(CRED_PATH)) return { ok: false }
    const encrypted = fs.readFileSync(CRED_PATH)
    const decrypted = safeStorage.decryptString(encrypted)
    return { ok: true, ...JSON.parse(decrypted) }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('creds-clear', async () => {
  try {
    if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// =====================
// PROFILE INFO
// Lets the renderer know which profile it's running as
// =====================
ipcMain.handle('profile-info', () => {
  try {
    let name  = PROFILE_ID
    let color = null
    if (fs.existsSync(PROFILES_DB)) {
      const db = JSON.parse(fs.readFileSync(PROFILES_DB, 'utf8'))
      const p  = (db.profiles || []).find(x => x.id === PROFILE_ID)
      if (p) { name = p.name; color = p.color || null }
    }
    return { ok: true, id: PROFILE_ID, name, color }
  } catch (err) {
    return { ok: false, id: PROFILE_ID, name: PROFILE_ID }
  }
})

const PIN_PATH = path.join(USER_DATA_DIR, 'pin.enc')

ipcMain.handle('pin-save', async (_event, { pin }) => {
  try {
    const encrypted = safeStorage.encryptString(pin)
    fs.mkdirSync(path.dirname(PIN_PATH), { recursive: true })
    fs.writeFileSync(PIN_PATH, encrypted)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('pin-load', async () => {
  try {
    if (!fs.existsSync(PIN_PATH)) return { ok: false }
    const encrypted = fs.readFileSync(PIN_PATH)
    const pin       = safeStorage.decryptString(encrypted)
    return { ok: true, pin }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('pin-clear', async () => {
  try {
    if (fs.existsSync(PIN_PATH)) fs.unlinkSync(PIN_PATH)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// =====================
// WINDOW
// =====================
function createWindow () {
  // Load profile display name for window title
  let profileName = PROFILE_ID
  try {
    if (fs.existsSync(PROFILES_DB)) {
      const db = JSON.parse(fs.readFileSync(PROFILES_DB, 'utf8'))
      const p  = (db.profiles || []).find(x => x.id === PROFILE_ID)
      if (p) profileName = p.name
    }
  } catch (_) {}

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    title: profileName === 'default' ? 'HALQ' : `HALQ — ${profileName}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      additionalArguments: [`--halq-profile=${PROFILE_ID}`, `--halq-profile-name=${profileName}`]
    }
  })

  win.setMenuBarVisibility(false)

  // Block new BrowserWindow spawns from the main window itself.
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log('[HALQ] main window setWindowOpenHandler fired — url:', url)
    if (url.startsWith('mailto:')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    if (url && url !== 'about:blank') {
      win.webContents.send('open-new-tab', url)
    }
    return { action: 'deny' }
  })

  win.loadFile('index.html')
}

// =====================
// CONSTANTS
// =====================
const ALLOWED_PERMISSION_SET = new Set([
  'media', 'geolocation', 'notifications',
  'fullscreen', 'pointerLock', 'openExternal'
])

// Excel workbook — path loaded dynamically from settings (no hardcoded path)
const EXCEL_SHEET = 'Active Monitoring'

// VBA macro names exactly as defined in the .xlsm
// ② QuickTransferHighlightedWO is excluded — it requires manual row selection in Excel
const MACRO = {
  scanNewWOs:        'ScanForNewWorkOrders',
  refresh:           'RefreshFormulasActiveMonitoring',
  transferToSummary: 'TransferToSummary'
}

// Active Monitoring column indices (1-based) — read-only, never written from HALQ
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
// WO TAGS PERSISTENCE
// Saves/loads per-WO followup dates and category assignments
// keyed by WO number to userdata/wo-tags.json
// =====================
const WO_TAGS_PATH = path.join(USER_DATA_DIR, 'wo-tags.json')

ipcMain.handle('wo-tags-save', async (_event, tags) => {
  try {
    fs.mkdirSync(path.dirname(WO_TAGS_PATH), { recursive: true })
    fs.writeFileSync(WO_TAGS_PATH, JSON.stringify(tags, null, 2), 'utf8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('wo-tags-load', async () => {
  try {
    if (!fs.existsSync(WO_TAGS_PATH)) return { ok: false }
    const data = JSON.parse(fs.readFileSync(WO_TAGS_PATH, 'utf8'))
    return { ok: true, tags: data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// =====================
// CATEGORIES PERSISTENCE
// Saves/loads category list to userdata/categories.json
// =====================
const CAT_PATH = path.join(USER_DATA_DIR, 'categories.json')

ipcMain.handle('categories-save', async (_event, categories) => {
  try {
    fs.mkdirSync(path.dirname(CAT_PATH), { recursive: true })
    fs.writeFileSync(CAT_PATH, JSON.stringify(categories, null, 2), 'utf8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('categories-load', async () => {
  try {
    if (!fs.existsSync(CAT_PATH)) return { ok: false }
    const data = JSON.parse(fs.readFileSync(CAT_PATH, 'utf8'))
    return { ok: true, categories: data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// =====================
// SETTINGS PERSISTENCE
// Stores app settings (Excel file path, etc.) to userdata/settings.json
// Separate from encrypted creds — settings are plain JSON
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



// contextIsolation prevents file.path from working in renderer
// Use main-process dialog instead to get the real file system path
// =====================
ipcMain.handle('dialog-open', async (_event, options) => {
  const result = await dialog.showOpenDialog(win, options)
  return result
})

// =====================
// EXCEL IMPORT
// 1. Read Appfolio export, auto-detect header row
// 2. Write clean CSV to userdata/import_tmp.csv
// 3. Write CSV path to userdata/import_cfg.txt so VBA macro knows where to find it
// 4. Trigger ImportFromCSV VBA macro via PowerShell — macro runs inside user's Excel
//    This avoids all COM file-open/permission issues
// =====================
ipcMain.handle('excel-import', async (_event, exportFilePath) => {
  try {
    if (!fs.existsSync(exportFilePath)) {
      return { ok: false, error: 'Export file not found: ' + exportFilePath }
    }

    // Read raw Appfolio export
    const exportWb = XLSX.readFile(exportFilePath, { cellDates: true, sheetStubs: true })
    const exportWs = exportWb.Sheets[exportWb.SheetNames[0]]
    const allRows  = XLSX.utils.sheet_to_json(exportWs, { header: 1, defval: '' })

    // Auto-detect header row
    const HEADER_KEYWORDS = ['work order', 'property', 'status', 'vendor', 'unit', 'resident']
    let headerIdx = -1
    for (let i = 0; i < Math.min(allRows.length, 30); i++) {
      const rowText = allRows[i].join(' ').toLowerCase()
      if (HEADER_KEYWORDS.filter(k => rowText.includes(k)).length >= 3) {
        headerIdx = i; break
      }
    }
    if (headerIdx === -1) {
      return { ok: false, error: 'Could not detect header row in export file' }
    }

    const pasteData = allRows.slice(headerIdx)
    if (pasteData.length < 2) {
      return { ok: false, error: 'No data rows found after header' }
    }

    // Write clean CSV
    const tmpPath = path.join(USER_DATA_DIR, 'import_tmp.csv')
    const csvWb   = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(csvWb, XLSX.utils.aoa_to_sheet(pasteData), 'Data')
    XLSX.writeFile(csvWb, tmpPath)

    // Write path config for VBA macro to read
    const cfgPath = path.join(USER_DATA_DIR, 'import_cfg.txt')
    fs.writeFileSync(cfgPath, tmpPath, 'utf8')

    // Trigger ImportFromCSV macro — runs inside user's open Excel instance
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
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// HALQ never writes to the sheet; all writes are done by the VBA macros
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

    const workbook    = XLSX.readFile(excelPath, { cellDates: true, sheetStubs: true })
    const worksheet   = workbook.Sheets[EXCEL_SHEET]
    if (!worksheet) {
      return { ok: false, error: 'Sheet "' + EXCEL_SHEET + '" not found in workbook' }
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    // Skip header row (row 0), map each data row using AM_COL indices (1-based → 0-based)
    // Active Monitoring col C holds the street address directly — read it straight.
    const wos = rows.slice(1)
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
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// =====================
// MACRO RUN
// Triggers a VBA macro in the .xlsm via PowerShell COM
// If Excel is open, attaches to running instance
// If Excel is closed, opens the workbook first then runs macro
// HALQ passes only the macro name — all logic stays inside the .xlsm
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
// SESSION
// Grants permissions for the appfolio webview partition so
// navigation does not abort with ERR_ABORTED (-3)
// =====================
function setupAppfolioSession () {
  const afSession = session.fromPartition(AF_PARTITION)

  afSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSION_SET.has(permission))
  })

  afSession.setPermissionCheckHandler((_webContents, permission) => {
    return ALLOWED_PERMISSION_SET.has(permission)
  })

  // Allow all navigation within Appfolio — prevents ERR_ABORTED on search URLs
  afSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: false })
  })
}

function setupOutlookSession () {
  const olSession = session.fromPartition(OUTLOOK_PARTITION)

  olSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSION_SET.has(permission))
  })

  olSession.setPermissionCheckHandler((_webContents, permission) => {
    return ALLOWED_PERMISSION_SET.has(permission)
  })

  olSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: false })
  })
}

// =====================
// WEBVIEW LINK HANDLING
// =====================
app.on('web-contents-created', (_e, contents) => {
  const type = contents.getType()

  if (type !== 'webview') return

  contents.setWindowOpenHandler(({ url }) => {
    console.log('[HALQ] webview setWindowOpenHandler fired — url:', url)
    if (url.startsWith('mailto:')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    if (win && !win.isDestroyed()) win.webContents.send('open-new-tab', url)
    return { action: 'deny' }
  })
})

// =====================
// IPC
// =====================
// =====================
// NOTES
// Storage: userdata/notes/notebooks.json (tree metadata)
//          userdata/notes/pages/[id].html (page content)
//          userdata/notes/assets/[id]/    (images, files per page)
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
// opts: { type: 'notebook'|'section'|'page', nbId, secId?, pgId? }
// =====================
ipcMain.handle('notes-export', async (_e, opts) => {
  try {
    notesEnsureDirs()
    const { dialog } = require('electron')
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
// OneNote (.one / .onepkg): export from OneNote as HTML, then import the HTML file.
// =====================


ipcMain.handle('notes-import', async (_e) => {
  try {
    const { dialog } = require('electron')
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

    // ── .halqnote ────────────────────────────────────────────────────────────
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

      // Full notebook
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

    // ── .html ─────────────────────────────────────────────────────────────────
    if (ext === '.html' || ext === '.htm') {
      return { ok: true, type: 'page', name: path.basename(filePath, ext), html: fs.readFileSync(filePath, 'utf8') }
    }

    // ── .txt ──────────────────────────────────────────────────────────────────
    if (ext === '.txt') {
      const txt  = fs.readFileSync(filePath, 'utf8')
      const name = path.basename(filePath, ext)
      const html = txt.split('\n').map(l =>
        l.trim() === '' ? '<br>' : `<p>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
      ).join('\n')
      return { ok: true, type: 'page', name, html }
    }

    // ── Unsupported (including .one / .onepkg) ────────────────────────────────
    if (ext === '.one' || ext === '.onepkg') {
      return { ok: false, error: 'OneNote files cannot be imported directly.\n\nIn OneNote: File → Export → Export As → HTML (*.htm).\nThen import the .htm file here.' }
    }

    return { ok: false, error: `Unsupported file type: ${ext || '(none)'}.\nSupported formats: .halqnote  .html  .txt` }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.on('toggle-menubar', (event, visible) => {
  win.setMenuBarVisibility(visible)
})

// ── Notes cleanup: remove orphaned page files + purge deleted-flag entries ──
ipcMain.handle('notes-cleanup', async () => {
  try {
    notesEnsureDirs()
    const meta = notesLoadMeta()

    // Collect all valid page IDs from meta
    const validIds = new Set()
    for (const nb of (meta.notebooks || [])) {
      for (const sec of (nb.sections || [])) {
        for (const pg of (sec.pages || [])) {
          if (pg && pg.id) validIds.add(pg.id)
        }
      }
    }

    // Delete orphaned .html page files
    let orphanCount = 0
    const pageFiles = fs.readdirSync(NOTES_PAGES).filter(f => f.endsWith('.html'))
    for (const f of pageFiles) {
      const id = f.replace(/\.html$/, '')
      if (!validIds.has(id)) {
        fs.unlinkSync(path.join(NOTES_PAGES, f))
        orphanCount++
      }
    }

    // Also clean up orphaned asset folders
    let assetCount = 0
    if (fs.existsSync(NOTES_ASSETS)) {
      const assetDirs = fs.readdirSync(NOTES_ASSETS)
      for (const d of assetDirs) {
        if (!validIds.has(d)) {
          fs.rmSync(path.join(NOTES_ASSETS, d), { recursive: true, force: true })
          assetCount++
        }
      }
    }

    return { ok: true, orphanCount, assetCount, validPageCount: validIds.size }
  } catch (err) { return { ok: false, error: err.message } }
})

// =====================
// AUTO-UPDATER
// Flow: renderer calls 'update-check' → main fetches version.json from UPDATE_URL
//   → if newer version found, returns { available: true, version, asarUrl }
//   → renderer calls 'update-download' → main downloads new app.asar to temp
//   → replaces live app.asar → returns ok → renderer prompts restart
//   → renderer calls 'update-restart' → main relaunches
// =====================

// Promisified HTTPS GET — returns body string
function httpsGet (url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HALQ-Updater' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// Promisified HTTPS binary download
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

// Compare semver strings — returns true if remote > local
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
    const info = JSON.parse(body)           // { version, asarUrl, notes }
    if (isNewer(APP_VERSION, info.version)) {
      return { available: true, current: APP_VERSION, ...info }
    }
    return { available: false, current: APP_VERSION }
  } catch (err) {
    return { available: false, error: err.message }
  }
})

ipcMain.handle('update-download', async (_event, asarUrl) => {
  try {
    // asar lives at: <installDir>/resources/app.asar
    const asarPath = path.join(process.resourcesPath || __dirname, 'app.asar')
    const tmpPath  = asarPath + '.update'

    await httpsDownload(asarUrl, tmpPath)

    // Swap: rename live → .bak, move download → live
    const bakPath = asarPath + '.bak'
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath)
    if (fs.existsSync(asarPath)) fs.renameSync(asarPath, bakPath)
    fs.renameSync(tmpPath, asarPath)

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('update-restart', () => {
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('update-version', () => APP_VERSION)

// =====================
// APP LIFECYCLE
// =====================
app.whenReady().then(() => {
  setupAppfolioSession()
  setupOutlookSession()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})