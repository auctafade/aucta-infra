// =========================================
// Sprint 8: Incident Management Routes
// RESTful API endpoints for incident operations
// =========================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const IncidentManagementAPI = require('../lib/sprint8/incidentManagementAPI');

// Configure multer for incident file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/incidents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const incidentId = req.body.incident_id || req.params.incident_id || 'unknown';
    cb(null, `${incidentId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// ===============================
// Incident CRUD Operations
// ===============================

/**
 * GET /api/sprint8/incidents
 * Get list of incidents with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      type: req.query.type ? req.query.type.split(',') : undefined,
      severity: req.query.severity ? req.query.severity.split(',') : undefined,
      status: req.query.status ? req.query.status.split(',') : undefined,
      owner_name: req.query.owner_name,
      shipment_id: req.query.shipment_id,
      search: req.query.search,
      sort_by: req.query.sort_by || 'priority',
      sort_order: req.query.sort_order || 'desc',
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await IncidentManagementAPI.getIncidents(filters);
    
    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in GET /incidents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_INCIDENTS_ERROR',
        message: 'Failed to fetch incidents'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sprint8/incidents/:incident_id
 * Get detailed incident information
 */
router.get('/:incident_id', async (req, res) => {
  try {
    const { incident_id } = req.params;
    const result = await IncidentManagementAPI.getIncidentById(incident_id);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INCIDENT_NOT_FOUND',
          message: result.error
        },
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in GET /incidents/:id:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_INCIDENT_ERROR',
        message: 'Failed to fetch incident details'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sprint8/incidents
 * Create a new incident
 */
router.post('/', async (req, res) => {
  try {
    const incidentData = {
      type: req.body.type,
      severity: req.body.severity,
      title: req.body.title,
      description: req.body.description,
      shipment_id: req.body.shipment_id,
      leg_id: req.body.leg_id,
      hub_id: req.body.hub_id,
      assignee: req.body.assignee,
      client_name: req.body.client_name,
      contact_name: req.body.contact_name,
      contact_email: req.body.contact_email,
      contact_phone: req.body.contact_phone,
      leg_display: req.body.leg_display,
      hub_name: req.body.hub_name,
      carrier: req.body.carrier,
      tracking_id: req.body.tracking_id,
      tags: req.body.tags || [],
      created_by: req.body.created_by || 'API User'
    };

    // Validate required fields
    const requiredFields = ['type', 'severity', 'title', 'description', 'shipment_id', 'client_name', 'contact_name'];
    const missingFields = requiredFields.filter(field => !incidentData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missingFields.join(', ')}`
        },
        timestamp: new Date().toISOString()
      });
    }

    const result = await IncidentManagementAPI.createIncident(incidentData);
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Incident created successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in POST /incidents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_INCIDENT_ERROR',
        message: 'Failed to create incident'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/sprint8/incidents/:incident_id
 * Update an existing incident
 */
