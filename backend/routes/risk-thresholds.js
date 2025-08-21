const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const riskThresholdManager = require('../lib/sprint8/risk-thresholds');

// Middleware for admin access
const adminMiddleware = async (req, res, next) => {
  const userRole = req.headers['x-user-role'] || 'user';
  if (!['ops_admin', 'admin', 'super_admin'].includes(userRole)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.userRole = userRole;
  req.userId = req.headers['x-user-id'] || 'unknown';
  next();
};

// ==========================================
// RISK POLICY CRUD OPERATIONS
// ==========================================

// Get all risk policies with optional filtering
router.get('/policies', adminMiddleware, async (req, res) => {
  try {
    const result = await riskThresholdManager.getAllRiskPolicies(req.query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching risk policies:', error);
    res.status(500).json({ error: 'Failed to fetch risk policies' });
  }
});

// Get specific risk policy by ID
router.get('/policies/:policyId', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const policy = await riskThresholdManager.getRiskPolicyFull(policyId);
    res.json({ policy });
  } catch (error) {
    console.error('Error fetching risk policy:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: 'Risk policy not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch risk policy' });
    }
  }
});

// Get current active risk policy (cached for performance)
router.get('/policies/active/current', async (req, res) => {
  try {
    const policy = await riskThresholdManager.getActiveRiskPolicy();
    res.json({ policy });
  } catch (error) {
    console.error('Error fetching active risk policy:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: 'No active risk policy found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch active risk policy' });
    }
  }
});

// Save risk policy (create or update draft)
router.post('/policies', adminMiddleware, async (req, res) => {
  try {
    const result = await riskThresholdManager.saveRiskPolicy(
      req.body, 
      req.userId, 
      req.userRole
    );
    
    res.json({
      message: 'Risk policy saved successfully',
      ...result
    });
  } catch (error) {
    console.error('Error saving risk policy:', error);
    res.status(500).json({ error: error.message || 'Failed to save risk policy' });
  }
});

// Publish risk policy
router.post('/policies/:policyId/publish', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const result = await riskThresholdManager.publishRiskPolicy(
      policyId,
      req.body,
      req.userId,
      req.userRole
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error publishing risk policy:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: 'Risk policy not found' });
    } else if (error.message.includes('requires approval')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to publish risk policy' });
    }
  }
});

// ==========================================
// RISK POLICY SIMULATION
// ==========================================

// Run risk policy simulation
router.post('/policies/:policyId/simulate', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const result = await riskThresholdManager.runRiskSimulation(
      policyId,
      req.body,
      req.userId
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error running risk simulation:', error);
    res.status(500).json({ error: 'Failed to run risk simulation' });
  }
});

