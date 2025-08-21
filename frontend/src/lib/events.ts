// events.ts - Telemetry and system hooks for AUCTA
// This service handles event emission for analytics, monitoring, and downstream service integration

export interface TelemetryEvent {
  event: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface ShipmentCreatedEvent extends TelemetryEvent {
  event: 'shipment.created';
  metadata: {
    shipment_id: string;
    actor: string;
    ts: number;
  };
}

export interface IntakeCompletedEvent extends TelemetryEvent {
  event: 'intake.completed';
  metadata: {
    shipment_id: string;
    completeness_score: number;
    has_docs: boolean;
    ts: number;
  };
}

export interface IntakeAutosaveEvent extends TelemetryEvent {
  event: 'intake.autosave';
  metadata: {
    draft_id: string;
    fields_changed: string[];
    ts: number;
  };
}

export interface IntakeValidationErrorEvent extends TelemetryEvent {
  event: 'intake.validation.error';
  metadata: {
    field: string;
    code: string;
    ts: number;
  };
}

export type TelemetryEventType = 
  | ShipmentCreatedEvent 
  | IntakeCompletedEvent 
  | IntakeAutosaveEvent 
  | IntakeValidationErrorEvent;

class EventService {
  private listeners: Map<string, ((event: TelemetryEvent) => void)[]> = new Map();
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor() {
    // Initialize event listeners for development
    if (this.isDevelopment) {
      this.setupDevelopmentListeners();
    }
  }

