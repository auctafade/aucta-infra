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

// Sprint 8: Route Planning System
const routePlanningAPI = require('./lib/sprint8/routePlanningAPI');
// Sprint 8: WG (White-Glove) System
const WGAPIService = require('./lib/sprint8/wgAPI');
// Sprint 8: Hub Console System
const hubConsoleRoutes = require('./routes/hubConsole');
// Sprint 8: Incident Management System
const incidentManagementRoutes = require('./routes/incidentManagement');
// Sprint 8: Inventory Management System
const inventoryRoutes = require('./routes/inventory');
// Sprint 8: NFC Inventory Management System
const nfcInventoryRoutes = require('./routes/nfcInventory');
// Sprint 8: Contacts Management System
const contactsRoutes = require('./routes/contacts');
// Sprint 8: SLA & Margin Policies System
const slaPoliciesRoutes = require('./routes/sla-policies');
// Sprint 8: Risk Thresholds & Policies System
const riskThresholdsRoutes = require('./routes/risk-thresholds');
// Sprint 8: Hub Capacity Management System
const hubCapacityRoutes = require('./routes/hub-capacity');
// Sprint 8: Hub Management System
const hubRoutes = require('./routes/hubs');
// Sprint 8: Shipments Management for Quote System
const shipmentsRoutes = require('./routes/shipments');
// Sprint 8: Settings Event Handler for audit and logging
const settingsEventHandler = require('./lib/settingsEventHandler');
// Sprint 8: Data Integrity Service for duplicate prevention
const dataIntegrityService = require('./lib/dataIntegrityService');
// Conditionally require optional dependencies
let PDFDocument, archiver;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  console.warn('⚠️  PDFKit not installed - document generation will use fallback');
}
try {
  archiver = require('archiver');
} catch (e) {
  console.warn('⚠️  Archiver not installed - ZIP export will use fallback');
}

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
const securityDocsDir = path.join(__dirname, 'uploads/security');
const documentsDir = path.join(__dirname, 'uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(securityDocsDir)) {
  fs.mkdirSync(securityDocsDir, { recursive: true });
}
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

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

// =============================================================================
// DOCUMENT GENERATION HELPERS
// =============================================================================

// Generate KYC Certificate PDF
async function generateKYCCertificate(client) {
  if (!PDFDocument) {
    // Fallback: create a simple text file
    const filename = `kyc-certificate-${client.id}-${Date.now()}.txt`;
    const filepath = path.join(documentsDir, filename);
    const content = `KYC VERIFICATION CERTIFICATE\n\nClient: ${client.name}\nClient ID: ${client.id}\nWallet Address: ${client.wallet_address}\nVerification Date: ${new Date(client.created_at).toLocaleDateString()}\nCertificate ID: KYC-${client.id}-${Date.now()}`;
    fs.writeFileSync(filepath, content);
    return `/uploads/documents/${filename}`;
  }
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const filename = `kyc-certificate-${client.id}-${Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);
      
      // Add content
      doc.fontSize(24).text('KYC Verification Certificate', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`This certifies that ${client.name} has completed identity verification.`);
      doc.text(`Client ID: ${client.id}`);
      doc.text(`Wallet Address: ${client.wallet_address}`);
      doc.text(`Verification Date: ${new Date(client.created_at).toLocaleDateString()}`);
      doc.text(`Certificate ID: KYC-${client.id}-${Date.now()}`);
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(`/uploads/documents/${filename}`);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Product Passport PDF
async function generateProductPassport(passport, client) {
  if (!PDFDocument) {
    // Fallback: create a simple text file
    const metadata = typeof passport.metadata === 'string' ? JSON.parse(passport.metadata) : passport.metadata;
    const filename = `passport-${passport.id}-${Date.now()}.txt`;
    const filepath = path.join(documentsDir, filename);
    const content = `DIGITAL PRODUCT PASSPORT\n\nProduct: ${metadata.brand} ${metadata.object_name}\nNFC UID: ${passport.nfc_uid}\nOwner: ${client.name}\nStatus: ${passport.status}\nCreated: ${new Date(passport.created_at).toLocaleDateString()}\nMetadata Hash: ${passport.metadata_hash}`;
    fs.writeFileSync(filepath, content);
    return `/uploads/documents/${filename}`;
  }
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const metadata = typeof passport.metadata === 'string' ? JSON.parse(passport.metadata) : passport.metadata;
      const filename = `passport-${passport.id}-${Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);
      
      // Add content
      doc.fontSize(24).text('Digital Product Passport', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`${metadata.brand} ${metadata.object_name}`);
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`NFC UID: ${passport.nfc_uid}`);
      doc.text(`Owner: ${client.name}`);
      doc.text(`Status: ${passport.status}`);
      doc.text(`Created: ${new Date(passport.created_at).toLocaleDateString()}`);
      if (metadata.collection_year) doc.text(`Collection Year: ${metadata.collection_year}`);
      if (metadata.original_price) doc.text(`Value: ${metadata.original_price}`);
      doc.moveDown();
      doc.text(`Metadata Hash: ${passport.metadata_hash}`);
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(`/uploads/documents/${filename}`);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Authenticity Certificate PDF
async function generateAuthenticityertificate(passport) {
  if (!PDFDocument) {
    // Fallback: create a simple text file
    const metadata = typeof passport.metadata === 'string' ? JSON.parse(passport.metadata) : passport.metadata;
    const filename = `authenticity-${passport.id}-${Date.now()}.txt`;
    const filepath = path.join(documentsDir, filename);
    const content = `CERTIFICATE OF AUTHENTICITY\n\n${metadata.brand}\n\nProduct: ${metadata.object_name}\nBrand: ${metadata.brand}\nAuthentication Date: ${new Date().toLocaleDateString()}\nVerification Code: ${passport.nfc_uid}\n\nThis product has been verified and registered on the AUCTA blockchain.`;
    fs.writeFileSync(filepath, content);
    return `/uploads/documents/${filename}`;
  }
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const metadata = typeof passport.metadata === 'string' ? JSON.parse(passport.metadata) : passport.metadata;
      const filename = `authenticity-${passport.id}-${Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);
      
      // Add content
      doc.fontSize(24).text('Certificate of Authenticity', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(metadata.brand, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text('This certifies that the following product is authentic:');
      doc.moveDown();
      doc.text(`Product: ${metadata.object_name}`);
      doc.text(`Brand: ${metadata.brand}`);
      doc.text(`Authentication Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Verification Code: ${passport.nfc_uid}`);
      doc.moveDown();
      doc.text('This product has been verified and registered on the AUCTA blockchain.');
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(`/uploads/documents/${filename}`);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Blockchain Certificate JSON
async function generateBlockchainCertificate(passport, sbt) {
  const metadata = typeof passport.metadata === 'string' ? JSON.parse(passport.metadata) : passport.metadata;
  const filename = `blockchain-${passport.id}-${Date.now()}.json`;
  const filepath = path.join(documentsDir, filename);
  
  const certificateData = {
    certificate_type: 'AUCTA_BLOCKCHAIN_CERTIFICATE',
    generated_at: new Date().toISOString(),
    product: {
      id: passport.id,
      nfc_uid: passport.nfc_uid,
      brand: metadata.brand,
      name: metadata.object_name,
      metadata_hash: passport.metadata_hash
    },
    blockchain: {
      sbt_hash: sbt.sbt_hash,
      transaction_hash: sbt.blockchain_tx_hash,
      minted_at: sbt.minted_at,
      network: 'AUCTA Private Chain',
      status: 'IMMUTABLE'
    },
    verification: {
      url: `https://aucta.io/verify/${sbt.sbt_hash}`,
      qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${sbt.sbt_hash}`
    }
  };
  
  fs.writeFileSync(filepath, JSON.stringify(certificateData, null, 2));
  
  return `/uploads/documents/${filename}`;
}

// Routes

// Settings Events API - Event logging and audit system
app.post('/api/events/settings', async (req, res) => {
  try {
    const event = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const correlationId = req.headers['x-correlation-id'];
    
    // Add correlation ID if provided in header
    if (correlationId && !event.correlationId) {
      event.correlationId = correlationId;
    }
    
    // Validate event structure
    const validationErrors = settingsEventHandler.validateEvent(event);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Event validation failed',
        details: validationErrors
      });
    }
    
    // Process and store event
    const result = await settingsEventHandler.storeEvent(event, clientIp);
    
    res.status(result.skipped ? 200 : 201).json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Settings event API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process settings event',
      details: error.message
    });
  }
});

// Get audit trail for a resource
app.get('/api/audit/settings/:resourceType/:resourceId', async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const auditTrail = await settingsEventHandler.getAuditTrail(resourceType, resourceId, limit);
    
    res.json({
      success: true,
      auditTrail,
      resourceType,
      resourceId,
      count: auditTrail.length
    });
    
  } catch (error) {
    console.error('Audit trail API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit trail',
      details: error.message
    });
  }
});

// Get events by correlation ID
app.get('/api/events/correlation/:correlationId', async (req, res) => {
  try {
    const { correlationId } = req.params;
    
    const events = await settingsEventHandler.getEventsByCorrelationId(correlationId);
    
    res.json({
      success: true,
      events,
      correlationId,
      count: events.length
    });
    
  } catch (error) {
    console.error('Correlation events API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch correlation events',
      details: error.message
    });
  }
});

// Data Integrity API - Idempotent policy publishing with duplicate prevention
app.post('/api/settings/sla-margin/publish', async (req, res) => {
  try {
    const policyData = req.body;
    const options = {
      actorId: req.headers['x-actor-id'] || 'api_user',
      changeReason: req.body.change_reason || 'Policy update via API',
      publishRequestId: req.headers['x-request-id']
    };
    
    const result = await dataIntegrityService.publishSLAMarginPolicy(policyData, options);
    
    res.status(result.success ? (result.isDuplicate ? 200 : 201) : 400).json(result);
    
  } catch (error) {
    console.error('SLA policy publish API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish SLA policy',
      details: error.message
    });
  }
});

app.post('/api/settings/risk-threshold/publish', async (req, res) => {
  try {
    const policyData = req.body;
    const options = {
      actorId: req.headers['x-actor-id'] || 'api_user',
      changeReason: req.body.change_reason || 'Policy update via API',
      publishRequestId: req.headers['x-request-id']
    };
    
    const result = await dataIntegrityService.publishRiskThresholdPolicy(policyData, options);
    
    res.status(result.success ? (result.isDuplicate ? 200 : 201) : 400).json(result);
    
  } catch (error) {
    console.error('Risk policy publish API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish risk policy',
      details: error.message
    });
  }
});

app.post('/api/settings/hub-capacity/publish', async (req, res) => {
  try {
    const profileData = req.body;
    const options = {
      actorId: req.headers['x-actor-id'] || 'api_user',
      changeReason: req.body.change_reason || 'Capacity update via API',
      publishRequestId: req.headers['x-request-id']
    };
    
    const result = await dataIntegrityService.publishHubCapacityProfile(profileData, options);
    
    res.status(result.success ? (result.isDuplicate ? 200 : 201) : 400).json(result);
    
  } catch (error) {
    console.error('Hub capacity publish API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish capacity profile',
      details: error.message
    });
  }
});

// Schedule policy for future activation
app.post('/api/settings/:policyType/schedule', async (req, res) => {
  try {
    const { policyType } = req.params;
    const { policyData, effectiveAt } = req.body;
    
    const validPolicyTypes = ['sla_margin', 'risk_threshold', 'hub_capacity'];
    if (!validPolicyTypes.includes(policyType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid policy type',
        details: `Policy type must be one of: ${validPolicyTypes.join(', ')}`
      });
    }
    
    const options = {
      actorId: req.headers['x-actor-id'] || 'api_user',
      changeReason: req.body.change_reason || 'Scheduled policy update via API',
      publishRequestId: req.headers['x-request-id']
    };
    
    const result = await dataIntegrityService.schedulePolicy(policyType, policyData, effectiveAt, options);
    
    res.status(result.success ? (result.isDuplicate ? 200 : 201) : 400).json(result);
    
  } catch (error) {
    console.error('Policy schedule API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule policy',
      details: error.message
    });
  }
});

// Check data integrity
app.get('/api/settings/integrity/check', async (req, res) => {
  try {
    const result = await dataIntegrityService.checkDataIntegrity();
    
    res.json(result);
    
  } catch (error) {
    console.error('Data integrity check API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check data integrity',
      details: error.message
    });
  }
});

// Get active policies summary
app.get('/api/settings/active-policies', async (req, res) => {
  try {
    const result = await dataIntegrityService.getActivePoliciesSummary();
    
    res.json(result);
    
  } catch (error) {
    console.error('Active policies API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active policies',
      details: error.message
    });
  }
});

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

    // Log the login action
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [client.id, 'CLIENT_LOGIN', { method: 'credentials', timestamp: new Date() }]
    );

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

    // Log the biometric login
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [client.id, 'CLIENT_LOGIN', { 
        method: 'biometric_email', 
        email: email,
        timestamp: new Date() 
      }]
    );

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
// DOCUMENT ENDPOINTS
// =============================================================================

// Get or generate all documents for a client
app.get('/client/:clientId/documents', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get client details
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const client = clientResult.rows[0];

    // Get all products
    const productsResult = await pool.query(
      `SELECT p.*, s.sbt_hash, s.blockchain_tx_hash, s.minted_at as sbt_minted_at
       FROM passports p
       LEFT JOIN sbts s ON p.id = s.passport_id
       WHERE p.assigned_client_id = $1`,
      [clientId]
    );

    // Get proxy assignments
    const proxyResult = await pool.query(
      'SELECT * FROM proxy_assignments WHERE client_id = $1 AND status = $2',
      [clientId, 'active']
    );

    const documents = {
      identity: [],
      products: [],
      legal: [],
      blockchain: []
    };

    // Generate identity documents
    const kycCertPath = await generateKYCCertificate(client);
    documents.identity.push({
      id: `kyc-cert-${client.id}`,
      name: 'KYC Verification Certificate',
      type: 'identity',
      category: 'Official Certificate',
      path: kycCertPath,
      size: '156 KB',
      date: client.created_at,
      status: 'verified',
      format: 'PDF'
    });

    // Generate product documents
    for (const product of productsResult.rows) {
      // Product passport
      const passportPath = await generateProductPassport(product, client);
      documents.products.push({
        id: `passport-${product.id}`,
        name: `Digital Passport - ${product.id}`,
        type: 'product',
        productId: product.id,
        category: 'Product Authentication',
        path: passportPath,
        size: '4.2 MB',
        date: product.created_at,
        status: 'active',
        format: 'PDF'
      });

      // Authenticity certificate
      const authPath = await generateAuthenticityertificate(product);
      documents.products.push({
        id: `auth-cert-${product.id}`,
        name: `Certificate of Authenticity - ${product.id}`,
        type: 'product',
        productId: product.id,
        category: 'Authenticity',
        path: authPath,
        size: '1.8 MB',
        date: product.created_at,
        status: 'verified',
        format: 'PDF'
      });

      // Blockchain certificate if minted
      if (product.sbt_hash) {
        const blockchainPath = await generateBlockchainCertificate(product, {
          sbt_hash: product.sbt_hash,
          blockchain_tx_hash: product.blockchain_tx_hash,
          minted_at: product.sbt_minted_at
        });
        
        documents.blockchain.push({
          id: `blockchain-${product.id}`,
          name: `SBT Certificate - ${product.id}`,
          type: 'blockchain',
          productId: product.id,
          category: 'Blockchain Record',
          path: blockchainPath,
          size: '89 KB',
          date: product.sbt_minted_at,
          status: 'immutable',
          format: 'JSON',
          hash: product.sbt_hash,
          txHash: product.blockchain_tx_hash
        });
      }
    }

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Download specific document
app.get('/document/download/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { clientId } = req.query;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse document ID to get type and actual ID
    const [type, ...idParts] = documentId.split('-');
    
    // In production, verify document belongs to client
    // For now, construct the filename
    let filename;
    if (type === 'kyc' && idParts[0] === 'cert') {
      filename = `kyc-certificate-${clientId}-*.pdf`;
    } else if (type === 'passport') {
      filename = `passport-${idParts.join('-')}-*.pdf`;
    } else if (type === 'auth' && idParts[0] === 'cert') {
      filename = `authenticity-${idParts.slice(1).join('-')}-*.pdf`;
    } else if (type === 'blockchain') {
      filename = `blockchain-${idParts.join('-')}-*.json`;
    }

    // Find the file
    const files = fs.readdirSync(documentsDir).filter(f => {
      const pattern = filename.replace(/\*/g, '.*');
      return new RegExp(pattern).test(f);
    });

    if (files.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filepath = path.join(documentsDir, files[0]);
    res.download(filepath);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Export all documents as ZIP
app.get('/client/:clientId/documents/export-zip', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!archiver) {
      return res.status(501).json({ 
        error: 'ZIP export not available - archiver module not installed',
        fallback: 'Use individual document downloads instead'
      });
    }

    // Get all documents
    const documentsResponse = await fetch(`http://localhost:${PORT}/client/${clientId}/documents`, {
      headers: { 'Authorization': req.headers.authorization }
    });
    const documents = await documentsResponse.json();

    // Create ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    const zipFilename = `AUCTA_Documents_${clientId}_${Date.now()}.zip`;
    
    res.attachment(zipFilename);
    archive.pipe(res);

    // Add all documents to ZIP
    const allDocs = [
      ...documents.identity,
      ...documents.products,
      ...documents.legal,
      ...documents.blockchain
    ];

    for (const doc of allDocs) {
      if (doc.path) {
        const filepath = path.join(__dirname, doc.path);
        if (fs.existsSync(filepath)) {
          archive.file(filepath, { name: `${doc.type}/${doc.name}.${doc.format.toLowerCase()}` });
        }
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('Error creating ZIP:', error);
    res.status(500).json({ error: 'Failed to create ZIP export' });
  }
});

