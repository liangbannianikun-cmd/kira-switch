const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('personaSwitch', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  chooseCard: () => ipcRenderer.invoke('card:choose'),
  importCard: (filePath) => ipcRenderer.invoke('card:import', filePath),
  removeCard: (cardId) => ipcRenderer.invoke('card:remove', cardId),
  previewPersona: (payload) => ipcRenderer.invoke('persona:preview', payload),
  applyPersona: (payload) => ipcRenderer.invoke('persona:apply', payload),
  disablePersona: (clientId) => ipcRenderer.invoke('persona:disable', clientId),
  restoreOperation: (operationId) => ipcRenderer.invoke('persona:restore', operationId),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetPath: (clientId) => ipcRenderer.invoke('settings:reset-path', clientId),
  showFile: (targetPath) => ipcRenderer.invoke('shell:show-file', targetPath)
});