  /**
   * Emit a telemetry event
   * In production, this would send to analytics services, webhooks, etc.
   */
  emit(event: TelemetryEvent): void {
    // Log to console in development
    if (this.isDevelopment) {
      console.log('📊 TELEMETRY EVENT:', event);
    }

    // Notify local listeners
    const eventListeners = this.listeners.get(event.event) || [];
    eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.event}:`, error);
      }
    });

    // Send to backend API (if available)
    this.sendToBackend(event);

    // Send to analytics services (if configured)
    this.sendToAnalytics(event);
  }

  /**
   * Emit shipment.created event
   * Critical for downstream services (Tier Gate, Dashboard, Client App)
   */
  emitShipmentCreated(shipmentId: string, actor: string): void {
    const event: ShipmentCreatedEvent = {
      event: 'shipment.created',
      timestamp: Date.now(),
      metadata: {
        shipment_id: shipmentId,
        actor,
        ts: Date.now()
      }
    };

    this.emit(event);
  }

  /**
   * Emit intake.completed event
   * Indicates successful form completion with completeness metrics
   */
  emitIntakeCompleted(shipmentId: string, completenessScore: number, hasDocs: boolean): void {
    const event: IntakeCompletedEvent = {
      event: 'intake.completed',
      timestamp: Date.now(),
      metadata: {
        shipment_id: shipmentId,
        completeness_score: completenessScore,
        has_docs: hasDocs,
        ts: Date.now()
      }
    };

    this.emit(event);
  }

  /**
   * Emit intake.autosave event (optional analytics)
   * Tracks autosave behavior for UX optimization
   */
  emitIntakeAutosave(draftId: string, fieldsChanged: string[]): void {
    const event: IntakeAutosaveEvent = {
      event: 'intake.autosave',
      timestamp: Date.now(),
      metadata: {
        draft_id: draftId,
        fields_changed: fieldsChanged,
        ts: Date.now()
      }
    };

    this.emit(event);
  }

  /**
   * Emit intake.validation.error event (optional analytics)
   * Tracks validation errors for form optimization
   */
  emitIntakeValidationError(field: string, code: string): void {
    const event: IntakeValidationErrorEvent = {
      event: 'intake.validation.error',
      timestamp: Date.now(),
      metadata: {
        field,
        code,
        ts: Date.now()
      }
    };

    this.emit(event);
  }

  /**
   * Subscribe to specific event types
   * Useful for components that need to react to events
   */
  on(eventType: string, listener: (event: TelemetryEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    this.listeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Send event to backend API
   */
  private async sendToBackend(event: TelemetryEvent): Promise<void> {
    try {
      // In production, this would send to a dedicated telemetry endpoint
      if (typeof window !== 'undefined' && window.fetch) {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
      }
    } catch (error) {
      // Silently fail - telemetry shouldn't break user experience
      if (this.isDevelopment) {
        console.warn('Failed to send telemetry to backend:', error);
      }
    }
  }

  /**
   * Send event to analytics services
   */
  private sendToAnalytics(event: TelemetryEvent): void {
    try {
      // Google Analytics 4
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', event.event, {
          ...event.metadata,
          timestamp: event.timestamp,
        });
      }

      // Mixpanel
      if (typeof window !== 'undefined' && (window as any).mixpanel) {
        (window as any).mixpanel.track(event.event, {
          ...event.metadata,
          timestamp: event.timestamp,
        });
      }

      // Custom analytics
      if (typeof window !== 'undefined' && (window as any).auctaAnalytics) {
        (window as any).auctaAnalytics.track(event.event, event.metadata);
      }
    } catch (error) {
      // Silently fail - analytics shouldn't break user experience
      if (this.isDevelopment) {
        console.warn('Failed to send telemetry to analytics:', error);
      }
    }
  }

  /**
   * Setup development-specific event listeners
   */
  private setupDevelopmentListeners(): void {
    // Listen for shipment.created events to simulate downstream service integration
    this.on('shipment.created', (event) => {
      console.log('🚀 Downstream Service Integration:');
      console.log('  - Tier Gate: New shipment ready for classification');
      console.log('  - Dashboard: Added to "To classify" queue');
      console.log('  - Client App: Notification sent to operator');
      console.log('  - Event:', event);
    });

    // Listen for intake.completed events
    this.on('intake.completed', (event) => {
      console.log('✅ Intake Completion Metrics:');
      console.log(`  - Completeness Score: ${event.metadata.completeness_score}%`);
      console.log(`  - Has Documents: ${event.metadata.has_docs ? 'Yes' : 'No'}`);
      console.log(`  - Shipment ID: ${event.metadata.shipment_id}`);
    });

    // Listen for autosave events
    this.on('intake.autosave', (event) => {
      console.log('💾 Autosave Analytics:');
      console.log(`  - Draft ID: ${event.metadata.draft_id}`);
      console.log(`  - Fields Changed: ${event.metadata.fields_changed.join(', ')}`);
    });

    // Listen for validation errors
    this.on('intake.validation.error', (event) => {
      console.log('⚠️  Validation Error Analytics:');
      console.log(`  - Field: ${event.metadata.field}`);
      console.log(`  - Error Code: ${event.metadata.code}`);
    });
  }

  /**
   * Calculate completeness score for a shipment form
   * Returns percentage (0-100) based on required fields completion
   */
  calculateCompletenessScore(formData: any): number {
    const requiredFields = [
      'reference', 'declaredValue', 'weight', 'length', 'width', 'height',
      'sender.fullName', 'sender.email', 'sender.phone', 'sender.city', 'sender.country',
      'buyer.fullName', 'buyer.email', 'buyer.phone', 'buyer.city', 'buyer.country'
    ];

    let completedFields = 0;
    const totalFields = requiredFields.length;

    requiredFields.forEach(field => {
      const value = this.getNestedValue(formData, field);
      if (value && value.toString().trim() !== '') {
        completedFields++;
      }
    });

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if shipment has supporting documents
   */
  hasSupportingDocuments(formData: any): boolean {
    return formData.files && formData.files.length > 0;
  }

  /**
   * Generate a unique draft ID for autosave tracking
   */
  generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const eventService = new EventService();

// Export convenience functions
export const emitShipmentCreated = (shipmentId: string, actor: string) => 
  eventService.emitShipmentCreated(shipmentId, actor);

export const emitIntakeCompleted = (shipmentId: string, completenessScore: number, hasDocs: boolean) => 
  eventService.emitIntakeCompleted(shipmentId, completenessScore, hasDocs);

export const emitIntakeAutosave = (draftId: string, fieldsChanged: string[]) => 
  eventService.emitIntakeAutosave(draftId, fieldsChanged);

export const emitIntakeValidationError = (field: string, code: string) => 
  eventService.emitIntakeValidationError(field, code);

export default eventService;
