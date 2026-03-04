const { contextBridge, ipcRenderer } = require('electron')

// =====================
// RENDERER API
// Exposes specific IPC channels to index.html via window.halq
// =====================
contextBridge.exposeInMainWorld('halq', {

  // --- Credentials ---
  credsSave:  (email, password) => ipcRenderer.invoke('creds-save', { email, password }),
  credsLoad:  ()                => ipcRenderer.invoke('creds-load'),
  credsClear: ()                => ipcRenderer.invoke('creds-clear'),

  // --- Settings PIN ---
  pinSave:  (pin) => ipcRenderer.invoke('pin-save',  { pin }),
  pinLoad:  ()    => ipcRenderer.invoke('pin-load'),
  pinClear: ()    => ipcRenderer.invoke('pin-clear'),

  // --- Dialogs ---
  dialogOpen: (options) => ipcRenderer.invoke('dialog-open', options),

  // --- Excel ---
  excelLoad:   ()               => ipcRenderer.invoke('excel-load'),
  excelImport: (filePath)       => ipcRenderer.invoke('excel-import', filePath),
  macroRun:    (macroName)      => ipcRenderer.invoke('macro-run', macroName),

  // --- Menu bar ---
  toggleMenuBar: (visible) => ipcRenderer.send('toggle-menubar', visible),

  // --- WO Tags ---
  woTagsSave: (tags) => ipcRenderer.invoke('wo-tags-save', tags),
  woTagsLoad: ()     => ipcRenderer.invoke('wo-tags-load'),

  // --- Categories ---
  categoriesSave: (cats) => ipcRenderer.invoke('categories-save', cats),
  categoriesLoad: ()     => ipcRenderer.invoke('categories-load'),

  // --- New tab from webview link ---
  onNewTab: (callback) => ipcRenderer.on('open-new-tab', (_e, url) => callback(url))

})