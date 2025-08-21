// frontend/src/lib/contactsApi.ts
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
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `API call failed: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API call to ${url} failed:`, error);
    throw error;
  }
}

// Contact interfaces
export interface Contact {
  id: number;
  name: string;
  emails: string[];
  phones: string[];
  normalizedPhones?: Array<{original: string, normalized: string}>;
  role: 'sender' | 'buyer' | 'wg' | 'hub';
  company: string;
  city: string;
  country: string;
  kycStatus: 'ok' | 'pending' | 'failed' | 'n/a';
  kycDate?: string | null;
  tags: string[];
  lastUsed?: string | null;
  shipmentCount: number;
  addresses: ContactAddress[];
  preferences: ContactPreferences;
  logistics: ContactLogistics;
  shipmentHistory: ShipmentHistoryEntry[];
  notes: ContactNote[];
  status?: 'active' | 'deleted' | 'merged';
  unreachable?: boolean;
  unreachableReason?: string;
  unreachableDate?: string;
  mergedInto?: number;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactAddress {
  type: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

export interface ContactPreferences {
  communication: string[];
  timeWindows: {
    pickup: string;
    delivery: string;
  };
  language: string;
  timezone: string;
}

export interface ContactLogistics {
  deliveryNotes?: string;
  securityRequirements?: string[];
  specialInstructions?: string;
  // WG specific fields
  areaCoverage?: string;
  maxValueClearance?: number;
  vehicle?: string;
  insurance?: string;
  insuranceExpiryDate?: string;
  rating?: number;
}

export interface ShipmentHistoryEntry {
  id: string;
  tier: string;
  mode: string;
  hub: string;
  status: string;
  role: string;
  date: string;
}

export interface ContactNote {
  id?: number;
  date: string;
  author: string;
  content: string;
}

export interface ContactsFilters {
  search?: string;
  role?: string;
  location?: string;
  kycStatus?: string;
  activity?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ContactsResponse {
  success: boolean;
  data: Contact[];
  stats: {
    total: number;
    totalAll: number;
    byRole: Record<string, number>;
    byKYC: Record<string, number>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Shipment {
  id: string;
  tier: string;
  value: number;
  status: string;
  hub?: string;
}

// API functions
export const contactsApi = {
  // Get all contacts with filtering
  async getContacts(filters: ContactsFilters = {}): Promise<ContactsResponse> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          queryParams.append(key, value.join(','));
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });

    const queryString = queryParams.toString();
    const endpoint = `/api/contacts${queryString ? `?${queryString}` : ''}`;
    
    return await apiCall(endpoint);
  },

  // Get specific contact
  async getContact(id: number): Promise<{ success: boolean; data: Contact }> {
    return await apiCall(`/api/contacts/${id}`);
  },

  // Create new contact
  async createContact(contactData: Partial<Contact>): Promise<{ success: boolean; data: Contact; message: string }> {
    return await apiCall('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  },

  // Update contact
  async updateContact(id: number, updates: Partial<Contact>): Promise<{ success: boolean; data: Contact; message: string }> {
    return await apiCall(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Add note to contact
  async addNote(contactId: number, content: string, author?: string): Promise<{ success: boolean; data: ContactNote; message: string }> {
    return await apiCall(`/api/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, author }),
    });
  },

  // Update KYC status
  async updateKYC(contactId: number, status: Contact['kycStatus'], verifier?: string): Promise<{ success: boolean; data: any; message: string }> {
    return await apiCall(`/api/contacts/${contactId}/kyc`, {
      method: 'POST',
      body: JSON.stringify({ status, verifier }),
    });
  },

  // Link contact to shipment
  async linkToShipment(contactId: number, shipmentId: string, role: string): Promise<{ success: boolean; data: any; message: string }> {
    return await apiCall('/api/contacts/link-shipment', {
      method: 'POST',
      body: JSON.stringify({ contactId, shipmentId, role }),
    });
  },

  // Search shipments for linking
  async searchShipments(query: string): Promise<{ success: boolean; data: Shipment[] }> {
    const queryParams = new URLSearchParams({ query });
    return await apiCall(`/api/contacts/search/shipments?${queryParams.toString()}`);
  },

  // Delete contact
  async deleteContact(id: number): Promise<{ success: boolean; message: string }> {
    return await apiCall(`/api/contacts/${id}`, {
      method: 'DELETE',
    });
  },

  // Find potential duplicates
  async findDuplicates(contactId: number): Promise<{ success: boolean; data: any }> {
    return await apiCall(`/api/contacts/${contactId}/duplicates`);
  },

  // Merge contacts
  async mergeContacts(survivorId: number, mergedId: number, fieldSelections: Record<string, string>, actorId?: string): Promise<{ success: boolean; data: Contact; message: string }> {
    return await apiCall('/api/contacts/merge', {
      method: 'POST',
      body: JSON.stringify({ survivorId, mergedId, fieldSelections, actorId }),
    });
  },

  // Get contact versions
  async getContactVersions(contactId: number, limit?: number): Promise<{ success: boolean; data: any }> {
    const queryParams = limit ? `?limit=${limit}` : '';
    return await apiCall(`/api/contacts/${contactId}/versions${queryParams}`);
  },

  // Restore contact to version
  async restoreContactToVersion(contactId: number, versionNumber: number, actorId?: string): Promise<{ success: boolean; data: Contact; message: string }> {
    return await apiCall(`/api/contacts/${contactId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ versionNumber, actorId }),
    });
  },

  // Mark contact as unreachable
  async markUnreachable(contactId: number, reason: string, actorId?: string): Promise<{ success: boolean; data: Contact; message: string }> {
    return await apiCall(`/api/contacts/${contactId}/mark-unreachable`, {
      method: 'POST',
      body: JSON.stringify({ reason, actorId }),
    });
  },

  // Get telemetry data
  async getTelemetry(): Promise<{ success: boolean; data: any }> {
    return await apiCall('/api/contacts/telemetry');
  },

  // Bulk operations
  async bulkTag(contactIds: number[], tags: string[]): Promise<{ success: boolean; message: string }> {
    // This would be implemented if needed
    throw new Error('Bulk tagging not yet implemented');
  },

  async exportCSV(contactIds?: number[]): Promise<Blob> {
    const filters = contactIds ? { ids: contactIds } : {};
    const response = await fetch(`${API_BASE_URL}/api/contacts/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return await response.blob();
  }
};

// Hook for React components
export function useContacts() {
  return {
    contactsApi,
  };
}
