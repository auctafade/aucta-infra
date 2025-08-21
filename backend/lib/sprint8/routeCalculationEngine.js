// lib/sprint8/routeCalculationEngine.js
// Enhanced Route Calculation Engine with Tier-specific routing rules

const { Pool } = require('pg');
const { EventEmitter } = require('events');
const pool = require('../../database/connection');
const DetailedTravelPlanner = require('./detailedTravelPlanner');
const APICostController = require('./apiCostController');

class RouteCalculationEngine extends EventEmitter {
  constructor() {
    super();
    this.pool = pool;
    this.travelPlanner = new DetailedTravelPlanner();
    
    // Hub Price Book - drives all cost calculations
    this.hubPriceBook = new Map();
    this.initializeHubPriceBook();
    
    // Itinerary Engine - builds actual travel plans
    this.itineraryEngine = new ItineraryEngine(this);
    
    // API Cost Controller - manages external API calls with discipline
    this.apiCostController = new APICostController();
    
    // Geocoding cache for A/B addresses
    this.geocodeCache = new Map();
    
    // Rate caches for fast lookups (managed by API Cost Controller)
    this.rateCache = {
      dhl: new Map(),
      wg: new Map(),
      ground: new Map(),
      flights: new Map(),
      trains: new Map()
    };
    
    // ================================================================================
    // CORE ROUTING RULES (LOCKED) - ONLY THESE OPTIONS ARE COMPUTED
    // ================================================================================
    // 
    // Tier 3 (NFC + sewing) - EXACTLY 3 options:
    // 1. Full WG (single operator) — WG from A → HubId → HubCou → B
    // 2. Hybrid (WG → DHL) — WG A → HubId → HubCou, DHL HubCou → B  
    // 3. Hybrid (DHL → WG) — DHL A → HubId, internal rollout HubId→HubCou, WG HubCou → B
    // 
    // Tier 2 (Tag) - EXACTLY 2 options:
    // 1. WG end-to-end: A → HubId → B
    // 2. DHL end-to-end: A → HubId + HubId → B
    // 
    // ENFORCEMENT:
    // - NEVER use DHL between HubId→HubCou (always internal daily rollout)
    // - NO partial WG for Tier 2 (only complete end-to-end)
    // - NO other route options beyond these specifications
    // ================================================================================
    this.ROUTING_RULES = {
      TIER_3: {
        flow: ['SELLER', 'HUB_ID', 'HUB_COU', 'BUYER'],
        options: [
          { id: 'FULL_WG', label: 'Full WG (single operator)', description: 'WG from A → HubId → HubCou → B. One operator, shortest feasible itinerary.' },
          { id: 'HYBRID_WG_DHL', label: 'Hybrid (WG → DHL)', description: 'WG A → HubId → HubCou, DHL HubCou → B' },
          { id: 'HYBRID_DHL_WG', label: 'Hybrid (DHL → WG)', description: 'DHL A → HubId, internal rollout HubId→HubCou, WG HubCou → B' }
        ],
        requiresNFC: true,
        requiresSewing: true,
        internalTransfer: true, // HubId→HubCou is ALWAYS internal rollout, NEVER DHL
        mustUseBothHubs: true,  // Tier 3 MUST use both HubId and HubCou
        strictInternalPolicy: true // NO DHL between hubs under any circumstances
      },
      TIER_2: {
        flow: ['SELLER', 'HUB_ID', 'BUYER'],
        options: [
          { id: 'WG_END_TO_END', label: 'WG end-to-end', description: 'A → HubId → B. Complete WG service only.' },
          { id: 'DHL_END_TO_END', label: 'DHL end-to-end', description: 'A → HubId + HubId → B. Complete DHL service only.' }
        ],
        requiresTag: true,
        requiresSewing: false,
        noPartialWG: true, // Enforce no mixed WG/DHL for Tier 2
        onlyEndToEnd: true, // ONLY complete end-to-end solutions allowed
        singleHubOnly: true // Tier 2 uses ONLY HubId, no HubCou
      }
    };
    
    // Default internal rollout configuration
    this.INTERNAL_ROLLOUT = {
      costPerItem: 25, // EUR
      costPerRun: 50, // EUR base cost
      slaHours: 24,
      dailySchedule: '14:00', // Daily rollout at 2 PM
      bufferHours: 2
    };
  }

  /**
   * Initialize Hub Price Book with comprehensive pricing per hub
   */
  initializeHubPriceBook() {
    // Default hub configurations - to be loaded from database
    const defaultHubs = [
      {
        hubId: "LONDON_HUB1",
        hubCode: "LDN1", 
        hubName: "London Primary Hub",
        city: "London",
        country: "UK",
        currency: "GBP",
        tier2_auth_fee: 150,
        tier3_auth_fee: 200,
        tier3_sew_fee: 180,
        qa_fee: 25,
        tag_unit_cost: 4,
        nfc_unit_cost: 20,
        internal_rollout_cost: 35,
        last_mile_base: 15,
        capacity_multiplier: 1.0,
        sewing_capability: true,
        active: true
      },
      {
        hubId: "PARIS_HUB1",
        hubCode: "PAR1",
        hubName: "Paris Central Hub", 
        city: "Paris",
        country: "FR",
        currency: "EUR",
        tier2_auth_fee: 120,
        tier3_auth_fee: 160,
        tier3_sew_fee: 150,
        qa_fee: 20,
        tag_unit_cost: 5,
        nfc_unit_cost: 25,
        internal_rollout_cost: 25,
        last_mile_base: 12,
        capacity_multiplier: 1.2,
        sewing_capability: true,
        active: true
      },
      {
        hubId: "MILAN_HUB1",
        hubCode: "MLN1",
        hubName: "Milan Fashion Hub",
        city: "Milan", 
        country: "IT",
        currency: "EUR",
        tier2_auth_fee: 110,
        tier3_auth_fee: 150,
        tier3_sew_fee: 140,
        qa_fee: 18,
        tag_unit_cost: 5,
        nfc_unit_cost: 25,
        internal_rollout_cost: 30,
        last_mile_base: 14,
        capacity_multiplier: 0.8,
        sewing_capability: true,
        active: true
      },
      {
        hubId: "FRANKFURT_HUB1",
        hubCode: "FRA1", 
        hubName: "Frankfurt Logistics Hub",
        city: "Frankfurt",
        country: "DE",
        currency: "EUR",
        tier2_auth_fee: 125,
        tier3_auth_fee: 165,
        tier3_sew_fee: 160,
        qa_fee: 22,
        tag_unit_cost: 5,
        nfc_unit_cost: 24,
        internal_rollout_cost: 28,
        last_mile_base: 13,
        capacity_multiplier: 1.1,
        sewing_capability: false, // No sewing at this hub
        active: true
      }
    ];

    // Load into price book
    defaultHubs.forEach(hub => {
      this.hubPriceBook.set(hub.hubId, hub);
    });

    console.log(`✅ Hub Price Book initialized with ${this.hubPriceBook.size} hubs`);
  }

  /**
   * Update hub pricing - triggers instant recalculation
   */
  updateHubPricing(hubId, updates) {
    const existing = this.hubPriceBook.get(hubId);
    if (!existing) {
      throw new Error(`Hub ${hubId} not found in price book`);
    }

    // Merge updates
    const updated = { ...existing, ...updates, lastUpdated: new Date().toISOString() };
    this.hubPriceBook.set(hubId, updated);

    console.log(`💰 Hub pricing updated for ${hubId}:`, updates);
    
    // Emit event for instant recalculation
    this.emit('hubPricingChanged', { hubId, updates, timestamp: new Date().toISOString() });
    
    return updated;
  }

