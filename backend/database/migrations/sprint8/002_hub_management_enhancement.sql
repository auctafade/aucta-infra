-- Sprint 8: Hub Management Enhancement Migration
-- Migration 002: Enhanced Hub Management Tables

-- Hub Roles table - Track hub capabilities (authenticator, couturier, or both)
CREATE TABLE IF NOT EXISTS hub_roles (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('authenticator', 'couturier')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hub_id, role_type)
);

-- Hub Pricing table - Store pricing information per hub
CREATE TABLE IF NOT EXISTS hub_pricing (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    
    -- Tier 2 Pricing (Authenticator)
    tier2_auth_fee DECIMAL(10,2) DEFAULT 0,
    tag_unit_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Tier 3 Pricing (Authenticator + Couturier)
    tier3_auth_fee DECIMAL(10,2) DEFAULT 0,
    nfc_unit_cost DECIMAL(10,2) DEFAULT 0,
    sew_fee DECIMAL(10,2) DEFAULT 0,
    qa_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Internal costs
    internal_rollout_cost DECIMAL(10,2) DEFAULT 0, -- per shipment for HubId → HubCou leg
    
    -- Special requests and surcharges
    special_surcharges JSONB DEFAULT '{}', -- {"rush_percent": 25, "fragile_fee": 15, "weekend_fee": 50}
    
    -- Currency and metadata
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP WITH TIME ZONE NULL,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one active pricing per hub
    UNIQUE(hub_id)
);

-- Hub Audit Log - Track all changes to hubs
CREATE TABLE IF NOT EXISTS hub_audit_log (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'archived', 'pricing_changed'
    actor_id VARCHAR(255) NOT NULL, -- user ID or 'system'
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hub Attachments - Store photos, documents for hubs
CREATE TABLE IF NOT EXISTS hub_attachments (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    attachment_type VARCHAR(50) NOT NULL, -- 'photo', 'document', 'door_instructions'
    description TEXT,
    uploaded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hub_roles_hub_id ON hub_roles(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_roles_active ON hub_roles(hub_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hub_pricing_hub_id ON hub_pricing(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_audit_hub_id ON hub_audit_log(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_audit_created_at ON hub_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_hub_attachments_hub_id ON hub_attachments(hub_id);

-- Insert sample data for testing
INSERT INTO hubs (code, name, location, timezone, status, address, contact_info) VALUES
(
    'PAR-Id-01',
    'Paris Authenticator Hub',
    'Paris, France',
    'Europe/Paris',
    'active',
    '{"street": "45 Rue de Rivoli", "city": "Paris", "postal_code": "75001", "country": "France", "coordinates": {"lat": 48.8566, "lng": 2.3522}}',
    '{"name": "Marie Dubois", "email": "marie.dubois@aucta.com", "phone": "+33 1 42 60 30 30"}'
),
(
    'LON-Cou-01',
    'London Couturier Hub',
    'London, United Kingdom',
    'Europe/London',
    'active',
    '{"street": "123 Savile Row", "city": "London", "postal_code": "W1S 3PJ", "country": "United Kingdom", "coordinates": {"lat": 51.5074, "lng": -0.1278}}',
    '{"name": "James Wilson", "email": "james.wilson@aucta.com", "phone": "+44 20 7946 0958"}'
),
(
    'NYC-Hub-01',
    'New York Hybrid Hub',
    'New York, United States',
    'America/New_York',
    'active',
    '{"street": "350 Fifth Avenue", "city": "New York", "postal_code": "10118", "country": "United States", "coordinates": {"lat": 40.7484, "lng": -73.9857}}',
    '{"name": "Sarah Johnson", "email": "sarah.johnson@aucta.com", "phone": "+1 212 555 0123"}'
)
ON CONFLICT (code) DO NOTHING;

-- Insert roles for sample hubs
INSERT INTO hub_roles (hub_id, role_type, is_active) VALUES
((SELECT id FROM hubs WHERE code = 'PAR-Id-01'), 'authenticator', true),
((SELECT id FROM hubs WHERE code = 'LON-Cou-01'), 'couturier', true),
((SELECT id FROM hubs WHERE code = 'NYC-Hub-01'), 'authenticator', true),
((SELECT id FROM hubs WHERE code = 'NYC-Hub-01'), 'couturier', true)
ON CONFLICT (hub_id, role_type) DO NOTHING;

-- Insert sample pricing
INSERT INTO hub_pricing (hub_id, tier2_auth_fee, tag_unit_cost, tier3_auth_fee, nfc_unit_cost, sew_fee, qa_fee, internal_rollout_cost, currency, special_surcharges) VALUES
(
    (SELECT id FROM hubs WHERE code = 'PAR-Id-01'),
    150.00, 12.50, 175.00, 25.00, 0, 0, 35.00, 'EUR',
    '{"rush_percent": 25, "fragile_fee": 15, "weekend_fee": 50}'
),
(
    (SELECT id FROM hubs WHERE code = 'LON-Cou-01'),
    0, 0, 200.00, 30.00, 125.00, 75.00, 40.00, 'GBP',
    '{"rush_percent": 30, "fragile_fee": 20, "weekend_fee": 60}'
),
(
    (SELECT id FROM hubs WHERE code = 'NYC-Hub-01'),
    175.00, 15.00, 225.00, 35.00, 150.00, 85.00, 45.00, 'USD',
    '{"rush_percent": 25, "fragile_fee": 25, "weekend_fee": 75}'
)
ON CONFLICT (hub_id) DO NOTHING;

-- Insert sample capacity profiles for hubs
INSERT INTO capacity_profiles (
    hub_id, version, effective_date, state, auth_capacity, sewing_capacity, 
    qa_capacity, qa_headcount, last_edited_by, change_reason, created_by
) VALUES
(
    (SELECT id FROM hubs WHERE code = 'PAR-Id-01'),
    '1.0.0', CURRENT_TIMESTAMP, 'published', 50, 0, 0, 0, 'system', 'Initial setup', 'system'
),
(
    (SELECT id FROM hubs WHERE code = 'LON-Cou-01'),
    '1.0.0', CURRENT_TIMESTAMP, 'published', 0, 30, 15, 3, 'system', 'Initial setup', 'system'
),
(
    (SELECT id FROM hubs WHERE code = 'NYC-Hub-01'),
    '1.0.0', CURRENT_TIMESTAMP, 'published', 75, 45, 25, 5, 'system', 'Initial setup', 'system'
)
ON CONFLICT DO NOTHING;
