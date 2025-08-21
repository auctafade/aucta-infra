// frontend/src/lib/wgBackendService.ts
// Frontend service to connect with WG backend APIs

interface WGOperator {
  id: number;
  operator_code: string;
  name: string;
  email: string;
  phone: string;
  max_value_clearance: number;
  languages: string[];
  area_coverage: string[];
  vehicle_type: string;
  rating: number;
  total_jobs: number;
  successful_jobs: number;
  status: string;
  insurance_policy_number?: string;
  insurance_expiry?: string;
  background_check_date?: string;
  special_skills: string[];
  created_at: string;
  updated_at: string;
}

interface WGShipment {
  id: number;
  shipment_code: string;
  product_name: string;
  product_category: string;
  declared_value: number;
  tier_level: number;
  sender_name: string;
  sender_address: string;
  sender_phone?: string;
  sender_time_window?: string;
  sender_timezone: string;
  buyer_name: string;
  buyer_address: string;
  buyer_phone?: string;
  buyer_time_window?: string;
  buyer_timezone: string;
  hub_location: string;
  hub_timezone: string;
  sla_deadline: string;
  priority: string;
  status: string;
  estimated_distance_km?: number;
  estimated_duration_minutes?: number;
  route_legs?: any;
  special_instructions?: string;
  requires_insurance_verification: boolean;
  requires_liveness_check: boolean;
  created_at: string;
  updated_at: string;
  // Assignment fields (when joined)
  assignment_id?: number;
  operator_id?: number;
  assignment_status?: string;
  pickup_scheduled_at?: string;
  hub_arrival_scheduled_at?: string;
  hub_departure_scheduled_at?: string;
  delivery_scheduled_at?: string;
  pickup_otp?: string;
  hub_intake_otp?: string;
  delivery_otp?: string;
  seal_id?: string;
  operator_name?: string;
  operator_phone?: string;
  operator_rating?: number;
}

interface WGAssignment {
  id: number;
  shipment_id: number;
  operator_id: number;
  assigned_by: string;
  assigned_at: string;
  assignment_type: string;
  pickup_scheduled_at?: string;
  hub_arrival_scheduled_at?: string;
  hub_departure_scheduled_at?: string;
  delivery_scheduled_at?: string;
  pickup_otp?: string;
  hub_intake_otp?: string;
  delivery_otp?: string;
  seal_id?: string;
  status: string;
  actual_pickup_at?: string;
  actual_hub_arrival_at?: string;
  actual_hub_departure_at?: string;
  actual_delivery_at?: string;
  liveness_check_pickup: boolean;
  liveness_check_hub: boolean;
  liveness_check_delivery: boolean;
  operator_notes?: string;
  issues_encountered?: string;
  created_at: string;
  updated_at: string;
}

interface HubCapacitySlot {
  id: number;
  hub_location: string;
  capacity_type: string;
  tier_level: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  max_capacity: number;
  current_bookings: number;
  is_available: boolean;
  held_until?: string;
  held_for_shipment_id?: number;
  created_at: string;
  updated_at: string;
}

interface WGSourcingRequest {
  id: number;
  shipment_id: number;
  requested_by: string;
  requested_at: string;
  sla_target_at: string;
  required_cities: string[];
  min_value_clearance: number;
  max_distance_km: number;
  urgency_level: string;
  status: string;
  assigned_operator_id?: number;
  time_to_assign_ms?: number;
  escalated_at?: string;
  escalation_reason?: string;
  escalation_channel?: string;
  created_at: string;
  updated_at: string;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  message?: string;
}

