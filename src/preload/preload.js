'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Everything the renderer can do lives here, explicitly. The renderer has
 * no Node integration (see main.js's webPreferences) and cannot reach fs,
 * child_process, etc. directly -- only these specific, narrow operations.
 */
contextBridge.exposeInMainWorld('qtiApp', {
  selectQtiFiles: () => ipcRenderer.invoke('dialog:select-qti-files'),
  selectOutputDir: () => ipcRenderer.invoke('dialog:select-output-dir'),
  processFiles: (filePaths, outputDir, sortMode) =>
    ipcRenderer.invoke('process:run', { filePaths, outputDir, sortMode }),
  onProcessProgress: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('process:progress', listener);
    return () => ipcRenderer.removeListener('process:progress', listener);
  },

  getStyle: () => ipcRenderer.invoke('style:get'),
  saveStyle: (cssText) => ipcRenderer.invoke('style:save', cssText),
  resetStyle: () => ipcRenderer.invoke('style:reset'),

  revealInFolder: (targetPath) => ipcRenderer.invoke('shell:reveal-in-folder', targetPath),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),

  onMenuSelectFiles: (callback) => ipcRenderer.on('menu:select-files', callback),
  onMenuSelectOutputDir: (callback) => ipcRenderer.on('menu:select-output-dir', callback),
  onMenuOpenStyleEditor: (callback) => ipcRenderer.on('menu:open-style-editor', callback),
});
