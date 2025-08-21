// =========================================
// Incident Management API Client
// Real backend integration for incidents
// =========================================

import { IncidentDataModel } from '../incidentDataModel';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const INCIDENTS_API = `${API_BASE_URL}/api/sprint8/incidents`;

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
  timestamp: string;
}

export interface IncidentFilters {
  type?: string[];
  severity?: string[];
  status?: string[];
  owner_name?: string;
  shipment_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CreateIncidentData {
  type: string;
  severity: string;
  title: string;
  description: string;
  shipment_id: string;
  leg_id?: string;
  hub_id?: string;
  assignee?: string;
  client_name: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  leg_display?: string;
  hub_name?: string;
  carrier?: string;
  tracking_id?: string;
  tags?: string[];
  created_by?: string;
}

export interface IncidentUpdateData {
  [key: string]: any;
  actor_name?: string;
  update_reason?: string;
}

export interface ResolutionData {
  reason: string;
  post_mortem?: string;
  admin_override?: boolean;
  override_passport_hold?: boolean;
  override_reason?: string;
  actor_name?: string;
}

export interface TimelineEntryData {
  entry_type?: string;
  user_name?: string;
  title: string;
  description: string;
  is_client_visible?: boolean;
  metadata?: any;
}

export interface CommunicationData {
  type?: string;
  channel?: string;
  template_id?: string;
  subject: string;
  content: string;
  sent_by?: string;
}

class IncidentAPIClient {
  
  // ===============================
  // Core CRUD Operations
  // ===============================
  
  static async getIncidents(filters: IncidentFilters = {}): Promise<APIResponse<any>> {
    try {
      const params = new URLSearchParams();
      
      if (filters.type?.length) params.set('type', filters.type.join(','));
      if (filters.severity?.length) params.set('severity', filters.severity.join(','));
      if (filters.status?.length) params.set('status', filters.status.join(','));
      if (filters.owner_name) params.set('owner_name', filters.owner_name);
      if (filters.shipment_id) params.set('shipment_id', filters.shipment_id);
      if (filters.search) params.set('search', filters.search);
      if (filters.sort_by) params.set('sort_by', filters.sort_by);
      if (filters.sort_order) params.set('sort_order', filters.sort_order);
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.offset) params.set('offset', filters.offset.toString());
      
      const url = `${INCIDENTS_API}?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error fetching incidents:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static async getIncidentById(incidentId: string): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/${incidentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error fetching incident:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static async createIncident(incidentData: CreateIncidentData): Promise<APIResponse<any>> {
    try {
      const response = await fetch(INCIDENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incidentData),
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error creating incident:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static async updateIncident(incidentId: string, updates: IncidentUpdateData): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error updating incident:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static async resolveIncident(incidentId: string, resolutionData: ResolutionData): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/${incidentId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resolutionData),
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error resolving incident:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // ===============================
  // Timeline and Communication
  // ===============================
  
  static async addTimelineEntry(incidentId: string, entryData: TimelineEntryData): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/${incidentId}/timeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryData),
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error adding timeline entry:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static async sendCommunication(incidentId: string, communicationData: CommunicationData): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/${incidentId}/communicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(communicationData),
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error sending communication:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // ===============================
  // File Management
  // ===============================
  
  static async uploadFile(incidentId: string, file: File, tags: string[] = [], uploadedBy: string = 'User'): Promise<APIResponse<any>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('incident_id', incidentId);
      formData.append('tags', tags.join(','));
      formData.append('uploaded_by', uploadedBy);
      
      const response = await fetch(`${INCIDENTS_API}/${incidentId}/files`, {
        method: 'POST',
        body: formData,
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static getFileDownloadUrl(incidentId: string, fileId: string): string {
    return `${INCIDENTS_API}/${incidentId}/files/${fileId}`;
  }
  
  // ===============================
  // Edge Case Management
  // ===============================
  
  static async checkOwnershipGaps(): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/system/ownership-gaps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error checking ownership gaps:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  static async escalateIncident(incidentId: string, reason: string = 'Auto-escalation'): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/${incidentId}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error escalating incident:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // ===============================
  // Analytics
  // ===============================
  
  static async getAnalytics(timeRange: string = '7d'): Promise<APIResponse<any>> {
    try {
      const response = await fetch(`${INCIDENTS_API}/system/analytics?time_range=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return await response.json();
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // ===============================
  // Utility Methods
  // ===============================
  
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health/incidents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
  
  // Convert database incident to frontend format
  static convertIncidentFromDB(dbIncident: any): any {
    return {
      id: dbIncident.incident_id,
      type: dbIncident.type,
      severity: dbIncident.severity,
      status: dbIncident.status,
      tier: dbIncident.tier,
      title: dbIncident.title,
      description: dbIncident.description,
      resolution: dbIncident.resolution,
      resolutionNotes: dbIncident.resolution_notes,
      shipmentId: dbIncident.shipment_id,
      legId: dbIncident.leg_id,
      hubId: dbIncident.hub_id,
      assignee: dbIncident.owner_name,
      clientName: dbIncident.client_name,
      contactName: dbIncident.contact_name,
      contactEmail: dbIncident.contact_email,
      contactPhone: dbIncident.contact_phone,
      createdAt: dbIncident.created_at,
      updatedAt: dbIncident.updated_at,
      dueAt: dbIncident.sla_due_at,
      resolvedAt: dbIncident.resolved_at,
      priority: dbIncident.priority,
      isOverdue: dbIncident.is_overdue || dbIncident.is_currently_overdue,
      tags: dbIncident.tags || [],
      relatedShipments: dbIncident.related_incidents || [],
      legDisplay: dbIncident.leg_display,
      hubName: dbIncident.hub_name,
      carrier: dbIncident.carrier,
      trackingId: dbIncident.tracking_id,
      lastAction: dbIncident.updated_at,
      // Telemetry data
      telemetry: {
        timeToOwnMs: dbIncident.time_to_own_ms,
        timeToResolveMs: dbIncident.time_to_resolve_ms,
        slaBreached: dbIncident.sla_breached,
        clientNotificationCount: dbIncident.client_notifications_sent || 0,
        reopenCount: dbIncident.reopen_count || 0,
        escalationCount: dbIncident.escalation_count || 0
      }
    };
  }
  
  // Convert frontend incident for API submission
  static convertIncidentForAPI(frontendIncident: any): CreateIncidentData {
    return {
      type: frontendIncident.type,
      severity: frontendIncident.severity,
      title: frontendIncident.title,
      description: frontendIncident.description,
      shipment_id: frontendIncident.shipmentId,
      leg_id: frontendIncident.legId,
      hub_id: frontendIncident.hubId,
      assignee: frontendIncident.assignee,
      client_name: frontendIncident.clientName,
      contact_name: frontendIncident.contactName,
      contact_email: frontendIncident.contactEmail,
      contact_phone: frontendIncident.contactPhone,
      leg_display: frontendIncident.legDisplay,
      hub_name: frontendIncident.hubName,
      carrier: frontendIncident.carrier,
      tracking_id: frontendIncident.trackingId,
      tags: frontendIncident.tags || [],
      created_by: frontendIncident.createdBy || 'Frontend User'
    };
  }
}

export default IncidentAPIClient;


