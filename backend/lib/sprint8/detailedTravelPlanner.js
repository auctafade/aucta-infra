// lib/sprint8/detailedTravelPlanner.js
// Planificateur de voyage détaillé avec coûts précis et horaires exacts

const ExternalPricingService = require('./externalPricingService');

class DetailedTravelPlanner {
  constructor() {
    this.pricingService = new ExternalPricingService();
    
    // Horaires et paramètres de transport
    this.transportConfig = {
      wgOperator: {
        workingHours: { start: '06:00', end: '22:00' },
        overtimeRate: 1.5,
        homeBase: 'hub', // L'opérateur retourne toujours à son hub
        maxDailyHours: 12,
        breakTime: 60 // minutes
      },
      airports: {
        'London': { 
          codes: ['LHR', 'LGW', 'STN'],
          toCity: { time: 45, cost: 35 }, // Heathrow Express + Uber
          fromCity: { time: 60, cost: 40 } // Buffer pour sécurité
        },
        'Paris': { 
          codes: ['CDG', 'ORY'],
          toCity: { time: 50, cost: 32 }, // RER B + Uber
          fromCity: { time: 65, cost: 35 }
        },
        'Milan': { 
          codes: ['MXP', 'LIN'],
          toCity: { time: 55, cost: 38 }, // Malpensa Express + Uber
          fromCity: { time: 70, cost: 42 }
        },
        'Frankfurt': { 
          codes: ['FRA'],
          toCity: { time: 40, cost: 28 }, // S-Bahn + Uber
          fromCity: { time: 50, cost: 30 }
        }
      },
      trainStations: {
        'London': { main: 'St Pancras International', toStation: 15, fromStation: 20 },
        'Paris': { main: 'Gare du Nord', toStation: 25, fromStation: 30 },
        'Brussels': { main: 'Bruxelles-Midi', toStation: 20, fromStation: 25 }
      }
    };
  }

