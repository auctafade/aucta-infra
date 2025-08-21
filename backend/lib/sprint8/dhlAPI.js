// lib/sprint8/dhlAPI.js
// Express API endpoints for DHL Label Management System

const express = require('express');
const router = express.Router();
const pool = require('../../database/connection');

// ========================================================================================
// DHL LABEL MANAGEMENT ENDPOINTS
// ========================================================================================

/**
 * GET /api/shipments/:shipmentId/dhl/legs
 * Get DHL legs for a planned route
 */
router.get('/shipments/:shipmentId/dhl/legs', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    
    // Get shipment with planned route
    const shipmentResult = await pool.query(`
      SELECT s.*, rp.id as route_plan_id
      FROM shipments s
      JOIN shipment_route_plans rp ON s.id = rp.shipment_id AND rp.is_selected = TRUE
      WHERE s.shipment_id = $1
    `, [shipmentId]);
    
    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SHIPMENT_NOT_FOUND', message: 'Shipment or planned route not found' }
      });
    }
    
    const shipment = shipmentResult.rows[0];
    
    // Get DHL legs from route plan
    const legsResult = await pool.query(`
      SELECT rl.*, 
             'pending' as label_status,
             'fresh' as rate_ttl_status,
             'ready' as validation_status,
             COALESCE(dlm.tracking_number, '') as tracking_number,
             COALESCE(dlm.label_url, '') as label_url,
             COALESCE(dlm.dhl_reference, '') as dhl_reference,
             COALESCE(dlm.service_type, 'standard') as service_type,
             COALESCE(dlm.estimated_transit_days, 
               CASE 
                 WHEN rl.leg_type LIKE '%express%' THEN 1
                 ELSE 3
               END
             ) as estimated_transit_days
      FROM shipment_route_legs rl
      LEFT JOIN dhl_label_management dlm ON rl.id = dlm.route_leg_id
      WHERE rl.route_plan_id = $1 
        AND (rl.leg_type LIKE '%dhl%' OR rl.carrier = 'DHL')
      ORDER BY rl.leg_order
    `, [shipment.route_plan_id]);
    
    // Format legs with proper cost breakdown
    const dhlLegs = legsResult.rows.map(leg => ({
      leg_order: leg.leg_order,
      leg_type: leg.leg_type,
      from_location: leg.from_location,
      to_location: leg.to_location,
      start_date: leg.start_date,
      end_date: leg.end_date,
      leg_cost: parseFloat(leg.leg_cost),
      carrier: leg.carrier || 'DHL',
      service_type: leg.service_type,
      estimated_transit_days: leg.estimated_transit_days,
      label_status: leg.label_status,
      tracking_number: leg.tracking_number,
      label_url: leg.label_url,
      dhl_reference: leg.dhl_reference,
      rate_ttl_status: leg.rate_ttl_status,
      validation_status: leg.validation_status,
      eta_band: calculateETABand(leg.start_date, leg.estimated_transit_days),
      cost_breakdown: {
        base_cost: parseFloat(leg.leg_cost) * 0.8,
        fuel_surcharge: parseFloat(leg.leg_cost) * 0.1,
        remote_area_surcharge: 0,
        insurance_cost: parseFloat(leg.leg_cost) * 0.05,
        signature_cost: 5.00,
        total: parseFloat(leg.leg_cost),
        currency: 'EUR'
      },
      provisional_cost: parseFloat(leg.leg_cost)
    }));
    
    res.json({
      success: true,
      data: {
        shipment: {
          shipment_id: shipment.shipment_id,
          reference_sku: shipment.reference_sku,
          declared_value: parseFloat(shipment.declared_value),
          currency: shipment.currency,
          weight: parseFloat(shipment.weight),
          length_cm: parseFloat(shipment.length_cm),
          width_cm: parseFloat(shipment.width_cm),
          height_cm: parseFloat(shipment.height_cm),
          tier: shipment.tier,
          sender_name: shipment.sender_name,
          buyer_name: shipment.buyer_name,
          sender_city: shipment.sender_city,
          buyer_city: shipment.buyer_city
        },
        dhl_legs: dhlLegs
      }
    });
    
  } catch (error) {
    console.error('Error getting DHL legs:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DHL_LEGS_ERROR', message: error.message }
    });
  }
});

/**
 * POST /api/shipments/:shipmentId/dhl/legs/:legId/purchase
 * Purchase a DHL label for a specific leg
 */
