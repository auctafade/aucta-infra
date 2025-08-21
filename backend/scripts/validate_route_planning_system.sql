-- Comprehensive validation script for Route Planning System
-- This script validates the complete backend system setup

\echo '=================================================='
\echo '🔍 AUCTA Route Planning System Validation'
\echo '=================================================='

-- Check database connection
\echo ''
\echo '📊 Database Connection:'
SELECT current_database() as database, current_user as user, version() as postgresql_version;

-- Check all required tables exist
\echo ''
\echo '📋 Required Tables Check:'
SELECT 
    CASE 
        WHEN COUNT(*) = 16 THEN '✅ All required tables exist' 
        ELSE '❌ Missing tables: ' || (16 - COUNT(*)::text)
    END as table_status,
    COUNT(*) as existing_tables,
    16 as required_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'shipments', 'logistics_contacts', 'logistics_hubs', 'shipment_documents', 'shipment_tracking',
    'shipment_route_plans', 'shipment_route_legs', 'route_guardrails', 'route_financial_snapshots',
    'route_planning_sessions', 'route_telemetry_events', 'score_computation_logs',
    'guardrail_analytics', 'route_comparison_logs', 'tier_resource_reservations', 'inventory_constraint_checks'
);

-- List all route planning related tables
\echo ''
\echo '📝 Route Planning Tables:'
SELECT table_name, 
       pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%route%' OR table_name LIKE '%telemetry%' OR table_name = 'shipments')
ORDER BY table_name;

-- Check indexes
\echo ''
\echo '🚀 Performance Indexes:'
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (tablename LIKE '%route%' OR tablename LIKE '%telemetry%' OR tablename = 'shipments')
ORDER BY tablename, indexname;

-- Check functions and triggers
\echo ''
\echo '⚙️ Functions and Triggers:'
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND p.proname IN ('update_session_end', 'track_route_selection', 'log_guardrail_telemetry', 'update_updated_at_column', 'track_shipment_status_change');

-- Check sample data exists
\echo ''
\echo '🏢 Logistics Hubs:'
SELECT hub_code, hub_name, city, country, capacity_max, active 
FROM logistics_hubs 
ORDER BY hub_code;

-- Check pricing data
\echo ''
\echo '💰 Logistics Pricing:'
SELECT tier, urgency_level, weight_range_min, weight_range_max, base_price, active
FROM logistics_pricing 
WHERE active = true
ORDER BY tier, urgency_level, weight_range_min;

-- Test table constraints
\echo ''
\echo '🔒 Constraint Validation:'

-- Test shipment status constraint
DO $$
BEGIN
    BEGIN
        INSERT INTO shipments (shipment_id, reference_sku, declared_value, weight, length_cm, width_cm, height_cm, brand, category, status)
        VALUES ('TEST-001', 'TEST', 1000, 1, 10, 10, 10, 'Test', 'Test', 'invalid_status');
    EXCEPTION 
        WHEN check_violation THEN
            RAISE NOTICE '✅ Shipment status constraint working';
    END;
    
    -- Clean up
    DELETE FROM shipments WHERE shipment_id = 'TEST-001';
END $$;

-- Test route plan score constraint
DO $$
BEGIN
    -- First insert a valid shipment
    INSERT INTO logistics_contacts (full_name, email, phone, city, country)
    VALUES ('Test Sender', 'test@example.com', '+1234567890', 'London', 'UK');
    
    INSERT INTO shipments (shipment_id, reference_sku, declared_value, weight, length_cm, width_cm, height_cm, brand, category, sender_id)
    VALUES ('TEST-002', 'TEST', 1000, 1, 10, 10, 10, 'Test', 'Test', currval('logistics_contacts_id_seq'));
    
    BEGIN
        INSERT INTO shipment_route_plans (shipment_id, route_label, route_type, score_letter, score_numeric, time_score, cost_score, risk_score, estimated_days, delivery_date, total_cost, client_price, estimated_margin_amount, estimated_margin_percentage)
        VALUES (currval('shipments_id_seq'), 'test', 'standard', 'X', 85, 80, 75, 90, 3, CURRENT_DATE + 3, 100, 150, 50, 33.33);
    EXCEPTION 
        WHEN check_violation THEN
            RAISE NOTICE '✅ Route plan score constraint working';
    END;
    
    -- Clean up
    DELETE FROM shipments WHERE shipment_id = 'TEST-002';
    DELETE FROM logistics_contacts WHERE email = 'test@example.com';
END $$;

-- Check foreign key relationships
\echo ''
\echo '🔗 Foreign Key Relationships:'
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND (tc.table_name LIKE '%route%' OR tc.table_name LIKE '%telemetry%')
ORDER BY tc.table_name, kcu.column_name;

