// lib/sprint8/hubPricingService.js
// Hub Pricing and Selection Service with per-Hub price book

const { Pool } = require('pg');
const pool = require('../../database/connection');

class HubPricingService {
  constructor() {
    this.pool = pool;
    
    // Default hub price book (can be overridden from database)
    this.defaultPriceBook = {
      'HUB-LON-001': {
        hubId: 'HUB-LON-001',
        hubCode: 'LON1',
        hubName: 'London Hub 1',
        city: 'London',
        country: 'United Kingdom',
        address: '123 Victoria Street, London SW1',
        tier2: {
          auth_fee: 75,
          tag_unit_cost: 5,
          qa_fee: 25
        },
        tier3: {
          auth_fee: 100,
          nfc_unit_cost: 25,
          sew_fee: 150,
          qa_fee: 50
        },
        internal_rollout_cost: 25,
        currency: 'EUR',
        has_sewing_capability: true,
        operating_hours: '08:00-20:00',
        time_zone: 'Europe/London'
      },
      'HUB-PAR-001': {
        hubId: 'HUB-PAR-001',
        hubCode: 'PAR1',
        hubName: 'Paris Hub 1',
        city: 'Paris',
        country: 'France',
        address: '456 Rue de Rivoli, Paris',
        tier2: {
          auth_fee: 70,
          tag_unit_cost: 5,
          qa_fee: 20
        },
        tier3: {
          auth_fee: 95,
          nfc_unit_cost: 25,
          sew_fee: 140,
          qa_fee: 45
        },
        internal_rollout_cost: 30,
        currency: 'EUR',
        has_sewing_capability: true,
        operating_hours: '09:00-19:00',
        time_zone: 'Europe/Paris'
      },
      'HUB-MIL-001': {
        hubId: 'HUB-MIL-001',
        hubCode: 'MIL1',
        hubName: 'Milan Hub 1',
        city: 'Milan',
        country: 'Italy',
        address: '789 Via Montenapoleone, Milan',
        tier2: {
          auth_fee: 65,
          tag_unit_cost: 4,
          qa_fee: 20
        },
        tier3: {
          auth_fee: 90,
          nfc_unit_cost: 22,
          sew_fee: 160,
          qa_fee: 55
        },
        internal_rollout_cost: 20,
        currency: 'EUR',
        has_sewing_capability: true,
        operating_hours: '08:30-18:30',
        time_zone: 'Europe/Rome'
      },
      'HUB-BER-001': {
        hubId: 'HUB-BER-001',
        hubCode: 'BER1',
        hubName: 'Berlin Hub 1',
        city: 'Berlin',
        country: 'Germany',
        address: '321 Kurfürstendamm, Berlin',
        tier2: {
          auth_fee: 80,
          tag_unit_cost: 6,
          qa_fee: 30
        },
        tier3: {
          auth_fee: 110,
          nfc_unit_cost: 28,
          sew_fee: 145,
          qa_fee: 48
        },
        internal_rollout_cost: 35,
        currency: 'EUR',
        has_sewing_capability: false, // No sewing capability
        operating_hours: '08:00-18:00',
        time_zone: 'Europe/Berlin'
      },
      'HUB-AMS-001': {
        hubId: 'HUB-AMS-001',
        hubCode: 'AMS1',
        hubName: 'Amsterdam Hub 1',
        city: 'Amsterdam',
        country: 'Netherlands',
        address: '654 Kalverstraat, Amsterdam',
        tier2: {
          auth_fee: 72,
          tag_unit_cost: 5,
          qa_fee: 22
        },
        tier3: {
          auth_fee: 98,
          nfc_unit_cost: 24,
          sew_fee: 155,
          qa_fee: 52
        },
        internal_rollout_cost: 28,
        currency: 'EUR',
        has_sewing_capability: true,
        operating_hours: '09:00-20:00',
        time_zone: 'Europe/Amsterdam'
      }
    };
  }

