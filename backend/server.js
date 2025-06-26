// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('./lib/database');
const { blockchainSimulator } = require('./blockchain-simulator');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
const securityDocsDir = path.join(__dirname, 'uploads/security');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(securityDocsDir)) {
  fs.mkdirSync(securityDocsDir, { recursive: true });
}

// Initialize database tables on startup
async function initializeDatabase() {
  try {
    // Create proxy_assignments table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proxy_assignments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        proxy_name VARCHAR(255) NOT NULL,
        proxy_email VARCHAR(255),
        proxy_wallet_address VARCHAR(255),
        relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('Family', 'Lawyer', 'Other')),
        role VARCHAR(50) NOT NULL CHECK (role IN ('viewer', 'legal_proxy', 'inheritance_heir')),
        country VARCHAR(100) NOT NULL,
        additional_notes TEXT,
        id_document_url VARCHAR(500),
        legal_document_url VARCHAR(500),
        status VARCHAR(50) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'active', 'rejected', 'revoked')),
        admin_notes TEXT,
        created_proxy_client_id INTEGER REFERENCES clients(id),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP,
        revoked_at TIMESTAMP
      )
    `);

    // Create notifications table for system messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'security')),
        read BOOLEAN DEFAULT false,
        action_url VARCHAR(500),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // Create client_sessions table for advanced session management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_sessions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        session_token VARCHAR(500) NOT NULL UNIQUE,
        device_info JSONB,
        ip_address INET,
        location_info JSONB,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create security_settings table for client-specific security configs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_settings (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_method VARCHAR(20) CHECK (two_factor_method IN ('sms', 'email', 'authenticator', 'faceid')),
        geo_tracking_enabled BOOLEAN DEFAULT false,
        login_notifications BOOLEAN DEFAULT true,
        suspicious_activity_alerts BOOLEAN DEFAULT true,
        require_biometric_for_transfers BOOLEAN DEFAULT false,
        session_timeout_minutes INTEGER DEFAULT 60,
        max_concurrent_sessions INTEGER DEFAULT 3,
        trusted_devices JSONB DEFAULT '[]'::jsonb,
        security_questions JSONB,
        last_password_change TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        account_locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create system_maintenance table for scheduled maintenance windows
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_maintenance (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        maintenance_type VARCHAR(50) DEFAULT 'scheduled' CHECK (maintenance_type IN ('scheduled', 'emergency', 'security')),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        affected_services JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
        notify_clients BOOLEAN DEFAULT true,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create audit_trail table for enhanced security auditing
    // Create blockchain_transactions table for detailed SBT tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_transactions (
        id SERIAL PRIMARY KEY,
        passport_id INTEGER REFERENCES passports(id),
        client_id INTEGER REFERENCES clients(id),
        transaction_hash VARCHAR(66) NOT NULL UNIQUE,
        transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('mint', 'transfer', 'burn', 'metadata_update')),
        from_address VARCHAR(42),
        to_address VARCHAR(42),
        token_id VARCHAR(100),
        gas_used BIGINT,
        gas_price BIGINT,
        block_number BIGINT,
        block_hash VARCHAR(66),
        confirmation_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP
      )
    `);

    // Create product_valuations table for tracking asset values over time
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_valuations (
        id SERIAL PRIMARY KEY,
        passport_id INTEGER REFERENCES passports(id) ON DELETE CASCADE,
        valuation_type VARCHAR(50) NOT NULL CHECK (valuation_type IN ('market', 'insurance', 'auction', 'appraisal')),
        valuation_amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'EUR',
        valuation_date DATE NOT NULL,
        appraiser_name VARCHAR(255),
        appraiser_license VARCHAR(100),
        methodology TEXT,
        supporting_documents JSONB DEFAULT '[]'::jsonb,
        confidence_level VARCHAR(20) CHECK (confidence_level IN ('low', 'medium', 'high', 'certified')),
        market_conditions TEXT,
        validity_period_months INTEGER DEFAULT 12,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create transfer_requests table for secure product transfers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transfer_requests (
        id SERIAL PRIMARY KEY,
        passport_id INTEGER REFERENCES passports(id),
        from_client_id INTEGER REFERENCES clients(id),
        to_client_id INTEGER,
        to_email VARCHAR(255),
        to_wallet_address VARCHAR(42),
        transfer_reason VARCHAR(500),
        transfer_type VARCHAR(50) DEFAULT 'sale' CHECK (transfer_type IN ('sale', 'gift', 'inheritance', 'legal_transfer', 'insurance_claim')),
        agreed_value DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'EUR',
        requires_kyc BOOLEAN DEFAULT true,
        requires_biometric BOOLEAN DEFAULT true,
        biometric_confirmed_from BOOLEAN DEFAULT false,
        biometric_confirmed_to BOOLEAN DEFAULT false,
        legal_documents JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'kyc_required', 'approval_required', 'approved', 'in_progress', 'completed', 'cancelled', 'rejected')),
        admin_notes TEXT,
        expires_at TIMESTAMP,
        initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Create audit_trail table for enhanced security auditing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id),
        admin_user VARCHAR(100),
        action_category VARCHAR(50) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
        geolocation JSONB,
        session_id VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to clients table if they don't exist
    const clientColumns = [
      'email VARCHAR(255)',
      'phone VARCHAR(50)',
      'preferred_contact VARCHAR(50)',
      'street_address TEXT',
      'zip_code VARCHAR(20)',
      'city VARCHAR(100)',
      'country VARCHAR(100)',
      'proof_of_address_status VARCHAR(50) DEFAULT \'pending\'',
      'language VARCHAR(10) DEFAULT \'en\'',
      'currency VARCHAR(10) DEFAULT \'EUR\'',
      'enable_notifications BOOLEAN DEFAULT true',
      'allow_qr_access BOOLEAN DEFAULT true',
      'date_of_birth DATE',
      'place_of_birth VARCHAR(255)',
      'nationality VARCHAR(100)',
      'kyc_status VARCHAR(50) DEFAULT \'pending\'',
      'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];

    for (const column of clientColumns) {
      const columnName = column.split(' ')[0];
      try {
        await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${column}`);
      } catch (err) {
        // Column might already exist, ignore error
        console.log(`Column ${columnName} might already exist`);
      }
    }

    console.log('✅ Database tables initialized successfully');
    
    // Create indexes for better performance
    await createIndexes();
    
    // Initialize default security settings for existing clients
    await initializeDefaultSecuritySettings();
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Create database indexes for better performance
async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_action_logs_client_timestamp ON action_logs(client_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action)',
    'CREATE INDEX IF NOT EXISTS idx_passports_client ON passports(assigned_client_id)',
    'CREATE INDEX IF NOT EXISTS idx_passports_status ON passports(status)',
    'CREATE INDEX IF NOT EXISTS idx_client_sessions_token ON client_sessions(session_token)',
    'CREATE INDEX IF NOT EXISTS idx_client_sessions_client ON client_sessions(client_id, is_active)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_client_unread ON notifications(client_id, read)',
    'CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_hash ON blockchain_transactions(transaction_hash)',
    'CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_status ON blockchain_transactions(status)',
    'CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status)',
    'CREATE INDEX IF NOT EXISTS idx_audit_trail_client_time ON audit_trail(client_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_audit_trail_risk ON audit_trail(risk_level, timestamp DESC)'
  ];

  for (const indexQuery of indexes) {
    try {
      await pool.query(indexQuery);
    } catch (err) {
      console.log('Index might already exist:', err.message);
    }
  }
  console.log('✅ Database indexes created successfully');
}

// Initialize default security settings for existing clients
async function initializeDefaultSecuritySettings() {
  try {
    await pool.query(`
      INSERT INTO security_settings (client_id)
      SELECT id FROM clients 
      WHERE id NOT IN (SELECT client_id FROM security_settings WHERE client_id IS NOT NULL)
      ON CONFLICT (client_id) DO NOTHING
    `);
    console.log('✅ Default security settings initialized');
  } catch (error) {
    console.log('Security settings initialization completed');
  }
}

// Initialize database on startup
initializeDatabase();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for security documents
const securityStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, securityDocsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const clientId = req.body.client_id || 'unknown';
    const requestType = req.body.request_type || 'general';
    cb(null, `${clientId}-${requestType}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const uploadSecurityDoc = multer({
  storage: securityStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
});

// Serve uploaded images and documents
app.use('/uploads', express.static(uploadDir));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Handle SPA routing
app.get('/mint-sbt', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/mint-sbt.html'));
});

// Handle SPA routing - serve mint-sbt.html for all mint-sbt routes
app.get('/mint-sbt/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/mint-sbt.html'));
});

// Handle mint-confirmation redirect to mint-sbt
app.get('/mint-confirmation', (req, res) => {
  res.redirect('/');
});

// Helper function to generate metadata hash
function generateMetadataHash(metadata) {
  return crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
}

