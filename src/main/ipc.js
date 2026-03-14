const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');
const { initDB, addReimbursement, getReimbursements, getReimbursement, updateReimbursementStatus, deleteReimbursement, updateReimbursementProofs, updateReimbursementAmount, updateReimbursement, getDashboardStats, getCategories, addCategory, deleteCategory, updateCategoryOrder, getTravels, addTravel, updateTravel, deleteTravel } = require('./database');
const archiver = require('archiver');
const { createWriteStream } = require('fs');

const store = new Store();

function setupIPC(mainWindow) {
  // Get/Set Storage Path
  ipcMain.handle('get-storage-path', () => {
    return store.get('storagePath') || '';
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('set-storage-path', async (event, newPath) => {
    if (!newPath) return false;
    store.set('storagePath', newPath);
    return initDB(newPath);
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // Select File (Support multiple files)
  ipcMain.handle('select-file', async (event, filters = []) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters
    });
    if (result.canceled) return null;
    return result.filePaths; // Return array of paths
  });

  // Get Dashboard Stats
  ipcMain.handle('get-dashboard-stats', () => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return getDashboardStats();
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  });

  // Get historical categories
  ipcMain.handle('get-categories', () => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return getCategories();
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  });

  // Get Status Order
  ipcMain.handle('get-status-order', () => {
    return store.get('statusOrder') || ['材料不齐', '待提交', '待审核', '待打款', '已完成'];
  });

  // Set Status Order
  ipcMain.handle('set-status-order', (event, order) => {
    store.set('statusOrder', order);
    return true;
  });

  // Add Category
  ipcMain.handle('add-category', (event, name) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return addCategory(name);
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  });

  // Delete Category
  ipcMain.handle('delete-category', (event, id) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return deleteCategory(id);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  });

  // Update Category Order
  ipcMain.handle('update-category-order', (event, categories) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      updateCategoryOrder(categories);
      return true;
    } catch (error) {
      console.error('Error updating category order:', error);
      throw error;
    }
  });

  // Get Reimbursements
  ipcMain.handle('get-reimbursements', () => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      // Ensure DB is initialized
      initDB(storagePath);
      const records = getReimbursements();
      
      // Resolve relative paths for proofs
      return records.map(record => {
        if (record.proofs) {
          const resolvedProofs = {};
          for (const [key, files] of Object.entries(record.proofs)) {
            const fileList = Array.isArray(files) ? files : (files ? [files] : []);
            resolvedProofs[key] = fileList.map(filePath => {
              if (filePath && !path.isAbsolute(filePath)) {
                return path.join(storagePath, filePath);
              }
              return filePath;
            });
          }
          record.proofs = resolvedProofs;
        }
        return record;
      });
    } catch (error) {
      console.error('Error getting reimbursements:', error);
      throw error;
    }
  });

  // Add Reimbursement
  ipcMain.handle('add-reimbursement', async (event, data) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');

      const attachmentsPath = path.join(storagePath, 'attachments');
      await fs.ensureDir(attachmentsPath);

      const id = uuidv4();
      const proofs = {};

      // Process files
      for (const [key, files] of Object.entries(data.proofs)) {
        proofs[key] = [];
        // Ensure files is an array (backward compatibility or robustness)
        const fileList = Array.isArray(files) ? files : (files ? [files] : []);
        
        for (let i = 0; i < fileList.length; i++) {
          const filePath = fileList[i];
          if (filePath) {
            const ext = path.extname(filePath);
            // Renaming logic: Name + Material Type + Price + Index
            const materialTypeMap = {
              'physical_photo': '实物照片',
              'electronic_invoice': '电子发票',
              'payment_screenshot': '支付截图'
            };
            const materialType = materialTypeMap[key] || key;
            const safeName = (data.name || '未命名').replace(/[\\/:*?"<>|]/g, '_'); // Sanitize filename
            const suffix = fileList.length > 1 ? `_${i + 1}` : '';
            
            const fileName = `${safeName}_${materialType}_${data.amount}${suffix}${ext}`;
            
            const destPath = path.join(attachmentsPath, fileName);
            // Check if file exists, if so, append timestamp or random to avoid collision
            let finalDestPath = destPath;
            if (await fs.pathExists(finalDestPath)) {
               const timestamp = Date.now();
               const fileNameWithTime = `${safeName}_${materialType}_${data.amount}${suffix}_${timestamp}${ext}`;
               finalDestPath = path.join(attachmentsPath, fileNameWithTime);
            }

            await fs.copy(filePath, finalDestPath);
            // Store relative path to storage path
            proofs[key].push(path.relative(storagePath, finalDestPath));
          }
        }
      }

      const record = {
        id,
        date: data.date,
        amount: data.amount,
        category: data.category,
        name: data.name,
        description: data.description,
        proofs: JSON.stringify(proofs),
        status: data.status || '材料不齐', // Default status
        created_at: Date.now()
      };

      addReimbursement(record);
      return { success: true, id };
    } catch (error) {
      console.error('Error adding reimbursement:', error);
      return { success: false, error: error.message };
    }
  });

  // Update Reimbursement Status
  ipcMain.handle('update-reimbursement-status', async (event, { id, status, action, details }) => {
    try {
      updateReimbursementStatus(id, status, action, details);
      return { success: true };
    } catch (error) {
      console.error('Error updating status:', error);
      return { success: false, error: error.message };
    }
  });

  // Update Reimbursement Amount
  ipcMain.handle('update-reimbursement-amount', async (event, { id, amount, action, details }) => {
    try {
      updateReimbursementAmount(id, amount, action, details);
      return { success: true };
    } catch (error) {
      console.error('Error updating amount:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Update Reimbursement Generic (New)
  ipcMain.handle('update-reimbursement', async (event, { id, updates, action, details }) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      updateReimbursement(id, updates, action, details);
      return { success: true };
    } catch (error) {
      console.error('Error updating reimbursement:', error);
      return { success: false, error: error.message };
    }
  });

  // Update Reimbursement Proofs
  ipcMain.handle('update-reimbursement-proofs', async (event, { id, proofs, action, details }) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      const attachmentsPath = path.join(storagePath, 'attachments');
      await fs.ensureDir(attachmentsPath);

      // Get existing record for naming convention
      initDB(storagePath);
      const record = getReimbursement(id);
      if (!record) throw new Error('Reimbursement not found');

      // 1. Identify files to remove
      const oldFiles = new Set();
      if (record.proofs) {
        for (const files of Object.values(record.proofs)) {
          const fileList = Array.isArray(files) ? files : (files ? [files] : []);
          for (const f of fileList) {
            if (f) {
              // Resolve relative paths to absolute for reliable comparison
              const absPath = path.isAbsolute(f) ? f : path.join(storagePath, f);
              oldFiles.add(path.resolve(absPath));
            }
          }
        }
      }

      const updatedProofs = {};
      const newFiles = new Set();

      for (const [key, files] of Object.entries(proofs)) {
        updatedProofs[key] = [];
        const fileList = Array.isArray(files) ? files : (files ? [files] : []);

        for (let i = 0; i < fileList.length; i++) {
          const filePath = fileList[i];
          if (!filePath) continue;

          // Check if file is already in storage
          // If it's an absolute path inside storage, or relative path
          // We assume input filePath is usually absolute path from file selection
          
          let isExisting = false;
          const absFilePath = path.resolve(filePath);
          if (oldFiles.has(absFilePath)) {
             // File already exists in storage, just keep it
             // Store relative
             updatedProofs[key].push(path.relative(storagePath, absFilePath));
             newFiles.add(absFilePath);
             continue;
          }

          // New file, copy it
          const ext = path.extname(filePath);
          const materialTypeMap = {
              'physical_photo': '实物照片',
              'electronic_invoice': '电子发票',
              'payment_screenshot': '支付截图'
            };
          const materialType = materialTypeMap[key] || key;
          const safeName = (record.name || '未命名').replace(/[\\/:*?"<>|]/g, '_');
          const suffix = fileList.length > 1 ? `_${i + 1}` : '';
          
          const fileName = `${safeName}_${materialType}_${record.amount}${suffix}${ext}`;
          let destPath = path.join(attachmentsPath, fileName);
          
           if (await fs.pathExists(destPath)) {
               const timestamp = Date.now();
               const fileNameWithTime = `${safeName}_${materialType}_${record.amount}${suffix}_${timestamp}${ext}`;
               destPath = path.join(attachmentsPath, fileNameWithTime);
            }

          await fs.copy(filePath, destPath);
          updatedProofs[key].push(path.relative(storagePath, destPath));
          newFiles.add(path.resolve(destPath));
        }
      }
      
      // Delete removed files (optional, maybe we want to keep them?)
      // For now, let's NOT delete files to be safe, or implement later
      
      updateReimbursementProofs(id, updatedProofs, action, details);
      return { success: true };

    } catch (error) {
      console.error('Error updating proofs:', error);
      return { success: false, error: error.message };
    }
  });

  // Export Travel Proofs
  ipcMain.handle('export-travel-proofs', async (event, { applicant, date, itineraries }) => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出报销凭证',
        defaultPath: `${applicant || '差旅'}_${date || '日期'}_报销凭证.zip`,
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
      });

      if (!filePath) return { success: false, message: '已取消' };

      const output = createWriteStream(filePath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      archive.on('error', function(err) {
        throw err;
      });

      archive.pipe(output);

      for (let i = 0; i < itineraries.length; i++) {
        const leg = itineraries[i];
        // Ensure valid folder name
        const from = leg.from || '未知';
        const to = leg.to || '未知';
        
        let legDate = `行程${i+1}`;
        if (Array.isArray(leg.date) && leg.date.length > 0) {
            legDate = leg.date.join('至');
        } else if (typeof leg.date === 'string') {
            legDate = leg.date;
        }

        const folderName = `${legDate}_${from}-${to}`;
        
        const types = {
            ticket: '车票',
            hotelInvoice: '酒店发票',
            hotelStatement: '酒店水单',
            travelRequest: '出差申请'
        };

        for (const [key, label] of Object.entries(types)) {
            if (leg[key] && leg[key].path) {
                try {
                    if (await fs.pathExists(leg[key].path)) {
                        archive.file(leg[key].path, { name: `${folderName}/${label}${path.extname(leg[key].path)}` });
                    }
                } catch (e) {
                    console.error(`File access error: ${leg[key].path}`, e);
                }
            }
        }
      }

      await archive.finalize();
      return { success: true, filePath };

    } catch (error) {
      console.error('Error exporting proofs:', error);
      return { success: false, error: error.message };
    }
  });

  // Travel Management
  ipcMain.handle('get-travels', () => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return getTravels();
    } catch (error) {
      console.error('Error getting travels:', error);
      throw error;
    }
  });

  ipcMain.handle('add-travel', (event, data) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      
      // Ensure date is string (handle daterange array)
      const travelData = { ...data };
      if (Array.isArray(travelData.date)) {
        travelData.date = travelData.date.join(' 至 ');
      }
      
      // Handle optional fields
      if (travelData.applicant === undefined) travelData.applicant = null;
      
      return addTravel({ ...travelData, id: uuidv4() });
    } catch (error) {
      console.error('Error adding travel:', error);
      throw error;
    }
  });

  ipcMain.handle('update-travel', (event, { id, ...data }) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      
      const travelData = { ...data };
      if (Array.isArray(travelData.date)) {
        travelData.date = travelData.date.join(' 至 ');
      }
      
      return updateTravel(id, travelData);
    } catch (error) {
      console.error('Error updating travel:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-travel', (event, id) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return deleteTravel(id);
    } catch (error) {
      console.error('Error deleting travel:', error);
      throw error;
    }
  });

}

module.exports = { setupIPC };
