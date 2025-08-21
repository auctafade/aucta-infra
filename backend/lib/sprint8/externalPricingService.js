// lib/sprint8/externalPricingService.js
// External Pricing API Service with caching and fallback mechanisms

const axios = require('axios');
const NodeCache = require('node-cache');

class ExternalPricingService {
  constructor() {
    // Initialize caches with TTL
    this.flightCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL
    this.trainCache = new NodeCache({ stdTTL: 3600 });
    this.groundCache = new NodeCache({ stdTTL: 1800 }); // 30 min TTL
    this.dhlCache = new NodeCache({ stdTTL: 7200 }); // 2 hour TTL
    this.fxCache = new NodeCache({ stdTTL: 86400 }); // 24 hour TTL
    
    // API configuration
    this.apis = {
      // Flight APIs (in order of preference)
      flights: [
        {
          name: 'amadeus',
          enabled: process.env.AMADEUS_API_KEY ? true : false,
          baseUrl: 'https://api.amadeus.com/v2',
          auth: {
            clientId: process.env.AMADEUS_CLIENT_ID,
            clientSecret: process.env.AMADEUS_CLIENT_SECRET
          }
        },
        {
          name: 'duffel',
          enabled: process.env.DUFFEL_API_KEY ? true : false,
          baseUrl: 'https://api.duffel.com',
          apiKey: process.env.DUFFEL_API_KEY
        },
        {
          name: 'kiwi',
          enabled: process.env.KIWI_API_KEY ? true : false,
          baseUrl: 'https://api.tequila.kiwi.com',
          apiKey: process.env.KIWI_API_KEY
        }
      ],
      
      // Ground transport APIs
      ground: {
        uber: {
          enabled: process.env.UBER_API_KEY ? true : false,
          baseUrl: 'https://api.uber.com/v1.2',
          apiKey: process.env.UBER_API_KEY
        },
        googleMaps: {
          enabled: process.env.GOOGLE_MAPS_API_KEY ? true : false,
          baseUrl: 'https://maps.googleapis.com/maps/api',
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      },
      
      // DHL API
      dhl: {
        enabled: process.env.DHL_API_KEY ? true : false,
        baseUrl: 'https://api-eu.dhl.com/track',
        apiKey: process.env.DHL_API_KEY,
        accountNumber: process.env.DHL_ACCOUNT_NUMBER
      },
      
      // Currency API
      currency: {
        ecb: {
          enabled: true,
          baseUrl: 'https://api.exchangerate-api.com/v4/latest/EUR'
        }
      }
    };
    
    // Fallback pricing tables
    this.fallbackPricing = {
      flights: {
        // City pair base prices in EUR
        'LON-PAR': 120,
        'LON-MIL': 180,
        'LON-BER': 150,
        'PAR-MIL': 140,
        'PAR-BER': 160,
        'MIL-BER': 170,
        default: 200
      },
      trains: {
        'LON-PAR': 80, // Eurostar
        'PAR-MIL': 100,
        'PAR-BER': 120,
        'MIL-BER': 110,
        default: 90
      },
      ground: {
        perKm: 0.5, // EUR per km
        minimum: 15,
        airportSurcharge: 25
      },
      dhl: {
        standard: {
          base: 30,
          perKg: 2,
          perKm: 0.05
        },
        express: {
          base: 50,
          perKg: 3,
          perKm: 0.08
        }
      }
    };
    
    // API call tracking
    this.apiCallCount = 0;
    this.apiCallLimit = 8; // Per render limit
  }

  /**
   * Get flight prices with caching and fallback
   * @param {Object} params - { from, to, date, flexible }
   * @returns {Object} Flight pricing with source indicator
   */
  async getFlightPrice(params) {
    const { from, to, date } = params;
    const cacheKey = `${from.city}-${to.city}-${date}`;
    
    // Check cache first
    const cached = this.flightCache.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache', fresh: true };
    }
    
    // Check API call limit
    if (this.apiCallCount >= this.apiCallLimit) {
      return this.getFallbackFlightPrice(from, to, date);
    }
    
    // Try each flight API in order
    for (const api of this.apis.flights) {
      if (!api.enabled) continue;
      
      try {
        let price;
        
        switch (api.name) {
          case 'amadeus':
            price = await this.getAmadeusFlightPrice(from, to, date, api);
            break;
          case 'duffel':
            price = await this.getDuffelFlightPrice(from, to, date, api);
            break;
          case 'kiwi':
            price = await this.getKiwiFlightPrice(from, to, date, api);
            break;
        }
        
        if (price) {
          this.apiCallCount++;
          this.flightCache.set(cacheKey, price);
          return { ...price, source: 'live', fresh: true };
        }
      } catch (error) {
        console.error(`${api.name} flight API error:`, error.message);
        continue; // Try next API
      }
    }
    
    // Fallback to static pricing
    return this.getFallbackFlightPrice(from, to, date);
  }

