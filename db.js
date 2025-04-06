const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || 'flexibudget.db';
const db = new sqlite3.Database(dbPath);

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await run(`
          CREATE TABLE IF NOT EXISTS balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            starting_balance REAL NOT NULL,
            current_balance REAL NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        await run(`
          CREATE TABLE IF NOT EXISTS budget_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            weekly_budget REAL NOT NULL DEFAULT 100.00,
            budget_warnings BOOLEAN NOT NULL DEFAULT 1,
            strict_budget BOOLEAN NOT NULL DEFAULT 0,
            transaction_notifications BOOLEAN NOT NULL DEFAULT 1,
            weekly_reports BOOLEAN NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        await run(`
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            location TEXT NOT NULL,
            description TEXT,
            transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        await run(`
          CREATE TABLE IF NOT EXISTS fairy_statuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            max_transaction_amount REAL,
            total_helped_amount REAL DEFAULT 0,
            total_requests_fulfilled INTEGER DEFAULT 0,
            rating_average REAL DEFAULT 0,
            rating_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        await run(`
          CREATE TABLE IF NOT EXISTS fairy_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requestor_id INTEGER NOT NULL,
            fairy_id INTEGER,
            location TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, completed, cancelled
            requestor_confirmed BOOLEAN DEFAULT 0,
            fairy_confirmed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requestor_id) REFERENCES users (id),
            FOREIGN KEY (fairy_id) REFERENCES users (id)
          )
        `);

        await run(`
          CREATE TABLE IF NOT EXISTS fairy_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            fairy_id INTEGER NOT NULL,
            requestor_id INTEGER NOT NULL,
            rating INTEGER NOT NULL, -- 1-5 stars
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES fairy_requests (id),
            FOREIGN KEY (fairy_id) REFERENCES users (id),
            FOREIGN KEY (requestor_id) REFERENCES users (id)
          )
        `);

        console.log('Database initialized');
        resolve();
      } catch (err) {
        console.error('Error initializing database:', err);
        reject(err);
      }
    });
  });
}

async function createUser(studentID, name, email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run('BEGIN TRANSACTION');
        
        const userResult = await run(
          `INSERT INTO users (student_id, password_hash, name, email, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [studentID, passwordHash, name, email]
        );
        
        const userID = userResult.lastID;
        
        await run(
          `INSERT INTO balances (user_id, starting_balance, current_balance, updated_at)
           VALUES (?, ?, ?, datetime('now'))`,
          [userID, 1500.00, 1500.00]
        );
        
        await run(
          `INSERT INTO budget_settings (user_id, weekly_budget, budget_warnings, strict_budget, 
             transaction_notifications, weekly_reports, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [userID, 100.00, 1, 0, 1, 1]
        );
        
        await run('COMMIT');
        
        const user = await getUserById(userID);
        resolve(user);
      } catch (err) {
        await run('ROLLBACK');
        reject(err);
      }
    });
  });
}

async function getUserById(id) {
  return await get(
    `SELECT id, student_id, name, email, password_hash, created_at, updated_at
     FROM users
     WHERE id = ?`,
    [id]
  );
}

async function getUserByStudentId(studentID) {
  return await get(
    `SELECT id, student_id, name, email, password_hash, created_at, updated_at
     FROM users
     WHERE student_id = ?`,
    [studentID]
  );
}

async function verifyPassword(user, password) {
  return await bcrypt.compare(password, user.password_hash);
}

async function getUserBalance(userID) {
  return await get(
    `SELECT id, user_id, starting_balance, current_balance, updated_at
     FROM balances
     WHERE user_id = ?`,
    [userID]
  );
}

