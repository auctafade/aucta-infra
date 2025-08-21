const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./database');

const SALT_ROUNDS = 10;

// Hash password
const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// Verify password
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT tokens
const generateTokens = (clientId) => {
  const accessToken = jwt.sign(
    { clientId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const refreshToken = jwt.sign(
    { clientId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.accessToken;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get client info
    const result = await pool.query(
      'SELECT id, name, email, wallet_address FROM clients WHERE id = $1 AND is_active = true',
      [decoded.clientId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.client = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
  authMiddleware
};