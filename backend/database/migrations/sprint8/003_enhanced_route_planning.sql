-- Migration 003: Enhanced Route Planning System
-- Adds tables for hub pricing, resource reservations, and manifest tracking

-- ========================================================================================
-- HUB PRICING & CONFIGURATION
-- ========================================================================================

-- Add pricing columns to logistics_hubs if they don't exist
ALTER TABLE logistics_hubs 
ADD COLUMN IF NOT EXISTS tier2_auth_fee DECIMAL(10,2) DEFAULT 75,
ADD COLUMN IF NOT EXISTS tier3_auth_fee DECIMAL(10,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS tier3_sew_fee DECIMAL(10,2) DEFAULT 150,
ADD COLUMN IF NOT EXISTS tag_unit_cost DECIMAL(10,2) DEFAULT 5,
ADD COLUMN IF NOT EXISTS nfc_unit_cost DECIMAL(10,2) DEFAULT 25,
ADD COLUMN IF NOT EXISTS qa_fee DECIMAL(10,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS internal_rollout_cost DECIMAL(10,2) DEFAULT 25,
ADD COLUMN IF NOT EXISTS has_sewing_capability BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS operating_hours VARCHAR(20) DEFAULT '08:00-20:00',
ADD COLUMN IF NOT EXISTS time_zone VARCHAR(50) DEFAULT 'Europe/London',
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- ========================================================================================
-- HUB RESOURCE RESERVATIONS
-- ========================================================================================

CREATE TABLE IF NOT EXISTS hub_resource_reservations (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(100) NOT NULL,
    hub_id INTEGER REFERENCES logistics_hubs(id),
    reservation_type VARCHAR(50) NOT NULL, -- 'route_planning', 'tier_gate', 'manual'
    reservation_date DATE NOT NULL,
    resources JSONB NOT NULL, -- Array of reserved resources
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'expired', 'cancelled', 'consumed'
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    cancelled_at TIMESTAMP,
    cancelled_by VARCHAR(100),
    consumed_at TIMESTAMP,
    consumed_by VARCHAR(100)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_hub_reservations_shipment ON hub_resource_reservations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_hub_reservations_hub ON hub_resource_reservations(hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_reservations_status ON hub_resource_reservations(status);
CREATE INDEX IF NOT EXISTS idx_hub_reservations_expires ON hub_resource_reservations(expires_at);

-- ========================================================================================
-- ROUTE MANIFEST TRACKING
-- ========================================================================================

CREATE TABLE IF NOT EXISTS route_manifest_logs (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id),
    manifest_id VARCHAR(100) UNIQUE NOT NULL,
    route_type VARCHAR(50) NOT NULL,
    pdf_path TEXT,
    html_path TEXT,
    qr_code TEXT,
    generated_by VARCHAR(100) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    last_accessed_by VARCHAR(100)
);

-- Index for manifest lookups
CREATE INDEX IF NOT EXISTS idx_manifest_shipment ON route_manifest_logs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_manifest_id ON route_manifest_logs(manifest_id);

-- ========================================================================================
-- EXTERNAL API CACHE
-- ========================================================================================

CREATE TABLE IF NOT EXISTS external_api_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    api_source VARCHAR(50) NOT NULL, -- 'amadeus', 'dhl', 'uber', etc.
    cache_type VARCHAR(50) NOT NULL, -- 'flight', 'ground', 'dhl_rate', 'currency'
    cached_data JSONB NOT NULL,
    ttl_seconds INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_hit_at TIMESTAMP
);

-- Indexes for cache management
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON external_api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON external_api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_cache_source ON external_api_cache(api_source);

-- ========================================================================================
-- ROUTE SELECTION AUDIT
-- ========================================================================================

CREATE TABLE IF NOT EXISTS route_selection_audit (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id),
    route_plan_id INTEGER REFERENCES shipment_route_plans(id),
    selected_by VARCHAR(100) NOT NULL,
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    selection_reason TEXT,
    admin_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    
    -- Options presented
    options_presented JSONB NOT NULL, -- All route options shown
    options_count INTEGER NOT NULL,
    
    -- Decision factors
    time_weight DECIMAL(5,2),
    cost_weight DECIMAL(5,2),
    risk_weight DECIMAL(5,2),
    
    -- Client preferences
    client_currency VARCHAR(3) DEFAULT 'EUR',
    client_timezone VARCHAR(50),
    
    -- Session info
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_route_audit_shipment ON route_selection_audit(shipment_id);
CREATE INDEX IF NOT EXISTS idx_route_audit_selected_at ON route_selection_audit(selected_at);
CREATE INDEX IF NOT EXISTS idx_route_audit_session ON route_selection_audit(session_id);

-- ========================================================================================
-- HUB INVENTORY TRACKING
-- ========================================================================================

CREATE TABLE IF NOT EXISTS hub_inventory (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER REFERENCES logistics_hubs(id) UNIQUE,
    nfc_stock INTEGER DEFAULT 0,
    nfc_reserved INTEGER DEFAULT 0,
    nfc_minimum_level INTEGER DEFAULT 10,
    tag_stock INTEGER DEFAULT 0,
    tag_reserved INTEGER DEFAULT 0,
    tag_minimum_level INTEGER DEFAULT 20,
    last_restocked_at TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT nfc_stock_check CHECK (nfc_stock >= nfc_reserved),
    CONSTRAINT tag_stock_check CHECK (tag_stock >= tag_reserved)
);

-- ========================================================================================
-- HUB DAILY CAPACITY
-- ========================================================================================

CREATE TABLE IF NOT EXISTS hub_daily_capacity (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER REFERENCES logistics_hubs(id),
    capacity_date DATE NOT NULL,
    
    -- Authentication capacity
    auth_capacity_total INTEGER DEFAULT 50,
    auth_capacity_available INTEGER DEFAULT 50,
    auth_capacity_reserved INTEGER DEFAULT 0,
    
    -- Sewing capacity
    sewing_capacity_total INTEGER DEFAULT 20,
    sewing_capacity_available INTEGER DEFAULT 20,
    sewing_capacity_reserved INTEGER DEFAULT 0,
    
    -- Status
    is_holiday BOOLEAN DEFAULT FALSE,
    is_maintenance BOOLEAN DEFAULT FALSE,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hub_id, capacity_date),
    CONSTRAINT auth_capacity_check CHECK (auth_capacity_available >= 0),
    CONSTRAINT sewing_capacity_check CHECK (sewing_capacity_available >= 0)
);

-- Index for capacity queries
CREATE INDEX IF NOT EXISTS idx_hub_capacity_date ON hub_daily_capacity(capacity_date);
CREATE INDEX IF NOT EXISTS idx_hub_capacity_hub ON hub_daily_capacity(hub_id);

-- ========================================================================================
-- SAMPLE DATA FOR TESTING
-- ========================================================================================

-- Add hub_id column for compatibility
ALTER TABLE logistics_hubs 
ADD COLUMN IF NOT EXISTS hub_id VARCHAR(50);

-- Update existing hubs with hub_id based on hub_code (only if hub_id is null)
UPDATE logistics_hubs 
SET hub_id = 'HUB-' || UPPER(LEFT(country, 3)) || '-' || hub_code
WHERE hub_id IS NULL;

-- Add unique constraint on hub_id (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'logistics_hubs_hub_id_unique'
    ) THEN
        ALTER TABLE logistics_hubs 
        ADD CONSTRAINT logistics_hubs_hub_id_unique UNIQUE (hub_id);
    END IF;
END $$;

-- Insert sample hub pricing data (updating existing hubs)
UPDATE logistics_hubs SET
    tier2_auth_fee = 75, tier3_auth_fee = 100, tier3_sew_fee = 150,
    tag_unit_cost = 5, nfc_unit_cost = 25, qa_fee = 50,
    internal_rollout_cost = 25, has_sewing_capability = true,
    operating_hours = '08:00-20:00', time_zone = 'Europe/London',
    hub_id = 'HUB-UNI-LON1'
WHERE hub_code = 'LON1' OR city = 'London';

-- Insert additional sample hubs if they don't exist
INSERT INTO logistics_hubs (
    hub_code, hub_name, city, country, address,
    tier2_auth_fee, tier3_auth_fee, tier3_sew_fee,
    tag_unit_cost, nfc_unit_cost, qa_fee,
    internal_rollout_cost, has_sewing_capability,
    operating_hours, time_zone, hub_id
) VALUES 
    ('PAR1', 'Paris Hub 1', 'Paris', 'France', '456 Rue de Rivoli, Paris',
     70, 95, 140, 5, 25, 45, 30, true, '09:00-19:00', 'Europe/Paris', 'HUB-FRA-PAR1'),
    ('MIL1', 'Milan Hub 1', 'Milan', 'Italy', '789 Via Montenapoleone, Milan',
     65, 90, 160, 4, 22, 55, 20, true, '08:30-18:30', 'Europe/Rome', 'HUB-ITA-MIL1')
ON CONFLICT (hub_code) DO UPDATE SET
    tier2_auth_fee = EXCLUDED.tier2_auth_fee,
    tier3_auth_fee = EXCLUDED.tier3_auth_fee,
    tier3_sew_fee = EXCLUDED.tier3_sew_fee,
    tag_unit_cost = EXCLUDED.tag_unit_cost,
    nfc_unit_cost = EXCLUDED.nfc_unit_cost;

-- Insert sample inventory data
INSERT INTO hub_inventory (hub_id, nfc_stock, tag_stock, nfc_minimum_level, tag_minimum_level)
SELECT id, 100, 200, 10, 20 FROM logistics_hubs
ON CONFLICT (hub_id) DO NOTHING;

-- Insert sample capacity for next 30 days
INSERT INTO hub_daily_capacity (hub_id, capacity_date, auth_capacity_total, auth_capacity_available, sewing_capacity_total, sewing_capacity_available)
SELECT 
    h.id,
    generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day')::date,
    50, 50, 20, 20
FROM logistics_hubs h
ON CONFLICT (hub_id, capacity_date) DO NOTHING;

-- ========================================================================================
-- FUNCTIONS & TRIGGERS
-- ========================================================================================

-- Function to automatically expire reservations
CREATE OR REPLACE FUNCTION expire_hub_reservations() RETURNS void AS $$
BEGIN
    UPDATE hub_resource_reservations
    SET status = 'expired'
    WHERE status = 'active' 
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache() RETURNS void AS $$
BEGIN
    DELETE FROM external_api_cache
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update hub capacity when reservation is made
CREATE OR REPLACE FUNCTION update_hub_capacity_on_reservation() RETURNS TRIGGER AS $$
DECLARE
    resource JSONB;
BEGIN
    IF NEW.status = 'active' THEN
        -- Process each resource in the reservation
        FOR resource IN SELECT * FROM jsonb_array_elements(NEW.resources)
        LOOP
            IF resource->>'type' = 'authentication' THEN
                UPDATE hub_daily_capacity
                SET auth_capacity_available = auth_capacity_available - 1,
                    auth_capacity_reserved = auth_capacity_reserved + 1
                WHERE hub_id = NEW.hub_id 
                AND capacity_date = NEW.reservation_date::date
                AND auth_capacity_available > 0;
            ELSIF resource->>'type' = 'sewing' THEN
                UPDATE hub_daily_capacity
                SET sewing_capacity_available = sewing_capacity_available - 1,
                    sewing_capacity_reserved = sewing_capacity_reserved + 1
                WHERE hub_id = NEW.hub_id 
                AND capacity_date = NEW.reservation_date::date
                AND sewing_capacity_available > 0;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_capacity_on_reservation
AFTER INSERT ON hub_resource_reservations
FOR EACH ROW EXECUTE FUNCTION update_hub_capacity_on_reservation();

-- Trigger to release capacity when reservation is cancelled/expired
CREATE OR REPLACE FUNCTION release_hub_capacity_on_cancellation() RETURNS TRIGGER AS $$
DECLARE
    resource JSONB;
BEGIN
    IF OLD.status = 'active' AND NEW.status IN ('cancelled', 'expired') THEN
        -- Release each resource
        FOR resource IN SELECT * FROM jsonb_array_elements(OLD.resources)
        LOOP
            IF resource->>'type' = 'authentication' THEN
                UPDATE hub_daily_capacity
                SET auth_capacity_available = auth_capacity_available + 1,
                    auth_capacity_reserved = auth_capacity_reserved - 1
                WHERE hub_id = OLD.hub_id 
                AND capacity_date = OLD.reservation_date::date;
            ELSIF resource->>'type' = 'sewing' THEN
                UPDATE hub_daily_capacity
                SET sewing_capacity_available = sewing_capacity_available + 1,
                    sewing_capacity_reserved = sewing_capacity_reserved - 1
                WHERE hub_id = OLD.hub_id 
                AND capacity_date = OLD.reservation_date::date;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_release_capacity_on_cancellation
AFTER UPDATE ON hub_resource_reservations
FOR EACH ROW EXECUTE FUNCTION release_hub_capacity_on_cancellation();

-- ========================================================================================
-- GRANTS
-- ========================================================================================

-- Grant appropriate permissions (adjust based on your user setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
