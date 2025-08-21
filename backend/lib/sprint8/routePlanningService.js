// lib/sprint8/routePlanningService.js
// Comprehensive Route Planning and Telemetry Service

const { Pool } = require('pg');
const pool = require('../../database/connection');
const RouteCalculationEngine = require('./routeCalculationEngine');
const ExternalPricingService = require('./externalPricingService');
const HubPricingService = require('./hubPricingService');

class RoutePlanningService {
  constructor() {
    this.pool = pool;
    this.routeEngine = new RouteCalculationEngine();
    this.pricingService = new ExternalPricingService();
    this.hubService = new HubPricingService();
  }

  // ========================================================================================
  // ROUTE CALCULATION & PLANNING
  // ========================================================================================

  /**
   * Calculate route options for a shipment
   * @param {string} shipmentId - Shipment ID
   * @param {Object} shipmentData - Complete shipment data
   * @returns {Array} Array of route options with scoring and cost breakdown
   */
  async calculateRoutes(shipmentId, shipmentData) {
    try {
      // Start new telemetry session
      const sessionId = await this.startTelemetrySession(shipmentId);
      
      // Get tier resource reservations
      const reservations = await this.getTierReservations(shipmentId);
      
      // Calculate route options
      const routes = await this.generateRouteOptions(shipmentData, reservations);
      
      // Calculate costs and scoring for each route
      const routesWithCosts = await Promise.all(
        routes.map(route => this.calculateRouteCosts(route, shipmentData))
      );
      
      // Apply scoring algorithm
      const routesWithScores = routesWithCosts.map(route => 
        this.calculateRouteScore(route, shipmentData)
      );
      
      // Validate guardrails
      const routesWithGuardrails = await Promise.all(
        routesWithScores.map(route => this.validateRouteGuardrails(route, shipmentData))
      );
      
      // Store route plans in database
      const routePlanIds = await this.storeRoutePlans(shipmentId, routesWithGuardrails);
      
      // Log telemetry
      await this.logRouteCalculation(sessionId, routePlanIds);
      
      return routesWithGuardrails.map((route, index) => ({
        ...route,
        id: routePlanIds[index]
      }));
      
    } catch (error) {
      console.error('Error calculating routes:', error);
      throw new Error('Failed to calculate route options');
    }
  }

