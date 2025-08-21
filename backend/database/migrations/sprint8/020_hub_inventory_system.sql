-- Hub Inventory Management System for Tags and NFC Units
-- This migration creates the inventory tables needed for Hub Console operations

-- ====================
-- INVENTORY MANAGEMENT
-- ====================

-- Inventory Tags - Physical tags used in Tier 2 processing
CREATE TABLE IF NOT EXISTS inventory_tags (
    id SERIAL PRIMARY KEY,
    tag_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'TAG-001234'
    tag_type VARCHAR(20) DEFAULT 'qr' CHECK (tag_type IN ('qr', 'nfc', 'hybrid')),
    
    -- Physical properties
    batch_number VARCHAR(50),
    manufacture_date DATE,
    expiry_date DATE,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'applied', 'defective', 'lost')),
    assigned_shipment_id VARCHAR(50), -- References shipments.shipment_id
    assigned_hub_id INTEGER REFERENCES logistics_hubs(id),
    assigned_at TIMESTAMP,
    applied_at TIMESTAMP,
    
    -- Hub location
    current_hub_id INTEGER REFERENCES logistics_hubs(id),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Quality control
    quality_check_passed BOOLEAN DEFAULT TRUE,
    quality_notes TEXT,
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Inventory NFC Units - NFC chips used in Tier 3 processing
CREATE TABLE IF NOT EXISTS inventory_nfc (
    id SERIAL PRIMARY KEY,
    nfc_uid VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'NFC-567890'
    nfc_type VARCHAR(20) DEFAULT 'ntag213' CHECK (nfc_type IN ('ntag213', 'ntag215', 'ntag216', 'custom')),
    
    -- Technical specifications
    memory_size_bytes INTEGER DEFAULT 180,
    read_range_cm INTEGER DEFAULT 4,
    write_cycles_max INTEGER DEFAULT 10000,
    
    -- Batch information
    batch_number VARCHAR(50),
    manufacture_date DATE,
    supplier VARCHAR(100),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'installed', 'defective', 'rma')),
    assigned_shipment_id VARCHAR(50), -- References shipments.shipment_id
    assigned_hub_id INTEGER REFERENCES logistics_hubs(id),
    assigned_at TIMESTAMP,
    installed_at TIMESTAMP,
    
    -- Hub location
    current_hub_id INTEGER REFERENCES logistics_hubs(id),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Testing and validation
    read_test_passed BOOLEAN,
    write_test_passed BOOLEAN,
    last_test_date TIMESTAMP,
    test_notes TEXT,
    
    -- RMA tracking
    rma_initiated_at TIMESTAMP,
    rma_reason TEXT,
    rma_reference VARCHAR(50),
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Hub Processing Jobs - Links shipments to hub processing workflow
CREATE TABLE IF NOT EXISTS hub_processing_jobs (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(50) UNIQUE NOT NULL, -- References shipments.shipment_id
    hub_id INTEGER NOT NULL REFERENCES logistics_hubs(id),
    
    -- Tier and classification
    tier INTEGER NOT NULL CHECK (tier IN (2, 3)),
    product_category VARCHAR(100),
    declared_value DECIMAL(12,2),
    
    -- Processing status
    status VARCHAR(30) DEFAULT 'awaiting_intake' CHECK (status IN (
        'awaiting_intake', 'in_progress', 'waiting_qa', 'ready_outbound', 'completed', 'paused', 'cancelled'
    )),
    
    -- Reserved inventory
    reserved_tag_id VARCHAR(50) REFERENCES inventory_tags(tag_id),
    reserved_nfc_uid VARCHAR(50) REFERENCES inventory_nfc(nfc_uid),
    
    -- Timeline tracking
    intake_started_at TIMESTAMP,
    intake_completed_at TIMESTAMP,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    qa_started_at TIMESTAMP,
    qa_completed_at TIMESTAMP,
    outbound_started_at TIMESTAMP,
    outbound_completed_at TIMESTAMP,
    
    -- SLA tracking
    planned_intake_time TIMESTAMP NOT NULL,
    sla_deadline TIMESTAMP NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Processing results
    tag_applied BOOLEAN DEFAULT FALSE,
    nfc_installed BOOLEAN DEFAULT FALSE,
    qa_status VARCHAR(20) DEFAULT 'pending' CHECK (qa_status IN ('pending', 'passed', 'failed', 'rework_required')),
    qa_notes TEXT,
    
    -- Metadata
    processing_notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    assigned_technician VARCHAR(100)
);

-- Hub Evidence Files - Stores evidence photos and documents
CREATE TABLE IF NOT EXISTS hub_evidence_files (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES hub_processing_jobs(id) ON DELETE CASCADE,
    
    -- File information
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for integrity
    
    -- Evidence type classification
    evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN (
        'intake_seal', 'intake_360', 'auth_photo', 'tag_placement', 
        'nfc_test', 'final_photo', 'outbound_seal', 'qa_review'
    )),
    
    -- Validation status
    validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    
    -- Metadata
    captured_at TIMESTAMP NOT NULL,
    captured_by VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hub Incidents - Tracks damage, issues, and edge cases
