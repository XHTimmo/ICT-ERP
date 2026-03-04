const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Storage
  getStoragePath: () => ipcRenderer.invoke('get-storage-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  setStoragePath: (path) => ipcRenderer.invoke('set-storage-path', path),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  
  // Reimbursements
  getReimbursements: () => ipcRenderer.invoke('get-reimbursements'),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getCategories: () => ipcRenderer.invoke('get-categories'),
  addReimbursement: (data) => ipcRenderer.invoke('add-reimbursement', data),
  updateReimbursementStatus: (data) => ipcRenderer.invoke('update-reimbursement-status', data),
  updateReimbursementProofs: (data) => ipcRenderer.invoke('update-reimbursement-proofs', data),
  updateReimbursementAmount: (data) => ipcRenderer.invoke('update-reimbursement-amount', data),
  updateReimbursement: (data) => ipcRenderer.invoke('update-reimbursement', data),
  deleteReimbursement: (id) => ipcRenderer.invoke('delete-reimbursement', id),
  exportZip: (ids) => {
    console.log('[Preload] invoking export-zip with:', ids);
    return ipcRenderer.invoke('export-zip', ids);
  },
  
  // File
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

  // Auto Update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.removeListener('update-status', subscription);
  },
  onMessage: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('message', subscription);
    return () => ipcRenderer.removeListener('message', subscription);
  }
});
