// frontend/src/lib/wgEvents.ts
// WG Event Emission System for Dashboard Updates, Inventory/Hub Notifications, and Sprint 2 Client Timeline

export interface WGAssignedEvent {
  event: 'wg.assigned';
  data: {
    shipmentId: string;
    operatorId: string;
    pickupAt: string; // ISO timestamp
    hubIntakeAt: string; // ISO timestamp
    deliveryAt: string; // ISO timestamp
    tzs: {
      pickup: string; // timezone
      hub: string; // timezone
      delivery: string; // timezone
    };
    actorId: string; // user who performed assignment
    ts: string; // event timestamp
  };
}

export interface WGSourcingStartedEvent {
  event: 'wg.sourcing.started';
  data: {
    shipmentId: string;
    filter: {
      cities: string[];
      minValue: number;
      maxDistance: number;
      urgency: 'standard' | 'premium';
    };
    slaTargetAt: string; // ISO timestamp when assignment must be completed
    actorId: string;
    ts: string;
  };
}

export interface WGSourcingAssignedEvent {
  event: 'wg.sourcing.assigned';
  data: {
    shipmentId: string;
    operatorId: string;
    timeToAssignMs: number; // milliseconds from sourcing start to assignment
    ts: string;
  };
}

export interface WGSourcingEscalatedEvent {
  event: 'wg.sourcing.escalated';
  data: {
    shipmentId: string;
    reason: string;
    channel: 'partner_vendors' | 'premium_rate' | 'geographic_expansion';
    actorId: string;
    ts: string;
  };
}

export type WGEvent = 
  | WGAssignedEvent 
  | WGSourcingStartedEvent 
  | WGSourcingAssignedEvent 
  | WGSourcingEscalatedEvent;

// Event emission service
class WGEventService {
  private static instance: WGEventService;
  private listeners: Map<string, ((event: WGEvent) => void)[]> = new Map();
  
  static getInstance(): WGEventService {
    if (!WGEventService.instance) {
      WGEventService.instance = new WGEventService();
    }
    return WGEventService.instance;
  }

  // Emit WG assignment event
  emitWGAssigned(data: Omit<WGAssignedEvent['data'], 'ts'>): void {
    const event: WGAssignedEvent = {
      event: 'wg.assigned',
      data: {
        ...data,
        ts: new Date().toISOString()
      }
    };
    
    this.emit(event);
    this.logEvent(event);
    this.updateDashboardQueues(event);
    this.notifyInventoryHub(event);
    this.updateSprint2Timeline(event);
  }

  // Emit sourcing started event
  emitSourcingStarted(data: Omit<WGSourcingStartedEvent['data'], 'ts'>): void {
    const event: WGSourcingStartedEvent = {
      event: 'wg.sourcing.started',
      data: {
        ...data,
        ts: new Date().toISOString()
      }
    };
    
    this.emit(event);
    this.logEvent(event);
  }

  // Emit sourcing assignment event
  emitSourcingAssigned(data: Omit<WGSourcingAssignedEvent['data'], 'ts'>): void {
    const event: WGSourcingAssignedEvent = {
      event: 'wg.sourcing.assigned',
      data: {
        ...data,
        ts: new Date().toISOString()
      }
    };
    
    this.emit(event);
    this.logEvent(event);
  }

  // Emit sourcing escalation event
  emitSourcingEscalated(data: Omit<WGSourcingEscalatedEvent['data'], 'ts'>): void {
    const event: WGSourcingEscalatedEvent = {
      event: 'wg.sourcing.escalated',
      data: {
        ...data,
        ts: new Date().toISOString()
      }
    };
    
    this.emit(event);
    this.logEvent(event);
  }

