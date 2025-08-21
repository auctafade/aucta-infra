// Enhanced Incident Data Model with Edge Case Handling
// Comprehensive validation, conflict detection, and telemetry tracking

export interface IncidentDataModel {
  // Core identifiers
  id: string;
  shipmentId: string;
  legId?: string;
  hubId?: string;
  
  // Classification
  type: 'customs' | 'delay' | 'damage' | 'lost' | 'docs' | 'address' | 'payment_hold';
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  status: 'open' | 'investigating' | 'waiting_third_party' | 'on_hold' | 'resolved' | 'canceled';
  tier: 1 | 2 | 3;
  
  // Ownership
  ownerId?: string;
  ownerName?: string;
  
  // Timing
  createdAt: string;
  updatedAt: string;
  slaDueAt: string;
  resolvedAt?: string;
  
  // Content
  title: string;
  description: string;
  resolution?: string;
  resolutionNotes?: string;
  
  // Client information
  clientName: string;
  contactName: string;
  
  // Relationships
  relatedIncidents: string[];
  duplicateWarnings: DuplicateWarning[];
  
  // Manual override tracking
  manualUpdates: ManualUpdate[];
  
  // Communication tracking
  clientCommunications: ClientCommunication[];
  lastClientNotification?: string;
  
  // Playbook data
  playbookData: PlaybookData;
  
  // Post-mortem (T2/T3)
  postMortem?: PostMortem;
  
  // Telemetry
  telemetry: IncidentTelemetry;
  
  // Conflict tracking
  activeConflicts: ConflictWarning[];
}

export interface DuplicateWarning {
  incidentId: string;
  type: string;
  severity: string;
  status: string;
  overlapReason: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface ManualUpdate {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  field: string;
  value: any;
  reason: string;
  source: 'manual' | 'api_failure' | 'override';
  apiContext?: {
    service: string;
    errorCode?: string;
    retryAttempts: number;
  };
}

export interface ClientCommunication {
  id: string;
  timestamp: string;
  type: 'notification' | 'update' | 'resolution' | 'escalation';
  channel: 'email' | 'sms' | 'push' | 'webhook';
  template: string;
  content: string;
  status: 'sent' | 'delivered' | 'failed' | 'blocked_cooling_off';
  readStatus?: 'unread' | 'read' | 'clicked';
}

export interface PlaybookData {
  type: string;
  version: string;
  steps: PlaybookStep[];
  completionRate: number;
  requiredStepsCompleted: boolean;
  blockedBy?: string[];
}

export interface PlaybookStep {
  id: string;
  order: number;
  label: string;
  description: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  inputType: 'checkbox' | 'text' | 'date' | 'file' | 'select';
  value?: any;
  dependencies?: string[];
  blockers?: ConflictWarning[];
}

export interface PostMortem {
  rootCause: string;
  correctiveActions: string[];
  preventiveMeasures: string[];
  completedBy: string;
  completedAt: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface IncidentTelemetry {
  timeToOwnMs?: number;
  timeToFirstActionMs?: number;
  timeToResolveMs?: number;
  reopenCount: number;
  clientNotificationCount: number;
  slaBreached: boolean;
  slaBreachReasonCode?: string;
  escalationCount: number;
  manualOverrideCount: number;
  conflictCount: number;
  performanceMetrics: {
    avgResponseTime: number;
    userSatisfactionScore?: number;
    resolutionQualityScore?: number;
  };
}

export interface ConflictWarning {
  id: string;
  type: 'data_conflict' | 'workflow_conflict' | 'system_conflict';
  severity: 'blocking' | 'warning' | 'info';
  title: string;
  description: string;
  conflictingSources: string[];
  suggestedResolution?: string;
  autoResolvable: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Edge Case Handlers
export class IncidentEdgeCaseHandler {
  // Multiple incidents per shipment handling
  static checkForDuplicates(newIncident: Partial<IncidentDataModel>, existingIncidents: IncidentDataModel[]): DuplicateWarning[] {
    const warnings: DuplicateWarning[] = [];
    
    const shipmentIncidents = existingIncidents.filter(inc => 
      inc.shipmentId === newIncident.shipmentId && 
      inc.status !== 'resolved' && 
      inc.status !== 'canceled'
    );
    
    for (const existing of shipmentIncidents) {
      // Exact type overlap
      if (existing.type === newIncident.type) {
        warnings.push({
          incidentId: existing.id,
          type: existing.type,
          severity: existing.severity,
          status: existing.status,
          overlapReason: `Duplicate ${existing.type} incident already exists for shipment ${newIncident.shipmentId}`
        });
      }
      
      // Related type conflicts
      const conflictMap: { [key: string]: string[] } = {
        'customs': ['docs'],
        'docs': ['customs'],
        'damage': ['lost'],
        'lost': ['damage']
      };
      
      if (conflictMap[existing.type]?.includes(newIncident.type!)) {
        warnings.push({
          incidentId: existing.id,
          type: existing.type,
          severity: existing.severity,
          status: existing.status,
          overlapReason: `Related incident type conflict: ${existing.type} vs ${newIncident.type}`
        });
      }
    }
    
    return warnings;
  }
  
