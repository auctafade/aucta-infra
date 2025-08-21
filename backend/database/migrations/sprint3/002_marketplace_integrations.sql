CREATE TABLE IF NOT EXISTS marketplace_integrations (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    echo_enabled BOOLEAN DEFAULT false,
    api_endpoint VARCHAR(255),
    api_key VARCHAR(255),
    commission_rate DECIMAL(5,2),
    currency_supported TEXT[],
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO marketplace_integrations (id, name, echo_enabled, commission_rate) VALUES
    ('farfetch', 'Farfetch', true, 30.00),
    ('thefloorr', 'The Floorr', true, 25.00),
    ('vestiaire', 'Vestiaire Collective', false, 33.00),
    ('rebag', 'Rebag', false, 20.00),
    ('stockx', 'StockX', true, 15.00)
ON CONFLICT (id) DO NOTHING;