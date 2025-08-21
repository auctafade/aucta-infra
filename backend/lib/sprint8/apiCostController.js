// lib/sprint8/apiCostController.js
// API Cost Discipline - Controls external API calls with caching and hard caps

class APICostController {
  constructor() {
    // Cache stores with TTL
    this.caches = {
      flights: new Map(), // (city-pair, date_bucket) → cached response
      trains: new Map(),  // (city-pair, date_bucket) → cached response
      dhl: new Map(),     // (postcodes, weight/dims, product) → cached response
      ground: new Map()   // (origin, dest, time) → cached response
    };
    
    // Call tracking per render session
    this.callTracking = new Map(); // sessionId → { calls: [], count: 0, staleParts: [] }
    
    // Hard limits
    this.HARD_CAP = 8; // Max external calls per render
    
    // Cache TTL settings (in minutes)
    this.CACHE_TTL = {
      flights: 60,    // 1 hour for flight pricing
      trains: 60,     // 1 hour for train pricing
      dhl: 30,        // 30 minutes for DHL rates
      ground: 120     // 2 hours for ground transport
    };
    
    // Date bucket settings for batching
    this.DATE_BUCKET_HOURS = {
      flights: 4,     // 4-hour buckets for flights
      trains: 6,      // 6-hour buckets for trains
      ground: 12      // 12-hour buckets for ground
    };
  }

  /**
   * Initialize a new render session
   */
  initializeSession(sessionId) {
    this.callTracking.set(sessionId, {
      calls: [],
      count: 0,
      staleParts: [],
      startTime: new Date().toISOString()
    });
    
    console.log(`🎯 API Cost Controller initialized for session ${sessionId}`);
  }

