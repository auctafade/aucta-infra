// Route Sheet PDF Generator
// Generates a clean PDF route sheet for operations team - single source of truth for hand-off

interface RouteSheetData {
  shipmentId: string;
  shipment: any;
  serviceModel: string;
  tier: number;
  quote: any;
  hybridVariant?: string;
  generatedAt: string;
}

// Get mode icon based on transport type
function getModeIcon(mode: string): string {
  switch(mode?.toLowerCase()) {
    case 'wg':
    case 'white-glove':
      return '🧤';
    case 'dhl':
      return '📦';
    case 'internal':
    case 'rollout':
      return '🚚';
    case 'flight':
      return '✈️';
    case 'train':
      return '🚂';
    case 'car':
    case 'ground':
      return '🚗';
    default:
      return '🔄';
  }
}

// Format datetime for display
function formatDateTime(date: string | Date): { local: string; utc: string } {
  const d = new Date(date);
  return {
    local: d.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    utc: d.toUTCString().replace('GMT', 'UTC').substring(0, 22)
  };
}

export async function generatePDF(data: RouteSheetData): Promise<Blob> {
  // Calculate total duration
  const totalHours = data.quote?.segments?.reduce((sum: number, seg: any) => {
    if (seg.departure && seg.arrival) {
      const duration = (new Date(seg.arrival).getTime() - new Date(seg.departure).getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }
    return sum + (seg.duration || 0);
  }, 0) || 0;

  // Get service model display name
  const getServiceModelName = () => {
    if (data.serviceModel === 'wg-full') return 'Full White-Glove';
    if (data.serviceModel === 'dhl-full') return 'Full DHL';
    if (data.serviceModel === 'hybrid') {
      if (data.hybridVariant === 'wg_to_dhl') return 'Hybrid (WG → DHL)';
      if (data.hybridVariant === 'dhl_to_wg') return 'Hybrid (DHL → WG)';
      return 'Hybrid';
    }
    return data.serviceModel;
  };

  // Create HTML content for the route sheet
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Route Sheet - ${data.shipmentId}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #1f2937;
          padding: 15px;
          background: white;
        }
        
        /* Header Section */
        .header {
          background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .header-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-top: 15px;
        }
        
        .header-item {
          border-left: 2px solid rgba(255,255,255,0.3);
          padding-left: 10px;
        }
        
        .header-item:first-child {
          border-left: none;
        }
        
        .header-label {
          font-size: 9px;
          opacity: 0.8;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        
        .header-value {
          font-size: 14px;
          font-weight: 600;
        }
        
        .header-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .header-subtitle {
          font-size: 12px;
          opacity: 0.9;
        }
        
        /* Parties & Hubs Section */
        .parties-section {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .parties-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        
        .party-box {
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px;
        }
        
        .party-label {
          font-size: 9px;
          color: #6b7280;
          text-transform: uppercase;
          margin-bottom: 4px;
          font-weight: 600;
        }
        
        .party-name {
          font-size: 13px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 4px;
        }
        
        .party-address {
          font-size: 10px;
          color: #4b5563;
          line-height: 1.3;
        }
        
        /* Route Timeline Section */
        .timeline-section {
          margin-bottom: 20px;
        }
        
        .timeline-title {
          font-size: 14px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #3b82f6;
        }
        
        .timeline-container {
          position: relative;
          padding-left: 20px;
        }
        
        .timeline-line {
          position: absolute;
          left: 9px;
          top: 20px;
          bottom: 20px;
          width: 2px;
          background: #d1d5db;
        }
        
        .timeline-segment {
          display: flex;
          align-items: start;
          margin-bottom: 20px;
          position: relative;
        }
        
        .timeline-dot {
          position: absolute;
          left: -15px;
          top: 5px;
          width: 20px;
          height: 20px;
          background: white;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          z-index: 1;
        }
        
        .timeline-arrow {
          position: absolute;
          left: -5px;
          top: 25px;
          font-size: 16px;
          color: #9ca3af;
        }
        
        .timeline-content {
          flex: 1;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-left: 15px;
        }
        
        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 8px;
        }
        
        .timeline-route {
          font-size: 12px;
          font-weight: bold;
          color: #111827;
        }
        
        .timeline-mode {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          color: #1e40af;
        }
        
        .timeline-times {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 8px 0;
          padding: 8px;
          background: #f9fafb;
          border-radius: 4px;
        }
        
        .timeline-time-item {
          font-size: 10px;
        }
        
        .timeline-time-label {
          color: #6b7280;
          margin-bottom: 2px;
        }
        
        .timeline-time-value {
          color: #111827;
          font-weight: 600;
        }
        
        .timeline-notes {
          font-size: 10px;
          color: #4b5563;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #f3f4f6;
        }
        
        .timeline-who {
          font-size: 9px;
          color: #6b7280;
          margin-top: 4px;
          font-style: italic;
        }
        
        /* Cost Breakdown Table */
        .cost-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .cost-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        
        .cost-table th {
          text-align: left;
          padding: 8px;
          background: #f3f4f6;
          border-bottom: 2px solid #d1d5db;
          font-size: 10px;
          font-weight: 600;
          color: #4b5563;
          text-transform: uppercase;
        }
        
        .cost-table td {
          padding: 8px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 11px;
        }
        
        .cost-table .amount {
          text-align: right;
          font-weight: 600;
        }
        
        .cost-table .subtotal-row {
          background: #f9fafb;
          font-weight: 600;
        }
        
        .cost-table .total-row {
          background: #f3f4f6;
          font-weight: bold;
          font-size: 12px;
          border-top: 2px solid #d1d5db;
        }
        
        .cost-table .client-row {
          background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%);
          font-weight: bold;
          font-size: 14px;
          color: #1e40af;
        }
        
        /* Assumptions & Buffers */
        .assumptions-section {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .assumptions-title {
          font-size: 12px;
          font-weight: bold;
          color: #92400e;
          margin-bottom: 10px;
        }
        
        .assumptions-list {
          margin-left: 20px;
          color: #78350f;
          font-size: 10px;
        }
        
        .assumptions-list li {
          margin-bottom: 4px;
        }
        
        /* Attachments */
        .attachments-section {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .attachment-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        
        .attachment-thumb {
          aspect-ratio: 1;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: #6b7280;
          text-align: center;
          padding: 5px;
        }
        
        /* Footer */
        .footer {
          background: #f3f4f6;
          border: 2px dashed #9ca3af;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          margin-top: 30px;
        }
        
        .footer-warning {
          font-size: 12px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        
        .footer-text {
          font-size: 10px;
          color: #4b5563;
          line-height: 1.5;
        }
        
        /* SLA Comment */
        .sla-section {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }
        
        .sla-title {
          font-size: 11px;
          font-weight: 600;
          color: #0369a1;
          margin-bottom: 6px;
        }
        
        .sla-content {
          font-size: 11px;
          color: #0c4a6e;
          line-height: 1.5;
        }
        
        @media print {
          body {
            padding: 0;
          }
          .timeline-section,
          .cost-section,
          .parties-section {
            break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <!-- Header with Key Information -->
      <div class="header">
        <div>
          <div class="header-title">ROUTE SHEET</div>
          <div class="header-subtitle">Shipment #${data.shipmentId}</div>
        </div>
        <div class="header-grid">
          <div class="header-item">
            <div class="header-label">Tier</div>
            <div class="header-value">${data.tier}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Service Model</div>
            <div class="header-value">${getServiceModelName()}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Value</div>
            <div class="header-value">€${(data.shipment?.declared_value || 0).toLocaleString()}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Weight/Dims</div>
            <div class="header-value">${data.shipment?.weight || 0}kg / ${data.shipment?.dimensions || 'N/A'}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Fragility</div>
            <div class="header-value">Level ${data.shipment?.fragility_level || 0}/5</div>
          </div>
          <div class="header-item">
            <div class="header-label">Currency</div>
            <div class="header-value">${data.quote?.currency || 'EUR'}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Date</div>
            <div class="header-value">${new Date(data.generatedAt).toLocaleDateString('en-GB')}</div>
          </div>
          <div class="header-item">
            <div class="header-label">Duration</div>
            <div class="header-value">~${Math.ceil(totalHours / 24)} days</div>
          </div>
        </div>
      </div>
      
      <!-- Parties & Hubs with Formatted Addresses -->
      <div class="parties-section">
        <div class="timeline-title">Parties & Hubs</div>
        <div class="parties-grid">
          <div class="party-box">
            <div class="party-label">Sender (A)</div>
            <div class="party-name">${data.quote?.parties?.sender?.name || data.shipment?.sender_name || 'N/A'}</div>
            <div class="party-address">
              ${data.quote?.parties?.sender?.street || data.shipment?.sender_address || ''}<br/>
              ${data.quote?.parties?.sender?.city || data.shipment?.sender_city || ''}, 
              ${data.quote?.parties?.sender?.postalCode || ''}<br/>
              ${data.quote?.parties?.sender?.country || data.shipment?.sender_country || ''}
            </div>
          </div>
          
          ${data.quote?.parties?.hub1 ? `
          <div class="party-box">
            <div class="party-label">Hub #1 (Authenticator)</div>
            <div class="party-name">${data.quote.parties.hub1.name || 'Hub #1'}</div>
            <div class="party-address">
              ${data.quote.parties.hub1.street || ''}<br/>
              ${data.quote.parties.hub1.city || ''}, 
              ${data.quote.parties.hub1.postalCode || ''}<br/>
              ${data.quote.parties.hub1.country || ''}
            </div>
          </div>
          ` : ''}
          
          ${data.quote?.parties?.hub2 ? `
          <div class="party-box">
            <div class="party-label">Hub #2 (Couturier)</div>
            <div class="party-name">${data.quote.parties.hub2.name || 'Hub #2'}</div>
            <div class="party-address">
              ${data.quote.parties.hub2.street || ''}<br/>
              ${data.quote.parties.hub2.city || ''}, 
              ${data.quote.parties.hub2.postalCode || ''}<br/>
              ${data.quote.parties.hub2.country || ''}
            </div>
          </div>
          ` : ''}
          
          <div class="party-box">
            <div class="party-label">Buyer (B)</div>
            <div class="party-name">${data.quote?.parties?.buyer?.name || data.shipment?.buyer_name || 'N/A'}</div>
            <div class="party-address">
              ${data.quote?.parties?.buyer?.street || data.shipment?.buyer_address || ''}<br/>
              ${data.quote?.parties?.buyer?.city || data.shipment?.buyer_city || ''}, 
              ${data.quote?.parties?.buyer?.postalCode || ''}<br/>
              ${data.quote?.parties?.buyer?.country || data.shipment?.buyer_country || ''}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Route Timeline with Boxes and Arrows -->
      <div class="timeline-section">
        <div class="timeline-title">Route Timeline</div>
        <div class="timeline-container">
          <div class="timeline-line"></div>
          ${data.quote?.segments?.map((segment: any, index: number) => {
            const isWG = segment.mode === 'wg' || segment.mode === 'white-glove';
            const isDHL = segment.mode === 'dhl';
            const isInternal = segment.mode === 'internal' || segment.mode === 'rollout';
            
            // Format times if available
            let timeDisplay = '';
            if (segment.departure && segment.arrival) {
              const dep = formatDateTime(segment.departure);
              const arr = formatDateTime(segment.arrival);
              timeDisplay = `
                <div class="timeline-times">
                  <div class="timeline-time-item">
                    <div class="timeline-time-label">Departure (Local/UTC)</div>
                    <div class="timeline-time-value">${dep.local} / ${dep.utc}</div>
                  </div>
                  <div class="timeline-time-item">
                    <div class="timeline-time-label">Arrival (Local/UTC)</div>
                    <div class="timeline-time-value">${arr.local} / ${arr.utc}</div>
                  </div>
                </div>
              `;
            }
            
            // Build notes with pricing info
            let notes = '';
            if (isWG && segment.wgPricing) {
              const parts = [];
              if (segment.wgPricing.flights > 0) parts.push(`Flights: €${segment.wgPricing.flights}`);
              if (segment.wgPricing.trains > 0) parts.push(`Trains: €${segment.wgPricing.trains}`);
              if (segment.wgPricing.ground > 0) parts.push(`Ground: €${segment.wgPricing.ground}`);
              if (parts.length > 0) notes = parts.join(' • ');
            } else if (isDHL && segment.dhlPricing) {
              notes = `DHL Quote: €${segment.dhlPricing.quote}`;
              if (segment.dhlPricing.serviceLevel) notes += ` (${segment.dhlPricing.serviceLevel})`;
            } else if (isInternal && segment.internalPricing) {
              notes = `Internal: €${segment.internalPricing.perItemCost}/item × ${segment.internalPricing.itemCount} items`;
            }
            
            if (segment.notes) {
              notes = notes ? notes + ' • ' + segment.notes : segment.notes;
            }
            
            return `
              <div class="timeline-segment">
                <div class="timeline-dot"></div>
                ${index < (data.quote?.segments?.length || 0) - 1 ? '<div class="timeline-arrow">↓</div>' : ''}
                <div class="timeline-content">
                  <div class="timeline-header">
                    <div class="timeline-route">
                      ${getModeIcon(segment.mode)} ${segment.from || 'Origin'} → ${segment.to || 'Destination'}
                    </div>
                    <div class="timeline-mode">${segment.mode?.toUpperCase() || 'TRANSPORT'}</div>
                  </div>
                  ${timeDisplay}
                  ${notes ? `<div class="timeline-notes">📝 ${notes}</div>` : ''}
                  <div class="timeline-who">
                    ${isWG ? '🧤 White-Glove operators handle this segment' : 
                      isDHL ? '📦 DHL handles this segment' : 
                      isInternal ? '🚚 Internal team handles this segment' : 
                      '🔄 Standard transport'}
                  </div>
                </div>
              </div>
            `;
          }).join('') || '<p style="padding: 20px; color: #6b7280;">No segments defined</p>'}
        </div>
      </div>
      
      <!-- Cost Breakdown Table -->
      <div class="cost-section">
        <div class="timeline-title">Cost Breakdown</div>
        <table class="cost-table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="amount">Amount (€)</th>
            </tr>
          </thead>
          <tbody>
            ${data.quote?.laborCosts?.totalLaborCost > 0 ? `
              <tr>
                <td>WG Labor</td>
                <td class="amount">${data.quote.laborCosts.totalLaborCost.toFixed(2)}</td>
              </tr>
            ` : ''}
            
            ${(() => {
              // Calculate transport costs by type
              let flights = 0, trains = 0, ground = 0, dhl = 0, internal = 0;
              data.quote?.segments?.forEach((seg: any) => {
                if (seg.wgPricing) {
                  flights += seg.wgPricing.flights || 0;
                  trains += seg.wgPricing.trains || 0;
                  ground += seg.wgPricing.ground || 0;
                } else if (seg.dhlPricing) {
                  dhl += seg.dhlPricing.quote || 0;
                } else if (seg.internalPricing) {
                  internal += (seg.internalPricing.perItemCost * seg.internalPricing.itemCount) || 0;
                }
              });
              
              let rows = '';
              if (flights > 0) rows += `<tr><td>Flights/Trains</td><td class="amount">${(flights + trains).toFixed(2)}</td></tr>`;
              if (ground > 0) rows += `<tr><td>Ground Transport</td><td class="amount">${ground.toFixed(2)}</td></tr>`;
              if (dhl > 0) rows += `<tr><td>DHL Services</td><td class="amount">${dhl.toFixed(2)}</td></tr>`;
              if (internal > 0) rows += `<tr><td>Internal Rollout</td><td class="amount">${internal.toFixed(2)}</td></tr>`;
              return rows;
            })()}
            
            ${(() => {
              // Hub fees breakdown
              const hubFees = data.quote?.hubFees;
              if (!hubFees) return '';
              
              let rows = '';
              if (hubFees.authentication > 0) rows += `<tr><td>Hub Authentication</td><td class="amount">${hubFees.authentication.toFixed(2)}</td></tr>`;
              if (hubFees.tag > 0) rows += `<tr><td>Security Tag</td><td class="amount">${hubFees.tag.toFixed(2)}</td></tr>`;
              if (hubFees.nfc > 0) rows += `<tr><td>NFC Chip</td><td class="amount">${hubFees.nfc.toFixed(2)}</td></tr>`;
              if (hubFees.sewing > 0) rows += `<tr><td>Sewing Service</td><td class="amount">${hubFees.sewing.toFixed(2)}</td></tr>`;
              if (hubFees.qaFee > 0) rows += `<tr><td>Quality Assurance</td><td class="amount">${hubFees.qaFee.toFixed(2)}</td></tr>`;
              return rows;
            })()}
            
            ${data.quote?.insurance > 0 ? `
              <tr>
                <td>Insurance/Surcharges</td>
                <td class="amount">${data.quote.insurance.toFixed(2)}</td>
              </tr>
            ` : ''}
            
            <tr class="total-row">
              <td><strong>Internal Cost Total</strong></td>
              <td class="amount"><strong>${(data.quote?.totalCost || 0).toFixed(2)}</strong></td>
            </tr>
            
            <tr class="client-row">
              <td><strong>CLIENT PRICE</strong></td>
              <td class="amount"><strong>€${(data.quote?.clientPrice || 0).toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
        
        ${data.quote?.marginType && data.quote?.margin ? `
          <div style="margin-top: 10px; padding: 8px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px;">
            <div style="font-size: 10px; color: #166534;">
              <strong>Margin Applied:</strong> 
              ${data.quote.marginType === 'percentage' ? 
                `${data.quote.margin}% of internal cost` : 
                `€${data.quote.margin} fixed amount`}
            </div>
          </div>
        ` : ''}
      </div>
      
      <!-- SLA Comment if provided -->
      ${data.quote?.slaComment ? `
        <div class="sla-section">
          <div class="sla-title">SLA Commitment</div>
          <div class="sla-content">${data.quote.slaComment}</div>
        </div>
      ` : ''}
      
      <!-- Assumptions & Buffers -->
      <div class="assumptions-section">
        <div class="assumptions-title">⚠️ Assumptions & Buffers</div>
        <ul class="assumptions-list">
          ${data.quote?.laborCosts ? `
            <li>WG Labor: ${data.quote.laborCosts.regularHours?.toFixed(1) || 0}h regular + ${data.quote.laborCosts.overtimeHours?.toFixed(1) || 0}h overtime</li>
            ${data.quote.laborCosts.overtimeHours > 0 ? `<li>Overtime multiplier applied after threshold</li>` : ''}
            ${data.quote.laborCosts.perDiemCost > 0 ? `<li>Per-diem included for multi-day operations</li>` : ''}
            ${data.quote.laborCosts.bufferHours > 0 ? `<li>Time buffers included: ${data.quote.laborCosts.bufferHours.toFixed(1)}h total</li>` : ''}
          ` : ''}
          <li>All prices include applicable taxes and fees</li>
          <li>Exchange rates fixed at time of quote generation</li>
          <li>Hub processing times based on standard SLAs</li>
          ${data.tier === 3 ? '<li>NFC chip and sewing required at designated hubs</li>' : ''}
          ${data.tier === 2 ? '<li>Security tag required at authentication hub</li>' : ''}
          <li>Insurance calculated at 0.3% of declared value</li>
        </ul>
      </div>
      
      <!-- Attachments Thumbnails -->
      ${(() => {
        const attachments: string[] = [];
        data.quote?.segments?.forEach((seg: any) => {
          if (seg.attachments?.length > 0) {
            seg.attachments.forEach((att: any) => attachments.push(att.name || 'Attachment'));
          }
        });
        
        if (attachments.length > 0) {
          return `
            <div class="attachments-section">
              <div class="timeline-title">Attachments</div>
              <div class="attachment-grid">
                ${attachments.slice(0, 8).map(name => `
                  <div class="attachment-thumb">
                    📎<br/>${name}
                  </div>
                `).join('')}
                ${attachments.length > 8 ? `
                  <div class="attachment-thumb">
                    +${attachments.length - 8} more
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }
        return '';
      })()}
      
      <!-- Footer with Disclaimer -->
      <div class="footer">
        <div class="footer-warning">
          ⚠️ DRAFT QUOTE — NO BOOKINGS CREATED BY THIS DOCUMENT
        </div>
        <div class="footer-text">
          This route sheet is for planning purposes only. No operator assignments, DHL labels, inventory holds, or hub reservations have been made.<br/>
          All prices are manually entered based on external lookups. Valid for 7 days from generation.<br/>
          Generated: ${new Date(data.generatedAt).toLocaleString('en-GB')}<br/>
          Contact: operations@aucta.com for execution approval
        </div>
      </div>
    </body>
    </html>
  `;

  // Convert HTML to PDF using browser's print functionality
  // In production, use a proper PDF library like jsPDF or puppeteer
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Failed to open print window');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  return new Promise((resolve, reject) => {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        
        // Create a blob from the printed content
        // In a real implementation, you'd use a proper PDF library
        const pdfContent = new Blob([html], { type: 'application/pdf' });
        resolve(pdfContent);
        
        // Close the print window after a delay
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 250);
    };
  });
}

// Save PDF to shipment record
export async function savePDFToShipment(shipmentId: string, pdfBlob: Blob): Promise<{ url: string }> {
  // In a real implementation, this would upload to S3 or similar
  // For now, we'll create a local object URL
  const url = URL.createObjectURL(pdfBlob);
  
  // Simulate saving to backend
  console.log(`PDF saved for shipment ${shipmentId}: ${url}`);
  
  // Optional: Save JSON quote draft for later editing
  // This would be stored in the database
  
  return { url };
}