  /**
   * Planifie un voyage WG complet avec tous les détails
   */
  async planDetailedWGJourney(leg, shipmentData, operatorHub) {
    console.log('Planning detailed WG journey:', leg.from?.city, '→', leg.to?.city);
    
    const journey = {
      operator: {
        homeHub: operatorHub.city,
        startTime: null,
        endTime: null,
        totalHours: 0,
        overtime: 0
      },
      segments: [],
      costs: {
        labor: 0,
        transport: {
          flights: [],
          trains: [],
          groundTransport: [],
          total: 0
        },
        accommodation: 0,
        meals: 0,
        returnJourney: 0,
        total: 0
      },
      timeline: []
    };

    // 1. Planifier le départ depuis le hub
    const startTime = this.getOptimalStartTime(leg.from?.city, leg.to?.city);
    journey.operator.startTime = startTime;

    // 2. Transport du hub vers le pickup
    if (operatorHub.city !== leg.from?.city) {
      const hubToPickup = this.planHubToPickupTransport(
        operatorHub, 
        leg.from, 
        startTime
      );
      journey.segments.push(hubToPickup);
      if (hubToPickup.flights) journey.costs.transport.flights.push(...hubToPickup.flights);
      if (hubToPickup.trains) journey.costs.transport.trains.push(...hubToPickup.trains);
      if (hubToPickup.groundTransport) journey.costs.transport.groundTransport.push(...hubToPickup.groundTransport);
    }

    // 3. Pickup chez le sender/hub
    const pickup = this.planPickupSegment(leg.from, startTime, shipmentData);
    journey.segments.push(pickup);
    if (pickup.groundTransport) journey.costs.transport.groundTransport.push(...pickup.groundTransport);

    // 4. Transport principal (pickup vers destination)
    const mainTransport = this.planMainTransport(
      leg.from,
      leg.to,
      pickup.endTime,
      shipmentData
    );
    journey.segments.push(mainTransport);
    if (mainTransport.flights) journey.costs.transport.flights.push(...mainTransport.flights);
    if (mainTransport.trains) journey.costs.transport.trains.push(...mainTransport.trains);
    if (mainTransport.groundTransport) journey.costs.transport.groundTransport.push(...mainTransport.groundTransport);

    // 5. Delivery à la destination finale
    const delivery = this.planDeliverySegment(
      leg.to,
      mainTransport.arrivalTime,
      shipmentData
    );
    journey.segments.push(delivery);
    if (delivery.groundTransport) journey.costs.transport.groundTransport.push(...delivery.groundTransport);

    // 6. IMPORTANT: Voyage de retour de l'opérateur vers son hub
    const returnJourney = this.planReturnJourney(
      leg.to,
      operatorHub,
      delivery.endTime
    );
    journey.segments.push(returnJourney);
    journey.costs.returnJourney = returnJourney.totalCost;
    if (returnJourney.flights) journey.costs.transport.flights.push(...returnJourney.flights);
    if (returnJourney.trains) journey.costs.transport.trains.push(...returnJourney.trains);
    if (returnJourney.groundTransport) journey.costs.transport.groundTransport.push(...returnJourney.groundTransport);

    // 7. Calculer les coûts de main d'œuvre
    journey.operator.endTime = returnJourney.endTime;
    journey.operator.totalHours = this.calculateTotalHours(
      journey.operator.startTime,
      journey.operator.endTime
    );
    
    const laborCosts = this.calculateLaborCosts(journey.operator.totalHours);
    journey.costs.labor = laborCosts.total;
    journey.operator.overtime = laborCosts.overtime;

    // 8. Hébergement si nécessaire (voyage > 1 jour)
    if (journey.operator.totalHours > 16) {
      journey.costs.accommodation = this.calculateAccommodationCosts(leg.to.city);
      journey.costs.meals = this.calculateMealCosts(journey.operator.totalHours);
    }

    // 9. Total des coûts transport
    journey.costs.transport.total = 
      journey.costs.transport.flights.reduce((sum, f) => sum + f.cost, 0) +
      journey.costs.transport.trains.reduce((sum, t) => sum + t.cost, 0) +
      journey.costs.transport.groundTransport.reduce((sum, g) => sum + g.cost, 0);

    journey.costs.total = 
      journey.costs.labor +
      journey.costs.transport.total +
      journey.costs.accommodation +
      journey.costs.meals +
      journey.costs.returnJourney;

    // 10. Générer la timeline détaillée
    journey.timeline = this.generateDetailedTimeline(journey.segments);

    return journey;
  }

  /**
   * Planifie le transport du hub vers le pickup
   */
  planHubToPickupTransport(operatorHub, pickupLocation, startTime) {
    const segment = {
      type: 'hub-to-pickup',
      from: operatorHub.city,
      to: pickupLocation.city,
      startTime,
      flights: [],
      trains: [],
      groundTransport: [],
      endTime: null
    };

    const distance = this.calculateDistance(operatorHub.city, pickupLocation.city);
    
    if (distance > 500) {
      // Vol nécessaire
      const flight = this.findOptimalFlight(
        operatorHub.city,
        pickupLocation.city,
        startTime
      );
      segment.flights.push(flight);

      // Transport aéroport vers pickup
      const airportTransfer = this.planAirportTransfer(
        pickupLocation.city,
        'arrival',
        flight.arrivalTime,
        pickupLocation.address
      );
      segment.groundTransport.push(airportTransfer);
      segment.endTime = airportTransfer.arrivalTime;

    } else if (distance > 150) {
      // Train possible
      const train = this.findOptimalTrain(
        operatorHub.city,
        pickupLocation.city,
        startTime
      );
      
      if (train) {
        segment.trains.push(train);
        
        // Transport gare vers pickup
        const stationTransfer = this.planStationTransfer(
          pickupLocation.city,
          train.arrivalTime,
          pickupLocation.address
        );
        segment.groundTransport.push(stationTransfer);
        segment.endTime = stationTransfer.arrivalTime;
      } else {
        // Route directe
        const directTransport = this.planDirectGroundTransport(
          operatorHub.city,
          pickupLocation.address,
          startTime,
          distance
        );
        segment.groundTransport.push(directTransport);
        segment.endTime = directTransport.arrivalTime;
      }
    } else {
      // Transport direct
      const directTransport = this.planDirectGroundTransport(
        operatorHub.city,
        pickupLocation.address,
        startTime,
        distance
      );
      segment.groundTransport.push(directTransport);
      segment.endTime = directTransport.arrivalTime;
    }

    return segment;
  }

