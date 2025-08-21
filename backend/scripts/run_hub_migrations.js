#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database configuration - using port 5433 as specified in memory
const dbConfig = {
  user: process.env.DB_USER || 'thiswillnotfade',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'aucta_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5433,
};

console.log('🔗 Connecting to database:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user
});

async function runMigrations() {
  const pool = new Pool(dbConfig);
  
  try {
    // Test connection
    console.log('🧪 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Check if logistics tables exist
    const logisticsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'logistics_hubs'
      )
    `);

    if (!logisticsCheck.rows[0].exists) {
      console.log('📋 Running logistics system migration...');
      const logisticsMigration = await fs.readFile(
        path.join(__dirname, '../database/migrations/sprint8/001_logistics_system.sql'),
        'utf8'
      );
      await pool.query(logisticsMigration);
      console.log('✅ Logistics system migration completed');
    } else {
      console.log('⏭️  Logistics system already exists, skipping...');
    }

    // Check if WG tables exist
    const wgCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'wg_operators'
      )
    `);

    if (!wgCheck.rows[0].exists) {
      console.log('📋 Running WG system migration...');
      const wgMigration = await fs.readFile(
        path.join(__dirname, '../database/migrations/sprint8/010_wg_complete_system.sql'),
        'utf8'
      );
      await pool.query(wgMigration);
      console.log('✅ WG system migration completed');
    } else {
      console.log('⏭️  WG system already exists, skipping...');
    }

    // Check if hub inventory tables exist
    const hubCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'hub_processing_jobs'
      )
    `);

    if (!hubCheck.rows[0].exists) {
      console.log('📋 Running hub inventory system migration...');
      const hubMigration = await fs.readFile(
        path.join(__dirname, '../database/migrations/sprint8/020_hub_inventory_system.sql'),
        'utf8'
      );
      await pool.query(hubMigration);
      console.log('✅ Hub inventory system migration completed');
    } else {
      console.log('⏭️  Hub inventory system already exists, skipping...');
    }

    // Verify tables exist
    console.log('🔍 Verifying tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%hub%' OR table_name LIKE '%inventory%'
      ORDER BY table_name
    `);
    
    console.log('📊 Found tables:', tables.rows.map(row => row.table_name));

    // Insert sample hub processing jobs
    console.log('📝 Creating sample hub processing jobs...');
    
    // First, get hub IDs
    const hubsResult = await pool.query('SELECT id, hub_code FROM logistics_hubs LIMIT 2');
    const hubs = hubsResult.rows;
    
    if (hubs.length === 0) {
      console.log('⚠️  No hubs found, skipping sample data');
    } else {
      console.log('🏢 Found hubs:', hubs.map(h => `${h.hub_code} (ID: ${h.id})`));
      
      // Create sample shipments first
      const sampleShipments = [
        {
          shipment_id: 'SH-2024-001',
          reference_sku: 'LV-BAG-001',
          declared_value: 2500.00,
          weight: 1.2,
          length_cm: 35.0,
          width_cm: 25.0,
          height_cm: 15.0,
          brand: 'Louis Vuitton',
          category: 'Handbags',
          tier: 'premium'
        },
        {
          shipment_id: 'SH-2024-002',
          reference_sku: 'ROL-WATCH-001',
          declared_value: 8500.00,
          weight: 0.3,
          length_cm: 15.0,
          width_cm: 15.0,
          height_cm: 8.0,
          brand: 'Rolex',
          category: 'Watches',
          tier: 'platinum'
        },
        {
          shipment_id: 'SH-2024-003',
          reference_sku: 'HER-SCARF-001',
          declared_value: 650.00,
          weight: 0.1,
          length_cm: 20.0,
          width_cm: 20.0,
          height_cm: 2.0,
          brand: 'Hermès',
          category: 'Accessories',
          tier: 'standard'
        }
      ];

      // Create contacts and shipments
      for (const shipment of sampleShipments) {
        try {
          // Create sender
          const senderResult = await pool.query(`
            INSERT INTO logistics_contacts (
              full_name, email, phone, street_address, city, country, contact_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [
            `Sender for ${shipment.reference_sku}`,
            `sender-${shipment.shipment_id.toLowerCase()}@example.com`,
            '+33123456789',
            '123 Luxury Street',
            'Paris',
            'France',
            'sender'
          ]);

          // Create buyer
          const buyerResult = await pool.query(`
            INSERT INTO logistics_contacts (
              full_name, email, phone, street_address, city, country, contact_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [
            `Buyer for ${shipment.reference_sku}`,
            `buyer-${shipment.shipment_id.toLowerCase()}@example.com`,
            '+44987654321',
            '456 Collector Avenue',
            'London',
            'United Kingdom',
            'buyer'
          ]);

          // Create shipment
          await pool.query(`
            INSERT INTO shipments (
              shipment_id, reference_sku, declared_value, weight, length_cm, width_cm, height_cm,
              brand, category, tier, sender_id, buyer_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            shipment.shipment_id,
            shipment.reference_sku,
            shipment.declared_value,
            shipment.weight,
            shipment.length_cm,
            shipment.width_cm,
            shipment.height_cm,
            shipment.brand,
            shipment.category,
            shipment.tier,
            senderResult.rows[0].id,
            buyerResult.rows[0].id,
            'classified'
          ]);

          // Create hub processing job
          const tier = shipment.tier === 'standard' ? 2 : 3;
          const hubId = hubs[Math.floor(Math.random() * hubs.length)].id;
          const now = new Date();
          const plannedIntake = new Date(now.getTime() + Math.random() * 24 * 60 * 60 * 1000); // Random time in next 24 hours
          const slaDeadline = new Date(plannedIntake.getTime() + 72 * 60 * 60 * 1000); // 3 days after intake

          await pool.query(`
            INSERT INTO hub_processing_jobs (
              shipment_id, hub_id, tier, product_category, declared_value,
              planned_intake_time, sla_deadline, priority, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            shipment.shipment_id,
            hubId,
            tier,
            shipment.category,
            shipment.declared_value,
            plannedIntake.toISOString(),
            slaDeadline.toISOString(),
            shipment.declared_value > 5000 ? 'high' : 'normal',
            Math.random() > 0.5 ? 'awaiting_intake' : 'in_progress'
          ]);

          console.log(`✅ Created hub job for ${shipment.shipment_id} (Tier ${tier}) at hub ${hubId}`);
        } catch (error) {
          if (error.code === '23505') { // Unique constraint violation
            console.log(`⏭️  Sample data for ${shipment.shipment_id} already exists, skipping...`);
          } else {
            throw error;
          }
        }
      }
    }

    // Verify the data
    const jobCount = await pool.query('SELECT COUNT(*) FROM hub_processing_jobs');
    const tagCount = await pool.query('SELECT COUNT(*) FROM inventory_tags');
    const nfcCount = await pool.query('SELECT COUNT(*) FROM inventory_nfc');

    console.log('\n📊 Database Summary:');
    console.log(`   Hub Processing Jobs: ${jobCount.rows[0].count}`);
    console.log(`   Inventory Tags: ${tagCount.rows[0].count}`);
    console.log(`   Inventory NFC: ${nfcCount.rows[0].count}`);
    console.log(`   Logistics Hubs: ${hubs.length}`);

    console.log('\n🎉 Hub Console database setup completed successfully!');
    console.log('🔗 The Hub Console at /sprint-8/logistics/hub is now connected to real data');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch(console.error);
}

module.exports = { runMigrations };