// Helper function to generate transaction ID
function generateTransactionId() {
  return 'AUCTA-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Helper function to save base64 image and return URL
function saveBase64Image(base64Data, prefix = 'image') {
  try {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image data');
    }
    
    const extension = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');
    
    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
    const filepath = path.join(uploadDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Error saving base64 image:', error);
    return null;
  }
}

// Helper function to calculate MoneySBT balance (2% cashback system)
async function logAction(clientId, action, details = {}, options = {}) {
  const {
    passportId = null,
    adminUser = null,
    riskLevel = 'low',
    ipAddress = null,
    userAgent = null,
    resourceType = null,
    resourceId = null,
    oldValues = null,
    newValues = null
  } = options;

  try {
    // Log to action_logs (existing functionality)
    await pool.query(
      'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
      [clientId, passportId, action, details]
    );

    // Log to audit_trail for enhanced security tracking
    await pool.query(`
      INSERT INTO audit_trail (
        client_id, admin_user, action_category, action_type, 
        resource_type, resource_id, old_values, new_values,
        ip_address, user_agent, risk_level, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    `, [
      clientId,
      adminUser,
      action.split('_')[0], // e.g., 'CLIENT' from 'CLIENT_LOGIN'
      action,
      resourceType,
      resourceId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      riskLevel
    ]);

    console.log(`📝 Action logged: ${action} for client ${clientId}`);
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

// Enhanced notification system
async function createNotification(clientId, title, message, type = 'info', options = {}) {
  const {
    actionUrl = null,
    metadata = {},
    expiresInDays = 30
  } = options;

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await pool.query(`
      INSERT INTO notifications (client_id, title, message, type, action_url, metadata, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [clientId, title, message, type, actionUrl, JSON.stringify(metadata), expiresAt]);

    console.log(`🔔 Notification created for client ${clientId}: ${title}`);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Enhanced session management
async function createSession(clientId, sessionToken, deviceInfo, ipAddress, locationInfo = {}) {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour sessions

    await pool.query(`
      INSERT INTO client_sessions (
        client_id, session_token, device_info, ip_address, 
        location_info, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      clientId,
      sessionToken,
      JSON.stringify(deviceInfo),
      ipAddress,
      JSON.stringify(locationInfo),
      expiresAt
    ]);

    // Cleanup old sessions (keep only last 5 per client)
    await pool.query(`
      UPDATE client_sessions 
      SET is_active = false 
      WHERE client_id = $1 
      AND id NOT IN (
        SELECT id FROM client_sessions 
        WHERE client_id = $1 AND is_active = true 
        ORDER BY created_at DESC 
        LIMIT 5
      )
    `, [clientId]);

  } catch (error) {
    console.error('Error creating session:', error);
  }
}

// Risk assessment for activities
function assessRiskLevel(action, details = {}, clientHistory = {}) {
  // High-risk activities
  if ([
    'EMERGENCY_LOCKDOWN_REQUEST',
    'SUSPICIOUS_ACTIVITY_REPORT',
    'PROXY_ACCESS_REVOKED',
    'TRANSFER_REQUEST_INITIATED'
  ].includes(action)) {
    return 'high';
  }

  // Medium-risk activities
  if ([
    'PROXY_REQUEST_SUBMITTED',
    'SECURITY_UPDATE',
    'DEVICE_RESET_REQUEST',
    'PHYSICAL_AGENT_REQUEST'
  ].includes(action)) {
    return 'medium';
  }

  // Critical activities (admin-only or emergency)
  if ([
    'ADMIN_OVERRIDE',
    'SYSTEM_MAINTENANCE',
    'EMERGENCY_ACCESS'
  ].includes(action)) {
    return 'critical';
  }

  return 'low';
}
async function calculateMoneySBTBalance(clientId) {
  try {
    // Get all owned products with their values
    const productsResult = await pool.query(
      `SELECT 
        p.metadata->>'original_price' as original_price,
        p.metadata->>'brand' as brand,
        p.metadata->>'object_name' as object_name,
        p.created_at,
        p.status
      FROM passports p 
      WHERE p.assigned_client_id = $1 AND p.status IN ('ASSIGNED', 'MINTED')`,
      [clientId]
    );

    let totalCashback = 0;
    const transactions = [];

    // Calculate 2% cashback on initial purchases
    productsResult.rows.forEach(product => {
      if (product.original_price) {
        const price = parseFloat(product.original_price.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(price)) {
          const cashback = price * 0.02; // 2% cashback
          totalCashback += cashback;
          
          transactions.push({
            type: 'purchase_cashback',
            product: `${product.brand} ${product.object_name}`,
            amount: cashback,
            productValue: price,
            date: product.created_at,
            description: `2% cashback on purchase`
          });
        }
      }
    });

    // Simulate some resale cashbacks (in production, this would come from actual resale data)
    if (productsResult.rows.length > 0) {
      // Add simulated resale cashback for demonstration
      const resaleCashback = 41.65; // Simulated resale earnings
      totalCashback += resaleCashback;
      
      transactions.push({
        type: 'resale_cashback',
        product: 'Saffiano Briefcase',
        amount: resaleCashback,
        productValue: 2082.50, // Simulated resale price
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        description: '2% cashback on resale'
      });
    }

    return {
      totalBalance: totalCashback,
      transactions: transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
    };
  } catch (error) {
    console.error('Error calculating MoneySBT balance:', error);
    return { totalBalance: 0, transactions: [] };
  }
}

// Simple JWT-like token generation (in production, use proper JWT library)
function generateAuthToken(clientId) {
  const payload = {
    clientId,
    timestamp: Date.now(),
    random: crypto.randomBytes(16).toString('hex')
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Verify token (simple implementation)
function verifyAuthToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    // Check if token is less than 24 hours old
    if (Date.now() - payload.timestamp > 24 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Middleware to verify authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token' });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.clientId = payload.clientId;
  next();
}

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'AUCTA Backend Running', 
    version: '2.0.0',
    database: 'PostgreSQL',
    port: PORT 
  });
});

