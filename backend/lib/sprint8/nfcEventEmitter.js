const EventEmitter = require('events');

/**
 * NFC Inventory Event Emitter
 * Manages system-wide events for NFC inventory state changes
 * Ensures Dashboard KPIs, Hub Console, and Tier Gate consistency
 */

class NFCInventoryEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Log all events for debugging
    this.on('newListener', (eventName) => {
      console.log(`New listener added for event: ${eventName}`);
    });
  }

  // ====================
  // EVENT EMISSION METHODS
  // ====================

  /**
   * Emit NFC received event
   * @param {Object} data - { hubId, lot, qty, actorId, ts, uids? }
   */
  emitNFCReceived(data) {
    const event = {
      type: 'inventory.nfc.received',
      hubId: data.hubId,
      lot: data.lot,
      qty: data.qty,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      uids: data.uids || null,
      evidenceFiles: data.evidenceFiles || []
    };

    console.log('Emitting inventory.nfc.received:', event);
    this.emit('inventory.nfc.received', event);
    this.emit('inventory.update', event); // General inventory update
    return event;
  }

  /**
   * Emit NFC assigned to shipment event
   * @param {Object} data - { uid, hubId, shipmentId, actorId, ts }
   */
  emitNFCAssigned(data) {
    const event = {
      type: 'inventory.nfc.assigned',
      uid: data.uid,
      hubId: data.hubId,
      shipmentId: data.shipmentId,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      previousStatus: data.previousStatus || 'stock'
    };

    console.log('Emitting inventory.nfc.assigned:', event);
    this.emit('inventory.nfc.assigned', event);
    this.emit('inventory.update', event);
    this.emit('tier.gate.update', event); // Notify Tier Gate system
    return event;
  }

  /**
   * Emit NFC installed event (from Hub Console)
   * @param {Object} data - { uid, hubId, actorId, ts, testResults }
   */
  emitNFCInstalled(data) {
    const event = {
      type: 'nfc.installed',
      uid: data.uid,
      hubId: data.hubId,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      testResults: data.testResults || { read: true, write: true },
      evidenceFiles: data.evidenceFiles || []
    };

    console.log('Emitting nfc.installed:', event);
    this.emit('nfc.installed', event);
    this.emit('inventory.update', event);
    this.emit('hub.console.update', event); // Notify Hub Console
    return event;
  }

  /**
   * Emit NFC transfer initiated event
   * @param {Object} data - { fromHub, toHub, uids, eta, actorId, ts }
   */
  emitNFCTransferred(data) {
    const event = {
      type: 'inventory.nfc.transferred',
      fromHub: data.fromHub,
      toHub: data.toHub,
      uids: Array.isArray(data.uids) ? data.uids.length : data.uids,
      uidList: Array.isArray(data.uids) ? data.uids : [],
      eta: data.eta,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      reason: data.reason || 'Hub transfer',
      transferId: data.transferId
    };

    console.log('Emitting inventory.nfc.transferred:', event);
    this.emit('inventory.nfc.transferred', event);
    this.emit('inventory.update', event);
    return event;
  }

  /**
   * Emit NFC transfer arrived event
   * @param {Object} data - { toHub, uids, ts, transferId }
   */
  emitNFCTransferArrived(data) {
    const event = {
      type: 'inventory.nfc.transfer.arrived',
      toHub: data.toHub,
      uids: Array.isArray(data.uids) ? data.uids.length : data.uids,
      uidList: Array.isArray(data.uids) ? data.uids : [],
      ts: data.ts || new Date().toISOString(),
      transferId: data.transferId,
      actorId: data.actorId || 'system'
    };

    console.log('Emitting inventory.nfc.transfer.arrived:', event);
    this.emit('inventory.nfc.transfer.arrived', event);
    this.emit('inventory.update', event);
    return event;
  }

  /**
   * Emit NFC RMA event
   * @param {Object} data - { uid, lot, reason, actorId, ts }
   */
  emitNFCRMA(data) {
    const event = {
      type: 'inventory.nfc.rma',
      uid: data.uid,
      lot: data.lot,
      reason: data.reason,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      replacementUid: data.replacementUid || null,
      evidenceFiles: data.evidenceFiles || []
    };

    console.log('Emitting inventory.nfc.rma:', event);
    this.emit('inventory.nfc.rma', event);
    this.emit('inventory.update', event);
    this.emit('quality.alert', event); // Notify quality monitoring
    return event;
  }

  /**
   * Emit lot quarantine set event
   * @param {Object} data - { lot, reason, actorId, ts, hubId? }
   */
  emitLotQuarantineSet(data) {
    const event = {
      type: 'inventory.nfc.quarantine.set',
      lot: data.lot,
      reason: data.reason,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      hubId: data.hubId || null,
      affectedUIDs: data.affectedUIDs || 0
    };

    console.log('Emitting inventory.nfc.quarantine.set:', event);
    this.emit('inventory.nfc.quarantine.set', event);
    this.emit('inventory.update', event);
    this.emit('quality.alert', event);
    this.emit('supplier.alert', event); // Notify supplier management
    return event;
  }

  /**
   * Emit lot quarantine lifted event
   * @param {Object} data - { lot, actorId, ts, hubId? }
   */
  emitLotQuarantineLifted(data) {
    const event = {
      type: 'inventory.nfc.quarantine.lifted',
      lot: data.lot,
      actorId: data.actorId,
      ts: data.ts || new Date().toISOString(),
      hubId: data.hubId || null,
      reason: data.reason || 'Investigation complete',
      restoredUIDs: data.restoredUIDs || 0
    };

    console.log('Emitting inventory.nfc.quarantine.lifted:', event);
    this.emit('inventory.nfc.quarantine.lifted', event);
    this.emit('inventory.update', event);
    return event;
  }

  // ====================
  // SYSTEM INTEGRATION HANDLERS
  // ====================

  /**
   * Setup Dashboard KPI update handlers
   */
  setupDashboardHandlers() {
    // Update Dashboard when inventory changes
    this.on('inventory.update', (event) => {
      // Trigger Dashboard recalculation
      console.log('Dashboard KPI update triggered by:', event.type);
      // Implementation would notify Dashboard service
    });
  }

  /**
   * Setup Hub Console integration handlers
   */
  setupHubConsoleHandlers() {
    // Sync with Hub Console when NFC status changes
    this.on('hub.console.update', (event) => {
      console.log('Hub Console sync triggered by:', event.type);
      // Implementation would notify Hub Console service
    });
  }

  /**
   * Setup Tier Gate integration handlers
   */
  setupTierGateHandlers() {
    // Notify Tier Gate of reservation changes
    this.on('tier.gate.update', (event) => {
      console.log('Tier Gate sync triggered by:', event.type);
      // Implementation would notify Tier Gate service
    });
  }

  /**
   * Setup audit and supplier notification handlers
   */
  setupAuditHandlers() {
    // Log all quality issues for audit trail
    this.on('quality.alert', (event) => {
      console.log('Quality alert logged for audit:', event.type);
      // Implementation would log to audit system
    });

    // Notify supplier management of issues
    this.on('supplier.alert', (event) => {
      console.log('Supplier notification triggered:', event.type);
      // Implementation would notify supplier management
    });
  }

  /**
   * Initialize all system integrations
   */
  initializeIntegrations() {
    this.setupDashboardHandlers();
    this.setupHubConsoleHandlers();
    this.setupTierGateHandlers();
    this.setupAuditHandlers();
  }
}

// Create singleton instance
const nfcEventEmitter = new NFCInventoryEventEmitter();
nfcEventEmitter.initializeIntegrations();

module.exports = nfcEventEmitter;
