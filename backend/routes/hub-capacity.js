// routes/hub-capacity.js
const express = require('express');
const router = express.Router();
const pool = require('../lib/database');

// Helper function to format hub capacity response
function formatCapacityProfile(profile) {
  return {
    id: profile.id,
    hubId: profile.hub_id,
    version: profile.version,
    effectiveDate: profile.effective_date,
    state: profile.state,
    lastEditedBy: profile.last_edited_by,
    lastEditedAt: profile.last_edited_at,
    changeReason: profile.change_reason,
    authCapacity: profile.auth_capacity,
    sewingCapacity: profile.sewing_capacity,
    qaCapacity: profile.qa_capacity,
    qaHeadcount: profile.qa_headcount,
    qaShiftMinutes: profile.qa_shift_minutes,
    workingDays: profile.working_days,
    workingHours: {
      start: profile.working_hours_start,
      end: profile.working_hours_end
    },
    overbookingPercent: parseFloat(profile.overbooking_percent),
    rushBucketPercent: parseFloat(profile.rush_bucket_percent),
    backToBackCutoff: profile.back_to_back_cutoff,
    seasonalityMultipliers: profile.seasonality_multipliers,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
}

// Helper function to emit capacity events
async function emitCapacityEvent(eventType, hubId, entityType, entityId, eventData, actorId, approverId = null) {
  try {
    await pool.query(`
      INSERT INTO capacity_events (event_type, hub_id, entity_type, entity_id, event_data, actor_id, approver_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [eventType, hubId, entityType, entityId, JSON.stringify(eventData), actorId, approverId]);
  } catch (error) {
    console.error('Failed to emit capacity event:', error);
  }
}

// Helper function to record telemetry
async function recordTelemetry(hubId, metricName, metricValue, metricUnit = null, dimensions = null) {
  try {
    await pool.query(`
      INSERT INTO capacity_telemetry (hub_id, metric_name, metric_value, metric_unit, dimensions)
      VALUES ($1, $2, $3, $4, $5)
    `, [hubId, metricName, metricValue, metricUnit, dimensions ? JSON.stringify(dimensions) : null]);
  } catch (error) {
    console.error('Failed to record telemetry:', error);
  }
}

// GET /api/hubs - Get all hubs
router.get('/hubs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, code, name, location, timezone, status, 
             contact_info, created_at, updated_at
      FROM hubs
      ORDER BY code
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hubs'
    });
  }
});

// GET /api/hubs/:hubId/capacity/active - Get active capacity profile for hub
router.get('/hubs/:hubId/capacity/active', async (req, res) => {
  try {
    const { hubId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM capacity_profiles 
      WHERE hub_id = $1 AND state = 'published'
      ORDER BY effective_date DESC
      LIMIT 1
    `, [hubId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active capacity profile found for this hub'
      });
    }

    res.json({
      success: true,
      data: formatCapacityProfile(result.rows[0])
    });
  } catch (error) {
    console.error('Error fetching active capacity profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity profile'
    });
  }
});

