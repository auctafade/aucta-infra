// routes/contacts.js
const express = require('express');
const router = express.Router();
const pool = require('../lib/database');
const crypto = require('crypto');

// Import validation and utility functions
const { validateEmail, normalizePhoneToE164, validateCountryISO, inferTimezone, fuzzyNameMatch, validateContactData, detectDuplicates } = require('../lib/sprint8/contactValidation');
const { emitContactEvent, contactEventEmitter } = require('../lib/sprint8/contactEvents');
const { createContactVersion, getContactVersions, getContactHistorySummary, restoreContactToVersion } = require('../lib/sprint8/contactVersioning');

// Database queries for contacts management
const getAllContacts = async (filters = {}) => {
  let query = `
    SELECT 
      c.*,
      ca.street_address, ca.city as address_city, ca.country as address_country,
      cp.preferred_communication, cp.language, cp.timezone,
      cp.pickup_time_windows, cp.delivery_time_windows,
      cl.area_coverage, cl.max_value_clearance, cl.vehicle_type, 
      cl.insurance_status, cl.rating, cl.department, cl.escalation_level,
      lh.hub_name
    FROM contacts c
    LEFT JOIN contact_addresses ca ON c.id = ca.contact_id AND ca.is_primary = true
    LEFT JOIN contact_preferences cp ON c.id = cp.contact_id
    LEFT JOIN contact_logistics cl ON c.id = cl.contact_id
    LEFT JOIN logistics_hubs lh ON cl.hub_id = lh.id
    WHERE c.status != 'deleted'
  `;
  
  const params = [];
  let paramIndex = 1;
  
  // Apply filters
  if (filters.role) {
    query += ` AND c.role = $${paramIndex++}`;
    params.push(filters.role);
  }
  
  if (filters.location) {
    query += ` AND (c.city ILIKE $${paramIndex++} OR c.country ILIKE $${paramIndex++})`;
    params.push(`%${filters.location}%`, `%${filters.location}%`);
    paramIndex++; // Skip one since we used two parameters
  }
  
  if (filters.kycStatus) {
    query += ` AND c.kyc_status = $${paramIndex++}`;
    params.push(filters.kycStatus);
  }
  
  if (filters.activity) {
    const days = filters.activity === '30' ? 30 : 90;
    query += ` AND c.last_used >= NOW() - INTERVAL '${days} days'`;
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query += ` AND c.tags && $${paramIndex++}`;
    params.push(filters.tags);
  }
  
  if (filters.search) {
    query += ` AND (
      c.name ILIKE $${paramIndex++} OR 
      EXISTS(SELECT 1 FROM unnest(c.emails) AS email WHERE email ILIKE $${paramIndex++}) OR
      EXISTS(SELECT 1 FROM unnest(c.phones) AS phone WHERE phone ILIKE $${paramIndex++}) OR
      c.company ILIKE $${paramIndex++}
    )`;
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    paramIndex += 3; // Skip since we used multiple parameters
  }
  
  query += ` ORDER BY c.last_used DESC NULLS LAST, c.created_at DESC`;
  
  const result = await pool.query(query, params);
  return result.rows;
};

