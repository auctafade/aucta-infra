-- Migration 006: Add resale finalization support
-- This migration adds the necessary tables and fields for resale finalization

-- Add finalized_at field to resale_events table
ALTER TABLE resale_events 
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP;

-- Create sbt_tokens table for Soulbound Tokens
CREATE TABLE IF NOT EXISTS sbt_tokens (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(100) UNIQUE NOT NULL,
    passport_id INTEGER REFERENCES passports(id),
    owner_id INTEGER REFERENCES clients(id),
    status VARCHAR(50) DEFAULT 'MINTED',
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_hash VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to existing blockchain_transactions table
ALTER TABLE blockchain_transactions 
ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

-- Update transaction_type check constraint to include RESALE_FINALIZATION
ALTER TABLE blockchain_transactions 
DROP CONSTRAINT IF EXISTS blockchain_transactions_transaction_type_check;

ALTER TABLE blockchain_transactions 
ADD CONSTRAINT blockchain_transactions_transaction_type_check 
CHECK (transaction_type::text = ANY (ARRAY['mint'::character varying, 'transfer'::character varying, 'burn'::character varying, 'metadata_update'::character varying, 'RESALE_FINALIZATION'::character varying]::text[]));

-- Update status check constraint to include CONFIRMED
ALTER TABLE blockchain_transactions 
DROP CONSTRAINT IF EXISTS blockchain_transactions_status_check;

ALTER TABLE blockchain_transactions 
ADD CONSTRAINT blockchain_transactions_status_check 
CHECK (status::text = ANY (ARRAY['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying, 'reverted'::character varying, 'CONFIRMED'::character varying]::text[]));

-- Create resale_archives table for storing finalized resale metadata
CREATE TABLE IF NOT EXISTS resale_archives (
    id SERIAL PRIMARY KEY,
    resale_id VARCHAR(50) REFERENCES resale_events(resale_id),
    passport_id INTEGER REFERENCES passports(id),
    archived_data JSONB NOT NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sbt_tokens_passport ON sbt_tokens(passport_id);
CREATE INDEX IF NOT EXISTS idx_sbt_tokens_owner ON sbt_tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_sbt_tokens_status ON sbt_tokens(status);
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_hash ON blockchain_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_passport ON blockchain_transactions(passport_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_type ON blockchain_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_resale_archives_resale ON resale_archives(resale_id);
CREATE INDEX IF NOT EXISTS idx_resale_archives_passport ON resale_archives(passport_id);

-- Add finalized_at index to resale_events
CREATE INDEX IF NOT EXISTS idx_resale_finalized ON resale_events(finalized_at);
