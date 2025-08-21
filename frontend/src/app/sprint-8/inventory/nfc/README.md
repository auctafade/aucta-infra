# NFC Inventory (Tier 3) — http://localhost:3000/sprint-8/inventory/nfc

## Purpose

Maintain end-to-end control of NFC chips (by UID and lot) so Tier 3 jobs never stall and every chip is traceable from receipt → reservation → installation → RMA.

## Broader Picture

- **Tier Gate (T3)** reserves an NFC unit and a sewing slot at a Hub; this page reflects those reservations and guards against double booking.
- **Hub Console** moves a reserved UID to installed after sewing + read/write tests.
- **Dashboard** raises low stock and quarantine alerts; they are resolvable here.

## Views & Actions

### A) Hub Overview (Default)

**Goal:** See NFC health per Hub and act before shortages or quality issues hit.

**Shows per Hub (Paris / London):**
- Counts by status: stock | reserved | installed | rma | quarantined
- Threshold (editable) + Low-stock badge
- Burn rate (7d/30d: installs/day)
- Days of cover (free stock ÷ burn_rate_7d)
- Upcoming T3 demand (planned T3 shipments next 7/14 days)
- Lot health: any lot under quarantine or unusually high failure rate (read/write fails)

**Behavior:**
- Status chip coloring: Green/Amber/Red based on Days of cover vs threshold
- Clicking a Hub opens Hub detail (UID table) filtered to that Hub
- Create transfer button appears when low-stock

### B) Hub Detail View

**Shows:**
- Individual NFC UIDs with test results (read/write status)
- Lot information and batch tracking
- Reservation and installation history
- RMA tracking with reasons

**Actions:**
- Filter by status, lot, or search UIDs
- View test results and failure reasons
- Process RMA for defective units
- Quarantine problematic lots

## Technical Implementation

### Backend API
- **Location:** `/backend/lib/sprint8/nfcInventoryAPI.js`
- **Routes:** `/backend/routes/nfcInventory.js`
- **Database:** Uses `inventory_nfc` table from hub inventory system migration

### Frontend Components
- **Main Page:** `/frontend/src/app/sprint-8/inventory/nfc/page.tsx`
- **API Client:** `/frontend/src/lib/nfcInventoryApi.ts`

### Key Features
1. **Real-time Hub Status** - Shows current stock levels and health per hub
2. **Burn Rate Analytics** - Calculates installation rates and coverage days
3. **Lot Quality Monitoring** - Tracks test failures and quarantine status
4. **Transfer Management** - Creates transfers between hubs for stock balancing
5. **Tier 3 Integration** - Validates stock availability for reservation

### Database Tables Used
- `inventory_nfc` - Main NFC inventory tracking
- `logistics_hubs` - Hub information and capacity
- `hub_processing_jobs` - Tier 3 demand planning
- `hub_incidents` - Quality issues and transfers
- `inventory_audit_log` - Complete change history

### API Endpoints
- `GET /api/nfc-inventory/hub-overview` - Hub dashboard data
- `GET /api/nfc-inventory/hub/:id/detail` - Detailed hub inventory
- `POST /api/nfc-inventory/reserve` - Reserve NFC for shipment
- `POST /api/nfc-inventory/install` - Mark NFC as installed
- `POST /api/nfc-inventory/quarantine-lot` - Quarantine problematic lots
- `POST /api/nfc-inventory/create-transfer` - Create inter-hub transfers

## Usage Notes

- The system uses Paris (CDG01) and London (LHR01) hubs by default
- NFC status progression: stock → reserved → installed
- Quarantine is a special defective status for quality issues
- Transfer requests create incident records for tracking
- All changes are logged in the audit trail

## Development

To test the system:
1. Ensure the database migrations have been run
2. Start the backend server on port 4000  
3. Access the page at http://localhost:3000/sprint-8/inventory/nfc
4. Use the Hub Console to simulate NFC operations
