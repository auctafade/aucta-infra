// lib/hubCapacityApi.ts
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
    
    // Handle non-JSON responses
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
    console.error(`Hub Capacity API call error for ${endpoint}:`, error?.message || error);
    throw error;
  }
}

// Types for Hub Capacity Management
export interface Hub {
  id: number;
  code: string;
  name: string;
  location: string;
  timezone: string;
  status: 'active' | 'maintenance' | 'offline';
  contactInfo?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CapacityProfile {
  id: number;
  hubId: number;
  version: string;
  effectiveDate: string;
  state: 'draft' | 'published' | 'scheduled';
  lastEditedBy: string;
  lastEditedAt: string;
  changeReason: string;
  authCapacity: number;
  sewingCapacity: number;
  qaCapacity: number;
  qaHeadcount: number;
  qaShiftMinutes: number;
  workingDays: string[];
  workingHours: { start: string; end: string };
  overbookingPercent: number;
  rushBucketPercent: number;
  backToBackCutoff: string;
  seasonalityMultipliers: { [month: string]: number };
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: number;
  shipmentId: string;
  hubId: number;
  reservationDate: string;
  lane: 'auth' | 'sewing' | 'qa';
  slotsReserved: number;
  tier: 'T2' | 'T3';
  priority: 'standard' | 'priority';
  reservationType: 'hold' | 'booking' | 'in_progress';
  status: 'active' | 'released' | 'completed';
  qaMinutesRequired: number;
  estimatedQaTime: number;
  isRush: boolean;
  rushReason?: string;
  createdBy: string;
  createdAt: string;
  releasedAt?: string;
  completedAt?: string;
}

export interface BlackoutRule {
  id: number;
  hubId: number;
  name: string;
  ruleType: 'recurring' | 'one_time';
  startDate: string;
  endDate?: string;
  recurrenceRule?: string;
  affectedLanes: string[];
  reason: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface UtilizationData {
  date: string;
  lane: string;
  held: number;
  planned: number;
  consumed: number;
  rushUsed: number;
  qaMinutesUsed: number;
  baseCapacity: number;
  effectiveCapacity: number;
  seasonalityMultiplier: number;
  utilization: number;
  availableSlots: number;
  rushAvailable: number;
  qaCapacityMinutes: number;
}

export interface CapacityEvent {
  id: number;
  eventType: string;
  hubId: number;
  entityType: string;
  entityId: number;
  eventData: any;
  actorId: string;
  approverId?: string;
  timestampUtc: string;
}

// Hub Capacity API
export const hubCapacityApi = {
  // Hub management
  getHubs: (): Promise<{ success: boolean; data: Hub[] }> =>
    apiCall('/hubs'),

  getHub: (hubId: number): Promise<{ success: boolean; data: Hub }> =>
    apiCall(`/hubs/${hubId}`),

  // Capacity profiles
  getActiveCapacityProfile: (hubId: number): Promise<{ success: boolean; data: CapacityProfile }> =>
    apiCall(`/hubs/${hubId}/capacity/active`),

  getCapacityHistory: (hubId: number, limit = 10): Promise<{ success: boolean; data: CapacityProfile[] }> =>
    apiCall(`/hubs/${hubId}/capacity/history?limit=${limit}`),

  saveCapacityProfile: (hubId: number, profile: Partial<CapacityProfile>): Promise<{ success: boolean; data: CapacityProfile; message: string }> =>
    apiCall(`/hubs/${hubId}/capacity`, {
      method: 'POST',
      body: JSON.stringify(profile),
    }),

  publishCapacityProfile: (hubId: number, profile: Partial<CapacityProfile>): Promise<{ success: boolean; data: CapacityProfile; message: string }> =>
    apiCall(`/hubs/${hubId}/capacity`, {
      method: 'POST',
      body: JSON.stringify({ ...profile, state: 'published' }),
    }),

  // Reservations
  getReservations: (
    hubId: number, 
    filters?: { 
      startDate?: string; 
      endDate?: string; 
      lane?: string; 
    }
  ): Promise<{ success: boolean; data: Reservation[] }> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.lane) params.append('lane', filters.lane);
    
    const queryString = params.toString();
    return apiCall(`/hubs/${hubId}/reservations${queryString ? `?${queryString}` : ''}`);
  },

  createReservation: (hubId: number, reservation: Partial<Reservation>): Promise<{ success: boolean; data: Reservation; message: string }> =>
    apiCall(`/hubs/${hubId}/reservations`, {
      method: 'POST',
      body: JSON.stringify(reservation),
    }),

  releaseReservation: (hubId: number, reservationId: number): Promise<{ success: boolean; message: string }> =>
    apiCall(`/hubs/${hubId}/reservations/${reservationId}/release`, {
      method: 'POST',
    }),