  /**
   * Select and lock a route plan
   * @param {string} shipmentId - Shipment ID
   * @param {string} routePlanId - Selected route plan ID
   * @param {boolean} adminOverride - Whether admin override was used
   * @param {string} userId - User making the selection
   * @returns {Object} Locked route plan with provisional legs
   */
  async selectRoute(shipmentId, routePlanId, adminOverride = false, userId = 'system') {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate route plan exists and is not blocked
      const routeValidation = await this.validateRouteSelection(routePlanId, adminOverride);
      if (!routeValidation.valid) {
        throw new Error(routeValidation.reason);
      }
      
      // Mark route as selected
      await client.query(`
        UPDATE shipment_route_plans 
        SET is_selected = TRUE, selected_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [routePlanId]);
      
      // Update shipment status to 'planned'
      await client.query(`
        UPDATE shipments 
        SET status = 'planned', updated_at = CURRENT_TIMESTAMP 
        WHERE shipment_id = $1
      `, [shipmentId]);
      
      // Create provisional legs
      const provisionalLegs = await this.createProvisionalLegs(routePlanId);
      
      // Store financial snapshot
      const snapshotId = await this.storeFinancialSnapshot(
        shipmentId, 
        routePlanId, 
        adminOverride, 
        userId
      );
      
      // Log telemetry decision
      await this.logRouteDecision(shipmentId, routePlanId, adminOverride);
      
      await client.query('COMMIT');
      
      return {
        routePlanId,
        snapshotId,
        provisionalLegs,
        adminOverride,
        selectedAt: new Date().toISOString()
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error selecting route:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ========================================================================================
  // COST CALCULATION
  // ========================================================================================

  async calculateRouteCosts(route, shipmentData) {
    const costs = {
      wgSubtotal: 0,
      dhlSubtotal: 0,
      hubFee: 0,
      flightCosts: 0,
      personnelCosts: 0,
      insurance: 0,
      surcharges: {
        weekend: 0,
        remoteArea: 0,
        fuel: 0,
        fragile: 0
      }
    };

    // Calculate costs by leg type with new structure
    route.legs.forEach(leg => {
      // Base service cost
      if (leg.type.includes('wg') || leg.type.includes('white-glove')) {
        costs.wgSubtotal += leg.baseCost || 0;
      } else if (leg.type.includes('dhl')) {
        costs.dhlSubtotal += leg.baseCost || 0;
      } else if (leg.type.includes('hub') || leg.type.includes('processing')) {
        costs.hubFee += leg.baseCost || 0;
      }

      // Additional costs
      costs.flightCosts += leg.flightCost || 0;
      costs.personnelCosts += leg.personnelCost || 0;
    });

    // Insurance (0.3% of declared value, minimum €25)
    const insuranceRate = 0.003;
    costs.insurance = Math.max(
      Math.round(shipmentData.declared_value * insuranceRate), 
      25
    );

    // Surcharges based on route characteristics
    costs.surcharges = await this.calculateSurcharges(route, shipmentData);

    // Calculate operational cost (what it costs AUCTA)
    const operationalCost = costs.wgSubtotal + costs.dhlSubtotal + costs.hubFee + 
                           costs.flightCosts + costs.personnelCosts + costs.insurance + 
                           Object.values(costs.surcharges).reduce((a, b) => a + b, 0);

    // Client price (with margin)
    const marginMultiplier = this.getMarginMultiplier(shipmentData.tier);
    const clientPrice = Math.round(operationalCost * marginMultiplier);

    return {
      ...route,
      totalCost: operationalCost,
      clientPrice,
      costBreakdown: {
        ...costs,
      estimatedMargin: {
          amount: clientPrice - operationalCost,
          percentage: ((clientPrice - operationalCost) / clientPrice) * 100
        }
      }
    };
  }

  async calculateSurcharges(route, shipmentData) {
    const surcharges = {
      weekend: 0,
      remoteArea: 0,
      fuel: 0,
      fragile: 0
    };

    // Weekend surcharge (if delivery on weekend)
    const deliveryDate = new Date(route.deliveryDate);
    if (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      surcharges.weekend = 35; // Increased for premium weekend service
    }

    // Remote area surcharge (simplified check)
    const remoteAreas = ['highlands', 'islands', 'remote', 'rural'];
    const senderCity = shipmentData.sender_city || '';
    const buyerCity = shipmentData.buyer_city || '';
    
    if (remoteAreas.some(area => 
      buyerCity.toLowerCase().includes(area) ||
      senderCity.toLowerCase().includes(area)
    )) {
      surcharges.remoteArea = 45; // Higher remote area fee
    }

    // Fuel surcharge (4% of DHL + flight costs)
    const transportCosts = route.legs.reduce((sum, leg) => {
      return sum + (leg.baseCost || 0) + (leg.flightCost || 0);
    }, 0);
    surcharges.fuel = Math.round(transportCosts * 0.04);

    // Fragile/High-value handling surcharge
    const fragility = shipmentData.fragility_level || 
                     (shipmentData.fragility === 'high' ? 5 : 3);
    const declaredValue = shipmentData.declared_value || 0;
    
    if (fragility >= 4 || declaredValue > 25000) {
      surcharges.fragile = declaredValue > 50000 ? 85 : 
                          declaredValue > 25000 ? 55 : 25;
    }

    return surcharges;
  }

  // ========================================================================================
  // SCORING ALGORITHM
  // ========================================================================================

  calculateRouteScore(route, shipmentData) {
    const weights = {
      time: 0.4,
      cost: 0.35,
      risk: 0.25
    };

    // Time score (faster is better, scale 0-100)
    const timeScore = Math.max(0, 100 - (route.estimatedDays * 10));

    // Cost score (cheaper is better relative to alternatives)
    const costScore = this.calculateRelativeCostScore(route.totalCost, shipmentData);

    // Risk score (lower risk is better)
    const riskScore = this.calculateRiskScore(route, shipmentData);

    // Weighted calculation
    const numericScore = Math.round(
      (timeScore * weights.time) + 
      (costScore * weights.cost) + 
      (riskScore * weights.risk)
    );

    // Convert to letter grade
    const letterScore = numericScore >= 85 ? 'A' : numericScore >= 70 ? 'B' : 'C';

    return {
      ...route,
      score: letterScore,
      scoreNumeric: numericScore,
      breakdown: {
        time: timeScore,
        cost: costScore,
        risk: riskScore
      },
      weights
    };
  }

  calculateRiskScore(route, shipmentData) {
    let riskScore = 85; // Start with good score

    // High value reduces score
    if (shipmentData.declared_value > 10000) riskScore -= 10;
    if (shipmentData.declared_value > 50000) riskScore -= 15;

    // Fragility reduces score
    if (shipmentData.fragility_level >= 4) riskScore -= 10;

    // Multiple legs increase risk
    if (route.legs.length > 3) riskScore -= 5;

    // International routes have more risk
    const isInternational = route.legs.some(leg => 
      leg.from_location.includes('UK') && leg.to_location.includes('EU') ||
      leg.from_location.includes('EU') && leg.to_location.includes('UK')
    );
    if (isInternational) riskScore -= 8;

    return Math.max(0, Math.min(100, riskScore));
  }

  // ========================================================================================
  // GUARDRAIL VALIDATION
  // ========================================================================================

  async validateRouteGuardrails(route, shipmentData) {
    const guardrails = [];

    // Margin validation
    const marginGuardrail = this.validateMargin(route, shipmentData);
    if (marginGuardrail) guardrails.push(marginGuardrail);

    // Hub capacity validation
    const capacityGuardrail = await this.validateHubCapacity(route, shipmentData);
    if (capacityGuardrail) guardrails.push(capacityGuardrail);

    // Tier constraints validation
    const tierGuardrails = this.validateTierConstraints(route, shipmentData);
    guardrails.push(...tierGuardrails);

    // Customs validation
    const customsGuardrail = this.validateCustoms(route, shipmentData);
    if (customsGuardrail) guardrails.push(customsGuardrail);

    // DHL rate freshness
    const dhlGuardrail = this.validateDhlRates(route);
    if (dhlGuardrail) guardrails.push(dhlGuardrail);

    // WG capacity
    const wgGuardrail = this.validateWgCapacity(route);
    if (wgGuardrail) guardrails.push(wgGuardrail);

    const isBlocked = guardrails.some(g => g.blocking);

    return {
      ...route,
      guardrails,
      isBlocked
    };
  }

  validateMargin(route, shipmentData) {
    const minimumMarginPercent = this.getMinimumMargin(shipmentData.tier);
    
    if (route.estimatedMargin.percentage < minimumMarginPercent) {
      return {
        type: 'error',
        category: 'margin',
        message: `Margin ${route.estimatedMargin.percentage.toFixed(1)}% below minimum ${minimumMarginPercent}%`,
        blocking: true,
        action: 'Contact admin for override approval'
      };
    }
    return null;
  }

  // ========================================================================================
  // TELEMETRY SYSTEM
  // ========================================================================================

  async startTelemetrySession(shipmentId) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.pool.query(`
      INSERT INTO route_planning_sessions (session_id, shipment_id)
      VALUES ($1, $2)
    `, [sessionId, shipmentId]);
    
    return sessionId;
  }

  async logTelemetryEvent(sessionId, eventType, eventData, routeId = null) {
    try {
      // Get session start time for relative timing
      const sessionResult = await this.pool.query(`
        SELECT session_start FROM route_planning_sessions WHERE session_id = $1
      `, [sessionId]);
      
      if (sessionResult.rows.length === 0) return;
      
      const sessionStart = sessionResult.rows[0].session_start;
      const timeSinceStart = Date.now() - new Date(sessionStart).getTime();
      
      await this.pool.query(`
        INSERT INTO route_telemetry_events (
          session_id, event_type, event_category, event_data, route_id, time_since_session_start_ms
        ) VALUES (
          (SELECT id FROM route_planning_sessions WHERE session_id = $1),
          $2, $3, $4, $5, $6
        )
      `, [
        sessionId,
        eventType,
        this.categorizeEvent(eventType),
        JSON.stringify(eventData),
        routeId,
        timeSinceStart
      ]);
      
    } catch (error) {
      console.error('Error logging telemetry event:', error);
      // Don't throw - telemetry should not break main functionality
    }
  }

  async logScoreWeights(sessionId, routePlanId, route) {
    await this.pool.query(`
      INSERT INTO score_computation_logs (
        route_plan_id, session_id, time_weight, cost_weight, risk_weight,
        time_raw_value, cost_raw_value, risk_raw_value,
        time_contribution, cost_contribution, risk_contribution,
        total_numeric_score, letter_grade
      ) VALUES ($1, (SELECT id FROM route_planning_sessions WHERE session_id = $2),
        $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      routePlanId, sessionId,
      route.weights.time, route.weights.cost, route.weights.risk,
      route.breakdown.time, route.breakdown.cost, route.breakdown.risk,
      route.breakdown.time * route.weights.time,
      route.breakdown.cost * route.weights.cost,
      route.breakdown.risk * route.weights.risk,
      route.scoreNumeric, route.score
    ]);
  }

