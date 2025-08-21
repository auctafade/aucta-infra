#!/usr/bin/env node
// scripts/run_wg_migrations.js
// Run WG system database migrations and populate sample data

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - note the custom port 5433
const dbConfig = {
  user: process.env.DB_USER || 'thiswillnotfade',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'aucta_db',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5433, // Custom port as noted in memory
};

async function runMigrations() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🚀 Starting WG system database migrations...');
    console.log(`📍 Connecting to database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();
    
    // Migration files in order
    const migrationFiles = [
      '010_wg_complete_system.sql',
      '011_wg_sample_data.sql'
    ];
    
    const migrationsDir = path.join(__dirname, '../database/migrations/sprint8');
    
    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationsDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Migration file not found: ${fileName}`);
        continue;
      }
      
      console.log(`📄 Running migration: ${fileName}`);
      
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`✅ Migration completed: ${fileName}`);
      } catch (error) {
        console.error(`❌ Migration failed: ${fileName}`);
        console.error('Error:', error.message);
        
        // Continue with next migration (non-fatal)
        if (error.message.includes('already exists')) {
          console.log('   (Table already exists - skipping)');
        } else {
          throw error;
        }
      }
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying WG system tables...');
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'wg_%'
      ORDER BY table_name;
    `;
    
    const result = await pool.query(tableCheckQuery);
    
    if (result.rows.length > 0) {
      console.log('✅ WG Tables created successfully:');
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  No WG tables found');
    }
    
    // Check sample data
    console.log('\n📊 Checking sample data...');
    const dataQueries = [
      { name: 'WG Operators', query: 'SELECT COUNT(*) as count FROM wg_operators;' },
      { name: 'WG Shipments', query: 'SELECT COUNT(*) as count FROM wg_shipments;' },
      { name: 'Hub Capacity Slots', query: 'SELECT COUNT(*) as count FROM hub_capacity_slots;' },
      { name: 'Telemetry Events', query: 'SELECT COUNT(*) as count FROM wg_telemetry_events;' }
    ];
    
    for (const { name, query } of dataQueries) {
      try {
        const result = await pool.query(query);
        const count = result.rows[0].count;
        console.log(`   ${name}: ${count} records`);
      } catch (error) {
        console.log(`   ${name}: Table not found or error`);
      }
    }
    
    console.log('\n🎉 WG system migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start the backend server: npm start');
    console.log('   2. Access WG API at: http://localhost:4000/api/wg/health');
    console.log('   3. View operators at: http://localhost:4000/api/wg/operators');
    console.log('   4. View pending shipments at: http://localhost:4000/api/wg/shipments/pending');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check if PostgreSQL is running on port 5433');
    console.error('   2. Verify database connection settings');
    console.error('   3. Ensure database "aucta" exists');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Self-executing function
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
