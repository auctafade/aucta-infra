-- WG System Sample Data
-- Sprint 8: Populate database with realistic test data

-- ====================
-- WG OPERATORS
-- ====================

INSERT INTO wg_operators (
    operator_code, name, email, phone,
    max_value_clearance, languages, area_coverage, vehicle_type,
    rating, total_jobs, successful_jobs, status,
    insurance_policy_number, insurance_expiry, background_check_date,
    special_skills
) VALUES 
(
    'WG001', 'Elena Rodriguez', 'elena.rodriguez@aucta.com', '+1-555-0101',
    500000, '{"English", "Spanish"}', '{"Manhattan", "Brooklyn", "Queens"}', 'van',
    4.8, 127, 122, 'active',
    'INS-WG001-2024', '2024-12-31', '2024-01-15',
    '{"High-value handling", "Delicate textiles", "International protocols"}'
),
(
    'WG002', 'Marcus Chen', 'marcus.chen@aucta.com', '+1-555-0102',
    300000, '{"English", "Mandarin"}', '{"Manhattan", "Newark", "Hoboken"}', 'car',
    4.6, 89, 84, 'active',
    'INS-WG002-2024', '2024-11-30', '2024-01-10',
    '{"High-value handling", "Electronics", "Art transport"}'
),
(
    'WG003', 'Sarah Johnson', 'sarah.johnson@aucta.com', '+1-555-0103',
    750000, '{"English", "French"}', '{"Manhattan", "Brooklyn", "Staten Island"}', 'van',
    4.9, 156, 153, 'active',
    'INS-WG003-2024', '2025-01-31', '2024-01-20',
    '{"High-value handling", "Jewelry specialist", "VIP client relations"}'
),
(
    'WG004', 'David Kim', 'david.kim@aucta.com', '+1-555-0104',
    400000, '{"English", "Korean"}', '{"Queens", "Bronx", "Long Island"}', 'car',
    4.5, 73, 70, 'active',
    'INS-WG004-2024', '2024-10-31', '2024-01-05',
    '{"High-value handling", "Watches", "Automotive collectibles"}'
),
(
    'WG005', 'Isabella Santos', 'isabella.santos@aucta.com', '+1-555-0105',
    600000, '{"English", "Portuguese", "Spanish"}', '{"Manhattan", "Brooklyn", "Newark"}', 'van',
    4.7, 98, 94, 'active',
    'INS-WG005-2024', '2025-02-28', '2024-01-12',
    '{"High-value handling", "Art transport", "Museum protocols", "International shipping"}'
);

-- ====================
-- WG SHIPMENTS
-- ====================

