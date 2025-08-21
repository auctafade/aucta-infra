-- Migration 002: Advanced Route Planning & Telemetry System
-- This migration adds comprehensive route planning, cost calculation, and telemetry tracking

-- ========================================================================================
-- ROUTE PLANNING & COST MANAGEMENT TABLES
-- ========================================================================================

-- Table for storing planned shipment routes with detailed cost breakdown
CREATE TABLE IF NOT EXISTS shipment_route_plans (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    route_label VARCHAR(50) NOT NULL, -- 'standard', 'priority', 'white-glove'
    route_type VARCHAR(30) NOT NULL, -- 'standard', 'priority', 'white-glove'
    
    -- Score and evaluation
    score_letter VARCHAR(1) CHECK (score_letter IN ('A', 'B', 'C')) NOT NULL,
    score_numeric DECIMAL(5,2) NOT NULL, -- 0-100 numeric score
    time_score DECIMAL(5,2) NOT NULL, -- Individual component scores
    cost_score DECIMAL(5,2) NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    
    -- Delivery and timing
    estimated_days INTEGER NOT NULL,
    delivery_date DATE NOT NULL,
    hub_id INTEGER REFERENCES logistics_hubs(id),
    
    -- Cost breakdown
    total_cost DECIMAL(12,2) NOT NULL,
    wg_subtotal DECIMAL(12,2) DEFAULT 0,
    dhl_subtotal DECIMAL(12,2) DEFAULT 0,
    hub_fee DECIMAL(12,2) DEFAULT 0,
    insurance_cost DECIMAL(12,2) DEFAULT 0,
    
    -- Surcharges
    weekend_surcharge DECIMAL(8,2) DEFAULT 0,
    remote_area_surcharge DECIMAL(8,2) DEFAULT 0,
    fuel_surcharge DECIMAL(8,2) DEFAULT 0,
    fragile_surcharge DECIMAL(8,2) DEFAULT 0,
    
    -- Margin calculation
    client_price DECIMAL(12,2) NOT NULL,
    estimated_margin_amount DECIMAL(12,2) NOT NULL,
    estimated_margin_percentage DECIMAL(5,2) NOT NULL,
    
    -- Availability indicators
    dhl_rates_freshness VARCHAR(10) CHECK (dhl_rates_freshness IN ('fresh', 'amber', 'stale')) DEFAULT 'fresh',
    wg_capacity_status VARCHAR(10) CHECK (wg_capacity_status IN ('high', 'medium', 'low')) DEFAULT 'high',
    hub_processing_status VARCHAR(15) CHECK (hub_processing_status IN ('confirmed', 'likely', 'tight')) DEFAULT 'confirmed',
    
    -- Status and metadata
    is_selected BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_reasons JSONB DEFAULT '[]',
    route_metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    selected_at TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Table for individual route legs (segments of a route)
CREATE TABLE IF NOT EXISTS shipment_route_legs (
    id SERIAL PRIMARY KEY,
    route_plan_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    leg_order INTEGER NOT NULL, -- Order within the route (1, 2, 3...)
    
    -- Leg details
    leg_type VARCHAR(30) NOT NULL, -- 'white-glove', 'dhl-standard', 'dhl-express', 'hub-processing'
    from_location VARCHAR(255) NOT NULL,
    to_location VARCHAR(255) NOT NULL,
    
    -- Timing
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    dwell_time_hours INTEGER DEFAULT 0, -- Time spent at location
    
    -- Cost for this leg
    leg_cost DECIMAL(10,2) NOT NULL,
    carrier VARCHAR(100),
    service_type VARCHAR(50),
    
    -- Provisional tracking (no actual booking yet)
    provisional_eta TIMESTAMP,
    assumptions TEXT, -- e.g., "overnight at Hub", "express pickup"
    
    -- Metadata
    leg_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for route guardrails and validation results
CREATE TABLE IF NOT EXISTS route_guardrails (
    id SERIAL PRIMARY KEY,
    route_plan_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    
    -- Guardrail details
    guardrail_type VARCHAR(20) NOT NULL, -- 'error', 'warning', 'info'
    guardrail_category VARCHAR(30) NOT NULL, -- 'margin', 'capacity', 'sla', 'customs', 'tier', 'other'
    message TEXT NOT NULL,
    action_required TEXT,
    link_url VARCHAR(255),
    
    -- Impact
    is_blocking BOOLEAN DEFAULT FALSE,
    can_override BOOLEAN DEFAULT FALSE,
    override_level VARCHAR(20) DEFAULT 'admin', -- 'admin', 'manager', 'operator'
    
    -- Status
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    override_applied BOOLEAN DEFAULT FALSE,
    override_by VARCHAR(100),
    override_at TIMESTAMP,
    override_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing financial snapshots for audit
CREATE TABLE IF NOT EXISTS route_financial_snapshots (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    route_plan_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    
    -- Snapshot identifier
    snapshot_id VARCHAR(50) UNIQUE NOT NULL,
    snapshot_type VARCHAR(20) DEFAULT 'route_selection', -- 'route_selection', 'booking_confirmation'
    
    -- Complete cost breakdown at time of snapshot
    cost_breakdown JSONB NOT NULL, -- Full cost structure
    pricing_rules JSONB NOT NULL,  -- Pricing rules applied
    exchange_rates JSONB DEFAULT '{}', -- Currency conversion rates
    
    -- Margin analysis
    margin_analysis JSONB NOT NULL,
    profitability_flags JSONB DEFAULT '[]',
    
    -- Compliance and approval
    compliance_checks JSONB DEFAULT '{}',
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP
);

-- ========================================================================================
-- TELEMETRY & ANALYTICS TABLES
-- ========================================================================================

-- Table for session-level telemetry tracking
CREATE TABLE IF NOT EXISTS route_planning_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    
    -- Session timing
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP,
    session_duration_ms INTEGER,
    
    -- User behavior summary
    routes_calculated INTEGER DEFAULT 0,
    routes_compared INTEGER DEFAULT 0,
    score_hovers INTEGER DEFAULT 0,
    route_expansions INTEGER DEFAULT 0,
    guardrails_triggered INTEGER DEFAULT 0,
    
    -- Decision outcome
    decision_made BOOLEAN DEFAULT FALSE,
    selected_route_id INTEGER REFERENCES shipment_route_plans(id),
    admin_override_used BOOLEAN DEFAULT FALSE,
    
    -- Behavioral profile
    is_fast_decision BOOLEAN DEFAULT FALSE, -- < 1 minute
    is_thorough_evaluator BOOLEAN DEFAULT FALSE, -- 3+ hovers OR comparisons
    encountered_guardrails BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    time_to_first_interaction_ms INTEGER,
    calculation_time_ms INTEGER,
    decision_time_ms INTEGER,
    
    -- Client context
    user_agent TEXT,
    client_currency VARCHAR(3) DEFAULT 'EUR',
    client_timezone VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for detailed telemetry events
CREATE TABLE IF NOT EXISTS route_telemetry_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES route_planning_sessions(id) ON DELETE CASCADE,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL, -- 'score.weights', 'guardrail.triggered', 'compare.used', 'decision.time_ms', etc.
    event_category VARCHAR(20) NOT NULL, -- 'interaction', 'performance', 'business', 'system'
    
    -- Event payload
    event_data JSONB NOT NULL,
    route_id INTEGER REFERENCES shipment_route_plans(id), -- Optional route context
    
    -- Timing
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_since_session_start_ms INTEGER,
    
    -- Additional context
    user_context JSONB DEFAULT '{}'
);

-- Table for score computation tracking (detailed analytics)
CREATE TABLE IF NOT EXISTS score_computation_logs (
    id SERIAL PRIMARY KEY,
    route_plan_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES route_planning_sessions(id) ON DELETE CASCADE,
    
    -- Score weights used
    time_weight DECIMAL(4,3) NOT NULL, -- e.g., 0.400
    cost_weight DECIMAL(4,3) NOT NULL, -- e.g., 0.350
    risk_weight DECIMAL(4,3) NOT NULL, -- e.g., 0.250
    
    -- Raw component values
    time_raw_value DECIMAL(6,2) NOT NULL,
    cost_raw_value DECIMAL(6,2) NOT NULL,
    risk_raw_value DECIMAL(6,2) NOT NULL,
    
    -- Weighted contributions
    time_contribution DECIMAL(6,2) NOT NULL,
    cost_contribution DECIMAL(6,2) NOT NULL,
    risk_contribution DECIMAL(6,2) NOT NULL,
    
    -- Final calculation
    total_numeric_score DECIMAL(6,2) NOT NULL,
    letter_grade VARCHAR(1) NOT NULL,
    
    -- Algorithm version for A/B testing
    algorithm_version VARCHAR(10) DEFAULT 'v1.0',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for guardrail analytics
CREATE TABLE IF NOT EXISTS guardrail_analytics (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES route_planning_sessions(id) ON DELETE CASCADE,
    route_plan_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    guardrail_id INTEGER REFERENCES route_guardrails(id) ON DELETE CASCADE,
    
    -- Trigger context
    trigger_type VARCHAR(30) NOT NULL, -- 'margin', 'capacity', 'sla', 'customs'
    trigger_severity VARCHAR(10) NOT NULL, -- 'error', 'warning', 'info'
    is_blocking BOOLEAN NOT NULL,
    
    -- User response
    user_viewed BOOLEAN DEFAULT FALSE,
    user_acknowledged BOOLEAN DEFAULT FALSE,
    override_requested BOOLEAN DEFAULT FALSE,
    override_granted BOOLEAN DEFAULT FALSE,
    
    -- Business impact
    blocked_selection BOOLEAN DEFAULT FALSE,
    caused_route_change BOOLEAN DEFAULT FALSE,
    
    -- Resolution
    resolution_time_ms INTEGER,
    resolution_method VARCHAR(30), -- 'override', 'route_change', 'admin_intervention', 'abandoned'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for route comparison analytics
CREATE TABLE IF NOT EXISTS route_comparison_logs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES route_planning_sessions(id) ON DELETE CASCADE,
    
    -- Comparison details
    route_a_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    route_b_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    comparison_count INTEGER NOT NULL, -- 1st, 2nd, 3rd comparison in session
    
    -- Comparison outcome
    selected_route_id INTEGER REFERENCES shipment_route_plans(id), -- Which one was chosen (if any)
    comparison_duration_ms INTEGER,
    
    -- Analysis insight
    primary_differentiator VARCHAR(30), -- 'cost', 'time', 'risk', 'service_level'
    cost_difference DECIMAL(10,2),
    time_difference_days INTEGER,
    score_difference DECIMAL(4,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================================
-- RESOURCE MANAGEMENT TABLES
-- ========================================================================================

-- Table for tier-based resource reservations
CREATE TABLE IF NOT EXISTS tier_resource_reservations (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    
    -- Tier assignment
    assigned_tier VARCHAR(20) NOT NULL CHECK (assigned_tier IN ('standard', 'premium', 'platinum')),
    tier_assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tier_assigned_by VARCHAR(100) DEFAULT 'system',
    
    -- Hub reservation
    reserved_hub_id INTEGER REFERENCES logistics_hubs(id),
    hub_capacity_reserved INTEGER DEFAULT 1,
    hub_reservation_expires TIMESTAMP,
    
    -- Resource allocations (T2/T3 specific)
    tags_reserved INTEGER DEFAULT 0,
    nfc_chips_reserved INTEGER DEFAULT 0,
    sewing_slots_reserved INTEGER DEFAULT 0,
    
    -- Reservation metadata
    reservation_notes TEXT,
    reservation_metadata JSONB DEFAULT '{}',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'released', 'extended'
    released_at TIMESTAMP,
    released_by VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for inventory constraint validation
CREATE TABLE IF NOT EXISTS inventory_constraint_checks (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    route_plan_id INTEGER REFERENCES shipment_route_plans(id) ON DELETE CASCADE,
    
    -- Constraint validation
    check_type VARCHAR(30) NOT NULL, -- 'tags', 'nfc_chips', 'hub_capacity', 'sewing_availability'
    required_quantity INTEGER NOT NULL,
    available_quantity INTEGER NOT NULL,
    constraint_met BOOLEAN NOT NULL,
    
    -- Details
    constraint_details JSONB NOT NULL,
    alternative_suggestions JSONB DEFAULT '[]',
    
    -- Timing
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolution_method VARCHAR(50),
    resolved_at TIMESTAMP
);

-- ========================================================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- ========================================================================================

-- Route planning indexes
CREATE INDEX IF NOT EXISTS idx_route_plans_shipment_id ON shipment_route_plans(shipment_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_selected ON shipment_route_plans(is_selected);
CREATE INDEX IF NOT EXISTS idx_route_plans_type ON shipment_route_plans(route_type);
CREATE INDEX IF NOT EXISTS idx_route_plans_hub ON shipment_route_plans(hub_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_score ON shipment_route_plans(score_letter, score_numeric);

CREATE INDEX IF NOT EXISTS idx_route_legs_route_plan ON shipment_route_legs(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_route_legs_order ON shipment_route_legs(route_plan_id, leg_order);
CREATE INDEX IF NOT EXISTS idx_route_legs_type ON shipment_route_legs(leg_type);

CREATE INDEX IF NOT EXISTS idx_guardrails_route_plan ON route_guardrails(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_guardrails_category ON route_guardrails(guardrail_category);
CREATE INDEX IF NOT EXISTS idx_guardrails_blocking ON route_guardrails(is_blocking);

CREATE INDEX IF NOT EXISTS idx_financial_snapshots_shipment ON route_financial_snapshots(shipment_id);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_snapshot_id ON route_financial_snapshots(snapshot_id);

-- Telemetry indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_shipment ON route_planning_sessions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_start ON route_planning_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_decision ON route_planning_sessions(decision_made);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_session ON route_telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON route_telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_timestamp ON route_telemetry_events(event_timestamp);

CREATE INDEX IF NOT EXISTS idx_score_logs_route_plan ON score_computation_logs(route_plan_id);
CREATE INDEX IF NOT EXISTS idx_score_logs_session ON score_computation_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_guardrail_analytics_session ON guardrail_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_guardrail_analytics_type ON guardrail_analytics(trigger_type);

CREATE INDEX IF NOT EXISTS idx_comparison_logs_session ON route_comparison_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_comparison_logs_routes ON route_comparison_logs(route_a_id, route_b_id);

-- Resource management indexes
CREATE INDEX IF NOT EXISTS idx_tier_reservations_shipment ON tier_resource_reservations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tier_reservations_tier ON tier_resource_reservations(assigned_tier);
CREATE INDEX IF NOT EXISTS idx_tier_reservations_hub ON tier_resource_reservations(reserved_hub_id);
CREATE INDEX IF NOT EXISTS idx_tier_reservations_status ON tier_resource_reservations(status);

CREATE INDEX IF NOT EXISTS idx_inventory_checks_shipment ON inventory_constraint_checks(shipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_checks_type ON inventory_constraint_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_inventory_checks_constraint ON inventory_constraint_checks(constraint_met);

-- ========================================================================================
-- TRIGGERS AND FUNCTIONS
-- ========================================================================================

-- Function to update session end time and calculate duration
CREATE OR REPLACE FUNCTION update_session_end()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.session_end IS NOT NULL AND OLD.session_end IS NULL THEN
        NEW.session_duration_ms = EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_duration 
    BEFORE UPDATE ON route_planning_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_session_end();

-- Function to automatically set route selection timestamp
CREATE OR REPLACE FUNCTION track_route_selection()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_selected = TRUE AND OLD.is_selected = FALSE THEN
        NEW.selected_at = CURRENT_TIMESTAMP;
        
        -- Update the session with decision outcome
        UPDATE route_planning_sessions 
        SET decision_made = TRUE,
            selected_route_id = NEW.id,
            session_end = CURRENT_TIMESTAMP
        WHERE shipment_id = NEW.shipment_id 
        AND session_end IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_route_selection_updates 
    BEFORE UPDATE ON shipment_route_plans 
    FOR EACH ROW 
    EXECUTE FUNCTION track_route_selection();

-- Function to automatically create telemetry event for guardrail triggers
CREATE OR REPLACE FUNCTION log_guardrail_telemetry()
RETURNS TRIGGER AS $$
DECLARE
    session_record RECORD;
BEGIN
    -- Find the active session for this shipment
    SELECT * INTO session_record 
    FROM route_planning_sessions 
    WHERE shipment_id = (
        SELECT shipment_id 
        FROM shipment_route_plans 
        WHERE id = NEW.route_plan_id
    ) 
    AND session_end IS NULL 
    ORDER BY session_start DESC 
    LIMIT 1;
    
    IF session_record.id IS NOT NULL THEN
        -- Insert telemetry event
        INSERT INTO route_telemetry_events (
            session_id, 
            event_type, 
            event_category, 
            event_data, 
            route_id,
            time_since_session_start_ms
        ) VALUES (
            session_record.id,
            'guardrail.triggered',
            'business',
            json_build_object(
                'type', NEW.guardrail_category,
                'message', NEW.message,
                'blocking', NEW.is_blocking,
                'can_override', NEW.can_override
            ),
            NEW.route_plan_id,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - session_record.session_start)) * 1000
        );
        
        -- Update session guardrail counter
        UPDATE route_planning_sessions 
        SET guardrails_triggered = guardrails_triggered + 1,
            encountered_guardrails = TRUE
        WHERE id = session_record.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_guardrail_events 
    AFTER INSERT ON route_guardrails 
    FOR EACH ROW 
    EXECUTE FUNCTION log_guardrail_telemetry();

-- ========================================================================================
-- SAMPLE DATA FOR TESTING
-- ========================================================================================

-- Sample tier reservations for testing
-- Note: This will be populated by the tier gate process, but adding samples for development

-- Table comments for documentation
COMMENT ON TABLE shipment_route_plans IS 'Stores complete route plans with scoring, costs, and availability indicators';
COMMENT ON TABLE shipment_route_legs IS 'Individual segments of a route plan with timing and cost details';
COMMENT ON TABLE route_guardrails IS 'Validation rules and constraints for route plans';
COMMENT ON TABLE route_financial_snapshots IS 'Audit trail of financial calculations for compliance';
COMMENT ON TABLE route_planning_sessions IS 'Session-level analytics for route planning user behavior';
COMMENT ON TABLE route_telemetry_events IS 'Detailed event tracking for user interactions and system performance';
COMMENT ON TABLE score_computation_logs IS 'Detailed logging of score calculations for algorithm analysis';
COMMENT ON TABLE guardrail_analytics IS 'Analytics on guardrail triggers and user responses';
COMMENT ON TABLE route_comparison_logs IS 'Tracking of route comparisons and decision factors';
COMMENT ON TABLE tier_resource_reservations IS 'Resource allocations from tier gate for shipments';
COMMENT ON TABLE inventory_constraint_checks IS 'Validation of inventory availability for route plans';
