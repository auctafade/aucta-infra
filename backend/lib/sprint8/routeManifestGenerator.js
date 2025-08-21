// lib/sprint8/routeManifestGenerator.js
// Route Map Manifest Generator for Operations (PDF/HTML)

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class RouteManifestGenerator {
  constructor() {
    this.manifestsDir = path.join(__dirname, '../../uploads/manifests');
    this.ensureManifestsDirectory();
  }

  async ensureManifestsDirectory() {
    try {
      await fs.mkdir(this.manifestsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating manifests directory:', error);
    }
  }

  /**
   * Generate complete route manifest (PDF and HTML)
   * @param {Object} shipmentData - Complete shipment information
   * @param {Object} route - Selected route with all details
   * @returns {Object} Paths to generated files
   */
  async generateRouteManifest(shipmentData, route) {
    try {
      const manifestId = `MANIFEST-${shipmentData.shipment_id}-${Date.now()}`;
      
      // Generate both formats
      const [pdfPath, htmlPath] = await Promise.all([
        this.generatePDF(manifestId, shipmentData, route),
        this.generateHTML(manifestId, shipmentData, route)
      ]);
      
      // Store manifest record
      await this.storeManifestRecord(manifestId, shipmentData.shipment_id, {
        pdfPath,
        htmlPath,
        route
      });
      
      return {
        manifestId,
        pdfPath,
        htmlPath,
        qrCode: await this.generateQRCode(manifestId)
      };
      
    } catch (error) {
      console.error('Error generating route manifest:', error);
      throw error;
    }
  }

  /**
   * Generate PDF manifest
   */
  async generatePDF(manifestId, shipmentData, route) {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `${manifestId}.pdf`;
        const filePath = path.join(this.manifestsDir, fileName);
        
        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Route Manifest - ${shipmentData.shipment_id}`,
            Author: 'AUCTA Logistics',
            Subject: 'Shipment Route Manifest',
            Keywords: `shipment,${shipmentData.shipment_id},tier${route.tier}`
          }
        });
        
        // Pipe to file
        const stream = doc.pipe(fsSync.createWriteStream(filePath));
        
        // Header
        this.addPDFHeader(doc, manifestId, shipmentData);
        
        // Shipment Summary
        this.addPDFShipmentSummary(doc, shipmentData, route);
        
        // Route Itinerary
        this.addPDFItinerary(doc, route);
        
        // Cost Breakdown
        this.addPDFCostBreakdown(doc, route);
        
        // Operational Checklists
        this.addPDFChecklists(doc, shipmentData, route);
        
        // Risk & Fallback Notes
        this.addPDFRiskNotes(doc, route);
        
        // QR Code
        this.addPDFQRCode(doc, manifestId);
        
        // Finalize PDF
        doc.end();
        
        stream.on('finish', () => {
          resolve(filePath);
        });
        
        stream.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add PDF Header
   */
  addPDFHeader(doc, manifestId, shipmentData) {
    // Logo/Title
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('AUCTA LOGISTICS', { align: 'center' });
    
    doc.fontSize(18)
       .font('Helvetica')
       .text('Route Manifest', { align: 'center' });
    
    doc.moveDown();
    
    // Manifest Info Box
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(`Manifest ID: ${manifestId}`, 50, doc.y);
    
    doc.text(`Generated: ${new Date().toISOString()}`, 300, doc.y - 12);
    
    doc.moveDown();
    
    // Horizontal line
    doc.moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();
    
    doc.moveDown();
  }

  /**
   * Add Shipment Summary
   */
  addPDFShipmentSummary(doc, shipmentData, route) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('SHIPMENT DETAILS');
    
    doc.moveDown(0.5);
    
    // Two column layout
    const leftX = 50;
    const rightX = 300;
    let currentY = doc.y;
    
    doc.fontSize(10).font('Helvetica');
    
    // Left column
    doc.text(`Shipment ID: ${shipmentData.shipment_id}`, leftX, currentY);
    currentY += 15;
    doc.text(`Tier: ${route.tier}`, leftX, currentY);
    currentY += 15;
    doc.text(`Value: €${shipmentData.declared_value.toLocaleString()}`, leftX, currentY);
    currentY += 15;
    doc.text(`Weight: ${shipmentData.weight}kg`, leftX, currentY);
    currentY += 15;
    doc.text(`Dimensions: ${shipmentData.dimensions.length}x${shipmentData.dimensions.width}x${shipmentData.dimensions.height}cm`, leftX, currentY);
    
    // Right column
    currentY = doc.y - 75;
    doc.text(`Route Type: ${route.label}`, rightX, currentY);
    currentY += 15;
    doc.text(`Hub ID: ${route.hubId.hubCode} (${route.hubId.city})`, rightX, currentY);
    currentY += 15;
    if (route.hubCou) {
      doc.text(`Hub Cou: ${route.hubCou.hubCode} (${route.hubCou.city})`, rightX, currentY);
      currentY += 15;
    }
    doc.text(`SLA Target: ${new Date(shipmentData.sla_target_date).toLocaleDateString()}`, rightX, currentY);
    currentY += 15;
    doc.text(`Est. Delivery: ${new Date(route.schedule.estimatedDelivery).toLocaleDateString()}`, rightX, currentY);
    
    doc.y = currentY + 20;
    doc.moveDown();
    
    // Parties
    doc.fontSize(12).font('Helvetica-Bold').text('PARTIES');
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    
    // Sender
    doc.font('Helvetica-Bold').text('SENDER:', leftX);
    doc.font('Helvetica')
       .text(shipmentData.sender_name, leftX + 60, doc.y - 12)
       .text(shipmentData.sender_address, leftX + 60)
       .text(`${shipmentData.sender_city}, ${shipmentData.sender_country}`, leftX + 60);
    
    doc.moveDown();
    
    // Buyer
    doc.font('Helvetica-Bold').text('BUYER:', leftX);
    doc.font('Helvetica')
       .text(shipmentData.buyer_name, leftX + 60, doc.y - 12)
       .text(shipmentData.buyer_address, leftX + 60)
       .text(`${shipmentData.buyer_city}, ${shipmentData.buyer_country}`, leftX + 60);
    
    doc.moveDown(2);
  }

  /**
   * Add Route Itinerary
   */
  addPDFItinerary(doc, route) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('STEP-BY-STEP ITINERARY');
    
    doc.moveDown();
    
    // Table headers
    doc.fontSize(9)
       .font('Helvetica-Bold');
    
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 100;
    const col3 = 200;
    const col4 = 350;
    const col5 = 450;
    
    doc.text('Step', col1, tableTop);
    doc.text('Type', col2, tableTop);
    doc.text('From → To', col3, tableTop);
    doc.text('Service/Processing', col4, tableTop);
    doc.text('ETA', col5, tableTop);
    
    // Table line
    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();
    
    // Table rows
    doc.fontSize(9).font('Helvetica');
    let rowY = tableTop + 25;
    
    route.legs.forEach((leg, index) => {
      doc.text(`${index + 1}`, col1, rowY);
      doc.text(leg.type, col2, rowY);
      doc.text(`${leg.from.city} → ${leg.to.city}`, col3, rowY);
      doc.text(leg.service || '-', col4, rowY);
      
      // Calculate ETA
      const eta = this.calculateLegETA(route.schedule.pickup, leg, index);
      doc.text(eta, col5, rowY);
      
      // Processing note
      if (leg.processing && leg.processing !== 'none') {
        rowY += 12;
        doc.fontSize(8)
           .fillColor('#666666')
           .text(`Processing: ${leg.processing}`, col3, rowY);
        doc.fillColor('black');
      }
      
      // Responsibility note
      rowY += 12;
      doc.fontSize(8)
         .fillColor('#666666')
         .text(`Responsible: ${this.getResponsibleParty(leg)}`, col3, rowY);
      doc.fillColor('black');
      
      // OTP placeholder
      if (leg.type === 'white-glove') {
        rowY += 12;
        doc.fontSize(8)
           .fillColor('#0066cc')
           .text(`OTP: [_______]`, col3, rowY);
        doc.fillColor('black');
      }
      
      rowY += 20;
      
      // Add line between legs
      if (index < route.legs.length - 1) {
        doc.moveTo(col1, rowY - 5)
           .lineTo(550, rowY - 5)
           .strokeColor('#cccccc')
           .stroke();
        doc.strokeColor('black');
      }
    });
    
    doc.y = rowY + 10;
    doc.moveDown();
  }

  /**
   * Add Cost Breakdown
   */
  addPDFCostBreakdown(doc, route) {
    doc.addPage();
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('COST & TIME BREAKDOWN');
    
    doc.moveDown();
    
    // Cost table
    doc.fontSize(10).font('Helvetica');
    
    const costs = route.costBreakdown;
    const items = [];
    
    if (costs.wgLabor > 0) items.push(['WG Labor', costs.wgLabor]);
    if (costs.wgTravel > 0) items.push(['WG Travel', costs.wgTravel]);
    if (costs.flights > 0) items.push(['Flights', costs.flights]);
    if (costs.trains > 0) items.push(['Trains', costs.trains]);
    if (costs.ground > 0) items.push(['Ground Transport', costs.ground]);
    if (costs.dhlStandard > 0) items.push(['DHL Standard', costs.dhlStandard]);
    if (costs.dhlExpress > 0) items.push(['DHL Express', costs.dhlExpress]);
    items.push(['Hub Authentication', costs.hubIdFee]);
    if (costs.hubCouFee > 0) items.push(['Sewing & QA', costs.hubCouFee]);
    if (costs.nfcUnit > 0) items.push(['NFC Chip', costs.nfcUnit]);
    if (costs.tagUnit > 0) items.push(['Security Tag', costs.tagUnit]);
    if (costs.internalRollout > 0) items.push(['Internal Rollout', costs.internalRollout]);
    items.push(['Insurance', costs.insurance]);
    
    // Surcharges
    if (Object.values(costs.surcharges).some(v => v > 0)) {
      items.push(['--- SURCHARGES ---', null]);
      if (costs.surcharges.peak > 0) items.push(['  Peak Season', costs.surcharges.peak]);
      if (costs.surcharges.remote > 0) items.push(['  Remote Area', costs.surcharges.remote]);
      if (costs.surcharges.weekend > 0) items.push(['  Weekend', costs.surcharges.weekend]);
      if (costs.surcharges.fragile > 0) items.push(['  Fragile Handling', costs.surcharges.fragile]);
      if (costs.surcharges.fuel > 0) items.push(['  Fuel', costs.surcharges.fuel]);
    }
    
    let yPos = doc.y;
    
    items.forEach(([label, amount]) => {
      if (amount === null) {
        doc.font('Helvetica-Bold').text(label, 50, yPos);
      } else {
        doc.font('Helvetica').text(label, 50, yPos);
        doc.text(`€${amount.toFixed(2)}`, 450, yPos, { align: 'right' });
      }
      yPos += 15;
    });
    
    // Totals
    yPos += 10;
    doc.moveTo(50, yPos)
       .lineTo(550, yPos)
       .stroke();
    
    yPos += 10;
    doc.font('Helvetica-Bold')
       .text('Operational Cost:', 50, yPos)
       .text(`€${costs.total.toFixed(2)}`, 450, yPos, { align: 'right' });
    
    yPos += 15;
    doc.fillColor('green')
       .text(`Margin (${costs.marginPercentage}%):`, 50, yPos)
       .text(`€${costs.margin.toFixed(2)}`, 450, yPos, { align: 'right' });
    
    yPos += 20;
    doc.fillColor('black')
       .fontSize(12)
       .text('CLIENT PRICE:', 50, yPos)
       .text(`€${costs.clientPrice.toFixed(2)}`, 450, yPos, { align: 'right' });
    
    doc.y = yPos + 30;
    doc.moveDown();
  }

  /**
   * Add Operational Checklists
   */
  addPDFChecklists(doc, shipmentData, route) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('OPERATIONAL CHECKLISTS');
    
    doc.moveDown();
    
    // Pickup Checklist
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text('PICKUP CHECKLIST:');
    
    doc.fontSize(10).font('Helvetica');
    const pickupChecks = [
      '□ Verify sender identity',
      '□ Inspect item condition',
      '□ Take pickup photos (min 4 angles)',
      '□ Apply intake seal',
      '□ Record seal number: [_______________]',
      '□ Get sender signature',
      '□ Send pickup confirmation'
    ];
    
    pickupChecks.forEach(check => {
      doc.text(check, 70);
    });
    
    doc.moveDown();
    
    // Hub Processing Checklist
    if (route.tier === 3) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('HUB AUTHENTICATION & SEWING:');
      
      doc.fontSize(10).font('Helvetica');
      const hubChecks = [
        '□ Verify seal integrity',
        '□ Authenticate item',
        '□ Apply NFC chip',
        '□ Complete sewing service',
        '□ Quality assurance check',
        '□ Update tracking system',
        '□ Prepare for next leg'
      ];
      
      hubChecks.forEach(check => {
        doc.text(check, 70);
      });
    } else {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('HUB AUTHENTICATION:');
      
      doc.fontSize(10).font('Helvetica');
      const hubChecks = [
        '□ Verify seal integrity',
        '□ Authenticate item',
        '□ Apply security tag',
        '□ Quality check',
        '□ Update tracking system',
        '□ Prepare for next leg'
      ];
      
      hubChecks.forEach(check => {
        doc.text(check, 70);
      });
    }
    
    doc.moveDown();
    
    // Delivery Checklist
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text('DELIVERY CHECKLIST:');
    
    doc.fontSize(10).font('Helvetica');
    const deliveryChecks = [
      '□ Verify buyer identity',
      '□ Present item for inspection',
      '□ Remove transit seals',
      '□ Take delivery photos',
      '□ Get buyer signature',
      '□ Record proof of delivery',
      '□ Send delivery confirmation'
    ];
    
    deliveryChecks.forEach(check => {
      doc.text(check, 70);
    });
    
    doc.moveDown();
    
    // Customs Checklist (if international)
    if (shipmentData.sender_country !== shipmentData.buyer_country) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('CUSTOMS DOCUMENTATION:');
      
      doc.fontSize(10).font('Helvetica');
      const customsChecks = [
        '□ Commercial invoice',
        '□ Packing list',
        '□ Certificate of authenticity',
        '□ Export declaration',
        '□ Import permits (if required)',
        '□ Insurance documentation'
      ];
      
      customsChecks.forEach(check => {
        doc.text(check, 70);
      });
    }
    
    doc.moveDown();
  }

  /**
   * Add Risk & Fallback Notes
   */
  addPDFRiskNotes(doc, route) {
    doc.addPage();
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('RISK ASSESSMENT & CONTINGENCIES');
    
    doc.moveDown();
    
    // Guardrails
    if (route.guardrails && route.guardrails.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('IDENTIFIED RISKS:');
      
      doc.fontSize(10).font('Helvetica');
      
      route.guardrails.forEach(guardrail => {
        const icon = guardrail.type === 'error' ? '⚠' : 
                    guardrail.type === 'warning' ? '!' : 'ℹ';
        doc.text(`${icon} ${guardrail.message}`, 70);
        if (guardrail.canOverride) {
          doc.fontSize(9)
             .fillColor('#666666')
             .text('  → Can be overridden by admin', 85);
          doc.fillColor('black').fontSize(10);
        }
      });
      
      doc.moveDown();
    }
    
    // Rate freshness
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text('PRICING STATUS:');
    
    doc.fontSize(10).font('Helvetica');
    
    const freshness = route.rateFreshness || 'unknown';
    const freshnessText = {
      'fresh': 'All rates are current and confirmed',
      'amber': 'Some rates may need updating',
      'stale': 'Rates are outdated - refresh recommended',
      'unknown': 'Rate status unknown'
    };
    
    doc.text(freshnessText[freshness], 70);
    
    doc.moveDown();
    
    // Capacity warnings
    if (route.hubId.capacity_status === 'low' || 
        (route.hubCou && route.hubCou.capacity_status === 'low')) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('CAPACITY WARNINGS:');
      
      doc.fontSize(10).font('Helvetica');
      
      if (route.hubId.capacity_status === 'low') {
        doc.text(`• Hub ${route.hubId.hubCode} has limited authentication capacity`, 70);
      }
      if (route.hubCou && route.hubCou.capacity_status === 'low') {
        doc.text(`• Hub ${route.hubCou.hubCode} has limited sewing capacity`, 70);
      }
      
      doc.moveDown();
    }
    
    // Fallback procedures
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text('FALLBACK PROCEDURES:');
    
    doc.fontSize(10).font('Helvetica');
    
    const fallbacks = [
      'If hub capacity unavailable: Contact dispatch for alternate hub',
      'If WG operator delayed: Activate backup operator from roster',
      'If DHL service disrupted: Switch to alternate carrier',
      'If customs delay: Engage customs broker for expedited clearance',
      'Emergency contact: Operations Manager +44 20 7123 4567'
    ];
    
    fallbacks.forEach(fallback => {
      doc.text(`• ${fallback}`, 70);
    });
    
    doc.moveDown();
  }

  /**
   * Add QR Code
   */
  async addPDFQRCode(doc, manifestId) {
    try {
      // Generate QR code
      const qrCodeData = await QRCode.toDataURL(
        `https://aucta.com/manifest/${manifestId}`,
        { width: 150 }
      );
      
      // Position at bottom right
      doc.image(qrCodeData, 400, doc.page.height - 200, { width: 150 });
      
      doc.fontSize(8)
         .text('Scan for digital manifest', 400, doc.page.height - 40, { width: 150, align: 'center' });
      
    } catch (error) {
      console.error('Error adding QR code:', error);
    }
  }

  /**
   * Generate HTML manifest
   */
  async generateHTML(manifestId, shipmentData, route) {
    const fileName = `${manifestId}.html`;
    const filePath = path.join(this.manifestsDir, fileName);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Route Manifest - ${shipmentData.shipment_id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid #0066cc;
      margin-bottom: 30px;
    }
    .header h1 { color: #0066cc; margin-bottom: 10px; }
    .header .manifest-id { 
      background: #f0f8ff; 
      padding: 10px; 
      border-radius: 5px;
      display: inline-block;
      margin-top: 10px;
    }
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background: #fafafa;
      border-radius: 8px;
    }
    .section h2 {
      color: #0066cc;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .field {
      margin-bottom: 10px;
    }
    .field label {
      font-weight: bold;
      color: #666;
      display: inline-block;
      width: 120px;
    }
    .field span { color: #333; }
    .itinerary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .itinerary-table th {
      background: #0066cc;
      color: white;
      padding: 10px;
      text-align: left;
    }
    .itinerary-table td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    .itinerary-table tr:hover {
      background: #f0f8ff;
    }
    .checklist {
      background: white;
      padding: 15px;
      border-radius: 5px;
      margin-top: 10px;
    }
    .checklist h3 {
      color: #0066cc;
      margin-bottom: 10px;
    }
    .checklist ul {
      list-style: none;
      padding-left: 20px;
    }
    .checklist li {
      margin-bottom: 8px;
      position: relative;
    }
    .checklist li:before {
      content: "☐";
      position: absolute;
      left: -20px;
    }
    .cost-table {
      width: 100%;
      margin-top: 15px;
    }
    .cost-table td {
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    .cost-table .total {
      font-weight: bold;
      font-size: 1.2em;
      border-top: 2px solid #0066cc;
      padding-top: 10px;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
    }
    .success {
      background: #d4edda;
      border: 1px solid #28a745;
      color: #155724;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
    }
    .qr-code {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background: #f0f8ff;
      border-radius: 8px;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AUCTA LOGISTICS</h1>
      <h2>Route Manifest</h2>
      <div class="manifest-id">
        <strong>Manifest ID:</strong> ${manifestId}<br>
        <strong>Generated:</strong> ${new Date().toLocaleString()}
      </div>
    </div>
    
    <div class="section">
      <h2>Shipment Details</h2>
      <div class="grid">
        <div>
          <div class="field">
            <label>Shipment ID:</label>
            <span>${shipmentData.shipment_id}</span>
          </div>
          <div class="field">
            <label>Tier:</label>
            <span>${route.tier}</span>
          </div>
          <div class="field">
            <label>Value:</label>
            <span>€${shipmentData.declared_value.toLocaleString()}</span>
          </div>
          <div class="field">
            <label>Weight:</label>
            <span>${shipmentData.weight}kg</span>
          </div>
        </div>
        <div>
          <div class="field">
            <label>Route Type:</label>
            <span>${route.label}</span>
          </div>
          <div class="field">
            <label>Hub ID:</label>
            <span>${route.hubId.hubCode} (${route.hubId.city})</span>
          </div>
          ${route.hubCou ? `
          <div class="field">
            <label>Hub Cou:</label>
            <span>${route.hubCou.hubCode} (${route.hubCou.city})</span>
          </div>
          ` : ''}
          <div class="field">
            <label>Est. Delivery:</label>
            <span>${new Date(route.schedule.estimatedDelivery).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Route Itinerary</h2>
      <table class="itinerary-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Type</th>
            <th>From → To</th>
            <th>Service</th>
            <th>Processing</th>
          </tr>
        </thead>
        <tbody>
          ${route.legs.map((leg, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${leg.type}</td>
            <td>${leg.from.city} → ${leg.to.city}</td>
            <td>${leg.service}</td>
            <td>${leg.processing || '-'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>Cost Breakdown</h2>
      <table class="cost-table">
        ${this.generateHTMLCostRows(route.costBreakdown)}
        <tr class="total">
          <td>Client Price</td>
          <td align="right">€${route.costBreakdown.clientPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    
    <div class="section">
      <h2>Operational Checklists</h2>
      
      <div class="checklist">
        <h3>Pickup Checklist</h3>
        <ul>
          <li>Verify sender identity</li>
          <li>Inspect item condition</li>
          <li>Take pickup photos (min 4 angles)</li>
          <li>Apply intake seal</li>
          <li>Record seal number</li>
          <li>Get sender signature</li>
        </ul>
      </div>
      
      <div class="checklist">
        <h3>Hub Processing</h3>
        <ul>
          <li>Verify seal integrity</li>
          <li>Authenticate item</li>
          <li>Apply ${route.tier === 3 ? 'NFC chip' : 'security tag'}</li>
          ${route.tier === 3 ? '<li>Complete sewing service</li>' : ''}
          <li>Quality assurance check</li>
          <li>Update tracking system</li>
        </ul>
      </div>
      
      <div class="checklist">
        <h3>Delivery Checklist</h3>
        <ul>
          <li>Verify buyer identity</li>
          <li>Present item for inspection</li>
          <li>Remove transit seals</li>
          <li>Take delivery photos</li>
          <li>Get buyer signature</li>
          <li>Record proof of delivery</li>
        </ul>
      </div>
    </div>
    
    ${route.guardrails && route.guardrails.length > 0 ? `
    <div class="section">
      <h2>Risk Assessment</h2>
      ${route.guardrails.map(g => `
      <div class="${g.type === 'error' ? 'warning' : 'success'}">
        <strong>${g.type.toUpperCase()}:</strong> ${g.message}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div class="qr-code">
      <img src="data:image/png;base64,${await this.generateQRCodeBase64(manifestId)}" width="150" height="150">
      <p>Scan for digital manifest</p>
    </div>
  </div>
</body>
</html>
    `;
    
    await fs.writeFile(filePath, html);
    return filePath;
  }

  /**
   * Helper methods
   */
  calculateLegETA(pickupTime, leg, index) {
    // Simplified ETA calculation
    const pickup = new Date(pickupTime);
    const hoursToAdd = (index + 1) * 24; // Each leg takes ~1 day
    const eta = new Date(pickup.getTime() + hoursToAdd * 60 * 60 * 1000);
    
    return `${eta.toLocaleDateString()} ${eta.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`;
  }

  getResponsibleParty(leg) {
    if (leg.type === 'white-glove') {
      return 'WG Operator';
    } else if (leg.type === 'dhl') {
      return 'DHL';
    } else if (leg.type === 'internal-rollout') {
      return 'Hub Operations';
    }
    return 'TBD';
  }

  generateHTMLCostRows(costs) {
    const rows = [];
    
    if (costs.wgLabor > 0) {
      rows.push(`<tr><td>WG Labor</td><td align="right">€${costs.wgLabor.toFixed(2)}</td></tr>`);
    }
    if (costs.wgTravel > 0) {
      rows.push(`<tr><td>WG Travel</td><td align="right">€${costs.wgTravel.toFixed(2)}</td></tr>`);
    }
    if (costs.flights > 0) {
      rows.push(`<tr><td>Flights</td><td align="right">€${costs.flights.toFixed(2)}</td></tr>`);
    }
    if (costs.dhlStandard > 0 || costs.dhlExpress > 0) {
      rows.push(`<tr><td>DHL Shipping</td><td align="right">€${(costs.dhlStandard + costs.dhlExpress).toFixed(2)}</td></tr>`);
    }
    
    rows.push(`<tr><td>Hub Fees</td><td align="right">€${(costs.hubIdFee + costs.hubCouFee).toFixed(2)}</td></tr>`);
    rows.push(`<tr><td>Insurance</td><td align="right">€${costs.insurance.toFixed(2)}</td></tr>`);
    
    // Surcharges
    const totalSurcharges = Object.values(costs.surcharges).reduce((a, b) => a + b, 0);
    if (totalSurcharges > 0) {
      rows.push(`<tr><td>Surcharges</td><td align="right">€${totalSurcharges.toFixed(2)}</td></tr>`);
    }
    
    rows.push(`<tr><td><strong>Total Cost</strong></td><td align="right"><strong>€${costs.total.toFixed(2)}</strong></td></tr>`);
    rows.push(`<tr><td>Margin (${costs.marginPercentage}%)</td><td align="right">€${costs.margin.toFixed(2)}</td></tr>`);
    
    return rows.join('\n');
  }

  async generateQRCode(manifestId) {
    const url = `https://aucta.com/manifest/${manifestId}`;
    return await QRCode.toDataURL(url, { width: 200 });
  }

  async generateQRCodeBase64(manifestId) {
    const url = `https://aucta.com/manifest/${manifestId}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 200 });
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }

  async storeManifestRecord(manifestId, shipmentId, data) {
    // Store manifest record in database
    // This would be implemented with actual database calls
    console.log(`Manifest ${manifestId} stored for shipment ${shipmentId}`);
  }
}

module.exports = RouteManifestGenerator;
