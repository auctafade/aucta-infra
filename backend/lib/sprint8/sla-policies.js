const pool = require('../database');

/**
 * SLA & Margin Policies Backend Library
 * Handles policy management, validation, and cache operations
 */

class SLAPolicyManager {
  constructor() {
    this.defaultPolicyId = 'policy-001';
  }

  /**
   * Get current active policy from cache (high performance)
   */
  async getActivePolicy(policyId = this.defaultPolicyId) {
    try {
      const result = await pool.query(`
        SELECT * FROM active_policy_cache 
        WHERE policy_id = $1
        ORDER BY last_updated DESC 
        LIMIT 1
      `, [policyId]);

      if (result.rows.length === 0) {
        throw new Error(`No active policy found for ${policyId}`);
      }

      return this.formatCacheToPolicy(result.rows[0]);
    } catch (error) {
      console.error('Error getting active policy:', error);
      throw error;
    }
  }

  /**
   * Get full policy with history
   */
  async getPolicyFull(policyId) {
    try {
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
        throw new Error(`Policy ${policyId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting full policy:', error);
      throw error;
    }
  }

  /**
   * Validate shipment against SLA targets
   */
  async validateSLA(shipmentData) {
    try {
      const policy = await this.getActivePolicy();
      const violations = [];
      const warnings = [];

      const {
        tier,
        estimated_pickup_hours,
        estimated_hub_hours,
        estimated_delivery_hours,
        sla_deadline,
        urgency_level = 'standard'
      } = shipmentData;

      // Calculate total estimated time
      const totalEstimatedHours = 
        (estimated_pickup_hours || 0) + 
        (estimated_hub_hours || 0) + 
        (estimated_delivery_hours || 0);

      // Check classification SLA
      if (shipmentData.classification_pending_hours > policy.sla_targets.classification.timeToClassify) {
        violations.push({
          type: 'classification_sla',
          message: `Classification time (${shipmentData.classification_pending_hours}h) exceeds limit (${policy.sla_targets.classification.timeToClassify}h)`,
          severity: 'error',
          field: 'classification_time'
        });
      }

      // Check pickup SLA
      const pickupLimit = estimated_pickup_hours <= 50 ? // Urban vs inter-city heuristic
        policy.sla_targets.pickups.urbanWGMaxHours :
        policy.sla_targets.pickups.interCityWGMaxHours;

      if (estimated_pickup_hours > pickupLimit) {
        violations.push({
          type: 'pickup_sla',
          message: `Pickup time (${estimated_pickup_hours}h) exceeds limit (${pickupLimit}h)`,
          severity: 'error',
          field: 'pickup_time'
        });
      }

      // Check hub processing SLA
      let hubLimit;
      if (tier === 'standard') {
        hubLimit = policy.sla_targets.hubProcessing.tier2MaxHours;
      } else if (['premium', 'platinum'].includes(tier)) {
        hubLimit = policy.sla_targets.hubProcessing.tier3MaxHours + 
                  policy.sla_targets.hubProcessing.tier3QABuffer;
      }

      if (hubLimit && estimated_hub_hours > hubLimit) {
        violations.push({
          type: 'hub_processing_sla',
          message: `Hub processing time (${estimated_hub_hours}h) exceeds ${tier} limit (${hubLimit}h)`,
          severity: 'error',
          field: 'hub_processing_time'
        });
      }

      // Check delivery SLA
      if (estimated_delivery_hours > policy.sla_targets.delivery.wgFinalDeliveryMaxHours) {
        violations.push({
          type: 'delivery_sla',
          message: `Delivery time (${estimated_delivery_hours}h) exceeds limit (${policy.sla_targets.delivery.wgFinalDeliveryMaxHours}h)`,
          severity: 'error',
          field: 'delivery_time'
        });
      }

      // Check SLA risk buffer
      if (sla_deadline) {
        const deadlineTime = new Date(sla_deadline).getTime();
        const estimatedCompletionTime = Date.now() + (totalEstimatedHours * 60 * 60 * 1000);
        const bufferTime = policy.sla_targets.riskManagement.riskBufferHours * 60 * 60 * 1000;

        if ((deadlineTime - estimatedCompletionTime) < bufferTime) {
          warnings.push({
            type: 'sla_risk',
            message: `Timeline is within SLA risk buffer (${policy.sla_targets.riskManagement.riskBufferHours}h)`,
            severity: 'warning',
            field: 'sla_risk_buffer'
          });
        }
      }

      return {
        valid: violations.length === 0,
        violations,
        warnings,
        policy_version: policy.version,
        sla_summary: {
          total_estimated_hours: totalEstimatedHours,
          pickup_hours: estimated_pickup_hours,
          hub_hours: estimated_hub_hours,
          delivery_hours: estimated_delivery_hours,
          risk_buffer_hours: policy.sla_targets.riskManagement.riskBufferHours
        }
      };
    } catch (error) {
      console.error('Error validating SLA:', error);
      throw error;
    }
  }

  /**
   * Validate quote margins against policy thresholds
   */
  async validateMargins(quoteData) {
    try {
      const policy = await this.getActivePolicy();
      const violations = [];
      const warnings = [];

      const {
        total_cost,
        client_price,
        component_breakdown = {},
        currency = 'EUR'
      } = quoteData;

      // Calculate overall margin
      const marginAmount = client_price - total_cost;
      const marginPercent = (marginAmount / client_price) * 100;

      // Check global minimum margin
      if (marginPercent < policy.margin_thresholds.global.minimumMargin) {
        violations.push({
          type: 'global_margin_violation',
          message: `Total margin (${marginPercent.toFixed(2)}%) below minimum (${policy.margin_thresholds.global.minimumMargin}%)`,
          severity: 'error',
          field: 'global_margin',
          can_override: true,
          override_level: 'admin'
        });
      }

      // Check target margin (warning)
      if (marginPercent < policy.margin_thresholds.global.targetMargin) {
        warnings.push({
          type: 'target_margin_warning',
          message: `Total margin (${marginPercent.toFixed(2)}%) below target (${policy.margin_thresholds.global.targetMargin}%)`,
          severity: 'warning',
          field: 'target_margin'
        });
      }

      // Validate component margins
      const componentChecks = [
        { key: 'wg_component', field: 'wgComponent', name: 'WG' },
        { key: 'dhl_component', field: 'dhlComponent', name: 'DHL' },
        { key: 'hub_fee', field: 'hubFeeComponent', name: 'Hub Fee' },
        { key: 'insurance', field: 'insuranceMarkup', name: 'Insurance' },
        { key: 'surcharges', field: 'surchargesPolicy', name: 'Surcharges' }
      ];

      componentChecks.forEach(({ key, field, name }) => {
        if (component_breakdown[key]) {
          const componentMargin = component_breakdown[key].margin_percent || 0;
          const threshold = policy.margin_thresholds.components[field];

          if (componentMargin < threshold) {
            violations.push({
              type: 'component_margin_violation',
              message: `${name} margin (${componentMargin.toFixed(2)}%) below minimum (${threshold}%)`,
              severity: 'error',
              field: `${key}_margin`,
              can_override: true,
              override_level: 'manager'
            });
          }
        }
      });

      // Check variance tolerance
      if (component_breakdown.actual_cost && component_breakdown.planned_cost) {
        const variancePercent = ((component_breakdown.actual_cost - component_breakdown.planned_cost) / component_breakdown.planned_cost) * 100;
        
        if (variancePercent > policy.margin_thresholds.variance.tolerancePercent) {
          warnings.push({
            type: 'variance_warning',
            message: `Actual cost variance (${variancePercent.toFixed(2)}%) exceeds tolerance (${policy.margin_thresholds.variance.tolerancePercent}%)`,
            severity: 'warning',
            field: 'cost_variance'
          });
        }
      }

      return {
        valid: violations.length === 0,
        violations,
        warnings,
        policy_version: policy.version,
        margin_analysis: {
          total_margin_amount: marginAmount,
          total_margin_percent: marginPercent.toFixed(2),
          meets_minimum: marginPercent >= policy.margin_thresholds.global.minimumMargin,
          meets_target: marginPercent >= policy.margin_thresholds.global.targetMargin,
          currency: currency,
          component_breakdown: component_breakdown
        }
      };
    } catch (error) {
      console.error('Error validating margins:', error);
      throw error;
    }
  }

  /**
   * Check if policy changes require approval
   */
  async checkApprovalRequired(oldPolicy, newPolicy) {
    // Check for protection-lowering changes
    const requiresApproval = 
      // SLA targets being relaxed (increased)
      newPolicy.sla_targets.hubProcessing.tier2MaxHours > oldPolicy.sla_targets.hubProcessing.tier2MaxHours ||
      newPolicy.sla_targets.hubProcessing.tier3MaxHours > oldPolicy.sla_targets.hubProcessing.tier3MaxHours ||
      newPolicy.sla_targets.delivery.wgFinalDeliveryMaxHours > oldPolicy.sla_targets.delivery.wgFinalDeliveryMaxHours ||
      
      // Margin thresholds being lowered
      newPolicy.margin_thresholds.global.minimumMargin < oldPolicy.margin_thresholds.global.minimumMargin ||
      newPolicy.margin_thresholds.components.wgComponent < oldPolicy.margin_thresholds.components.wgComponent ||
      newPolicy.margin_thresholds.components.dhlComponent < oldPolicy.margin_thresholds.components.dhlComponent;

    return requiresApproval;
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(policyId, requestedBy, reason) {
    try {
      const requestId = `approval_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const result = await pool.query(`
        INSERT INTO policy_approval_requests (
          request_id, policy_id, requested_by, reason,
          required_approvers, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        requestId, policyId, requestedBy, reason,
        JSON.stringify([
          { role: 'ops_admin', email: 'ops.admin@aucta.io' },
          { role: 'finance_approver', email: 'finance.approver@aucta.io' }
        ]),
        'pending'
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating approval request:', error);
      throw error;
    }
  }

  /**
   * Run policy simulation
   */
  async runSimulation(policyChanges, sampleShipments = []) {
    try {
      const startTime = Date.now();
      
      // Get current policy for comparison
      const currentPolicy = await this.getActivePolicy();
      
      // Create temporary policy object with changes
      const simulatedPolicy = {
        ...currentPolicy,
        sla_targets: { ...currentPolicy.sla_targets, ...policyChanges.sla_targets },
        margin_thresholds: { ...currentPolicy.margin_thresholds, ...policyChanges.margin_thresholds }
      };

      // Get test shipments
      let testShipments;
      if (sampleShipments.length > 0) {
        const placeholders = sampleShipments.map((_, i) => `$${i + 1}`).join(',');
        testShipments = await pool.query(`
          SELECT shipment_id, declared_value, tier, status,
                 weight, length_cm, width_cm, height_cm
          FROM shipments 
          WHERE shipment_id IN (${placeholders})
          LIMIT 50
        `, sampleShipments);
      } else {
        // Use recent shipments as default sample
        testShipments = await pool.query(`
          SELECT shipment_id, declared_value, tier, status,
                 weight, length_cm, width_cm, height_cm
          FROM shipments 
          WHERE status IN ('planned', 'in-transit')
          ORDER BY created_at DESC
          LIMIT 20
        `);
      }

      const simulationResults = [];
      let atRiskCount = 0;
      let blockedCount = 0;
      let totalScoreChange = 0;

      for (const shipment of testShipments.rows) {
        // Simulate scoring with current policy
        const currentValidation = await this.validateMargins({
          total_cost: shipment.declared_value * 0.7, // Mock cost
          client_price: shipment.declared_value,
          component_breakdown: {
            wg_component: { margin_percent: 12 },
            dhl_component: { margin_percent: 8 },
            hub_fee: { margin_percent: 25 }
          }
        });

        // Simulate with new policy (simplified)
        const newMarginCheck = simulatedPolicy.margin_thresholds.global.minimumMargin;
        const currentMargin = 30; // Mock current margin
        
        const currentScore = currentValidation.valid ? 90 : 70;
        const newScore = currentMargin >= newMarginCheck ? 92 : 65;
        const scoreDelta = newScore - currentScore;

        const guardrailHits = [];
        if (currentMargin < newMarginCheck) {
          guardrailHits.push('Margin below target');
          blockedCount++;
        }

        const slaAtRisk = Math.random() > 0.8; // 20% chance for demo
        if (slaAtRisk) atRiskCount++;

        simulationResults.push({
          shipmentId: shipment.shipment_id,
          lane: `${shipment.tier || 'standard'} tier`,
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

      return {
        simulation_summary: {
          total_shipments_tested: testShipments.rows.length,
          shipments_at_risk: atRiskCount,
          routes_blocked: blockedCount,
          average_score_change: averageScoreChange.toFixed(2),
          simulation_duration_ms: simulationDuration
        },
        results: simulationResults,
        policy_comparison: {
          current_version: currentPolicy.version,
          simulated_changes: policyChanges
        }
      };
    } catch (error) {
      console.error('Error running simulation:', error);
      throw error;
    }
  }

  /**
   * Emit policy event
   */
  async emitEvent(eventType, policyId, version, actorId, eventData = {}) {
    try {
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      await pool.query(`
        INSERT INTO policy_events (
          event_id, event_type, policy_id, version, effective_at,
          actor_id, event_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [
        eventId, eventType, policyId, version, 
        new Date().toISOString(), actorId, JSON.stringify(eventData)
      ]);

      return eventId;
    } catch (error) {
      console.error('Error emitting policy event:', error);
      throw error;
    }
  }

  /**
   * Format cache data back to policy structure
   */
  formatCacheToPolicy(cache) {
    return {
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
  }

  /**
   * Refresh active policy cache
   */
  async refreshCache(policyId = this.defaultPolicyId) {
    try {
      await pool.query('SELECT refresh_active_policy_cache($1)', [policyId]);
      return true;
    } catch (error) {
      console.error('Error refreshing policy cache:', error);
      throw error;
    }
  }
}

module.exports = new SLAPolicyManager();
