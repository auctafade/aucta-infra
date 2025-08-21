-- Telemetry and Audit tables for comprehensive logging

-- Main telemetry events table
CREATE TABLE IF NOT EXISTS telemetry_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  shipment_id VARCHAR(100),
  session_id VARCHAR(100),
  user_id VARCHAR(100),
  
  -- Hashing for idempotency and audit
  option_hash VARCHAR(32), -- For plan.option.computed idempotency
  selection_hash VARCHAR(32), -- For plan.route.selected audit
  
  -- Full event data as JSONB for flexibility
  event_data JSONB NOT NULL,
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes will be created below
  CONSTRAINT unique_option_computation UNIQUE (option_hash, timestamp)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_shipment ON telemetry_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_option_hash ON telemetry_events(option_hash);
CREATE INDEX IF NOT EXISTS idx_telemetry_selection_hash ON telemetry_events(selection_hash);

-- JSONB indexes for common queries
CREATE INDEX IF NOT EXISTS idx_telemetry_route_id ON telemetry_events 
  USING GIN ((event_data->'selectedRoute'->>'id'));
CREATE INDEX IF NOT EXISTS idx_telemetry_tier ON telemetry_events 
  USING GIN ((event_data->'selectedRoute'->>'tier'));
CREATE INDEX IF NOT EXISTS idx_telemetry_total_cost ON telemetry_events 
  USING BTREE (((event_data->'fullBreakdown'->>'totalCost')::numeric));

-- Cache hit tracking table
CREATE TABLE IF NOT EXISTS cache_performance (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  service_type VARCHAR(50) NOT NULL, -- 'flights', 'trains', 'dhl', 'ground'
  cache_key VARCHAR(200) NOT NULL,
  hit BOOLEAN NOT NULL, -- true = cache hit, false = cache miss
  response_time_ms INTEGER,
  
  -- Context
  shipment_id VARCHAR(100),
  route_option_id VARCHAR(100),
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for cache performance
CREATE INDEX IF NOT EXISTS idx_cache_session ON cache_performance(session_id);
CREATE INDEX IF NOT EXISTS idx_cache_service ON cache_performance(service_type);
CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON cache_performance(timestamp);
CREATE INDEX IF NOT EXISTS idx_cache_hit_rate ON cache_performance(service_type, hit, timestamp);

-- Idempotency tracking table (for audit purposes)
CREATE TABLE IF NOT EXISTS idempotency_log (
  id SERIAL PRIMARY KEY,
  option_hash VARCHAR(32) NOT NULL,
  shipment_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100),
  
  -- Original computation details
  inputs_hash VARCHAR(32) NOT NULL,
  hub_selection JSONB,
  options_generated INTEGER,
  
  -- Idempotency tracking
  first_computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  duplicate_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(option_hash)
);

-- Indexes for idempotency
CREATE INDEX IF NOT EXISTS idx_idempotency_hash ON idempotency_log(option_hash);
CREATE INDEX IF NOT EXISTS idx_idempotency_shipment ON idempotency_log(shipment_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_timestamp ON idempotency_log(first_computed_at);

-- API cost tracking table
CREATE TABLE IF NOT EXISTS api_cost_tracking (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  endpoint VARCHAR(200),
  
  -- Request details
  request_params JSONB,
  cache_key VARCHAR(200),
  
  -- Response details
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  cost_estimate DECIMAL(8,4), -- Estimated API cost in currency units
  
  -- Caching
  from_cache BOOLEAN DEFAULT FALSE,
  cache_age_seconds INTEGER,
  
  -- Context
  shipment_id VARCHAR(100),
  route_calculation_id VARCHAR(100),
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for API cost tracking
CREATE INDEX IF NOT EXISTS idx_api_cost_session ON api_cost_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_api_cost_service ON api_cost_tracking(service_type);
CREATE INDEX IF NOT EXISTS idx_api_cost_timestamp ON api_cost_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_cost_success ON api_cost_tracking(success, timestamp);

-- Route map generation tracking
CREATE TABLE IF NOT EXISTS route_map_generation_log (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(100) NOT NULL,
  route_id VARCHAR(100) NOT NULL,
  route_selection_hash VARCHAR(32),
  
  -- Generation details
  html_generated BOOLEAN DEFAULT FALSE,
  pdf_generated BOOLEAN DEFAULT FALSE,
  html_path TEXT,
  pdf_path TEXT,
  generation_time_ms INTEGER,
  
  -- Content details
  legs_count INTEGER,
  hubs_count INTEGER,
  checklists_count INTEGER,
  total_cost DECIMAL(12,2),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for route map generation
CREATE INDEX IF NOT EXISTS idx_route_map_shipment ON route_map_generation_log(shipment_id);
CREATE INDEX IF NOT EXISTS idx_route_map_route ON route_map_generation_log(route_id);
CREATE INDEX IF NOT EXISTS idx_route_map_status ON route_map_generation_log(status, timestamp);

-- Materialized view for performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_summary AS
SELECT 
  DATE(timestamp) as event_date,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT shipment_id) as unique_shipments,
  COUNT(DISTINCT session_id) as unique_sessions,
  
  -- Option computation stats
  AVG(CASE 
    WHEN event_type = 'plan.option.computed' 
    THEN (event_data->'computation'->>'optionsGenerated')::int 
    ELSE NULL 
  END) as avg_options_generated,
  
  -- Selection stats
  AVG(CASE 
    WHEN event_type = 'plan.route.selected' 
    THEN (event_data->'fullBreakdown'->>'totalCost')::numeric 
    ELSE NULL 
  END) as avg_selection_cost,
  
  -- Cache performance
  AVG(CASE 
    WHEN event_type = 'plan.option.computed' 
    THEN (event_data->'cacheHits'->>'hitRate')::numeric 
    ELSE NULL 
  END) as avg_cache_hit_rate
  
FROM telemetry_events 
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp), event_type
ORDER BY event_date DESC, event_type;

-- Refresh materialized view daily
CREATE INDEX IF NOT EXISTS idx_telemetry_summary_date ON telemetry_summary(event_date);

-- Cleanup function for old data
CREATE OR REPLACE FUNCTION cleanup_old_telemetry(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old telemetry events
  DELETE FROM telemetry_events 
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old cache performance data
  DELETE FROM cache_performance 
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old API cost tracking
  DELETE FROM api_cost_tracking 
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old route map generation logs
  DELETE FROM route_map_generation_log 
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW telemetry_summary;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update duplicate attempt count
CREATE OR REPLACE FUNCTION increment_duplicate_attempt(hash VARCHAR(32))
RETURNS VOID AS $$
BEGIN
  UPDATE idempotency_log 
  SET duplicate_attempts = duplicate_attempts + 1,
      last_attempt_at = NOW()
  WHERE option_hash = hash;
  
  -- Insert if not exists
  INSERT INTO idempotency_log (option_hash, shipment_id, session_id, inputs_hash, hub_selection, options_generated)
  SELECT hash, '', '', '', '{}', 0
  WHERE NOT EXISTS (SELECT 1 FROM idempotency_log WHERE option_hash = hash);
END;
$$ LANGUAGE plpgsql;
