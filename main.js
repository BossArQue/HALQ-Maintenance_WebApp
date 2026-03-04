const { app, BrowserWindow, ipcMain, safeStorage, session, dialog, shell } = require('electron')
const path     = require('path')
const fs       = require('fs')
const { exec } = require('child_process')
const XLSX     = require('xlsx')

// Derive paths from project root — no hardcoded absolute paths in source
const USER_DATA_DIR = path.join(__dirname, 'userdata')
const CRED_PATH     = path.join(USER_DATA_DIR, 'creds.enc')

app.setPath('userData', USER_DATA_DIR)
app.setPath('sessionData', path.join(USER_DATA_DIR, 'session'))

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
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  win.setMenuBarVisibility(false)

  // Block new BrowserWindow spawns from the main window itself.
  // Without this, Electron creates a second HALQ app window instead of a tab.
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
const AF_PARTITION   = 'persist:appfolio'
const ALLOWED_PERMISSION_SET = new Set([
  'media', 'geolocation', 'notifications',
  'fullscreen', 'pointerLock', 'openExternal'
])

// Excel workbook — path only, all logic stays inside the .xlsm macros
const EXCEL_PATH  = 'D:\\OneDrive\\Talley Properties\\Work Order Status Update.xlsm'
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
  vendor:   12,  // L — Vendor name
  notified: 15   // O — Tenant Notified (Yes/No)
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
// NATIVE FILE DIALOG
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
    if (!fs.existsSync(EXCEL_PATH)) {
      return { ok: false, error: 'Excel file not found at: ' + EXCEL_PATH }
    }

    const workbook    = XLSX.readFile(EXCEL_PATH, { cellDates: true, sheetStubs: true })
    const worksheet   = workbook.Sheets[EXCEL_SHEET]
    if (!worksheet) {
      return { ok: false, error: 'Sheet "' + EXCEL_SHEET + '" not found in workbook' }
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    // Skip header row (row 0), map each data row using AM_COL indices (convert to 0-based)
    const wos = rows.slice(1)
      .filter(row => {
        const wo = String(row[AM_COL.wo - 1] || '').trim()
        return wo !== '' && wo !== '0' && wo.length >= 2
      })
      .map(row => ({
        wo:       String(row[AM_COL.wo       - 1] || '').trim(),
        prop:     String(row[AM_COL.property - 1] || '').trim(),
        unit:     String(row[AM_COL.unit     - 1] || '').trim(),
        res:      String(row[AM_COL.resident - 1] || '').trim(),
        age:      Number(row[AM_COL.age      - 1]) || 0,
        job:      String(row[AM_COL.job      - 1] || '').trim(),
        status:   String(row[AM_COL.status   - 1] || '').trim(),
        vendor:   String(row[AM_COL.vendor   - 1] || '').trim(),
        notified: String(row[AM_COL.notified - 1] || '').trim()
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
    const psPath   = path.join(USER_DATA_DIR, 'macro.ps1')
    const psScript = [
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
      `  if (-not $wb) { $wb = $excel.Workbooks.Open('${EXCEL_PATH}') }`,
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
ipcMain.on('toggle-menubar', (event, visible) => {
  win.setMenuBarVisibility(visible)
})

// =====================
// APP LIFECYCLE
// =====================
app.whenReady().then(() => {
  setupAppfolioSession()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})