  // Ownership gap detection and auto-escalation
  static checkOwnershipGaps(incidents: IncidentDataModel[]): { incident: IncidentDataModel; escalationRequired: boolean; timeUnassigned: number }[] {
    const results = [];
    const now = new Date().getTime();
    
    for (const incident of incidents) {
      if (!incident.ownerId && incident.status !== 'resolved' && incident.status !== 'canceled') {
        const createdAt = new Date(incident.createdAt).getTime();
        const timeUnassigned = now - createdAt;
        
        // Auto-escalation thresholds
        const escalationThresholds = {
          'S1': 5 * 60 * 1000,    // 5 minutes
          'S2': 15 * 60 * 1000,   // 15 minutes
          'S3': 60 * 60 * 1000,   // 1 hour
          'S4': 4 * 60 * 60 * 1000 // 4 hours
        };
        
        const threshold = escalationThresholds[incident.severity];
        const escalationRequired = timeUnassigned > threshold;
        
        if (escalationRequired || timeUnassigned > threshold * 0.8) { // Warning at 80% threshold
          results.push({
            incident,
            escalationRequired,
            timeUnassigned
          });
        }
      }
    }
    
    return results;
  }
  
  // Conflicting action detection
  static detectConflicts(incident: IncidentDataModel, proposedAction: string, actionData?: any): ConflictWarning[] {
    const conflicts: ConflictWarning[] = [];
    
    // Customs resolution conflicts
    if (proposedAction === 'resolve' && incident.type === 'customs') {
      const hasRequiredDocs = incident.playbookData.steps.find(step => 
        step.id === 'commercial_invoice' && step.completed
      );
      
      if (!hasRequiredDocs) {
        conflicts.push({
          id: `conflict-${Date.now()}`,
          type: 'workflow_conflict',
          severity: 'blocking',
          title: 'Cannot resolve customs incident',
          description: 'Commercial invoice documentation not confirmed as received by broker',
          conflictingSources: ['playbook_requirements', 'hub_documentation_status'],
          suggestedResolution: 'Complete required documentation steps before resolution',
          autoResolvable: false
        });
      }
    }
    
    // Damage resolution without photos
    if (proposedAction === 'resolve' && incident.type === 'damage') {
      const hasPhotos = incident.playbookData.steps.find(step => 
        step.id === 'damage_photos' && step.completed
      );
      
      if (!hasPhotos) {
        conflicts.push({
          id: `conflict-${Date.now()}`,
          type: 'workflow_conflict',
          severity: 'blocking',
          title: 'Cannot resolve damage incident',
          description: 'Damage assessment photos required before resolution',
          conflictingSources: ['insurance_requirements', 'hub_assessment_status'],
          suggestedResolution: 'Upload damage photos and complete assessment',
          autoResolvable: false
        });
      }
    }
    
    // Severity downgrade conflicts
    if (proposedAction === 'change_severity' && actionData?.newSeverity) {
      const currentSeverityLevel = { 'S1': 4, 'S2': 3, 'S3': 2, 'S4': 1 }[incident.severity];
      const newSeverityLevel = { 'S1': 4, 'S2': 3, 'S3': 2, 'S4': 1 }[actionData.newSeverity];
      
      if (newSeverityLevel < currentSeverityLevel && incident.telemetry.slaBreached) {
        conflicts.push({
          id: `conflict-${Date.now()}`,
          type: 'workflow_conflict',
          severity: 'warning',
          title: 'Severity downgrade on breached SLA',
          description: 'Reducing severity on an incident that has already breached SLA may affect metrics',
          conflictingSources: ['sla_tracking', 'severity_change_request'],
          suggestedResolution: 'Consider maintaining current severity until resolution',
          autoResolvable: false
        });
      }
    }
    
    return conflicts;
  }
  