  /**
   * Get all available hubs with current capacity and pricing
   * @param {Date} targetDate - Date for capacity check
   * @returns {Array} Array of hubs with pricing and availability
   */
  async getAvailableHubs(targetDate) {
    try {
      // Get hubs from database with current capacity
      const hubsResult = await this.pool.query(`
        SELECT 
          h.*,
          hc.auth_capacity_total,
          hc.auth_capacity_available,
          hc.sewing_capacity_total,
          hc.sewing_capacity_available,
          hc.capacity_date,
          hi.nfc_stock,
          hi.tag_stock,
          hi.last_updated as inventory_updated
        FROM logistics_hubs h
        LEFT JOIN hub_daily_capacity hc ON h.id = hc.hub_id 
          AND hc.capacity_date = $1::date
        LEFT JOIN hub_inventory hi ON h.id = hi.hub_id
        WHERE h.status = 'active'
        ORDER BY h.hub_code
      `, [targetDate]);
      
      const hubs = hubsResult.rows;
      
      // Merge with price book
      const hubsWithPricing = hubs.map(hub => {
        const priceBook = this.defaultPriceBook[hub.hub_id] || {};
        
        return {
          ...hub,
          ...priceBook,
          // Override with database values if they exist
          tier2_auth_fee: hub.tier2_auth_fee || priceBook.tier2?.auth_fee || 75,
          tier3_auth_fee: hub.tier3_auth_fee || priceBook.tier3?.auth_fee || 100,
          tier3_sew_fee: hub.tier3_sew_fee || priceBook.tier3?.sew_fee || 150,
          tag_unit_cost: hub.tag_unit_cost || priceBook.tier2?.tag_unit_cost || 5,
          nfc_unit_cost: hub.nfc_unit_cost || priceBook.tier3?.nfc_unit_cost || 25,
          qa_fee: hub.qa_fee || priceBook.tier3?.qa_fee || 50,
          internal_rollout_cost: hub.internal_rollout_cost || priceBook.internal_rollout_cost || 25,
          
          // Capacity status
          auth_capacity_status: this.getCapacityStatus(
            hub.auth_capacity_available,
            hub.auth_capacity_total
          ),
          sewing_capacity_status: this.getCapacityStatus(
            hub.sewing_capacity_available,
            hub.sewing_capacity_total
          ),
          inventory_status: {
            nfc: this.getInventoryStatus(hub.nfc_stock),
            tag: this.getInventoryStatus(hub.tag_stock)
          }
        };
      });
      
      return hubsWithPricing;
      
    } catch (error) {
      console.error('Error getting available hubs:', error);
      // Return default hubs if database fails
      return Object.values(this.defaultPriceBook);
    }
  }

  /**
   * Select optimal hub combination for a shipment
   * @param {Object} shipmentData - Shipment details
   * @param {Number} tier - Shipment tier (2 or 3)
   * @param {Date} processingDate - Target processing date
   * @returns {Object} Selected hub(s) with pricing
   */
  async selectOptimalHubs(shipmentData, tier, processingDate) {
    const availableHubs = await this.getAvailableHubs(processingDate);
    
    // Filter hubs based on tier requirements
    const eligibleHubs = availableHubs.filter(hub => {
      // Must have authentication capacity
      if (hub.auth_capacity_available <= 0) return false;
      
      // Tier 3 specific requirements
      if (tier === 3) {
        // Must have NFC stock
        if (hub.nfc_stock <= 0) return false;
        
        // For sewing, need sewing capability
        if (hub.has_sewing_capability && hub.sewing_capacity_available <= 0) {
          return false;
        }
      }
      
      // Tier 2 specific requirements
      if (tier === 2) {
        // Must have tag stock
        if (hub.tag_stock <= 0) return false;
      }
      
      return true;
    });
    
    if (eligibleHubs.length === 0) {
      throw new Error('No hubs available with required capacity and inventory');
    }
    
    // Score hubs based on multiple factors
    const scoredHubs = await Promise.all(
      eligibleHubs.map(async hub => {
        const score = await this.scoreHub(hub, shipmentData, tier);
        return { ...hub, score };
      })
    );
    
    // Sort by score (highest first)
    scoredHubs.sort((a, b) => b.score - a.score);
    
    // Select hubs based on tier
    if (tier === 3) {
      // Need HubId and HubCou
      const hubId = scoredHubs[0];
      
      // Find best hub for sewing (might be same hub)
      const hubCou = scoredHubs.find(h => h.has_sewing_capability) || hubId;
      
      return {
        hubId: this.formatHubForResponse(hubId, tier),
        hubCou: this.formatHubForResponse(hubCou, tier),
        totalCost: this.calculateHubCosts(hubId, hubCou, tier)
      };
    } else {
      // Tier 2 only needs HubId
      const hubId = scoredHubs[0];
      
      return {
        hubId: this.formatHubForResponse(hubId, tier),
        hubCou: null,
        totalCost: this.calculateHubCosts(hubId, null, tier)
      };
    }
  }