async function createTransaction(userID, amount, location, description) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run('BEGIN TRANSACTION');
        
        const balance = await getUserBalance(userID);
        if (!balance) {
          throw new Error('Balance not found');
        }
        
        const newBalance = balance.current_balance - amount;
        
        await run(
          `UPDATE balances
           SET current_balance = ?, updated_at = datetime('now')
           WHERE user_id = ?`,
          [newBalance, userID]
        );
        
        const result = await run(
          `INSERT INTO transactions (user_id, amount, location, description, transaction_date)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [userID, amount, location, description || '']
        );
        
        await run('COMMIT');
        
        const tx = await getTransactionById(result.lastID);
        resolve(tx);
      } catch (err) {
        await run('ROLLBACK');
        reject(err);
      }
    });
  });
}

async function getTransactionById(id) {
  return await get(
    `SELECT id, user_id, amount, location, description, transaction_date
     FROM transactions
     WHERE id = ?`,
    [id]
  );
}

async function getUserTransactions(userID, limit = 10, offset = 0) {
  const countRow = await get(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ?`,
    [userID]
  );
  
  const transactions = await all(
    `SELECT id, user_id, amount, location, description, transaction_date
     FROM transactions
     WHERE user_id = ?
     ORDER BY transaction_date DESC
     LIMIT ? OFFSET ?`,
    [userID, limit, offset]
  );
  
  return {
    transactions,
    total: countRow ? countRow.count : 0,
    limit,
    offset
  };
}

async function getBudgetSettings(userID) {
  return await get(
    `SELECT id, user_id, weekly_budget, budget_warnings, strict_budget, 
       transaction_notifications, weekly_reports, updated_at
     FROM budget_settings
     WHERE user_id = ?`,
    [userID]
  );
}

async function updateBudgetSettings(userID, settings) {
  return await run(
    `UPDATE budget_settings
     SET weekly_budget = ?, budget_warnings = ?, strict_budget = ?, 
       transaction_notifications = ?, weekly_reports = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
    [
      settings.weekly_budget, 
      settings.budget_warnings ? 1 : 0, 
      settings.strict_budget ? 1 : 0, 
      settings.transaction_notifications ? 1 : 0, 
      settings.weekly_reports ? 1 : 0, 
      userID
    ]
  );
}

async function toggleFairyStatus(userID, isActive, maxTransactionAmount = null) {
  const existingStatus = await get(
    `SELECT id FROM fairy_statuses WHERE user_id = ?`,
    [userID]
  );
  
  if (existingStatus) {
    return await run(
      `UPDATE fairy_statuses 
       SET is_active = ?, max_transaction_amount = ?, updated_at = datetime('now')
       WHERE user_id = ?`,
      [isActive ? 1 : 0, maxTransactionAmount, userID]
    );
  } else {
    return await run(
      `INSERT INTO fairy_statuses (user_id, is_active, max_transaction_amount, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
      [userID, isActive ? 1 : 0, maxTransactionAmount]
    );
  }
}

async function getFairyStatus(userID) {
  return await get(
    `SELECT id, user_id, is_active, max_transaction_amount, total_helped_amount, 
       total_requests_fulfilled, rating_average, rating_count, created_at, updated_at
     FROM fairy_statuses
     WHERE user_id = ?`,
    [userID]
  );
}

