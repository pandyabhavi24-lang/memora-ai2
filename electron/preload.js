const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  isElectron: true
});
