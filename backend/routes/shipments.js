// Sprint 8 - Shipments API Routes
// Connects to real PostgreSQL database for actual shipments

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection using port 5433
const pool = new Pool({
  user: 'thiswillnotfade',
  host: 'localhost',
  database: 'aucta_db',
  password: '',
  port: 5433,
});

// Store quotes in memory (in production, use database)
const shipmentQuotes = {};

// GET /api/sprint8/logistics/shipments
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    
    // Build query for real shipments with logistics_contacts
    let query = `
      SELECT 
        s.id,
        s.shipment_id,
        s.reference_sku,
        s.declared_value,
        s.currency,
        s.weight,
        s.weight_unit,
        s.length_cm,
        s.width_cm,
        s.height_cm,
        CONCAT(s.length_cm, 'x', s.width_cm, 'x', s.height_cm, 'cm') as dimensions,
        s.fragility_level,
        s.brand,
        s.category,
        s.hs_code,
        s.sender_id,
        s.buyer_id,
        s.urgency_level,
        s.preferred_transport,
        s.security_notes,
        s.high_value,
        s.temperature_sensitive,
        s.photo_proof_required,
        s.status,
        s.tier,
        s.created_at,
        s.updated_at,
        s.created_by,
        -- Get sender info from logistics_contacts
        COALESCE(sender.full_name, s.brand) as sender_name,
        COALESCE(sender.city, 'Paris') as sender_city,
        COALESCE(sender.country, 'France') as sender_country,
        COALESCE(sender.street_address, '') as sender_address,
        -- Get buyer info from logistics_contacts
        COALESCE(buyer.full_name, 'Client') as buyer_name,
        COALESCE(buyer.city, 'New York') as buyer_city,
        COALESCE(buyer.country, 'USA') as buyer_country,
        COALESCE(buyer.street_address, '') as buyer_address
      FROM shipments s
      LEFT JOIN logistics_contacts sender ON s.sender_id = sender.id
      LEFT JOIN logistics_contacts buyer ON s.buyer_id = buyer.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Filter by status if provided
    if (status) {
      const statuses = status.split(',');
      // Map common statuses to actual database values
      const statusMap = {
        'classified': 'Ready for Route Planning',
        'pending_quote': 'Ready for Route Planning',
        'quote_expired': 'Ready for Route Planning',
        'ready': 'Ready for Route Planning'
      };
      
      const mappedStatuses = statuses.map(s => statusMap[s] || s);
      const uniqueStatuses = [...new Set(mappedStatuses)];
      
      if (uniqueStatuses.length > 0) {
        paramCount++;
        query += ` AND s.status = ANY($${paramCount})`;
        params.push(uniqueStatuses);
      }
    } else {
      // Default to showing shipments ready for route planning
      paramCount++;
      query += ` AND s.status = $${paramCount}`;
      params.push('Ready for Route Planning');
    }
    
    // Add search filter if provided
    if (search) {
      paramCount++;
      query += ` AND (
        s.shipment_id ILIKE $${paramCount} OR
        s.reference_sku ILIKE $${paramCount} OR
        s.brand ILIKE $${paramCount} OR
        s.category ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY s.created_at DESC';
    
    const result = await pool.query(query, params);
    
    // Transform the data to match frontend expectations
    const shipments = result.rows.map(row => ({
      id: row.shipment_id || `SHP-${row.id}`,
      sender_name: row.sender_name,
      sender_address: row.sender_address,
      sender_city: row.sender_city,
      sender_country: row.sender_country,
      buyer_name: row.buyer_name,
      buyer_address: row.buyer_address,
      buyer_city: row.buyer_city,
      buyer_country: row.buyer_country,
      declared_value: parseFloat(row.declared_value) || 0,
      weight: parseFloat(row.weight) || 0,
      dimensions: row.dimensions,
      fragility_level: row.fragility_level || 3,
      tier: parseInt(row.tier) || 3,
      status: row.status,
      created_at: row.created_at,
      brand: row.brand,
      category: row.category,
      urgency_level: row.urgency_level,
      high_value: row.high_value,
      temperature_sensitive: row.temperature_sensitive
    }));
    
    res.json({
      success: true,
      data: {
        shipments,
        total: shipments.length
      }
    });
  } catch (error) {
    console.error('Error fetching shipments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipments',
      details: error.message
    });
  }
});

