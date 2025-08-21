-- Migration 001: Comprehensive Logistics System Database Schema
-- This migration creates all tables needed for the advanced shipment management system

-- Create logistics_contacts table for sender/buyer contact information
CREATE TABLE IF NOT EXISTS logistics_contacts (
    id SERIAL PRIMARY KEY,
    contact_id VARCHAR(50) UNIQUE, -- Optional external contact ID
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL, -- E.164 format
    phone_original VARCHAR(50), -- Original format for display
    street_address TEXT,
    city VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    contact_type VARCHAR(20) DEFAULT 'general', -- 'sender', 'buyer', 'general'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Add indexes for performance
    CONSTRAINT chk_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

-- Create time_windows table for pickup/delivery scheduling
CREATE TABLE IF NOT EXISTS time_windows (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES logistics_contacts(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_date DATE NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    access_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shipments table for main shipment data
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(50) UNIQUE NOT NULL, -- External shipment reference
    reference_sku VARCHAR(100) NOT NULL,
    declared_value DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    weight DECIMAL(8,3) NOT NULL,
    weight_unit VARCHAR(2) DEFAULT 'kg',
    length_cm DECIMAL(6,2) NOT NULL,
    width_cm DECIMAL(6,2) NOT NULL,
    height_cm DECIMAL(6,2) NOT NULL,
    fragility_level INTEGER CHECK (fragility_level BETWEEN 1 AND 5) DEFAULT 3,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    hs_code VARCHAR(20),
    
    -- Participants
    sender_id INTEGER REFERENCES logistics_contacts(id),
    buyer_id INTEGER REFERENCES logistics_contacts(id),
    
    -- Logistics preferences
    urgency_level VARCHAR(20) DEFAULT 'standard', -- 'standard', 'expedited', 'express'
    preferred_transport VARCHAR(30) DEFAULT 'no-preference', -- 'no-preference', 'air-only', 'ground-only', 'express-only'
    security_notes TEXT,
    
    -- Special conditions
    high_value BOOLEAN DEFAULT FALSE,
    temperature_sensitive BOOLEAN DEFAULT FALSE,
    photo_proof_required BOOLEAN DEFAULT TRUE,
    
    -- Status and tracking
    status VARCHAR(30) DEFAULT 'draft', -- 'draft', 'classified', 'planned', 'in-transit', 'delivered', 'cancelled'
    tier VARCHAR(20), -- Will be assigned during classification: 'standard', 'premium', 'platinum'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT chk_urgency_level CHECK (urgency_level IN ('standard', 'expedited', 'express')),
    CONSTRAINT chk_preferred_transport CHECK (preferred_transport IN ('no-preference', 'air-only', 'ground-only', 'express-only')),
    CONSTRAINT chk_status CHECK (status IN ('draft', 'classified', 'planned', 'in-transit', 'delivered', 'cancelled')),
    CONSTRAINT chk_tier CHECK (tier IN ('standard', 'premium', 'platinum'))
);

-- Create shipment_documents table for file attachments
CREATE TABLE IF NOT EXISTS shipment_documents (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) DEFAULT 'general', -- 'photo', 'invoice', 'certificate', 'general'
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100) DEFAULT 'system'
);

-- Create shipment_tracking table for status updates
CREATE TABLE IF NOT EXISTS shipment_tracking (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    location VARCHAR(255),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT 'system',
    metadata JSONB DEFAULT '{}'
);