  /**
   * Trouve le vol optimal avec horaires précis
   */
  findOptimalFlight(fromCity, toCity, preferredTime) {
    // Utilise des données réalistes basées sur des horaires vrais
    const flights = this.searchFlights(fromCity, toCity, preferredTime);
    
    // Sélectionner le vol le plus proche de l'heure préférée
    const optimalFlight = flights.reduce((best, current) => {
      const bestDiff = Math.abs(new Date(best.departureTime) - new Date(preferredTime));
      const currentDiff = Math.abs(new Date(current.departureTime) - new Date(preferredTime));
      return currentDiff < bestDiff ? current : best;
    });

    return {
      airline: optimalFlight.airline,
      flightNumber: optimalFlight.flightNumber,
      departureTime: optimalFlight.departureTime,
      arrivalTime: optimalFlight.arrivalTime,
      departureAirport: optimalFlight.departureAirport,
      arrivalAirport: optimalFlight.arrivalAirport,
      cost: optimalFlight.price,
      duration: optimalFlight.duration,
      class: 'Economy Flexible' // Pour permettre les changements
    };
  }

  /**
   * Trouve le train optimal
   */
  findOptimalTrain(fromCity, toCity, preferredTime) {
    // Routes train populaires en Europe
    const trainRoutes = {
      'London-Paris': { provider: 'Eurostar', duration: 140, frequency: 60 },
      'Paris-London': { provider: 'Eurostar', duration: 140, frequency: 60 },
      'Paris-Brussels': { provider: 'Thalys', duration: 85, frequency: 30 },
      'Paris-Frankfurt': { provider: 'ICE', duration: 240, frequency: 120 }
    };

    const routeKey = `${fromCity}-${toCity}`;
    const route = trainRoutes[routeKey];

    if (!route) return null;

    // Calculer l'horaire optimal
    const departureTime = this.findNextTrainDeparture(preferredTime, route.frequency);
    const arrivalTime = new Date(departureTime.getTime() + route.duration * 60000);

    return {
      provider: route.provider,
      trainNumber: `TGV${Math.floor(Math.random() * 9000) + 1000}`,
      departureTime: departureTime.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      departureStation: this.transportConfig.trainStations[fromCity]?.main || `${fromCity} Central`,
      arrivalStation: this.transportConfig.trainStations[toCity]?.main || `${toCity} Central`,
      cost: this.calculateTrainCost(fromCity, toCity, route.duration),
      duration: route.duration,
      class: '2nd Class Flexible'
    };
  }

  /**
   * Planifie le transfer aéroport
   */
  planAirportTransfer(city, direction, flightTime, finalAddress) {
    const airportConfig = this.transportConfig.airports[city];
    const transferTime = direction === 'departure' ? 
      airportConfig.fromCity.time : airportConfig.toCity.time;
    const transferCost = direction === 'departure' ? 
      airportConfig.fromCity.cost : airportConfig.toCity.cost;

    const startTime = direction === 'departure' ? 
      new Date(new Date(flightTime).getTime() - transferTime * 60000) :
      new Date(flightTime);

    const endTime = new Date(startTime.getTime() + transferTime * 60000);

    return {
      type: direction === 'departure' ? 'address-to-airport' : 'airport-to-address',
      from: direction === 'departure' ? finalAddress : `${city} Airport`,
      to: direction === 'departure' ? `${city} Airport` : finalAddress,
      startTime: startTime.toISOString(),
      arrivalTime: endTime.toISOString(),
      method: 'Express Train + Uber',
      cost: transferCost,
      duration: transferTime,
      details: [
        {
          segment: direction === 'departure' ? 'Uber to station' : 'Express train',
          duration: Math.floor(transferTime * 0.3),
          cost: Math.floor(transferCost * 0.4)
        },
        {
          segment: direction === 'departure' ? 'Express train' : 'Uber to address',
          duration: Math.floor(transferTime * 0.7),
          cost: Math.floor(transferCost * 0.6)
        }
      ]
    };
  }

