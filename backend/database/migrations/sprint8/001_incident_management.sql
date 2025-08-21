-- =========================================
-- Sprint 8: Incident Management System
-- Database schema for operational incidents
-- =========================================

-- Main incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Core classification
    type VARCHAR(50) NOT NULL CHECK (type IN ('customs', 'delay', 'damage', 'lost', 'docs', 'address', 'payment_hold')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('S1', 'S2', 'S3', 'S4')),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'waiting_third_party', 'on_hold', 'resolved', 'canceled')),
    tier INTEGER NOT NULL DEFAULT 1 CHECK (tier IN (1, 2, 3)),
    
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    resolution TEXT,
    resolution_notes TEXT,
    
    -- Relationships
    shipment_id VARCHAR(100) NOT NULL,
    leg_id VARCHAR(100),
    hub_id VARCHAR(100),
    passport_id INTEGER REFERENCES passports(id),
    
    -- Ownership and assignment
    owner_id INTEGER REFERENCES clients(id),
    owner_name VARCHAR(255),
    assigned_by VARCHAR(255),
    
    -- Client information
    client_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Timing and SLA
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sla_due_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    first_assigned_at TIMESTAMP,
    first_action_at TIMESTAMP,
    
    -- Priority and workflow
    priority INTEGER DEFAULT 50,
    is_overdue BOOLEAN DEFAULT false,
    escalation_count INTEGER DEFAULT 0,
    
    -- Metadata
    tags TEXT[],
    related_incidents TEXT[],
    leg_display VARCHAR(100),
    hub_name VARCHAR(100),
    carrier VARCHAR(50),
    tracking_id VARCHAR(100),
    
    -- Manual operations tracking
    manual_updates_count INTEGER DEFAULT 0,
    api_failure_count INTEGER DEFAULT 0,
    
    -- Communication tracking
    client_notifications_count INTEGER DEFAULT 0,
    last_client_notification TIMESTAMP,
    
    -- Post-mortem (for Tier 2/3)
    requires_post_mortem BOOLEAN DEFAULT false,
    post_mortem_completed BOOLEAN DEFAULT false,
    post_mortem_data JSONB,
    
    -- Passport integration
    blocks_passport_activation BOOLEAN DEFAULT false,
    passport_hold_override BOOLEAN DEFAULT false,
    passport_hold_override_reason TEXT
);

-- Incident timeline/activity log
CREATE TABLE IF NOT EXISTS incident_timeline (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Timeline entry details
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('status_change', 'assignment', 'comment', 'file_upload', 'action', 'escalation', 'system_alert', 'client_notification')),
    user_id INTEGER REFERENCES clients(id),
    user_name VARCHAR(255) NOT NULL,
    
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Metadata
    is_client_visible BOOLEAN DEFAULT false,
    metadata JSONB,
    
    -- Timing
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incident playbook tracking
CREATE TABLE IF NOT EXISTS incident_playbooks (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Playbook info
    playbook_type VARCHAR(50) NOT NULL,
    playbook_version VARCHAR(20) DEFAULT '1.0',
    
    -- Progress tracking
    total_steps INTEGER NOT NULL,
    required_steps INTEGER NOT NULL,
    completed_steps INTEGER DEFAULT 0,
    completed_required_steps INTEGER DEFAULT 0,
    
    -- Steps data
    steps_data JSONB NOT NULL,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File attachments and evidence
CREATE TABLE IF NOT EXISTS incident_files (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- File info
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    
    -- Metadata
    tags TEXT[],
    uploaded_by VARCHAR(255) NOT NULL,
    upload_source VARCHAR(50) DEFAULT 'manual' CHECK (upload_source IN ('manual', 'drag_drop', 'api', 'system')),
    
    -- Timing
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client communications log
CREATE TABLE IF NOT EXISTS incident_communications (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Communication details
    communication_type VARCHAR(50) NOT NULL CHECK (communication_type IN ('notification', 'update', 'resolution', 'escalation', 'request')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'webhook', 'portal')),
    
    -- Content
    template_id VARCHAR(100),
    subject VARCHAR(500),
    content TEXT NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'blocked_cooling_off')),
    delivery_status VARCHAR(50),
    read_status VARCHAR(50),
    
    -- Policy compliance
    cooling_off_until TIMESTAMP,
    communication_sequence INTEGER DEFAULT 1,
    
    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP
);