  /**
   * Score a hub based on multiple factors
   */
  async scoreHub(hub, shipmentData, tier) {
    let score = 100;
    
    // Distance factor (30% weight)
    const senderDistance = await this.calculateDistance(
      shipmentData.sender_city,
      hub.city
    );
    const buyerDistance = await this.calculateDistance(
      hub.city,
      shipmentData.buyer_city
    );
    
    const totalDistance = senderDistance + buyerDistance;
    const distanceScore = Math.max(0, 100 - (totalDistance / 30)); // Lose 1 point per 30km
    score = (score * 0.7) + (distanceScore * 0.3);
    
    // Cost factor (25% weight)
    const authFee = tier === 3 ? hub.tier3_auth_fee : hub.tier2_auth_fee;
    const costScore = Math.max(0, 100 - (authFee - 50)); // Base at €50
    score = (score * 0.75) + (costScore * 0.25);
    
    // Capacity factor (25% weight)
    const capacityRatio = hub.auth_capacity_available / hub.auth_capacity_total;
    const capacityScore = capacityRatio * 100;
    score = (score * 0.75) + (capacityScore * 0.25);
    
    // Capability factor (20% weight for Tier 3)
    if (tier === 3) {
      const capabilityScore = hub.has_sewing_capability ? 100 : 50;
      score = (score * 0.8) + (capabilityScore * 0.2);
    }
    
    // Bonus points for same-hub processing (reduces internal transfer)
    if (tier === 3 && hub.has_sewing_capability) {
      score += 10; // Bonus for single-hub processing
    }
    
    return Math.round(score);
  }

  /**
   * Calculate total hub costs
   */
  calculateHubCosts(hubId, hubCou, tier) {
    const costs = {
      authentication: 0,
      sewing: 0,
      qa: 0,
      inventory: 0,
      internalTransfer: 0,
      total: 0
    };
    
    if (tier === 3) {
      costs.authentication = hubId.tier3_auth_fee || 100;
      costs.inventory = hubId.nfc_unit_cost || 25;
      costs.qa = hubId.qa_fee || 50;
      
      if (hubCou) {
        costs.sewing = hubCou.tier3_sew_fee || 150;
        
        // Internal transfer cost if different hubs
        if (hubId.id !== hubCou.id) {
          costs.internalTransfer = hubId.internal_rollout_cost || 25;
        }
      }
    } else {
      costs.authentication = hubId.tier2_auth_fee || 75;
      costs.inventory = hubId.tag_unit_cost || 5;
      costs.qa = hubId.qa_fee || 25;
    }
    
    costs.total = Object.values(costs).reduce((sum, val) => sum + val, 0);
    
    return costs;
  }

  /**
   * Reserve hub capacity and inventory
   * @param {String} shipmentId - Shipment ID
   * @param {Object} selectedHubs - Selected hub(s)
   * @param {Number} tier - Shipment tier
   * @param {Date} processingDate - Processing date
   * @returns {Object} Reservation details
   */
  async reserveHubResources(shipmentId, selectedHubs, tier, processingDate) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const reservations = [];
      
