// scripts/setup_route_planning_simple.js
// Simple step-by-step setup for route planning system

const { Pool } = require('pg');
require('dotenv').config();

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

async function setupStep(stepName, sql) {
  try {
    console.log(`⏳ ${stepName}...`);
    await pool.query(sql);
    console.log(`✅ ${stepName} completed\n`);
  } catch (error) {
    if (error.code === '42701' || error.code === '42P07' || error.code === '23505') {
      console.log(`⚠️  ${stepName} - Already exists, skipping\n`);
    } else {
      console.error(`❌ ${stepName} failed:`, error.message);
      console.log('');
    }
  }
}

async function setupRouteSystem() {
  console.log('🚀 Setting up Enhanced Route Planning System...\n');
  
  try {
    // Step 1: Add pricing columns to logistics_hubs
    await setupStep('Adding pricing columns to logistics_hubs', `
      ALTER TABLE logistics_hubs 
      ADD COLUMN tier2_auth_fee DECIMAL(10,2) DEFAULT 75,
      ADD COLUMN tier3_auth_fee DECIMAL(10,2) DEFAULT 100,
      ADD COLUMN tier3_sew_fee DECIMAL(10,2) DEFAULT 150,
      ADD COLUMN tag_unit_cost DECIMAL(10,2) DEFAULT 5,
      ADD COLUMN nfc_unit_cost DECIMAL(10,2) DEFAULT 25,
      ADD COLUMN qa_fee DECIMAL(10,2) DEFAULT 50,
      ADD COLUMN internal_rollout_cost DECIMAL(10,2) DEFAULT 25,
      ADD COLUMN has_sewing_capability BOOLEAN DEFAULT TRUE,
      ADD COLUMN operating_hours VARCHAR(20) DEFAULT '08:00-20:00',
      ADD COLUMN time_zone VARCHAR(50) DEFAULT 'Europe/London',
      ADD COLUMN status VARCHAR(20) DEFAULT 'active',
      ADD COLUMN hub_id VARCHAR(50);
    `);

    // Step 2: Update hub_id for existing hubs
    await setupStep('Setting hub_id for existing hubs', `
      UPDATE logistics_hubs 
      SET hub_id = 'HUB-' || UPPER(LEFT(country, 3)) || '-' || hub_code
      WHERE hub_id IS NULL;
    `);

    // Step 3: Add unique constraint on hub_id
    await setupStep('Adding unique constraint on hub_id', `
      ALTER TABLE logistics_hubs 
      ADD CONSTRAINT logistics_hubs_hub_id_unique UNIQUE (hub_id);
    `);

    // Step 4: Create hub_inventory table
    await setupStep('Creating hub_inventory table', `
      CREATE TABLE hub_inventory (
          id SERIAL PRIMARY KEY,
          hub_id INTEGER REFERENCES logistics_hubs(id) UNIQUE,
          nfc_stock INTEGER DEFAULT 100,
          nfc_reserved INTEGER DEFAULT 0,
          nfc_minimum_level INTEGER DEFAULT 10,
          tag_stock INTEGER DEFAULT 200,
          tag_reserved INTEGER DEFAULT 0,
          tag_minimum_level INTEGER DEFAULT 20,
          last_restocked_at TIMESTAMP,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT nfc_stock_check CHECK (nfc_stock >= nfc_reserved),
          CONSTRAINT tag_stock_check CHECK (tag_stock >= tag_reserved)
      );
    `);

    // Step 5: Create hub_daily_capacity table
    await setupStep('Creating hub_daily_capacity table', `
      CREATE TABLE hub_daily_capacity (
          id SERIAL PRIMARY KEY,
          hub_id INTEGER REFERENCES logistics_hubs(id),
          capacity_date DATE NOT NULL,
          
          auth_capacity_total INTEGER DEFAULT 50,
          auth_capacity_available INTEGER DEFAULT 50,
          auth_capacity_reserved INTEGER DEFAULT 0,
          
          sewing_capacity_total INTEGER DEFAULT 20,
          sewing_capacity_available INTEGER DEFAULT 20,
          sewing_capacity_reserved INTEGER DEFAULT 0,
          
          is_holiday BOOLEAN DEFAULT FALSE,
          is_maintenance BOOLEAN DEFAULT FALSE,
          notes TEXT,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          UNIQUE(hub_id, capacity_date),
          CONSTRAINT auth_capacity_check CHECK (auth_capacity_available >= 0),
          CONSTRAINT sewing_capacity_check CHECK (sewing_capacity_available >= 0)
      );
    `);

    // Step 6: Create other required tables
    await setupStep('Creating route_manifest_logs table', `
      CREATE TABLE route_manifest_logs (
          id SERIAL PRIMARY KEY,
          shipment_id INTEGER REFERENCES shipments(id),
          manifest_id VARCHAR(100) UNIQUE NOT NULL,
          route_type VARCHAR(50) NOT NULL,
          pdf_path TEXT,
          html_path TEXT,
          qr_code TEXT,
          generated_by VARCHAR(100) NOT NULL,
          generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accessed_count INTEGER DEFAULT 0,
          last_accessed_at TIMESTAMP,
          last_accessed_by VARCHAR(100)
      );
    `);

    await setupStep('Creating external_api_cache table', `
      CREATE TABLE external_api_cache (
          id SERIAL PRIMARY KEY,
          cache_key VARCHAR(255) UNIQUE NOT NULL,
          api_source VARCHAR(50) NOT NULL,
          cache_type VARCHAR(50) NOT NULL,
          cached_data JSONB NOT NULL,
          ttl_seconds INTEGER NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          hit_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_hit_at TIMESTAMP
      );
    `);

    await setupStep('Creating hub_resource_reservations table', `
      CREATE TABLE hub_resource_reservations (
          id SERIAL PRIMARY KEY,
          shipment_id VARCHAR(100) NOT NULL,
          hub_id INTEGER REFERENCES logistics_hubs(id),
          reservation_type VARCHAR(50) NOT NULL,
          reservation_date DATE NOT NULL,
          resources JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100) DEFAULT 'system',
          cancelled_at TIMESTAMP,
          cancelled_by VARCHAR(100),
          consumed_at TIMESTAMP,
          consumed_by VARCHAR(100)
      );
    `);

    // Step 7: Insert sample inventory data
    await setupStep('Creating inventory records for existing hubs', `
      INSERT INTO hub_inventory (hub_id, nfc_stock, tag_stock, nfc_minimum_level, tag_minimum_level)
      SELECT id, 100, 200, 10, 20 FROM logistics_hubs
      ON CONFLICT (hub_id) DO NOTHING;
    `);

    // Step 8: Insert sample capacity for next 30 days
    await setupStep('Creating capacity records for next 30 days', `
      INSERT INTO hub_daily_capacity (hub_id, capacity_date, auth_capacity_total, auth_capacity_available, sewing_capacity_total, sewing_capacity_available)
      SELECT 
          h.id,
          generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day')::date,
          50, 50, 20, 20
      FROM logistics_hubs h
      ON CONFLICT (hub_id, capacity_date) DO NOTHING;
    `);

    // Step 9: Create indexes
    await setupStep('Creating performance indexes', `
      CREATE INDEX IF NOT EXISTS idx_hub_reservations_shipment ON hub_resource_reservations(shipment_id);
      CREATE INDEX IF NOT EXISTS idx_hub_capacity_date ON hub_daily_capacity(capacity_date);
      CREATE INDEX IF NOT EXISTS idx_api_cache_key ON external_api_cache(cache_key);
      CREATE INDEX IF NOT EXISTS idx_manifest_shipment ON route_manifest_logs(shipment_id);
    `);

    // Step 10: Verify setup
    console.log('🔍 Verifying setup...\n');
    
    const hubsWithPricing = await pool.query(`
      SELECT hub_code, city, tier3_auth_fee, has_sewing_capability, hub_id
      FROM logistics_hubs 
      WHERE tier3_auth_fee IS NOT NULL 
      LIMIT 3
    `);
    
    console.log('  Sample Hubs with Pricing:');
    hubsWithPricing.rows.forEach(hub => {
      console.log(`    - ${hub.hub_code} (${hub.city}): T3 Auth €${hub.tier3_auth_fee}, Sewing: ${hub.has_sewing_capability}, ID: ${hub.hub_id}`);
    });

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

    const capacity = await pool.query(`
      SELECT h.hub_code, COUNT(*) as days_configured
      FROM hub_daily_capacity hc
      JOIN logistics_hubs h ON hc.hub_id = h.id
      WHERE hc.capacity_date >= CURRENT_DATE
      GROUP BY h.hub_code
      LIMIT 3
    `);
    
    console.log('\n  Capacity Configuration:');
    capacity.rows.forEach(cap => {
      console.log(`    - ${cap.hub_code}: ${cap.days_configured} days configured`);
    });

    console.log('\n✅ Enhanced Route Planning System is ready!');
    console.log('\n🎯 Key Features Available:');
    console.log('  - Hub pricing configuration ✅');
    console.log('  - Resource reservations ✅');
    console.log('  - Inventory tracking ✅');
    console.log('  - Capacity management ✅');
    console.log('  - External API caching ✅');
    console.log('  - Route manifests ✅');

    console.log('\n🚀 Ready to test:');
    console.log('  - API endpoint: /api/shipments/[id]/routes');
    console.log('  - Frontend page: /sprint-8/logistics/plan/[shipmentId]');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await pool.end();
  }
}

setupRouteSystem().catch(console.error);
