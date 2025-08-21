const express = require('express');
const router = express.Router();
const inventoryAPI = require('../lib/sprint8/inventoryAPI');

/**
 * Tag Inventory Management Routes
 * Real backend routes connected to PostgreSQL database
 */

// ====================
// HUB DASHBOARD ROUTES
// ====================

/**
 * GET /api/inventory/hubs/dashboard
 * Get inventory dashboard for all hubs
 */
router.get('/hubs/dashboard', async (req, res) => {
  try {
    const result = await inventoryAPI.getHubInventoryDashboard();
    res.json(result);
  } catch (error) {
    console.error('Error in hub dashboard route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hub inventory dashboard',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/hubs/:hubId
 * Get detailed inventory for a specific hub
 */
router.get('/hubs/:hubId', async (req, res) => {
  try {
    const { hubId } = req.params;
    const filters = {
      status: req.query.status,
      lot: req.query.lot,
      searchQuery: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const result = await inventoryAPI.getHubInventoryDetail(hubId, filters);
    res.json(result);
  } catch (error) {
    console.error('Error in hub detail route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hub inventory detail',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/lots
 * Get available lots for filtering (optionally by hub)
 */
router.get('/lots', async (req, res) => {
  try {
    const { hubId } = req.query;
    const result = await inventoryAPI.getAvailableLots(hubId);
    res.json(result);
  } catch (error) {
    console.error('Error in lots route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available lots',
      message: error.message
    });
  }
});

// ====================
// TAG OPERATION ROUTES
// ====================

/**
 * POST /api/inventory/tags/:tagId/assign
 * Assign tag to shipment
 */
router.post('/tags/:tagId/assign', async (req, res) => {
  try {
    const { tagId } = req.params;
    const { shipmentId, hubId } = req.body;
    const actorId = req.headers['x-user-id'] || req.ip;

    if (!shipmentId || !hubId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: shipmentId and hubId'
      });
    }

    const result = await inventoryAPI.assignTagToShipment(tagId, shipmentId, hubId, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in tag assignment route:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to assign tag to shipment',
      message: error.message
    });
  }
});

/**
 * POST /api/inventory/tags/:tagId/apply
 * Apply tag (mark as applied during hub processing)
 */
router.post('/tags/:tagId/apply', async (req, res) => {
  try {
    const { tagId } = req.params;
    const { hubId } = req.body;
    const actorId = req.headers['x-user-id'] || req.ip;

    if (!hubId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: hubId'
      });
    }

    const result = await inventoryAPI.applyTag(tagId, hubId, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in tag application route:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to apply tag',
      message: error.message
    });
  }
});

/**
 * POST /api/inventory/tags/:tagId/rma
 * Mark tag as RMA (defective)
 */
router.post('/tags/:tagId/rma', async (req, res) => {
  try {
    const { tagId } = req.params;
    const { reason } = req.body;
    const actorId = req.headers['x-user-id'] || req.ip;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: reason'
      });
    }

    const result = await inventoryAPI.markTagRMA(tagId, reason, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in RMA route:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to mark tag as RMA',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/tags/:tagId/history
 * Get tag movement history
 */
router.get('/tags/:tagId/history', async (req, res) => {
  try {
    const { tagId } = req.params;
    const result = await inventoryAPI.getTagHistory(tagId);
    res.json(result);
  } catch (error) {
    console.error('Error in tag history route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tag history',
      message: error.message
    });
  }
});

// ====================
// STOCK VALIDATION ROUTES
// ====================

/**
 * GET /api/inventory/hubs/:hubId/validate-stock
 * Validate hub stock for Tier Gate integration
 */
router.get('/hubs/:hubId/validate-stock', async (req, res) => {
  try {
    const { hubId } = req.params;
    const requiredQuantity = parseInt(req.query.quantity) || 1;

    const result = await inventoryAPI.validateHubStock(hubId, requiredQuantity);
    res.json(result);
  } catch (error) {
    console.error('Error in stock validation route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate hub stock',
      message: error.message
    });
  }
});

// ====================
// BATCH OPERATION ROUTES
// ====================

/**
 * POST /api/inventory/hubs/:hubId/receive-batch
 * Receive new tags batch into hub inventory
 */
router.post('/hubs/:hubId/receive-batch', async (req, res) => {
  try {
    const { hubId } = req.params;
    const batchData = req.body;
    const actorId = req.headers['x-user-id'] || req.ip;

    // Validate required fields
    if (!batchData.lot || !batchData.quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: lot and quantity'
      });
    }

    const result = await inventoryAPI.receiveBatch(hubId, batchData, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in receive batch route:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to receive batch',
      message: error.message
    });
  }
});

// ====================
// TELEMETRY AND MONITORING ROUTES
// ====================

/**
 * GET /api/inventory/telemetry/events
 * Get recent telemetry events for monitoring
 */
router.get('/telemetry/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const eventType = req.query.eventType;

    let query = `
      SELECT * FROM hub_telemetry_events
      WHERE event_type LIKE 'inventory.%'
    `;
    
    const queryParams = [];
    let paramCounter = 1;

    if (eventType) {
      query += ` AND event_type = $${paramCounter}`;
      queryParams.push(eventType);
      paramCounter++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCounter}`;
    queryParams.push(limit);

    const db = require('../lib/database');
    const result = await db.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in telemetry route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch telemetry events',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const db = require('../lib/database');
    const result = await db.query('SELECT COUNT(*) as tag_count FROM inventory_tags');
    
    res.json({
      success: true,
      status: 'healthy',
      tagCount: parseInt(result.rows[0].tag_count),
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

