-- Migration 012: DHL Label Management System
-- This migration adds comprehensive DHL label management and telemetry tracking

-- ========================================================================================
-- DHL LABEL MANAGEMENT TABLES
-- ========================================================================================

-- Table for DHL label management data
CREATE TABLE IF NOT EXISTS dhl_label_management (
    id SERIAL PRIMARY KEY,
    route_leg_id INTEGER REFERENCES shipment_route_legs(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL,
    leg_order INTEGER NOT NULL,
    
    -- DHL Label Details
    tracking_number VARCHAR(50) UNIQUE,
    dhl_reference VARCHAR(50) UNIQUE,
    label_url TEXT,
    service_type VARCHAR(20) DEFAULT 'standard', -- 'standard', 'express'
    estimated_transit_days INTEGER DEFAULT 3,
    
    -- Label Status
    label_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'purchasing', 'generated', 'voided', 'failed'
    rate_ttl_status VARCHAR(10) DEFAULT 'fresh', -- 'fresh', 'amber', 'stale'
    validation_status VARCHAR(15) DEFAULT 'ready', -- 'ready', 'missing_data'
    
    -- Options Configuration
    service_level VARCHAR(20) DEFAULT 'standard',
    insured_value DECIMAL(12,2),
    signature_required BOOLEAN DEFAULT FALSE,
    packages JSONB DEFAULT '[]',
    addresses JSONB DEFAULT '{}',
    customs_data JSONB DEFAULT '{}',
    pickup_method VARCHAR(20) DEFAULT 'drop-off', -- 'pickup', 'drop-off'
    pickup_window JSONB DEFAULT '{}',
    label_format VARCHAR(10) DEFAULT 'PDF',
    
    -- Cost Breakdown
    cost_breakdown JSONB DEFAULT '{}',
    
    -- Timestamps
    purchased_at TIMESTAMP,
    purchased_by VARCHAR(100),
    voided_at TIMESTAMP,
    void_reason TEXT,
    rate_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint on route leg
    CONSTRAINT unique_route_leg_label UNIQUE (route_leg_id)
);

-- Table for DHL telemetry events
CREATE TABLE IF NOT EXISTS dhl_telemetry_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'dhl.rate.refresh', 'dhl.purchase.time_ms', 'dhl.guardrail.triggered', 'dhl.variance.vs_plan_pct'
    event_data JSONB NOT NULL,
    
    -- Context
    shipment_id VARCHAR(50),
    leg_id VARCHAR(20),
    session_id VARCHAR(100),
    
    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional metadata
    user_context JSONB DEFAULT '{}'
);

-- Table for DHL audit logs
CREATE TABLE IF NOT EXISTS dhl_audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL, -- 'LABEL_PURCHASED', 'LABEL_VOIDED', 'RATE_REFRESHED'
    
    -- Label details
    leg_id VARCHAR(20),
    tracking_number VARCHAR(50),
    dhl_reference VARCHAR(50),
    original_cost DECIMAL(12,2),
    
    -- Audit details
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by VARCHAR(100) DEFAULT 'system',
    reason TEXT,
    
    -- Void-specific fields
    voided_at TIMESTAMP,
    voided_by VARCHAR(100),
    within_carrier_window BOOLEAN,
    hours_after_creation DECIMAL(6,2),
    
    -- Session tracking
    session_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for remote area surcharges
