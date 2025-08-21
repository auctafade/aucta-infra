-- Sprint 8: Hub Management Enhancement Migration (Clean Version)
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

-- Clean up any existing fake/test data
DELETE FROM hub_pricing WHERE hub_id IN (
    SELECT id FROM hubs WHERE code IN ('PAR-Id-01', 'LON-Cou-01', 'NYC-Hub-01')
);

DELETE FROM hub_roles WHERE hub_id IN (
    SELECT id FROM hubs WHERE code IN ('PAR-Id-01', 'LON-Cou-01', 'NYC-Hub-01')
);

DELETE FROM capacity_profiles WHERE hub_id IN (
    SELECT id FROM hubs WHERE code IN ('PAR-Id-01', 'LON-Cou-01', 'NYC-Hub-01')
);

DELETE FROM hubs WHERE code IN ('PAR-Id-01', 'LON-Cou-01', 'NYC-Hub-01');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update timestamps
DROP TRIGGER IF EXISTS trigger_hub_roles_updated_at ON hub_roles;
CREATE TRIGGER trigger_hub_roles_updated_at
    BEFORE UPDATE ON hub_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_hub_pricing_updated_at ON hub_pricing;
CREATE TRIGGER trigger_hub_pricing_updated_at
    BEFORE UPDATE ON hub_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
