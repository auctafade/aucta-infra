// Data Integrity Service - Idempotent operations with duplicate prevention
// Enforces unique constraints and validates scheduling windows

const { pool } = require('../database/connection');
const crypto = require('crypto');

class DataIntegrityService {
  
  // Generate idempotency key from normalized payload
  generateIdempotencyKey(payload, actorId, timestamp) {
    const normalizedPayload = this.normalizePayload(payload);
    const combined = `${JSON.stringify(normalizedPayload)}:${actorId}:${timestamp}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }
  
  // Generate payload hash for content-based deduplication
  generatePayloadHash(payload) {
    const normalizedPayload = this.normalizePayload(payload);
    return crypto.createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex');
  }
  
  // Normalize payload for consistent hashing
  normalizePayload(payload) {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }
    
    if (Array.isArray(payload)) {
      return payload.map(item => this.normalizePayload(item)).sort();
    }
    
    const normalized = {};
    const sortedKeys = Object.keys(payload).sort();
    
    for (const key of sortedKeys) {
      // Skip metadata fields that shouldn't affect duplication
      if (['created_at', 'updated_at', 'id', 'timestamp', 'correlationId', 'eventId'].includes(key)) {
        continue;
      }
      normalized[key] = this.normalizePayload(payload[key]);
    }
    
    return normalized;
  }
  
  // Idempotent SLA margin policy publish
  async publishSLAMarginPolicy(policyData, options = {}) {
    const {
      actorId = 'system',
      changeReason = 'Policy update',
      publishRequestId = null,
      bypassValidation = false
    } = options;
    
    try {
      // Generate idempotency key and payload hash
      const timestamp = new Date().toISOString();
      const idempotencyKey = this.generateIdempotencyKey(policyData, actorId, timestamp);
      const payloadHash = this.generatePayloadHash(policyData);
      
      // Call idempotent upsert function
      const result = await pool.query(`
        SELECT * FROM upsert_sla_margin_policy(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        policyData.policy_id,
        policyData.name,
        policyData.version,
        'published',
        policyData.effective_date || new Date().toISOString(),
        JSON.stringify(policyData.sla_targets),
        JSON.stringify(policyData.margin_thresholds),
        changeReason,
        actorId,
        idempotencyKey,
        payloadHash,
        publishRequestId
      ]);
      
      const { policy_id, is_duplicate, action_taken } = result.rows[0];
      
      console.log(`SLA Policy ${action_taken}: ${policy_id} (duplicate: ${is_duplicate})`);
      