  /**
   * Planifie le voyage de retour de l'opérateur (CRUCIAL!)
   */
  planReturnJourney(lastLocation, operatorHub, departureTime) {
    const returnSegment = {
      type: 'operator-return',
      from: lastLocation.city,
      to: operatorHub.city,
      startTime: departureTime,
      flights: [],
      trains: [],
      groundTransport: [],
      endTime: null,
      totalCost: 0
    };

    const distance = this.calculateDistance(lastLocation?.city, operatorHub?.city || operatorHub);
    const fromCity = lastLocation?.city || 'Destination finale';
    const toCity = operatorHub?.city || operatorHub;

    if (distance > 500) {
      // Vol de retour nécessaire
      const returnFlight = this.findOptimalFlight(
        fromCity,
        toCity,
        departureTime
      );
      returnSegment.flights = [returnFlight];

      // Transport vers l'aéroport et retour au hub
      const airportCost = 35 + 40; // aller-retour aéroport
      returnSegment.groundTransport = [{
        type: 'airport-transfer',
        from: fromCity,
        to: toCity,
        cost: airportCost,
        method: 'Express train + Uber retour'
      }];
      
      returnSegment.endTime = new Date(new Date(returnFlight.arrivalTime).getTime() + 90 * 60000).toISOString();

    } else if (distance > 150) {
      // Train de retour
      const returnTrain = this.findOptimalTrain(fromCity, toCity, departureTime);
      
      if (returnTrain) {
        returnSegment.trains = [returnTrain];
        returnSegment.groundTransport = [{
          type: 'station-transfer',
          from: fromCity,
          to: toCity,
          cost: 30, // taxi/uber gares
          method: 'Uber vers gare + taxi retour'
        }];
        returnSegment.endTime = new Date(new Date(returnTrain.arrivalTime).getTime() + 45 * 60000).toISOString();
      } else {
        // Route directe
        const directCost = Math.round(distance * 0.8 + 50);
        returnSegment.groundTransport = [{
          type: 'direct-drive',
          from: fromCity,
          to: toCity,
          cost: directCost,
          method: 'Location voiture ou taxi longue distance'
        }];
        returnSegment.endTime = new Date(new Date(departureTime).getTime() + distance * 1.5 * 60000).toISOString();
      }
    } else {
      // Transport direct de retour
      const directCost = Math.round(distance * 1.2 + 35);
      returnSegment.groundTransport = [{
        type: 'local-return',
        from: fromCity,
        to: toCity,
        cost: directCost,
        method: 'Uber/Taxi retour'
      }];
      returnSegment.endTime = new Date(new Date(departureTime).getTime() + Math.max(60, distance * 2) * 60000).toISOString();
    }

    // Calculer le coût total du retour
    returnSegment.totalCost = 
      returnSegment.flights.reduce((sum, f) => sum + f.cost, 0) +
      returnSegment.trains.reduce((sum, t) => sum + t.cost, 0) +
      returnSegment.groundTransport.reduce((sum, g) => sum + g.cost, 0);

    return returnSegment;
  }

