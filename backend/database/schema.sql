-- Create the AUCTA database schema
-- Run this in PostgreSQL to create all required tables

-- Clients table for KYC-verified users
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    kyc_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Passports table for luxury product digital identity
CREATE TABLE IF NOT EXISTS passports (
    id SERIAL PRIMARY KEY,
    nfc_uid VARCHAR(255) UNIQUE NOT NULL,
    metadata_hash VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'VACANT',
    assigned_client_id INTEGER REFERENCES clients(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SBTs table for Soulbound Tokens on private blockchain
CREATE TABLE IF NOT EXISTS sbts (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER REFERENCES passports(id),
    client_id INTEGER REFERENCES clients(id),
    sbt_hash VARCHAR(255) NOT NULL,
    blockchain_tx_hash VARCHAR(255),
    minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Action logs for complete audit trail
CREATE TABLE IF NOT EXISTS action_logs (
    id SERIAL PRIMARY KEY,
    passport_id INTEGER REFERENCES passports(id),
    client_id INTEGER REFERENCES clients(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_passports_nfc_uid ON passports(nfc_uid);
CREATE INDEX IF NOT EXISTS idx_passports_status ON passports(status);
CREATE INDEX IF NOT EXISTS idx_clients_wallet ON clients(wallet_address);
CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp);