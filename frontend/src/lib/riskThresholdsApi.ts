// Risk Thresholds & Policies API Client
// Connects to the backend risk-thresholds API endpoints

export interface ValueBand {
  id: string;
  minValue: number;
  maxValue: number | null;
  recommendedTier: 'T1' | 'T2' | 'T3';
  wgRecommended: boolean;
}

export interface FragilityRule {
  fragility: number;
  wgRecommended: boolean;
  requiresRigidPackaging: boolean;
}

export interface BrandOverride {
  id: string;
  brand: string;
  marketplace: string;
  minimumTier: 'T1' | 'T2' | 'T3';
}

export interface LaneRisk {
  id: string;
  category: 'EU↔EU' | 'UK↔EU' | 'International';
  baseRiskLevel: number;
  requiredDocs: string[];
  autoIncidentHours: number;
}

export interface InventoryThresholds {
  tags: {
    lowStockQty: number;
    minDaysOfCover: number;
  };
  nfc: {
    lowStockQty: number;
    minDaysOfCover: number;
    lotFailureQuarantineThreshold: number;
  };
  transferSlaHours: number;
}

export interface RiskWeights {
  time: number;
  cost: number;
  risk: number;
}

export interface RiskComponents {
  valueRisk: number;
  fragilityRisk: number;
  laneRisk: number;
  operatorRisk: number;
  carrierRisk: number;
  addressRisk: number;
  hubLoadRisk: number;
}

export interface SecurityDefaults {
  otpLivenessValueThreshold: number;
  sealRequiredTiers: ('T2' | 'T3')[];
  minPhotosPickup: number;
  minPhotosIntake: number;
  minPhotosDelivery: number;
}

export interface IncidentRule {
  id: string;
  trigger: string;
  condition: string;
  incidentType: string;
  severity: 'S1' | 'S2' | 'S3';
  assignTo: string;
  description: string;
}

export interface PublishingScope {
  newShipmentsOnly: boolean;
  unplannedDrafts: boolean;
  retroactiveChanges: boolean;
  notifyRoles: string[];
}

