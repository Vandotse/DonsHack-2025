const db = require('./db');
const auth = require('./auth');

// Location icons mapping
const locationIcons = {
  'Campus Café': 'fa-utensils',
  'University Bookstore': 'fa-book',
  'Student Center': 'fa-mug-hot',
  'Food Truck Rally': 'fa-truck',
  'Late Night Grill': 'fa-hamburger'
};

// Authentication routes
async function handleLogin(req, res) {
  try {
    const { student_id, password } = req.body;
    
    if (!student_id || !password) {
      return res.status(400).json({ error: 'Student ID and password are required' });
    }
    
    // First check if the user exists
    const user = await db.getUserByStudentId(student_id);
    if (!user) {
      return res.status(401).json({ 
        error: 'No account found with that Student ID. Please register first.' 
      });
    }
    
    // Then attempt the login
    const loginResult = await auth.login(student_id, password);
    if (!loginResult) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    
    res.json(loginResult);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRegister(req, res) {
  try {
    const { student_id, name, email, password } = req.body;
    
    if (!student_id || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const registrationResult = await auth.register(student_id, name, email, password);
    if (registrationResult.error) {
      return res.status(400).json({ error: registrationResult.error });
    }
    
    res.json(registrationResult);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function handleLogout(req, res) {
  // In a stateless JWT authentication system, we don't need to do anything server-side
  // The client should discard the token
  res.json({ success: true });
}

// User routes
function getCurrentUser(req, res) {
  // User information is already attached to the request by the auth middleware
  const { id, student_id, name, email } = req.user;
  
  res.json({
    id,
    student_id,
    name,
    email
  });
}

async function getUserBalance(req, res) {
  try {
    const balance = await db.getUserBalance(req.user.id);
    
    if (!balance) {
      return res.status(404).json({ error: 'Balance not found' });
    }
    
    // Calculate spent amount
    const spentAmount = balance.starting_balance - balance.current_balance;
    
    res.json({
      user_id: balance.user_id,
      starting_balance: balance.starting_balance,
      current_balance: balance.current_balance,
      spent_amount: spentAmount
    });
  } catch (err) {
    console.error('Error getting balance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Transaction routes
async function getTransactions(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.getUserTransactions(req.user.id, limit, offset);
    
    // Add icons to transactions
    const defaultIcon = 'fa-credit-card';
    const transactionsWithIcons = result.transactions.map(tx => {
      const icon = locationIcons[tx.location] || defaultIcon;
      return { ...tx, icon };
    });
    
    res.json({
      transactions: transactionsWithIcons,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error('Error getting transactions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createTransaction(req, res) {
  try {
    const { amount, location, description } = req.body;
    
    if (!amount || !location) {
      return res.status(400).json({ error: 'Amount and location are required' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }
    
    // Check budget settings
    const settings = await db.getBudgetSettings(req.user.id);
    
    // Get current balance
    const balance = await db.getUserBalance(req.user.id);
    
    // Check if transaction would exceed balance and strict budget is enabled
    if (settings.strict_budget && balance.current_balance < amount) {
      return res.status(403).json({ 
        error: 'Transaction exceeds available balance with strict budget enabled' 
      });
    }
    
    const transaction = await db.createTransaction(req.user.id, amount, location, description);
    
    // Add icon
    const icon = locationIcons[transaction.location] || 'fa-credit-card';
    transaction.icon = icon;
    
    res.json(transaction);
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: err.message });
  }
}

// Budget routes
async function getBudget(req, res) {
  try {
    const settings = await db.getBudgetSettings(req.user.id);
    
    if (!settings) {
      return res.status(404).json({ error: 'Budget settings not found' });
    }
    
    // Convert SQLite boolean integers to JavaScript booleans
    res.json({
      id: settings.id,
      user_id: settings.user_id,
      weekly_budget: settings.weekly_budget,
      budget_warnings: Boolean(settings.budget_warnings),
      strict_budget: Boolean(settings.strict_budget),
      transaction_notifications: Boolean(settings.transaction_notifications),
      weekly_reports: Boolean(settings.weekly_reports),
      updated_at: settings.updated_at
    });
  } catch (err) {
    console.error('Error getting budget settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateBudget(req, res) {
  try {
    const { 
      weekly_budget, 
      budget_warnings, 
      strict_budget, 
      transaction_notifications, 
      weekly_reports 
    } = req.body;
    
    if (weekly_budget <= 0) {
      return res.status(400).json({ error: 'Weekly budget must be positive' });
    }
    
    const settings = {
      weekly_budget,
      budget_warnings,
      strict_budget,
      transaction_notifications,
      weekly_reports
    };
    
    await db.updateBudgetSettings(req.user.id, settings);
    
    // Get updated settings
    const updatedSettings = await db.getBudgetSettings(req.user.id);
    
    // Convert SQLite boolean integers to JavaScript booleans
    res.json({
      id: updatedSettings.id,
      user_id: updatedSettings.user_id,
      weekly_budget: updatedSettings.weekly_budget,
      budget_warnings: Boolean(updatedSettings.budget_warnings),
      strict_budget: Boolean(updatedSettings.strict_budget),
      transaction_notifications: Boolean(updatedSettings.transaction_notifications),
      weekly_reports: Boolean(updatedSettings.weekly_reports),
      updated_at: updatedSettings.updated_at
    });
  } catch (err) {
    console.error('Error updating budget settings:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  // Auth routes
  handleLogin,
  handleRegister,
  handleLogout,
  
  // User routes
  getCurrentUser,
  getUserBalance,
  
  // Transaction routes
  getTransactions,
  createTransaction,
  
  // Budget routes
  getBudget,
  updateBudget
}; 