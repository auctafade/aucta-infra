const express = require('express');
const router = express.Router();
const hubConsoleAPI = require('../lib/sprint8/hubConsoleAPI');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

// Configure multer for evidence file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/evidence');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `evidence-${timestamp}-${randomString}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// ====================
// JOB MANAGEMENT ROUTES
// ====================

/**
 * GET /api/hub-console/jobs
 * Get all jobs for a hub with filtering
 */
router.get('/jobs', async (req, res) => {
  try {
    const { hubId, tier, status, priority, when, search } = req.query;

    if (!hubId) {
      return res.status(400).json({ error: 'hubId is required' });
    }

    const filters = {
      tier,
      status,
      priority,
      when,
      search
    };

    const jobs = await hubConsoleAPI.getHubJobs(hubId, filters);
    
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error fetching hub jobs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch hub jobs',
      details: error.message 
    });
  }
});

/**
 * GET /api/hub-console/jobs/:shipmentId
 * Get detailed job information
 */
router.get('/jobs/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const job = await hubConsoleAPI.getJobDetails(shipmentId);
    
    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to fetch job details',
      details: error.message
    });
  }
});

/**
 * POST /api/hub-console/jobs
 * Create a new hub processing job
 */
router.post('/jobs', async (req, res) => {
  try {
    const jobData = req.body;
    
    // Validate required fields
    const required = ['shipmentId', 'hubId', 'tier', 'plannedIntakeTime', 'slaDeadline'];
    for (const field of required) {
      if (!jobData[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    const job = await hubConsoleAPI.createHubJob(jobData);
    
    // Reserve inventory
    if (job.tier === 2 || job.tier === 3) {
      try {
        const reservation = await hubConsoleAPI.reserveInventory(
          job.shipment_id, 
          job.hub_id, 
          job.tier
        );
        job.reservedInventory = reservation;
      } catch (reservationError) {
        console.warn('Warning: Could not reserve inventory:', reservationError.message);
      }
    }

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error creating hub job:', error);
    res.status(500).json({
      error: 'Failed to create hub job',
      details: error.message
    });
  }
});

/**
 * PUT /api/hub-console/jobs/:shipmentId/status
 * Update job status and timeline
 */
router.put('/jobs/:shipmentId/status', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { status, updateData } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const job = await hubConsoleAPI.updateJobStatus(shipmentId, status, updateData);
    
    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({
      error: 'Failed to update job status',
      details: error.message
    });
  }
});

// ====================
// INVENTORY MANAGEMENT ROUTES
// ====================

/**
 * GET /api/hub-console/inventory/:hubId
 * Get available inventory for a hub
 */
router.get('/inventory/:hubId', async (req, res) => {
  try {
    const { hubId } = req.params;
    const { type = 'both' } = req.query;

    const inventory = await hubConsoleAPI.getAvailableInventory(hubId, type);
    
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({
      error: 'Failed to fetch inventory',
      details: error.message
    });
  }
});

/**
 * POST /api/hub-console/inventory/reserve
 * Reserve inventory for a job
 */
router.post('/inventory/reserve', async (req, res) => {
  try {
    const { shipmentId, hubId, tier } = req.body;

    if (!shipmentId || !hubId || !tier) {
      return res.status(400).json({ 
        error: 'shipmentId, hubId, and tier are required' 
      });
    }

    const reservation = await hubConsoleAPI.reserveInventory(shipmentId, hubId, tier);
    
    res.json({
      success: true,
      data: reservation
    });
  } catch (error) {
    console.error('Error reserving inventory:', error);
    res.status(500).json({
      error: 'Failed to reserve inventory',
      details: error.message
    });
  }
});

/**
 * POST /api/hub-console/inventory/apply
 * Mark inventory as applied/installed
 */
router.post('/inventory/apply', async (req, res) => {
  try {
    const { shipmentId, itemId, itemType } = req.body;

    if (!shipmentId || !itemId || !itemType) {
      return res.status(400).json({ 
        error: 'shipmentId, itemId, and itemType are required' 
      });
    }

    const result = await hubConsoleAPI.applyInventory(shipmentId, itemId, itemType);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error applying inventory:', error);
    res.status(500).json({
      error: 'Failed to apply inventory',
      details: error.message
    });
  }
});

/**
 * POST /api/hub-console/inventory/swap
 * Swap inventory item for edge cases
 */
router.post('/inventory/swap', async (req, res) => {
  try {
    const { shipmentId, oldItemId, newItemId, itemType, reason, changedBy } = req.body;

    if (!shipmentId || !oldItemId || !newItemId || !itemType || !reason) {
      return res.status(400).json({ 
        error: 'shipmentId, oldItemId, newItemId, itemType, and reason are required' 
      });
    }

    const result = await hubConsoleAPI.swapInventory(
      shipmentId, oldItemId, newItemId, itemType, reason, changedBy || 'unknown'
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error swapping inventory:', error);
    res.status(500).json({
      error: 'Failed to swap inventory',
      details: error.message
    });
  }
});

// ====================
// EVIDENCE MANAGEMENT ROUTES
// ====================

/**
 * POST /api/hub-console/evidence/upload
 * Upload evidence files
 */
router.post('/evidence/upload', upload.array('files', 12), async (req, res) => {
  try {
    const { jobId, evidenceType, capturedBy } = req.body;

    if (!jobId || !evidenceType || !req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'jobId, evidenceType, and files are required' 
      });
    }

    const results = [];

    for (const file of req.files) {
      // Generate file hash
      const fileBuffer = await fs.readFile(file.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const fileData = {
        filename: file.filename,
        originalFilename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileHash,
        evidenceType,
        validated: true,
        capturedAt: new Date().toISOString(),
        capturedBy: capturedBy || 'unknown'
      };

      const evidenceFile = await hubConsoleAPI.storeEvidenceFile(jobId, fileData);
      results.push(evidenceFile);
    }

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error uploading evidence:', error);
    res.status(500).json({
      error: 'Failed to upload evidence',
      details: error.message
    });
  }
});

/**
 * GET /api/hub-console/evidence/:jobId
 * Get evidence files for a job
 */
router.get('/evidence/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { evidenceType } = req.query;

    const evidenceFiles = await hubConsoleAPI.getEvidenceFiles(jobId, evidenceType);
    
    res.json({
      success: true,
      data: evidenceFiles,
      count: evidenceFiles.length
    });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({
      error: 'Failed to fetch evidence',
      details: error.message
    });
  }
});