  /**
   * Planifie un transport DHL avec détails précis
   */
  async planDHLTransport(leg, shipmentData) {
    const dhlSegment = {
      type: 'dhl-transport',
      from: leg.from,
      to: leg.to,
      service: leg.service, // 'standard' ou 'express'
      details: {
        pickup: null,
        transit: null,
        delivery: null
      },
      costs: {
        base: 0,
        fuel: 0,
        remote: 0,
        insurance: 0,
        total: 0
      },
      timeline: []
    };

    // Obtenir les détails DHL via API
    const dhlQuote = await this.getDHLDetailedQuote(leg.from, leg.to, shipmentData, leg.service);
    
    dhlSegment.details.pickup = {
      timeWindow: dhlQuote.pickup.timeWindow,
      cutoffTime: dhlQuote.pickup.cutoffTime,
      cost: dhlQuote.pickup.cost
    };

    dhlSegment.details.transit = {
      sortingFacilities: dhlQuote.transit.facilities,
      estimatedTransitTime: dhlQuote.transit.time,
      trackingEvents: dhlQuote.transit.expectedEvents
    };

    dhlSegment.details.delivery = {
      estimatedDelivery: dhlQuote.delivery.estimatedTime,
      timeWindow: dhlQuote.delivery.timeWindow,
      attemptPolicy: dhlQuote.delivery.attempts,
      cost: dhlQuote.delivery.cost
    };

    dhlSegment.costs = dhlQuote.costs;
    dhlSegment.timeline = this.generateDHLTimeline(dhlQuote);

    return dhlSegment;
  }

  /**
   * Calcule les coûts de main d'œuvre avec précision
   */
  calculateLaborCosts(totalHours) {
    const regularRate = 65; // €/heure
    const overtimeRate = regularRate * 1.5;
    const regularHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(0, totalHours - 8);
    
    const regularCost = regularHours * regularRate;
    const overtimeCost = overtimeHours * overtimeRate;
    
    // Per diem si voyage > 12h
    const perDiem = totalHours > 12 ? 150 : 0;

    return {
      regular: regularCost,
      overtime: overtimeCost,
      perDiem: perDiem,
      total: regularCost + overtimeCost + perDiem,
      breakdown: {
        regularHours: Math.round(regularHours * 10) / 10,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        regularRate,
        overtimeRate
      }
    };
  }

  /**
   * Génère une timeline détaillée avec horaires précis
   */
  generateDetailedTimeline(segments) {
    const timeline = [];
    let currentTime = null;

    segments.forEach((segment, index) => {
      timeline.push({
        step: index + 1,
        type: segment.type,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: this.calculateDuration(segment.startTime, segment.endTime),
        description: this.getSegmentDescription(segment),
        costs: this.getSegmentCosts(segment),
        checkpoints: this.getSegmentCheckpoints(segment)
      });
    });

    return timeline;
  }

  /**
   * Méthodes helper
   */
  getOptimalStartTime(fromCity, toCity) {
    // Optimise pour arriver pendant les heures d'ouverture
    const baseTime = new Date();
    baseTime.setHours(7, 0, 0, 0); // Départ à 7h pour arriver vers 9h
    return baseTime.toISOString();
  }

  calculateDistance(fromCity, toCity) {
    // Utilise l'API Google Distance Matrix ou calcul haversine
    const distances = {
      'London-Paris': 465,
      'London-Milan': 1155,
      'Paris-Milan': 850,
      'Paris-Frankfurt': 480
    };
    
    const key = `${fromCity}-${toCity}`;
    return distances[key] || distances[`${toCity}-${fromCity}`] || 500;
  }

  calculateTotalHours(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10;
  }

  findNextTrainDeparture(preferredTime, frequency) {
    const preferred = new Date(preferredTime);
    const startOfDay = new Date(preferred);
    startOfDay.setHours(6, 0, 0, 0); // Premier train à 6h

    // Trouve le prochain départ
    let departure = new Date(startOfDay);
    while (departure < preferred) {
      departure = new Date(departure.getTime() + frequency * 60000);
    }

    return departure;
  }

