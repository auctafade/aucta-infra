// lib/sprint8/routeMapGenerator.js
// Route Map Generator - Auto-generates PDF/HTML ops manifest for Lina

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class RouteMapGenerator extends EventEmitter {
  constructor() {
    super();
    this.outputDir = path.join(__dirname, '../../uploads/manifests');
    this.ensureOutputDirectory();
  }

  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }

  /**
   * Auto-generate route map on selection
   * 
   * @param {Object} selectionResult - Complete route selection result
   * @returns {Object} Generated route map details
   */
  async generateRouteMap(selectionResult) {
    const { shipmentId, selectedRoute, provisionalLegs, hubReservations, inventoryHolds } = selectionResult;
    
    console.log(`🗺️  Generating route map for shipment ${shipmentId}`);
    
    try {
      // 1. Gather all required data
      const mapData = await this.gatherMapData(selectionResult);
      
      // 2. Generate HTML version (always)
      const htmlPath = await this.generateHTMLMap(mapData);
      
      // 3. Generate PDF version (optional, requires puppeteer)
      const pdfPath = await this.generatePDFMap(mapData);
      
      // 4. Log generation event
      this.emit('route_map.generated', {
        shipmentId,
        routeId: selectedRoute.id,
        htmlPath,
        pdfPath,
        generatedAt: new Date().toISOString(),
        mapData: {
          legs: provisionalLegs.length,
          hubReservations: hubReservations.length,
          inventoryHolds: inventoryHolds.length,
          totalCost: selectedRoute.totalCost
        }
      });
      
      console.log(`✅ Route map generated: ${htmlPath}`);
      
      return {
        shipmentId,
        htmlPath,
        pdfPath,
        downloadUrl: `/api/shipments/${shipmentId}/route-map`,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Route map generation failed:', error);
      throw error;
    }
  }

  /**
   * Gather all data needed for route map
   */
  async gatherMapData(selectionResult) {
    const { shipmentId, selectedRoute, provisionalLegs, hubReservations, inventoryHolds } = selectionResult;
    
    // Get additional shipment details (would come from database)
    const shipmentDetails = await this.getShipmentDetails(shipmentId);
    
    return {
      // Shipment header
      shipment: {
        id: shipmentId,
        tier: `Tier ${selectedRoute.tier}`,
        value: selectedRoute.totalCost,
        currency: selectedRoute.currency || 'EUR',
        dimensions: shipmentDetails.dimensions || { length: 0, width: 0, height: 0, weight: 0 },
        slaDate: selectedRoute.estimatedDelivery,
        fragility: shipmentDetails.fragility || 'medium',
        sender: shipmentDetails.sender || {},
        buyer: shipmentDetails.buyer || {}
      },
      
      // Chosen hubs
      hubs: {
        hubId: selectedRoute.hubId,
        hubCou: selectedRoute.hubCou
      },
      
      // Step-by-step itinerary
      itinerary: this.buildDetailedItinerary(provisionalLegs, hubReservations),
      
      // Cost breakdown
      costs: this.buildCostBreakdown(selectedRoute, provisionalLegs),
      
      // Checklists
      checklists: this.generateChecklists(selectedRoute.tier, provisionalLegs),
      
      // Risk flags and backup
      risks: selectedRoute.slaValidation?.risks || [],
      backup: this.generateBackupOption(selectedRoute),
      
      // Generation metadata
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'Route Planning System',
        version: '1.0'
      }
    };
  }

  /**
   * Build detailed itinerary with times, addresses, contacts
   */
  buildDetailedItinerary(provisionalLegs, hubReservations) {
    const itinerary = [];
    
    // Process each provisional leg
    provisionalLegs.forEach((leg, index) => {
      const step = {
        order: leg.legOrder,
        type: leg.legType,
        carrier: leg.carrier,
        
        // Timing
        departure: {
          local: this.formatDateTime(leg.plannedDeparture, 'local'),
          utc: this.formatDateTime(leg.plannedDeparture, 'utc'),
          timestamp: leg.plannedDeparture
        },
        arrival: {
          local: this.formatDateTime(leg.plannedArrival, 'local'),
          utc: this.formatDateTime(leg.plannedArrival, 'utc'),
          timestamp: leg.plannedArrival
        },
        
        // Locations
        from: {
          address: leg.fromLocation,
          type: leg.fromType,
          contact: this.getLocationContact(leg.fromType, leg.hubCode),
          coordinates: this.getLocationCoordinates(leg.fromLocation)
        },
        to: {
          address: leg.toLocation,
          type: leg.toType,
          contact: this.getLocationContact(leg.toType, leg.hubCode),
          coordinates: this.getLocationCoordinates(leg.toLocation)
        },
        
        // Operational details
        cost: leg.frozenCost,
        currency: leg.currency,
        distance: leg.distance,
        duration: leg.duration,
        
        // Evidence required
        evidence: this.getRequiredEvidence(leg.legType, leg.processing),
        
        // OTP placeholders
        otp: {
          pickup: this.generateOTPPlaceholder(),
          delivery: this.generateOTPPlaceholder()
        },
        
        // Special instructions
        instructions: this.getStepInstructions(leg),
        
        // Buffer time
        bufferTime: leg.bufferTime
      };
      
      itinerary.push(step);
    });
    
    // Add hub processing steps
    hubReservations.forEach(reservation => {
      const processStep = {
        order: 100 + hubReservations.indexOf(reservation), // After transport legs
        type: 'hub-processing',
        carrier: 'hub-operations',
        
        // Timing
        departure: {
          local: this.formatDateTime(reservation.plannedStartTime, 'local'),
          utc: this.formatDateTime(reservation.plannedStartTime, 'utc'),
          timestamp: reservation.plannedStartTime
        },
        arrival: {
          local: this.formatDateTime(reservation.plannedEndTime, 'local'),
          utc: this.formatDateTime(reservation.plannedEndTime, 'utc'),
          timestamp: reservation.plannedEndTime
        },
        
        // Location (hub)
        location: {
          hub: reservation.hubCode,
          serviceType: reservation.serviceType,
          contact: this.getHubContact(reservation.hubCode)
        },
        
        // Processing details
        cost: reservation.frozenCost,
        currency: reservation.currency,
        duration: reservation.duration,
        capacityUnits: reservation.capacityUnits,
        
        // Evidence required for processing
        evidence: this.getProcessingEvidence(reservation.serviceType),
        
        // Processing instructions
        instructions: this.getProcessingInstructions(reservation.serviceType, reservation.tier)
      };
      
      itinerary.push(processStep);
    });
    
    // Sort by order and timing
    itinerary.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return new Date(a.departure.timestamp) - new Date(b.departure.timestamp);
    });
    
    return itinerary;
  }

  /**
   * Build comprehensive cost breakdown
   */
  buildCostBreakdown(selectedRoute, provisionalLegs) {
    const breakdown = {
      legs: provisionalLegs.map(leg => ({
        order: leg.legOrder,
        description: `${leg.carrier} ${leg.fromLocation} → ${leg.toLocation}`,
        cost: leg.frozenCost,
        currency: leg.currency
      })),
      
      summary: {
        labor: selectedRoute.detailedCosts?.labor || 0,
        transport: selectedRoute.detailedCosts?.transport || 0,
        hubFees: selectedRoute.detailedCosts?.hubFees || 0,
        inventory: selectedRoute.detailedCosts?.inventory || 0,
        insurance: selectedRoute.detailedCosts?.insurance || 0,
        surcharges: selectedRoute.detailedCosts?.surcharges || 0
      },
      
      total: selectedRoute.totalCost,
      clientPrice: selectedRoute.clientPrice,
      currency: selectedRoute.currency,
      
      // DHL links (if any)
      dhlLinks: this.extractDHLLinks(provisionalLegs)
    };
    
    // Verify totals match
    const calculatedTotal = Object.values(breakdown.summary).reduce((sum, cost) => sum + cost, 0);
    breakdown.verification = {
      calculated: calculatedTotal,
      stored: selectedRoute.totalCost,
      matches: Math.abs(calculatedTotal - selectedRoute.totalCost) < 0.01
    };
    
    return breakdown;
  }

  /**
   * Generate operational checklists
   */
  generateChecklists(tier, provisionalLegs) {
    const hasWGLegs = provisionalLegs.some(leg => leg.legType === 'white-glove');
    const hasDHLLegs = provisionalLegs.some(leg => leg.legType === 'dhl');
    
    return {
      pickup: {
        title: 'Pickup Checklist',
        items: [
          '📦 Verify item condition and packaging',
          '📄 Collect necessary documentation',
          '📸 Take pickup photos (item + location)',
          '🔐 Apply security seal if required',
          '📱 Record pickup OTP',
          '⏰ Confirm pickup time and signature',
          '📋 Update shipment status to "picked-up"'
        ],
        required: hasWGLegs
      },
      
      intake: {
        title: 'Hub Intake Checklist',
        items: [
          '🔍 Inspect security seal integrity',
          '📦 Verify item condition vs documentation',
          '📸 Take intake photos (all angles)',
          '⚖️ Confirm weight and dimensions',
          '📋 Log intake in hub system',
          '🏷️ Apply hub tracking label',
          '📍 Assign storage location'
        ],
        required: true
      },
      
      authentication: {
        title: 'Authentication Checklist',
        items: [
          '🔍 Perform visual inspection',
          '📸 Take detailed authentication photos',
          '🔬 Conduct material/craftsmanship analysis',
          '📝 Complete authentication certificate',
          '💾 Update authentication status',
          tier === 3 ? '📟 Apply NFC tag' : '🏷️ Apply authentication tag',
          '✅ Mark authentication complete'
        ],
        required: true
      },
      
      sewing: {
        title: 'Sewing Checklist',
        items: [
          '🧵 Prepare sewing station and materials',
          '📐 Mark sewing location precisely',
          '📸 Take pre-sewing photos',
          '🪡 Execute sewing according to specifications',
          '📸 Take post-sewing photos',
          '🔍 Quality check sewing integrity',
          '✅ Mark sewing complete'
        ],
        required: tier === 3
      },
      
      qa: {
        title: 'Quality Assurance Checklist',
        items: [
          '🔍 Final visual inspection',
          '📸 Take final QA photos',
          '📋 Verify all processing completed',
          '📄 Review documentation completeness',
          '✅ Sign off on quality approval',
          '📦 Prepare for outbound processing',
          '📍 Update status to "qa-complete"'
        ],
        required: true
      },
      
      delivery: {
        title: 'Delivery & PoD Checklist',
        items: [
          '📍 Confirm delivery address and contact',
          '📸 Take pre-delivery photos',
          '📦 Verify item condition before handover',
          '🆔 Verify recipient identity',
          '📱 Record delivery OTP',
          '✍️ Obtain signature (Proof of Delivery)',
          '📸 Take delivery confirmation photos',
          '✅ Update status to "delivered"'
        ],
        required: hasWGLegs || hasDHLLegs
      }
    };
  }

  /**
   * Generate HTML route map
   */
  async generateHTMLMap(mapData) {
    const template = await this.getHTMLTemplate();
    const html = this.populateTemplate(template, mapData);
    
    const filename = `route-map-${mapData.shipment.id}-${Date.now()}.html`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, html, 'utf8');
    
    return filepath;
  }

  /**
   * Generate PDF route map (requires puppeteer)
   */
  async generatePDFMap(mapData) {
    try {
      // Only attempt PDF generation if puppeteer is available
      const puppeteer = require('puppeteer');
      
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      const template = await this.getPDFTemplate();
      const html = this.populateTemplate(template, mapData);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const filename = `route-map-${mapData.shipment.id}-${Date.now()}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
      });
      
      await browser.close();
      
      return filepath;
      
    } catch (error) {
      console.warn('PDF generation not available:', error.message);
      return null; // HTML only
    }
  }

  /**
   * Get HTML template for route map
   */
  async getHTMLTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Route Map - {{shipment.id}}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .header h1 { color: #1e40af; font-size: 28px; margin-bottom: 10px; }
        .header-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
        .header-item { padding: 15px; background: #f1f5f9; border-radius: 8px; }
        .header-item strong { color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .header-item div { font-size: 18px; font-weight: 600; margin-top: 5px; }
        .section { background: white; margin-bottom: 20px; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .section-header { background: #1e40af; color: white; padding: 20px; font-size: 20px; font-weight: 600; }
        .section-content { padding: 20px; }
        .itinerary-step { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
        .step-header { background: #f8fafc; padding: 15px; border-bottom: 1px solid #e2e8f0; }
        .step-content { padding: 15px; }
        .step-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .time-box { background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; }
        .cost-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .cost-table th, .cost-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .cost-table th { background: #f8fafc; font-weight: 600; }
        .cost-total { background: #1e40af; color: white; font-weight: bold; }
        .checklist { margin-bottom: 20px; }
        .checklist h4 { color: #1e40af; margin-bottom: 10px; }
        .checklist ul { list-style: none; }
        .checklist li { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .risk-flag { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; margin: 10px 0; color: #dc2626; }
        .backup-option { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px; margin: 10px 0; }
        .generated-info { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; padding: 20px; }
        @media print { body { background: white; } .container { max-width: none; padding: 0; } }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header Section -->
        <div class="header">
            <h1>🗺️ Route Map - {{shipment.id}}</h1>
            <p><strong>{{shipment.tier}} Shipment</strong> • Generated {{metadata.generatedAt}}</p>
            
            <div class="header-grid">
                <div class="header-item">
                    <strong>Shipment Value</strong>
                    <div>{{costs.clientPrice}} {{costs.currency}}</div>
                </div>
                <div class="header-item">
                    <strong>Estimated Delivery</strong>
                    <div>{{shipment.slaDate}}</div>
                </div>
                <div class="header-item">
                    <strong>Route Type</strong>
                    <div>{{selectedRoute.label}}</div>
                </div>
                <div class="header-item">
                    <strong>Hubs</strong>
                    <div>{{hubs.hubId.hubCode}} → {{hubs.hubCou.hubCode}}</div>
                </div>
            </div>
        </div>

        <!-- Itinerary Section -->
        <div class="section">
            <div class="section-header">📋 Step-by-Step Itinerary</div>
            <div class="section-content">
                {{#each itinerary}}
                <div class="itinerary-step">
                    <div class="step-header">
                        <strong>Step {{order}}: {{type}} ({{carrier}})</strong>
                    </div>
                    <div class="step-content">
                        <div class="step-grid">
                            <div>
                                <strong>Departure</strong>
                                <div class="time-box">
                                    <div>Local: {{departure.local}}</div>
                                    <div>UTC: {{departure.utc}}</div>
                                </div>
                            </div>
                            <div>
                                <strong>Arrival</strong>
                                <div class="time-box">
                                    <div>Local: {{arrival.local}}</div>
                                    <div>UTC: {{arrival.utc}}</div>
                                </div>
                            </div>
                            <div>
                                <strong>From</strong>
                                <div>{{from.address}}</div>
                                <div>Contact: {{from.contact}}</div>
                            </div>
                            <div>
                                <strong>To</strong>
                                <div>{{to.address}}</div>
                                <div>Contact: {{to.contact}}</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <strong>Evidence Required:</strong> {{evidence}}
                        </div>
                        <div>
                            <strong>OTP Placeholders:</strong> Pickup: {{otp.pickup}} | Delivery: {{otp.delivery}}
                        </div>
                        <div>
                            <strong>Instructions:</strong> {{instructions}}
                        </div>
                    </div>
                </div>
                {{/each}}
            </div>
        </div>

        <!-- Cost Breakdown Section -->
        <div class="section">
            <div class="section-header">💰 Cost Breakdown</div>
            <div class="section-content">
                <table class="cost-table">
                    <thead>
                        <tr>
                            <th>Component</th>
                            <th>Amount</th>
                            <th>Currency</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Labor Costs</td><td>{{costs.summary.labor}}</td><td>{{costs.currency}}</td></tr>
                        <tr><td>Transport</td><td>{{costs.summary.transport}}</td><td>{{costs.currency}}</td></tr>
                        <tr><td>Hub Fees</td><td>{{costs.summary.hubFees}}</td><td>{{costs.currency}}</td></tr>
                        <tr><td>Inventory</td><td>{{costs.summary.inventory}}</td><td>{{costs.currency}}</td></tr>
                        <tr><td>Insurance</td><td>{{costs.summary.insurance}}</td><td>{{costs.currency}}</td></tr>
                        <tr><td>Surcharges</td><td>{{costs.summary.surcharges}}</td><td>{{costs.currency}}</td></tr>
                        <tr class="cost-total"><td><strong>Total</strong></td><td><strong>{{costs.total}}</strong></td><td><strong>{{costs.currency}}</strong></td></tr>
                        <tr class="cost-total"><td><strong>Client Price</strong></td><td><strong>{{costs.clientPrice}}</strong></td><td><strong>{{costs.currency}}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Checklists Section -->
        <div class="section">
            <div class="section-header">✅ Operational Checklists</div>
            <div class="section-content">
                {{#each checklists}}
                {{#if required}}
                <div class="checklist">
                    <h4>{{title}}</h4>
                    <ul>
                        {{#each items}}
                        <li>{{this}}</li>
                        {{/each}}
                    </ul>
                </div>
                {{/if}}
                {{/each}}
            </div>
        </div>

        <!-- Risk Flags & Backup -->
        {{#if risks}}
        <div class="section">
            <div class="section-header">⚠️ Risk Flags & Backup</div>
            <div class="section-content">
                {{#each risks}}
                <div class="risk-flag">
                    <strong>{{type}}:</strong> {{message}}
                </div>
                {{/each}}
                
                {{#if backup}}
                <div class="backup-option">
                    <strong>Backup Option:</strong> {{backup.description}}
                </div>
                {{/if}}
            </div>
        </div>
        {{/if}}

        <div class="generated-info">
            Generated by {{metadata.generatedBy}} on {{metadata.generatedAt}} | Version {{metadata.version}}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get PDF-optimized template
   */
  async getPDFTemplate() {
    // PDF template would have better print styling
    return this.getHTMLTemplate(); // For now, use same template
  }

  /**
   * Populate template with data using simple substitution
   */
  populateTemplate(template, data) {
    let html = template;
    
    // Simple template substitution (in production, use a proper template engine)
    const flattenData = (obj, prefix = '') => {
      const flattened = {};
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(flattened, flattenData(obj[key], `${prefix}${key}.`));
        } else {
          flattened[`${prefix}${key}`] = obj[key];
        }
      }
      return flattened;
    };
    
    const flatData = flattenData(data);
    
    // Replace simple placeholders
    for (const [key, value] of Object.entries(flatData)) {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
    }
    
    // Handle arrays (simplified)
    html = html.replace(/{{#each itinerary}}.*?{{\/each}}/gs, this.renderItinerary(data.itinerary));
    html = html.replace(/{{#each checklists}}.*?{{\/each}}/gs, this.renderChecklists(data.checklists));
    html = html.replace(/{{#if risks}}.*?{{\/if}}/gs, data.risks.length > 0 ? this.renderRisks(data.risks, data.backup) : '');
    
    return html;
  }

  // Helper methods for data gathering and formatting
  async getShipmentDetails(shipmentId) {
    // Mock implementation - would fetch from database
    return {
      dimensions: { length: 30, width: 20, height: 15, weight: 2.5 },
      fragility: 'high',
      sender: { name: 'Luxury Boutique', address: '123 Fashion St, London', contact: '+44 20 1234 5678' },
      buyer: { name: 'Premium Client', address: '456 Via Roma, Milan', contact: '+39 02 9876 5432' }
    };
  }

  formatDateTime(timestamp, format) {
    if (!timestamp) return '--';
    try {
      const date = new Date(timestamp);
      if (format === 'utc') {
        return date.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      }
      return date.toLocaleString('en-GB', { 
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '--';
    }
  }

  getLocationContact(locationType, hubCode) {
    const contacts = {
      'seller': 'Seller Contact (+44 20 1234 5678)',
      'buyer': 'Buyer Contact (+39 02 9876 5432)',
      'hub': `${hubCode} Hub Operations (+33 1 2345 6789)`
    };
    return contacts[locationType] || 'Contact TBD';
  }

  getLocationCoordinates(address) {
    // Mock implementation - would use geocoding service
    return { lat: 51.5074, lng: -0.1278 };
  }

  getRequiredEvidence(legType, processing) {
    const evidence = {
      'white-glove': 'Photos: pickup, transit, delivery. Signatures required.',
      'dhl': 'Tracking confirmation, delivery proof.',
      'internal-rollout': 'Hub transfer documentation, seal verification.'
    };
    return evidence[legType] || 'Standard documentation required.';
  }

  getProcessingEvidence(serviceType) {
    const evidence = {
      'authentication': 'Detailed photos (all angles), authentication certificate',
      'sewing': 'Pre/post sewing photos, quality inspection',
      'qa': 'Final inspection photos, completion certificate'
    };
    return evidence[serviceType] || 'Processing documentation required.';
  }

  generateOTPPlaceholder() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  getStepInstructions(leg) {
    const instructions = {
      'white-glove': 'Handle with care. Verify identity. Collect signatures.',
      'dhl': 'Standard DHL procedures. Track via reference number.',
      'internal-rollout': 'Hub-to-hub transfer. Verify seal integrity.'
    };
    return instructions[leg.legType] || 'Follow standard procedures.';
  }

  getProcessingInstructions(serviceType, tier) {
    const instructions = {
      'authentication': `Tier ${tier} authentication protocol. Document thoroughly.`,
      'sewing': 'Follow sewing specifications. Quality check required.',
      'qa': 'Final inspection checklist. Photo documentation required.'
    };
    return instructions[serviceType] || 'Follow standard processing procedures.';
  }

  getHubContact(hubCode) {
    const contacts = {
      'PAR1': 'Paris Hub (+33 1 2345 6789)',
      'LDN1': 'London Hub (+44 20 1234 5678)',
      'MLN1': 'Milan Hub (+39 02 9876 5432)'
    };
    return contacts[hubCode] || `${hubCode} Hub Operations`;
  }

  extractDHLLinks(provisionalLegs) {
    return provisionalLegs
      .filter(leg => leg.legType === 'dhl')
      .map(leg => ({
        legOrder: leg.legOrder,
        description: `${leg.fromLocation} → ${leg.toLocation}`,
        labelUrl: `/api/dhl/labels/${leg.id}`,
        trackingUrl: `/api/dhl/tracking/${leg.id}`
      }));
  }

  generateBackupOption(selectedRoute) {
    return {
      description: `Alternative ${selectedRoute.tier === 3 ? 'Hybrid' : 'WG'} routing available if primary route encounters issues.`,
      contact: 'Operations Center (+44 20 BACKUP)',
      escalation: 'Notify operations within 2 hours of any route deviations.'
    };
  }

  // Simple template rendering helpers
  renderItinerary(itinerary) {
    return itinerary.map(step => `
      <div class="itinerary-step">
        <div class="step-header"><strong>Step ${step.order}: ${step.type}</strong></div>
        <div class="step-content">
          <div>From: ${step.from?.address || step.location?.hub || 'N/A'}</div>
          <div>To: ${step.to?.address || step.location?.hub || 'N/A'}</div>
          <div>Time: ${step.departure?.local || 'TBD'} → ${step.arrival?.local || 'TBD'}</div>
          <div>Evidence: ${step.evidence}</div>
        </div>
      </div>
    `).join('');
  }

  renderChecklists(checklists) {
    return Object.values(checklists)
      .filter(checklist => checklist.required)
      .map(checklist => `
        <div class="checklist">
          <h4>${checklist.title}</h4>
          <ul>
            ${checklist.items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `).join('');
  }

  renderRisks(risks, backup) {
    const riskHTML = risks.map(risk => `
      <div class="risk-flag">
        <strong>${risk.type}:</strong> ${risk.message}
      </div>
    `).join('');
    
    const backupHTML = backup ? `
      <div class="backup-option">
        <strong>Backup Option:</strong> ${backup.description}
      </div>
    ` : '';
    
    return `
      <div class="section">
        <div class="section-header">⚠️ Risk Flags & Backup</div>
        <div class="section-content">
          ${riskHTML}
          ${backupHTML}
        </div>
      </div>
    `;
  }
}

module.exports = RouteMapGenerator;
