// Logistics API - Backend endpoints for Sprint 8 Logistics System
const pool = require('../database');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

class LogisticsAPI {
    // Generate unique shipment ID
    static generateShipmentId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `shipment_${timestamp}_${random}`;
    }

    // Generate unique contact ID
    static generateContactId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `contact_${timestamp}_${random}`;
    }

    // Normalize phone number to E.164 format
    static normalizePhoneNumber(phone, country = null) {
        if (!phone) return null;
        
        // Remove all non-digit characters except +
        let normalized = phone.replace(/[^\d+]/g, '');
        
        // If it already starts with +, return as is (assuming it's already E.164)
        if (normalized.startsWith('+')) {
            return normalized;
        }
        
        // Add country codes based on common patterns
        const countryCodeMap = {
            'United Kingdom': '+44',
            'France': '+33',
            'Germany': '+49',
            'Italy': '+39',
            'Spain': '+34',
            'Netherlands': '+31',
            'Switzerland': '+41',
            'United States': '+1',
            'Japan': '+81',
            'China': '+86',
            'United Arab Emirates': '+971'
        };
        
        // If country is provided and number doesn't start with country code
        if (country && countryCodeMap[country]) {
            const countryCode = countryCodeMap[country].substring(1); // Remove +
            if (!normalized.startsWith(countryCode)) {
                // Remove leading 0 if present (common in European numbers)
                if (normalized.startsWith('0')) {
                    normalized = normalized.substring(1);
                }
                normalized = countryCodeMap[country] + normalized;
            } else {
                normalized = '+' + normalized;
            }
        } else {
            // Default to +44 if no country specified and no + prefix
            normalized = '+44' + (normalized.startsWith('0') ? normalized.substring(1) : normalized);
        }
        
        return normalized;
    }

    // Create or update contact
    static async createOrUpdateContact(contactData) {
        const client = await pool.connect();
        try {
            const {
                contactId,
                fullName,
                email,
                phone,
                phoneOriginal,
                street,
                city,
                zip,
                country,
                timeWindows = [],
                accessNotes = '',
                contactType = 'general'
            } = contactData;

            const normalizedPhone = this.normalizePhoneNumber(phone, country);

            let query, values;
            let resultContactId = contactId;

            if (contactId) {
                // Update existing contact
                query = `
                    UPDATE logistics_contacts 
                    SET full_name = $1, email = $2, phone = $3, phone_original = $4,
                        street_address = $5, city = $6, zip_code = $7, country = $8,
                        contact_type = $9, updated_at = CURRENT_TIMESTAMP
                    WHERE contact_id = $10
                    RETURNING id, contact_id
                `;
                values = [fullName, email, normalizedPhone, phoneOriginal || phone, 
                         street, city, zip, country, contactType, contactId];
            } else {
                // Create new contact
                resultContactId = this.generateContactId();
                query = `
                    INSERT INTO logistics_contacts 
                    (contact_id, full_name, email, phone, phone_original, street_address, 
                     city, zip_code, country, contact_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id, contact_id
                `;
                values = [resultContactId, fullName, email, normalizedPhone, phoneOriginal || phone,
                         street, city, zip, country, contactType];
            }

            const result = await client.query(query, values);
            const contact = result.rows[0];

            // Handle time windows
            if (timeWindows.length > 0) {
                // Delete existing time windows if updating
                await client.query('DELETE FROM time_windows WHERE contact_id = $1', [contact.id]);
                
                // Insert new time windows
                for (const window of timeWindows) {
                    if (window.startDate && window.startTime && window.endDate && window.endTime) {
                        await client.query(`
                            INSERT INTO time_windows (contact_id, start_date, start_time, end_date, end_time, timezone, access_notes)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [contact.id, window.startDate, window.startTime, window.endDate, window.endTime, window.timezone || 'Europe/London', accessNotes]);
                    }
                }
            }

            return { ...contact, contact_id: resultContactId };
        } finally {
            client.release();
        }
    }

    // Create shipment with all related data
    static async createShipment(shipmentData, files = []) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const shipmentId = this.generateShipmentId();

            // Create sender contact
            const sender = await this.createOrUpdateContact({
                ...shipmentData.sender,
                contactType: 'sender'
            });

            // Create buyer contact
            const buyer = await this.createOrUpdateContact({
                ...shipmentData.buyer,
                contactType: 'buyer'
            });

            // Create shipment
            const shipmentQuery = `
                INSERT INTO shipments (
                    shipment_id, reference_sku, declared_value, currency, weight, weight_unit,
                    length_cm, width_cm, height_cm, fragility_level, brand, category, hs_code,
                    sender_id, buyer_id, urgency_level, preferred_transport, security_notes,
                    high_value, temperature_sensitive, photo_proof_required, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                RETURNING id, shipment_id
            `;

            const shipmentValues = [
                shipmentId,
                shipmentData.reference,
                parseFloat(shipmentData.declaredValue),
                shipmentData.currency,
                parseFloat(shipmentData.weight),
                shipmentData.weightUnit,
                parseFloat(shipmentData.length),
                parseFloat(shipmentData.width),
                parseFloat(shipmentData.height),
                shipmentData.fragility,
                shipmentData.brand,
                shipmentData.category,
                shipmentData.hsCode || null,
                sender.id,
                buyer.id,
                shipmentData.urgency,
                shipmentData.preferredTransport,
                shipmentData.securityNotes || null,
                shipmentData.specialConditions.highValue,
                shipmentData.specialConditions.temperatureSensitive,
                shipmentData.specialConditions.photoProofRequired,
                'user'
            ];

            const shipmentResult = await client.query(shipmentQuery, shipmentValues);
            const shipment = shipmentResult.rows[0];

            // Handle file uploads
            if (files && files.length > 0) {
                for (const file of files) {
                    await client.query(`
                        INSERT INTO shipment_documents (shipment_id, filename, original_filename, file_path, file_size, mime_type, document_type)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        shipment.id,
                        file.filename,
                        file.originalname,
                        file.path,
                        file.size,
                        file.mimetype,
                        this.getDocumentType(file.mimetype)
                    ]);
                }
            }

            // Check for edge cases and create warnings
            await this.checkAndCreateEdgeCaseWarnings(client, shipment.id, shipmentData);

            // Create initial tracking entry
            await client.query(`
                INSERT INTO shipment_tracking (shipment_id, status, notes, updated_by)
                VALUES ($1, $2, $3, $4)
            `, [shipment.id, 'draft', 'Shipment created', 'user']);

            await client.query('COMMIT');

            return {
                shipmentId: shipment.shipment_id,
                internalId: shipment.id,
                sender: sender,
                buyer: buyer,
                status: 'draft'
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Check for edge cases and create warnings
    static async checkAndCreateEdgeCaseWarnings(client, shipmentId, shipmentData) {
        const warnings = [];

        // Check for duplicate reference
        const duplicateCheck = await client.query(
            'SELECT COUNT(*) as count FROM shipments WHERE reference_sku = $1 AND id != $2',
            [shipmentData.reference, shipmentId]
        );
        if (duplicateCheck.rows[0].count > 0) {
            warnings.push({
                type: 'duplicate_reference',
                details: { reference: shipmentData.reference, count: duplicateCheck.rows[0].count }
            });
        }

        // Check for phone format issues
        const senderPhoneValid = /^\+[1-9]\d{1,14}$/.test(shipmentData.sender.phone);
        const buyerPhoneValid = /^\+[1-9]\d{1,14}$/.test(shipmentData.buyer.phone);
        if (!senderPhoneValid || !buyerPhoneValid) {
            warnings.push({
                type: 'phone_format',
                details: { 
                    sender_valid: senderPhoneValid, 
                    buyer_valid: buyerPhoneValid,
                    sender_phone: shipmentData.sender.phone,
                    buyer_phone: shipmentData.buyer.phone
                }
            });
        }

        // Check for partial addresses
        const senderPartial = !shipmentData.sender.street || !shipmentData.sender.zip;
        const buyerPartial = !shipmentData.buyer.street || !shipmentData.buyer.zip;
        if (senderPartial || buyerPartial) {
            warnings.push({
                type: 'partial_address',
                details: { sender_partial: senderPartial, buyer_partial: buyerPartial }
            });
        }

        // Check for timezone mismatch
        if (shipmentData.sender.country !== shipmentData.buyer.country) {
            warnings.push({
                type: 'timezone_mismatch',
                details: { 
                    sender_country: shipmentData.sender.country,
                    buyer_country: shipmentData.buyer.country
                }
            });
        }

        // Insert warnings
        for (const warning of warnings) {
            await client.query(`
                INSERT INTO edge_case_warnings (shipment_id, warning_type, warning_details)
                VALUES ($1, $2, $3)
            `, [shipmentId, warning.type, JSON.stringify(warning.details)]);
        }
    }

    // Get document type based on MIME type
    static getDocumentType(mimeType) {
        if (mimeType.startsWith('image/')) return 'photo';
        if (mimeType === 'application/pdf') return 'certificate';
        if (mimeType.includes('document') || mimeType.includes('word')) return 'certificate';
        return 'general';
    }

    // Get shipments for dashboard (to classify)
    static async getShipmentsToClassify(limit = 50, offset = 0) {
        const query = `
            SELECT 
                s.id, s.shipment_id, s.reference_sku, s.brand, s.declared_value, s.currency,
                s.urgency_level, s.status, s.created_at,
                s.metadata->>'product_image' as product_image,
                s.metadata->>'category' as category,
                sc.full_name as sender_name, sc.city as sender_city, sc.country as sender_country,
                bc.full_name as buyer_name, bc.city as buyer_city, bc.country as buyer_country,
                COUNT(sd.id) as document_count
            FROM shipments s
            LEFT JOIN logistics_contacts sc ON s.sender_id = sc.id
            LEFT JOIN logistics_contacts bc ON s.buyer_id = bc.id
            LEFT JOIN shipment_documents sd ON s.id = sd.shipment_id
            WHERE s.status = 'draft'
            GROUP BY s.id, sc.full_name, sc.city, sc.country, bc.full_name, bc.city, bc.country
            ORDER BY s.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        
        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }

    // Get shipments that are classified and ready for route planning
    static async getShipmentsReadyForPlanning(limit = 50, offset = 0) {
        const query = `
            SELECT 
                s.id, s.shipment_id, s.reference_sku, s.brand, s.declared_value, s.currency,
                s.urgency_level, s.status, s.created_at,
                s.tier AS assigned_tier,
                s.fragility_level,
                s.metadata->>'product_image' as product_image,
                s.metadata->>'category' as category,
                sc.city as sender_city, bc.city as buyer_city,
                trr.hub_reservation_expires,
                lh.hub_code as reserved_hub_code
            FROM shipments s
            LEFT JOIN logistics_contacts sc ON s.sender_id = sc.id
            LEFT JOIN logistics_contacts bc ON s.buyer_id = bc.id
            LEFT JOIN tier_resource_reservations trr ON s.id = trr.shipment_id AND trr.status = 'active'
            LEFT JOIN logistics_hubs lh ON trr.reserved_hub_id = lh.id
            WHERE s.status = 'Ready for Route Planning'
            ORDER BY s.updated_at DESC, s.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }

    // Get shipment details by ID
    static async getShipmentById(shipmentId) {
        const client = await pool.connect();
        try {
            // Get main shipment data
            const shipmentQuery = `
                SELECT 
                    s.*,
                    sc.full_name as sender_name, sc.email as sender_email, sc.phone as sender_phone,
                    sc.street_address as sender_street, sc.city as sender_city, sc.zip_code as sender_zip,
                    sc.country as sender_country,
                    bc.full_name as buyer_name, bc.email as buyer_email, bc.phone as buyer_phone,
                    bc.street_address as buyer_street, bc.city as buyer_city, bc.zip_code as buyer_zip,
                    bc.country as buyer_country
                FROM shipments s
                LEFT JOIN logistics_contacts sc ON s.sender_id = sc.id
                LEFT JOIN logistics_contacts bc ON s.buyer_id = bc.id
                WHERE s.shipment_id = $1
            `;
            
            const shipmentResult = await client.query(shipmentQuery, [shipmentId]);
            if (shipmentResult.rows.length === 0) {
                return null;
            }
            
            const shipment = shipmentResult.rows[0];
            
            // Get documents
            const documentsResult = await client.query(
                'SELECT * FROM shipment_documents WHERE shipment_id = $1 ORDER BY uploaded_at DESC',
                [shipment.id]
            );
            
            // Get tracking history
            const trackingResult = await client.query(
                'SELECT * FROM shipment_tracking WHERE shipment_id = $1 ORDER BY timestamp DESC',
                [shipment.id]
            );
            
            // Get warnings
            const warningsResult = await client.query(
                'SELECT * FROM edge_case_warnings WHERE shipment_id = $1 ORDER BY created_at DESC',
                [shipment.id]
            );
            
            return {
                ...shipment,
                documents: documentsResult.rows,
                tracking: trackingResult.rows,
                warnings: warningsResult.rows
            };
        } finally {
            client.release();
        }
    }

    // Update shipment status and tier
    static async updateShipmentStatus(shipmentId, status, tier = null, notes = null, updatedBy = 'system') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Update shipment
            const updateQuery = tier 
                ? 'UPDATE shipments SET status = $1, tier = $2, updated_at = CURRENT_TIMESTAMP WHERE shipment_id = $3 RETURNING id'
                : 'UPDATE shipments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE shipment_id = $2 RETURNING id';
            
            const updateValues = tier ? [status, tier, shipmentId] : [status, shipmentId];
            const result = await client.query(updateQuery, updateValues);
            
            if (result.rows.length === 0) {
                throw new Error('Shipment not found');
            }
            
            // Add tracking entry (this will be done automatically by trigger, but we can add notes)
            if (notes) {
                await client.query(`
                    INSERT INTO shipment_tracking (shipment_id, status, notes, updated_by)
                    VALUES ($1, $2, $3, $4)
                `, [result.rows[0].id, status, notes, updatedBy]);
            }
            
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Save shipment as draft (for autosave)
    static async saveShipmentDraft(shipmentData) {
        // For autosave, we can store partial data in a drafts table or update existing shipment
        // This is a simplified version - in production you might want a separate drafts table
        try {
            if (shipmentData.shipmentId) {
                // Update existing draft
                return await this.updateShipmentDraft(shipmentData.shipmentId, shipmentData);
            } else {
                // Create new draft
                return await this.createShipment(shipmentData, []);
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            throw new Error('Failed to save draft');
        }
    }

    // Get logistics hubs
    static async getLogisticsHubs() {
        const result = await pool.query(
            'SELECT * FROM logistics_hubs WHERE active = true ORDER BY hub_name'
        );
        return result.rows;
    }

    // Get pricing for tier calculation
    static async calculateShipmentPricing(shipment) {
        const { weight, urgency_level, specialConditions, declared_value } = shipment;
        
        const pricingQuery = `
            SELECT * FROM logistics_pricing 
            WHERE weight_range_min <= $1 AND weight_range_max >= $1 
            AND urgency_level = $2 AND active = true 
            ORDER BY tier ASC
        `;
        
        const result = await pool.query(pricingQuery, [parseFloat(weight), urgency_level]);
        
        return result.rows.map(pricing => {
            let totalPrice = pricing.base_price + (parseFloat(weight) * pricing.price_per_kg);
            
            // Add surcharges
            if (specialConditions?.highValue) {
                totalPrice += (parseFloat(declared_value) * pricing.high_value_surcharge_percent / 100);
            }
            if (specialConditions?.temperatureSensitive) {
                totalPrice += pricing.temperature_surcharge;
            }
            if (specialConditions?.photoProofRequired) {
                totalPrice += pricing.photo_proof_surcharge;
            }
            
            return {
                ...pricing,
                total_price: Math.round(totalPrice * 100) / 100 // Round to 2 decimal places
            };
        });
    }
}

module.exports = LogisticsAPI;
