-- Add dynamic royalty and cashback system to resale_configurations
-- This supports multiple buyer levels (FB, SB, TB, etc.)

-- Add columns for dynamic royalty/cashback tiers
ALTER TABLE resale_configurations 
ADD COLUMN IF NOT EXISTS ownership_depth INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS royalty_tiers JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cashback_tiers JSONB DEFAULT '{}';

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_resale_config_ownership_depth ON resale_configurations(ownership_depth);

-- Comment on the new columns
COMMENT ON COLUMN resale_configurations.ownership_depth IS 'Number of previous owners (1 = going to first buyer, 2 = going to second buyer, etc.)';
COMMENT ON COLUMN resale_configurations.royalty_tiers IS 'JSON object with royalty percentages for each buyer level: {"FB": 5.0, "SB": 3.0, "TB": 2.0}';
COMMENT ON COLUMN resale_configurations.cashback_tiers IS 'JSON object with cashback percentages for each buyer level: {"FB": 2.0, "SB": 1.5, "TB": 1.0}';

-- Example data structure for royalty_tiers:
-- {
--   "FB": 5.0,    -- First Buyer gets 5% royalty
--   "SB": 3.0,    -- Second Buyer gets 3% royalty  
--   "TB": 2.0     -- Third Buyer gets 2% royalty
-- }

-- Example data structure for cashback_tiers:
-- {
--   "FB": 2.0,    -- First Buyer gets 2% cashback
--   "SB": 1.5,    -- Second Buyer gets 1.5% cashback
--   "TB": 1.0     -- Third Buyer gets 1% cashback
-- }