  async logRouteComparison(sessionId, routeAId, routeBId) {
    // Get routes for comparison analysis
    const routes = await this.pool.query(`
      SELECT id, total_cost, estimated_days, score_numeric 
      FROM shipment_route_plans 
      WHERE id IN ($1, $2)
    `, [routeAId, routeBId]);
    
    if (routes.rows.length === 2) {
      const [routeA, routeB] = routes.rows;
      
      await this.pool.query(`
        INSERT INTO route_comparison_logs (
          session_id, route_a_id, route_b_id, comparison_count,
          cost_difference, time_difference_days, score_difference
        ) VALUES (
          (SELECT id FROM route_planning_sessions WHERE session_id = $1),
          $2, $3, 
          (SELECT COUNT(*) + 1 FROM route_comparison_logs 
           WHERE session_id = (SELECT id FROM route_planning_sessions WHERE session_id = $1)),
          $4, $5, $6
        )
      `, [
        sessionId, routeAId, routeBId,
        Math.abs(routeA.total_cost - routeB.total_cost),
        Math.abs(routeA.estimated_days - routeB.estimated_days),
        Math.abs(routeA.score_numeric - routeB.score_numeric)
      ]);
    }
  }

  async finalizeTelemetrySession(sessionId, selectedRouteId = null) {
    const sessionData = await this.getSessionAnalytics(sessionId);
    
    await this.pool.query(`
      UPDATE route_planning_sessions SET
        session_end = CURRENT_TIMESTAMP,
        decision_made = $2,
        selected_route_id = $3,
        is_fast_decision = $4,
        is_thorough_evaluator = $5
      WHERE session_id = $1
    `, [
      sessionId,
      !!selectedRouteId,
      selectedRouteId,
      sessionData.sessionDuration < 60000, // < 1 minute
      sessionData.totalInteractions > 3 // Thorough evaluation
    ]);
  }