-- Performance analysis
\echo ''
\echo '📈 Table Statistics:'
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
AND (tablename LIKE '%route%' OR tablename LIKE '%telemetry%' OR tablename = 'shipments')
ORDER BY tablename;

-- Test telemetry session workflow
\echo ''
\echo '🔬 Testing Telemetry Workflow:'

DO $$
DECLARE
    test_session_id VARCHAR(100) := 'test-session-' || extract(epoch from now());
    test_shipment_id INTEGER;
    test_route_plan_id INTEGER;
BEGIN
    -- Create test shipment
    INSERT INTO logistics_contacts (full_name, email, phone, city, country, contact_type)
    VALUES ('Test Sender', 'sender@test.com', '+1234567890', 'London', 'UK', 'sender'),
           ('Test Buyer', 'buyer@test.com', '+1987654321', 'Paris', 'France', 'buyer');
    
    INSERT INTO shipments (
        shipment_id, reference_sku, declared_value, weight, length_cm, width_cm, height_cm, 
        brand, category, sender_id, buyer_id, status, tier
    ) VALUES (
        'TEST-TELEMETRY-001', 'TEST-SKU', 5000, 2.5, 30, 20, 15, 
        'Test Brand', 'luxury', 
        (SELECT id FROM logistics_contacts WHERE email = 'sender@test.com'),
        (SELECT id FROM logistics_contacts WHERE email = 'buyer@test.com'),
        'classified', 'premium'
    );
    
    SELECT id INTO test_shipment_id FROM shipments WHERE shipment_id = 'TEST-TELEMETRY-001';
    
    -- Create telemetry session
    INSERT INTO route_planning_sessions (session_id, shipment_id, routes_calculated)
    VALUES (test_session_id, test_shipment_id, 3);
    
    -- Create test route plan
    INSERT INTO shipment_route_plans (
        shipment_id, route_label, route_type, score_letter, score_numeric,
        time_score, cost_score, risk_score, estimated_days, delivery_date,
        total_cost, client_price, estimated_margin_amount, estimated_margin_percentage
    ) VALUES (
        test_shipment_id, 'Test Route', 'standard', 'A', 85,
        80, 75, 90, 3, CURRENT_DATE + 3,
        200, 300, 100, 33.33
    );
    
    SELECT id INTO test_route_plan_id FROM shipment_route_plans WHERE shipment_id = test_shipment_id;
    
    -- Test telemetry event
    INSERT INTO route_telemetry_events (
        session_id, event_type, event_category, event_data, route_id
    ) VALUES (
        (SELECT id FROM route_planning_sessions WHERE session_id = test_session_id),
        'test.event', 'interaction', '{"test": true}', test_route_plan_id
    );
    
    -- Test score computation log
    INSERT INTO score_computation_logs (
        route_plan_id, session_id, time_weight, cost_weight, risk_weight,
        time_raw_value, cost_raw_value, risk_raw_value,
        time_contribution, cost_contribution, risk_contribution,
        total_numeric_score, letter_grade
    ) VALUES (
        test_route_plan_id, 
        (SELECT id FROM route_planning_sessions WHERE session_id = test_session_id),
        0.4, 0.35, 0.25, 80, 75, 90, 32, 26.25, 22.5, 85, 'A'
    );
    
    RAISE NOTICE '✅ Telemetry workflow test successful';
    
    -- Clean up test data
    DELETE FROM route_telemetry_events WHERE session_id = (SELECT id FROM route_planning_sessions WHERE session_id = test_session_id);
    DELETE FROM score_computation_logs WHERE session_id = (SELECT id FROM route_planning_sessions WHERE session_id = test_session_id);
    DELETE FROM shipment_route_plans WHERE shipment_id = test_shipment_id;
    DELETE FROM route_planning_sessions WHERE session_id = test_session_id;
    DELETE FROM shipments WHERE id = test_shipment_id;
    DELETE FROM logistics_contacts WHERE email IN ('sender@test.com', 'buyer@test.com');
    
END $$;

-- Final system status
\echo ''
\echo '🎯 System Status Summary:'
SELECT 
    'Route Planning System' as component,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (
                'shipment_route_plans', 'shipment_route_legs', 'route_guardrails', 
                'route_financial_snapshots', 'route_planning_sessions', 'route_telemetry_events'
            )
        ) = 6 THEN '✅ OPERATIONAL'
        ELSE '❌ INCOMPLETE'
    END as status,
    NOW() as checked_at;

\echo ''
\echo '=================================================='
\echo '✅ Route Planning System Validation Complete'
\echo '=================================================='
