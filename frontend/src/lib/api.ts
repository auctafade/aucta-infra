// frontend/src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get auth token if it exists
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    // Handle non-JSON responses (like 404 HTML pages)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `API call failed: ${response.statusText}`);
    }

    return data;
  } catch (error: any) {
    console.error(`API call error for ${endpoint}:`, error?.message || error);
    throw error;
  }
}

// API endpoints matching your backend
export const api = {
  // Authentication
  login: (identifier: string, password: string) =>
    apiCall('/client/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  register: (userData: any) =>
    apiCall('/client/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  biometricLogin: (biometricId: string) =>
    apiCall('/client/biometric-login', {
      method: 'POST',
      body: JSON.stringify({ biometricId }),
    }),

  biometricLoginEmail: (email: string) =>
    apiCall('/client/biometric-login-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  logout: () =>
    apiCall('/client/logout', {
      method: 'POST',
    }),

  // Client data
  getClientItems: () => apiCall('/client/items'),
  getClients: () => apiCall('/clients'),
  getClient: (clientId: number) =>
    apiCall(`/client/${clientId}`),
  updateClientProfile: (clientId: number, profileData: {
    email?: string;
    phone?: string;
    preferred_contact?: string;
    street_address?: string;
    zip_code?: string;
    city?: string;
    country?: string;
    language?: string;
    currency?: string;
    enable_notifications?: boolean;
    allow_qr_access?: boolean;
  }) =>
    apiCall(`/client/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),
  submitKycChangeRequest: (clientId: number, description: string, fieldsToChange?: string[]) =>
    apiCall(`/client/${clientId}/kyc-change-request`, {
      method: 'POST',
      body: JSON.stringify({ 
        description, 
        fields_to_change: fieldsToChange 
      }),
    }),
  exportClientData: (clientId: number) =>
    apiCall(`/client/${clientId}/export`),
  getClientActivity: (clientId: number, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/client/${clientId}/activity${params}`);
  },
  getClientVault: (clientId: number) =>
    apiCall(`/client/vault/${clientId}`),
  getClientVaultProtected: (clientId: number) =>
    apiCall(`/client/vault-protected/${clientId}`).catch(error => {
      console.warn('Protected vault endpoint not available:', error.message);
      return [];
    }),
  getItemPassport: (id: string) => apiCall(`/items/${id}/passport`),
  getSBTInfo: (id: string) => apiCall(`/items/${id}/sbt`),

  // Passport management
  getPassports: () => apiCall('/passports'),
  getPassport: (passportId: number) => apiCall(`/passport/${passportId}`),
  createPassport: (nfcUID: string, metadata: any) =>
    apiCall('/create-passport', {
      method: 'POST',
      body: JSON.stringify({ 
        nfc_uid: nfcUID, 
        metadata: metadata,
        metadata_hash: null // Let backend generate the hash
      }),
    }),
  assignPassport: (passportId: number, clientId: number) =>
    apiCall(`/assign/${passportId}`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    }),

  // Blockchain Operations
  mintSBT: (passportId: number) =>
    apiCall(`/mint-sbt/${passportId}`, {
      method: 'POST',
    }),
  getSBT: (passportId: number) => apiCall(`/sbt/${passportId}`),
  getAssignment: (transactionId: string) => apiCall(`/assignment/${transactionId}`),

  // Admin Functions
  getAdminLogs: () => apiCall('/admin/logs'),

  // Proxy Management
  getProxyAssignments: (clientId: number) =>
    apiCall(`/client/${clientId}/proxy`),
  submitProxyRequest: (clientId: number, proxyData: {
    proxy_name: string;
    proxy_email?: string;
    proxy_wallet_address?: string;
    relationship: string;
    role: string;
    country: string;
    additional_notes?: string;
    id_document_url?: string;
    legal_document_url?: string;
  }) =>
    apiCall(`/client/${clientId}/proxy`, {
      method: 'POST',
      body: JSON.stringify(proxyData),
    }),
  revokeProxyAccess: (clientId: number, proxyId: number) =>
    apiCall(`/client/${clientId}/proxy/${proxyId}/revoke`, {
      method: 'PUT',
    }),

  // Vault operations
  requestTransfer: (itemId: string, transferData: any) =>
    apiCall(`/items/${itemId}/transfer-request`, {
      method: 'POST',
      body: JSON.stringify(transferData),
    }),

  // Documents
  uploadDocument: (file: File, metadata: any) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    return fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  },

  getDocuments: () => apiCall('/client/documents'),
  deleteDocument: (id: string) =>
    apiCall(`/documents/${id}`, { method: 'DELETE' }),

  // Profile management
  getProfile: () => apiCall('/client/profile'),
  updateProfile: (profileData: any) =>
    apiCall('/client/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  // Security
  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall('/client/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  enable2FA: () => apiCall('/client/2fa/enable', { method: 'POST' }),
  disable2FA: (token: string) =>
    apiCall('/client/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // Activity logs
  getActivityLog: () => apiCall('/client/activity'),
  getItemHistory: (id: string) => apiCall(`/items/${id}/history`),

  // Transfers
  getPendingTransfers: () => apiCall('/transfers/pending'),
  approveTransfer: (id: string) =>
    apiCall(`/transfers/${id}/approve`, { method: 'PUT' }),
  rejectTransfer: (id: string, reason: string) =>
    apiCall(`/transfers/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  // Messages
  getMessages: () => apiCall('/messages'),
  sendMessage: (messageData: any) =>
    apiCall('/messages/send', {
      method: 'POST',
      body: JSON.stringify(messageData),
    }),
  markMessageRead: (id: string) =>
    apiCall(`/messages/${id}/read`, { method: 'PUT' }),

  // QR Access
  generateQR: (itemId: string, options: any) =>
    apiCall(`/qr/generate/${itemId}`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  getQRAccessLogs: () => apiCall('/qr/access-logs'),

  // Valuation
  getItemValuations: () => apiCall('/valuations/items'),
  getValuationHistory: (id: string) => apiCall(`/valuations/history/${id}`),
  requestValuation: (itemId: string, valuationData: any) =>
    apiCall('/valuations/request', {
      method: 'POST',
      body: JSON.stringify({ itemId, ...valuationData }),
    }),

  // Market data
  getMarketTrends: () => apiCall('/market/trends'),

  // Rewards
  getRewardsBalance: () => apiCall('/rewards/balance'),
  getRewardsHistory: () => apiCall('/rewards/history'),
  redeemRewards: (rewardData: any) =>
    apiCall('/rewards/redeem', {
      method: 'POST',
      body: JSON.stringify(rewardData),
    }),

  // Inheritance
  getInheritancePlan: (clientId: number) =>
    apiCall(`/client/${clientId}/inheritance-plan`).catch(error => {
      console.warn('Inheritance plan endpoint not available:', error.message);
      return [];
    }),
  updateInheritancePlan: (planData: any) =>
    apiCall('/inheritance/plan', {
      method: 'PUT',
      body: JSON.stringify(planData),
    }),
  submitInheritanceRequest: (clientId: number, requestData: {
    request_type: 'immediate' | 'post_mortem' | 'legal_mandate';
    product_ids: number[];
    beneficiary: {
      name: string;
      email: string;
      phone?: string;
      relationship: string;
      is_existing_proxy?: boolean;
      proxy_assignment_id?: number;
    };
    documents?: Array<{
      type: string;
      url: string;
      name: string;
    }>;
  }) =>
    apiCall(`/client/${clientId}/inheritance-request`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    }),
  cancelInheritanceRequest: (clientId: number, requestId: number) =>
    apiCall(`/client/${clientId}/inheritance-request/${requestId}/cancel`, {
      method: 'PUT',
    }),
  getInheritanceActivity: (clientId: number, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/client/${clientId}/inheritance-activity${params}`);
  },
  requestInheritanceLegalReview: (clientId: number, reviewData: {
    inheritance_request_id?: number;
    appointment_type?: 'physical' | 'virtual';
    preferred_dates?: string[];
    notes?: string;
  }) =>
    apiCall(`/client/${clientId}/inheritance-legal-review`, {
      method: 'POST',
      body: JSON.stringify(reviewData),
    }),
  uploadInheritanceDocument: async (file: File, documentType: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', documentType);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    try {
      const response = await fetch(`${API_BASE_URL}/upload-inheritance-document`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload document');
      }

      return response.json();
    } catch (error: any) {
      console.error('Upload inheritance document error:', error?.message || error);
      throw error;
    }
  },

  // Wallet integration
  connectWallet: (walletData: any) =>
    apiCall('/wallet/connect', {
      method: 'POST',
      body: JSON.stringify(walletData),
    }),
  getWalletInfo: () => apiCall('/wallet/info'),

  // Proxy services
  getAuctionHouses: () => apiCall('/proxy/auction-houses'),
  connectService: (serviceData: any) =>
    apiCall('/proxy/connect-service', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    }),

  // =============================================================================
  // SPRINT 3 ENDPOINTS
  // =============================================================================

  // Contract Management
  getRecentContracts: (limit = 10) =>
    apiCall(`/api/sprint3/contracts/recent?limit=${limit}`),

  // Resale Console - Ready-to-resale products
  getReadyToResaleProducts: () =>
    apiCall('/api/sprint3/resale-console/ready-to-resale'),

  // Resale Console - Configure resale
  configureResale: (productId: string, configData: any) =>
    apiCall(`/api/sprint3/resale-console/configure/${productId}`, {
      method: 'POST',
      body: JSON.stringify(configData),
    }),

  // Resale Console - Generate QR access
  generateQRAccess: (productId: string, options: any) =>
    apiCall(`/api/sprint3/resale-console/qr-access/${productId}`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  // Resale Console - Initiate resale
  initiateResale: (resaleData: any) =>
    apiCall('/api/sprint3/resale-console/initiate', {
      method: 'POST',
      body: JSON.stringify(resaleData),
    }),

  // Resale Console - Purchase completion
  completeResalePurchase: (resaleId: string, completionData: any) =>
    apiCall(`/api/sprint3/resale-console/purchase/${resaleId}`, {
      method: 'POST',
      body: JSON.stringify(completionData),
    }),

  // Resale Console - Finalize resale
  finalizeResale: (resaleId: string, finalizationData: {
    ownership_transfer: boolean;
    sbt_minted: boolean;
    passport_updated: boolean;
    blockchain_anchored: boolean;
    metadata_archived: boolean;
  }) =>
    apiCall(`/api/sprint3/resale/${resaleId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(finalizationData),
    }),

  // Get resale finalization status
  getResaleFinalizationStatus: (resaleId: string) =>
    apiCall(`/api/sprint3/resale/${resaleId}/finalization-status`),

  // Get finalized resale summary
  getResaleSummary: (resaleId: string) =>
    apiCall(`/api/sprint3/resale/${resaleId}/summary`),

  // =============================================================================
  // ADMIN DASHBOARD ENDPOINTS
  // =============================================================================

  // Get admin dashboard statistics
  getAdminDashboardStats: () =>
    apiCall('/api/sprint3/admin/dashboard-stats'),

  // Get all resale events for admin dashboard
  getAdminResaleEvents: () =>
    apiCall('/api/sprint3/admin/resale-events'),

  // Get royalty distributions for admin dashboard
  getAdminRoyaltyDistributions: () =>
    apiCall('/api/sprint3/admin/royalty-distributions'),

  // Get marketplace integrations for admin dashboard
  getAdminMarketplaceIntegrations: () =>
    apiCall('/api/sprint3/admin/marketplace-integrations'),

  // Approve resale (admin action)
  adminApproveResale: (resaleId: string, status: string, reason?: string) =>
    apiCall(`/api/sprint3/admin/resale/${resaleId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),

  // Block resale (admin action)
  adminBlockResale: (resaleId: string, status: string, reason: string) =>
    apiCall(`/api/sprint3/admin/resale/${resaleId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),

  // Get real-time updates for admin dashboard
  getAdminRealTimeUpdates: () =>
    apiCall('/api/sprint3/admin/real-time-updates'),

  // =============================================================================
  // ROYALTY ENGINE ENDPOINTS
  // =============================================================================

  // Get royalty distributions
  getRoyaltyDistributions: () =>
    apiCall('/api/sprint3/royalty-engine/distributions'),

  // Recalculate royalties for a resale
  recalculateRoyalties: (resaleId: string) =>
    apiCall(`/api/sprint3/royalty-engine/recalculate/${resaleId}`, {
      method: 'POST',
    }),

  // =============================================================================
  // MARKETPLACE CONNECTOR ENDPOINTS
  // =============================================================================

  // Get marketplace integrations
  getMarketplaceIntegrations: () =>
    apiCall('/api/sprint3/marketplace-connector/integrations'),

  // =============================================================================
  // LOGISTICS CLASSIFICATION ENDPOINTS
  // =============================================================================

  // Get shipments that need classification  
  getShipments: (filters?: { status?: string; limit?: number; offset?: number }) => {
    // If looking for pending_classification, use the specific backend endpoint
    if (filters?.status === 'pending_classification') {
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());
      
      const queryString = params.toString();
      return apiCall(`/api/sprint8/logistics/shipments/to-classify${queryString ? `?${queryString}` : ''}`);
    }
    
    // If looking for classified shipments (ready for planning), use the to-plan endpoint
    if (filters?.status === 'classified') {
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());
      
      const queryString = params.toString();
      return apiCall(`/api/sprint8/logistics/shipments/to-plan${queryString ? `?${queryString}` : ''}`);
    }
    
    // For other status filters, use the general endpoint (if it exists)
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const queryString = params.toString();
    return apiCall(`/api/sprint8/logistics/shipments${queryString ? `?${queryString}` : ''}`);
  },

  // Classify and reserve resources for a shipment
  classifyAndReserveResources: (classificationData: {
    shipment_id: string;
    tier: string;
    hub: string;
    status: string;
  }) =>
    apiCall('/api/sprint8/logistics/classify-and-reserve', {
      method: 'POST',
      body: JSON.stringify(classificationData),
    }),

  // Get hub resource availability
  getHubResourceAvailability: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/${hubId}/resources`),

  // Get all available hubs with resource counts
  getAvailableHubs: () =>
    apiCall('/api/sprint8/logistics/hubs/availability'),

  // Submit tier suggestion (for hub_tech users)
  submitTierSuggestion: (suggestionData: {
    shipment_id: string;
    suggested_tier?: string;
    suggested_hub?: string;
    suggestion_note: string;
    suggested_reason?: string;
    attachments?: Array<{ name: string; size: number; type: string }>;
  }) =>
    apiCall('/api/sprint8/logistics/tier-suggestion', {
      method: 'POST',
      body: JSON.stringify(suggestionData),
    }),

  // Get shipment by ID (Sprint 8 logistics)
  getShipmentById: (shipmentId: string) =>
    apiCall(`/api/sprint8/logistics/shipments/${shipmentId}`),

  // Classify a shipment (assign tier)
  classifyShipment: (shipmentId: string, tier: string, notes?: string) =>
    apiCall(`/api/sprint8/logistics/shipments/${shipmentId}/classify`, {
      method: 'PUT',
      body: JSON.stringify({ tier, notes }),
    }),

  // =============================================================================
  // LOGISTICS DASHBOARD ENDPOINTS
  // =============================================================================

  // Get shipments that need classification
  getShipmentsToClassify: (limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return apiCall(`/api/sprint8/logistics/shipments/to-classify?${params.toString()}`);
  },

  // Get logistics statistics
  getLogisticsStats: () =>
    apiCall('/api/sprint8/logistics/stats'),

  // =============================================================================
  // HUB MANAGEMENT ENDPOINTS
  // =============================================================================

  // Get all hubs with filters
  getHubsManagement: (filters?: {
    role?: string;
    country?: string;
    city?: string;
    status?: string;
    currency?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.country) params.append('country', filters.country);
    if (filters?.city) params.append('city', filters.city);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.currency) params.append('currency', filters.currency);
    if (filters?.search) params.append('search', filters.search);
    
    const queryString = params.toString();
    return apiCall(`/api/sprint8/logistics/hubs/management${queryString ? `?${queryString}` : ''}`);
  },

  // Get hub by ID
  getHubManagementById: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}`),

  // Create new hub
  createHubManagement: (hubData: any) =>
    apiCall('/api/sprint8/logistics/hubs/management', {
      method: 'POST',
      body: JSON.stringify(hubData),
    }),

  // Update hub
  updateHubManagement: (hubId: string, updateData: any) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    }),

  // Archive hub
  archiveHubManagement: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}`, {
      method: 'DELETE',
    }),

  // Duplicate hub
  duplicateHubManagement: (hubId: string, newHubData: any) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(newHubData),
    }),

  // Get hub capacity summary
  getHubManagementCapacity: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}/capacity`),

  // Get hub inventory summary
  getHubManagementInventory: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}/inventory`),

  // Check for duplicate reference/SKU
  checkDuplicateReference: (reference: string) =>
    apiCall(`/api/shipments/check-duplicate?reference=${encodeURIComponent(reference)}`).catch(error => {
      console.warn('Check duplicate reference endpoint not available, using mock response:', error.message);
      // Return mock response (randomly simulate duplicates for testing)
      return {
        success: true,
        isDuplicate: Math.random() < 0.1, // 10% chance of duplicate for testing
        message: 'Reference checked successfully'
      };
    }),

  // Save shipment draft (for autosave)
  saveShipmentDraft: async (shipmentData: any) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to save draft');
    }

    return response.json();
  },

};

// Auth helper functions
export const auth = {
  isAuthenticated: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('authToken');
  },

  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
  },

  getClientData: (): any | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem('clientData');
    return data ? JSON.parse(data) : null;
  },

  setAuth: (token: string, clientData: any) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', token);
    localStorage.setItem('clientData', JSON.stringify(clientData));
  },

  clearAuth: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('clientData');
  },
};
