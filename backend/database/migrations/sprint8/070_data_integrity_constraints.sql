-- Data Integrity & Anti-Duplication System
-- Enforces unique constraints, validates scheduling, and prevents duplicate publishes

-- ============================================================================
-- 1. UNIQUE CONSTRAINTS FOR ACTIVE POLICIES
-- ============================================================================

-- Add unique constraint: Only one active policy per type at a time
-- This prevents multiple policies from being active simultaneously

-- For SLA Margin Policies
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_margin_one_active_policy 
ON sla_margin_policies (policy_id) 
WHERE state IN ('published', 'scheduled') AND archived_date IS NULL;

-- Partial unique constraint to ensure only one policy can be 'published' at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_margin_single_published 
ON sla_margin_policies ((1)) 
WHERE state = 'published' AND archived_date IS NULL;

-- For Risk Threshold Policies  
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_threshold_one_active_policy 
ON risk_threshold_policies (policy_id) 
WHERE state IN ('published', 'scheduled') AND archived_date IS NULL;

-- Partial unique constraint for single published risk policy
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_threshold_single_published 
ON risk_threshold_policies ((1)) 
WHERE state = 'published' AND archived_date IS NULL;

-- For Hub Capacity Profiles (per hub)
CREATE UNIQUE INDEX IF NOT EXISTS idx_capacity_one_active_per_hub 
ON capacity_profiles (hub_id) 
WHERE state IN ('published', 'scheduled');

-- ============================================================================
-- 2. IDEMPOTENCY KEYS FOR PUBLISH ACTIONS
-- ============================================================================

-- Add idempotency key columns to existing tables
ALTER TABLE sla_margin_policies 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS publish_request_id VARCHAR(100);

ALTER TABLE risk_threshold_policies 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS publish_request_id VARCHAR(100);