INSERT INTO wg_shipments (
    shipment_code, product_name, product_category, declared_value, tier_level,
    sender_name, sender_address, sender_phone, sender_time_window, sender_timezone,
    buyer_name, buyer_address, buyer_phone, buyer_time_window, buyer_timezone,
    hub_location, hub_timezone, sla_deadline, priority,
    estimated_distance_km, estimated_duration_minutes, route_legs,
    special_instructions, requires_insurance_verification, requires_liveness_check,
    status
) VALUES 
(
    'SH001', 'Hermès Birkin Bag', 'handbags', 12500000, 2,
    'Alice Thompson', '432 Park Ave, Manhattan, NY 10022', '+1-555-1001', '10:00-14:00', 'America/New_York',
    'Victoria Castellano', '820 Fifth Ave, Manhattan, NY 10065', '+1-555-1002', '16:00-20:00', 'America/New_York',
    'AUCTA Hub - Newark', 'America/New_York', '2024-01-17 20:00:00', 'standard',
    25, 90, '[{"from": "Manhattan Pickup", "to": "Newark Hub", "distance": 25, "duration": 45, "mode": "drive"}, {"from": "Newark Hub", "to": "Manhattan Delivery", "distance": 25, "duration": 45, "mode": "drive"}]',
    'Handle with extreme care. Avoid direct sunlight. Client prefers morning pickup.', true, true,
    'pending_assignment'
),
(
    'SH002', 'Patek Philippe Nautilus', 'watches', 8500000, 2,
    'James Wilson', '15 Central Park West, Manhattan, NY 10023', '+1-555-1003', '09:00-12:00', 'America/New_York',
    'Catherine Liu', '1 Wall Street, Manhattan, NY 10005', '+1-555-1004', '14:00-18:00', 'America/New_York',
    'AUCTA Hub - Newark', 'America/New_York', '2024-01-16 18:00:00', 'urgent',
    15, 60, '[{"from": "Central Park West", "to": "Newark Hub", "distance": 15, "duration": 30, "mode": "drive"}, {"from": "Newark Hub", "to": "Wall Street", "distance": 20, "duration": 30, "mode": "drive"}]',
    'Temperature sensitive. Keep in provided case. Buyer works until 6 PM.', true, true,
    'pending_assignment'
),
(
    'SH003', 'Patek Philippe Grand Complication', 'watches', 95000000, 3,
    'Robert Sterling', '740 Park Avenue, Manhattan, NY 10021', '+1-555-1005', '11:00-15:00', 'America/New_York',
    'Alexander Petrov', '220 Central Park South, Manhattan, NY 10019', '+1-555-1006', '17:00-21:00', 'America/New_York',
    'AUCTA Hub - Newark', 'America/New_York', '2024-01-16 21:00:00', 'critical',
    12, 75, '[{"from": "Park Avenue", "to": "Newark Hub", "distance": 12, "duration": 35, "mode": "drive"}, {"from": "Newark Hub", "to": "Central Park South", "distance": 15, "duration": 40, "mode": "drive"}]',
    'TIER 3: Requires armed escort approval. Swiss customs documentation included. Buyer prefers evening delivery for discretion.', true, true,
    'pending_assignment'
),
(
    'SH004', 'Vintage Rolex Daytona Paul Newman', 'watches', 1800000, 2,
    'Michael Torres', '200 Amsterdam Ave, Manhattan, NY 10023', '+1-555-1007', '13:00-17:00', 'America/New_York',
    'Jennifer Walsh', '55 Wall Street, Manhattan, NY 10005', '+1-555-1008', '09:00-13:00', 'America/New_York',
    'AUCTA Hub - Newark', 'America/New_York', '2024-01-17 13:00:00', 'standard',
    18, 65, '[{"from": "Amsterdam Ave", "to": "Newark Hub", "distance": 18, "duration": 30, "mode": "drive"}, {"from": "Newark Hub", "to": "Wall Street", "distance": 20, "duration": 35, "mode": "drive"}]',
    'Collector piece. Requires white gloves. Original box and papers included.', false, true,
    'pending_assignment'
),
(
    'SH005', 'Cartier Panthère de Cartier', 'jewelry', 4500000, 1,
    'Sophie Dubois', '625 Madison Ave, Manhattan, NY 10022', '+1-555-1009', '10:00-16:00', 'America/New_York',
    'Maria Garcia', '100 Barclay Street, Manhattan, NY 10007', '+1-555-1010', '12:00-18:00', 'America/New_York',
    'AUCTA Hub - Newark', 'America/New_York', '2024-01-16 18:00:00', 'standard',
    22, 70, '[{"from": "Madison Ave", "to": "Newark Hub", "distance": 22, "duration": 35, "mode": "drive"}, {"from": "Newark Hub", "to": "Barclay Street", "distance": 25, "duration": 35, "mode": "drive"}]',
    'Gift for anniversary. Include congratulatory note. Buyer prefers afternoon delivery.', false, false,
    'pending_assignment'
);

-- ====================
-- HUB CAPACITY SLOTS
-- ====================

-- Authenticator capacity (Tier 1 & 2)
INSERT INTO hub_capacity_slots (
    hub_location, capacity_type, tier_level, slot_date, start_time, end_time, timezone,
    max_capacity, current_bookings, is_available
) VALUES 
('AUCTA Hub - Newark', 'authenticator', 1, '2024-01-16', '09:00:00', '11:00:00', 'America/New_York', 3, 0, true),
('AUCTA Hub - Newark', 'authenticator', 1, '2024-01-16', '11:00:00', '13:00:00', 'America/New_York', 3, 1, true),
('AUCTA Hub - Newark', 'authenticator', 1, '2024-01-16', '13:00:00', '15:00:00', 'America/New_York', 3, 0, true),
('AUCTA Hub - Newark', 'authenticator', 1, '2024-01-16', '15:00:00', '17:00:00', 'America/New_York', 3, 2, true),
('AUCTA Hub - Newark', 'authenticator', 2, '2024-01-16', '10:00:00', '12:00:00', 'America/New_York', 2, 0, true),
('AUCTA Hub - Newark', 'authenticator', 2, '2024-01-16', '14:00:00', '16:00:00', 'America/New_York', 2, 1, true),
('AUCTA Hub - Newark', 'authenticator', 2, '2024-01-16', '16:00:00', '18:00:00', 'America/New_York', 2, 0, true);