async function getActiveFairies(limit = 20, offset = 0, sortBy = 'rating') {
  const countRow = await get(
    `SELECT COUNT(*) as count FROM fairy_statuses WHERE is_active = 1`
  );
  
  let orderBy = '';
  if (sortBy === 'rating') {
    orderBy = 'f.rating_average DESC, f.total_requests_fulfilled DESC';
  } else if (sortBy === 'amount') {
    orderBy = 'f.total_helped_amount DESC, f.rating_average DESC';
  } else if (sortBy === 'count') {
    orderBy = 'f.total_requests_fulfilled DESC, f.rating_average DESC';
  }
  
  const fairies = await all(
    `SELECT f.id, f.user_id, f.is_active, f.max_transaction_amount, f.total_helped_amount, 
       f.total_requests_fulfilled, f.rating_average, f.rating_count, f.created_at, f.updated_at,
       u.name, u.student_id
     FROM fairy_statuses f
     JOIN users u ON f.user_id = u.id
     WHERE f.is_active = 1
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  
  return {
    fairies,
    total: countRow ? countRow.count : 0,
    limit,
    offset
  };
}

async function createFairyRequest(requestorID, location, amount, description) {
  return await run(
    `INSERT INTO fairy_requests (requestor_id, location, amount, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [requestorID, location, amount, description || '']
  );
}

async function getFairyRequest(requestID) {
  return await get(
    `SELECT fr.id, fr.requestor_id, fr.fairy_id, fr.location, fr.amount, fr.description, 
       fr.status, fr.requestor_confirmed, fr.fairy_confirmed, fr.created_at, fr.updated_at,
       requester.name as requestor_name, requester.student_id as requestor_student_id,
       fairy.name as fairy_name, fairy.student_id as fairy_student_id
     FROM fairy_requests fr
     JOIN users requester ON fr.requestor_id = requester.id
     LEFT JOIN users fairy ON fr.fairy_id = fairy.id
     WHERE fr.id = ?`,
    [requestID]
  );
}

async function getPendingFairyRequests(fairyId, maxAmount) {
  let sql = `
    SELECT 
      fr.*,
      u.name as requestor_name,
      u.email as requestor_email,
      u.student_id as requestor_student_id
    FROM fairy_requests fr
    JOIN users u ON fr.requestor_id = u.id
    WHERE fr.status = 'pending'
    AND fr.requestor_id != ?
  `;
  
  const params = [fairyId];
  
  if (maxAmount !== null && maxAmount !== undefined) {
    sql += ` AND fr.amount <= ?`;
    params.push(maxAmount);
  }
  
  sql += ` ORDER BY fr.created_at DESC`;
  
  return all(sql, params);
}

async function getUserFairyRequests(userID, limit = 20, offset = 0) {
  const countRow = await get(
    `SELECT COUNT(*) as count FROM fairy_requests WHERE requestor_id = ?`,
    [userID]
  );
  
  const requests = await all(
    `SELECT fr.id, fr.requestor_id, fr.fairy_id, fr.location, fr.amount, fr.description, 
       fr.status, fr.requestor_confirmed, fr.fairy_confirmed, fr.created_at, fr.updated_at,
       fairy.name as fairy_name, fairy.student_id as fairy_student_id
     FROM fairy_requests fr
     LEFT JOIN users fairy ON fr.fairy_id = fairy.id
     WHERE fr.requestor_id = ?
     ORDER BY fr.created_at DESC
     LIMIT ? OFFSET ?`,
    [userID, limit, offset]
  );
  
  return {
    requests,
    total: countRow ? countRow.count : 0,
    limit,
    offset
  };
}

async function getFairyAcceptedRequests(fairyID, limit = 20, offset = 0) {
  const countRow = await get(
    `SELECT COUNT(*) as count FROM fairy_requests WHERE fairy_id = ?`,
    [fairyID]
  );
  
  const requests = await all(
    `SELECT fr.id, fr.requestor_id, fr.fairy_id, fr.location, fr.amount, fr.description, 
       fr.status, fr.requestor_confirmed, fr.fairy_confirmed, fr.created_at, fr.updated_at,
       u.name as requestor_name, u.student_id as requestor_student_id
     FROM fairy_requests fr
     JOIN users u ON fr.requestor_id = u.id
     WHERE fr.fairy_id = ?
     ORDER BY fr.created_at DESC
     LIMIT ? OFFSET ?`,
    [fairyID, limit, offset]
  );
  
  return {
    requests,
    total: countRow ? countRow.count : 0,
    limit,
    offset
  };
}

async function acceptFairyRequest(requestID, fairyID) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run('BEGIN TRANSACTION');
        
        await run(
          `UPDATE fairy_requests
           SET fairy_id = ?, status = 'accepted', updated_at = datetime('now')
           WHERE id = ? AND status = 'pending'`,
          [fairyID, requestID]
        );
        
        await run('COMMIT');
        
        const request = await getFairyRequest(requestID);
        resolve(request);
      } catch (err) {
        await run('ROLLBACK');
        reject(err);
      }
    });
  });
}