ALTER TABLE capacity_profiles 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS publish_request_id VARCHAR(100);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sla_margin_idempotency ON sla_margin_policies(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sla_margin_payload_hash ON sla_margin_policies(payload_hash) WHERE payload_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_risk_threshold_idempotency ON risk_threshold_policies(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_threshold_payload_hash ON risk_threshold_policies(payload_hash) WHERE payload_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capacity_idempotency ON capacity_profiles(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_capacity_payload_hash ON capacity_profiles(payload_hash) WHERE payload_hash IS NOT NULL;

-- ============================================================================
-- 3. EFFECTIVE DATE VALIDATION
-- ============================================================================

-- Function to validate no overlapping active windows
CREATE OR REPLACE FUNCTION validate_effective_date_overlap()
RETURNS TRIGGER AS $$
DECLARE
    overlap_count INTEGER;
    policy_type TEXT;
BEGIN
    -- Determine policy type based on table
    IF TG_TABLE_NAME = 'sla_margin_policies' THEN
        policy_type := 'sla_margin';
    ELSIF TG_TABLE_NAME = 'risk_threshold_policies' THEN
        policy_type := 'risk_threshold';
    ELSIF TG_TABLE_NAME = 'capacity_profiles' THEN
        policy_type := 'hub_capacity';
    ELSE
        RAISE EXCEPTION 'Unknown table for effective date validation: %', TG_TABLE_NAME;
    END IF;
    
    -- Check for overlapping effective dates (only for published/scheduled states)
    IF NEW.state IN ('published', 'scheduled') AND NEW.archived_date IS NULL THEN
        
        -- For SLA and Risk policies: global uniqueness
        IF policy_type IN ('sla_margin', 'risk_threshold') THEN
            IF policy_type = 'sla_margin' THEN
                SELECT COUNT(*) INTO overlap_count
                FROM sla_margin_policies 
                WHERE id != COALESCE(NEW.id, -1)
                AND state IN ('published', 'scheduled') 
                AND archived_date IS NULL
                AND (
                    -- New policy starts before existing ends
                    (NEW.effective_date < effective_date + INTERVAL '1 day') OR
                    -- New policy is already active
                    (NEW.effective_date <= CURRENT_TIMESTAMP AND effective_date <= CURRENT_TIMESTAMP)
                );
            ELSE
                SELECT COUNT(*) INTO overlap_count
                FROM risk_threshold_policies 
                WHERE id != COALESCE(NEW.id, -1)
                AND state IN ('published', 'scheduled') 
                AND archived_date IS NULL
                AND (
                    (NEW.effective_date < effective_date + INTERVAL '1 day') OR
                    (NEW.effective_date <= CURRENT_TIMESTAMP AND effective_date <= CURRENT_TIMESTAMP)
                );
            END IF;
            
            IF overlap_count > 0 THEN
                RAISE EXCEPTION 'Overlapping active policy window detected for % policy. Only one active policy allowed at a time.', policy_type;
            END IF;
        
        -- For Hub Capacity: per-hub uniqueness
        ELSIF policy_type = 'hub_capacity' THEN
            SELECT COUNT(*) INTO overlap_count
            FROM capacity_profiles 
            WHERE id != COALESCE(NEW.id, -1)
            AND hub_id = NEW.hub_id
            AND state IN ('published', 'scheduled')
            AND (
                (NEW.effective_date < effective_date + INTERVAL '1 day') OR
                (NEW.effective_date <= CURRENT_TIMESTAMP AND effective_date <= CURRENT_TIMESTAMP)
            );
            
            IF overlap_count > 0 THEN
                RAISE EXCEPTION 'Overlapping active capacity profile for hub %. Only one active profile per hub allowed.', NEW.hub_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for overlap validation
DROP TRIGGER IF EXISTS validate_sla_margin_overlap ON sla_margin_policies;
CREATE TRIGGER validate_sla_margin_overlap 
    BEFORE INSERT OR UPDATE ON sla_margin_policies 
    FOR EACH ROW EXECUTE FUNCTION validate_effective_date_overlap();

DROP TRIGGER IF EXISTS validate_risk_threshold_overlap ON risk_threshold_policies;
CREATE TRIGGER validate_risk_threshold_overlap 
    BEFORE INSERT OR UPDATE ON risk_threshold_policies 
    FOR EACH ROW EXECUTE FUNCTION validate_effective_date_overlap();

DROP TRIGGER IF EXISTS validate_capacity_overlap ON capacity_profiles;
CREATE TRIGGER validate_capacity_overlap 
    BEFORE INSERT OR UPDATE ON capacity_profiles 
    FOR EACH ROW EXECUTE FUNCTION validate_effective_date_overlap();

-- ============================================================================
-- 4. IDEMPOTENT UPSERT FUNCTIONS
-- ============================================================================

-- Function to upsert SLA margin policy with idempotency
CREATE OR REPLACE FUNCTION upsert_sla_margin_policy(
    p_policy_id VARCHAR(50),
    p_name VARCHAR(255),
    p_version VARCHAR(20),
    p_state VARCHAR(20),
    p_effective_date TIMESTAMP WITH TIME ZONE,
    p_sla_targets JSONB,
    p_margin_thresholds JSONB,
    p_change_reason TEXT,
    p_changed_by VARCHAR(255),
    p_idempotency_key VARCHAR(64),
    p_payload_hash VARCHAR(64),
    p_publish_request_id VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    policy_id VARCHAR(50),
    is_duplicate BOOLEAN,
    action_taken TEXT
) AS $$
DECLARE
    existing_policy RECORD;
    result_policy_id VARCHAR(50);
    is_duplicate_result BOOLEAN := FALSE;
    action_result TEXT;
BEGIN
    -- Check for existing idempotency key
    SELECT * INTO existing_policy 
    FROM sla_margin_policies 
    WHERE idempotency_key = p_idempotency_key;
    
    IF existing_policy.id IS NOT NULL THEN
        -- Duplicate request - return existing policy
        result_policy_id := existing_policy.policy_id;
        is_duplicate_result := TRUE;
        action_result := 'duplicate_prevented';
    ELSE
        -- Check for existing payload hash
        SELECT * INTO existing_policy 
        FROM sla_margin_policies 
        WHERE payload_hash = p_payload_hash;
        
        IF existing_policy.id IS NOT NULL THEN
            -- Same payload, different key - still a duplicate
            result_policy_id := existing_policy.policy_id;
            is_duplicate_result := TRUE;
            action_result := 'payload_duplicate_prevented';
        ELSE
            -- Archive any existing published policy if we're publishing a new one
            IF p_state = 'published' THEN
                UPDATE sla_margin_policies 
                SET state = 'archived', 
                    archived_date = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE state = 'published' 
                AND archived_date IS NULL;
            END IF;
            
            -- Insert new policy
            INSERT INTO sla_margin_policies (
                policy_id, name, version, state, effective_date,
                sla_targets, margin_thresholds, change_reason, changed_by,
                idempotency_key, payload_hash, publish_request_id,
                created_at, updated_at
            ) VALUES (
                p_policy_id, p_name, p_version, p_state, p_effective_date,
                p_sla_targets, p_margin_thresholds, p_change_reason, p_changed_by,
                p_idempotency_key, p_payload_hash, p_publish_request_id,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
            
            result_policy_id := p_policy_id;
            is_duplicate_result := FALSE;
            action_result := 'created';
        END IF;
    END IF;
    
    RETURN QUERY SELECT result_policy_id, is_duplicate_result, action_result;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert risk threshold policy with idempotency
CREATE OR REPLACE FUNCTION upsert_risk_threshold_policy(
    p_policy_id VARCHAR(50),
    p_name VARCHAR(255),
    p_version VARCHAR(20),
    p_state VARCHAR(20),
    p_effective_date TIMESTAMP WITH TIME ZONE,
    p_value_bands JSONB,
    p_fragility_rules JSONB,
    p_brand_overrides JSONB,
    p_lane_risks JSONB,
    p_inventory_thresholds JSONB,
    p_risk_weights JSONB,
    p_risk_components JSONB,
    p_security_defaults JSONB,
    p_incident_rules JSONB,
    p_publishing_scope JSONB,
    p_change_reason TEXT,
    p_changed_by VARCHAR(255),
    p_idempotency_key VARCHAR(64),
    p_payload_hash VARCHAR(64),
    p_publish_request_id VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    policy_id VARCHAR(50),
    is_duplicate BOOLEAN,
    action_taken TEXT
) AS $$
DECLARE
    existing_policy RECORD;
    result_policy_id VARCHAR(50);
    is_duplicate_result BOOLEAN := FALSE;
    action_result TEXT;
BEGIN
    -- Check for existing idempotency key
    SELECT * INTO existing_policy 
    FROM risk_threshold_policies 
    WHERE idempotency_key = p_idempotency_key;
    
    IF existing_policy.id IS NOT NULL THEN
        result_policy_id := existing_policy.policy_id;
        is_duplicate_result := TRUE;
        action_result := 'duplicate_prevented';
    ELSE
        -- Check for existing payload hash
        SELECT * INTO existing_policy 
        FROM risk_threshold_policies 
        WHERE payload_hash = p_payload_hash;
        
        IF existing_policy.id IS NOT NULL THEN
            result_policy_id := existing_policy.policy_id;
            is_duplicate_result := TRUE;
            action_result := 'payload_duplicate_prevented';
        ELSE
            -- Archive existing published policy if publishing new one
            IF p_state = 'published' THEN
                UPDATE risk_threshold_policies 
                SET state = 'archived', 
                    archived_date = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE state = 'published' 
                AND archived_date IS NULL;
            END IF;
            
            -- Insert new policy
            INSERT INTO risk_threshold_policies (
                policy_id, name, version, state, effective_date,
                value_bands, fragility_rules, brand_overrides, lane_risks,
                inventory_thresholds, risk_weights, risk_components,
                security_defaults, incident_rules, publishing_scope,
                change_reason, changed_by,
                idempotency_key, payload_hash, publish_request_id,
                created_at, updated_at
            ) VALUES (
                p_policy_id, p_name, p_version, p_state, p_effective_date,
                p_value_bands, p_fragility_rules, p_brand_overrides, p_lane_risks,
                p_inventory_thresholds, p_risk_weights, p_risk_components,
                p_security_defaults, p_incident_rules, p_publishing_scope,
                p_change_reason, p_changed_by,
                p_idempotency_key, p_payload_hash, p_publish_request_id,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
            
            result_policy_id := p_policy_id;
            is_duplicate_result := FALSE;
            action_result := 'created';
        END IF;
    END IF;
    
    RETURN QUERY SELECT result_policy_id, is_duplicate_result, action_result;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert hub capacity profile with idempotency
CREATE OR REPLACE FUNCTION upsert_capacity_profile(
    p_hub_id INTEGER,
    p_version VARCHAR(20),
    p_effective_date TIMESTAMP WITH TIME ZONE,
    p_state VARCHAR(20),
    p_auth_capacity INTEGER,
    p_sewing_capacity INTEGER,
    p_qa_capacity INTEGER,
    p_qa_headcount INTEGER,
    p_qa_shift_minutes INTEGER,
    p_seasonality_multiplier DECIMAL(5,2),
    p_overbooking_percentage DECIMAL(5,2),
    p_leadtime_days INTEGER,
    p_cutoff_hour INTEGER,
    p_weekend_processing BOOLEAN,
    p_change_reason TEXT,
    p_changed_by VARCHAR(255),
    p_idempotency_key VARCHAR(64),
    p_payload_hash VARCHAR(64),
    p_publish_request_id VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    profile_id INTEGER,
    is_duplicate BOOLEAN,
    action_taken TEXT
) AS $$
DECLARE
    existing_profile RECORD;
    result_profile_id INTEGER;
    is_duplicate_result BOOLEAN := FALSE;
    action_result TEXT;
BEGIN
    -- Check for existing idempotency key
    SELECT * INTO existing_profile 
    FROM capacity_profiles 
    WHERE idempotency_key = p_idempotency_key;
    
    IF existing_profile.id IS NOT NULL THEN
        result_profile_id := existing_profile.id;
        is_duplicate_result := TRUE;
        action_result := 'duplicate_prevented';
    ELSE
        -- Check for existing payload hash
        SELECT * INTO existing_profile 
        FROM capacity_profiles 
        WHERE payload_hash = p_payload_hash;
        
        IF existing_profile.id IS NOT NULL THEN
            result_profile_id := existing_profile.id;
            is_duplicate_result := TRUE;
            action_result := 'payload_duplicate_prevented';
        ELSE
            -- Archive existing published profile for this hub if publishing new one
            IF p_state = 'published' THEN
                UPDATE capacity_profiles 
                SET state = 'archived', 
                    updated_at = CURRENT_TIMESTAMP
                WHERE hub_id = p_hub_id 
                AND state = 'published';
            END IF;
            
            -- Insert new profile
            INSERT INTO capacity_profiles (
                hub_id, version, effective_date, state,
                auth_capacity, sewing_capacity, qa_capacity,
                qa_headcount, qa_shift_minutes,
                seasonality_multiplier, overbooking_percentage,
                leadtime_days, cutoff_hour, weekend_processing,
                change_reason, changed_by,
                idempotency_key, payload_hash, publish_request_id,
                created_at, updated_at
            ) VALUES (
                p_hub_id, p_version, p_effective_date, p_state,
                p_auth_capacity, p_sewing_capacity, p_qa_capacity,
                p_qa_headcount, p_qa_shift_minutes,
                p_seasonality_multiplier, p_overbooking_percentage,
                p_leadtime_days, p_cutoff_hour, p_weekend_processing,
                p_change_reason, p_changed_by,
                p_idempotency_key, p_payload_hash, p_publish_request_id,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id INTO result_profile_id;
            
            is_duplicate_result := FALSE;
            action_result := 'created';
        END IF;
    END IF;
    
    RETURN QUERY SELECT result_profile_id, is_duplicate_result, action_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. DATA INTEGRITY MONITORING
-- ============================================================================

-- View to monitor active policies
CREATE OR REPLACE VIEW active_policies_summary AS
SELECT 
    'sla_margin' as policy_type,
    policy_id,
    name,
    version,
    state,
    effective_date,
    created_at,
    updated_at
FROM sla_margin_policies 
WHERE state IN ('published', 'scheduled') AND archived_date IS NULL

UNION ALL

SELECT 
    'risk_threshold' as policy_type,
    policy_id,
    name,
    version,
    state,
    effective_date,
    created_at,
    updated_at
FROM risk_threshold_policies 
WHERE state IN ('published', 'scheduled') AND archived_date IS NULL

UNION ALL

SELECT 
    'hub_capacity' as policy_type,
    CONCAT('hub-', hub_id) as policy_id,
    CONCAT('Hub ', hub_id, ' Capacity v', version) as name,
    version,
    state,
    effective_date,
    created_at,
    updated_at
FROM capacity_profiles 
WHERE state IN ('published', 'scheduled');

-- Function to check for constraint violations
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
    check_name TEXT,
    violation_count INTEGER,
    details JSONB
) AS $$
BEGIN
    -- Check for multiple active SLA policies
    RETURN QUERY
    SELECT 
        'multiple_active_sla_policies'::TEXT,
        COUNT(*)::INTEGER,
        jsonb_agg(jsonb_build_object('policy_id', policy_id, 'state', state, 'effective_date', effective_date))
    FROM sla_margin_policies 
    WHERE state IN ('published', 'scheduled') AND archived_date IS NULL
    HAVING COUNT(*) > 1;
    
    -- Check for multiple active risk policies
    RETURN QUERY
    SELECT 
        'multiple_active_risk_policies'::TEXT,
        COUNT(*)::INTEGER,
        jsonb_agg(jsonb_build_object('policy_id', policy_id, 'state', state, 'effective_date', effective_date))
    FROM risk_threshold_policies 
    WHERE state IN ('published', 'scheduled') AND archived_date IS NULL
    HAVING COUNT(*) > 1;
    
    -- Check for multiple active capacity profiles per hub
    RETURN QUERY
    SELECT 
        CONCAT('multiple_active_capacity_hub_', hub_id)::TEXT,
        COUNT(*)::INTEGER,
        jsonb_agg(jsonb_build_object('id', id, 'version', version, 'state', state, 'effective_date', effective_date))
    FROM capacity_profiles 
    WHERE state IN ('published', 'scheduled')
    GROUP BY hub_id
    HAVING COUNT(*) > 1;
    
    -- Check for duplicate idempotency keys
    RETURN QUERY
    SELECT 
        'duplicate_idempotency_keys'::TEXT,
        COUNT(*)::INTEGER,
        jsonb_agg(jsonb_build_object('idempotency_key', idempotency_key, 'count', cnt))
    FROM (
        SELECT idempotency_key, COUNT(*) as cnt
        FROM (
            SELECT idempotency_key FROM sla_margin_policies WHERE idempotency_key IS NOT NULL
            UNION ALL
            SELECT idempotency_key FROM risk_threshold_policies WHERE idempotency_key IS NOT NULL
            UNION ALL
            SELECT idempotency_key FROM capacity_profiles WHERE idempotency_key IS NOT NULL
        ) combined
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
    ) duplicates
    HAVING COUNT(*) > 0;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON active_policies_summary TO PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_sla_margin_policy TO PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_risk_threshold_policy TO PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_capacity_profile TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_data_integrity TO PUBLIC;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION validate_effective_date_overlap IS 'Prevents overlapping active policy windows - ensures only one active policy per type';
COMMENT ON FUNCTION upsert_sla_margin_policy IS 'Idempotent policy creation/update with duplicate prevention via idempotency keys';
COMMENT ON FUNCTION upsert_risk_threshold_policy IS 'Idempotent risk policy creation/update with duplicate prevention';
COMMENT ON FUNCTION upsert_capacity_profile IS 'Idempotent capacity profile creation/update with duplicate prevention';
COMMENT ON FUNCTION check_data_integrity IS 'Monitors and reports data integrity constraint violations';
COMMENT ON VIEW active_policies_summary IS 'Unified view of all active policies across all types for monitoring';

COMMIT;
