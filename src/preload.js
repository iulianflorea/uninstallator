'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  scan: () => ipcRenderer.invoke('scan'),
  preview: (items) => ipcRenderer.invoke('preview', items),
  uninstall: (items, options) => ipcRenderer.invoke('uninstall', items, options),
  cleanFlatpak: () => ipcRenderer.invoke('clean-flatpak'),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),
  getTheme: () => ipcRenderer.invoke('theme-get'),
  setTheme: (mode) => ipcRenderer.invoke('theme-set', mode),
  win: (action) => ipcRenderer.send('win', action),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, t) => cb(t)),
  onTheme: (cb) => ipcRenderer.on('theme', (_e, t) => cb(t)),
  onWindowState: (cb) => ipcRenderer.on('window-state', (_e, s) => cb(s)),
});
