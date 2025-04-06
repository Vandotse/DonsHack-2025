const jwt = require('jsonwebtoken');
const db = require('./db');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'flexibudget-default-secret-key';

// Token expiration (24 hours)
const TOKEN_EXPIRATION = '24h';

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object with id and student_id
 * @returns {Object} - Token and expiration information
 */
function generateToken(user) {
  const payload = {
    user_id: user.id,
    student_id: user.student_id
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  
  // Calculate expiration date
  const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
  
  return {
    token,
    expiresAt
  };
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Extract user ID from authorization header
 * @param {Object} req - Express request object
 * @returns {number|null} - User ID or null if token is invalid
 */
function extractUserID(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  
  const decoded = verifyToken(token);
  if (!decoded) return null;
  
  return decoded.user_id;
}

/**
 * Middleware to authenticate requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authMiddleware(req, res, next) {
  try {
    const userID = extractUserID(req);
    if (!userID) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verify user exists
    const user = await db.getUserById(userID);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Add user to request object
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

/**
 * Login a user
 * @param {string} studentID - Student ID
 * @param {string} password - Password
 * @returns {Object|null} - User and token information or null if login failed
 */
async function login(studentID, password) {
  try {
    const user = await db.getUserByStudentId(studentID);
    
    if (!user) {
      // User doesn't exist, return null to indicate login failure
      return null;
    }
    
    // Verify password
    const isValid = await db.verifyPassword(user, password);
    if (!isValid) {
      return null;
    }
    
    // Generate token with consistent JWT_SECRET
    const token = jwt.sign({
      user_id: user.id,
      student_id: user.student_id,
      name: user.name,
      email: user.email
    }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
    
    // Calculate expiration date
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

/**
 * Register a new user
 * @param {string} studentID - Student ID
 * @param {string} name - User's name
 * @param {string} email - User's email
 * @param {string} password - Password
 * @returns {Object|null} - User and token information or null if registration failed
 */
async function register(studentID, name, email, password) {
  try {
    // Check if user already exists
    const existingUser = await db.getUserByStudentId(studentID);
    if (existingUser) {
      return { error: 'User already exists' };
    }
    
    // Create new user
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