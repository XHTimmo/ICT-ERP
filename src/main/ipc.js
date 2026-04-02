const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const Store = require('electron-store');
const { initDB, addReimbursement, getReimbursements, getReimbursement, updateReimbursementStatus, deleteReimbursement, updateReimbursementProofs, updateReimbursementAmount, updateReimbursement, getDashboardStats, getCategories, addCategory, deleteCategory, updateCategoryOrder, getTravels, addTravel, updateTravel, deleteTravel, getClaims, addClaim, deleteClaim, removeClaimItem, updateClaimItemsStatus } = require('./database');
const archiver = require('archiver');
const { createWriteStream } = require('fs');

const store = new Store();

const escapeHtml = (text = '') => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const travelPermissionMap = {
  admin: { upload: true, view: true, delete: true, export: true },
  editor: { upload: true, view: true, delete: false, export: true },
  viewer: { upload: false, view: true, delete: false, export: false }
};

const getCurrentRole = () => store.get('currentUserRole') || 'admin';
const isTravelPermissionControlEnabled = () => store.get('enableTravelPermissionControl') === true;

const ensureTravelPermission = (action) => {
  if (!isTravelPermissionControlEnabled()) {
    return;
  }
  const role = getCurrentRole();
  const permissions = travelPermissionMap[role] || travelPermissionMap.admin;
  if (!permissions[action]) {
    throw new Error('当前用户无权限执行该操作');
  }
};

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

  ipcMain.handle('get-current-role', () => {
    return getCurrentRole();
  });

  ipcMain.handle('set-current-role', (event, role) => {
    const validRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'admin';
    store.set('currentUserRole', validRole);
    return validRole;
  });

  ipcMain.handle('get-travel-permission-control', () => {
    return isTravelPermissionControlEnabled();
  });

  ipcMain.handle('set-travel-permission-control', (event, enabled) => {
    const nextValue = Boolean(enabled);
    store.set('enableTravelPermissionControl', nextValue);
    return nextValue;
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

  ipcMain.handle('get-file-meta', async (event, filePath) => {
    if (!filePath) return null;
    try {
      const stat = await fs.stat(filePath);
      return {
        name: path.basename(filePath),
        size: stat.size,
        uploadedAt: Date.now(),
        ext: path.extname(filePath).toLowerCase()
      };
    } catch (error) {
      return null;
    }
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
        receipt_no: data.receipt_no,
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

  ipcMain.handle('export-travel-report', async (event, { rows = [], format = 'excel' }) => {
    try {
      ensureTravelPermission('export');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const isPdf = format === 'pdf';
      const defaultPath = isPdf
        ? `travel_export_${timestamp}.pdf`
        : `travel_export_${timestamp}.csv`;

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出差旅明细',
        defaultPath,
        filters: isPdf
          ? [{ name: 'PDF Files', extensions: ['pdf'] }]
          : [{ name: 'Excel Files', extensions: ['csv'] }]
      });

      if (!filePath) {
        return { success: false, cancelled: true };
      }

      const header = ['ID', '序号', '报销单号', '日期', '报销名称', '金额', '类别', '状态', '备注', '目的地', '出差时间', '单据数量'];
      const csvRows = rows.map((row, index) => {
        const cols = [
          row.id || '',
          index + 1,
          row.receipt_no || '',
          row.date || '',
          row.name || '',
          row.amount ?? 0,
          row.category || '差旅',
          row.status || '',
          row.description || '',
          row.destination || '',
          row.travelDates || '',
          row.documentCount ?? 0
        ];
        return cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = '\uFEFF' + header.join(',') + '\n' + csvRows.join('\n');

      if (!isPdf) {
        await fs.writeFile(filePath, csvContent, 'utf8');
        return { success: true, filePath };
      }

      const tableRows = rows.map((row, index) => {
        return `<tr>
          <td>${escapeHtml(row.id || '')}</td>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.receipt_no || '')}</td>
          <td>${escapeHtml(row.date || '')}</td>
          <td>${escapeHtml(row.name || '')}</td>
          <td>${escapeHtml(String(row.amount ?? 0))}</td>
          <td>${escapeHtml(row.category || '差旅')}</td>
          <td>${escapeHtml(row.status || '')}</td>
          <td>${escapeHtml(row.description || '')}</td>
          <td>${escapeHtml(row.destination || '')}</td>
          <td>${escapeHtml(row.travelDates || '')}</td>
          <td>${escapeHtml(String(row.documentCount ?? 0))}</td>
        </tr>`;
      }).join('');

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>差旅导出</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif; font-size: 12px; color: #303133; padding: 24px; }
    h1 { margin: 0 0 12px 0; font-size: 18px; }
    .meta { margin-bottom: 12px; color: #606266; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #dcdfe6; padding: 6px 8px; word-break: break-all; }
    th { background: #f5f7fa; }
  </style>
</head>
<body>
  <h1>差旅明细导出清单</h1>
  <div class="meta">共 ${rows.length} 条，导出时间 ${new Date().toLocaleString()}</div>
  <table>
    <thead>
      <tr>${header.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true
        }
      });
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await printWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true
      });
      await fs.writeFile(filePath, pdfBuffer);
      printWindow.destroy();
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Travel Management
  ipcMain.handle('get-travels', () => {
    try {
      ensureTravelPermission('view');
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
      ensureTravelPermission('upload');
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
      ensureTravelPermission('upload');
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
      ensureTravelPermission('delete');
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return deleteTravel(id);
    } catch (error) {
      console.error('Error deleting travel:', error);
      throw error;
    }
  });

  // --- Claims ---
  ipcMain.handle('get-claims', () => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      return getClaims();
    } catch (error) {
      console.error('Error getting claims:', error);
      throw error;
    }
  });

  ipcMain.handle('add-claim', async (event, { data, item_ids }) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      
      const claimId = uuidv4();
      const actualId = addClaim({ id: claimId, ...data }, item_ids);
      return { success: true, id: actualId };
    } catch (error) {
      console.error('Error adding claim:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-claim', async (event, id) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      deleteClaim(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting claim:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('remove-claim-item', async (event, { claim_id, item_id }) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      removeClaimItem(claim_id, item_id);
      return { success: true };
    } catch (error) {
      console.error('Error removing claim item:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-claim-items-status', async (event, { claim_id, status }) => {
    try {
      const storagePath = store.get('storagePath');
      if (!storagePath) throw new Error('Storage path not set');
      initDB(storagePath);
      updateClaimItemsStatus(claim_id, status);
      return { success: true };
    } catch (error) {
      console.error('Error updating claim items status:', error);
      return { success: false, error: error.message };
    }
  });

  // Export ZIP
  ipcMain.handle('export-zip', async (event, reimbursementIds) => {
    console.log('--- EXPORT ZIP STARTED ---');
    console.log('IDs:', reimbursementIds);
    try {
      let storagePath = store.get('storagePath');
      console.log('Storage path (from store):', storagePath);
      
      if (!storagePath) {
        // Fallback to Downloads
        storagePath = app.getPath('downloads');
        console.log('Storage path missing, using Downloads:', storagePath);
      }
      
      // Ensure storage path exists
      if (!await fs.pathExists(storagePath)) {
        console.error('Storage path does not exist on disk:', storagePath);
        try {
          await fs.ensureDir(storagePath);
          console.log('Created missing directory:', storagePath);
        } catch (e) {
          storagePath = app.getPath('downloads');
          console.warn('Failed to create storage path, fallback to Downloads:', storagePath);
        }
      }

      console.log('Preparing file path...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `reimbursements_export_${timestamp}.zip`;
      const filePath = path.join(storagePath, filename);
      
      console.log('Exporting directly to:', filePath);
      
      await new Promise((resolve, reject) => {
        const output = createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', function() {
          console.log(archive.pointer() + ' total bytes');
          console.log('archiver has been finalized and the output file descriptor has closed.');
          resolve();
        });
        
        output.on('error', function(err) {
          console.error('Output stream error:', err);
          reject(err);
        });
        
        archive.on('warning', function(err) {
          if (err.code === 'ENOENT') {
            console.warn('Archiver warning:', err);
          } else {
            console.error('Archiver error:', err);
            reject(err);
          }
        });
        
        archive.on('error', function(err) {
          console.error('Archiver fatal error:', err);
          reject(err);
        });
    
        archive.pipe(output);
        
        const reimbursements = getReimbursements().filter(r => reimbursementIds.includes(r.id));
        console.log('Reimbursements to export:', reimbursements.length);
        
        // Generate CSV Manifest
        const csvHeader = 'ID,序号,报销单号,日期,报销名称,金额,类别,状态,备注,实物照片,电子发票,支付截图\n';
        const csvRows = reimbursements.map(r => {
          let proofs = r.proofs || {};
          if (typeof proofs === 'string') {
            try { proofs = JSON.parse(proofs); } catch(e) {}
          }
          
          const safeName = (r.name || '').replace(/"/g, '""');
          const safeDesc = (r.description || '').replace(/"/g, '""');
          const receiptNo = (r.receipt_no || '').replace(/"/g, '""');
          
          const getBaseNames = (p) => {
             if (!p) return '';
             if (Array.isArray(p)) return p.map(f => path.basename(f)).join('; ');
             return path.basename(p);
          };

          const pPhoto = getBaseNames(proofs.physical_photo);
          const eInvoice = getBaseNames(proofs.electronic_invoice);
          const pScreenshot = getBaseNames(proofs.payment_screenshot);
          
          return `"${r.id}","${r.serial_no || ''}","${receiptNo}","${r.date}","${safeName}","${r.amount}","${r.category}","${r.status}","${safeDesc}","${pPhoto}","${eInvoice}","${pScreenshot}"`;
        }).join('\n');
        
        archive.append('\uFEFF' + csvHeader + csvRows, { name: 'manifest.csv' });
        
        // Add files
        (async () => {
          try {
            for (const r of reimbursements) {
              let proofs = r.proofs || {};
              if (typeof proofs === 'string') {
                try { proofs = JSON.parse(proofs); } catch(e) {}
              }

              const safeName = (r.name || '未命名').replace(/[\\/:*?"<>|]/g, '_');
              const folderName = `${r.date}_${safeName}_${r.amount}`;
              
              const addProofFiles = async (files, prefix) => {
                if (!files) return;
                const fileList = Array.isArray(files) ? files : [files];
                
                for (let i = 0; i < fileList.length; i++) {
                  let fPath = fileList[i];
                  if (!fPath) continue;
                  
                  if (!path.isAbsolute(fPath)) {
                    fPath = path.join(storagePath, fPath);
                  }

                  if (await fs.pathExists(fPath)) {
                    archive.file(fPath, { name: `${folderName}/${prefix}_${path.basename(fPath)}` });
                  }
                }
              };

              await addProofFiles(proofs.physical_photo, 'physical');
              await addProofFiles(proofs.electronic_invoice, 'invoice');
              await addProofFiles(proofs.payment_screenshot, 'payment');
            }
            
            console.log('Finalizing archive...');
            await archive.finalize();
          } catch (err) {
            reject(err);
          }
        })();
      });
      
      console.log('Archive finalized successfully');
      
      return { success: true, filePath };
      
    } catch (error) {
      console.error('--- EXPORT FAILED ---');
      console.error(error);
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
