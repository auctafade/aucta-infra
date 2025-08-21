-- Create resale_configurations table to store configuration settings for products
CREATE TABLE IF NOT EXISTS resale_configurations (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER REFERENCES passports(id) ON DELETE CASCADE,
    
    -- Resale type options
    resale_type VARCHAR(20) DEFAULT 'private' CHECK (resale_type IN ('private', 'auction', 'delegated')),
    
    -- Revenue options
    royalties_enabled BOOLEAN DEFAULT true,
    cashback_enabled BOOLEAN DEFAULT false,
    
    -- Brand participation
    brand_participation BOOLEAN DEFAULT false,
    brand_revenue_share DECIMAL(5,2) DEFAULT 5.00,
    
    -- QR Access
    qr_access_generated BOOLEAN DEFAULT false,
    qr_access_url TEXT,
    qr_access_expires_at TIMESTAMP,
    
    -- Configuration metadata
    configured_by VARCHAR(100),
    configured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one configuration per passport
    UNIQUE(passport_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resale_config_passport ON resale_configurations(passport_id);
CREATE INDEX IF NOT EXISTS idx_resale_config_type ON resale_configurations(resale_type);
CREATE INDEX IF NOT EXISTS idx_resale_config_configured_at ON resale_configurations(configured_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_resale_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER resale_config_updated_at_trigger
    BEFORE UPDATE ON resale_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_resale_config_updated_at();