      // Reserve authentication capacity at HubId
      const authReservation = await client.query(`
        UPDATE hub_daily_capacity
        SET auth_capacity_available = auth_capacity_available - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE hub_id = $1 
          AND capacity_date = $2::date
          AND auth_capacity_available > 0
        RETURNING *
      `, [selectedHubs.hubId.id, processingDate]);
      
      if (authReservation.rows.length === 0) {
        throw new Error('Failed to reserve authentication capacity');
      }
      
      reservations.push({
        type: 'authentication',
        hubId: selectedHubs.hubId.id,
        date: processingDate
      });
      
      // Reserve sewing capacity for Tier 3
      if (tier === 3 && selectedHubs.hubCou) {
        const sewingReservation = await client.query(`
          UPDATE hub_daily_capacity
          SET sewing_capacity_available = sewing_capacity_available - 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE hub_id = $1 
            AND capacity_date = $2::date
            AND sewing_capacity_available > 0
          RETURNING *
        `, [selectedHubs.hubCou.id, processingDate]);
        
        if (sewingReservation.rows.length === 0) {
          throw new Error('Failed to reserve sewing capacity');
        }
        
        reservations.push({
          type: 'sewing',
          hubId: selectedHubs.hubCou.id,
          date: processingDate
        });
      }
      
      // Reserve inventory
      const inventoryType = tier === 3 ? 'nfc' : 'tag';
      const inventoryField = tier === 3 ? 'nfc_stock' : 'tag_stock';
      
      const inventoryReservation = await client.query(`
        UPDATE hub_inventory
        SET ${inventoryField} = ${inventoryField} - 1,
            last_updated = CURRENT_TIMESTAMP
        WHERE hub_id = $1 
          AND ${inventoryField} > 0
        RETURNING *
      `, [selectedHubs.hubId.id]);
      
      if (inventoryReservation.rows.length === 0) {
        throw new Error(`Failed to reserve ${inventoryType} inventory`);
      }
      
      reservations.push({
        type: inventoryType,
        hubId: selectedHubs.hubId.id,
        quantity: 1
      });
      
