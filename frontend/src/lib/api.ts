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
  } catch (error) {
    console.error('API call error:', error);
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

  // Client Management
  registerClient: (name: string, kycInfo: string) =>
    apiCall('/register-client', {
      method: 'POST',
      body: JSON.stringify({ name, kycInfo }),
    }),

  registerClientWithSelfie: (name: string, walletAddress: string, kycInfo: any, selfieBase64: string) =>
    apiCall('/register-client', {
      method: 'POST',
      body: JSON.stringify({ 
        name, 
        wallet_address: walletAddress,
        kyc_info: JSON.stringify(kycInfo),
        selfie_base64: selfieBase64
      }),
    }),

  getClients: (search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiCall(`/clients${params}`);
  },

  // Profile Management - Updated with full profile data
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
  
  // Protected vault endpoint (requires auth)
  getClientVaultProtected: (clientId: number) =>
    apiCall(`/client/vault-protected/${clientId}`),
  
  // Original unprotected vault endpoint
  getClientVault: (clientId: number) =>
    apiCall(`/client/vault/${clientId}`),

  // Wallet Management
  getWalletData: (clientId: number) =>
    apiCall(`/client/${clientId}/wallet`),

  getClientActivity: (clientId: number, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/client/${clientId}/activity${params}`);
  },

  exportWalletData: (clientId: number) =>
    apiCall(`/client/${clientId}/wallet/export`),

  rotateWalletKey: (clientId: number) =>
    apiCall(`/client/${clientId}/wallet/rotate-key`, {
      method: 'POST',
    }),

  // MoneySBT Management
  getMoneySBTTransactions: (clientId: number) =>
    apiCall(`/client/${clientId}/moneysbt/transactions`),

  withdrawMoneySBT: (clientId: number, amount: number) =>
    apiCall(`/client/${clientId}/moneysbt/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // =============================================================================
  // PROXY MANAGEMENT ENDPOINTS
  // =============================================================================

  // Get all proxy assignments for a client
  getProxyAssignments: (clientId: number) =>
    apiCall(`/client/${clientId}/proxy`),

  // Submit new proxy request
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

  // Revoke proxy access
  revokeProxyAccess: (clientId: number, proxyId: number) =>
    apiCall(`/client/${clientId}/proxy/${proxyId}/revoke`, {
      method: 'PUT',
    }),

  // Get proxy assignment history
  getProxyHistory: (clientId: number, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/client/${clientId}/proxy/history${params}`);
  },

  // Upload proxy document (ID or legal document)
  uploadProxyDocument: async (file: File, documentType = 'proxy_document') => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', documentType);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    try {
      const response = await fetch(`${API_BASE_URL}/upload-proxy-document`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('Proxy document upload error:', error);
      throw error;
    }
  },

  // Admin endpoints (for AUCTA staff)
  adminUpdateProxyStatus: (proxyId: number, status: string, adminNotes?: string) =>
    apiCall(`/admin/proxy/${proxyId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status, 
        admin_notes: adminNotes 
      }),
    }),

  // Admin - Create client account for approved proxy
  adminCreateProxyClient: (proxyId: number, walletAddress?: string) =>
    apiCall(`/admin/proxy/${proxyId}/create-client`, {
      method: 'POST',
      body: JSON.stringify({ 
        walletAddress 
      }),
    }),

  // =============================================================================
  // SECURITY SETTINGS ENDPOINTS
  // =============================================================================

  getSecuritySettings: (clientId: number) =>
    apiCall(`/client/${clientId}/security`),

  toggleGeoTracking: (clientId: number, enabled: boolean) =>
    apiCall(`/client/${clientId}/security/geo-tracking`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  addTrustedLocation: (clientId: number, locationData: {
    name: string;
    address: string;
    purpose?: string;
    document?: string;
  }) =>
    apiCall(`/client/${clientId}/security/trusted-location`, {
      method: 'POST',
      body: JSON.stringify(locationData),
    }),

  requestNewVault: (clientId: number, vaultData: {
    location: string;
    purpose: string;
    description?: string;
    document?: string;
  }) =>
    apiCall(`/client/${clientId}/security/vault-request`, {
      method: 'POST',
      body: JSON.stringify(vaultData),
    }),

  requestPhysicalAgent: (clientId: number, agentRequest: {
    product_id?: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    use_case: string;
    contact_method: string;
    description: string;
  }) =>
    apiCall(`/client/${clientId}/security/agent-request`, {
      method: 'POST',
      body: JSON.stringify(agentRequest),
    }),

  emergencyProductLockdown: (clientId: number, lockdownData: {
    product_ids?: number[];
    reason: string;
    biometric_confirmed: boolean;
  }) =>
    apiCall(`/client/${clientId}/security/emergency-lockdown`, {
      method: 'POST',
      body: JSON.stringify(lockdownData),
    }),

  reportProductStatus: (clientId: number, productId: number, statusData: {
    status: 'safe' | 'lost' | 'stolen' | 'in_repair' | 'archived';
    description?: string;
    document?: string;
  }) =>
    apiCall(`/client/${clientId}/security/product-report`, {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, ...statusData }),
    }),

  request2FAActivation: (clientId: number, method: 'sms' | 'email' | 'faceid') =>
    apiCall(`/client/${clientId}/security/2fa-request`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),

  requestDeviceReset: (clientId: number, reason: string) =>
    apiCall(`/client/${clientId}/security/device-reset`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  logoutAllDevices: (clientId: number) =>
    apiCall(`/client/${clientId}/security/logout-all`, {
      method: 'POST',
    }),

  reportSuspiciousActivity: (clientId: number, activityData: {
    description: string;
    session_id?: string;
    suspected_device?: string;
  }) =>
    apiCall(`/client/${clientId}/security/report-suspicious`, {
      method: 'POST',
      body: JSON.stringify(activityData),
    }),

  getSecurityLogs: (clientId: number, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/client/${clientId}/security/logs${params}`);
  },

  // Passport Management
  createPassport: (nfcUid: string, metadata: any) =>
    apiCall('/create-passport', {
      method: 'POST',
      body: JSON.stringify({ 
        nfc_uid: nfcUid,
        metadata: metadata,
        metadata_hash: metadata.metadata_hash // if pre-computed
      }),
    }),

  getPassports: () => apiCall('/passports'),

  getPassport: (passportId: number) =>
    apiCall(`/passport/${passportId}`),

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

  getSBT: (passportId: number) =>
    apiCall(`/sbt/${passportId}`),

  // Get assignment by transaction ID
  getAssignment: (transactionId: string) =>
    apiCall(`/assignment/${transactionId}`),

  // Admin Functions
  getAdminLogs: () => apiCall('/admin/logs'),

  // Development Only
  cleanupTestData: () => {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Cleanup only available in development');
    }
    return apiCall('/dev/cleanup', { method: 'DELETE' });
  },

  // Image upload
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    try {
      const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  },

  // Document upload for security requests
  uploadSecurityDocument: async (file: File, clientId: number, requestType: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('client_id', clientId.toString());
    formData.append('request_type', requestType);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    try {
      const response = await fetch(`${API_BASE_URL}/upload-security-document`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('Security document upload error:', error);
      throw error;
    }
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