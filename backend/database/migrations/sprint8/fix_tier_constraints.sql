-- Fix tier constraints properly
-- Sprint 8: Tier gate refactor

-- First, update existing data
UPDATE shipments SET tier = 'T1' WHERE tier = 'standard';
UPDATE shipments SET tier = 'T2' WHERE tier = 'premium';
UPDATE shipments SET tier = 'T3' WHERE tier = 'platinum';

-- Drop old constraints
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS chk_tier;
ALTER TABLE logistics_pricing DROP CONSTRAINT IF EXISTS chk_pricing_tier;

-- Update pricing data
UPDATE logistics_pricing SET tier = 'T1' WHERE tier = 'standard';
UPDATE logistics_pricing SET tier = 'T2' WHERE tier = 'premium';  
UPDATE logistics_pricing SET tier = 'T3' WHERE tier = 'platinum';

-- Add new constraints
ALTER TABLE shipments ADD CONSTRAINT chk_tier CHECK (tier IN ('T1', 'T2', 'T3'));
ALTER TABLE logistics_pricing ADD CONSTRAINT chk_pricing_tier CHECK (tier IN ('T1', 'T2', 'T3'));

COMMENT ON COLUMN shipments.tier IS 'Processing tier: T1 (Digital), T2 (Tag), T3 (NFC + Sewing)';
COMMENT ON COLUMN logistics_pricing.tier IS 'Processing tier: T1 (Digital), T2 (Tag), T3 (NFC + Sewing)';
