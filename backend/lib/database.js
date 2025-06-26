// lib/database.js
const { Pool } = require('pg');

// Database configuration for AUCTA user
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,  // Updated to match Postgres.app
  database: process.env.DB_NAME || 'aucta_db',
  user: process.env.DB_USER || 'thiswillnotfade',  // Your current user
  password: process.env.DB_PASSWORD || '',
  // Additional options for better connection handling
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
  allowExitOnIdle: true
});

// Test connection and create tables if needed
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.stack);
    console.error('Make sure PostgreSQL is running and AUCTA user has access');
  } else {
    console.log('✅ Connected to PostgreSQL database as user:', client.user);
    console.log('📊 Database:', client.database);
    
    // Check if tables exist
    client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('clients', 'passports', 'sbts', 'action_logs')
    `, (err, result) => {
      if (err) {
        console.error('Error checking tables:', err);
      } else {
        console.log('📋 Existing tables:', result.rows.map(r => r.table_name).join(', ') || 'None');
        if (result.rows.length === 0) {
          console.log('⚠️  No tables found. Run: psql -U AUCTA -d aucta_db -f create_tables.sql');
        }
      }
      release();
    });
  }
});

// Error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;