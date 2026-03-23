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
  macroRun:    (macroName)      => ipcRenderer.invoke('macro-run', macroName),

  // --- Notes ---
  notesMetaLoad:   ()                      => ipcRenderer.invoke('notes-meta-load'),
  notesMetaSave:   (data)                  => ipcRenderer.invoke('notes-meta-save', data),
  notesPageLoad:   (pageId)                => ipcRenderer.invoke('notes-page-load', pageId),
  notesPageSave:   (pageId, content)       => ipcRenderer.invoke('notes-page-save', pageId, content),
  notesPageDelete: (pageId)                => ipcRenderer.invoke('notes-page-delete', pageId),
  notesAssetSave:  (pageId, name, b64)     => ipcRenderer.invoke('notes-asset-save', pageId, name, b64),
  notesFileRead:   (filePath)              => ipcRenderer.invoke('notes-file-read', filePath),
  notesAssetOpen:  (filePath)              => ipcRenderer.invoke('notes-asset-open', filePath),
  notesExport:     (opts)                  => ipcRenderer.invoke('notes-export', opts),
  notesImport:     ()                      => ipcRenderer.invoke('notes-import'),
  notesCleanup:    ()                      => ipcRenderer.invoke('notes-cleanup'),

  // --- Menu bar ---
  toggleMenuBar: (visible) => ipcRenderer.send('toggle-menubar', visible),

  // --- WO Tags ---
  woTagsSave: (tags) => ipcRenderer.invoke('wo-tags-save', tags),
  woTagsLoad: ()     => ipcRenderer.invoke('wo-tags-load'),

  // --- Categories ---
  categoriesSave: (cats) => ipcRenderer.invoke('categories-save', cats),
  categoriesLoad: ()     => ipcRenderer.invoke('categories-load'),

  // --- New tab from webview link ---
  onNewTab: (callback) => ipcRenderer.on('open-new-tab', (_e, url) => callback(url)),

  // --- App Settings (Excel path, theme, layout, prefs) ---
  settingsLoad: ()       => ipcRenderer.invoke('settings-load'),
  settingsSave: (data)   => ipcRenderer.invoke('settings-save', data),

  // --- Profile info (which profile this window is running as) ---
  profileInfo: () => ipcRenderer.invoke('profile-info'),

  // --- Vendor Directory ---
  vendorsLoad:         ()          => ipcRenderer.invoke('vendors-load'),
  vendorsSave:         (vendors)   => ipcRenderer.invoke('vendors-save', vendors),
  vendorsImportExcel:  ()          => ipcRenderer.invoke('vendors-import-excel'),

  // --- Auto-updater ---
  updateCheck:    ()         => ipcRenderer.invoke('update-check'),
  updateDownload: (asarUrl)  => ipcRenderer.invoke('update-download', asarUrl),
  updateRestart:  ()         => ipcRenderer.invoke('update-restart'),
  updateVersion:  ()         => ipcRenderer.invoke('update-version'),

})