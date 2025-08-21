// backend/lib/sprint8/contactEvents.js
const EventEmitter = require('events');

// Create a singleton event emitter for contact events
class ContactEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.telemetry = {
      searchTimes: [],
      linkTimes: [],
      mergeRate: 0,
      kycPassRate: 0,
      reuseRate: 0
    };
  }

  // Emit contact event with standardized structure
  emitContactEvent(eventType, data) {
    const event = {
      eventType,
      timestamp: new Date().toISOString(),
      ...data
    };

    console.log(`Contact Event: ${eventType}`, event);
    this.emit(eventType, event);
    
    // Store in database for audit trail
    this.storeEvent(event);
    
    return event;
  }

  // Store event in database (mock implementation)
  async storeEvent(event) {
    // In real implementation, store in database
    console.log('Storing event:', event);
  }

  // Telemetry tracking
  trackSearchTime(timeMs) {
    this.telemetry.searchTimes.push(timeMs);
    if (this.telemetry.searchTimes.length > 1000) {
      this.telemetry.searchTimes = this.telemetry.searchTimes.slice(-1000);
    }
  }

  trackLinkTime(timeMs) {
    this.telemetry.linkTimes.push(timeMs);
    if (this.telemetry.linkTimes.length > 1000) {
      this.telemetry.linkTimes = this.telemetry.linkTimes.slice(-1000);
    }
  }

  updateMergeRate(rate) {
    this.telemetry.mergeRate = rate;
  }

  updateKYCPassRate(rate) {
    this.telemetry.kycPassRate = rate;
  }

  updateReuseRate(rate) {
    this.telemetry.reuseRate = rate;
  }

  getTelemetry() {
    return {
      ...this.telemetry,
      avgSearchTime: this.telemetry.searchTimes.length > 0 ? 
        this.telemetry.searchTimes.reduce((a, b) => a + b, 0) / this.telemetry.searchTimes.length : 0,
      avgLinkTime: this.telemetry.linkTimes.length > 0 ?
        this.telemetry.linkTimes.reduce((a, b) => a + b, 0) / this.telemetry.linkTimes.length : 0
    };
  }
}

const contactEventEmitter = new ContactEventEmitter();

// Event emission functions
function emitContactCreated(contactId, role, kycStatus, actorId) {
  return contactEventEmitter.emitContactEvent('contact.created', {
    contactId,
    role,
    kycStatus,
    actorId
  });
}

function emitContactUpdated(contactId, fields, actorId) {
  return contactEventEmitter.emitContactEvent('contact.updated', {
    contactId,
    fields,
    actorId
  });
}

function emitContactMerged(survivorId, mergedId, actorId) {
  return contactEventEmitter.emitContactEvent('contact.merged', {
    survivorId,
    mergedId,
    actorId
  });
}

function emitContactLinkedToShipment(contactId, shipmentId, role, actorId) {
  return contactEventEmitter.emitContactEvent('contact.linked_to_shipment', {
    contactId,
    shipmentId,
    role,
    actorId
  });
}

function emitKYCRequested(contactId) {
  return contactEventEmitter.emitContactEvent('contact.kyc.requested', {
    contactId
  });
}

function emitKYCPassed(contactId) {
  return contactEventEmitter.emitContactEvent('contact.kyc.passed', {
    contactId
  });
}

function emitKYCFailed(contactId) {
  return contactEventEmitter.emitContactEvent('contact.kyc.failed', {
    contactId
  });
}

function emitContactEvent(eventType, data) {
  return contactEventEmitter.emitContactEvent(eventType, data);
}

// Set up event listeners for integrations
contactEventEmitter.on('contact.created', (event) => {
  // Notify Dashboard
  console.log('Notifying Dashboard of new contact:', event.contactId);
});

contactEventEmitter.on('contact.updated', (event) => {
  // Notify systems that cache contact data
  console.log('Notifying systems of contact update:', event.contactId);
});

contactEventEmitter.on('contact.linked_to_shipment', (event) => {
  // Update shipment records
  console.log('Updating shipment with contact link:', event);
});

contactEventEmitter.on('contact.kyc.passed', (event) => {
  // Update KYC analytics
  console.log('KYC passed for contact:', event.contactId);
});

module.exports = {
  contactEventEmitter,
  emitContactCreated,
  emitContactUpdated,
  emitContactMerged,
  emitContactLinkedToShipment,
  emitKYCRequested,
  emitKYCPassed,
  emitKYCFailed,
  emitContactEvent
};
