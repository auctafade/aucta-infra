/**
 * Real Inventory API Client
 * Connects to the actual backend PostgreSQL database
 * Replaces mock data with real database integration
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

interface HubInventoryData {
  id: number;
  name: string;
  code: string;
  location: string;
  currentStock: {
    free: number;
    reserved: number;
    appliedToday: number;
    rma: number;
    total: number;
  };
  burnRate: {
    sevenDay: number;
    thirtyDay: number;
  };
  historical: {
    tagsAppliedLast7Days: number;
    tagsAppliedLast30Days: number;
  };
  metrics: {
    daysOfCover: number | 'infinite';
    stockRatio: number;
  };
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  capacity: {
    max: number;
    current: number;
  };
  lastUpdate: string;
}

interface InventoryTag {
  id: string;
  batchRange: string;
  lot: string;
  status: 'available' | 'assigned' | 'applied' | 'defective' | 'lost';
  reservedFor?: string;
  lastMovement: string;
  notes: string;
  receivedDate: string;
  hub: number;
  type: string;
  qualityPassed: boolean;
  manufactureDate?: string;
  expiryDate?: string;
}

interface TagHistoryEntry {
  id: number;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  changedBy: string;
  timestamp: string;
  hubName?: string;
}

interface BatchData {
  lot: string;
  quantity: number;
  tagIds?: string[];
  supplierReference?: string;
}

class InventoryApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}/api/inventory${endpoint}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'frontend-user', // In real app, get from auth context
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // ====================
  // HUB DASHBOARD APIs
  // ====================

  /**
   * Get inventory dashboard for all hubs
   */
  async getHubInventoryDashboard(): Promise<HubInventoryData[]> {
    const response = await this.fetchApi<HubInventoryData[]>('/hubs/dashboard');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch hub inventory dashboard');
    }
    return response.data;
  }

  /**
   * Get detailed inventory for a specific hub
   */
  async getHubInventoryDetail(
    hubId: number, 
    filters: {
      status?: string;
      lot?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    } = {}
  ): Promise<{ inventory: InventoryTag[]; hubInfo: any }> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/hubs/${hubId}?${queryParams.toString()}`;
    const response = await this.fetchApi<{ inventory: InventoryTag[]; hubInfo: any }>(endpoint);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch hub inventory detail');
    }

    return {
      inventory: response.data.data || [],
      hubInfo: response.data.hubInfo
    };
  }

  /**
   * Get available lots for filtering
   */
  async getAvailableLots(hubId?: number): Promise<string[]> {
    const queryParams = hubId ? `?hubId=${hubId}` : '';
    const response = await this.fetchApi<string[]>(`/lots${queryParams}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch available lots');
    }
    
    return response.data;
  }

  // ====================
  // TAG OPERATION APIs
  // ====================

  /**
   * Assign tag to shipment
   */
  async assignTagToShipment(tagId: string, shipmentId: string, hubId: number): Promise<any> {
    const response = await this.fetchApi(`/tags/${tagId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ shipmentId, hubId }),
    });

    if (!response.success) {
      throw new Error(response.error || response.message || 'Failed to assign tag to shipment');
    }

    return response.data;
  }

  /**
   * Apply tag (mark as applied during hub processing)
   */
  async applyTag(tagId: string, hubId: number): Promise<any> {
    const response = await this.fetchApi(`/tags/${tagId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ hubId }),
    });

    if (!response.success) {
      throw new Error(response.error || response.message || 'Failed to apply tag');
    }

    return response.data;
  }

  /**
   * Mark tag as RMA (defective)
   */
  async markTagRMA(tagId: string, reason: string): Promise<any> {
    const response = await this.fetchApi(`/tags/${tagId}/rma`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

    if (!response.success) {
      throw new Error(response.error || response.message || 'Failed to mark tag as RMA');
    }

    return response.data;
  }

  /**
   * Get tag movement history
   */
  async getTagHistory(tagId: string): Promise<{ tagId: string; history: TagHistoryEntry[] }> {
    const response = await this.fetchApi<{ tagId: string; history: TagHistoryEntry[] }>(`/tags/${tagId}/history`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch tag history');
    }
    
    return response.data;
  }

  // ====================
  // STOCK VALIDATION APIs
  // ====================

  /**
   * Validate hub stock for Tier Gate integration
   */
  async validateHubStock(hubId: number, requiredQuantity: number = 1): Promise<{
    success: boolean;
    available: number;
    required: number;
    hubName: string;
    hubCode: string;
    canProceed: boolean;
    suggestion?: string;
  }> {
    const response = await this.fetchApi<any>(`/hubs/${hubId}/validate-stock?quantity=${requiredQuantity}`);
    
    if (!response.success && !response.data) {
      throw new Error(response.error || 'Failed to validate hub stock');
    }
    
    // Return the actual validation result, not just the response wrapper
    return response.data || response;
  }

  // ====================
  // BATCH OPERATION APIs
  // ====================

  /**
   * Receive new tags batch into hub inventory
   */
  async receiveBatch(hubId: number, batchData: BatchData): Promise<any> {
    const response = await this.fetchApi(`/hubs/${hubId}/receive-batch`, {
      method: 'POST',
      body: JSON.stringify(batchData),
    });

    if (!response.success) {
      throw new Error(response.error || response.message || 'Failed to receive batch');
    }

    return response.data;
  }

  // ====================
  // TELEMETRY AND MONITORING APIs
  // ====================

  /**
   * Get recent telemetry events
   */
  async getTelemetryEvents(limit: number = 50, eventType?: string): Promise<any[]> {
    const queryParams = new URLSearchParams({ limit: limit.toString() });
    if (eventType) {
      queryParams.append('eventType', eventType);
    }

    const response = await this.fetchApi<any[]>(`/telemetry/events?${queryParams.toString()}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch telemetry events');
    }
    
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    tagCount: number;
    database: string;
  }> {
    const response = await this.fetchApi<any>('/health');
    
    if (!response.success) {
      throw new Error(response.error || 'Health check failed');
    }
    
    return response.data || response;
  }
}

// Export singleton instance
export const inventoryApi = new InventoryApiClient();
export default inventoryApi;

// Export types for use in components
export type {
  HubInventoryData,
  InventoryTag,
  TagHistoryEntry,
  BatchData,
  ApiResponse
};

