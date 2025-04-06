const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'flexibudget-default-secret-key';

const generateToken = (user) => {
  const payload = {
    user_id: user.id,
    student_id: user.student_id,
    name: user.name,
    email: user.email
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};

const verifyJWT = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

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