CREATE TABLE IF NOT EXISTS dhl_remote_area_surcharges (
    id SERIAL PRIMARY KEY,
    leg_id INTEGER REFERENCES shipment_route_legs(id) ON DELETE CASCADE,
    
    -- Location details
    from_location VARCHAR(255),
    to_location VARCHAR(255),
    detected_location VARCHAR(255),
    
    -- Surcharge details
    surcharge_amount DECIMAL(8,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    reason TEXT,
    
    -- Detection metadata
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detection_method VARCHAR(50) DEFAULT 'location_pattern', -- 'location_pattern', 'postal_code', 'manual'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for address validation and suggestions
CREATE TABLE IF NOT EXISTS dhl_address_suggestions (
    id SERIAL PRIMARY KEY,
    leg_id INTEGER REFERENCES shipment_route_legs(id) ON DELETE CASCADE,
    
    -- Address field details
    field_name VARCHAR(50) NOT NULL, -- 'postcode', 'country', 'city', 'address1'
    current_value TEXT,
    suggested_value TEXT,
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    reason TEXT,
    
    -- Validation context
    address_type VARCHAR(20), -- 'sender', 'buyer', 'hub'
    validation_rules_applied JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'ignored'
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for multi-parcel validation issues
CREATE TABLE IF NOT EXISTS dhl_validation_issues (
    id SERIAL PRIMARY KEY,
    leg_id INTEGER REFERENCES shipment_route_legs(id) ON DELETE CASCADE,
    
    -- Issue details
    issue_type VARCHAR(30) NOT NULL, -- 'multi_parcel', 'weight_limit', 'dimension_limit', 'customs_missing'
    severity VARCHAR(10) NOT NULL, -- 'error', 'warning', 'info'
    message TEXT NOT NULL,
    
    -- Issue data
    issue_data JSONB NOT NULL,
    suggested_resolution TEXT,
    can_continue BOOLEAN DEFAULT FALSE,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolution_method VARCHAR(50),
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- ========================================================================================

-- DHL label management indexes
CREATE INDEX IF NOT EXISTS idx_dhl_label_management_route_leg ON dhl_label_management(route_leg_id);
CREATE INDEX IF NOT EXISTS idx_dhl_label_management_shipment ON dhl_label_management(shipment_id);
CREATE INDEX IF NOT EXISTS idx_dhl_label_management_tracking ON dhl_label_management(tracking_number);
CREATE INDEX IF NOT EXISTS idx_dhl_label_management_status ON dhl_label_management(label_status);
CREATE INDEX IF NOT EXISTS idx_dhl_label_management_rate_ttl ON dhl_label_management(rate_ttl_status);

-- DHL telemetry indexes
CREATE INDEX IF NOT EXISTS idx_dhl_telemetry_event_type ON dhl_telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_dhl_telemetry_shipment_id ON dhl_telemetry_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_dhl_telemetry_session_id ON dhl_telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_dhl_telemetry_created_at ON dhl_telemetry_events(created_at);

-- DHL audit logs indexes
CREATE INDEX IF NOT EXISTS idx_dhl_audit_logs_action ON dhl_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_dhl_audit_logs_leg_id ON dhl_audit_logs(leg_id);
CREATE INDEX IF NOT EXISTS idx_dhl_audit_logs_tracking ON dhl_audit_logs(tracking_number);
CREATE INDEX IF NOT EXISTS idx_dhl_audit_logs_performed_at ON dhl_audit_logs(performed_at);

-- Remote area surcharges indexes
CREATE INDEX IF NOT EXISTS idx_dhl_remote_area_leg_id ON dhl_remote_area_surcharges(leg_id);
CREATE INDEX IF NOT EXISTS idx_dhl_remote_area_location ON dhl_remote_area_surcharges(detected_location);

-- Address suggestions indexes
CREATE INDEX IF NOT EXISTS idx_dhl_address_suggestions_leg_id ON dhl_address_suggestions(leg_id);
CREATE INDEX IF NOT EXISTS idx_dhl_address_suggestions_field ON dhl_address_suggestions(field_name);
CREATE INDEX IF NOT EXISTS idx_dhl_address_suggestions_status ON dhl_address_suggestions(status);

-- Validation issues indexes
CREATE INDEX IF NOT EXISTS idx_dhl_validation_issues_leg_id ON dhl_validation_issues(leg_id);
CREATE INDEX IF NOT EXISTS idx_dhl_validation_issues_type ON dhl_validation_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_dhl_validation_issues_severity ON dhl_validation_issues(severity);
CREATE INDEX IF NOT EXISTS idx_dhl_validation_issues_resolved ON dhl_validation_issues(resolved);

-- ========================================================================================
-- TRIGGERS AND FUNCTIONS
-- ========================================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dhl_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for DHL label management
CREATE TRIGGER update_dhl_label_management_updated_at 
    BEFORE UPDATE ON dhl_label_management 
    FOR EACH ROW 
    EXECUTE FUNCTION update_dhl_updated_at_column();

-- Function to automatically log DHL label status changes
CREATE OR REPLACE FUNCTION log_dhl_label_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF NEW.label_status IS DISTINCT FROM OLD.label_status THEN
        INSERT INTO dhl_audit_logs (
            action, leg_id, tracking_number, dhl_reference,
            original_cost, performed_by, reason
        ) VALUES (
            CASE 
                WHEN NEW.label_status = 'generated' THEN 'LABEL_PURCHASED'
                WHEN NEW.label_status = 'voided' THEN 'LABEL_VOIDED'
                ELSE 'LABEL_STATUS_CHANGED'
            END,
            NEW.leg_order::text,
            NEW.tracking_number,
            NEW.dhl_reference,
            (NEW.cost_breakdown->>'total')::decimal,
            NEW.purchased_by,
            CASE 
                WHEN NEW.label_status = 'voided' THEN NEW.void_reason
                ELSE 'Status changed from ' || COALESCE(OLD.label_status, 'null') || ' to ' || NEW.label_status
            END
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for DHL label status changes
CREATE TRIGGER log_dhl_label_status_updates 
    AFTER UPDATE ON dhl_label_management 
    FOR EACH ROW 
    EXECUTE FUNCTION log_dhl_label_status_change();

-- ========================================================================================
-- SAMPLE DATA FOR TESTING (Optional)
-- ========================================================================================

-- Table comments for documentation
COMMENT ON TABLE dhl_label_management IS 'Comprehensive DHL label management with options, status tracking, and cost breakdown';
COMMENT ON TABLE dhl_telemetry_events IS 'Telemetry events for DHL operations including performance and business metrics';
COMMENT ON TABLE dhl_audit_logs IS 'Audit trail for DHL label operations including purchases, voids, and rate refreshes';
COMMENT ON TABLE dhl_remote_area_surcharges IS 'Remote area surcharge detection and tracking';
COMMENT ON TABLE dhl_address_suggestions IS 'Address validation suggestions with confidence scoring';
COMMENT ON TABLE dhl_validation_issues IS 'Validation issues and guardrails for DHL operations';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dhl_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dhl_user;
