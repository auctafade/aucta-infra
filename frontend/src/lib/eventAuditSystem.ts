// Event Audit System - Structured, deduplicated events with correlation IDs
// Ensures one and only one event per confirmed action; replay safe

import { v4 as uuidv4 } from 'uuid';

// Event Types per Specification
export type SettingsEventType = 
  | 'settings.sla.updated'
  | 'settings.margin.updated' 
  | 'settings.policy.published'
  | 'settings.hub_capacity.published'
  | 'hub_capacity.changed'
  | 'settings.thresholds.updated'
  | 'settings.riskmodel.updated'
  | 'settings.policy.published';

// Core Event Structure
export interface BaseEvent {
  // Required fields per specification
  actorId: string;
  version?: string;
  effectiveAt?: string;
  fieldsChanged?: string[];
  shipmentId?: string;
  ts: string; // ISO timestamp
  correlationId: string;
  
  // Internal fields for idempotency
  eventId: string;
  eventType: SettingsEventType;
  payloadHash: string;
  
  // Pre/Post state for audit
  preState?: Record<string, any>;
  postState?: Record<string, any>;
  
  // Additional context
  sessionId?: string;
  userAgent?: string;
  clientIp?: string;
}

// Specific Event Interfaces
export interface SLAUpdatedEvent extends BaseEvent {
  eventType: 'settings.sla.updated';
  slaSection: string;
  slaField: string;
  oldValue: any;
  newValue: any;
}

export interface MarginUpdatedEvent extends BaseEvent {
  eventType: 'settings.margin.updated';
  marginSection: string;
  marginField: string;
  oldValue: any;
  newValue: any;
}

export interface PolicyPublishedEvent extends BaseEvent {
  eventType: 'settings.policy.published';
  policyType: 'sla_margin' | 'hub_capacity' | 'risk_threshold';
  policyId: string;
  publishedBy: string;
  scheduledAt?: string;
}

export interface HubCapacityPublishedEvent extends BaseEvent {
  eventType: 'settings.hub_capacity.published';
  hubId: number;
  capacityProfile: Record<string, any>;
}

export interface HubCapacityChangedEvent extends BaseEvent {
  eventType: 'hub_capacity.changed';
  hubId: number;
  changeType: 'capacity' | 'blackout' | 'maintenance' | 'exception';
  entityId?: string;
}

export interface ThresholdsUpdatedEvent extends BaseEvent {
  eventType: 'settings.thresholds.updated';
  thresholdType: 'value_bands' | 'fragility_rules' | 'brand_overrides' | 'inventory';
  thresholdId?: string;
}

export interface RiskModelUpdatedEvent extends BaseEvent {
  eventType: 'settings.riskmodel.updated';
  modelComponent: 'weights' | 'rules' | 'scoring' | 'automation';
  riskLevel?: string;
}

export type SettingsEvent = 
  | SLAUpdatedEvent 
  | MarginUpdatedEvent 
  | PolicyPublishedEvent
  | HubCapacityPublishedEvent
  | HubCapacityChangedEvent
  | ThresholdsUpdatedEvent
  | RiskModelUpdatedEvent;

// Event Processing Queue for deduplication
class EventProcessor {
  private processedEvents = new Set<string>();
  private correlationMap = new Map<string, string[]>();
  
  // Generate deterministic hash for payload to detect duplicates
  private generatePayloadHash(payload: any): string {
    const normalizedPayload = JSON.stringify(payload, Object.keys(payload).sort());
    // Use a simple hash since crypto is not available in browser
    return btoa(normalizedPayload).replace(/[/+=]/g, '').substring(0, 32);
  }

  // Check if event is duplicate based on payload hash
  private isDuplicate(payloadHash: string): boolean {
    return this.processedEvents.has(payloadHash);
  }

  // Mark event as processed
  private markProcessed(payloadHash: string, eventId: string): void {
    this.processedEvents.add(payloadHash);
  }

