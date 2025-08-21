-- Migration 030: Comprehensive Contacts Management System
-- This migration creates all tables needed for the advanced contact management system
-- Integrates with existing logistics_contacts table

-- ====================
-- CONTACTS MANAGEMENT CORE
-- ====================

-- Enhanced contacts table - extends logistics_contacts with advanced features
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    
    -- Link to existing logistics_contacts if applicable
    logistics_contact_id INTEGER REFERENCES logistics_contacts(id),
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    emails TEXT[] NOT NULL DEFAULT '{}', -- Array of email addresses
    phones TEXT[] NOT NULL DEFAULT '{}', -- Array of phone numbers (E.164 format)
    phones_original TEXT[] DEFAULT '{}', -- Original format for display
    role VARCHAR(20) NOT NULL CHECK (role IN ('sender', 'buyer', 'wg', 'hub')),
    
    -- Contact Details
    company VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    
    -- KYC and Compliance
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('ok', 'pending', 'failed', 'n/a')),
    kyc_date TIMESTAMP,
    kyc_verifier VARCHAR(255),
    kyc_notes TEXT,
    
    -- Contact Management
    tags TEXT[] DEFAULT '{}', -- Array of tags: ['VIP', 'high-value', 'corporate']
    last_used TIMESTAMP,
    shipment_count INTEGER DEFAULT 0,
    
    -- Status and Availability
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted', 'merged')),
    unreachable BOOLEAN DEFAULT FALSE,
    unreachable_reason TEXT,
    unreachable_date TIMESTAMP,
    merged_into INTEGER REFERENCES contacts(id),
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) DEFAULT 'system',
    updated_by VARCHAR(255) DEFAULT 'system'
);

