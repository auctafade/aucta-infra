-- Migration 007: Add missing tables for Admin Dashboard functionality
-- This migration creates the royalty_distributions and audit_trail tables

-- Create royalty_distributions table
CREATE TABLE IF NOT EXISTS royalty_distributions (
    id SERIAL PRIMARY KEY,
    resale_id VARCHAR(50) NOT NULL,
    seller_amount DECIMAL(10,2) NOT NULL,
    brand_royalty DECIMAL(10,2) NOT NULL,
    aucta_commission DECIMAL(10,2) NOT NULL,
    cashback_amount DECIMAL(10,2) DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    distribution_hash VARCHAR(255),
    blockchain_tx_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_royalty_distributions_resale 
        FOREIGN KEY (resale_id) REFERENCES resale_events(resale_id) ON DELETE CASCADE
);

-- Create audit_trail table for admin actions
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    action_category VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    admin_user VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_royalty_distributions_resale_id ON royalty_distributions(resale_id);
CREATE INDEX IF NOT EXISTS idx_royalty_distributions_status ON royalty_distributions(status);
CREATE INDEX IF NOT EXISTS idx_royalty_distributions_calculated_at ON royalty_distributions(calculated_at);

CREATE INDEX IF NOT EXISTS idx_audit_trail_action_category ON audit_trail(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource_type ON audit_trail(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trail_admin_user ON audit_trail(admin_user);

-- Add comments for documentation
COMMENT ON TABLE royalty_distributions IS 'Stores royalty distribution calculations for resale events';
COMMENT ON TABLE audit_trail IS 'Tracks all admin actions and system changes for audit purposes';

-- Insert sample royalty distribution data for testing
INSERT INTO royalty_distributions (resale_id, seller_amount, brand_royalty, aucta_commission, cashback_amount, status) VALUES
    ('RS001', 850.00, 50.00, 100.00, 25.00, 'completed'),
    ('RS002', 1200.00, 75.00, 125.00, 30.00, 'pending'),
    ('RS003', 950.00, 60.00, 90.00, 20.00, 'completed')
ON CONFLICT DO NOTHING;

-- Insert sample audit trail data for testing
INSERT INTO audit_trail (action_category, action_type, resource_type, resource_id, admin_user, new_values) VALUES
    ('resale_management', 'approve_resale', 'resale_event', 'RS001', 'admin', '{"status": "approved"}'),
    ('resale_management', 'block_resale', 'resale_event', 'RS002', 'admin', '{"status": "blocked", "reason": "Suspicious activity"}'),
    ('royalty_management', 'recalculate_royalties', 'resale_event', 'RS003', 'admin', '{"action": "recalculation_requested"}')
ON CONFLICT DO NOTHING;