  /**
   * Amadeus API implementation
   */
  async getAmadeusFlightPrice(from, to, date, api) {
    // Get access token
    const tokenResponse = await axios.post(
      `${api.baseUrl}/security/oauth2/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: api.auth.clientId,
        client_secret: api.auth.clientSecret
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    const token = tokenResponse.data.access_token;
    
    // Search for flights
    const searchResponse = await axios.get(
      `${api.baseUrl}/shopping/flight-offers`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          originLocationCode: this.getCityCode(from.city),
          destinationLocationCode: this.getCityCode(to.city),
          departureDate: date,
          adults: 1,
          max: 3,
          currencyCode: 'EUR'
        }
      }
    );
    
    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      // Get lowest flexible fare
      const offers = searchResponse.data.data;
      const flexibleOffers = offers.filter(o => 
        o.travelerPricings[0].fareOption === 'STANDARD'
      );
      
      const lowestPrice = Math.min(...flexibleOffers.map(o => 
        parseFloat(o.price.total)
      ));
      
      return {
        amount: lowestPrice,
        currency: 'EUR',
        carrier: offers[0].validatingAirlineCodes[0],
        flightNumber: offers[0].itineraries[0].segments[0].number,
        duration: offers[0].itineraries[0].duration
      };
    }
    
    return null;
  }

  /**
   * Duffel API implementation
   */
  async getDuffelFlightPrice(from, to, date, api) {
    const response = await axios.post(
      `${api.baseUrl}/air/offer_requests`,
      {
        data: {
          slices: [{
            origin: this.getCityCode(from.city),
            destination: this.getCityCode(to.city),
            departure_date: date
          }],
          passengers: [{ type: 'adult' }],
          cabin_class: 'economy'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${api.apiKey}`,
          'Duffel-Version': 'v1',
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.data && response.data.data.offers) {
      const offers = response.data.data.offers;
      const lowestPrice = Math.min(...offers.map(o => 
        parseFloat(o.total_amount)
      ));
      
      return {
        amount: lowestPrice,
        currency: offers[0].total_currency,
        carrier: offers[0].owner.name,
        duration: offers[0].slices[0].duration
      };
    }
    
    return null;
  }

  /**
   * Kiwi (Tequila) API implementation
   */
  async getKiwiFlightPrice(from, to, date, api) {
    const response = await axios.get(
      `${api.baseUrl}/v2/search`,
      {
        headers: { 'apikey': api.apiKey },
        params: {
          fly_from: this.getCityCode(from.city),
          fly_to: this.getCityCode(to.city),
          date_from: date,
          date_to: date,
          adults: 1,
          curr: 'EUR',
          limit: 5,
          sort: 'price'
        }
      }
    );
    
    if (response.data.data && response.data.data.length > 0) {
      const flight = response.data.data[0];
      
      return {
        amount: flight.price,
        currency: 'EUR',
        carrier: flight.airlines[0],
        duration: `${Math.floor(flight.duration.total / 3600)}h`,
        route: flight.route.map(r => r.cityFrom).join('-')
      };
    }
    
    return null;
  }