-- Sewing capacity (Tier 3)
INSERT INTO hub_capacity_slots (
    hub_location, capacity_type, tier_level, slot_date, start_time, end_time, timezone,
    max_capacity, current_bookings, is_available
) VALUES 
('AUCTA Hub - Newark', 'sewing', 3, '2024-01-16', '10:00:00', '12:00:00', 'America/New_York', 1, 0, true),
('AUCTA Hub - Newark', 'sewing', 3, '2024-01-16', '14:00:00', '16:00:00', 'America/New_York', 1, 0, true),
('AUCTA Hub - Newark', 'sewing', 3, '2024-01-16', '16:00:00', '18:00:00', 'America/New_York', 1, 1, false);

-- Next day capacity
INSERT INTO hub_capacity_slots (
    hub_location, capacity_type, tier_level, slot_date, start_time, end_time, timezone,
    max_capacity, current_bookings, is_available
) VALUES 
('AUCTA Hub - Newark', 'authenticator', 1, '2024-01-17', '09:00:00', '11:00:00', 'America/New_York', 3, 0, true),
('AUCTA Hub - Newark', 'authenticator', 1, '2024-01-17', '11:00:00', '13:00:00', 'America/New_York', 3, 0, true),
('AUCTA Hub - Newark', 'authenticator', 2, '2024-01-17', '10:00:00', '12:00:00', 'America/New_York', 2, 0, true),
('AUCTA Hub - Newark', 'sewing', 3, '2024-01-17', '10:00:00', '12:00:00', 'America/New_York', 1, 0, true);

-- ====================
-- SAMPLE ASSIGNMENTS (Historical)
-- ====================

-- Create a sample completed assignment
INSERT INTO wg_assignments (
    shipment_id, operator_id, assigned_by, assignment_type,
    pickup_scheduled_at, hub_arrival_scheduled_at, hub_departure_scheduled_at, delivery_scheduled_at,
    pickup_otp, hub_intake_otp, delivery_otp, seal_id,
    status, actual_pickup_at, actual_hub_arrival_at, actual_hub_departure_at, actual_delivery_at,
    liveness_check_pickup, liveness_check_hub, liveness_check_delivery,
    operator_notes
) VALUES (
    1, 3, 'admin_user_001', 'direct',
    '2024-01-15 10:30:00', '2024-01-15 11:45:00', '2024-01-15 13:00:00', '2024-01-15 14:30:00',
    '123456', '789012', '345678', NULL,
    'delivered', 
    '2024-01-15 10:35:00', '2024-01-15 11:50:00', '2024-01-15 13:05:00', '2024-01-15 14:25:00',
    true, true, true,
    'Smooth pickup and delivery. Client very satisfied with service. No issues encountered.'
);

-- Update the assigned shipment status
UPDATE wg_shipments SET status = 'delivered' WHERE id = 1;

-- ====================
-- SAMPLE SOURCING REQUESTS
-- ====================

INSERT INTO wg_sourcing_requests (
    shipment_id, requested_by, sla_target_at,
    required_cities, min_value_clearance, max_distance_km, urgency_level,
    status
) VALUES (
    3, 'ops_manager_002', '2024-01-16 19:00:00',
    '{"Manhattan", "Brooklyn"}', 95000000, 50, 'premium',
    'broadcast_sent'
);

-- ====================
-- SAMPLE TELEMETRY EVENTS
-- ====================