const getContactById = async (id) => {
  const query = `
    SELECT 
      c.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ca.id,
            'type', ca.address_type,
            'street', ca.street_address,
            'city', ca.city,
            'zip', ca.zip_code,
            'country', ca.country,
            'isPrimary', ca.is_primary,
            'deliveryNotes', ca.delivery_notes
          )
        ) FILTER (WHERE ca.id IS NOT NULL), 
        '[]'
      ) as addresses,
      cp.preferred_communication, cp.language, cp.timezone,
      cp.pickup_time_windows, cp.delivery_time_windows,
      cl.area_coverage, cl.max_value_clearance, cl.vehicle_type, 
      cl.insurance_status, cl.rating, cl.department, cl.escalation_level,
      lh.hub_name
    FROM contacts c
    LEFT JOIN contact_addresses ca ON c.id = ca.contact_id
    LEFT JOIN contact_preferences cp ON c.id = cp.contact_id
    LEFT JOIN contact_logistics cl ON c.id = cl.contact_id
    LEFT JOIN logistics_hubs lh ON cl.hub_id = lh.id
    WHERE c.id = $1 AND c.status != 'deleted'
    GROUP BY c.id, cp.id, cl.id, lh.id
  `;
  
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const createContact = async (contactData, actorId = 'system') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert main contact record
    const contactQuery = `
      INSERT INTO contacts (
        name, emails, phones, phones_original, role, company, city, country,
        kyc_status, tags, status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const contactResult = await client.query(contactQuery, [
      contactData.name,
      contactData.emails || [],
      contactData.normalizedPhones?.map(p => p.normalized) || contactData.phones || [],
      contactData.phones || [],
      contactData.role,
      contactData.company || '',
      contactData.city,
      contactData.country,
      'pending',
      contactData.tags || [],
      'active',
      actorId,
      actorId
    ]);
    
    const contact = contactResult.rows[0];
    
    // Insert address if provided
    if (contactData.addresses && contactData.addresses.length > 0) {
      const address = contactData.addresses[0];
      await client.query(`
        INSERT INTO contact_addresses (
          contact_id, address_type, street_address, city, zip_code, country, is_primary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        contact.id, 'primary', address.street, address.city, 
        address.zip, address.country, true
      ]);
    }
    
    // Insert preferences
    if (contactData.preferences) {
      await client.query(`
        INSERT INTO contact_preferences (
          contact_id, preferred_communication, language, timezone,
          pickup_time_windows, delivery_time_windows
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        contact.id,
        contactData.preferences.communication || ['email'],
        contactData.preferences.language || 'en',
        contactData.preferences.timezone || 'UTC',
        JSON.stringify(contactData.preferences.timeWindows || {}),
        JSON.stringify(contactData.preferences.timeWindows || {})
      ]);
    }
    
    // Insert logistics profile if WG or hub
    if (contactData.logistics && (contactData.role === 'wg' || contactData.role === 'hub')) {
      await client.query(`
        INSERT INTO contact_logistics (
          contact_id, area_coverage, max_value_clearance, vehicle_type,
          insurance_status, rating
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        contact.id,
        contactData.logistics.areaCoverage || [],
        contactData.logistics.maxValueClearance || 0,
        contactData.logistics.vehicle || null,
        contactData.logistics.insurance || 'unknown',
        contactData.logistics.rating || 5.0
      ]);
    }
    
    await client.query('COMMIT');
    return await getContactById(contact.id);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Mock data for demonstration - this will be replaced by database queries