router.put('/:incident_id', async (req, res) => {
  try {
    const { incident_id } = req.params;
    const updates = req.body;
    const actorName = req.body.actor_name || 'API User';

    const result = await IncidentManagementAPI.updateIncident(incident_id, updates, actorName);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_BLOCKED',
          message: result.error,
          conflicts: result.conflicts
        },
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: 'Incident updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in PUT /incidents/:id:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_INCIDENT_ERROR',
        message: 'Failed to update incident'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sprint8/incidents/:incident_id/resolve
 * Resolve an incident with validation
 */
router.post('/:incident_id/resolve', async (req, res) => {
  try {
    const { incident_id } = req.params;
    const resolutionData = {
      reason: req.body.reason,
      post_mortem: req.body.post_mortem,
      admin_override: req.body.admin_override || false,
      override_passport_hold: req.body.override_passport_hold || false,
      override_reason: req.body.override_reason
    };
    const actorName = req.body.actor_name || 'API User';

    // Validate required fields
    if (!resolutionData.reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Resolution reason is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const result = await IncidentManagementAPI.resolveIncident(incident_id, resolutionData, actorName);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESOLUTION_BLOCKED',
          message: result.error,
          validation_errors: result.validation_errors
        },
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      message: 'Incident resolved successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in POST /incidents/:id/resolve:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_INCIDENT_ERROR',
        message: 'Failed to resolve incident'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===============================
// Timeline and Communication
// ===============================

/**
 * POST /api/sprint8/incidents/:incident_id/timeline
 * Add entry to incident timeline
 */
router.post('/:incident_id/timeline', async (req, res) => {
  try {
    const { incident_id } = req.params;
    const entryData = {
      entry_type: req.body.entry_type || 'comment',
      user_name: req.body.user_name || 'API User',
      title: req.body.title,
      description: req.body.description,
      is_client_visible: req.body.is_client_visible || false,
      metadata: req.body.metadata || {}
    };

    if (!entryData.title || !entryData.description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and description are required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const result = await IncidentManagementAPI.addTimelineEntry(incident_id, entryData);
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Timeline entry added successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in POST /incidents/:id/timeline:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ADD_TIMELINE_ERROR',
        message: 'Failed to add timeline entry'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sprint8/incidents/:incident_id/communicate
 * Send client communication
 */
router.post('/:incident_id/communicate', async (req, res) => {
  try {
    const { incident_id } = req.params;
    const communicationData = {
      type: req.body.type || 'notification',
      channel: req.body.channel || 'email',
      template_id: req.body.template_id,
      subject: req.body.subject,
      content: req.body.content,
      sent_by: req.body.sent_by || 'API User'
    };

    if (!communicationData.subject || !communicationData.content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Subject and content are required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const result = await IncidentManagementAPI.sendClientCommunication(incident_id, communicationData);
    
    if (!result.success) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'COMMUNICATION_BLOCKED',
          message: result.error,
          reason: result.reason,
          cooldown_minutes: result.cooldown_minutes
        },
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Communication sent successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in POST /incidents/:id/communicate:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_COMMUNICATION_ERROR',
        message: 'Failed to send communication'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===============================
// File Management
// ===============================

/**
 * POST /api/sprint8/incidents/:incident_id/files
 * Upload files to incident
 */
router.post('/:incident_id/files', upload.single('file'), async (req, res) => {
  try {
    const { incident_id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_PROVIDED',
          message: 'No file provided'
        },
        timestamp: new Date().toISOString()
      });
    }

    const fileData = {
      filename: req.file.filename,
      original_filename: req.file.originalname,
      file_path: req.file.path,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      tags: req.body.tags ? req.body.tags.split(',') : [],
      uploaded_by: req.body.uploaded_by || 'API User'
    };

    // Save file record to database
    const pool = require('../database/connection');
    const result = await pool.query(`
      INSERT INTO incident_files (
        incident_id, filename, original_filename, file_path, 
        file_type, file_size, tags, uploaded_by
      ) VALUES (
        (SELECT id FROM incidents WHERE incident_id = $1),
        $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [
      incident_id, fileData.filename, fileData.original_filename,
      fileData.file_path, fileData.file_type, fileData.file_size,
      fileData.tags, fileData.uploaded_by
    ]);

    // Add timeline entry
    await IncidentManagementAPI.addTimelineEntry(incident_id, {
      entry_type: 'file_upload',
      user_name: fileData.uploaded_by,
      title: 'File attached',
      description: `Uploaded: ${fileData.original_filename} (${(fileData.file_size / 1024).toFixed(1)} KB)`,
      is_client_visible: false
    });
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'File uploaded successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in POST /incidents/:id/files:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: 'Failed to upload file'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sprint8/incidents/:incident_id/files/:file_id
 * Download incident file
 */
router.get('/:incident_id/files/:file_id', async (req, res) => {
  try {
    const { incident_id, file_id } = req.params;
    
    const pool = require('../database/connection');
    const result = await pool.query(`
      SELECT f.* 
      FROM incident_files f
      JOIN incidents i ON f.incident_id = i.id
      WHERE i.incident_id = $1 AND f.id = $2
    `, [incident_id, file_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    const file = result.rows[0];
    
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_EXISTS',
          message: 'File no longer exists on disk'
        },
        timestamp: new Date().toISOString()
      });
    }

    res.setHeader('Content-Type', file.file_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.sendFile(path.resolve(file.file_path));
    
  } catch (error) {
    console.error('Error in GET /incidents/:id/files/:file_id:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FILE_DOWNLOAD_ERROR',
        message: 'Failed to download file'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===============================
// Edge Case Management
// ===============================

/**
 * GET /api/sprint8/incidents/ownership-gaps
 * Check for incidents with ownership gaps requiring escalation
 */
router.get('/system/ownership-gaps', async (req, res) => {
  try {
    const result = await IncidentManagementAPI.checkOwnershipGaps();
    
    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in GET /ownership-gaps:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'OWNERSHIP_GAP_CHECK_ERROR',
        message: 'Failed to check ownership gaps'
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/sprint8/incidents/:incident_id/escalate
 * Auto-escalate incident due to ownership gap
 */
router.post('/:incident_id/escalate', async (req, res) => {
  try {
    const { incident_id } = req.params;
    const reason = req.body.reason || 'Auto-escalation due to ownership gap';

    const result = await IncidentManagementAPI.autoEscalateIncident(incident_id, reason);
    
    res.json({
      success: true,
      data: result.data,
      message: 'Incident escalated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in POST /incidents/:id/escalate:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ESCALATE_INCIDENT_ERROR',
        message: 'Failed to escalate incident'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ===============================
// Analytics and Reporting
// ===============================

/**
 * GET /api/sprint8/incidents/analytics
 * Get incident analytics and metrics
 */
router.get('/system/analytics', async (req, res) => {
  try {
    const timeRange = req.query.time_range || '7d';
    const result = await IncidentManagementAPI.getIncidentAnalytics(timeRange);
    
    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in GET /analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to fetch analytics'
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;