// Client login endpoint
app.post('/client/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    // Query for client by wallet address, email, or ID
    let query;
    let queryParams;

    if (identifier.startsWith('0x')) {
      // Wallet address
      query = 'SELECT * FROM clients WHERE wallet_address = $1';
      queryParams = [identifier];
    } else if (identifier.includes('@')) {
      // Email (search in KYC info)
      query = `SELECT * FROM clients WHERE kyc_info::jsonb->>'email' = $1`;
      queryParams = [identifier];
    } else {
      // Client ID
      query = 'SELECT * FROM clients WHERE id = $1';
      queryParams = [parseInt(identifier)];
    }

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const client = result.rows[0];

    // In production, verify password hash
    // For demo, accept any password
    const token = generateAuthToken(client.id);

    // Enhanced login logging with risk assessment
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || req.connection.remoteAddress,
      acceptLanguage: req.headers['accept-language'],
      timestamp: new Date()
    };

    const riskLevel = assessRiskLevel('CLIENT_LOGIN', { method: 'credentials' });

    // Log the login action with enhanced details
    await logAction(client.id, 'CLIENT_LOGIN', { 
      method: 'credentials', 
      timestamp: new Date(),
      device_info: deviceInfo,
      login_success: true
    }, {
      riskLevel: riskLevel,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent
    });

    // Create session record
    await createSession(client.id, token, deviceInfo, deviceInfo.ip);

    // Create login notification if enabled
    const securitySettings = await pool.query(
      'SELECT login_notifications FROM security_settings WHERE client_id = $1',
      [client.id]
    );

    if (securitySettings.rows[0]?.login_notifications !== false) {
      await createNotification(
        client.id,
        'New Login Detected',
        `Your AUCTA vault was accessed from a new device. If this wasn't you, please contact support immediately.`,
        'security',
        { metadata: { ip: deviceInfo.ip, userAgent: deviceInfo.userAgent } }
      );
    }

    // Get client's owned products count
    const passportsResult = await pool.query(
      'SELECT COUNT(*) as count FROM passports WHERE assigned_client_id = $1',
      [client.id]
    );

    res.json({
      success: true,
      token,
      client: {
        id: client.id,
        name: client.name,
        walletAddress: client.wallet_address,
        createdAt: client.created_at,
        ownedProducts: parseInt(passportsResult.rows[0].count)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Biometric login endpoint (simulated)
app.post('/client/biometric-login', async (req, res) => {
  try {
    const { biometricId } = req.body;

    // In production, verify biometric data
    // For demo, use a hardcoded client ID
    const clientId = 1; // Demo client

    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Client not found' });
    }

    const client = result.rows[0];
    const token = generateAuthToken(client.id);

    // Log the biometric login
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [client.id, 'CLIENT_LOGIN', { method: 'biometric', timestamp: new Date() }]
    );

    res.json({
      success: true,
      token,
      client: {
        id: client.id,
        name: client.name,
        walletAddress: client.wallet_address,
        createdAt: client.created_at
      }
    });
  } catch (err) {
    console.error('Biometric login error:', err);
    res.status(500).json({ error: 'Biometric login failed' });
  }
});

// Biometric login with email endpoint
app.post('/client/biometric-login-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Query for client by email in KYC info
    const query = `
      SELECT id, name, wallet_address, kyc_info, created_at 
      FROM clients 
      WHERE kyc_info::jsonb->>'email' = $1
    `;
    
    const result = await pool.query(query, [email.toLowerCase()]);

    if (result.rows.length === 0) {
      // Try case-insensitive search
      const caseInsensitiveQuery = `
        SELECT id, name, wallet_address, kyc_info, created_at 
        FROM clients 
        WHERE LOWER(kyc_info::jsonb->>'email') = LOWER($1)
      `;
      
      const caseInsensitiveResult = await pool.query(caseInsensitiveQuery, [email]);
      
      if (caseInsensitiveResult.rows.length === 0) {
        return res.status(401).json({ error: 'No account found with this email address' });
      }
      
      result.rows = caseInsensitiveResult.rows;
    }

    const client = result.rows[0];
    
    // Generate auth token
    const token = generateAuthToken(client.id);

    // Enhanced biometric login logging
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || req.connection.remoteAddress,
      biometricType: 'TouchID/FaceID',
      timestamp: new Date()
    };

    // Log the biometric login with enhanced security tracking
    await logAction(client.id, 'CLIENT_LOGIN', { 
      method: 'biometric_email', 
      email: email,
      timestamp: new Date(),
      device_info: deviceInfo,
      login_success: true
    }, {
      riskLevel: assessRiskLevel('CLIENT_LOGIN', { method: 'biometric_email' }),
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent
    });

    // Create session record
    await createSession(client.id, token, deviceInfo, deviceInfo.ip);

    // Get client's owned products count
    const passportsResult = await pool.query(
      'SELECT COUNT(*) as count FROM passports WHERE assigned_client_id = $1',
      [client.id]
    );

    // Parse KYC info to include in response
    let kycData = {};
    try {
      kycData = typeof client.kyc_info === 'string' 
        ? JSON.parse(client.kyc_info) 
        : client.kyc_info || {};
    } catch (e) {
      console.warn('Failed to parse KYC info:', e);
    }

    console.log(`✅ Biometric login successful for: ${client.name} (${email})`);

    res.json({
      success: true,
      token,
      client: {
        id: client.id,
        name: client.name,
        walletAddress: client.wallet_address,
        email: kycData.email || email,
        createdAt: client.created_at,
        ownedProducts: parseInt(passportsResult.rows[0].count)
      }
    });
  } catch (err) {
    console.error('Biometric email login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// =============================================================================
// ENHANCED NOTIFICATION SYSTEM ENDPOINTS
// =============================================================================

// Get notifications for a client
app.get('/client/:clientId/notifications', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unread === 'true';
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = `
      SELECT * FROM notifications 
      WHERE client_id = $1 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    let params = [clientId];

    if (unreadOnly) {
      query += ' AND read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2';
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      notifications: result.rows,
      unread_count: result.rows.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get all proxy assignments for a client
app.get('/client/:clientId/proxy', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT 
        pa.*,
        pc.name as proxy_client_name,
        pc.wallet_address as proxy_wallet_address_created
      FROM proxy_assignments pa
      LEFT JOIN clients pc ON pa.created_proxy_client_id = pc.id
      WHERE pa.client_id = $1 
      ORDER BY pa.requested_at DESC`,
      [clientId]
    );

    console.log(`📋 Found ${result.rows.length} proxy assignments for client ${clientId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching proxy assignments:', error);
    res.status(500).json({ error: 'Failed to fetch proxy assignments' });
  }
});

// Submit new proxy request
app.post('/client/:clientId/proxy', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      proxy_name,
      proxy_email,
      proxy_wallet_address,
      relationship,
      role,
      country,
      additional_notes,
      id_document_url,
      legal_document_url
    } = req.body;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!proxy_name || !relationship || !role || !country) {
      return res.status(400).json({ 
        error: 'Missing required fields: proxy_name, relationship, role, country' 
      });
    }

    // Validate role
    const validRoles = ['viewer', 'legal_proxy', 'inheritance_heir'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Validate relationship
    const validRelationships = ['Family', 'Lawyer', 'Other'];
    if (!validRelationships.includes(relationship)) {
      return res.status(400).json({ error: 'Invalid relationship specified' });
    }

    // Validate email format if provided
    if (proxy_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(proxy_email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // Validate wallet address format if provided
    if (proxy_wallet_address) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(proxy_wallet_address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
    }

    // Check for duplicate active proxy with same role
    const existingProxy = await pool.query(
      'SELECT id FROM proxy_assignments WHERE client_id = $1 AND role = $2 AND status = $3',
      [clientId, role, 'active']
    );

    if (existingProxy.rows.length > 0) {
      return res.status(409).json({ 
        error: `An active ${role.replace('_', ' ')} proxy already exists. Please revoke the existing one first.` 
      });
    }

    // Verify client exists
    const clientResult = await pool.query('SELECT name FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Insert new proxy request
    const result = await pool.query(
      `INSERT INTO proxy_assignments (
        client_id, proxy_name, proxy_email, proxy_wallet_address, 
        relationship, role, country, additional_notes, 
        id_document_url, legal_document_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING *`,
      [
        clientId, proxy_name, proxy_email, proxy_wallet_address,
        relationship, role, country, additional_notes,
        id_document_url, legal_document_url, 'pending_review'
      ]
    );

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'PROXY_REQUEST_SUBMITTED', {
        proxy_id: result.rows[0].id,
        proxy_name: proxy_name,
        role: role,
        relationship: relationship,
        status: 'pending_review',
        requested_at: new Date().toISOString()
      }]
    );

    console.log(`✅ Proxy request submitted: ${proxy_name} (${role}) for client ${clientId}`);

    res.status(201).json({
      success: true,
      proxy: result.rows[0],
      message: 'Proxy request submitted successfully. AUCTA will review and contact both parties.',
      requestId: `PROXY-${result.rows[0].id}-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting proxy request:', error);
    res.status(500).json({ error: 'Failed to submit proxy request' });
  }
});

// Revoke proxy access
app.put('/client/:clientId/proxy/:proxyId/revoke', requireAuth, async (req, res) => {
  try {
    const { clientId, proxyId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if proxy exists and belongs to client
    const proxyCheck = await pool.query(
      'SELECT * FROM proxy_assignments WHERE id = $1 AND client_id = $2',
      [proxyId, clientId]
    );

    if (proxyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proxy assignment not found' });
    }

    const proxy = proxyCheck.rows[0];

    if (proxy.status === 'revoked') {
      return res.status(409).json({ error: 'Proxy access already revoked' });
    }

    // Update proxy status to revoked
    const result = await pool.query(
      `UPDATE proxy_assignments 
       SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND client_id = $2 
       RETURNING *`,
      [proxyId, clientId]
    );

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'PROXY_ACCESS_REVOKED', {
        proxy_id: proxyId,
        proxy_name: proxy.proxy_name,
        role: proxy.role,
        revoked_at: new Date().toISOString(),
        previous_status: proxy.status
      }]
    );

    console.log(`✅ Proxy access revoked: ${proxy.proxy_name} for client ${clientId}`);

    res.json({
      success: true,
      proxy: result.rows[0],
      message: 'Proxy access revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking proxy access:', error);
    res.status(500).json({ error: 'Failed to revoke proxy access' });
  }
});

// Get proxy assignment history
app.get('/client/:clientId/proxy/history', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all proxy-related actions
    const result = await pool.query(
      `SELECT * FROM action_logs 
       WHERE client_id = $1 AND action LIKE '%PROXY%' 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [clientId, limit]
    );

    const history = result.rows.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
      proxy_name: log.details?.proxy_name || 'Unknown',
      role: log.details?.role || 'Unknown'
    }));

    res.json(history);
  } catch (error) {
    console.error('Error fetching proxy history:', error);
    res.status(500).json({ error: 'Failed to fetch proxy history' });
  }
});

// Admin endpoint - Approve/reject proxy requests (for AUCTA staff)
app.put('/admin/proxy/:proxyId/status', requireAuth, async (req, res) => {
  try {
    const { proxyId } = req.params;
    const { status, admin_notes } = req.body;
    
    // TODO: Add admin role verification in production
    // if (req.userRole !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const validStatuses = ['active', 'rejected', 'pending_review'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get current proxy info
    const proxyCheck = await pool.query(
      'SELECT * FROM proxy_assignments WHERE id = $1',
      [proxyId]
    );

    if (proxyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proxy assignment not found' });
    }

    const proxy = proxyCheck.rows[0];

    // Update proxy status
    const updateQuery = status === 'active' 
      ? `UPDATE proxy_assignments 
         SET status = $1, admin_notes = $2, activated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 RETURNING *`
      : `UPDATE proxy_assignments 
         SET status = $1, admin_notes = $2 
         WHERE id = $3 RETURNING *`;

    const result = await pool.query(updateQuery, [status, admin_notes, proxyId]);

    // Log the admin action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [proxy.client_id, 'PROXY_STATUS_UPDATED_BY_ADMIN', {
        proxy_id: proxyId,
        proxy_name: proxy.proxy_name,
        old_status: proxy.status,
        new_status: status,
        admin_notes: admin_notes,
        updated_by_admin: true,
        updated_at: new Date().toISOString()
      }]
    );

    console.log(`✅ Proxy status updated by admin: ${proxy.proxy_name} -> ${status}`);

    res.json({
      success: true,
      proxy: result.rows[0],
      message: `Proxy request ${status === 'active' ? 'approved' : status}`
    });
  } catch (error) {
    console.error('Error updating proxy status:', error);
    res.status(500).json({ error: 'Failed to update proxy status' });
  }
});

// Admin endpoint - Create client account for approved proxy
app.post('/admin/proxy/:proxyId/create-client', requireAuth, async (req, res) => {
  try {
    const { proxyId } = req.params;
    const { walletAddress } = req.body;
    
    // TODO: Add admin role verification in production
    
    // Get proxy info
    const proxyResult = await pool.query(
      'SELECT * FROM proxy_assignments WHERE id = $1 AND status = $2',
      [proxyId, 'active']
    );

    if (proxyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active proxy assignment not found' });
    }

    const proxy = proxyResult.rows[0];

    if (proxy.created_proxy_client_id) {
      return res.status(409).json({ error: 'Proxy client account already exists' });
    }

    // Generate wallet if not provided
    const finalWalletAddress = walletAddress || ('0x' + crypto.randomBytes(20).toString('hex'));

    // Create client account for proxy
    const clientResult = await pool.query(
      `INSERT INTO clients (name, wallet_address, kyc_info) 
       VALUES ($1, $2, $3) RETURNING *`,
      [
        proxy.proxy_name,
        finalWalletAddress,
        JSON.stringify({
          email: proxy.proxy_email,
          country: proxy.country,
          proxy_for_client_id: proxy.client_id,
          role: proxy.role,
          created_by_admin: true,
          proxy_assignment_id: proxyId
        })
      ]
    );

    // Update proxy assignment with created client ID
    await pool.query(
      'UPDATE proxy_assignments SET created_proxy_client_id = $1 WHERE id = $2',
      [clientResult.rows[0].id, proxyId]
    );

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [proxy.client_id, 'PROXY_CLIENT_CREATED_BY_ADMIN', {
        proxy_id: proxyId,
        proxy_name: proxy.proxy_name,
        created_client_id: clientResult.rows[0].id,
        wallet_address: finalWalletAddress,
        created_by_admin: true
      }]
    );

    console.log(`✅ Proxy client created: ${proxy.proxy_name} (ID: ${clientResult.rows[0].id})`);

    res.json({
      success: true,
      proxyClient: clientResult.rows[0],
      message: 'Proxy client account created successfully'
    });
  } catch (error) {
    console.error('Error creating proxy client:', error);
    res.status(500).json({ error: 'Failed to create proxy client account' });
  }
});

// Upload proxy documents (extends existing upload functionality)
app.post('/upload-proxy-document', uploadSecurityDoc.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }
    
    const documentUrl = `/uploads/security/${req.file.filename}`;
    res.json({ 
      success: true, 
      documentUrl: documentUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      type: req.body.document_type || 'proxy_document'
    });
  } catch (error) {
    console.error('Error uploading proxy document:', error);
    res.status(500).json({ error: 'Failed to upload proxy document' });
  }
});

// =============================================================================
// SECURITY SETTINGS ENDPOINTS
// =============================================================================

// Get security settings for a client
app.get('/client/:clientId/security', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get client info
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get security settings from various sources
    const [sessionLogs, securityLogs, trustedLocations] = await Promise.all([
      // Recent session logs
      pool.query(
        `SELECT * FROM action_logs WHERE client_id = $1 AND action = 'CLIENT_LOGIN' 
         ORDER BY timestamp DESC LIMIT 5`,
        [clientId]
      ),
      // Security-related logs
      pool.query(
        `SELECT * FROM action_logs WHERE client_id = $1 AND action LIKE '%SECURITY%' 
         ORDER BY timestamp DESC LIMIT 10`,
        [clientId]
      ),
      // Trusted locations (stored in action_logs for now)
      pool.query(
        `SELECT * FROM action_logs WHERE client_id = $1 AND action = 'TRUSTED_LOCATION_REQUEST'
         ORDER BY timestamp DESC`,
        [clientId]
      )
    ]);

    // Mock security data (in production, this would come from dedicated tables)
    const securityData = {
      kycStatus: 'Verified',
      walletType: 'Custodial',
      deviceId: 'iPhone 15 Pro • Touch ID',
      geoTracking: false, // Would be stored in client settings
      twoFactorEnabled: false, // Would be stored in client settings
      trustedLocations: trustedLocations.rows.map(log => ({
        id: log.id,
        name: log.details?.name || 'Unknown Location',
        address: log.details?.address || 'Unknown Address',
        status: log.details?.status || 'Pending'
      })),
      sessionLogs: sessionLogs.rows.map(log => ({
        timestamp: log.timestamp,
        location: log.details?.location || 'Unknown',
        ip: log.details?.ip || '127.0.0.1',
        device: log.details?.device || 'Unknown Device',
        trusted: log.details?.trusted !== false
      }))
    };

    res.json(securityData);
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.status(500).json({ error: 'Failed to fetch security settings' });
  }
});

// Toggle geo-tracking
app.post('/client/:clientId/security/geo-tracking', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { enabled } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log the geo-tracking change
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'GEO_TRACKING_TOGGLE', { 
        enabled: enabled,
        timestamp: new Date(),
        requires_review: true // Always requires AUCTA review
      }]
    );

    res.json({
      success: true,
      message: `Geo-tracking ${enabled ? 'activation' : 'deactivation'} request submitted for review`,
      status: 'pending_review'
    });
  } catch (error) {
    console.error('Error toggling geo-tracking:', error);
    res.status(500).json({ error: 'Failed to process geo-tracking request' });
  }
});

// Add trusted location
app.post('/client/:clientId/security/trusted-location', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { name, address, purpose, document } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    // Store trusted location request
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'TRUSTED_LOCATION_REQUEST', {
        name: name,
        address: address,
        purpose: purpose || 'Vault location',
        document: document,
        status: 'Pending',
        requested_at: new Date(),
        requires_review: true
      }]
    );

    res.json({
      success: true,
      message: 'Trusted location request submitted for AUCTA review',
      status: 'pending_review'
    });
  } catch (error) {
    console.error('Error adding trusted location:', error);
    res.status(500).json({ error: 'Failed to submit location request' });
  }
});

// Request new vault
app.post('/client/:clientId/security/vault-request', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { location, purpose, description, document } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!location || !purpose) {
      return res.status(400).json({ error: 'Location and purpose are required' });
    }

    // Store vault request
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'NEW_VAULT_REQUEST', {
        location: location,
        purpose: purpose,
        description: description,
        document: document,
        status: 'Pending',
        requested_at: new Date(),
        requires_review: true,
        priority: 'high'
      }]
    );

    res.json({
      success: true,
      message: 'New vault request submitted for AUCTA review',
      status: 'pending_review',
      requestId: `VAULT-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting vault request:', error);
    res.status(500).json({ error: 'Failed to submit vault request' });
  }
});

