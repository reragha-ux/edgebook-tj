// Exposes only the desktop features the helper pages need. Edgebook.html itself doesn't use any of it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('edgebookDesktop', {
  migrateStatus: () => ipcRenderer.invoke('migrate:status'),
  migrateRun: () => ipcRenderer.invoke('migrate:run'),
  migrateDone: () => ipcRenderer.invoke('migrate:done'),
  licenseGet: () => ipcRenderer.invoke('license:get'),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseBuy: () => ipcRenderer.invoke('license:buy'),
  licenseClose: () => ipcRenderer.invoke('license:close'),
});