const mockContactsData = [
  {
    id: 1,
    name: 'John Smith',
    emails: ['john.smith@company.com', 'j.smith@personal.com'],
    phones: ['+1 (555) 123-4567', '+1 (555) 123-4568'],
    role: 'sender',
    company: 'Global Shipping Co.',
    city: 'New York',
    country: 'USA',
    kycStatus: 'ok',
    kycDate: '2024-01-10',
    tags: ['VIP', 'corporate'],
    lastUsed: '2024-01-15',
    shipmentCount: 12,
    addresses: [
      { type: 'primary', street: '123 Main St', city: 'New York', zip: '10001', country: 'USA' },
      { type: 'billing', street: '456 Corp Ave', city: 'New York', zip: '10002', country: 'USA' }
    ],
    preferences: {
      communication: ['email', 'phone'],
      timeWindows: { pickup: '9:00-17:00', delivery: '9:00-17:00' },
      language: 'en',
      timezone: 'America/New_York'
    },
    logistics: {
      deliveryNotes: 'Ring doorbell twice, leave with concierge if no answer',
      securityRequirements: ['signature'],
      specialInstructions: 'Fragile items only'
    },
    shipmentHistory: [
      { id: 'SHP-001', tier: 'Premium', mode: 'WG', hub: 'NYC-01', status: 'delivered', role: 'sender', date: '2024-01-15' },
      { id: 'SHP-002', tier: 'Standard', mode: 'DHL', hub: 'NYC-01', status: 'in-transit', role: 'sender', date: '2024-01-12' }
    ],
    notes: [
      { date: '2024-01-10', author: 'admin', content: 'Preferred contact for high-value shipments' }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    emails: ['sarah.j@logistics.com'],
    phones: ['+1 (555) 987-6543'],
    role: 'wg',
    company: 'FastTrack Logistics',
    city: 'Los Angeles',
    country: 'USA',
    kycStatus: 'ok',
    kycDate: '2024-01-08',
    tags: ['high-value'],
    lastUsed: '2024-01-14',
    shipmentCount: 8,
    addresses: [
      { type: 'primary', street: '789 Logistics Blvd', city: 'Los Angeles', zip: '90210', country: 'USA' }
    ],
    preferences: {
      communication: ['email', 'SMS'],
      timeWindows: { pickup: '8:00-18:00', delivery: '8:00-18:00' },
      language: 'en',
      timezone: 'America/Los_Angeles'
    },
    logistics: {
      areaCoverage: 'LA County',
      maxValueClearance: 50000,
      vehicle: 'Van',
      insurance: 'Active',
      rating: 4.8,
      deliveryNotes: 'Professional WG operator',
      securityRequirements: ['ID_check']
    },
    shipmentHistory: [
      { id: 'SHP-003', tier: 'Premium', mode: 'WG', hub: 'LAX-01', status: 'completed', role: 'wg', date: '2024-01-14' }
    ],
    notes: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z'
  },
  {
    id: 3,
    name: 'Mike Chen',
    emails: ['mike.chen@shipping.com'],
    phones: ['+1 (555) 456-7890'],
    role: 'hub',
    company: 'Express Cargo',
    city: 'Chicago',
    country: 'USA',
    kycStatus: 'pending',
    kycDate: null,
    tags: [],
    lastUsed: '2024-01-05',
    shipmentCount: 25,
    addresses: [
      { type: 'primary', street: '321 Warehouse Dr', city: 'Chicago', zip: '60601', country: 'USA' }
    ],
    preferences: {
      communication: ['phone'],
      timeWindows: { pickup: '6:00-22:00', delivery: '6:00-22:00' },
      language: 'en',
      timezone: 'America/Chicago'
    },
    logistics: {
      deliveryNotes: 'Loading dock access required',
      securityRequirements: ['ID_check'],
      specialInstructions: 'Call ahead for large shipments'
    },
    shipmentHistory: [
      { id: 'SHP-004', tier: 'Standard', mode: 'Hub', hub: 'CHI-01', status: 'processing', role: 'hub', date: '2024-01-05' }
    ],
    notes: [
      { date: '2024-01-05', author: 'ops', content: 'KYC documents pending review' }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z'
  },
  {
    id: 4,
    name: 'Lisa Wang',
    emails: ['lisa.wang@global.com'],
    phones: ['+1 (555) 789-0123'],
    role: 'buyer',
    company: 'International Freight',
    city: 'Miami',
    country: 'USA',
    kycStatus: 'failed',
    kycDate: '2024-01-03',
    tags: ['returns-only'],
    lastUsed: '2024-01-01',
    shipmentCount: 3,
    addresses: [
      { type: 'primary', street: '654 Ocean Drive', city: 'Miami', zip: '33101', country: 'USA' }
    ],
    preferences: {
      communication: ['email'],
      timeWindows: { pickup: '10:00-16:00', delivery: '10:00-16:00' },
      language: 'en',
      timezone: 'America/New_York'
    },
    logistics: {
      deliveryNotes: 'No weekend deliveries',
      securityRequirements: ['signature', 'ID_check'],
      specialInstructions: 'Returns processing only'
    },
    shipmentHistory: [
      { id: 'SHP-005', tier: 'Standard', mode: 'DHL', hub: 'MIA-01', status: 'returned', role: 'buyer', date: '2024-01-01' }
    ],
    notes: [
      { date: '2024-01-03', author: 'compliance', content: 'KYC failed - documentation incomplete' }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  }
];

// GET /api/contacts - Get all contacts with filtering
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      search,
      role,
      location,
      kycStatus,
      activity,
      tags,
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build filters object for database query
    const filters = {};
    if (role && role !== 'all') filters.role = role;
    if (location && location !== 'all') filters.location = location;
    if (kycStatus && kycStatus !== 'all') filters.kycStatus = kycStatus;
    if (activity && activity !== 'all') filters.activity = activity;
    if (tags && Array.isArray(tags)) filters.tags = tags;
    if (search) filters.search = search;

    // Get contacts from database
    const dbContacts = await getAllContacts(filters);
    
    // Transform database rows to match frontend interface
    let filteredContacts = dbContacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      emails: contact.emails || [],
      phones: contact.phones_original || contact.phones || [],
      role: contact.role,
      company: contact.company || '',
      city: contact.city,
      country: contact.country,
      kycStatus: contact.kyc_status,
      kycDate: contact.kyc_date,
      tags: contact.tags || [],
      lastUsed: contact.last_used,
      shipmentCount: contact.shipment_count || 0,
      addresses: contact.addresses || [],
      preferences: {
        communication: contact.preferred_communication || ['email'],
        timeWindows: {
          pickup: contact.pickup_time_windows || {},
          delivery: contact.delivery_time_windows || {}
        },
        language: contact.language || 'en',
        timezone: contact.timezone || 'UTC'
      },
      logistics: {
        areaCoverage: contact.area_coverage || [],
        maxValueClearance: contact.max_value_clearance || 0,
        vehicle: contact.vehicle_type,
        insurance: contact.insurance_status || 'unknown',
        rating: contact.rating || 5.0,
        department: contact.department,
        escalationLevel: contact.escalation_level
      },
      shipmentHistory: [], // Populated separately if needed
      notes: [], // Populated separately if needed
      status: contact.status,
      unreachable: contact.unreachable || false,
      unreachableReason: contact.unreachable_reason,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    }));

    // Filtering is now done in the database query above

    // Sort
    filteredContacts.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

    // Get summary statistics
    const stats = {
      total: filteredContacts.length,
      totalAll: filteredContacts.length,
      byRole: {
        sender: filteredContacts.filter(c => c.role === 'sender').length,
        buyer: filteredContacts.filter(c => c.role === 'buyer').length,
        wg: filteredContacts.filter(c => c.role === 'wg').length,
        hub: filteredContacts.filter(c => c.role === 'hub').length
      },
      byKYC: {
        ok: filteredContacts.filter(c => c.kycStatus === 'ok').length,
        pending: filteredContacts.filter(c => c.kycStatus === 'pending').length,
        failed: filteredContacts.filter(c => c.kycStatus === 'failed').length,
        'n/a': filteredContacts.filter(c => c.kycStatus === 'n/a').length
      }
    };

    res.json({
      success: true,
      data: paginatedContacts,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredContacts.length,
        pages: Math.ceil(filteredContacts.length / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts',
      error: error.message
    });
  }
});

