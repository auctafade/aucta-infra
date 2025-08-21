# Quote System Test Instructions

## Quick Start Testing

### 1. Access Test Page
Navigate to: `http://localhost:3000/sprint-8/logistics/plan/test`

### 2. Test Flow Walkthrough

#### Test Case 1: Tier 3 → Hybrid (DHL→WG)
1. Go to `/sprint-8/logistics/plan/start`
2. Select any shipment (or use TEST-001)
3. Click "Continue to Service Selection"
4. Select **Tier 3** and **Hybrid** service model
5. Choose **DHL → WG** variant
6. Fill in the manual planner:
   - **Hub #1**: London Hub, 123 Oxford Street, London, UK
   - **Hub #2**: Paris Hub, 456 Champs-Élysées, Paris, France
   - **Segment 1 (DHL)**: 
     - From: Sender → To: Hub #1
     - DHL Quote: €500
     - Service Level: Express
   - **Segment 2 (Internal)**: 
     - From: Hub #1 → To: Hub #2
     - Items: 1, Cost: €50
   - **Segment 3 (WG)**:
     - From: Hub #2 → To: Buyer
     - Departure: Today 10:00
     - Arrival: Today 18:00
     - Flight: €300, Ground: €50
7. Check WG labor calculation appears (8 hours × €75 = €600)
8. Verify totals: Transport + Labor + Hub fees
9. Click "Generate Quote PDF"
10. **Expected**: PDF with all segments, correct pricing, no system bookings

#### Test Case 2: Tier 3 → Full WG (with Overtime)
1. Start new quote, select **Tier 3** and **Full White-Glove**
2. Fill three WG segments:
   - **Segment 1**: Paris → London (4 hours, Flight: €800)
   - **Segment 2**: London → Milan (5 hours, Train: €200)  
   - **Segment 3**: Milan → Buyer (4 hours, Taxi: €100)
3. Enable buffers:
   - ✓ Airport check-in (90 min)
   - ✓ Train buffer (20 min)
4. **Verify overtime**: 13h base + 1.8h buffers = 14.8h total
   - Regular: 8h × €75 = €600
   - Overtime: 6.8h × €75 × 1.5 = €765
5. Export PDF

#### Test Case 3: Tier 2 → Full DHL
1. Start new quote, select **Tier 2** and **Full DHL**
2. Note: No hybrid option should appear for Tier 2
3. Fill DHL segments:
   - **Segment 1**: A → Hub #1, DHL Quote: €400
   - **Segment 2**: Hub #1 → B, DHL Quote: €350
4. Verify hub fees auto-populate:
   - Authentication: €100
   - Security Tag: €25
5. Edit fees inline if needed
6. Export PDF

#### Test Case 4: Edge Case - No Second Hub
1. Select **Tier 3** service
2. Toggle "No second hub for this quote" ✓
3. Verify Hub #2 fields disappear
4. Note sewing/QA fees move to Hub #1
5. Complete quote and export

### 3. Validation Tests

#### Non-Blocking Validation
1. Enter arrival before departure (should show warning)
2. Leave DHL price empty (should show error but allow continue)
3. Enter margin > 100% (should show warning)
4. Confirm you can still save despite warnings

#### No Side Effects Check
1. After generating PDF, check:
   - No network calls to booking APIs
   - No inventory deductions
   - No operator assignments
   - Only PDF attachment exists

### 4. Settings Test
1. Go to `/sprint-8/settings/quote-config`
2. Change:
   - WG hourly rate to €100
   - Hub authentication fee to €200
   - Default margin to 40%
3. Save settings
4. Create new quote
5. Verify new rates apply immediately

## Acceptance Criteria Checklist

### Core Flow
- [ ] Can navigate: /plan/start → /plan/mode → Manual Planner
- [ ] Can fill addresses & segment times
- [ ] Can paste ticket/DHL prices
- [ ] App computes WG labor correctly
- [ ] App calculates totals accurately
- [ ] Can export PDF attached to shipment

### System Behavior
- [ ] No bookings/holds/logs created
- [ ] Only PDF exists in system
- [ ] Tier logic generates correct segments
- [ ] Service models restrict options correctly
- [ ] Hub fees auto-insert from price book
- [ ] All fees are editable inline

### Data Quality
- [ ] No NaN states appear
- [ ] No Invalid Date errors
- [ ] Currency displays consistently (EUR)
- [ ] Calculations handle edge cases

### PDF Quality
- [ ] Header has shipment ID, tier, service model
- [ ] Shows value, weight, fragility, currency, date
- [ ] Parties & addresses formatted correctly
- [ ] Timeline readable with local/UTC times
- [ ] Cost breakdown complete and accurate
- [ ] Assumptions & buffers listed
- [ ] Footer shows "DRAFT QUOTE" disclaimer
- [ ] PDF is clean and hand-off ready

## Test Data

### Sample Shipment
```json
{
  "id": "TEST-001",
  "sender_name": "Louis Vuitton Paris",
  "sender_address": "2 Rue du Pont Neuf",
  "sender_city": "Paris",
  "sender_country": "France",
  "buyer_name": "John Smith",
  "buyer_address": "123 Fifth Avenue",
  "buyer_city": "New York",
  "buyer_country": "USA",
  "declared_value": 50000,
  "weight": 2.5,
  "fragility_level": 4,
  "tier": 3
}
```

### Sample Hub Addresses
- **London Hub**: 123 Oxford Street, London, W1D 2HG, UK
- **Paris Hub**: 456 Champs-Élysées, 75008 Paris, France
- **Milan Hub**: 789 Via Montenapoleone, 20121 Milano, Italy
- **New York Hub**: 555 Madison Avenue, NY 10022, USA

### Sample Pricing
- **WG Flights**: €500-1500
- **WG Trains**: €100-400
- **WG Ground**: €50-200
- **DHL Express**: €300-800
- **DHL Standard**: €200-500
- **Internal Rollout**: €50/item

## Troubleshooting

### Common Issues
1. **Settings not applying**: Clear localStorage and refresh
2. **PDF not generating**: Check browser popup blocker
3. **Validation blocking**: Errors are warnings only, click "Continue anyway"
4. **Hub fees wrong**: Check Settings → Quote Config → Hub Price Book

### Reset Everything
```javascript
// Run in browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Success Criteria
✅ All test cases pass
✅ No system side effects
✅ PDF is professional and complete
✅ Operations team can execute from PDF alone
✅ No technical errors or NaN states
