/**
 * Hub Console API Client
 * Real backend integration for Hub Console operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
  details?: string;
}

interface HubJob {
  id: number;
  shipment_id: string;
  hub_id: number;
  tier: number;
  product_category: string;
  declared_value: number;
  status: string;
  planned_intake_time: string;
  sla_deadline: string;
  priority: string;
  created_at: string;
  // Joined fields
  hub_name: string;
  hub_code: string;
  reference_sku: string;
  brand: string;
  category: string;
  weight: number;
  sender_name: string;
  buyer_name: string;
  reserved_tag_id?: string;
  reserved_nfc_uid?: string;
  // Additional fields referenced in code
  value: number; // alias for declared_value
  brandModel: string; // brand + model combination
  outboundType: string; // 'WG' or other delivery types
  qaNeeded: boolean; // whether QA is required
  assignedTechnician?: string; // assigned tech for processing
  // Calculated fields
  isOverdue: boolean;
  hoursOverdue: number;
  evidenceStatus: {
    photo?: boolean;
    otp?: boolean;
    seal?: boolean;
    [key: string]: boolean | undefined;
  };
  checklistProgress: number;
}

interface HubFilters {
  hubId?: string;
  tier?: string;
  status?: string;
  priority?: string;
  when?: string;
  search?: string;
}

interface InventoryItem {
  id: number;
  tag_id?: string;
  nfc_uid?: string;
  status: string;
  assigned_shipment_id?: string;
  current_hub_id: number;
  created_at: string;
}

interface EvidenceFile {
  id: number;
  job_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_hash: string;
  evidence_type: string;
  validated: boolean;
  captured_at: string;
  captured_by: string;
  created_at: string;
}

export class HubConsoleApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/hub-console`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // ====================
  // JOB MANAGEMENT
  // ====================

  async getHubJobs(filters: HubFilters): Promise<HubJob[]> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.append(key, value);
      }
    });

    const response = await this.request<HubJob[]>(`/jobs?${params.toString()}`);
    return response.data;
  }

  async getJobDetails(shipmentId: string): Promise<HubJob> {
    const response = await this.request<HubJob>(`/jobs/${shipmentId}`);
    return response.data;
  }

  async createHubJob(jobData: {
    shipmentId: string;
    hubId: number;
    tier: number;
    productCategory?: string;
    declaredValue?: number;
    plannedIntakeTime: string;
    slaDeadline: string;
    priority?: string;
  }): Promise<HubJob> {
    const response = await this.request<HubJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
    return response.data;
  }

  async updateJobStatus(
    shipmentId: string,
    status: string,
    updateData: Record<string, any> = {}
  ): Promise<HubJob> {
    const response = await this.request<HubJob>(`/jobs/${shipmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, updateData }),
    });
    return response.data;
  }

  // ====================
  // INVENTORY MANAGEMENT
  // ====================

  async getAvailableInventory(
    hubId: number,
    type: 'tags' | 'nfc' | 'both' = 'both'
  ): Promise<{ tags?: InventoryItem[]; nfc?: InventoryItem[] }> {
    const response = await this.request<{ tags?: InventoryItem[]; nfc?: InventoryItem[] }>(
      `/inventory/${hubId}?type=${type}`
    );
    return response.data;
  }

  async reserveInventory(
    shipmentId: string,
    hubId: number,
    tier: number
  ): Promise<{ tagId?: string; nfcUid?: string }> {
    const response = await this.request<{ tagId?: string; nfcUid?: string }>(
      '/inventory/reserve',
      {
        method: 'POST',
        body: JSON.stringify({ shipmentId, hubId, tier }),
      }
    );
    return response.data;
  }

  async applyInventory(
    shipmentId: string,
    itemId: string,
    itemType: 'tag' | 'nfc'
  ): Promise<InventoryItem> {
    const response = await this.request<InventoryItem>('/inventory/apply', {
      method: 'POST',
      body: JSON.stringify({ shipmentId, itemId, itemType }),
    });
    return response.data;
  }

  async swapInventory(
    shipmentId: string,
    oldItemId: string,
    newItemId: string,
    itemType: 'tag' | 'nfc',
    reason: string,
    changedBy?: string
  ): Promise<{ success: boolean; newItemId: string }> {
    const response = await this.request<{ success: boolean; newItemId: string }>(
      '/inventory/swap',
      {
        method: 'POST',
        body: JSON.stringify({
          shipmentId,
          oldItemId,
          newItemId,
          itemType,
          reason,
          changedBy,
        }),
      }
    );
    return response.data;
  }

  // ====================
  // EVIDENCE MANAGEMENT
  // ====================

  async uploadEvidence(
    jobId: number,
    files: File[],
    evidenceType: string,
    capturedBy?: string
  ): Promise<EvidenceFile[]> {
    const formData = new FormData();
    formData.append('jobId', jobId.toString());
    formData.append('evidenceType', evidenceType);
    if (capturedBy) {
      formData.append('capturedBy', capturedBy);
    }

    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${this.baseUrl}/evidence/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getEvidenceFiles(
    jobId: number,
    evidenceType?: string
  ): Promise<EvidenceFile[]> {
    const params = evidenceType ? `?evidenceType=${evidenceType}` : '';
    const response = await this.request<EvidenceFile[]>(`/evidence/${jobId}${params}`);
    return response.data;
  }

  // ====================
  // INCIDENT MANAGEMENT
  // ====================

  async createIncident(incidentData: {
    jobId?: number;
    incidentType: string;
    severity?: string;
    title: string;
    description: string;
    jobPaused?: boolean;
    reportedBy: string;
  }): Promise<{ incident_id: string }> {
    const response = await this.request<{ incident_id: string }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData),
    });
    return response.data;
  }

  // ====================
  // TELEMETRY
  // ====================

  async trackTelemetry(eventData: {
    event_type: string;
    session_id?: string;
    job_id?: number;
    hub_id?: number;
    user_id?: string;
    user_role?: string;
    event_data: Record<string, any>;
    duration_ms?: number;
  }): Promise<void> {
    try {
      await this.request('/telemetry', {
        method: 'POST',
        body: JSON.stringify(eventData),
      });
    } catch (error) {
      // Don't throw on telemetry failures
      console.warn('Telemetry tracking failed:', error);
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  async getHubs(): Promise<Array<{
    id: number;
    hub_code: string;
    hub_name: string;
    city: string;
    country: string;
    capacity_max: number;
    capacity_current: number;
  }>> {
    const response = await this.request<Array<{
      id: number;
      hub_code: string;
      hub_name: string;
      city: string;
      country: string;
      capacity_max: number;
      capacity_current: number;
    }>>('/hubs');
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const hubConsoleApi = new HubConsoleApiService();

// Export types for use in components
export type {
  HubJob,
  HubFilters,
  InventoryItem,
  EvidenceFile,
  ApiResponse,
};
