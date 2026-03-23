const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

let db;

function initDB(storagePath) {
  try {
    const dbPath = path.join(storagePath, 'db');
    fs.ensureDirSync(dbPath);
    const dbFile = path.join(dbPath, 'erp.db');
    
    console.log('Initializing database at:', dbFile);

    if (db && db.open) {
      db.close();
    }
    
    db = new Database(dbFile);
    
    // Create tables
    // proofs will be stored as JSON string
    db.exec(`
      CREATE TABLE IF NOT EXISTS reimbursements (
        id TEXT PRIMARY KEY,
        serial_no INTEGER,
        receipt_no TEXT,
        date TEXT,
        amount REAL,
        category TEXT,
        name TEXT,
        description TEXT,
        proofs TEXT,
        status TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS travels (
        id TEXT PRIMARY KEY,
        applicant TEXT,
        date TEXT,
        reason TEXT,
        status TEXT,
        total_amount REAL DEFAULT 0,
        itineraries TEXT,
        created_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS reimbursement_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reimbursement_id TEXT,
        action TEXT,
        details TEXT,
        created_at INTEGER,
        FOREIGN KEY(reimbursement_id) REFERENCES reimbursements(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        claim_no TEXT UNIQUE,
        approval_date TEXT,
        created_at INTEGER
      );
    `);
    
    // Initialize default categories if table is empty
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    if (categoryCount === 0) {
      const defaultCategories = ['办公用品', '餐饮', '交通', '住宿', '团建', '其他'];
      const insert = db.prepare('INSERT INTO categories (name, sort_order, created_at) VALUES (?, ?, ?)');
      const now = Date.now();
      db.transaction(() => {
        defaultCategories.forEach((cat, index) => {
          insert.run(cat, index, now);
        });
      })();
    }
    
    // Migration: Add status column if not exists (simple check)
    try {
      db.exec("ALTER TABLE reimbursements ADD COLUMN status TEXT");
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add name column if not exists
    try {
      db.exec("ALTER TABLE reimbursements ADD COLUMN name TEXT");
    } catch (e) {
      // Column already exists, ignore
    }
    
    // Migration: Add serial_no column if not exists
    try {
      db.exec("ALTER TABLE reimbursements ADD COLUMN serial_no INTEGER");
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add receipt_no column if not exists
    try {
      db.exec("ALTER TABLE reimbursements ADD COLUMN receipt_no TEXT");
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add claim_id column to reimbursements if not exists
    try {
      const tableInfo = db.prepare("PRAGMA table_info(reimbursements)").all();
      const hasClaimId = tableInfo.some(col => col.name === 'claim_id');
      if (!hasClaimId) {
        db.exec("ALTER TABLE reimbursements ADD COLUMN claim_id TEXT");
      }
    } catch (e) {
      console.error('Migration error for claim_id:', e);
    }

    // Migration: Add total_amount to travels if not exists
    try {
      const tableInfo = db.prepare("PRAGMA table_info(travels)").all();
      const hasTotalAmount = tableInfo.some(col => col.name === 'total_amount');
      if (!hasTotalAmount) {
        db.exec("ALTER TABLE travels ADD COLUMN total_amount REAL DEFAULT 0");
      }
    } catch (e) {
      console.error('Migration error:', e);
    }
    
    // Ensure unique index on serial_no to avoid duplicates
    try {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_reimbursements_serial_no ON reimbursements(serial_no)");
    } catch (e) {
      // Ignore index creation errors
    }
    // Backfill serial_no for existing rows if missing
    try {
      const maxRow = db.prepare('SELECT IFNULL(MAX(serial_no), 0) AS maxno FROM reimbursements').get();
      let next = (maxRow.maxno || 0) + 1;
      const missing = db.prepare('SELECT id FROM reimbursements WHERE serial_no IS NULL ORDER BY created_at ASC, rowid ASC').all();
      const upd = db.prepare('UPDATE reimbursements SET serial_no = ? WHERE id = ?');
      const tx = db.transaction((rows) => {
        for (const r of rows) {
          upd.run(next++, r.id);
        }
      });
      if (missing.length) tx(missing);
    } catch (e) {
      // Ignore backfill errors, will assign on next inserts
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

function getDB() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function getNextSerialNo() {
  const row = getDB().prepare('SELECT IFNULL(MAX(serial_no), 0) + 1 AS next FROM reimbursements').get();
  return row.next || 1;
}

function addReimbursement(data) {
  const stmt = getDB().prepare(`
    INSERT INTO reimbursements (id, serial_no, receipt_no, date, amount, category, name, description, proofs, status, created_at)
    VALUES (@id, @serial_no, @receipt_no, @date, @amount, @category, @name, @description, @proofs, @status, @created_at)
  `);
  
  const logStmt = getDB().prepare(`
    INSERT INTO reimbursement_logs (reimbursement_id, action, details, created_at)
    VALUES (@reimbursement_id, @action, @details, @created_at)
  `);

  const transaction = getDB().transaction((reimbursement) => {
    const now = Date.now();
    const serial = reimbursement.serial_no || getNextSerialNo();
    stmt.run({ ...reimbursement, serial_no: serial, created_at: reimbursement.created_at || now });
    logStmt.run({
      reimbursement_id: reimbursement.id,
      action: '创建',
      details: '创建报销单',
      created_at: now
    });
  });
  
  return transaction(data);
}

function updateReimbursementStatus(id, status, action, details) {
  const stmt = getDB().prepare(`
    UPDATE reimbursements SET status = @status WHERE id = @id
  `);
  
  const logStmt = getDB().prepare(`
    INSERT INTO reimbursement_logs (reimbursement_id, action, details, created_at)
    VALUES (@reimbursement_id, @action, @details, @created_at)
  `);

  const transaction = getDB().transaction(() => {
    stmt.run({ id, status });
    logStmt.run({
      reimbursement_id: id,
      action,
      details,
      created_at: Date.now()
    });
  });
  
  return transaction();
}

function updateReimbursementProofs(id, proofs, action, details) {
  const stmt = getDB().prepare(`
    UPDATE reimbursements SET proofs = @proofs WHERE id = @id
  `);
  
  const logStmt = getDB().prepare(`
    INSERT INTO reimbursement_logs (reimbursement_id, action, details, created_at)
    VALUES (@reimbursement_id, @action, @details, @created_at)
  `);

  const transaction = getDB().transaction(() => {
    stmt.run({ id, proofs: JSON.stringify(proofs) });
    logStmt.run({
      reimbursement_id: id,
      action,
      details,
      created_at: Date.now()
    });
  });
  
  return transaction();
}

function updateReimbursementAmount(id, amount, action, details) {
  const stmt = getDB().prepare(`
    UPDATE reimbursements SET amount = @amount WHERE id = @id
  `);
  
  const logStmt = getDB().prepare(`
    INSERT INTO reimbursement_logs (reimbursement_id, action, details, created_at)
    VALUES (@reimbursement_id, @action, @details, @created_at)
  `);

  const transaction = getDB().transaction(() => {
    stmt.run({ id, amount });
    logStmt.run({
      reimbursement_id: id,
      action,
      details,
      created_at: Date.now()
    });
  });
  
  return transaction();
}

function updateReimbursement(id, updates, action, details) {
  const allowedFields = ['name', 'date', 'amount', 'category', 'description', 'receipt_no'];
  const fieldsToUpdate = Object.keys(updates).filter(key => allowedFields.includes(key));
  
  if (fieldsToUpdate.length === 0) return;

  const setClause = fieldsToUpdate.map(field => `${field} = @${field}`).join(', ');
  const stmt = getDB().prepare(`UPDATE reimbursements SET ${setClause} WHERE id = @id`);
  
  const logStmt = getDB().prepare(`
    INSERT INTO reimbursement_logs (reimbursement_id, action, details, created_at)
    VALUES (@reimbursement_id, @action, @details, @created_at)
  `);

  const transaction = getDB().transaction(() => {
    stmt.run({ ...updates, id });
    logStmt.run({
      reimbursement_id: id,
      action,
      details,
      created_at: Date.now()
    });
  });
  
  return transaction();
}

function deleteReimbursement(id) {
  const transaction = getDB().transaction(() => {
    getDB().prepare('DELETE FROM reimbursement_logs WHERE reimbursement_id = ?').run(id);
    getDB().prepare('DELETE FROM reimbursements WHERE id = ?').run(id);
  });
  return transaction();
}

function getReimbursement(id) {
  const record = getDB().prepare('SELECT * FROM reimbursements WHERE id = ?').get(id);
  if (record) {
    record.proofs = JSON.parse(record.proofs);
    record.logs = getDB().prepare('SELECT * FROM reimbursement_logs WHERE reimbursement_id = ? ORDER BY created_at DESC').all(id);
  }
  return record;
}

function getReimbursements() {
  const records = getDB().prepare('SELECT * FROM reimbursements ORDER BY created_at DESC').all();
  return records.map(r => ({
    ...r,
    proofs: JSON.parse(r.proofs),
    logs: getDB().prepare('SELECT * FROM reimbursement_logs WHERE reimbursement_id = ? ORDER BY created_at DESC').all(r.id)
  }));
}

function getCategories() {
  return getDB().prepare('SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC').all();
}

function addCategory(name) {
  try {
    const count = getDB().prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const stmt = getDB().prepare('INSERT INTO categories (name, sort_order, created_at) VALUES (?, ?, ?)');
    const info = stmt.run(name, count, Date.now());
    return { id: info.lastInsertRowid, name, sort_order: count, created_at: Date.now() };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('类别名称已存在');
    }
    throw error;
  }
}

function deleteCategory(id) {
  return getDB().prepare('DELETE FROM categories WHERE id = ?').run(id);
}

function updateCategoryOrder(categories) {
  const update = getDB().prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
  const transaction = getDB().transaction((cats) => {
    cats.forEach((cat, index) => {
      update.run(index, cat.id);
    });
  });
  transaction(categories);
}

function getDashboardStats() {
  const db = getDB();
  
  // --- Reimbursements Stats ---
  const reimTotal = db.prepare('SELECT COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements').get();
  
  // By Category
  const categoryStats = db.prepare('SELECT category, COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements GROUP BY category ORDER BY totalAmount DESC').all();
  
  // By Status
  const statusStats = db.prepare('SELECT status, COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements GROUP BY status').all();
  
  // Unfinished Reimbursements
  const unfinishedStatuses = ['材料不齐', '待提交', '待审核', '待打款'];
  const placeholders = unfinishedStatuses.map(() => '?').join(',');
  const reimUnfinished = db.prepare(`SELECT SUM(amount) as totalAmount FROM reimbursements WHERE status IN (${placeholders})`).get(...unfinishedStatuses);
  const unfinishedByCategory = db.prepare(`SELECT category, COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements WHERE status IN (${placeholders}) GROUP BY category ORDER BY totalAmount DESC`).all(...unfinishedStatuses);
  
  // Recent 5 items
  const recentItems = db.prepare('SELECT id, name, date, amount, status FROM reimbursements ORDER BY created_at DESC LIMIT 5').all();
  
  // Monthly stats for the last 6 months
  const monthlyStats = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as totalAmount, COUNT(*) as count 
    FROM reimbursements 
    WHERE date >= date('now', 'start of month', '-5 months') 
    GROUP BY month 
    ORDER BY month ASC
  `).all();

  // --- Travel Stats ---
  const travelTotal = db.prepare('SELECT COUNT(*) as count, SUM(total_amount) as totalAmount FROM travels').get();
  const travelStatusStats = db.prepare('SELECT status, COUNT(*) as count, SUM(total_amount) as totalAmount FROM travels GROUP BY status').all();
  
  // Unfinished Travels
   const travelUnfinished = db.prepare(`
     SELECT COUNT(*) as count, SUM(total_amount) as totalAmount 
     FROM travels 
     WHERE status IN ('待提交', '待审核', '待打款', '材料不齐', 'pending_submission', 'pending_approval', 'pending_reimbursement', 'pending')
   `).get();
 
   // --- Data Merging & Formatting ---
 
   // 1. Status Mapping (English -> Chinese)
  const travelStatusMap = {
    'pending_submission': '待提交',
    'pending_approval': '待审核',
    'pending_reimbursement': '待打款',
    'pending_closure': '已完成',
    'pending': '待处理'
  };

  // 2. Merge Status Stats
  const combinedStatusMap = new Map();
  // Add Reimbursement Statuses
  statusStats.forEach(item => {
    combinedStatusMap.set(item.status, { count: item.count, totalAmount: item.totalAmount });
  });
  // Add Travel Statuses
  travelStatusStats.forEach(item => {
    const statusName = travelStatusMap[item.status] || item.status;
    if (combinedStatusMap.has(statusName)) {
      const existing = combinedStatusMap.get(statusName);
      existing.count += item.count;
      existing.totalAmount += item.totalAmount;
    } else {
      combinedStatusMap.set(statusName, { count: item.count, totalAmount: item.totalAmount });
    }
  });
  const finalStatusStats = Array.from(combinedStatusMap.entries()).map(([status, data]) => ({
    status,
    ...data
  }));

  // 3. Merge Category Stats
  const travelCategoryItem = {
    category: '差旅',
    count: travelTotal.count || 0,
    totalAmount: travelTotal.totalAmount || 0
  };
  const finalCategoryStats = [...categoryStats, travelCategoryItem].sort((a, b) => b.totalAmount - a.totalAmount);

  // 4. Merge Recent Items
  // Fetch recent travels
  const recentTravels = db.prepare('SELECT id, reason as name, date, total_amount as amount, status, created_at FROM travels ORDER BY created_at DESC LIMIT 5').all();
  
  const allRecent = [
    ...recentItems.map(i => ({ ...i, type: 'reimbursement' })),
    ...recentTravels.map(i => ({ 
      ...i, 
      status: travelStatusMap[i.status] || i.status,
      type: 'travel' 
    }))
  ];
  const finalRecentItems = allRecent
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 5);

  // 5. Merge Monthly Stats
  const monthlyTravels = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(total_amount) as totalAmount, COUNT(*) as count 
    FROM travels 
    WHERE date >= date('now', 'start of month', '-5 months') 
    GROUP BY month 
    ORDER BY month ASC
  `).all();

  const monthlyMap = new Map();
  monthlyStats.forEach(item => {
    monthlyMap.set(item.month, { totalAmount: item.totalAmount, count: item.count });
  });
  monthlyTravels.forEach(item => {
    if (monthlyMap.has(item.month)) {
      const existing = monthlyMap.get(item.month);
      existing.totalAmount += item.totalAmount;
      existing.count += item.count;
    } else {
      monthlyMap.set(item.month, { totalAmount: item.totalAmount, count: item.count });
    }
  });
  // Re-sort by month keys
   const finalMonthlyStats = Array.from(monthlyMap.entries())
     .sort((a, b) => a[0].localeCompare(b[0]))
     .map(([month, data]) => ({ month, ...data }));
 
   // 6. Merge Unfinished by Category
   const finalUnfinishedByCategory = [...unfinishedByCategory];
   if (travelUnfinished && travelUnfinished.totalAmount > 0) {
     finalUnfinishedByCategory.push({
       category: '差旅',
       count: travelUnfinished.count || 0,
       totalAmount: travelUnfinished.totalAmount
     });
     finalUnfinishedByCategory.sort((a, b) => b.totalAmount - a.totalAmount);
   }

   // --- Combined Stats ---
   const totalCount = (reimTotal.count || 0) + (travelTotal.count || 0);
   const totalAmount = (reimTotal.totalAmount || 0) + (travelTotal.totalAmount || 0);
   const unfinishedTotalAmount = (reimUnfinished.totalAmount || 0) + (travelUnfinished.totalAmount || 0);
 
   return {
     totalCount,
     totalAmount,
     categoryStats: finalCategoryStats,
     statusStats: finalStatusStats,
     unfinishedTotalAmount,
     unfinishedByCategory: finalUnfinishedByCategory,
     recentItems: finalRecentItems,
     monthlyStats: finalMonthlyStats,
     travelStats: {
       totalCount: travelTotal.count || 0,
       totalAmount: travelTotal.totalAmount || 0,
       statusStats: travelStatusStats
     }
   };
 }

function getTravels() {
  const records = getDB().prepare('SELECT * FROM travels ORDER BY created_at DESC').all();
  return records.map(r => ({
    ...r,
    itineraries: JSON.parse(r.itineraries || '[]')
  }));
}

function addTravel(data) {
  const stmt = getDB().prepare(`
    INSERT INTO travels (id, applicant, date, reason, status, total_amount, itineraries, created_at)
    VALUES (@id, @applicant, @date, @reason, @status, @total_amount, @itineraries, @created_at)
  `);
  
  const transaction = getDB().transaction((travel) => {
    stmt.run({
      ...travel,
      itineraries: JSON.stringify(travel.itineraries || []),
      created_at: Date.now()
    });
  });
  
  return transaction(data);
}

function updateTravel(id, data) {
  const fields = [];
  const values = { id };
  
  if (data.applicant !== undefined) { fields.push('applicant = @applicant'); values.applicant = data.applicant; }
  if (data.date !== undefined) { fields.push('date = @date'); values.date = data.date; }
  if (data.reason !== undefined) { fields.push('reason = @reason'); values.reason = data.reason; }
  if (data.status !== undefined) { fields.push('status = @status'); values.status = data.status; }
  if (data.total_amount !== undefined) { fields.push('total_amount = @total_amount'); values.total_amount = data.total_amount; }
  if (data.itineraries !== undefined) { fields.push('itineraries = @itineraries'); values.itineraries = JSON.stringify(data.itineraries); }
  
  if (fields.length === 0) return;
  
  const stmt = getDB().prepare(`UPDATE travels SET ${fields.join(', ')} WHERE id = @id`);
  return stmt.run(values);
}

function deleteTravel(id) {
  return getDB().prepare('DELETE FROM travels WHERE id = ?').run(id);
}

// --- Claims ---

function getClaims() {
  const db = getDB();
  const claims = db.prepare('SELECT * FROM claims ORDER BY created_at DESC').all();
  const claimsWithItems = claims.map(claim => {
    const items = db.prepare('SELECT * FROM reimbursements WHERE claim_id = ?').all(claim.id);
    const total_amount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    return {
      ...claim,
      items,
      total_amount
    };
  });
  return claimsWithItems;
}

function addClaim(data, item_ids) {
  const db = getDB();
  
  const transaction = db.transaction(() => {
    let claimId = data.id;
    // Check if claim_no already exists
    const existing = db.prepare('SELECT id FROM claims WHERE claim_no = ?').get(data.claim_no);
    if (existing) {
      claimId = existing.id;
      db.prepare('UPDATE claims SET approval_date = ? WHERE id = ?').run(data.approval_date, claimId);
    } else {
      db.prepare(`
        INSERT INTO claims (id, claim_no, approval_date, created_at)
        VALUES (@id, @claim_no, @approval_date, @created_at)
      `).run({
        id: claimId,
        claim_no: data.claim_no,
        approval_date: data.approval_date,
        created_at: Date.now()
      });
    }
    
    if (item_ids && item_ids.length > 0) {
      const updateReim = db.prepare('UPDATE reimbursements SET claim_id = ? WHERE id = ?');
      item_ids.forEach(itemId => {
        updateReim.run(claimId, itemId);
      });
    }
    
    return claimId;
  });
  
  return transaction();
}

function deleteClaim(id) {
  const db = getDB();
  const updateReim = db.prepare('UPDATE reimbursements SET claim_id = NULL WHERE claim_id = ?');
  const deleteStmt = db.prepare('DELETE FROM claims WHERE id = ?');
  
  const transaction = db.transaction(() => {
    updateReim.run(id);
    deleteStmt.run(id);
  });
  
  return transaction();
}

function removeClaimItem(claim_id, item_id) {
  return getDB().prepare('UPDATE reimbursements SET claim_id = NULL WHERE claim_id = ? AND id = ?').run(claim_id, item_id);
}

function updateClaimItemsStatus(claim_id, status) {
  const db = getDB();
  const items = db.prepare('SELECT id FROM reimbursements WHERE claim_id = ?').all(claim_id);
  
  const updateStatusStmt = db.prepare('UPDATE reimbursements SET status = ? WHERE id = ?');
  const logStmt = db.prepare(`
    INSERT INTO reimbursement_logs (reimbursement_id, action, details, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const transaction = db.transaction(() => {
    const now = Date.now();
    items.forEach(item => {
      updateStatusStmt.run(status, item.id);
      logStmt.run(item.id, '状态变更', `报销单批量更新状态为: ${status}`, now);
    });
  });
  
  return transaction();
}

module.exports = {
  initDB,
  addReimbursement,
  getReimbursements,
  getReimbursement,
  updateReimbursementStatus,
  updateReimbursementProofs,
  updateReimbursementAmount,
  updateReimbursement,
  deleteReimbursement,
  getDashboardStats,
  getCategories,
  addCategory,
  deleteCategory,
  updateCategoryOrder,
  getTravels,
  addTravel,
  updateTravel,
  deleteTravel,
  getClaims,
  addClaim,
  deleteClaim,
  removeClaimItem,
  updateClaimItemsStatus
};