  // Subscribe to events
  subscribe(eventType: string, callback: (event: WGEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  // Unsubscribe from events
  unsubscribe(eventType: string, callback: (event: WGEvent) => void): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Internal emit function
  private emit(event: WGEvent): void {
    const callbacks = this.listeners.get(event.event);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }

    // Emit to global listeners
    const globalCallbacks = this.listeners.get('*');
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => callback(event));
    }
  }

  // Log event for audit trail
  private logEvent(event: WGEvent): void {
    console.log(`[WG EVENT] ${event.event}:`, event.data);
    
    // In real app, would send to audit logging service
    // this.auditService.log({
    //   type: 'wg_event',
    //   event: event.event,
    //   data: event.data,
    //   timestamp: event.data.ts
    // });
  }

  // Update dashboard queues
  private updateDashboardQueues(event: WGAssignedEvent): void {
    // In real app, would update dashboard state/cache
    console.log(`[DASHBOARD] Updating queues for shipment ${event.data.shipmentId}:`);
    console.log(`- "WG to assign" count decreased by 1`);
    console.log(`- Shipment row now shows: ${event.data.operatorId} + pickup at ${new Date(event.data.pickupAt).toLocaleTimeString()}`);
    
    // Simulate dashboard update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dashboard:update', {
        detail: {
          type: 'wg_assigned',
          shipmentId: event.data.shipmentId,
          operatorId: event.data.operatorId,
          nextSlot: event.data.pickupAt
        }
      }));
    }
  }

  // Notify Inventory/Hub for preparation
  private notifyInventoryHub(event: WGAssignedEvent): void {
    console.log(`[INVENTORY/HUB] Notification for shipment ${event.data.shipmentId}:`);
    console.log(`- Hub intake scheduled for ${new Date(event.data.hubIntakeAt).toLocaleString()}`);
    console.log(`- Prepare processing capacity and seal kit if required`);
    
    // In real app, would send notifications to hub systems
    // this.hubNotificationService.notify({
    //   type: 'wg_scheduled',
    //   shipmentId: event.data.shipmentId,
    //   hubIntakeAt: event.data.hubIntakeAt,
    //   operatorId: event.data.operatorId
    // });
  }

  // Update Sprint 2 client timeline
  private updateSprint2Timeline(event: WGAssignedEvent): void {
    console.log(`[SPRINT 2 CLIENT] Timeline update for shipment ${event.data.shipmentId}:`);
    console.log(`- Pickup: ${new Date(event.data.pickupAt).toLocaleString()}`);
    console.log(`- Delivery: ${new Date(event.data.deliveryAt).toLocaleString()}`);
    
    // In real app, would update client-facing timeline
    // this.clientTimelineService.update({
    //   shipmentId: event.data.shipmentId,
    //   status: 'pickup_scheduled',
    //   timeline: {
    //     pickup: event.data.pickupAt,
    //     delivery: event.data.deliveryAt
    //   }
    // });
  }
}

// Export singleton instance
export const wgEventService = WGEventService.getInstance();

// Utility functions for common operations
export const emitWGAssignment = (
  shipmentId: string,
  operatorId: string,
  schedule: {
    pickup: { time: Date; timezone: string };
    hubIntake: { time: Date; timezone: string };
    delivery: { time: Date; timezone: string };
  },
  actorId: string
): void => {
  wgEventService.emitWGAssigned({
    shipmentId,
    operatorId,
    pickupAt: schedule.pickup.time.toISOString(),
    hubIntakeAt: schedule.hubIntake.time.toISOString(),
    deliveryAt: schedule.delivery.time.toISOString(),
    tzs: {
      pickup: schedule.pickup.timezone,
      hub: schedule.hubIntake.timezone,
      delivery: schedule.delivery.timezone
    },
    actorId
  });
};

export const emitSourcingStart = (
  shipmentId: string,
  filter: {
    cities: string[];
    minValue: number;
    maxDistance: number;
    urgency: 'standard' | 'premium';
  },
  slaTargetMinutes: number,
  actorId: string
): void => {
  const slaTargetAt = new Date(Date.now() + slaTargetMinutes * 60 * 1000);
  
  wgEventService.emitSourcingStarted({
    shipmentId,
    filter,
    slaTargetAt: slaTargetAt.toISOString(),
    actorId
  });
};

export const emitSourcingSuccess = (
  shipmentId: string,
  operatorId: string,
  startTime: Date
): void => {
  const timeToAssignMs = Date.now() - startTime.getTime();
  
  wgEventService.emitSourcingAssigned({
    shipmentId,
    operatorId,
    timeToAssignMs
  });
};

export const emitSourcingEscalation = (
  shipmentId: string,
  reason: string,
  channel: 'partner_vendors' | 'premium_rate' | 'geographic_expansion',
  actorId: string
): void => {
  wgEventService.emitSourcingEscalated({
    shipmentId,
    reason,
    channel,
    actorId
  });
};