  // ========================================================================================
  // DATABASE STORAGE
  // ========================================================================================

  async storeRoutePlans(shipmentId, routes) {
    const routePlanIds = [];
    
    for (const route of routes) {
      // Insert route plan
      const routePlanResult = await this.pool.query(`
        INSERT INTO shipment_route_plans (
          shipment_id, route_label, route_type, score_letter, score_numeric,
          time_score, cost_score, risk_score, estimated_days, delivery_date,
          total_cost, wg_subtotal, dhl_subtotal, hub_fee, insurance_cost,
          weekend_surcharge, remote_area_surcharge, fuel_surcharge, fragile_surcharge,
          client_price, estimated_margin_amount, estimated_margin_percentage,
          dhl_rates_freshness, wg_capacity_status, hub_processing_status,
          is_blocked, blocked_reasons, route_metadata
        ) VALUES (
          (SELECT id FROM shipments WHERE shipment_id = $1),
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING id
      `, [
        shipmentId, route.name, route.type, route.score, route.scoreNumeric,
        route.breakdown.time, route.breakdown.cost, route.breakdown.risk,
        route.estimatedDays, route.deliveryDate, route.totalCost,
        route.costBreakdown.wgSubtotal, route.costBreakdown.dhlSubtotal,
        route.costBreakdown.hubFee, route.costBreakdown.insurance,
        route.costBreakdown.surcharges.weekend, route.costBreakdown.surcharges.remoteArea,
        route.costBreakdown.surcharges.fuel, route.costBreakdown.surcharges.fragile,
        route.clientPrice, route.estimatedMargin.amount, route.estimatedMargin.percentage,
        route.availability?.dhlRates || 'fresh', route.availability?.wgCapacity || 'high',
        route.availability?.hubProcessing || 'confirmed', route.isBlocked,
        JSON.stringify(route.guardrails.filter(g => g.blocking).map(g => g.message)),
        JSON.stringify(route.metadata || {})
      ]);
      
      const routePlanId = routePlanResult.rows[0].id;
      routePlanIds.push(routePlanId);
      
      // Insert route legs
      for (let i = 0; i < route.legs.length; i++) {
        const leg = route.legs[i];
        await this.pool.query(`
          INSERT INTO shipment_route_legs (
            route_plan_id, leg_order, leg_type, from_location, to_location,
            start_date, end_date, dwell_time_hours, leg_cost, carrier,
            service_type, provisional_eta, assumptions, leg_metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          routePlanId, i + 1, leg.type, leg.from, leg.to,
          leg.startDate, leg.endDate, leg.dwellTime || 0, leg.baseCost,
          leg.carrier, leg.serviceType, leg.estimatedArrival,
          leg.assumptions, JSON.stringify(leg.metadata || {})
        ]);
      }
      
      // Insert guardrails
      for (const guardrail of route.guardrails) {
        await this.pool.query(`
          INSERT INTO route_guardrails (
            route_plan_id, guardrail_type, guardrail_category, message,
            action_required, link_url, is_blocking, can_override, override_level
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          routePlanId, guardrail.type, guardrail.category, guardrail.message,
          guardrail.action, guardrail.link, guardrail.blocking,
          guardrail.canOverride !== false, guardrail.overrideLevel || 'admin'
        ]);
      }
    }
    
    return routePlanIds;
  }

