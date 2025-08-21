/**
 * NFC Inventory API Client
 * Frontend API integration for NFC Inventory Management (Tier 3)
 */

const API_BASE = '/api/nfc-inventory';

export interface NFCStatus {
  stock: number;
  reserved: number;
  installed: number;
  rma: number;
  quarantined: number;
}

export interface HubOverview {
  id: number;
  name: string;
  code: string;
  location: string;
  status: NFCStatus;
  threshold: number;
  burnRate7d: number;
  burnRate30d: number;
  daysOfCover: number | 'infinite';
  upcomingDemand7d: number;
  upcomingDemand14d: number;
  lotHealth: {
    quarantinedLots: number;
    highFailureLots: number;
    totalLots: number;
  };
  statusColor: 'green' | 'amber' | 'red';
  lowStock: boolean;
  capacity: {
    max: number;
    current: number;
  };
  lastUpdate: string;
}

export interface NFCUnit {
  uid: string;
  lot: string;
  status: 'stock' | 'reserved' | 'installed' | 'rma' | 'quarantined';
  reservedFor?: string;
  installedAt?: string;
  testResults: {
    readTest: boolean;
    writeTest: boolean;
    lastTest: string;
  };
  rmaReason?: string;
  hubId: number;
  receivedDate: string;
  notes?: string;
  type?: string;
  supplier?: string;
  manufactureDate?: string;
}

export interface NFCFilters {
  status?: string;
  lot?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface TransferRequest {
  fromHubId: number;
  toHubId: number;
  nfcUIDs: string[];
  transferReason: string;
  urgency: 'normal' | 'urgent';
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

class NFCInventoryAPI {
  // ====================
  // HUB OVERVIEW
  // ====================

  async getHubOverview(): Promise<APIResponse<HubOverview[]>> {
    const response = await fetch(`${API_BASE}/hub-overview`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // ====================
  // HUB DETAIL
  // ====================

  async getHubDetail(hubId: number, filters: NFCFilters = {}): Promise<APIResponse<NFCUnit[]>> {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.lot) params.append('lot', filters.lot);
    if (filters.search) params.append('search', filters.search);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = `${API_BASE}/hub/${hubId}/detail${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getHubLots(hubId: number): Promise<APIResponse<{ lot: string; count: number }[]>> {
    const response = await fetch(`${API_BASE}/hub/${hubId}/lots`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getAllLots(): Promise<APIResponse<{ lot: string; count: number }[]>> {
    const response = await fetch(`${API_BASE}/lots`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // ====================
  // NFC OPERATIONS
  // ====================

  async reserveNFC(nfcUid: string, shipmentId: string, hubId: number, actorId?: string): Promise<APIResponse<any>> {
    const response = await fetch(`${API_BASE}/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nfcUid,
        shipmentId,
        hubId,
        actorId
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async installNFC(
    nfcUid: string, 
    hubId: number, 
    testResults: {
      readTest?: boolean;
      writeTest?: boolean;
      notes?: string;
    } = {},
    actorId?: string
  ): Promise<APIResponse<any>> {
    const response = await fetch(`${API_BASE}/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nfcUid,
        hubId,
        testResults,
        actorId
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async quarantineLot(
    lotId: string, 
    reason: string, 
    affectedUIDs: string[] = [],
    actorId?: string
  ): Promise<APIResponse<any>> {
    const response = await fetch(`${API_BASE}/quarantine-lot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lotId,
        reason,
        affectedUIDs,
        actorId
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async processRMA(
    nfcUid: string, 
    rmaReason: string, 
    rmaReference?: string,
    actorId?: string
  ): Promise<APIResponse<any>> {
    const response = await fetch(`${API_BASE}/rma`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nfcUid,
        rmaReason,
        rmaReference,
        actorId
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // ====================
  // STOCK VALIDATION
  // ====================

  async validateStock(hubId: number, quantity: number = 1): Promise<APIResponse<{
    available: number;
    availableTestedGood: number;
    required: number;
    hubName: string;
    hubCode: string;
    canProceed: boolean;
    suggestion?: string;
  }>> {
    const response = await fetch(`${API_BASE}/validate-stock/${hubId}?quantity=${quantity}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // ====================
  // TRANSFERS
  // ====================

  async createTransfer(transferRequest: TransferRequest, actorId?: string): Promise<APIResponse<any>> {
    const response = await fetch(`${API_BASE}/create-transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...transferRequest,
        actorId
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // ====================
  // METRICS
  // ====================

  async getSummaryMetrics(): Promise<APIResponse<{
    totalHubs: number;
    criticalHubs: number;
    warningHubs: number;
    healthyHubs: number;
    totalStock: number;
    totalReserved: number;
    totalInstalled: number;
    totalRMA: number;
    totalQuarantined: number;
    avgBurnRate7d: string;
    lowestDaysOfCover: number;
    totalQuarantinedLots: number;
    totalHighFailureLots: number;
    upcomingDemand7d: number;
    upcomingDemand14d: number;
  }>> {
    const response = await fetch(`${API_BASE}/metrics/summary`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // ====================
  // ENHANCED STATE TRANSITION METHODS
  // ====================

  async receiveBatchEnhanced(
    hubId: number, 
    lot: string, 
    quantity: number, 
    supplierRef: string, 
    uids?: string[], 
    evidenceFiles?: any[]
  ): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/receive-batch-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hubId, lot, quantity, supplierRef, uids, evidenceFiles })
    });
    return response.json();
  }

  async assignNFCEnhanced(uid: string, shipmentId: string, hubId: number): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/assign-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nfcUid: uid, shipmentId, hubId })
    });
    return response.json();
  }

  async installNFCEnhanced(uid: string, hubId: number, testResults: any = {}, evidenceFiles: any[] = []): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/install-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nfcUid: uid, hubId, testResults, evidenceFiles })
    });
    return response.json();
  }

  async markRMAEnhanced(uid: string, reasonCode: string, notes: string, replacementUid?: string, evidenceFiles: any[] = []): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/rma-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nfcUid: uid, reasonCode, notes, replacementUid, evidenceFiles })
    });
    return response.json();
  }

  async quarantineLotEnhanced(lot: string, hubId: number, reason: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/quarantine-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lotId: lot, hubId, reason })
    });
    return response.json();
  }

  async liftQuarantineEnhanced(lot: string, hubId: number, reason: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/lift-quarantine-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lotId: lot, hubId, reason })
    });
    return response.json();
  }

  async transferNFCsEnhanced(fromHubId: number, toHubId: number, uids: string[], quantity: number, reason: string, eta: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/transfer-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromHubId, toHubId, uids, quantity, reason, eta })
    });
    return response.json();
  }

  async completeTransfer(transferId: string, toHubId: number, arrivedUIDs: string[]): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/transfer-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferId, toHubId, arrivedUIDs })
    });
    return response.json();
  }
}

// Export singleton instance
export const nfcInventoryAPI = new NFCInventoryAPI();
