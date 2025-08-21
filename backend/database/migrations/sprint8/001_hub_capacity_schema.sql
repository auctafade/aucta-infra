-- Sprint 8: Hub Capacity & Logistics Management
-- Migration 001: Core Hub Capacity Tables

-- Hubs table - Physical logistics locations
CREATE TABLE IF NOT EXISTS hubs (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL, -- 'PAR', 'LON', etc.
    name VARCHAR(100) NOT NULL, -- 'Paris Hub', 'London Hub'
    location VARCHAR(255) NOT NULL, -- 'Paris, France'
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'maintenance', 'offline')),
    address JSONB, -- Full address details
    contact_info JSONB, -- Phone, email, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Capacity Profiles - Versioned capacity settings per hub
CREATE TABLE IF NOT EXISTS capacity_profiles (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id),
    version VARCHAR(20) NOT NULL, -- '2.1.0'
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (state IN ('draft', 'published', 'scheduled')),
    
    -- Core capacity numbers
    auth_capacity INTEGER NOT NULL DEFAULT 0,
    sewing_capacity INTEGER NOT NULL DEFAULT 0,
    qa_capacity INTEGER NOT NULL DEFAULT 0,
    
    -- QA staffing details
    qa_headcount INTEGER NOT NULL DEFAULT 0,
    qa_shift_minutes INTEGER NOT NULL DEFAULT 480, -- 8 hours
    
    -- Working schedule
    working_days TEXT[] NOT NULL DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday','saturday'],
    working_hours_start TIME NOT NULL DEFAULT '08:00',
    working_hours_end TIME NOT NULL DEFAULT '19:00',
    
    -- Policy settings
    overbooking_percent DECIMAL(5,2) NOT NULL DEFAULT 10.0 CHECK (overbooking_percent >= 0 AND overbooking_percent <= 30.0),
    rush_bucket_percent DECIMAL(5,2) NOT NULL DEFAULT 15.0 CHECK (rush_bucket_percent >= 0 AND rush_bucket_percent <= 20.0),
    back_to_back_cutoff TIME NOT NULL DEFAULT '17:00',
    
    -- Seasonality multipliers by month
    seasonality_multipliers JSONB NOT NULL DEFAULT '{
        "january": 1.2, "february": 1.0, "march": 1.1, "april": 1.0,
        "may": 0.9, "june": 0.8, "july": 0.7, "august": 0.8,
        "september": 1.0, "october": 1.1, "november": 1.3, "december": 1.4
    }',
    
    -- Audit fields
    last_edited_by VARCHAR(255) NOT NULL,
    last_edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one published profile per hub at a time
    UNIQUE (hub_id, version),
    CONSTRAINT one_published_per_hub EXCLUDE (hub_id WITH =) WHERE (state = 'published')
);

-- Blackout Rules - Holidays, maintenance, etc.
CREATE TABLE IF NOT EXISTS blackout_rules (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id),
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('recurring', 'one_time')),
    start_date DATE NOT NULL,
    end_date DATE,
    recurrence_rule TEXT, -- RRULE format for recurring events
    affected_lanes TEXT[] NOT NULL DEFAULT ARRAY['auth', 'sewing', 'qa'],
    reason TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance Windows - Scheduled downtime
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id),
    name VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slots_reduction INTEGER NOT NULL DEFAULT 0, -- How many slots this reduces
    affected_lanes TEXT[] NOT NULL DEFAULT ARRAY['auth', 'sewing', 'qa'],
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    approver VARCHAR(255) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Day Exceptions - One-off capacity adjustments
CREATE TABLE IF NOT EXISTS day_exceptions (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER NOT NULL REFERENCES hubs(id),
    exception_date DATE NOT NULL,
    lane VARCHAR(20) NOT NULL CHECK (lane IN ('auth', 'sewing', 'qa')),
    capacity_override INTEGER, -- Override base capacity for this day
    is_overtime BOOLEAN NOT NULL DEFAULT false,
    overtime_slots INTEGER DEFAULT 0,
    reason TEXT NOT NULL,
    approver VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (hub_id, exception_date, lane)
);