INSERT INTO wg_telemetry_events (
    event_type, shipment_id, operator_id, user_id, session_id,
    event_data, duration_ms, score_value,
    user_agent, ip_address
) VALUES 
(
    'wg.view.open', 1, NULL, 'user_001', 'session_12345',
    '{"page": "assignment", "referrer": "dashboard"}', NULL, NULL,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '192.168.1.100'
),
(
    'wg.operator.suggested', 1, 3, 'user_001', 'session_12345',
    '{"factors": {"proximity": 25, "language": 20, "valueClearance": 30, "rating": 15, "availability": 10}}', NULL, 92.5,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '192.168.1.100'
),
(
    'wg.confirm.time_ms', 1, 3, 'user_001', 'session_12345',
    '{"stages": {"operatorSelection": 45000, "scheduling": 60000, "validation": 30000, "chainOfCustody": 25000}}', 160000, NULL,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '192.168.1.100'
),
(
    'wg.time_to_assign_ms', 1, 3, 'user_001', 'session_12345',
    '{"planCreatedAt": "2024-01-15 09:00:00", "assignedAt": "2024-01-15 10:00:00"}', 3600000, NULL,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '192.168.1.100'
);

-- ====================
-- SAMPLE PERFORMANCE METRICS
-- ====================

INSERT INTO wg_performance_metrics (
    metric_date, metric_hour,
    total_assignments, avg_assignment_time_ms, assignments_under_2min, assignments_over_5min,
    total_conflicts, window_conflicts, travel_conflicts, hub_conflicts, calendar_conflicts,
    avg_operator_score, operator_utilization_rate,
    sla_met_count, sla_missed_count, avg_sla_margin_minutes
) VALUES 
(
    '2024-01-15', 10,
    5, 145000, 2, 1,
    3, 1, 1, 1, 0,
    88.5, 0.65,
    4, 1, 45
),
(
    '2024-01-15', 11,
    3, 120000, 2, 0,
    1, 0, 0, 1, 0,
    91.2, 0.50,
    3, 0, 60
);

-- ====================
-- SAMPLE CONSTRAINT LOGS
-- ====================

INSERT INTO wg_constraint_logs (
    shipment_id, constraint_type, constraint_description, violation_severity,
    resolution_action, resolved_by, is_override, override_reason
) VALUES 
(
    2, 'hub_hold_expiry', 'Hub authenticator capacity hold expired during scheduling', 'warning',
    'Used alternative time slot', 'user_001', false, NULL
),
(
    3, 'sla_deadline', 'Proposed schedule would miss SLA deadline by 15 minutes', 'error',
    'Ops admin override approved', 'ops_manager_002', true, 'Client priority request - premium service exception'
);

-- ====================
-- SAMPLE AUDIT TRAIL
-- ====================

INSERT INTO wg_audit_trail (
    action_type, user_id, user_role, session_id,
    shipment_id, operator_id, action_details, target_resource,
    success, ip_address, user_agent
) VALUES 
(
    'wg.assignment.create', 'user_001', 'ops_admin', 'session_12345',
    1, 3, '{"assignment_type": "direct", "pickup_scheduled": "2024-01-15 10:30:00"}', '/api/wg/assignments',
    true, '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
),
(
    'wg.sla.override', 'ops_manager_002', 'ops_admin', 'session_67890',
    3, NULL, '{"reason": "Client priority request", "original_deadline": "2024-01-16 21:00:00", "new_margin": -15}', '/api/wg/constraints/violations',
    true, '192.168.1.101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
),
(
    'wg.otp.view', 'wg_operator_003', 'wg_operator', 'session_11111',
    1, 3, '{"otp_type": "pickup", "masked_code": "***456"}', '/api/wg/assignments/1',
    true, '10.0.1.50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
);

-- ====================
-- USER SESSIONS
-- ====================

INSERT INTO wg_user_sessions (
    user_id, session_id, user_role,
    login_at, last_activity, ip_address,
    actions_performed, assignments_created, overrides_used,
    user_agent
) VALUES 
(
    'user_001', 'session_12345', 'ops_admin',
    '2024-01-15 08:30:00', '2024-01-15 11:45:00', '192.168.1.100',
    12, 1, 0,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
),
(
    'ops_manager_002', 'session_67890', 'ops_admin',
    '2024-01-15 09:00:00', '2024-01-15 16:30:00', '192.168.1.101',
    25, 3, 1,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
),
(
    'wg_operator_003', 'session_11111', 'wg_operator',
    '2024-01-15 10:00:00', '2024-01-15 15:00:00', '10.0.1.50',
    8, 0, 0,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
);

-- ====================
-- UPDATE OPERATOR STATS
-- ====================

UPDATE wg_operators SET total_jobs = total_jobs + 1, successful_jobs = successful_jobs + 1 WHERE id = 3;