  // ========================================================================================
  // UTILITY METHODS
  // ========================================================================================

  categorizeEvent(eventType) {
    if (eventType.includes('score')) return 'interaction';
    if (eventType.includes('guardrail')) return 'business';
    if (eventType.includes('compare')) return 'interaction';
    if (eventType.includes('decision')) return 'business';
    if (eventType.includes('time')) return 'performance';
    return 'system';
  }

  getMarginMultiplier(tier) {
    const margins = {
      'standard': 1.35,    // 35% margin
      'premium': 1.45,     // 45% margin
      'platinum': 1.60     // 60% margin
    };
    return margins[tier] || 1.35;
  }

  getMinimumMargin(tier) {
    const minimums = {
      'standard': 20,   // 20% minimum
      'premium': 25,    // 25% minimum
      'platinum': 30    // 30% minimum
    };
    return minimums[tier] || 20;
  }

  async getTierReservations(shipmentId) {
    const result = await this.pool.query(`
      SELECT * FROM tier_resource_reservations 
      WHERE shipment_id = (SELECT id FROM shipments WHERE shipment_id = $1)
      AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `, [shipmentId]);
    
    return result.rows[0] || null;
  }

  // Generate tier-based route options with real cost calculation
  async generateRouteOptions(shipmentData, reservations) {
    const tier = shipmentData.tier || shipmentData.assigned_tier || '1';
    const senderCity = shipmentData.sender_city;
    const buyerCity = shipmentData.buyer_city;
    const declaredValue = shipmentData.declared_value || 0;
    
    // Determine hub locations based on reservations or default logic
    const authHub = reservations?.reserved_hub_id || this.getClosestAuthHub(senderCity);
    const couturierHub = this.getCouturierHub(authHub, declaredValue);
    
    const routes = [];
    
    // TIER 1: Simple A → B delivery
    if (tier === '1' || tier === 'T1') {
      routes.push(...this.generateTier1Routes(senderCity, buyerCity, shipmentData));
    }
    
    // TIER 2: A → HUB(Auth) → B
    if (tier === '2' || tier === 'T2') {
      routes.push(...this.generateTier2Routes(senderCity, authHub, buyerCity, shipmentData));
    }
    
    // TIER 3: A → HUB(Auth) → HUB(Couturier) → B
    if (tier === '3' || tier === 'T3') {
      routes.push(...this.generateTier3Routes(senderCity, authHub, couturierHub, buyerCity, shipmentData));
    }
    
    return routes;
  }

  // TIER 1 ROUTES: Direct A → B
  generateTier1Routes(senderCity, buyerCity, shipmentData) {
    const routes = [];
    
    // DHL Direct Route
    routes.push({
      name: 'DHL Direct',
      type: 'dhl-direct',
      tierType: 'tier-1',
      estimatedDays: 2,
      deliveryDate: this.addDays(new Date(), 2),
      legs: [
        {
          type: 'dhl-express',
          from: senderCity,
          to: buyerCity,
          baseCost: this.calculateDHLCost(senderCity, buyerCity, shipmentData),
          carrier: 'DHL Express',
          serviceType: 'Direct International',
          flightCost: 0, // No separate flight for DHL
          personnelCost: 0 // Included in DHL rate
        }
      ]
    });
    
    // White-Glove Direct Route (if high value)
    if (shipmentData.declared_value > 15000) {
      routes.push({
        name: 'WG Direct',
        type: 'wg-direct',
        tierType: 'tier-1',
        estimatedDays: 1,
        deliveryDate: this.addDays(new Date(), 1),
        legs: [
          {
            type: 'white-glove-direct',
            from: senderCity,
            to: buyerCity,
            baseCost: this.calculateWGDirectCost(senderCity, buyerCity, shipmentData),
            carrier: 'WG Specialist',
            serviceType: 'Hand Carry',
            flightCost: this.calculateFlightCost(senderCity, buyerCity),
            personnelCost: this.calculatePersonnelCost(1, shipmentData) // 1 day
          }
        ]
      });
    }
    
    return routes;
  }