// GET /api/sprint8/logistics/shipments/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        s.*,
        CONCAT(s.length_cm, 'x', s.width_cm, 'x', s.height_cm, 'cm') as dimensions,
        -- Get sender info from logistics_contacts
        COALESCE(sender.full_name, s.brand) as sender_name,
        COALESCE(sender.city, 'Paris') as sender_city,
        COALESCE(sender.country, 'France') as sender_country,
        COALESCE(sender.street_address, '') as sender_address,
        -- Get buyer info from logistics_contacts
        COALESCE(buyer.full_name, 'Client') as buyer_name,
        COALESCE(buyer.city, 'New York') as buyer_city,
        COALESCE(buyer.country, 'USA') as buyer_country,
        COALESCE(buyer.street_address, '') as buyer_address
      FROM shipments s
      LEFT JOIN logistics_contacts sender ON s.sender_id = sender.id
      LEFT JOIN logistics_contacts buyer ON s.buyer_id = buyer.id
      WHERE s.shipment_id = $1 OR s.id::text = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found'
      });
    }
    
    const row = result.rows[0];
    const shipment = {
      id: row.shipment_id || `SHP-${row.id}`,
      sender_name: row.sender_name,
      sender_address: row.sender_address,
      sender_city: row.sender_city,
      sender_country: row.sender_country,
      buyer_name: row.buyer_name,
      buyer_address: row.buyer_address,
      buyer_city: row.buyer_city,
      buyer_country: row.buyer_country,
      declared_value: parseFloat(row.declared_value) || 0,
      weight: parseFloat(row.weight) || 0,
      dimensions: row.dimensions,
      fragility_level: row.fragility_level || 3,
      tier: parseInt(row.tier) || 3,
      status: row.status,
      created_at: row.created_at,
      brand: row.brand,
      category: row.category,
      urgency_level: row.urgency_level,
      high_value: row.high_value,
      temperature_sensitive: row.temperature_sensitive
    };
    
    res.json({
      success: true,
      data: {
        shipment,
        quote: shipmentQuotes[id] || null
      }
    });
  } catch (error) {
    console.error('Error fetching shipment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shipment',
      details: error.message
    });
  }
});

// POST /api/sprint8/logistics/shipments/:id/quote
router.post('/:id/quote', (req, res) => {
  try {
    const { id } = req.params;
    const quote = req.body;
    
    // Store quote
    shipmentQuotes[id] = {
      ...quote,
      shipmentId: id,
      createdAt: new Date().toISOString(),
      status: 'draft'
    };
    
    res.json({
      success: true,
      data: {
        quote: shipmentQuotes[id],
        message: 'Quote saved successfully'
      }
    });
  } catch (error) {
    console.error('Error saving quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save quote'
    });
  }
});

// GET /api/sprint8/logistics/shipments/:id/quote
router.get('/:id/quote', (req, res) => {
  try {
    const { id } = req.params;
    const quote = shipmentQuotes[id];
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'No quote found for this shipment'
      });
    }
    
    res.json({
      success: true,
      data: {
        quote
      }
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quote'
    });
  }
});

// POST /api/sprint8/logistics/shipments/:id/quote/pdf
router.post('/:id/quote/pdf', (req, res) => {
  try {
    const { id } = req.params;
    const { pdfUrl } = req.body;
    
    // In production, this would save the PDF URL to the database
    if (shipmentQuotes[id]) {
      shipmentQuotes[id].pdfUrl = pdfUrl;
      shipmentQuotes[id].pdfGeneratedAt = new Date().toISOString();
    }
    
    res.json({
      success: true,
      data: {
        message: 'PDF attached to shipment',
        pdfUrl
      }
    });
  } catch (error) {
    console.error('Error attaching PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to attach PDF'
    });
  }
});

module.exports = router;