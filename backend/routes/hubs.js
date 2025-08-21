const express = require('express');
const router = express.Router();
const pool = require('../database/connection');

// GET /api/hubs - Fetch all hubs from single table
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT *
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
      // Flatten pricing data for backwards compatibility
      tier2_auth_fee: row.pricing?.tier2_auth_fee || 0,
      tag_unit_cost: row.pricing?.tag_unit_cost || 0,
      tier3_auth_fee: row.pricing?.tier3_auth_fee || 0,
      nfc_unit_cost: row.pricing?.nfc_unit_cost || 0,
      sew_fee: row.pricing?.sew_fee || 0,
      qa_fee: row.pricing?.qa_fee || 0,
      internal_rollout_cost: row.pricing?.internal_rollout_cost || 0,
      currency: row.pricing?.currency || 'EUR',
      special_surcharges: row.special_surcharges || {},
      // Flatten capacity data for backwards compatibility
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

// PUT /api/hubs/:id - Update an existing hub (ALL DATA IN ONE TABLE)
router.put('/:id', async (req, res) => {
  try {
    const hubId = req.params.id;
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
    
    // Update ALL hub data in the single hubs table
    const hubResult = await pool.query(`
      UPDATE hubs 
      SET 
        code = $1, name = $2, location = $3, timezone = $4, status = $5,
        address = $6, contact_info = $7, logo = $8, roles = $9,
        pricing = $10, capacity = $11, operating_hours = $12, 
        time_per_product = $13, special_surcharges = $14, 
        notes = $15, attachments = $16, updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
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
      JSON.stringify(attachments || []),
      hubId
    ]);
    
    if (hubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hub not found' });
    }
    
    const updatedHub = hubResult.rows[0];
    
    res.json({
      id: updatedHub.id.toString(),
      code: updatedHub.code,
      name: updatedHub.name,
      location: updatedHub.location,
      timezone: updatedHub.timezone,
      status: updatedHub.status,
      roles: updatedHub.roles || ['authenticator'],
      logo: updatedHub.logo,
      address: updatedHub.address || {},
      contact_info: updatedHub.contact_info || {},
      pricing: updatedHub.pricing || {},
      capacity: updatedHub.capacity || {},
      operating_hours: updatedHub.operating_hours || {},
      time_per_product: updatedHub.time_per_product || {},
      special_surcharges: updatedHub.special_surcharges || {},
      notes: updatedHub.notes || '',
      attachments: updatedHub.attachments || [],
      created_at: updatedHub.created_at,
      updated_at: updatedHub.updated_at
    });
  } catch (error) {
    console.error('Error updating hub:', error);
    res.status(500).json({ error: 'Failed to update hub' });
  }
});

// DELETE /api/hubs/:id - Archive/delete a hub
router.delete('/:id', async (req, res) => {
  try {
    const hubId = req.params.id;
    
    // Hard delete - completely remove from database
    const result = await pool.query(`
      DELETE FROM hubs 
      WHERE id = $1
      RETURNING *
    `, [hubId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hub not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Hub deleted successfully',
      hubId: hubId
    });
  } catch (error) {
    console.error('Error deleting hub:', error);
    res.status(500).json({ error: 'Failed to delete hub' });
  }
});

module.exports = router;