// Request physical agent
app.post('/client/:clientId/security/agent-request', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { product_id, urgency, use_case, contact_method, description } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!urgency || !use_case || !contact_method || !description) {
      return res.status(400).json({ error: 'All fields are required for agent request' });
    }

    // Get product info if specified
    let productInfo = null;
    if (product_id) {
      const productResult = await pool.query(
        'SELECT * FROM passports WHERE id = $1 AND assigned_client_id = $2',
        [product_id, clientId]
      );
      if (productResult.rows.length > 0) {
        productInfo = productResult.rows[0];
      }
    }

    // Store agent request
    await pool.query(
      'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
      [clientId, product_id || null, 'PHYSICAL_AGENT_REQUEST', {
        urgency: urgency,
        use_case: use_case,
        contact_method: contact_method,
        description: description,
        product_info: productInfo,
        status: 'Pending',
        requested_at: new Date(),
        requires_immediate_review: urgency === 'critical',
        priority: urgency
      }]
    );

    res.json({
      success: true,
      message: 'Physical agent request submitted for immediate AUCTA review',
      status: 'pending_review',
      urgency: urgency,
      requestId: `AGENT-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting agent request:', error);
    res.status(500).json({ error: 'Failed to submit agent request' });
  }
});

// Emergency product lockdown
app.post('/client/:clientId/security/emergency-lockdown', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { product_ids, reason, biometric_confirmed } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!reason || !biometric_confirmed) {
      return res.status(400).json({ error: 'Reason and biometric confirmation required' });
    }

    // Get all client products if none specified
    let targetProducts = product_ids;
    if (!targetProducts || targetProducts.length === 0) {
      const allProductsResult = await pool.query(
        'SELECT id FROM passports WHERE assigned_client_id = $1',
        [clientId]
      );
      targetProducts = allProductsResult.rows.map(row => row.id);
    }

    // Store emergency lockdown request
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'EMERGENCY_LOCKDOWN_REQUEST', {
        product_ids: targetProducts,
        reason: reason,
        biometric_confirmed: biometric_confirmed,
        status: 'Pending',
        requested_at: new Date(),
        requires_immediate_review: true,
        priority: 'critical',
        emergency: true
      }]
    );

    res.json({
      success: true,
      message: 'Emergency lockdown request submitted. AUCTA will review immediately.',
      status: 'pending_immediate_review',
      affected_products: targetProducts.length,
      requestId: `LOCKDOWN-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting emergency lockdown:', error);
    res.status(500).json({ error: 'Failed to submit emergency lockdown request' });
  }
});

// Report product status
app.post('/client/:clientId/security/product-report', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { product_id, status, description, document } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!product_id || !status) {
      return res.status(400).json({ error: 'Product ID and status are required' });
    }

    // Verify product ownership
    const productResult = await pool.query(
      'SELECT * FROM passports WHERE id = $1 AND assigned_client_id = $2',
      [product_id, clientId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or not owned by client' });
    }

    const product = productResult.rows[0];

    // Store product status report
    await pool.query(
      'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
      [clientId, product_id, 'PRODUCT_STATUS_REPORT', {
        old_status: product.status,
        new_status: status,
        description: description,
        document: document,
        product_info: {
          brand: product.metadata?.brand,
          object_name: product.metadata?.object_name,
          nfc_uid: product.nfc_uid
        },
        status: 'Pending',
        reported_at: new Date(),
        requires_review: true,
        priority: status === 'stolen' ? 'critical' : 'normal'
      }]
    );

    res.json({
      success: true,
      message: `Product status report (${status}) submitted for AUCTA review`,
      status: 'pending_review',
      product: {
        id: product.id,
        brand: product.metadata?.brand,
        object_name: product.metadata?.object_name
      },
      requestId: `REPORT-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting product report:', error);
    res.status(500).json({ error: 'Failed to submit product report' });
  }
});

// Request 2FA activation
app.post('/client/:clientId/security/2fa-request', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { method } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!method || !['sms', 'email', 'faceid'].includes(method)) {
      return res.status(400).json({ error: 'Valid 2FA method required (sms, email, faceid)' });
    }

    // Store 2FA activation request
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, '2FA_ACTIVATION_REQUEST', {
        method: method,
        status: 'Pending',
        requested_at: new Date(),
        requires_review: true
      }]
    );

    res.json({
      success: true,
      message: `2FA activation request (${method}) submitted for review`,
      status: 'pending_review',
      method: method
    });
  } catch (error) {
    console.error('Error submitting 2FA request:', error);
    res.status(500).json({ error: 'Failed to submit 2FA request' });
  }
});

// Request device reset
app.post('/client/:clientId/security/device-reset', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { reason } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason for device reset is required' });
    }

    // Store device reset request
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'DEVICE_RESET_REQUEST', {
        reason: reason,
        status: 'Pending',
        requested_at: new Date(),
        requires_review: true,
        current_device: req.headers['user-agent'] || 'Unknown'
      }]
    );

    res.json({
      success: true,
      message: 'Device reset request submitted for AUCTA review',
      status: 'pending_review'
    });
  } catch (error) {
    console.error('Error submitting device reset request:', error);
    res.status(500).json({ error: 'Failed to submit device reset request' });
  }
});

// Logout from all devices
app.post('/client/:clientId/security/logout-all', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Store logout all request
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'LOGOUT_ALL_REQUEST', {
        status: 'Pending',
        requested_at: new Date(),
        requires_review: true,
        requesting_device: req.headers['user-agent'] || 'Unknown'
      }]
    );

    res.json({
      success: true,
      message: 'Logout all devices request submitted for AUCTA review',
      status: 'pending_review'
    });
  } catch (error) {
    console.error('Error submitting logout all request:', error);
    res.status(500).json({ error: 'Failed to submit logout all request' });
  }
});

// Report suspicious activity
app.post('/client/:clientId/security/report-suspicious', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { description, session_id, suspected_device } = req.body;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Description of suspicious activity is required' });
    }

    // Store suspicious activity report
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'SUSPICIOUS_ACTIVITY_REPORT', {
        description: description,
        session_id: session_id,
        suspected_device: suspected_device,
        reporting_device: req.headers['user-agent'] || 'Unknown',
        reporting_ip: req.ip || req.connection.remoteAddress,
        status: 'Under Investigation',
        reported_at: new Date(),
        requires_immediate_review: true,
        priority: 'high'
      }]
    );

    res.json({
      success: true,
      message: 'Suspicious activity report submitted. AUCTA security team will investigate.',
      status: 'under_investigation',
      reportId: `SUSPICIOUS-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting suspicious activity report:', error);
    res.status(500).json({ error: 'Failed to submit suspicious activity report' });
  }
});

