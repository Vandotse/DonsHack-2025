const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const auth = require('./auth');
const api = require('./api');
const fairyRouter = require('./api/fairy');

process.env.JWT_SECRET = 'flexibudget-default-secret-key';

process.env.NODE_ENV = 'production';
const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web')));

app.use('/api/fairy', fairyRouter);

app.post('/api/login', api.handleLogin);
app.post('/api/register', api.handleRegister);
app.post('/api/logout', api.handleLogout);

app.get('/api/users/me', auth.authMiddleware, api.getCurrentUser);
app.get('/api/users/me/balance', auth.authMiddleware, api.getUserBalance);

app.get('/api/transactions', auth.authMiddleware, api.getTransactions);
app.post('/api/transactions/new', auth.authMiddleware, api.createTransaction);

app.get('/api/budget', auth.authMiddleware, api.getBudget);
app.post('/api/budget/update', auth.authMiddleware, api.updateBudget);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'login.html'));
});

app.use((req, res) => {
  const filePath = path.join(__dirname, 'web', req.path);
  
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
  } catch (err) {
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 