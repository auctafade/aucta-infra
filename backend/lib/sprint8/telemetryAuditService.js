// lib/sprint8/telemetryAuditService.js
// Telemetry & Audit Service - Comprehensive logging with idempotency

const { Pool } = require('pg');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const pool = require('../../database/connection');

class TelemetryAuditService extends EventEmitter {
  constructor() {
    super();
    this.pool = pool;
    
    // Idempotency tracking
    this.processedHashes = new Map(); // optionHash → timestamp
    this.HASH_TTL = 60 * 60 * 1000; // 1 hour TTL for idempotency
  }

  /**
   * Log plan.option.computed event
   * 
   * @param {Object} computationData - Route computation details
   * @returns {string} optionHash for idempotency
   */
  async logOptionComputed(computationData) {
    const {
      shipmentId,
      inputsHash,
      selectedHubs,
      routeOptions,
      cacheHits,
      sessionId
    } = computationData;

    // Generate option hash for idempotency
    const optionHash = this.generateOptionHash(inputsHash, selectedHubs, routeOptions);
    
    // Check idempotency
    if (this.isProcessed(optionHash)) {
      console.log(`🔄 Idempotency: Option computation already processed (${optionHash})`);
      return optionHash;
    }

    try {
      const eventData = {
        eventType: 'plan.option.computed',
        shipmentId,
        sessionId,
        optionHash,
        inputsHash,
        selectedHubs: {
          hubId: selectedHubs.hubId?.hubCode || selectedHubs.hubId?.id,
          hubCou: selectedHubs.hubCou?.hubCode || selectedHubs.hubCou?.id
        },
        routeOptions: routeOptions.map(route => ({
          id: route.id,
          label: route.label,
          eta: route.schedule?.estimatedDelivery,
          totalCost: route.costBreakdown?.total,
          score: route.score,
          feasible: route.feasible,
          tier: route.tier
        })),
        cacheHits: {
          total: cacheHits?.total || 0,
          byService: cacheHits?.byService || {},
          hitRate: cacheHits?.hitRate || 0
        },
        computation: {
          optionsGenerated: routeOptions.length,
          avgScore: routeOptions.reduce((sum, r) => sum + (r.score || 0), 0) / routeOptions.length,
          feasibleCount: routeOptions.filter(r => r.feasible).length,
          totalCostRange: {
            min: Math.min(...routeOptions.map(r => r.costBreakdown?.total || 0)),
            max: Math.max(...routeOptions.map(r => r.costBreakdown?.total || 0))
          }
        },
        timestamp: new Date().toISOString()
      };

      // Store in database
      await this.storeEvent(eventData);
      
      // Mark as processed for idempotency
      this.markProcessed(optionHash);
      
      // Emit event for listeners
      this.emit('plan.option.computed', eventData);
      
      console.log(`📊 Logged option computation: ${routeOptions.length} options, hash: ${optionHash}`);
      
      return optionHash;
      
    } catch (error) {
      console.error('❌ Failed to log option computation:', error);
      throw error;
    }
  }

  /**
   * Log plan.route.selected event
   * 
   * @param {Object} selectionData - Route selection details
   * @returns {string} selectionHash for audit
   */
  async logRouteSelected(selectionData) {
    const {
      shipmentId,
      selectedRoute,
      provisionalLegs,
      hubReservations,
      inventoryHolds,
      routeMap,
      userId,
      sessionId,
      optionHash
    } = selectionData;

    // Generate selection hash
    const selectionHash = this.generateSelectionHash(shipmentId, selectedRoute.id, optionHash);

    try {
      const eventData = {
        eventType: 'plan.route.selected',
        shipmentId,
        sessionId,
        userId,
        optionHash,
        selectionHash,
        selectedRoute: {
          id: selectedRoute.id,
          label: selectedRoute.label,
          tier: selectedRoute.tier,
          routeType: this.determineRouteType(selectedRoute)
        },
        fullBreakdown: {
          totalCost: selectedRoute.costBreakdown?.total,
          clientPrice: selectedRoute.costBreakdown?.clientPrice,
          currency: selectedRoute.costBreakdown?.currency,
          components: this.extractCostComponents(selectedRoute.costBreakdown),
          margins: {
            absolute: (selectedRoute.costBreakdown?.clientPrice || 0) - (selectedRoute.costBreakdown?.total || 0),
            percentage: this.calculateMarginPercentage(selectedRoute.costBreakdown)
          }
        },
        hubsUsed: {
          hubId: selectedRoute.hubId?.hubCode || selectedRoute.hubId?.id,
          hubCou: selectedRoute.hubCou?.hubCode || selectedRoute.hubCou?.id,
          hubCount: selectedRoute.tier === 3 ? 2 : 1
        },
        legs: provisionalLegs.map(leg => ({
          order: leg.legOrder,
          type: leg.legType,
          carrier: leg.carrier,
          from: leg.fromLocation,
          to: leg.toLocation,
          frozenCost: leg.frozenCost,
          duration: leg.duration,
          distance: leg.distance
        })),
        reservations: {
          hubSlots: hubReservations.length,
          inventoryHolds: inventoryHolds.length,
          totalReservedValue: hubReservations.reduce((sum, r) => sum + (r.frozenCost || 0), 0) +
                            inventoryHolds.reduce((sum, h) => sum + (h.totalCost || 0), 0)
        },
        routeMap: {
          generated: !!routeMap,
          htmlPath: routeMap?.htmlPath,
          pdfPath: routeMap?.pdfPath
        },
        timing: {
          estimatedDelivery: selectedRoute.schedule?.estimatedDelivery,
          totalHours: selectedRoute.schedule?.totalHours,
          slaCompliant: selectedRoute.slaValidation?.compliant
        },
        riskFlags: selectedRoute.slaValidation?.risks?.length || 0,
        timestamp: new Date().toISOString()
      };

      // Store in database
      await this.storeEvent(eventData);
      
      // Emit event for listeners
      this.emit('plan.route.selected', eventData);
      
      console.log(`📋 Logged route selection: ${selectedRoute.id}, value: €${selectedRoute.costBreakdown?.total}`);
      
      return selectionHash;
      
    } catch (error) {
      console.error('❌ Failed to log route selection:', error);
      throw error;
    }
  }