// GET /api/contacts/:id - Get specific contact
router.get('/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const contact = await getContactById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Transform database result to match frontend interface
    const transformedContact = {
      id: contact.id,
      name: contact.name,
      emails: contact.emails || [],
      phones: contact.phones_original || contact.phones || [],
      role: contact.role,
      company: contact.company || '',
      city: contact.city,
      country: contact.country,
      kycStatus: contact.kyc_status,
      kycDate: contact.kyc_date,
      tags: contact.tags || [],
      lastUsed: contact.last_used,
      shipmentCount: contact.shipment_count || 0,
      addresses: contact.addresses || [],
      preferences: {
        communication: contact.preferred_communication || ['email'],
        timeWindows: {
          pickup: contact.pickup_time_windows || {},
          delivery: contact.delivery_time_windows || {}
        },
        language: contact.language || 'en',
        timezone: contact.timezone || 'UTC'
      },
      logistics: {
        areaCoverage: contact.area_coverage || [],
        maxValueClearance: contact.max_value_clearance || 0,
        vehicle: contact.vehicle_type,
        insurance: contact.insurance_status || 'unknown',
        rating: contact.rating || 5.0,
        department: contact.department,
        escalationLevel: contact.escalation_level
      },
      shipmentHistory: [], // Would be populated with separate query
      notes: [], // Would be populated with separate query
      status: contact.status,
      unreachable: contact.unreachable || false,
      unreachableReason: contact.unreachable_reason,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    };

    res.json({
      success: true,
      data: transformedContact
    });

  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact',
      error: error.message
    });
  }
});

