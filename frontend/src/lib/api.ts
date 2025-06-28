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
    apiCall(`/client/vault-protected/${clientId}`).catch(error => {
      console.warn('Protected vault endpoint not available:', error.message);
      return [];
    }),
  
  // Original unprotected vault endpoint
  getClientVault: (clientId: number) =>
    apiCall(`/client/vault/${clientId}`),

  // Wallet Management
  getWalletData: (clientId: number) =>
    apiCall(`/client/${clientId}/wallet`),

  // =============================================================================
  // ACTIVITY LOG ENDPOINT - ENHANCED VERSION
  // =============================================================================
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

  // Transfer Request Endpoints
  getTransferRequests: (clientId: number) => {
    return apiCall(`/client/${clientId}/transfer-requests`).catch(error => {
      // If endpoint doesn't exist yet, return empty array
      if (error.message?.includes('404') || 
          error.message?.includes('Not Found') || 
          error.message?.includes('API call failed: 404') ||
          error.message?.includes('Cannot GET')) {
        console.warn('Transfer requests endpoint not implemented yet');
        return [];
      }
      // For other errors, still return empty array to prevent crashes
      console.warn('Transfer requests API error, returning empty array:', error.message);
      return [];
    });
  },

  // Submit new transfer request
  submitTransferRequest: (clientId: number, transferData: {
    product_id: number;
    reason: 'resale' | 'inheritance' | 'gift' | 'legal_assignment';
    is_resale: boolean;
    recipient_wallet_address?: string;
    recipient_first_name?: string;
    recipient_last_name?: string;
    recipient_email?: string;
  }) =>
    apiCall(`/client/${clientId}/transfer-request`, {
      method: 'POST',
      body: JSON.stringify(transferData),
    }),

  // Cancel transfer request
  cancelTransferRequest: (clientId: number, requestId: number) =>
    apiCall(`/client/${clientId}/transfer-request/${requestId}/cancel`, {
      method: 'PUT',
    }),

  // Admin - Update transfer request status
  adminUpdateTransferStatus: (requestId: number, status: string, adminNotes?: string) =>
    apiCall(`/admin/transfer-request/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status, 
        admin_notes: adminNotes 
      }),
    }),

  // =============================================================================
  // QR ACCESS TOKEN MANAGEMENT
  // =============================================================================

  // Get all QR access tokens for a client
  getQRAccessTokens: (clientId: number) =>
    apiCall(`/client/${clientId}/qr-access-tokens`).catch(error => {
      if (error.message?.includes('404') || 
          error.message?.includes('Not Found') || 
          error.message?.includes('API call failed: 404') ||
          error.message?.includes('Cannot GET')) {
        console.warn('QR access tokens endpoint not implemented yet');
        return [];
      }
      console.warn('QR access tokens API error, returning empty array:', error.message);
      return [];
    }),

  // Create new QR access token
  createQRAccessToken: (clientId: number, tokenData: {
    passport_id: number;
    access_reason: string;
    validity_duration: string;
    expires_in: number;
    authorized_email?: string;
    authorized_name?: string;
    usage_type?: 'single' | 'multiple';
    max_access_count?: number;
  }) =>
    apiCall(`/client/${clientId}/qr-access-token`, {
      method: 'POST',
      body: JSON.stringify(tokenData),
    }),

  // Revoke QR access token
  revokeQRAccessToken: (clientId: number, tokenId: number) =>
    apiCall(`/client/${clientId}/qr-access-token/${tokenId}/revoke`, {
      method: 'PUT',
    }),

  // Verify QR access token (public endpoint - no auth required)
  verifyQRAccessToken: (token: string) =>
    apiCall(`/access/verify?token=${encodeURIComponent(token)}`),

  // Get QR access statistics
  getQRAccessStats: (clientId: number) =>
    apiCall(`/client/${clientId}/qr-access-stats`).catch(error => {
      if (error.message?.includes('404') || 
          error.message?.includes('Not Found') || 
          error.message?.includes('API call failed: 404') ||
          error.message?.includes('Cannot GET')) {
        console.warn('QR access stats endpoint not implemented yet');
        return { total_tokens: 0, active_tokens: 0, total_accesses: 0 };
      }
      console.warn('QR access stats API error, returning default stats:', error.message);
      return { total_tokens: 0, active_tokens: 0, total_accesses: 0 };
    }),

  // =============================================================================
  // VALUATION HISTORY ENDPOINTS
  // =============================================================================

  // Get valuation history for a client
  getValuationHistory: (clientId: number) =>
    apiCall(`/client/${clientId}/valuation-history`).catch(error => {
      console.warn('Valuation history endpoint not available:', error.message);
      return [];
    }),

  // Submit new valuation request
  submitValuationRequest: (clientId: number, valuationData: {
    product_id: number;
    reason?: string;
    connect_authenticator?: boolean;
    preferred_region?: string;
  }) =>
    apiCall(`/client/${clientId}/valuation-request`, {
      method: 'POST',
      body: JSON.stringify(valuationData),
    }).catch(error => {
      console.warn('Valuation request endpoint not available:', error.message);
      throw new Error('Valuation requests are not available yet. Please try again later.');
    }),

  // Get active valuation requests
  getValuationRequests: (clientId: number) =>
    apiCall(`/client/${clientId}/valuation-requests`).catch(error => {
      console.warn('Valuation requests endpoint not available:', error.message);
      return [];
    }),

  // Download valuation certificate
  downloadValuationCertificate: (clientId: number, valuationId: number) =>
    apiCall(`/client/${clientId}/valuation-certificate/${valuationId}`).catch(error => {
      console.warn('Valuation certificate endpoint not available:', error.message);
      throw new Error('Certificate download is not available yet.');
    }),

  // =============================================================================
  // RDS SYSTEM ENDPOINTS
  // =============================================================================

  // Get rewards subscription status
  getRewardsSubscription: (clientId: number) => {
    const endpoint = `/client/${clientId}/rewards/subscription`;
    console.log('Calling rewards subscription endpoint:', endpoint);
    return apiCall(endpoint).catch(error => {
      console.warn('Rewards subscription endpoint failed:', endpoint, error.message);
      if (error.message?.includes('404') || 
          error.message?.includes('Not Found') || 
          error.message?.includes('API call failed: 404') ||
          error.message?.includes('Cannot GET') ||
          error.message?.includes('/rewards/subscription')) {
        console.warn('Rewards subscription endpoint not implemented yet');
        return { subscribed: false, subscription: null, card: null, totalCashback: 0 };
      }
      console.warn('Rewards subscription API error, returning default:', error.message);
      return { subscribed: false, subscription: null, card: null, totalCashback: 0 };
    });
  },

  // Subscribe to rewards program
  subscribeToRewards: (clientId: number, tier: 'TIER_I' | 'TIER_II' | 'TIER_III') =>
    apiCall(`/client/${clientId}/rewards/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }).catch(error => {
      console.warn('Rewards subscribe endpoint not available:', error.message);
      throw new Error('Rewards subscription is not available yet. Please try again later.');
    }),

  // Order physical card
  orderRewardsCard: (clientId: number, shippingAddress?: {
    street: string;
    city: string;
    state?: string;
    zip: string;
    country: string;
  }) =>
    apiCall(`/client/${clientId}/rewards/order-card`, {
      method: 'POST',
      body: JSON.stringify({ shipping_address: shippingAddress }),
    }).catch(error => {
      console.warn('Rewards order card endpoint not available:', error.message);
      throw new Error('Card ordering is not available yet. Please try again later.');
    }),

  // Get card status
  getRewardsCardStatus: (clientId: number) =>
    apiCall(`/client/${clientId}/rewards/card-status`).catch(error => {
      console.warn('Rewards card status endpoint not available:', error.message);
      return null;
    }),

  // Submit concierge request
  submitConciergeRequest: (clientId: number, requestData: {
    request_type: string;
    subject: string;
    description: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }) =>
    apiCall(`/client/${clientId}/rewards/concierge-request`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    }).catch(error => {
      console.warn('Concierge request endpoint not available:', error.message);
      throw new Error('Concierge requests are not available yet. Please try again later.');
    }),

  // Get concierge requests
  getConciergeRequests: (clientId: number) =>
    apiCall(`/client/${clientId}/rewards/concierge-requests`).catch(error => {
      console.warn('Concierge requests endpoint not available:', error.message);
      return [];
    }),

  // Update subscription tier
  updateRewardsSubscription: (clientId: number, newTier: 'TIER_I' | 'TIER_II' | 'TIER_III') =>
    apiCall(`/client/${clientId}/rewards/update-subscription`, {
      method: 'PUT',
      body: JSON.stringify({ new_tier: newTier }),
    }).catch(error => {
      console.warn('Update rewards subscription endpoint not available:', error.message);
      throw new Error('Subscription updates are not available yet. Please try again later.');
    }),

  // Cancel subscription
  cancelRewardsSubscription: (clientId: number) =>
    apiCall(`/client/${clientId}/rewards/cancel-subscription`, {
      method: 'PUT',
    }).catch(error => {
      console.warn('Cancel rewards subscription endpoint not available:', error.message);
      throw new Error('Subscription cancellation is not available yet. Please try again later.');
    }),

  // Record benefit usage
  useRewardsBenefit: (clientId: number, benefitData: {
    benefit_type: string;
    location?: string;
    details?: any;
  }) =>
    apiCall(`/client/${clientId}/rewards/use-benefit`, {
      method: 'POST',
      body: JSON.stringify(benefitData),
    }).catch(error => {
      console.warn('Use rewards benefit endpoint not available:', error.message);
      throw new Error('Benefit usage tracking is not available yet.');
    }),

  // Get rewards statistics
  getRewardsStats: (clientId: number) =>
    apiCall(`/client/${clientId}/rewards/stats`).catch(error => {
      console.warn('Rewards stats endpoint not available:', error.message);
      return { 
        tier: null, 
        benefits_used: 0, 
        total_savings: 0,
        cashback: { balance: 0, transactionCount: 0 },
        benefitsUsage: []
      };
    }),

  // Apply for family access plan
  applyForFamilyAccess: (clientId: number, familyMembers: Array<{
    email: string;
    name: string;
    relationship: string;
  }>) =>
    apiCall(`/client/${clientId}/rewards/family-access`, {
      method: 'POST',
      body: JSON.stringify({ family_members: familyMembers }),
    }).catch(error => {
      console.warn('Family access endpoint not available:', error.message);
      throw new Error('Family access applications are not available yet. Please try again later.');
    }),

  // Submit service feedback
  submitRewardsFeedback: (clientId: number, feedbackData: {
    category: string;
    rating: number;
    feedback: string;
  }) =>
    apiCall(`/client/${clientId}/rewards/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    }).catch(error => {
      console.warn('Rewards feedback endpoint not available:', error.message);
      throw new Error('Feedback submission is not available yet. Please try again later.');
    }),

  // =============================================================================
  // INHERITANCE PLAN ENDPOINTS
  // =============================================================================

  // Get inheritance plan for a client
  getInheritancePlan: (clientId: number) =>
    apiCall(`/client/${clientId}/inheritance-plan`).catch(error => {
      console.warn('Inheritance plan endpoint not available:', error.message);
      return [];
    }),

  // Submit new inheritance request
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

  // Cancel inheritance request
  cancelInheritanceRequest: (clientId: number, requestId: number) =>
    apiCall(`/client/${clientId}/inheritance-request/${requestId}/cancel`, {
      method: 'PUT',
    }),

  // Get inheritance-related activity logs
  getInheritanceActivity: (clientId: number, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/client/${clientId}/inheritance-activity${params}`);
  },

  // Request legal review appointment
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

  // Upload inheritance document
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('Inheritance document upload error:', error);
      throw error;
    }
  },

  // Admin - Update inheritance request status
  adminUpdateInheritanceStatus: (requestId: number, status: string, adminNotes?: string) =>
    apiCall(`/admin/inheritance-request/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status, 
        admin_notes: adminNotes 
      }),
    }),

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