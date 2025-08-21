-- Migration 050: Risk Thresholds & Policies System
-- Sprint 8: Comprehensive Risk Policy Management
-- This extends the SLA/Margin policies with specific risk threshold management

-- ====================
-- RISK THRESHOLD POLICY TABLES
-- ====================

-- Table for storing comprehensive risk threshold policies
CREATE TABLE IF NOT EXISTS risk_threshold_policies (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) UNIQUE NOT NULL, -- 'risk-policy-001'
    name VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL, -- 'v2.1.0'
    
    -- Policy state and lifecycle
    state VARCHAR(20) DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'scheduled', 'archived')),
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_date TIMESTAMP WITH TIME ZONE,
    
    -- Value & Fragility Thresholds
    value_bands JSONB NOT NULL DEFAULT '[]',
    -- Example structure:
    -- [
    --   {"id": "1", "minValue": 0, "maxValue": 1000, "recommendedTier": "T1", "wgRecommended": false},
    --   {"id": "2", "minValue": 1000, "maxValue": 5000, "recommendedTier": "T2", "wgRecommended": false},
    --   {"id": "3", "minValue": 5000, "maxValue": null, "recommendedTier": "T3", "wgRecommended": true}
    -- ]
    
    fragility_rules JSONB NOT NULL DEFAULT '[]',
    -- Example structure:
    -- [
    --   {"fragility": 1, "wgRecommended": false, "requiresRigidPackaging": false},
    --   {"fragility": 2, "wgRecommended": false, "requiresRigidPackaging": false},
    --   {"fragility": 3, "wgRecommended": false, "requiresRigidPackaging": true},
    --   {"fragility": 4, "wgRecommended": true, "requiresRigidPackaging": true},
    --   {"fragility": 5, "wgRecommended": true, "requiresRigidPackaging": true}
    -- ]
    
    brand_overrides JSONB NOT NULL DEFAULT '[]',
    -- Example structure:
    -- [
    --   {"id": "1", "brand": "Hermès", "marketplace": "All", "minimumTier": "T3"},
    --   {"id": "2", "brand": "Rolex", "marketplace": "All", "minimumTier": "T3"},
    --   {"id": "3", "brand": "Louis Vuitton", "marketplace": "Vestiaire", "minimumTier": "T2"}
    -- ]
    
    -- Customs & Lane Risk Configuration
    lane_risks JSONB NOT NULL DEFAULT '[]',
    -- Example structure:
    -- [
    --   {"id": "1", "category": "EU↔EU", "baseRiskLevel": 0.1, "requiredDocs": ["Commercial Invoice"], "autoIncidentHours": 72},
    --   {"id": "2", "category": "UK↔EU", "baseRiskLevel": 0.3, "requiredDocs": ["Commercial Invoice", "HS Code", "Insured Value Evidence"], "autoIncidentHours": 48},
    --   {"id": "3", "category": "International", "baseRiskLevel": 0.5, "requiredDocs": ["Commercial Invoice", "HS Code", "Incoterm", "Insured Value Evidence"], "autoIncidentHours": 24}
    -- ]
    
    -- Inventory Thresholds (Global Defaults)
    inventory_thresholds JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {
    --   "tags": {"lowStockQty": 50, "minDaysOfCover": 7},
    --   "nfc": {"lowStockQty": 20, "minDaysOfCover": 5, "lotFailureQuarantineThreshold": 15},
    --   "transferSlaHours": 24
    -- }
    
    -- Risk Model Configuration
    risk_weights JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {"time": 0.4, "cost": 0.3, "risk": 0.3}
    
    risk_components JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {
    --   "valueRisk": 0.2, "fragilityRisk": 0.15, "laneRisk": 0.2,
    --   "operatorRisk": 0.15, "carrierRisk": 0.1, "addressRisk": 0.1, "hubLoadRisk": 0.1
    -- }
    
    -- Security & Chain of Custody Defaults
    security_defaults JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {
    --   "otpLivenessValueThreshold": 2000,
    --   "sealRequiredTiers": ["T2", "T3"],
    --   "minPhotosPickup": 2, "minPhotosIntake": 3, "minPhotosDelivery": 2
    -- }
    
    -- Incident Automation Rules
    incident_rules JSONB NOT NULL DEFAULT '[]',
    -- Example structure:
    -- [
    --   {
    --     "id": "1", "trigger": "DHL No-Scan", "condition": "> 6 hours after label purchase",
    --     "incidentType": "delay", "severity": "S3", "assignTo": "Ops Team",
    --     "description": "DHL package not scanned within expected timeframe"
    --   }
    -- ]
    
    -- Publishing & Scope Configuration
    publishing_scope JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {
    --   "newShipmentsOnly": true, "unplannedDrafts": true, "retroactiveChanges": false,
    --   "notifyRoles": ["Ops", "WG Coordinators", "Hub Leads"]
    -- }
    
    -- Change management
    change_reason TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    last_edited_by VARCHAR(255) NOT NULL,
    last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Approval workflow (for protection-lowering changes)
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_request_id VARCHAR(100),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    policy_metadata JSONB DEFAULT '{}',
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for risk policy version history and audit trail
CREATE TABLE IF NOT EXISTS risk_policy_version_history (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) REFERENCES risk_threshold_policies(policy_id),
    version VARCHAR(20) NOT NULL,
    
    -- Change details
    change_type VARCHAR(30) NOT NULL, -- 'created', 'updated', 'published', 'scheduled', 'rolled_back', 'archived'
    change_reason TEXT NOT NULL,
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Field-level changes
    fields_changed JSONB DEFAULT '[]', -- ["valueBands", "riskWeights.time", "inventoryThresholds.tags.lowStockQty"]
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    
    -- Full policy snapshot at time of change
    policy_snapshot JSONB NOT NULL,
    
    -- Impact analysis
    affected_quotes INTEGER DEFAULT 0,
    affected_shipments INTEGER DEFAULT 0,
    affected_alerts INTEGER DEFAULT 0,
    
    -- Approval details (if applicable)
    approval_request_id VARCHAR(100),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Table for risk policy simulation results