-- Manual updates and API failure tracking
CREATE TABLE IF NOT EXISTS incident_manual_updates (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Update details
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    
    -- Source tracking
    update_source VARCHAR(50) NOT NULL CHECK (update_source IN ('manual', 'api_failure', 'override', 'system')),
    api_context JSONB,
    
    -- User info
    user_id INTEGER REFERENCES clients(id),
    user_name VARCHAR(255) NOT NULL,
    
    -- Timing
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conflict warnings and resolution blockers
CREATE TABLE IF NOT EXISTS incident_conflicts (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Conflict details
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN ('data_conflict', 'workflow_conflict', 'system_conflict')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('blocking', 'warning', 'info')),
    
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    conflicting_sources TEXT[],
    suggested_resolution TEXT,
    
    -- Resolution
    is_auto_resolvable BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP,
    
    -- Timing
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telemetry and metrics
CREATE TABLE IF NOT EXISTS incident_telemetry (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Performance metrics (in milliseconds)
    time_to_own_ms BIGINT,
    time_to_first_action_ms BIGINT,
    time_to_resolve_ms BIGINT,
    
    -- Operational metrics
    reopen_count INTEGER DEFAULT 0,
    escalation_count INTEGER DEFAULT 0,
    manual_override_count INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    
    -- Quality metrics
    sla_breached BOOLEAN DEFAULT false,
    sla_breach_reason_code VARCHAR(100),
    client_satisfaction_score INTEGER,
    resolution_quality_score INTEGER,
    
    -- Communication metrics
    client_notifications_sent INTEGER DEFAULT 0,
    avg_response_time_ms BIGINT,
    
    -- Timestamps
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_shipment_id ON incidents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_owner_id ON incidents(owner_id);
CREATE INDEX IF NOT EXISTS idx_incidents_sla_due_at ON incidents(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_is_overdue ON incidents(is_overdue);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident_id ON incident_timeline(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_timestamp ON incident_timeline(timestamp);
CREATE INDEX IF NOT EXISTS idx_incident_timeline_entry_type ON incident_timeline(entry_type);

CREATE INDEX IF NOT EXISTS idx_incident_playbooks_incident_id ON incident_playbooks(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_files_incident_id ON incident_files(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_communications_incident_id ON incident_communications(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_manual_updates_incident_id ON incident_manual_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_conflicts_incident_id ON incident_conflicts(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_telemetry_incident_id ON incident_telemetry(incident_id);

-- Create trigger functions for automatic updates
CREATE OR REPLACE FUNCTION update_incident_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Update SLA overdue status
    NEW.is_overdue = (NEW.sla_due_at < CURRENT_TIMESTAMP AND NEW.status NOT IN ('resolved', 'canceled'));
    
    -- Update post-mortem requirements
    NEW.requires_post_mortem = (NEW.tier >= 2);
    
    -- Update passport blocking
    NEW.blocks_passport_activation = (NEW.type IN ('damage', 'lost') AND NEW.tier = 3 AND NEW.status NOT IN ('resolved', 'canceled') AND NOT NEW.passport_hold_override);
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_incident_telemetry()
RETURNS TRIGGER AS $$
BEGIN
    -- Update first assignment time
    IF OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL AND NEW.first_assigned_at IS NULL THEN
        NEW.first_assigned_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Calculate time to own
    IF NEW.first_assigned_at IS NOT NULL THEN
        UPDATE incident_telemetry 
        SET time_to_own_ms = EXTRACT(EPOCH FROM (NEW.first_assigned_at - NEW.created_at)) * 1000,
            updated_at = CURRENT_TIMESTAMP
        WHERE incident_id = NEW.id;
    END IF;
    
    -- Calculate time to resolve
    IF OLD.status != 'resolved' AND NEW.status = 'resolved' THEN
        NEW.resolved_at = CURRENT_TIMESTAMP;
        
        UPDATE incident_telemetry 
        SET time_to_resolve_ms = EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.created_at)) * 1000,
            sla_breached = (NEW.resolved_at > NEW.sla_due_at),
            updated_at = CURRENT_TIMESTAMP
        WHERE incident_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER incidents_updated_at_trigger
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_updated_at();

CREATE TRIGGER incidents_telemetry_trigger
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_telemetry();

-- Insert initial telemetry record for new incidents
CREATE OR REPLACE FUNCTION create_incident_telemetry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO incident_telemetry (incident_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER incidents_create_telemetry_trigger
    AFTER INSERT ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION create_incident_telemetry();

-- Comments on tables
COMMENT ON TABLE incidents IS 'Main incident management table tracking operational issues in the logistics pipeline';
COMMENT ON TABLE incident_timeline IS 'Complete audit trail of all incident activities and status changes';
COMMENT ON TABLE incident_playbooks IS 'Structured playbook progress tracking for each incident type';
COMMENT ON TABLE incident_files IS 'File attachments and evidence uploaded for incidents';
COMMENT ON TABLE incident_communications IS 'Client communication log with cooling-off policy enforcement';
COMMENT ON TABLE incident_manual_updates IS 'Manual updates and API failure override tracking';
COMMENT ON TABLE incident_conflicts IS 'Conflict detection and resolution blocking mechanisms';
COMMENT ON TABLE incident_telemetry IS 'Performance metrics and operational analytics for incidents';