  // TIER 2 ROUTES: A → Auth Hub → B
  generateTier2Routes(senderCity, authHub, buyerCity, shipmentData) {
    const routes = [];
    
    // DHL + Hub + DHL Route
    routes.push({
      name: 'DHL via Auth Hub',
      type: 'dhl-hub-dhl',
      tierType: 'tier-2',
      estimatedDays: 4,
      deliveryDate: this.addDays(new Date(), 4),
      legs: [
        {
          type: 'dhl-to-hub',
          from: senderCity,
          to: authHub,
          baseCost: this.calculateDHLCost(senderCity, authHub, shipmentData),
          carrier: 'DHL Standard',
          serviceType: 'To Hub',
          flightCost: 0,
          personnelCost: 0
          },
          {
            type: 'hub-processing',
          from: authHub,
          to: authHub,
          baseCost: this.calculateAuthHubCost(shipmentData),
          carrier: 'Auth Hub Team',
          serviceType: 'Tag Application & Authentication',
          dwellTime: 24,
          flightCost: 0,
          personnelCost: this.calculateHubPersonnelCost('auth', 1)
        },
        {
          type: 'dhl-from-hub',
          from: authHub,
          to: buyerCity,
          baseCost: this.calculateDHLCost(authHub, buyerCity, shipmentData),
          carrier: 'DHL Express',
          serviceType: 'From Hub',
          flightCost: 0,
          personnelCost: 0
        }
      ]
    });
    
    // WG + Hub + DHL Route
    routes.push({
      name: 'WG to Hub, DHL Delivery',
      type: 'wg-hub-dhl',
      tierType: 'tier-2',
        estimatedDays: 3,
        deliveryDate: this.addDays(new Date(), 3),
        legs: [
          {
          type: 'wg-to-hub',
          from: senderCity,
          to: authHub,
          baseCost: this.calculateWGCost(senderCity, authHub, shipmentData),
          carrier: 'WG Specialist',
          serviceType: 'Secure Transport to Hub',
          flightCost: this.calculateFlightCost(senderCity, authHub),
          personnelCost: this.calculatePersonnelCost(1, shipmentData)
          },
          {
            type: 'hub-processing',
          from: authHub,
          to: authHub,
          baseCost: this.calculateAuthHubCost(shipmentData),
          carrier: 'Auth Hub Team',
          serviceType: 'Tag Application & Authentication',
          dwellTime: 12,
          flightCost: 0,
          personnelCost: this.calculateHubPersonnelCost('auth', 0.5)
        },
        {
          type: 'dhl-from-hub',
          from: authHub,
          to: buyerCity,
          baseCost: this.calculateDHLCost(authHub, buyerCity, shipmentData),
          carrier: 'DHL Express',
          serviceType: 'From Hub',
          flightCost: 0,
          personnelCost: 0
        }
      ]
    });
    
    return routes;
  }

