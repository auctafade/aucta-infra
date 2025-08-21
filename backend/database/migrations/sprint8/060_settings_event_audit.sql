-- Settings Event & Audit System
-- Structured, deduplicated events with correlation IDs
-- One and only one event per confirmed action; replay safe

-- Main settings events table with idempotency
CREATE TABLE IF NOT EXISTS settings_events (
    id SERIAL PRIMARY KEY,
    
    -- Event Identity (for idempotency)
    event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'settings.sla.updated',
        'settings.margin.updated', 
        'settings.policy.published',
        'settings.hub_capacity.published',
        'hub_capacity.changed',
        'settings.thresholds.updated',
        'settings.riskmodel.updated'
    )),
    payload_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash for duplicate detection
    correlation_id VARCHAR(100) NOT NULL,
    
    -- Required fields per specification
    actor_id VARCHAR(255) NOT NULL,
    version VARCHAR(20),
    effective_at TIMESTAMP WITH TIME ZONE,
    fields_changed TEXT[], -- Array of changed field paths
    shipment_id VARCHAR(50),
    
    -- Event metadata
    timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100),
    user_agent TEXT,
    client_ip INET,
    
    -- Event payload and state tracking
    payload JSONB NOT NULL,
    pre_state JSONB, -- State before change
    post_state JSONB, -- State after change
    state_diff JSONB, -- Calculated diff: {added: {}, modified: {}, removed: {}}
    
    -- Processing metadata
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'retrying'))
);

-- Indexes for performance and querying
CREATE INDEX IF NOT EXISTS idx_settings_events_event_type ON settings_events(event_type);
CREATE INDEX IF NOT EXISTS idx_settings_events_correlation_id ON settings_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_settings_events_actor_timestamp ON settings_events(actor_id, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_settings_events_payload_hash ON settings_events(payload_hash);
CREATE INDEX IF NOT EXISTS idx_settings_events_fields_changed ON settings_events USING GIN(fields_changed);
CREATE INDEX IF NOT EXISTS idx_settings_events_timestamp ON settings_events(timestamp_utc DESC);

-- Event correlation tracking
CREATE TABLE IF NOT EXISTS event_correlations (
    id SERIAL PRIMARY KEY,
    correlation_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100),
    
    -- Context for grouping related events
    policy_id VARCHAR(50),
    hub_id INTEGER,
    user_id VARCHAR(255),
    
    -- Correlation metadata
    initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    event_count INTEGER DEFAULT 0,
    
    -- Correlation status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    
    UNIQUE(correlation_id)
);

CREATE INDEX IF NOT EXISTS idx_event_correlations_session ON event_correlations(session_id);
CREATE INDEX IF NOT EXISTS idx_event_correlations_status ON event_correlations(status, initiated_at DESC);

