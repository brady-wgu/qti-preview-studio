'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

const { processArchive } = require('../../lib/qti/process-archive');
const { StyleManager } = require('../../lib/style/style-manager');

// ---------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------
// app.getAppPath() resolves correctly both in dev (project root) and in a
// packaged build (inside the asar/resources), since lib/ and assets/ are
// included via the "files" list in package.json's build config.
const APP_ROOT = app.getAppPath();
const BASELINE_CSS_PATH = path.join(APP_ROOT, 'lib', 'style', 'baseline.css');
const KATEX_ASSETS_DIR = path.join(APP_ROOT, 'assets', 'katex');

let mainWindow = null;
let styleManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    webPreferences: {
      // Security posture: no Node integration in the renderer, context
      // isolation on, and all main-process capability exposed narrowly
      // through preload.js's contextBridge API. The renderer never gets
      // direct fs/child_process/etc. access.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(true);
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Select QTI Files\u2026', click: () => mainWindow.webContents.send('menu:select-files') },
        { label: 'Choose Output Location\u2026', click: () => mainWindow.webContents.send('menu:select-output-dir') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Style Editor', click: () => mainWindow.webContents.send('menu:open-style-editor') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Quick Start Guide',
          click: () => shell.openPath(path.join(APP_ROOT, 'docs', 'QUICKSTART.md')),
        },
        {
          label: 'About QTI Preview Studio',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About QTI Preview Studio',
              message: 'QTI Preview Studio',
              detail: `Version ${app.getVersion()}\nOffline QTI (v1.2 / v2.1) item bank previewer.`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  styleManager = new StyleManager(app.getPath('userData'), BASELINE_CSS_PATH);
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------
// IPC handlers -- the only surface the renderer can reach (via preload.js)
// ---------------------------------------------------------------------

ipcMain.handle('dialog:select-qti-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select QTI archive(s) to process',
    filters: [{ name: 'QTI Archives', extensions: ['zip'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('dialog:select-output-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose where to create output folders',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('process:run', async (event, { filePaths, outputDir, sortMode }) => {
  const results = [];
  for (const filePath of filePaths) {
    const archiveBaseName = path.basename(filePath, path.extname(filePath));
    try {
      const buf = fs.readFileSync(filePath);
      const summary = processArchive(buf, archiveBaseName, outputDir, {
        sortMode,
        styleCssPath: styleManager.getEffectiveCssPath(),
        katexAssetsDir: KATEX_ASSETS_DIR,
      });
      results.push({ ...summary, ok: true });
    } catch (e) {
      results.push({ archiveBaseName, ok: false, error: e.message });
    }
    mainWindow.webContents.send('process:progress', { archiveBaseName, done: true });
  }
  return results;
});

ipcMain.handle('style:get', () => ({
  css: styleManager.getEffectiveCss(),
  isOverride: styleManager.hasOverride(),
  overrideFilePath: styleManager.getOverrideFilePath(),
}));

ipcMain.handle('style:save', (event, cssText) => {
  styleManager.saveOverride(cssText);
  return { ok: true };
});

ipcMain.handle('style:reset', () => {
  styleManager.resetToBaseline();
  return { ok: true };
});

ipcMain.handle('shell:reveal-in-folder', (event, targetPath) => {
  shell.showItemInFolder(targetPath);
});

ipcMain.handle('shell:open-path', (event, targetPath) => {
  shell.openPath(targetPath);
});