  // TIER 3 ROUTES: A → Auth Hub → Couturier Hub → B
  generateTier3Routes(senderCity, authHub, couturierHub, buyerCity, shipmentData) {
    const routes = [];
    
    // Full WG Route (recommended for Tier 3)
    routes.push({
      name: 'Full White-Glove',
      type: 'wg-full',
      tierType: 'tier-3',
      estimatedDays: 6,
      deliveryDate: this.addDays(new Date(), 6),
      legs: [
        {
          type: 'wg-to-auth',
          from: senderCity,
          to: authHub,
          baseCost: this.calculateWGCost(senderCity, authHub, shipmentData),
          carrier: 'WG Specialist',
          serviceType: 'Secure Transport to Auth Hub',
          flightCost: this.calculateFlightCost(senderCity, authHub),
          personnelCost: this.calculatePersonnelCost(1, shipmentData)
        },
        {
          type: 'auth-hub-processing',
          from: authHub,
          to: authHub,
          baseCost: this.calculateAuthHubCost(shipmentData),
          carrier: 'Auth Hub Team',
          serviceType: 'Authentication & Prep for Couturier',
          dwellTime: 8,
          flightCost: 0,
          personnelCost: this.calculateHubPersonnelCost('auth', 0.5)
        },
        {
          type: 'auth-to-couturier',
          from: authHub,
          to: couturierHub,
          baseCost: this.calculateSameCityTransfer(authHub, couturierHub, shipmentData),
          carrier: 'Local Courier',
          serviceType: 'Same-city Secure Transfer',
          flightCost: 0, // Same city
          personnelCost: this.calculateLocalPersonnelCost(shipmentData)
        },
        {
          type: 'couturier-processing',
          from: couturierHub,
          to: couturierHub,
          baseCost: this.calculateCouturierHubCost(shipmentData),
          carrier: 'Couturier Team',
          serviceType: 'NFC Installation & Sewing',
          dwellTime: 48, // More complex work
          flightCost: 0,
          personnelCost: this.calculateHubPersonnelCost('couturier', 2)
        },
        {
          type: 'wg-final-delivery',
          from: couturierHub,
          to: buyerCity,
          baseCost: this.calculateWGCost(couturierHub, buyerCity, shipmentData),
          carrier: 'WG Specialist',
          serviceType: 'Final Delivery',
          flightCost: this.calculateFlightCost(couturierHub, buyerCity),
          personnelCost: this.calculatePersonnelCost(1, shipmentData)
        }
      ]
    });
    
    // Mixed Route: WG to Couturier, DHL final delivery
    routes.push({
      name: 'WG Processing, DHL Delivery',
      type: 'wg-mixed',
      tierType: 'tier-3',
      estimatedDays: 5,
      deliveryDate: this.addDays(new Date(), 5),
        legs: [
          {
          type: 'wg-to-auth',
          from: senderCity,
          to: authHub,
          baseCost: this.calculateWGCost(senderCity, authHub, shipmentData),
          carrier: 'WG Specialist',
          serviceType: 'Secure Transport',
          flightCost: this.calculateFlightCost(senderCity, authHub),
          personnelCost: this.calculatePersonnelCost(1, shipmentData)
        },
        {
          type: 'auth-hub-processing',
          from: authHub,
          to: authHub,
          baseCost: this.calculateAuthHubCost(shipmentData),
          carrier: 'Auth Hub Team',
          serviceType: 'Authentication',
          dwellTime: 8,
          flightCost: 0,
          personnelCost: this.calculateHubPersonnelCost('auth', 0.5)
        },
        {
          type: 'auth-to-couturier',
          from: authHub,
          to: couturierHub,
          baseCost: this.calculateSameCityTransfer(authHub, couturierHub, shipmentData),
          carrier: 'Local Courier',
          serviceType: 'Same-city Transfer',
          flightCost: 0,
          personnelCost: this.calculateLocalPersonnelCost(shipmentData)
        },
        {
          type: 'couturier-processing',
          from: couturierHub,
          to: couturierHub,
          baseCost: this.calculateCouturierHubCost(shipmentData),
          carrier: 'Couturier Team',
          serviceType: 'NFC & Sewing',
          dwellTime: 36,
          flightCost: 0,
          personnelCost: this.calculateHubPersonnelCost('couturier', 1.5)
        },
        {
          type: 'dhl-final',
          from: couturierHub,
          to: buyerCity,
          baseCost: this.calculateDHLCost(couturierHub, buyerCity, shipmentData),
          carrier: 'DHL Express',
          serviceType: 'Final Delivery',
          flightCost: 0,
          personnelCost: 0
        }
      ]
    });
    
    return routes;
  }

  // ========================================================================================
  // REAL COST CALCULATION METHODS
  // ========================================================================================

  calculateDHLCost(fromCity, toCity, shipmentData) {
    // Base DHL rates (would come from real API)
    const baseRates = {
      'domestic': 25,
      'eu-eu': 45,
      'eu-uk': 65,
      'uk-eu': 70,
      'international': 125
    };
    
    const routeType = this.getRouteType(fromCity, toCity);
    const baseRate = baseRates[routeType] || baseRates.international;
    
    // Weight multiplier
    const weight = shipmentData.weight || 2; // Default 2kg
    const weightMultiplier = weight > 5 ? 1.5 : weight > 2 ? 1.2 : 1.0;
    
    // Value multiplier for insurance
    const valueMultiplier = shipmentData.declared_value > 10000 ? 1.3 : 1.0;
    
    return Math.round(baseRate * weightMultiplier * valueMultiplier);
  }

  calculateWGCost(fromCity, toCity, shipmentData) {
    // White-glove base cost calculation
    const distance = this.getDistance(fromCity, toCity);
    const baseCost = distance > 1000 ? 180 : distance > 500 ? 120 : 80;
    
    // Value-based premium
    const valuePremium = shipmentData.declared_value > 50000 ? 100 : 
                        shipmentData.declared_value > 25000 ? 60 : 
                        shipmentData.declared_value > 10000 ? 30 : 0;
    
    return baseCost + valuePremium;
  }