async function confirmFairyRequest(requestID, userID, isRequestor) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run('BEGIN TRANSACTION');
        
        const request = await getFairyRequest(requestID);
        
        if (!request) {
          throw new Error('Request not found');
        }
        
        if (request.status !== 'accepted') {
          throw new Error('Request must be accepted before it can be confirmed');
        }
        
        if (isRequestor) {
          if (request.requestor_id !== userID) {
            throw new Error('Only the requestor can confirm this request');
          }
          
          await run(
            `UPDATE fairy_requests
             SET requestor_confirmed = 1, updated_at = datetime('now')
             WHERE id = ?`,
            [requestID]
          );
        } else {
          if (request.fairy_id !== userID) {
            throw new Error('Only the fairy can confirm this request');
          }
          
          await run(
            `UPDATE fairy_requests
             SET fairy_confirmed = 1, updated_at = datetime('now')
             WHERE id = ?`,
            [requestID]
          );
        }
        
        const updatedRequest = await getFairyRequest(requestID);
        
        if (updatedRequest.requestor_confirmed && updatedRequest.fairy_confirmed) {
          await run(
            `UPDATE fairy_requests
             SET status = 'completed', updated_at = datetime('now')
             WHERE id = ?`,
            [requestID]
          );
          
          await run(
            `UPDATE fairy_statuses
             SET total_helped_amount = total_helped_amount + ?,
                 total_requests_fulfilled = total_requests_fulfilled + 1,
                 updated_at = datetime('now')
             WHERE user_id = ?`,
            [updatedRequest.amount, updatedRequest.fairy_id]
          );
        }
        
        await run('COMMIT');
        
        const finalRequest = await getFairyRequest(requestID);
        resolve(finalRequest);
      } catch (err) {
        await run('ROLLBACK');
        reject(err);
      }
    });
  });
}

async function addFairyRating(requestID, requestorID, fairyID, rating, comment) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await run('BEGIN TRANSACTION');
        
        const ratingResult = await run(
          `INSERT INTO fairy_ratings (request_id, fairy_id, requestor_id, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [requestID, fairyID, requestorID, rating, comment || '']
        );
        
        const fairyStatus = await getFairyStatus(fairyID);
        const newCount = fairyStatus.rating_count + 1;
        const newAverage = ((fairyStatus.rating_average * fairyStatus.rating_count) + rating) / newCount;
        
        await run(
          `UPDATE fairy_statuses
           SET rating_average = ?, rating_count = ?, updated_at = datetime('now')
           WHERE user_id = ?`,
          [newAverage, newCount, fairyID]
        );
        
        await run('COMMIT');
        
        const createdRating = await get(
          `SELECT id, request_id, fairy_id, requestor_id, rating, comment, created_at
           FROM fairy_ratings
           WHERE id = ?`,
          [ratingResult.lastID]
        );
        
        resolve(createdRating);
      } catch (err) {
        await run('ROLLBACK');
        reject(err);
      }
    });
  });
}

db.createFairyRequestsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS fairy_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requestor_id INTEGER NOT NULL,
      fairy_id INTEGER,
      location TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      fairy_confirmed INTEGER DEFAULT 0,
      requestor_confirmed INTEGER DEFAULT 0,
      rating INTEGER,
      rating_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requestor_id) REFERENCES users (id),
      FOREIGN KEY (fairy_id) REFERENCES users (id)
    )
  `;
  return db.run(sql);
};

db.createFairySettingsTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS fairy_settings (
      user_id INTEGER PRIMARY KEY,
      is_active INTEGER DEFAULT 0,
      max_transaction_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `;
  return db.run(sql);
};

db.updateFairyStatus = async (userId, isActive, maxTransactionAmount) => {
  const settings = await db.get(`SELECT * FROM fairy_settings WHERE user_id = ?`, [userId]);
  
  if (settings) {
    return db.run(
      `UPDATE fairy_settings 
       SET is_active = ?, 
           max_transaction_amount = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [isActive ? 1 : 0, maxTransactionAmount, userId]
    );
  } else {
    return db.run(
      `INSERT INTO fairy_settings (user_id, is_active, max_transaction_amount) 
       VALUES (?, ?, ?)`,
      [userId, isActive ? 1 : 0, maxTransactionAmount]
    );
  }
};