-- Contact addresses - Multiple addresses per contact
CREATE TABLE IF NOT EXISTS contact_addresses (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Address Information
    address_type VARCHAR(20) DEFAULT 'primary' CHECK (address_type IN ('primary', 'secondary', 'work', 'billing')),
    street_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    
    -- Preferences
    is_primary BOOLEAN DEFAULT FALSE,
    delivery_notes TEXT,
    access_instructions TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact preferences - Communication and operational preferences
CREATE TABLE IF NOT EXISTS contact_preferences (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Communication Preferences
    preferred_communication TEXT[] DEFAULT '{"email"}' CHECK (preferred_communication <@ ARRAY['email', 'phone', 'sms', 'whatsapp']),
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Time Windows
    pickup_time_windows JSONB DEFAULT '{}', -- {"monday": "09:00-17:00", "tuesday": "09:00-17:00"}
    delivery_time_windows JSONB DEFAULT '{}',
    
    -- Special Requirements
    requires_appointment BOOLEAN DEFAULT FALSE,
    minimum_notice_hours INTEGER DEFAULT 24,
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact logistics profile - WG and hub specific information
CREATE TABLE IF NOT EXISTS contact_logistics (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- General Logistics
    delivery_notes TEXT,
    security_requirements TEXT[] DEFAULT '{}',
    special_instructions TEXT,
    
    -- WG Operator Specific (when role = 'wg')
    area_coverage TEXT[] DEFAULT '{}', -- Geographic areas they cover
    max_value_clearance BIGINT DEFAULT 0, -- Maximum shipment value in cents
    vehicle_type VARCHAR(50),
    insurance_status VARCHAR(20) DEFAULT 'unknown' CHECK (insurance_status IN ('active', 'expired', 'pending', 'unknown')),
    insurance_policy_number VARCHAR(100),
    insurance_expiry_date DATE,
    rating DECIMAL(3,2) DEFAULT 5.00,
    
    -- Hub Contact Specific (when role = 'hub')
    hub_id INTEGER REFERENCES logistics_hubs(id),
    department VARCHAR(100),
    escalation_level INTEGER DEFAULT 1, -- 1=first contact, 2=supervisor, 3=manager
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- SHIPMENT INTEGRATION
-- ====================

-- Contact shipment history - Links contacts to shipments
CREATE TABLE IF NOT EXISTS contact_shipment_history (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    shipment_id VARCHAR(50) NOT NULL, -- References shipments.shipment_id
    
    -- Role in shipment
    role_in_shipment VARCHAR(20) NOT NULL CHECK (role_in_shipment IN ('sender', 'buyer', 'wg', 'hub_contact')),
    
    -- Shipment context (denormalized for performance)
    tier VARCHAR(20),
    transport_mode VARCHAR(30), -- 'wg', 'dhl', 'air', 'ground'
    hub_location VARCHAR(255),
    shipment_status VARCHAR(30),
    declared_value DECIMAL(12,2),
    
    -- Timeline
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_milestone VARCHAR(50), -- 'pickup', 'intake', 'processing', 'delivery'
    last_milestone_date TIMESTAMP,
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- VERSIONING AND AUDIT
-- ====================

-- Contact versions - Complete version history
CREATE TABLE IF NOT EXISTS contact_versions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Version Information
    version_number INTEGER NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('create', 'update', 'merge', 'delete', 'restore')),
    
    -- Data Snapshot
    contact_data JSONB NOT NULL, -- Complete contact data at this version
    changes_made JSONB, -- Specific changes from previous version
    
    -- Actor Information
    changed_by VARCHAR(255) NOT NULL,
    change_reason TEXT,
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact notes - Internal notes and communications
CREATE TABLE IF NOT EXISTS contact_notes (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Note Content
    note_type VARCHAR(20) DEFAULT 'general' CHECK (note_type IN ('general', 'compliance', 'issue', 'escalation')),
    title VARCHAR(255),
    content TEXT NOT NULL,
    
    -- Visibility and Priority
    is_private BOOLEAN DEFAULT FALSE,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Status
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL
);

-- ====================
-- DUPLICATE MANAGEMENT
-- ====================

-- Contact duplicates - Potential duplicate relationships
CREATE TABLE IF NOT EXISTS contact_duplicates (
    id SERIAL PRIMARY KEY,
    
    -- Contacts involved
    contact_1_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contact_2_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Duplicate Analysis
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('exact_email', 'exact_phone', 'fuzzy_name', 'address_similar')),
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    matching_fields TEXT[] NOT NULL, -- ['email', 'phone', 'name', 'address']
    
    -- Resolution
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed_duplicate', 'false_positive', 'merged')),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    resolution_action VARCHAR(50),
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't create duplicate duplicate records
    UNIQUE(contact_1_id, contact_2_id)
);

-- ====================
-- EVENTS AND TELEMETRY
-- ====================

-- Contact events - Business events for integration
CREATE TABLE IF NOT EXISTS contact_events (
    id SERIAL PRIMARY KEY,
    
    -- Event Classification
    event_type VARCHAR(50) NOT NULL,
    -- 'contact.created', 'contact.updated', 'contact.merged', 'contact.linked_to_shipment', 
    -- 'contact.kyc.requested', 'contact.kyc.passed', 'contact.kyc.failed'
    
    -- Context
    contact_id INTEGER REFERENCES contacts(id),
    shipment_id VARCHAR(50), -- References shipments.shipment_id
    
    -- Event Data
    event_data JSONB NOT NULL,
    actor_id VARCHAR(255),
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact telemetry - Performance and usage analytics
CREATE TABLE IF NOT EXISTS contact_telemetry (
    id SERIAL PRIMARY KEY,
    
    -- Metric Classification
    metric_type VARCHAR(50) NOT NULL,
    -- 'search_time_ms', 'link_time_ms', 'merge_time_ms', 'duplicate_check_time_ms'
    
    -- Context
    contact_id INTEGER REFERENCES contacts(id),
    user_id VARCHAR(255),
    session_id VARCHAR(100),
    
    -- Measurement
    value_numeric DECIMAL(15,6),
    value_text VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- INDEXES FOR PERFORMANCE
-- ====================

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(role);
CREATE INDEX IF NOT EXISTS idx_contacts_city_country ON contacts(city, country);
CREATE INDEX IF NOT EXISTS idx_contacts_kyc_status ON contacts(kyc_status);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_emails ON contacts USING GIN(emails);
CREATE INDEX IF NOT EXISTS idx_contacts_phones ON contacts USING GIN(phones);
CREATE INDEX IF NOT EXISTS idx_contacts_last_used ON contacts(last_used);
CREATE INDEX IF NOT EXISTS idx_contacts_shipment_count ON contacts(shipment_count);
CREATE INDEX IF NOT EXISTS idx_contacts_logistics_id ON contacts(logistics_contact_id);

-- Contact Addresses
CREATE INDEX IF NOT EXISTS idx_contact_addresses_contact_id ON contact_addresses(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_addresses_primary ON contact_addresses(is_primary);
CREATE INDEX IF NOT EXISTS idx_contact_addresses_country ON contact_addresses(country);

-- Contact Preferences
CREATE INDEX IF NOT EXISTS idx_contact_preferences_contact_id ON contact_preferences(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_preferences_language ON contact_preferences(language);
CREATE INDEX IF NOT EXISTS idx_contact_preferences_timezone ON contact_preferences(timezone);

-- Contact Logistics
CREATE INDEX IF NOT EXISTS idx_contact_logistics_contact_id ON contact_logistics(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_logistics_hub_id ON contact_logistics(hub_id);
CREATE INDEX IF NOT EXISTS idx_contact_logistics_max_value ON contact_logistics(max_value_clearance);
CREATE INDEX IF NOT EXISTS idx_contact_logistics_area_coverage ON contact_logistics USING GIN(area_coverage);

-- Shipment History
CREATE INDEX IF NOT EXISTS idx_contact_shipment_history_contact_id ON contact_shipment_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_shipment_history_shipment_id ON contact_shipment_history(shipment_id);
CREATE INDEX IF NOT EXISTS idx_contact_shipment_history_role ON contact_shipment_history(role_in_shipment);
CREATE INDEX IF NOT EXISTS idx_contact_shipment_history_created_at ON contact_shipment_history(created_at);

-- Versions
CREATE INDEX IF NOT EXISTS idx_contact_versions_contact_id ON contact_versions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_versions_version_number ON contact_versions(contact_id, version_number);
CREATE INDEX IF NOT EXISTS idx_contact_versions_created_at ON contact_versions(created_at);

-- Notes
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_type ON contact_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_contact_notes_priority ON contact_notes(priority);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON contact_notes(created_at);

-- Duplicates
CREATE INDEX IF NOT EXISTS idx_contact_duplicates_contact_1 ON contact_duplicates(contact_1_id);
CREATE INDEX IF NOT EXISTS idx_contact_duplicates_contact_2 ON contact_duplicates(contact_2_id);
CREATE INDEX IF NOT EXISTS idx_contact_duplicates_status ON contact_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_contact_duplicates_match_type ON contact_duplicates(match_type);

-- Events
CREATE INDEX IF NOT EXISTS idx_contact_events_type ON contact_events(event_type);
CREATE INDEX IF NOT EXISTS idx_contact_events_contact_id ON contact_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_created_at ON contact_events(created_at);

-- Telemetry
CREATE INDEX IF NOT EXISTS idx_contact_telemetry_metric_type ON contact_telemetry(metric_type);
CREATE INDEX IF NOT EXISTS idx_contact_telemetry_contact_id ON contact_telemetry(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_telemetry_created_at ON contact_telemetry(created_at);

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
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_addresses_updated_at BEFORE UPDATE ON contact_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_preferences_updated_at BEFORE UPDATE ON contact_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_logistics_updated_at BEFORE UPDATE ON contact_logistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update shipment count
CREATE OR REPLACE FUNCTION update_contact_shipment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE contacts 
        SET shipment_count = shipment_count + 1,
            last_used = NEW.created_at
        WHERE id = NEW.contact_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE contacts 
        SET shipment_count = GREATEST(0, shipment_count - 1)
        WHERE id = OLD.contact_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shipment_count_on_history_change 
    AFTER INSERT OR DELETE ON contact_shipment_history 
    FOR EACH ROW 
    EXECUTE FUNCTION update_contact_shipment_count();

-- Auto-create version on contact changes
CREATE OR REPLACE FUNCTION create_contact_version()
RETURNS TRIGGER AS $$
DECLARE
    version_num INTEGER;
    contact_json JSONB;
    changes_json JSONB;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO version_num 
    FROM contact_versions 
    WHERE contact_id = NEW.id;
    
    -- Build complete contact data
    SELECT to_jsonb(NEW.*) INTO contact_json;
    
    -- For updates, calculate changes
    IF TG_OP = 'UPDATE' THEN
        SELECT jsonb_build_object(
            'changed_fields', (
                SELECT jsonb_object_agg(key, value)
                FROM jsonb_each(to_jsonb(NEW.*))
                WHERE to_jsonb(OLD.*) ->> key IS DISTINCT FROM value::text
            ),
            'previous_values', (
                SELECT jsonb_object_agg(key, OLD_value.value)
                FROM jsonb_each(to_jsonb(NEW.*)) AS NEW_value(key, value)
                JOIN jsonb_each(to_jsonb(OLD.*)) AS OLD_value(key, value) USING (key)
                WHERE OLD_value.value::text IS DISTINCT FROM NEW_value.value::text
            )
        ) INTO changes_json;
    END IF;
    
    -- Insert version record
    INSERT INTO contact_versions (
        contact_id, version_number, action_type, contact_data, changes_made, changed_by
    ) VALUES (
        NEW.id, 
        version_num, 
        CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
        contact_json,
        changes_json,
        COALESCE(NEW.updated_by, 'system')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_contact_version_on_change 
    AFTER INSERT OR UPDATE ON contacts 
    FOR EACH ROW 
    EXECUTE FUNCTION create_contact_version();

-- ====================
-- SAMPLE DATA INTEGRATION
-- ====================

-- Migrate existing logistics_contacts to new contacts table
INSERT INTO contacts (
    logistics_contact_id, name, emails, phones, phones_original, role, 
    company, city, country, status, created_at, updated_at
)
SELECT 
    lc.id,
    lc.full_name,
    ARRAY[lc.email],
    ARRAY[lc.phone],
    ARRAY[COALESCE(lc.phone_original, lc.phone)],
    CASE 
        WHEN lc.contact_type = 'sender' THEN 'sender'
        WHEN lc.contact_type = 'buyer' THEN 'buyer'
        ELSE 'hub'
    END,
    '', -- company - not in logistics_contacts
    lc.city,
    lc.country,
    'active',
    lc.created_at,
    lc.updated_at
FROM logistics_contacts lc
WHERE NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.logistics_contact_id = lc.id
);

-- Create corresponding address records
INSERT INTO contact_addresses (
    contact_id, address_type, street_address, city, country, is_primary
)
SELECT 
    c.id,
    'primary',
    COALESCE(lc.street_address, 'Address not provided'),
    lc.city,
    lc.country,
    true
FROM contacts c
JOIN logistics_contacts lc ON c.logistics_contact_id = lc.id
WHERE lc.street_address IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM contact_addresses ca WHERE ca.contact_id = c.id
);

-- Create default preferences for migrated contacts
INSERT INTO contact_preferences (contact_id, preferred_communication, language, timezone)
SELECT 
    c.id,
    ARRAY['email'],
    'en',
    'UTC'
FROM contacts c
WHERE NOT EXISTS (
    SELECT 1 FROM contact_preferences cp WHERE cp.contact_id = c.id
);

-- Add some sample WG operators and hub contacts for testing
INSERT INTO contacts (
    name, emails, phones, phones_original, role, city, country, 
    kyc_status, tags, status
) VALUES
    ('Marcus Thompson', ARRAY['marcus.thompson@wg-nyc.com'], ARRAY['+12125551234'], ARRAY['(212) 555-1234'], 'wg', 'New York', 'United States', 'ok', ARRAY['premium', 'tier-3-certified'], 'active'),
    ('Elena Rodriguez', ARRAY['elena.rodriguez@wg-la.com'], ARRAY['+13105559876'], ARRAY['(310) 555-9876'], 'wg', 'Los Angeles', 'United States', 'ok', ARRAY['high-value', 'art-specialist'], 'active'),
    ('James Mitchell', ARRAY['james.mitchell@hub-london.aucta.com'], ARRAY['+442071234567'], ARRAY['+44 20 7123 4567'], 'hub', 'London', 'United Kingdom', 'n/a', ARRAY['hub-supervisor'], 'active'),
    ('Sarah Chen', ARRAY['sarah.chen@hub-zurich.aucta.com'], ARRAY['+41445551234'], ARRAY['+41 44 555 1234'], 'hub', 'Zurich', 'Switzerland', 'n/a', ARRAY['hub-manager', 'escalation'], 'active')
ON CONFLICT DO NOTHING;

-- Add WG logistics profiles for WG operators
INSERT INTO contact_logistics (
    contact_id, area_coverage, max_value_clearance, vehicle_type, 
    insurance_status, rating
)
SELECT 
    c.id,
    CASE 
        WHEN c.city = 'New York' THEN ARRAY['Manhattan', 'Brooklyn', 'Queens', 'Bronx']
        WHEN c.city = 'Los Angeles' THEN ARRAY['Los Angeles', 'Beverly Hills', 'Santa Monica', 'Pasadena']
        ELSE ARRAY[c.city]
    END,
    CASE 
        WHEN 'tier-3-certified' = ANY(c.tags) THEN 500000000 -- $5M in cents
        WHEN 'high-value' = ANY(c.tags) THEN 200000000 -- $2M in cents
        ELSE 100000000 -- $1M in cents
    END,
    'luxury_sedan',
    'active',
    4.95
FROM contacts c
WHERE c.role = 'wg'
AND NOT EXISTS (
    SELECT 1 FROM contact_logistics cl WHERE cl.contact_id = c.id
);

-- Add hub logistics profiles for hub contacts
INSERT INTO contact_logistics (
    contact_id, hub_id, department, escalation_level
)
SELECT 
    c.id,
    lh.id,
    CASE 
        WHEN 'hub-manager' = ANY(c.tags) THEN 'Operations Management'
        WHEN 'hub-supervisor' = ANY(c.tags) THEN 'Processing Supervision'
        ELSE 'General Operations'
    END,
    CASE 
        WHEN 'hub-manager' = ANY(c.tags) THEN 3
        WHEN 'hub-supervisor' = ANY(c.tags) THEN 2
        ELSE 1
    END
FROM contacts c
JOIN logistics_hubs lh ON (
    (c.city = 'London' AND lh.hub_code LIKE 'L%') OR
    (c.city = 'Zurich' AND lh.hub_code = 'ZUR01') OR
    (c.city = 'Paris' AND lh.hub_code = 'CDG01') OR
    (c.city = 'Frankfurt' AND lh.hub_code = 'FRA01')
)
WHERE c.role = 'hub'
AND NOT EXISTS (
    SELECT 1 FROM contact_logistics cl WHERE cl.contact_id = c.id
);

-- ====================
-- TABLE COMMENTS
-- ====================

COMMENT ON TABLE contacts IS 'Enhanced contact management system with KYC, versioning, and role-based features';
COMMENT ON TABLE contact_addresses IS 'Multiple addresses per contact with delivery preferences';
COMMENT ON TABLE contact_preferences IS 'Communication and operational preferences for contacts';
COMMENT ON TABLE contact_logistics IS 'Role-specific logistics information for WG operators and hub contacts';
COMMENT ON TABLE contact_shipment_history IS 'Links contacts to shipments with role and context';
COMMENT ON TABLE contact_versions IS 'Complete version history for all contact changes';
COMMENT ON TABLE contact_notes IS 'Internal notes and communications about contacts';
COMMENT ON TABLE contact_duplicates IS 'Potential duplicate contact relationships for deduplication';
COMMENT ON TABLE contact_events IS 'Business events for system integration and analytics';
COMMENT ON TABLE contact_telemetry IS 'Performance metrics and usage analytics';
