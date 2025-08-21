-- Database schema for route selection operational workflow

-- Table for storing provisional route legs with frozen pricing
CREATE TABLE IF NOT EXISTS shipment_route_legs (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,
  leg_type VARCHAR(50) NOT NULL, -- 'white-glove', 'dhl', 'internal-rollout'
  carrier VARCHAR(100),
  
  -- Location details
  from_location TEXT,
  to_location TEXT,
  from_type VARCHAR(50), -- 'seller', 'hub', 'buyer'
  to_type VARCHAR(50),
  
  -- Frozen pricing from selection
  frozen_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Timing details
  planned_departure TIMESTAMP WITH TIME ZONE,
  planned_arrival TIMESTAMP WITH TIME ZONE,
  provisional_eta TIMESTAMP WITH TIME ZONE,
  
  -- Operational details
  processing JSONB, -- Processing steps at this leg
  buffer_time DECIMAL(4,2) DEFAULT 0, -- Buffer time in hours
  distance DECIMAL(8,2) DEFAULT 0, -- Distance in km
  duration DECIMAL(6,2) DEFAULT 0, -- Duration in hours
  hub_code VARCHAR(20),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'confirmed', 'in-transit', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for hub slot reservations
CREATE TABLE IF NOT EXISTS hub_slot_reservations (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  hub_id VARCHAR(50) NOT NULL,
  hub_code VARCHAR(20) NOT NULL,
  service_type VARCHAR(50) NOT NULL, -- 'authentication', 'sewing', 'qa'
  tier INTEGER NOT NULL,
  
  -- Timing
  planned_start_time TIMESTAMP WITH TIME ZONE,
  planned_end_time TIMESTAMP WITH TIME ZONE,
  duration DECIMAL(4,2) NOT NULL, -- Duration in hours
  
  -- Pricing
  frozen_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Capacity allocation
  capacity_units DECIMAL(4,2) NOT NULL DEFAULT 1,
  priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'reserved', -- 'reserved', 'confirmed', 'in-progress', 'completed', 'cancelled'
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Reservation expiry
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for inventory holds (Tag/NFC units)
CREATE TABLE IF NOT EXISTS inventory_holds (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  hub_id VARCHAR(50) NOT NULL,
  hub_code VARCHAR(20) NOT NULL,
  item_type VARCHAR(20) NOT NULL, -- 'tag', 'nfc'
  quantity INTEGER NOT NULL DEFAULT 1,
  tier INTEGER NOT NULL,
  
  -- Pricing
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Inventory tracking
  batch_number VARCHAR(50),
  serial_numbers JSONB, -- Array of serial numbers if applicable
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'held', -- 'held', 'allocated', 'consumed', 'released'
  held_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  allocated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Hold expiry
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for selected route plans with complete operational data
CREATE TABLE IF NOT EXISTS selected_route_plans (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  route_id VARCHAR(100) NOT NULL,
  route_label VARCHAR(200) NOT NULL,
  route_type VARCHAR(50) NOT NULL, -- 'white-glove', 'dhl', 'hybrid', 'mixed'
  tier INTEGER NOT NULL,
  
  -- Frozen pricing
  total_cost DECIMAL(12,2) NOT NULL,
  client_price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Timing
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  total_hours DECIMAL(6,2),
  
  -- Hub assignments
  hub_id VARCHAR(50),
  hub_cou VARCHAR(50),
  
  -- Operational references
  provisional_leg_ids JSONB, -- Array of leg IDs
  hub_reservation_ids JSONB, -- Array of reservation IDs
  inventory_hold_ids JSONB, -- Array of hold IDs
  
  -- Selection tracking
  is_selected BOOLEAN DEFAULT TRUE,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  selected_by VARCHAR(100),
  frozen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(shipment_id) -- Only one selected route per shipment
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_legs_shipment ON shipment_route_legs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_route_legs_status ON shipment_route_legs(status);
CREATE INDEX IF NOT EXISTS idx_hub_reservations_shipment ON hub_slot_reservations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_hub_reservations_hub ON hub_slot_reservations(hub_id, service_type);
CREATE INDEX IF NOT EXISTS idx_hub_reservations_timing ON hub_slot_reservations(planned_start_time, planned_end_time);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_shipment ON inventory_holds(shipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_hub ON inventory_holds(hub_id, item_type);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_status ON inventory_holds(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_selected_plans_shipment ON selected_route_plans(shipment_id);

-- Update triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_route_legs_updated_at BEFORE UPDATE ON shipment_route_legs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hub_reservations_updated_at BEFORE UPDATE ON hub_slot_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_holds_updated_at BEFORE UPDATE ON inventory_holds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_selected_plans_updated_at BEFORE UPDATE ON selected_route_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