// POST /api/contacts - Create new contact with validation and duplicate detection
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const contactData = req.body;
    const actorId = req.user?.id || 'system'; // From auth middleware

    // Comprehensive validation
    const validation = validateContactData(contactData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const processedData = validation.processedData;

    // Required field validation
    if (!processedData.name || !processedData.emails || !processedData.phones || !processedData.role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, emails, phones, role'
      });
    }

    if (!['sender', 'buyer', 'wg', 'hub'].includes(processedData.role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: sender, buyer, wg, or hub'
      });
    }

    // Duplicate detection
    const duplicates = await detectDuplicates(processedData);
    
    // Create contact in database

    // Save to database
    const savedContact = await createContact(processedData, actorId);

    // Emit creation event
    emitContactEvent('contact.created', {
      contactId: savedContact.id,
      role: savedContact.role,
      kycStatus: savedContact.kyc_status,
      actorId
    });

    const response = {
      success: true,
      data: savedContact,
      message: 'Contact created successfully'
    };

    // Include duplicate warnings if found
    if (duplicates.exact.length > 0 || duplicates.fuzzy.length > 0) {
      response.duplicates = {
        exact: duplicates.exact,
        fuzzy: duplicates.fuzzy,
        warning: 'Potential duplicates detected. Consider merging.'
      };
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contact',
      error: error.message
    });
  } finally {
    // Track telemetry
    const duration = Date.now() - startTime;
    contactEventEmitter.trackSearchTime(duration);
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const contactIndex = mockContacts.findIndex(c => c.id === contactId);

    if (contactIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const updates = req.body;
    delete updates.id; // Don't allow ID updates
    delete updates.createdAt; // Don't allow creation date updates

    // Update contact
    mockContacts[contactIndex] = {
      ...mockContacts[contactIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: mockContacts[contactIndex],
      message: 'Contact updated successfully'
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact',
      error: error.message
    });
  }
});

// POST /api/contacts/:id/notes - Add note to contact
router.post('/:id/notes', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const contact = mockContacts.find(c => c.id === contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const { content, author = 'system' } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    const newNote = {
      id: contact.notes.length + 1,
      date: new Date().toISOString().split('T')[0],
      author,
      content
    };

    contact.notes.unshift(newNote); // Add to beginning
    contact.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      data: newNote,
      message: 'Note added successfully'
    });

  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message
    });
  }
});

// POST /api/contacts/:id/kyc - Update KYC status
router.post('/:id/kyc', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const contact = mockContacts.find(c => c.id === contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const { status, verifier = 'system' } = req.body;

    if (!['ok', 'pending', 'failed', 'n/a'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid KYC status'
      });
    }

    contact.kycStatus = status;
    contact.kycDate = status === 'ok' ? new Date().toISOString().split('T')[0] : null;
    contact.updatedAt = new Date().toISOString();

    // Add audit note
    contact.notes.unshift({
      id: contact.notes.length + 1,
      date: new Date().toISOString().split('T')[0],
      author: verifier,
      content: `KYC status updated to: ${status}`
    });

    res.json({
      success: true,
      data: {
        kycStatus: contact.kycStatus,
        kycDate: contact.kycDate
      },
      message: 'KYC status updated successfully'
    });

  } catch (error) {
    console.error('Error updating KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update KYC status',
      error: error.message
    });
  }
});

