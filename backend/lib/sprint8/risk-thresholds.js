const pool = require('../../database/connection');

/**
 * Risk Thresholds & Policies Backend Library
 * Handles comprehensive risk policy management, validation, simulation, and cache operations
 */

class RiskThresholdManager {
  constructor() {
    this.defaultPolicyId = 'risk-policy-001';
  }

  /**
   * Get current active risk policy from cache (high performance)
   */
  async getActiveRiskPolicy(policyId = this.defaultPolicyId) {
    try {
      const result = await pool.query(`
        SELECT * FROM active_risk_policy_cache 
        WHERE policy_id = $1
        ORDER BY last_updated DESC 
        LIMIT 1
      `, [policyId]);

      if (result.rows.length === 0) {
        throw new Error(`No active risk policy found for ${policyId}`);
      }

      return this.formatCacheToRiskPolicy(result.rows[0]);
    } catch (error) {
      console.error('Error getting active risk policy:', error);
      throw error;
    }
  }

  /**
   * Get full risk policy with all configuration data
   */
  async getRiskPolicyFull(policyId) {
    try {
      const result = await pool.query(`
        SELECT 
          id, policy_id, name, version, state, effective_date,
          value_bands, fragility_rules, brand_overrides, lane_risks,
          inventory_thresholds, risk_weights, risk_components,
          security_defaults, incident_rules, publishing_scope,
          change_reason, created_by, last_edited_by, last_edited_at,
          requires_approval, approved_by, approved_at,
          policy_metadata, created_at, updated_at
        FROM risk_threshold_policies 
        WHERE policy_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [policyId]);

      if (result.rows.length === 0) {
        throw new Error(`Risk policy ${policyId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting full risk policy:', error);
      throw error;
    }
  }

  /**
   * Get all risk policies with filtering
   */
  async getAllRiskPolicies(filters = {}) {
    try {
      const { state, version, limit = 50, offset = 0 } = filters;
      
      let query = `
        SELECT 
          id, policy_id, name, version, state, effective_date,
          change_reason, created_by, last_edited_by, last_edited_at,
          requires_approval, approved_by, approved_at,
          created_at, updated_at
        FROM risk_threshold_policies 
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
      let countQuery = 'SELECT COUNT(*) FROM risk_threshold_policies WHERE 1=1';
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
      
      return {
        policies: result.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        }
      };
    } catch (error) {
      console.error('Error fetching risk policies:', error);
      throw error;
    }
  }

  /**
   * Save risk policy (create or update draft)
   */
  async saveRiskPolicy(policyData, userId, userRole) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const {
        policy_id,
        name,
        version,
        value_bands,
        fragility_rules,
        brand_overrides,
        lane_risks,
        inventory_thresholds,
        risk_weights,
        risk_components,
        security_defaults,
        incident_rules,
        publishing_scope,
        change_reason,
        effective_date,
        state = 'draft'
      } = policyData;
      
      // Validation
      if (!policy_id || !name || !version || !change_reason) {
        throw new Error('Missing required fields: policy_id, name, version, change_reason');
      }

      // Validate risk policy structure
      const validationResult = this.validateRiskPolicy(policyData);
      if (!validationResult.valid) {
        throw new Error(`Policy validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Check if policy exists
      const existingPolicy = await client.query(
        'SELECT id, value_bands, risk_weights, inventory_thresholds FROM risk_threshold_policies WHERE policy_id = $1',
        [policy_id]
      );
      
      let result;
      let requiresApproval = false;
      
      if (existingPolicy.rows.length > 0) {
        // Check if changes require approval
        requiresApproval = await this.checkRiskApprovalRequired(existingPolicy.rows[0], policyData);
        
        // Update existing policy
        result = await client.query(`
          UPDATE risk_threshold_policies 
          SET 
            name = $2, version = $3,
            value_bands = $4, fragility_rules = $5, brand_overrides = $6,
            lane_risks = $7, inventory_thresholds = $8, risk_weights = $9,
            risk_components = $10, security_defaults = $11, incident_rules = $12,
            publishing_scope = $13, change_reason = $14, last_edited_by = $15,
            last_edited_at = CURRENT_TIMESTAMP, effective_date = $16,
            state = $17, requires_approval = $18, updated_at = CURRENT_TIMESTAMP
          WHERE policy_id = $1
          RETURNING *
        `, [
          policy_id, name, version,
          JSON.stringify(value_bands), JSON.stringify(fragility_rules), JSON.stringify(brand_overrides),
          JSON.stringify(lane_risks), JSON.stringify(inventory_thresholds), JSON.stringify(risk_weights),
          JSON.stringify(risk_components), JSON.stringify(security_defaults), JSON.stringify(incident_rules),
          JSON.stringify(publishing_scope), change_reason, userId,
          effective_date || new Date().toISOString(), state, requiresApproval
        ]);
      } else {
        // Create new policy
        result = await client.query(`
          INSERT INTO risk_threshold_policies (
            policy_id, name, version,
            value_bands, fragility_rules, brand_overrides, lane_risks,
            inventory_thresholds, risk_weights, risk_components,
            security_defaults, incident_rules, publishing_scope,
            change_reason, created_by, last_edited_by, effective_date, state, requires_approval
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *
        `, [
          policy_id, name, version,
          JSON.stringify(value_bands), JSON.stringify(fragility_rules), JSON.stringify(brand_overrides),
          JSON.stringify(lane_risks), JSON.stringify(inventory_thresholds), JSON.stringify(risk_weights),
          JSON.stringify(risk_components), JSON.stringify(security_defaults), JSON.stringify(incident_rules),
          JSON.stringify(publishing_scope), change_reason, userId, userId,
          effective_date || new Date().toISOString(), state, requiresApproval
        ]);
      }
      
      // Emit policy event
      await this.emitRiskEvent(
        'settings.thresholds.updated',
        policy_id, version, userId, 
        { 
          action: 'save_draft', 
          fields_changed: ['value_bands', 'risk_weights', 'inventory_thresholds'],
          requires_approval: requiresApproval
        },
        change_reason,
        client
      );
      
      await client.query('COMMIT');
      
      return {
        policy: result.rows[0],
        requires_approval: requiresApproval,
        validation: validationResult
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving risk policy:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Publish risk policy
   */
  async publishRiskPolicy(policyId, publishData, userId, userRole) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { change_reason, scheduled_date } = publishData;
      
      if (!change_reason) {
        throw new Error('Change reason is required for publishing');
      }
      
      // Get current policy
      const currentPolicy = await client.query(
        'SELECT * FROM risk_threshold_policies WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1',
        [policyId]
      );
      
      if (currentPolicy.rows.length === 0) {
        throw new Error('Risk policy not found');
      }
      
      const policy = currentPolicy.rows[0];
      const effectiveDate = scheduled_date ? new Date(scheduled_date) : new Date();
      const newState = scheduled_date ? 'scheduled' : 'published';
      
      // Check if approval is required
      if (policy.requires_approval && !policy.approved_at) {
        throw new Error('Policy requires approval before publishing');
      }
      
      // Update policy state
      const result = await client.query(`
        UPDATE risk_threshold_policies 
        SET 
          state = $2,
          effective_date = $3,
          change_reason = $4,
          last_edited_by = $5,
          last_edited_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE policy_id = $1
        RETURNING *
      `, [policyId, newState, effectiveDate.toISOString(), change_reason, userId]);
      
      // Emit publish event
      await this.emitRiskEvent(
        'settings.policy.published',
        policyId, policy.version, userId,
        { action: 'publish', state: newState },
        change_reason,
        client,
        !!scheduled_date
      );
      
      // If publishing immediately, refresh cache
      if (!scheduled_date) {
        await client.query('SELECT refresh_active_risk_policy_cache($1)', [policyId]);
        
        // Emit recompute events
        await this.emitRiskEvent(
          'settings.riskmodel.updated',
          policyId, policy.version, userId,
          { 
            weights: policy.risk_weights,
            components: policy.risk_components,
            effective_at: effectiveDate.toISOString()
          },
          'Risk model updated via policy publication',
          client
        );
      }
      
      await client.query('COMMIT');
      
      return {
        message: scheduled_date ? 'Risk policy scheduled for publication' : 'Risk policy published successfully',
        policy: result.rows[0],
        effective_date: effectiveDate.toISOString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error publishing risk policy:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run risk policy simulation
   */
  async runRiskSimulation(policyId, simulationData, userId) {
    const client = await pool.connect();
    
    try {
      const startTime = Date.now();
      const { 
        value_bands, 
        risk_weights, 
        inventory_thresholds, 
        incident_rules,
        sample_shipments = [] 
      } = simulationData;
      
      // Get current policy for comparison
      const currentPolicy = await this.getActiveRiskPolicy(policyId);
      
      // Validate the new configuration
      const validationResult = this.validateRiskPolicy(simulationData);
      
      // Simulate route and alert changes
      const simulationResults = await this.calculateSimulationImpact({
        currentPolicy,
        newConfig: simulationData,
        sampleShipments: sample_shipments
      });
      
      const simulationDuration = Date.now() - startTime;
      const simulationId = `sim_risk_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Store simulation results
      await client.query(`
        INSERT INTO risk_policy_simulations (
          simulation_id, policy_id, simulated_by, simulation_type,
          target_value_bands, target_risk_weights, target_inventory_thresholds,
          target_incident_rules, sample_shipments,
          routes_flipped, new_warnings, new_blocks, total_routes,
          new_inventory_alerts, new_customs_alerts, new_incident_rules_count,
          total_alerts_change, conflicts_found, estimated_impact,
          simulation_results, simulation_duration_ms, routes_calculated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      `, [
        simulationId, policyId, userId, 'policy_change',
        JSON.stringify(value_bands), JSON.stringify(risk_weights), 
        JSON.stringify(inventory_thresholds), JSON.stringify(incident_rules),
        JSON.stringify(sample_shipments),
        simulationResults.routeChanges.routesFlipped,
        simulationResults.routeChanges.newWarnings,
        simulationResults.routeChanges.newBlocks,
        simulationResults.routeChanges.totalRoutes,
        simulationResults.alertChanges.newInventoryAlerts,
        simulationResults.alertChanges.newCustomsAlerts,
        simulationResults.alertChanges.newIncidentRules,
        simulationResults.alertChanges.totalAlertsChange,
        JSON.stringify(validationResult.conflicts || []),
        simulationResults.estimatedImpact,
        JSON.stringify(simulationResults),
        simulationDuration,
        simulationResults.routeChanges.totalRoutes
      ]);
      
      // Emit simulation event
      await this.emitRiskEvent(
        'settings.thresholds.simulated',
        policyId, currentPolicy.version, userId,
        {
          simulation_id: simulationId,
          estimated_impact: simulationResults.estimatedImpact,
          conflicts_found: validationResult.conflicts?.length || 0
        },
        'Risk policy simulation executed',
        client
      );
      
      return {
        simulation_id: simulationId,
        summary: {
          total_shipments_tested: simulationResults.routeChanges.totalRoutes,
          shipments_at_risk: simulationResults.alertChanges.newInventoryAlerts,
          routes_blocked: simulationResults.routeChanges.newBlocks,
          average_score_change: simulationResults.averageScoreChange || 0,
          simulation_duration_ms: simulationDuration
        },
        route_changes: simulationResults.routeChanges,
        alert_changes: simulationResults.alertChanges,
        conflicts: validationResult.conflicts || [],
        estimated_impact: simulationResults.estimatedImpact
      };
    } catch (error) {
      console.error('Error running risk simulation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get risk policy version history
   */
  async getRiskPolicyHistory(policyId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      
      const result = await pool.query(`
        SELECT 
          version, change_type, change_reason, changed_by, changed_at,
          fields_changed, old_values, new_values,
          approval_request_id, approved_by, approved_at,
          affected_quotes, affected_shipments, affected_alerts
        FROM risk_policy_version_history 
        WHERE policy_id = $1
        ORDER BY changed_at DESC
        LIMIT $2 OFFSET $3
      `, [policyId, parseInt(limit), parseInt(offset)]);
      
      return {
        policy_id: policyId,
        history: result.rows
      };
    } catch (error) {
      console.error('Error fetching risk policy history:', error);
      throw error;
    }
  }

  /**
   * Validate risk policy configuration
   */
  validateRiskPolicy(policyData) {
    const errors = [];
    const conflicts = [];
    
    // Validate value bands
    if (policyData.value_bands) {
      policyData.value_bands.forEach((band, index) => {
        if (band.minValue < 0) {
          errors.push(`Value band ${index + 1}: minimum value cannot be negative`);
        }
        if (band.maxValue && band.maxValue <= band.minValue) {
          errors.push(`Value band ${index + 1}: maximum value must be greater than minimum value`);
        }
        if (band.recommendedTier === 'T1' && band.minValue > 2000) {
          conflicts.push({
            type: 'value-policy',
            description: `Value band ${index + 1} suggests T1 for high-value items (€${band.minValue}+)`,
            recommendation: 'Consider T2 or T3 for values above €2000',
            severity: 'warning'
          });
        }
      });
    }
    
    // Validate inventory thresholds
    if (policyData.inventory_thresholds) {
      const inv = policyData.inventory_thresholds;
      if (inv.tags?.lowStockQty <= 0) {
        errors.push('Tags low stock threshold must be greater than 0');
      }
      if (inv.nfc?.lowStockQty <= 0) {
        errors.push('NFC low stock threshold must be greater than 0');
      }
      if (inv.nfc?.lotFailureQuarantineThreshold < 0 || inv.nfc?.lotFailureQuarantineThreshold > 100) {
        errors.push('NFC lot failure threshold must be between 0 and 100');
      }
    }
    
    // Validate risk weights
    if (policyData.risk_weights) {
      const weights = policyData.risk_weights;
      const sum = (weights.time || 0) + (weights.cost || 0) + (weights.risk || 0);
      if (sum === 0) {
        errors.push('Risk weights cannot all be zero');
      }
      if (weights.time < 0 || weights.cost < 0 || weights.risk < 0) {
        errors.push('Risk weights cannot be negative');
      }
    }
    
    // Validate risk components
    if (policyData.risk_components) {
      const components = policyData.risk_components;
      Object.entries(components).forEach(([key, value]) => {
        if (value < 0 || value > 1) {
          errors.push(`Risk component ${key} must be between 0 and 1`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      conflicts
    };
  }

  /**
   * Check if risk policy changes require approval
   */
  async checkRiskApprovalRequired(oldPolicy, newPolicy) {
    // Check for protection-lowering changes
    return (
      // Value thresholds being lowered (allowing T1 for higher values)
      this.compareBandProtection(oldPolicy.value_bands, newPolicy.value_bands) ||
      
      // Inventory thresholds being lowered
      (newPolicy.inventory_thresholds?.tags?.lowStockQty < oldPolicy.inventory_thresholds?.tags?.lowStockQty) ||
      (newPolicy.inventory_thresholds?.nfc?.lowStockQty < oldPolicy.inventory_thresholds?.nfc?.lowStockQty) ||
      
      // Risk weights being adjusted in ways that lower protection
      (newPolicy.risk_weights?.risk < oldPolicy.risk_weights?.risk)
    );
  }

  /**
   * Compare band protection levels
   */
  compareBandProtection(oldBands, newBands) {
    if (!oldBands || !newBands) return false;
    
    // Check if any band is recommending lower tiers for similar value ranges
    for (let i = 0; i < Math.min(oldBands.length, newBands.length); i++) {
      const oldBand = oldBands[i];
      const newBand = newBands[i];
      
      const tierValues = { 'T1': 1, 'T2': 2, 'T3': 3 };
      if (tierValues[newBand.recommendedTier] < tierValues[oldBand.recommendedTier]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate simulation impact
   */
  async calculateSimulationImpact({ currentPolicy, newConfig, sampleShipments }) {
    // Mock simulation logic - in production, this would integrate with your route planning engine
    const totalRoutes = sampleShipments.length || 1247; // Default sample size
    
    // Calculate route changes
    const routesFlipped = Math.floor(Math.random() * 50) + 10;
    const newWarnings = Math.floor(Math.random() * 25) + 5;
    const newBlocks = Math.floor(Math.random() * 10) + 1;
    
    // Calculate alert changes
    const newInventoryAlerts = Math.floor(Math.random() * 15) + 3;
    const newCustomsAlerts = Math.floor(Math.random() * 8) + 2;
    const newIncidentRules = newConfig.incident_rules?.length || 0;
    const totalAlertsChange = newInventoryAlerts + newCustomsAlerts + newIncidentRules;
    
    // Determine impact level
    let estimatedImpact = 'Low';
    if (newBlocks > 5 || routesFlipped > 30) {
      estimatedImpact = 'High';
    } else if (newBlocks > 2 || routesFlipped > 15) {
      estimatedImpact = 'Medium';
    }
    
    return {
      routeChanges: {
        routesFlipped,
        newWarnings,
        newBlocks,
        totalRoutes
      },
      alertChanges: {
        newInventoryAlerts,
        newCustomsAlerts,
        newIncidentRules,
        totalAlertsChange
      },
      estimatedImpact,
      averageScoreChange: (Math.random() * 10 - 5).toFixed(2) // -5 to +5 point change
    };
  }

  /**
   * Emit risk policy event
   */
  async emitRiskEvent(eventType, policyId, version, actorId, eventData = {}, reason = '', client = null, scheduled = false) {
    try {
      const eventId = `evt_risk_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const queryClient = client || pool;
      
      await queryClient.query(`
        INSERT INTO risk_policy_events (
          event_id, event_type, policy_id, version, effective_at,
          actor_id, event_data, reason, scheduled, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      `, [
        eventId, eventType, policyId, version, 
        new Date().toISOString(), actorId, JSON.stringify(eventData),
        reason, scheduled
      ]);

      return eventId;
    } catch (error) {
      console.error('Error emitting risk policy event:', error);
      throw error;
    }
  }

  /**
   * Format cache data back to risk policy structure
   */
  formatCacheToRiskPolicy(cache) {
    return {
      policy_id: cache.policy_id,
      version: cache.current_version,
      effective_since: cache.effective_since,
      value_bands: [
        { id: '1', minValue: 0, maxValue: cache.value_band_t1_max, recommendedTier: 'T1', wgRecommended: false },
        { id: '2', minValue: cache.value_band_t1_max, maxValue: cache.value_band_t2_max, recommendedTier: 'T2', wgRecommended: false },
        { id: '3', minValue: cache.value_band_t3_min, maxValue: null, recommendedTier: 'T3', wgRecommended: cache.wg_recommended_value_threshold <= cache.value_band_t3_min }
      ],
      fragility_rules: [
        { fragility: 1, wgRecommended: false, requiresRigidPackaging: false },
        { fragility: 2, wgRecommended: false, requiresRigidPackaging: false },
        { fragility: 3, wgRecommended: false, requiresRigidPackaging: cache.fragility_rigid_packaging_threshold <= 3 },
        { fragility: 4, wgRecommended: cache.fragility_wg_threshold <= 4, requiresRigidPackaging: true },
        { fragility: 5, wgRecommended: true, requiresRigidPackaging: true }
      ],
      inventory_thresholds: {
        tags: {
          lowStockQty: cache.tags_low_stock_qty,
          minDaysOfCover: cache.tags_min_days_cover
        },
        nfc: {
          lowStockQty: cache.nfc_low_stock_qty,
          minDaysOfCover: cache.nfc_min_days_cover,
          lotFailureQuarantineThreshold: cache.nfc_lot_failure_threshold
        },
        transferSlaHours: cache.transfer_sla_hours
      },
      risk_weights: {
        time: cache.risk_weight_time,
        cost: cache.risk_weight_cost,
        risk: cache.risk_weight_risk
      },
      risk_components: {
        valueRisk: cache.risk_component_value,
        fragilityRisk: cache.risk_component_fragility,
        laneRisk: cache.risk_component_lane,
        operatorRisk: cache.risk_component_operator,
        carrierRisk: cache.risk_component_carrier,
        addressRisk: cache.risk_component_address,
        hubLoadRisk: cache.risk_component_hub_load
      },
      security_defaults: {
        otpLivenessValueThreshold: cache.otp_liveness_value_threshold,
        sealRequiredTiers: [
          ...(cache.seal_required_t2 ? ['T2'] : []),
          ...(cache.seal_required_t3 ? ['T3'] : [])
        ],
        minPhotosPickup: cache.min_photos_pickup,
        minPhotosIntake: cache.min_photos_intake,
        minPhotosDelivery: cache.min_photos_delivery
      },
      cache_version: cache.cache_version,
      last_updated: cache.last_updated
    };
  }

  /**
   * Refresh active risk policy cache
   */
  async refreshRiskCache(policyId = this.defaultPolicyId) {
    try {
      await pool.query('SELECT refresh_active_risk_policy_cache($1)', [policyId]);
      return true;
    } catch (error) {
      console.error('Error refreshing risk policy cache:', error);
      throw error;
    }
  }

  /**
   * Get tier recommendation for a given value
   */
  getTierRecommendation(value, policyCache) {
    if (value <= policyCache.value_band_t1_max) {
      return { tier: 'T1', wgRecommended: false };
    } else if (value <= policyCache.value_band_t2_max) {
      return { tier: 'T2', wgRecommended: false };
    } else {
      return { tier: 'T3', wgRecommended: value >= policyCache.wg_recommended_value_threshold };
    }
  }

  /**
   * Calculate risk score for a shipment
   */
  calculateRiskScore(shipmentData, policyCache) {
    const {
      declared_value = 0,
      fragility = 1,
      lane_category = 'EU↔EU',
      address_confidence = 1.0,
      hub_utilization = 0.5
    } = shipmentData;

    // Calculate individual risk components
    const valueRisk = Math.min(declared_value / 50000, 1.0) * policyCache.risk_component_value;
    const fragilityRisk = (fragility / 5) * policyCache.risk_component_fragility;
    
    let laneRisk = 0.1 * policyCache.risk_component_lane; // Default EU↔EU
    if (lane_category === 'UK↔EU') laneRisk = 0.3 * policyCache.risk_component_lane;
    if (lane_category === 'International') laneRisk = 0.5 * policyCache.risk_component_lane;
    
    const addressRisk = (1 - address_confidence) * policyCache.risk_component_address;
    const hubLoadRisk = hub_utilization * policyCache.risk_component_hub_load;
    
    // Total risk score (0-1 scale)
    const totalRisk = valueRisk + fragilityRisk + laneRisk + addressRisk + hubLoadRisk;
    
    return {
      total_risk: Math.min(totalRisk, 1.0),
      components: {
        value_risk: valueRisk,
        fragility_risk: fragilityRisk,
        lane_risk: laneRisk,
        address_risk: addressRisk,
        hub_load_risk: hubLoadRisk
      }
    };
  }
}

module.exports = new RiskThresholdManager();
