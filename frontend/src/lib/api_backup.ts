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
  // CONTRACT MANAGEMENT ENDPOINTS
  // =============================================================================

  // Get recent contracts
  getRecentContracts: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return apiCall(`/api/sprint3/contracts/recent${params}`);
  },

  // Search contracts
  searchContracts: (query: string, status?: string, limit?: number) => {
    const params = new URLSearchParams();
    params.append('q', query);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    return apiCall(`/api/sprint3/contracts/search?${params.toString()}`);
  },

  // Get contract by resale ID
  getContract: (resaleId: string) =>
    apiCall(`/api/sprint3/contracts/${resaleId}`),

  // Finalize resale transaction
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

  // DHL/Shipment specific functions for Sprint 8
  getShipmentDetails: (shipmentId: string) =>
    apiCall(`/api/shipments/${shipmentId}`).catch(error => {
      console.warn('Shipment details endpoint not available, using mock data:', error.message);
      // Return mock data structure to prevent loading state
      return {
        success: true,
        data: {
          shipment: {
            shipment_id: shipmentId,
            reference_sku: 'MOCK-SKU-001',
            assigned_tier: 'premium',
            assigned_hub: 'LHR01',
            tier_status: 'classified',
            sender_location: 'Geneva, Switzerland',
            buyer_location: 'London, UK',
            declared_value: 15000,
            weight: 2.5,
            dimensions: { length: 30, width: 20, height: 10 },
            fragility: 'high',
            sla_target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
          }
        }
      };
    }),

  getDHLLegs: (shipmentId: string) =>
    apiCall(`/api/shipments/${shipmentId}/dhl-legs`).catch(error => {
      console.warn('DHL legs endpoint not available, using mock data:', error.message);
      // Return mock DHL legs to prevent loading state
      return {
        success: true,
        data: {
          dhl_legs: [
            {
              leg_order: 1,
              leg_type: 'dhl_express',
              from_location: 'Geneva, Switzerland',
              to_location: 'London, UK',
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              leg_cost: 125.50,
              carrier: 'DHL Express',
              service_type: 'EXPRESS_WORLDWIDE',
              estimated_transit_days: 2,
              label_status: 'not_generated',
              tracking_number: null,
              label_url: null,
              dhl_reference: null,
              eta_band: 'Next Day 12:00',
              rate_ttl_status: 'valid',
              validation_status: 'pending'
            }
          ]
        }
      };
    }),

  // Create new shipment
  createShipment: (formData: any, files?: File[]) =>
    apiCall('/api/shipments', {
      method: 'POST',
      body: JSON.stringify(formData),
    }).catch(error => {
      console.warn('Create shipment endpoint not available, using mock response:', error.message);
      // Return mock successful creation response
      const mockShipmentId = `SH-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      return {
        success: true,
        shipment: {
          shipmentId: mockShipmentId,
          reference: formData.reference || 'MOCK-REF-001',
          status: 'pending_classification',
          created_at: new Date().toISOString(),
          sender_location: `${formData.sender?.city || 'Unknown'}, ${formData.sender?.country || 'Unknown'}`,
          buyer_location: `${formData.buyer?.city || 'Unknown'}, ${formData.buyer?.country || 'Unknown'}`,
          declared_value: parseFloat(formData.declaredValue) || 0,
          currency: formData.currency || 'EUR',
          urgency: formData.urgency || 'standard'
        },
        message: `Shipment ${mockShipmentId} created successfully and ready for classification.`
      };
    }),

  // Save shipment draft (autosave)
  saveShipmentDraft: (shipmentData: any) =>
    apiCall('/api/sprint8/logistics/shipments/draft', {
      method: 'POST',
      body: JSON.stringify(shipmentData),
    }).catch(error => {
      console.warn('Save shipment draft endpoint not available, using mock response:', error.message);
      // Return a noop success so autosave UI can proceed during local dev
      return { success: true, savedAt: new Date().toISOString() };
    }),

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

  // ===== SPRINT 8: LOGISTICS API METHODS =====

  // Create a new shipment
  createShipment: async (shipmentData: any, files?: File[]) => {
    const formData = new FormData();
    formData.append('shipmentData', JSON.stringify(shipmentData));
    
    if (files && files.length > 0) {
      files.forEach((file, index) => {
        formData.append('files', file);
      });
    }

    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to create shipment');
    }

    return response.json();
  },

  // Get shipments that need classification
  getShipmentsToClassify: async (limit = 50, offset = 0) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/to-classify?limit=${limit}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch shipments to classify');
    }

    return response.json();
  },

  // Get shipment details by ID
  getShipmentById: async (shipmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/${shipmentId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Shipment not found');
      }
      throw new Error('Failed to fetch shipment details');
    }

    return response.json();
  },

  // Classify a shipment (assign tier)
  classifyShipment: async (shipmentId: string, tier: string, notes?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/${shipmentId}/classify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to classify shipment');
    }

    return response.json();
  },

  // Update shipment status
  updateShipmentStatus: async (shipmentId: string, status: string, notes?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to update shipment status');
    }

    return response.json();
  },

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

  // Get logistics hubs
  getLogisticsHubs: async () => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/hubs`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch logistics hubs');
    }

    return response.json();
  },

  // Calculate shipment pricing
  calculateShipmentPricing: async (shipmentData: any) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/pricing/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to calculate pricing');
    }

    return response.json();
  },

  // Check for duplicate reference
  checkDuplicateReference: async (reference: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/check-reference/${encodeURIComponent(reference)}`);
    
    if (!response.ok) {
      throw new Error('Failed to check reference');
    }

    return response.json();
  },

  // Get logistics statistics
  getLogisticsStats: async () => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch logistics statistics');
    }

    return response.json();
  },

  // =============================================================================
  // DHL LABEL MANAGEMENT ENDPOINTS
  // =============================================================================

  // Get DHL legs for a planned route
  getDHLLegs: (shipmentId: string) =>
    apiCall(`/api/shipments/${shipmentId}/dhl/legs`),

  // Purchase DHL label for a specific leg
  purchaseDHLLabel: (shipmentId: string, legId: string, options: any) =>
    apiCall(`/api/shipments/${shipmentId}/dhl/legs/${legId}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ options }),
    }),

  // Void DHL label
  voidDHLLabel: (shipmentId: string, legId: string, reason?: string) =>
    apiCall(`/api/shipments/${shipmentId}/dhl/legs/${legId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Refresh DHL rate
  refreshDHLRate: (shipmentId: string, legId: string) =>
    apiCall(`/api/shipments/${shipmentId}/dhl/legs/${legId}/refresh-rate`, {
      method: 'POST',
    }),

  // Log DHL telemetry event
  logDHLTelemetry: (eventType: string, eventData: any, shipmentId?: string, legId?: string, sessionId?: string) =>
    apiCall('/api/dhl/telemetry', {
      method: 'POST',
      body: JSON.stringify({ eventType, eventData, shipmentId, legId, sessionId }),
    }),

  // Get shipment details (enhanced for DHL page)
  getShipmentDetails: (shipmentId: string) =>
    apiCall(`/api/shipments/${shipmentId}`),

  // Get planned route for shipment
  getShipmentPlan: (shipmentId: string) =>
    apiCall(`/api/shipments/${shipmentId}/plan`),

  // Create shipment
  createShipment: async (shipmentData: any, files: File[]) => {
    const formData = new FormData();
    formData.append('shipmentData', JSON.stringify(shipmentData));
    
    files.forEach((file, index) => {
      formData.append(`file${index}`, file);
    });

    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/create`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to create shipment');
    }

    return response.json();
  },

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
  getHubById: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}`),

  // Create new hub
  createHub: (hubData: any) =>
    apiCall('/api/sprint8/logistics/hubs/management', {
      method: 'POST',
      body: JSON.stringify(hubData),
    }),

  // Update hub
  updateHub: (hubId: string, updateData: any) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    }),

  // Archive hub
  archiveHub: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}`, {
      method: 'DELETE',
    }),

  // Duplicate hub
  duplicateHub: (hubId: string, newHubData: any) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(newHubData),
    }),

  // Get hub capacity summary
  getHubCapacity: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}/capacity`),

  // Get hub inventory summary
  getHubInventory: (hubId: string) =>
    apiCall(`/api/sprint8/logistics/hubs/management/${hubId}/inventory`),

  // Save shipment draft
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

  // Get shipment details by ID
  getShipmentById: async (shipmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/${shipmentId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Shipment not found');
      }
      throw new Error('Failed to fetch shipment details');
    }

    return response.json();
  },

  // Classify a shipment (assign tier)
  classifyShipment: async (shipmentId: string, tier: string, notes?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/sprint8/logistics/shipments/${shipmentId}/classify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Failed to classify shipment');
    }

    return response.json();
  },
};