#!/usr/bin/env node

// Script to run the contacts management system migration
const fs = require('fs');
const path = require('path');
const pool = require('../database/connection');

async function runContactsMigration() {
  console.log('🚀 Starting Contacts Management System migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/sprint8/030_contacts_management_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📂 Migration file loaded successfully');
    
    // Execute the migration
    console.log('⚡ Executing migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Contacts Management System migration completed successfully!');
    console.log('');
    console.log('📊 Migration includes:');
    console.log('  • contacts table with KYC, versioning, and role-based features');
    console.log('  • contact_addresses for multiple addresses per contact');
    console.log('  • contact_preferences for communication settings');
    console.log('  • contact_logistics for WG operators and hub contacts');
    console.log('  • contact_shipment_history for shipment tracking');
    console.log('  • contact_versions for complete audit trail');
    console.log('  • contact_notes for internal communications');
    console.log('  • contact_duplicates for deduplication');
    console.log('  • contact_events for system integration');
    console.log('  • contact_telemetry for analytics');
    console.log('');
    console.log('🔗 Integration features:');
    console.log('  • Migrated existing logistics_contacts data');
    console.log('  • Foreign key relationships to logistics_hubs');
    console.log('  • Sample WG operators and hub contacts');
    console.log('  • Automatic triggers for versioning and audit');
    console.log('');
    console.log('🎯 Ready for production use!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runContactsMigration().catch(console.error);
}

module.exports = runContactsMigration;