// POST /api/contacts/link-shipment - Link contact to shipment
router.post('/link-shipment', async (req, res) => {
  try {
    const { contactId, shipmentId, role } = req.body;

    if (!contactId || !shipmentId || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: contactId, shipmentId, role'
      });
    }

    const contact = mockContacts.find(c => c.id === parseInt(contactId));

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Validation for WG role
    if (role === 'wg' && contact.logistics?.maxValueClearance) {
      // In real implementation, fetch shipment value from database
      const mockShipmentValue = 15000; // This would come from shipment lookup
      
      if (mockShipmentValue > contact.logistics.maxValueClearance) {
        return res.status(400).json({
          success: false,
          message: `Cannot assign: shipment value ($${mockShipmentValue.toLocaleString()}) exceeds WG max clearance ($${contact.logistics.maxValueClearance.toLocaleString()})`
        });
      }
    }

    // Add to shipment history (in real implementation, this would update shipment record)
    const shipmentEntry = {
      id: shipmentId,
      tier: 'Premium', // This would come from actual shipment
      mode: role === 'wg' ? 'WG' : 'DHL',
      hub: 'NYC-01', // This would come from actual shipment
      status: 'linked',
      role,
      date: new Date().toISOString().split('T')[0]
    };

    contact.shipmentHistory.unshift(shipmentEntry);
    contact.shipmentCount += 1;
    contact.lastUsed = new Date().toISOString().split('T')[0];
    contact.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      data: {
        contact: contact,
        shipment: shipmentEntry
      },
      message: `Successfully linked ${contact.name} as ${role} to ${shipmentId}`
    });

  } catch (error) {
    console.error('Error linking contact to shipment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link contact to shipment',
      error: error.message
    });
  }
});

// GET /api/contacts/search/shipments - Search available shipments for linking
router.get('/search/shipments', async (req, res) => {
  try {
    const { query } = req.query;

    // Mock shipments - in real implementation, query actual shipments
    const mockShipments = [
      { id: 'SHP-2024-001', tier: 'Premium', value: 5000, status: 'pending', hub: 'NYC-01' },
      { id: 'SHP-2024-002', tier: 'Standard', value: 1200, status: 'in-transit', hub: 'LAX-01' },
      { id: 'SHP-2024-003', tier: 'Express', value: 15000, status: 'delivered', hub: 'CHI-01' },
      { id: 'SHP-2024-004', tier: 'Premium', value: 8000, status: 'pending', hub: 'MIA-01' }
    ];

    let filteredShipments = mockShipments;

    if (query) {
      filteredShipments = mockShipments.filter(shipment =>
        shipment.id.toLowerCase().includes(query.toLowerCase())
      );
    }

    res.json({
      success: true,
      data: filteredShipments
    });

  } catch (error) {
    console.error('Error searching shipments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search shipments',
      error: error.message
    });
  }
});

// POST /api/contacts/merge - Merge contacts (Ops only)
router.post('/merge', async (req, res) => {
  try {
    const { survivorId, mergedId, fieldSelections, actorId } = req.body;
    
    // Validation
    if (!survivorId || !mergedId || !fieldSelections) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: survivorId, mergedId, fieldSelections'
      });
    }

    const survivor = mockContacts.find(c => c.id === parseInt(survivorId));
    const merged = mockContacts.find(c => c.id === parseInt(mergedId));

    if (!survivor || !merged) {
      return res.status(404).json({
        success: false,
        message: 'One or both contacts not found'
      });
    }

    // Create backup versions before merge
    createContactVersion(survivor.id, survivor, null, actorId, 'pre-merge');
    createContactVersion(merged.id, merged, null, actorId, 'pre-merge');

    // Merge data based on field selections
    const mergedContact = { ...survivor };
    
    Object.keys(fieldSelections).forEach(field => {
      const selectedSource = fieldSelections[field]; // 'survivor' or 'merged'
      if (selectedSource === 'merged' && merged[field] !== undefined) {
        mergedContact[field] = merged[field];
      }
    });

    // Combine histories
    mergedContact.shipmentHistory = [
      ...survivor.shipmentHistory,
      ...merged.shipmentHistory
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Combine notes
    mergedContact.notes = [
      ...survivor.notes,
      ...merged.notes,
      {
        date: new Date().toISOString().split('T')[0],
        author: actorId,
        content: `Merged with contact ${merged.name} (ID: ${merged.id})`
      }
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    mergedContact.updatedAt = new Date().toISOString();

    // Update survivor
    const survivorIndex = mockContacts.findIndex(c => c.id === survivor.id);
    mockContacts[survivorIndex] = mergedContact;

    // Remove merged contact (soft delete)
    const mergedIndex = mockContacts.findIndex(c => c.id === merged.id);
    mockContacts[mergedIndex].status = 'merged';
    mockContacts[mergedIndex].mergedInto = survivor.id;

    // Create post-merge version
    createContactVersion(survivor.id, survivor, mergedContact, actorId, 'merge');

    // Emit merge event
    emitContactEvent('contact.merged', {
      survivorId: survivor.id,
      mergedId: merged.id,
      actorId
    });

    res.json({
      success: true,
      data: mergedContact,
      message: `Successfully merged contact ${merged.name} into ${survivor.name}`
    });

  } catch (error) {
    console.error('Error merging contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to merge contacts',
      error: error.message
    });
  }
});

