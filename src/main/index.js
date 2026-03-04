const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setupIPC } = require('./ipc');
const { setupUpdater } = require('./updater');
const Store = require('electron-store');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const store = new Store();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false, // For better-sqlite3
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Initialize IPC handlers
  setupIPC(mainWindow);
}

app.on('ready', () => {
  // Ensure storage path is set or prompt user later
  const storagePath = store.get('storagePath');
  if (storagePath) {
    const { initDB } = require('./database');
    initDB(storagePath);
  }
  
  createWindow();
  setupUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
