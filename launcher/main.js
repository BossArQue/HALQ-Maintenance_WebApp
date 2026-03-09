const { app, BrowserWindow, ipcMain } = require('electron')
const path     = require('path')
const fs       = require('fs')
const { spawn, execFile } = require('child_process')

// =====================
// PATHS
// profiles.json lives in the shared userdata root (not inside any profile folder)
// =====================
const BASE_DIR    = path.join(__dirname, '..', 'userdata')
const PROFILES_DB = path.join(BASE_DIR, 'profiles.json')

// =====================
// PROFILES DB
// { profiles: [ { id, name, url, color } ] }
// =====================
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

// =====================
// RUNNING PROCESS TRACKING
// Map<profileId, { pid, win? }>
// We detect if a process is still alive by checking if pid is still running.
// =====================
const running = new Map()  // profileId → { pid }

function isAlive (pid) {
  try { process.kill(pid, 0); return true }
  catch { return false }
}

function cleanupDead () {
  for (const [id, info] of running.entries()) {
    if (!isAlive(info.pid)) running.delete(id)
  }
}

// =====================
// LAUNCH HALQ FOR A PROFILE
// Dev:  electron . --profile=<id>
// Prod: HALQ.exe --profile=<id>   (sibling to launcher.exe)
// =====================
function launchProfile (profileId) {
  cleanupDead()
  if (running.has(profileId) && isAlive(running.get(profileId).pid)) {
    return { ok: true, alreadyRunning: true }
  }

  let child
  const profileArg = `--profile=${profileId}`

  if (app.isPackaged) {
    // Production: HALQ.exe lives next to launcher.exe
    const exePath = path.join(path.dirname(process.execPath), 'HALQ.exe')
    child = spawn(exePath, [profileArg], {
      detached: true,
      stdio: 'ignore'
    })
  } else {
    // Development: re-run electron on the project root
    const electronBin = process.execPath   // path to electron binary
    const projectRoot = path.join(__dirname, '..')
    child = spawn(electronBin, [projectRoot, profileArg], {
      detached: true,
      stdio: 'ignore',
      cwd: projectRoot
    })
  }

  child.unref()  // let the child outlive the launcher if needed
  running.set(profileId, { pid: child.pid })
  return { ok: true, pid: child.pid }
}

// =====================
// DELETE PROFILE DATA
// Removes the profile's data folder. Profile entry itself removed by renderer.
// =====================
function deleteProfileData (profileId) {
  const profileDir = path.join(BASE_DIR, 'profiles', profileId)
  try {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// =====================
// WINDOW
// =====================
let win

function createWindow () {
  win = new BrowserWindow({
    width: 520,
    height: 620,
    minWidth: 420,
    minHeight: 480,
    resizable: true,
    frame: true,
    title: 'HALQ Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, 'index.html'))
}

// =====================
// IPC HANDLERS
// =====================
ipcMain.handle('profiles-load', () => {
  cleanupDead()
  const db = dbLoad()
  // Annotate each profile with running state
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
    return launchProfile(profileId)
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('profile-running-state', () => {
  cleanupDead()
  const state = {}
  for (const [id, info] of running.entries()) {
    state[id] = isAlive(info.pid)
  }
  return { ok: true, state }
})

ipcMain.handle('profile-delete-data', (_e, profileId) => {
  // Kill the process if running
  if (running.has(profileId)) {
    try { process.kill(running.get(profileId).pid) } catch (_) {}
    running.delete(profileId)
  }
  return deleteProfileData(profileId)
})

// =====================
// APP LIFECYCLE
// =====================
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Poll running state every 5 seconds and push to renderer
setInterval(() => {
  if (win && !win.isDestroyed()) {
    cleanupDead()
    const state = {}
    for (const [id, info] of running.entries()) state[id] = isAlive(info.pid)
    win.webContents.send('running-state-update', state)
  }
}, 5000)
