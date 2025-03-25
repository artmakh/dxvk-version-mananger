const { contextBridge, ipcRenderer } = require('electron');

// Make sure this code runs by adding a log statement
console.log('Preload script is running');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    getSteamGames: () => ipcRenderer.invoke('get-steam-games'),
    getGameMetadata: (appId) => ipcRenderer.invoke('get-game-metadata', appId),
    
    // DXVK related functions
    getDxvkReleases: () => ipcRenderer.invoke('get-dxvk-releases'),
    downloadDxvkVersion: (version, downloadUrl) => 
      ipcRenderer.invoke('download-dxvk-version', version, downloadUrl),
      
    // DXVK-gplasync related functions
    getGplasyncReleases: () => ipcRenderer.invoke('get-gplasync-releases'),
    downloadGplasyncVersion: (version, downloadUrl) => 
      ipcRenderer.invoke('download-gplasync-version', version, downloadUrl),
      
    // DXVK management functions
    getInstalledDxvkVersions: () => ipcRenderer.invoke('get-installed-dxvk-versions'),
    applyDxvkToGame: (gameId, dxvkType, version) => 
      ipcRenderer.invoke('apply-dxvk-to-game', gameId, dxvkType, version),
      
    // Game DXVK status
    getGameDxvkStatus: (gameId) => ipcRenderer.invoke('get-game-dxvk-status', gameId),
    restoreOriginalDlls: (game) => ipcRenderer.invoke('restore-original-dlls', game.appid),
    
    // New functions for enhanced DLL management
    checkBackupExists: (gameDir) => ipcRenderer.invoke('check-backup-exists', gameDir),
    removeDxvkFromGame: (game) => ipcRenderer.invoke('remove-dxvk-from-game', game.appid)
  }
);

// Log to confirm exposure
console.log('API exposed to renderer process'); 