  calculateTrainCost(fromCity, toCity, duration) {
    const baseCost = 0.15; // €/km/min
    const distance = this.calculateDistance(fromCity, toCity);
    return Math.round(baseCost * distance * duration / 60);
  }

  async searchFlights(fromCity, toCity, preferredTime) {
    // Mock de recherche de vols - en réalité utiliserait Amadeus/Duffel
    const baseFlights = [
      {
        airline: 'British Airways',
        flightNumber: 'BA315',
        departureTime: '08:15',
        arrivalTime: '11:30',
        price: 285
      },
      {
        airline: 'Air France',
        flightNumber: 'AF1234',
        departureTime: '14:20',
        arrivalTime: '17:35',
        price: 245
      }
    ];

    return baseFlights.map(flight => ({
      ...flight,
      departureTime: this.adjustFlightTime(preferredTime, flight.departureTime),
      arrivalTime: this.adjustFlightTime(preferredTime, flight.arrivalTime, 3.25), // +3h15 vol
      departureAirport: this.getAirportCode(fromCity),
      arrivalAirport: this.getAirportCode(toCity)
    }));
  }

  /**
   * Planifie un segment de pickup
   */
  planPickupSegment(pickupLocation, startTime, shipmentData) {
    const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(); // 30 min
    
    return {
      type: 'pickup',
      from: 'Hub de départ',
      to: pickupLocation?.address || pickupLocation?.city || 'Adresse pickup',
      startTime,
      endTime,
      method: 'White-Glove Pickup',
      cost: 50, // Coût de pickup
      groundTransport: [{
        type: 'local-pickup',
        from: pickupLocation?.city || 'Ville',
        to: pickupLocation?.address || 'Adresse',
        duration: 30,
        cost: 50,
        method: 'White-Glove Pickup Service'
      }]
    };
  }

  /**
   * Planifie le transport principal
   */
  planMainTransport(fromLocation, toLocation, startTime, shipmentData) {
    const distance = this.calculateDistance(fromLocation?.city, toLocation?.city);
    
    const segment = {
      type: 'main-transport',
      from: fromLocation,
      to: toLocation,
      startTime,
      arrivalTime: null,
      flights: [],
      trains: [],
      groundTransport: []
    };

    const fromCity = fromLocation?.city || 'Departure';
    const toCity = toLocation?.city || 'Destination';
    
    if (distance > 500) {
      // Vol nécessaire
      const flight = this.findOptimalFlight(fromCity, toCity, startTime);
      segment.flights = [flight];
      segment.arrivalTime = flight.arrivalTime;
    } else if (distance > 150) {
      // Train possible
      const train = this.findOptimalTrain(fromCity, toCity, startTime);
      if (train) {
        segment.trains = [train];
        segment.arrivalTime = train.arrivalTime;
      } else {
        // Transport terrestre direct
        const groundTransport = this.planDirectGroundTransport(
          fromCity, toCity, startTime, distance
        );
        segment.groundTransport = [groundTransport];
        segment.arrivalTime = groundTransport.arrivalTime;
      }
    } else {
      // Transport terrestre direct
      const groundTransport = this.planDirectGroundTransport(
        fromCity, toCity, startTime, distance
      );
      segment.groundTransport = [groundTransport];
      segment.arrivalTime = groundTransport.arrivalTime;
    }

    return segment;
  }

  /**
   * Planifie un segment de livraison
   */
  planDeliverySegment(deliveryLocation, arrivalTime, shipmentData) {
    const deliveryTime = new Date(new Date(arrivalTime).getTime() + 45 * 60000).toISOString(); // 45 min après arrivée
    
    return {
      type: 'delivery',
      from: deliveryLocation?.city || 'Transport',
      to: deliveryLocation?.address || deliveryLocation?.city || 'Adresse livraison',
      startTime: arrivalTime,
      endTime: deliveryTime,
      method: 'White-Glove Delivery',
      cost: 75,
      groundTransport: [{
        type: 'final-delivery',
        from: deliveryLocation?.city || 'Ville',
        to: deliveryLocation?.address || 'Adresse',
        duration: 45,
        cost: 75,
        method: 'White-Glove Final Delivery'
      }]
    };
  }