      // Create reservation record
      const reservationRecord = await client.query(`
        INSERT INTO hub_resource_reservations (
          shipment_id,
          hub_id,
          reservation_type,
          reservation_date,
          resources,
          status,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        shipmentId,
        selectedHubs.hubId.id,
        'route_planning',
        processingDate,
        JSON.stringify(reservations),
        'active',
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour expiry
      ]);
      
      await client.query('COMMIT');
      
      return {
        reservationId: reservationRecord.rows[0].id,
        reservations,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error reserving hub resources:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update hub pricing in the price book
   * @param {String} hubId - Hub ID
   * @param {Object} pricing - New pricing structure
   */
  async updateHubPricing(hubId, pricing) {
    try {
      // Update in database
      await this.pool.query(`
        UPDATE logistics_hubs
        SET 
          tier2_auth_fee = $2,
          tier3_auth_fee = $3,
          tier3_sew_fee = $4,
          tag_unit_cost = $5,
          nfc_unit_cost = $6,
          qa_fee = $7,
          internal_rollout_cost = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE hub_id = $1
      `, [
        hubId,
        pricing.tier2_auth_fee,
        pricing.tier3_auth_fee,
        pricing.tier3_sew_fee,
        pricing.tag_unit_cost,
        pricing.nfc_unit_cost,
        pricing.qa_fee,
        pricing.internal_rollout_cost
      ]);
      
      // Update in-memory price book
      if (this.defaultPriceBook[hubId]) {
        this.defaultPriceBook[hubId] = {
          ...this.defaultPriceBook[hubId],
          tier2: {
            auth_fee: pricing.tier2_auth_fee,
            tag_unit_cost: pricing.tag_unit_cost,
            qa_fee: pricing.qa_fee
          },
          tier3: {
            auth_fee: pricing.tier3_auth_fee,
            nfc_unit_cost: pricing.nfc_unit_cost,
            sew_fee: pricing.tier3_sew_fee,
            qa_fee: pricing.qa_fee
          },
          internal_rollout_cost: pricing.internal_rollout_cost
        };
      }
      
      return { success: true, message: 'Hub pricing updated' };
      
    } catch (error) {
      console.error('Error updating hub pricing:', error);
      throw error;
    }
  }

  /**
   * Add a new hub to the price book
   * @param {Object} hubData - Complete hub data including pricing
   */
  async addHub(hubData) {
    try {
      // Insert into database
      const result = await this.pool.query(`
        INSERT INTO logistics_hubs (
          hub_id, hub_code, hub_name, city, country, address,
          tier2_auth_fee, tier3_auth_fee, tier3_sew_fee,
          tag_unit_cost, nfc_unit_cost, qa_fee,
          internal_rollout_cost, has_sewing_capability,
          operating_hours, time_zone, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `, [
        hubData.hubId,
        hubData.hubCode,
        hubData.hubName,
        hubData.city,
        hubData.country,
        hubData.address,
        hubData.tier2.auth_fee,
        hubData.tier3.auth_fee,
        hubData.tier3.sew_fee,
        hubData.tier2.tag_unit_cost,
        hubData.tier3.nfc_unit_cost,
        hubData.tier3.qa_fee,
        hubData.internal_rollout_cost,
        hubData.has_sewing_capability,
        hubData.operating_hours,
        hubData.time_zone,
        'active'
      ]);
      
      // Add to in-memory price book
      this.defaultPriceBook[hubData.hubId] = hubData;
      
      return {
        success: true,
        hubId: result.rows[0].id,
        message: 'Hub added successfully'
      };
      
    } catch (error) {
      console.error('Error adding hub:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  getCapacityStatus(available, total) {
    if (!total || available <= 0) return 'none';
    
    const ratio = available / total;
    if (ratio > 0.5) return 'high';
    if (ratio > 0.2) return 'medium';
    return 'low';
  }

  getInventoryStatus(stock) {
    if (!stock || stock <= 0) return 'out';
    if (stock < 10) return 'low';
    if (stock < 50) return 'medium';
    return 'high';
  }

  formatHubForResponse(hub, tier) {
    return {
      id: hub.id,
      hubId: hub.hub_id,
      hubCode: hub.hub_code,
      hubName: hub.hub_name,
      city: hub.city,
      country: hub.country,
      address: hub.address,
      tier2_auth_fee: hub.tier2_auth_fee,
      tier3_auth_fee: hub.tier3_auth_fee,
      tier3_sew_fee: hub.tier3_sew_fee,
      tag_unit_cost: hub.tag_unit_cost,
      nfc_unit_cost: hub.nfc_unit_cost,
      qa_fee: hub.qa_fee,
      internal_rollout_cost: hub.internal_rollout_cost,
      has_sewing_capability: hub.has_sewing_capability,
      auth_capacity_available: hub.auth_capacity_available,
      sewing_capacity_available: hub.sewing_capacity_available,
      nfc_stock: hub.nfc_stock,
      tag_stock: hub.tag_stock,
      capacity_status: hub.auth_capacity_status,
      inventory_status: hub.inventory_status,
      score: hub.score
    };
  }

  async calculateDistance(fromCity, toCity) {
    // Simplified distance calculation
    const cities = {
      'London': { lat: 51.5074, lon: -0.1278 },
      'Paris': { lat: 48.8566, lon: 2.3522 },
      'Milan': { lat: 45.4642, lon: 9.1900 },
      'Berlin': { lat: 52.5200, lon: 13.4050 },
      'Madrid': { lat: 40.4168, lon: -3.7038 },
      'Amsterdam': { lat: 52.3676, lon: 4.9041 }
    };
    
    const from = cities[fromCity] || cities['London'];
    const to = cities[toCity] || cities['London'];
    
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(from.lat * Math.PI / 180) * 
              Math.cos(to.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
  }
}

module.exports = HubPricingService;
