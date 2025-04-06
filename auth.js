const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'flexibudget-default-secret-key';

const TOKEN_EXPIRATION = '24h';

function generateToken(user) {
  const payload = {
    user_id: user.id,
    student_id: user.student_id
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  
  const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  
  return {
    token,
    expiresAt
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function extractUserID(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  
  const decoded = verifyToken(token);
  if (!decoded) return null;
  
  return decoded.user_id;
}

async function authMiddleware(req, res, next) {
  try {
    const userID = extractUserID(req);
    if (!userID) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await db.getUserById(userID);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    req.user = {
      id: user.id,
      student_id: user.student_id,
      name: user.name,
      email: user.email
    };
    
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(studentID, password) {
  try {
    const user = await db.getUserByStudentId(studentID);
    
    if (!user) {
      return null;
    }
    
    const isValid = await db.verifyPassword(user, password);
    if (!isValid) {
      return null;
    }
    
    const token = jwt.sign({
      user_id: user.id,
      student_id: user.student_id,
      name: user.name,
      email: user.email
    }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
    
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    
    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        student_id: user.student_id,
        name: user.name
      }
    };
  } catch (err) {
    console.error('Login error:', err);
    return null;
  }
}

async function register(studentID, name, email, password) {
  try {
    const existingUser = await db.getUserByStudentId(studentID);
    if (existingUser) {
      return { error: 'User already exists' };
    }
    
    const user = await db.createUser(studentID, name, email, password);
    
    const { token, expiresAt } = generateToken(user);
    
    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        student_id: user.student_id,
        name: user.name
      }
    };
  } catch (err) {
    console.error('Error registering user:', err);
    return { error: err.message };
  }
}

module.exports = {
  generateToken,
  verifyToken,
  extractUserID,
  authMiddleware,
  login,
  register
}; 