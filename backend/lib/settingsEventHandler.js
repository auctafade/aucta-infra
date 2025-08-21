// Settings Event Handler - Backend event processing with audit trail
// Ensures one and only one event per confirmed action; replay safe

const { pool } = require('../database/connection');
const crypto = require('crypto');

// Event specification validation
const VALID_EVENT_TYPES = [
  'settings.sla.updated',
  'settings.margin.updated', 
  'settings.policy.published',
  'settings.hub_capacity.published',
  'hub_capacity.changed',
  'settings.thresholds.updated',
  'settings.riskmodel.updated'
];

// Required fields per event type
const EVENT_FIELD_REQUIREMENTS = {
  'settings.sla.updated': ['actorId', 'version', 'effectiveAt', 'fieldsChanged'],
  'settings.margin.updated': ['actorId', 'version', 'effectiveAt', 'fieldsChanged'],
  'settings.policy.published': ['actorId', 'version', 'effectiveAt'],
  'settings.hub_capacity.published': ['actorId', 'version', 'effectiveAt'],
  'hub_capacity.changed': ['actorId', 'fieldsChanged'],
  'settings.thresholds.updated': ['actorId', 'version', 'effectiveAt', 'fieldsChanged'],
  'settings.riskmodel.updated': ['actorId', 'version', 'effectiveAt', 'fieldsChanged']
};

class SettingsEventHandler {
  