  /**
   * Generate option hash for idempotency
   */
  generateOptionHash(inputsHash, selectedHubs, routeOptions) {
    const hashContent = {
      inputs: inputsHash,
      hubs: {
        hubId: selectedHubs.hubId?.id || selectedHubs.hubId?.hubId,
        hubCou: selectedHubs.hubCou?.id || selectedHubs.hubCou?.hubId
      },
      options: routeOptions.map(r => ({
        id: r.id,
        cost: r.costBreakdown?.total,
        feasible: r.feasible
      }))
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(hashContent))
      .digest('hex')
      .substring(0, 16); // 16 char hash
  }

  /**
   * Generate selection hash for audit
   */
  generateSelectionHash(shipmentId, routeId, optionHash) {
    const hashContent = {
      shipmentId,
      routeId,
      optionHash,
      timestamp: Date.now()
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(hashContent))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Check if option computation already processed (idempotency)
   */
  isProcessed(optionHash) {
    const processed = this.processedHashes.get(optionHash);
    if (!processed) return false;
    
    // Check TTL
    const age = Date.now() - processed;
    if (age > this.HASH_TTL) {
      this.processedHashes.delete(optionHash);
      return false;
    }
    
    return true;
  }

  /**
   * Mark option as processed for idempotency
   */
  markProcessed(optionHash) {
    this.processedHashes.set(optionHash, Date.now());
    
    // Clean up old entries
    this.cleanupProcessedHashes();
  }

  /**
   * Clean up expired processed hashes
   */
  cleanupProcessedHashes() {
    const now = Date.now();
    for (const [hash, timestamp] of this.processedHashes.entries()) {
      if (now - timestamp > this.HASH_TTL) {
        this.processedHashes.delete(hash);
      }
    }
  }

  /**
   * Store event in database
   */
  async storeEvent(eventData) {
    const query = `
      INSERT INTO telemetry_events (
        event_type, shipment_id, session_id, user_id, 
        option_hash, selection_hash, event_data, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const values = [
      eventData.eventType,
      eventData.shipmentId,
      eventData.sessionId,
      eventData.userId || null,
      eventData.optionHash || null,
      eventData.selectionHash || null,
      JSON.stringify(eventData),
      eventData.timestamp
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Generate inputs hash for shipment data
   */
  generateInputsHash(shipmentData) {
    const relevantInputs = {
      tier: shipmentData.assigned_tier,
      origin: shipmentData.sender_city,
      destination: shipmentData.buyer_city,
      value: shipmentData.declared_value,
      weight: shipmentData.weight,
      sla: shipmentData.sla_target_date,
      fragility: shipmentData.fragility
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(relevantInputs))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Extract cost components from breakdown
   */
  extractCostComponents(costBreakdown) {
    if (!costBreakdown) return {};
    
    return {
      labor: costBreakdown.operatorCosts || 0,
      transport: costBreakdown.transportCosts || 0,
      hubFees: (costBreakdown.hubIdFee || 0) + (costBreakdown.hubCouFee || 0),
      inventory: (costBreakdown.nfcUnit || 0) + (costBreakdown.tagUnit || 0),
      insurance: costBreakdown.insurance || 0,
      surcharges: (costBreakdown.peakSurcharge || 0) + 
                  (costBreakdown.remoteSurcharge || 0) + 
                  (costBreakdown.weekendSurcharge || 0) +
                  (costBreakdown.fragileSurcharge || 0) +
                  (costBreakdown.fuelSurcharge || 0),
      internalRollout: costBreakdown.internalRollout || 0,
      dhl: costBreakdown.dhlCosts || 0
    };
  }

  /**
   * Calculate margin percentage
   */
  calculateMarginPercentage(costBreakdown) {
    if (!costBreakdown || !costBreakdown.total || !costBreakdown.clientPrice) {
      return 0;
    }
    
    const margin = costBreakdown.clientPrice - costBreakdown.total;
    return (margin / costBreakdown.total) * 100;
  }

  /**
   * Determine route type from selected route
   */
  determineRouteType(selectedRoute) {
    if (selectedRoute.id?.includes('FULL_WG') || selectedRoute.label?.includes('Full WG')) {
      return 'white-glove';
    } else if (selectedRoute.id?.includes('DHL') && selectedRoute.id?.includes('END_TO_END')) {
      return 'dhl';
    } else if (selectedRoute.id?.includes('HYBRID')) {
      return 'hybrid';
    } else if (selectedRoute.id?.includes('WG') && selectedRoute.id?.includes('END_TO_END')) {
      return 'white-glove';
    }
    return 'mixed';
  }

  /**
   * Get telemetry statistics
   */
  async getTelemetryStats(timeRange = '24h') {
    const whereClause = this.getTimeRangeClause(timeRange);
    
    const query = `
      SELECT 
        event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT shipment_id) as unique_shipments,
        COUNT(DISTINCT session_id) as unique_sessions,
        AVG(CASE 
          WHEN event_data->>'routeOptions' IS NOT NULL 
          THEN (event_data->'computation'->>'optionsGenerated')::int 
          ELSE NULL 
        END) as avg_options_generated,
        AVG(CASE 
          WHEN event_data->>'selectedRoute' IS NOT NULL 
          THEN (event_data->'fullBreakdown'->>'totalCost')::numeric 
          ELSE NULL 
        END) as avg_selection_cost
      FROM telemetry_events 
      WHERE ${whereClause}
      GROUP BY event_type
      ORDER BY event_count DESC
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Get idempotency statistics
   */
  getIdempotencyStats() {
    return {
      trackedHashes: this.processedHashes.size,
      hashTTL: this.HASH_TTL / 1000 / 60, // minutes
      oldestHash: this.processedHashes.size > 0 ? 
        Math.min(...this.processedHashes.values()) : null
    };
  }

  /**
   * Audit route selection for compliance
   */
  async auditRouteSelection(shipmentId, timeRange = '7d') {
    const whereClause = this.getTimeRangeClause(timeRange);
    
    const query = `
      SELECT 
        event_data->>'shipmentId' as shipment_id,
        event_data->>'optionHash' as option_hash,
        event_data->>'selectionHash' as selection_hash,
        event_data->'selectedRoute'->>'id' as route_id,
        event_data->'selectedRoute'->>'tier' as tier,
        event_data->'fullBreakdown'->>'totalCost' as total_cost,
        event_data->'timing'->>'slaCompliant' as sla_compliant,
        event_data->>'riskFlags' as risk_flags,
        timestamp
      FROM telemetry_events 
      WHERE event_type = 'plan.route.selected' 
        AND event_data->>'shipmentId' = $1
        AND ${whereClause}
      ORDER BY timestamp DESC
    `;
    
    const result = await this.pool.query(query, [shipmentId]);
    return result.rows;
  }

  /**
   * Generate time range SQL clause
   */
  getTimeRangeClause(timeRange) {
    const intervals = {
      '1h': 'INTERVAL \'1 hour\'',
      '24h': 'INTERVAL \'24 hours\'',
      '7d': 'INTERVAL \'7 days\'',
      '30d': 'INTERVAL \'30 days\''
    };
    
    const interval = intervals[timeRange] || intervals['24h'];
    return `timestamp >= NOW() - ${interval}`;
  }

  /**
   * Generate telemetry report
   */
  async generateTelemetryReport(timeRange = '24h') {
    const stats = await this.getTelemetryStats(timeRange);
    const idempotencyStats = this.getIdempotencyStats();
    
    // Get cache hit rates
    const cacheQuery = `
      SELECT 
        AVG((event_data->'cacheHits'->>'hitRate')::numeric) as avg_cache_hit_rate,
        SUM((event_data->'cacheHits'->>'total')::int) as total_cache_hits
      FROM telemetry_events 
      WHERE event_type = 'plan.option.computed' 
        AND ${this.getTimeRangeClause(timeRange)}
    `;
    
    const cacheResult = await this.pool.query(cacheQuery);
    const cacheStats = cacheResult.rows[0];
    
    return {
      timeRange,
      generatedAt: new Date().toISOString(),
      eventStats: stats,
      idempotency: idempotencyStats,
      performance: {
        avgCacheHitRate: parseFloat(cacheStats.avg_cache_hit_rate || 0).toFixed(1),
        totalCacheHits: parseInt(cacheStats.total_cache_hits || 0)
      },
      summary: {
        totalEvents: stats.reduce((sum, s) => sum + parseInt(s.event_count), 0),
        uniqueShipments: Math.max(...stats.map(s => parseInt(s.unique_shipments || 0))),
        uniqueSessions: Math.max(...stats.map(s => parseInt(s.unique_sessions || 0)))
      }
    };
  }

  /**
   * Cleanup old telemetry data
   */
  async cleanupOldData(retentionDays = 90) {
    const query = `
      DELETE FROM telemetry_events 
      WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
    `;
    
    const result = await this.pool.query(query);
    console.log(`🧹 Cleaned up ${result.rowCount} old telemetry records`);
    
    return result.rowCount;
  }
}

module.exports = TelemetryAuditService;