  calculateWGDirectCost(fromCity, toCity, shipmentData) {
    const baseCost = this.calculateWGCost(fromCity, toCity, shipmentData);
    const directPremium = 150; // Premium for direct service
    return baseCost + directPremium;
  }

  calculateFlightCost(fromCity, toCity) {
    // Realistic flight cost estimation based on route
    const routeType = this.getRouteType(fromCity, toCity);
    const flightCosts = {
      'domestic': 0, // Ground transport
      'eu-eu': 200,
      'eu-uk': 180,
      'uk-eu': 185,
      'international': 450
    };
    
    return flightCosts[routeType] || flightCosts.international;
  }

  calculatePersonnelCost(days, shipmentData) {
    // Daily specialist rate
    const dailyRate = 350;
    
    // Value-based bonus
    const valueBonus = shipmentData.declared_value > 50000 ? 100 : 
                      shipmentData.declared_value > 25000 ? 50 : 0;
    
    return Math.round((dailyRate * days) + valueBonus);
  }

  calculateAuthHubCost(shipmentData) {
    // Authentication hub processing cost
    const baseCost = 75; // Base authentication fee
    const tierMultiplier = 1.0; // Tier 2 & 3 same for auth
    
    return Math.round(baseCost * tierMultiplier);
  }

  calculateCouturierHubCost(shipmentData) {
    // Couturier hub cost (NFC + sewing)
    const baseCost = 150; // Base NFC installation and sewing
    const complexityMultiplier = shipmentData.category === 'jewelry' ? 1.5 : 
                                shipmentData.category === 'watches' ? 1.3 : 1.0;
    
    return Math.round(baseCost * complexityMultiplier);
  }

  calculateHubPersonnelCost(hubType, days) {
    const rates = {
      'auth': 250, // Authentication specialist
      'couturier': 400 // Couturier specialist
    };
    
    return Math.round((rates[hubType] || 250) * days);
  }

  calculateLocalPersonnelCost(shipmentData) {
    // Same-city transfer cost
    const baseCost = 45;
    const valueMultiplier = shipmentData.declared_value > 25000 ? 1.5 : 1.0;
    
    return Math.round(baseCost * valueMultiplier);
  }

  calculateSameCityTransfer(fromHub, toHub, shipmentData) {
    // Base same-city transfer cost
    const baseCost = 35;
    const securityLevel = shipmentData.declared_value > 25000 ? 'high' : 'standard';
    const securityMultiplier = securityLevel === 'high' ? 1.8 : 1.0;
    
    return Math.round(baseCost * securityMultiplier);
  }

  // ========================================================================================
  // HELPER METHODS
  // ========================================================================================

  getClosestAuthHub(city) {
    // Simplified hub assignment logic
    const europeanCities = ['paris', 'milan', 'madrid', 'berlin', 'amsterdam'];
    return europeanCities.includes(city.toLowerCase()) ? 'Paris Auth Hub' : 'London Auth Hub';
  }

  getCouturierHub(authHub, declaredValue) {
    // Couturier hub assignment based on auth hub and value
    if (authHub.includes('Paris')) {
      return declaredValue > 30000 ? 'Paris Haute Couture Hub' : 'Paris Couturier Hub';
    }
    return declaredValue > 30000 ? 'London Premium Couturier Hub' : 'London Couturier Hub';
  }

  getRouteType(fromCity, toCity) {
    const from = fromCity.toLowerCase();
    const to = toCity.toLowerCase();
    
    const ukCities = ['london', 'manchester', 'edinburgh', 'birmingham'];
    const euCities = ['paris', 'milan', 'madrid', 'berlin', 'amsterdam', 'zurich'];
    
    const fromUK = ukCities.some(city => from.includes(city));
    const toUK = ukCities.some(city => to.includes(city));
    const fromEU = euCities.some(city => from.includes(city));
    const toEU = euCities.some(city => to.includes(city));
    
    if (fromUK && toUK) return 'domestic';
    if (fromEU && toEU) return 'eu-eu';
    if (fromEU && toUK) return 'eu-uk';
    if (fromUK && toEU) return 'uk-eu';
    
    return 'international';
  }

  getDistance(fromCity, toCity) {
    // Simplified distance calculation (would use real geo API)
    const distances = {
      'london-paris': 340,
      'paris-london': 340,
      'london-milan': 950,
      'milan-london': 950,
      'paris-milan': 640,
      'milan-paris': 640
    };
    
    const key = `${fromCity.toLowerCase()}-${toCity.toLowerCase()}`;
    return distances[key] || 800; // Default distance
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  }
}

module.exports = RoutePlanningService;
