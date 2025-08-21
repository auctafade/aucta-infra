# Tag Inventory Data Effects & State Transitions

## Overview
Complete implementation of tag lifecycle management with real-time state transitions, event emissions, and comprehensive audit logging. This system maintains data integrity while providing transparent tracking for dashboard KPIs and compliance requirements.

## State Transition Lifecycle

### Tag States
```
stock → reserved → applied
  ↓       ↓         ↓
 rma    stock    (final)
  ↓       ↓
(final) in_transit → stock@destination
```

### State Definitions
- **`stock`** - Available for assignment at hub
- **`reserved`** - Assigned to T2 shipment, awaiting application
- **`applied`** - Applied to physical shipment (final state)
- **`rma`** - Defective/damaged, excluded from inventory
- **`in_transit`** - Being transferred between hubs

## State Transition Functions

### 1. Receive Tags
**Function:** `receiveTagsBatch(hubId, lot, quantity, tagIds[])`

**Preconditions:** None
**State Change:** `null → stock`
**Event Emitted:** `inventory.tag.received`

```javascript
// Example usage
const newTags = receiveTagsBatch('HUB-PAR', 'LOT-2024-001', 50);
// Creates 50 tags with status 'stock' at Paris Hub
```

**Data Effects:**
- Creates new tag records with `status = 'stock'`
- Sets `hub`, `lot`, `receivedDate`, `expiryDate`
- Logs movement with action `RECEIVED`
- Emits event with `hubId`, `lot`, `qty`, `tagIds`

### 2. Assign to Shipment
**Function:** `assignTagToShipment(tagId, shipmentId, hubId)`

**Preconditions:** 
- Tag status must be `stock`
- Hub must match tag location
**State Change:** `stock → reserved`
**Event Emitted:** `inventory.tag.assigned`

```javascript
// Example usage
const result = assignTagToShipment('TAG-001', 'SHP-2024-123', 'HUB-PAR');
// Tag becomes reserved for the shipment
```

**Data Effects:**
- Updates `status = 'reserved'`
- Sets `assignedShipmentId = shipmentId`
- Logs movement with action `ASSIGNED`
- Emits event with `tagId`, `hubId`, `shipmentId`

**Guardrails:**
- ❌ Cannot assign if tag status ≠ `stock`
- ❌ Cannot assign if hub mismatch
- ❌ Cannot assign if no free stock available

### 3. Apply Tag (Hub Console Integration)
**Function:** `applyTag(tagId, hubId)`

**Preconditions:** Tag status must be `reserved`
**State Change:** `reserved → applied`
**Event Emitted:** `tag.applied`

```javascript
// Example usage (typically called from Hub Console)
const result = applyTag('TAG-001', 'HUB-PAR');
// Tag marked as applied to physical shipment
```

**Data Effects:**
- Updates `status = 'applied'`
- Logs movement with action `APPLIED`
- Emits event with `tagId`, `hubId`, `shipmentId`

**Guardrails:**
- ❌ Cannot apply if tag status ≠ `reserved`

### 4. Unreserve Tag
**Function:** `unreserveTag(tagId, reason, isOpsOverride)`

**Preconditions:** Tag status must be `reserved`
**State Change:** `reserved → stock`
**Event Emitted:** `inventory.tag.unreserved`

```javascript
// Example usage
const result = unreserveTag('TAG-001', 'Shipment cancelled', false);
// Tag returned to available stock
```

**Data Effects:**
- Updates `status = 'stock'`
- Clears `assignedShipmentId`
- Logs movement with action `UNRESERVED` or `UNRESERVED_OVERRIDE`
- Emits event with `tagId`, `reason`, `wasJobStarted`, `isOpsOverride`

**Guardrails:**
- ❌ Cannot unreserve if hub job started (unless Ops override)
- ⚠️ Requires reason for audit trail
- 🔐 Ops override bypasses job-started restriction

### 5. Mark RMA
**Function:** `markTagRMA(tagId, reason)`

