'use strict';
const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const scanner = require('./scanner');
const uninstaller = require('./uninstaller');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a12' : '#eef0f6',
    title: 'Dezinstalator',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // Doar pentru testare automată: salvează o captură și închide aplicația
  if (process.env.DZ_SNAPSHOT) {
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(process.env.DZ_SNAPSHOT, img.toPNG());
      app.quit();
    }, 6000));
  }
  win.on('maximize', () => win.webContents.send('window-state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('window-state', { maximized: false }));

  // Linkurile externe se deschid în browser, nu în aplicație
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

const progress = (text) => {
  if (win && !win.isDestroyed()) win.webContents.send('progress', text);
};

// Interfața trimite doar cheile; obiectele reale rămân aici, ca să nu poată fi falsificate.
let cache = new Map();
let allowedLeftovers = new Set();
const pick = (keys) => (Array.isArray(keys) ? keys : []).map((k) => cache.get(k)).filter(Boolean);

ipcMain.handle('scan', async () => {
  const res = await scanner.scanAll();
  cache = new Map(res.items.map((i) => [i.key, i]));
  return res;
});
ipcMain.handle('preview', async (_e, keys) => {
  const res = await uninstaller.preview(pick(keys));
  allowedLeftovers = new Set(res.leftovers.map((l) => l.path));
  return res;
});
ipcMain.handle('uninstall', async (_e, keys, options) => {
  const leftovers = ((options && options.leftovers) || []).filter((p) => allowedLeftovers.has(p));
  return uninstaller.uninstall(pick(keys), { leftovers }, progress);
});
ipcMain.handle('clean-flatpak', async () => uninstaller.cleanUnusedFlatpak(progress));
ipcMain.handle('show-in-folder', async (_e, p) => {
  if (typeof p === 'string' && p.startsWith('/')) shell.showItemInFolder(p);
});
ipcMain.handle('theme-get', () => ({ dark: nativeTheme.shouldUseDarkColors }));
ipcMain.handle('theme-set', (_e, mode) => {
  nativeTheme.themeSource = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
  return { dark: nativeTheme.shouldUseDarkColors };
});
ipcMain.on('win', (_e, action) => {
  if (!win) return;
  if (action === 'close') win.close();
  else if (action === 'min') win.minimize();
  else if (action === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
});

nativeTheme.on('updated', () => {
  if (win && !win.isDestroyed()) win.webContents.send('theme', { dark: nativeTheme.shouldUseDarkColors });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