CREATE TABLE IF NOT EXISTS hub_incidents (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'INC-20240115-001'
    job_id INTEGER REFERENCES hub_processing_jobs(id),
    
    -- Incident classification
    incident_type VARCHAR(30) NOT NULL CHECK (incident_type IN (
        'damage_on_arrival', 'inventory_shortage', 'nfc_failure', 
        'quality_issue', 'processing_delay', 'other'
    )),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolution TEXT,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(100),
    
    -- Impact
    job_paused BOOLEAN DEFAULT FALSE,
    paused_at TIMESTAMP,
    resume_authorized_by VARCHAR(100),
    
    -- Assignment
    assigned_to VARCHAR(100),
    reported_by VARCHAR(100) NOT NULL,
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hub Telemetry Events - Performance and analytics tracking
CREATE TABLE IF NOT EXISTS hub_telemetry_events (
    id SERIAL PRIMARY KEY,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    session_id VARCHAR(100),
    job_id INTEGER REFERENCES hub_processing_jobs(id),
    hub_id INTEGER REFERENCES logistics_hubs(id),
    
    -- Actor context
    user_id VARCHAR(100),
    user_role VARCHAR(50),
    
    -- Event data
    event_data JSONB NOT NULL,
    duration_ms BIGINT,
    
    -- Technical context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Audit Log - Complete change history
CREATE TABLE IF NOT EXISTS inventory_audit_log (
    id SERIAL PRIMARY KEY,
    
    -- What was changed
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    
    -- Change details
    field_name VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    
    -- Context
    job_id INTEGER REFERENCES hub_processing_jobs(id),
    reason TEXT,
    
    -- Actor
    changed_by VARCHAR(100) NOT NULL,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- INDEXES FOR PERFORMANCE
-- ====================

-- Inventory Tags
CREATE INDEX IF NOT EXISTS idx_inventory_tags_status ON inventory_tags(status);
CREATE INDEX IF NOT EXISTS idx_inventory_tags_hub ON inventory_tags(current_hub_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tags_shipment ON inventory_tags(assigned_shipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tags_created_at ON inventory_tags(created_at);

-- Inventory NFC
CREATE INDEX IF NOT EXISTS idx_inventory_nfc_status ON inventory_nfc(status);
CREATE INDEX IF NOT EXISTS idx_inventory_nfc_hub ON inventory_nfc(current_hub_id);
CREATE INDEX IF NOT EXISTS idx_inventory_nfc_shipment ON inventory_nfc(assigned_shipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_nfc_test_date ON inventory_nfc(last_test_date);

-- Hub Processing Jobs
CREATE INDEX IF NOT EXISTS idx_hub_jobs_status ON hub_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_hub_jobs_hub ON hub_processing_jobs(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_jobs_tier ON hub_processing_jobs(tier);
CREATE INDEX IF NOT EXISTS idx_hub_jobs_sla_deadline ON hub_processing_jobs(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_hub_jobs_priority ON hub_processing_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_hub_jobs_created_at ON hub_processing_jobs(created_at);

-- Hub Evidence Files
CREATE INDEX IF NOT EXISTS idx_hub_evidence_job ON hub_evidence_files(job_id);
CREATE INDEX IF NOT EXISTS idx_hub_evidence_type ON hub_evidence_files(evidence_type);
CREATE INDEX IF NOT EXISTS idx_hub_evidence_captured_at ON hub_evidence_files(captured_at);
CREATE INDEX IF NOT EXISTS idx_hub_evidence_hash ON hub_evidence_files(file_hash);

-- Hub Incidents
CREATE INDEX IF NOT EXISTS idx_hub_incidents_job ON hub_incidents(job_id);
CREATE INDEX IF NOT EXISTS idx_hub_incidents_status ON hub_incidents(status);
CREATE INDEX IF NOT EXISTS idx_hub_incidents_type ON hub_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_hub_incidents_created_at ON hub_incidents(created_at);

-- Hub Telemetry
CREATE INDEX IF NOT EXISTS idx_hub_telemetry_event_type ON hub_telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hub_telemetry_job ON hub_telemetry_events(job_id);
CREATE INDEX IF NOT EXISTS idx_hub_telemetry_created_at ON hub_telemetry_events(created_at);

-- Inventory Audit Log
CREATE INDEX IF NOT EXISTS idx_inventory_audit_table_record ON inventory_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_created_at ON inventory_audit_log(created_at);

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

-- Apply triggers
CREATE TRIGGER update_inventory_tags_updated_at BEFORE UPDATE ON inventory_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_nfc_updated_at BEFORE UPDATE ON inventory_nfc FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hub_processing_jobs_updated_at BEFORE UPDATE ON hub_processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hub_incidents_updated_at BEFORE UPDATE ON hub_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trail trigger for inventory changes
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO inventory_audit_log (
                table_name, record_id, action, field_name, old_value, new_value, changed_by
            ) VALUES (
                TG_TABLE_NAME, NEW.id, 'update', 'status', OLD.status, NEW.status, 
                COALESCE(NEW.updated_at::text, 'system')
            );
        END IF;
        
        -- Log assignment changes for tags
        IF TG_TABLE_NAME = 'inventory_tags' AND OLD.assigned_shipment_id IS DISTINCT FROM NEW.assigned_shipment_id THEN
            INSERT INTO inventory_audit_log (
                table_name, record_id, action, field_name, old_value, new_value, changed_by
            ) VALUES (
                TG_TABLE_NAME, NEW.id, 'update', 'assigned_shipment_id', 
                OLD.assigned_shipment_id, NEW.assigned_shipment_id, 
                COALESCE(NEW.updated_at::text, 'system')
            );
        END IF;
        
        -- Log assignment changes for NFC
        IF TG_TABLE_NAME = 'inventory_nfc' AND OLD.assigned_shipment_id IS DISTINCT FROM NEW.assigned_shipment_id THEN
            INSERT INTO inventory_audit_log (
                table_name, record_id, action, field_name, old_value, new_value, changed_by
            ) VALUES (
                TG_TABLE_NAME, NEW.id, 'update', 'assigned_shipment_id', 
                OLD.assigned_shipment_id, NEW.assigned_shipment_id, 
                COALESCE(NEW.updated_at::text, 'system')
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers
CREATE TRIGGER audit_inventory_tags_changes AFTER UPDATE ON inventory_tags FOR EACH ROW EXECUTE FUNCTION log_inventory_changes();
CREATE TRIGGER audit_inventory_nfc_changes AFTER UPDATE ON inventory_nfc FOR EACH ROW EXECUTE FUNCTION log_inventory_changes();

-- ====================
-- SAMPLE DATA
-- ====================

-- Insert sample inventory for testing
INSERT INTO inventory_tags (tag_id, tag_type, batch_number, current_hub_id, status) VALUES
    ('TAG-001001', 'qr', 'BATCH-2024-001', 1, 'available'),
    ('TAG-001002', 'qr', 'BATCH-2024-001', 1, 'available'),
    ('TAG-001003', 'qr', 'BATCH-2024-001', 1, 'available'),
    ('TAG-001004', 'hybrid', 'BATCH-2024-002', 1, 'available'),
    ('TAG-001005', 'hybrid', 'BATCH-2024-002', 1, 'available'),
    ('TAG-002001', 'qr', 'BATCH-2024-001', 2, 'available'),
    ('TAG-002002', 'qr', 'BATCH-2024-001', 2, 'available'),
    ('TAG-002003', 'hybrid', 'BATCH-2024-002', 2, 'available')
ON CONFLICT (tag_id) DO NOTHING;

INSERT INTO inventory_nfc (nfc_uid, nfc_type, batch_number, current_hub_id, status, read_test_passed, write_test_passed) VALUES
    ('NFC-001001', 'ntag213', 'NFC-BATCH-2024-001', 1, 'available', true, true),
    ('NFC-001002', 'ntag213', 'NFC-BATCH-2024-001', 1, 'available', true, true),
    ('NFC-001003', 'ntag215', 'NFC-BATCH-2024-002', 1, 'available', true, true),
    ('NFC-001004', 'ntag215', 'NFC-BATCH-2024-002', 1, 'available', true, true),
    ('NFC-001005', 'ntag216', 'NFC-BATCH-2024-003', 1, 'available', true, true),
    ('NFC-002001', 'ntag213', 'NFC-BATCH-2024-001', 2, 'available', true, true),
    ('NFC-002002', 'ntag213', 'NFC-BATCH-2024-001', 2, 'available', true, true),
    ('NFC-002003', 'ntag215', 'NFC-BATCH-2024-002', 2, 'available', true, true)
ON CONFLICT (nfc_uid) DO NOTHING;

-- Table comments for documentation
COMMENT ON TABLE inventory_tags IS 'Physical tags inventory for Tier 2 processing';
COMMENT ON TABLE inventory_nfc IS 'NFC chips inventory for Tier 3 processing';
COMMENT ON TABLE hub_processing_jobs IS 'Hub processing workflow jobs linked to shipments';
COMMENT ON TABLE hub_evidence_files IS 'Evidence photos and documents for hub processing';
COMMENT ON TABLE hub_incidents IS 'Incidents, damage reports, and edge cases';
COMMENT ON TABLE hub_telemetry_events IS 'Performance analytics and user behavior tracking';
COMMENT ON TABLE inventory_audit_log IS 'Complete audit trail for inventory changes';