  // Validate event structure per specification
  validateEvent(event) {
    const errors = [];
    
    // Check event type
    if (!VALID_EVENT_TYPES.includes(event.eventType)) {
      errors.push(`Invalid event type: ${event.eventType}`);
    }
    
    // Check required fields
    const requiredFields = EVENT_FIELD_REQUIREMENTS[event.eventType] || [];
    for (const field of requiredFields) {
      if (!event[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate timestamp format
    if (event.ts && !this.isValidISOTimestamp(event.ts)) {
      errors.push(`Invalid timestamp format: ${event.ts}`);
    }
    
    // Validate correlation ID format
    if (event.correlationId && !this.isValidUUID(event.correlationId)) {
      errors.push(`Invalid correlation ID format: ${event.correlationId}`);
    }
    
    return errors;
  }
  
  isValidISOTimestamp(timestamp) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(timestamp);
  }
  
  isValidUUID(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  }
  
  // Check for duplicate events based on payload hash
  async isDuplicateEvent(payloadHash) {
    try {
      const result = await pool.query(
        'SELECT id FROM settings_events WHERE payload_hash = $1 LIMIT 1',
        [payloadHash]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking duplicate event:', error);
      return false; // Fail open - allow event if check fails
    }
  }
  
  // Calculate state diff for audit trail
  calculateStateDiff(preState, postState) {
    const diff = {
      added: {},
      modified: {},
      removed: {}
    };
    
    if (!preState && !postState) return diff;
    
    const pre = preState || {};
    const post = postState || {};
    
    // Find added and modified fields
    for (const [key, value] of Object.entries(post)) {
      if (!(key in pre)) {
        diff.added[key] = value;
      } else if (JSON.stringify(pre[key]) !== JSON.stringify(value)) {
        diff.modified[key] = {
          from: pre[key],
          to: value
        };
      }
    }
    
    // Find removed fields
    for (const key of Object.keys(pre)) {
      if (!(key in post)) {
        diff.removed[key] = pre[key];
      }
    }
    
    return diff;
  }
  
  // Store event in appropriate table based on type
  async storeEvent(event, clientIp) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check for duplicate
      const isDuplicate = await this.isDuplicateEvent(event.payloadHash);
      if (isDuplicate) {
        await client.query('ROLLBACK');
        return {
          success: true,
          skipped: true,
          reason: 'Duplicate event prevented by idempotency check',
          eventId: event.eventId
        };
      }
      
      // Calculate state diff for audit
      const stateDiff = this.calculateStateDiff(event.preState, event.postState);
      
      // Store in main events table
      const eventResult = await client.query(`
        INSERT INTO settings_events (
          event_id, event_type, payload_hash, correlation_id,
          actor_id, version, effective_at, fields_changed, shipment_id,
          timestamp_utc, session_id, user_agent, client_ip,
          payload, pre_state, post_state, state_diff
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING id
      `, [
        event.eventId,
        event.eventType,
        event.payloadHash,
        event.correlationId,
        event.actorId,
        event.version,
        event.effectiveAt,
        event.fieldsChanged,
        event.shipmentId,
        event.ts,
        event.sessionId,
        event.userAgent,
        clientIp,
        JSON.stringify(event.payload),
        JSON.stringify(event.preState),
        JSON.stringify(event.postState),
        JSON.stringify(stateDiff)
      ]);
      
      const settingsEventId = eventResult.rows[0].id;
      
      // Store in specific table based on event type
      if (event.eventType.startsWith('settings.sla.') || event.eventType.startsWith('settings.margin.') || 
          (event.eventType === 'settings.policy.published' && event.payload?.policyType === 'sla_margin')) {
        
        await client.query(`
          INSERT INTO policy_events (
            event_id, event_type, policy_id, actor_id, version, effective_at,
            fields_changed, shipment_id, timestamp_utc, session_id, event_payload
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          event.eventId,
          event.eventType,
          event.payload?.policyId || `policy-${Date.now()}`,
          event.actorId,
          event.version,
          event.effectiveAt,
          event.fieldsChanged,
          event.shipmentId,
          event.ts,
          event.sessionId,
          JSON.stringify(event.payload)
        ]);
        
      } else if (event.eventType.startsWith('settings.hub_capacity.') || event.eventType.startsWith('hub_capacity.')) {
        
        await client.query(`
          INSERT INTO capacity_events (
            event_type, hub_id, entity_type, entity_id, event_data,
            actor_id, timestamp_utc
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          event.eventType,
          event.payload?.hubId || 1,
          event.payload?.changeType || 'profile',
          event.payload?.entityId || null,
          JSON.stringify({
            ...event.payload,
            eventId: event.eventId,
            correlationId: event.correlationId,
            fieldsChanged: event.fieldsChanged,
            stateDiff
          }),
          event.actorId,
          event.ts
        ]);
        
      } else if (event.eventType.startsWith('settings.thresholds.') || event.eventType.startsWith('settings.riskmodel.') ||
                 (event.eventType === 'settings.policy.published' && event.payload?.policyType === 'risk_threshold')) {
        
        await client.query(`
          INSERT INTO risk_policy_events (
            event_id, event_type, policy_id, actor_id, version, effective_at,
            fields_changed, shipment_id, timestamp_utc, session_id, event_payload
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          event.eventId,
          event.eventType,
          event.payload?.policyId || `risk-policy-${Date.now()}`,
          event.actorId,
          event.version,
          event.effectiveAt,
          event.fieldsChanged,
          event.shipmentId,
          event.ts,
          event.sessionId,
          JSON.stringify(event.payload)
        ]);
      }
      
      // Store audit trail
      await client.query(`
        INSERT INTO audit_trail (
          action_category, action_type, resource_type, resource_id,
          old_values, new_values, admin_user, timestamp, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'settings',
        event.eventType,
        event.eventType.split('.')[1], // sla, margin, hub_capacity, etc.
        event.payload?.policyId || event.payload?.hubId || 'unknown',
        event.preState,
        event.postState,
        event.actorId,
        event.ts,
        clientIp
      ]);
      
      await client.query('COMMIT');
      
      console.log(`✅ Event stored successfully: ${event.eventType} (${event.eventId.substring(0, 8)})`);
      
      return {
        success: true,
        eventId: event.eventId,
        settingsEventId,
        stateDiff
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error storing event:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get audit trail for a resource
  async getAuditTrail(resourceType, resourceId, limit = 50) {
    try {
      const result = await pool.query(`
        SELECT 
          at.*,
          se.correlation_id,
          se.session_id,
          se.fields_changed,
          se.state_diff
        FROM audit_trail at
        LEFT JOIN settings_events se ON at.action_type = se.event_type 
          AND at.timestamp = se.timestamp_utc
        WHERE at.resource_type = $1 AND at.resource_id = $2
        ORDER BY at.timestamp DESC
        LIMIT $3
      `, [resourceType, resourceId, limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        actionCategory: row.action_category,
        actionType: row.action_type,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        adminUser: row.admin_user,
        timestamp: row.timestamp,
        ipAddress: row.ip_address,
        correlationId: row.correlation_id,
        sessionId: row.session_id,
        fieldsChanged: row.fields_changed,
        stateDiff: row.state_diff
      }));
      
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      throw error;
    }
  }
  
  // Get events by correlation ID for tracking related actions
  async getEventsByCorrelationId(correlationId) {
    try {
      const result = await pool.query(
        'SELECT * FROM settings_events WHERE correlation_id = $1 ORDER BY timestamp_utc ASC',
        [correlationId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching events by correlation ID:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new SettingsEventHandler();