CREATE TABLE IF NOT EXISTS risk_policy_simulations (
    id SERIAL PRIMARY KEY,
    simulation_id VARCHAR(100) UNIQUE NOT NULL,
    policy_id VARCHAR(50) REFERENCES risk_threshold_policies(policy_id),
    
    -- Simulation context
    simulated_by VARCHAR(255) NOT NULL,
    simulated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    simulation_type VARCHAR(30) DEFAULT 'policy_change', -- 'policy_change', 'rollback', 'scheduled_activation'
    
    -- Input parameters
    target_value_bands JSONB,
    target_risk_weights JSONB,
    target_inventory_thresholds JSONB,
    target_incident_rules JSONB,
    sample_shipments JSONB DEFAULT '[]',
    
    -- Route Change Results
    routes_flipped INTEGER DEFAULT 0,
    new_warnings INTEGER DEFAULT 0,
    new_blocks INTEGER DEFAULT 0,
    total_routes INTEGER DEFAULT 0,
    
    -- Alert Change Results
    new_inventory_alerts INTEGER DEFAULT 0,
    new_customs_alerts INTEGER DEFAULT 0,
    new_incident_rules_count INTEGER DEFAULT 0,
    total_alerts_change INTEGER DEFAULT 0,
    
    -- Conflict Analysis
    conflicts_found JSONB DEFAULT '[]',
    estimated_impact VARCHAR(10) DEFAULT 'Low', -- 'Low', 'Medium', 'High'
    
    -- Detailed results
    simulation_results JSONB NOT NULL DEFAULT '{}',
    -- Example: {
    --   "routeChanges": {"routesFlipped": 23, "newWarnings": 8, "newBlocks": 3, "totalRoutes": 1247},
    --   "alertChanges": {"newInventoryAlerts": 5, "newCustomsAlerts": 2, "newIncidentRules": 3, "totalAlertsChange": 10}
    -- }
    
    -- Performance metrics
    simulation_duration_ms INTEGER NOT NULL,
    routes_calculated INTEGER DEFAULT 0,
    
    -- Impact assessment
    business_impact JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]'
);

