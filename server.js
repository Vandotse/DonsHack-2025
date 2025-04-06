const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Import our modules
const auth = require('./auth');
const api = require('./api');
const fairyRouter = require('./api/fairy');

// Set up global JWT secret
process.env.JWT_SECRET = 'flexibudget-default-secret-key';

// Set environment variables
process.env.NODE_ENV = 'production';
const PORT = process.env.PORT || 3001;

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web')));

// API Routes
// Use fairy API router
app.use('/api/fairy', fairyRouter);

// Legacy API routes
// Public routes (no authentication required)
app.post('/api/login', api.handleLogin);
app.post('/api/register', api.handleRegister);
app.post('/api/logout', api.handleLogout);

// Protected routes (authentication required)
// User routes
app.get('/api/users/me', auth.authMiddleware, api.getCurrentUser);
app.get('/api/users/me/balance', auth.authMiddleware, api.getUserBalance);

// Transaction routes
app.get('/api/transactions', auth.authMiddleware, api.getTransactions);
app.post('/api/transactions/new', auth.authMiddleware, api.createTransaction);

// Budget routes
app.get('/api/budget', auth.authMiddleware, api.getBudget);
app.post('/api/budget/update', auth.authMiddleware, api.updateBudget);

// Route for root path - serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'login.html'));
});

// Fallback route - if not found, serve login page
app.use((req, res) => {
  // Try to serve the requested path first
  const filePath = path.join(__dirname, 'web', req.path);
  
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    
    // If the path isn't a file, redirect to login.html
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
  } catch (err) {
    // If there's an error (e.g., invalid characters in path), redirect to login
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 