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
  getStatusOrder: () => ipcRenderer.invoke('get-status-order'),
  setStatusOrder: (order) => ipcRenderer.invoke('set-status-order', order),
  addCategory: (name) => ipcRenderer.invoke('add-category', name),
  deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
  updateCategoryOrder: (categories) => ipcRenderer.invoke('update-category-order', categories),
  addReimbursement: (data) => ipcRenderer.invoke('add-reimbursement', data),
  updateReimbursementStatus: (data) => ipcRenderer.invoke('update-reimbursement-status', data),
  updateReimbursementProofs: (data) => ipcRenderer.invoke('update-reimbursement-proofs', data),
  updateReimbursementAmount: (data) => ipcRenderer.invoke('update-reimbursement-amount', data),
  updateReimbursement: (data) => ipcRenderer.invoke('update-reimbursement', data),
  deleteReimbursement: (id) => ipcRenderer.invoke('delete-reimbursement', id),
  exportTravelProofs: (data) => ipcRenderer.invoke('export-travel-proofs', data),
  
  // Travel Management
  getTravels: () => ipcRenderer.invoke('get-travels'),
  addTravel: (data) => ipcRenderer.invoke('add-travel', data),
  updateTravel: (data) => ipcRenderer.invoke('update-travel', data),
  deleteTravel: (id) => ipcRenderer.invoke('delete-travel', id),

  // Claims
  getClaims: () => ipcRenderer.invoke('get-claims'),
  addClaim: (data) => ipcRenderer.invoke('add-claim', data),
  deleteClaim: (id) => ipcRenderer.invoke('delete-claim', id),
  removeClaimItem: (data) => ipcRenderer.invoke('remove-claim-item', data),
  updateClaimItemsStatus: (data) => ipcRenderer.invoke('update-claim-items-status', data),

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