-- Table for risk policy events (extends the existing policy_events table concept)
CREATE TABLE IF NOT EXISTS risk_policy_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    -- 'settings.thresholds.updated', 'settings.riskmodel.updated', 'settings.policy.published',
    -- 'settings.policy.rolled_back', 'settings.thresholds.simulated'
    
    -- Context
    policy_id VARCHAR(50) REFERENCES risk_threshold_policies(policy_id),
    version VARCHAR(20) NOT NULL,
    effective_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Actor information
    actor_id VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50),
    approver_id VARCHAR(255),
    
    -- Event payload
    event_data JSONB NOT NULL DEFAULT '{}',
    fields_changed JSONB DEFAULT '[]',
    reason TEXT,
    scheduled BOOLEAN DEFAULT FALSE,
    
    -- Additional context
    from_version VARCHAR(20), -- For rollback events
    to_version VARCHAR(20),   -- For rollback events
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_errors JSONB DEFAULT '[]',
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for active risk policy cache (for high-performance queries)
CREATE TABLE IF NOT EXISTS active_risk_policy_cache (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Current active policy
    current_version VARCHAR(20) NOT NULL,
    effective_since TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Flattened value bands for fast queries
    value_band_t1_max DECIMAL(12,2) DEFAULT 1000,
    value_band_t2_max DECIMAL(12,2) DEFAULT 5000,
    value_band_t3_min DECIMAL(12,2) DEFAULT 5000,
    wg_recommended_value_threshold DECIMAL(12,2) DEFAULT 5000,
    
    -- Flattened fragility rules
    fragility_wg_threshold INTEGER DEFAULT 4,
    fragility_rigid_packaging_threshold INTEGER DEFAULT 3,
    
    -- Flattened lane risks
    eu_eu_base_risk DECIMAL(4,3) DEFAULT 0.1,
    uk_eu_base_risk DECIMAL(4,3) DEFAULT 0.3,
    international_base_risk DECIMAL(4,3) DEFAULT 0.5,
    
    -- Flattened inventory thresholds
    tags_low_stock_qty INTEGER DEFAULT 50,
    tags_min_days_cover INTEGER DEFAULT 7,
    nfc_low_stock_qty INTEGER DEFAULT 20,
    nfc_min_days_cover INTEGER DEFAULT 5,
    nfc_lot_failure_threshold DECIMAL(5,2) DEFAULT 15.0,
    transfer_sla_hours INTEGER DEFAULT 24,
    
    -- Flattened risk weights (normalized)
    risk_weight_time DECIMAL(4,3) DEFAULT 0.400,
    risk_weight_cost DECIMAL(4,3) DEFAULT 0.300,
    risk_weight_risk DECIMAL(4,3) DEFAULT 0.300,
    
    -- Flattened risk components
    risk_component_value DECIMAL(4,3) DEFAULT 0.200,
    risk_component_fragility DECIMAL(4,3) DEFAULT 0.150,
    risk_component_lane DECIMAL(4,3) DEFAULT 0.200,
    risk_component_operator DECIMAL(4,3) DEFAULT 0.150,
    risk_component_carrier DECIMAL(4,3) DEFAULT 0.100,
    risk_component_address DECIMAL(4,3) DEFAULT 0.100,
    risk_component_hub_load DECIMAL(4,3) DEFAULT 0.100,
    
    -- Flattened security defaults
    otp_liveness_value_threshold DECIMAL(12,2) DEFAULT 2000,
    seal_required_t2 BOOLEAN DEFAULT TRUE,
    seal_required_t3 BOOLEAN DEFAULT TRUE,
    min_photos_pickup INTEGER DEFAULT 2,
    min_photos_intake INTEGER DEFAULT 3,
    min_photos_delivery INTEGER DEFAULT 2,
    
    -- Cache management
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cache_version INTEGER DEFAULT 1
);

