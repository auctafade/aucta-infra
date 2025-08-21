// backend/routes/hubs.js
const express = require('express');
const pool = require('../lib/database'); // Use existing database connection
const router = express.Router();

// GET /api/hubs - Fetch all hubs
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        code,
        name,
        location,
        timezone,
        status,
        address,
        contact_info,
        logo,
        roles,
        pricing,
        capacity,
        operating_hours,
        time_per_product,
        special_surcharges,
        notes,
        attachments,
        created_at,
        updated_at
      FROM hubs
      WHERE status != 'deleted'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // Format the response to match frontend expectations
    const hubs = result.rows.map(row => ({
      id: row.id.toString(),
      code: row.code,
      name: row.name,
      location: row.location,
      timezone: row.timezone,
      status: row.status,
      roles: row.roles || ['authenticator'],
      logo: row.logo,
      address: row.address || {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: ''
      },
      contact_info: row.contact_info || {
        name: '',
        email: '',
        phone: ''
      },
      // Flatten pricing data
      tier2_auth_fee: row.pricing?.tier2_auth_fee || 0,
      tag_unit_cost: row.pricing?.tag_unit_cost || 0,
      tier3_auth_fee: row.pricing?.tier3_auth_fee || 0,
      nfc_unit_cost: row.pricing?.nfc_unit_cost || 0,
      sew_fee: row.pricing?.sew_fee || 0,
      qa_fee: row.pricing?.qa_fee || 0,
      internal_rollout_cost: row.pricing?.internal_rollout_cost || 0,
      currency: row.pricing?.currency || 'EUR',
      special_surcharges: row.special_surcharges || {},
      // Flatten capacity data
      auth_capacity: row.capacity?.auth_capacity || 100,
      sewing_capacity: row.capacity?.sewing_capacity || 50,
      qa_capacity: row.capacity?.qa_capacity || 75,
      working_days: row.capacity?.working_days || 5,
      working_hours_start: row.capacity?.working_hours_start || '09:00',
      working_hours_end: row.capacity?.working_hours_end || '17:00',
      // Additional fields
      operating_hours: row.operating_hours || {},
      time_per_product: row.time_per_product || {},
      notes: row.notes || '',
      attachments: row.attachments || [],
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    res.json(hubs);
  } catch (error) {
    console.error('Error fetching hubs:', error);
    res.status(500).json({ error: 'Failed to fetch hubs' });
  }
});

// POST /api/hubs - Create a new hub (ALL DATA IN ONE TABLE)
router.post('/', async (req, res) => {
  try {
    const {
      code,
      name,
      location,
      timezone,
      status,
      roles,
      logo,
      address,
      contact_info,
      pricing,
      capacity,
      operating_hours,
      time_per_product,
      special_surcharges,
      notes,
      attachments
    } = req.body;
    
    // Insert ALL hub data into the single hubs table
    const hubResult = await pool.query(`
      INSERT INTO hubs (
        code, name, location, timezone, status, address, contact_info, logo,
        roles, pricing, capacity, operating_hours, time_per_product, 
        special_surcharges, notes, attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      code, 
      name, 
      location, 
      timezone, 
      status, 
      JSON.stringify(address || {}), 
      JSON.stringify(contact_info || {}), 
      logo || null,
      JSON.stringify(roles || ['authenticator']),
      JSON.stringify(pricing || {}),
      JSON.stringify(capacity || {}),
      JSON.stringify(operating_hours || {}),
      JSON.stringify(time_per_product || {}),
      JSON.stringify(special_surcharges || {}),
      notes || '',
      JSON.stringify(attachments || [])
    ]);
    
    const newHub = hubResult.rows[0];
    
    res.status(201).json({
      id: newHub.id.toString(),
      code: newHub.code,
      name: newHub.name,
      location: newHub.location,
      timezone: newHub.timezone,
      status: newHub.status,
      roles: newHub.roles || ['authenticator'],
      logo: newHub.logo,
      address: newHub.address || {},
      contact_info: newHub.contact_info || {},
      pricing: newHub.pricing || {},
      capacity: newHub.capacity || {},
      operating_hours: newHub.operating_hours || {},
      time_per_product: newHub.time_per_product || {},
      special_surcharges: newHub.special_surcharges || {},
      notes: newHub.notes || '',
      attachments: newHub.attachments || [],
      created_at: newHub.created_at,
      updated_at: newHub.updated_at
    });
  } catch (error) {
    console.error('Error creating hub:', error);
    res.status(500).json({ error: 'Failed to create hub' });
  }
});

// PUT /api/hubs/:id - Update an existing hub
// PUT /api/hubs/:id - Update an existing hub
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  const hubId = req.params.id;
  
  try {
    await client.query('BEGIN');
    
    const {
      code,
      name,
      location,
      timezone,
      status,
      roles,
      logo,
      address,
      contact_info,
      pricing
    } = req.body;
    
    // 1. Update hub
    await client.query(`
      UPDATE hubs 
      SET code = $1, name = $2, location = $3, timezone = $4, 
          status = $5, address = $6, contact_info = $7, logo = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `, [code, name, location, timezone, status, address, contact_info, logo, hubId]);
    
    // 2. Update roles (delete and re-insert)
    await client.query('DELETE FROM hub_roles WHERE hub_id = $1', [hubId]);
    if (roles && roles.length > 0) {
      for (const role of roles) {
        await client.query(`
          INSERT INTO hub_roles (hub_id, role_type)
          VALUES ($1, $2)
        `, [hubId, role]);
      }
    }
    
    // 3. Update pricing
    if (pricing) {
      await client.query(`
        UPDATE hub_pricing 
        SET tier2_auth_fee = $2, tag_unit_cost = $3, tier3_auth_fee = $4, 
            nfc_unit_cost = $5, sew_fee = $6, qa_fee = $7, 
            internal_rollout_cost = $8, currency = $9, special_surcharges = $10,
            updated_at = CURRENT_TIMESTAMP
        WHERE hub_id = $1
      `, [
        hubId,
        pricing.tier2_auth_fee || 0,
        pricing.tag_unit_cost || 0,
        pricing.tier3_auth_fee || 0,
        pricing.nfc_unit_cost || 0,
        pricing.sew_fee || 0,
        pricing.qa_fee || 0,
        pricing.internal_rollout_cost || 0,
        pricing.currency || 'EUR',
        pricing.special_surcharges || {}
      ]);
    }
    
    // 4. Log the update
    await client.query(`
      INSERT INTO hub_audit_log (hub_id, action, actor_id, details)
      VALUES ($1, $2, $3, $4)
    `, [hubId, 'updated', 'system', { updated_data: req.body }]);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Hub updated successfully' 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating hub:', error);
    res.status(500).json({ error: 'Failed to update hub' });
  } finally {
    client.release();
  }
});

// DELETE /api/hubs/:id - Archive a hub (soft delete)
router.delete('/:id', async (req, res) => {
  const hubId = req.params.id;
  
  try {
    await pool.query(`
      UPDATE hubs 
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [hubId]);
    
    // Log the archival
    await pool.query(`
      INSERT INTO hub_audit_log (hub_id, action, actor_id, details)
      VALUES ($1, $2, $3, $4)
    `, [hubId, 'archived', 'system', { reason: 'User request' }]);
    
    res.json({ 
      success: true, 
      message: 'Hub archived successfully' 
    });
    
  } catch (error) {
    console.error('Error archiving hub:', error);
    res.status(500).json({ error: 'Failed to archive hub' });
  }
});

module.exports = router;