router.post('/shipments/:shipmentId/dhl/legs/:legId/purchase', async (req, res) => {
  try {
    const { shipmentId, legId } = req.params;
    const { options } = req.body;
    
    if (!options) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_OPTIONS', message: 'Label options are required' }
      });
    }
    
    // Start transaction
    const client = await pool.connect();
    await client.query('BEGIN');
    
    try {
      // Get leg details
      const legResult = await client.query(`
        SELECT rl.*, s.shipment_id, s.declared_value
        FROM shipment_route_legs rl
        JOIN shipment_route_plans rp ON rl.route_plan_id = rp.id
        JOIN shipments s ON rp.shipment_id = s.id
        WHERE s.shipment_id = $1 AND rl.leg_order = $2
      `, [shipmentId, legId]);
      
      if (legResult.rows.length === 0) {
        throw new Error('Leg not found');
      }
      
      const leg = legResult.rows[0];
      
      // Simulate DHL API call delay
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));
      
      // Generate tracking number and label reference
      const trackingNumber = `1Z${Date.now().toString().slice(-10)}`;
      const dhlReference = `DHL${Date.now().toString().slice(-8)}`;
      const labelUrl = `/api/labels/${dhlReference}.pdf`;
      
      // Insert or update DHL label management record
      await client.query(`
        INSERT INTO dhl_label_management (
          route_leg_id, shipment_id, leg_order, 
          tracking_number, dhl_reference, label_url,
          service_type, estimated_transit_days,
          label_status, rate_ttl_status,
          service_level, insured_value, signature_required,
          packages, addresses, customs_data,
          pickup_method, pickup_window, label_format,
          cost_breakdown, purchased_at, purchased_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'generated', 'fresh',
          $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
          CURRENT_TIMESTAMP, 'api-user'
        )
        ON CONFLICT (route_leg_id) 
        DO UPDATE SET
          tracking_number = EXCLUDED.tracking_number,
          dhl_reference = EXCLUDED.dhl_reference,
          label_url = EXCLUDED.label_url,
          label_status = 'generated',
          purchased_at = CURRENT_TIMESTAMP
      `, [
        leg.id, leg.shipment_id, leg.leg_order,
        trackingNumber, dhlReference, labelUrl,
        options.serviceLevel || 'standard',
        options.serviceLevel === 'express' ? 1 : 3,
        options.serviceLevel, options.insuredValue || leg.declared_value,
        options.signatureRequired || false,
        JSON.stringify(options.packages || []),
        JSON.stringify(options.addresses || {}),
        JSON.stringify(options.customs || {}),
        options.pickupMethod || 'drop-off',
        JSON.stringify(options.pickupWindow || {}),
        options.labelFormat || 'PDF',
        JSON.stringify({
          base_cost: leg.leg_cost * 0.8,
          fuel_surcharge: leg.leg_cost * 0.1,
          remote_area_surcharge: 0,
          insurance_cost: leg.leg_cost * 0.05,
          signature_cost: 5.00,
          total: leg.leg_cost,
          currency: 'EUR'
        })
      ]);
      
      // Log telemetry event
      await client.query(`
        INSERT INTO dhl_telemetry_events (
          event_type, event_data, shipment_id, leg_id, created_at
        ) VALUES (
          'dhl.label.purchased',
          $1,
          $2, $3, CURRENT_TIMESTAMP
        )
      `, [
        JSON.stringify({
          service: options.serviceLevel,
          cost: leg.leg_cost,
          tracking_number: trackingNumber,
          purchase_time_ms: 800 + Math.random() * 1500
        }),
        leg.shipment_id, legId
      ]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {
          tracking_number: trackingNumber,
          dhl_reference: dhlReference,
          label_url: labelUrl,
          service_type: options.serviceLevel || 'standard',
          estimated_delivery: new Date(Date.now() + (options.serviceLevel === 'express' ? 1 : 3) * 24 * 60 * 60 * 1000),
          cost_breakdown: {
            base_cost: leg.leg_cost * 0.8,
            fuel_surcharge: leg.leg_cost * 0.1,
            remote_area_surcharge: 0,
            insurance_cost: leg.leg_cost * 0.05,
            signature_cost: 5.00,
            total: leg.leg_cost,
            currency: 'EUR'
          }
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error purchasing DHL label:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LABEL_PURCHASE_ERROR', message: error.message }
    });
  }
});

/**
 * POST /api/shipments/:shipmentId/dhl/legs/:legId/void
 * Void a DHL label
 */
