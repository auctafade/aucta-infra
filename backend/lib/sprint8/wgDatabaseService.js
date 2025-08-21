// backend/lib/sprint8/wgDatabaseService.js
// Database service layer for WG (White-Glove) system

const { Pool } = require('pg');

class WGDatabaseService {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'thiswillnotfade',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'aucta_db',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 5433, // Note: Custom port 5433
    });
  }

  // ====================
  // WG OPERATORS
  // ====================

  async getAllOperators() {
    const query = `
      SELECT 
        id, operator_code, name, email, phone,
        max_value_clearance, languages, area_coverage, vehicle_type,
        rating, total_jobs, successful_jobs, status,
        insurance_policy_number, insurance_expiry, background_check_date,
        special_skills, created_at, updated_at
      FROM wg_operators 
      WHERE status = 'active'
      ORDER BY rating DESC, total_jobs DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getOperatorById(operatorId) {
    const query = `
      SELECT * FROM wg_operators 
      WHERE id = $1
    `;
    
    const result = await this.pool.query(query, [operatorId]);
    return result.rows[0];
  }

  async getCompatibleOperators(shipmentValue, cities, requiredDate) {
    const query = `
      SELECT 
        o.*,
        CASE 
          WHEN o.max_value_clearance >= $1 THEN true 
          ELSE false 
        END as value_compatible,
        CASE 
          WHEN o.area_coverage && $2 THEN true 
          ELSE false 
        END as area_compatible
      FROM wg_operators o
      WHERE o.status = 'active'
        AND (o.max_value_clearance >= $1 OR o.max_value_clearance >= ($1 * 0.8))
        AND o.area_coverage && $2
      ORDER BY 
        (o.max_value_clearance >= $1) DESC,
        o.rating DESC,
        o.total_jobs DESC
    `;
    
    const result = await this.pool.query(query, [shipmentValue, cities]);
    return result.rows;
  }

  async updateOperatorStats(operatorId, jobCompleted, successful) {
    const query = `
      UPDATE wg_operators 
      SET 
        total_jobs = total_jobs + 1,
        successful_jobs = successful_jobs + $2,
        rating = CASE 
          WHEN total_jobs > 0 THEN (successful_jobs::float / total_jobs::float) * 5 
          ELSE 5.0 
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [operatorId, successful ? 1 : 0]);
    return result.rows[0];
  }

  // ====================
  // WG SHIPMENTS
  // ====================

  async createShipment(shipmentData) {
    const query = `
      INSERT INTO wg_shipments (
        shipment_code, product_name, product_category, declared_value, tier_level,
        sender_name, sender_address, sender_phone, sender_time_window, sender_timezone,
        buyer_name, buyer_address, buyer_phone, buyer_time_window, buyer_timezone,
        hub_location, hub_timezone, sla_deadline, priority,
        estimated_distance_km, estimated_duration_minutes, route_legs,
        special_instructions, requires_insurance_verification, requires_liveness_check
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25
      ) RETURNING *
    `;
    
    const values = [
      shipmentData.shipment_code,
      shipmentData.product_name,
      shipmentData.product_category,
      shipmentData.declared_value,
      shipmentData.tier_level,
      shipmentData.sender_name,
      shipmentData.sender_address,
      shipmentData.sender_phone,
      shipmentData.sender_time_window,
      shipmentData.sender_timezone,
      shipmentData.buyer_name,
      shipmentData.buyer_address,
      shipmentData.buyer_phone,
      shipmentData.buyer_time_window,
      shipmentData.buyer_timezone,
      shipmentData.hub_location,
      shipmentData.hub_timezone,
      shipmentData.sla_deadline,
      shipmentData.priority,
      shipmentData.estimated_distance_km,
      shipmentData.estimated_duration_minutes,
      JSON.stringify(shipmentData.route_legs),
      shipmentData.special_instructions,
      shipmentData.requires_insurance_verification,
      shipmentData.requires_liveness_check
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getShipmentById(shipmentId) {
    const query = `
      SELECT s.*, 
        a.id as assignment_id,
        a.operator_id,
        a.status as assignment_status,
        a.pickup_scheduled_at,
        a.hub_arrival_scheduled_at,
        a.hub_departure_scheduled_at,
        a.delivery_scheduled_at,
        a.pickup_otp,
        a.hub_intake_otp,
        a.delivery_otp,
        a.seal_id,
        o.name as operator_name,
        o.phone as operator_phone,
        o.rating as operator_rating
      FROM wg_shipments s
      LEFT JOIN wg_assignments a ON s.id = a.shipment_id
      LEFT JOIN wg_operators o ON a.operator_id = o.id
      WHERE s.id = $1
    `;
    
    const result = await this.pool.query(query, [shipmentId]);
    return result.rows[0];
  }

  async getShipmentByCode(shipmentCode) {
    const query = `
      SELECT * FROM wg_shipments 
      WHERE shipment_code = $1
    `;
    
    const result = await this.pool.query(query, [shipmentCode]);
    return result.rows[0];
  }

  async getPendingShipments() {
    const query = `
      SELECT s.*, 
        COUNT(o.id) as compatible_operators
      FROM wg_shipments s
      LEFT JOIN wg_operators o ON (
        o.status = 'active' AND 
        o.max_value_clearance >= s.declared_value
      )
      WHERE s.status = 'pending_assignment'
      GROUP BY s.id
      ORDER BY s.priority DESC, s.sla_deadline ASC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  async updateShipmentStatus(shipmentId, status) {
    const query = `
      UPDATE wg_shipments 
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [shipmentId, status]);
    return result.rows[0];
  }

  // ====================
  // WG ASSIGNMENTS
  // ====================

  async createAssignment(assignmentData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create assignment
      const assignmentQuery = `
        INSERT INTO wg_assignments (
          shipment_id, operator_id, assigned_by, assignment_type,
          pickup_scheduled_at, hub_arrival_scheduled_at, 
          hub_departure_scheduled_at, delivery_scheduled_at,
          pickup_otp, hub_intake_otp, delivery_otp, seal_id,
          liveness_check_pickup, liveness_check_hub, liveness_check_delivery
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      const assignmentValues = [
        assignmentData.shipment_id,
        assignmentData.operator_id,
        assignmentData.assigned_by,
        assignmentData.assignment_type || 'direct',
        assignmentData.pickup_scheduled_at,
        assignmentData.hub_arrival_scheduled_at,
        assignmentData.hub_departure_scheduled_at,
        assignmentData.delivery_scheduled_at,
        assignmentData.pickup_otp,
        assignmentData.hub_intake_otp,
        assignmentData.delivery_otp,
        assignmentData.seal_id,
        assignmentData.liveness_check_pickup || false,
        assignmentData.liveness_check_hub || false,
        assignmentData.liveness_check_delivery || false
      ];
      
      const assignmentResult = await client.query(assignmentQuery, assignmentValues);
      
      // Update shipment status
      await client.query(
        'UPDATE wg_shipments SET status = $1 WHERE id = $2',
        ['assigned', assignmentData.shipment_id]
      );
      
      await client.query('COMMIT');
      return assignmentResult.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAssignmentById(assignmentId) {
    const query = `
      SELECT a.*, s.*, o.name as operator_name, o.phone as operator_phone
      FROM wg_assignments a
      JOIN wg_shipments s ON a.shipment_id = s.id
      JOIN wg_operators o ON a.operator_id = o.id
      WHERE a.id = $1
    `;
    
    const result = await this.pool.query(query, [assignmentId]);
    return result.rows[0];
  }

  async updateAssignmentStatus(assignmentId, status, actualTimestamp = null) {
    const query = `
      UPDATE wg_assignments 
      SET 
        status = $2,
        ${actualTimestamp ? `
          actual_pickup_at = CASE WHEN $2 = 'pickup_completed' THEN $3 ELSE actual_pickup_at END,
          actual_hub_arrival_at = CASE WHEN $2 = 'at_hub' THEN $3 ELSE actual_hub_arrival_at END,
          actual_hub_departure_at = CASE WHEN $2 = 'departed_hub' THEN $3 ELSE actual_hub_departure_at END,
          actual_delivery_at = CASE WHEN $2 = 'delivered' THEN $3 ELSE actual_delivery_at END,
        ` : ''}
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = actualTimestamp ? [assignmentId, status, actualTimestamp] : [assignmentId, status];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ====================
  // HUB CAPACITY MANAGEMENT
  // ====================

  async getHubCapacity(hubLocation, date, tierLevel) {
    const query = `
      SELECT * FROM hub_capacity_slots 
      WHERE hub_location = $1 
        AND slot_date = $2 
        AND tier_level = $3
        AND is_available = true
        AND (held_until IS NULL OR held_until < CURRENT_TIMESTAMP)
      ORDER BY start_time
    `;
    
    const result = await this.pool.query(query, [hubLocation, date, tierLevel]);
    return result.rows;
  }

  async holdHubCapacity(slotId, shipmentId, holdDurationMinutes = 120) {
    const query = `
      UPDATE hub_capacity_slots 
      SET 
        held_until = CURRENT_TIMESTAMP + INTERVAL '${holdDurationMinutes} minutes',
        held_for_shipment_id = $2,
        current_bookings = current_bookings + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND current_bookings < max_capacity
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [slotId, shipmentId]);
    return result.rows[0];
  }

  async releaseHubCapacity(slotId) {
    const query = `
      UPDATE hub_capacity_slots 
      SET 
        held_until = NULL,
        held_for_shipment_id = NULL,
        current_bookings = GREATEST(current_bookings - 1, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [slotId]);
    return result.rows[0];
  }

  // ====================
  // SOURCING PIPELINE
  // ====================

  async createSourcingRequest(requestData) {
    const query = `
      INSERT INTO wg_sourcing_requests (
        shipment_id, requested_by, sla_target_at,
        required_cities, min_value_clearance, max_distance_km, urgency_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      requestData.shipment_id,
      requestData.requested_by,
      requestData.sla_target_at,
      requestData.required_cities,
      requestData.min_value_clearance,
      requestData.max_distance_km,
      requestData.urgency_level
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async updateSourcingStatus(requestId, status, timeToAssignMs = null, operatorId = null) {
    const query = `
      UPDATE wg_sourcing_requests 
      SET 
        status = $2,
        ${timeToAssignMs ? 'time_to_assign_ms = $3,' : ''}
        ${operatorId ? 'assigned_operator_id = $4,' : ''}
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [requestId, status];
    if (timeToAssignMs) values.push(timeToAssignMs);
    if (operatorId) values.push(operatorId);
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async escalateSourcing(requestId, reason, channel) {
    const query = `
      UPDATE wg_sourcing_requests 
      SET 
        status = 'escalated',
        escalated_at = CURRENT_TIMESTAMP,
        escalation_reason = $2,
        escalation_channel = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [requestId, reason, channel]);
    return result.rows[0];
  }

  // ====================
  // TELEMETRY AND ANALYTICS
  // ====================

  async logTelemetryEvent(eventData) {
    const query = `
      INSERT INTO wg_telemetry_events (
        event_type, shipment_id, operator_id, user_id, session_id,
        event_data, duration_ms, score_value, user_agent, ip_address, referrer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      eventData.event_type,
      eventData.shipment_id,
      eventData.operator_id,
      eventData.user_id,
      eventData.session_id,
      JSON.stringify(eventData.event_data),
      eventData.duration_ms,
      eventData.score_value,
      eventData.user_agent,
      eventData.ip_address,
      eventData.referrer
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getPerformanceMetrics(startDate, endDate) {
    const query = `
      SELECT 
        metric_date,
        SUM(total_assignments) as total_assignments,
        AVG(avg_assignment_time_ms) as avg_assignment_time_ms,
        SUM(assignments_under_2min) as assignments_under_2min,
        SUM(assignments_over_5min) as assignments_over_5min,
        SUM(total_conflicts) as total_conflicts,
        SUM(window_conflicts) as window_conflicts,
        SUM(travel_conflicts) as travel_conflicts,
        SUM(hub_conflicts) as hub_conflicts,
        SUM(calendar_conflicts) as calendar_conflicts,
        AVG(avg_operator_score) as avg_operator_score,
        SUM(sla_met_count) as sla_met_count,
        SUM(sla_missed_count) as sla_missed_count
      FROM wg_performance_metrics
      WHERE metric_date >= $1 AND metric_date <= $2
      GROUP BY metric_date
      ORDER BY metric_date
    `;
    
    const result = await this.pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  async updatePerformanceMetrics(date, hour, metrics) {
    const query = `
      INSERT INTO wg_performance_metrics (
        metric_date, metric_hour,
        total_assignments, avg_assignment_time_ms,
        assignments_under_2min, assignments_over_5min,
        total_conflicts, window_conflicts, travel_conflicts, hub_conflicts, calendar_conflicts,
        avg_operator_score, operator_utilization_rate,
        sla_met_count, sla_missed_count, avg_sla_margin_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (metric_date, metric_hour) 
      DO UPDATE SET
        total_assignments = EXCLUDED.total_assignments,
        avg_assignment_time_ms = EXCLUDED.avg_assignment_time_ms,
        assignments_under_2min = EXCLUDED.assignments_under_2min,
        assignments_over_5min = EXCLUDED.assignments_over_5min,
        total_conflicts = EXCLUDED.total_conflicts,
        window_conflicts = EXCLUDED.window_conflicts,
        travel_conflicts = EXCLUDED.travel_conflicts,
        hub_conflicts = EXCLUDED.hub_conflicts,
        calendar_conflicts = EXCLUDED.calendar_conflicts,
        avg_operator_score = EXCLUDED.avg_operator_score,
        operator_utilization_rate = EXCLUDED.operator_utilization_rate,
        sla_met_count = EXCLUDED.sla_met_count,
        sla_missed_count = EXCLUDED.sla_missed_count,
        avg_sla_margin_minutes = EXCLUDED.avg_sla_margin_minutes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      date, hour,
      metrics.total_assignments, metrics.avg_assignment_time_ms,
      metrics.assignments_under_2min, metrics.assignments_over_5min,
      metrics.total_conflicts, metrics.window_conflicts, 
      metrics.travel_conflicts, metrics.hub_conflicts, metrics.calendar_conflicts,
      metrics.avg_operator_score, metrics.operator_utilization_rate,
      metrics.sla_met_count, metrics.sla_missed_count, metrics.avg_sla_margin_minutes
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ====================
  // CONSTRAINT VALIDATION
  // ====================

  async logConstraintViolation(constraintData) {
    const query = `
      INSERT INTO wg_constraint_logs (
        shipment_id, assignment_id, constraint_type, constraint_description,
        violation_severity, resolution_action, resolved_by,
        is_override, override_reason, override_authorized_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      constraintData.shipment_id,
      constraintData.assignment_id,
      constraintData.constraint_type,
      constraintData.constraint_description,
      constraintData.violation_severity,
      constraintData.resolution_action,
      constraintData.resolved_by,
      constraintData.is_override || false,
      constraintData.override_reason,
      constraintData.override_authorized_by
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ====================
  // AUDIT TRAIL
  // ====================

  async logAuditAction(auditData) {
    const query = `
      INSERT INTO wg_audit_trail (
        action_type, user_id, user_role, session_id,
        shipment_id, operator_id, action_details, target_resource,
        success, failure_reason, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      auditData.action_type,
      auditData.user_id,
      auditData.user_role,
      auditData.session_id,
      auditData.shipment_id,
      auditData.operator_id,
      JSON.stringify(auditData.action_details),
      auditData.target_resource,
      auditData.success !== false,
      auditData.failure_reason,
      auditData.ip_address,
      auditData.user_agent
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getAuditLogs(filters = {}) {
    let query = `
      SELECT * FROM wg_audit_trail 
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 0;

    if (filters.user_id) {
      query += ` AND user_id = $${++paramCount}`;
      values.push(filters.user_id);
    }

    if (filters.action_type) {
      query += ` AND action_type = $${++paramCount}`;
      values.push(filters.action_type);
    }

    if (filters.shipment_id) {
      query += ` AND shipment_id = $${++paramCount}`;
      values.push(filters.shipment_id);
    }

    if (filters.start_date) {
      query += ` AND created_at >= $${++paramCount}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND created_at <= $${++paramCount}`;
      values.push(filters.end_date);
    }

    query += ` ORDER BY created_at DESC LIMIT ${filters.limit || 100}`;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  // ====================
  // UTILITY METHODS
  // ====================

  async generateOTPCode() {
    // Generate 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async generateSealId() {
    // Generate unique seal ID
    const prefix = 'SEAL';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  async healthCheck() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return { status: 'healthy', timestamp: result.rows[0].now };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = WGDatabaseService;