  /**
   * Check if API call should be made or use cache
   * 
   * @param {string} sessionId - Render session ID
   * @param {string} serviceType - 'flights', 'trains', 'dhl', 'ground'
   * @param {Object} params - Parameters for the API call
   * @param {boolean} forceRefresh - Force refresh even if cached
   * @returns {Object} { shouldCall, cachedData, staleParts }
   */
  checkAPICall(sessionId, serviceType, params, forceRefresh = false) {
    const session = this.callTracking.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not initialized`);
    }

    // Check hard cap
    if (session.count >= this.HARD_CAP && !forceRefresh) {
      console.warn(`⚠️  Hard cap (${this.HARD_CAP}) reached for session ${sessionId}`);
      return {
        shouldCall: false,
        reason: 'HARD_CAP_REACHED',
        cachedData: this.getCachedData(serviceType, params),
        staleParts: session.staleParts
      };
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(serviceType, params);
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = this.getCachedData(serviceType, params);
      if (cached && !this.isCacheExpired(serviceType, cached.timestamp)) {
        console.log(`💾 Using cached ${serviceType} data for ${cacheKey}`);
        return {
          shouldCall: false,
          reason: 'CACHE_HIT',
          cachedData: cached,
          staleParts: session.staleParts
        };
      } else if (cached && this.isCacheExpired(serviceType, cached.timestamp)) {
        // Mark as stale
        session.staleParts.push(`${serviceType}: ${cacheKey}`);
        console.log(`⚠️  Stale ${serviceType} data for ${cacheKey}`);
      }
    }

    // Allow the call
    return {
      shouldCall: true,
      reason: forceRefresh ? 'FORCE_REFRESH' : 'CACHE_MISS',
      cachedData: null,
      staleParts: session.staleParts
    };
  }

  /**
   * Record an API call and cache the result
   */
  recordAPICall(sessionId, serviceType, params, response, error = null) {
    const session = this.callTracking.get(sessionId);
    if (!session) return;

    const callRecord = {
      serviceType,
      params,
      timestamp: new Date().toISOString(),
      success: !error,
      error: error?.message,
      cacheKey: this.generateCacheKey(serviceType, params)
    };

    session.calls.push(callRecord);
    session.count += 1;

    // Cache successful responses
    if (!error && response) {
      this.cacheResponse(serviceType, params, response);
      console.log(`💾 Cached ${serviceType} response for ${callRecord.cacheKey}`);
    }

    console.log(`📞 API call ${session.count}/${this.HARD_CAP}: ${serviceType} (${callRecord.success ? 'success' : 'error'})`);
  }

  /**
   * Generate cache key based on service type and parameters
   */
  generateCacheKey(serviceType, params) {
    switch (serviceType) {
      case 'flights':
      case 'trains':
        // Cache by (city-pair, date_bucket)
        const dateBucket = this.getDateBucket(params.date, this.DATE_BUCKET_HOURS[serviceType]);
        return `${params.origin}-${params.destination}-${dateBucket}`;
        
      case 'dhl':
        // Cache by (postcodes, weight/dims, product)
        const weightBucket = Math.ceil(params.weight / 5) * 5; // Round to nearest 5kg
        return `${params.originPostcode}-${params.destPostcode}-${weightBucket}kg-${params.product || 'standard'}`;
        
      case 'ground':
        // Cache by (origin, dest, time_bucket)
        const timeBucket = this.getDateBucket(params.date, this.DATE_BUCKET_HOURS[serviceType]);
        return `${params.origin}-${params.destination}-${timeBucket}`;
        
      default:
        return `${serviceType}-${JSON.stringify(params)}`;
    }
  }

  /**
   * Get date bucket for batching API calls
   */
  getDateBucket(dateString, bucketHours) {
    const date = new Date(dateString);
    const bucketSize = bucketHours * 60 * 60 * 1000; // Convert to milliseconds
    const bucketStart = Math.floor(date.getTime() / bucketSize) * bucketSize;
    return new Date(bucketStart).toISOString().substring(0, 13); // YYYY-MM-DDTHH
  }

  /**
   * Cache response with timestamp
   */
  cacheResponse(serviceType, params, response) {
    const cacheKey = this.generateCacheKey(serviceType, params);
    const cache = this.caches[serviceType];
    
    if (cache) {
      cache.set(cacheKey, {
        data: response,
        timestamp: new Date().toISOString(),
        params
      });
      
      // Clean up old cache entries periodically
      this.cleanupCache(serviceType);
    }
  }

  /**
   * Get cached data if available
   */
  getCachedData(serviceType, params) {
    const cacheKey = this.generateCacheKey(serviceType, params);
    const cache = this.caches[serviceType];
    
    return cache ? cache.get(cacheKey) : null;
  }

  /**
   * Check if cache entry is expired
   */
  isCacheExpired(serviceType, timestamp) {
    const ttl = this.CACHE_TTL[serviceType] * 60 * 1000; // Convert to milliseconds
    const age = Date.now() - new Date(timestamp).getTime();
    return age > ttl;
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(serviceType) {
    const cache = this.caches[serviceType];
    if (!cache) return;

    const now = Date.now();
    const ttl = this.CACHE_TTL[serviceType] * 60 * 1000;

    for (const [key, entry] of cache.entries()) {
      const age = now - new Date(entry.timestamp).getTime();
      if (age > ttl) {
        cache.delete(key);
      }
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    const session = this.callTracking.get(sessionId);
    if (!session) return null;

    const callsByService = {};
    session.calls.forEach(call => {
      callsByService[call.serviceType] = (callsByService[call.serviceType] || 0) + 1;
    });

    return {
      sessionId,
      totalCalls: session.count,
      hardCap: this.HARD_CAP,
      remainingCalls: Math.max(0, this.HARD_CAP - session.count),
      callsByService,
      staleParts: session.staleParts,
      startTime: session.startTime,
      cacheHitRate: this.calculateCacheHitRate(session)
    };
  }

  /**
   * Calculate cache hit rate for session
   */
  calculateCacheHitRate(session) {
    if (session.calls.length === 0) return 0;
    
    const cacheHits = session.calls.filter(call => call.success).length;
    return (cacheHits / session.calls.length) * 100;
  }

  /**
   * Batch API calls for efficiency
   */
  async batchAPICalls(sessionId, requests) {
    const session = this.callTracking.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not initialized`);
    }

    console.log(`🚀 Batching ${requests.length} API requests for session ${sessionId}`);
    
    const results = [];
    const batchesByService = {};
    
    // Group requests by service type
    requests.forEach((request, index) => {
      const { serviceType } = request;
      if (!batchesByService[serviceType]) {
        batchesByService[serviceType] = [];
      }
      batchesByService[serviceType].push({ ...request, originalIndex: index });
    });
    
    // Process each service type batch
    for (const [serviceType, batch] of Object.entries(batchesByService)) {
      if (session.count >= this.HARD_CAP) {
        console.warn(`⚠️  Hard cap reached, skipping remaining ${serviceType} calls`);
        break;
      }
      
      // Check which calls can be satisfied from cache
      const callsToMake = [];
      const cachedResults = [];
      
      batch.forEach(request => {
        const checkResult = this.checkAPICall(sessionId, serviceType, request.params);
        
        if (checkResult.shouldCall && session.count < this.HARD_CAP) {
          callsToMake.push(request);
        } else if (checkResult.cachedData) {
          cachedResults.push({
            originalIndex: request.originalIndex,
            data: checkResult.cachedData.data,
            fromCache: true
          });
        }
      });
      
      // Make actual API calls for uncached requests
      if (callsToMake.length > 0) {
        const apiResults = await this.executeServiceBatch(serviceType, callsToMake);
        
        apiResults.forEach((result, index) => {
          const originalRequest = callsToMake[index];
          this.recordAPICall(sessionId, serviceType, originalRequest.params, result.data, result.error);
          
          results[originalRequest.originalIndex] = {
            data: result.data,
            error: result.error,
            fromCache: false
          };
        });
      }
      
      // Add cached results
      cachedResults.forEach(result => {
        results[result.originalIndex] = result;
      });
    }
    
    console.log(`✅ Batch completed: ${session.count}/${this.HARD_CAP} calls used`);
    
    return results;
  }

  /**
   * Execute batch of API calls for specific service
   */
  async executeServiceBatch(serviceType, requests) {
    // Mock implementation - replace with actual API calls
    console.log(`📞 Making ${requests.length} ${serviceType} API calls`);
    
    return requests.map(request => {
      // Simulate API response based on service type
      switch (serviceType) {
        case 'flights':
          return {
            data: {
              price: 300 + Math.random() * 200,
              duration: 2.5,
              airline: 'MockAir',
              departure: request.params.date
            }
          };
          
        case 'trains':
          return {
            data: {
              price: 80 + Math.random() * 40,
              duration: 4.5,
              operator: 'MockRail',
              departure: request.params.date
            }
          };
          
        case 'dhl':
          return {
            data: {
              price: 25 + (request.params.weight * 3.5),
              service: request.params.product || 'standard',
              transitTime: '1-2 days'
            }
          };
          
        case 'ground':
          return {
            data: {
              price: 120 + Math.random() * 80,
              duration: 8,
              vehicle: 'Van'
            }
          };
          
        default:
          return { error: new Error(`Unknown service type: ${serviceType}`) };
      }
    });
  }

  /**
   * Force refresh specific leg types
   */
  async refreshSpecificLegs(sessionId, legTypes) {
    const session = this.callTracking.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not initialized`);
    }

    console.log(`🔄 Refreshing specific leg types: ${legTypes.join(', ')}`);
    
    const refreshResults = {};
    
    for (const legType of legTypes) {
      if (session.count >= this.HARD_CAP) {
        console.warn(`⚠️  Hard cap reached, skipping ${legType} refresh`);
        break;
      }
      
      // Clear cache for this leg type
      this.clearCacheForLegType(legType);
      
      // Record as forced refresh
      refreshResults[legType] = {
        refreshed: true,
        timestamp: new Date().toISOString()
      };
    }
    
    return refreshResults;
  }

  /**
   * Clear cache for specific leg type
   */
  clearCacheForLegType(legType) {
    const cache = this.caches[legType];
    if (cache) {
      cache.clear();
      console.log(`🗑️  Cleared ${legType} cache`);
    }
  }

  /**
   * Get API cost discipline badge info
   */
  getAPICostBadge(sessionId) {
    const stats = this.getSessionStats(sessionId);
    if (!stats) return null;

    const badge = {
      callsUsed: stats.totalCalls,
      hardCap: stats.hardCap,
      percentage: (stats.totalCalls / stats.hardCap) * 100,
      staleParts: stats.staleParts,
      status: this.getBadgeStatus(stats.totalCalls, stats.hardCap, stats.staleParts.length)
    };

    return badge;
  }

  /**
   * Determine badge status based on usage
   */
  getBadgeStatus(used, cap, staleCount) {
    if (staleCount > 0) return 'stale-parts';
    if (used >= cap) return 'cap-reached';
    if (used >= cap * 0.8) return 'warning';
    return 'good';
  }

  /**
   * Generate cost discipline report
   */
  generateCostReport(sessionId) {
    const stats = this.getSessionStats(sessionId);
    if (!stats) return null;

    return {
      sessionId,
      summary: {
        totalAPICalls: stats.totalCalls,
        hardCapLimit: stats.hardCap,
        remainingCalls: stats.remainingCalls,
        utilizationRate: `${((stats.totalCalls / stats.hardCap) * 100).toFixed(1)}%`,
        cacheHitRate: `${stats.cacheHitRate.toFixed(1)}%`
      },
      breakdown: stats.callsByService,
      staleParts: stats.staleParts,
      cacheStats: {
        flights: this.caches.flights.size,
        trains: this.caches.trains.size,
        dhl: this.caches.dhl.size,
        ground: this.caches.ground.size
      },
      recommendations: this.generateRecommendations(stats)
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    if (stats.cacheHitRate < 50) {
      recommendations.push('Consider increasing cache TTL for better hit rates');
    }

    if (stats.totalCalls >= stats.hardCap * 0.9) {
      recommendations.push('Close to API limit - consider batching requests');
    }

    if (stats.staleParts.length > 0) {
      recommendations.push('Some data is stale - refresh key routes if needed');
    }

    if (stats.callsByService.dhl > 3) {
      recommendations.push('High DHL API usage - batch by weight/destination');
    }

    return recommendations;
  }

  /**
   * Cleanup session data
   */
  cleanupSession(sessionId) {
    this.callTracking.delete(sessionId);
    console.log(`🧹 Cleaned up session ${sessionId}`);
  }
}

module.exports = APICostController;