  /**
   * Get ground transport price
   */
  async getGroundPrice(params) {
    const { from, to, distance } = params;
    const cacheKey = `${from.city}-${to.city}`;
    
    // Check cache
    const cached = this.groundCache.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache', fresh: true };
    }
    
    // Try Uber API first
    if (this.apis.ground.uber.enabled && this.apiCallCount < this.apiCallLimit) {
      try {
        const price = await this.getUberPrice(from, to, this.apis.ground.uber);
        if (price) {
          this.apiCallCount++;
          this.groundCache.set(cacheKey, price);
          return { ...price, source: 'live', fresh: true };
        }
      } catch (error) {
        console.error('Uber API error:', error.message);
      }
    }
    
    // Fallback to Google Distance Matrix + fare calculation
    if (this.apis.ground.googleMaps.enabled && this.apiCallCount < this.apiCallLimit) {
      try {
        const price = await this.getGoogleGroundPrice(from, to, distance);
        if (price) {
          this.apiCallCount++;
          this.groundCache.set(cacheKey, price);
          return { ...price, source: 'live', fresh: true };
        }
      } catch (error) {
        console.error('Google Maps API error:', error.message);
      }
    }
    
    // Fallback to static calculation
    return this.getFallbackGroundPrice(distance);
  }

  /**
   * Uber price estimate
   */
  async getUberPrice(from, to, api) {
    const response = await axios.get(
      `${api.baseUrl}/estimates/price`,
      {
        headers: { 'Authorization': `Token ${api.apiKey}` },
        params: {
          start_latitude: from.lat || this.getCoordinates(from.city).lat,
          start_longitude: from.lon || this.getCoordinates(from.city).lon,
          end_latitude: to.lat || this.getCoordinates(to.city).lat,
          end_longitude: to.lon || this.getCoordinates(to.city).lon
        }
      }
    );
    
    if (response.data.prices && response.data.prices.length > 0) {
      // Get UberX price
      const uberX = response.data.prices.find(p => p.display_name === 'UberX') || 
                    response.data.prices[0];
      
      return {
        amount: (uberX.high_estimate + uberX.low_estimate) / 2,
        currency: uberX.currency_code,
        service: uberX.display_name,
        duration: Math.round(uberX.duration / 60), // Convert to minutes
        distance: uberX.distance
      };
    }
    
    return null;
  }

  /**
   * Google Distance Matrix + fare calculation
   */
  async getGoogleGroundPrice(from, to, distance) {
    const api = this.apis.ground.googleMaps;
    
    const response = await axios.get(
      `${api.baseUrl}/distancematrix/json`,
      {
        params: {
          origins: `${from.city}`,
          destinations: `${to.city}`,
          mode: 'driving',
          units: 'metric',
          key: api.apiKey
        }
      }
    );
    
    if (response.data.rows && response.data.rows[0].elements[0].status === 'OK') {
      const element = response.data.rows[0].elements[0];
      const distanceKm = element.distance.value / 1000;
      const durationMin = element.duration.value / 60;
      
      // Calculate fare based on city rates
      const cityRates = this.getCityTaxiRates(from.city);
      const fare = cityRates.base + (distanceKm * cityRates.perKm) + 
                  (durationMin * cityRates.perMinute);
      
      return {
        amount: Math.round(fare),
        currency: 'EUR',
        service: 'Taxi',
        duration: Math.round(durationMin),
        distance: distanceKm
      };
    }
    
    return null;
  }

  /**
   * Get DHL rate
   */
  async getDHLRate(params) {
    const { from, to, weight, dims, service } = params;
    const cacheKey = `${from.postcode}-${to.postcode}-${weight}-${service}`;
    
    // Check cache
    const cached = this.dhlCache.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache', fresh: true };
    }
    
    // Check API limit
    if (!this.apis.dhl.enabled || this.apiCallCount >= this.apiCallLimit) {
      return this.getFallbackDHLRate(from, to, weight, service);
    }
    
    try {
      // DHL Rating API call
      const response = await axios.post(
        `${this.apis.dhl.baseUrl}/mydhlapi/rates`,
        {
          customerDetails: {
            shipperDetails: {
              postalCode: from.postcode,
              cityName: from.city,
              countryCode: this.getCountryCode(from.country)
            },
            receiverDetails: {
              postalCode: to.postcode,
              cityName: to.city,
              countryCode: this.getCountryCode(to.country)
            }
          },
          accounts: [{
            typeCode: 'shipper',
            number: this.apis.dhl.accountNumber
          }],
          productCode: service === 'express' ? 'N' : 'P', // N=Express, P=Standard
          localProductCode: service === 'express' ? 'N' : 'P',
          payerCountryCode: 'GB',
          plannedShippingDateAndTime: new Date().toISOString(),
          unitOfMeasurement: 'metric',
          isCustomsDeclarable: from.country !== to.country,
          packages: [{
            weight: weight,
            dimensions: {
              length: dims?.length || 30,
              width: dims?.width || 20,
              height: dims?.height || 10
            }
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apis.dhl.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        const rate = {
          amount: parseFloat(product.totalPrice[0].price),
          currency: product.totalPrice[0].currency,
          service: product.productName,
          deliveryTime: product.deliveryCapabilities.estimatedDeliveryDateAndTime,
          breakdown: {
            base: parseFloat(product.totalPrice[0].priceBreakdown[0].price),
            surcharges: product.totalPrice[0].priceBreakdown.slice(1).map(s => ({
              type: s.typeCode,
              amount: parseFloat(s.price)
            }))
          }
        };
        
        this.apiCallCount++;
        this.dhlCache.set(cacheKey, rate);
        return { ...rate, source: 'live', fresh: true };
      }
    } catch (error) {
      console.error('DHL API error:', error.message);
    }
    
    return this.getFallbackDHLRate(from, to, weight, service);
  }

  /**
   * Get currency exchange rates
   */
  async getExchangeRates(baseCurrency = 'EUR') {
    const cacheKey = `fx-${baseCurrency}`;
    
    // Check cache
    const cached = this.fxCache.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
    
    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
      );
      
      const rates = {
        rates: response.data.rates,
        base: baseCurrency,
        date: response.data.date
      };
      
      this.fxCache.set(cacheKey, rates);
      return { ...rates, source: 'live' };
    } catch (error) {
      console.error('Currency API error:', error.message);
      
      // Fallback rates
      return {
        rates: {
          EUR: 1,
          GBP: 0.86,
          USD: 1.08,
          CHF: 0.97
        },
        base: baseCurrency,
        source: 'fallback'
      };
    }
  }

  /**
   * Fallback pricing methods
   */
  getFallbackFlightPrice(from, to, date) {
    const cityPair = `${this.getCityCode(from.city)}-${this.getCityCode(to.city)}`;
    const basePrice = this.fallbackPricing.flights[cityPair] || 
                     this.fallbackPricing.flights.default;
    
    // Add date-based adjustments
    const dayOfWeek = new Date(date).getDay();
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1;
    
    return {
      amount: Math.round(basePrice * weekendMultiplier),
      currency: 'EUR',
      source: 'fallback',
      fresh: false,
      warning: 'Using estimated pricing'
    };
  }

  getFallbackGroundPrice(distance) {
    const fare = Math.max(
      this.fallbackPricing.ground.minimum,
      distance * this.fallbackPricing.ground.perKm
    );
    
    return {
      amount: Math.round(fare),
      currency: 'EUR',
      service: 'Taxi (estimated)',
      distance: distance,
      source: 'fallback',
      fresh: false
    };
  }

  getFallbackDHLRate(from, to, weight, service) {
    const pricing = this.fallbackPricing.dhl[service];
    const distance = this.estimateDistance(from.city, to.city);
    
    const rate = pricing.base + 
                (weight * pricing.perKg) + 
                (distance * pricing.perKm);
    
    // Add international surcharge
    if (from.country !== to.country) {
      rate *= 1.25;
    }
    
    return {
      amount: Math.round(rate),
      currency: 'EUR',
      service: service === 'express' ? 'DHL Express' : 'DHL Standard',
      source: 'fallback',
      fresh: false,
      warning: 'Using estimated pricing'
    };
  }

  /**
   * Helper methods
   */
  getCityCode(cityName) {
    const cityCodes = {
      'London': 'LON',
      'Paris': 'PAR',
      'Milan': 'MIL',
      'Berlin': 'BER',
      'Madrid': 'MAD',
      'Amsterdam': 'AMS',
      'Rome': 'ROM',
      'Barcelona': 'BCN',
      'Munich': 'MUC',
      'Vienna': 'VIE'
    };
    
    return cityCodes[cityName] || cityName.substring(0, 3).toUpperCase();
  }

  getCountryCode(country) {
    const countryCodes = {
      'United Kingdom': 'GB',
      'France': 'FR',
      'Italy': 'IT',
      'Germany': 'DE',
      'Spain': 'ES',
      'Netherlands': 'NL',
      'Belgium': 'BE',
      'Switzerland': 'CH',
      'Austria': 'AT'
    };
    
    return countryCodes[country] || 'GB';
  }

  getCoordinates(city) {
    const coords = {
      'London': { lat: 51.5074, lon: -0.1278 },
      'Paris': { lat: 48.8566, lon: 2.3522 },
      'Milan': { lat: 45.4642, lon: 9.1900 },
      'Berlin': { lat: 52.5200, lon: 13.4050 },
      'Madrid': { lat: 40.4168, lon: -3.7038 },
      'Amsterdam': { lat: 52.3676, lon: 4.9041 }
    };
    
    return coords[city] || coords['London'];
  }

  getCityTaxiRates(city) {
    const rates = {
      'London': { base: 3.20, perKm: 2.40, perMinute: 0.30 },
      'Paris': { base: 2.60, perKm: 1.06, perMinute: 0.35 },
      'Milan': { base: 3.30, perKm: 1.10, perMinute: 0.28 },
      'Berlin': { base: 3.90, perKm: 2.00, perMinute: 0.30 },
      'Madrid': { base: 2.40, perKm: 1.05, perMinute: 0.22 },
      'Amsterdam': { base: 2.95, perKm: 2.17, perMinute: 0.36 }
    };
    
    return rates[city] || rates['London'];
  }

  estimateDistance(fromCity, toCity) {
    // Simplified distance estimation
    const coords1 = this.getCoordinates(fromCity);
    const coords2 = this.getCoordinates(toCity);
    
    const R = 6371; // Earth radius in km
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lon - coords1.lon) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coords1.lat * Math.PI / 180) * 
              Math.cos(coords2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
  }

  /**
   * Reset API call counter (call at start of each render)
   */
  resetApiCallCount() {
    this.apiCallCount = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      flights: {
        keys: this.flightCache.keys().length,
        hits: this.flightCache.getStats().hits,
        misses: this.flightCache.getStats().misses
      },
      ground: {
        keys: this.groundCache.keys().length,
        hits: this.groundCache.getStats().hits,
        misses: this.groundCache.getStats().misses
      },
      dhl: {
        keys: this.dhlCache.keys().length,
        hits: this.dhlCache.getStats().hits,
        misses: this.dhlCache.getStats().misses
      },
      apiCallsThisRender: this.apiCallCount,
      apiCallLimit: this.apiCallLimit
    };
  }
}

module.exports = ExternalPricingService;
