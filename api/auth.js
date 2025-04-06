const jwt = require('jsonwebtoken');

// Secret key for JWT signing (this should be in a .env file in production)
const JWT_SECRET = process.env.JWT_SECRET || 'flexibudget-default-secret-key';

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  const payload = {
    user_id: user.id,
    student_id: user.student_id,
    name: user.name,
    email: user.email
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyJWT = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Middleware to verify token from Authorization header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyJWT(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
  
  // Add user info from token payload to request
  req.user = {
    id: decoded.user_id,
    student_id: decoded.student_id,
    name: decoded.name,
    email: decoded.email
  };
  
  next();
};

module.exports = {
  generateToken,
  verifyJWT,
  verifyToken
}; 