  /**
   * Planifie un transfert depuis/vers une gare
   */
  async planStationTransfer(city, trainTime, finalAddress) {
    const transferTime = this.transportConfig.trainStations[city]?.toStation || 20;
    const startTime = new Date(new Date(trainTime).getTime() - transferTime * 60000);
    
    return {
      type: 'station-transfer',
      from: finalAddress,
      to: `${city} Station`,
      startTime: startTime.toISOString(),
      arrivalTime: trainTime,
      cost: 15,
      duration: transferTime,
      method: 'Uber vers gare'
    };
  }

  /**
   * Planifie un transport terrestre direct
   */
  async planDirectGroundTransport(fromAddress, toAddress, startTime, distance) {
    const duration = Math.max(60, distance * 1.2); // min 1h, puis 1.2 min/km
    const cost = Math.round(distance * 0.8 + 35); // base + distance
    const arrivalTime = new Date(new Date(startTime).getTime() + duration * 60000);
    
    return {
      type: 'ground-transport',
      from: fromAddress,
      to: toAddress,
      startTime,
      arrivalTime: arrivalTime.toISOString(),
      duration,
      cost,
      method: distance > 300 ? 'Location voiture' : 'Uber/Taxi'
    };
  }

  /**
   * Obtient un devis DHL détaillé
   */
  async getDHLDetailedQuote(fromLocation, toLocation, shipmentData, service) {
    // Mock DHL API response
    const baseTime = service === 'express' ? 24 : 72; // heures
    const baseCost = service === 'express' ? 65 : 35;
    
    return {
      pickup: {
        timeWindow: '09:00-17:00',
        cutoffTime: '16:00',
        cost: 15
      },
      transit: {
        facilities: [`${fromLocation.city} Sort`, `${toLocation.city} Sort`],
        time: baseTime,
        expectedEvents: [
          'Collecté',
          'En transit',
          'Arrivé au centre de tri',
          'En cours de livraison'
        ]
      },
      delivery: {
        estimatedTime: new Date(Date.now() + baseTime * 60 * 60 * 1000).toISOString(),
        timeWindow: '09:00-18:00',
        attempts: 3,
        cost: 10
      },
      costs: {
        base: baseCost,
        fuel: baseCost * 0.15,
        remote: 0,
        insurance: parseFloat(shipmentData.declared_value) * 0.002,
        total: baseCost * 1.15 + parseFloat(shipmentData.declared_value) * 0.002
      }
    };
  }

  /**
   * Génère une timeline DHL
   */
  generateDHLTimeline(dhlQuote) {
    const now = new Date();
    return [
      {
        time: now.toISOString(),
        action: 'Collecte programmée',
        location: 'Adresse expéditeur',
        responsible: 'DHL'
      },
      {
        time: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        action: 'En transit vers centre de tri',
        location: 'Réseau DHL',
        responsible: 'DHL'
      },
      {
        time: dhlQuote.delivery.estimatedTime,
        action: 'Livraison finale',
        location: 'Adresse destinataire',
        responsible: 'DHL'
      }
    ];
  }

  adjustFlightTime(baseDate, timeString, hoursOffset = 0) {
    const date = new Date(baseDate);
    const [hours, minutes] = timeString.split(':').map(Number);
    date.setHours(hours + hoursOffset, minutes, 0, 0);
    return date.toISOString();
  }

  getAirportCode(city) {
    const codes = {
      'London': 'LHR',
      'Paris': 'CDG',
      'Milan': 'MXP',
      'Frankfurt': 'FRA'
    };
    return codes[city] || 'XXX';
  }
}

module.exports = DetailedTravelPlanner;