// GET /api/hubs/:hubId/capacity/history - Get capacity profile history
router.get('/hubs/:hubId/capacity/history', async (req, res) => {
  try {
    const { hubId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(`
      SELECT * FROM capacity_profiles 
      WHERE hub_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [hubId, limit]);

    res.json({
      success: true,
      data: result.rows.map(formatCapacityProfile)
    });
  } catch (error) {
    console.error('Error fetching capacity history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity history'
    });
  }
});

// POST /api/hubs/:hubId/capacity - Save capacity profile (draft or publish)
router.post('/hubs/:hubId/capacity', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { hubId } = req.params;
    const {
      version,
      state = 'draft',
      authCapacity,
      sewingCapacity,
      qaCapacity,
      qaHeadcount,
      qaShiftMinutes,
      workingDays,
      workingHours,
      overbookingPercent,
      rushBucketPercent,
      backToBackCutoff,
      seasonalityMultipliers,
      changeReason,
      effectiveDate
    } = req.body;

    // Validate required fields
    if (!version || !changeReason || authCapacity === undefined || sewingCapacity === undefined || qaCapacity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: version, changeReason, and capacity values are required'
      });
    }

    // Validate business rules
    if (overbookingPercent > 30) {
      return res.status(400).json({
        success: false,
        error: 'Overbooking percentage cannot exceed 30% by policy'
      });
    }

    if (rushBucketPercent > 20) {
      return res.status(400).json({
        success: false,
        error: 'Rush bucket percentage cannot exceed 20% to avoid starving standard flow'
      });
    }

    // Check for capacity conflicts if publishing
    if (state === 'published') {
      const conflictCheck = await client.query(`
        SELECT sr.shipment_id, sr.slots_reserved, sr.lane
        FROM shipment_reservations sr
        WHERE sr.hub_id = $1 
          AND sr.status = 'active'
          AND sr.reservation_type = 'booking'
          AND (
            (sr.lane = 'auth' AND sr.slots_reserved > $2) OR
            (sr.lane = 'sewing' AND sr.slots_reserved > $3) OR
            (sr.lane = 'qa' AND sr.slots_reserved > $4)
          )
      `, [hubId, authCapacity, sewingCapacity, qaCapacity]);

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: 'Capacity reduction would invalidate existing bookings',
          conflictingBookings: conflictCheck.rows
        });
      }

      // If publishing, unpublish any existing published profile
      await client.query(`
        UPDATE capacity_profiles 
        SET state = 'archived', updated_at = CURRENT_TIMESTAMP
        WHERE hub_id = $1 AND state = 'published'
      `, [hubId]);
    }

    // Insert new capacity profile
    const insertResult = await client.query(`
      INSERT INTO capacity_profiles (
        hub_id, version, effective_date, state,
        auth_capacity, sewing_capacity, qa_capacity, qa_headcount, qa_shift_minutes,
        working_days, working_hours_start, working_hours_end,
        overbooking_percent, rush_bucket_percent, back_to_back_cutoff,
        seasonality_multipliers, last_edited_by, change_reason
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `, [
      hubId, version, effectiveDate || new Date(), state,
      authCapacity, sewingCapacity, qaCapacity, qaHeadcount || 4, qaShiftMinutes || 480,
      workingDays || ['monday','tuesday','wednesday','thursday','friday','saturday'],
      workingHours?.start || '08:00', workingHours?.end || '19:00',
      overbookingPercent || 10, rushBucketPercent || 15, backToBackCutoff || '17:00',
      JSON.stringify(seasonalityMultipliers || {}),
      req.user?.email || 'system', changeReason
    ]);

    const profile = insertResult.rows[0];

    // Emit capacity event
    await emitCapacityEvent(
      state === 'published' ? 'settings.hub_capacity.published' : 'settings.hub_capacity.changed',
      hubId,
      'profile',
      profile.id,
      {
        version: profile.version,
        effectiveAt: profile.effective_date,
        fieldsChanged: ['capacity_profile'],
        scope: state === 'published' ? 'published' : 'draft'
      },
      req.user?.email || 'system'
    );

    // Record telemetry
    await recordTelemetry(hubId, 'hub_capacity.publish.time_ms', Date.now(), 'milliseconds');

    await client.query('COMMIT');

    res.json({
      success: true,
      data: formatCapacityProfile(profile),
      message: state === 'published' ? 'Capacity profile published successfully' : 'Capacity profile saved as draft'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving capacity profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save capacity profile'
    });
  } finally {
    client.release();
  }
});

// GET /api/hubs/:hubId/reservations - Get reservations for hub
router.get('/hubs/:hubId/reservations', async (req, res) => {
  try {
    const { hubId } = req.params;
    const { startDate, endDate, lane } = req.query;
    
    let query = `
      SELECT sr.*, h.name as hub_name, h.code as hub_code
      FROM shipment_reservations sr
      JOIN hubs h ON sr.hub_id = h.id
      WHERE sr.hub_id = $1 AND sr.status = 'active'
    `;
    const params = [hubId];
    
    if (startDate) {
      query += ` AND sr.reservation_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND sr.reservation_date <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    if (lane) {
      query += ` AND sr.lane = $${params.length + 1}`;
      params.push(lane);
    }
    
    query += ` ORDER BY sr.reservation_date, sr.created_at`;
    
    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reservations'
    });
  }
});

// POST /api/hubs/:hubId/reservations - Create reservation
router.post('/hubs/:hubId/reservations', async (req, res) => {
  try {
    const { hubId } = req.params;
    const {
      shipmentId,
      reservationDate,
      lane,
      slotsReserved = 1,
      tier,
      priority = 'standard',
      reservationType,
      qaMinutesRequired = 0,
      isRush = false,
      rushReason
    } = req.body;

    // Validate required fields
    if (!shipmentId || !reservationDate || !lane || !tier || !reservationType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Check capacity availability
    const capacityCheck = await pool.query(`
      WITH daily_usage AS (
        SELECT 
          COALESCE(SUM(slots_reserved), 0) as used_slots,
          COALESCE(SUM(CASE WHEN is_rush THEN slots_reserved ELSE 0 END), 0) as rush_used
        FROM shipment_reservations
        WHERE hub_id = $1 AND reservation_date = $2 AND lane = $3 AND status = 'active'
      ),
      capacity_info AS (
        SELECT auth_capacity, sewing_capacity, qa_capacity, rush_bucket_percent
        FROM capacity_profiles
        WHERE hub_id = $1 AND state = 'published'
      )
      SELECT 
        du.used_slots,
        du.rush_used,
        CASE 
          WHEN $3 = 'auth' THEN ci.auth_capacity
          WHEN $3 = 'sewing' THEN ci.sewing_capacity  
          WHEN $3 = 'qa' THEN ci.qa_capacity
        END as max_capacity,
        ci.rush_bucket_percent
      FROM daily_usage du
      CROSS JOIN capacity_info ci
    `, [hubId, reservationDate, lane]);

    if (capacityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No capacity profile found for this hub'
      });
    }

    const { used_slots, rush_used, max_capacity, rush_bucket_percent } = capacityCheck.rows[0];
    
    // Check if reservation would exceed capacity
    if (used_slots + slotsReserved > max_capacity) {
      return res.status(409).json({
        success: false,
        error: 'Insufficient capacity available',
        available: max_capacity - used_slots,
        requested: slotsReserved
      });
    }

    // Check rush bucket if this is a rush reservation
    if (isRush) {
      const rushCapacity = Math.ceil(max_capacity * (rush_bucket_percent / 100));
      if (rush_used + slotsReserved > rushCapacity) {
        return res.status(409).json({
          success: false,
          error: 'Rush bucket capacity exceeded',
          rushAvailable: rushCapacity - rush_used,
          requested: slotsReserved
        });
      }
    }

    // Create reservation
    const result = await pool.query(`
      INSERT INTO shipment_reservations (
        shipment_id, hub_id, reservation_date, lane, slots_reserved,
        tier, priority, reservation_type, qa_minutes_required,
        is_rush, rush_reason, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      shipmentId, hubId, reservationDate, lane, slotsReserved,
      tier, priority, reservationType, qaMinutesRequired,
      isRush, rushReason, req.user?.email || 'system'
    ]);

    // Emit reservation event
    await emitCapacityEvent(
      'hub_capacity.reservation.created',
      hubId,
      'reservation',
      result.rows[0].id,
      {
        shipmentId,
        reservationDate,
        lane,
        slotsReserved,
        reservationType
      },
      req.user?.email || 'system'
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Reservation created successfully'
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create reservation'
    });
  }
});

// GET /api/hubs/:hubId/capacity/utilization - Get utilization data
router.get('/hubs/:hubId/capacity/utilization', async (req, res) => {
  try {
    const { hubId } = req.params;
    const { startDate, endDate, lane } = req.query;
    
    let query = `
      WITH daily_reservations AS (
        SELECT 
          reservation_date,
          lane,
          SUM(CASE WHEN reservation_type = 'hold' THEN slots_reserved ELSE 0 END) as held,
          SUM(CASE WHEN reservation_type = 'booking' THEN slots_reserved ELSE 0 END) as planned,
          SUM(CASE WHEN reservation_type = 'in_progress' THEN slots_reserved ELSE 0 END) as consumed,
          SUM(CASE WHEN is_rush THEN slots_reserved ELSE 0 END) as rush_used,
          SUM(qa_minutes_required) as qa_minutes_used
        FROM shipment_reservations
        WHERE hub_id = $1 AND status = 'active'
    `;
    
    const params = [hubId];
    
    if (startDate) {
      query += ` AND reservation_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND reservation_date <= $${params.length + 1}`;
      params.push(endDate);
    }
    
    if (lane) {
      query += ` AND lane = $${params.length + 1}`;
      params.push(lane);
    }
    
    query += `
        GROUP BY reservation_date, lane
      ),
      capacity_info AS (
        SELECT auth_capacity, sewing_capacity, qa_capacity, 
               qa_headcount, qa_shift_minutes, overbooking_percent, 
               rush_bucket_percent, seasonality_multipliers
        FROM capacity_profiles
        WHERE hub_id = $1 AND state = 'published'
      )
      SELECT 
        dr.*,
        CASE 
          WHEN dr.lane = 'auth' THEN ci.auth_capacity
          WHEN dr.lane = 'sewing' THEN ci.sewing_capacity
          WHEN dr.lane = 'qa' THEN ci.qa_capacity
        END as base_capacity,
        ci.qa_headcount * ci.qa_shift_minutes as qa_capacity_minutes,
        ci.overbooking_percent,
        ci.rush_bucket_percent,
        ci.seasonality_multipliers
      FROM daily_reservations dr
      CROSS JOIN capacity_info ci
      ORDER BY dr.reservation_date, dr.lane
    `;
    
    const result = await pool.query(query, params);

    // Calculate utilization metrics for each day/lane
    const utilizationData = result.rows.map(row => {
      const seasonalityMultiplier = getSeasonalityMultiplier(row.reservation_date, row.seasonality_multipliers);
      const effectiveCapacity = Math.floor(row.base_capacity * seasonalityMultiplier);
      const maxCapacityWithOverbook = effectiveCapacity * (1 + row.overbooking_percent / 100);
      
      const totalUsed = (row.held || 0) + (row.planned || 0) + (row.consumed || 0);
      const utilization = (totalUsed / maxCapacityWithOverbook) * 100;
      const availableSlots = Math.max(0, effectiveCapacity - (row.held || 0) - (row.planned || 0));
      
      const rushCapacity = Math.ceil(row.base_capacity * (row.rush_bucket_percent / 100));
      const rushAvailable = Math.max(0, rushCapacity - (row.rush_used || 0));
      
      return {
        date: row.reservation_date,
        lane: row.lane,
        held: row.held || 0,
        planned: row.planned || 0,
        consumed: row.consumed || 0,
        rushUsed: row.rush_used || 0,
        qaMinutesUsed: row.qa_minutes_used || 0,
        baseCapacity: row.base_capacity,
        effectiveCapacity,
        seasonalityMultiplier,
        utilization: Math.round(utilization * 10) / 10,
        availableSlots,
        rushAvailable,
        qaCapacityMinutes: row.qa_capacity_minutes || 0
      };
    });

    res.json({
      success: true,
      data: utilizationData
    });

  } catch (error) {
    console.error('Error fetching utilization data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch utilization data'
    });
  }
});

// Helper function to get seasonality multiplier
function getSeasonalityMultiplier(date, seasonalityMultipliers) {
  const month = new Date(date).toLocaleString('en', { month: 'long' }).toLowerCase();
  return seasonalityMultipliers[month] || 1.0;
}

// POST /api/hubs/:hubId/blackouts - Create blackout rule
router.post('/hubs/:hubId/blackouts', async (req, res) => {
  try {
    const { hubId } = req.params;
    const {
      name,
      ruleType,
      startDate,
      endDate,
      recurrenceRule,
      affectedLanes = ['auth', 'sewing', 'qa'],
      reason
    } = req.body;

    const result = await pool.query(`
      INSERT INTO blackout_rules (
        hub_id, name, rule_type, start_date, end_date, 
        recurrence_rule, affected_lanes, reason, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      hubId, name, ruleType, startDate, endDate,
      recurrenceRule, affectedLanes, reason, req.user?.email || 'system'
    ]);

    await emitCapacityEvent(
      'hub_capacity.blackout.created',
      hubId,
      'blackout',
      result.rows[0].id,
      { name, ruleType, startDate, endDate, affectedLanes },
      req.user?.email || 'system'
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Blackout rule created successfully'
    });

  } catch (error) {
    console.error('Error creating blackout rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create blackout rule'
    });
  }
});

// GET /api/hubs/:hubId/events - Get capacity events for audit trail
router.get('/hubs/:hubId/events', async (req, res) => {
  try {
    const { hubId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await pool.query(`
      SELECT * FROM capacity_events
      WHERE hub_id = $1
      ORDER BY timestamp_utc DESC
      LIMIT $2
    `, [hubId, limit]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching capacity events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity events'
    });
  }
});

module.exports = router;