-- Shipment Reservations - Actual bookings and holds
CREATE TABLE IF NOT EXISTS shipment_reservations (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(50) NOT NULL, -- External shipment ID
    hub_id INTEGER NOT NULL REFERENCES hubs(id),
    reservation_date DATE NOT NULL,
    lane VARCHAR(20) NOT NULL CHECK (lane IN ('auth', 'sewing', 'qa')),
    slots_reserved INTEGER NOT NULL DEFAULT 1,
    tier VARCHAR(5) NOT NULL CHECK (tier IN ('T2', 'T3')),
    priority VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'priority')),
    reservation_type VARCHAR(20) NOT NULL CHECK (reservation_type IN ('hold', 'booking', 'in_progress')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'completed')),
    
    -- QA specific details
    qa_minutes_required INTEGER DEFAULT 0,
    estimated_qa_time INTEGER DEFAULT 0,
    
    -- Rush bucket usage
    is_rush BOOLEAN NOT NULL DEFAULT false,
    rush_reason TEXT,
    
    -- Audit trail
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE (shipment_id, hub_id, lane)
);

-- Capacity Events - Audit trail for all capacity changes
CREATE TABLE IF NOT EXISTS capacity_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    hub_id INTEGER REFERENCES hubs(id),
    entity_type VARCHAR(20), -- 'profile', 'blackout', 'maintenance', 'exception'
    entity_id INTEGER,
    event_data JSONB NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    approver_id VARCHAR(255),
    timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance telemetry
CREATE TABLE IF NOT EXISTS capacity_telemetry (
    id SERIAL PRIMARY KEY,
    hub_id INTEGER REFERENCES hubs(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    dimensions JSONB, -- Additional metadata
    timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_capacity_profiles_hub_state ON capacity_profiles(hub_id, state);
CREATE INDEX IF NOT EXISTS idx_capacity_profiles_effective_date ON capacity_profiles(effective_date);
CREATE INDEX IF NOT EXISTS idx_shipment_reservations_hub_date ON shipment_reservations(hub_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_shipment_reservations_shipment ON shipment_reservations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_blackout_rules_hub_active ON blackout_rules(hub_id, is_active);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_hub_date ON maintenance_windows(hub_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_day_exceptions_hub_date ON day_exceptions(hub_id, exception_date);
CREATE INDEX IF NOT EXISTS idx_capacity_events_type_time ON capacity_events(event_type, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_capacity_events_hub_time ON capacity_events(hub_id, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_capacity_telemetry_hub_metric ON capacity_telemetry(hub_id, metric_name, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_capacity_telemetry_time ON capacity_telemetry(timestamp_utc);

-- Insert default hubs
INSERT INTO hubs (code, name, location, timezone, status) VALUES 
    ('PAR', 'Paris Hub', 'Paris, France', 'Europe/Paris', 'active'),
    ('LON', 'London Hub', 'London, UK', 'Europe/London', 'active')
ON CONFLICT (code) DO NOTHING;

-- Insert default capacity profile for Paris
INSERT INTO capacity_profiles (
    hub_id, version, effective_date, state, 
    auth_capacity, sewing_capacity, qa_capacity, qa_headcount,
    last_edited_by, change_reason, created_by
) 
SELECT 
    h.id, '2.1.0', CURRENT_TIMESTAMP, 'published',
    45, 25, 30, 4,
    'system', 'Initial capacity profile', 'system'
FROM hubs h WHERE h.code = 'PAR'
ON CONFLICT (hub_id, version) DO NOTHING;

-- Insert default capacity profile for London  
INSERT INTO capacity_profiles (
    hub_id, version, effective_date, state,
    auth_capacity, sewing_capacity, qa_capacity, qa_headcount,
    last_edited_by, change_reason, created_by
) 
SELECT 
    h.id, '2.1.0', CURRENT_TIMESTAMP, 'published',
    35, 20, 25, 3,
    'system', 'Initial capacity profile', 'system'
FROM hubs h WHERE h.code = 'LON'
ON CONFLICT (hub_id, version) DO NOTHING;