db.getFairyStatus = async (userId) => {
  let settings = await db.get(`SELECT * FROM fairy_settings WHERE user_id = ?`, [userId]);
  
  if (!settings) {
    await db.run(
      `INSERT INTO fairy_settings (user_id, is_active, max_transaction_amount) 
       VALUES (?, 0, NULL)`,
      [userId]
    );
    
    settings = {
      user_id: userId,
      is_active: 0,
      max_transaction_amount: null
    };
  }
  
  const stats = await db.get(
    `SELECT 
       COUNT(*) as total_requests_fulfilled,
       COALESCE(SUM(amount), 0) as total_helped_amount,
       COALESCE(AVG(rating), 0) as rating_average,
       COUNT(rating) as rating_count
     FROM fairy_requests 
     WHERE fairy_id = ? AND status = 'completed'`,
    [userId]
  );
  
  return {
    is_active: settings.is_active === 1,
    max_transaction_amount: settings.max_transaction_amount,
    total_requests_fulfilled: stats.total_requests_fulfilled,
    total_helped_amount: stats.total_helped_amount,
    rating_average: stats.rating_average,
    rating_count: stats.rating_count
  };
};

db.createFairyRequest = async (userId, location, amount, description) => {
  const result = await db.run(
    `INSERT INTO fairy_requests (requestor_id, location, amount, description) 
     VALUES (?, ?, ?, ?)`,
    [userId, location, amount, description]
  );
  
  return result.lastID;
};

async function getUserPendingRequests(userId) {
  return all(
    `SELECT * FROM fairy_requests 
     WHERE requestor_id = ? AND status = 'pending'
     ORDER BY created_at DESC`,
    [userId]
  );
}

db.getUserFairyRequests = async (userId) => {
  const requests = await all(
    `SELECT 
       fr.*,
       u.name as fairy_name,
       u.email as fairy_email,
       u.student_id as fairy_student_id
     FROM fairy_requests fr
     LEFT JOIN users u ON fr.fairy_id = u.id
     WHERE fr.requestor_id = ?
     ORDER BY fr.created_at DESC`,
    [userId]
  );
  
  const requestor = await get(`SELECT name, email, student_id FROM users WHERE id = ?`, [userId]);
  
  return requests.map(req => ({
    ...req,
    requestor_name: requestor.name,
    requestor_email: requestor.email,
    requestor_student_id: requestor.student_id
  }));
};

db.getFairyAcceptedRequests = async (fairyId) => {
  return all(
    `SELECT 
       fr.*,
       u.name as requestor_name,
       u.email as requestor_email,
       u.student_id as requestor_student_id
     FROM fairy_requests fr
     JOIN users u ON fr.requestor_id = u.id
     WHERE fr.fairy_id = ?
     ORDER BY fr.created_at DESC`,
    [fairyId]
  );
};

async function getFairyRequestById(requestId) {
  return get(`SELECT * FROM fairy_requests WHERE id = ?`, [requestId]);
}

db.acceptFairyRequest = async (requestId, fairyId) => {
  return db.run(
    `UPDATE fairy_requests 
     SET fairy_id = ?, 
         status = 'accepted', 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND status = 'pending'`,
    [fairyId, requestId]
  );
};

async function cancelFairyRequest(requestId) {
  return run(
    `UPDATE fairy_requests 
     SET status = 'cancelled', 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND status = 'pending'`,
    [requestId]
  );
}

db.confirmFairyRequest = async (requestId, fairyId, requestorId, amount) => {
  await db.run('BEGIN TRANSACTION');
  
  try {
    await db.run(
      `UPDATE fairy_requests 
       SET fairy_confirmed = 1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [requestId]
    );
    
    const request = await db.get(
      `SELECT fairy_confirmed, requestor_confirmed FROM fairy_requests WHERE id = ?`,
      [requestId]
    );
    
    if (request.fairy_confirmed && request.requestor_confirmed) {
      await db.run(
        `UPDATE fairy_requests 
         SET status = 'completed', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [requestId]
      );
      
      await db.run(
        `UPDATE balances SET balance = balance - ? WHERE user_id = ?`,
        [amount, fairyId]
      );
      
      await db.run(
        `INSERT INTO transactions (user_id, amount, location, description, type) 
         VALUES (?, ?, ?, ?, 'fairy_donation')`,
        [fairyId, -amount, 'Flexi Fairy', `Helped student #${requestorId} with meal`]
      );
    }
    
    await db.run('COMMIT');
    return true;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
};

