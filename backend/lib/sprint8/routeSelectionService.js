// lib/sprint8/routeSelectionService.js
// Complete Route Selection Service - Handles all operational steps when a route is chosen

const { Pool } = require('pg');
const { EventEmitter } = require('events');
const pool = require('../../database/connection');
const RouteMapGenerator = require('./routeMapGenerator');

class RouteSelectionService extends EventEmitter {
  constructor() {
    super();
    this.pool = pool;
    this.routeMapGenerator = new RouteMapGenerator();
    
    // Listen for route map generation events
    this.routeMapGenerator.on('route_map.generated', (data) => {
      console.log(`📄 Route map generated for ${data.shipmentId}: ${data.htmlPath}`);
    });
  }

  /**
   * Complete route selection workflow
   * 
   * @param {string} shipmentId - Shipment identifier
   * @param {Object} selectedRoute - Complete route object from the card
   * @param {string} userId - User making the selection
   * @returns {Object} Selection result with next steps
   */
  async selectRoute(shipmentId, selectedRoute, userId = 'system') {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log(`🎯 Starting route selection for ${shipmentId}`);
      
      // 1. Set status = 'planned'
      const statusUpdate = await this.updateShipmentStatus(client, shipmentId, 'planned', userId);
      console.log(`✅ Status updated to 'planned'`);
      
      // 2. Create provisional legs with ETAs and frozen prices
      const provisionalLegs = await this.createProvisionalLegs(client, selectedRoute, shipmentId);
      console.log(`✅ Created ${provisionalLegs.length} provisional legs`);
      
      // 3. Reserve hub slots (Auth/Sewing/QA)
      const hubReservations = await this.reserveHubSlots(client, selectedRoute, shipmentId);
      console.log(`✅ Reserved ${hubReservations.length} hub slots`);
      
      // 4. Reserve inventory holds (Tag/NFC)
      const inventoryHolds = await this.reserveInventory(client, selectedRoute, shipmentId);
      console.log(`✅ Created ${inventoryHolds.length} inventory holds`);
      
      // 5. Store complete route plan
      const routePlanId = await this.storeSelectedRoutePlan(client, selectedRoute, shipmentId, {
        provisionalLegs,
        hubReservations,
        inventoryHolds
      });
      console.log(`✅ Stored route plan: ${routePlanId}`);
      
      await client.query('COMMIT');
      
      // 6. Emit events (after successful commit)
      await this.emitPlanningEvents(shipmentId, selectedRoute, {
        routePlanId,
        provisionalLegs,
        hubReservations,
        inventoryHolds,
        userId
      });
      console.log(`✅ Emitted planning events`);
      
      // 7. Determine smart next steps
      const nextSteps = this.determineNextSteps(selectedRoute, provisionalLegs);
      console.log(`✅ Next steps: ${nextSteps.primary}`);
      
      // 8. Generate route map for Lina
      const routeMap = await this.routeMapGenerator.generateRouteMap({
        shipmentId,
        selectedRoute,
        provisionalLegs,
        hubReservations,
        inventoryHolds
      });
      console.log(`✅ Route map generated: ${routeMap.htmlPath}`);
      
      return {
        success: true,
        shipmentId,
        routePlanId,
        status: 'planned',
        selectedRoute: {
          id: selectedRoute.id,
          label: selectedRoute.label,
          totalCost: selectedRoute.costBreakdown.total,
          estimatedDelivery: selectedRoute.schedule.estimatedDelivery
        },
        provisionalLegs,
        hubReservations,
        inventoryHolds,
        nextSteps,
        routeMap,
        selectedAt: new Date().toISOString()
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Route selection failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update shipment status to 'planned'
   */
  async updateShipmentStatus(client, shipmentId, status, userId) {
    const result = await client.query(`
      UPDATE shipments 
      SET status = $2, 
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $3
      WHERE shipment_id = $1
      RETURNING id, status, updated_at
    `, [shipmentId, status, userId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }
    
    return result.rows[0];
  }

  /**
   * Create provisional legs with ETAs and frozen prices from the card
   */
  async createProvisionalLegs(client, selectedRoute, shipmentId) {
    const provisionalLegs = [];
    
    // Get internal shipment ID
    const shipmentResult = await client.query(
      'SELECT id FROM shipments WHERE shipment_id = $1', 
      [shipmentId]
    );
    const internalShipmentId = shipmentResult.rows[0].id;
    
    // Process each leg from the selected route
    for (const [index, leg] of (selectedRoute.legs || []).entries()) {
      const provisionalLeg = {
        legOrder: index + 1,
        legType: leg.type || 'transport',
        carrier: leg.carrier || leg.type,
        fromLocation: this.formatLocation(leg.from),
        toLocation: this.formatLocation(leg.to),
        fromType: leg.from?.type || 'unknown',
        toType: leg.to?.type || 'unknown',
        
        // Frozen pricing from the card
        frozenCost: this.parseCost(leg.cost || leg.costBreakdown?.total || 0),
        currency: selectedRoute.costBreakdown?.currency || 'EUR',
        
        // ETAs from detailed schedule
        plannedDeparture: this.extractPlannedTime(selectedRoute.schedule.timeline, index, 'start'),
        plannedArrival: this.extractPlannedTime(selectedRoute.schedule.timeline, index, 'end'),
        provisionalETA: this.extractPlannedTime(selectedRoute.schedule.timeline, index, 'end'),
        
        // Processing details
        processing: leg.processing || [],
        bufferTime: leg.buffers?.total || 0,
        
        // Operational details
        distance: leg.distance || 0,
        duration: leg.duration || 0,
        hubCode: leg.from?.hubCode || leg.to?.hubCode || null,
        
        // Tracking
        status: 'planned',
        createdAt: new Date().toISOString()
      };
      
      // Store in database
      const legResult = await client.query(`
        INSERT INTO shipment_route_legs (
          shipment_id, leg_order, leg_type, carrier,
          from_location, to_location, from_type, to_type,
          frozen_cost, currency, planned_departure, planned_arrival, provisional_eta,
          processing, buffer_time, distance, duration, hub_code, status,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING id
      `, [
        internalShipmentId, provisionalLeg.legOrder, provisionalLeg.legType, provisionalLeg.carrier,
        provisionalLeg.fromLocation, provisionalLeg.toLocation, provisionalLeg.fromType, provisionalLeg.toType,
        provisionalLeg.frozenCost, provisionalLeg.currency, provisionalLeg.plannedDeparture, 
        provisionalLeg.plannedArrival, provisionalLeg.provisionalETA,
        JSON.stringify(provisionalLeg.processing), provisionalLeg.bufferTime, 
        provisionalLeg.distance, provisionalLeg.duration, provisionalLeg.hubCode, provisionalLeg.status,
        provisionalLeg.createdAt
      ]);
      
      provisionalLeg.id = legResult.rows[0].id;
      provisionalLegs.push(provisionalLeg);
    }
    
    return provisionalLegs;
  }

  /**
   * Reserve hub slots for Auth/Sewing/QA operations
   */
  async reserveHubSlots(client, selectedRoute, shipmentId) {
    const hubReservations = [];
    
    // Extract slot bookings from detailed itinerary
    const slotBookings = selectedRoute.detailedItinerary?.slotBookings?.sequence || 
                        selectedRoute.slotBookings?.sequence || [];
    
    for (const slot of slotBookings) {
      const reservation = {
        shipmentId,
        hubId: slot.hubId,
        hubCode: slot.hubCode,
        serviceType: slot.serviceType, // 'authentication', 'sewing', 'qa'
        tier: selectedRoute.tier,
        
        // Timing from slot booking
        plannedStartTime: slot.startTime,
        plannedEndTime: slot.endTime,
        duration: slot.duration,
        
        // Pricing frozen from selection
        frozenCost: slot.cost || 0,
        currency: selectedRoute.costBreakdown?.currency || 'EUR',
        
        // Capacity allocation
        capacityUnits: this.getCapacityUnits(slot.serviceType),
        priority: this.getServicePriority(slot.serviceType),
        
        // Status tracking
        status: 'reserved',
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h hold
      };
      
      // Store hub slot reservation
      const reservationResult = await client.query(`
        INSERT INTO hub_slot_reservations (
          shipment_id, hub_id, hub_code, service_type, tier,
          planned_start_time, planned_end_time, duration,
          frozen_cost, currency, capacity_units, priority,
          status, reserved_at, expires_at
        ) VALUES (
          (SELECT id FROM shipments WHERE shipment_id = $1),
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING id
      `, [
        shipmentId, reservation.hubId, reservation.hubCode, reservation.serviceType, reservation.tier,
        reservation.plannedStartTime, reservation.plannedEndTime, reservation.duration,
        reservation.frozenCost, reservation.currency, reservation.capacityUnits, reservation.priority,
        reservation.status, reservation.reservedAt, reservation.expiresAt
      ]);
      
      reservation.id = reservationResult.rows[0].id;
      hubReservations.push(reservation);
      
      // Update hub capacity (decrement available)
      await this.updateHubCapacity(client, reservation.hubId, reservation.serviceType, -reservation.capacityUnits);
    }
    
    return hubReservations;
  }

  /**
   * Reserve inventory for Tag/NFC units
   */
  async reserveInventory(client, selectedRoute, shipmentId) {
    const inventoryHolds = [];
    
    // Determine required inventory based on tier
    const inventoryRequirements = this.calculateInventoryRequirements(selectedRoute);
    
    for (const requirement of inventoryRequirements) {
      const hold = {
        shipmentId,
        hubId: requirement.hubId,
        hubCode: requirement.hubCode,
        itemType: requirement.itemType, // 'nfc' or 'tag'
        quantity: requirement.quantity,
        tier: selectedRoute.tier,
        
        // Pricing frozen from selection
        unitCost: requirement.unitCost,
        totalCost: requirement.unitCost * requirement.quantity,
        currency: selectedRoute.costBreakdown?.currency || 'EUR',
        
        // Hold details
        status: 'held',
        heldAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h hold
        
        // Allocation tracking
        batchNumber: this.generateBatchNumber(requirement.itemType),
        serialNumbers: requirement.quantity === 1 ? [this.generateSerialNumber(requirement.itemType)] : []
      };
      
      // Store inventory hold
      const holdResult = await client.query(`
        INSERT INTO inventory_holds (
          shipment_id, hub_id, hub_code, item_type, quantity, tier,
          unit_cost, total_cost, currency,
          status, held_at, expires_at, batch_number, serial_numbers
        ) VALUES (
          (SELECT id FROM shipments WHERE shipment_id = $1),
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING id
      `, [
        shipmentId, hold.hubId, hold.hubCode, hold.itemType, hold.quantity, hold.tier,
        hold.unitCost, hold.totalCost, hold.currency,
        hold.status, hold.heldAt, hold.expiresAt, hold.batchNumber, JSON.stringify(hold.serialNumbers)
      ]);
      
      hold.id = holdResult.rows[0].id;
      inventoryHolds.push(hold);
      
      // Update inventory stock (decrement available)
      await this.updateInventoryStock(client, hold.hubId, hold.itemType, -hold.quantity);
    }
    
    return inventoryHolds;
  }

  /**
   * Store the complete selected route plan
   */
  async storeSelectedRoutePlan(client, selectedRoute, shipmentId, operationalData) {
    const routePlan = {
      shipmentId,
      routeId: selectedRoute.id,
      routeLabel: selectedRoute.label,
      routeType: this.determineRouteType(selectedRoute),
      tier: selectedRoute.tier,
      
      // Frozen pricing
      totalCost: selectedRoute.costBreakdown.total,
      clientPrice: selectedRoute.costBreakdown.clientPrice,
      currency: selectedRoute.costBreakdown.currency,
      
      // Timing
      estimatedDelivery: selectedRoute.schedule.estimatedDelivery,
      totalHours: selectedRoute.schedule.totalHours,
      
      // Hubs
      hubId: selectedRoute.hubId?.hubId || selectedRoute.hubId?.id,
      hubCou: selectedRoute.hubCou?.hubId || selectedRoute.hubCou?.id,
      
      // Operational references
      provisionalLegIds: operationalData.provisionalLegs.map(leg => leg.id),
      hubReservationIds: operationalData.hubReservations.map(res => res.id),
      inventoryHoldIds: operationalData.inventoryHolds.map(hold => hold.id),
      
      // Metadata
      isSelected: true,
      selectedAt: new Date().toISOString(),
      frozenAt: new Date().toISOString()
    };
    
    const result = await client.query(`
      INSERT INTO selected_route_plans (
        shipment_id, route_id, route_label, route_type, tier,
        total_cost, client_price, currency,
        estimated_delivery, total_hours, hub_id, hub_cou,
        provisional_leg_ids, hub_reservation_ids, inventory_hold_ids,
        is_selected, selected_at, frozen_at
      ) VALUES (
        (SELECT id FROM shipments WHERE shipment_id = $1),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING id
    `, [
      shipmentId, routePlan.routeId, routePlan.routeLabel, routePlan.routeType, routePlan.tier,
      routePlan.totalCost, routePlan.clientPrice, routePlan.currency,
      routePlan.estimatedDelivery, routePlan.totalHours, routePlan.hubId, routePlan.hubCou,
      JSON.stringify(routePlan.provisionalLegIds), JSON.stringify(routePlan.hubReservationIds), 
      JSON.stringify(routePlan.inventoryHoldIds),
      routePlan.isSelected, routePlan.selectedAt, routePlan.frozenAt
    ]);
    
    return result.rows[0].id;
  }

  /**
   * Emit all required events for route selection
   */
  async emitPlanningEvents(shipmentId, selectedRoute, operationalData) {
    const { routePlanId, provisionalLegs, hubReservations, inventoryHolds, userId } = operationalData;
    
    // 1. plan.route.selected - Route selection completed
    this.emit('plan.route.selected', {
      shipmentId,
      routePlanId,
      routeId: selectedRoute.id,
      routeLabel: selectedRoute.label,
      totalCost: selectedRoute.costBreakdown.total,
      estimatedDelivery: selectedRoute.schedule.estimatedDelivery,
      hubsUsed: {
        hubId: selectedRoute.hubId?.hubCode,
        hubCou: selectedRoute.hubCou?.hubCode
      },
      selectedBy: userId,
      selectedAt: new Date().toISOString()
    });
    
    // 2. shipment.planned - Status updated to planned
    this.emit('shipment.planned', {
      shipmentId,
      previousStatus: 'calculating',
      newStatus: 'planned',
      routePlanId,
      provisionalLegsCount: provisionalLegs.length,
      estimatedDelivery: selectedRoute.schedule.estimatedDelivery,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    });
    
    // 3. inventory.holds.created - Inventory reserved
    if (inventoryHolds.length > 0) {
      this.emit('inventory.holds.created', {
        shipmentId,
        holds: inventoryHolds.map(hold => ({
          holdId: hold.id,
          hubId: hold.hubId,
          hubCode: hold.hubCode,
          itemType: hold.itemType,
          quantity: hold.quantity,
          unitCost: hold.unitCost,
          expiresAt: hold.expiresAt
        })),
        totalHolds: inventoryHolds.length,
        totalValue: inventoryHolds.reduce((sum, hold) => sum + hold.totalCost, 0),
        createdAt: new Date().toISOString()
      });
    }
    
    // 4. hub.slot.hold.created - Hub slots reserved
    if (hubReservations.length > 0) {
      for (const reservation of hubReservations) {
        this.emit('hub.slot.hold.created', {
          shipmentId,
          reservationId: reservation.id,
          hubId: reservation.hubId,
          hubCode: reservation.hubCode,
          serviceType: reservation.serviceType,
          tier: reservation.tier,
          plannedStartTime: reservation.plannedStartTime,
          plannedEndTime: reservation.plannedEndTime,
          duration: reservation.duration,
          capacityUnits: reservation.capacityUnits,
          frozenCost: reservation.frozenCost,
          expiresAt: reservation.expiresAt,
          reservedAt: reservation.reservedAt
        });
      }
    }
    
    console.log(`📢 Emitted ${4} planning events for shipment ${shipmentId}`);
  }

  /**
   * Determine smart next steps based on route type
   */
  determineNextSteps(selectedRoute, provisionalLegs) {
    const hasWGLegs = provisionalLegs.some(leg => leg.legType === 'white-glove' || leg.carrier === 'white-glove');
    const hasDHLLegs = provisionalLegs.some(leg => leg.legType === 'dhl' || leg.carrier === 'dhl');
    
    let primary = '';
    let secondary = [];
    
    if (hasWGLegs && hasDHLLegs) {
      // Hybrid route
      primary = 'wg-scheduling';
      secondary = ['dhl-labels', 'hub-coordination'];
    } else if (hasWGLegs) {
      // Full WG route
      primary = 'wg-scheduling';
      secondary = ['operator-assignment', 'hub-coordination'];
    } else if (hasDHLLegs) {
      // Full DHL route
      primary = 'dhl-labels';
      secondary = ['hub-coordination', 'tracking-setup'];
    } else {
      // Internal only
      primary = 'hub-coordination';
      secondary = ['internal-scheduling'];
    }
    
    return {
      primary,
      secondary,
      description: this.getNextStepDescription(primary),
      actions: this.getNextStepActions(primary, selectedRoute)
    };
  }

  // Helper methods
  formatLocation(locationObj) {
    if (!locationObj) return 'Unknown';
    return locationObj.address || `${locationObj.city}, ${locationObj.country || ''}`.trim();
  }

  parseCost(cost) {
    const parsed = parseFloat(cost);
    return isNaN(parsed) ? 0 : parsed;
  }

  extractPlannedTime(timeline, legIndex, timeType) {
    if (!timeline || !timeline[legIndex]) return null;
    const timeKey = timeType === 'start' ? 'startTime' : 'endTime';
    return timeline[legIndex][timeKey] || null;
  }

  getCapacityUnits(serviceType) {
    const units = {
      'authentication': 1,
      'sewing': 2,
      'qa': 0.5
    };
    return units[serviceType] || 1;
  }

  getServicePriority(serviceType) {
    const priorities = {
      'authentication': 'high',
      'sewing': 'medium', 
      'qa': 'low'
    };
    return priorities[serviceType] || 'medium';
  }

  calculateInventoryRequirements(selectedRoute) {
    const requirements = [];
    
    if (selectedRoute.tier === 3) {
      // Tier 3 requires NFC
      requirements.push({
        hubId: selectedRoute.hubId?.hubId || selectedRoute.hubId?.id,
        hubCode: selectedRoute.hubId?.hubCode || selectedRoute.hubId?.code,
        itemType: 'nfc',
        quantity: 1,
        unitCost: selectedRoute.detailedCosts?.inventory || 25
      });
    } else if (selectedRoute.tier === 2) {
      // Tier 2 requires Tag
      requirements.push({
        hubId: selectedRoute.hubId?.hubId || selectedRoute.hubId?.id,
        hubCode: selectedRoute.hubId?.hubCode || selectedRoute.hubId?.code,
        itemType: 'tag',
        quantity: 1,
        unitCost: selectedRoute.detailedCosts?.inventory || 5
      });
    }
    
    return requirements;
  }

  determineRouteType(selectedRoute) {
    if (selectedRoute.id?.includes('FULL_WG') || selectedRoute.label?.includes('Full WG')) {
      return 'white-glove';
    } else if (selectedRoute.id?.includes('DHL') || selectedRoute.label?.includes('DHL')) {
      return 'dhl';
    } else if (selectedRoute.id?.includes('HYBRID') || selectedRoute.label?.includes('Hybrid')) {
      return 'hybrid';
    }
    return 'mixed';
  }

  generateBatchNumber(itemType) {
    const prefix = itemType.toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}_${timestamp}`;
  }

  generateSerialNumber(itemType) {
    const prefix = itemType.toUpperCase();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${prefix}_${random}`;
  }

  getNextStepDescription(primary) {
    const descriptions = {
      'wg-scheduling': 'Schedule white-glove operator and coordinate pickup/delivery times',
      'dhl-labels': 'Generate DHL shipping labels and arrange carrier pickup',
      'hub-coordination': 'Coordinate hub processing schedules and capacity allocation'
    };
    return descriptions[primary] || 'Coordinate operational execution';
  }

  getNextStepActions(primary, selectedRoute) {
    const baseActions = {
      'wg-scheduling': [
        'Assign operator to route',
        'Confirm pickup/delivery windows',
        'Generate operator manifest',
        'Setup tracking checkpoints'
      ],
      'dhl-labels': [
        'Generate shipping labels',
        'Schedule carrier pickup',
        'Setup tracking integration',
        'Notify recipient'
      ],
      'hub-coordination': [
        'Confirm hub capacity allocation',
        'Schedule processing windows',
        'Prepare inventory allocation',
        'Setup internal logistics'
      ]
    };
    
    return baseActions[primary] || ['Proceed with execution'];
  }

  async updateHubCapacity(client, hubId, serviceType, capacityChange) {
    const field = `${serviceType}_capacity_available`;
    await client.query(`
      UPDATE hub_capacity 
      SET ${field} = ${field} + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE hub_id = $1
    `, [hubId, capacityChange]);
  }

  async updateInventoryStock(client, hubId, itemType, stockChange) {
    const field = `${itemType}_stock`;
    await client.query(`
      UPDATE hub_inventory 
      SET ${field} = ${field} + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE hub_id = $1
    `, [hubId, stockChange]);
  }
}

module.exports = RouteSelectionService;