// Get security logs
app.get('/client/:clientId/security/logs', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT * FROM action_logs 
       WHERE client_id = $1 AND (action LIKE '%SECURITY%' OR action LIKE '%REQUEST%')
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [clientId, limit]
    );

    const securityLogs = result.rows.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
      status: log.details?.status || 'Completed'
    }));

    res.json(securityLogs);
  } catch (error) {
    console.error('Error fetching security logs:', error);
    res.status(500).json({ error: 'Failed to fetch security logs' });
  }
});

// Upload security document
app.post('/upload-security-document', uploadSecurityDoc.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }
    
    const documentUrl = `/uploads/security/${req.file.filename}`;
    res.json({ 
      success: true, 
      documentUrl: documentUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading security document:', error);
    res.status(500).json({ error: 'Failed to upload security document' });
  }
});

// =============================================================================
// END SECURITY SETTINGS ENDPOINTS
// =============================================================================

// Protected route - Get client vault with auth - FIXED
app.get('/client/vault-protected/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    console.log(`🔒 Protected vault access for client ID: ${clientId} by authenticated user: ${req.clientId}`);
    
    // Ensure clientId is a valid number
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID format' });
    }

    // Verify the authenticated user is accessing their own vault
    if (clientIdNum !== req.clientId) {
      return res.status(403).json({ error: 'Access denied - cannot access another client\'s vault' });
    }

    // Get client info
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientIdNum]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get owned products with SBT info - FIXED to extract from JSONB
    const productsResult = await pool.query(
      `SELECT 
        p.id,
        p.nfc_uid,
        p.metadata,
        p.metadata_hash,
        p.status,
        p.metadata->>'original_price' as original_price,
        p.metadata->>'collection_year' as collection_year,
        p.created_at,
        p.assigned_client_id,
        s.sbt_hash,
        s.blockchain_tx_hash,
        s.minted_at
       FROM passports p
       LEFT JOIN sbts s ON s.passport_id = p.id
       WHERE p.assigned_client_id = $1
       ORDER BY p.created_at DESC`,
      [clientIdNum]
    );

    console.log(`✅ Protected vault: Found ${productsResult.rows.length} products for client ${clientIdNum}`);

    res.json({
      client: clientResult.rows[0],
      products: productsResult.rows
    });
  } catch (err) {
    console.error('❌ Protected vault fetch error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch vault data',
      details: err.message 
    });
  }
});

// NEW WALLET ENDPOINTS

