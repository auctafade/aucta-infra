-- WG (White-Glove) Complete System Database Schema
-- Sprint 8: Comprehensive logistics and assignment system

-- ====================
-- CORE WG ENTITIES
-- ====================

-- WG Operators - People who handle high-value shipments
CREATE TABLE IF NOT EXISTS wg_operators (
    id SERIAL PRIMARY KEY,
    operator_code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'WG001'
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    
    -- Capabilities and Clearances
    max_value_clearance BIGINT NOT NULL DEFAULT 0, -- Maximum shipment value they can handle
    languages TEXT[] NOT NULL DEFAULT '{}', -- ['English', 'Spanish', 'French']
    area_coverage TEXT[] NOT NULL DEFAULT '{}', -- ['Manhattan', 'Brooklyn', 'Newark']
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'car', -- 'car', 'van', 'motorcycle'
    
    -- Performance and Status
    rating DECIMAL(3,2) DEFAULT 5.00, -- 0.00 to 5.00
    total_jobs INTEGER DEFAULT 0,
    successful_jobs INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'on_leave'
    
    -- Insurance and Compliance
    insurance_policy_number VARCHAR(100),
    insurance_expiry DATE,
    background_check_date DATE,
    
    -- Special Skills
    special_skills TEXT[] DEFAULT '{}', -- ['High-value handling', 'Delicate textiles', 'Art transport']
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WG Shipments - High-value items requiring white-glove service
CREATE TABLE IF NOT EXISTS wg_shipments (
    id SERIAL PRIMARY KEY,
    shipment_code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'SH001'
    
    -- Product Information
    product_name VARCHAR(255) NOT NULL,
    product_category VARCHAR(100), -- 'jewelry', 'art', 'watches', 'handbags'
    declared_value BIGINT NOT NULL, -- In cents to avoid decimal issues
    tier_level INTEGER NOT NULL CHECK (tier_level IN (1, 2, 3)),
    
    -- Locations and Contacts
    sender_name VARCHAR(255) NOT NULL,
    sender_address TEXT NOT NULL,
    sender_phone VARCHAR(50),
    sender_time_window VARCHAR(100), -- '10:00-14:00'
    sender_timezone VARCHAR(50) DEFAULT 'America/New_York',
    
    buyer_name VARCHAR(255) NOT NULL,
    buyer_address TEXT NOT NULL,
    buyer_phone VARCHAR(50),
    buyer_time_window VARCHAR(100), -- '16:00-20:00'
    buyer_timezone VARCHAR(50) DEFAULT 'America/New_York',
    
    -- Hub Information
    hub_location VARCHAR(255) NOT NULL DEFAULT 'AUCTA Hub - Newark',
    hub_timezone VARCHAR(50) DEFAULT 'America/New_York',
    
    -- SLA and Priority
    sla_deadline TIMESTAMP NOT NULL,
    priority VARCHAR(20) DEFAULT 'standard', -- 'standard', 'urgent', 'critical'
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending_assignment', 
    -- 'pending_assignment', 'assigned', 'pickup_scheduled', 'in_transit', 
    -- 'at_hub', 'delivered', 'cancelled'
    
    -- Route Planning
    estimated_distance_km INTEGER,
    estimated_duration_minutes INTEGER,
    route_legs JSONB, -- Detailed route information
    
    -- Special Requirements
    special_instructions TEXT,
    requires_insurance_verification BOOLEAN DEFAULT FALSE,
    requires_liveness_check BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WG Assignments - Assignment of operators to shipments
CREATE TABLE IF NOT EXISTS wg_assignments (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES wg_shipments(id) ON DELETE CASCADE,
    operator_id INTEGER REFERENCES wg_operators(id) ON DELETE SET NULL,
    
    -- Assignment Details
    assigned_by VARCHAR(255) NOT NULL, -- User ID who made the assignment
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assignment_type VARCHAR(20) DEFAULT 'direct', -- 'direct', 'sourced', 'escalated'
    
    -- Schedule
    pickup_scheduled_at TIMESTAMP,
    hub_arrival_scheduled_at TIMESTAMP,
    hub_departure_scheduled_at TIMESTAMP,
    delivery_scheduled_at TIMESTAMP,
    
    -- OTP Codes for verification
    pickup_otp VARCHAR(10),
    hub_intake_otp VARCHAR(10),
    delivery_otp VARCHAR(10),
    seal_id VARCHAR(20), -- For Tier 2/3 shipments
    
    -- Status and Progress
    status VARCHAR(50) DEFAULT 'assigned',
    -- 'assigned', 'pickup_completed', 'at_hub', 'departed_hub', 'delivered', 'cancelled'
    
    -- Performance Tracking
    actual_pickup_at TIMESTAMP,
    actual_hub_arrival_at TIMESTAMP,
    actual_hub_departure_at TIMESTAMP,
    actual_delivery_at TIMESTAMP,
    
    -- Compliance and Verification
    liveness_check_pickup BOOLEAN DEFAULT FALSE,
    liveness_check_hub BOOLEAN DEFAULT FALSE,
    liveness_check_delivery BOOLEAN DEFAULT FALSE,
    
    -- Notes and Issues
    operator_notes TEXT,
    issues_encountered TEXT,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- HUB CAPACITY MANAGEMENT
-- ====================

-- Hub Capacity Slots - Available processing windows
CREATE TABLE IF NOT EXISTS hub_capacity_slots (
    id SERIAL PRIMARY KEY,
    hub_location VARCHAR(255) NOT NULL,
    
    -- Capacity Type
    capacity_type VARCHAR(20) NOT NULL, -- 'authenticator', 'sewing', 'general'
    tier_level INTEGER NOT NULL CHECK (tier_level IN (1, 2, 3)),
    
    -- Time Slot
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    
    -- Capacity Management
    max_capacity INTEGER DEFAULT 1,
    current_bookings INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    
    -- Hold Management
    held_until TIMESTAMP, -- When the hold expires
    held_for_shipment_id INTEGER REFERENCES wg_shipments(id),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- SOURCING PIPELINE
-- ====================

-- WG Sourcing Requests - When internal operators can't handle
CREATE TABLE IF NOT EXISTS wg_sourcing_requests (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES wg_shipments(id) ON DELETE CASCADE,
    
    -- Request Details
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sla_target_at TIMESTAMP NOT NULL,
    
    -- Sourcing Criteria
    required_cities TEXT[] NOT NULL,
    min_value_clearance BIGINT NOT NULL,
    max_distance_km INTEGER DEFAULT 50,
    urgency_level VARCHAR(20) DEFAULT 'standard', -- 'standard', 'premium'
    
    -- Status Tracking
    status VARCHAR(30) DEFAULT 'unassigned',
    -- 'unassigned', 'broadcast_sent', 'candidates_replying', 
    -- 'validating', 'assigned', 'escalated', 'cancelled'
    
    -- Results
    assigned_operator_id INTEGER REFERENCES wg_operators(id),
    time_to_assign_ms BIGINT, -- Milliseconds from request to assignment
    
    -- Escalation
    escalated_at TIMESTAMP,
    escalation_reason TEXT,
    escalation_channel VARCHAR(50), -- 'partner_vendors', 'premium_rate', 'geographic_expansion'
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- External Sourcing Candidates - Operators from partner networks
CREATE TABLE IF NOT EXISTS wg_sourcing_candidates (
    id SERIAL PRIMARY KEY,
    sourcing_request_id INTEGER REFERENCES wg_sourcing_requests(id) ON DELETE CASCADE,
    
    -- Candidate Information
    external_operator_id VARCHAR(100) NOT NULL, -- ID from partner system
    name VARCHAR(255) NOT NULL,
    contact_info JSONB, -- Phone, email, etc.
    
    -- Capabilities
    max_value_clearance BIGINT NOT NULL,
    coverage_areas TEXT[] NOT NULL,
    rating DECIMAL(3,2),
    
    -- Validation Status
    insurance_verified BOOLEAN DEFAULT FALSE,
    background_check_verified BOOLEAN DEFAULT FALSE,
    documents_verified BOOLEAN DEFAULT FALSE,
    validation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    
    -- Response
    responded_at TIMESTAMP,
    availability_window JSONB, -- Available time slots
    quoted_rate DECIMAL(10,2),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- TELEMETRY AND ANALYTICS
-- ====================

-- WG Telemetry Events - Detailed analytics tracking
CREATE TABLE IF NOT EXISTS wg_telemetry_events (
    id SERIAL PRIMARY KEY,
    
    -- Event Classification
    event_type VARCHAR(50) NOT NULL,
    -- 'wg.view.open', 'wg.operator.suggested', 'wg.slot.conflict', 
    -- 'wg.confirm.time_ms', 'wg.time_to_assign_ms'
    
    -- Context
    shipment_id INTEGER REFERENCES wg_shipments(id),
    operator_id INTEGER REFERENCES wg_operators(id),
    user_id VARCHAR(255), -- Actor who triggered the event
    session_id VARCHAR(255),
    
    -- Event Data
    event_data JSONB NOT NULL, -- Flexible data storage
    
    -- Performance Metrics
    duration_ms BIGINT, -- For timing events
    score_value DECIMAL(5,2), -- For scoring events
    
    -- Technical Context
    user_agent TEXT,
    ip_address INET,
    referrer TEXT,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Metrics Summary - Aggregated analytics
CREATE TABLE IF NOT EXISTS wg_performance_metrics (
    id SERIAL PRIMARY KEY,
    
    -- Time Period
    metric_date DATE NOT NULL,
    metric_hour INTEGER CHECK (metric_hour >= 0 AND metric_hour <= 23),
    
    -- Assignment Performance
    total_assignments INTEGER DEFAULT 0,
    avg_assignment_time_ms BIGINT DEFAULT 0,
    assignments_under_2min INTEGER DEFAULT 0,
    assignments_over_5min INTEGER DEFAULT 0,
    
    -- Conflict Analysis
    total_conflicts INTEGER DEFAULT 0,
    window_conflicts INTEGER DEFAULT 0,
    travel_conflicts INTEGER DEFAULT 0,
    hub_conflicts INTEGER DEFAULT 0,
    calendar_conflicts INTEGER DEFAULT 0,
    
    -- Operator Performance
    avg_operator_score DECIMAL(5,2) DEFAULT 0,
    top_operator_id INTEGER REFERENCES wg_operators(id),
    operator_utilization_rate DECIMAL(5,2) DEFAULT 0,
    
    -- SLA Compliance
    sla_met_count INTEGER DEFAULT 0,
    sla_missed_count INTEGER DEFAULT 0,
    avg_sla_margin_minutes INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(metric_date, metric_hour)
);

-- ====================
-- CONSTRAINT VALIDATION
-- ====================

-- WG Constraints Log - Track constraint violations and resolutions
CREATE TABLE IF NOT EXISTS wg_constraint_logs (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES wg_shipments(id),
    assignment_id INTEGER REFERENCES wg_assignments(id),
    
    -- Constraint Details
    constraint_type VARCHAR(50) NOT NULL,
    -- 'operator_consistency', 'hub_hold_expiry', 'sla_deadline', 
    -- 'time_window', 'travel_buffer', 'operator_conflict'
    
    constraint_description TEXT NOT NULL,
    violation_severity VARCHAR(20) DEFAULT 'error', -- 'warning', 'error', 'critical'
    
    -- Resolution
    resolution_action VARCHAR(100), -- What was done to resolve
    resolved_by VARCHAR(255), -- User who resolved
    resolved_at TIMESTAMP,
    
    -- Override Information
    is_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    override_authorized_by VARCHAR(255),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- RBAC AND AUDIT
-- ====================

-- WG User Sessions - Track user activity for RBAC
CREATE TABLE IF NOT EXISTS wg_user_sessions (
    id SERIAL PRIMARY KEY,
    
    -- User Information
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_role VARCHAR(50) NOT NULL, -- 'ops_admin', 'hub_tech', 'wg_operator', 'exec'
    
    -- Session Details
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    -- Activity Summary
    actions_performed INTEGER DEFAULT 0,
    assignments_created INTEGER DEFAULT 0,
    overrides_used INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WG Audit Trail - Complete action logging for compliance
CREATE TABLE IF NOT EXISTS wg_audit_trail (
    id SERIAL PRIMARY KEY,
    
    -- Action Classification
    action_type VARCHAR(100) NOT NULL,
    -- 'wg.assignment.create', 'wg.assignment.modify', 'wg.sla.override', 
    -- 'wg.sourcing.start', 'wg.otp.view', etc.
    
    -- Context
    user_id VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    session_id VARCHAR(255),
    shipment_id INTEGER REFERENCES wg_shipments(id),
    operator_id INTEGER REFERENCES wg_operators(id),
    
    -- Action Details
    action_details JSONB NOT NULL,
    target_resource VARCHAR(255), -- What was acted upon
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason TEXT,
    
    -- Technical Context
    ip_address INET,
    user_agent TEXT,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- INDEXES FOR PERFORMANCE
-- ====================

-- Operators
CREATE INDEX IF NOT EXISTS idx_wg_operators_status ON wg_operators(status);
CREATE INDEX IF NOT EXISTS idx_wg_operators_area_coverage ON wg_operators USING GIN(area_coverage);
CREATE INDEX IF NOT EXISTS idx_wg_operators_max_value ON wg_operators(max_value_clearance);

-- Shipments
CREATE INDEX IF NOT EXISTS idx_wg_shipments_status ON wg_shipments(status);
CREATE INDEX IF NOT EXISTS idx_wg_shipments_sla_deadline ON wg_shipments(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_wg_shipments_tier_level ON wg_shipments(tier_level);
CREATE INDEX IF NOT EXISTS idx_wg_shipments_declared_value ON wg_shipments(declared_value);

-- Assignments
CREATE INDEX IF NOT EXISTS idx_wg_assignments_status ON wg_assignments(status);
CREATE INDEX IF NOT EXISTS idx_wg_assignments_pickup_scheduled ON wg_assignments(pickup_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_wg_assignments_shipment ON wg_assignments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_wg_assignments_operator ON wg_assignments(operator_id);

-- Hub Capacity
CREATE INDEX IF NOT EXISTS idx_hub_capacity_date_type ON hub_capacity_slots(slot_date, capacity_type);
CREATE INDEX IF NOT EXISTS idx_hub_capacity_available ON hub_capacity_slots(is_available);
CREATE INDEX IF NOT EXISTS idx_hub_capacity_held_until ON hub_capacity_slots(held_until);

-- Sourcing
CREATE INDEX IF NOT EXISTS idx_wg_sourcing_status ON wg_sourcing_requests(status);
CREATE INDEX IF NOT EXISTS idx_wg_sourcing_sla_target ON wg_sourcing_requests(sla_target_at);

-- Telemetry
CREATE INDEX IF NOT EXISTS idx_wg_telemetry_event_type ON wg_telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_wg_telemetry_created_at ON wg_telemetry_events(created_at);
CREATE INDEX IF NOT EXISTS idx_wg_telemetry_shipment ON wg_telemetry_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_wg_telemetry_user ON wg_telemetry_events(user_id);

-- Performance Metrics
CREATE INDEX IF NOT EXISTS idx_wg_performance_date ON wg_performance_metrics(metric_date);

-- Audit
CREATE INDEX IF NOT EXISTS idx_wg_audit_action_type ON wg_audit_trail(action_type);
CREATE INDEX IF NOT EXISTS idx_wg_audit_user ON wg_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_wg_audit_created_at ON wg_audit_trail(created_at);

-- ====================
-- TRIGGERS FOR AUTO-UPDATES
-- ====================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_wg_operators_updated_at BEFORE UPDATE ON wg_operators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wg_shipments_updated_at BEFORE UPDATE ON wg_shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wg_assignments_updated_at BEFORE UPDATE ON wg_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hub_capacity_slots_updated_at BEFORE UPDATE ON hub_capacity_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wg_sourcing_requests_updated_at BEFORE UPDATE ON wg_sourcing_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wg_performance_metrics_updated_at BEFORE UPDATE ON wg_performance_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