-- Create logistics_hubs table for hub management
CREATE TABLE IF NOT EXISTS logistics_hubs (
    id SERIAL PRIMARY KEY,
    hub_code VARCHAR(10) UNIQUE NOT NULL,
    hub_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    capacity_max INTEGER DEFAULT 1000,
    capacity_current INTEGER DEFAULT 0,
    hub_type VARCHAR(20) DEFAULT 'regional', -- 'regional', 'international', 'specialty'
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Create shipment_routes table for routing and planning
CREATE TABLE IF NOT EXISTS shipment_routes (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    route_step INTEGER NOT NULL,
    hub_id INTEGER REFERENCES logistics_hubs(id),
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    estimated_departure TIMESTAMP,
    actual_departure TIMESTAMP,
    transport_method VARCHAR(50), -- 'air', 'ground', 'express'
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create logistics_pricing table for tier-based pricing
CREATE TABLE IF NOT EXISTS logistics_pricing (
    id SERIAL PRIMARY KEY,
    tier VARCHAR(20) NOT NULL,
    urgency_level VARCHAR(20) NOT NULL,
    weight_range_min DECIMAL(8,3) NOT NULL,
    weight_range_max DECIMAL(8,3) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    price_per_kg DECIMAL(8,2) NOT NULL,
    high_value_surcharge_percent DECIMAL(5,2) DEFAULT 0,
    temperature_surcharge DECIMAL(8,2) DEFAULT 0,
    photo_proof_surcharge DECIMAL(8,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_until DATE,
    active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT chk_pricing_tier CHECK (tier IN ('standard', 'premium', 'platinum')),
    CONSTRAINT chk_pricing_urgency CHECK (urgency_level IN ('standard', 'expedited', 'express'))
);

-- Create edge_case_warnings table for tracking edge cases
CREATE TABLE IF NOT EXISTS edge_case_warnings (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    warning_type VARCHAR(50) NOT NULL, -- 'duplicate_reference', 'large_files', 'phone_format', 'partial_address', 'timezone_mismatch'
    warning_details JSONB NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_logistics_contacts_email ON logistics_contacts(email);
CREATE INDEX IF NOT EXISTS idx_logistics_contacts_phone ON logistics_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_logistics_contacts_country ON logistics_contacts(country);
CREATE INDEX IF NOT EXISTS idx_logistics_contacts_type ON logistics_contacts(contact_type);

CREATE INDEX IF NOT EXISTS idx_shipments_shipment_id ON shipments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_reference_sku ON shipments(reference_sku);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_tier ON shipments(tier);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at);
CREATE INDEX IF NOT EXISTS idx_shipments_sender_id ON shipments(sender_id);
CREATE INDEX IF NOT EXISTS idx_shipments_buyer_id ON shipments(buyer_id);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_shipment_id ON shipment_tracking(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_status ON shipment_tracking(status);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_timestamp ON shipment_tracking(timestamp);

CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment_id ON shipment_documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_type ON shipment_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_logistics_hubs_hub_code ON logistics_hubs(hub_code);
CREATE INDEX IF NOT EXISTS idx_logistics_hubs_country ON logistics_hubs(country);
CREATE INDEX IF NOT EXISTS idx_logistics_hubs_active ON logistics_hubs(active);

CREATE INDEX IF NOT EXISTS idx_shipment_routes_shipment_id ON shipment_routes(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_routes_hub_id ON shipment_routes(hub_id);

CREATE INDEX IF NOT EXISTS idx_logistics_pricing_tier_urgency ON logistics_pricing(tier, urgency_level);
CREATE INDEX IF NOT EXISTS idx_logistics_pricing_active ON logistics_pricing(active);

CREATE INDEX IF NOT EXISTS idx_edge_case_warnings_shipment_id ON edge_case_warnings(shipment_id);
CREATE INDEX IF NOT EXISTS idx_edge_case_warnings_type ON edge_case_warnings(warning_type);

-- Add table comments for documentation
COMMENT ON TABLE logistics_contacts IS 'Stores contact information for senders and buyers in shipments';
COMMENT ON TABLE time_windows IS 'Stores pickup and delivery time windows for contacts';
COMMENT ON TABLE shipments IS 'Main table for shipment data and logistics preferences';
COMMENT ON TABLE shipment_documents IS 'Stores file attachments for shipments';
COMMENT ON TABLE shipment_tracking IS 'Tracks status updates and location changes for shipments';
COMMENT ON TABLE logistics_hubs IS 'Manages logistics hub information and capacity';
COMMENT ON TABLE shipment_routes IS 'Plans and tracks shipment routing through hubs';
COMMENT ON TABLE logistics_pricing IS 'Tier-based pricing configuration for different service levels';
COMMENT ON TABLE edge_case_warnings IS 'Tracks edge cases and warnings detected during shipment creation';

-- Insert sample logistics hubs
INSERT INTO logistics_hubs (hub_code, hub_name, address, city, country, capacity_max, hub_type) VALUES
    ('LHR01', 'London Heathrow Hub', 'Heathrow Airport, Terminal 4', 'London', 'United Kingdom', 2000, 'international'),
    ('CDG01', 'Paris Charles de Gaulle Hub', 'CDG Airport, Terminal 2E', 'Paris', 'France', 1800, 'international'),
    ('FRA01', 'Frankfurt Main Hub', 'Frankfurt Airport, Cargo City', 'Frankfurt', 'Germany', 2500, 'international'),
    ('NYC01', 'New York JFK Hub', 'JFK Airport, Building 14', 'New York', 'United States', 2200, 'international'),
    ('LON02', 'London Regional Hub', '45 Canary Wharf', 'London', 'United Kingdom', 1500, 'regional'),
    ('MIL01', 'Milan Malpensa Hub', 'Malpensa Airport, Cargo Terminal', 'Milan', 'Italy', 1600, 'international'),
    ('ZUR01', 'Zurich Specialty Hub', 'Zurich Airport, High Value Center', 'Zurich', 'Switzerland', 800, 'specialty')
ON CONFLICT (hub_code) DO NOTHING;

-- Insert sample pricing tiers
INSERT INTO logistics_pricing (tier, urgency_level, weight_range_min, weight_range_max, base_price, price_per_kg, high_value_surcharge_percent, temperature_surcharge, photo_proof_surcharge) VALUES
    -- Standard Tier
    ('standard', 'standard', 0.0, 1.0, 25.00, 15.00, 2.5, 10.00, 5.00),
    ('standard', 'standard', 1.0, 5.0, 35.00, 12.00, 2.5, 10.00, 5.00),
    ('standard', 'standard', 5.0, 20.0, 50.00, 8.00, 2.5, 15.00, 5.00),
    ('standard', 'expedited', 0.0, 1.0, 45.00, 25.00, 3.0, 15.00, 5.00),
    ('standard', 'expedited', 1.0, 5.0, 55.00, 20.00, 3.0, 15.00, 5.00),
    ('standard', 'express', 0.0, 1.0, 85.00, 45.00, 3.5, 20.00, 10.00),
    
    -- Premium Tier
    ('premium', 'standard', 0.0, 1.0, 45.00, 25.00, 2.0, 5.00, 3.00),
    ('premium', 'standard', 1.0, 5.0, 55.00, 20.00, 2.0, 5.00, 3.00),
    ('premium', 'standard', 5.0, 20.0, 75.00, 15.00, 2.0, 8.00, 3.00),
    ('premium', 'expedited', 0.0, 1.0, 75.00, 35.00, 2.5, 8.00, 3.00),
    ('premium', 'expedited', 1.0, 5.0, 85.00, 30.00, 2.5, 8.00, 3.00),
    ('premium', 'express', 0.0, 1.0, 125.00, 55.00, 3.0, 12.00, 5.00),
    
    -- Platinum Tier  
    ('platinum', 'standard', 0.0, 1.0, 85.00, 45.00, 1.5, 0.00, 0.00),
    ('platinum', 'standard', 1.0, 5.0, 95.00, 40.00, 1.5, 0.00, 0.00),
    ('platinum', 'standard', 5.0, 20.0, 125.00, 30.00, 1.5, 0.00, 0.00),
    ('platinum', 'expedited', 0.0, 1.0, 145.00, 65.00, 2.0, 0.00, 0.00),
    ('platinum', 'expedited', 1.0, 5.0, 165.00, 55.00, 2.0, 0.00, 0.00),
    ('platinum', 'express', 0.0, 1.0, 225.00, 85.00, 2.5, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_logistics_contacts_updated_at BEFORE UPDATE ON logistics_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for automatic shipment tracking entry on status change
CREATE OR REPLACE FUNCTION track_shipment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if status actually changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO shipment_tracking (shipment_id, status, notes, updated_by)
        VALUES (NEW.id, NEW.status, 'Status updated automatically', 'system');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_shipment_status_updates 
    AFTER UPDATE ON shipments 
    FOR EACH ROW 
    EXECUTE FUNCTION track_shipment_status_change();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO logistics_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO logistics_user;