  // Client communication cooling-off policy
  static checkCommunicationPolicy(incident: IncidentDataModel, proposedCommunication: Partial<ClientCommunication>): { allowed: boolean; reason?: string; suggestedDelay?: number } {
    const now = new Date().getTime();
    const recentComms = incident.clientCommunications
      .filter(comm => now - new Date(comm.timestamp).getTime() < 60 * 60 * 1000) // Last hour
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // No more than 3 communications per hour
    if (recentComms.length >= 3) {
      const oldestInHour = recentComms[recentComms.length - 1];
      const timeSinceOldest = now - new Date(oldestInHour.timestamp).getTime();
      const suggestedDelay = (60 * 60 * 1000) - timeSinceOldest;
      
      return {
        allowed: false,
        reason: 'Communication frequency limit exceeded (max 3 per hour)',
        suggestedDelay: Math.ceil(suggestedDelay / (60 * 1000)) // minutes
      };
    }
    
    // No duplicate content within 30 minutes
    const recentSimilar = recentComms.find(comm => 
      comm.template === proposedCommunication.template &&
      now - new Date(comm.timestamp).getTime() < 30 * 60 * 1000
    );
    
    if (recentSimilar) {
      return {
        allowed: false,
        reason: 'Similar communication sent within last 30 minutes',
        suggestedDelay: 30
      };
    }
    
    // Minimum 5-minute gap for any communication
    if (recentComms.length > 0) {
      const lastComm = recentComms[0];
      const timeSinceLast = now - new Date(lastComm.timestamp).getTime();
      
      if (timeSinceLast < 5 * 60 * 1000) {
        return {
          allowed: false,
          reason: 'Minimum 5-minute gap required between communications',
          suggestedDelay: Math.ceil((5 * 60 * 1000 - timeSinceLast) / (60 * 1000))
        };
      }
    }
    
    return { allowed: true };
  }
}

// Telemetry tracking
export class IncidentTelemetryTracker {
  static calculateMetrics(incident: IncidentDataModel): IncidentTelemetry {
    const createdAt = new Date(incident.createdAt).getTime();
    const now = new Date().getTime();
    const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : null;
    
    // Find first ownership assignment
    const firstOwnershipTime = incident.manualUpdates
      .filter(update => update.field === 'ownerId' && update.value)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    
    // Find first action (any playbook step or manual update)
    const firstActionTime = [...incident.manualUpdates, ...incident.playbookData.steps
      .filter(step => step.completedAt)
      .map(step => ({ timestamp: step.completedAt! }))]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    
    const telemetry: IncidentTelemetry = {
      timeToOwnMs: firstOwnershipTime ? new Date(firstOwnershipTime.timestamp).getTime() - createdAt : undefined,
      timeToFirstActionMs: firstActionTime ? new Date(firstActionTime.timestamp).getTime() - createdAt : undefined,
      timeToResolveMs: resolvedAt ? resolvedAt - createdAt : undefined,
      reopenCount: incident.manualUpdates.filter(update => 
        update.field === 'status' && 
        ['open', 'investigating'].includes(update.value) &&
        incident.manualUpdates.some(prev => 
          prev.field === 'status' && 
          prev.value === 'resolved' && 
          new Date(prev.timestamp).getTime() < new Date(update.timestamp).getTime()
        )
      ).length,
      clientNotificationCount: incident.clientCommunications.length,
      slaBreached: new Date(incident.slaDueAt).getTime() < (resolvedAt || now),
      escalationCount: incident.manualUpdates.filter(update => 
        update.field === 'severity' && 
        this.getSeverityLevel(update.value) > this.getSeverityLevel(incident.severity)
      ).length,
      manualOverrideCount: incident.manualUpdates.filter(update => update.source === 'override').length,
      conflictCount: incident.activeConflicts.length,
      performanceMetrics: {
        avgResponseTime: 0, // Would be calculated from historical data
        userSatisfactionScore: undefined,
        resolutionQualityScore: undefined
      }
    };
    
    // SLA breach reason
    if (telemetry.slaBreached) {
      if (!firstOwnershipTime && new Date(incident.slaDueAt).getTime() < now) {
        telemetry.slaBreachReasonCode = 'unassigned_timeout';
      } else if (incident.activeConflicts.length > 0) {
        telemetry.slaBreachReasonCode = 'blocked_by_conflicts';
      } else if (incident.manualUpdates.some(u => u.source === 'api_failure')) {
        telemetry.slaBreachReasonCode = 'system_availability';
      } else {
        telemetry.slaBreachReasonCode = 'processing_delay';
      }
    }
    
    return telemetry;
  }
  
  private static getSeverityLevel(severity: string): number {
    return { 'S1': 4, 'S2': 3, 'S3': 2, 'S4': 1 }[severity] || 0;
  }
}

// Carrier API failure handling
export class CarrierAPIHandler {
  static handleAPIFailure(operation: string, error: any): ManualUpdate {
    return {
      id: `manual-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: 'System Auto-Handler',
      field: 'api_status',
      value: 'manual_mode',
      reason: `Carrier API failure: ${operation}`,
      source: 'api_failure',
      apiContext: {
        service: 'carrier_api',
        errorCode: error.code || 'UNKNOWN',
        retryAttempts: error.retryAttempts || 0
      }
    };
  }
  
  static generateManualUpdatePrompt(operation: string, context: any): string {
    const prompts = {
      'tracking_update': `Please manually update tracking status for shipment ${context.shipmentId}. Last known status: ${context.lastStatus}`,
      'delivery_confirmation': `Please confirm delivery manually for shipment ${context.shipmentId}. Expected delivery: ${context.expectedDelivery}`,
      'status_sync': `Please manually sync status with carrier for shipment ${context.shipmentId}. Current system status: ${context.currentStatus}`
    };
    
    return prompts[operation] || `Manual update required for operation: ${operation}`;
  }
}


