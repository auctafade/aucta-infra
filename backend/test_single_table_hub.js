#!/usr/bin/env node

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'aucta_db',
  user: 'thiswillnotfade',
  password: ''
});

async function testSingleTableHubSave() {
  console.log('🧪 Testing Single Table Hub Save System');
  console.log('=' .repeat(50));
  
  try {
    // Test creating a complete hub with ALL data in ONE table
    const testHubData = {
      code: 'TST' + Math.floor(Math.random() * 1000),
      name: 'Complete Test Hub',
      location: 'Paris, France',
      timezone: 'Europe/Paris',
      status: 'active',
      address: {
        street: '123 Main Street',
        city: 'Paris',
        state: 'Île-de-France',
        postal_code: '75001',
        country: 'France'
      },
      contact_info: {
        name: 'Pierre Dubois',
        email: 'pierre@example.com',
        phone: '+33123456789'
      },
      roles: ['authenticator', 'couturier'],
      pricing: {
        currency: 'EUR',
        tier2_auth_fee: 150,
        tag_unit_cost: 5,
        tier3_auth_fee: 200,
        nfc_unit_cost: 3,
        sew_fee: 50,
        qa_fee: 25,
        internal_rollout_cost: 100
      },
      capacity: {
        auth_capacity: 100,
        sewing_capacity: 50,
        qa_capacity: 75,
        working_days: 5,
        working_hours_start: '09:00',
        working_hours_end: '17:00'
      },
      operating_hours: {
        monday: {open: '09:00', close: '17:00', closed: false},
        tuesday: {open: '09:00', close: '17:00', closed: false},
        wednesday: {open: '09:00', close: '17:00', closed: false},
        thursday: {open: '09:00', close: '17:00', closed: false},
        friday: {open: '09:00', close: '17:00', closed: false},
        saturday: {open: '09:00', close: '13:00', closed: false},
        sunday: {open: '', close: '', closed: true}
      },
      time_per_product: {
        tier2_auth: 45,
        tier3_auth: 60,
        sewing: 120,
        qa: 30
      },
      special_surcharges: {
        rush_percent: 25,
        fragile_handling: 15,
        weekend: 50
      },
      notes: 'This is a complete test hub with all fields populated.',
      attachments: ['manual.pdf', 'image.jpg'],
      logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    };
    
    console.log('1️⃣ Creating hub with ALL data in single table...');
    const insertResult = await pool.query(`
      INSERT INTO hubs (
        code, name, location, timezone, status, address, contact_info, logo,
        roles, pricing, capacity, operating_hours, time_per_product, 
        special_surcharges, notes, attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, code, name
    `, [
      testHubData.code,
      testHubData.name,
      testHubData.location,
      testHubData.timezone,
      testHubData.status,
      JSON.stringify(testHubData.address),
      JSON.stringify(testHubData.contact_info),
      testHubData.logo,
      JSON.stringify(testHubData.roles),
      JSON.stringify(testHubData.pricing),
      JSON.stringify(testHubData.capacity),
      JSON.stringify(testHubData.operating_hours),
      JSON.stringify(testHubData.time_per_product),
      JSON.stringify(testHubData.special_surcharges),
      testHubData.notes,
      JSON.stringify(testHubData.attachments)
    ]);
    
    const newHub = insertResult.rows[0];
    console.log(`✅ Hub created: ID ${newHub.id}, Code: ${newHub.code}, Name: ${newHub.name}`);
    
    console.log('2️⃣ Retrieving hub and verifying ALL data is present...');
    const retrieveResult = await pool.query('SELECT * FROM hubs WHERE id = $1', [newHub.id]);
    const savedHub = retrieveResult.rows[0];
    
    // Verify all fields are saved correctly
    const checks = [
      { field: 'code', expected: testHubData.code, actual: savedHub.code },
      { field: 'name', expected: testHubData.name, actual: savedHub.name },
      { field: 'location', expected: testHubData.location, actual: savedHub.location },
      { field: 'roles', expected: testHubData.roles, actual: savedHub.roles },
      { field: 'address.city', expected: testHubData.address.city, actual: savedHub.address.city },
      { field: 'contact_info.email', expected: testHubData.contact_info.email, actual: savedHub.contact_info.email },
      { field: 'pricing.currency', expected: testHubData.pricing.currency, actual: savedHub.pricing.currency },
      { field: 'capacity.auth_capacity', expected: testHubData.capacity.auth_capacity, actual: savedHub.capacity.auth_capacity },
      { field: 'operating_hours.monday.open', expected: testHubData.operating_hours.monday.open, actual: savedHub.operating_hours.monday.open },
      { field: 'time_per_product.tier2_auth', expected: testHubData.time_per_product.tier2_auth, actual: savedHub.time_per_product.tier2_auth },
      { field: 'special_surcharges.rush_percent', expected: testHubData.special_surcharges.rush_percent, actual: savedHub.special_surcharges.rush_percent },
      { field: 'notes', expected: testHubData.notes, actual: savedHub.notes },
      { field: 'attachments', expected: testHubData.attachments, actual: savedHub.attachments }
    ];
    
    let allChecksPass = true;
    checks.forEach(check => {
      const passed = JSON.stringify(check.expected) === JSON.stringify(check.actual);
      console.log(`${passed ? '✅' : '❌'} ${check.field}: ${passed ? 'PASS' : 'FAIL'}`);
      if (!passed) {
        console.log(`   Expected: ${JSON.stringify(check.expected)}`);
        console.log(`   Actual: ${JSON.stringify(check.actual)}`);
        allChecksPass = false;
      }
    });
    
    console.log('3️⃣ Cleaning up test data...');
    await pool.query('DELETE FROM hubs WHERE id = $1', [newHub.id]);
    console.log('✅ Test data cleaned up');
    
    console.log('\n' + '=' .repeat(50));
    if (allChecksPass) {
      console.log('🎉 SUCCESS: All hub data saved to SINGLE TABLE correctly!');
      console.log('📋 Table: hubs');
      console.log('💾 Data: ALL fields stored in one record');
    } else {
      console.log('❌ FAILED: Some data was not saved correctly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testSingleTableHubSave();
