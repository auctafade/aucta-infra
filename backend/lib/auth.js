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
const express = require('express');
const router = express.Router();
const pool = require('../lib/database');
const { hashPassword, verifyPassword, generateTokens, authMiddleware } = require('../lib/auth');
const { generateWallet } = require('../lib/walletUtils');

// Register new client
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, kyc_info } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM clients WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password and generate wallet
    const passwordHash = await hashPassword(password);
    const walletAddress = generateWallet();

    // Create client
    const result = await pool.query(
      `INSERT INTO clients (name, email, password_hash, wallet_address, kyc_info) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, wallet_address`,
      [name, email, passwordHash, walletAddress, kyc_info || null]
    );

    const client = result.rows[0];

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(client.id);

    // Store refresh token
    await pool.query(
      `INSERT INTO sessions (client_id, refresh_token, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [client.id, refreshToken]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [client.id, 'CLIENT_REGISTERED', { email, wallet_address: walletAddress }]
    );

    res.status(201).json({
      message: 'Registration successful',
      client,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find client
    const result = await pool.query(
      'SELECT id, name, email, password_hash, wallet_address FROM clients WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const client = result.rows[0];

    // Verify password
    const isValid = await verifyPassword(password, client.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(client.id);

    // Store refresh token
    await pool.query(
      `INSERT INTO sessions (client_id, refresh_token, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [client.id, refreshToken]
    );

    // Update last login
    await pool.query(
      'UPDATE clients SET last_login = NOW() WHERE id = $1',
      [client.id]
    );

    // Log action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [client.id, 'CLIENT_LOGIN', { email }]
    );

    // Remove password hash from response
    delete client.password_hash;

    res.json({
      message: 'Login successful',
      client,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (refreshToken) {
      // Remove refresh token from database
      await pool.query(
        'DELETE FROM sessions WHERE refresh_token = $1',
        [refreshToken]
      );
    }

    // Log action
    await pool.query(
      'INSERT INTO action_logs (client_id, action) VALUES ($1, $2)',
      [req.client.id, 'CLIENT_LOGOUT']
    );

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ client: req.client });
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database
    const tokenResult = await pool.query(
      'SELECT * FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Token expired or not found' });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.clientId);

    // Update refresh token
    await pool.query(
      'UPDATE sessions SET refresh_token = $1, expires_at = NOW() + INTERVAL \'7 days\' WHERE refresh_token = $2',
      [newRefreshToken, refreshToken]
    );

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

module.exports = router;