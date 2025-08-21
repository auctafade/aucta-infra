// Incident Event System
// Handles emission of events for dashboard sync, client notifications, and analytics

export interface IncidentEvent {
  type: 'incident.opened' | 'incident.updated' | 'incident.resolved';
  timestamp: string;
  actorId: string;
  actorName: string;
  data: any;
}

export interface IncidentOpenedEvent extends IncidentEvent {
  type: 'incident.opened';
  data: {
    incidentId: string;
    shipmentId: string;
    type: 'customs' | 'delay' | 'damage' | 'lost' | 'docs' | 'address' | 'payment_hold';
    severity: 'S1' | 'S2' | 'S3' | 'S4';
    ownerId?: string;
    slaDueAt: string;
    clientName: string;
    contactName: string;
    leg: string;
    hub: string;
    carrier: string;
  };
}

export interface IncidentUpdatedEvent extends IncidentEvent {
  type: 'incident.updated';
  data: {
    incidentId: string;
    field: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  };
}

export interface IncidentResolvedEvent extends IncidentEvent {
  type: 'incident.resolved';
  data: {
    incidentId: string;
    shipmentId: string;
    outcome: string;
    postMortem: boolean;
    postMortemContent?: string;
    passportImpact: boolean;
    overrideReason?: string;
  };
}

class IncidentEventEmitter {
  private listeners: Map<string, Array<(event: IncidentEvent) => void>> = new Map();

  on(eventType: string, callback: (event: IncidentEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: (event: IncidentEvent) => void) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: IncidentEvent) {
    console.log('📢 Incident Event Emitted:', event);
    
    // Emit to specific event type listeners
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }

    // Emit to all listeners
    const allCallbacks = this.listeners.get('*');
    if (allCallbacks) {
      allCallbacks.forEach(callback => callback(event));
    }

    // In real implementation, this would:
    // 1. Send to backend API for persistence
    // 2. Update dashboard alerts
    // 3. Trigger client notifications (if client-visible)
    // 4. Feed SLA analytics
    // 5. Update related systems (Passport, etc.)
    
    this.mockSystemIntegrations(event);
  }

  private mockSystemIntegrations(event: IncidentEvent) {
    switch (event.type) {
      case 'incident.opened':
        console.log('🔔 Dashboard Alert Created:', {
          alertId: `alert-${event.data.incidentId}`,
          type: 'incident',
          severity: event.data.severity,
          message: `New ${event.data.type} incident: ${event.data.incidentId}`,
          deepLink: `/sprint-8/logistics/incidents?incident=${event.data.incidentId}`
        });
        
        console.log('📊 SLA Analytics Updated:', {
          incidentId: event.data.incidentId,
          severity: event.data.severity,
          slaDueAt: event.data.slaDueAt,
          startTime: event.timestamp
        });
        break;

      case 'incident.updated':
        console.log('🔄 Dashboard Alert Updated:', {
          incidentId: event.data.incidentId,
          field: event.data.field,
          newValue: event.data.newValue
        });
        break;

      case 'incident.resolved':
        console.log('✅ Dashboard Alert Cleared:', {
          incidentId: event.data.incidentId,
          resolution: event.data.outcome
        });
        
        if (event.data.passportImpact) {
          console.log('🛂 Passport System Notified:', {
            incidentId: event.data.incidentId,
            shipmentId: event.data.shipmentId,
            action: event.data.overrideReason ? 'unblock_with_override' : 'unblock',
            overrideReason: event.data.overrideReason
          });
        }
        
        console.log('📈 SLA Analytics Completed:', {
          incidentId: event.data.incidentId,
          resolutionTime: event.timestamp,
          hasPostMortem: event.data.postMortem
        });
        break;
    }
  }
}

// Global incident event emitter instance
export const incidentEvents = new IncidentEventEmitter();

// Helper functions for common event emissions
export const emitIncidentOpened = (
  incidentData: Omit<IncidentOpenedEvent['data'], 'slaDueAt'> & { slaDueAt: string },
  actor: { id: string; name: string }
): void => {
  incidentEvents.emit({
    type: 'incident.opened',
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    data: incidentData
  });
};

export const emitIncidentUpdated = (
  updateData: IncidentUpdatedEvent['data'],
  actor: { id: string; name: string }
): void => {
  incidentEvents.emit({
    type: 'incident.updated',
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    data: updateData
  });
};

export const emitIncidentResolved = (
  resolutionData: IncidentResolvedEvent['data'],
  actor: { id: string; name: string }
): void => {
  incidentEvents.emit({
    type: 'incident.resolved',
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    data: resolutionData
  });
};

// Deep linking support
export const createIncidentDeepLink = (incidentId: string): string => {
  return `/sprint-8/logistics/incidents?incident=${incidentId}`;
};

export const createNewIncidentDeepLink = (params?: {
  type?: string;
  shipmentId?: string;
  severity?: string;
}): string => {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.shipmentId) searchParams.set('shipmentId', params.shipmentId);
  if (params?.severity) searchParams.set('severity', params.severity);
  
  const queryString = searchParams.toString();
  return `/sprint-8/logistics/incidents/create${queryString ? `?${queryString}` : ''}`;
};