// Export documents metadata as CSV
app.get('/client/:clientId/documents/export-csv', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all documents
    const documentsResponse = await fetch(`http://localhost:${PORT}/client/${clientId}/documents`, {
      headers: { 'Authorization': req.headers.authorization }
    });
    const documents = await documentsResponse.json();

    // Create CSV
    const csvRows = ['Document Name,Type,Category,Status,Date,Size,Format'];
    
    const allDocs = [
      ...documents.identity,
      ...documents.products,
      ...documents.legal,
      ...documents.blockchain
    ];

    allDocs.forEach(doc => {
      csvRows.push(
        `"${doc.name}","${doc.type}","${doc.category}","${doc.status}","${new Date(doc.date).toLocaleDateString()}","${doc.size}","${doc.format}"`
      );
    });

    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="AUCTA_Documents_Metadata_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error creating CSV:', error);
    res.status(500).json({ error: 'Failed to create CSV export' });
  }
});

// =============================================================================
// END DOCUMENT ENDPOINTS
// =============================================================================

// =============================================================================
// PROXY MANAGEMENT ENDPOINTS
// =============================================================================

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
       WHERE client_id = $1 AND action LIKE '%SECURITY%' OR action LIKE '%REQUEST%'
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
    
    const moneySBTData = await calculateMoneySBTBalance(clientId);
    
    if (amount > moneySBTData.totalBalance) {
      return res.status(400).json({ error: 'Insufficient MoneySBT balance' });
    }
    
    // Log the withdrawal
    await pool.query(
      'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
      [clientId, 'MONEYSBT_WITHDRAWAL', { 
        amount: amount,
        withdrawn_at: new Date().toISOString(),
        remaining_balance: moneySBTData.totalBalance - amount
      }]
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

// =============================================================================
// ACTIVITY LOG ENDPOINT - ENHANCED FOR FRONTEND
// =============================================================================

// Get recent activity for a client - ENHANCED VERSION
app.get('/client/:clientId/activity', async (req, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const result = await pool.query(
      `SELECT 
        al.*,
        p.metadata->>'brand' as product_brand,
        p.metadata->>'object_name' as product_name,
        p.metadata->>'original_price' as product_value,
        c.name as client_name
      FROM action_logs al
      LEFT JOIN passports p ON al.passport_id = p.id
      LEFT JOIN clients c ON al.client_id = c.id
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
      
      // Enhanced product info
      if (row.product_brand && row.product_name) {
        product = `${row.product_brand} ${row.product_name}`;
      } else if (row.details?.proxy_name) {
        product = row.details.proxy_name;
      } else if (row.details?.transactionId) {
        product = `TX: ${row.details.transactionId}`;
      }
      
      // Get value from product or details
      if (row.product_value) {
        value = parseFloat(row.product_value.replace(/[^0-9.-]+/g, ''));
      } else if (row.details?.amount) {
        value = row.details.amount;
      }
      
      // Map database actions to user-friendly names
      const actionMappings = {
        'SBT_MINTED': { display: 'SBT Minted', status: 'completed' },
        'PASSPORT_ASSIGNED': { display: 'Product Added', status: 'completed' },
        'CLIENT_LOGIN': { display: 'Vault Access', status: 'info' },
        'CLIENT_LOGOUT': { display: 'Session Ended', status: 'info' },
        'PROFILE_UPDATE': { display: 'Profile Updated', status: 'info' },
        'KEY_ROTATION': { display: 'Key Rotated', status: 'info' },
        'WALLET_EXPORT': { display: 'Wallet Exported', status: 'info' },
        'MONEYSBT_WITHDRAWAL': { display: 'Cashback Withdrawn', status: 'completed' },
        'PROXY_REQUEST_SUBMITTED': { display: 'Proxy Request', status: 'pending' },
        'PROXY_ACCESS_REVOKED': { display: 'Proxy Revoked', status: 'completed' },
        'PROXY_STATUS_UPDATED_BY_ADMIN': { display: 'Proxy Status Updated', status: 'info' },
        'SECURITY_REQUEST': { display: 'Security Request', status: 'pending' },
        'GEO_TRACKING_TOGGLE': { display: 'Geo-Tracking Updated', status: 'pending' },
        'TRUSTED_LOCATION_REQUEST': { display: 'Location Request', status: 'pending' },
        'NEW_VAULT_REQUEST': { display: 'Vault Request', status: 'pending' },
        'PHYSICAL_AGENT_REQUEST': { display: 'Agent Request', status: 'pending' },
        'EMERGENCY_LOCKDOWN_REQUEST': { display: 'Emergency Lockdown', status: 'critical' },
        'PRODUCT_STATUS_REPORT': { display: 'Product Report', status: 'pending' },
        '2FA_ACTIVATION_REQUEST': { display: '2FA Request', status: 'pending' },
        'DEVICE_RESET_REQUEST': { display: 'Device Reset', status: 'pending' },
        'LOGOUT_ALL_REQUEST': { display: 'Logout All Devices', status: 'pending' },
        'SUSPICIOUS_ACTIVITY_REPORT': { display: 'Suspicious Activity', status: 'critical' },
        'CLIENT_REGISTERED': { display: 'Account Created', status: 'completed' },
        'PASSPORT_CREATED': { display: 'Passport Created', status: 'completed' },
        'DATA_EXPORT': { display: 'Data Exported', status: 'info' }
      };
      
      const mapping = actionMappings[row.action] || { 
        display: row.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        status: 'info'
      };
      
      action = mapping.display;
      
      // Override status based on details
      if (row.details?.status === 'pending' || row.details?.status === 'pending_review') {
        status = 'pending';
      } else if (row.details?.status === 'failed' || row.action.includes('FAILED')) {
        status = 'failed';
      } else if (row.details?.priority === 'critical' || row.details?.emergency) {
        status = 'critical';
      } else {
        status = mapping.status;
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
        name,
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

// Test endpoint to check database connectivity and data
app.get('/api/sprint3/test', async (req, res) => {
  try {
    console.log('🧪 Testing database connectivity...');
    
    // Check if we have any passports
    const passportCount = await pool.query('SELECT COUNT(*) FROM passports');
    console.log(`📊 Total passports in database: ${passportCount.rows[0].count}`);
    
    // Check if we have any clients
    const clientCount = await pool.query('SELECT COUNT(*) FROM clients');
    console.log(`👥 Total clients in database: ${clientCount.rows[0].count}`);
    
    // Get a sample passport
    const samplePassport = await pool.query('SELECT * FROM passports LIMIT 1');
    if (samplePassport.rows.length > 0) {
      console.log(`🔍 Sample passport: ID=${samplePassport.rows[0].id}, NFC=${samplePassport.rows[0].nfc_uid}`);
    }
    
    res.json({
      status: 'Database connection successful',
      passportCount: parseInt(passportCount.rows[0].count),
      clientCount: parseInt(clientCount.rows[0].count),
      samplePassport: samplePassport.rows[0] || null
    });
  } catch (error) {
    console.error('❌ Database test failed:', error);
    res.status(500).json({ error: 'Database test failed', details: error.message });
  }
});

// Search passports with advanced search capabilities
app.get('/api/sprint3/passport/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    console.log(`🔍 Searching for: "${q}"`);
    const searchTerm = `%${q.trim()}%`;
    
    // Advanced search query that looks in multiple fields
    const query = `
      SELECT 
        p.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        c.city as client_city,
        c.country as client_country,
        CASE 
          WHEN p.id::text = $2 THEN 1
          WHEN p.nfc_uid = $2 THEN 2
          WHEN c.name ILIKE $2 THEN 3
          ELSE 4
        END as search_priority
      FROM passports p
      LEFT JOIN clients c ON p.assigned_client_id = c.id
      WHERE 
        p.id::text ILIKE $1 OR
        p.nfc_uid ILIKE $1 OR
        p.metadata_hash ILIKE $1 OR
        p.collection_year ILIKE $1 OR
        c.name ILIKE $1 OR
        c.email ILIKE $1 OR
        c.phone ILIKE $1 OR
        c.city ILIKE $1 OR
        c.country ILIKE $1 OR
        p.metadata::text ILIKE $1
      ORDER BY 
        search_priority,
        p.created_at DESC
      LIMIT 20
    `;
    
    console.log(`📝 Executing query with search term: "${searchTerm}"`);
    const result = await pool.query(query, [searchTerm, q.trim()]);
    console.log(`✅ Query executed, found ${result.rows.length} results`);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No passports found matching your search criteria' });
    }
    
    console.log(`🎯 Found ${result.rows.length} matching passports`);
    
    // Return all matching results so user can choose
    res.json({
      count: result.rows.length,
      passports: result.rows
    });
  } catch (error) {
    console.error('Error searching passports:', error);
    res.status(500).json({ error: 'Failed to search passports' });
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
    
    // Log the first product for debugging
    if (result.rows.length > 0) {
      console.log('Sample product:', {
        id: result.rows[0].id,
        nfc_uid: result.rows[0].nfc_uid,
        original_price: result.rows[0].original_price,
        status: result.rows[0].status
      });
    }
    
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
    
    // Query to find the assignment by transaction ID - FIXED
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
    await pool.query('TRUNCATE clients, passports, sbts, action_logs RESTART IDENTITY CASCADE');
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

// ========================================================================================
// SPRINT 8: ROUTE PLANNING & TELEMETRY API
// ========================================================================================

// Mount route planning APIs
app.use('/api', routePlanningAPI);

// Mount WG (White-Glove) APIs
const wgAPIService = new WGAPIService();
app.use('/api/wg', wgAPIService.getRouter());

// Mount Enhanced Route Planning APIs
app.use('/api', routePlanningAPI);

// Mount Route Manifest APIs
app.use('/api', require('./routes/routeManifest'));

// Mount Hub Console APIs
app.use('/api/hub-console', hubConsoleRoutes);

// Mount Hub Capacity Management APIs
app.use('/api', hubCapacityRoutes);

// Mount Incident Management APIs
app.use('/api/sprint8/incidents', incidentManagementRoutes);

// Mount Shipments APIs for Quote System
app.use('/api/sprint8/logistics/shipments', shipmentsRoutes);
app.use('/api/shipments', shipmentsRoutes); // Legacy compatibility

// Mount Inventory Management APIs
app.use('/api/inventory', inventoryRoutes);

// Mount NFC Inventory Management APIs
app.use('/api/nfc-inventory', nfcInventoryRoutes);

// Mount Contacts Management APIs
app.use('/api/contacts', contactsRoutes);

// Mount SLA & Margin Policies APIs
app.use('/api/sla-policies', slaPoliciesRoutes);

// Mount Risk Thresholds & Policies APIs
app.use('/api/risk-thresholds', riskThresholdsRoutes);

// Health check for incident management system
app.get('/api/health/incidents', async (req, res) => {
  try {
    // Test database connectivity and incident table access
    const testQuery = await pool.query('SELECT COUNT(*) FROM incidents');
    const incidentCount = parseInt(testQuery.rows[0].count);
    
    res.json({
      success: true,
      status: 'healthy',
      service: 'incident_management',
      database: 'connected',
      incidents_count: incidentCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Incident health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      service: 'incident_management',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for route planning system
app.get('/api/health/route-planning', async (req, res) => {
  try {
    // Test database connectivity
    const dbTest = await pool.query('SELECT 1');
    
    // Check if required tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'shipments', 'shipment_route_plans', 'route_telemetry_events', 
        'logistics_hubs', 'route_planning_sessions'
      )
    `);
    
    const requiredTables = ['shipments', 'shipment_route_plans', 'route_telemetry_events', 'logistics_hubs', 'route_planning_sessions'];
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        tables: {
          required: requiredTables.length,
          existing: existingTables.length,
          missing: missingTables
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Route planning health check failed:', error);
    res.status(500).json({
      success: false,
      error: {
        status: 'unhealthy',
        message: error.message
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AUCTA Backend running on http://localhost:${PORT}`);
  console.log(`📊 Database: PostgreSQL on port ${process.env.DB_PORT || 5433}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Security endpoints: ENABLED`);
  console.log(`🔗 Proxy management: ENABLED`);
  console.log(`📋 Activity logging: ENHANCED`);
  console.log(`📄 Document generation: ENABLED`);
});
// Get all transfer requests for a client
app.get('/client/:clientId/transfer-requests', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT 
        tr.*,
        p.metadata,
        p.nfc_uid,
        p.metadata->>'brand' as brand,
        p.metadata->>'object_name' as object_name,
        p.metadata->>'product_image' as product_image,
        p.metadata->>'original_price' as original_price,
        c.name as client_name,
        c.wallet_address as client_wallet
      FROM transfer_requests tr
      JOIN passports p ON tr.product_id = p.id
      JOIN clients c ON tr.client_id = c.id
      WHERE tr.client_id = $1
      ORDER BY tr.created_at DESC`,
      [clientId]
    );

    console.log(`📋 Found ${result.rows.length} transfer requests for client ${clientId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transfer requests:', error);
    res.status(500).json({ error: 'Failed to fetch transfer requests' });
  }
});

// Submit new transfer request
app.post('/client/:clientId/transfer-request', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      product_id,
      reason,
      is_resale,
      recipient_wallet_address,
      recipient_first_name,
      recipient_last_name,
      recipient_email
    } = req.body;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!product_id || !reason) {
      return res.status(400).json({ 
        error: 'Product ID and reason are required' 
      });
    }

    // Validate reason
    const validReasons = ['resale', 'inheritance', 'gift', 'legal_assignment'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid transfer reason' });
    }

    // Validate recipient info - either wallet OR name/email
    const hasWallet = !!recipient_wallet_address;
    const hasNameEmail = !!(recipient_first_name && recipient_last_name && recipient_email);
    
    if (!hasWallet && !hasNameEmail) {
      return res.status(400).json({ 
        error: 'Either recipient wallet address OR recipient name and email are required' 
      });
    }

    // Validate wallet format if provided
    if (recipient_wallet_address && !/^0x[a-fA-F0-9]{40}$/.test(recipient_wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Validate email format if provided
    if (recipient_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipient_email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
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

    // Check if product already has pending transfer
    const existingTransfer = await pool.query(
      `SELECT id FROM transfer_requests 
       WHERE product_id = $1 AND status IN ('pending', 'reviewing', 'approved', 'waiting_recipient')`,
      [product_id]
    );

    if (existingTransfer.rows.length > 0) {
      return res.status(409).json({ 
        error: 'This product already has an active transfer request' 
      });
    }

    // Determine initial status
    let initialStatus = 'pending';
    if (!recipient_wallet_address && recipient_email) {
      initialStatus = 'waiting_recipient';
    }

    // Insert transfer request
    const result = await pool.query(
      `INSERT INTO transfer_requests (
        client_id, product_id, reason, is_resale,
        recipient_wallet_address, recipient_first_name, 
        recipient_last_name, recipient_email, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`,
      [
        clientId, product_id, reason, is_resale || false,
        recipient_wallet_address, recipient_first_name,
        recipient_last_name, recipient_email, initialStatus
      ]
    );

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
      [clientId, product_id, 'TRANSFER_REQUEST_SUBMITTED', {
        transfer_request_id: result.rows[0].id,
        reason: reason,
        is_resale: is_resale || false,
        recipient_type: recipient_wallet_address ? 'existing_wallet' : 'new_recipient',
        status: initialStatus,
        product_info: {
          brand: product.metadata?.brand,
          object_name: product.metadata?.object_name,
          nfc_uid: product.nfc_uid
        }
      }]
    );

    // If recipient email provided without wallet, log invite action
    if (!recipient_wallet_address && recipient_email) {
      console.log(`📧 Simulating invite email to: ${recipient_email}`);
      await pool.query(
        'INSERT INTO action_logs (client_id, action, details) VALUES ($1, $2, $3)',
        [clientId, 'TRANSFER_INVITE_SENT', {
          recipient_email: recipient_email,
          recipient_name: `${recipient_first_name} ${recipient_last_name}`,
          transfer_request_id: result.rows[0].id,
          invite_sent_at: new Date().toISOString()
        }]
      );
    }

    console.log(`✅ Transfer request submitted: Product ${product_id} by client ${clientId}`);

    res.status(201).json({
      success: true,
      transfer_request: result.rows[0],
      message: initialStatus === 'waiting_recipient' 
        ? 'Transfer request submitted. Recipient will receive an invitation to join AUCTA.'
        : 'Transfer request submitted for AUCTA review.',
      requestId: `TRANSFER-${result.rows[0].id}-${Date.now()}`
    });
  } catch (error) {
    console.error('Error submitting transfer request:', error);
    res.status(500).json({ error: 'Failed to submit transfer request' });
  }
});

// Cancel transfer request
app.put('/client/:clientId/transfer-request/:requestId/cancel', requireAuth, async (req, res) => {
  try {
    const { clientId, requestId } = req.params;
    
    // Verify client access
    if (parseInt(clientId) !== req.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if request exists and belongs to client
    const requestCheck = await pool.query(
      'SELECT * FROM transfer_requests WHERE id = $1 AND client_id = $2',
      [requestId, clientId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const request = requestCheck.rows[0];

    // Only allow cancellation of pending requests
    if (!['pending', 'waiting_recipient'].includes(request.status)) {
      return res.status(409).json({ 
        error: `Cannot cancel transfer request with status: ${request.status}` 
      });
    }

    // Update status to cancelled
    const result = await pool.query(
      `UPDATE transfer_requests 
       SET status = 'rejected', admin_notes = 'Cancelled by client', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND client_id = $2 
       RETURNING *`,
      [requestId, clientId]
    );

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
      [clientId, request.product_id, 'TRANSFER_REQUEST_CANCELLED', {
        transfer_request_id: requestId,
        cancelled_at: new Date().toISOString(),
        previous_status: request.status
      }]
    );

    console.log(`✅ Transfer request cancelled: ${requestId} by client ${clientId}`);

    res.json({
      success: true,
      transfer_request: result.rows[0],
      message: 'Transfer request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling transfer request:', error);
    res.status(500).json({ error: 'Failed to cancel transfer request' });
  }
});

// Admin endpoint - Update transfer request status (for AUCTA staff)
app.put('/admin/transfer-request/:requestId/status', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, admin_notes } = req.body;
    
    // TODO: Add admin role verification in production
    
    const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'completed', 'waiting_recipient'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get current request info
    const requestCheck = await pool.query(
      'SELECT * FROM transfer_requests WHERE id = $1',
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    const request = requestCheck.rows[0];

    // Update request status
    const updateQuery = status === 'completed' 
      ? `UPDATE transfer_requests 
         SET status = $1, admin_notes = $2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`
      : `UPDATE transfer_requests 
         SET status = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`;

    const result = await pool.query(updateQuery, [status, admin_notes, requestId]);

    // Log the admin action
    await pool.query(
      'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
      [request.client_id, request.product_id, 'TRANSFER_STATUS_UPDATED_BY_ADMIN', {
        transfer_request_id: requestId,
        old_status: request.status,
        new_status: status,
        admin_notes: admin_notes,
        updated_by_admin: true,
        updated_at: new Date().toISOString()
      }]
    );

    console.log(`✅ Transfer request status updated by admin: ${requestId} -> ${status}`);

    res.json({
      success: true,
      transfer_request: result.rows[0],
      message: `Transfer request ${status}`
    });
  } catch (error) {
    console.error('Error updating transfer request status:', error);
    res.status(500).json({ error: 'Failed to update transfer request status' });
  }
});

// Sprint 3: Resale Console - Initiate Resale
app.post('/api/sprint3/resale-console/initiate', async (req, res) => {
  try {
    const {
      passport_id,
      seller_id,
      asking_price,
      minimum_price,
      currency,
      marketplace_id,
      external_listing_ref,
      current_valuation_id,
      metadata
    } = req.body;

    // Validate required fields
    if (!passport_id || !seller_id || !asking_price || !marketplace_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: passport_id, seller_id, asking_price, marketplace_id' 
      });
    }

    // Validate passport exists and is owned by seller
    const passportCheck = await pool.query(
      'SELECT * FROM passports WHERE id = $1 AND assigned_client_id = $2',
      [passport_id, seller_id]
    );

    if (passportCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Passport not found or not owned by the specified seller' 
      });
    }

    const passport = passportCheck.rows[0];

    // Check if passport is in valid state for resale
    if (!['MINTED', 'ASSIGNED'].includes(passport.status)) {
      return res.status(409).json({ 
        error: `Passport status "${passport.status}" is not valid for resale. Only MINTED or ASSIGNED items can be resold.` 
      });
    }

    // Check if passport already has an active resale
    const existingResale = await pool.query(
      'SELECT * FROM resale_events WHERE passport_id = $1 AND status IN ($2, $3, $4)',
      [passport_id, 'ready_for_resale', 'listed', 'pending_sale']
    );

    if (existingResale.rows.length > 0) {
      return res.status(409).json({ 
        error: 'This passport already has an active resale listing' 
      });
    }

    // Generate unique resale ID
    const resaleId = `RESALE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Create resale event
      const resaleResult = await pool.query(
        `INSERT INTO resale_events (
          resale_id, passport_id, seller_id, asking_price, minimum_price, 
          currency, marketplace_id, external_listing_ref, current_valuation_id,
          product_hash, client_hash, metadata, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          resaleId, passport_id, seller_id, asking_price, minimum_price || asking_price,
          currency || 'EUR', marketplace_id, external_listing_ref || null, 
          current_valuation_id || null, metadata?.product_hash || null,
          metadata?.client_hash || seller_id.toString(), metadata || {}, 'ready_for_resale'
        ]
      );

      // Update passport status to ready for resale
      await pool.query(
        'UPDATE passports SET status = $1 WHERE id = $2',
        ['READY_FOR_RESALE', passport_id]
      );

      // Log the action
      await pool.query(
        'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
        [seller_id, passport_id, 'RESALE_INITIATED', {
          resale_id: resaleId,
          asking_price: asking_price,
          minimum_price: minimum_price || asking_price,
          currency: currency || 'EUR',
          marketplace_id: marketplace_id,
          external_listing_ref: external_listing_ref,
          initiated_at: new Date().toISOString(),
          metadata: metadata
        }]
      );

      // Commit transaction
      await pool.query('COMMIT');

      console.log(`✅ Resale initiated successfully: ${resaleId} for passport ${passport_id}`);

      res.json({
        success: true,
        resale_id: resaleId,
        message: 'Resale initiated successfully',
        resale_event: resaleResult.rows[0],
        next_steps: [
          'Product marked as ready for resale',
          'ECHO activation triggered for supported marketplaces',
          'Valuation and product data snapshotted',
          'Transfer protocols initiated'
        ]
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error initiating resale:', error);
    res.status(500).json({ 
      error: 'Failed to initiate resale',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Console - Search resale events
app.get('/api/sprint3/resale-console/search', async (req, res) => {
  try {
    const { q, status, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let query = `
      SELECT 
        re.*,
        p.nfc_uid, p.status as passport_status, p.metadata as passport_metadata,
        c.name as seller_name, c.email as seller_email
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      JOIN clients c ON re.seller_id = c.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;

    // Add status filter if provided
    if (status) {
      query += ` AND re.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Add search conditions - if q is '*', get all recent events
    if (q !== '*') {
      query += ` AND (
        re.resale_id ILIKE $${paramIndex} OR
        re.passport_id::text = $${paramIndex + 1} OR
        p.metadata::text ILIKE $${paramIndex + 2} OR
        c.name ILIKE $${paramIndex + 3}
      )`;
      
      const searchTerm = `%${q}%`;
      queryParams.push(searchTerm, q, searchTerm, searchTerm);
    }

    query += ` ORDER BY re.initiated_at DESC LIMIT ${parseInt(limit) || 50}`;

    const result = await pool.query(query, queryParams);

    // Format the results
    const resaleEvents = result.rows.map(row => ({
      id: row.id,
      resale_id: row.resale_id,
      passport_id: row.passport_id,
      seller_id: row.seller_id,
      asking_price: parseFloat(row.asking_price),
      minimum_price: parseFloat(row.minimum_price),
      currency: row.currency,
      marketplace_id: row.marketplace_id,
      external_listing_ref: row.external_listing_ref,
      status: row.status,
      initiated_at: row.initiated_at,
      buyer_id: row.buyer_id,
      passport: {
        id: row.passport_id,
        nfc_uid: row.nfc_uid,
        status: row.passport_status,
        metadata: row.passport_metadata
      },
      seller: {
        id: row.seller_id,
        name: row.seller_name,
        email: row.seller_email
      }
    }));

    res.json({
      success: true,
      resale_events: resaleEvents,
      count: resaleEvents.length
    });

  } catch (error) {
    console.error('Error searching resale events:', error);
    res.status(500).json({ 
      error: 'Failed to search resale events',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Console - Assign buyer to resale event
// NOTE: This endpoint ONLY assigns a buyer to a resale event and logs the action.
// It does NOT mint any SBTs or transfer ownership. Those happen in later steps:
// 1. Contract creation between parties
// 2. Validation and approval process  
// 3. Final SBT minting and ownership transfer
app.post('/api/sprint3/resale-console/assign-buyer', async (req, res) => {
  try {
    console.log('🔄 Assignment request received:', req.body);
    
    // Test database connection first
    try {
      await pool.query('SELECT 1 as test');
      console.log('✅ Database connection verified');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: dbError.message 
      });
    }
    
    const {
      resale_id,
      buyer_id,
      assignment_metadata
    } = req.body;

    console.log('📝 Parsed assignment data:', { resale_id, buyer_id, assignment_metadata });

    if (!resale_id || !buyer_id) {
      console.log('❌ Missing required fields:', { resale_id, buyer_id });
      return res.status(400).json({ 
        error: 'Missing required fields: resale_id, buyer_id' 
      });
    }

    // Validate resale event exists and is in correct state
    console.log('🔍 Checking resale event:', resale_id);
    const resaleCheck = await pool.query(
      'SELECT * FROM resale_events WHERE resale_id = $1',
      [resale_id]
    );

    if (resaleCheck.rows.length === 0) {
      console.log('❌ Resale event not found:', resale_id);
      return res.status(404).json({ error: 'Resale event not found' });
    }

    const resaleEvent = resaleCheck.rows[0];
    console.log('✅ Found resale event:', { 
      id: resaleEvent.id, 
      status: resaleEvent.status, 
      buyer_id: resaleEvent.buyer_id,
      passport_id: resaleEvent.passport_id
    });

    if (resaleEvent.status !== 'ready_for_resale') {
      console.log('❌ Invalid resale status:', resaleEvent.status);
      return res.status(409).json({ 
        error: `Resale event status "${resaleEvent.status}" is not valid for buyer assignment` 
      });
    }

    if (resaleEvent.buyer_id) {
      console.log('❌ Buyer already assigned:', resaleEvent.buyer_id);
      return res.status(409).json({ 
        error: 'This resale event already has a buyer assigned' 
      });
    }

    // Validate buyer exists
    console.log('🔍 Checking buyer:', buyer_id);
    const buyerCheck = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [buyer_id]
    );

    if (buyerCheck.rows.length === 0) {
      console.log('❌ Buyer not found:', buyer_id);
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const buyer = buyerCheck.rows[0];
    console.log('✅ Found buyer:', { id: buyer.id, name: buyer.name });

    // Start transaction
    console.log('🔄 Starting transaction...');
    await pool.query('BEGIN');

    try {
      // Generate assignment ID
      const assignmentId = `ASSIGN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      console.log('🆔 Generated assignment ID:', assignmentId);

      // Update resale event with buyer
      console.log('📝 Updating resale event...');
      const updateResult = await pool.query(
        `UPDATE resale_events 
         SET buyer_id = $1, 
             status = $2, 
             buyer_assigned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE resale_id = $4
         RETURNING *`,
        [
          buyer_id,
          'buyer_assigned',
          JSON.stringify({
            assignment_id: assignmentId,
            assignment_metadata: assignment_metadata || {},
            assigned_at: new Date().toISOString()
          }),
          resale_id
        ]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Failed to update resale event - no rows affected');
      }
      console.log('✅ Resale event updated successfully');

      // Update passport status to reflect buyer assignment
      console.log('📝 Updating passport status...');
      const passportUpdate = await pool.query(
        'UPDATE passports SET status = $1 WHERE id = $2 RETURNING id, status',
        ['BUYER_ASSIGNED', resaleEvent.passport_id]
      );
      
      if (passportUpdate.rows.length === 0) {
        throw new Error(`Failed to update passport ${resaleEvent.passport_id} - passport not found`);
      }
      console.log('✅ Passport status updated:', passportUpdate.rows[0]);

      // Log the assignment action
      console.log('📝 Creating action logs...');
      await pool.query(
        'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
        [buyer_id, resaleEvent.passport_id, 'BUYER_ASSIGNED', {
          assignment_id: assignmentId,
          resale_id: resale_id,
          seller_id: resaleEvent.seller_id,
          buyer_id: buyer_id,
          buyer_name: buyer.name,
          asking_price: resaleEvent.asking_price,
          currency: resaleEvent.currency,
          assigned_at: new Date().toISOString(),
          assignment_metadata: assignment_metadata,
          stage: 'buyer_assignment',
          note: 'Buyer assigned to resale event. No SBT minting or ownership transfer yet.'
        }]
      );

      // Also log for seller
      await pool.query(
        'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
        [resaleEvent.seller_id, resaleEvent.passport_id, 'BUYER_ASSIGNED_TO_RESALE', {
          assignment_id: assignmentId,
          resale_id: resale_id,
          buyer_id: buyer_id,
          buyer_name: buyer.name,
          assigned_at: new Date().toISOString()
        }]
      );
      console.log('✅ Action logs created successfully');

      // Commit transaction
      console.log('💾 Committing transaction...');
      await pool.query('COMMIT');

      console.log(`✅ Buyer assigned successfully: ${assignmentId} - Buyer ${buyer_id} assigned to resale ${resale_id}`);

      res.json({
        success: true,
        assignment_id: assignmentId,
        message: 'Buyer assigned successfully',
        resale_event: updateResult.rows[0],
        buyer: {
          id: buyer.id,
          name: buyer.name,
          email: buyer.email
        },
        next_steps: [
          'Buyer assignment recorded in system',
          'Ready for contract creation between parties',
          'Awaiting validation and approval process',
          'SBT minting will occur after final validation'
        ]
      });

    } catch (error) {
      console.log('🔄 Rolling back transaction due to error...');
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error assigning buyer:', error);
    console.error('Full error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    res.status(500).json({ 
      error: 'Failed to assign buyer',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});


// Clients search endpoint
app.get('/api/clients/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let query;
    let queryParams;

    // Base SELECT with all relevant columns
    const baseSelect = `SELECT 
      id, name, email, phone, wallet_address, kyc_info, created_at,
      city, country, kyc_status, updated_at
    FROM clients WHERE`;

    if (q.startsWith('0x')) {
      // Wallet address search
      query = `${baseSelect} wallet_address ILIKE $1`;
      queryParams = [`%${q}%`];
    } else if (q.includes('@')) {
      // Email search (in KYC info or direct email field)
      query = `${baseSelect} (
        email ILIKE $1 OR 
        kyc_info::jsonb->>'email' ILIKE $1
      )`;
      queryParams = [`%${q}%`];
    } else if (/^\d+$/.test(q)) {
      // Numeric ID search
      query = `${baseSelect} id = $1`;
      queryParams = [parseInt(q)];
    } else {
      // Name or general text search
      query = `${baseSelect} (
        name ILIKE $1 OR 
        kyc_info::jsonb->>'phone' ILIKE $1 OR
        kyc_info::jsonb->>'city' ILIKE $1 OR
        kyc_info::jsonb->>'country' ILIKE $1 OR
        city ILIKE $1 OR
        country ILIKE $1 OR
        phone ILIKE $1
      )`;
      queryParams = [`%${q}%`];
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, queryParams);

    // Get vault status for each client (check if they have any minted products)
    const clientIds = result.rows.map(row => row.id);
    let vaultStatuses = {};
    
    if (clientIds.length > 0) {
      const vaultQuery = await pool.query(
        `SELECT 
          assigned_client_id,
          COUNT(*) as product_count,
          COUNT(CASE WHEN status IN ('MINTED', 'ASSIGNED') THEN 1 END) as active_products
         FROM passports 
         WHERE assigned_client_id = ANY($1::int[])
         GROUP BY assigned_client_id`,
        [clientIds]
      );
      
      vaultQuery.rows.forEach(row => {
        vaultStatuses[row.assigned_client_id] = row.active_products > 0 ? 'active' : 'inactive';
      });
    }

    // Format the results
    const clients = result.rows.map(row => {
      // Parse KYC info to get proper status
      let kycData = {};
      if (row.kyc_info) {
        try {
          kycData = typeof row.kyc_info === 'string' ? JSON.parse(row.kyc_info) : row.kyc_info;
        } catch (e) {
          console.warn('Failed to parse KYC info for client', row.id);
        }
      }

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        wallet_address: row.wallet_address,
        kyc_info: {
          ...kycData,
          // Use the direct kyc_status column if available, otherwise fall back to kyc_info
          kyc_status: row.kyc_status || kycData.kyc_status || 'unknown',
          email: row.email || kycData.email,
          phone: row.phone || kycData.phone,
          city: row.city || kycData.city,
          country: row.country || kycData.country
        },
        vault_status: vaultStatuses[row.id] || 'inactive',
        created_at: row.created_at
      };
    });

    res.json({
      success: true,
      clients: clients,
      count: clients.length
    });

  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ 
      error: 'Failed to search clients',
      details: error.message 
    });
  }
});

// Sprint 3: Product Valuation - Get current valuation
app.get('/api/sprint3/product-valuation/:passportId', async (req, res) => {
  try {
    const { passportId } = req.params;

    if (!passportId) {
      return res.status(400).json({ error: 'Passport ID is required' });
    }

    // Get the most recent valuation for the passport
    const result = await pool.query(
      `SELECT * FROM product_valuations 
       WHERE passport_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [passportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No valuation found for this passport',
        message: 'This passport has not been valued yet'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching product valuation:', error);
    res.status(500).json({ 
      error: 'Failed to fetch product valuation',
      details: error.message 
    });
  }
});

// Sprint 3: Valuation Request - Create new valuation request
app.post('/api/sprint3/valuation/request', async (req, res) => {
  try {
    const {
      passport_id,
      requested_by,
      priority = 'normal',
      notes
    } = req.body;

    if (!passport_id || !requested_by) {
      return res.status(400).json({ 
        error: 'Missing required fields: passport_id, requested_by' 
      });
    }

    // Validate passport exists
    const passportCheck = await pool.query(
      'SELECT * FROM passports WHERE id = $1',
      [passport_id]
    );

    if (passportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Passport not found' });
    }

    // Create valuation request
    const result = await pool.query(
      `INSERT INTO valuation_requests (
        passport_id, requested_by, priority, notes, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [passport_id, requested_by, priority, notes || null, 'pending']
    );

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (passport_id, action, details) VALUES ($1, $2, $3)',
      [passport_id, 'VALUATION_REQUESTED', {
        request_id: result.rows[0].id,
        requested_by: requested_by,
        priority: priority,
        notes: notes,
        requested_at: new Date().toISOString()
      }]
    );

    console.log(`✅ Valuation request created: ${result.rows[0].id} for passport ${passport_id}`);

    res.json({
      success: true,
      valuation_request: result.rows[0],
      message: 'Valuation request created successfully'
    });

  } catch (error) {
    console.error('Error creating valuation request:', error);
    res.status(500).json({ 
      error: 'Failed to create valuation request',
      details: error.message 
    });
  }
});

// Sprint 3: Valuation Upsert - Create or update valuation
app.post('/api/sprint3/valuation/upsert', async (req, res) => {
  try {
    const {
      passport_id,
      valuation_amount,
      currency,
      appraiser_name,
      confidence_level,
      valuation_type = 'appraisal',
      notes
    } = req.body;

    if (!passport_id || !valuation_amount || !appraiser_name) {
      return res.status(400).json({ 
        error: 'Missing required fields: passport_id, valuation_amount, appraiser_name' 
      });
    }

    // Validate passport exists
    const passportCheck = await pool.query(
      'SELECT * FROM passports WHERE id = $1',
      [passport_id]
    );

    if (passportCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Passport not found' });
    }

    // Check if valuation already exists
    const existingValuation = await pool.query(
      'SELECT * FROM product_valuations WHERE passport_id = $1 ORDER BY created_at DESC LIMIT 1',
      [passport_id]
    );

    let result;
    if (existingValuation.rows.length > 0) {
      // Update existing valuation
      result = await pool.query(
        `UPDATE product_valuations 
         SET valuation_amount = $1, currency = $2, appraiser_name = $3, 
             confidence_level = $4, valuation_type = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [valuation_amount, currency, appraiser_name, confidence_level, valuation_type, notes, existingValuation.rows[0].id]
      );
    } else {
      // Create new valuation
      result = await pool.query(
        `INSERT INTO product_valuations (
          passport_id, valuation_amount, currency, appraiser_name, 
          confidence_level, valuation_type, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [passport_id, valuation_amount, currency, appraiser_name, confidence_level, valuation_type, notes]
      );
    }

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (passport_id, action, details) VALUES ($1, $2, $3)',
      [passport_id, 'VALUATION_UPDATED', {
        valuation_id: result.rows[0].id,
        valuation_amount: valuation_amount,
        currency: currency,
        appraiser_name: appraiser_name,
        confidence_level: confidence_level,
        valuation_type: valuation_type,
        updated_at: new Date().toISOString()
      }]
    );

    console.log(`✅ Valuation ${existingValuation.rows.length > 0 ? 'updated' : 'created'}: ${result.rows[0].id} for passport ${passport_id}`);

    res.json({
      success: true,
      valuation: result.rows[0],
      message: `Valuation ${existingValuation.rows.length > 0 ? 'updated' : 'created'} successfully`
    });

  } catch (error) {
    console.error('Error upserting valuation:', error);
    res.status(500).json({ 
      error: 'Failed to upsert valuation',
      details: error.message 
    });
  }
});

// Helper function to calculate ownership depth (how many buyers this passport has had)
const calculateOwnershipDepth = async (passportId) => {
  const transferHistory = await pool.query(`
    SELECT COUNT(*) as transfer_count
    FROM transfer_requests 
    WHERE product_id = $1 AND status = 'completed'
  `, [passportId]);
  
  const assignmentHistory = await pool.query(`
    SELECT COUNT(*) as assignment_count
    FROM action_logs 
    WHERE passport_id = $1 AND action = 'PASSPORT_ASSIGNED'
  `, [passportId]);
  
  // Ownership depth = number of assignments (initial + transfers)
  // Depth 1 = going to first buyer, Depth 2 = going to second buyer, etc.
  const depth = parseInt(assignmentHistory.rows[0].assignment_count) || 1;
  return depth;
};

// Helper function to get buyer level names
const getBuyerLevels = (depth) => {
  const levels = ['FB', 'SB', 'TB', 'QB', 'FiB', 'SiB']; // First, Second, Third, Fourth, Fifth, Sixth
  return levels.slice(0, depth);
};

// Sprint 3: Resale Console - Get ready-to-resale products
app.get('/api/sprint3/resale-console/ready-to-resale', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id,
        p.nfc_uid,
        p.metadata,
        p.status,
        p.assigned_client_id,
        p.created_at,
        c.name as client_name,
        c.email as client_email,
        c.city as client_city,
        c.country as client_country,
        pv.valuation_amount as current_valuation_amount,
        pv.currency as current_valuation_currency,
        pv.valuation_date as current_valuation_date,
        rc.id as config_id,
        rc.resale_type,
        rc.royalties_enabled,
        rc.cashback_enabled,
        rc.brand_participation,
        rc.brand_revenue_share,
        rc.qr_access_generated,
        rc.qr_access_url,
        rc.qr_access_expires_at,
        rc.configured_at,
        rc.ownership_depth,
        rc.royalty_tiers,
        rc.cashback_tiers,
        re.status as resale_event_status,
        re.initiated_at as resale_initiated_at
      FROM passports p
      LEFT JOIN clients c ON p.assigned_client_id = c.id
      LEFT JOIN product_valuations pv ON p.id = pv.passport_id 
        AND pv.id = (
          SELECT id FROM product_valuations 
          WHERE passport_id = p.id 
          ORDER BY valuation_date DESC 
          LIMIT 1
        )
      LEFT JOIN resale_configurations rc ON p.id = rc.passport_id
      LEFT JOIN resale_events re ON p.id = re.passport_id 
        AND re.status = 'ready_for_resale'
      WHERE p.assigned_client_id IS NOT NULL
        AND (
          p.status = 'READY_FOR_RESALE' 
          OR re.status = 'ready_for_resale'
        )
      ORDER BY COALESCE(re.initiated_at, p.created_at) DESC
    `;

    const result = await pool.query(query);

    // Calculate ownership depth for each product and add buyer levels
    const productsWithDepth = await Promise.all(result.rows.map(async (row) => {
      const ownershipDepth = await calculateOwnershipDepth(row.id);
      const buyerLevels = getBuyerLevels(ownershipDepth);
      
      return { ...row, calculated_ownership_depth: ownershipDepth, buyer_levels: buyerLevels };
    }));

    const products = productsWithDepth.map(row => ({
      id: row.id.toString(),
      passport_id: `PASSPORT-${row.id.toString().padStart(3, '0')}`,
      nfc_uid: row.nfc_uid,
      status: row.status,
      assigned_client_id: row.assigned_client_id?.toString(),
      metadata: row.metadata,
      client_name: row.client_name,
      client_email: row.client_email,
      client_city: row.client_city,
      client_country: row.client_country,
      current_valuation: row.current_valuation_amount ? {
        amount: parseFloat(row.current_valuation_amount),
        currency: row.current_valuation_currency,
        date: row.current_valuation_date
      } : null,
      ownership_depth: row.calculated_ownership_depth,
      buyer_levels: row.buyer_levels,
      resale_config: row.config_id ? {
        resale_type: row.resale_type,
        royalties_enabled: row.royalties_enabled,
        cashback_enabled: row.cashback_enabled,
        brand_participation: row.brand_participation,
        brand_revenue_share: row.brand_revenue_share ? parseFloat(row.brand_revenue_share) : null,
        qr_access_generated: row.qr_access_generated,
        qr_access_url: row.qr_access_url,
        qr_access_expires_at: row.qr_access_expires_at,
        configured_at: row.configured_at,
        ownership_depth: row.ownership_depth || row.calculated_ownership_depth,
        royalty_tiers: row.royalty_tiers || {},
        cashback_tiers: row.cashback_tiers || {}
      } : null
    }));

    console.log(`✅ Found ${products.length} ready-to-resale products`);

    res.json({
      success: true,
      products: products,
      total: products.length
    });

  } catch (error) {
    console.error('Error fetching ready-to-resale products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ready-to-resale products',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Console - Configure resale options
app.post('/api/sprint3/resale-console/configure/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      resale_type,
      royalties_enabled,
      cashback_enabled,
      brand_participation,
      brand_revenue_share,
      qr_access_enabled,
      qr_access_expiry_hours,
      configured_by,
      royalty_tiers,
      cashback_tiers
    } = req.body;

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Verify the passport exists and is valid for resale
      const passportCheck = await pool.query(
        'SELECT id, status, assigned_client_id FROM passports WHERE id = $1',
        [productId]
      );

      if (passportCheck.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      const passport = passportCheck.rows[0];
      if (!passport.assigned_client_id) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Product must have an assigned owner' });
      }

      if (!['MINTED', 'ASSIGNED', 'READY_FOR_RESALE'].includes(passport.status)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Product is not in a valid state for resale configuration' });
      }

      // Calculate ownership depth for this product
      const ownershipDepth = await calculateOwnershipDepth(productId);
      
      // Upsert resale configuration
      const configResult = await pool.query(`
        INSERT INTO resale_configurations (
          passport_id, resale_type, royalties_enabled, cashback_enabled,
          brand_participation, brand_revenue_share, qr_access_generated,
          configured_by, configured_at, ownership_depth, royalty_tiers, cashback_tiers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, $11)
        ON CONFLICT (passport_id) 
        DO UPDATE SET
          resale_type = EXCLUDED.resale_type,
          royalties_enabled = EXCLUDED.royalties_enabled,
          cashback_enabled = EXCLUDED.cashback_enabled,
          brand_participation = EXCLUDED.brand_participation,
          brand_revenue_share = EXCLUDED.brand_revenue_share,
          qr_access_generated = EXCLUDED.qr_access_generated,
          configured_by = EXCLUDED.configured_by,
          ownership_depth = EXCLUDED.ownership_depth,
          royalty_tiers = EXCLUDED.royalty_tiers,
          cashback_tiers = EXCLUDED.cashback_tiers,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        productId,
        resale_type,
        royalties_enabled,
        cashback_enabled,
        brand_participation,
        brand_revenue_share || null,
        qr_access_enabled || false,
        configured_by || 'admin',
        ownershipDepth,
        JSON.stringify(royalty_tiers || {}),
        JSON.stringify(cashback_tiers || {})
      ]);

      // Update passport resale status
      await pool.query(
        'UPDATE passports SET resale_status = $1 WHERE id = $2',
        ['configured', productId]
      );

      // Log the action
      await pool.query(
        'INSERT INTO action_logs (passport_id, action, details) VALUES ($1, $2, $3)',
        [productId, 'RESALE_CONFIGURED', {
          config_id: configResult.rows[0].id,
          resale_type: resale_type,
          royalties_enabled: royalties_enabled,
          cashback_enabled: cashback_enabled,
          brand_participation: brand_participation,
          brand_revenue_share: brand_revenue_share,
          qr_access_enabled: qr_access_enabled,
          configured_by: configured_by || 'admin',
          configured_at: new Date().toISOString()
        }]
      );

      await pool.query('COMMIT');

      console.log(`✅ Resale configuration saved for product ${productId}`);

      res.json({
        success: true,
        configuration: configResult.rows[0],
        message: 'Resale configuration saved successfully'
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error saving resale configuration:', error);
    res.status(500).json({ 
      error: 'Failed to save resale configuration',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Console - Generate QR access
app.post('/api/sprint3/resale-console/qr-access/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { expiry_hours = 24, include_metadata = true } = req.body;

    // Verify the passport exists and has resale configuration
    const productCheck = await pool.query(`
      SELECT p.id, p.nfc_uid, p.metadata, p.assigned_client_id, 
             c.name as client_name, rc.id as config_id
      FROM passports p
      LEFT JOIN clients c ON p.assigned_client_id = c.id
      LEFT JOIN resale_configurations rc ON p.id = rc.passport_id
      WHERE p.id = $1
    `, [productId]);

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productCheck.rows[0];
    if (!product.config_id) {
      return res.status(400).json({ error: 'Product must be configured for resale first' });
    }

    // Generate unique access token
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (expiry_hours * 60 * 60 * 1000));

    // Create QR access token
    const tokenResult = await pool.query(`
      INSERT INTO qr_access_tokens (
        client_id, passport_id, token, access_reason, 
        validity_duration, expires_at, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      product.assigned_client_id,
      productId,
      accessToken,
      'resale_preview',
      `${expiry_hours}h`,
      expiresAt,
      'active'
    ]);

    // Update resale configuration with QR info
    const qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/preview/${accessToken}`;
    await pool.query(`
      UPDATE resale_configurations 
      SET qr_access_generated = true, qr_access_url = $1, qr_access_expires_at = $2
      WHERE passport_id = $3
    `, [qrUrl, expiresAt, productId]);

    // Log the action
    await pool.query(
      'INSERT INTO action_logs (passport_id, action, details) VALUES ($1, $2, $3)',
      [productId, 'QR_ACCESS_GENERATED', {
        token_id: tokenResult.rows[0].id,
        access_token: accessToken,
        qr_url: qrUrl,
        expires_at: expiresAt.toISOString(),
        expiry_hours: expiry_hours,
        include_metadata: include_metadata
      }]
    );

    console.log(`✅ QR access generated for product ${productId}: ${accessToken}`);

    res.json({
      success: true,
      qr_url: qrUrl,
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      expiry_hours: expiry_hours,
      token_info: tokenResult.rows[0],
      message: 'QR access generated successfully'
    });

  } catch (error) {
    console.error('Error generating QR access:', error);
    res.status(500).json({ 
      error: 'Failed to generate QR access',
      details: error.message 
    });
  }
});

// Sprint 3: Contract Management - Get recent contracts
app.get('/api/sprint3/contracts/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const query = `
      SELECT 
        re.*,
        p.nfc_uid, p.status as passport_status, p.metadata as passport_metadata,
        c_seller.name as seller_name, c_seller.email as seller_email,
        c_buyer.name as buyer_name, c_buyer.email as buyer_email,
        pv.valuation_amount, pv.currency, pv.valuation_date
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      JOIN clients c_seller ON re.seller_id = c_seller.id
      LEFT JOIN clients c_buyer ON re.buyer_id = c_buyer.id
      LEFT JOIN product_valuations pv ON p.id = pv.passport_id 
        AND pv.id = (
          SELECT id FROM product_valuations 
          WHERE passport_id = p.id 
          ORDER BY valuation_date DESC 
          LIMIT 1
        )
      ORDER BY re.initiated_at DESC 
      LIMIT $1
    `;

    const result = await pool.query(query, [parseInt(limit)]);

    const contracts = result.rows.map(row => ({
      id: row.id,
      resale_id: row.resale_id,
      passport_id: row.passport_id,
      seller_id: row.seller_id,
      buyer_id: row.buyer_id,
      asking_price: parseFloat(row.asking_price),
      minimum_price: parseFloat(row.minimum_price),
      currency: row.currency,
      marketplace_id: row.marketplace_id,
      external_listing_ref: row.external_listing_ref,
      status: row.status,
      initiated_at: row.initiated_at,
      passport: {
        id: row.passport_id,
        nfc_uid: row.nfc_uid,
        status: row.passport_status,
        metadata: row.passport_metadata
      },
      seller: {
        id: row.seller_id,
        name: row.seller_name,
        email: row.seller_email
      },
      buyer: row.buyer_id ? {
        id: row.buyer_id,
        name: row.buyer_name,
        email: row.buyer_email
      } : null,
      valuation: row.valuation_amount ? {
        amount: parseFloat(row.valuation_amount),
        currency: row.currency,
        date: row.valuation_date
      } : null
    }));

    res.json({
      success: true,
      contracts: contracts,
      count: contracts.length
    });

  } catch (error) {
    console.error('Error fetching recent contracts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recent contracts',
      details: error.message 
    });
  }
});

// Sprint 3: Contract Management - Search contracts
app.get('/api/sprint3/contracts/search', async (req, res) => {
  try {
    const { q, status, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    let query = `
      SELECT 
        re.*,
        p.nfc_uid, p.status as passport_status, p.metadata as passport_metadata,
        c_seller.name as seller_name, c_seller.email as seller_email,
        c_buyer.name as buyer_name, c_buyer.email as buyer_email,
        pv.valuation_amount, pv.currency, pv.valuation_date
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      JOIN clients c_seller ON re.seller_id = c_seller.id
      LEFT JOIN clients c_buyer ON re.buyer_id = c_buyer.id
      LEFT JOIN product_valuations pv ON p.id = pv.passport_id 
        AND pv.id = (
          SELECT id FROM product_valuations 
          WHERE passport_id = p.id 
          ORDER BY valuation_date DESC 
          LIMIT 1
        )
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;

    // Add status filter if provided
    if (status) {
      query += ` AND re.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Add search conditions
    query += ` AND (
      re.resale_id ILIKE $${paramIndex} OR
      re.passport_id::text = $${paramIndex + 1} OR
      p.metadata::text ILIKE $${paramIndex + 2} OR
      c_seller.name ILIKE $${paramIndex + 3} OR
      c_buyer.name ILIKE $${paramIndex + 4}
    )`;
    
    const searchTerm = `%${q}%`;
    queryParams.push(searchTerm, q, searchTerm, searchTerm, searchTerm);
    paramIndex += 5;

    query += ` ORDER BY re.initiated_at DESC LIMIT $${paramIndex}`;
    queryParams.push(parseInt(limit));

    const result = await pool.query(query, queryParams);

    const contracts = result.rows.map(row => ({
      id: row.id,
      resale_id: row.resale_id,
      passport_id: row.passport_id,
      seller_id: row.seller_id,
      buyer_id: row.buyer_id,
      asking_price: parseFloat(row.asking_price),
      minimum_price: parseFloat(row.minimum_price),
      currency: row.currency,
      marketplace_id: row.marketplace_id,
      external_listing_ref: row.external_listing_ref,
      status: row.status,
      initiated_at: row.initiated_at,
      passport: {
        id: row.passport_id,
        nfc_uid: row.nfc_uid,
        status: row.passport_status,
        metadata: row.passport_metadata
      },
      seller: {
        id: row.seller_id,
        name: row.seller_name,
        email: row.seller_email
      },
      buyer: row.buyer_id ? {
        id: row.buyer_id,
        name: row.buyer_name,
        email: row.buyer_email
      } : null,
      valuation: row.valuation_amount ? {
        amount: parseFloat(row.valuation_amount),
        currency: row.currency,
        date: row.valuation_date
      } : null
    }));

    res.json({
      success: true,
      contracts: contracts,
      count: contracts.length
    });

  } catch (error) {
    console.error('Error searching contracts:', error);
    res.status(500).json({ 
      error: 'Failed to search contracts',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Finalization - Finalize resale transaction
app.post('/api/sprint3/resale/:resaleId/finalize', async (req, res) => {
  try {
    const { resaleId } = req.params;
    const {
      ownership_transfer,
      sbt_minted,
      passport_updated,
      blockchain_anchored,
      metadata_archived
    } = req.body;

    // Validate required fields
    if (!ownership_transfer || !sbt_minted || !passport_updated || !blockchain_anchored || !metadata_archived) {
      return res.status(400).json({ 
        error: 'All finalization steps must be confirmed' 
      });
    }

    // Get resale event details
    const resaleQuery = `
      SELECT 
        re.*,
        p.id as passport_id, p.nfc_uid, p.status as passport_status, p.assigned_client_id,
        p.metadata as passport_metadata, p.created_at as passport_created,
        c_seller.name as seller_name, c_seller.email as seller_email,
        c_buyer.name as buyer_name, c_buyer.email as buyer_email
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      JOIN clients c_seller ON re.seller_id = c_seller.id
      LEFT JOIN clients c_buyer ON re.buyer_id = c_buyer.id
      WHERE re.resale_id = $1 AND re.status IN ('buyer_assigned', 'pending_sale')
    `;

    const resaleResult = await pool.query(resaleQuery, [resaleId]);

    if (resaleResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Resale event not found or not in a valid status for finalization (buyer_assigned or pending_sale)' 
      });
    }

    const resaleEvent = resaleResult.rows[0];

    // Validate that buyer is assigned
    if (!resaleEvent.buyer_id) {
      return res.status(400).json({ 
        error: 'Buyer must be assigned before finalization' 
      });
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // 0. Update status to pending_sale if currently buyer_assigned
      if (resaleEvent.status === 'buyer_assigned') {
        await pool.query(
          'UPDATE resale_events SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE resale_id = $2',
          ['pending_sale', resaleId]
        );
        console.log(`✅ Updated resale event ${resaleId} status from buyer_assigned to pending_sale`);
      }

      // 1. Remove product from seller's vault (ownership transfer)
      await pool.query(
        'UPDATE passports SET assigned_client_id = NULL, status = $1 WHERE id = $2',
        ['SOLD', resaleEvent.passport_id]
      );

      // 2. Mint new SBT for buyer (add to their vault)
      const newSbtId = `SBT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Create new SBT record
      await pool.query(
        `INSERT INTO sbt_tokens (
          token_id, passport_id, owner_id, status, minted_at, 
          transaction_hash, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newSbtId,
          resaleEvent.passport_id,
          resaleEvent.buyer_id,
          'MINTED',
          new Date(),
          `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          {
            resale_id: resaleId,
            previous_owner: resaleEvent.seller_id,
            minted_from_resale: true,
            original_passport_created: resaleEvent.passport_created
          }
        ]
      );

      // 3. Update passport metadata with new owner and status
      const updatedMetadata = {
        ...resaleEvent.passport_metadata,
        current_owner: resaleEvent.buyer_id,
        ownership_history: [
          ...(resaleEvent.passport_metadata?.ownership_history || []),
          {
            owner_id: resaleEvent.buyer_id,
            owner_name: resaleEvent.buyer_name,
            transfer_date: new Date().toISOString(),
            transfer_type: 'resale',
            resale_id: resaleId,
            previous_owner: resaleEvent.seller_id,
            previous_owner_name: resaleEvent.seller_name
          }
        ],
        resale_transactions: [
          ...(resaleEvent.passport_metadata?.resale_transactions || []),
          {
            resale_id: resaleId,
            seller_id: resaleEvent.seller_id,
            buyer_id: resaleEvent.buyer_id,
            amount: resaleEvent.asking_price,
            currency: resaleEvent.currency,
            date: new Date().toISOString(),
            status: 'completed'
          }
        ],
        last_updated: new Date().toISOString()
      };

      await pool.query(
        'UPDATE passports SET assigned_client_id = $1, status = $2, metadata = $3 WHERE id = $4',
        [resaleEvent.buyer_id, 'MINTED', updatedMetadata, resaleEvent.passport_id]
      );

      // 4. Lock transaction on blockchain (simulate blockchain anchoring)
      const blockchainTxHash = `BLOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Store blockchain transaction record
      await pool.query(
        `INSERT INTO blockchain_transactions (
          transaction_hash, passport_id, transaction_type, 
          from_address, to_address, amount, currency,
          metadata, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          blockchainTxHash,
          resaleEvent.passport_id,
          'RESALE_FINALIZATION',
          resaleEvent.seller_id.toString(),
          resaleEvent.buyer_id.toString(),
          resaleEvent.asking_price,
          resaleEvent.currency,
          {
            resale_id: resaleId,
            passport_id: resaleEvent.passport_id,
            finalization_steps: {
              ownership_transfer,
              sbt_minted,
              passport_updated,
              blockchain_anchored,
              metadata_archived
            }
          },
          'CONFIRMED',
          new Date()
        ]
      );

      // 5. Archive resale metadata
      const archivedMetadata = {
        resale_id: resaleId,
        passport_id: resaleEvent.passport_id,
        seller_id: resaleEvent.seller_id,
        seller_name: resaleEvent.seller_name,
        buyer_id: resaleEvent.buyer_id,
        buyer_name: resaleEvent.buyer_name,
        resale_amount: resaleEvent.asking_price,
        currency: resaleEvent.currency,
        marketplace_id: resaleEvent.marketplace_id,
        external_listing_ref: resaleEvent.external_listing_ref,
        finalization_date: new Date().toISOString(),
        blockchain_transaction: blockchainTxHash,
        passport_url: `/passport/${resaleEvent.passport_id}`,
        metadata: resaleEvent.metadata
      };

      await pool.query(
        `INSERT INTO resale_archives (
          resale_id, passport_id, archived_data, archived_at
        ) VALUES ($1, $2, $3, $4)`,
        [resaleId, resaleEvent.passport_id, archivedMetadata, new Date()]
      );

      // 6. Update resale event status to finalized
      await pool.query(
        'UPDATE resale_events SET status = $1, finalized_at = $2 WHERE resale_id = $3',
        ['finalized', new Date(), resaleId]
      );

      // 7. Log all actions
      const actions = [
        [resaleEvent.seller_id, resaleEvent.passport_id, 'RESALE_OWNERSHIP_TRANSFERRED', { resale_id: resaleId, new_owner: resaleEvent.buyer_id }],
        [resaleEvent.buyer_id, resaleEvent.passport_id, 'RESALE_SBT_MINTED', { resale_id: resaleId, sbt_id: newSbtId }],
        [resaleEvent.buyer_id, resaleEvent.passport_id, 'RESALE_PASSPORT_UPDATED', { resale_id: resaleId, new_status: 'MINTED' }],
        [resaleEvent.buyer_id, resaleEvent.passport_id, 'RESALE_BLOCKCHAIN_ANCHORED', { resale_id: resaleId, tx_hash: blockchainTxHash }],
        [resaleEvent.buyer_id, resaleEvent.passport_id, 'RESALE_METADATA_ARCHIVED', { resale_id: resaleId }]
      ];

      for (const [clientId, passportId, action, details] of actions) {
        await pool.query(
          'INSERT INTO action_logs (client_id, passport_id, action, details) VALUES ($1, $2, $3, $4)',
          [clientId, passportId, action, details]
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      console.log(`✅ Resale finalized successfully: ${resaleId} for passport ${resaleEvent.passport_id}`);

      res.json({
        success: true,
        message: 'Resale finalized successfully',
        resale_id: resaleId,
        passport_id: resaleEvent.passport_id,
        new_owner_id: resaleEvent.buyer_id,
        sbt_id: newSbtId,
        blockchain_transaction: blockchainTxHash,
        finalization_details: {
          ownership_transfer,
          sbt_minted,
          passport_updated,
          blockchain_anchored,
          metadata_archived
        },
        next_steps: [
          'Product successfully transferred to new owner',
          'New SBT minted and assigned',
          'Passport updated with ownership history',
          'Transaction locked on blockchain',
          'Metadata archived for traceability'
        ]
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error finalizing resale:', error);
    res.status(500).json({ 
      error: 'Failed to finalize resale',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Finalization - Get finalization status
app.get('/api/sprint3/resale/:resaleId/finalization-status', async (req, res) => {
  try {
    const { resaleId } = req.params;
    
    const query = `
      SELECT 
        re.*,
        p.status as passport_status, p.assigned_client_id,
        sbt.status as sbt_status, sbt.owner_id as sbt_owner_id,
        bt.transaction_hash, bt.status as blockchain_status
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      LEFT JOIN sbt_tokens sbt ON p.id = sbt.passport_id AND sbt.status = 'MINTED'
      LEFT JOIN blockchain_transactions bt ON p.id = bt.passport_id AND bt.transaction_type = 'RESALE_FINALIZATION'
      WHERE re.resale_id = $1
    `;

    const result = await pool.query(query, [resaleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resale event not found' });
    }

    const row = result.rows[0];
    
    const finalizationStatus = {
      resale_id: row.resale_id,
      passport_id: row.passport_id,
      status: row.status,
      ownership_transfer: row.passport_status === 'MINTED' && row.assigned_client_id === row.buyer_id,
      sbt_minted: row.sbt_status === 'MINTED' && row.sbt_owner_id === row.buyer_id,
      passport_updated: row.passport_status === 'MINTED' && row.assigned_client_id === row.buyer_id,
      blockchain_anchored: row.blockchain_status === 'CONFIRMED',
      metadata_archived: row.status === 'finalized',
      finalization_complete: row.status === 'finalized',
      blockchain_transaction: row.transaction_hash,
      finalization_date: row.finalized_at
    };

    res.json({
      success: true,
      finalization_status: finalizationStatus
    });

  } catch (error) {
    console.error('Error fetching finalization status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch finalization status',
      details: error.message 
    });
  }
});

// Sprint 3: Resale Summary - Get finalized resale summary
app.get('/api/sprint3/resale/:resaleId/summary', async (req, res) => {
  try {
    const { resaleId } = req.params;
    
    const query = `
      SELECT 
        re.*,
        p.nfc_uid, p.status as passport_status, p.metadata as passport_metadata,
        c_seller.name as seller_name, c_seller.email as seller_email,
        c_buyer.name as buyer_name, c_buyer.email as buyer_email,
        sbt.token_id as sbt_id, sbt.minted_at as sbt_minted_at,
        bt.transaction_hash, bt.created_at as blockchain_date,
        ra.archived_data
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      JOIN clients c_seller ON re.seller_id = c_seller.id
      JOIN clients c_buyer ON re.buyer_id = c_buyer.id
      LEFT JOIN sbt_tokens sbt ON p.id = sbt.passport_id AND sbt.status = 'MINTED'
      LEFT JOIN blockchain_transactions bt ON p.id = bt.passport_id AND bt.transaction_type = 'RESALE_FINALIZATION'
      LEFT JOIN resale_archives ra ON re.resale_id = ra.resale_id
      WHERE re.resale_id = $1 AND re.status = 'finalized'
    `;

    const result = await pool.query(query, [resaleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Finalized resale not found' });
    }

    const row = result.rows[0];
    
    const resaleSummary = {
      resale_id: row.resale_id,
      passport_id: row.passport_id,
      nfc_uid: row.nfc_uid,
      transaction_details: {
        seller: {
          id: row.seller_id,
          name: row.seller_name,
          email: row.seller_email
        },
        buyer: {
          id: row.buyer_id,
          name: row.buyer_name,
          email: row.buyer_email
        },
        amount: parseFloat(row.asking_price),
        currency: row.currency,
        marketplace_id: row.marketplace_id,
        external_listing_ref: row.external_listing_ref,
        initiated_at: row.initiated_at,
        finalized_at: row.finalized_at
      },
      blockchain_details: {
        sbt_id: row.sbt_id,
        sbt_minted_at: row.sbt_minted_at,
        transaction_hash: row.transaction_hash,
        blockchain_date: row.blockchain_date
      },
      passport_status: row.passport_status,
      archived_metadata: row.archived_data || {},
      traceability: {
        ownership_history: row.passport_metadata?.ownership_history || [],
        resale_transactions: row.passport_metadata?.resale_transactions || [],
        blockchain_anchored: true,
        immutable_record: true
      }
    };

    res.json({
      success: true,
      resale_summary: resaleSummary
    });

  } catch (error) {
    console.error('Error fetching resale summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch resale summary',
      details: error.message 
    });
  }
});

// Sprint 3: Contract Management - Get contract by ID
app.get('/api/sprint3/contracts/:resaleId', async (req, res) => {
  try {
    const { resaleId } = req.params;
    
    const query = `
      SELECT 
        re.*,
        p.nfc_uid, p.status as passport_status, p.metadata as passport_metadata,
        c_seller.name as seller_name, c_seller.email as seller_email,
        c_buyer.name as buyer_name, c_buyer.email as buyer_email,
        pv.valuation_amount, pv.currency, pv.valuation_date,
        rc.resale_type, rc.royalties_enabled, rc.cashback_enabled,
        rc.brand_participation, rc.brand_revenue_share
      FROM resale_events re
      JOIN passports p ON re.passport_id = p.id
      JOIN clients c_seller ON re.seller_id = c_seller.id
      LEFT JOIN clients c_buyer ON re.buyer_id = c_buyer.id
      LEFT JOIN product_valuations pv ON p.id = pv.passport_id 
        AND pv.id = (
          SELECT id FROM product_valuations 
          WHERE passport_id = p.id 
          ORDER BY valuation_date DESC 
          LIMIT 1
        )
      LEFT JOIN resale_configurations rc ON p.id = rc.passport_id
      WHERE re.resale_id = $1
    `;

    const result = await pool.query(query, [resaleId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const row = result.rows[0];
    const contract = {
      id: row.id,
      resale_id: row.resale_id,
      passport_id: row.passport_id,
      seller_id: row.seller_id,
      buyer_id: row.buyer_id,
      asking_price: parseFloat(row.asking_price),
      minimum_price: parseFloat(row.minimum_price),
      currency: row.currency,
      marketplace_id: row.marketplace_id,
      external_listing_ref: row.external_listing_ref,
      status: row.status,
      initiated_at: row.initiated_at,
      passport: {
        id: row.passport_id,
        nfc_uid: row.nfc_uid,
        status: row.passport_status,
        metadata: row.passport_metadata
      },
      seller: {
        id: row.seller_id,
        name: row.seller_name,
        email: row.seller_email
      },
      buyer: row.buyer_id ? {
        id: row.buyer_id,
        name: row.buyer_name,
        email: row.buyer_email
      } : null,
      valuation: row.valuation_amount ? {
        amount: parseFloat(row.valuation_amount),
        currency: row.currency,
        date: row.valuation_date
      } : null,
      resale_config: row.resale_type ? {
        resale_type: row.resale_type,
        royalties_enabled: row.royalties_enabled,
        cashback_enabled: row.cashback_enabled,
        brand_participation: row.brand_participation,
        brand_revenue_share: row.brand_revenue_share ? parseFloat(row.brand_revenue_share) : null
      } : null
    };

    res.json({
      success: true,
      contract: contract
    });

  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contract',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Get dashboard statistics
app.get('/api/sprint3/admin/dashboard-stats', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const stats = await adminDashboard.getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Get all resale events
app.get('/api/sprint3/admin/resale-events', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const events = await adminDashboard.getAllResaleEvents();
    res.json({ success: true, resale_events: events });
  } catch (error) {
    console.error('Error fetching resale events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch resale events',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Get royalty distributions
app.get('/api/sprint3/admin/royalty-distributions', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const distributions = await adminDashboard.getRoyaltyDistributions();
    res.json({ success: true, distributions });
  } catch (error) {
    console.error('Error fetching royalty distributions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch royalty distributions',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Get marketplace integrations
app.get('/api/sprint3/admin/marketplace-integrations', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const integrations = await adminDashboard.getMarketplaceIntegrations();
    res.json({ success: true, integrations });
  } catch (error) {
    console.error('Error fetching marketplace integrations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch marketplace integrations',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Approve resale
app.patch('/api/sprint3/admin/resale/:resaleId/approve', async (req, res) => {
  try {
    const { resaleId } = req.params;
    const { status, reason } = req.body;
    
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const result = await adminDashboard.approveResale(resaleId, status, reason);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error approving resale:', error);
    res.status(500).json({ 
      error: 'Failed to approve resale',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Block resale
app.patch('/api/sprint3/admin/resale/:resaleId/block', async (req, res) => {
  try {
    const { resaleId } = req.params;
    const { status, reason } = req.body;
    
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const result = await adminDashboard.blockResale(resaleId, status, reason);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error blocking resale:', error);
    res.status(500).json({ 
      error: 'Failed to block resale',
      details: error.message 
    });
  }
});

// Sprint 3: Admin Dashboard - Get real-time updates
app.get('/api/sprint3/admin/real-time-updates', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const updates = await adminDashboard.getRealTimeUpdates();
    res.json({ success: true, updates });
  } catch (error) {
    console.error('Error fetching real-time updates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch real-time updates',
      details: error.message 
    });
  }
});

// Sprint 3: Royalty Engine - Get distributions
app.get('/api/sprint3/royalty-engine/distributions', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const distributions = await adminDashboard.getRoyaltyDistributions();
    res.json({ success: true, distributions });
  } catch (error) {
    console.error('Error fetching royalty distributions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch royalty distributions',
      details: error.message 
    });
  }
});

// Sprint 3: Royalty Engine - Recalculate royalties
app.post('/api/sprint3/royalty-engine/recalculate/:resaleId', async (req, res) => {
  try {
    const { resaleId } = req.params;
    
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const result = await adminDashboard.recalculateRoyalties(resaleId);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error recalculating royalties:', error);
    res.status(500).json({ 
      error: 'Failed to recalculate royalties',
      details: error.message 
    });
  }
});

// Sprint 3: Marketplace Connector - Get integrations
app.get('/api/sprint3/marketplace-connector/integrations', async (req, res) => {
  try {
    const adminDashboard = require('./lib/sprint3/adminDashboard');
    const integrations = await adminDashboard.getMarketplaceIntegrations();
    res.json({ success: true, integrations });
  } catch (error) {
    console.error('Error fetching marketplace integrations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch marketplace integrations',
      details: error.message 
    });
  }
});

// ===== SPRINT 8: LOGISTICS SYSTEM API ENDPOINTS =====

const LogisticsAPI = require('./lib/sprint8/logisticsApi');

// Configure multer for logistics document uploads
const logisticsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads/logistics');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const shipmentRef = req.body.reference || 'unknown';
    const sanitizedRef = shipmentRef.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${sanitizedRef}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadLogisticsFiles = multer({
  storage: logisticsStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Maximum 10 files per shipment
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                    file.mimetype === 'application/pdf' ||
                    file.mimetype.includes('document') ||
                    file.mimetype.includes('word');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed for logistics shipments'));
    }
  }
});

// Create new shipment
app.post('/api/sprint8/logistics/shipments', uploadLogisticsFiles.array('files', 10), async (req, res) => {
  try {
    const shipmentData = JSON.parse(req.body.shipmentData || '{}');
    const files = req.files || [];
    
    console.log('Creating shipment with data:', {
      reference: shipmentData.reference,
      filesCount: files.length,
      senderName: shipmentData.sender?.fullName,
      buyerName: shipmentData.buyer?.fullName
    });
    
    const result = await LogisticsAPI.createShipment(shipmentData, files);
    
    res.json({
      success: true,
      message: 'Shipment created successfully',
      shipment: result
    });
  } catch (error) {
    console.error('Error creating shipment:', error);
    res.status(500).json({
      error: 'Failed to create shipment',
      details: error.message
    });
  }
});

// Get shipments to classify (for dashboard)
app.get('/api/sprint8/logistics/shipments/to-classify', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const shipments = await LogisticsAPI.getShipmentsToClassify(
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      success: true,
      shipments: shipments,
      count: shipments.length
    });
  } catch (error) {
    console.error('Error fetching shipments to classify:', error);
    res.status(500).json({
      error: 'Failed to fetch shipments',
      details: error.message
    });
  }
});

// Get shipments ready for route planning (classified with tier)
app.get('/api/sprint8/logistics/shipments/to-plan', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const shipments = await LogisticsAPI.getShipmentsReadyForPlanning(
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      shipments,
      count: shipments.length
    });
  } catch (error) {
    console.error('Error fetching shipments to plan:', error);
    res.status(500).json({
      error: 'Failed to fetch shipments to plan',
      details: error.message
    });
  }
});

// Get shipment details by ID
app.get('/api/sprint8/logistics/shipments/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const shipment = await LogisticsAPI.getShipmentById(shipmentId);
    
    if (!shipment) {
      return res.status(404).json({
        error: 'Shipment not found'
      });
    }
    
    // Extract metadata fields
    const metadata = shipment.metadata || {};
    const enrichedShipment = {
      ...shipment,
      product_image: metadata.product_image || null,
      category: metadata.category || null
    };
    
    res.json({
      success: true,
      shipment: enrichedShipment
    });
  } catch (error) {
    console.error('Error fetching shipment:', error);
    res.status(500).json({
      error: 'Failed to fetch shipment',
      details: error.message
    });
  }
});

// Update shipment status and tier (for classification)
app.put('/api/sprint8/logistics/shipments/:shipmentId/classify', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { tier, notes = 'Tier assigned' } = req.body;
    
    if (!tier || !['T1', 'T2', 'T3'].includes(tier)) {
      return res.status(400).json({
        error: 'Valid tier is required (T1, T2, or T3)'
      });
    }

    // Parse justification data if provided
    let justificationData = null;
    try {
      if (notes && notes.startsWith('{')) {
        justificationData = JSON.parse(notes);
      }
    } catch (e) {
      // If parsing fails, treat notes as regular text
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update the shipment with assigned tier and status  
      const updateQuery = `
        UPDATE shipments 
        SET tier = $1, 
            status = 'Ready for Route Planning', 
            updated_at = CURRENT_TIMESTAMP
        WHERE shipment_id = $2 
        RETURNING id
      `;
      
      const result = await client.query(updateQuery, [tier, shipmentId]);
      
      if (result.rows.length === 0) {
        throw new Error('Shipment not found');
      }
      
      const internalId = result.rows[0].id;
      
      // Add tracking entry
      await client.query(`
        INSERT INTO shipment_tracking (shipment_id, status, notes, updated_by)
        VALUES ($1, $2, $3, $4)
      `, [internalId, 'Ready for Route Planning', `Tier ${tier} assigned${justificationData ? ` - ${justificationData.reason}` : ''}`, 'user']);
      
      await client.query('COMMIT');
      
      console.log(`✅ Tier ${tier} assigned to shipment ${shipmentId}`);
      
      res.json({
        success: true,
        message: 'Tier assigned successfully',
        shipmentId: shipmentId,
        tier: tier,
        status: 'classified',
        next_step: 'Quote & Plan - route selection and bookings'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error assigning tier:', error);
    res.status(500).json({
      error: 'Failed to assign tier',
      details: error.message
    });
  }
});

// Update shipment status
app.put('/api/sprint8/logistics/shipments/:shipmentId/status', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { status, notes = 'Status updated' } = req.body;
    
    const validStatuses = ['draft', 'classified', 'planned', 'in-transit', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Valid status is required (${validStatuses.join(', ')})`
      });
    }
    
    await LogisticsAPI.updateShipmentStatus(
      shipmentId, 
      status, 
      null, 
      notes, 
      'system'
    );
    
    res.json({
      success: true,
      message: 'Shipment status updated successfully',
      shipmentId: shipmentId,
      status: status
    });
  } catch (error) {
    console.error('Error updating shipment status:', error);
    res.status(500).json({
      error: 'Failed to update shipment status',
      details: error.message
    });
  }
});

// Save shipment draft (for autosave)
app.post('/api/sprint8/logistics/shipments/draft', async (req, res) => {
  try {
    const shipmentData = req.body;
    
    const result = await LogisticsAPI.saveShipmentDraft(shipmentData);
    
    res.json({
      success: true,
      message: 'Draft saved successfully',
      shipment: result
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({
      error: 'Failed to save draft',
      details: error.message
    });
  }
});

// Get logistics hubs
app.get('/api/sprint8/logistics/hubs', async (req, res) => {
  try {
    const hubs = await LogisticsAPI.getLogisticsHubs();
    
    res.json({
      success: true,
      hubs: hubs
    });
  } catch (error) {
    console.error('Error fetching logistics hubs:', error);
    res.status(500).json({
      error: 'Failed to fetch logistics hubs',
      details: error.message
    });
  }
});

// Calculate shipment pricing
app.post('/api/sprint8/logistics/pricing/calculate', async (req, res) => {
  try {
    const shipmentData = req.body;
    
    const pricing = await LogisticsAPI.calculateShipmentPricing(shipmentData);
    
    res.json({
      success: true,
      pricing: pricing
    });
  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      error: 'Failed to calculate pricing',
      details: error.message
    });
  }
});

// Check for duplicate reference
app.get('/api/sprint8/logistics/shipments/check-reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const result = await pool.query(
      'SELECT COUNT(*) as count, array_agg(shipment_id) as shipment_ids FROM shipments WHERE reference_sku = $1',
      [reference]
    );
    
    const count = parseInt(result.rows[0].count);
    const isDuplicate = count > 0;
    
    res.json({
      success: true,
      isDuplicate: isDuplicate,
      count: count,
      existingShipments: isDuplicate ? result.rows[0].shipment_ids : []
    });
  } catch (error) {
    console.error('Error checking reference:', error);
    res.status(500).json({
      error: 'Failed to check reference',
      details: error.message
    });
  }
});

// Get shipment statistics for dashboard
app.get('/api/sprint8/logistics/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(declared_value) as total_value
      FROM shipments 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY status
    `);
    
    const tierStats = await pool.query(`
      SELECT 
        tier,
        COUNT(*) as count
      FROM shipments 
      WHERE tier IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY tier
    `);
    
    res.json({
      success: true,
      statusStats: stats.rows,
      tierStats: tierStats.rows
    });
  } catch (error) {
    console.error('Error fetching logistics stats:', error);
    res.status(500).json({
      error: 'Failed to fetch logistics statistics',
      details: error.message
    });
  }
});

// =============================================================================
// SPRINT 8: DHL LABEL MANAGEMENT API
// =============================================================================

// Mount the DHL API endpoints
const dhlAPI = require('./lib/sprint8/dhlAPI');
app.use('/api', dhlAPI);

// =============================================================================
// SPRINT 8: HUB MANAGEMENT API ENDPOINTS
// =============================================================================

const HubManagementAPI = require('./lib/sprint8/hubManagementAPI');

// Get all hubs with optional filters
app.get('/api/sprint8/logistics/hubs/management', async (req, res) => {
  try {
    const filters = {
      role: req.query.role,
      country: req.query.country,
      city: req.query.city,
      status: req.query.status,
      currency: req.query.currency,
      search: req.query.search
    };

    const hubs = await HubManagementAPI.getHubs(filters);
    
    res.json({
      success: true,
      hubs: hubs,
      count: hubs.length
    });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    res.status(500).json({
      error: 'Failed to fetch hubs',
      details: error.message
    });
  }
});

// Get hub by ID
app.get('/api/sprint8/logistics/hubs/management/:hubId', async (req, res) => {
  try {
    const { hubId } = req.params;
    const hub = await HubManagementAPI.getHubById(hubId);
    
    res.json({
      success: true,
      hub: hub
    });
  } catch (error) {
    console.error('Error fetching hub:', error);
    const statusCode = error.message === 'Hub not found' ? 404 : 500;
    res.status(statusCode).json({
      error: error.message,
      details: error.message
    });
  }
});

// Create new hub
app.post('/api/sprint8/logistics/hubs/management', async (req, res) => {
  try {
    const hubData = req.body;
    const actorId = req.headers['x-actor-id'] || 'api_user';
    
    // Add audit info
    hubData.createdBy = actorId;
    
    const result = await HubManagementAPI.createHub(hubData);
    
    res.status(201).json({
      success: true,
      message: 'Hub created successfully',
      hub: result
    });
  } catch (error) {
    console.error('Error creating hub:', error);
    res.status(500).json({
      error: 'Failed to create hub',
      details: error.message
    });
  }
});

// Update hub
app.put('/api/sprint8/logistics/hubs/management/:hubId', async (req, res) => {
  try {
    const { hubId } = req.params;
    const updateData = req.body;
    const actorId = req.headers['x-actor-id'] || 'api_user';
    
    // Add audit info
    updateData.updatedBy = actorId;
    
    const result = await HubManagementAPI.updateHub(hubId, updateData);
    
    res.json({
      success: true,
      message: 'Hub updated successfully',
      hub: result
    });
  } catch (error) {
    console.error('Error updating hub:', error);
    res.status(500).json({
      error: 'Failed to update hub',
      details: error.message
    });
  }
});

// Archive hub
app.delete('/api/sprint8/logistics/hubs/management/:hubId', async (req, res) => {
  try {
    const { hubId } = req.params;
    const actorId = req.headers['x-actor-id'] || 'api_user';
    
    await HubManagementAPI.archiveHub(hubId, actorId);
    
    res.json({
      success: true,
      message: 'Hub archived successfully'
    });
  } catch (error) {
    console.error('Error archiving hub:', error);
    res.status(500).json({
      error: 'Failed to archive hub',
      details: error.message
    });
  }
});

// Duplicate hub
app.post('/api/sprint8/logistics/hubs/management/:hubId/duplicate', async (req, res) => {
  try {
    const { hubId } = req.params;
    const newHubData = req.body;
    const actorId = req.headers['x-actor-id'] || 'api_user';
    
    newHubData.createdBy = actorId;
    
    const result = await HubManagementAPI.duplicateHub(hubId, newHubData);
    
    res.status(201).json({
      success: true,
      message: 'Hub duplicated successfully',
      hub: result
    });
  } catch (error) {
    console.error('Error duplicating hub:', error);
    res.status(500).json({
      error: 'Failed to duplicate hub',
      details: error.message
    });
  }
});

// Get hub capacity summary
app.get('/api/sprint8/logistics/hubs/management/:hubId/capacity', async (req, res) => {
  try {
    const { hubId } = req.params;
    const capacity = await HubManagementAPI.getHubCapacitySummary(hubId);
    
    res.json({
      success: true,
      capacity: capacity
    });
  } catch (error) {
    console.error('Error fetching hub capacity:', error);
    res.status(500).json({
      error: 'Failed to fetch hub capacity',
      details: error.message
    });
  }
});

// Get hub inventory summary
app.get('/api/sprint8/logistics/hubs/management/:hubId/inventory', async (req, res) => {
  try {
    const { hubId } = req.params;
    const inventory = await HubManagementAPI.getHubInventorySummary(hubId);
    
    res.json({
      success: true,
      inventory: inventory
    });
  } catch (error) {
    console.error('Error fetching hub inventory:', error);
    res.status(500).json({
      error: 'Failed to fetch hub inventory',
      details: error.message
    });
  }
});

// Register hub management routes
app.use('/api/hubs', hubRoutes);