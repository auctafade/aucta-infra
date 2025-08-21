// backend/lib/sprint8/wgAPI.js
// REST API endpoints for WG (White-Glove) system

const express = require('express');
const WGDatabaseService = require('./wgDatabaseService');

class WGAPIService {
  constructor() {
    this.router = express.Router();
    this.db = new WGDatabaseService();
    this.setupRoutes();
  }

  setupRoutes() {
    // ====================
    // WG OPERATORS ENDPOINTS
    // ====================

    // GET /api/wg/operators - Get all operators
    this.router.get('/operators', async (req, res) => {
      try {
        const { minValue, cities, available } = req.query;
        
        let operators;
        if (minValue && cities) {
          const citiesArray = Array.isArray(cities) ? cities : cities.split(',');
          operators = await this.db.getCompatibleOperators(
            parseInt(minValue), 
            citiesArray, 
            available
          );
        } else {
          operators = await this.db.getAllOperators();
        }

        // Log API access
        await this.logAuditAction(req, 'wg.operators.list', { 
          count: operators.length,
          filters: { minValue, cities, available }
        });

        res.json({
          success: true,
          data: operators,
          count: operators.length
        });
      } catch (error) {
        console.error('Error fetching operators:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch operators',
          message: error.message
        });
      }
    });