  /**
   * Add new hub to price book
   */
  addHub(hubConfig) {
    const requiredFields = ['hubId', 'hubCode', 'city', 'tier2_auth_fee', 'tier3_auth_fee'];
    for (const field of requiredFields) {
      if (!hubConfig[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const hubData = {
      ...hubConfig,
      currency: hubConfig.currency || 'EUR',
      tier3_sew_fee: hubConfig.tier3_sew_fee || hubConfig.tier3_auth_fee * 1.2,
      qa_fee: hubConfig.qa_fee || 20,
      tag_unit_cost: hubConfig.tag_unit_cost || 5,
      nfc_unit_cost: hubConfig.nfc_unit_cost || 25,
      internal_rollout_cost: hubConfig.internal_rollout_cost || 25,
      last_mile_base: hubConfig.last_mile_base || 12,
      capacity_multiplier: hubConfig.capacity_multiplier || 1.0,
      sewing_capability: hubConfig.sewing_capability !== false,
      active: hubConfig.active !== false,
      created: new Date().toISOString()
    };

    this.hubPriceBook.set(hubData.hubId, hubData);
    console.log(`🏢 New hub added: ${hubData.hubId} in ${hubData.city}`);
    
    return hubData;
  }

  /**
   * Get hub pricing by ID
   */
  getHubPricing(hubId) {
    const pricing = this.hubPriceBook.get(hubId);
    if (!pricing) {
      throw new Error(`Hub pricing not found for: ${hubId}`);
    }
    return pricing;
  }

  /**
   * Get all active hubs with current pricing
   */
  getAllActiveHubs() {
    return Array.from(this.hubPriceBook.values()).filter(hub => hub.active);
  }

  /**
   * Calculate cost for specific hub services
   */
  calculateHubServiceCost(hubId, serviceType, tier = 2) {
    const pricing = this.getHubPricing(hubId);
    
    switch (serviceType) {
      case 'authentication':
        return tier === 3 ? pricing.tier3_auth_fee : pricing.tier2_auth_fee;
      case 'sewing':
        return pricing.tier3_sew_fee || 0;
      case 'qa':
        return pricing.qa_fee || 0;
      case 'tag':
        return pricing.tag_unit_cost || 0;
      case 'nfc':
        return pricing.nfc_unit_cost || 0;
      case 'internal_rollout':
        return pricing.internal_rollout_cost || 0;
      case 'last_mile':
        return pricing.last_mile_base || 0;
      default:
        throw new Error(`Unknown service type: ${serviceType}`);
    }
  }

  /**
   * Convert pricing to common currency (EUR)
   */
  convertToEUR(amount, fromCurrency) {
    const exchangeRates = {
      'EUR': 1.0,
      'GBP': 1.17,
      'USD': 0.92,
      'CHF': 1.04
    };
    
    return amount * (exchangeRates[fromCurrency] || 1.0);
  }

  /**
   * Calculate all route options for a shipment with API cost discipline
   * @param {Object} shipmentData - Complete shipment data including tier, addresses, value, etc.
   * @param {Object} hubData - Available hubs with capacity and pricing
   * @param {string} sessionId - Session ID for API cost tracking
   * @param {boolean} forceRefresh - Force refresh of specific leg types
   * @returns {Array} Array of route options with costs and schedules
   */
  async calculateRouteOptions(shipmentData, hubData, sessionId = null, forceRefresh = false) {
    // Initialize API cost tracking for this render session
    if (sessionId) {
      this.apiCostController.initializeSession(sessionId);
    }
    try {
      const tier = shipmentData.assigned_tier;
      const routingRules = this.ROUTING_RULES[`TIER_${tier}`];
      
      if (!routingRules) {
        throw new Error(`Invalid tier: ${tier}`);
      }
      
      // VALIDATION: Only compute the exact options specified
      const allowedTierOptions = {
        3: ['FULL_WG', 'HYBRID_WG_DHL', 'HYBRID_DHL_WG'],
        2: ['WG_END_TO_END', 'DHL_END_TO_END']
      };
      
      if (!allowedTierOptions[tier]) {
        throw new Error(`Tier ${tier} not supported`);
      }
      
      // Select optimal hubs
      const selectedHubs = await this.selectOptimalHubs(shipmentData, hubData, routingRules);
      
      // Generate ONLY the specified route options - no others
      const routeOptions = [];
      
      for (const optionTemplate of routingRules.options) {
        // STRICT: Only build allowed options
        if (!allowedTierOptions[tier].includes(optionTemplate.id)) {
          console.warn(`Skipping unauthorized route option: ${optionTemplate.id} for Tier ${tier}`);
          continue;
        }
        
        const route = await this.buildRouteOption(
          optionTemplate,
          shipmentData,
          selectedHubs,
          routingRules
        );
        
        if (route && route.feasible) {
          // VALIDATION: Ensure route follows correct pattern
          const isValidRoute = this.validateRoutePattern(route, tier);
          if (isValidRoute) {
            routeOptions.push(route);
          } else {
            console.warn(`Route ${route.id} failed pattern validation for Tier ${tier}`);
          }
        }
      }
      
      // Sort by score and return exact count: 3 for Tier 3, 2 for Tier 2
      const sortedRoutes = this.scoreAndSortRoutes(routeOptions, shipmentData);
      
      // ENFORCED: Return exactly what's specified
      const maxOptions = tier === 3 ? 3 : 2;
      return sortedRoutes.slice(0, maxOptions);
      
    } catch (error) {
      console.error('Error calculating route options:', error);
      throw error;
    }
  }

  /**
   * Select optimal hubs based on ETA + cost + capacity/stock from price book
   */
  async selectOptimalHubs(shipmentData, hubData, routingRules) {
    const { sender_city, buyer_city, sla_target_date, assigned_tier } = shipmentData;
    
    // Get all active hubs from price book (overrides hubData if provided)
    const priceBookHubs = this.getAllActiveHubs();
    const activeHubs = hubData && hubData.length > 0 ? 
      hubData.filter(h => priceBookHubs.some(pb => pb.hubId === h.hubId)) : 
      priceBookHubs;
    
    // Merge capacity data with price book
    const enrichedHubs = activeHubs.map(hub => {
      const pricing = this.getHubPricing(hub.hubId || hub.id);
      const capacityData = hubData?.find(h => h.hubId === pricing.hubId) || {};
      
      return {
        ...pricing,
        // Capacity data (from database or defaults)
        auth_capacity_available: capacityData.auth_capacity_available || 50,
        auth_capacity_total: capacityData.auth_capacity_total || 100,
        sewing_capacity_available: capacityData.sewing_capacity_available || 20,
        sewing_capacity_total: capacityData.sewing_capacity_total || 40,
        nfc_stock: capacityData.nfc_stock || 100,
        tag_stock: capacityData.tag_stock || 200,
        has_sewing_capability: pricing.sewing_capability,
        id: pricing.hubId,
        hub_code: pricing.hubCode
      };
    });
    
    // Filter hubs with available capacity and required services
    let availableHubs = enrichedHubs.filter(hub => {
      const hasAuthCapacity = hub.auth_capacity_available > 0;
      const hasSewingCapacity = !routingRules.requiresSewing || 
        (hub.has_sewing_capability && hub.sewing_capacity_available > 0);
      const hasInventory = (routingRules.requiresNFC && hub.nfc_stock > 0) || 
                          (routingRules.requiresTag && hub.tag_stock > 0);
      
      return hasAuthCapacity && hasSewingCapacity && hasInventory;
    });
    
    if (availableHubs.length === 0) {
      console.warn('⚠️  No hubs meet all requirements, using fallback logic');
      
      // Fallback: Use all enriched hubs but log the constraints
      availableHubs = enrichedHubs.filter(hub => hub.status === 'active');
      
      if (availableHubs.length === 0) {
        // Final fallback: Create demo hubs
        console.warn('⚠️  No active hubs found, using demo hubs');
        availableHubs = [
          {
            hubId: 'LONDON_HUB1', hubCode: 'LDN1', city: 'London', country: 'UK',
            auth_capacity_available: 10, sewing_capacity_available: 5,
            nfc_stock: 100, tag_stock: 200, status: 'active', has_sewing_capability: true
          },
          {
            hubId: 'PARIS_HUB1', hubCode: 'PAR1', city: 'Paris', country: 'FR', 
            auth_capacity_available: 8, sewing_capacity_available: 3,
            nfc_stock: 80, tag_stock: 150, status: 'active', has_sewing_capability: true
          }
        ];
      }
    }
    
    // Score hubs based on ETA + cost + capacity using price book
    const scoredHubs = await Promise.all(
      availableHubs.map(async hub => {
        const score = await this.scoreHubWithPriceBook(hub, shipmentData, assigned_tier);
        return { ...hub, score };
      })
    );
    
    // Sort by score (higher is better)
    scoredHubs.sort((a, b) => b.score - a.score);
    
    console.log(`🏢 Hub selection for Tier ${assigned_tier}:`, 
      scoredHubs.map(h => `${h.hubCode}(${h.city}): ${h.score.toFixed(1)}`));
    
    // Enforce tier-specific hub selection rules
    if (routingRules.singleHubOnly) {
      // Tier 2: Only use HubId, no HubCou
      return {
        hubId: scoredHubs[0],
        hubCou: null
      };
    } else if (routingRules.mustUseBothHubs) {
      // Tier 3: MUST use both HubId and HubCou (authentication and sewing)
      const hubId = scoredHubs[0];
      
      // Find best HubCou with sewing capability
      const sewingHubs = scoredHubs.filter(h => 
        h.has_sewing_capability && h.sewing_capacity_available > 0);
      
      if (sewingHubs.length === 0) {
        throw new Error('No hubs available with sewing capability for Tier 3');
      }
      
      // Prefer different hub for HubCou to enforce proper routing
      let hubCou = sewingHubs.find(h => h.hubId !== hubId.hubId);
      if (!hubCou) {
        // If no different hub available, use same hub but mark for combined processing
        hubCou = sewingHubs[0];
        console.log(`⚠️  Using same hub for both auth and sewing: ${hubCou.hubCode}`);
      }
      
      return {
        hubId: hubId,
        hubCou: hubCou
      };
    } else {
      // Legacy logic for other cases
      const hubId = scoredHubs[0];
      const hubCou = routingRules.requiresSewing ? 
        (scoredHubs.find(h => h.has_sewing_capability) || scoredHubs[0]) : 
        null;
      
      return {
        hubId: hubId,
        hubCou: hubCou
      };
    }
  }

  /**
   * Build a complete route option with detailed travel planning
   */
  async buildRouteOption(optionTemplate, shipmentData, selectedHubs, routingRules) {
    const route = {
      id: optionTemplate.id,
      label: optionTemplate.label,
      description: optionTemplate.description,
      tier: shipmentData.assigned_tier,
      hubId: selectedHubs.hubId,
      hubCou: selectedHubs.hubCou,
      legs: [],
      costBreakdown: {},
      schedule: {},
      feasible: true,
      warnings: [],
      guardrails: []
    };
    
    try {
      // Build legs based on option type
      switch (optionTemplate.id) {
        case 'FULL_WG':
          route.legs = await this.buildFullWGLegs(shipmentData, selectedHubs, routingRules);
          break;
          
        case 'HYBRID_WG_DHL':
          route.legs = await this.buildHybridWGDHLLegs(shipmentData, selectedHubs, routingRules);
          break;
          
        case 'HYBRID_DHL_WG':
          route.legs = await this.buildHybridDHLWGLegs(shipmentData, selectedHubs, routingRules);
          break;
          
        case 'WG_END_TO_END':
          route.legs = await this.buildWGEndToEndLegs(shipmentData, selectedHubs);
          break;
          
        case 'DHL_END_TO_END':
          route.legs = await this.buildDHLEndToEndLegs(shipmentData, selectedHubs);
          break;
      }
      
      // Calculate costs for all legs
      route.costBreakdown = await this.calculateRouteCosts(route, shipmentData);
      
      // Build schedule with time zones
      route.schedule = this.buildSchedule(route.legs, shipmentData);
      
      // Validate feasibility
      route.feasible = await this.validateRouteFeasibility(route, shipmentData);
      
      // Check guardrails  
      route.guardrails = this.checkGuardrails(route, shipmentData);
      
      return route;
      
    } catch (error) {
      console.error(`Error building route option ${optionTemplate.id}:`, error);
      route.feasible = false;
      route.warnings.push(error.message);
    }
    
          // Apply detailed itinerary planning for final accuracy if route is feasible
      console.log(`Route ${route.id}: feasible=${route.feasible}, legs=${route.legs?.length || 0}`);
      if (route.feasible) {
        console.log(`Applying detailed itinerary planning for ${route.id}...`);
        
        // Build detailed itinerary with the engine
        const itineraryInputs = {
          originAddress: shipmentData.sender_address,
          destinationAddress: shipmentData.buyer_address,
          originGeocode: shipmentData.sender_geocode,
          destinationGeocode: shipmentData.buyer_geocode,
          timeWindows: {
            pickup: shipmentData.pickup_window,
            delivery: shipmentData.delivery_window,
            businessHours: true
          },
          weightDims: {
            weight: shipmentData.weight || 2.5,
            volume: shipmentData.volume || 0.5,
            fragile: shipmentData.fragility === 'high'
          },
          assignedTier: shipmentData.assigned_tier,
          slaTargetDate: shipmentData.sla_target_date,
          shipmentValue: shipmentData.declared_value
        };
        
        try {
          const detailedItinerary = await this.itineraryEngine.buildItinerary(
            itineraryInputs,
            [selectedHubs.hubId, selectedHubs.hubCou].filter(Boolean),
            this.rateCache
          );
          
          // Enhance route with detailed itinerary data
          route.detailedItinerary = detailedItinerary;
          route.slotBookings = detailedItinerary.slotBookings;
          route.slaValidation = detailedItinerary.sla;
          route.riskFlags = detailedItinerary.riskFlags;
          
          // Update ETA with itinerary calculation
          if (detailedItinerary.eta) {
            route.schedule.estimatedDelivery = detailedItinerary.eta.estimatedDelivery;
            route.schedule.totalHours = detailedItinerary.eta.totalHours;
            route.schedule.timeline = detailedItinerary.eta.timeline;
          }
          
          console.log(`✅ Detailed itinerary built: ${detailedItinerary.totalDuration}h total, SLA grade: ${detailedItinerary.sla.grade}`);
        } catch (error) {
          console.warn(`⚠️  Could not build detailed itinerary: ${error.message}`);
          // Continue with basic route data
        }
      
      // FORCE immediate generation of detailed data for WG routes
      route.segments = [];
      route.operatorDetails = { totalHours: 0, overtime: 0, returnJourney: false, requiresOvernight: false };
      route.timeline = [];
      
      for (const leg of route.legs || []) {
        if (leg.type === 'white-glove' || leg.carrier === 'white-glove') {
          const operatorHub = selectedHubs.hubId || { city: 'London' };
          const detailedJourney = this.createRealisticWGJourney(leg, shipmentData, operatorHub);
          
          // Add segments and timeline immediately
          route.segments.push(...detailedJourney.segments);
          route.timeline.push(...detailedJourney.timeline);
          
          // Update operator details
          route.operatorDetails.totalHours += detailedJourney.operator.totalHours;
          route.operatorDetails.overtime += detailedJourney.operator.overtime;
          route.operatorDetails.returnJourney = true;
          
          // Update cost breakdown with detailed transport costs
          if (!route.costBreakdown.transport) route.costBreakdown.transport = { flights: [], trains: [], groundTransport: [] };
          route.costBreakdown.transport.flights.push(...detailedJourney.costs.transport.flights);
          route.costBreakdown.transport.trains.push(...detailedJourney.costs.transport.trains);
          route.costBreakdown.transport.groundTransport.push(...detailedJourney.costs.transport.groundTransport);
          
          // Update labor costs
          route.costBreakdown.labor = {
            regular: Math.min(detailedJourney.operator.totalHours, 8) * 65,
            overtime: Math.max(0, detailedJourney.operator.totalHours - 8) * 97.5,
            perDiem: detailedJourney.operator.totalHours > 12 ? 105 : 0,
            total: detailedJourney.costs.labor
          };
          
          // Add return journey cost
          route.costBreakdown.returnJourney = detailedJourney.costs.returnJourney;
          
          console.log(`✅ Generated ${detailedJourney.segments.length} segments and ${detailedJourney.timeline.length} timeline items for ${route.id}`);
        }
      }
      
      console.log(`✅ Total route enhancement: ${route.segments.length} segments, ${route.timeline.length} timeline items`);
    } else {
      console.log(`❌ Route ${route.id} not feasible, skipping detailed planning`);
    }
    
    return route;
  }

  /**
   * Apply detailed travel planning with precise schedules and costs
   */
  async applyDetailedTravelPlanning(route, shipmentData, selectedHubs) {
    console.log(`🚀 Starting detailed travel planning for route ${route.id}`);
    try {
      const detailedSegments = [];
      const detailedTimeline = [];
      const preciseTransportCosts = {
        flights: [],
        trains: [],
        groundTransport: []
      };
      
      let totalOperatorHours = 0;
      let requiresOvernight = false;
      
      for (const leg of route.legs || []) {
        console.log(`Processing leg: type=${leg.type}, carrier=${leg.carrier}`);
        if (leg.type === 'white-glove' || leg.carrier === 'white-glove') {
          // Plan detailed WG journey with the travel planner
          const operatorHub = leg.from_type === 'hub' ? selectedHubs.hubId : 
                             leg.to_type === 'hub' ? selectedHubs.hubCou : selectedHubs.hubId;
          
          console.log(`Planning WG journey for leg from ${leg.from?.city} to ${leg.to?.city}`);
          
          // Créer un voyage détaillé immédiatement
          const detailedJourney = this.createRealisticWGJourney(leg, shipmentData, operatorHub);
          
          // Update route with detailed information
          leg.detailedPlan = detailedJourney;
          leg.actualCost = detailedJourney.costs.total;
          leg.operatorHours = detailedJourney.operator.totalHours;
          leg.timeline = detailedJourney.timeline;
          leg.returnJourney = detailedJourney.segments.find(s => s.type === 'operator-return');
          
          console.log(`Leg details: ${detailedJourney.segments.length} segments, ${detailedJourney.timeline.length} timeline`);
          
          // Accumulate detailed transport costs (with safety checks)
          if (detailedJourney.costs.transport.flights) {
            preciseTransportCosts.flights.push(...detailedJourney.costs.transport.flights);
          }
          if (detailedJourney.costs.transport.trains) {
            preciseTransportCosts.trains.push(...detailedJourney.costs.transport.trains);
          }
          if (detailedJourney.costs.transport.groundTransport) {
            preciseTransportCosts.groundTransport.push(...detailedJourney.costs.transport.groundTransport);
          }
          
          totalOperatorHours += detailedJourney.operator.totalHours || 0;
          
          if (detailedJourney.operator.totalHours > 16) {
            requiresOvernight = true;
          }
          
          // IMPORTANT: Ajouter les segments et timeline aux arrays
          detailedSegments.push(...detailedJourney.segments);
          detailedTimeline.push(...detailedJourney.timeline);
          
          console.log(`Total accumulated: ${detailedSegments.length} segments, ${detailedTimeline.length} timeline items`);
          
        } else if (leg.type === 'dhl') {
          // Plan detailed DHL transport with precise pricing
          const dhlPlan = await this.travelPlanner.planDHLTransport(leg, shipmentData);
          
          leg.detailedPlan = dhlPlan;
          leg.actualCost = dhlPlan.costs.total;
          leg.timeline = dhlPlan.timeline;
          
          detailedTimeline.push(...dhlPlan.timeline);
        }
      }
      
      // Calculate precise labor costs
      const laborCosts = this.travelPlanner.calculateLaborCosts(totalOperatorHours);
      
      // Update route with detailed planning results
      // Set operator details
      route.operatorDetails = {
        totalHours: totalOperatorHours || 0,
        overtime: totalOperatorHours > 8 ? totalOperatorHours - 8 : 0,
        returnJourney: route.legs.some(leg => leg.returnJourney),
        requiresOvernight: totalOperatorHours > 16
      };
      
      // Set segments and timeline
      route.segments = detailedSegments || [];
      route.timeline = detailedTimeline || [];
      
      console.log(`✅ Route ${route.id} enhanced: ${route.segments.length} segments, ${route.timeline.length} timeline items`);
      
      // Update cost breakdown with precise values
      route.costBreakdown.labor = {
        regular: laborCosts.regular,
        overtime: laborCosts.overtime,
        perDiem: laborCosts.perDiem,
        total: laborCosts.total
      };
      
      route.costBreakdown.transport = preciseTransportCosts;
      
      // Add accommodation and meals if overnight
      if (requiresOvernight) {
        route.costBreakdown.accommodation = this.calculateAccommodationCosts(route);
        route.costBreakdown.meals = this.calculateMealCosts(totalOperatorHours);
      }
      
      // Recalculate totals with precise values
      const newTransportTotal = 
        preciseTransportCosts.flights.reduce((sum, f) => sum + f.cost, 0) +
        preciseTransportCosts.trains.reduce((sum, t) => sum + t.cost, 0) +
        preciseTransportCosts.groundTransport.reduce((sum, g) => sum + g.cost, 0);
      
      route.costBreakdown.returnJourney = route.legs
        .filter(leg => leg.returnJourney)
        .reduce((sum, leg) => sum + leg.returnJourney.totalCost, 0);
      
      // Final total cost calculation
      route.totalCost = 
        laborCosts.total +
        newTransportTotal +
        route.costBreakdown.hubFees +
        route.costBreakdown.inventory +
        route.costBreakdown.insurance +
        route.costBreakdown.returnJourney +
        (route.costBreakdown.accommodation || 0) +
        (route.costBreakdown.meals || 0);
      
      // Set client price with margin
      const marginMultiplier = this.getMarginMultiplier(route.grade);
      route.clientPrice = Math.round(route.totalCost * marginMultiplier);
      
      // Calculate delivery date based on precise timeline
      route.deliveryDate = this.calculatePreciseDeliveryDate(route.timeline);
      route.estimatedDays = this.calculateEstimatedDays(route.timeline);
      
      // Add guardrails based on detailed analysis
      route.guardrails = this.generateGuardrails(route, shipmentData);
      
    } catch (error) {
      console.error('Error applying detailed travel planning:', error);
      // Fall back to original estimates if detailed planning fails
    }
  }

  /**
   * Generate precise timeline from detailed journey segments
   */
  generatePreciseTimeline(detailedEvents) {
    return detailedEvents
      .sort((a, b) => new Date(a.time || a.startTime) - new Date(b.time || b.startTime))
      .map((event, index) => ({
        step: index + 1,
        time: this.formatEventTime(event.time || event.startTime),
        location: event.location || `${event.from} → ${event.to}`,
        action: event.action || event.description || event.type,
        duration: event.duration || this.calculateEventDuration(event),
        responsible: event.responsible || this.getResponsibleParty(event),
        checkpoints: event.checkpoints || this.generateCheckpoints(event)
      }));
  }

  /**
   * Calculate accommodation costs for overnight trips
   */
  calculateAccommodationCosts(route) {
    const nights = Math.floor(route.operatorDetails.totalHours / 24);
    const cityRates = {
      'London': 180,
      'Paris': 160,
      'Milan': 140,
      'Frankfurt': 120
    };
    
    // Find the most expensive city in the route for accommodation
    const cities = route.legs
      .map(leg => [leg.from_location, leg.to_location])
      .flat()
      .filter(city => cityRates[city]);
    
    const maxRate = Math.max(...cities.map(city => cityRates[city] || 100));
    return nights * maxRate;
  }

  /**
   * Calculate meal costs based on travel duration
   */
  calculateMealCosts(totalHours) {
    const meals = Math.ceil(totalHours / 8); // Meal every 8 hours
    return meals * 35; // €35 per meal allowance
  }

  /**
   * Get margin multiplier based on route grade
   */
  getMarginMultiplier(grade) {
    const margins = {
      'A': 1.25, // 25% margin for premium routes
      'B': 1.30, // 30% margin for standard routes
      'C': 1.35  // 35% margin for complex routes
    };
    return margins[grade] || 1.30;
  }

  /**
   * Calculate precise delivery date from timeline
   */
  calculatePreciseDeliveryDate(timeline) {
    const lastEvent = timeline[timeline.length - 1];
    if (lastEvent && lastEvent.time) {
      return new Date(lastEvent.time).toISOString();
    }
    
    // Fallback calculation
    const now = new Date();
    now.setDate(now.getDate() + 2); // 2-day default
    return now.toISOString();
  }

  /**
   * Calculate estimated days from timeline
   */
  calculateEstimatedDays(timeline) {
    if (timeline.length < 2) return 1;
    
    const start = new Date(timeline[0].time);
    const end = new Date(timeline[timeline.length - 1].time);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    return Math.max(1, days);
  }

  /**
   * Generate guardrails and warnings for the route
   */
  generateGuardrails(route, shipmentData) {
    const guardrails = [];
    
    // Check for overtime
    if (route.operatorDetails.overtime > 4) {
      guardrails.push({
        type: 'warning',
        message: `Opérateur en heures supplémentaires importantes (${route.operatorDetails.overtime}h). Considérer une pause ou second opérateur.`
      });
    }
    
    // Check for high-value items
    if (parseFloat(shipmentData.declared_value) > 50000) {
      guardrails.push({
        type: 'info',
        message: 'Article de haute valeur - assurance supplémentaire et protocoles de sécurité renforcés appliqués.'
      });
    }
    
    // Check for fragile items
    if (shipmentData.fragility === 'high') {
      guardrails.push({
        type: 'warning',
        message: 'Article fragile - manipulation spécialisée requise à chaque étape du transport.'
      });
    }
    
    // Check for weekend delivery
    const deliveryDate = new Date(route.deliveryDate);
    if (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      guardrails.push({
        type: 'info',
        message: 'Livraison programmée en weekend - surcharge weekend-end appliquée.'
      });
    }
    
    // Check for international transport
    const isInternational = route.legs.some(leg => 
      leg.from_location !== leg.to_location && 
      this.isDifferentCountry(leg.from_location, leg.to_location)
    );
    
    if (isInternational) {
      guardrails.push({
        type: 'info',
        message: 'Transport international - documentation douanière et délais additionnels possibles.'
      });
    }
    
    return guardrails;
  }

  /**
   * Helper methods for detailed planning
   */
  formatEventTime(timeString) {
    return new Date(timeString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  calculateEventDuration(event) {
    if (event.duration) return `${event.duration}min`;
    if (event.startTime && event.endTime) {
      const duration = (new Date(event.endTime) - new Date(event.startTime)) / 60000;
      return `${Math.round(duration)}min`;
    }
    return 'Variable';
  }

  getResponsibleParty(event) {
    if (event.type === 'wg' || event.type?.includes('operator')) return 'Opérateur WG';
    if (event.type === 'dhl') return 'DHL';
    if (event.type?.includes('hub')) return 'Hub Aucta';
    return 'Système';
  }

  generateCheckpoints(event) {
    const checkpoints = [];
    
    if (event.type === 'pickup') {
      checkpoints.push('Vérification identité expéditeur');
      checkpoints.push('Contrôle état article');
      checkpoints.push('Photo de récupération');
    } else if (event.type === 'delivery') {
      checkpoints.push('Vérification identité destinataire');
      checkpoints.push('Contrôle intégrité article');
      checkpoints.push('Signature de livraison');
    } else if (event.type?.includes('hub')) {
      checkpoints.push('Enregistrement arrivée hub');
      checkpoints.push('Contrôle qualité');
      checkpoints.push('Mise à jour tracking');
    }
    
    return checkpoints;
  }

  isDifferentCountry(city1, city2) {
    const countries = {
      'London': 'UK',
      'Paris': 'FR',
      'Milan': 'IT',
      'Frankfurt': 'DE',
      'Nice': 'FR'
    };
    
    return countries[city1] !== countries[city2];
  }

  /**
   * Crée un voyage WG réaliste avec données détaillées
   */
  createRealisticWGJourney(leg, shipmentData, operatorHub) {
    const fromCity = leg.from?.city || 'Départ';
    const toCity = leg.to?.city || 'Destination';
    const distance = this.calculateSimpleDistance(fromCity, toCity);
    
    // Calculs temporels réalistes
    const now = new Date();
    const startTime = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // +2h
    const flightDuration = distance > 500 ? 180 : 0; // 3h de vol si >500km
    const trainDuration = distance > 150 && distance <= 500 ? 120 : 0; // 2h de train
    const carDuration = distance <= 150 ? Math.max(60, distance * 1.5) : 0; // voiture courtes distances
    
    const transportDuration = flightDuration || trainDuration || carDuration || 120;
    const totalDuration = transportDuration + 120; // +2h pour pickup/delivery
    const endTime = new Date(new Date(startTime).getTime() + totalDuration * 60000).toISOString();
    
    // Segments réalistes
    const segments = [];
    
    // 1. Pickup
    segments.push({
      type: 'pickup',
      from: 'Hub opérateur',
      to: fromCity,
      startTime,
      endTime: new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(),
      method: 'White-Glove Pickup',
      cost: 75
    });
    
    // 2. Transport principal
    let transportCost = 0;
    let transportMethod = '';
    if (distance > 500) {
      transportCost = 285; // Vol
      transportMethod = 'Vol British Airways BA315';
    } else if (distance > 150) {
      transportCost = 150; // Train
      transportMethod = 'Train Eurostar/TGV';
    } else {
      transportCost = Math.round(distance * 0.8 + 35); // Route
      transportMethod = 'Transport terrestre direct';
    }
    
    segments.push({
      type: 'main-transport',
      from: fromCity,
      to: toCity,
      startTime: new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(),
      endTime: new Date(new Date(startTime).getTime() + (30 + transportDuration) * 60000).toISOString(),
      method: transportMethod,
      cost: transportCost
    });
    
    // 3. Delivery
    segments.push({
      type: 'delivery',
      from: toCity,
      to: leg.to?.address || toCity,
      startTime: new Date(new Date(startTime).getTime() + (30 + transportDuration) * 60000).toISOString(),
      endTime,
      method: 'White-Glove Delivery',
      cost: 85
    });
    
    // 4. Voyage de retour opérateur
    const returnDuration = Math.max(transportDuration, 90);
    const returnCost = Math.round(transportCost * 0.8); // Retour moins cher
    segments.push({
      type: 'operator-return',
      from: toCity,
      to: operatorHub?.city || 'Hub opérateur',
      startTime: endTime,
      endTime: new Date(new Date(endTime).getTime() + returnDuration * 60000).toISOString(),
      method: `Retour opérateur (${transportMethod})`,
      cost: returnCost
    });
    
    // Coûts détaillés
    const totalHours = Math.round(totalDuration / 60 * 10) / 10;
    const overtime = Math.max(0, totalHours - 8);
    const laborCost = Math.min(totalHours, 8) * 65 + overtime * 97.5; // €65/h + €97.5/h sup
    
    const transportCosts = {
      flights: distance > 500 ? [{
        airline: 'British Airways',
        flightNumber: 'BA315',
        route: `${fromCity} → ${toCity}`,
        departureTime: new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(),
        arrivalTime: new Date(new Date(startTime).getTime() + (30 + flightDuration) * 60000).toISOString(),
        cost: transportCost,
        class: 'Economy Flexible'
      }] : [],
      trains: distance > 150 && distance <= 500 ? [{
        provider: 'Eurostar',
        trainNumber: 'TGV2156',
        route: `${fromCity} → ${toCity}`,
        departureTime: new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(),
        arrivalTime: new Date(new Date(startTime).getTime() + (30 + trainDuration) * 60000).toISOString(),
        cost: transportCost,
        class: '2nd Class Flexible'
      }] : [],
      groundTransport: [
        { type: 'pickup', from: fromCity, to: fromCity, cost: 75, method: 'White-Glove Pickup' },
        { type: 'delivery', from: toCity, to: toCity, cost: 85, method: 'White-Glove Delivery' },
        { type: 'return', from: toCity, to: operatorHub?.city || 'Hub', cost: returnCost, method: 'Retour opérateur' }
      ]
    };
    
    // Timeline précise
    const timeline = [
      {
        step: 1,
        time: startTime,
        location: fromCity,
        action: 'Pickup chez expéditeur',
        duration: '30min',
        responsible: 'Opérateur WG',
        checkpoints: ['Vérification identité', 'Contrôle état article', 'Photo récupération']
      },
      {
        step: 2,
        time: new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(),
        location: `${fromCity} → ${toCity}`,
        action: `Transport principal (${transportMethod})`,
        duration: `${Math.round(transportDuration)}min`,
        responsible: 'Opérateur WG',
        checkpoints: ['Départ confirmé', 'En transit', 'Arrivée destination']
      },
      {
        step: 3,
        time: new Date(new Date(startTime).getTime() + (30 + transportDuration) * 60000).toISOString(),
        location: toCity,
        action: 'Livraison finale',
        duration: '45min',
        responsible: 'Opérateur WG',
        checkpoints: ['Vérification destinataire', 'Contrôle intégrité', 'Signature livraison']
      },
      {
        step: 4,
        time: endTime,
        location: `${toCity} → ${operatorHub?.city || 'Hub'}`,
        action: 'Retour opérateur au hub',
        duration: `${Math.round(returnDuration)}min`,
        responsible: 'Opérateur WG',
        checkpoints: ['Départ retour', 'En transit', 'Arrivée hub']
      }
    ];
    
    return {
      operator: {
        homeHub: operatorHub?.city || 'Hub',
        startTime,
        endTime: new Date(new Date(endTime).getTime() + returnDuration * 60000).toISOString(),
        totalHours,
        overtime
      },
      segments,
      costs: {
        labor: laborCost,
        transport: transportCosts,
        accommodation: totalHours > 16 ? 160 : 0,
        meals: totalHours > 12 ? 105 : 0, // 3 repas
        returnJourney: returnCost,
        total: laborCost + transportCost + 160 + returnCost + (totalHours > 16 ? 160 : 0) + (totalHours > 12 ? 105 : 0)
      },
      timeline
    };
  }
  
  /**
   * Calcule une distance simple entre deux villes
   */
  calculateSimpleDistance(fromCity, toCity) {
    const distances = {
      'London-Paris': 465, 'Paris-London': 465,
      'London-Milan': 1155, 'Milan-London': 1155,
      'Paris-Milan': 850, 'Milan-Paris': 850,
      'Paris-Frankfurt': 480, 'Frankfurt-Paris': 480,
      'London-Frankfurt': 930, 'Frankfurt-London': 930,
      'Paris-Nice': 940, 'Nice-Paris': 940,
      'London-Nice': 1280, 'Nice-London': 1280,
      'Paris-Suresnes': 15, 'Suresnes-Paris': 15,
      'London-Harrogate': 320, 'Harrogate-London': 320
    };
    
    const key = `${fromCity}-${toCity}`;
    return distances[key] || distances[`${toCity}-${fromCity}`] || 300; // Default 300km
  }

  /**
   * Build legs for Full WG option (Tier 3)
   * Pattern: Single WG operator from A → HubId → HubCou → B
   * Shortest feasible itinerary respecting windows/SLA + Hub slots (Auth & Sewing)
   */
  async buildFullWGLegs(shipmentData, selectedHubs, routingRules) {
    const legs = [];
    const { hubId, hubCou } = selectedHubs;
    
    // Leg 1: Seller → HubId (WG - single operator starts journey)
    legs.push({
      order: 1,
      type: 'white-glove',
      from: {
        type: 'seller',
        address: shipmentData.sender_address,
        city: shipmentData.sender_city,
        country: shipmentData.sender_country
      },
      to: {
        type: 'hub',
        hubCode: hubId.hub_code,
        address: hubId.address,
        city: hubId.city,
        country: hubId.country
      },
      carrier: 'white-glove',
      service: 'pickup-and-delivery',
      processing: 'authentication',
      singleOperator: true, // ENFORCED: Same operator continues
      description: 'Single operator picks up and continues to HubCou'
    });
    
    // Leg 2: HubId → HubCou (ALWAYS internal rollout for Tier 3, NEVER DHL)
    if (hubId.id !== hubCou.id) {
      // STRICT ENFORCEMENT: Different hubs MUST use internal rollout
      legs.push({
        order: 2,
        type: 'internal-rollout',
        from: {
          type: 'hub',
          hubCode: hubId.hub_code,
          city: hubId.city
        },
        to: {
          type: 'hub',
          hubCode: hubCou.hub_code,
          city: hubCou.city
        },
        carrier: 'internal',
        service: 'daily-rollout',
        processing: 'sewing-and-qa',
        strictPolicy: 'NO_DHL_BETWEEN_HUBS', // ENFORCED: Never DHL between hubs
        description: 'Internal rollout with our config price/SLA'
      });
    } else {
      // Same hub - combined processing (auth + sewing in one location)
      legs[0].processing = 'authentication-sewing-qa';
    }
    
    // Leg 3: HubCou → Buyer (WG - same operator completes delivery)
    const lastHub = hubCou || hubId;
    legs.push({
      order: legs.length + 1,
      type: 'white-glove',
      from: {
        type: 'hub',
        hubCode: lastHub.hub_code,
        city: lastHub.city
      },
      to: {
        type: 'buyer',
        address: shipmentData.buyer_address,
        city: shipmentData.buyer_city,
        country: shipmentData.buyer_country
      },
      carrier: 'white-glove',
      service: 'final-delivery',
      processing: 'none',
      singleOperator: true, // ENFORCED: Same operator completes
      description: 'Same operator completes final delivery'
    });
    
    return legs;
  }

  /**
   * Build legs for Hybrid WG→DHL option (Tier 3)
   * Pattern: WG A → HubId → HubCou, DHL HubCou → B
   */
  async buildHybridWGDHLLegs(shipmentData, selectedHubs, routingRules) {
    const legs = [];
    const { hubId, hubCou } = selectedHubs;
    
    // Leg 1: Seller → HubId (WG)
    legs.push({
      order: 1,
      type: 'white-glove',
      from: {
        type: 'seller',
        address: shipmentData.sender_address,
        city: shipmentData.sender_city
      },
      to: {
        type: 'hub',
        hubCode: hubId.hub_code,
        city: hubId.city
      },
      carrier: 'white-glove',
      service: 'pickup-and-delivery',
      processing: 'authentication',
      description: 'WG pickup and delivery to HubId'
    });
    
    // Leg 2: HubId → HubCou (ALWAYS Internal Rollout for Tier 3 - NEVER DHL)
    if (hubId.id !== hubCou.id) {
      legs.push({
        order: 2,
        type: 'internal-rollout',
        from: {
          type: 'hub',
          hubCode: hubId.hub_code
        },
        to: {
          type: 'hub',
          hubCode: hubCou.hub_code
        },
        carrier: 'internal',
        service: 'daily-rollout',
        processing: 'sewing-and-qa',
        strictPolicy: 'NO_DHL_BETWEEN_HUBS', // ENFORCED: Never DHL between hubs
        description: 'Internal rollout with our config price/SLA'
      });
    } else {
      // Same hub - combined processing
      legs[0].processing = 'authentication-sewing-qa';
    }
    
    // Leg 3: HubCou → Buyer (DHL)
    const lastHub = hubCou || hubId;
    legs.push({
      order: legs.length + 1,
      type: 'dhl',
      from: {
        type: 'hub',
        hubCode: lastHub.hub_code,
        city: lastHub.city
      },
      to: {
        type: 'buyer',
        address: shipmentData.buyer_address,
        city: shipmentData.buyer_city
      },
      carrier: 'dhl',
      service: shipmentData.priority ? 'express' : 'standard',
      processing: 'none',
      description: 'DHL final delivery from HubCou to buyer'
    });
    
    return legs;
  }

  /**
   * Build legs for Hybrid DHL→WG option (Tier 3)
   * Pattern: DHL A → HubId, internal rollout HubId→HubCou, WG HubCou → B
   */
  async buildHybridDHLWGLegs(shipmentData, selectedHubs, routingRules) {
    const legs = [];
    const { hubId, hubCou } = selectedHubs;
    
    // Leg 1: Seller → HubId (DHL)
    legs.push({
      order: 1,
      type: 'dhl',
      from: {
        type: 'seller',
        address: shipmentData.sender_address,
        city: shipmentData.sender_city
      },
      to: {
        type: 'hub',
        hubCode: hubId.hub_code,
        city: hubId.city
      },
      carrier: 'dhl',
      service: 'standard',
      processing: 'authentication'
    });
    
    // Leg 2: HubId → HubCou (ALWAYS Internal Rollout - NEVER DHL)
    if (hubId.id !== hubCou.id) {
      legs.push({
        order: 2,
        type: 'internal-rollout',
        from: {
          type: 'hub',
          hubCode: hubId.hub_code
        },
        to: {
          type: 'hub',
          hubCode: hubCou.hub_code
        },
        carrier: 'internal',
        service: 'daily-rollout',
        processing: 'sewing-and-qa',
        strictPolicy: 'NO_DHL_BETWEEN_HUBS', // ENFORCED: Never DHL between hubs
        description: 'Internal rollout with our config price/SLA'
      });
    } else {
      // Same hub - combined processing
      legs[0].processing = 'authentication-sewing-qa';
    }
    
    // Leg 3: HubCou → Buyer (WG)
    const lastHub = hubCou || hubId;
    legs.push({
      order: legs.length + 1,
      type: 'white-glove',
      from: {
        type: 'hub',
        hubCode: lastHub.hub_code,
        city: lastHub.city
      },
      to: {
        type: 'buyer',
        address: shipmentData.buyer_address,
        city: shipmentData.buyer_city
      },
      carrier: 'white-glove',
      service: 'final-delivery',
      processing: 'none'
    });
    
    return legs;
  }

  /**
   * Build legs for WG End-to-End option (Tier 2)
   */
  async buildWGEndToEndLegs(shipmentData, selectedHubs) {
    const legs = [];
    const { hubId } = selectedHubs;
    
    // Leg 1: Seller → HubId (WG)
    legs.push({
      order: 1,
      type: 'white-glove',
      from: {
        type: 'seller',
        address: shipmentData.sender_address,
        city: shipmentData.sender_city
      },
      to: {
        type: 'hub',
        hubCode: hubId.hub_code,
        city: hubId.city
      },
      carrier: 'white-glove',
      service: 'pickup-and-delivery',
      processing: 'authentication-and-tagging'
    });
    
    // Leg 2: HubId → Buyer (WG - same operator if possible)
    legs.push({
      order: 2,
      type: 'white-glove',
      from: {
        type: 'hub',
        hubCode: hubId.hub_code,
        city: hubId.city
      },
      to: {
        type: 'buyer',
        address: shipmentData.buyer_address,
        city: shipmentData.buyer_city
      },
      carrier: 'white-glove',
      service: 'final-delivery',
      processing: 'none',
      continuity: true // Try to use same operator
    });
    
    return legs;
  }

  /**
   * Build legs for DHL End-to-End option (Tier 2)
   */
  async buildDHLEndToEndLegs(shipmentData, selectedHubs) {
    const legs = [];
    const { hubId } = selectedHubs;
    
    // Leg 1: Seller → HubId (DHL)
    legs.push({
      order: 1,
      type: 'dhl',
      from: {
        type: 'seller',
        address: shipmentData.sender_address,
        city: shipmentData.sender_city
      },
      to: {
        type: 'hub',
        hubCode: hubId.hub_code,
        city: hubId.city
      },
      carrier: 'dhl',
      service: 'standard',
      processing: 'authentication-and-tagging'
    });
    
    // Leg 2: HubId → Buyer (DHL)
    legs.push({
      order: 2,
      type: 'dhl',
      from: {
        type: 'hub',
        hubCode: hubId.hub_code,
        city: hubId.city
      },
      to: {
        type: 'buyer',
        address: shipmentData.buyer_address,
        city: shipmentData.buyer_city
      },
      carrier: 'dhl',
      service: shipmentData.priority ? 'express' : 'standard',
      processing: 'none'
    });
    
    return legs;
  }

  /**
   * Calculate comprehensive costs for a route
   */
  async calculateRouteCosts(route, shipmentData) {
    const costs = {
      wgLabor: 0,
      wgTravel: 0,
      flights: 0,
      trains: 0,
      ground: 0,
      dhlStandard: 0,
      dhlExpress: 0,
      hubIdFee: 0,
      hubCouFee: 0,
      nfcUnit: 0,
      tagUnit: 0,
      internalRollout: 0,
      insurance: 0,
      surcharges: {
        peak: 0,
        remote: 0,
        weekend: 0,
        fragile: 0,
        fuel: 0
      },
      total: 0,
      clientPrice: 0,
      margin: 0,
      marginPercentage: 0
    };
    
    // Get hub pricing from route
    const hubIdPricing = route.hubId;
    const hubCouPricing = route.hubCou;
    
    // Calculate detailed transport costs if they exist from enhanced planning
    if (route.costBreakdown?.transport) {
      // Sum flight costs
      if (route.costBreakdown.transport.flights) {
        costs.flights = route.costBreakdown.transport.flights.reduce((sum, flight) => sum + (flight.cost || 0), 0);
      }
      
      // Sum train costs  
      if (route.costBreakdown.transport.trains) {
        costs.trains = route.costBreakdown.transport.trains.reduce((sum, train) => sum + (train.cost || 0), 0);
      }
      
      // Sum ground transport costs
      if (route.costBreakdown.transport.groundTransport) {
        costs.ground = route.costBreakdown.transport.groundTransport.reduce((sum, ground) => sum + (ground.cost || 0), 0);
      }
    }
    
    // Calculate labor costs if operator details exist
    if (route.costBreakdown?.labor) {
      costs.wgLabor = route.costBreakdown.labor.total || 0;
    }
    
    // Process each leg for remaining costs
    for (const leg of route.legs) {
      const legCost = await this.calculateLegCost(leg, shipmentData, hubIdPricing, hubCouPricing);
      
      // Only add leg costs if not already calculated from detailed planning
      if (!route.costBreakdown?.transport || !route.costBreakdown?.labor) {
        if (leg.type === 'white-glove') {
          if (!route.costBreakdown?.labor) {
            costs.wgLabor += legCost.labor || 0;
          }
          if (!route.costBreakdown?.transport) {
            costs.wgTravel += legCost.travel || 0;
            costs.flights += legCost.flights || 0;
            costs.trains += legCost.trains || 0;
            costs.ground += legCost.ground || 0;
          }
        } else if (leg.type === 'dhl') {
          if (leg.service === 'express') {
            costs.dhlExpress += legCost.total || 0;
          } else {
            costs.dhlStandard += legCost.total || 0;
          }
        } else if (leg.type === 'internal-rollout') {
          costs.internalRollout += legCost.total || 0;
        }
      }
      
      // Hub processing fees using price book - always calculate these
      if (leg.processing?.includes('authentication')) {
        const hubId = hubIdPricing?.hubId || hubIdPricing?.id;
        if (hubId) {
          const authCost = this.calculateHubServiceCost(hubId, 'authentication', route.tier);
          costs.hubIdFee = this.convertToEUR(authCost, hubIdPricing.currency || 'EUR');
        } else {
          // Fallback to defaults
          costs.hubIdFee = route.tier === 3 ? 100 : 75;
        }
      }
      
      if (leg.processing?.includes('sewing')) {
        const hubCouId = hubCouPricing?.hubId || hubCouPricing?.id;
        if (hubCouId) {
          const sewingCost = this.calculateHubServiceCost(hubCouId, 'sewing', route.tier);
          costs.hubCouFee = this.convertToEUR(sewingCost, hubCouPricing.currency || 'EUR');
        } else {
          // Fallback to default
          costs.hubCouFee = 150;
        }
      }
    }
    
    // Inventory costs using price book
    if (route.tier === 3) {
      const hubId = hubIdPricing?.hubId || hubIdPricing?.id;
      if (hubId) {
        const nfcCost = this.calculateHubServiceCost(hubId, 'nfc', route.tier);
        costs.nfcUnit = this.convertToEUR(nfcCost, hubIdPricing.currency || 'EUR');
      } else {
        costs.nfcUnit = 25; // Fallback
      }
    } else {
      const hubId = hubIdPricing?.hubId || hubIdPricing?.id;
      if (hubId) {
        const tagCost = this.calculateHubServiceCost(hubId, 'tag', route.tier);
        costs.tagUnit = this.convertToEUR(tagCost, hubIdPricing.currency || 'EUR');
      } else {
        costs.tagUnit = 5; // Fallback
      }
    }
    
    // Insurance (0.3% of value, min €25)
    const declaredValue = parseFloat(shipmentData.declared_value) || 0;
    costs.insurance = Math.max(declaredValue * 0.003, 25);
    
    // Calculate realistic surcharges
    const deliveryDate = new Date(route.schedule?.estimatedDelivery || Date.now() + 2 * 24 * 60 * 60 * 1000);
    const month = deliveryDate.getMonth();
    const day = deliveryDate.getDate();
    const dayOfWeek = deliveryDate.getDay();
    
    costs.surcharges = {
      peak: ((month === 11 && day >= 15) || (month === 0 && day <= 5)) ? costs.wgLabor * 0.15 : 0,
      remote: 0, // TODO: Check remote areas
      weekend: (dayOfWeek === 0 || dayOfWeek === 6) ? 75 : 0,
      fragile: shipmentData.fragility === 'high' ? declaredValue * 0.01 : 0,
      fuel: 0 // Will calculate after base total
    };
    
    // Calculate base total without fuel surcharge
    const baseTotal = costs.wgLabor + costs.wgTravel + costs.flights + costs.trains + costs.ground +
                      costs.dhlStandard + costs.dhlExpress + costs.hubIdFee + costs.hubCouFee +
                      costs.nfcUnit + costs.tagUnit + costs.internalRollout + costs.insurance +
                      costs.surcharges.peak + costs.surcharges.remote + costs.surcharges.weekend + costs.surcharges.fragile;
    
    // Calculate fuel surcharge as 5% of transport costs only
    const transportTotal = costs.wgTravel + costs.flights + costs.trains + costs.ground + costs.dhlStandard + costs.dhlExpress;
    costs.surcharges.fuel = transportTotal * 0.05;
    
    // Final total including fuel surcharge
    costs.total = baseTotal + costs.surcharges.fuel;
    
    // Add return journey cost if exists
    if (route.costBreakdown?.returnJourney) {
      costs.total += route.costBreakdown.returnJourney;
    }
    
    // Client price with margin
    const marginMultiplier = this.getMarginMultiplier(route.tier);
    costs.clientPrice = Math.round(costs.total * marginMultiplier);
    costs.margin = costs.clientPrice - costs.total;
    costs.marginPercentage = costs.clientPrice > 0 ? parseFloat(((costs.margin / costs.clientPrice) * 100).toFixed(1)) : 0;
    
    return costs;
  }

  /**
   * Calculate cost for a single leg
   */
  async calculateLegCost(leg, shipmentData, hubIdPricing, hubCouPricing) {
    const cost = {
      labor: 0,
      travel: 0,
      flights: 0,
      trains: 0,
      ground: 0,
      total: 0
    };
    
    if (leg.type === 'white-glove') {
      // WG labor costs
      const distance = await this.calculateDistance(leg.from, leg.to);
      const duration = await this.estimateDuration(distance, leg);
      
      // Labor: €50/hour base, €75/hour overtime, €150/day per diem if overnight
      const hours = Math.ceil(duration / 60);
      const regularHours = Math.min(hours, 8);
      const overtimeHours = Math.max(0, hours - 8);
      
      cost.labor = (regularHours * 50) + (overtimeHours * 75);
      
      if (hours > 12) {
        cost.labor += 150; // Per diem
      }
      
      // Travel costs
      if (distance > 200) {
        // Long distance - check for flights/trains
        const transportCost = await this.getTransportCost(leg.from, leg.to, 'optimal');
        cost.flights = transportCost.flights || 0;
        cost.trains = transportCost.trains || 0;
        cost.ground = transportCost.ground || 0;
      } else {
        // Short distance - ground only
        cost.ground = distance * 0.5; // €0.50 per km
      }
      
    } else if (leg.type === 'dhl') {
      // Get DHL rates
      const dhlRate = await this.getDHLRate(leg.from, leg.to, shipmentData, leg.service);
      cost.total = dhlRate.total;
      
    } else if (leg.type === 'internal-rollout') {
      // Internal rollout cost using price book
      const fromHubId = leg.from.hubCode ? 
        Array.from(this.hubPriceBook.values()).find(h => h.hubCode === leg.from.hubCode)?.hubId : null;
      const toHubId = leg.to.hubCode ? 
        Array.from(this.hubPriceBook.values()).find(h => h.hubCode === leg.to.hubCode)?.hubId : null;
      
      let rolloutCost = this.INTERNAL_ROLLOUT.costPerItem; // Base cost
      
      if (fromHubId && fromHubId !== toHubId) {
        // Different hubs - use source hub's internal rollout cost
        try {
          const hubRolloutCost = this.calculateHubServiceCost(fromHubId, 'internal_rollout');
          const fromHub = this.getHubPricing(fromHubId);
          rolloutCost = this.convertToEUR(hubRolloutCost, fromHub.currency);
        } catch (error) {
          console.warn(`Could not get rollout cost for ${fromHubId}, using default`);
          rolloutCost = this.INTERNAL_ROLLOUT.costPerItem;
        }
        rolloutCost += this.INTERNAL_ROLLOUT.costPerRun; // Add run cost
      }
      
      cost.total = rolloutCost;
    }
    
    cost.total = Object.values(cost).reduce((sum, val) => sum + val, 0) - cost.total;
    
    return cost;
  }

  /**
   * Calculate surcharges based on route characteristics
   */
  async calculateSurcharges(route, shipmentData) {
    const surcharges = {
      peak: 0,
      remote: 0,
      weekend: 0,
      fragile: 0,
      fuel: 0
    };
    
    // Peak season (Dec 15 - Jan 5)
    const deliveryDate = new Date(route.schedule.estimatedDelivery);
    const month = deliveryDate.getMonth();
    const day = deliveryDate.getDate();
    
    if ((month === 11 && day >= 15) || (month === 0 && day <= 5)) {
      surcharges.peak = route.costBreakdown.total * 0.15; // 15% peak surcharge
    }
    
    // Remote area surcharge
    const remoteAreas = await this.checkRemoteAreas([
      shipmentData.sender_city,
      shipmentData.buyer_city
    ]);
    
    if (remoteAreas.length > 0) {
      surcharges.remote = 50 * remoteAreas.length; // €50 per remote location
    }
    
    // Weekend delivery
    if (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      surcharges.weekend = 75; // €75 weekend surcharge
    }
    
    // Fragile handling
    if (shipmentData.fragility === 'high') {
      surcharges.fragile = shipmentData.declared_value * 0.01; // 1% of value
    }
    
    // Fuel surcharge (5% base) - calculate from base costs, not total
    const baseCosts = Object.values(costs).filter(v => typeof v === 'number').reduce((sum, val) => sum + val, 0);
    surcharges.fuel = baseCosts * 0.05;
    
    return surcharges;
  }

  /**
   * Build schedule with time zones and buffers
   */
  buildSchedule(legs, shipmentData) {
    const schedule = {
      pickup: null,
      hubIdArrival: null,
      hubIdProcessing: null,
      hubCouArrival: null,
      hubCouProcessing: null,
      estimatedDelivery: null,
      totalDays: 0,
      timeZones: {}
    };
    
    // Start from pickup window or reasonable default
    const startTime = shipmentData.pickup_window_start ? 
      new Date(shipmentData.pickup_window_start) : 
      new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    // Ensure start time is valid
    if (isNaN(startTime.getTime())) {
      console.warn('Invalid pickup_window_start, using default');
      const defaultStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      let currentTime = new Date(defaultStart);
      schedule.pickup = currentTime.toISOString();
    } else {
      let currentTime = new Date(startTime);
      schedule.pickup = currentTime.toISOString();
    }
    
    let currentTime = new Date(schedule.pickup);
    
    for (const leg of legs) {
      const duration = this.estimateLegDuration(leg);
      
      // Add travel time
      const travelTimeMs = (duration.travel + duration.buffer) * 60 * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + travelTimeMs);
      
      // Add processing time at destination
      if (leg.processing && leg.processing !== 'none') {
        if (leg.processing.includes('authentication')) {
          schedule.hubIdArrival = currentTime.toISOString();
          currentTime = new Date(currentTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours
          schedule.hubIdProcessing = currentTime.toISOString();
        }
        
        if (leg.processing.includes('sewing')) {
          schedule.hubCouArrival = currentTime.toISOString();
          currentTime = new Date(currentTime.getTime() + 6 * 60 * 60 * 1000); // 6 hours
          schedule.hubCouProcessing = currentTime.toISOString();
        }
        
        if (leg.processing.includes('tagging')) {
          currentTime = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours
        }
      }
      
      // Add dwell time for internal rollout
      if (leg.type === 'internal-rollout') {
        // Internal rollout happens daily at 14:00, so wait until next 14:00
        const nextRollout = new Date(currentTime);
        nextRollout.setDate(nextRollout.getDate() + 1);
        nextRollout.setHours(14, 0, 0, 0);
        currentTime = nextRollout;
      }
      
      // Add buffer for DHL services
      if (leg.type === 'dhl') {
        const dhlBufferHours = leg.service === 'express' ? 2 : 4;
        currentTime = new Date(currentTime.getTime() + dhlBufferHours * 60 * 60 * 1000);
      }
    }
    
    schedule.estimatedDelivery = currentTime.toISOString();
    
    // Calculate total days with better precision
    const pickupTime = new Date(schedule.pickup);
    const deliveryTime = new Date(schedule.estimatedDelivery);
    
    if (isNaN(pickupTime.getTime()) || isNaN(deliveryTime.getTime())) {
      console.warn('Invalid dates in schedule calculation');
      schedule.totalDays = 2; // Default fallback
    } else {
      const diffMs = deliveryTime.getTime() - pickupTime.getTime();
      schedule.totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
    
    return schedule;
  }

  /**
   * Estimate duration for a leg in hours
   */
  estimateLegDuration(leg) {
    const duration = {
      travel: 0,
      processing: 0,
      buffer: 0
    };
    
    if (leg.type === 'white-glove') {
      duration.travel = 8; // Average WG travel time
      duration.buffer = 2;
    } else if (leg.type === 'dhl') {
      duration.travel = leg.service === 'express' ? 24 : 48; // DHL times
      duration.buffer = 4;
    } else if (leg.type === 'internal-rollout') {
      duration.travel = 24; // Daily rollout
      duration.buffer = 2;
    }
    
    if (leg.processing && leg.processing !== 'none') {
      if (leg.processing.includes('authentication')) duration.processing += 4;
      if (leg.processing.includes('sewing')) duration.processing += 6;
      if (leg.processing.includes('tagging')) duration.processing += 2;
    }
    
    return duration;
  }

  /**
   * Score and sort routes by time, cost, and risk
   */
  scoreAndSortRoutes(routes, shipmentData) {
    return routes.map(route => {
      const scores = {
        time: 0,
        cost: 0,
        risk: 0,
        total: 0
      };
      
      // Time score (0-100, faster is better)
      const maxDays = Math.max(...routes.map(r => r.schedule.totalDays));
      scores.time = maxDays > 0 ? 
        ((maxDays - route.schedule.totalDays) / maxDays) * 100 : 100;
      
      // Cost score (0-100, cheaper is better)
      const maxCost = Math.max(...routes.map(r => r.costBreakdown.total));
      scores.cost = maxCost > 0 ? 
        ((maxCost - route.costBreakdown.total) / maxCost) * 100 : 100;
      
      // Risk score (0-100, lower risk is better)
      scores.risk = 100;
      if (route.guardrails.some(g => g.type === 'error')) scores.risk -= 50;
      if (route.guardrails.some(g => g.type === 'warning')) scores.risk -= 25;
      if (route.warnings.length > 0) scores.risk -= 10 * route.warnings.length;
      
      // Weighted total (time: 35%, cost: 35%, risk: 30%)
      scores.total = (scores.time * 0.35) + (scores.cost * 0.35) + (scores.risk * 0.30);
      
      // Letter grade
      let grade = 'C';
      if (scores.total >= 80) grade = 'A';
      else if (scores.total >= 60) grade = 'B';
      
      return {
        ...route,
        scores,
        grade
      };
    }).sort((a, b) => b.scores.total - a.scores.total);
  }

  /**
   * Validate route feasibility
   */
  async validateRouteFeasibility(route, shipmentData) {
    // Check SLA compliance
    const deliveryDate = new Date(route.schedule.estimatedDelivery);
    const slaDate = new Date(shipmentData.sla_target_date);
    
    if (deliveryDate > slaDate) {
      route.warnings.push('Route may not meet SLA target');
      return false;
    }
    
    // Check hub capacity
    for (const hub of [route.hubId, route.hubCou].filter(Boolean)) {
      if (hub.auth_capacity_available <= 0) {
        route.warnings.push(`Hub ${hub.hub_code} has no authentication capacity`);
        return false;
      }
    }
    
    // Check inventory availability
    if (route.tier === 3 && route.hubId.nfc_stock <= 0) {
      route.warnings.push('NFC chips out of stock');
      return false;
    }
    
    if (route.tier === 2 && route.hubId.tag_stock <= 0) {
      route.warnings.push('Tags out of stock');
      return false;
    }
    
    return true;
  }

  /**
   * Validate that route follows correct pattern for tier
   */
  validateRoutePattern(route, tier) {
    if (tier === 3) {
      // Tier 3 validation
      switch (route.id) {
        case 'FULL_WG':
          // Must have A→HubId→HubCou→B pattern with all WG (except internal rollout)
          return route.legs.length >= 2 && 
                 route.legs[0].type === 'white-glove' &&
                 route.legs[route.legs.length - 1].type === 'white-glove' &&
                 !route.legs.some(leg => leg.type === 'dhl' && leg.from?.type === 'hub' && leg.to?.type === 'hub');
        
        case 'HYBRID_WG_DHL':
          // Must have WG to HubCou, then DHL to buyer
          return route.legs.some(leg => leg.type === 'white-glove' && leg.to?.type === 'hub') &&
                 route.legs.some(leg => leg.type === 'dhl' && leg.from?.type === 'hub' && leg.to?.type === 'buyer') &&
                 !route.legs.some(leg => leg.type === 'dhl' && leg.from?.type === 'hub' && leg.to?.type === 'hub');
        
        case 'HYBRID_DHL_WG':
          // Must have DHL to HubId, then WG from HubCou
          return route.legs.some(leg => leg.type === 'dhl' && leg.to?.type === 'hub') &&
                 route.legs.some(leg => leg.type === 'white-glove' && leg.from?.type === 'hub' && leg.to?.type === 'buyer') &&
                 !route.legs.some(leg => leg.type === 'dhl' && leg.from?.type === 'hub' && leg.to?.type === 'hub');
        
        default:
          return false;
      }
    } else if (tier === 2) {
      // Tier 2 validation - only end-to-end, no partial
      switch (route.id) {
        case 'WG_END_TO_END':
          // Must be all WG, A→HubId→B only
          return route.legs.every(leg => leg.type === 'white-glove') &&
                 route.legs.length === 2 &&
                 !route.legs.some(leg => leg.processing?.includes('sewing')); // No sewing for Tier 2
        
        case 'DHL_END_TO_END':
          // Must be all DHL, A→HubId→B only
          return route.legs.every(leg => leg.type === 'dhl') &&
                 route.legs.length === 2 &&
                 !route.legs.some(leg => leg.processing?.includes('sewing')); // No sewing for Tier 2
        
        default:
          return false;
      }
    }
    
    return false;
  }

  /**
   * Check guardrails for a route
   */
  checkGuardrails(route, shipmentData) {
    const guardrails = [];
    
    // Margin guardrail
    if (route.costBreakdown?.marginPercentage && route.costBreakdown.marginPercentage < 20) {
      guardrails.push({
        type: 'warning',
        category: 'margin',
        message: `Low margin: ${route.costBreakdown.marginPercentage}%`,
        canOverride: true
      });
    }
    
    // Capacity guardrail  
    if (route.hubId?.auth_capacity_available && route.hubId.auth_capacity_available < 5) {
      guardrails.push({
        type: 'warning',
        category: 'capacity',
        message: `Hub ${route.hubId.hub_code} capacity is tight`,
        canOverride: false
      });
    }
    
    // SLA guardrail
    if (route.schedule?.estimatedDelivery && shipmentData.sla_target_date) {
      const buffer = Math.ceil(
        (new Date(shipmentData.sla_target_date) - new Date(route.schedule.estimatedDelivery)) / 
        (1000 * 60 * 60 * 24)
      );
      
      if (buffer < 2) {
        guardrails.push({
          type: 'warning',
          category: 'sla',
          message: `Only ${buffer} day(s) buffer before SLA deadline`,
          canOverride: true
        });
      }
    }
    
    // Tier compliance - Tier 3 needs authentication AND sewing somewhere in the flow
    if (route.tier === 3) {
      const hasAuth = route.legs.some(l => 
        l.processing?.includes('authentication') || 
        l.processing?.includes('authentication-sewing-qa')
      );
      const hasSewing = route.legs.some(l => 
        l.processing?.includes('sewing') || 
        l.processing?.includes('sewing-and-qa') ||
        l.processing?.includes('authentication-sewing-qa')
      );
      
      if (!hasAuth) {
        guardrails.push({
          type: 'warning',
          category: 'tier',
          message: 'Tier 3 requires authentication service',
          canOverride: true
        });
      }
      
      if (!hasSewing) {
        guardrails.push({
          type: 'warning',
          category: 'tier',
          message: 'Tier 3 requires sewing service - consider adding HubCou processing',
          canOverride: true
        });
      }
    }
    
    return guardrails;
  }

  /**
   * Score a hub using price book data - ETA + cost + capacity/stock
   */
  async scoreHubWithPriceBook(hub, shipmentData, tier) {
    let score = 100; // Start with base score
    
    // 1. ETA/Distance factor (40% weight)
    const senderDistance = await this.calculateDistance(
      { city: shipmentData.sender_city },
      { city: hub.city }
    );
    const buyerDistance = await this.calculateDistance(
      { city: hub.city },
      { city: shipmentData.buyer_city }
    );
    
    const totalDistance = senderDistance + buyerDistance;
    const etaScore = Math.max(0, 100 - (totalDistance / 50)); // Penalty per 50km
    score += etaScore * 0.4;
    
    // 2. Cost factor (35% weight) - using price book
    const authCost = this.calculateHubServiceCost(hub.hubId, 'authentication', tier);
    const sewingCost = tier === 3 ? this.calculateHubServiceCost(hub.hubId, 'sewing', tier) : 0;
    const inventoryCost = tier === 3 ? 
      this.calculateHubServiceCost(hub.hubId, 'nfc', tier) : 
      this.calculateHubServiceCost(hub.hubId, 'tag', tier);
    
    const totalHubCost = authCost + sewingCost + inventoryCost;
    
    // Convert to EUR for comparison
    const costInEUR = this.convertToEUR(totalHubCost, hub.currency);
    
    // Lower cost = higher score (baseline 200 EUR)
    const costScore = Math.max(0, 100 - Math.max(0, (costInEUR - 200) / 5));
    score += costScore * 0.35;
    
    // 3. Capacity factor (20% weight)
    const authCapacityRatio = hub.auth_capacity_available / (hub.auth_capacity_total || 100);
    const sewingCapacityRatio = tier === 3 && hub.has_sewing_capability ? 
      hub.sewing_capacity_available / (hub.sewing_capacity_total || 40) : 1;
    
    const avgCapacityRatio = (authCapacityRatio + sewingCapacityRatio) / 2;
    const capacityScore = avgCapacityRatio * 100; // Higher available capacity = higher score
    score += capacityScore * 0.20;
    
    // 4. Stock factor (5% weight)
    const requiredStock = tier === 3 ? hub.nfc_stock : hub.tag_stock;
    const stockScore = Math.min(100, (requiredStock / 10) * 10); // 10+ items = full score
    score += stockScore * 0.05;
    
    // Penalties
    if (tier === 3 && !hub.has_sewing_capability) {
      score -= 50; // Major penalty for T3 without sewing
    }
    
    if (authCapacityRatio < 0.1) {
      score -= 30; // Penalty for very low auth capacity
    }
    
    if (costInEUR > 400) {
      score -= 25; // Penalty for very high cost
    }
    
    // Capacity multiplier from price book
    score *= (hub.capacity_multiplier || 1.0);
    
    return Math.max(0, score);
  }

  /**
   * Score a hub based on multiple factors (legacy method)
   */
  async scoreHub(hub, shipmentData) {
    let score = 100;
    
    // Distance factor (closer is better)
    const senderDistance = await this.calculateDistance(
      { city: shipmentData.sender_city },
      { city: hub.city }
    );
    const buyerDistance = await this.calculateDistance(
      { city: hub.city },
      { city: shipmentData.buyer_city }
    );
    
    const totalDistance = senderDistance + buyerDistance;
    if (totalDistance > 2000) score -= 20;
    else if (totalDistance > 1000) score -= 10;
    
    // Capacity factor
    const capacityRatio = hub.auth_capacity_available / hub.auth_capacity_total;
    if (capacityRatio < 0.2) score -= 30;
    else if (capacityRatio < 0.5) score -= 15;
    
    // Cost factor
    const authFee = shipmentData.assigned_tier === 3 ? 
      hub.tier3_auth_fee : hub.tier2_auth_fee;
    
    if (authFee > 150) score -= 20;
    else if (authFee > 100) score -= 10;
    
    // Hub capabilities
    if (shipmentData.assigned_tier === 3 && !hub.has_sewing_capability) {
      score -= 50; // Major penalty for T3 without sewing
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate distance between two locations (simplified)
   */
  async calculateDistance(from, to) {
    // In production, use Google Distance Matrix API
    // For now, use simplified calculation
    const cities = {
      'London': { lat: 51.5074, lon: -0.1278 },
      'Paris': { lat: 48.8566, lon: 2.3522 },
      'Milan': { lat: 45.4642, lon: 9.1900 },
      'Berlin': { lat: 52.5200, lon: 13.4050 },
      'Madrid': { lat: 40.4168, lon: -3.7038 },
      'Amsterdam': { lat: 52.3676, lon: 4.9041 }
    };
    
    const fromCoords = cities[from.city] || cities['London'];
    const toCoords = cities[to.city] || cities['London'];
    
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (toCoords.lat - fromCoords.lat) * Math.PI / 180;
    const dLon = (toCoords.lon - fromCoords.lon) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(fromCoords.lat * Math.PI / 180) * 
              Math.cos(toCoords.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance);
  }

  /**
   * Estimate duration based on distance and transport mode
   */
  async estimateDuration(distance, leg) {
    // Simplified duration estimation
    // In production, use actual travel time APIs
    
    if (leg.type === 'white-glove') {
      // WG travels at average 60 km/h including stops
      return Math.ceil(distance / 60) * 60; // minutes
    } else if (leg.type === 'dhl') {
      // DHL standard: 48h, express: 24h
      return leg.service === 'express' ? 24 * 60 : 48 * 60;
    } else {
      // Internal rollout: fixed 24h
      return 24 * 60;
    }
  }

  /**
   * Get transport cost (flights/trains/ground)
   */
  async getTransportCost(from, to, mode) {
    // In production, integrate with:
    // - Amadeus API for flights
    // - Rail Europe API for trains
    // - Uber/Lyft APIs for ground
    
    const distance = await this.calculateDistance(from, to);
    
    const costs = {
      flights: 0,
      trains: 0,
      ground: 0
    };
    
    if (distance > 500) {
      // Long distance - prefer flights
      costs.flights = 150 + (distance * 0.1); // Base + per km
    } else if (distance > 200) {
      // Medium distance - trains
      costs.trains = 50 + (distance * 0.15);
    } else {
      // Short distance - ground only
      costs.ground = distance * 0.5; // €0.50 per km
    }
    
    return costs;
  }

  /**
   * Get DHL rate for a leg
   */
  async getDHLRate(from, to, shipmentData, service) {
    // In production, use DHL API
    // For now, use simplified calculation
    
    const distance = await this.calculateDistance(from, to);
    const weight = shipmentData.weight || 5; // kg
    const baseRate = service === 'express' ? 50 : 30;
    
    const rate = {
      base: baseRate,
      distance: distance * 0.05,
      weight: weight * 2,
      total: 0
    };
    
    rate.total = rate.base + rate.distance + rate.weight;
    
    // Add customs if international
    if (from.country !== to.country) {
      rate.customs = 25;
      rate.total += rate.customs;
    }
    
    return rate;
  }

  /**
   * Check if locations are in remote areas
   */
  async checkRemoteAreas(cities) {
    // In production, check against remote area database
    const remoteAreas = ['Isle of Skye', 'Faroe Islands', 'Svalbard'];
    
    return cities.filter(city => remoteAreas.includes(city));
  }

  /**
   * Get margin multiplier based on tier
   */
  getMarginMultiplier(tier) {
    // Tier 3: 40% margin, Tier 2: 35% margin
    return tier === 3 ? 1.40 : 1.35;
  }
}

// ========================================================================================
// ITINERARY ENGINE - BUILDS ACTUAL TRAVEL PLANS
// ========================================================================================

class ItineraryEngine {
  constructor(routeEngine) {
    this.routeEngine = routeEngine;
    this.geocodingService = new GeocodingService();
    this.slotBookingService = new SlotBookingService();
    
    // SLA buffer policies
    this.SLA_POLICIES = {
      STANDARD: { bufferHours: 4, riskThreshold: 2 },
      EXPRESS: { bufferHours: 2, riskThreshold: 1 },
      PRIORITY: { bufferHours: 1, riskThreshold: 0.5 }
    };
    
    // Time window constraints
    this.TIME_WINDOWS = {
      BUSINESS_HOURS: { start: '09:00', end: '17:00' },
      EXTENDED_HOURS: { start: '08:00', end: '19:00' },
      WEEKEND_RESTRICTED: { saturday: '10:00-15:00', sunday: 'closed' }
    };
  }

  /**
   * Main entry point: Build complete itinerary from inputs
   * 
   * @param {Object} inputs - A/B geocodes, time windows, weight/dims, assigned tier
   * @param {Array} hubCandidates - Hub candidates with capacity slots + stock
   * @param {Object} rateCaches - Cached rates for fast lookup
   * @returns {Object} Complete itinerary with legs, slots, ETA, SLA validation
   */
  async buildItinerary(inputs, hubCandidates, rateCaches = {}) {
    console.log(`🛣️  Building itinerary for Tier ${inputs.assignedTier} shipment`);
    
    const {
      originGeocode,
      destinationGeocode,
      timeWindows,
      weightDims,
      assignedTier,
      slaTargetDate,
      shipmentValue
    } = inputs;
    
    // 1. Validate inputs and geocodes
    const validatedInputs = await this.validateAndEnrichInputs(inputs);
    
    // 2. Select optimal hubs based on current price book
    const selectedHubs = await this.selectOptimalHubsForItinerary(
      validatedInputs, hubCandidates, assignedTier
    );
    
    // 3. Construct leg patterns based on tier
    const legPattern = this.constructLegPattern(assignedTier, selectedHubs);
    
    // 4. Build detailed legs with path finding
    const detailedLegs = await this.buildDetailedLegs(
      legPattern, validatedInputs, selectedHubs, rateCaches
    );
    
    // 5. Book logical slots at hubs
    const slotBookings = await this.bookLogicalSlots(
      detailedLegs, selectedHubs, assignedTier, timeWindows
    );
    
    // 6. Compute end-to-end ETA
    const etaCalculation = this.computeEndToEndETA(detailedLegs, slotBookings);
    
    // 7. Validate SLA compliance and flag risks
    const slaValidation = this.validateSLACompliance(
      etaCalculation, slaTargetDate, assignedTier
    );
    
    return {
      itineraryId: `ITN_${Date.now()}`,
      tier: assignedTier,
      legs: detailedLegs,
      slotBookings,
      eta: etaCalculation,
      sla: slaValidation,
      hubsUsed: selectedHubs,
      totalDuration: etaCalculation.totalHours,
      feasible: slaValidation.compliant,
      riskFlags: slaValidation.risks,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Validate and enrich input data with geocoding
   */
  async validateAndEnrichInputs(inputs) {
    const enriched = { ...inputs };
    
    // Geocode A/B if not provided
    if (!inputs.originGeocode && inputs.originAddress) {
      enriched.originGeocode = await this.geocodingService.geocode(inputs.originAddress);
    }
    
    if (!inputs.destinationGeocode && inputs.destinationAddress) {
      enriched.destinationGeocode = await this.geocodingService.geocode(inputs.destinationAddress);
    }
    
    // Validate weight/dimensions
    enriched.weightDims = this.validateWeightDimensions(inputs.weightDims);
    
    // Standardize time windows
    enriched.timeWindows = this.standardizeTimeWindows(inputs.timeWindows);
    
    return enriched;
  }

  /**
   * Construct tier-specific leg patterns
   */
  constructLegPattern(tier, selectedHubs) {
    const { hubId, hubCou } = selectedHubs;
    
    if (tier === 3) {
      // Tier 3: A→HubId→HubCou→B (always use internal rollout between hubs)
      return [
        { segment: 'ORIGIN_TO_HUB_ID', from: 'origin', to: 'hubId', hubId },
        { segment: 'HUB_ID_TO_HUB_COU', from: 'hubId', to: 'hubCou', hubId, hubCou, type: 'internal-rollout' },
        { segment: 'HUB_COU_TO_DESTINATION', from: 'hubCou', to: 'destination', hubCou }
      ];
    } else if (tier === 2) {
      // Tier 2: A→HubId→B (single hub)
      return [
        { segment: 'ORIGIN_TO_HUB', from: 'origin', to: 'hubId', hubId },
        { segment: 'HUB_TO_DESTINATION', from: 'hubId', to: 'destination', hubId }
      ];
    } else {
      throw new Error(`Unsupported tier: ${tier}`);
    }
  }

  /**
   * Build detailed legs with path finding for WG segments
   */
  async buildDetailedLegs(legPattern, inputs, selectedHubs, rateCaches) {
    const detailedLegs = [];
    
    for (const [index, segment] of legPattern.entries()) {
      const legId = `LEG_${index + 1}`;
      
      if (segment.type === 'internal-rollout') {
        // Internal rollout between hubs - simple transfer
        const internalLeg = await this.buildInternalRolloutLeg(segment, inputs);
        detailedLegs.push({ ...internalLeg, id: legId, order: index + 1 });
      } else {
        // WG or DHL segment - requires path finding
        const transportLeg = await this.buildTransportLeg(
          segment, inputs, selectedHubs, rateCaches
        );
        detailedLegs.push({ ...transportLeg, id: legId, order: index + 1 });
      }
    }
    
    return detailedLegs;
  }

  /**
   * Build WG transport leg with ground→flight/train→ground path finding
   */
  async buildTransportLeg(segment, inputs, selectedHubs, rateCaches) {
    const { from, to, segment: segmentName } = segment;
    
    // Determine transport mode based on route option
    const transportMode = this.determineTransportMode(segment, inputs);
    
    if (transportMode === 'white-glove') {
      return await this.buildWhiteGloveLeg(segment, inputs, selectedHubs);
    } else if (transportMode === 'dhl') {
      return await this.buildDHLLeg(segment, inputs, selectedHubs, rateCaches);
    } else {
      throw new Error(`Unknown transport mode: ${transportMode}`);
    }
  }

  /**
   * Build white-glove leg with feasible path finding
   */
  async buildWhiteGloveLeg(segment, inputs, selectedHubs) {
    const { from, to } = segment;
    const { originGeocode, destinationGeocode, weightDims, timeWindows } = inputs;
    
    // Get start and end coordinates
    const startCoords = this.getCoordinatesForLocation(from, {
      origin: originGeocode,
      hubId: selectedHubs.hubId,
      hubCou: selectedHubs.hubCou,
      destination: destinationGeocode
    });
    
    const endCoords = this.getCoordinatesForLocation(to, {
      origin: originGeocode,
      hubId: selectedHubs.hubId,
      hubCou: selectedHubs.hubCou,
      destination: destinationGeocode
    });
    
    // Find feasible path: ground → flight/train → ground
    const feasiblePath = await this.findFeasibleWGPath(
      startCoords, endCoords, weightDims, timeWindows
    );
    
    // Ensure one operator's calendar is continuous
    const operatorSchedule = await this.ensureContinuousOperator(
      feasiblePath, timeWindows
    );
    
    // Account for overnight stays if forced
    const overnightStays = this.calculateOvernightRequirements(
      feasiblePath, operatorSchedule
    );
    
    return {
      type: 'white-glove',
      from: startCoords,
      to: endCoords,
      path: feasiblePath,
      operator: operatorSchedule.operatorId,
      schedule: operatorSchedule,
      overnightStays,
      duration: feasiblePath.totalDuration,
      distance: feasiblePath.totalDistance,
      segments: feasiblePath.segments, // ground, flight, train details
      buffers: this.calculateLegBuffers(feasiblePath),
      processing: this.determineLegProcessing(segment, inputs.assignedTier)
    };
  }

  /**
   * Find feasible WG path with ground→flight/train→ground options
   */
  async findFeasibleWGPath(startCoords, endCoords, weightDims, timeWindows) {
    const distance = this.calculateDistance(startCoords, endCoords);
    
    // For short distances (<300km), use ground only
    if (distance < 300) {
      return await this.planGroundOnlyPath(startCoords, endCoords, weightDims);
    }
    
    // For medium distances (300-1000km), try ground and train
    if (distance < 1000) {
      const groundPath = await this.planGroundOnlyPath(startCoords, endCoords, weightDims);
      const trainPath = await this.planGroundTrainGroundPath(startCoords, endCoords, weightDims);
      
      // Return the fastest feasible option
      return groundPath.totalDuration < trainPath.totalDuration ? groundPath : trainPath;
    }
    
    // For long distances (>1000km), prefer flight
    const flightPath = await this.planGroundFlightGroundPath(startCoords, endCoords, weightDims);
    const groundPath = await this.planGroundOnlyPath(startCoords, endCoords, weightDims);
    
    // Return flight if available and faster, otherwise ground
    return flightPath.feasible && flightPath.totalDuration < groundPath.totalDuration * 0.7 ? 
      flightPath : groundPath;
  }

  /**
   * Plan ground-only transport path
   */
  async planGroundOnlyPath(startCoords, endCoords, weightDims) {
    const distance = this.calculateDistance(startCoords, endCoords);
    const driveTime = distance / 80; // 80 km/h average speed
    const breaks = Math.floor(driveTime / 4); // Break every 4 hours
    
    return {
      type: 'ground-only',
      segments: [{
        mode: 'ground',
        from: startCoords,
        to: endCoords,
        distance,
        duration: driveTime + (breaks * 0.5), // 30min breaks
        cost: distance * 1.20 // €1.20/km
      }],
      totalDistance: distance,
      totalDuration: driveTime + (breaks * 0.5),
      totalCost: distance * 1.20,
      feasible: true,
      requiresOvernight: driveTime > 10 // More than 10 hours driving
    };
  }

  /**
   * Plan ground→train→ground path
   */
  async planGroundTrainGroundPath(startCoords, endCoords, weightDims) {
    // Find nearest train stations
    const startStation = await this.findNearestTrainStation(startCoords);
    const endStation = await this.findNearestTrainStation(endCoords);
    
    if (!startStation || !endStation) {
      return { feasible: false, reason: 'No suitable train stations' };
    }
    
    const segments = [
      // Ground to start station
      {
        mode: 'ground',
        from: startCoords,
        to: startStation.coords,
        distance: this.calculateDistance(startCoords, startStation.coords),
        duration: this.calculateDistance(startCoords, startStation.coords) / 60, // 60 km/h city driving
        cost: this.calculateDistance(startCoords, startStation.coords) * 1.50
      },
      // Train journey
      {
        mode: 'train',
        from: startStation.coords,
        to: endStation.coords,
        distance: this.calculateDistance(startStation.coords, endStation.coords),
        duration: this.calculateDistance(startStation.coords, endStation.coords) / 160, // 160 km/h train speed
        cost: weightDims.weight * 12 + 150, // Base train freight cost
        station: { start: startStation.name, end: endStation.name }
      },
      // Ground from end station
      {
        mode: 'ground',
        from: endStation.coords,
        to: endCoords,
        distance: this.calculateDistance(endStation.coords, endCoords),
        duration: this.calculateDistance(endStation.coords, endCoords) / 60,
        cost: this.calculateDistance(endStation.coords, endCoords) * 1.50
      }
    ];
    
    return {
      type: 'ground-train-ground',
      segments,
      totalDistance: segments.reduce((sum, s) => sum + s.distance, 0),
      totalDuration: segments.reduce((sum, s) => sum + s.duration, 0) + 2, // 2h buffer for transfers
      totalCost: segments.reduce((sum, s) => sum + s.cost, 0),
      feasible: true,
      requiresOvernight: false
    };
  }

  /**
   * Plan ground→flight→ground path
   */
  async planGroundFlightGroundPath(startCoords, endCoords, weightDims) {
    // Find nearest airports
    const startAirport = await this.findNearestAirport(startCoords);
    const endAirport = await this.findNearestAirport(endCoords);
    
    if (!startAirport || !endAirport) {
      return { feasible: false, reason: 'No suitable airports' };
    }
    
    // Check if cargo capacity available
    if (weightDims.weight > 500 || weightDims.volume > 2) {
      return { feasible: false, reason: 'Exceeds air cargo limits' };
    }
    
    const segments = [
      // Ground to start airport
      {
        mode: 'ground',
        from: startCoords,
        to: startAirport.coords,
        distance: this.calculateDistance(startCoords, startAirport.coords),
        duration: this.calculateDistance(startCoords, startAirport.coords) / 60,
        cost: this.calculateDistance(startCoords, startAirport.coords) * 1.50
      },
      // Flight
      {
        mode: 'flight',
        from: startAirport.coords,
        to: endAirport.coords,
        distance: this.calculateDistance(startAirport.coords, endAirport.coords),
        duration: this.calculateDistance(startAirport.coords, endAirport.coords) / 800 + 3, // 800 km/h + 3h for procedures
        cost: weightDims.weight * 25 + 400, // Air freight pricing
        airports: { start: startAirport.code, end: endAirport.code }
      },
      // Ground from end airport
      {
        mode: 'ground',
        from: endAirport.coords,
        to: endCoords,
        distance: this.calculateDistance(endAirport.coords, endCoords),
        duration: this.calculateDistance(endAirport.coords, endCoords) / 60,
        cost: this.calculateDistance(endAirport.coords, endCoords) * 1.50
      }
    ];
    
    return {
      type: 'ground-flight-ground',
      segments,
      totalDistance: segments.reduce((sum, s) => sum + s.distance, 0),
      totalDuration: segments.reduce((sum, s) => sum + s.duration, 0),
      totalCost: segments.reduce((sum, s) => sum + s.cost, 0),
      feasible: true,
      requiresOvernight: false
    };
  }

  /**
   * Book logical slots: Auth→Sewing→QA→Outbound
   */
  async bookLogicalSlots(detailedLegs, selectedHubs, tier, timeWindows) {
    const slotBookings = {
      hubId: [],
      hubCou: [],
      sequence: [],
      totalProcessingTime: 0
    };
    
    // Determine processing sequence based on tier
    if (tier === 3) {
      // Tier 3: HubId(Auth) → HubCou(Sewing) → HubCou(QA) → Outbound
      const authSlot = await this.bookHubSlot(
        selectedHubs.hubId, 'authentication', timeWindows, 'T3'
      );
      
      const sewingSlot = await this.bookHubSlot(
        selectedHubs.hubCou, 'sewing', timeWindows, 'T3', authSlot.endTime
      );
      
      const qaSlot = await this.bookHubSlot(
        selectedHubs.hubCou, 'qa', timeWindows, 'T3', sewingSlot.endTime
      );
      
      slotBookings.hubId.push(authSlot);
      slotBookings.hubCou.push(sewingSlot, qaSlot);
      slotBookings.sequence = [authSlot, sewingSlot, qaSlot];
      
    } else if (tier === 2) {
      // Tier 2: HubId(Auth) → HubId(QA) → Outbound
      const authSlot = await this.bookHubSlot(
        selectedHubs.hubId, 'authentication', timeWindows, 'T2'
      );
      
      const qaSlot = await this.bookHubSlot(
        selectedHubs.hubId, 'qa', timeWindows, 'T2', authSlot.endTime
      );
      
      slotBookings.hubId.push(authSlot, qaSlot);
      slotBookings.sequence = [authSlot, qaSlot];
    }
    
    slotBookings.totalProcessingTime = slotBookings.sequence.reduce(
      (sum, slot) => sum + slot.duration, 0
    );
    
    return slotBookings;
  }

  /**
   * Book individual hub slot with capacity checking
   */
  async bookHubSlot(hub, serviceType, timeWindows, tier, earliestStart = null) {
    const hubPricing = this.routeEngine.getHubPricing(hub.hubId || hub.id);
    
    // Get service duration based on type and tier
    const serviceDuration = this.getServiceDuration(serviceType, tier);
    
    // Find available slot
    const availableSlot = await this.findAvailableSlot(
      hub, serviceType, serviceDuration, timeWindows, earliestStart
    );
    
    if (!availableSlot) {
      throw new Error(`No available ${serviceType} slots at ${hub.hubCode}`);
    }
    
    return {
      hubId: hub.hubId || hub.id,
      hubCode: hub.hubCode,
      serviceType,
      tier,
      startTime: availableSlot.startTime,
      endTime: availableSlot.endTime,
      duration: serviceDuration,
      cost: this.routeEngine.calculateHubServiceCost(hub.hubId || hub.id, serviceType, parseInt(tier.slice(1))),
      slotId: `SLOT_${Date.now()}_${serviceType}`,
      booked: true
    };
  }

  /**
   * Compute end-to-end ETA with all buffers
   */
  computeEndToEndETA(detailedLegs, slotBookings) {
    let currentTime = new Date();
    let totalTransportTime = 0;
    let totalProcessingTime = slotBookings.totalProcessingTime;
    let totalBufferTime = 0;
    
    const timeline = [];
    
    // Process each leg
    for (const leg of detailedLegs) {
      const legStart = new Date(currentTime);
      const legDuration = leg.duration;
      const legEnd = new Date(legStart.getTime() + legDuration * 60 * 60 * 1000);
      
      totalTransportTime += legDuration;
      
      // Add buffers
      if (leg.buffers) {
        totalBufferTime += leg.buffers.total || 0;
        legEnd.setTime(legEnd.getTime() + (leg.buffers.total || 0) * 60 * 60 * 1000);
      }
      
      timeline.push({
        leg: leg.id,
        startTime: legStart.toISOString(),
        endTime: legEnd.toISOString(),
        duration: legDuration,
        buffers: leg.buffers
      });
      
      currentTime = legEnd;
    }
    
    // Add processing time from slot bookings
    for (const slot of slotBookings.sequence) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(slotStart.getTime() + slot.duration * 60 * 60 * 1000);
      
      timeline.push({
        slot: slot.slotId,
        hubCode: slot.hubCode,
        serviceType: slot.serviceType,
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        duration: slot.duration
      });
      
      currentTime = slotEnd;
    }
    
    return {
      startTime: new Date().toISOString(),
      estimatedDelivery: currentTime.toISOString(),
      totalHours: totalTransportTime + totalProcessingTime + totalBufferTime,
      breakdown: {
        transport: totalTransportTime,
        processing: totalProcessingTime,
        buffers: totalBufferTime
      },
      timeline
    };
  }

  /**
   * Validate SLA compliance and flag risks
   */
  validateSLACompliance(etaCalculation, slaTargetDate, tier) {
    const deliveryDate = new Date(etaCalculation.estimatedDelivery);
    const targetDate = new Date(slaTargetDate);
    const bufferHours = (targetDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60);
    
    const slaPolicy = this.SLA_POLICIES.STANDARD; // Could be tier-dependent
    const isCompliant = bufferHours >= slaPolicy.bufferHours;
    const hasRisk = bufferHours < slaPolicy.riskThreshold;
    
    const risks = [];
    
    if (hasRisk) {
      risks.push({
        type: 'SLA_BUFFER_INSUFFICIENT',
        severity: bufferHours < 0 ? 'CRITICAL' : 'HIGH',
        message: `Buffer of ${bufferHours.toFixed(1)}h is below ${slaPolicy.riskThreshold}h threshold`,
        impact: 'Delivery may miss SLA deadline'
      });
    }
    
    if (etaCalculation.breakdown.buffers < 2) {
      risks.push({
        type: 'INSUFFICIENT_OPERATIONAL_BUFFER',
        severity: 'MEDIUM',
        message: 'Less than 2 hours operational buffer',
        impact: 'Vulnerable to minor delays'
      });
    }
    
    return {
      compliant: isCompliant,
      bufferHours: bufferHours,
      targetDate: slaTargetDate,
      estimatedDelivery: etaCalculation.estimatedDelivery,
      risks,
      grade: this.calculateSLAGrade(bufferHours, risks.length)
    };
  }

  /**
   * Helper methods for itinerary engine
   */
  calculateDistance(coord1, coord2) {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  getServiceDuration(serviceType, tier) {
    const durations = {
      'authentication': { 'T2': 2, 'T3': 3 },
      'sewing': { 'T3': 4 },
      'qa': { 'T2': 1, 'T3': 1.5 }
    };
    
    return durations[serviceType]?.[tier] || 1;
  }

  calculateSLAGrade(bufferHours, riskCount) {
    if (bufferHours >= 24 && riskCount === 0) return 'A';
    if (bufferHours >= 12 && riskCount <= 1) return 'B';
    if (bufferHours >= 4 && riskCount <= 2) return 'C';
    if (bufferHours >= 0) return 'D';
    return 'F';
  }

  /**
   * Select optimal hubs for itinerary (reuse from main engine)
   */
  async selectOptimalHubsForItinerary(inputs, hubCandidates, tier) {
    return await this.routeEngine.selectOptimalHubs(
      inputs, hubCandidates, { requiresSewing: tier === 3, requiresNFC: tier === 3 }
    );
  }

  /**
   * Build internal rollout leg between hubs
   */
  async buildInternalRolloutLeg(segment, inputs) {
    const { hubId, hubCou } = segment;
    
    return {
      type: 'internal-rollout',
      from: hubId,
      to: hubCou,
      duration: 0.5, // 30 minutes for internal transfer
      cost: this.routeEngine.calculateHubServiceCost(hubId.hubId, 'internal_rollout'),
      schedule: 'daily-14:00', // Daily rollout at 14:00
      priority: 'internal',
      buffers: { loading: 0.25, unloading: 0.25 }
    };
  }

  /**
   * Build DHL leg with rate cache lookup
   */
  async buildDHLLeg(segment, inputs, selectedHubs, rateCaches) {
    const { from, to } = segment;
    
    return {
      type: 'dhl',
      from: this.getCoordinatesForLocation(from, {
        origin: inputs.originGeocode,
        hubId: selectedHubs.hubId,
        hubCou: selectedHubs.hubCou,
        destination: inputs.destinationGeocode
      }),
      to: this.getCoordinatesForLocation(to, {
        origin: inputs.originGeocode,
        hubId: selectedHubs.hubId,
        hubCou: selectedHubs.hubCou,
        destination: inputs.destinationGeocode
      }),
      service: inputs.weightDims.weight > 30 ? 'EXPRESS' : 'STANDARD',
      duration: inputs.weightDims.weight > 30 ? 1.5 : 2.5, // Express vs standard
      cost: this.calculateDHLCost(inputs.weightDims),
      tracking: `DHL_${Date.now()}`,
      buffers: { pickup: 0.5, delivery: 0.5 }
    };
  }

  /**
   * Calculate DHL shipping cost
   */
  calculateDHLCost(weightDims) {
    const baseRate = 25;
    const weightRate = weightDims.weight * 3.50;
    const volumeRate = weightDims.volume * 15;
    const fragileRate = weightDims.fragile ? 20 : 0;
    
    return baseRate + weightRate + volumeRate + fragileRate;
  }

  // Enhanced helper methods
  validateWeightDimensions(weightDims) { 
    return {
      weight: Math.max(0.1, weightDims?.weight || 2.5),
      volume: Math.max(0.01, weightDims?.volume || 0.5),
      fragile: Boolean(weightDims?.fragile)
    };
  }

  standardizeTimeWindows(timeWindows) { 
    return {
      pickup: timeWindows?.pickup || this.TIME_WINDOWS.BUSINESS_HOURS,
      delivery: timeWindows?.delivery || this.TIME_WINDOWS.BUSINESS_HOURS,
      businessHours: timeWindows?.businessHours !== false
    };
  }

  determineTransportMode(segment, inputs) { 
    // Simple logic - could be enhanced based on route option
    return segment.preferredMode || 'white-glove';
  }

  getCoordinatesForLocation(location, coords) { 
    const locationMap = {
      'origin': coords.origin,
      'hubId': coords.hubId?.city ? { lat: this.getCityLat(coords.hubId.city), lng: this.getCityLng(coords.hubId.city) } : coords.hubId,
      'hubCou': coords.hubCou?.city ? { lat: this.getCityLat(coords.hubCou.city), lng: this.getCityLng(coords.hubCou.city) } : coords.hubCou,
      'destination': coords.destination
    };
    
    return locationMap[location] || coords.origin;
  }

  getCityLat(city) {
    const coords = {
      'London': 51.5074, 'Paris': 48.8566, 'Milan': 45.4642,
      'Frankfurt': 50.1109, 'Barcelona': 41.3851
    };
    return coords[city] || 51.5074;
  }

  getCityLng(city) {
    const coords = {
      'London': -0.1278, 'Paris': 2.3522, 'Milan': 9.1900,
      'Frankfurt': 8.6821, 'Barcelona': 2.1734
    };
    return coords[city] || -0.1278;
  }

  ensureContinuousOperator(path, timeWindows) { 
    return { 
      operatorId: `WG_OP_${Math.floor(Math.random() * 1000)}`,
      continuousSchedule: true,
      shiftStart: '08:00',
      shiftEnd: '18:00',
      overnightCapable: path.requiresOvernight
    }; 
  }

  calculateOvernightRequirements(path, schedule) { 
    if (!path.requiresOvernight) return [];
    
    return [{
      location: 'Transit Hub',
      date: new Date().toISOString(),
      cost: 120, // Hotel cost
      reason: 'Extended travel time requires overnight stay'
    }];
  }

  calculateLegBuffers(path) { 
    const baseBuffer = 1; // 1 hour base
    const complexityBuffer = path.segments?.length > 1 ? 0.5 : 0;
    const weatherBuffer = 0.25; // Seasonal buffer
    
    return { 
      base: baseBuffer,
      complexity: complexityBuffer,
      weather: weatherBuffer,
      total: baseBuffer + complexityBuffer + weatherBuffer
    };
  }

  determineLegProcessing(segment, tier) { 
    if (segment.from === 'hubId') return tier === 3 ? 'authentication' : 'authentication-qa';
    if (segment.from === 'hubCou') return 'sewing-qa';
    return 'pickup';
  }

  findNearestTrainStation(coords) { 
    // Mock train stations - in reality would query transport API
    const stations = [
      { name: 'Central Station', coords: { lat: coords.lat + 0.01, lng: coords.lng + 0.01 } },
      { name: 'North Terminal', coords: { lat: coords.lat - 0.02, lng: coords.lng + 0.02 } }
    ];
    
    return stations[0]; // Return closest
  }

  findNearestAirport(coords) { 
    // Mock airports - in reality would query aviation API
    const airports = [
      { name: 'International Airport', code: 'INT', coords: { lat: coords.lat + 0.05, lng: coords.lng + 0.05 } },
      { name: 'Regional Airport', code: 'REG', coords: { lat: coords.lat - 0.03, lng: coords.lng - 0.03 } }
    ];
    
    return airports[0]; // Return closest
  }

  findAvailableSlot(hub, service, duration, windows, earliest) { 
    const startTime = earliest ? new Date(earliest) : new Date();
    startTime.setMinutes(0, 0, 0); // Round to nearest hour
    
    // Ensure within business hours
    if (startTime.getHours() < 8) startTime.setHours(8);
    if (startTime.getHours() > 17) {
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(8);
    }
    
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);
    
    return { 
      startTime,
      endTime,
      available: true,
      hubCapacity: `${service}_available`,
      slotNumber: Math.floor(Math.random() * 100)
    }; 
  }
}

// ========================================================================================
// SUPPORTING SERVICES
// ========================================================================================

class GeocodingService {
  async geocode(address) {
    // Mock implementation - would integrate with real geocoding service
    return {
      lat: 51.5074 + Math.random() * 0.1,
      lng: -0.1278 + Math.random() * 0.1,
      address,
      city: address.split(',')[0],
      country: 'UK'
    };
  }
}

class SlotBookingService {
  constructor() {
    this.bookings = new Map();
  }
  
  async findAvailableSlot(hubId, serviceType, duration, timeWindows) {
    // Mock implementation - would check real capacity database
    return {
      startTime: new Date(),
      endTime: new Date(Date.now() + duration * 60 * 60 * 1000),
      available: true
    };
  }
}

module.exports = RouteCalculationEngine;