-- Table for risk policy conflicts and validation results
CREATE TABLE IF NOT EXISTS risk_policy_conflicts (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) REFERENCES risk_threshold_policies(policy_id),
    conflict_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Conflict details
    conflict_type VARCHAR(30) NOT NULL, -- 'value-policy', 'tier-restriction', 'threshold-conflict'
    description TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL, -- 'warning', 'error'
    
    -- Context
    field_path VARCHAR(255), -- e.g., 'valueBands[0].recommendedTier'
    current_value JSONB,
    recommended_value JSONB,
    
    -- Resolution
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'resolved', 'ignored'
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Audit
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- INDEXES FOR PERFORMANCE
-- ====================

-- Primary risk policy indexes
CREATE INDEX IF NOT EXISTS idx_risk_policies_policy_id ON risk_threshold_policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_risk_policies_state ON risk_threshold_policies(state);
CREATE INDEX IF NOT EXISTS idx_risk_policies_effective_date ON risk_threshold_policies(effective_date);
CREATE INDEX IF NOT EXISTS idx_risk_policies_version ON risk_threshold_policies(policy_id, version);

-- Risk version history indexes
CREATE INDEX IF NOT EXISTS idx_risk_version_history_policy ON risk_policy_version_history(policy_id);
CREATE INDEX IF NOT EXISTS idx_risk_version_history_changed_at ON risk_policy_version_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_risk_version_history_change_type ON risk_policy_version_history(change_type);

-- Risk simulation indexes
CREATE INDEX IF NOT EXISTS idx_risk_simulations_policy ON risk_policy_simulations(policy_id);
CREATE INDEX IF NOT EXISTS idx_risk_simulations_simulated_at ON risk_policy_simulations(simulated_at);
CREATE INDEX IF NOT EXISTS idx_risk_simulations_simulated_by ON risk_policy_simulations(simulated_by);

-- Risk event indexes
CREATE INDEX IF NOT EXISTS idx_risk_policy_events_type ON risk_policy_events(event_type);
CREATE INDEX IF NOT EXISTS idx_risk_policy_events_policy ON risk_policy_events(policy_id);
CREATE INDEX IF NOT EXISTS idx_risk_policy_events_effective_at ON risk_policy_events(effective_at);
CREATE INDEX IF NOT EXISTS idx_risk_policy_events_processed ON risk_policy_events(processed);

-- Risk cache indexes
CREATE INDEX IF NOT EXISTS idx_active_risk_cache_policy ON active_risk_policy_cache(policy_id);

-- Conflict indexes
CREATE INDEX IF NOT EXISTS idx_risk_conflicts_policy ON risk_policy_conflicts(policy_id);
CREATE INDEX IF NOT EXISTS idx_risk_conflicts_status ON risk_policy_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_risk_conflicts_severity ON risk_policy_conflicts(severity);

-- ====================
-- TRIGGERS AND FUNCTIONS
-- ====================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_risk_policy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamps
CREATE TRIGGER update_risk_policies_updated_at 
    BEFORE UPDATE ON risk_threshold_policies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_risk_policy_updated_at();

-- Function to create risk policy version history entry
CREATE OR REPLACE FUNCTION create_risk_policy_version_history()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val VARCHAR(30);
    fields_changed_arr JSONB := '[]'::jsonb;
    old_vals JSONB := '{}'::jsonb;
    new_vals JSONB := '{}'::jsonb;
