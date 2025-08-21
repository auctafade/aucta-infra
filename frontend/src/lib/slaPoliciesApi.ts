// SLA & Margin Policies API Client
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Types for API responses
export interface PolicyData {
  id: string;
  policy_id: string;
  name: string;
  version: string;
  state: 'draft' | 'published' | 'scheduled' | 'archived';
  effective_date: string;
  sla_targets: SLATargets;
  margin_thresholds: MarginThresholds;
  change_reason: string;
  created_by: string;
  last_edited_by: string;
  last_edited_at: string;
  requires_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
  policy_metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface SLATargets {
  classification: {
    timeToClassify: number;
  };
  pickups: {
    urbanWGMaxHours: number;
    interCityWGMaxHours: number;
    windowConstraints: 'business' | '24_7';
  };
  hubProcessing: {
    tier2MaxHours: number;
    tier3MaxHours: number;
    tier3QABuffer: number;
  };
  delivery: {
    wgFinalDeliveryMaxHours: number;
    dhlStandardDays: number;
    dhlExpressDays: number;
  };
  laneSpecifics: {
    euToEuMultiplier: number;
    ukToEuMultiplier: number;
    remoteAreaMultiplier: number;
    weekendRule: 'calendar' | 'business';
  };
  riskManagement: {
    riskBufferHours: number;
    breachEscalationMinutes: number;
  };
}

export interface MarginThresholds {
  global: {
    minimumMargin: number;
    targetMargin: number;
  };
  components: {
    wgComponent: number;
    dhlComponent: number;
    hubFeeComponent: number;
    insuranceMarkup: number;
    surchargesPolicy: number;
  };
  variance: {
    tolerancePercent: number;
  };
  currency: {
    base: string;
    includeVAT: boolean;
  };
}

export interface SimulationResult {
  shipmentId: string;
  lane: string;
  currentScore: number;
  newScore: number;
  scoreDelta: number;
  guardrailHits: string[];
  slaAtRisk: boolean;
}

export interface PolicyEvent {
  event_id: string;
  event_type: string;
  version: string;
  effective_at: string;
  actor_id: string;
  actor_role?: string;
  approver_id?: string;
  event_data: any;
  reason?: string;
  scheduled?: boolean;
  processed: boolean;
  created_at: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: ValidationError[];
  warnings: ValidationError[];
  policy_version: string;
}

export interface ValidationError {
  type: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
  can_override?: boolean;
  override_level?: string;
}

// Helper function for API calls with admin headers
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Add mock admin headers for now (replace with your auth system)
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': 'ops_admin',
      'X-User-ID': 'current_user@aucta.io',
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
      throw new Error(data.error || `API call failed: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
}

// ==========================================
// POLICY MANAGEMENT API FUNCTIONS
// ==========================================

/**
 * Get all policies with optional filtering
 */
export async function getPolicies(params: {
  state?: string;
  version?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  policies: PolicyData[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value.toString());
    }
  });
  
  const queryString = searchParams.toString();
  return apiCall(`/api/sla-policies/policies${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get specific policy by ID
 */
export async function getPolicy(policyId: string): Promise<{ policy: PolicyData }> {
  return apiCall(`/api/sla-policies/policies/${policyId}`);
}

/**
 * Get current active policy (cached for performance)
 */
export async function getActivePolicy(): Promise<{ policy: PolicyData }> {
  return apiCall('/api/sla-policies/policies/active/current');
}

/**
 * Create or update policy (save draft)
 */
export async function savePolicy(policyData: {
  policy_id: string;
  name: string;
  version: string;
  sla_targets: SLATargets;
  margin_thresholds: MarginThresholds;
  change_reason: string;
  effective_date?: string;
  state?: string;
}): Promise<{ message: string; policy: PolicyData }> {
  return apiCall('/api/sla-policies/policies', {
    method: 'POST',
    body: JSON.stringify(policyData),
  });
}

/**
 * Publish policy (immediately or scheduled)
 */
export async function publishPolicy(
  policyId: string,
  data: {
    change_reason: string;
    scheduled_date?: string;
  }
): Promise<{ message: string; policy: PolicyData; effective_date: string }> {
  return apiCall(`/api/sla-policies/policies/${policyId}/publish`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==========================================
// SIMULATION API FUNCTIONS
// ==========================================

/**
 * Run policy simulation
 */
export async function runSimulation(
  policyId: string,
  data: {
    sla_targets: SLATargets;
    margin_thresholds: MarginThresholds;
    sample_shipments?: string[];
  }
): Promise<{
  simulation_id: string;
  summary: {
    total_shipments_tested: number;
    shipments_at_risk: number;
    routes_blocked: number;
    average_score_change: string;
    simulation_duration_ms: number;
  };
  results: SimulationResult[];
}> {
  return apiCall(`/api/sla-policies/policies/${policyId}/simulate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==========================================
// HISTORY AND AUDIT API FUNCTIONS
// ==========================================

/**
 * Get policy version history
 */
export async function getPolicyHistory(
  policyId: string,
  params: { limit?: number; offset?: number } = {}
): Promise<{
  policy_id: string;
  history: Array<{
    version: string;
    change_type: string;
    change_reason: string;
    changed_by: string;
    changed_at: string;
    fields_changed: string[];
    old_values: any;
    new_values: any;
    approval_request_id?: string;
    approved_by?: string;
    approved_at?: string;
  }>;
}> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value.toString());
    }
  });
  
  const queryString = searchParams.toString();
  return apiCall(`/api/sla-policies/policies/${policyId}/history${queryString ? `?${queryString}` : ''}`);
}

/**
 * Get policy events (for analytics and debugging)
 */
export async function getPolicyEvents(
  policyId: string,
  params: { limit?: number; offset?: number; event_type?: string } = {}
): Promise<{
  policy_id: string;
  events: PolicyEvent[];
}> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value.toString());
    }
  });
  
  const queryString = searchParams.toString();
  return apiCall(`/api/sla-policies/policies/${policyId}/events${queryString ? `?${queryString}` : ''}`);
}

// ==========================================
// VALIDATION API FUNCTIONS
// ==========================================

/**
 * Validate shipment against current SLA policy
 */
export async function validateSLA(shipmentData: {
  shipment_id: string;
  estimated_timeline: {
    pickup_hours: number;
    hub_processing_hours: number;
    delivery_hours: number;
    sla_deadline_hours: number;
  };
  tier: string;
}): Promise<ValidationResult & {
  shipment_id: string;
  sla_summary?: any;
}> {
  return apiCall('/api/sla-policies/validate/sla', {
    method: 'POST',
    body: JSON.stringify(shipmentData),
  });
}

/**
 * Validate quote margins against current policy
 */
export async function validateMargins(quoteData: {
  quote_id: string;
  total_cost: number;
  client_price: number;
  component_breakdown?: any;
}): Promise<ValidationResult & {
  quote_id: string;
  margin_analysis: {
    total_margin_amount: number;
    total_margin_percent: string;
    meets_minimum: boolean;
    meets_target: boolean;
  };
}> {
  return apiCall('/api/sla-policies/validate/margin', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  });
}

// ==========================================
// CACHE MANAGEMENT API FUNCTIONS
// ==========================================

/**
 * Refresh policy cache (for scheduled policies or manual refresh)
 */
export async function refreshPolicyCache(policyId: string = 'policy-001'): Promise<{
  message: string;
  policy_id: string;
  refreshed_at: string;
}> {
  return apiCall('/api/sla-policies/cache/refresh', {
    method: 'POST',
    body: JSON.stringify({ policy_id: policyId }),
  });
}

// ==========================================
// ERROR HANDLING HELPERS
// ==========================================

export class PolicyAPIError extends Error {
  constructor(message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = 'PolicyAPIError';
  }
}

/**
 * Wrapper function that converts API errors to PolicyAPIError
 */
export async function handlePolicyAPICall<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (error instanceof PolicyAPIError) {
      throw error;
    }
    
    throw new PolicyAPIError(
      error instanceof Error ? error.message : 'Unknown API error',
      undefined,
      error
    );
  }
}