export interface RiskThresholdPolicy {
  policy_id: string;
  name: string;
  version: string;
  state: 'draft' | 'published' | 'scheduled' | 'archived';
  effective_date: string;
  value_bands: ValueBand[];
  fragility_rules: FragilityRule[];
  brand_overrides: BrandOverride[];
  lane_risks: LaneRisk[];
  inventory_thresholds: InventoryThresholds;
  risk_weights: RiskWeights;
  risk_components: RiskComponents;
  security_defaults: SecurityDefaults;
  incident_rules: IncidentRule[];
  publishing_scope: PublishingScope;
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

export interface PolicyVersion {
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
  affected_quotes?: number;
  affected_shipments?: number;
  affected_alerts?: number;
}

export interface SimulationResult {
  simulation_id: string;
  summary: {
    total_shipments_tested: number;
    shipments_at_risk: number;
    routes_blocked: number;
    average_score_change: number;
    simulation_duration_ms: number;
  };
  route_changes: {
    routesFlipped: number;
    newWarnings: number;
    newBlocks: number;
    totalRoutes: number;
  };
  alert_changes: {
    newInventoryAlerts: number;
    newCustomsAlerts: number;
    newIncidentRules: number;
    totalAlertsChange: number;
  };
  conflicts: ConflictItem[];
  estimated_impact: 'Low' | 'Medium' | 'High';
}

export interface ConflictItem {
  type: 'value-policy' | 'tier-restriction' | 'threshold-conflict';
  description: string;
  recommendation: string;
  severity: 'warning' | 'error';
}

export interface TelemetryData {
  period_days: number;
  simulations: {
    total_simulations: number;
    avg_duration_ms: number;
    avg_routes_flipped: number;
    avg_new_warnings: number;
    avg_new_blocks: number;
  };
  policy_changes: {
    total_changes: number;
    unique_editors: number;
  };
  conflicts: {
    total_conflicts: number;
    error_conflicts: number;
    warning_conflicts: number;
    resolved_conflicts: number;
  };
  generated_at: string;
}

class RiskThresholdsAPI {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    this.headers = {
      'Content-Type': 'application/json',
      'x-user-role': 'ops_admin', // Should be set from auth context
      'x-user-id': 'current-user-id' // Should be set from auth context
    };
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/risk-thresholds${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ==========================================
  // POLICY CRUD OPERATIONS
  // ==========================================

  async getAllPolicies(filters: {
    state?: string;
    version?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    policies: Partial<RiskThresholdPolicy>[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    return this.fetchWithAuth(`/policies${queryString ? `?${queryString}` : ''}`);
  }

  async getPolicy(policyId: string): Promise<{ policy: RiskThresholdPolicy }> {
    return this.fetchWithAuth(`/policies/${policyId}`);
  }

  async getActivePolicy(): Promise<{ policy: RiskThresholdPolicy }> {
    return this.fetchWithAuth('/policies/active/current');
  }

  async savePolicy(policyData: Partial<RiskThresholdPolicy>): Promise<{
    message: string;
    policy: RiskThresholdPolicy;
    requires_approval: boolean;
    validation: {
      valid: boolean;
      errors: string[];
      conflicts: ConflictItem[];
    };
  }> {
    return this.fetchWithAuth('/policies', {
      method: 'POST',
      body: JSON.stringify(policyData),
    });
  }

  async publishPolicy(policyId: string, publishData: {
    change_reason: string;
    scheduled_date?: string;
  }): Promise<{
    message: string;
    policy: RiskThresholdPolicy;
    effective_date: string;
  }> {
    return this.fetchWithAuth(`/policies/${policyId}/publish`, {
      method: 'POST',
      body: JSON.stringify(publishData),
    });
  }

  async rollbackPolicy(policyId: string, rollbackData: {
    target_version: string;
    change_reason: string;
  }): Promise<{
    message: string;
    policy: RiskThresholdPolicy;
    rolled_back_from: string;
    new_version: string;
  }> {
    return this.fetchWithAuth(`/policies/${policyId}/rollback`, {
      method: 'POST',
      body: JSON.stringify(rollbackData),
    });
  }

  // ==========================================
  // SIMULATION
  // ==========================================

  async runSimulation(policyId: string, simulationData: {
    value_bands?: ValueBand[];
    risk_weights?: RiskWeights;
    inventory_thresholds?: InventoryThresholds;
    incident_rules?: IncidentRule[];
    sample_shipments?: string[];
  }): Promise<SimulationResult> {
    return this.fetchWithAuth(`/policies/${policyId}/simulate`, {
      method: 'POST',
      body: JSON.stringify(simulationData),
    });
  }

  async getSimulation(simulationId: string): Promise<{
    simulation: {
      simulation_id: string;
      policy_id: string;
      simulated_by: string;
      simulated_at: string;
      routes_flipped: number;
      new_warnings: number;
      new_blocks: number;
      total_routes: number;
      new_inventory_alerts: number;
      new_customs_alerts: number;
      new_incident_rules_count: number;
      total_alerts_change: number;
      conflicts_found: ConflictItem[];
      estimated_impact: string;
      simulation_results: any;
      simulation_duration_ms: number;
    };
  }> {
    return this.fetchWithAuth(`/simulations/${simulationId}`);
  }

  // ==========================================
  // HISTORY AND AUDIT
  // ==========================================

  async getPolicyHistory(policyId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    policy_id: string;
    history: PolicyVersion[];
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    return this.fetchWithAuth(`/policies/${policyId}/history${queryString ? `?${queryString}` : ''}`);
  }

  async getPolicyEvents(policyId: string, options: {
    limit?: number;
    offset?: number;
    event_type?: string;
  } = {}): Promise<{
    policy_id: string;
    events: Array<{
      event_id: string;
      event_type: string;
      version: string;
      effective_at: string;
      actor_id: string;
      actor_role: string;
      event_data: any;
      reason: string;
      scheduled: boolean;
      processed: boolean;
      created_at: string;
    }>;
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    return this.fetchWithAuth(`/policies/${policyId}/events${queryString ? `?${queryString}` : ''}`);
  }

  // ==========================================
  // RISK ASSESSMENT
  // ==========================================

  async assessTier(assessmentData: {
    declared_value: number;
    brand?: string;
    marketplace?: string;
  }): Promise<{
    declared_value: number;
    brand?: string;
    marketplace?: string;
    recommended_tier: string;
    wg_recommended: boolean;
    brand_override?: string;
    final_recommendation: string;
    policy_version: string;
  }> {
    return this.fetchWithAuth('/assess/tier', {
      method: 'POST',
      body: JSON.stringify(assessmentData),
    });
  }

  async assessRisk(shipmentData: {
    declared_value?: number;
    fragility?: number;
    lane_category?: string;
    address_confidence?: number;
    hub_utilization?: number;
  }): Promise<{
    shipment_data: any;
    risk_assessment: {
      total_risk: number;
      components: {
        value_risk: number;
        fragility_risk: number;
        lane_risk: number;
        address_risk: number;
        hub_load_risk: number;
      };
    };
    policy_version: string;
    assessed_at: string;
  }> {
    return this.fetchWithAuth('/assess/risk', {
      method: 'POST',
      body: JSON.stringify(shipmentData),
    });
  }

  async validateInventory(inventoryData: {
    hub_id: string;
    tag_inventory?: {
      current_stock: number;
      weekly_burn_rate: number;
    };
    nfc_inventory?: {
      current_stock: number;
      lot_failure_rate: number;
    };
  }): Promise<{
    hub_id: string;
    valid: boolean;
    violations: Array<{
      type: string;
      category: string;
      message: string;
      severity: string;
      action_required?: string;
    }>;
    warnings: Array<{
      type: string;
      category: string;
      message: string;
      severity: string;
    }>;
    policy_version: string;
    validated_at: string;
  }> {
    return this.fetchWithAuth('/validate/inventory', {
      method: 'POST',
      body: JSON.stringify(inventoryData),
    });
  }

  // ==========================================
  // CACHE AND TELEMETRY
  // ==========================================

  async refreshCache(policy_id?: string): Promise<{
    message: string;
    policy_id: string;
    refreshed_at: string;
  }> {
    return this.fetchWithAuth('/cache/refresh', {
      method: 'POST',
      body: JSON.stringify({ policy_id }),
    });
  }

  async getTelemetry(days: number = 30): Promise<TelemetryData> {
    return this.fetchWithAuth(`/telemetry?days=${days}`);
  }
}

export const riskThresholdsApi = new RiskThresholdsAPI();