  // Create correlation ID or reuse existing one for related events
  private getCorrelationId(context?: { sessionId?: string; policyId?: string }): string {
    if (context?.sessionId && this.correlationMap.has(context.sessionId)) {
      const existing = this.correlationMap.get(context.sessionId);
      return existing![0]; // Return first correlation ID for session
    }
    
    const correlationId = uuidv4();
    if (context?.sessionId) {
      const existing = this.correlationMap.get(context.sessionId) || [];
      existing.push(correlationId);
      this.correlationMap.set(context.sessionId, existing);
    }
    
    return correlationId;
  }

  // Process event with idempotency checks
  async processEvent(
    eventType: SettingsEventType,
    payload: Record<string, any>,
    context: {
      actorId: string;
      sessionId?: string;
      preState?: Record<string, any>;
      postState?: Record<string, any>;
      version?: string;
      effectiveAt?: string;
      fieldsChanged?: string[];
      shipmentId?: string;
    }
  ): Promise<{ success: boolean; eventId?: string; skipped?: boolean; reason?: string }> {
    
    try {
      // Generate payload hash for idempotency
      const payloadHash = this.generatePayloadHash({
        eventType,
        payload,
        actorId: context.actorId,
        preState: context.preState,
        postState: context.postState
      });

      // Check for duplicate
      if (this.isDuplicate(payloadHash)) {
        console.log(`🔄 Event ${eventType} skipped - duplicate payload hash: ${payloadHash.substring(0, 8)}`);
        return { 
          success: true, 
          skipped: true, 
          reason: 'Duplicate payload - idempotency check prevented duplicate event' 
        };
      }

      // Create base event
      const eventId = uuidv4();
      const correlationId = this.getCorrelationId(context);
      const timestamp = new Date().toISOString();

      const baseEvent: BaseEvent = {
        eventId,
        eventType,
        payloadHash,
        actorId: context.actorId,
        version: context.version,
        effectiveAt: context.effectiveAt,
        fieldsChanged: context.fieldsChanged,
        shipmentId: context.shipmentId,
        ts: timestamp,
        correlationId,
        preState: context.preState,
        postState: context.postState,
        sessionId: context.sessionId,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
        clientIp: 'client-side' // Would be set by backend
      };

      // Send to backend for persistence
      const response = await fetch('/api/events/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        },
        body: JSON.stringify({
          ...baseEvent,
          payload
        })
      });

      if (!response.ok) {
        throw new Error(`Event API failed: ${response.status} ${response.statusText}`);
      }

      // Mark as processed only after successful backend persistence
      this.markProcessed(payloadHash, eventId);

      console.log(`✅ Event ${eventType} processed successfully:`, {
        eventId: eventId.substring(0, 8),
        correlationId: correlationId.substring(0, 8),
        payloadHash: payloadHash.substring(0, 8),
        fieldsChanged: context.fieldsChanged
      });

      return { success: true, eventId };

    } catch (error) {
      console.error(`❌ Failed to process event ${eventType}:`, error);
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Batch process multiple related events (e.g., policy publish with multiple field updates)
  async processBatch(
    events: Array<{
      eventType: SettingsEventType;
      payload: Record<string, any>;
      context: {
        actorId: string;
        sessionId?: string;
        preState?: Record<string, any>;
        postState?: Record<string, any>;
        version?: string;
        effectiveAt?: string;
        fieldsChanged?: string[];
        shipmentId?: string;
      };
    }>
  ): Promise<{ processed: number; skipped: number; failed: number; results: any[] }> {
    
    const results = [];
    let processed = 0, skipped = 0, failed = 0;

    // Use same correlation ID for all events in batch
    const batchCorrelationId = uuidv4();
    
    for (const event of events) {
      event.context.sessionId = event.context.sessionId || batchCorrelationId;
      
      const result = await this.processEvent(
        event.eventType,
        event.payload,
        event.context
      );
      
      results.push(result);
      
      if (result.success && result.skipped) skipped++;
      else if (result.success) processed++;
      else failed++;
    }

    console.log(`📊 Batch processing complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);
    
    return { processed, skipped, failed, results };
  }
}

// Global event processor instance
const eventProcessor = new EventProcessor();

// High-level API functions for each settings page
export const SettingsEventAPI = {
  
  // SLA & Margins Events
  async slaUpdated(params: {
    actorId: string;
    version: string;
    effectiveAt: string;
    slaSection: string;
    slaField: string;
    oldValue: any;
    newValue: any;
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
  }) {
    return eventProcessor.processEvent('settings.sla.updated', {
      slaSection: params.slaSection,
      slaField: params.slaField,
      oldValue: params.oldValue,
      newValue: params.newValue
    }, {
      actorId: params.actorId,
      version: params.version,
      effectiveAt: params.effectiveAt,
      fieldsChanged: [`${params.slaSection}.${params.slaField}`],
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  async marginUpdated(params: {
    actorId: string;
    version: string;
    effectiveAt: string;
    marginSection: string;
    marginField: string;
    oldValue: any;
    newValue: any;
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
  }) {
    return eventProcessor.processEvent('settings.margin.updated', {
      marginSection: params.marginSection,
      marginField: params.marginField,
      oldValue: params.oldValue,
      newValue: params.newValue
    }, {
      actorId: params.actorId,
      version: params.version,
      effectiveAt: params.effectiveAt,
      fieldsChanged: [`${params.marginSection}.${params.marginField}`],
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  async policyPublished(params: {
    actorId: string;
    version: string;
    effectiveAt: string;
    policyType: 'sla_margin' | 'hub_capacity' | 'risk_threshold';
    policyId: string;
    publishedBy: string;
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
    scheduledAt?: string;
  }) {
    return eventProcessor.processEvent('settings.policy.published', {
      policyType: params.policyType,
      policyId: params.policyId,
      publishedBy: params.publishedBy,
      scheduledAt: params.scheduledAt
    }, {
      actorId: params.actorId,
      version: params.version,
      effectiveAt: params.effectiveAt,
      fieldsChanged: ['policy_status'],
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  // Hub Capacity Events
  async hubCapacityPublished(params: {
    actorId: string;
    version: string;
    effectiveAt: string;
    hubId: number;
    capacityProfile: Record<string, any>;
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
  }) {
    return eventProcessor.processEvent('settings.hub_capacity.published', {
      hubId: params.hubId,
      capacityProfile: params.capacityProfile
    }, {
      actorId: params.actorId,
      version: params.version,
      effectiveAt: params.effectiveAt,
      fieldsChanged: ['capacity_profile'],
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  async hubCapacityChanged(params: {
    actorId: string;
    hubId: number;
    changeType: 'capacity' | 'blackout' | 'maintenance' | 'exception';
    entityId?: string;
    fieldsChanged: string[];
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
  }) {
    return eventProcessor.processEvent('hub_capacity.changed', {
      hubId: params.hubId,
      changeType: params.changeType,
      entityId: params.entityId
    }, {
      actorId: params.actorId,
      fieldsChanged: params.fieldsChanged,
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  // Thresholds & Risk Events
  async thresholdsUpdated(params: {
    actorId: string;
    version: string;
    effectiveAt: string;
    thresholdType: 'value_bands' | 'fragility_rules' | 'brand_overrides' | 'inventory';
    thresholdId?: string;
    fieldsChanged: string[];
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
  }) {
    return eventProcessor.processEvent('settings.thresholds.updated', {
      thresholdType: params.thresholdType,
      thresholdId: params.thresholdId
    }, {
      actorId: params.actorId,
      version: params.version,
      effectiveAt: params.effectiveAt,
      fieldsChanged: params.fieldsChanged,
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  async riskModelUpdated(params: {
    actorId: string;
    version: string;
    effectiveAt: string;
    modelComponent: 'weights' | 'rules' | 'scoring' | 'automation';
    riskLevel?: string;
    fieldsChanged: string[];
    preState: Record<string, any>;
    postState: Record<string, any>;
    sessionId?: string;
  }) {
    return eventProcessor.processEvent('settings.riskmodel.updated', {
      modelComponent: params.modelComponent,
      riskLevel: params.riskLevel
    }, {
      actorId: params.actorId,
      version: params.version,
      effectiveAt: params.effectiveAt,
      fieldsChanged: params.fieldsChanged,
      preState: params.preState,
      postState: params.postState,
      sessionId: params.sessionId
    });
  },

  // Batch operations for complex policy updates
  async batchUpdate(events: Parameters<typeof eventProcessor.processBatch>[0]) {
    return eventProcessor.processBatch(events);
  },

  // Idempotent policy publishing with duplicate prevention
  async publishSLAMarginPolicy(params: {
    policyData: Record<string, any>;
    actorId: string;
    changeReason: string;
    requestId?: string;
  }) {
    try {
      const response = await fetch('/api/settings/sla-margin/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-ID': params.actorId,
          'X-Request-ID': params.requestId || `sla-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          ...params.policyData,
          change_reason: params.changeReason
        })
      });

      const result = await response.json();
      
      if (result.isDuplicate) {
        console.log('🔄 SLA policy publish prevented duplicate:', result.policyId);
      } else {
        console.log('✅ SLA policy published successfully:', result.policyId);
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to publish SLA policy:', error);
      throw error;
    }
  },

  async publishRiskThresholdPolicy(params: {
    policyData: Record<string, any>;
    actorId: string;
    changeReason: string;
    requestId?: string;
  }) {
    try {
      const response = await fetch('/api/settings/risk-threshold/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-ID': params.actorId,
          'X-Request-ID': params.requestId || `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          ...params.policyData,
          change_reason: params.changeReason
        })
      });

      const result = await response.json();
      
      if (result.isDuplicate) {
        console.log('🔄 Risk policy publish prevented duplicate:', result.policyId);
      } else {
        console.log('✅ Risk policy published successfully:', result.policyId);
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to publish risk policy:', error);
      throw error;
    }
  },

  async publishHubCapacityProfile(params: {
    profileData: Record<string, any>;
    actorId: string;
    changeReason: string;
    requestId?: string;
  }) {
    try {
      const response = await fetch('/api/settings/hub-capacity/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-ID': params.actorId,
          'X-Request-ID': params.requestId || `capacity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          ...params.profileData,
          change_reason: params.changeReason
        })
      });

      const result = await response.json();
      
      if (result.isDuplicate) {
        console.log('🔄 Hub capacity publish prevented duplicate:', result.profileId);
      } else {
        console.log('✅ Hub capacity published successfully:', result.profileId);
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to publish hub capacity:', error);
      throw error;
    }
  },

  // Schedule policy for future activation
  async schedulePolicy(params: {
    policyType: 'sla_margin' | 'risk_threshold' | 'hub_capacity';
    policyData: Record<string, any>;
    effectiveAt: string;
    actorId: string;
    changeReason: string;
    requestId?: string;
  }) {
    try {
      const response = await fetch(`/api/settings/${params.policyType}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Actor-ID': params.actorId,
          'X-Request-ID': params.requestId || `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({
          policyData: params.policyData,
          effectiveAt: params.effectiveAt,
          change_reason: params.changeReason
        })
      });

      const result = await response.json();
      
      if (result.isDuplicate) {
        console.log('🔄 Policy schedule prevented duplicate:', result.policyId);
      } else {
        console.log('✅ Policy scheduled successfully for:', params.effectiveAt, result.policyId);
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to schedule policy:', error);
      throw error;
    }
  },

  // Check data integrity
  async checkDataIntegrity() {
    try {
      const response = await fetch('/api/settings/integrity/check');
      const result = await response.json();
      
      if (result.violations && result.violations.length > 0) {
        console.warn('⚠️ Data integrity violations found:', result.violations);
      } else {
        console.log('✅ Data integrity check passed');
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to check data integrity:', error);
      throw error;
    }
  },

  // Get active policies summary
  async getActivePolicies() {
    try {
      const response = await fetch('/api/settings/active-policies');
      const result = await response.json();
      
      console.log('📊 Active policies:', result.summary);
      return result;
    } catch (error) {
      console.error('❌ Failed to get active policies:', error);
      throw error;
    }
  }
};

// Utility for creating pre/post state snapshots
export const createStateSnapshot = (data: any, fields?: string[]): Record<string, any> => {
  if (fields) {
    const snapshot: Record<string, any> = {};
    fields.forEach(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], data);
      snapshot[field] = value;
    });
    return snapshot;
  }
  
  return JSON.parse(JSON.stringify(data)); // Deep clone
};

export default SettingsEventAPI;