BEGIN
    -- Determine change type
    IF TG_OP = 'INSERT' THEN
        change_type_val := 'created';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.state != NEW.state AND NEW.state = 'published' THEN
            change_type_val := 'published';
        ELSIF OLD.state != NEW.state AND NEW.state = 'scheduled' THEN
            change_type_val := 'scheduled';
        ELSIF OLD.state != NEW.state AND NEW.state = 'archived' THEN
            change_type_val := 'archived';
        ELSE
            change_type_val := 'updated';
        END IF;
        
        -- Track field changes for key fields
        IF OLD.value_bands != NEW.value_bands THEN
            fields_changed_arr := fields_changed_arr || '["value_bands"]'::jsonb;
            old_vals := old_vals || jsonb_build_object('value_bands', OLD.value_bands);
            new_vals := new_vals || jsonb_build_object('value_bands', NEW.value_bands);
        END IF;
        
        IF OLD.risk_weights != NEW.risk_weights THEN
            fields_changed_arr := fields_changed_arr || '["risk_weights"]'::jsonb;
            old_vals := old_vals || jsonb_build_object('risk_weights', OLD.risk_weights);
            new_vals := new_vals || jsonb_build_object('risk_weights', NEW.risk_weights);
        END IF;
        
        IF OLD.inventory_thresholds != NEW.inventory_thresholds THEN
            fields_changed_arr := fields_changed_arr || '["inventory_thresholds"]'::jsonb;
            old_vals := old_vals || jsonb_build_object('inventory_thresholds', OLD.inventory_thresholds);
            new_vals := new_vals || jsonb_build_object('inventory_thresholds', NEW.inventory_thresholds);
        END IF;
    END IF;
    
    -- Insert version history record
    INSERT INTO risk_policy_version_history (
        policy_id, version, change_type, change_reason, changed_by, changed_at,
        fields_changed, old_values, new_values, policy_snapshot,
        approval_request_id, approved_by, approved_at
    ) VALUES (
        NEW.policy_id, NEW.version, change_type_val, NEW.change_reason, NEW.last_edited_by, NEW.last_edited_at,
        fields_changed_arr, old_vals, new_vals,
        jsonb_build_object(
            'value_bands', NEW.value_bands,
            'fragility_rules', NEW.fragility_rules,
            'brand_overrides', NEW.brand_overrides,
            'lane_risks', NEW.lane_risks,
            'inventory_thresholds', NEW.inventory_thresholds,
            'risk_weights', NEW.risk_weights,
            'risk_components', NEW.risk_components,
            'security_defaults', NEW.security_defaults,
            'incident_rules', NEW.incident_rules,
            'publishing_scope', NEW.publishing_scope,
            'state', NEW.state,
            'effective_date', NEW.effective_date,
            'metadata', NEW.policy_metadata
        ),
        NEW.approval_request_id, NEW.approved_by, NEW.approved_at
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for version history
CREATE TRIGGER create_risk_version_history 
    AFTER INSERT OR UPDATE ON risk_threshold_policies 
    FOR EACH ROW 
    EXECUTE FUNCTION create_risk_policy_version_history();

-- Function to refresh active risk policy cache
CREATE OR REPLACE FUNCTION refresh_active_risk_policy_cache(target_policy_id VARCHAR(50))
RETURNS VOID AS $$
DECLARE
    policy_record RECORD;
    value_bands_data JSONB;
    fragility_data JSONB;
    inventory_data JSONB;
    risk_weights_data JSONB;
    risk_components_data JSONB;
    security_data JSONB;
BEGIN
    -- Get the current active policy
    SELECT * INTO policy_record
    FROM risk_threshold_policies 
    WHERE policy_id = target_policy_id 
    AND state IN ('published', 'scheduled')
    AND effective_date <= CURRENT_TIMESTAMP
    ORDER BY effective_date DESC
    LIMIT 1;
    
    IF policy_record.id IS NOT NULL THEN
        value_bands_data := policy_record.value_bands;
        fragility_data := policy_record.fragility_rules;
        inventory_data := policy_record.inventory_thresholds;
        risk_weights_data := policy_record.risk_weights;
        risk_components_data := policy_record.risk_components;
        security_data := policy_record.security_defaults;
        
        -- Insert or update cache
        INSERT INTO active_risk_policy_cache (
            policy_id, current_version, effective_since,
            value_band_t1_max, value_band_t2_max, value_band_t3_min,
            fragility_wg_threshold, fragility_rigid_packaging_threshold,
            tags_low_stock_qty, tags_min_days_cover,
            nfc_low_stock_qty, nfc_min_days_cover, nfc_lot_failure_threshold,
            transfer_sla_hours,
            risk_weight_time, risk_weight_cost, risk_weight_risk,
            risk_component_value, risk_component_fragility, risk_component_lane,
            risk_component_operator, risk_component_carrier, risk_component_address, risk_component_hub_load,
            otp_liveness_value_threshold, seal_required_t2, seal_required_t3,
            min_photos_pickup, min_photos_intake, min_photos_delivery,
            cache_version
        ) VALUES (
            policy_record.policy_id, policy_record.version, policy_record.effective_date,
            COALESCE((value_bands_data->0->>'maxValue')::decimal, 1000),
            COALESCE((value_bands_data->1->>'maxValue')::decimal, 5000),
            COALESCE((value_bands_data->2->>'minValue')::decimal, 5000),
            4, 3, -- Default fragility thresholds
            COALESCE((inventory_data->'tags'->>'lowStockQty')::integer, 50),
            COALESCE((inventory_data->'tags'->>'minDaysOfCover')::integer, 7),
            COALESCE((inventory_data->'nfc'->>'lowStockQty')::integer, 20),
            COALESCE((inventory_data->'nfc'->>'minDaysOfCover')::integer, 5),
            COALESCE((inventory_data->'nfc'->>'lotFailureQuarantineThreshold')::decimal, 15.0),
            COALESCE((inventory_data->>'transferSlaHours')::integer, 24),
            COALESCE((risk_weights_data->>'time')::decimal, 0.4),
            COALESCE((risk_weights_data->>'cost')::decimal, 0.3),
            COALESCE((risk_weights_data->>'risk')::decimal, 0.3),
            COALESCE((risk_components_data->>'valueRisk')::decimal, 0.2),
            COALESCE((risk_components_data->>'fragilityRisk')::decimal, 0.15),
            COALESCE((risk_components_data->>'laneRisk')::decimal, 0.2),
            COALESCE((risk_components_data->>'operatorRisk')::decimal, 0.15),
            COALESCE((risk_components_data->>'carrierRisk')::decimal, 0.1),
            COALESCE((risk_components_data->>'addressRisk')::decimal, 0.1),
            COALESCE((risk_components_data->>'hubLoadRisk')::decimal, 0.1),
            COALESCE((security_data->>'otpLivenessValueThreshold')::decimal, 2000),
            COALESCE(security_data->'sealRequiredTiers' ? 'T2', true),
            COALESCE(security_data->'sealRequiredTiers' ? 'T3', true),
            COALESCE((security_data->>'minPhotosPickup')::integer, 2),
            COALESCE((security_data->>'minPhotosIntake')::integer, 3),
            COALESCE((security_data->>'minPhotosDelivery')::integer, 2),
            1
        ) 
        ON CONFLICT (policy_id) DO UPDATE SET
            current_version = EXCLUDED.current_version,
            effective_since = EXCLUDED.effective_since,
            value_band_t1_max = EXCLUDED.value_band_t1_max,
            value_band_t2_max = EXCLUDED.value_band_t2_max,
            value_band_t3_min = EXCLUDED.value_band_t3_min,
            fragility_wg_threshold = EXCLUDED.fragility_wg_threshold,
            fragility_rigid_packaging_threshold = EXCLUDED.fragility_rigid_packaging_threshold,
            tags_low_stock_qty = EXCLUDED.tags_low_stock_qty,
            tags_min_days_cover = EXCLUDED.tags_min_days_cover,
            nfc_low_stock_qty = EXCLUDED.nfc_low_stock_qty,
            nfc_min_days_cover = EXCLUDED.nfc_min_days_cover,
            nfc_lot_failure_threshold = EXCLUDED.nfc_lot_failure_threshold,
            transfer_sla_hours = EXCLUDED.transfer_sla_hours,
            risk_weight_time = EXCLUDED.risk_weight_time,
            risk_weight_cost = EXCLUDED.risk_weight_cost,
            risk_weight_risk = EXCLUDED.risk_weight_risk,
            risk_component_value = EXCLUDED.risk_component_value,
            risk_component_fragility = EXCLUDED.risk_component_fragility,
            risk_component_lane = EXCLUDED.risk_component_lane,
            risk_component_operator = EXCLUDED.risk_component_operator,
            risk_component_carrier = EXCLUDED.risk_component_carrier,
            risk_component_address = EXCLUDED.risk_component_address,
            risk_component_hub_load = EXCLUDED.risk_component_hub_load,
            otp_liveness_value_threshold = EXCLUDED.otp_liveness_value_threshold,
            seal_required_t2 = EXCLUDED.seal_required_t2,
            seal_required_t3 = EXCLUDED.seal_required_t3,
            min_photos_pickup = EXCLUDED.min_photos_pickup,
            min_photos_intake = EXCLUDED.min_photos_intake,
            min_photos_delivery = EXCLUDED.min_photos_delivery,
            last_updated = CURRENT_TIMESTAMP,
            cache_version = active_risk_policy_cache.cache_version + 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- SAMPLE DATA
-- ====================

-- Insert default risk threshold policy
INSERT INTO risk_threshold_policies (
    policy_id, name, version, state, effective_date,
    value_bands, fragility_rules, brand_overrides, lane_risks,
    inventory_thresholds, risk_weights, risk_components,
    security_defaults, incident_rules, publishing_scope,
    change_reason, created_by, last_edited_by
) VALUES (
    'risk-policy-001', 
    'Standard Risk Policy v2.1', 
    'v2.1.0', 
    'published', 
    '2024-01-15 10:00:00+01:00',
    '[
        {"id": "1", "minValue": 0, "maxValue": 1000, "recommendedTier": "T1", "wgRecommended": false},
        {"id": "2", "minValue": 1000, "maxValue": 5000, "recommendedTier": "T2", "wgRecommended": false},
        {"id": "3", "minValue": 5000, "maxValue": null, "recommendedTier": "T3", "wgRecommended": true}
    ]',
    '[
        {"fragility": 1, "wgRecommended": false, "requiresRigidPackaging": false},
        {"fragility": 2, "wgRecommended": false, "requiresRigidPackaging": false},
        {"fragility": 3, "wgRecommended": false, "requiresRigidPackaging": true},
        {"fragility": 4, "wgRecommended": true, "requiresRigidPackaging": true},
        {"fragility": 5, "wgRecommended": true, "requiresRigidPackaging": true}
    ]',
    '[
        {"id": "1", "brand": "Hermès", "marketplace": "All", "minimumTier": "T3"},
        {"id": "2", "brand": "Rolex", "marketplace": "All", "minimumTier": "T3"},
        {"id": "3", "brand": "Louis Vuitton", "marketplace": "Vestiaire", "minimumTier": "T2"}
    ]',
    '[
        {"id": "1", "category": "EU↔EU", "baseRiskLevel": 0.1, "requiredDocs": ["Commercial Invoice"], "autoIncidentHours": 72},
        {"id": "2", "category": "UK↔EU", "baseRiskLevel": 0.3, "requiredDocs": ["Commercial Invoice", "HS Code", "Insured Value Evidence"], "autoIncidentHours": 48},
        {"id": "3", "category": "International", "baseRiskLevel": 0.5, "requiredDocs": ["Commercial Invoice", "HS Code", "Incoterm", "Insured Value Evidence"], "autoIncidentHours": 24}
    ]',
    '{
        "tags": {"lowStockQty": 50, "minDaysOfCover": 7},
        "nfc": {"lowStockQty": 20, "minDaysOfCover": 5, "lotFailureQuarantineThreshold": 15},
        "transferSlaHours": 24
    }',
    '{"time": 0.4, "cost": 0.3, "risk": 0.3}',
    '{
        "valueRisk": 0.2, "fragilityRisk": 0.15, "laneRisk": 0.2,
        "operatorRisk": 0.15, "carrierRisk": 0.1, "addressRisk": 0.1, "hubLoadRisk": 0.1
    }',
    '{
        "otpLivenessValueThreshold": 2000,
        "sealRequiredTiers": ["T2", "T3"],
        "minPhotosPickup": 2, "minPhotosIntake": 3, "minPhotosDelivery": 2
    }',
    '[
        {
            "id": "1", "trigger": "DHL No-Scan", "condition": "> 6 hours after label purchase",
            "incidentType": "delay", "severity": "S3", "assignTo": "Ops Team",
            "description": "DHL package not scanned within expected timeframe"
        },
        {
            "id": "2", "trigger": "WG No-Confirm", "condition": "30 min before scheduled slot",
            "incidentType": "delay", "severity": "S2", "assignTo": "WG Coordinator",
            "description": "White Glove service not confirmed before scheduled pickup"
        },
        {
            "id": "3", "trigger": "Hub Over Capacity", "condition": "Beyond capacity day threshold",
            "incidentType": "capacity", "severity": "S2", "assignTo": "Hub Lead",
            "description": "Hub operating beyond safe capacity limits"
        }
    ]',
    '{
        "newShipmentsOnly": true, "unplannedDrafts": true, "retroactiveChanges": false,
        "notifyRoles": ["Ops", "WG Coordinators", "Hub Leads"]
    }',
    'Initial risk threshold policy setup for Q1 2024',
    'system',
    'alice.ops@aucta.io'
) ON CONFLICT (policy_id) DO NOTHING;

