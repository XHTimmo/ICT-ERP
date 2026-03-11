const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');
const { initDB, addReimbursement, getReimbursements, getReimbursement, updateReimbursementStatus, deleteReimbursement, updateReimbursementProofs, updateReimbursementAmount, updateReimbursement, getDashboardStats, getCategories, addCategory, deleteCategory, updateCategoryOrder } = require('./database');
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
      return getReimbursements();
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
            // Add index if there are multiple files or just always add it to be safe/consistent
            const indexSuffix = fileList.length > 1 ? `_${i + 1}` : ''; 
            // If it's the first file and only one, maybe keep old format? 
            // User asked for "multiple proofs", so consistent naming is better.
            // Let's use index if > 1, or maybe always use index to avoid overwriting if user uploads same file twice?
            // Let's use index 1, 2, 3... always for clarity if we change to multi-file.
            // But to keep it clean for single file:
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
            proofs[key].push(finalDestPath);
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

      const updatedProofs = {};

      for (const [key, files] of Object.entries(proofs)) {
        updatedProofs[key] = [];
        const fileList = Array.isArray(files) ? files : (files ? [files] : []);

        for (let i = 0; i < fileList.length; i++) {
          const filePath = fileList[i];
          if (!filePath) continue;

          // Check if file is already in storage
          if (filePath.startsWith(attachmentsPath)) {
            updatedProofs[key].push(filePath);
          } else {
            // New file, needs to be copied and renamed
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
            
            // Avoid overwriting existing files with same name (e.g. if re-uploading or name collision)
            if (await fs.pathExists(destPath)) {
               const timestamp = Date.now();
               const fileNameWithTime = `${safeName}_${materialType}_${record.amount}${suffix}_${timestamp}${ext}`;
               destPath = path.join(attachmentsPath, fileNameWithTime);
            }

            await fs.copy(filePath, destPath);
            updatedProofs[key].push(destPath);
          }
        }
      }

      updateReimbursementProofs(id, updatedProofs, action, details);
      return { success: true };
    } catch (error) {
      console.error('Error updating proofs:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete Reimbursement
  ipcMain.handle('delete-reimbursement', async (event, id) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      
      // Get reimbursement to find files to delete (optional, skipping actual file deletion for safety or keeping history)
      // For now, we just delete the record from DB
      deleteReimbursement(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting reimbursement:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Export ZIP
  ipcMain.handle('export-zip', async (event, reimbursementIds) => {
    console.log('--- EXPORT ZIP STARTED ---');
    try {
      let storagePath = store.get('storagePath');
      if (!storagePath) {
        storagePath = app.getPath('downloads');
      }
      
      const attachmentsPath = path.join(storagePath, 'attachments');
      await fs.ensureDir(storagePath);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `reimbursements_export_${timestamp}.zip`;
      const filePath = path.join(storagePath, filename);
      
      const output = createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      const promise = new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
      });

      archive.pipe(output);

      const allReimbursements = getReimbursements();
      const reimbursements = allReimbursements.filter(r => reimbursementIds.includes(r.id));
      
      // Helper for cross-platform basename
      const getBasename = (p) => {
        if (!p) return '';
        // Handle both Windows and POSIX separators
        return p.split(/[/\\]/).pop();
      };

      // Generate CSV Manifest
      const csvHeader = 'ID,序号,日期,报销名称,金额,类别,状态,备注,实物照片,电子发票,支付截图\n';
      const csvRows = reimbursements.map(r => {
        let proofs = r.proofs || {};
        if (typeof proofs === 'string') {
          try { proofs = JSON.parse(proofs); } catch(e) { proofs = {}; }
        }
        
        const getBaseNames = (p) => {
          if (!p) return '';
          const fileList = Array.isArray(p) ? p : [p];
          return fileList.map(f => getBasename(f)).join('; ');
        };

        return `"${r.id}","${r.serial_no || ''}","${r.date}","${(r.name || '').replace(/"/g, '""')}","${r.amount}","${r.category}","${r.status}","${(r.description || '').replace(/"/g, '""')}","${getBaseNames(proofs.physical_photo)}","${getBaseNames(proofs.electronic_invoice)}","${getBaseNames(proofs.payment_screenshot)}"`;
      }).join('\n');
      
      archive.append(csvHeader + csvRows, { name: 'manifest.csv' });

      // Add files with path fixing
      for (const r of reimbursements) {
        let proofs = r.proofs || {};
        if (typeof proofs === 'string') {
          try { proofs = JSON.parse(proofs); } catch(e) { proofs = {}; }
        }

        const safeName = (r.name || '未命名').replace(/[\\/:*?"<>|]/g, '_');
        const folderName = `${r.date}_${safeName}_${r.amount}`;
        
        const addProofFiles = async (files, typeLabel) => {
          if (!files) return;
          const fileList = Array.isArray(files) ? files : [files];
          
          for (const fPath of fileList) {
            if (!fPath) continue;
            
            const fileName = getBasename(fPath);
            
            // Try original path, then try current attachments directory
            let actualPath = fPath;
            if (!(await fs.pathExists(actualPath))) {
              actualPath = path.join(attachmentsPath, fileName);
            }

            if (await fs.pathExists(actualPath)) {
              archive.file(actualPath, { name: `${folderName}/${typeLabel}_${fileName}` });
            } else {
              console.warn(`File not found, skipping: ${fPath} (tried: ${actualPath})`);
            }
          }
        };

        await addProofFiles(proofs.physical_photo, 'physical');
        await addProofFiles(proofs.electronic_invoice, 'invoice');
        await addProofFiles(proofs.payment_screenshot, 'payment');
      }
      
      await archive.finalize();
      await promise;
      
      return { success: true, filePath };
    } catch (error) {
      console.error('--- EXPORT FAILED ---', error);
      return { success: false, error: error.message };
    }
  });

  // Open File
  ipcMain.handle('open-file', async (event, filePath) => {
      const { shell } = require('electron');
      if (await fs.pathExists(filePath)) {
          await shell.openPath(filePath);
          return true;
      }
      return false;
  });
}

module.exports = { setupIPC };
