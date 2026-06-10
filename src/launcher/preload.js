const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  // Load all profiles (annotated with running state)
  profilesLoad:      ()               => ipcRenderer.invoke('profiles-load'),
  // Save full profiles array (after create/edit/delete)
  profilesSave:      (profiles)       => ipcRenderer.invoke('profiles-save', profiles),
  // Launch HALQ for a profile
  profileLaunch:     (profileId)      => ipcRenderer.invoke('profile-launch', profileId),
  // Get latest running state map { profileId: bool }
  profileRunningState: ()             => ipcRenderer.invoke('profile-running-state'),
  // Delete a profile's data folder (called after removing from list)
  profileDeleteData: (profileId)      => ipcRenderer.invoke('profile-delete-data', profileId),
  // Live running-state push from main (every 5s)
  onRunningUpdate: (cb) => ipcRenderer.on('running-state-update', (_e, state) => cb(state)),
})