// ====================
// INCIDENT MANAGEMENT ROUTES
// ====================

/**
 * POST /api/hub-console/incidents
 * Create a new incident
 */
router.post('/incidents', async (req, res) => {
  try {
    const incidentData = req.body;

    // Generate incident ID if not provided
    if (!incidentData.incidentId) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      incidentData.incidentId = `INC-${dateStr}-${timeStr}`;
    }

    const incident = await hubConsoleAPI.createIncident(incidentData);
    
    res.status(201).json({
      success: true,
      data: incident
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({
      error: 'Failed to create incident',
      details: error.message
    });
  }
});

// ====================
// TELEMETRY ROUTES
// ====================

/**
 * POST /api/hub-console/telemetry
 * Track telemetry event
 */
router.post('/telemetry', async (req, res) => {
  try {
    const eventData = req.body;

    // Add IP and user agent
    eventData.ip_address = req.ip;
    eventData.user_agent = req.get('User-Agent');

    await hubConsoleAPI.trackTelemetry(eventData);
    
    res.json({
      success: true,
      message: 'Telemetry tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking telemetry:', error);
    // Don't fail the request for telemetry issues
    res.json({
      success: false,
      message: 'Telemetry tracking failed',
      details: error.message
    });
  }
});

// ====================
// UTILITY ROUTES
// ====================

/**
 * GET /api/hub-console/hubs
 * Get available hubs
 */
router.get('/hubs', async (req, res) => {
  try {
    const result = await hubConsoleAPI.db.query(`
      SELECT id, hub_code, hub_name, city, country, capacity_max, capacity_current
      FROM logistics_hubs 
      WHERE active = true
      ORDER BY hub_name
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    res.status(500).json({
      error: 'Failed to fetch hubs',
      details: error.message
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: 'Maximum file size is 10MB'
      });
    }
  }

  console.error('Hub Console API Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

module.exports = router;