async function rateFairyRequest(requestId, rating, comment) {
  return run(
    `UPDATE fairy_requests 
     SET requestor_confirmed = 1, 
         rating = ?, 
         rating_comment = ?,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [rating, comment, requestId]
  );
}

async function completeFairyRequest(requestId) {
  return run(
    `UPDATE fairy_requests 
     SET status = 'completed', 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [requestId]
  );
}

async function getFairyLeaderboard(timeframe) {
  let timeFilter = '';
  
  if (timeframe === 'week') {
    timeFilter = "AND fr.created_at >= datetime('now', '-7 days')";
  } else if (timeframe === 'month') {
    timeFilter = "AND fr.created_at >= datetime('now', '-30 days')";
  } else if (timeframe === 'semester') {
    timeFilter = "AND fr.created_at >= datetime('now', '-120 days')";
  }
  
  const sql = `
    SELECT 
      u.id,
      u.name,
      u.student_id,
      COUNT(fr.id) as requests_fulfilled,
      COALESCE(SUM(fr.amount), 0) as amount_helped,
      COALESCE(AVG(fr.rating), 0) as rating
    FROM users u
    JOIN fairy_requests fr ON u.id = fr.fairy_id
    WHERE fr.status = 'completed'
    ${timeFilter}
    GROUP BY u.id
    ORDER BY amount_helped DESC
    LIMIT 25
  `;
  
  return all(sql);
}

async function initFairyTables() {
  if (!db) return;
  
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS fairy_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requestor_id INTEGER NOT NULL,
        fairy_id INTEGER,
        location TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        fairy_confirmed INTEGER DEFAULT 0,
        requestor_confirmed INTEGER DEFAULT 0,
        rating INTEGER,
        rating_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requestor_id) REFERENCES users (id),
        FOREIGN KEY (fairy_id) REFERENCES users (id)
      )
    `);
    
    await run(`
      CREATE TABLE IF NOT EXISTS fairy_statuses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 0,
        max_transaction_amount REAL,
        total_helped_amount REAL DEFAULT 0,
        total_requests_fulfilled INTEGER DEFAULT 0,
        rating_average REAL DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    
    console.log('Fairy tables initialized');
  } catch (err) {
    console.error('Error initializing fairy tables:', err);
  }
}

const originalInitDB = initDB;
initDB = async function() {
  await originalInitDB();
  await initFairyTables();
};

async function updateFairyStatus(userId, isActive, maxTransactionAmount) {
  const settings = await get(`SELECT * FROM fairy_statuses WHERE user_id = ?`, [userId]);
  
  if (settings) {
    return run(
      `UPDATE fairy_statuses 
       SET is_active = ?, 
           max_transaction_amount = ?, 
           updated_at = datetime('now') 
       WHERE user_id = ?`,
      [isActive ? 1 : 0, maxTransactionAmount, userId]
    );
  } else {
    return run(
      `INSERT INTO fairy_statuses (user_id, is_active, max_transaction_amount) 
       VALUES (?, ?, ?)`,
      [userId, isActive ? 1 : 0, maxTransactionAmount]
    );
  }
}

initDB().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = {
  createUser,
  getUserById,
  getUserByStudentId,
  verifyPassword,
  getUserBalance,
  createTransaction,
  getUserTransactions,
  getBudgetSettings,
  updateBudgetSettings,
  toggleFairyStatus,
  getFairyStatus,
  getActiveFairies,
  createFairyRequest,
  getFairyRequest,
  getPendingFairyRequests,
  getUserFairyRequests,
  getFairyAcceptedRequests,
  acceptFairyRequest,
  confirmFairyRequest,
  addFairyRating,
  getUserPendingRequests,
  getFairyRequestById,
  cancelFairyRequest,
  rateFairyRequest,
  completeFairyRequest,
  getFairyLeaderboard,
  updateFairyStatus
}; 