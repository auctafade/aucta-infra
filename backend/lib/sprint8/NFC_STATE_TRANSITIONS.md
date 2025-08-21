# NFC Inventory State Transitions & Events

## Overview

This document outlines the comprehensive state transition system implemented for NFC inventory management, including data effects, event emission, and audit trails that ensure Dashboard KPIs, Hub Console, and Tier Gate consistency.

## State Transition Matrix

### Valid Transitions

| From Status | To Status | Action | Description |
|-------------|-----------|--------|-------------|
| `null` | `available` | `receive` | Initial NFC creation at hub |
| `available` | `assigned` | `assign` | Reserve for T3 shipment |
| `assigned` | `installed` | `install` | Complete sewing + testing (write-once) |
| `assigned` | `available` | `unreserve` | Cancel reservation (Ops only) |
| `available` | `quarantined` | `quarantine` | Quality issue identified |
| `assigned` | `quarantined` | `quarantine` | Quality issue on reserved NFC |
| `quarantined` | `available` | `lift_quarantine` | Issue resolved |
| `available` | `in_transit` | `transfer` | Inter-hub transfer initiated |
| `in_transit` | `available` | `transfer_arrive` | Transfer completed |
| `any` | `rma` | `rma` | Defective unit (terminal state) |

### Blocked Transitions

- `installed` → `any` (except `rma`) - Write-once protection
- `rma` → `any` - Terminal state
- Quarantined NFCs cannot be assigned or transferred
- Reserved NFCs cannot be transferred (must unreserve first)

## Data Effects (State Changes)

### 1. Receive NFCs
```javascript
// State: n/a → stock (status=available, hubId=<hub>, lot=<lot>)
{
  nfc_uid: "NFC-LOT-001-0001",
  status: "available",
  current_hub_id: hubId,
  batch_number: lot,
  supplier: supplierRef,
  received_at: timestamp,
  created_by: actorId
}
```

**Audit Log**: Creation entry with evidence files (delivery notes, QC reports)

### 2. Assign to Shipment
```javascript
// State: stock → reserved (status=assigned, assignedShipmentId=<id>)
{
  status: "assigned",
  assigned_shipment_id: shipmentId,
  assigned_hub_id: hubId,
  assigned_at: timestamp
}
```

**Audit Log**: Status change with shipment linkage
**Guards**: 
- Cannot assign quarantined NFCs
- Cannot assign same UID to multiple shipments
- Warns if Hub sewing capacity not held

### 3. Install (Hub Console)
```javascript
// State: reserved → installed (status=installed, write-once)
{
  status: "installed",
  installed_at: timestamp,
  read_test_passed: true,
  write_test_passed: true,
  last_test_date: timestamp,
  test_notes: "Installation test completed"
}
```

**Audit Log**: Installation with test results and evidence
**Protection**: Write-once status (only RMA allowed after installation)

### 4. Mark RMA
```javascript
// State: any → rma (status=rma, removed from free stock)
{
  status: "rma",
  rma_initiated_at: timestamp,
  rma_reason: reasonCode,
  rma_reference: `${reasonCode}: ${notes}`
}
```

**Audit Log**: RMA entry with reason codes and evidence
**Auto-Replace**: If replacement UID specified, automatically assigns to same shipment

### 5. Quarantine Lot
```javascript
// State: all non-installed UIDs of lot → quarantined
// Blocks assignment/transfer for entire lot
{
  status: "quarantined",
  test_notes: "QUARANTINE: ${reason}",
  updated_at: timestamp
}
```

**Audit Log**: Quarantine action for all affected UIDs
**Incident**: Creates hub incident record for tracking

### 6. Transfer Inter-Hub
```javascript
// State: stock@A → in_transit → stock@B on arrival
// Phase 1: Transfer initiation
{
  status: "in_transit",
  updated_at: timestamp
}

// Phase 2: Arrival completion
{
  status: "available",
  current_hub_id: toHubId,
  updated_at: timestamp
}
```

**Audit Log**: Two-phase logging (departure and arrival)
**Transfer Record**: Generates transfer ID for tracking

## Event Emission System

### Event Types

#### 1. `inventory.nfc.received`
```javascript
{
  type: 'inventory.nfc.received',
  hubId: number,
  lot: string,
  qty: number,
  actorId: string,
  ts: ISO_timestamp,
  uids: string[],
  evidenceFiles: object[]
}
```