-- Enhanced audit trail with event linking
CREATE TABLE IF NOT EXISTS settings_audit_trail (
    id SERIAL PRIMARY KEY,
    
    -- Link to original event
    event_id VARCHAR(100) REFERENCES settings_events(event_id),
    correlation_id VARCHAR(100),
    
    -- Standard audit fields
    action_category VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    
    -- State tracking
    old_values JSONB,
    new_values JSONB,
    field_diffs JSONB, -- Detailed field-by-field changes
    
    -- Actor information
    actor_id VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50),
    
    -- Context
    timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    
    -- Compliance & retention
    retention_policy VARCHAR(50) DEFAULT 'standard', -- 'standard', 'extended', 'permanent'
    compliance_level VARCHAR(20) DEFAULT 'normal' CHECK (compliance_level IN ('normal', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_settings_audit_resource ON settings_audit_trail(resource_type, resource_id, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_settings_audit_actor ON settings_audit_trail(actor_id, timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_settings_audit_correlation ON settings_audit_trail(correlation_id);
CREATE INDEX IF NOT EXISTS idx_settings_audit_event_id ON settings_audit_trail(event_id);

-- Event processing status for monitoring
CREATE TABLE IF NOT EXISTS event_processing_status (
    id SERIAL PRIMARY KEY,
    
    -- Processing window
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Statistics
    events_processed INTEGER DEFAULT 0,
    events_skipped INTEGER DEFAULT 0, -- Duplicates caught by idempotency
    events_failed INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_processing_time_ms INTEGER,
    max_processing_time_ms INTEGER,
    duplicate_rate DECIMAL(5,2), -- Percentage of events that were duplicates
    
    -- Processing metadata
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processor_version VARCHAR(20),
    
    UNIQUE(window_start, window_end)
);

-- Functions for event processing
CREATE OR REPLACE FUNCTION update_event_correlation_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update event count in correlations table
    INSERT INTO event_correlations (correlation_id, event_count)
    VALUES (NEW.correlation_id, 1)
    ON CONFLICT (correlation_id) 
    DO UPDATE SET 
        event_count = event_correlations.event_count + 1,
        completed_at = CASE 
            WHEN event_correlations.status = 'active' THEN NULL 
            ELSE CURRENT_TIMESTAMP 
        END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain correlation counts
DROP TRIGGER IF EXISTS trigger_update_correlation_count ON settings_events;
CREATE TRIGGER trigger_update_correlation_count
    AFTER INSERT ON settings_events
    FOR EACH ROW EXECUTE FUNCTION update_event_correlation_count();

-- Function to get audit trail with diffs
CREATE OR REPLACE FUNCTION get_resource_audit_trail(
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(50),
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    audit_id INTEGER,
    event_id VARCHAR(100),
    correlation_id VARCHAR(100),
    action_type VARCHAR(50),
    actor_id VARCHAR(255),
    timestamp_utc TIMESTAMP WITH TIME ZONE,
    field_changes JSONB,
    pre_state JSONB,
    post_state JSONB,
    state_diff JSONB,
    ip_address INET,
    session_id VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sat.id,
        sat.event_id,
        sat.correlation_id,
        sat.action_type,
        sat.actor_id,
        sat.timestamp_utc,
        sat.field_diffs,
        se.pre_state,
        se.post_state,
        se.state_diff,
        sat.ip_address,
        sat.session_id
    FROM settings_audit_trail sat
    LEFT JOIN settings_events se ON sat.event_id = se.event_id
    WHERE sat.resource_type = p_resource_type 
      AND sat.resource_id = p_resource_id
    ORDER BY sat.timestamp_utc DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to check event idempotency
CREATE OR REPLACE FUNCTION is_duplicate_event(p_payload_hash VARCHAR(64))
RETURNS BOOLEAN AS $$
DECLARE
    event_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM settings_events 
        WHERE payload_hash = p_payload_hash
    ) INTO event_exists;
    
    RETURN event_exists;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
INSERT INTO event_correlations (correlation_id, session_id, policy_id, user_id, status, event_count)
VALUES 
    ('corr-001-test', 'session-001', 'policy-001', 'ops_admin@aucta.io', 'completed', 3),
    ('corr-002-test', 'session-002', 'hub-policy-001', 'hub_tech@aucta.io', 'active', 1)
ON CONFLICT (correlation_id) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON settings_events TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON event_correlations TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON settings_audit_trail TO PUBLIC;
GRANT SELECT ON event_processing_status TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

-- Comments for documentation
COMMENT ON TABLE settings_events IS 'Main events table with idempotency checks for settings changes';
COMMENT ON COLUMN settings_events.payload_hash IS 'SHA-256 hash of normalized payload for duplicate detection';
COMMENT ON COLUMN settings_events.correlation_id IS 'Groups related events in a user session or batch operation';
COMMENT ON COLUMN settings_events.state_diff IS 'Calculated difference showing added/modified/removed fields';
COMMENT ON TABLE event_correlations IS 'Tracks correlation contexts and event groupings';
COMMENT ON TABLE settings_audit_trail IS 'Enhanced audit trail with event linking and compliance levels';
COMMENT ON FUNCTION get_resource_audit_trail IS 'Retrieves full audit trail with state diffs for a resource';
COMMENT ON FUNCTION is_duplicate_event IS 'Checks if an event payload hash already exists (idempotency)';

COMMIT;