// Get wallet data for a client
app.get('/client/:clientId/wallet', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const client = clientResult.rows[0];
    
    // Get vault value (sum of all owned products)
    const vaultResult = await pool.query(
      `SELECT 
        COUNT(p.id) as product_count,
        COALESCE(SUM(CAST(REPLACE(REPLACE(p.metadata->>'original_price', '€', ''), ',', '') AS NUMERIC)), 0) as vault_value
      FROM passports p 
      WHERE p.assigned_client_id = $1 AND p.status IN ('ASSIGNED', 'MINTED')`,
      [clientId]
    );
    
    // Get recent assets with proper categories (not "Other")
    const recentAssetsResult = await pool.query(
      `SELECT 
        p.id,
        p.metadata->>'brand' as brand,
        p.metadata->>'object_name' as object_name,
        p.metadata->>'product_image' as image,
        CAST(REPLACE(REPLACE(p.metadata->>'original_price', '€', ''), ',', '') AS NUMERIC) as value,
        p.status,
        p.created_at
      FROM passports p 
      WHERE p.assigned_client_id = $1 AND p.status IN ('ASSIGNED', 'MINTED')
      ORDER BY p.created_at DESC
      LIMIT 5`,
      [clientId]
    );
    
    const vault = vaultResult.rows[0];
    
    // Calculate real MoneySBT balance
    const moneySBTData = await calculateMoneySBTBalance(clientId);
    
    // Mock data for now - in production these would come from real sources
    const walletData = {
      walletAddress: client.wallet_address,
      walletType: 'Custodial',
      soulboundId: `SBT-${client.id.toString().padStart(4, '0')}`,
      onboardingDate: client.created_at,
      vaultValue: parseFloat(vault.vault_value) || 0,
      productCount: parseInt(vault.product_count) || 0,
      moneySbtBalance: moneySBTData.totalBalance,
      moneySbtTransactions: moneySBTData.transactions,
      ethBalance: 0.0234, // Mock - would come from wallet provider
      qrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==` // Mock QR
    };
    
    // Format recent assets properly
    const recentAssets = recentAssetsResult.rows.map(asset => ({
      id: asset.id,
      name: `${asset.brand} ${asset.object_name}`,
      brand: asset.brand,
      object_name: asset.object_name,
      image: asset.image,
      value: parseFloat(asset.value) || 0,
      status: asset.status,
      created_at: asset.created_at
    }));
    
    res.json({
      wallet: walletData,
      recentAssets
    });
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// NEW: MoneySBT transaction details endpoint
app.get('/client/:clientId/moneysbt/transactions', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const moneySBTData = await calculateMoneySBTBalance(clientId);
    
    res.json({
      totalBalance: moneySBTData.totalBalance,
      transactions: moneySBTData.transactions
    });
  } catch (error) {
    console.error('Error fetching MoneySBT transactions:', error);
    res.status(500).json({ error: 'Failed to fetch MoneySBT transactions' });
  }
});

// NEW: MoneySBT cashback withdrawal (simulation)
app.post('/client/:clientId/moneysbt/withdraw', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
    
    // Calculate real MoneySBT balance
    const moneySBTData = await calculateMoneySBTBalance(clientId);
    
    if (amount > moneySBTData.totalBalance) {
      return res.status(400).json({ error: 'Insufficient MoneySBT balance' });
    }
    
    // Enhanced MoneySBT withdrawal logging
    await logAction(clientId, 'MONEYSBT_WITHDRAWAL', { 
      amount: amount,
      withdrawn_at: new Date().toISOString(),
      remaining_balance: moneySBTData.totalBalance - amount,
      withdrawal_method: 'direct',
      transaction_id: `WITHDRAW-${Date.now()}`
    }, {
      resourceType: 'moneysbt_balance',
      riskLevel: amount > 1000 ? 'medium' : 'low', // Higher amounts get medium risk
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Create notification for withdrawal
    await createNotification(
      clientId,
      'Cashback Withdrawn',
      `€${amount.toFixed(2)} has been successfully withdrawn from your MoneySBT balance.`,
      'success',
      { 
        actionUrl: `/client/wallet`,
        metadata: { 
          amount: amount,
          remaining_balance: moneySBTData.totalBalance - amount,
          transaction_id: `WITHDRAW-${Date.now()}`
        }
      }
    );
    
    res.json({
      success: true,
      message: `€${amount.toFixed(2)} withdrawn successfully`,
      withdrawnAmount: amount,
      remainingBalance: moneySBTData.totalBalance - amount,
      transactionId: `WITHDRAW-${Date.now()}`
    });
  } catch (error) {
    console.error('Error processing MoneySBT withdrawal:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// Get recent activity for a client
app.get('/client/:clientId/activity', async (req, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(
      `SELECT 
        al.*,
        p.metadata->>'brand' as product_brand,
        p.metadata->>'object_name' as product_name,
        p.metadata->>'original_price' as product_value
      FROM action_logs al
      LEFT JOIN passports p ON al.passport_id = p.id
      WHERE al.client_id = $1
      ORDER BY al.timestamp DESC
      LIMIT $2`,
      [clientId, limit]
    );
    
    const activities = result.rows.map(row => {
      let action = row.action;
      let product = null;
      let value = null;
      let status = 'completed';
      
      // Map database actions to user-friendly names
      switch (row.action) {
        case 'SBT_MINTED':
          action = 'SBT Minted';
          product = row.product_brand && row.product_name ? `${row.product_brand} ${row.product_name}` : null;
          if (row.product_value) {
            value = parseFloat(row.product_value.replace(/[^0-9.-]+/g, ''));
          }
          break;
        case 'PASSPORT_ASSIGNED':
          action = 'Product Added';
          product = row.product_brand && row.product_name ? `${row.product_brand} ${row.product_name}` : null;
          if (row.product_value) {
            value = parseFloat(row.product_value.replace(/[^0-9.-]+/g, ''));
          }
          break;
        case 'CLIENT_LOGIN':
          action = 'Vault Access';
          status = 'info';
          break;
        case 'PROFILE_UPDATE':
          action = 'Profile Updated';
          status = 'info';
          break;
        case 'KEY_ROTATION':
          action = 'Key Rotated';
          status = 'info';
          break;
        case 'WALLET_EXPORT':
          action = 'Wallet Exported';
          status = 'info';
          break;
        case 'MONEYSBT_WITHDRAWAL':
          action = 'Cashback Withdrawn';
          if (row.details && row.details.amount) {
            value = row.details.amount;
          }
          status = 'completed';
          break;
        default:
          action = row.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
      
      return {
        id: row.id,
        action,
        product,
        value,
        status,
        timestamp: row.timestamp,
        details: row.details
      };
    });
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Export wallet data
app.get('/client/:clientId/wallet/export', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Get comprehensive wallet data
    const [client, products, activity] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE id = $1', [clientId]),
      pool.query(`SELECT p.*, s.sbt_hash, s.blockchain_tx_hash 
                  FROM passports p 
                  LEFT JOIN sbts s ON p.id = s.passport_id 
                  WHERE p.assigned_client_id = $1`, [clientId]),
      pool.query(`SELECT * FROM action_logs WHERE client_id = $1 ORDER BY timestamp DESC`, [clientId])
    ]);
    
    if (client.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const moneySBTData = await calculateMoneySBTBalance(clientId);
    
    const exportData = {
      export_date: new Date().toISOString(),
      wallet: {
        address: client.rows[0].wallet_address,
        soulbound_id: `SBT-${client.rows[0].id.toString().padStart(4, '0')}`,
        created: client.rows[0].created_at
      },
      client_info: {
        name: client.rows[0].name,
        id: client.rows[0].id
      },
      moneysbt: {
        balance: moneySBTData.totalBalance,
        transactions: moneySBTData.transactions
      },
      products: products.rows,
      activity_history: activity.rows,
      summary: {
        total_products: products.rows.length,
        minted_products: products.rows.filter(p => p.status === 'MINTED').length,
        total_activities: activity.rows.length,
        total_cashback_earned: moneySBTData.totalBalance
      }
    };
    
    // Log the export
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'WALLET_EXPORT', { export_date: exportData.export_date }]
    );
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting wallet:', error);
    res.status(500).json({ error: 'Failed to export wallet data' });
  }
});

// Rotate wallet key (simulation)
app.post('/client/:clientId/wallet/rotate-key', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // In production, this would generate a new private key and update the wallet
    // For now, we'll just log the action and return success
    
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'KEY_ROTATION', { 
        rotated_at: new Date().toISOString(),
        method: 'security_update'
      }]
    );
    
    res.json({
      success: true,
      message: 'Wallet key rotated successfully',
      new_key_id: `key_${Date.now()}`
    });
  } catch (error) {
    console.error('Error rotating key:', error);
    res.status(500).json({ error: 'Failed to rotate wallet key' });
  }
});

// Logout endpoint (optional auth - works with or without token)
app.post('/client/logout', async (req, res) => {
  try {
    // Try to get token from header
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const payload = verifyAuthToken(token);
      if (payload && payload.clientId) {
        // Log the logout action if we have a valid token
        await pool.query(
          'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
          [payload.clientId, 'CLIENT_LOGOUT', { timestamp: new Date() }]
        );
      }
    }
    
    // Always return success, even if no token
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    // Still return success to allow client to clear local storage
    res.json({ success: true, message: 'Logged out successfully' });
  }
});

// List all clients with search support
app.get('/clients', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT id, name, wallet_address, kyc_info, created_at FROM clients';
    let params = [];

    if (search && search.length >= 3) {
      query += ' WHERE LOWER(name) LIKE $1 OR wallet_address LIKE $1 OR CAST(id AS TEXT) = $2';
      params = [`%${search.toLowerCase()}%`, search];
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    // Parse KYC info for email if available
    const clients = result.rows.map(client => {
      let email = null;
      if (client.kyc_info) {
        try {
          const kycData = typeof client.kyc_info === 'string' ? JSON.parse(client.kyc_info) : client.kyc_info;
          email = kycData.email;
        } catch (e) {
          // Invalid JSON or no email, skip
        }
      }
      return {
        ...client,
        email
      };
    });

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Register new client with KYC - UPDATED to handle image URLs
app.post('/register-client', async (req, res) => {
  try {
    const { name, wallet_address, kyc_info, selfie_base64 } = req.body;
    
    if (!name || !wallet_address) {
      return res.status(400).json({ error: 'Name and wallet address are required' });
    }
    
    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Check if wallet already exists
    const existingCheck = await pool.query(
      'SELECT id FROM clients WHERE wallet_address = $1',
      [wallet_address]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A client with this wallet address already exists' });
    }
    
    // Parse KYC info
    let kycData = {};
    if (kyc_info) {
      try {
        kycData = typeof kyc_info === 'string' ? JSON.parse(kyc_info) : kyc_info;
      } catch (e) {
        console.error('Failed to parse KYC info:', e);
        kycData = {};
      }
    }
    
    // Handle selfie image
    if (selfie_base64) {
      const selfieUrl = saveBase64Image(selfie_base64, 'selfie');
      if (selfieUrl) {
        kycData.selfie = selfieUrl;
      }
    }
    
    // Insert new client
    const result = await pool.query(
      'INSERT INTO clients (name, wallet_address, kyc_info) VALUES ($1, $2, $3) RETURNING *',
      [name, wallet_address, JSON.stringify(kycData)]
    );
    
    // Log action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'CLIENT_REGISTERED', JSON.stringify({
        name,
        wallet_address,
        kyc_status: kyc_info ? 'VERIFIED' : 'PENDING',
        registered_at: new Date().toISOString()
      })]
    );
    
    console.log(`✅ Client registered: ${name} (ID: ${result.rows[0].id})`);
    
    res.status(201).json({
      success: true,
      clientId: result.rows[0].id,
      message: 'Client successfully registered'
    });
  } catch (error) {
    console.error('❌ Error registering client:', error);
    res.status(500).json({ error: 'Failed to register client' });
  }
});

// Get specific client details with profile information
app.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id, 
        name as full_name,
        wallet_address,
        kyc_info,
        created_at,
        email,
        phone,
        preferred_contact,
        street_address,
        zip_code,
        city,
        country,
        proof_of_address_status,
        language,
        currency,
        enable_notifications,
        allow_qr_access,
        date_of_birth,
        place_of_birth,
        nationality,
        kyc_status
      FROM clients 
      WHERE id = $1`,
      [clientId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Get product count and total value
    const statsResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM((p.metadata->>'value')::numeric), 0) as total_value
      FROM passports p
      WHERE p.assigned_client_id = $1 AND p.status IN ('ASSIGNED', 'MINTED')`,
      [clientId]
    );
    
    const client = result.rows[0];
    const stats = statsResult.rows[0];
    
    // Parse KYC info if it exists
    let kycData = {};
    if (client.kyc_info) {
      try {
        kycData = typeof client.kyc_info === 'string' ? JSON.parse(client.kyc_info) : client.kyc_info;
      } catch (e) {
        console.warn('Failed to parse KYC info:', e);
      }
    }
    
    res.json({
      ...client,
      kyc_info: kycData,
      product_count: parseInt(stats.product_count),
      total_value: parseFloat(stats.total_value)
    });
  } catch (error) {
    console.error('Error fetching client profile:', error);
    res.status(500).json({ error: 'Failed to fetch client profile' });
  }
});

// Update client profile (only editable fields)
app.put('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      email,
      phone,
      preferred_contact,
      street_address,
      zip_code,
      city,
      country,
      language,
      currency,
      enable_notifications,
      allow_qr_access
    } = req.body;
    
    // Update client information
    const result = await pool.query(
      `UPDATE clients 
      SET 
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        preferred_contact = COALESCE($4, preferred_contact),
        street_address = COALESCE($5, street_address),
        zip_code = COALESCE($6, zip_code),
        city = COALESCE($7, city),
        country = COALESCE($8, country),
        language = COALESCE($9, language),
        currency = COALESCE($10, currency),
        enable_notifications = COALESCE($11, enable_notifications),
        allow_qr_access = COALESCE($12, allow_qr_access),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *`,
      [
        clientId,
        email,
        phone,
        preferred_contact,
        street_address,
        zip_code,
        city,
        country,
        language,
        currency,
        enable_notifications,
        allow_qr_access
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Log the update action
    await pool.query(
      `INSERT INTO action_logs (client_id, action, details)
      VALUES ($1, $2, $3)`,
      [clientId, 'PROFILE_UPDATE', { updated_fields: Object.keys(req.body) }]
    );
    
    res.json({
      message: 'Profile updated successfully',
      client: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating client profile:', error);
    res.status(500).json({ error: 'Failed to update client profile' });
  }
});

// Submit KYC change request
app.post('/client/:clientId/kyc-change-request', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { description, fields_to_change } = req.body;
    
    // Store the change request
    await pool.query(
      `INSERT INTO action_logs (client_id, action, details)
      VALUES ($1, $2, $3)`,
      [
        clientId, 
        'KYC_CHANGE_REQUEST', 
        { 
          description, 
          fields_to_change,
          status: 'pending',
          requested_at: new Date().toISOString()
        }
      ]
    );
    
    res.json({
      message: 'KYC change request submitted successfully',
      request_id: Date.now() // In production, use a proper ID
    });
  } catch (error) {
    console.error('Error submitting KYC change request:', error);
    res.status(500).json({ error: 'Failed to submit change request' });
  }
});

// Export client data (GDPR compliance)
app.get('/client/:clientId/export', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Get all client data
    const clientResult = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [clientId]
    );
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Get all related data
    const [passports, sbts, actions] = await Promise.all([
      pool.query('SELECT * FROM passports WHERE assigned_client_id = $1', [clientId]),
      pool.query('SELECT * FROM sbts WHERE client_id = $1', [clientId]),
      pool.query('SELECT * FROM action_logs WHERE client_id = $1 ORDER BY timestamp DESC', [clientId])
    ]);
    
    const exportData = {
      client: clientResult.rows[0],
      passports: passports.rows,
      sbts: sbts.rows,
      action_history: actions.rows,
      export_date: new Date().toISOString()
    };
    
    // Log the export action
    await pool.query(
      `INSERT INTO action_logs (client_id, action, details)
      VALUES ($1, $2, $3)`,
      [clientId, 'DATA_EXPORT', { export_date: exportData.export_date }]
    );
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting client data:', error);
    res.status(500).json({ error: 'Failed to export client data' });
  }
});

// Create product passport - UPDATED to ensure proper image URL storage
app.post('/create-passport', async (req, res) => {
  try {
    const { nfc_uid, metadata, metadata_hash } = req.body;
    
    // Validate required field
    if (!nfc_uid) {
      return res.status(400).json({ error: 'NFC UID is required' });
    }
    
    // Check if NFC UID already exists
    const existing = await pool.query('SELECT id FROM passports WHERE nfc_uid = $1', [nfc_uid]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Passport with this NFC UID already exists' });
    }
    
    // Handle image if it's base64 in metadata
    let finalMetadata = { ...metadata };
    if (metadata && metadata.product_image) {
      if (metadata.product_image.startsWith('data:image')) {
        // It's base64, save it
        const imageUrl = saveBase64Image(metadata.product_image, 'product');
        if (imageUrl) {
          finalMetadata.product_image = imageUrl;
        } else {
          delete finalMetadata.product_image;
        }
      } else if (!metadata.product_image.startsWith('/uploads/') && !metadata.product_image.startsWith('http')) {
        // It's just a filename, add the uploads prefix
        finalMetadata.product_image = `/uploads/${metadata.product_image}`;
      }
      // If it already starts with /uploads/ or http, leave it as is
    }
    
    // Use provided hash or generate one
    const finalMetadataHash = metadata_hash || generateMetadataHash(finalMetadata);
    
    // Create passport
    const result = await pool.query(
      'INSERT INTO passports (nfc_uid, metadata_hash, metadata, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [nfc_uid, finalMetadataHash, JSON.stringify(finalMetadata), 'VACANT']
    );
    
    // Log action
    await pool.query(
      'INSERT INTO action_logs (passport_id, action, details) VALUES ($1, $2, $3)',
      [result.rows[0].id, 'PASSPORT_CREATED', { 
        nfc_uid, 
        brand: finalMetadata.brand,
        object_name: finalMetadata.object_name,
        created_by_role: finalMetadata.created_by_role 
      }]
    );
    
    console.log('✅ Passport created successfully:', result.rows[0].id);
    
    res.status(201).json({
      success: true,
      passport: result.rows[0],
      message: 'Digital passport created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating passport:', error);
    res.status(500).json({ error: 'Failed to create passport', details: error.message });
  }
});

// Upload endpoint for forms that need separate image upload
app.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get all passports
app.get('/passports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM passports ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching passports:', error);
    res.status(500).json({ error: 'Failed to fetch passports' });
  }
});

// Get passport by ID
app.get('/passport/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM passports WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Passport not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching passport:', error);
    res.status(500).json({ error: 'Failed to fetch passport' });
  }
});

// Assign passport to client
app.post('/assign/:passportId', async (req, res) => {
  try {
    const { passportId } = req.params;
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }
    
    // Start transaction for data consistency
    await pool.query('BEGIN');
    
    try {
      // Check if passport exists and is vacant
      const passport = await pool.query('SELECT * FROM passports WHERE id = $1', [passportId]);
      if (passport.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Passport not found' });
      }
      
      if (passport.rows[0].status !== 'VACANT') {
        await pool.query('ROLLBACK');
        return res.status(409).json({ error: 'Passport is not available for assignment' });
      }
      
      // Check if client exists
      const client = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
      if (client.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // Generate transaction ID
      const transactionId = generateTransactionId();
      
      // Assign passport
      const result = await pool.query(
        'UPDATE passports SET assigned_client_id = $1, status = $2 WHERE id = $3 RETURNING *',
        [clientId, 'ASSIGNED', passportId]
      );
      
      // Log action with transaction ID
      await pool.query(
        'INSERT INTO action_logs (passport_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
        [passportId, clientId, 'PASSPORT_ASSIGNED', { 
          clientName: client.rows[0].name,
          transactionId: transactionId,
          assignedAt: new Date().toISOString()
        }]
      );
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log(`✅ Passport ${passportId} assigned to client ${clientId} (TX: ${transactionId})`);
      
      res.json({
        success: true,
        passport: result.rows[0],
        transactionId: transactionId,
        message: 'Passport assigned successfully'
      });
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error assigning passport:', error);
    res.status(500).json({ error: 'Failed to assign passport' });
  }
});

// Mint SBT for passport
app.post('/mint-sbt/:passportId', async (req, res) => {
  try {
    const { passportId } = req.params;
    
    // Check if passport exists and is assigned
    const passport = await pool.query(
      'SELECT p.*, c.wallet_address, c.name as client_name FROM passports p JOIN clients c ON p.assigned_client_id = c.id WHERE p.id = $1',
      [passportId]
    );
    
    if (passport.rows.length === 0) {
      return res.status(404).json({ error: 'Passport not found or not assigned' });
    }
    
    if (passport.rows[0].status === 'MINTED') {
      return res.status(409).json({ error: 'SBT already minted for this passport' });
    }
    
    // Generate SBT hash (simulated)
    const sbtHash = '0x' + crypto.randomBytes(32).toString('hex');
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Record SBT minting
    const sbtResult = await pool.query(
      'INSERT INTO sbts (passport_id, client_id, sbt_hash, blockchain_tx_hash) VALUES ($1, $2, $3, $4) RETURNING *',
      [passportId, passport.rows[0].assigned_client_id, sbtHash, txHash]
    );
    
    // Update passport status
    await pool.query('UPDATE passports SET status = $1 WHERE id = $2', ['MINTED', passportId]);
    
    // Log action
    await pool.query(
      'INSERT INTO action_logs (passport_id, client_id, action, details) VALUES ($1, $2, $3, $4)',
      [passportId, passport.rows[0].assigned_client_id, 'SBT_MINTED', { sbtHash, txHash }]
    );
    
    console.log(`✅ SBT minted for passport ${passportId} with TX hash: ${txHash}`);
    
    // Return comprehensive response
    res.json({
      success: true,
      sbt: sbtResult.rows[0],
      blockchainTxHash: txHash,
      sbtHash: sbtHash,
      message: 'SBT minted successfully'
    });
  } catch (error) {
    console.error('Error minting SBT:', error);
    res.status(500).json({ error: 'Failed to mint SBT' });
  }
});

// Get client's vault (owned products) - FIXED to extract from JSONB
app.get('/client/vault/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    console.log(`📦 Fetching vault for client ID: ${clientId}`);
    
    // Ensure clientId is a valid number
    const clientIdNum = parseInt(clientId);
    if (isNaN(clientIdNum)) {
      return res.status(400).json({ error: 'Invalid client ID format' });
    }
    
    const result = await pool.query(
      `SELECT 
        p.id,
        p.nfc_uid,
        p.metadata,
        p.metadata_hash,
        p.status,
        p.metadata->>'original_price' as original_price,
        p.metadata->>'collection_year' as collection_year,
        p.created_at,
        p.assigned_client_id,
        s.sbt_hash,
        s.blockchain_tx_hash,
        s.minted_at
       FROM passports p
       LEFT JOIN sbts s ON p.id = s.passport_id
       WHERE p.assigned_client_id = $1
       ORDER BY p.created_at DESC`,
      [clientIdNum]
    );
    
    console.log(`✅ Found ${result.rows.length} products for client ${clientIdNum}`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching client vault:', error);
    res.status(500).json({ 
      error: 'Failed to fetch client vault',
      details: error.message 
    });
  }
});

// GET assignment by transaction ID (for mint-sbt page)
app.get('/assignment/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // Query to find the assignment by transaction ID
    const query = `
      SELECT 
        al.details->>'transactionId' as transaction_id,
        p.id as passport_id,
        p.nfc_uid,
        p.metadata,
        p.status,
        p.metadata->>'collection_year' as collection_year,
        c.id as client_id,
        c.name as client_name,
        c.wallet_address,
        c.kyc_info
      FROM action_logs al
      JOIN passports p ON al.passport_id = p.id
      JOIN clients c ON al.client_id = c.id
      WHERE al.action = 'PASSPORT_ASSIGNED'
      AND al.details->>'transactionId' = $1
      ORDER BY al.timestamp DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [transactionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    const row = result.rows[0];
    
    // Parse KYC info for client details
    let kycData = {};
    try {
      kycData = typeof row.kyc_info === 'string' ? JSON.parse(row.kyc_info) : row.kyc_info || {};
    } catch (e) {
      console.warn('Failed to parse KYC info:', e);
    }
    
    res.json({
      transactionId: row.transaction_id,
      passport: {
        id: row.passport_id,
        nfc_uid: row.nfc_uid,
        metadata: row.metadata,
        status: row.status,
        collection_year: row.collection_year
      },
      client: {
        id: row.client_id,
        name: row.client_name,
        wallet_address: row.wallet_address,
        email: kycData.email || null,
        kyc_info: kycData
      }
    });
    
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Failed to fetch assignment data' });
  }
});