router.post('/shipments/:shipmentId/dhl/legs/:legId/void', async (req, res) => {
  try {
    const { shipmentId, legId } = req.params;
    const { reason = 'User requested void' } = req.body;
    
    const client = await pool.connect();
    await client.query('BEGIN');
    
    try {
      // Get label details
      const labelResult = await client.query(`
        SELECT dlm.*, rl.leg_cost
        FROM dhl_label_management dlm
        JOIN shipment_route_legs rl ON dlm.route_leg_id = rl.id
        JOIN shipment_route_plans rp ON rl.route_plan_id = rp.id
        JOIN shipments s ON rp.shipment_id = s.id
        WHERE s.shipment_id = $1 AND rl.leg_order = $2
      `, [shipmentId, legId]);
      
      if (labelResult.rows.length === 0) {
        throw new Error('Label not found');
      }
      
      const label = labelResult.rows[0];
      
      // Check void window (24 hours)
      const hoursElapsed = (Date.now() - new Date(label.purchased_at).getTime()) / (1000 * 60 * 60);
      if (hoursElapsed > 24) {
        throw new Error(`Void window expired. Label created ${Math.round(hoursElapsed)}h ago (DHL allows 24h max)`);
      }
      
      // Update label status
      await client.query(`
        UPDATE dhl_label_management 
        SET label_status = 'voided',
            voided_at = CURRENT_TIMESTAMP,
            void_reason = $1,
            rate_ttl_status = 'stale'
        WHERE id = $2
      `, [reason, label.id]);
      
      // Log audit event
      await client.query(`
        INSERT INTO dhl_audit_logs (
          action, leg_id, tracking_number, dhl_reference,
          original_cost, voided_at, voided_by, reason,
          within_carrier_window, hours_after_creation, session_id
        ) VALUES (
          'LABEL_VOIDED', $1, $2, $3, $4, CURRENT_TIMESTAMP, 'api-user', $5, $6, $7, $8
        )
      `, [
        legId, label.tracking_number, label.dhl_reference,
        label.leg_cost, reason, hoursElapsed <= 24, hoursElapsed, 
        `dhl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      ]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {
          message: `Label voided: ${hoursElapsed.toFixed(1)}h after creation`,
          cost_recovered: parseFloat(label.leg_cost),
          within_window: true
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error voiding DHL label:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LABEL_VOID_ERROR', message: error.message }
    });
  }
});

/**
 * POST /api/shipments/:shipmentId/dhl/legs/:legId/refresh-rate
 * Refresh rate for a DHL leg
 */
router.post('/shipments/:shipmentId/dhl/legs/:legId/refresh-rate', async (req, res) => {
  try {
    const { shipmentId, legId } = req.params;
    
    // Simulate rate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Update rate status in database
    await pool.query(`
      UPDATE dhl_label_management 
      SET rate_ttl_status = 'fresh',
          rate_refreshed_at = CURRENT_TIMESTAMP
      WHERE route_leg_id = (
        SELECT rl.id 
        FROM shipment_route_legs rl
        JOIN shipment_route_plans rp ON rl.route_plan_id = rp.id
        JOIN shipments s ON rp.shipment_id = s.id
        WHERE s.shipment_id = $1 AND rl.leg_order = $2
      )
    `, [shipmentId, legId]);
    
    // Log telemetry
    await pool.query(`
      INSERT INTO dhl_telemetry_events (
        event_type, event_data, shipment_id, leg_id, created_at
      ) VALUES (
        'dhl.rate.refresh',
        $1, $2, $3, CURRENT_TIMESTAMP
      )
    `, [
      JSON.stringify({
        previous_status: 'stale',
        was_forced: true,
        route: `leg ${legId}`
      }),
      shipmentId, legId
    ]);
    
    res.json({
      success: true,
      data: {
        message: 'Rate refreshed successfully',
        rate_status: 'fresh',
        refreshed_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error refreshing rate:', error);
    res.status(500).json({
      success: false,
      error: { code: 'RATE_REFRESH_ERROR', message: error.message }
    });
  }
});

/**
 * POST /api/dhl/telemetry
 * Log DHL telemetry events
 */
router.post('/dhl/telemetry', async (req, res) => {
  try {
    const { eventType, eventData, shipmentId, legId, sessionId } = req.body;
    
    await pool.query(`
      INSERT INTO dhl_telemetry_events (
        event_type, event_data, shipment_id, leg_id, session_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [eventType, JSON.stringify(eventData), shipmentId, legId, sessionId]);
    
    res.json({
      success: true,
      data: { logged: true, timestamp: new Date().toISOString() }
    });
    
  } catch (error) {
    console.error('Error logging DHL telemetry:', error);
    // Don't fail for telemetry errors
    res.json({
      success: true,
      data: { logged: false, error: error.message }
    });
  }
});

// ========================================================================================
// HELPER FUNCTIONS
// ========================================================================================

function calculateETABand(startDate, transitDays) {
  const start = new Date(startDate);
  const end = new Date(start.getTime() + transitDays * 24 * 60 * 60 * 1000);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

module.exports = router;
