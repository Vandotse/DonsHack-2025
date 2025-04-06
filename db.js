const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Initialize database
const dbPath = process.env.DB_PATH || 'flexibudget.db';
const db = new sqlite3.Database(dbPath);

// Run a query with promise
function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Get a single row with promise
function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Get all rows with promise
function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Create tables if they don't exist
function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Create users table
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

        // Create balances table
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

        // Create budget_settings table
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

        // Create transactions table
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

        console.log('Database initialized');
        resolve();
      } catch (err) {
        console.error('Error initializing database:', err);
        reject(err);
      }
    });
  });
}

// User operations
async function createUser(studentID, name, email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Begin transaction
        await run('BEGIN TRANSACTION');
        
        // Insert user
        const userResult = await run(
          `INSERT INTO users (student_id, password_hash, name, email, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [studentID, passwordHash, name, email]
        );
        
        const userID = userResult.lastID;
        
        // Create initial balance
        await run(
          `INSERT INTO balances (user_id, starting_balance, current_balance, updated_at)
           VALUES (?, ?, ?, datetime('now'))`,
          [userID, 1500.00, 1500.00]
        );
        
        // Create default budget settings
        await run(
          `INSERT INTO budget_settings (user_id, weekly_budget, budget_warnings, strict_budget, 
             transaction_notifications, weekly_reports, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [userID, 100.00, 1, 0, 1, 1]
        );
        
        // Commit transaction
        await run('COMMIT');
        
        // Get the created user
        const user = await getUserById(userID);
        resolve(user);
      } catch (err) {
        // Rollback transaction on error
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

// Balance operations
async function getUserBalance(userID) {
  return await get(
    `SELECT id, user_id, starting_balance, current_balance, updated_at
     FROM balances
     WHERE user_id = ?`,
    [userID]
  );
}

// Transaction operations
async function createTransaction(userID, amount, location, description) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Begin transaction
        await run('BEGIN TRANSACTION');
        
        // Get current balance
        const balance = await getUserBalance(userID);
        if (!balance) {
          throw new Error('Balance not found');
        }
        
        // Calculate new balance
        const newBalance = balance.current_balance - amount;
        
        // Update balance
        await run(
          `UPDATE balances
           SET current_balance = ?, updated_at = datetime('now')
           WHERE user_id = ?`,
          [newBalance, userID]
        );
        
        // Insert transaction
        const result = await run(
          `INSERT INTO transactions (user_id, amount, location, description, transaction_date)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [userID, amount, location, description || '']
        );
        
        // Commit transaction
        await run('COMMIT');
        
        // Get the created transaction
        const tx = await getTransactionById(result.lastID);
        resolve(tx);
      } catch (err) {
        // Rollback transaction on error
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
  // Get total count
  const countRow = await get(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ?`,
    [userID]
  );
  
  // Get transactions with pagination
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

// Budget settings operations
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

// Initialize database on startup
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
  updateBudgetSettings
}; 