// GET /api/contacts/:id/duplicates - Find potential duplicates
router.get('/:id/duplicates', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const contact = mockContacts.find(c => c.id === contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const duplicates = await detectDuplicates(contact, contactId);

    res.json({
      success: true,
      data: duplicates
    });

  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find duplicates',
      error: error.message
    });
  }
});

// GET /api/contacts/:id/versions - Get contact version history
router.get('/:id/versions', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 20;

    const versions = getContactVersions(contactId, limit);
    const summary = getContactHistorySummary(contactId);

    res.json({
      success: true,
      data: {
        versions,
        summary
      }
    });

  } catch (error) {
    console.error('Error getting versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get contact versions',
      error: error.message
    });
  }
});

// POST /api/contacts/:id/restore - Restore contact to specific version
router.post('/:id/restore', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { versionNumber, actorId } = req.body;

    const result = restoreContactToVersion(contactId, versionNumber, actorId);

    // Update contact in mock data
    const contactIndex = mockContacts.findIndex(c => c.id === contactId);
    if (contactIndex !== -1) {
      mockContacts[contactIndex] = {
        ...result.restoredData,
        updatedAt: new Date().toISOString()
      };
    }

    res.json({
      success: true,
      data: result.restoredData,
      message: `Contact restored to version ${versionNumber}`
    });

  } catch (error) {
    console.error('Error restoring contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore contact',
      error: error.message
    });
  }
});

// POST /api/contacts/:id/mark-unreachable - Mark contact as unreachable
router.post('/:id/mark-unreachable', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { reason, actorId } = req.body;

    const contact = mockContacts.find(c => c.id === contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Create version before change
    createContactVersion(contactId, contact, null, actorId, 'mark-unreachable');

    contact.unreachable = true;
    contact.unreachableReason = reason || 'No response to communication attempts';
    contact.unreachableDate = new Date().toISOString();
    contact.updatedAt = new Date().toISOString();

    // Add note
    contact.notes.unshift({
      date: new Date().toISOString().split('T')[0],
      author: actorId,
      content: `Marked as unreachable: ${reason || 'No response'}`
    });

    res.json({
      success: true,
      data: contact,
      message: 'Contact marked as unreachable'
    });

  } catch (error) {
    console.error('Error marking contact unreachable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark contact unreachable',
      error: error.message
    });
  }
});

// GET /api/contacts/telemetry - Get telemetry data
router.get('/telemetry', async (req, res) => {
  try {
    const telemetry = contactEventEmitter.getTelemetry();
    
    res.json({
      success: true,
      data: telemetry
    });

  } catch (error) {
    console.error('Error getting telemetry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get telemetry',
      error: error.message
    });
  }
});

// DELETE /api/contacts/:id - Delete contact (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const actorId = req.user?.id || 'system';
    
    const contactIndex = mockContacts.findIndex(c => c.id === contactId);

    if (contactIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const contact = mockContacts[contactIndex];

    // Create version before delete
    createContactVersion(contactId, contact, null, actorId, 'delete');

    // Soft delete
    contact.status = 'deleted';
    contact.deletedAt = new Date().toISOString();
    contact.deletedBy = actorId;

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact',
      error: error.message
    });
  }
});

module.exports = router;