-- Refresh the cache for the default risk policy
SELECT refresh_active_risk_policy_cache('risk-policy-001');

-- ====================
-- TABLE COMMENTS
-- ====================

COMMENT ON TABLE risk_threshold_policies IS 'Comprehensive risk threshold and policy configuration management';
COMMENT ON TABLE risk_policy_version_history IS 'Complete audit trail of risk policy changes with field-level tracking';
COMMENT ON TABLE risk_policy_simulations IS 'Storage for risk policy simulation results and impact analysis';
COMMENT ON TABLE risk_policy_events IS 'Event log for risk policy changes, used for system synchronization and analytics';
COMMENT ON TABLE active_risk_policy_cache IS 'High-performance cache of current active risk policy settings for fast queries';
COMMENT ON TABLE risk_policy_conflicts IS 'Validation conflicts and resolution tracking for risk policies';

COMMENT ON COLUMN risk_threshold_policies.value_bands IS 'JSONB array of value ranges with tier recommendations and WG hints';
COMMENT ON COLUMN risk_threshold_policies.fragility_rules IS 'JSONB array of fragility level rules for packaging and WG recommendations';
COMMENT ON COLUMN risk_threshold_policies.brand_overrides IS 'JSONB array of brand-specific minimum tier requirements';
COMMENT ON COLUMN risk_threshold_policies.lane_risks IS 'JSONB array of shipping lane risk configurations and document requirements';
COMMENT ON COLUMN risk_threshold_policies.inventory_thresholds IS 'JSONB object containing global inventory alert thresholds';
COMMENT ON COLUMN risk_threshold_policies.risk_weights IS 'JSONB object with time/cost/risk scoring weights';
COMMENT ON COLUMN risk_threshold_policies.risk_components IS 'JSONB object with individual risk component weights';
COMMENT ON COLUMN risk_threshold_policies.security_defaults IS 'JSONB object with security and chain of custody defaults';
COMMENT ON COLUMN risk_threshold_policies.incident_rules IS 'JSONB array of automatic incident creation rules';
COMMENT ON COLUMN risk_threshold_policies.publishing_scope IS 'JSONB object with publication scope and notification settings';
