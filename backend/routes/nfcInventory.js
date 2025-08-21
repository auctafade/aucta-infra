const express = require('express');
const router = express.Router();
const nfcInventoryAPI = require('../lib/sprint8/nfcInventoryAPI');

// Middleware for error handling
const handleAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ====================
// HUB OVERVIEW ROUTES
// ====================

/**
 * GET /api/nfc-inventory/hub-overview
 * Get NFC inventory overview for all hubs
 */
router.get('/hub-overview', handleAsync(async (req, res) => {
  try {
    const result = await nfcInventoryAPI.getNFCHubOverview();
    res.json(result);
  } catch (error) {
    console.error('Error in hub overview:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ====================
// HUB DETAIL ROUTES
// ====================

/**
 * GET /api/nfc-inventory/hub/:hubId/detail
 * Get detailed NFC inventory for specific hub
 */
router.get('/hub/:hubId/detail', handleAsync(async (req, res) => {
  try {
    const { hubId } = req.params;
    const filters = {
      status: req.query.status || 'all',
      lot: req.query.lot || 'all',
      searchQuery: req.query.search || '',
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const result = await nfcInventoryAPI.getNFCHubDetail(parseInt(hubId), filters);
    res.json(result);
  } catch (error) {
    console.error('Error in hub detail:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/nfc-inventory/hub/:hubId/lots
 * Get available lots for specific hub
 */
router.get('/hub/:hubId/lots', handleAsync(async (req, res) => {
  try {
    const { hubId } = req.params;
    const result = await nfcInventoryAPI.getNFCAvailableLots(parseInt(hubId));
    res.json(result);
  } catch (error) {
    console.error('Error fetching lots:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/nfc-inventory/lots
 * Get all available lots across all hubs
 */
router.get('/lots', handleAsync(async (req, res) => {
  try {
    const result = await nfcInventoryAPI.getNFCAvailableLots();
    res.json(result);
  } catch (error) {
    console.error('Error fetching all lots:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ====================
// NFC OPERATIONS ROUTES
// ====================

/**
 * POST /api/nfc-inventory/reserve
 * Reserve NFC for Tier 3 shipment
 */
router.post('/reserve', handleAsync(async (req, res) => {
  try {
    const { nfcUid, shipmentId, hubId } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!nfcUid || !shipmentId || !hubId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nfcUid, shipmentId, hubId',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.reserveNFCForShipment(nfcUid, shipmentId, hubId, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error reserving NFC:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/install
 * Mark NFC as installed after sewing + tests
 */
router.post('/install', handleAsync(async (req, res) => {
  try {
    const { nfcUid, hubId, testResults = {} } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!nfcUid || !hubId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nfcUid, hubId',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.installNFC(nfcUid, hubId, testResults, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error installing NFC:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/quarantine-lot
 * Quarantine NFC lot due to quality issues
 */
router.post('/quarantine-lot', handleAsync(async (req, res) => {
  try {
    const { lotId, reason, affectedUIDs = [] } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!lotId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: lotId, reason',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.quarantineNFCLot(lotId, reason, affectedUIDs, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error quarantining lot:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/rma
 * Process RMA for defective NFC
 */
router.post('/rma', handleAsync(async (req, res) => {
  try {
    const { nfcUid, rmaReason, rmaReference } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!nfcUid || !rmaReason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nfcUid, rmaReason',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.processNFCRMA(nfcUid, rmaReason, rmaReference, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error processing RMA:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ====================
// STOCK VALIDATION ROUTES
// ====================

/**
 * GET /api/nfc-inventory/validate-stock/:hubId
 * Validate NFC stock for Tier Gate integration
 */
router.get('/validate-stock/:hubId', handleAsync(async (req, res) => {
  try {
    const { hubId } = req.params;
    const requiredQuantity = parseInt(req.query.quantity) || 1;

    const result = await nfcInventoryAPI.validateNFCStock(parseInt(hubId), requiredQuantity);
    res.json(result);
  } catch (error) {
    console.error('Error validating stock:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ====================
// TRANSFER ROUTES
// ====================

/**
 * POST /api/nfc-inventory/create-transfer
 * Create NFC transfer between hubs
 */
router.post('/create-transfer', handleAsync(async (req, res) => {
  try {
    const { fromHubId, toHubId, nfcUIDs, transferReason, urgency = 'normal' } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!fromHubId || !toHubId || !nfcUIDs || !Array.isArray(nfcUIDs) || nfcUIDs.length === 0 || !transferReason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromHubId, toHubId, nfcUIDs (array), transferReason',
        timestamp: new Date().toISOString()
      });
    }

    if (fromHubId === toHubId) {
      return res.status(400).json({
        success: false,
        error: 'Source and destination hubs cannot be the same',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.createNFCTransfer(
      fromHubId, 
      toHubId, 
      nfcUIDs, 
      transferReason, 
      urgency, 
      actorId
    );
    res.json(result);
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ====================
// METRICS AND ANALYTICS
// ====================

/**
 * GET /api/nfc-inventory/metrics/summary
 * Get overall NFC inventory metrics
 */
router.get('/metrics/summary', handleAsync(async (req, res) => {
  try {
    const hubOverview = await nfcInventoryAPI.getNFCHubOverview();
    
    if (!hubOverview.success) {
      return res.status(500).json(hubOverview);
    }

    const hubs = hubOverview.data;
    
    const summary = {
      totalHubs: hubs.length,
      criticalHubs: hubs.filter(h => h.statusColor === 'red').length,
      warningHubs: hubs.filter(h => h.statusColor === 'amber').length,
      healthyHubs: hubs.filter(h => h.statusColor === 'green').length,
      
      totalStock: hubs.reduce((sum, h) => sum + h.status.stock, 0),
      totalReserved: hubs.reduce((sum, h) => sum + h.status.reserved, 0),
      totalInstalled: hubs.reduce((sum, h) => sum + h.status.installed, 0),
      totalRMA: hubs.reduce((sum, h) => sum + h.status.rma, 0),
      totalQuarantined: hubs.reduce((sum, h) => sum + h.status.quarantined, 0),
      
      avgBurnRate7d: hubs.length > 0 ? 
        (hubs.reduce((sum, h) => sum + h.burnRate7d, 0) / hubs.length).toFixed(1) : 0,
      
      lowestDaysOfCover: Math.min(...hubs.map(h => 
        h.daysOfCover === 'infinite' ? 999 : h.daysOfCover
      )),
      
      totalQuarantinedLots: hubs.reduce((sum, h) => sum + h.lotHealth.quarantinedLots, 0),
      totalHighFailureLots: hubs.reduce((sum, h) => sum + h.lotHealth.highFailureLots, 0),
      
      upcomingDemand7d: hubs.reduce((sum, h) => sum + h.upcomingDemand7d, 0),
      upcomingDemand14d: hubs.reduce((sum, h) => sum + h.upcomingDemand14d, 0)
    };

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching summary metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// ====================
// ENHANCED STATE TRANSITION ROUTES
// ====================

/**
 * POST /api/nfc-inventory/receive-batch-enhanced
 * Receive batch of NFCs with event emission and audit logging
 */
router.post('/receive-batch-enhanced', handleAsync(async (req, res) => {
  try {
    const { hubId, lot, quantity, supplierRef, uids, evidenceFiles } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';
    
    if (!hubId || !lot || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hubId, lot, quantity',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.receiveNFCBatchEnhanced(
      hubId,
      { lot, quantity, supplierRef, uids, evidenceFiles },
      actorId
    );

    res.json(result);
  } catch (error) {
    console.error('Error in receive-batch-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/assign-enhanced
 * Assign NFC to shipment with enhanced validation and events
 */
router.post('/assign-enhanced', handleAsync(async (req, res) => {
  try {
    const { nfcUid, shipmentId, hubId } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!nfcUid || !shipmentId || !hubId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nfcUid, shipmentId, hubId',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.assignNFCtoShipmentEnhanced(nfcUid, shipmentId, hubId, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in assign-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/install-enhanced
 * Install NFC with enhanced state tracking and evidence linking
 */
router.post('/install-enhanced', handleAsync(async (req, res) => {
  try {
    const { nfcUid, hubId, testResults = {}, evidenceFiles = [] } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!nfcUid || !hubId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nfcUid, hubId',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.installNFCEnhanced(nfcUid, hubId, testResults, evidenceFiles, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in install-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/rma-enhanced
 * Mark NFC as RMA with enhanced tracking and replacement support
 */
router.post('/rma-enhanced', handleAsync(async (req, res) => {
  try {
    const { nfcUid, reasonCode, notes, replacementUid, evidenceFiles = [] } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!nfcUid || !reasonCode || !notes) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: nfcUid, reasonCode, notes',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.markNFCasRMAEnhanced(nfcUid, reasonCode, notes, replacementUid, evidenceFiles, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in rma-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/quarantine-enhanced
 * Quarantine lot with enhanced event emission and audit trail
 */
router.post('/quarantine-enhanced', handleAsync(async (req, res) => {
  try {
    const { lotId, hubId, reason } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!lotId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: lotId, reason',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.quarantineLotEnhanced(lotId, hubId, reason, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in quarantine-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/lift-quarantine-enhanced
 * Lift quarantine with enhanced tracking
 */
router.post('/lift-quarantine-enhanced', handleAsync(async (req, res) => {
  try {
    const { lotId, hubId, reason } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!lotId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: lotId, reason',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.liftQuarantineEnhanced(lotId, hubId, reason, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in lift-quarantine-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/transfer-enhanced
 * Transfer NFCs with enhanced state tracking
 */
router.post('/transfer-enhanced', handleAsync(async (req, res) => {
  try {
    const { fromHubId, toHubId, uids, quantity, reason, eta } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!fromHubId || !toHubId || !reason || !eta) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromHubId, toHubId, reason, eta',
        timestamp: new Date().toISOString()
      });
    }

    if ((!uids || uids.length === 0) && !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Must specify either specific UIDs or quantity to transfer',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.transferNFCsEnhanced(fromHubId, toHubId, uids, quantity, reason, eta, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in transfer-enhanced route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/nfc-inventory/transfer-complete
 * Complete NFC transfer arrival with state updates
 */
router.post('/transfer-complete', handleAsync(async (req, res) => {
  try {
    const { transferId, toHubId, arrivedUIDs } = req.body;
    const actorId = req.user?.id || req.body.actorId || 'api-user';

    if (!transferId || !toHubId || !arrivedUIDs || !Array.isArray(arrivedUIDs)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transferId, toHubId, arrivedUIDs (array)',
        timestamp: new Date().toISOString()
      });
    }

    const result = await nfcInventoryAPI.completeNFCTransferEnhanced(transferId, toHubId, arrivedUIDs, actorId);
    res.json(result);
  } catch (error) {
    console.error('Error in transfer-complete route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('NFC Inventory API Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
