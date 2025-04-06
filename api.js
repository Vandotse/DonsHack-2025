const db = require('./db');
const auth = require('./auth');

const locationIcons = {
  'Campus Café': 'fa-utensils',
  'University Bookstore': 'fa-book',
  'Student Center': 'fa-mug-hot',
  'Food Truck Rally': 'fa-truck',
  'Late Night Grill': 'fa-hamburger'
};

async function handleLogin(req, res) {
  try {
    const { student_id, password } = req.body;
    
    if (!student_id || !password) {
      return res.status(400).json({ error: 'Student ID and password are required' });
    }
    
    const user = await db.getUserByStudentId(student_id);
    if (!user) {
      return res.status(401).json({ 
        error: 'No account found with that Student ID. Please register first.' 
      });
    }
    
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
  res.json({ success: true });
}

function getCurrentUser(req, res) {
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

async function getTransactions(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.getUserTransactions(req.user.id, limit, offset);
    
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
    
    const settings = await db.getBudgetSettings(req.user.id);
    
    const balance = await db.getUserBalance(req.user.id);
    
    if (settings.strict_budget && balance.current_balance < amount) {
      return res.status(403).json({ 
        error: 'Transaction exceeds available balance with strict budget enabled' 
      });
    }
    
    const transaction = await db.createTransaction(req.user.id, amount, location, description);
    
    const icon = locationIcons[transaction.location] || 'fa-credit-card';
    transaction.icon = icon;
    
    res.json(transaction);
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getBudget(req, res) {
  try {
    const settings = await db.getBudgetSettings(req.user.id);
    
    if (!settings) {
      return res.status(404).json({ error: 'Budget settings not found' });
    }
    
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
    
    const updatedSettings = await db.getBudgetSettings(req.user.id);
    
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

async function getFairyStatus(req, res) {
  try {
    const status = await db.getFairyStatus(req.user.id);
    
    if (!status) {
      return res.json({
        is_active: false,
        total_helped_amount: 0,
        total_requests_fulfilled: 0,
        rating_average: 0,
        rating_count: 0
      });
    }
    
    res.json({
      id: status.id,
      is_active: Boolean(status.is_active),
      max_transaction_amount: status.max_transaction_amount,
      total_helped_amount: status.total_helped_amount,
      total_requests_fulfilled: status.total_requests_fulfilled,
      rating_average: status.rating_average,
      rating_count: status.rating_count
    });
  } catch (err) {
    console.error('Error getting fairy status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleFairyStatus(req, res) {
  try {
    const { is_active, max_transaction_amount } = req.body;
    
    if (is_active === undefined) {
      return res.status(400).json({ error: 'is_active field is required' });
    }
    
    await db.toggleFairyStatus(req.user.id, is_active, max_transaction_amount);
    
    const status = await db.getFairyStatus(req.user.id);
    
    res.json({
      id: status.id,
      is_active: Boolean(status.is_active),
      max_transaction_amount: status.max_transaction_amount,
      total_helped_amount: status.total_helped_amount,
      total_requests_fulfilled: status.total_requests_fulfilled,
      rating_average: status.rating_average,
      rating_count: status.rating_count
    });
  } catch (err) {
    console.error('Error toggling fairy status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getActiveFairies(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sort_by || 'rating';
    
    const result = await db.getActiveFairies(limit, offset, sortBy);
    
    const formattedFairies = result.fairies.map(fairy => ({
      id: fairy.id,
      user_id: fairy.user_id,
      name: fairy.name,
      student_id: fairy.student_id,
      is_active: Boolean(fairy.is_active),
      max_transaction_amount: fairy.max_transaction_amount,
      total_helped_amount: fairy.total_helped_amount,
      total_requests_fulfilled: fairy.total_requests_fulfilled,
      rating_average: fairy.rating_average,
      rating_count: fairy.rating_count
    }));
    
    res.json({
      fairies: formattedFairies,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error('Error getting active fairies:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createFairyRequest(req, res) {
  try {
    const { location, amount, description } = req.body;
    
    if (!location || !amount) {
      return res.status(400).json({ error: 'Location and amount are required' });
    }
    
    const validLocations = [
      'The Market Cafe', 
      'Undercaf', 
      'Law Cafe', 
      'Lone Mountain Cafe'
    ];
    
    if (!validLocations.includes(location)) {
      return res.status(400).json({ 
        error: 'Invalid location. Valid locations are: ' + validLocations.join(', ')
      });
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    
    const result = await db.createFairyRequest(req.user.id, location, amountNum, description);
    
    const request = await db.getFairyRequest(result.lastID);
    
    res.json(request);
  } catch (err) {
    console.error('Error creating fairy request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPendingFairyRequests(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.getPendingFairyRequests(limit, offset);
    
    res.json({
      requests: result.requests,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error('Error getting pending fairy requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserFairyRequests(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.getUserFairyRequests(req.user.id, limit, offset);
    
    res.json({
      requests: result.requests,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error('Error getting user fairy requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getFairyAcceptedRequests(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.getFairyAcceptedRequests(req.user.id, limit, offset);
    
    res.json({
      requests: result.requests,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error('Error getting fairy accepted requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function acceptFairyRequest(req, res) {
  try {
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    
    const fairyStatus = await db.getFairyStatus(req.user.id);
    
    if (!fairyStatus || !fairyStatus.is_active) {
      return res.status(403).json({ error: 'Only active fairies can accept requests' });
    }
    
    const request = await db.acceptFairyRequest(request_id, req.user.id);
    
    res.json(request);
  } catch (err) {
    console.error('Error accepting fairy request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function confirmFairyRequest(req, res) {
  try {
    const { request_id } = req.body;
    
    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }
    
    const request = await db.getFairyRequest(request_id);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const isRequestor = request.requestor_id === req.user.id;
    const isFairy = request.fairy_id === req.user.id;
    
    if (!isRequestor && !isFairy) {
      return res.status(403).json({ error: 'Only the requestor or the fairy can confirm this request' });
    }
    
    const updatedRequest = await db.confirmFairyRequest(request_id, req.user.id, isRequestor);
    
    res.json(updatedRequest);
  } catch (err) {
    console.error('Error confirming fairy request:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

async function rateFairy(req, res) {
  try {
    const { request_id, rating, comment } = req.body;
    
    if (!request_id || !rating) {
      return res.status(400).json({ error: 'request_id and rating are required' });
    }
    
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const request = await db.getFairyRequest(request_id);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.requestor_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the requestor can rate the fairy' });
    }
    
    if (request.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed requests can be rated' });
    }
    
    const ratingResult = await db.addFairyRating(
      request_id, 
      req.user.id, 
      request.fairy_id, 
      ratingNum, 
      comment
    );
    
    res.json(ratingResult);
  } catch (err) {
    console.error('Error rating fairy:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  handleLogin,
  handleRegister,
  handleLogout,
  
  getCurrentUser,
  getUserBalance,
  
  getTransactions,
  createTransaction,
  
  getBudget,
  updateBudget,
  
  getFairyStatus,
  toggleFairyStatus,
  getActiveFairies,
  createFairyRequest,
  getPendingFairyRequests,
  getUserFairyRequests,
  getFairyAcceptedRequests,
  acceptFairyRequest,
  confirmFairyRequest,
  rateFairy
}; 