ALTER TABLE passports 
ADD COLUMN IF NOT EXISTS resale_status VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_passport_resale_status ON passports(resale_status);