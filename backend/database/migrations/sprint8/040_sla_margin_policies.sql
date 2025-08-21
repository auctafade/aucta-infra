-- Migration 040: SLA & Margin Policies System
-- Sprint 8: Operational Guardrails and Policy Management

-- ====================
-- POLICY MANAGEMENT TABLES
-- ====================

-- Table for storing SLA and margin policy configurations
CREATE TABLE IF NOT EXISTS sla_margin_policies (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) UNIQUE NOT NULL, -- 'policy-001', 'policy-002'
    name VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL, -- 'v2.1.0'
    
    -- Policy state and lifecycle
    state VARCHAR(20) DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'scheduled', 'archived')),
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_date TIMESTAMP WITH TIME ZONE,
    
    -- SLA Targets (stored as JSONB for flexibility)
    sla_targets JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {
    --   "classification": {"timeToClassify": 4},
    --   "pickups": {"urbanWGMaxHours": 12, "interCityWGMaxHours": 24, "windowConstraints": "business"},
    --   "hubProcessing": {"tier2MaxHours": 24, "tier3MaxHours": 48, "tier3QABuffer": 4},
    --   "delivery": {"wgFinalDeliveryMaxHours": 12, "dhlStandardDays": 3, "dhlExpressDays": 1},
    --   "laneSpecifics": {"euToEuMultiplier": 1.0, "ukToEuMultiplier": 1.2, "remoteAreaMultiplier": 1.5, "weekendRule": "business"},
    --   "riskManagement": {"riskBufferHours": 6, "breachEscalationMinutes": 60}
    -- }
    
    -- Margin Thresholds (stored as JSONB for flexibility)
    margin_thresholds JSONB NOT NULL DEFAULT '{}',
    -- Example structure:
    -- {
    --   "global": {"minimumMargin": 15, "targetMargin": 25},
    --   "components": {"wgComponent": 8, "dhlComponent": 5, "hubFeeComponent": 20, "insuranceMarkup": 10, "surchargesPolicy": 15},
    --   "variance": {"tolerancePercent": 10},
    --   "currency": {"base": "EUR", "includeVAT": true}
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

-- Table for policy version history and audit trail
CREATE TABLE IF NOT EXISTS policy_version_history (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) REFERENCES sla_margin_policies(policy_id),
    version VARCHAR(20) NOT NULL,
    
    -- Change details
    change_type VARCHAR(30) NOT NULL, -- 'created', 'updated', 'published', 'scheduled', 'rolled_back', 'archived'
    change_reason TEXT NOT NULL,
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Field-level changes
    fields_changed JSONB DEFAULT '[]', -- ["slaTargets.pickups.urbanWGMaxHours", "marginThresholds.global.minimumMargin"]
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    
    -- Full policy snapshot at time of change
    policy_snapshot JSONB NOT NULL,
    
    -- Impact analysis
    affected_quotes INTEGER DEFAULT 0,
    affected_shipments INTEGER DEFAULT 0,
    
    -- Approval details (if applicable)
    approval_request_id VARCHAR(100),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Table for tracking policy approval requests
CREATE TABLE IF NOT EXISTS policy_approval_requests (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(100) UNIQUE NOT NULL,
    policy_id VARCHAR(50) REFERENCES sla_margin_policies(policy_id),
    
    -- Request details
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    
    -- Approvers (stored as JSONB array)
    required_approvers JSONB NOT NULL DEFAULT '[]',
    -- Example: [{"role": "ops_admin", "email": "ops.admin@aucta.io"}, {"role": "finance_approver", "email": "finance.approver@aucta.io"}]
    
    approvals_received JSONB DEFAULT '[]',
    -- Example: [{"role": "ops_admin", "email": "ops.admin@aucta.io", "approved_at": "2024-01-15T10:30:00Z"}]
    
    -- Resolution
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Expiry
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

-- Table for policy event logging (for analytics and synchronization)
CREATE TABLE IF NOT EXISTS policy_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    -- 'settings.sla.updated', 'settings.margin.updated', 'settings.policy.published', 
    -- 'settings.policy.rolled_back', 'quote.recompute.requested'
    
    -- Context
    policy_id VARCHAR(50) REFERENCES sla_margin_policies(policy_id),
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

-- Table for policy simulation results and impact analysis
CREATE TABLE IF NOT EXISTS policy_simulations (
    id SERIAL PRIMARY KEY,
    simulation_id VARCHAR(100) UNIQUE NOT NULL,
    policy_id VARCHAR(50) REFERENCES sla_margin_policies(policy_id),
    
    -- Simulation context
    simulated_by VARCHAR(255) NOT NULL,
    simulated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    simulation_type VARCHAR(30) DEFAULT 'policy_change', -- 'policy_change', 'rollback', 'scheduled_activation'
    
    -- Input parameters
    target_sla_targets JSONB NOT NULL,
    target_margin_thresholds JSONB NOT NULL,
    sample_shipments JSONB DEFAULT '[]', -- Shipment IDs or criteria used for simulation
    
    -- Results summary
    total_shipments_tested INTEGER NOT NULL,
    shipments_at_risk INTEGER DEFAULT 0,
    routes_blocked INTEGER DEFAULT 0,
    average_score_change DECIMAL(5,2) DEFAULT 0,
    
    -- Detailed results
    simulation_results JSONB NOT NULL DEFAULT '[]',
    -- Example: [{"shipmentId": "SH-2024-001", "currentScore": 85, "newScore": 78, "scoreDelta": -7, "guardrailHits": ["Margin below target"], "slaAtRisk": false}]
    
    -- Performance metrics
    simulation_duration_ms INTEGER NOT NULL,
    routes_calculated INTEGER DEFAULT 0,
    
    -- Impact assessment
    business_impact JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    
    -- Export/sharing
    exported_at TIMESTAMP WITH TIME ZONE,
    export_format VARCHAR(20), -- 'csv', 'pdf', 'json'
    shared_with JSONB DEFAULT '[]'
);

-- Table for active policy settings cache (for high-performance queries)
CREATE TABLE IF NOT EXISTS active_policy_cache (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Current active policy
    current_version VARCHAR(20) NOT NULL,
    effective_since TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Flattened SLA targets for fast queries
    sla_classification_hours DECIMAL(5,2) NOT NULL,
    sla_urban_pickup_hours DECIMAL(5,2) NOT NULL,
    sla_intercity_pickup_hours DECIMAL(5,2) NOT NULL,
    sla_tier2_max_hours DECIMAL(5,2) NOT NULL,
    sla_tier3_max_hours DECIMAL(5,2) NOT NULL,
    sla_tier3_qa_buffer_hours DECIMAL(5,2) NOT NULL,
    sla_wg_delivery_hours DECIMAL(5,2) NOT NULL,
    sla_dhl_standard_days INTEGER NOT NULL,
    sla_dhl_express_days INTEGER NOT NULL,
    sla_risk_buffer_hours DECIMAL(5,2) NOT NULL,
    sla_breach_escalation_minutes INTEGER NOT NULL,
    
    -- Flattened margin thresholds for fast queries
    margin_global_minimum DECIMAL(5,2) NOT NULL,
    margin_global_target DECIMAL(5,2) NOT NULL,
    margin_wg_component DECIMAL(5,2) NOT NULL,
    margin_dhl_component DECIMAL(5,2) NOT NULL,
    margin_hub_fee DECIMAL(5,2) NOT NULL,
    margin_insurance_markup DECIMAL(5,2) NOT NULL,
    margin_surcharges DECIMAL(5,2) NOT NULL,
    margin_variance_tolerance DECIMAL(5,2) NOT NULL,
    margin_currency_base VARCHAR(3) NOT NULL,
    margin_include_vat BOOLEAN NOT NULL,
    
    -- Multipliers and modifiers
    eu_to_eu_multiplier DECIMAL(4,3) NOT NULL,
    uk_to_eu_multiplier DECIMAL(4,3) NOT NULL,
    remote_area_multiplier DECIMAL(4,3) NOT NULL,
    weekend_rule VARCHAR(20) NOT NULL,
    pickup_window_constraints VARCHAR(20) NOT NULL,
    
    -- Cache management
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cache_version INTEGER DEFAULT 1
);

-- ====================
-- INDEXES FOR PERFORMANCE
-- ====================

-- Primary policy indexes
CREATE INDEX IF NOT EXISTS idx_policies_policy_id ON sla_margin_policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_policies_state ON sla_margin_policies(state);
CREATE INDEX IF NOT EXISTS idx_policies_effective_date ON sla_margin_policies(effective_date);
CREATE INDEX IF NOT EXISTS idx_policies_version ON sla_margin_policies(policy_id, version);

-- Version history indexes
CREATE INDEX IF NOT EXISTS idx_version_history_policy ON policy_version_history(policy_id);
CREATE INDEX IF NOT EXISTS idx_version_history_changed_at ON policy_version_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_version_history_change_type ON policy_version_history(change_type);

-- Approval request indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_policy ON policy_approval_requests(policy_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON policy_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_expires ON policy_approval_requests(expires_at);

-- Event indexes
CREATE INDEX IF NOT EXISTS idx_policy_events_type ON policy_events(event_type);
CREATE INDEX IF NOT EXISTS idx_policy_events_policy ON policy_events(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_events_effective_at ON policy_events(effective_at);
CREATE INDEX IF NOT EXISTS idx_policy_events_processed ON policy_events(processed);

-- Simulation indexes
CREATE INDEX IF NOT EXISTS idx_simulations_policy ON policy_simulations(policy_id);
CREATE INDEX IF NOT EXISTS idx_simulations_simulated_at ON policy_simulations(simulated_at);
CREATE INDEX IF NOT EXISTS idx_simulations_simulated_by ON policy_simulations(simulated_by);

-- Cache indexes
CREATE INDEX IF NOT EXISTS idx_active_cache_policy ON active_policy_cache(policy_id);

-- ====================
-- TRIGGERS AND FUNCTIONS
-- ====================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_policy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamps
CREATE TRIGGER update_policies_updated_at 
    BEFORE UPDATE ON sla_margin_policies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_policy_updated_at();

-- Function to create version history entry on policy changes
CREATE OR REPLACE FUNCTION create_policy_version_history()
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
        
        -- Track field changes
        IF OLD.sla_targets != NEW.sla_targets THEN
            fields_changed_arr := fields_changed_arr || '["sla_targets"]'::jsonb;
            old_vals := old_vals || jsonb_build_object('sla_targets', OLD.sla_targets);
            new_vals := new_vals || jsonb_build_object('sla_targets', NEW.sla_targets);
        END IF;
        
        IF OLD.margin_thresholds != NEW.margin_thresholds THEN
            fields_changed_arr := fields_changed_arr || '["margin_thresholds"]'::jsonb;
            old_vals := old_vals || jsonb_build_object('margin_thresholds', OLD.margin_thresholds);
            new_vals := new_vals || jsonb_build_object('margin_thresholds', NEW.margin_thresholds);
        END IF;
    END IF;
    
    -- Insert version history record
    INSERT INTO policy_version_history (
        policy_id, version, change_type, change_reason, changed_by, changed_at,
        fields_changed, old_values, new_values, policy_snapshot,
        approval_request_id, approved_by, approved_at
    ) VALUES (
        NEW.policy_id, NEW.version, change_type_val, NEW.change_reason, NEW.last_edited_by, NEW.last_edited_at,
        fields_changed_arr, old_vals, new_vals,
        jsonb_build_object(
            'sla_targets', NEW.sla_targets,
            'margin_thresholds', NEW.margin_thresholds,
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
CREATE TRIGGER create_version_history 
    AFTER INSERT OR UPDATE ON sla_margin_policies 
    FOR EACH ROW 
    EXECUTE FUNCTION create_policy_version_history();

-- Function to refresh active policy cache
CREATE OR REPLACE FUNCTION refresh_active_policy_cache(target_policy_id VARCHAR(50))
RETURNS VOID AS $$
DECLARE
    policy_record RECORD;
    sla_data JSONB;
    margin_data JSONB;
BEGIN
    -- Get the current active policy
    SELECT * INTO policy_record
    FROM sla_margin_policies 
    WHERE policy_id = target_policy_id 
    AND state IN ('published', 'scheduled')
    AND effective_date <= CURRENT_TIMESTAMP
    ORDER BY effective_date DESC
    LIMIT 1;
    
    IF policy_record.id IS NOT NULL THEN
        sla_data := policy_record.sla_targets;
        margin_data := policy_record.margin_thresholds;
        
        -- Insert or update cache
        INSERT INTO active_policy_cache (
            policy_id, current_version, effective_since,
            sla_classification_hours, sla_urban_pickup_hours, sla_intercity_pickup_hours,
            sla_tier2_max_hours, sla_tier3_max_hours, sla_tier3_qa_buffer_hours,
            sla_wg_delivery_hours, sla_dhl_standard_days, sla_dhl_express_days,
            sla_risk_buffer_hours, sla_breach_escalation_minutes,
            margin_global_minimum, margin_global_target,
            margin_wg_component, margin_dhl_component, margin_hub_fee,
            margin_insurance_markup, margin_surcharges, margin_variance_tolerance,
            margin_currency_base, margin_include_vat,
            eu_to_eu_multiplier, uk_to_eu_multiplier, remote_area_multiplier,
            weekend_rule, pickup_window_constraints,
            cache_version
        ) VALUES (
            policy_record.policy_id, policy_record.version, policy_record.effective_date,
            (sla_data->'classification'->>'timeToClassify')::decimal,
            (sla_data->'pickups'->>'urbanWGMaxHours')::decimal,
            (sla_data->'pickups'->>'interCityWGMaxHours')::decimal,
            (sla_data->'hubProcessing'->>'tier2MaxHours')::decimal,
            (sla_data->'hubProcessing'->>'tier3MaxHours')::decimal,
            (sla_data->'hubProcessing'->>'tier3QABuffer')::decimal,
            (sla_data->'delivery'->>'wgFinalDeliveryMaxHours')::decimal,
            (sla_data->'delivery'->>'dhlStandardDays')::integer,
            (sla_data->'delivery'->>'dhlExpressDays')::integer,
            (sla_data->'riskManagement'->>'riskBufferHours')::decimal,
            (sla_data->'riskManagement'->>'breachEscalationMinutes')::integer,
            (margin_data->'global'->>'minimumMargin')::decimal,
            (margin_data->'global'->>'targetMargin')::decimal,
            (margin_data->'components'->>'wgComponent')::decimal,
            (margin_data->'components'->>'dhlComponent')::decimal,
            (margin_data->'components'->>'hubFeeComponent')::decimal,
            (margin_data->'components'->>'insuranceMarkup')::decimal,
            (margin_data->'components'->>'surchargesPolicy')::decimal,
            (margin_data->'variance'->>'tolerancePercent')::decimal,
            margin_data->'currency'->>'base',
            (margin_data->'currency'->>'includeVAT')::boolean,
            (sla_data->'laneSpecifics'->>'euToEuMultiplier')::decimal,
            (sla_data->'laneSpecifics'->>'ukToEuMultiplier')::decimal,
            (sla_data->'laneSpecifics'->>'remoteAreaMultiplier')::decimal,
            sla_data->'laneSpecifics'->>'weekendRule',
            sla_data->'pickups'->>'windowConstraints',
            1
        ) 
        ON CONFLICT (policy_id) DO UPDATE SET
            current_version = EXCLUDED.current_version,
            effective_since = EXCLUDED.effective_since,
            sla_classification_hours = EXCLUDED.sla_classification_hours,
            sla_urban_pickup_hours = EXCLUDED.sla_urban_pickup_hours,
            sla_intercity_pickup_hours = EXCLUDED.sla_intercity_pickup_hours,
            sla_tier2_max_hours = EXCLUDED.sla_tier2_max_hours,
            sla_tier3_max_hours = EXCLUDED.sla_tier3_max_hours,
            sla_tier3_qa_buffer_hours = EXCLUDED.sla_tier3_qa_buffer_hours,
            sla_wg_delivery_hours = EXCLUDED.sla_wg_delivery_hours,
            sla_dhl_standard_days = EXCLUDED.sla_dhl_standard_days,
            sla_dhl_express_days = EXCLUDED.sla_dhl_express_days,
            sla_risk_buffer_hours = EXCLUDED.sla_risk_buffer_hours,
            sla_breach_escalation_minutes = EXCLUDED.sla_breach_escalation_minutes,
            margin_global_minimum = EXCLUDED.margin_global_minimum,
            margin_global_target = EXCLUDED.margin_global_target,
            margin_wg_component = EXCLUDED.margin_wg_component,
            margin_dhl_component = EXCLUDED.margin_dhl_component,
            margin_hub_fee = EXCLUDED.margin_hub_fee,
            margin_insurance_markup = EXCLUDED.margin_insurance_markup,
            margin_surcharges = EXCLUDED.margin_surcharges,
            margin_variance_tolerance = EXCLUDED.margin_variance_tolerance,
            margin_currency_base = EXCLUDED.margin_currency_base,
            margin_include_vat = EXCLUDED.margin_include_vat,
            eu_to_eu_multiplier = EXCLUDED.eu_to_eu_multiplier,
            uk_to_eu_multiplier = EXCLUDED.uk_to_eu_multiplier,
            remote_area_multiplier = EXCLUDED.remote_area_multiplier,
            weekend_rule = EXCLUDED.weekend_rule,
            pickup_window_constraints = EXCLUDED.pickup_window_constraints,
            last_updated = CURRENT_TIMESTAMP,
            cache_version = active_policy_cache.cache_version + 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- SAMPLE DATA
-- ====================

-- Insert default policy
INSERT INTO sla_margin_policies (
    policy_id, name, version, state, effective_date,
    sla_targets, margin_thresholds, change_reason, created_by, last_edited_by
) VALUES (
    'policy-001', 
    'Standard Operations Policy', 
    'v2.1.0', 
    'published', 
    '2024-01-15 09:00:00+01:00',
    '{
        "classification": {"timeToClassify": 4},
        "pickups": {
            "urbanWGMaxHours": 12,
            "interCityWGMaxHours": 24,
            "windowConstraints": "business"
        },
        "hubProcessing": {
            "tier2MaxHours": 24,
            "tier3MaxHours": 48,
            "tier3QABuffer": 4
        },
        "delivery": {
            "wgFinalDeliveryMaxHours": 12,
            "dhlStandardDays": 3,
            "dhlExpressDays": 1
        },
        "laneSpecifics": {
            "euToEuMultiplier": 1.0,
            "ukToEuMultiplier": 1.2,
            "remoteAreaMultiplier": 1.5,
            "weekendRule": "business"
        },
        "riskManagement": {
            "riskBufferHours": 6,
            "breachEscalationMinutes": 60
        }
    }',
    '{
        "global": {
            "minimumMargin": 15,
            "targetMargin": 25
        },
        "components": {
            "wgComponent": 8,
            "dhlComponent": 5,
            "hubFeeComponent": 20,
            "insuranceMarkup": 10,
            "surchargesPolicy": 15
        },
        "variance": {
            "tolerancePercent": 10
        },
        "currency": {
            "base": "EUR",
            "includeVAT": true
        }
    }',
    'Initial policy setup for Q1 2024',
    'system',
    'sarah.ops@aucta.io'
) ON CONFLICT (policy_id) DO NOTHING;

-- Refresh the cache for the default policy
SELECT refresh_active_policy_cache('policy-001');

-- ====================
-- TABLE COMMENTS
-- ====================

COMMENT ON TABLE sla_margin_policies IS 'Main table for SLA targets and margin threshold policies';
COMMENT ON TABLE policy_version_history IS 'Complete audit trail of policy changes with field-level tracking';
COMMENT ON TABLE policy_approval_requests IS 'Two-person approval workflow for protection-lowering changes';
COMMENT ON TABLE policy_events IS 'Event log for policy changes, used for system synchronization and analytics';
COMMENT ON TABLE policy_simulations IS 'Storage for policy simulation results and impact analysis';
COMMENT ON TABLE active_policy_cache IS 'High-performance cache of current active policy settings for fast queries';

COMMENT ON COLUMN sla_margin_policies.sla_targets IS 'JSONB structure containing all SLA time targets and constraints';
COMMENT ON COLUMN sla_margin_policies.margin_thresholds IS 'JSONB structure containing all margin thresholds and currency settings';
COMMENT ON COLUMN active_policy_cache.cache_version IS 'Incremented on each cache update to detect stale data';