      return {
        success: true,
        policyId: policy_id,
        isDuplicate: is_duplicate,
        actionTaken: action_taken,
        idempotencyKey,
        payloadHash
      };
      
    } catch (error) {
      console.error('Error publishing SLA margin policy:', error);
      
      // Check if it's a constraint violation
      if (error.message.includes('Overlapping active policy window')) {
        return {
          success: false,
          error: 'OVERLAPPING_POLICY',
          message: 'Cannot publish policy: overlapping active window detected',
          details: error.message
        };
      }
      
      throw error;
    }
  }
  
  // Idempotent risk threshold policy publish
  async publishRiskThresholdPolicy(policyData, options = {}) {
    const {
      actorId = 'system',
      changeReason = 'Policy update',
      publishRequestId = null
    } = options;
    
    try {
      const timestamp = new Date().toISOString();
      const idempotencyKey = this.generateIdempotencyKey(policyData, actorId, timestamp);
      const payloadHash = this.generatePayloadHash(policyData);
      
      const result = await pool.query(`
        SELECT * FROM upsert_risk_threshold_policy(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
      `, [
        policyData.policy_id,
        policyData.name,
        policyData.version,
        'published',
        policyData.effective_date || new Date().toISOString(),
        JSON.stringify(policyData.value_bands || []),
        JSON.stringify(policyData.fragility_rules || []),
        JSON.stringify(policyData.brand_overrides || []),
        JSON.stringify(policyData.lane_risks || []),
        JSON.stringify(policyData.inventory_thresholds || {}),
        JSON.stringify(policyData.risk_weights || {}),
        JSON.stringify(policyData.risk_components || {}),
        JSON.stringify(policyData.security_defaults || {}),
        JSON.stringify(policyData.incident_rules || []),
        JSON.stringify(policyData.publishing_scope || {}),
        changeReason,
        actorId,
        idempotencyKey,
        payloadHash,
        publishRequestId
      ]);
      
      const { policy_id, is_duplicate, action_taken } = result.rows[0];
      
      console.log(`Risk Policy ${action_taken}: ${policy_id} (duplicate: ${is_duplicate})`);
      
      return {
        success: true,
        policyId: policy_id,
        isDuplicate: is_duplicate,
        actionTaken: action_taken,
        idempotencyKey,
        payloadHash
      };
      
    } catch (error) {
      console.error('Error publishing risk threshold policy:', error);
      
      if (error.message.includes('Overlapping active policy window')) {
        return {
          success: false,
          error: 'OVERLAPPING_POLICY',
          message: 'Cannot publish policy: overlapping active window detected',
          details: error.message
        };
      }
      
      throw error;
    }
  }
  
  // Idempotent hub capacity profile publish
  async publishHubCapacityProfile(profileData, options = {}) {
    const {
      actorId = 'system',
      changeReason = 'Capacity update',
      publishRequestId = null
    } = options;
    
    try {
      const timestamp = new Date().toISOString();
      const idempotencyKey = this.generateIdempotencyKey(profileData, actorId, timestamp);
      const payloadHash = this.generatePayloadHash(profileData);
      
      const result = await pool.query(`
        SELECT * FROM upsert_capacity_profile(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
      `, [
        profileData.hub_id,
        profileData.version,
        profileData.effective_date || new Date().toISOString(),
        'published',
        profileData.auth_capacity || 0,
        profileData.sewing_capacity || 0,
        profileData.qa_capacity || 0,
        profileData.qa_headcount || 0,
        profileData.qa_shift_minutes || 480,
        profileData.seasonality_multiplier || 1.0,
        profileData.overbooking_percentage || 0.0,
        profileData.leadtime_days || 7,
        profileData.cutoff_hour || 16,
        profileData.weekend_processing || false,
        changeReason,
        actorId,
        idempotencyKey,
        payloadHash,
        publishRequestId
      ]);
      
      const { profile_id, is_duplicate, action_taken } = result.rows[0];
      
      console.log(`Capacity Profile ${action_taken}: ${profile_id} (duplicate: ${is_duplicate})`);
      
      return {
        success: true,
        profileId: profile_id,
        isDuplicate: is_duplicate,
        actionTaken: action_taken,
        idempotencyKey,
        payloadHash
      };
      
    } catch (error) {
      console.error('Error publishing hub capacity profile:', error);
      
      if (error.message.includes('Overlapping active capacity profile')) {
        return {
          success: false,
          error: 'OVERLAPPING_CAPACITY',
          message: 'Cannot publish capacity profile: overlapping active profile for hub',
          details: error.message
        };
      }
      
      throw error;
    }
  }
  
  // Schedule policy for future activation
  async schedulePolicy(policyType, policyData, effectiveAt, options = {}) {
    const {
      actorId = 'system',
      changeReason = 'Scheduled policy update',
      publishRequestId = null
    } = options;
    
    // Validate future effective date
    const effectiveDate = new Date(effectiveAt);
    const now = new Date();
    
    if (effectiveDate <= now) {
      return {
        success: false,
        error: 'INVALID_SCHEDULE_DATE',
        message: 'Effective date must be in the future'
      };
    }
    
    try {
      const timestamp = new Date().toISOString();
      const scheduleData = {
        ...policyData,
        effective_date: effectiveAt,
        state: 'scheduled'
      };
      
      const idempotencyKey = this.generateIdempotencyKey(scheduleData, actorId, timestamp);
      const payloadHash = this.generatePayloadHash(scheduleData);
      
      let result;
      
      switch (policyType) {
        case 'sla_margin':
          result = await pool.query(`
            SELECT * FROM upsert_sla_margin_policy(
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
          `, [
            policyData.policy_id,
            policyData.name,
            policyData.version,
            'scheduled',
            effectiveAt,
            JSON.stringify(policyData.sla_targets),
            JSON.stringify(policyData.margin_thresholds),
            changeReason,
            actorId,
            idempotencyKey,
            payloadHash,
            publishRequestId
          ]);
          break;
          
        case 'risk_threshold':
          result = await pool.query(`
            SELECT * FROM upsert_risk_threshold_policy(
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            )
          `, [
            policyData.policy_id,
            policyData.name,
            policyData.version,
            'scheduled',
            effectiveAt,
            JSON.stringify(policyData.value_bands || []),
            JSON.stringify(policyData.fragility_rules || []),
            JSON.stringify(policyData.brand_overrides || []),
            JSON.stringify(policyData.lane_risks || []),
            JSON.stringify(policyData.inventory_thresholds || {}),
            JSON.stringify(policyData.risk_weights || {}),
            JSON.stringify(policyData.risk_components || {}),
            JSON.stringify(policyData.security_defaults || {}),
            JSON.stringify(policyData.incident_rules || []),
            JSON.stringify(policyData.publishing_scope || {}),
            changeReason,
            actorId,
            idempotencyKey,
            payloadHash,
            publishRequestId
          ]);
          break;
          
        case 'hub_capacity':
          result = await pool.query(`
            SELECT * FROM upsert_capacity_profile(
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
          `, [
            policyData.hub_id,
            policyData.version,
            effectiveAt,
            'scheduled',
            policyData.auth_capacity || 0,
            policyData.sewing_capacity || 0,
            policyData.qa_capacity || 0,
            policyData.qa_headcount || 0,
            policyData.qa_shift_minutes || 480,
            policyData.seasonality_multiplier || 1.0,
            policyData.overbooking_percentage || 0.0,
            policyData.leadtime_days || 7,
            policyData.cutoff_hour || 16,
            policyData.weekend_processing || false,
            changeReason,
            actorId,
            idempotencyKey,
            payloadHash,
            publishRequestId
          ]);
          break;
          
        default:
          throw new Error(`Unknown policy type: ${policyType}`);
      }
      
      const { policy_id, profile_id, is_duplicate, action_taken } = result.rows[0];
      
      console.log(`${policyType} Policy ${action_taken} for ${effectiveAt}: ${policy_id || profile_id} (duplicate: ${is_duplicate})`);
      
      return {
        success: true,
        policyId: policy_id || profile_id,
        isDuplicate: is_duplicate,
        actionTaken: action_taken,
        effectiveAt,
        idempotencyKey,
        payloadHash
      };
      
    } catch (error) {
      console.error(`Error scheduling ${policyType} policy:`, error);
      
      if (error.message.includes('Overlapping active')) {
        return {
          success: false,
          error: 'OVERLAPPING_SCHEDULE',
          message: 'Cannot schedule policy: overlapping with existing active or scheduled policy',
          details: error.message
        };
      }
      
      throw error;
    }
  }
  
  // Check data integrity
  async checkDataIntegrity() {
    try {
      const result = await pool.query('SELECT * FROM check_data_integrity()');
      
      const violations = result.rows.map(row => ({
        checkName: row.check_name,
        violationCount: row.violation_count,
        details: row.details
      }));
      
      const hasViolations = violations.length > 0;
      
      return {
        success: !hasViolations,
        violations,
        summary: hasViolations 
          ? `Found ${violations.length} data integrity violations`
          : 'All data integrity constraints satisfied'
      };
      
    } catch (error) {
      console.error('Error checking data integrity:', error);
      throw error;
    }
  }
  
  // Get active policies summary
  async getActivePoliciesSummary() {
    try {
      const result = await pool.query('SELECT * FROM active_policies_summary ORDER BY policy_type, effective_date DESC');
      
      const summary = {
        sla_margin: [],
        risk_threshold: [],
        hub_capacity: []
      };
      
      result.rows.forEach(row => {
        summary[row.policy_type].push({
          policyId: row.policy_id,
          name: row.name,
          version: row.version,
          state: row.state,
          effectiveDate: row.effective_date,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      });
      
      return {
        success: true,
        summary,
        totalActive: result.rows.length
      };
      
    } catch (error) {
      console.error('Error getting active policies summary:', error);
      throw error;
    }
  }
}

module.exports = new DataIntegrityService();