class WGBackendService {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  // Set authentication headers
  setAuthHeaders(userId: string, userRole: string, sessionId: string) {
    this.headers = {
      ...this.headers,
      'x-user-id': userId,
      'x-user-role': userRole,
      'x-session-id': sessionId,
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}/api/wg${endpoint}`, {
        headers: this.headers,
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`WG API Error (${endpoint}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ====================
  // OPERATORS
  // ====================

  async getOperators(filters?: {
    minValue?: number;
    cities?: string[];
    available?: string;
  }): Promise<APIResponse<WGOperator[]>> {
    const params = new URLSearchParams();
    
    if (filters?.minValue) {
      params.append('minValue', filters.minValue.toString());
    }
    if (filters?.cities && filters.cities.length > 0) {
      params.append('cities', filters.cities.join(','));
    }
    if (filters?.available) {
      params.append('available', filters.available);
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest<WGOperator[]>(`/operators${query}`);
  }

  async getOperatorById(operatorId: number): Promise<APIResponse<WGOperator>> {
    return this.makeRequest<WGOperator>(`/operators/${operatorId}`);
  }

  // ====================
  // SHIPMENTS
  // ====================

  async getPendingShipments(): Promise<APIResponse<WGShipment[]>> {
    return this.makeRequest<WGShipment[]>('/shipments/pending');
  }

  async getShipmentById(shipmentId: number): Promise<APIResponse<WGShipment>> {
    return this.makeRequest<WGShipment>(`/shipments/${shipmentId}`);
  }

  async getShipmentByCode(shipmentCode: string): Promise<APIResponse<WGShipment>> {
    return this.makeRequest<WGShipment>(`/shipments/code/${shipmentCode}`);
  }

  async createShipment(shipmentData: Partial<WGShipment>): Promise<APIResponse<WGShipment>> {
    return this.makeRequest<WGShipment>('/shipments', {
      method: 'POST',
      body: JSON.stringify(shipmentData),
    });
  }

  // ====================
  // ASSIGNMENTS
  // ====================

  async createAssignment(assignmentData: {
    shipment_id: number;
    operator_id: number;
    assigned_by: string;
    assignment_type?: string;
    pickup_scheduled_at?: string;
    hub_arrival_scheduled_at?: string;
    hub_departure_scheduled_at?: string;
    delivery_scheduled_at?: string;
    liveness_check_pickup?: boolean;
    liveness_check_hub?: boolean;
    liveness_check_delivery?: boolean;
  }): Promise<APIResponse<WGAssignment>> {
    return this.makeRequest<WGAssignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  }

  async getAssignmentById(assignmentId: number): Promise<APIResponse<WGAssignment>> {
    return this.makeRequest<WGAssignment>(`/assignments/${assignmentId}`);
  }

  async updateAssignmentStatus(
    assignmentId: number,
    status: string
  ): Promise<APIResponse<WGAssignment>> {
    return this.makeRequest<WGAssignment>(`/assignments/${assignmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // ====================
  // HUB CAPACITY
  // ====================

  async getHubCapacity(
    hubLocation: string,
    date: string,
    tierLevel: number
  ): Promise<APIResponse<HubCapacitySlot[]>> {
    const params = new URLSearchParams({
      hub_location: hubLocation,
      date: date,
      tier_level: tierLevel.toString(),
    });

    return this.makeRequest<HubCapacitySlot[]>(`/hub/capacity?${params.toString()}`);
  }

  async holdHubCapacity(
    slotId: number,
    shipmentId: number,
    holdDurationMinutes?: number
  ): Promise<APIResponse<HubCapacitySlot>> {
    return this.makeRequest<HubCapacitySlot>(`/hub/capacity/${slotId}/hold`, {
      method: 'POST',
      body: JSON.stringify({
        shipment_id: shipmentId,
        hold_duration_minutes: holdDurationMinutes,
      }),
    });
  }

  async releaseHubCapacity(slotId: number): Promise<APIResponse<HubCapacitySlot>> {
    return this.makeRequest<HubCapacitySlot>(`/hub/capacity/${slotId}/hold`, {
      method: 'DELETE',
    });
  }

  // ====================
  // SOURCING
  // ====================

  async createSourcingRequest(requestData: {
    shipment_id: number;
    requested_by: string;
    sla_target_at: string;
    required_cities: string[];
    min_value_clearance: number;
    max_distance_km?: number;
    urgency_level?: string;
  }): Promise<APIResponse<WGSourcingRequest>> {
    return this.makeRequest<WGSourcingRequest>('/sourcing/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  }

  async escalateSourcing(
    requestId: number,
    reason: string,
    channel: string
  ): Promise<APIResponse<WGSourcingRequest>> {
    return this.makeRequest<WGSourcingRequest>(`/sourcing/requests/${requestId}/escalate`, {
      method: 'PUT',
      body: JSON.stringify({ reason, channel }),
    });
  }

  // ====================
  // TELEMETRY
  // ====================

  async logTelemetryEvent(eventData: {
    event_type: string;
    shipment_id?: number;
    operator_id?: number;
    user_id: string;
    session_id: string;
    event_data: any;
    duration_ms?: number;
    score_value?: number;
  }): Promise<APIResponse<any>> {
    return this.makeRequest<any>('/telemetry/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async getPerformanceMetrics(
    startDate: string,
    endDate: string
  ): Promise<APIResponse<any[]>> {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    return this.makeRequest<any[]>(`/analytics/performance?${params.toString()}`);
  }

  // ====================
  // CONSTRAINTS
  // ====================

  async logConstraintViolation(constraintData: {
    shipment_id?: number;
    assignment_id?: number;
    constraint_type: string;
    constraint_description: string;
    violation_severity?: string;
    resolution_action?: string;
    resolved_by?: string;
    is_override?: boolean;
    override_reason?: string;
    override_authorized_by?: string;
  }): Promise<APIResponse<any>> {
    return this.makeRequest<any>('/constraints/violations', {
      method: 'POST',
      body: JSON.stringify(constraintData),
    });
  }

  // ====================
  // AUDIT
  // ====================

  async getAuditLogs(filters?: {
    user_id?: string;
    action_type?: string;
    shipment_id?: number;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<APIResponse<any[]>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.makeRequest<any[]>(`/audit/logs${query}`);
  }

  // ====================
  // HEALTH CHECK
  // ====================

  async healthCheck(): Promise<APIResponse<any>> {
    return this.makeRequest<any>('/health');
  }

  // ====================
  // UTILITY METHODS
  // ====================

  // Convert backend data to frontend format
  formatShipmentForDisplay(shipment: WGShipment) {
    return {
      ...shipment,
      declared_value_formatted: (shipment.declared_value / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      }),
      sla_deadline_formatted: new Date(shipment.sla_deadline).toLocaleString(),
      created_at_formatted: new Date(shipment.created_at).toLocaleString(),
    };
  }

  formatOperatorForDisplay(operator: WGOperator) {
    return {
      ...operator,
      max_value_clearance_formatted: (operator.max_value_clearance / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      }),
      success_rate: operator.total_jobs > 0 
        ? ((operator.successful_jobs / operator.total_jobs) * 100).toFixed(1) + '%'
        : 'N/A',
      languages_formatted: operator.languages.join(', '),
      area_coverage_formatted: operator.area_coverage.join(', '),
      special_skills_formatted: operator.special_skills.join(', '),
    };
  }

  // Check if operator is compatible with shipment
  isOperatorCompatible(operator: WGOperator, shipment: WGShipment): boolean {
    // Value clearance check
    if (operator.max_value_clearance < shipment.declared_value) {
      return false;
    }

    // Area coverage check (basic implementation)
    // In a real system, this would be more sophisticated
    const shipmentAreas = [
      shipment.sender_address,
      shipment.buyer_address,
      shipment.hub_location,
    ];

    const hasAreaCoverage = operator.area_coverage.some(area =>
      shipmentAreas.some(shipmentArea =>
        shipmentArea.toLowerCase().includes(area.toLowerCase())
      )
    );

    return hasAreaCoverage;
  }

  // Calculate compatibility score
  calculateCompatibilityScore(operator: WGOperator, shipment: WGShipment): number {
    let score = 0;

    // Value clearance (30 points max)
    if (operator.max_value_clearance >= shipment.declared_value) {
      const valueRatio = shipment.declared_value / operator.max_value_clearance;
      score += Math.min(30, valueRatio * 30);
    }

    // Rating (25 points max)
    score += (operator.rating / 5.0) * 25;

    // Experience (20 points max)
    if (operator.total_jobs > 0) {
      const successRate = operator.successful_jobs / operator.total_jobs;
      score += successRate * 20;
    }

    // Area coverage (15 points max)
    if (this.isOperatorCompatible(operator, shipment)) {
      score += 15;
    }

    // Special skills bonus (10 points max)
    const relevantSkills = operator.special_skills.filter(skill =>
      skill.toLowerCase().includes(shipment.product_category.toLowerCase()) ||
      skill.toLowerCase().includes('high-value')
    );
    score += Math.min(10, relevantSkills.length * 5);

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }
}

// Create singleton instance
const wgBackendService = new WGBackendService();

export default wgBackendService;
export type {
  WGOperator,
  WGShipment,
  WGAssignment,
  HubCapacitySlot,
  WGSourcingRequest,
  APIResponse,
};