// Get action logs
app.get('/admin/logs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.*, c.name as client_name, p.nfc_uid
       FROM action_logs al
       LEFT JOIN clients c ON al.client_id = c.id
       LEFT JOIN passports p ON al.passport_id = p.id
       ORDER BY al.timestamp DESC
       LIMIT 100`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Development only - clean test data
app.delete('/dev/cleanup', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'This endpoint is only available in development' });
  }
  
  try {
    await pool.query('TRUNCATE clients, passports, sbts, action_logs, proxy_assignments RESTART IDENTITY CASCADE');
    res.json({ success: true, message: 'Test data cleaned' });
  } catch (error) {
    console.error('Error cleaning data:', error);
    res.status(500).json({ error: 'Failed to clean data' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: error.message });
  } else if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

// Blockchain simulator routes
app.get('/blockchain', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/blockchain-dashboard.html'));
});

app.get('/blockchain/info', (req, res) => {
  const info = blockchainSimulator.getBlockchainInfo();
  res.json(info);
});

app.get('/blockchain/blocks', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const blocks = blockchainSimulator.getBlocks(limit);
  res.json(blocks);
});

app.get('/blockchain/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const transactions = blockchainSimulator.getTransactionHistory(limit);
  res.json(transactions);
});

app.post('/blockchain/start', (req, res) => {
  blockchainSimulator.start();
  res.json({ success: true });
});

// =============================================================================
// SYSTEM HEALTH & MAINTENANCE ENDPOINTS
// =============================================================================

// Get system health status
app.get('/admin/system/health', async (req, res) => {
  try {
    const [dbHealth, activeConnections, systemMetrics] = await Promise.all([
      // Database connectivity check
      pool.query('SELECT NOW() as timestamp, version() as db_version'),
      
      // Active connections count
      pool.query('SELECT count(*) as active_sessions FROM client_sessions WHERE is_active = true AND expires_at > NOW()'),
      
      // System metrics
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM clients) as total_clients,
          (SELECT COUNT(*) FROM passports WHERE status = 'MINTED') as minted_products,
          (SELECT COUNT(*) FROM client_sessions WHERE is_active = true) as active_sessions,
          (SELECT COUNT(*) FROM transfer_requests WHERE status = 'pending') as pending_transfers
      `)
    ]);

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        version: dbHealth.rows[0].db_version,
        timestamp: dbHealth.rows[0].timestamp
      },
      metrics: systemMetrics.rows[0],
      active_sessions: parseInt(activeConnections.rows[0].active_sessions),
      uptime_hours: Math.floor(process.uptime() / 3600),
      memory_usage: process.memoryUsage(),
      node_version: process.version
    };

    res.json(healthData);
  } catch (error) {
    console.error('System health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Schedule system maintenance
app.post('/admin/system/maintenance', async (req, res) => {
  try {
    const {
      title,
      description,
      maintenance_type,
      start_time,
      end_time,
      affected_services,
      notify_clients
    } = req.body;

    const maintenanceResult = await pool.query(`
      INSERT INTO system_maintenance (
        title, description, maintenance_type, start_time, end_time,
        affected_services, notify_clients, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title,
      description,
      maintenance_type || 'scheduled',
      start_time,
      end_time,
      JSON.stringify(affected_services || []),
      notify_clients !== false,
      req.adminUser || 'system'
    ]);

    // Notify all clients if requested
    if (notify_clients !== false) {
      const clients = await pool.query('SELECT id FROM clients');
      
      for (const client of clients.rows) {
        await createNotification(
          client.id,
          `Scheduled Maintenance: ${title}`,
          description || `System maintenance is scheduled from ${new Date(start_time).toLocaleString()} to ${new Date(end_time).toLocaleString()}.`,
          'warning',
          {
            metadata: {
              maintenance_id: maintenanceResult.rows[0].id,
              start_time: start_time,
              end_time: end_time,
              affected_services: affected_services
            },
            expiresInDays: 1 // Maintenance notifications expire after 1 day
          }
        );
      }
    }

    res.status(201).json({
      success: true,
      maintenance: maintenanceResult.rows[0],
      clients_notified: notify_clients !== false
    });
  } catch (error) {
    console.error('Error scheduling maintenance:', error);
    res.status(500).json({ error: 'Failed to schedule maintenance' });
  }
});

// Get system maintenance schedule
app.get('/admin/system/maintenance', async (req, res) => {
  try {
    const status = req.query.status || 'scheduled';
    
    const maintenanceResult = await pool.query(
      'SELECT * FROM system_maintenance WHERE status = $1 ORDER BY start_time ASC',
      [status]
    );

    res.json(maintenanceResult.rows);
  } catch (error) {
    console.error('Error fetching maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedule' });
  }
});

// =============================================================================
// ENHANCED ADMIN ANALYTICS ENDPOINTS
// =============================================================================

// Get comprehensive admin analytics
app.get('/admin/analytics/comprehensive', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '30_days';
    const intervalClause = timeframe === '24_hours' ? '1 hour' :
                          timeframe === '7_days' ? '1 day' :
                          timeframe === '30_days' ? '1 day' :
                          '1 week';

    const [userGrowth, activityTrends, securityMetrics, financialMetrics, productMetrics] = await Promise.all([
      // User growth over time
      pool.query(`
        SELECT 
          date_trunc('${intervalClause}', created_at) as period,
          COUNT(*) as new_clients
        FROM clients 
        WHERE created_at > NOW() - INTERVAL '${timeframe.replace('_', ' ')}'
        GROUP BY period
        ORDER BY period
      `),
      
      // Activity trends
      pool.query(`
        SELECT 
          date_trunc('${intervalClause}', timestamp) as period,
          action,
          COUNT(*) as count
        FROM action_logs 
        WHERE timestamp > NOW() - INTERVAL '${timeframe.replace('_', ' ')}'
        GROUP BY period, action
        ORDER BY period, count DESC
      `),
      
      // Security metrics
      pool.query(`
        SELECT 
          risk_level,
          COUNT(*) as count,
          COUNT(DISTINCT client_id) as unique_clients
        FROM audit_trail 
        WHERE timestamp > NOW() - INTERVAL '${timeframe.replace('_', ' ')}'
        GROUP BY risk_level
      `),
      
      // Financial metrics (MoneySBT)
      pool.query(`
        SELECT 
          COUNT(*) as total_withdrawals,
          SUM((details->>'amount')::numeric) as total_withdrawn,
          AVG((details->>'amount')::numeric) as avg_withdrawal
        FROM action_logs 
        WHERE action = 'MONEYSBT_WITHDRAWAL'
        AND timestamp > NOW() - INTERVAL '${timeframe.replace('_', ' ')}'
      `),
      
      // Product metrics
      pool.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(CAST(REPLACE(REPLACE(metadata->>'original_price', '€', ''), ',', '') AS NUMERIC)) as avg_value
        FROM passports 
        WHERE created_at > NOW() - INTERVAL '${timeframe.replace('_', ' ')}'
        GROUP BY status
      `)
    ]);

    res.json({
      timeframe: timeframe,
      generated_at: new Date().toISOString(),
      user_growth: userGrowth.rows,
      activity_trends: activityTrends.rows,
      security_metrics: securityMetrics.rows,
      financial_metrics: financialMetrics.rows[0] || {},
      product_metrics: productMetrics.rows
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

// =============================================================================
// ENHANCED ERROR HANDLING & MONITORING
// =============================================================================

// Global error tracking
let errorCount = 0;
let lastErrors = [];

const trackError = (error, context = '') => {
  errorCount++;
  lastErrors.unshift({
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context: context
  });
  
  // Keep only last 50 errors
  if (lastErrors.length > 50) {
    lastErrors = lastErrors.slice(0, 50);
  }
  
  console.error(`🚨 Error #${errorCount} [${context}]:`, error.message);
};

// Error monitoring endpoint
app.get('/admin/system/errors', async (req, res) => {
  try {
    res.json({
      total_errors: errorCount,
      recent_errors: lastErrors.slice(0, 20),
      error_rate: errorCount / Math.max(1, Math.floor(process.uptime() / 60)), // errors per minute
      uptime_minutes: Math.floor(process.uptime() / 60)
    });
  } catch (error) {
    trackError(error, 'error_monitoring');
    res.status(500).json({ error: 'Failed to fetch error data' });
  }
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  trackError(error, `${req.method} ${req.path}`);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: error.message });
  } else if (error) {
    // Log to audit trail for critical errors
    if (req.clientId) {
      logAction(req.clientId, 'SYSTEM_ERROR', {
        error_message: error.message,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      }, {
        riskLevel: 'high',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(console.error);
    }
    
    return res.status(400).json({ error: error.message });
  }
  next();
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received. Starting graceful shutdown...');
  
  try {
    // Close database connections
    await pool.end();
    console.log('✅ Database connections closed');
    
    // Log system shutdown
    console.log('🛑 AUCTA Backend V2 shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('\n🔄 SIGINT received. Starting graceful shutdown...');
  
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    console.log('🛑 AUCTA Backend V2 shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Unhandled promise rejection handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  trackError(new Error(`Unhandled Rejection: ${reason}`), 'unhandled_rejection');
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  trackError(error, 'uncaught_exception');
  
  // Give time for logging then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AUCTA Backend running on http://localhost:${PORT}`);
  console.log(`📊 Database: PostgreSQL on port ${process.env.DB_PORT || 5432}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Security endpoints: ENABLED`);
  console.log(`🔗 Proxy management: ENABLED`);
  console.log(`📋 Activity logging: ENABLED`);
});