**Preconditions:** None (can RMA from any state)
**State Change:** `any → rma`
**Event Emitted:** `inventory.tag.rma`

```javascript
// Example usage
const result = markTagRMA('TAG-001', 'Defective adhesive');
// Tag excluded from inventory counts
```

**Data Effects:**
- Updates `status = 'rma'`
- Logs movement with action `RMA`
- Emits event with `tagId`, `reason`, `previousStatus`

### 6. Transfer Between Hubs
**Function:** `initiateTransfer(fromHubId, toHubId, quantity, specificTagIds[], reason, eta)`

**Preconditions:** Tags must have `status = 'stock'`
**State Changes:** `stock@hubA → in_transit → stock@hubB`
**Events Emitted:** `inventory.tag.transferred`, `inventory.tag.transfer.arrived`

```javascript
// Example usage
const transfer = initiateTransfer('HUB-PAR', 'HUB-LON', 100, [], 'stock_balancing');
// Later: confirmTransferArrival(transfer.id)
```

**Phase 1 - Initiate Transfer:**
- Updates selected tags to `status = 'in_transit'`
- Creates transfer record with `status = 'in_transit'`
- Logs movement with action `TRANSFER_INITIATED`
- Emits `inventory.tag.transferred` event

**Phase 2 - Confirm Arrival:**
- Updates tags to `status = 'stock'` at destination hub
- Updates transfer record to `status = 'completed'`
- Logs movement with action `TRANSFER_ARRIVED`
- Emits `inventory.tag.transfer.arrived` event

**Guardrails:**
- ❌ Cannot transfer reserved/applied tags
- ❌ Cannot transfer more than available stock
- ⚠️ Requires sufficient stock at source hub

## Event Emission Framework

### Event Structure
```javascript
{
  id: "evt-1234567890-abc123",
  type: "inventory.tag.received",
  payload: {
    hubId: "HUB-PAR",
    lot: "LOT-2024-001",
    qty: 50,
    tagIds: ["TAG-001", "TAG-002", ...],
    ts: "2024-01-15T14:30:00.000Z",
    actorId: "user.ops.admin"
  },
  timestamp: "2024-01-15T14:30:00.000Z"
}
```

### Event Types

#### Tag Lifecycle Events
- **`inventory.tag.received`** - Batch received at hub
- **`inventory.tag.assigned`** - Tag assigned to T2 shipment  
- **`tag.applied`** - Tag applied at Hub Console
- **`inventory.tag.unreserved`** - Tag unreserved with reason
- **`inventory.tag.rma`** - Tag marked as defective

#### Transfer Events
- **`inventory.tag.transferred`** - Transfer initiated between hubs
- **`inventory.tag.transfer.arrived`** - Transfer completed at destination

### Dashboard Integration
Events are emitted to maintain real-time KPI accuracy:

- **Stock Levels** - Updated on receive/transfer/rma events
- **Burn Rates** - Calculated from applied events
- **Alert Thresholds** - Monitored via stock level changes
- **Transfer Status** - Tracked via transfer events

## Movement Logging & Audit Trail

### Movement Log Structure
```javascript
{
  id: "mov-1234567890-xyz789",
  tagId: "TAG-001",
  action: "ASSIGNED",
  timestamp: "2024-01-15T14:30:00.000Z",
  actorId: "user.ops.admin",
  actorName: "Operations Admin",
  hubId: "HUB-PAR",
  shipmentId: "SHP-2024-123",
  previousStatus: "stock",
  newStatus: "reserved",
  notes: "Assigned to shipment SHP-2024-123"
}
```

### Audit Trail Features
- **Immutable Records** - Movement logs never deleted/modified
- **Actor Tracking** - Every action attributed to user
- **Timestamped** - Precise timing for compliance
- **Status Transitions** - Before/after states recorded
- **Context Rich** - Includes shipment IDs, hub locations, reasons

## Real-time Monitoring

### Event Log View
- **Live Event Stream** - Real-time display of all events
- **JSON Payloads** - Full event data for debugging
- **Actor Attribution** - Who performed each action
- **Event Filtering** - By type, time, actor
- **Clear History** - Admin function to reset log

### Transfer Status Tracker
- **Active Transfers** - In-transit status monitoring
- **Completion Actions** - One-click arrival confirmation
- **Transfer History** - Complete audit trail
- **ETA Tracking** - Expected vs actual arrival times

### Tag History Modal
- **Per-Tag Timeline** - Complete movement history
- **Visual Status Flow** - State transition indicators
- **Context Details** - Shipments, transfers, reasons
- **Actor Trail** - Who handled each movement

## Technical Implementation

### State Validation
```javascript
// Example validation in assignTagToShipment
const tag = mockInventory.find(t => t.id === tagId);
if (!tag) throw new Error('Tag not found');
if (tag.status !== 'stock') throw new Error(`Cannot assign tag with status: ${tag.status}`);
if (tag.hub !== hubId) throw new Error('Hub mismatch');
```

### Error Handling
- **Precondition Checks** - Validate state before transitions
- **Business Rules** - Enforce operational constraints  
- **User Feedback** - Clear error messages in UI
- **Rollback Protection** - Failed operations don't corrupt state

### Performance Considerations
- **Client-side Calculations** - No backend dependency for demo
- **State Management** - React hooks for reactive updates
- **Memory Efficient** - Movement logs and events use circular buffers
- **Real-time UI** - Immediate feedback on all operations

### Integration Points
- **Hub Console** - Receives applied events via WebSocket
- **Tier Gate** - Monitors reserved tag status
- **Dashboard** - Consumes all events for KPI updates
- **Audit System** - Movement logs for compliance reporting

## Usage Examples

### Complete Tag Lifecycle
```javascript
// 1. Receive batch
const tags = receiveTagsBatch('HUB-PAR', 'LOT-2024-001', 10);

// 2. Assign to shipment
const assignment = assignTagToShipment('TAG-001', 'SHP-2024-123', 'HUB-PAR');

// 3. Apply at Hub Console (would be called from Hub Console)
const application = applyTag('TAG-001', 'HUB-PAR');

// Each step emits events and logs movements automatically
```

### Emergency Unreserve with Override
```javascript
try {
  const result = unreserveTag('TAG-001', 'Client cancelled urgently', false);
} catch (error) {
  // If job started, requires Ops override
  if (error.message.includes('job already started')) {
    const override = unreserveTag('TAG-001', 'Client cancelled urgently', true);
  }
}
```

### Transfer with Alert Resolution
```javascript
// Alert triggered: London Hub below threshold
const alert = getHubAlerts().find(a => a.hubId === 'HUB-LON');

// Create transfer to resolve alert
const transfer = initiateTransfer(
  'HUB-PAR',           // Source hub with surplus
  'HUB-LON',           // Destination hub with shortage  
  alert.shortfall,     // Exact amount needed
  [],                  // Auto-select tags
  'stock_balancing'    // Reason for audit
);

// Later: confirm arrival
const completion = confirmTransferArrival(transfer.id);
```

## Future Enhancements

### Backend Integration
- **WebSocket Events** - Real-time cross-user synchronization
- **Database Persistence** - PostgreSQL with audit tables
- **API Endpoints** - RESTful CRUD operations
- **Authentication** - JWT-based role permissions

### Advanced Features
- **Batch Operations** - Multi-tag state transitions
- **Scheduled Transfers** - Automated stock balancing
- **Predictive Analytics** - ML-based demand forecasting
- **Mobile App** - Scanner-based tag operations

### Compliance & Security
- **Immutable Audit** - Blockchain-based movement logs
- **Digital Signatures** - Cryptographic operation verification
- **Regulatory Reporting** - Automated compliance exports
- **Data Retention** - Configurable archival policies

This implementation provides a complete foundation for tag inventory management with enterprise-grade audit trails and real-time monitoring capabilities.

