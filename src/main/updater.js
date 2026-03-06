const { autoUpdater } = require("electron-updater");
const log = require('electron-log');
const { ipcMain, BrowserWindow } = require('electron');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

let isInitialized = false;

function setupUpdater() {
  if (isInitialized) return;
  isInitialized = true;

  function sendStatusToWindow(text) {
    log.info(text);
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('message', text);
        }
    });
  }

  function sendEventToWindow(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    });
  }

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...');
    sendEventToWindow('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.');
    sendEventToWindow('update-status', { status: 'available', info });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.');
    sendEventToWindow('update-status', { status: 'not-available', info });
  });

  autoUpdater.on('error', (err) => {
    let message = err.message || err.toString();
    if (message.includes('404') && message.includes('github.com')) {
      message += '\n\n可能原因：\n1. GitHub 仓库是私有的 (Private)，请在 GitHub 设置中将其改为公开 (Public)。\n2. 发布配置错误，请检查 package.json 中的 repository 配置。';
    }
    sendStatusToWindow('Error in auto-updater. ' + message);
    sendEventToWindow('update-status', { status: 'error', error: message });
    log.error(err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message);
    sendEventToWindow('update-status', { status: 'downloading', progress: progressObj });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded');
    sendEventToWindow('update-status', { status: 'downloaded', info });
  });

  // IPC handlers
  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });
}

module.exports = { setupUpdater };
