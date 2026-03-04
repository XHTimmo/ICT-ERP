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
        date TEXT,
        amount REAL,
        category TEXT,
        name TEXT,
        description TEXT,
        proofs TEXT,
        status TEXT,
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
    `);
    
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
    INSERT INTO reimbursements (id, serial_no, date, amount, category, name, description, proofs, status, created_at)
    VALUES (@id, @serial_no, @date, @amount, @category, @name, @description, @proofs, @status, @created_at)
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
  const allowedFields = ['name', 'date', 'amount', 'category', 'description'];
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
  const rows = getDB().prepare('SELECT DISTINCT category FROM reimbursements WHERE category IS NOT NULL AND category != ""').all();
  return rows.map(r => r.category);
}

function getDashboardStats() {
  const db = getDB();
  
  // Total Amount and Count
  const totalStats = db.prepare('SELECT COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements').get();
  
  // By Category
  const categoryStats = db.prepare('SELECT category, COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements GROUP BY category ORDER BY totalAmount DESC').all();
  
  // By Status
  const statusStats = db.prepare('SELECT status, COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements GROUP BY status').all();
  
  // Unfinished totals and by-category breakdown
  const unfinishedStatuses = ['材料不齐', '待提交', '待审核', '待打款'];
  const placeholders = unfinishedStatuses.map(() => '?').join(',');
  const unfinishedTotal = db.prepare(`SELECT SUM(amount) as totalAmount FROM reimbursements WHERE status IN (${placeholders})`).get(...unfinishedStatuses);
  const unfinishedByCategory = db.prepare(`SELECT category, COUNT(*) as count, SUM(amount) as totalAmount FROM reimbursements WHERE status IN (${placeholders}) GROUP BY category ORDER BY totalAmount DESC`).all(...unfinishedStatuses);
  
  // Recent 5 items
  const recentItems = db.prepare('SELECT id, name, date, amount, status FROM reimbursements ORDER BY created_at DESC LIMIT 5').all();
  
  // Monthly stats for the last 6 months (Keeping this new addition as it might be useful, or should I remove it if not used? Dashboard.vue doesn't seem to use it based on previous read, but let's check Dashboard.vue again. 
  // Wait, Dashboard.vue ONLY uses: totalAmount, totalCount, categoryStats, statusStats, recentItems, unfinishedTotalAmount, unfinishedByCategory.
  // It does NOT use monthlyStats. So I should stick to what Dashboard.vue expects.)

  return {
    totalCount: totalStats.count || 0,
    totalAmount: totalStats.totalAmount || 0,
    categoryStats,
    statusStats,
    unfinishedTotalAmount: unfinishedTotal.totalAmount || 0,
    unfinishedByCategory,
    recentItems
  };
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
  getCategories
};
