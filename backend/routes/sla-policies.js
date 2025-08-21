const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const { authMiddleware } = require('../lib/auth');

// Middleware for admin access (you may need to adjust based on your auth system)
const adminMiddleware = async (req, res, next) => {
  // For now, we'll use basic auth check - replace with your RBAC system
  const userRole = req.headers['x-user-role'] || 'user';
  if (!['ops_admin', 'admin', 'super_admin'].includes(userRole)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.userRole = userRole;
  req.userId = req.headers['x-user-id'] || 'unknown';
  next();
};

// ==========================================
// POLICY CRUD OPERATIONS
// ==========================================

// Get all policies with optional filtering
router.get('/policies', adminMiddleware, async (req, res) => {
  try {
    const { state, version, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        id, policy_id, name, version, state, effective_date,
        sla_targets, margin_thresholds, change_reason,
        created_by, last_edited_by, last_edited_at,
        requires_approval, approved_by, approved_at,
        created_at, updated_at
      FROM sla_margin_policies 
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (state) {
      query += ` AND state = $${++paramCount}`;
      params.push(state);
    }
    
    if (version) {
      query += ` AND version = $${++paramCount}`;
      params.push(version);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM sla_margin_policies WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;
    
    if (state) {
      countQuery += ` AND state = $${++countParamCount}`;
      countParams.push(state);
    }
    
    if (version) {
      countQuery += ` AND version = $${++countParamCount}`;
      countParams.push(version);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      policies: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// Get specific policy by ID
router.get('/policies/:policyId', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id, policy_id, name, version, state, effective_date,
        sla_targets, margin_thresholds, change_reason,
        created_by, last_edited_by, last_edited_at,
        requires_approval, approved_by, approved_at,
        policy_metadata, created_at, updated_at
      FROM sla_margin_policies 
      WHERE policy_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [policyId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    res.json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

// Get current active policy (cached for performance)
router.get('/policies/active/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM active_policy_cache 
      WHERE policy_id = 'policy-001'
      ORDER BY last_updated DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active policy found' });
    }
    
    const cache = result.rows[0];
    
    // Convert cache back to structured format for API consistency
    const policy = {
      policy_id: cache.policy_id,
      version: cache.current_version,
      effective_since: cache.effective_since,
      sla_targets: {
        classification: { timeToClassify: cache.sla_classification_hours },
        pickups: {
          urbanWGMaxHours: cache.sla_urban_pickup_hours,
          interCityWGMaxHours: cache.sla_intercity_pickup_hours,
          windowConstraints: cache.pickup_window_constraints
        },
        hubProcessing: {
          tier2MaxHours: cache.sla_tier2_max_hours,
          tier3MaxHours: cache.sla_tier3_max_hours,
          tier3QABuffer: cache.sla_tier3_qa_buffer_hours
        },
        delivery: {
          wgFinalDeliveryMaxHours: cache.sla_wg_delivery_hours,
          dhlStandardDays: cache.sla_dhl_standard_days,
          dhlExpressDays: cache.sla_dhl_express_days
        },
        laneSpecifics: {
          euToEuMultiplier: cache.eu_to_eu_multiplier,
          ukToEuMultiplier: cache.uk_to_eu_multiplier,
          remoteAreaMultiplier: cache.remote_area_multiplier,
          weekendRule: cache.weekend_rule
        },
        riskManagement: {
          riskBufferHours: cache.sla_risk_buffer_hours,
          breachEscalationMinutes: cache.sla_breach_escalation_minutes
        }
      },
      margin_thresholds: {
        global: {
          minimumMargin: cache.margin_global_minimum,
          targetMargin: cache.margin_global_target
        },
        components: {
          wgComponent: cache.margin_wg_component,
          dhlComponent: cache.margin_dhl_component,
          hubFeeComponent: cache.margin_hub_fee,
          insuranceMarkup: cache.margin_insurance_markup,
          surchargesPolicy: cache.margin_surcharges
        },
        variance: {
          tolerancePercent: cache.margin_variance_tolerance
        },
        currency: {
          base: cache.margin_currency_base,
          includeVAT: cache.margin_include_vat
        }
      },
      cache_version: cache.cache_version,
      last_updated: cache.last_updated
    };
    
    res.json({ policy });
  } catch (error) {
    console.error('Error fetching active policy:', error);
    res.status(500).json({ error: 'Failed to fetch active policy' });
  }
});

// Create or update policy (save draft)
router.post('/policies', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      policy_id,
      name,
      version,
      sla_targets,
      margin_thresholds,
      change_reason,
      effective_date,
      state = 'draft'
    } = req.body;
    
    // Validation
    if (!policy_id || !name || !version || !sla_targets || !margin_thresholds || !change_reason) {
      return res.status(400).json({ 
        error: 'Missing required fields: policy_id, name, version, sla_targets, margin_thresholds, change_reason' 
      });
    }
    
    // Check if policy exists
    const existingPolicy = await client.query(
      'SELECT id FROM sla_margin_policies WHERE policy_id = $1',
      [policy_id]
    );
    
    let result;
    
    if (existingPolicy.rows.length > 0) {
      // Update existing policy
      result = await client.query(`
        UPDATE sla_margin_policies 
        SET 
          name = $2,
          version = $3,
          sla_targets = $4,
          margin_thresholds = $5,
          change_reason = $6,
          last_edited_by = $7,
          last_edited_at = CURRENT_TIMESTAMP,
          effective_date = $8,
          state = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE policy_id = $1
        RETURNING *
      `, [
        policy_id, name, version, JSON.stringify(sla_targets), 
        JSON.stringify(margin_thresholds), change_reason, req.userId,
        effective_date || new Date().toISOString(), state
      ]);
    } else {
      // Create new policy
      result = await client.query(`
        INSERT INTO sla_margin_policies (
          policy_id, name, version, sla_targets, margin_thresholds,
          change_reason, created_by, last_edited_by, effective_date, state
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        policy_id, name, version, JSON.stringify(sla_targets),
        JSON.stringify(margin_thresholds), change_reason, req.userId,
        req.userId, effective_date || new Date().toISOString(), state
      ]);
    }
    
    // Emit policy event
    await client.query(`
      INSERT INTO policy_events (
        event_id, event_type, policy_id, version, effective_at,
        actor_id, actor_role, event_data, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      sla_targets !== result.rows[0].sla_targets ? 'settings.sla.updated' : 'settings.margin.updated',
      policy_id, version, effective_date || new Date().toISOString(),
      req.userId, req.userRole,
      JSON.stringify({ action: 'save_draft', fields_changed: ['sla_targets', 'margin_thresholds'] }),
      change_reason
    ]);
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Policy saved successfully',
      policy: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving policy:', error);
    res.status(500).json({ error: 'Failed to save policy' });
  } finally {
    client.release();
  }
});

// Publish policy
router.post('/policies/:policyId/publish', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { policyId } = req.params;
    const { change_reason, scheduled_date } = req.body;
    
    if (!change_reason) {
      return res.status(400).json({ error: 'Change reason is required' });
    }
    
    // Get current policy
    const currentPolicy = await client.query(
      'SELECT * FROM sla_margin_policies WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1',
      [policyId]
    );
    
    if (currentPolicy.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    const policy = currentPolicy.rows[0];
    const effectiveDate = scheduled_date ? new Date(scheduled_date) : new Date();
    const newState = scheduled_date ? 'scheduled' : 'published';
    
    // Update policy state
    const result = await client.query(`
      UPDATE sla_margin_policies 
      SET 
        state = $2,
        effective_date = $3,
        change_reason = $4,
        last_edited_by = $5,
        last_edited_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE policy_id = $1
      RETURNING *
    `, [policyId, newState, effectiveDate.toISOString(), change_reason, req.userId]);
    
    // Emit publish event
    await client.query(`
      INSERT INTO policy_events (
        event_id, event_type, policy_id, version, effective_at,
        actor_id, actor_role, event_data, reason, scheduled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      'settings.policy.published',
      policyId, policy.version, effectiveDate.toISOString(),
      req.userId, req.userRole,
      JSON.stringify({ action: 'publish', state: newState }),
      change_reason, !!scheduled_date
    ]);
    
    // If publishing immediately, refresh cache
    if (!scheduled_date) {
      await client.query('SELECT refresh_active_policy_cache($1)', [policyId]);
      
      // Emit recompute event
      await client.query(`
        INSERT INTO policy_events (
          event_id, event_type, policy_id, version, effective_at,
          actor_id, event_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        'quote.recompute.requested',
        policyId, policy.version, effectiveDate.toISOString(),
        req.userId,
        JSON.stringify({ trigger: 'policy_published' })
      ]);
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: scheduled_date ? 'Policy scheduled for publication' : 'Policy published successfully',
      policy: result.rows[0],
      effective_date: effectiveDate.toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error publishing policy:', error);
    res.status(500).json({ error: 'Failed to publish policy' });
  } finally {
    client.release();
  }
});

// ==========================================
// POLICY SIMULATION
// ==========================================

// Run policy simulation
router.post('/policies/:policyId/simulate', adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const startTime = Date.now();
    const { policyId } = req.params;
    const { sla_targets, margin_thresholds, sample_shipments = [] } = req.body;
    
    // Get test shipments (either provided or default sample)
    let testShipments;
    if (sample_shipments.length > 0) {
      const shipmentIds = sample_shipments.map(id => `'${id}'`).join(',');
      testShipments = await client.query(`
        SELECT shipment_id, declared_value, tier, status 
        FROM shipments 
        WHERE shipment_id IN (${shipmentIds})
      `);
    } else {
      // Use default sample for testing
      testShipments = { rows: [
        { shipment_id: 'SH-2024-001', declared_value: 25000, tier: 'standard', status: 'planned' },
        { shipment_id: 'SH-2024-002', declared_value: 45000, tier: 'premium', status: 'planned' },
        { shipment_id: 'SH-2024-003', declared_value: 85000, tier: 'platinum', status: 'planned' }
      ]};
    }
    
    // Simulate route scoring with new policy
    const simulationResults = [];
    let atRiskCount = 0;
    let blockedCount = 0;
    let totalScoreChange = 0;
    
    for (const shipment of testShipments.rows) {
      // Mock simulation logic - in real implementation, this would use your route planning engine
      const currentScore = Math.floor(Math.random() * 20) + 75; // 75-95
      const newScore = Math.floor(Math.random() * 20) + 70; // 70-90
      const scoreDelta = newScore - currentScore;
      
      const guardrailHits = [];
      const slaAtRisk = Math.random() > 0.7; // 30% chance of SLA risk
      
      // Check margin guardrails
      if (margin_thresholds.global.minimumMargin > 12) {
        guardrailHits.push('Margin below target');
        blockedCount++;
      }
      
      if (slaAtRisk) atRiskCount++;
      
      simulationResults.push({
        shipmentId: shipment.shipment_id,
        lane: `${shipment.tier} tier shipment`,
        currentScore,
        newScore,
        scoreDelta,
        guardrailHits,
        slaAtRisk
      });
      
      totalScoreChange += scoreDelta;
    }
    
    const simulationDuration = Date.now() - startTime;
    const averageScoreChange = totalScoreChange / testShipments.rows.length;
    
    // Store simulation results
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    await client.query(`
      INSERT INTO policy_simulations (
        simulation_id, policy_id, simulated_by, simulation_type,
        target_sla_targets, target_margin_thresholds, sample_shipments,
        total_shipments_tested, shipments_at_risk, routes_blocked,
        average_score_change, simulation_results, simulation_duration_ms,
        routes_calculated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      simulationId, policyId, req.userId, 'policy_change',
      JSON.stringify(sla_targets), JSON.stringify(margin_thresholds),
      JSON.stringify(sample_shipments), testShipments.rows.length,
      atRiskCount, blockedCount, averageScoreChange.toFixed(2),
      JSON.stringify(simulationResults), simulationDuration,
      testShipments.rows.length
    ]);
    
    res.json({
      simulation_id: simulationId,
      summary: {
        total_shipments_tested: testShipments.rows.length,
        shipments_at_risk: atRiskCount,
        routes_blocked: blockedCount,
        average_score_change: averageScoreChange.toFixed(2),
        simulation_duration_ms: simulationDuration
      },
      results: simulationResults
    });
  } catch (error) {
    console.error('Error running simulation:', error);
    res.status(500).json({ error: 'Failed to run simulation' });
  } finally {
    client.release();
  }
});

// ==========================================
// POLICY HISTORY AND AUDIT
// ==========================================

// Get policy version history
router.get('/policies/:policyId/history', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        version, change_type, change_reason, changed_by, changed_at,
        fields_changed, old_values, new_values,
        approval_request_id, approved_by, approved_at
      FROM policy_version_history 
      WHERE policy_id = $1
      ORDER BY changed_at DESC
      LIMIT $2 OFFSET $3
    `, [policyId, parseInt(limit), parseInt(offset)]);
    
    res.json({
      policy_id: policyId,
      history: result.rows
    });
  } catch (error) {
    console.error('Error fetching policy history:', error);
    res.status(500).json({ error: 'Failed to fetch policy history' });
  }
});

// Get policy events (for analytics and debugging)
router.get('/policies/:policyId/events', adminMiddleware, async (req, res) => {
  try {
    const { policyId } = req.params;
    const { limit = 100, offset = 0, event_type } = req.query;
    
    let query = `
      SELECT 
        event_id, event_type, version, effective_at,
        actor_id, actor_role, approver_id, event_data,
        reason, scheduled, processed, created_at
      FROM policy_events 
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
    console.error('Error fetching policy events:', error);
    res.status(500).json({ error: 'Failed to fetch policy events' });
  }
});

// ==========================================
// SYSTEM INTEGRATION ENDPOINTS
// ==========================================

// Validate shipment against current SLA policy
router.post('/validate/sla', async (req, res) => {
  try {
    const { shipment_id, estimated_timeline, tier } = req.body;
    
    // Get active policy
    const policy = await pool.query(`
      SELECT 
        sla_tier2_max_hours, sla_tier3_max_hours, sla_tier3_qa_buffer_hours,
        sla_wg_delivery_hours, sla_risk_buffer_hours
      FROM active_policy_cache 
      WHERE policy_id = 'policy-001'
    `);
    
    if (policy.rows.length === 0) {
      return res.status(500).json({ error: 'No active policy found' });
    }
    
    const sla = policy.rows[0];
    const violations = [];
    const warnings = [];
    
    // Example SLA validation logic
    if (tier === 'standard' && estimated_timeline.hub_processing_hours > sla.sla_tier2_max_hours) {
      violations.push({
        type: 'sla_violation',
        field: 'hub_processing_time',
        message: `Hub processing time (${estimated_timeline.hub_processing_hours}h) exceeds Tier 2 limit (${sla.sla_tier2_max_hours}h)`,
        severity: 'error'
      });
    }
    
    if (tier === 'premium' && estimated_timeline.hub_processing_hours > sla.sla_tier3_max_hours) {
      violations.push({
        type: 'sla_violation',
        field: 'hub_processing_time',
        message: `Hub processing time (${estimated_timeline.hub_processing_hours}h) exceeds Tier 3 limit (${sla.sla_tier3_max_hours}h)`,
        severity: 'error'
      });
    }
    
    // Check risk buffer
    const totalTime = estimated_timeline.pickup_hours + estimated_timeline.hub_processing_hours + estimated_timeline.delivery_hours;
    if (totalTime >= (estimated_timeline.sla_deadline_hours - sla.sla_risk_buffer_hours)) {
      warnings.push({
        type: 'sla_risk',
        field: 'total_timeline',
        message: `Timeline is within SLA risk buffer (${sla.sla_risk_buffer_hours}h)`,
        severity: 'warning'
      });
    }
    
    res.json({
      shipment_id,
      valid: violations.length === 0,
      violations,
      warnings,
      policy_version: policy.rows[0].current_version || 'unknown'
    });
  } catch (error) {
    console.error('Error validating SLA:', error);
    res.status(500).json({ error: 'Failed to validate SLA' });
  }
});

// Validate quote margins against current policy
router.post('/validate/margin', async (req, res) => {
  try {
    const { quote_id, total_cost, client_price, component_breakdown } = req.body;
    
    // Get active policy
    const policy = await pool.query(`
      SELECT 
        margin_global_minimum, margin_global_target,
        margin_wg_component, margin_dhl_component, margin_hub_fee,
        margin_variance_tolerance
      FROM active_policy_cache 
      WHERE policy_id = 'policy-001'
    `);
    
    if (policy.rows.length === 0) {
      return res.status(500).json({ error: 'No active policy found' });
    }
    
    const margins = policy.rows[0];
    const violations = [];
    const warnings = [];
    
    // Calculate overall margin
    const totalMarginAmount = client_price - total_cost;
    const totalMarginPercent = (totalMarginAmount / client_price) * 100;
    
    // Check global minimum margin
    if (totalMarginPercent < margins.margin_global_minimum) {
      violations.push({
        type: 'margin_violation',
        field: 'global_margin',
        message: `Total margin (${totalMarginPercent.toFixed(2)}%) below minimum (${margins.margin_global_minimum}%)`,
        severity: 'error',
        can_override: true,
        override_level: 'admin'
      });
    }
    
    // Check if below target (warning)
    if (totalMarginPercent < margins.margin_global_target) {
      warnings.push({
        type: 'margin_warning',
        field: 'target_margin',
        message: `Total margin (${totalMarginPercent.toFixed(2)}%) below target (${margins.margin_global_target}%)`,
        severity: 'warning'
      });
    }
    
    // Check component margins if breakdown provided
    if (component_breakdown) {
      const components = ['wg', 'dhl', 'hub_fee'];
      components.forEach(component => {
        if (component_breakdown[component]) {
          const componentMargin = component_breakdown[component].margin_percent;
          const thresholdField = `margin_${component === 'hub_fee' ? 'hub_fee' : component}_component`;
          const threshold = margins[thresholdField];
          
          if (componentMargin < threshold) {
            violations.push({
              type: 'component_margin_violation',
              field: `${component}_margin`,
              message: `${component.toUpperCase()} margin (${componentMargin.toFixed(2)}%) below minimum (${threshold}%)`,
              severity: 'error',
              can_override: true,
              override_level: 'manager'
            });
          }
        }
      });
    }
    
    res.json({
      quote_id,
      valid: violations.length === 0,
      violations,
      warnings,
      margin_analysis: {
        total_margin_amount: totalMarginAmount,
        total_margin_percent: totalMarginPercent.toFixed(2),
        meets_minimum: totalMarginPercent >= margins.margin_global_minimum,
        meets_target: totalMarginPercent >= margins.margin_global_target
      },
      policy_version: policy.rows[0].current_version || 'unknown'
    });
  } catch (error) {
    console.error('Error validating margin:', error);
    res.status(500).json({ error: 'Failed to validate margin' });
  }
});

// Refresh policy cache (for scheduled policies or manual refresh)
router.post('/cache/refresh', adminMiddleware, async (req, res) => {
  try {
    const { policy_id = 'policy-001' } = req.body;
    
    await pool.query('SELECT refresh_active_policy_cache($1)', [policy_id]);
    
    res.json({
      message: 'Policy cache refreshed successfully',
      policy_id,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing policy cache:', error);
    res.status(500).json({ error: 'Failed to refresh policy cache' });
  }
});

module.exports = router;
