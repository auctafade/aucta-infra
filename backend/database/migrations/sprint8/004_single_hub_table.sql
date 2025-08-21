-- Sprint 8: Consolidate ALL hub data into ONE table
-- Migration 004: Single Hub Table with All Data

-- First, let's modify the existing hubs table to include ALL fields
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '["authenticator"]';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT '{}';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS capacity JSONB DEFAULT '{}';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS time_per_product JSONB DEFAULT '{}';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS special_surcharges JSONB DEFAULT '{}';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Update existing data to migrate from separate tables into the single hubs table
-- (This will be done in the application code, not in SQL to handle the complex logic)

-- Example of what the new hubs table will contain:
-- {
--   "id": 1,
--   "code": "PAR-01", 
--   "name": "Paris Fashion Hub",
--   "location": "Paris, France",
--   "timezone": "Europe/Paris",
--   "status": "active",
--   "logo": "data:image/png;base64...",
--   "address": {
--     "street": "123 Main Street",
--     "city": "Paris", 
--     "state": "Île-de-France",
--     "postal_code": "75001",
--     "country": "France"
--   },
--   "contact_info": {
--     "name": "Pierre Dubois",
--     "email": "pierre@example.com", 
--     "phone": "+33123456789"
--   },
--   "roles": ["authenticator", "couturier"],
--   "pricing": {
--     "currency": "EUR",
--     "tier2_auth_fee": 150,
--     "tag_unit_cost": 5,
--     "tier3_auth_fee": 200,
--     "nfc_unit_cost": 3,
--     "sew_fee": 50,
--     "qa_fee": 25,
--     "internal_rollout_cost": 100
--   },
--   "capacity": {
--     "auth_capacity": 100,
--     "sewing_capacity": 50,
--     "qa_capacity": 75,
--     "working_days": 5
--   },
--   "operating_hours": {
--     "monday": {"open": "09:00", "close": "17:00", "closed": false},
--     "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
--     "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
--     "thursday": {"open": "09:00", "close": "17:00", "closed": false},
--     "friday": {"open": "09:00", "close": "17:00", "closed": false},
--     "saturday": {"open": "09:00", "close": "13:00", "closed": false},
--     "sunday": {"open": "", "close": "", "closed": true}
--   },
--   "time_per_product": {
--     "tier2_auth": 45,
--     "tier3_auth": 60,
--     "sewing": 120,
--     "qa": 30
--   },
--   "special_surcharges": {
--     "rush_percent": 25,
--     "fragile_handling": 15,
--     "weekend": 50
--   },
--   "notes": "Additional notes about this hub...",
--   "attachments": ["doc1.pdf", "image1.jpg"],
--   "created_at": "2025-08-16T22:08:27.504Z",
--   "updated_at": "2025-08-16T22:08:27.504Z"
-- }

-- Create indexes for the new JSONB columns for better performance
CREATE INDEX IF NOT EXISTS idx_hubs_roles ON hubs USING GIN (roles);
CREATE INDEX IF NOT EXISTS idx_hubs_pricing ON hubs USING GIN (pricing);
CREATE INDEX IF NOT EXISTS idx_hubs_status ON hubs (status);
CREATE INDEX IF NOT EXISTS idx_hubs_code ON hubs (code);

-- Future: After data migration is complete, we can optionally drop the old tables:
-- DROP TABLE IF EXISTS hub_roles CASCADE;
-- DROP TABLE IF EXISTS hub_pricing CASCADE; 
-- DROP TABLE IF EXISTS capacity_profiles CASCADE;
