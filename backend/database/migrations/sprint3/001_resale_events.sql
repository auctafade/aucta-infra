CREATE TABLE IF NOT EXISTS resale_events (
    id SERIAL PRIMARY KEY,
    resale_id VARCHAR(50) UNIQUE NOT NULL,
    passport_id INTEGER REFERENCES passports(id),
    seller_id INTEGER REFERENCES clients(id),
    buyer_id INTEGER REFERENCES clients(id),
    
    -- Pricing
    asking_price DECIMAL(12,2) NOT NULL,
    minimum_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Marketplace
    marketplace_id VARCHAR(50),
    external_listing_ref VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'ready_for_resale',
    
    -- Valuation link
    current_valuation_id INTEGER REFERENCES product_valuations(id),
    
    -- Snapshots
    product_hash VARCHAR(255),
    client_hash VARCHAR(255),
    metadata JSONB,
    
    -- Timestamps
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    buyer_assigned_at TIMESTAMP,
    listed_at TIMESTAMP,
    sold_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resale_passport ON resale_events(passport_id);
CREATE INDEX idx_resale_seller ON resale_events(seller_id);
CREATE INDEX idx_resale_buyer ON resale_events(buyer_id);
CREATE INDEX idx_resale_status ON resale_events(status);