#### 2. `inventory.nfc.assigned`
```javascript
{
  type: 'inventory.nfc.assigned',
  uid: string,
  hubId: number,
  shipmentId: string,
  actorId: string,
  ts: ISO_timestamp,
  previousStatus: string
}
```

#### 3. `nfc.installed` (from Hub Console)
```javascript
{
  type: 'nfc.installed',
  uid: string,
  hubId: number,
  actorId: string,
  ts: ISO_timestamp,
  testResults: object,
  evidenceFiles: object[]
}
```

#### 4. `inventory.nfc.transferred`
```javascript
{
  type: 'inventory.nfc.transferred',
  fromHub: number,
  toHub: number,
  uids: number, // count
  uidList: string[],
  eta: string,
  actorId: string,
  ts: ISO_timestamp,
  reason: string,
  transferId: string
}
```

#### 5. `inventory.nfc.transfer.arrived`
```javascript
{
  type: 'inventory.nfc.transfer.arrived',
  toHub: number,
  uids: number, // count
  uidList: string[],
  ts: ISO_timestamp,
  transferId: string,
  actorId: string
}
```

#### 6. `inventory.nfc.rma`
```javascript
{
  type: 'inventory.nfc.rma',
  uid: string,
  lot: string,
  reason: string,
  actorId: string,
  ts: ISO_timestamp,
  replacementUid: string | null,
  evidenceFiles: object[]
}
```

#### 7. `inventory.nfc.quarantine.set`
```javascript
{
  type: 'inventory.nfc.quarantine.set',
  lot: string,
  reason: string,
  actorId: string,
  ts: ISO_timestamp,
  hubId: number | null,
  affectedUIDs: number // count
}
```

#### 8. `inventory.nfc.quarantine.lifted`
```javascript
{
  type: 'inventory.nfc.quarantine.lifted',
  lot: string,
  actorId: string,
  ts: ISO_timestamp,
  hubId: number | null,
  reason: string,
  restoredUIDs: number // count
}
```

## System Integration

### Dashboard KPI Updates
Events trigger automatic recalculation of:
- Stock levels per hub
- Burn rates (7d/30d)
- Days of cover calculations
- Lot health metrics
- Alert thresholds

### Hub Console Synchronization
- Real-time inventory availability
- Reserved NFC status updates
- Installation completion notifications
- Quality issue alerts

### Tier Gate Integration
- Stock validation for reservations
- Capacity warnings
- Shipment assignment confirmations
- Quality block notifications

## Audit Trail Features

### Complete Traceability
Every transition includes:
- **Timestamp**: Exact moment of change
- **Actor**: User/system making the change
- **Evidence**: Linked files (photos, test results, documents)
- **Context**: Shipment IDs, transfer references, incident numbers

### Evidence Linking
Supports attachment of:
- Delivery notes (receive)
- QC test results (install)
- Defect photos (RMA)
- Investigation reports (quarantine)

### Query Capabilities
- Full movement history per UID
- Lot-level failure analysis
- Actor audit trails
- Evidence retrieval by audit log ID

## Enhanced API Endpoints

All state transitions available through enhanced endpoints:
- `/api/nfc-inventory/receive-batch-enhanced`
- `/api/nfc-inventory/assign-enhanced`
- `/api/nfc-inventory/install-enhanced`
- `/api/nfc-inventory/rma-enhanced`
- `/api/nfc-inventory/quarantine-enhanced`
- `/api/nfc-inventory/lift-quarantine-enhanced`
- `/api/nfc-inventory/transfer-enhanced`
- `/api/nfc-inventory/transfer-complete`

## Guardrails Implementation

### State Validation
- Validates all transitions using `validateStateTransition()`
- Prevents invalid state changes
- Protects write-once installations

### Business Logic Guards
- Cannot assign quarantined NFCs
- Cannot transfer reserved NFCs without unreserving
- Cannot unreserve once Hub job started (Ops override required)
- Lot quarantine blocks all new assignments

### Concurrency Protection
- Database transactions ensure atomic updates
- Optimistic locking on status changes
- Rollback on any failure in multi-UID operations

This comprehensive system ensures that every NFC chip is fully traceable from receipt through installation to RMA, with complete audit trails and real-time system synchronization.