    // GET /api/wg/operators/:id - Get operator by ID
    this.router.get('/operators/:id', async (req, res) => {
      try {
        const operator = await this.db.getOperatorById(req.params.id);
        
        if (!operator) {
          return res.status(404).json({
            success: false,
            error: 'Operator not found'
          });
        }

        await this.logAuditAction(req, 'wg.operator.view', { 
          operator_id: req.params.id 
        });

        res.json({
          success: true,
          data: operator
        });
      } catch (error) {
        console.error('Error fetching operator:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch operator',
          message: error.message
        });
      }
    });

    // ====================
    // WG SHIPMENTS ENDPOINTS
    // ====================

    // GET /api/wg/shipments/pending - Get pending shipments
    this.router.get('/shipments/pending', async (req, res) => {
      try {
        const shipments = await this.db.getPendingShipments();

        await this.logAuditAction(req, 'wg.shipments.list', { 
          status: 'pending',
          count: shipments.length 
        });

        res.json({
          success: true,
          data: shipments,
          count: shipments.length
        });
      } catch (error) {
        console.error('Error fetching pending shipments:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch pending shipments',
          message: error.message
        });
      }
    });

    // GET /api/wg/shipments/:id - Get shipment by ID
    this.router.get('/shipments/:id', async (req, res) => {
      try {
        const shipment = await this.db.getShipmentById(req.params.id);
        
        if (!shipment) {
          return res.status(404).json({
            success: false,
            error: 'Shipment not found'
          });
        }

        await this.logAuditAction(req, 'wg.shipment.view', { 
          shipment_id: req.params.id 
        });

        res.json({
          success: true,
          data: shipment
        });
      } catch (error) {
        console.error('Error fetching shipment:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch shipment',
          message: error.message
        });
      }
    });

    // GET /api/wg/shipments/code/:code - Get shipment by code
    this.router.get('/shipments/code/:code', async (req, res) => {
      try {
        const shipment = await this.db.getShipmentByCode(req.params.code);
        
        if (!shipment) {
          return res.status(404).json({
            success: false,
            error: 'Shipment not found'
          });
        }

        await this.logAuditAction(req, 'wg.shipment.view', { 
          shipment_code: req.params.code 
        });

        res.json({
          success: true,
          data: shipment
        });
      } catch (error) {
        console.error('Error fetching shipment by code:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch shipment',
          message: error.message
        });
      }
    });

    // POST /api/wg/shipments - Create new shipment
    this.router.post('/shipments', async (req, res) => {
      try {
        const shipmentData = req.body;
        
        // Validate required fields
        const requiredFields = ['shipment_code', 'product_name', 'declared_value', 'tier_level', 'sla_deadline'];
        for (const field of requiredFields) {
          if (!shipmentData[field]) {
            return res.status(400).json({
              success: false,
              error: `Missing required field: ${field}`
            });
          }
        }

        const shipment = await this.db.createShipment(shipmentData);

        await this.logAuditAction(req, 'wg.shipment.create', { 
          shipment_id: shipment.id,
          shipment_code: shipment.shipment_code,
          declared_value: shipment.declared_value
        });

        res.status(201).json({
          success: true,
          data: shipment
        });
      } catch (error) {
        console.error('Error creating shipment:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create shipment',
          message: error.message
        });
      }
    });

    // ====================
    // WG ASSIGNMENTS ENDPOINTS
    // ====================

    // POST /api/wg/assignments - Create assignment
    this.router.post('/assignments', async (req, res) => {
      try {
        const assignmentData = req.body;
        
        // Validate required fields
        const requiredFields = ['shipment_id', 'operator_id', 'assigned_by'];
        for (const field of requiredFields) {
          if (!assignmentData[field]) {
            return res.status(400).json({
              success: false,
              error: `Missing required field: ${field}`
            });
          }
        }

        // Generate OTP codes
        assignmentData.pickup_otp = await this.db.generateOTPCode();
        assignmentData.hub_intake_otp = await this.db.generateOTPCode();
        assignmentData.delivery_otp = await this.db.generateOTPCode();
        
        // Generate seal ID for Tier 2/3
        const shipment = await this.db.getShipmentById(assignmentData.shipment_id);
        if (shipment && shipment.tier_level >= 2) {
          assignmentData.seal_id = await this.db.generateSealId();
        }

        const assignment = await this.db.createAssignment(assignmentData);

        await this.logAuditAction(req, 'wg.assignment.create', { 
          assignment_id: assignment.id,
          shipment_id: assignment.shipment_id,
          operator_id: assignment.operator_id
        });

        // Log telemetry event
        await this.db.logTelemetryEvent({
          event_type: 'wg.assigned',
          shipment_id: assignment.shipment_id,
          operator_id: assignment.operator_id,
          user_id: assignmentData.assigned_by,
          session_id: req.headers['x-session-id'],
          event_data: {
            assignment_id: assignment.id,
            pickup_at: assignment.pickup_scheduled_at,
            hub_intake_at: assignment.hub_arrival_scheduled_at,
            delivery_at: assignment.delivery_scheduled_at
          },
          user_agent: req.headers['user-agent'],
          ip_address: req.ip
        });

        res.status(201).json({
          success: true,
          data: assignment
        });
      } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create assignment',
          message: error.message
        });
      }
    });

    // GET /api/wg/assignments/:id - Get assignment by ID
    this.router.get('/assignments/:id', async (req, res) => {
      try {
        const assignment = await this.db.getAssignmentById(req.params.id);
        
        if (!assignment) {
          return res.status(404).json({
            success: false,
            error: 'Assignment not found'
          });
        }

        await this.logAuditAction(req, 'wg.assignment.view', { 
          assignment_id: req.params.id 
        });

        res.json({
          success: true,
          data: assignment
        });
      } catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch assignment',
          message: error.message
        });
      }
    });

    // PUT /api/wg/assignments/:id/status - Update assignment status
    this.router.put('/assignments/:id/status', async (req, res) => {
      try {
        const { status } = req.body;
        
        if (!status) {
          return res.status(400).json({
            success: false,
            error: 'Status is required'
          });
        }

        const assignment = await this.db.updateAssignmentStatus(
          req.params.id, 
          status, 
          new Date()
        );

        await this.logAuditAction(req, 'wg.assignment.status_update', { 
          assignment_id: req.params.id,
          new_status: status
        });

        res.json({
          success: true,
          data: assignment
        });
      } catch (error) {
        console.error('Error updating assignment status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update assignment status',
          message: error.message
        });
      }
    });

    // ====================
    // HUB CAPACITY ENDPOINTS
    // ====================

    // GET /api/wg/hub/capacity - Get hub capacity
    this.router.get('/hub/capacity', async (req, res) => {
      try {
        const { hub_location, date, tier_level } = req.query;
        
        if (!hub_location || !date || !tier_level) {
          return res.status(400).json({
            success: false,
            error: 'hub_location, date, and tier_level are required'
          });
        }

        const capacity = await this.db.getHubCapacity(hub_location, date, parseInt(tier_level));

        res.json({
          success: true,
          data: capacity,
          count: capacity.length
        });
      } catch (error) {
        console.error('Error fetching hub capacity:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch hub capacity',
          message: error.message
        });
      }
    });

    // POST /api/wg/hub/capacity/:id/hold - Hold capacity slot
    this.router.post('/hub/capacity/:id/hold', async (req, res) => {
      try {
        const { shipment_id, hold_duration_minutes } = req.body;
        
        if (!shipment_id) {
          return res.status(400).json({
            success: false,
            error: 'shipment_id is required'
          });
        }

        const slot = await this.db.holdHubCapacity(
          req.params.id, 
          shipment_id, 
          hold_duration_minutes
        );

        if (!slot) {
          return res.status(409).json({
            success: false,
            error: 'Capacity slot not available or already at max capacity'
          });
        }

        await this.logAuditAction(req, 'wg.hub.capacity_hold', { 
          slot_id: req.params.id,
          shipment_id
        });

        res.json({
          success: true,
          data: slot
        });
      } catch (error) {
        console.error('Error holding hub capacity:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to hold hub capacity',
          message: error.message
        });
      }
    });

    // DELETE /api/wg/hub/capacity/:id/hold - Release capacity hold
    this.router.delete('/hub/capacity/:id/hold', async (req, res) => {
      try {
        const slot = await this.db.releaseHubCapacity(req.params.id);

        await this.logAuditAction(req, 'wg.hub.capacity_release', { 
          slot_id: req.params.id
        });

        res.json({
          success: true,
          data: slot
        });
      } catch (error) {
        console.error('Error releasing hub capacity:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to release hub capacity',
          message: error.message
        });
      }
    });

    // ====================
    // SOURCING ENDPOINTS
    // ====================

    // POST /api/wg/sourcing/requests - Create sourcing request
    this.router.post('/sourcing/requests', async (req, res) => {
      try {
        const requestData = req.body;
        
        const requiredFields = ['shipment_id', 'requested_by', 'sla_target_at', 'required_cities', 'min_value_clearance'];
        for (const field of requiredFields) {
          if (!requestData[field]) {
            return res.status(400).json({
              success: false,
              error: `Missing required field: ${field}`
            });
          }
        }

        const request = await this.db.createSourcingRequest(requestData);

        await this.logAuditAction(req, 'wg.sourcing.create', { 
          request_id: request.id,
          shipment_id: request.shipment_id
        });

        // Log telemetry event
        await this.db.logTelemetryEvent({
          event_type: 'wg.sourcing.started',
          shipment_id: request.shipment_id,
          user_id: request.requested_by,
          session_id: req.headers['x-session-id'],
          event_data: {
            request_id: request.id,
            sla_target_at: request.sla_target_at,
            required_cities: request.required_cities,
            min_value_clearance: request.min_value_clearance
          },
          user_agent: req.headers['user-agent'],
          ip_address: req.ip
        });

        res.status(201).json({
          success: true,
          data: request
        });
      } catch (error) {
        console.error('Error creating sourcing request:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create sourcing request',
          message: error.message
        });
      }
    });

    // PUT /api/wg/sourcing/requests/:id/escalate - Escalate sourcing
    this.router.put('/sourcing/requests/:id/escalate', async (req, res) => {
      try {
        const { reason, channel } = req.body;
        
        if (!reason || !channel) {
          return res.status(400).json({
            success: false,
            error: 'reason and channel are required'
          });
        }

        const request = await this.db.escalateSourcing(req.params.id, reason, channel);

        await this.logAuditAction(req, 'wg.sourcing.escalate', { 
          request_id: req.params.id,
          reason,
          channel
        });

        // Log telemetry event
        await this.db.logTelemetryEvent({
          event_type: 'wg.sourcing.escalated',
          user_id: req.body.user_id || 'system',
          session_id: req.headers['x-session-id'],
          event_data: {
            request_id: req.params.id,
            reason,
            channel
          },
          user_agent: req.headers['user-agent'],
          ip_address: req.ip
        });

        res.json({
          success: true,
          data: request
        });
      } catch (error) {
        console.error('Error escalating sourcing:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to escalate sourcing',
          message: error.message
        });
      }
    });

    // ====================
    // TELEMETRY ENDPOINTS
    // ====================

    // POST /api/wg/telemetry/events - Log telemetry event
    this.router.post('/telemetry/events', async (req, res) => {
      try {
        const eventData = {
          ...req.body,
          user_agent: req.headers['user-agent'],
          ip_address: req.ip
        };

        const event = await this.db.logTelemetryEvent(eventData);

        res.status(201).json({
          success: true,
          data: event
        });
      } catch (error) {
        console.error('Error logging telemetry event:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to log telemetry event',
          message: error.message
        });
      }
    });

    // GET /api/wg/analytics/performance - Get performance metrics
    this.router.get('/analytics/performance', async (req, res) => {
      try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
          return res.status(400).json({
            success: false,
            error: 'start_date and end_date are required'
          });
        }

        const metrics = await this.db.getPerformanceMetrics(start_date, end_date);

        res.json({
          success: true,
          data: metrics,
          count: metrics.length
        });
      } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch performance metrics',
          message: error.message
        });
      }
    });

    // ====================
    // CONSTRAINT VALIDATION ENDPOINTS
    // ====================

    // POST /api/wg/constraints/violations - Log constraint violation
    this.router.post('/constraints/violations', async (req, res) => {
      try {
        const constraintData = req.body;
        
        const requiredFields = ['constraint_type', 'constraint_description'];
        for (const field of requiredFields) {
          if (!constraintData[field]) {
            return res.status(400).json({
              success: false,
              error: `Missing required field: ${field}`
            });
          }
        }

        const violation = await this.db.logConstraintViolation(constraintData);

        // Log telemetry event for conflicts
        if (constraintData.shipment_id) {
          await this.db.logTelemetryEvent({
            event_type: 'wg.slot.conflict',
            shipment_id: constraintData.shipment_id,
            user_id: constraintData.resolved_by || 'system',
            session_id: req.headers['x-session-id'],
            event_data: {
              conflict_type: constraintData.constraint_type,
              description: constraintData.constraint_description,
              severity: constraintData.violation_severity
            },
            user_agent: req.headers['user-agent'],
            ip_address: req.ip
          });
        }

        res.status(201).json({
          success: true,
          data: violation
        });
      } catch (error) {
        console.error('Error logging constraint violation:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to log constraint violation',
          message: error.message
        });
      }
    });

    // ====================
    // AUDIT ENDPOINTS
    // ====================

    // GET /api/wg/audit/logs - Get audit logs
    this.router.get('/audit/logs', async (req, res) => {
      try {
        const filters = {
          user_id: req.query.user_id,
          action_type: req.query.action_type,
          shipment_id: req.query.shipment_id,
          start_date: req.query.start_date,
          end_date: req.query.end_date,
          limit: parseInt(req.query.limit) || 100
        };

        const logs = await this.db.getAuditLogs(filters);

        res.json({
          success: true,
          data: logs,
          count: logs.length
        });
      } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch audit logs',
          message: error.message
        });
      }
    });

    // ====================
    // HEALTH CHECK
    // ====================

    // GET /api/wg/health - Health check
    this.router.get('/health', async (req, res) => {
      try {
        const health = await this.db.healthCheck();
        
        res.status(health.status === 'healthy' ? 200 : 503).json({
          success: health.status === 'healthy',
          ...health
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          error: error.message
        });
      }
    });
  }

  // ====================
  // UTILITY METHODS
  // ====================

  async logAuditAction(req, actionType, details) {
    try {
      await this.db.logAuditAction({
        action_type: actionType,
        user_id: req.headers['x-user-id'] || 'anonymous',
        user_role: req.headers['x-user-role'] || 'unknown',
        session_id: req.headers['x-session-id'],
        action_details: details,
        target_resource: req.originalUrl,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    } catch (error) {
      console.error('Error logging audit action:', error);
      // Don't throw - audit logging shouldn't break the main flow
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = WGAPIService;