  // Utilization data
  getUtilization: (
    hubId: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      lane?: string;
    }
  ): Promise<{ success: boolean; data: UtilizationData[] }> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.lane) params.append('lane', filters.lane);
    
    const queryString = params.toString();
    return apiCall(`/hubs/${hubId}/capacity/utilization${queryString ? `?${queryString}` : ''}`);
  },

  // Blackout rules
  getBlackoutRules: (hubId: number): Promise<{ success: boolean; data: BlackoutRule[] }> =>
    apiCall(`/hubs/${hubId}/blackouts`),

  createBlackoutRule: (hubId: number, rule: Partial<BlackoutRule>): Promise<{ success: boolean; data: BlackoutRule; message: string }> =>
    apiCall(`/hubs/${hubId}/blackouts`, {
      method: 'POST',
      body: JSON.stringify(rule),
    }),

  deleteBlackoutRule: (hubId: number, ruleId: number): Promise<{ success: boolean; message: string }> =>
    apiCall(`/hubs/${hubId}/blackouts/${ruleId}`, {
      method: 'DELETE',
    }),

  // Maintenance windows
  getMaintenanceWindows: (hubId: number): Promise<{ success: boolean; data: any[] }> =>
    apiCall(`/hubs/${hubId}/maintenance`),

  createMaintenanceWindow: (hubId: number, window: any): Promise<{ success: boolean; data: any; message: string }> =>
    apiCall(`/hubs/${hubId}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(window),
    }),

  // Emergency actions
  createEmergencyBlackout: (hubId: number, reason: string): Promise<{ success: boolean; message: string }> =>
    apiCall(`/hubs/${hubId}/emergency/blackout`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Audit trail
  getCapacityEvents: (hubId: number, limit = 50): Promise<{ success: boolean; data: CapacityEvent[] }> =>
    apiCall(`/hubs/${hubId}/events?limit=${limit}`),

  // Analytics and reporting
  getCapacityAnalytics: (
    hubId: number,
    period: 'day' | 'week' | 'month'
  ): Promise<{ success: boolean; data: any }> =>
    apiCall(`/hubs/${hubId}/analytics?period=${period}`),

  exportCalendar: (
    hubId: number,
    format: 'csv' | 'ics',
    filters?: { lane?: string; startDate?: string; endDate?: string }
  ): Promise<{ success: boolean; data: string; filename: string }> => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters?.lane) params.append('lane', filters.lane);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    return apiCall(`/hubs/${hubId}/export?${params.toString()}`);
  },

  // Validation helpers
  validateCapacityChange: (
    hubId: number,
    changes: Partial<CapacityProfile>
  ): Promise<{ success: boolean; warnings: string[]; errors: string[]; conflictingBookings?: string[] }> =>
    apiCall(`/hubs/${hubId}/capacity/validate`, {
      method: 'POST',
      body: JSON.stringify(changes),
    }),

  // Real-time capacity calculation
  calculateDayCapacity: (
    hubId: number,
    date: string,
    lane: string
  ): Promise<{
    success: boolean;
    data: {
      utilization: number;
      availableSlots: number;
      rushAvailable: number;
      qaLoadMinutes: number;
      qaCapacityMinutes: number;
      overflowToNextDay: boolean;
    };
  }> =>
    apiCall(`/hubs/${hubId}/capacity/calculate`, {
      method: 'POST',
      body: JSON.stringify({ date, lane }),
    }),
};

// Helper functions for frontend use
export const capacityHelpers = {
  formatDateTime: (dateString: string, timezone = 'Europe/Paris') => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(dateString));
  },

  formatAbsoluteDateTime: (dateString: string) => {
    const date = new Date(dateString);
    const cetTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    const utcTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    return `${cetTime} CET (${utcTime} UTC)`;
  },

  getSeasonalityMultiplier: (date: string, seasonalityMultipliers: { [month: string]: number }) => {
    const month = new Date(date).toLocaleString('en', { month: 'long' }).toLowerCase();
    return seasonalityMultipliers[month] || 1.0;
  },

  calculateUtilization: (held: number, planned: number, consumed: number, baseCapacity: number, seasonality: number, overbookingPercent: number) => {
    const totalUsed = held + planned + consumed;
    const maxCapacityWithOverbook = baseCapacity * seasonality * (1 + overbookingPercent / 100);
    return (totalUsed / maxCapacityWithOverbook) * 100;
  },

  calculateAvailableSlots: (held: number, planned: number, baseCapacity: number, seasonality: number) => {
    const effectiveBaseCapacity = Math.floor(baseCapacity * seasonality);
    return Math.max(0, effectiveBaseCapacity - held - planned);
  },

  calculateRushAvailable: (rushUsed: number, baseCapacity: number, rushBucketPercent: number) => {
    const rushCapacity = Math.ceil(baseCapacity * (rushBucketPercent / 100));
    return Math.max(0, rushCapacity - rushUsed);
  },

  getUtilizationColor: (utilization: number, isBlackout = false, isMaintenance = false) => {
    if (isBlackout) return 'bg-gray-400';
    if (isMaintenance) return 'bg-orange-400';
    
    if (utilization >= 100) return 'bg-red-500';
    if (utilization >= 80) return 'bg-yellow-500';
    if (utilization >= 60) return 'bg-blue-500';
    return 'bg-green-500';
  },

  validateOverbookingPercent: (percent: number) => {
    return percent >= 0 && percent <= 30;
  },

  validateRushBucketPercent: (percent: number) => {
    return percent >= 0 && percent <= 20;
  }
};

export default hubCapacityApi;