// Get simulation results
router.get('/simulations/:simulationId', adminMiddleware, async (req, res) => {
  try {
    const { simulationId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        simulation_id, policy_id, simulated_by, simulated_at,
        routes_flipped, new_warnings, new_blocks, total_routes,
        new_inventory_alerts, new_customs_alerts, new_incident_rules_count,
        total_alerts_change, conflicts_found, estimated_impact,
        simulation_results, simulation_duration_ms
      FROM risk_policy_simulations 
      WHERE simulation_id = $1
    `, [simulationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Simulation not found' });
    }
    
    res.json({ simulation: result.rows[0] });
  } catch (error) {
    console.error('Error fetching simulation:', error);
    res.status(500).json({ error: 'Failed to fetch simulation' });
  }
});

// ==========================================
// RISK POLICY HISTORY AND AUDIT
// ==========================================

// Get risk policy version history
router.get('/policies/:policyId/history', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const result = await riskThresholdManager.getRiskPolicyHistory(policyId, req.query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching risk policy history:', error);
    res.status(500).json({ error: 'Failed to fetch risk policy history' });
  }
});

// Get risk policy events (for analytics and debugging)
router.get('/policies/:policyId/events', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const { limit = 100, offset = 0, event_type } = req.query;
    
    let query = `
      SELECT 
        event_id, event_type, version, effective_at,
        actor_id, actor_role, event_data,
        reason, scheduled, processed, created_at
      FROM risk_policy_events 
      WHERE policy_id = $1
    `;
    
    const params = [policyId];
    let paramCount = 1;
    
    if (event_type) {
      query += ` AND event_type = $${++paramCount}`;
      params.push(event_type);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      policy_id: policyId,
      events: result.rows
    });
  } catch (error) {
    console.error('Error fetching risk policy events:', error);
    res.status(500).json({ error: 'Failed to fetch risk policy events' });
  }
});

// Rollback to previous version
router.post('/policies/:policyId/rollback', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { policyId } = req.params;
    const { target_version, change_reason } = req.body;
    
    if (!target_version || !change_reason) {
      return res.status(400).json({ error: 'Target version and change reason are required' });
    }
    
    // Get the target version from history
    const historyResult = await client.query(`
      SELECT policy_snapshot FROM risk_policy_version_history 
      WHERE policy_id = $1 AND version = $2
      ORDER BY changed_at DESC LIMIT 1
    `, [policyId, target_version]);
    
    if (historyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Target version not found in history' });
    }
    
    const snapshot = historyResult.rows[0].policy_snapshot;
    const newVersion = `${target_version}-rollback-${Date.now()}`;
    
    // Create new draft policy from snapshot
    const result = await client.query(`
      UPDATE risk_threshold_policies 
      SET 
        version = $2,
        state = 'draft',
        value_bands = $3,
        fragility_rules = $4,
        brand_overrides = $5,
        lane_risks = $6,
        inventory_thresholds = $7,
        risk_weights = $8,
        risk_components = $9,
        security_defaults = $10,
        incident_rules = $11,
        publishing_scope = $12,
        change_reason = $13,
        last_edited_by = $14,
        last_edited_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE policy_id = $1
      RETURNING *
    `, [
      policyId, newVersion,
      JSON.stringify(snapshot.value_bands),
      JSON.stringify(snapshot.fragility_rules),
      JSON.stringify(snapshot.brand_overrides),
      JSON.stringify(snapshot.lane_risks),
      JSON.stringify(snapshot.inventory_thresholds),
      JSON.stringify(snapshot.risk_weights),
      JSON.stringify(snapshot.risk_components),
      JSON.stringify(snapshot.security_defaults),
      JSON.stringify(snapshot.incident_rules),
      JSON.stringify(snapshot.publishing_scope),
      change_reason,
      req.userId
    ]);
    
    // Emit rollback event
    await riskThresholdManager.emitRiskEvent(
      'settings.policy.rolled_back',
      policyId, newVersion, req.userId,
      { 
        from_version: target_version,
        to_version: newVersion,
        action: 'rollback'
      },
      change_reason,
      client
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Policy rolled back successfully',
      policy: result.rows[0],
      rolled_back_from: target_version,
      new_version: newVersion
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rolling back risk policy:', error);
    res.status(500).json({ error: 'Failed to rollback risk policy' });
  } finally {
    client.release();
  }
});

// ==========================================
// RISK ASSESSMENT ENDPOINTS
// ==========================================

// Get tier recommendation for a shipment value
router.post('/assess/tier', async (req, res) => {
  try {
    const { declared_value, brand, marketplace } = req.body;
    
    if (declared_value === undefined) {
      return res.status(400).json({ error: 'declared_value is required' });
    }
    
    const policyCache = await riskThresholdManager.getActiveRiskPolicy();
    const recommendation = riskThresholdManager.getTierRecommendation(declared_value, policyCache);
    
    // Check brand overrides
    let brandOverride = null;
    if (brand && policyCache.brand_overrides) {
      brandOverride = policyCache.brand_overrides.find(override => 
        override.brand.toLowerCase() === brand.toLowerCase() &&
        (override.marketplace === 'All' || override.marketplace === marketplace)
      );
    }
    
    res.json({
      declared_value,
      brand,
      marketplace,
      recommended_tier: recommendation.tier,
      wg_recommended: recommendation.wgRecommended,
      brand_override: brandOverride ? brandOverride.minimumTier : null,
      final_recommendation: brandOverride ? brandOverride.minimumTier : recommendation.tier,
      policy_version: policyCache.version
    });
  } catch (error) {
    console.error('Error assessing tier recommendation:', error);
    res.status(500).json({ error: 'Failed to assess tier recommendation' });
  }
});

// Calculate risk score for a shipment
router.post('/assess/risk', async (req, res) => {
  try {
    const shipmentData = req.body;
    const policyCache = await riskThresholdManager.getActiveRiskPolicy();
    
    const riskScore = riskThresholdManager.calculateRiskScore(shipmentData, policyCache);
    
    res.json({
      shipment_data: shipmentData,
      risk_assessment: riskScore,
      policy_version: policyCache.version,
      assessed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error calculating risk score:', error);
    res.status(500).json({ error: 'Failed to calculate risk score' });
  }
});

// Validate shipment against inventory thresholds
router.post('/validate/inventory', async (req, res) => {
  try {
    const { hub_id, tag_inventory, nfc_inventory } = req.body;
    const policyCache = await riskThresholdManager.getActiveRiskPolicy();
    
    const violations = [];
    const warnings = [];
    
    // Check tag inventory
    if (tag_inventory) {
      if (tag_inventory.current_stock < policyCache.inventory_thresholds.tags.lowStockQty) {
        violations.push({
          type: 'low_stock',
          category: 'tags',
          message: `Tag stock (${tag_inventory.current_stock}) below threshold (${policyCache.inventory_thresholds.tags.lowStockQty})`,
          severity: 'error'
        });
      }
      
      const daysOfCover = tag_inventory.current_stock / (tag_inventory.weekly_burn_rate / 7);
      if (daysOfCover < policyCache.inventory_thresholds.tags.minDaysOfCover) {
        warnings.push({
          type: 'low_days_cover',
          category: 'tags',
          message: `Tag days of cover (${daysOfCover.toFixed(1)}) below minimum (${policyCache.inventory_thresholds.tags.minDaysOfCover})`,
          severity: 'warning'
        });
      }
    }
    
    // Check NFC inventory
    if (nfc_inventory) {
      if (nfc_inventory.current_stock < policyCache.inventory_thresholds.nfc.lowStockQty) {
        violations.push({
          type: 'low_stock',
          category: 'nfc',
          message: `NFC stock (${nfc_inventory.current_stock}) below threshold (${policyCache.inventory_thresholds.nfc.lowStockQty})`,
          severity: 'error'
        });
      }
      
      if (nfc_inventory.lot_failure_rate > policyCache.inventory_thresholds.nfc.lotFailureQuarantineThreshold) {
        violations.push({
          type: 'lot_failure',
          category: 'nfc',
          message: `NFC lot failure rate (${nfc_inventory.lot_failure_rate}%) exceeds quarantine threshold (${policyCache.inventory_thresholds.nfc.lotFailureQuarantineThreshold}%)`,
          severity: 'error',
          action_required: 'quarantine_lot'
        });
      }
    }
    
    res.json({
      hub_id,
      valid: violations.length === 0,
      violations,
      warnings,
      policy_version: policyCache.version,
      validated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating inventory:', error);
    res.status(500).json({ error: 'Failed to validate inventory' });
  }
});

// ==========================================
// CACHE MANAGEMENT
// ==========================================

// Refresh risk policy cache
router.post('/cache/refresh', adminMiddleware, async (req, res) => {
  try {
    const { policy_id = 'risk-policy-001' } = req.body;
    
    await riskThresholdManager.refreshRiskCache(policy_id);
    
    res.json({
      message: 'Risk policy cache refreshed successfully',
      policy_id,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing risk policy cache:', error);
    res.status(500).json({ error: 'Failed to refresh risk policy cache' });
  }
});

// Get telemetry data for risk policies
router.get('/telemetry', adminMiddleware, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get simulation statistics
    const simulationsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_simulations,
        AVG(simulation_duration_ms) as avg_duration_ms,
        AVG(routes_flipped) as avg_routes_flipped,
        AVG(new_warnings) as avg_new_warnings,
        AVG(new_blocks) as avg_new_blocks
      FROM risk_policy_simulations 
      WHERE simulated_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `);
    
    // Get policy change frequency
    const changesResult = await pool.query(`
      SELECT 
        COUNT(*) as total_changes,
        COUNT(DISTINCT changed_by) as unique_editors
      FROM risk_policy_version_history 
      WHERE changed_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `);
    
    // Get conflict statistics
    const conflictsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_conflicts,
        COUNT(CASE WHEN severity = 'error' THEN 1 END) as error_conflicts,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_conflicts,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_conflicts
      FROM risk_policy_conflicts 
      WHERE detected_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `);
    
    res.json({
      period_days: parseInt(days),
      simulations: simulationsResult.rows[0],
      policy_changes: changesResult.rows[0],
      conflicts: conflictsResult.rows[0],
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching risk policy telemetry:', error);
    res.status(500).json({ error: 'Failed to fetch telemetry data' });
  }
});

module.exports = router;
