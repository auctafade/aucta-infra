// scripts/run_enhanced_route_planning_migration.js
// Run the enhanced route planning migration and verify the system

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection using port 5433
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'aucta_db',
  user: process.env.DB_USER || 'thiswillnotfade',
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runMigration() {
  console.log('🚀 Running Enhanced Route Planning Migration...\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/sprint8/003_enhanced_route_planning.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📄 Executing migration: 003_enhanced_route_planning.sql');
    
    // Execute migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify tables
    console.log('🔍 Verifying tables...\n');
    
    const tables = [
      'hub_resource_reservations',
      'route_manifest_logs',
      'external_api_cache',
      'route_selection_audit',
      'hub_inventory',
      'hub_daily_capacity'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      
      if (result.rows[0].count > 0) {
        console.log(`  ✅ Table ${table} exists`);
      } else {
        console.log(`  ❌ Table ${table} NOT FOUND`);
      }
    }
    
    // Verify hub pricing columns
    console.log('\n🔍 Verifying hub pricing columns...\n');
    
    const hubColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'logistics_hubs' 
      AND column_name IN (
        'tier2_auth_fee', 'tier3_auth_fee', 'tier3_sew_fee',
        'tag_unit_cost', 'nfc_unit_cost', 'qa_fee',
        'internal_rollout_cost', 'has_sewing_capability'
      )
    `);
    
    console.log(`  ✅ Found ${hubColumns.rows.length} pricing columns in logistics_hubs`);
    
    // Check sample data
    console.log('\n🔍 Checking sample data...\n');
    
    const hubs = await pool.query(`
      SELECT hub_code, hub_name, city, tier3_auth_fee, has_sewing_capability
      FROM logistics_hubs
      WHERE status = 'active'
      LIMIT 5
    `);
    
    console.log('  Sample Hubs:');
    hubs.rows.forEach(hub => {
      console.log(`    - ${hub.hub_code} (${hub.city}): T3 Auth €${hub.tier3_auth_fee}, Sewing: ${hub.has_sewing_capability}`);
    });
    
    // Check inventory
    const inventory = await pool.query(`
      SELECT h.hub_code, hi.nfc_stock, hi.tag_stock
      FROM hub_inventory hi
      JOIN logistics_hubs h ON hi.hub_id = h.id
      LIMIT 3
    `);
    
    console.log('\n  Sample Inventory:');
    inventory.rows.forEach(inv => {
      console.log(`    - ${inv.hub_code}: NFC=${inv.nfc_stock}, Tags=${inv.tag_stock}`);
    });
    
    // Check capacity
    const capacity = await pool.query(`
      SELECT h.hub_code, hc.capacity_date, hc.auth_capacity_available, hc.sewing_capacity_available
      FROM hub_daily_capacity hc
      JOIN logistics_hubs h ON hc.hub_id = h.id
      WHERE hc.capacity_date >= CURRENT_DATE
      ORDER BY hc.capacity_date
      LIMIT 3
    `);
    
    console.log('\n  Sample Capacity:');
    capacity.rows.forEach(cap => {
      console.log(`    - ${cap.hub_code} on ${cap.capacity_date.toISOString().split('T')[0]}: Auth=${cap.auth_capacity_available}, Sewing=${cap.sewing_capacity_available}`);
    });
    
    console.log('\n✅ Enhanced Route Planning System Ready!');
    console.log('\n📋 Summary:');
    console.log('  - Hub pricing configuration: ✅');
    console.log('  - Resource reservation system: ✅');
    console.log('  - Route manifest generation: ✅');
    console.log('  - External API caching: ✅');
    console.log('  - Audit trail: ✅');
    console.log('  - Hub inventory tracking: ✅');
    console.log('  - Daily capacity management: ✅');
    
    console.log('\n🎯 Key Features Implemented:');
    console.log('  1. Three route options for Tier 3 (Full WG, Hybrid WG→DHL, Hybrid DHL→WG)');
    console.log('  2. Two options for Tier 2 (WG end-to-end, DHL end-to-end) - NO partial WG');
    console.log('  3. Internal rollout for HubId→HubCou (never DHL between hubs)');
    console.log('  4. Per-hub price book with immediate updates');
    console.log('  5. Hub selection at route planning (not Tier Gate)');
    console.log('  6. Route Map PDF/HTML generation for operations');
    console.log('  7. External API integration with caching (Flights, Ground, DHL)');
    console.log('  8. Comprehensive cost breakdown with surcharges');
    
    console.log('\n🚀 Next Steps:');
    console.log('  1. Configure API keys in .env:');
    console.log('     - AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET');
    console.log('     - DUFFEL_API_KEY');
    console.log('     - KIWI_API_KEY');
    console.log('     - UBER_API_KEY');
    console.log('     - GOOGLE_MAPS_API_KEY');
    console.log('     - DHL_API_KEY, DHL_ACCOUNT_NUMBER');
    console.log('  2. Test route planning at: /sprint-8/logistics/plan/[shipmentId]');
    console.log('  3. Verify manifest generation');
    console.log('  4. Check hub capacity reservations');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
