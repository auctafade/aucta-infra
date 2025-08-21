// Test script for hub management SQL integration
const pool = require('./lib/database');

async function testHubAPI() {
  try {
    console.log('🧪 Testing Hub Management SQL Integration\n');
    
    // 1. Test if hubs table exists
    console.log('1️⃣ Checking if hubs table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'hubs'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Hubs table exists');
      
      // Check if logo column exists
      const logoCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'hubs' AND column_name = 'logo';
      `);
      
      if (logoCheck.rows.length > 0) {
        console.log('✅ Logo column exists');
      } else {
        console.log('❌ Logo column missing');
      }
    } else {
      console.log('❌ Hubs table does not exist');
      return;
    }
    
    // 2. Check schema first
    console.log('\n2️⃣ Checking hubs table schema...');
    const schemaResult = await pool.query(`
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'hubs' 
        ORDER BY ordinal_position
    `);
    console.log('🏗️ Hubs table schema:');
    schemaResult.rows.forEach(row => {
        console.log(`   ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
    });
    
    // 3. Test fetching existing hubs
    console.log('\n3️⃣ Fetching existing hubs...');
    const hubsResult = await pool.query(`
      SELECT 
        h.*,
        COALESCE(
          JSON_AGG(
            DISTINCT hr.role_type
          ) FILTER (WHERE hr.role_type IS NOT NULL), 
          '[]'
        ) as roles
      FROM hubs h
      LEFT JOIN hub_roles hr ON h.id = hr.hub_id AND hr.is_active = true
      WHERE h.status != 'deleted'
      GROUP BY h.id
      ORDER BY h.created_at DESC
    `);
    
    console.log(`✅ Found ${hubsResult.rows.length} existing hubs`);
    
    // 3. Test creating a new hub
    console.log('\n3️⃣ Testing hub creation...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert test hub
      const hubResult = await client.query(`
        INSERT INTO hubs (code, name, location, timezone, status, address, contact_info, logo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        'TST' + Math.floor(Math.random() * 1000),
        'Test Hub',
        'Test City, Test Country',
        'UTC',
        'active',
        JSON.stringify({ street: '123 Test St', city: 'Test City', country: 'Test Country', postal_code: '12345' }),
        JSON.stringify({ name: 'Test Contact', email: 'test@test.com', phone: '+1234567890' }),
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      ]);
      
      const hubId = hubResult.rows[0].id;
      console.log(`✅ Created hub with ID: ${hubId}`);
      
      // Insert hub roles
      await client.query(`
        INSERT INTO hub_roles (hub_id, role_type)
        VALUES ($1, $2), ($1, $3)
      `, [hubId, 'authenticator', 'couturier']);
      
      console.log('✅ Added hub roles');
      
      // Insert pricing
      await client.query(`
        INSERT INTO hub_pricing (
          hub_id, tier2_auth_fee, tag_unit_cost, tier3_auth_fee, 
          nfc_unit_cost, sew_fee, qa_fee, internal_rollout_cost, 
          currency, special_surcharges
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        hubId, 150, 12.50, 175, 25.00, 120, 70, 30, 'EUR',
        JSON.stringify({ rush_percent: 25, fragile_fee: 15, weekend_fee: 50 })
      ]);
      
      console.log('✅ Added pricing information');
      
      // Test reading the hub back
      const createdHub = await client.query(`
        SELECT 
          h.*,
          COALESCE(
            JSON_AGG(
              DISTINCT hr.role_type
            ) FILTER (WHERE hr.role_type IS NOT NULL), 
            '[]'
          ) as roles,
          hp.tier2_auth_fee,
          hp.currency
        FROM hubs h
        LEFT JOIN hub_roles hr ON h.id = hr.hub_id AND hr.is_active = true
        LEFT JOIN hub_pricing hp ON h.id = hp.hub_id
        WHERE h.id = $1
        GROUP BY h.id, hp.id
      `, [hubId]);
      
      const hub = createdHub.rows[0];
      console.log('✅ Successfully retrieved created hub:');
      console.log(`   - Name: ${hub.name}`);
      console.log(`   - Code: ${hub.code}`);
      console.log(`   - Roles: ${JSON.stringify(hub.roles)}`);
      console.log(`   - Logo: ${hub.logo ? 'Present' : 'None'}`);
      console.log(`   - Auth Fee: ${hub.currency} ${hub.tier2_auth_fee}`);
      
      // Clean up test data
      await client.query('DELETE FROM hub_pricing WHERE hub_id = $1', [hubId]);
      await client.query('DELETE FROM hub_roles WHERE hub_id = $1', [hubId]);
      await client.query('DELETE FROM hubs WHERE id = $1', [hubId]);
      
      await client.query('COMMIT');
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    console.log('\n🎉 All tests passed! Hub Management SQL integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testHubAPI();
