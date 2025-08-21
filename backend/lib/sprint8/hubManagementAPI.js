// Sprint 8: Comprehensive Hub Management API
const pool = require('../database');
const crypto = require('crypto');

class HubManagementAPI {
    // Generate unique hub code
    static generateHubCode(city, type) {
        const cityCode = city.slice(0, 3).toUpperCase();
        const typeCode = type === 'authenticator' ? 'Id' : type === 'couturier' ? 'Cou' : 'Hub';
        const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        return `${cityCode}-${typeCode}-${randomSuffix}`;
    }

    // Create new hub
    static async createHub(hubData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const {
                name,
                code,
                roles, // ['authenticator', 'couturier'] or single role
                status = 'active',
                address,
                timezone,
                coordinates,
                contact,
                pricing,
                notes,
                createdBy = 'system'
            } = hubData;

            // Insert main hub record
            const hubQuery = `
                INSERT INTO hubs (
                    code, name, location, timezone, status, address, contact_info, 
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id, code, name
            `;
            
            const hubLocation = `${address.city}, ${address.country}`;
            const addressData = {
                street: address.street,
                city: address.city,
                postal_code: address.postal_code || address.postalCode,
                country: address.country,
                coordinates: coordinates
            };
            
            const hubResult = await client.query(hubQuery, [
                code,
                name,
                hubLocation,
                timezone,
                status,
                JSON.stringify(addressData),
                JSON.stringify(contact_info || contact || {})
            ]);

            const hubId = hubResult.rows[0].id;

            // Insert hub roles
            const roleQuery = `
                INSERT INTO hub_roles (hub_id, role_type, is_active, created_at)
                VALUES ($1, $2, true, CURRENT_TIMESTAMP)
            `;

            const roleTypes = Array.isArray(roles) ? roles : [roles];
            for (const role of roleTypes) {
                await client.query(roleQuery, [hubId, role]);
            }

            // Insert pricing if provided
            if (pricing && typeof pricing === 'object') {
                const pricingQuery = `
                    INSERT INTO hub_pricing (
                        hub_id, tier2_auth_fee, tag_unit_cost, tier3_auth_fee, 
                        nfc_unit_cost, sew_fee, qa_fee, internal_rollout_cost, 
                        currency, special_surcharges, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                `;

                await client.query(pricingQuery, [
                    hubId,
                    pricing.tier2_auth_fee || 0,
                    pricing.tag_unit_cost || 0,
                    pricing.tier3_auth_fee || 0,
                    pricing.nfc_unit_cost || 0,
                    pricing.sew_fee || 0,
                    pricing.qa_fee || 0,
                    pricing.internal_rollout_cost || 0,
                    pricing.currency || 'EUR',
                    JSON.stringify(pricing.special_surcharges || {})
                ]);
            }

            // Add audit log
            await client.query(`
                INSERT INTO hub_audit_log (hub_id, action, actor_id, details, created_at)
                VALUES ($1, 'created', $2, $3, CURRENT_TIMESTAMP)
            `, [hubId, createdBy, JSON.stringify({ name, code, roles })]);

            await client.query('COMMIT');
            
            return { 
                id: hubId, 
                code: hubResult.rows[0].code, 
                name: hubResult.rows[0].name 
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Get all hubs with filters
    static async getHubs(filters = {}) {
        const {
            role,
            country,
            city,
            status,
            currency,
            search
        } = filters;

        let query = `
            SELECT 
                h.id,
                h.code,
                h.name,
                h.location,
                h.timezone,
                h.status,
                h.address,
                h.contact_info,
                h.created_at,
                h.updated_at,
                
                -- Get roles as array
                ARRAY_AGG(DISTINCT hr.role_type) FILTER (WHERE hr.is_active = true) as roles,
                
                -- Get pricing info
                hp.tier2_auth_fee,
                hp.tag_unit_cost,
                hp.tier3_auth_fee,
                hp.nfc_unit_cost,
                hp.sew_fee,
                hp.qa_fee,
                hp.internal_rollout_cost,
                hp.currency,
                hp.special_surcharges,
                
                -- Get capacity summary (from capacity_profiles)
                cp.auth_capacity,
                cp.sewing_capacity,
                cp.qa_capacity
                
            FROM hubs h
            LEFT JOIN hub_roles hr ON h.id = hr.hub_id
            LEFT JOIN hub_pricing hp ON h.id = hp.hub_id
            LEFT JOIN capacity_profiles cp ON h.id = cp.hub_id AND cp.state = 'published'
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        if (role) {
            paramCount++;
            query += ` AND EXISTS (
                SELECT 1 FROM hub_roles hr2 
                WHERE hr2.hub_id = h.id AND hr2.role_type = $${paramCount} AND hr2.is_active = true
            )`;
            params.push(role);
        }

        if (status) {
            paramCount++;
            query += ` AND h.status = $${paramCount}`;
            params.push(status);
        }

        if (country) {
            paramCount++;
            query += ` AND h.address->>'country' ILIKE $${paramCount}`;
            params.push(`%${country}%`);
        }

        if (city) {
            paramCount++;
            query += ` AND h.address->>'city' ILIKE $${paramCount}`;
            params.push(`%${city}%`);
        }

        if (currency) {
            paramCount++;
            query += ` AND hp.currency = $${paramCount}`;
            params.push(currency);
        }

        if (search) {
            paramCount++;
            query += ` AND (
                h.name ILIKE $${paramCount} OR 
                h.code ILIKE $${paramCount} OR 
                h.address->>'street' ILIKE $${paramCount} OR
                h.address->>'city' ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }

        query += `
            GROUP BY h.id, hp.tier2_auth_fee, hp.tag_unit_cost, hp.tier3_auth_fee, 
                     hp.nfc_unit_cost, hp.sew_fee, hp.qa_fee, hp.internal_rollout_cost, 
                     hp.currency, hp.special_surcharges, cp.auth_capacity, 
                     cp.sewing_capacity, cp.qa_capacity
            ORDER BY h.name
        `;

        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            ...row,
            address: typeof row.address === 'string' ? JSON.parse(row.address) : row.address,
            contact_info: typeof row.contact_info === 'string' ? JSON.parse(row.contact_info) : row.contact_info,
            special_surcharges: typeof row.special_surcharges === 'string' ? JSON.parse(row.special_surcharges) : row.special_surcharges
        }));
    }

    // Get hub by ID
    static async getHubById(hubId) {
        const query = `
            SELECT 
                h.*,
                ARRAY_AGG(DISTINCT hr.role_type) FILTER (WHERE hr.is_active = true) as roles,
                hp.*,
                cp.auth_capacity,
                cp.sewing_capacity,
                cp.qa_capacity,
                cp.working_days,
                cp.working_hours_start,
                cp.working_hours_end
            FROM hubs h
            LEFT JOIN hub_roles hr ON h.id = hr.hub_id
            LEFT JOIN hub_pricing hp ON h.id = hp.hub_id
            LEFT JOIN capacity_profiles cp ON h.id = cp.hub_id AND cp.state = 'published'
            WHERE h.id = $1
            GROUP BY h.id, hp.id, cp.id
        `;

        const result = await pool.query(query, [hubId]);
        if (result.rows.length === 0) {
            throw new Error('Hub not found');
        }

        const hub = result.rows[0];
        return {
            ...hub,
            address: typeof hub.address === 'string' ? JSON.parse(hub.address) : hub.address,
            contact_info: typeof hub.contact_info === 'string' ? JSON.parse(hub.contact_info) : hub.contact_info,
            special_surcharges: typeof hub.special_surcharges === 'string' ? JSON.parse(hub.special_surcharges) : hub.special_surcharges
        };
    }

    // Update hub
    static async updateHub(hubId, updateData) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const {
                name,
                code,
                roles,
                status,
                address,
                timezone,
                coordinates,
                contact,
                pricing,
                notes,
                updatedBy = 'system'
            } = updateData;

            // Update main hub record
            const hubQuery = `
                UPDATE hubs 
                SET name = $1, code = $2, location = $3, timezone = $4, status = $5, 
                    address = $6, contact_info = $7, updated_at = CURRENT_TIMESTAMP
                WHERE id = $8
                RETURNING *
            `;

            const hubLocation = address ? `${address.city}, ${address.country}` : null;
            const addressData = address ? {
                street: address.street,
                city: address.city,
                postal_code: address.postalCode,
                country: address.country,
                coordinates: coordinates
            } : null;

            const hubResult = await client.query(hubQuery, [
                name,
                code,
                hubLocation,
                timezone,
                status,
                addressData ? JSON.stringify(addressData) : null,
                contact ? JSON.stringify(contact) : null,
                hubId
            ]);

            // Update roles if provided
            if (roles) {
                // Deactivate all current roles
                await client.query(
                    'UPDATE hub_roles SET is_active = false WHERE hub_id = $1',
                    [hubId]
                );

                // Insert new roles
                const roleTypes = Array.isArray(roles) ? roles : [roles];
                for (const role of roleTypes) {
                    await client.query(`
                        INSERT INTO hub_roles (hub_id, role_type, is_active, created_at)
                        VALUES ($1, $2, true, CURRENT_TIMESTAMP)
                        ON CONFLICT (hub_id, role_type) 
                        DO UPDATE SET is_active = true
                    `, [hubId, role]);
                }
            }

            // Update pricing if provided
            if (pricing) {
                await client.query(`
                    INSERT INTO hub_pricing (
                        hub_id, tier2_auth_fee, tag_unit_cost, tier3_auth_fee, 
                        nfc_unit_cost, sew_fee, qa_fee, internal_rollout_cost, 
                        currency, special_surcharges, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                    ON CONFLICT (hub_id) 
                    DO UPDATE SET 
                        tier2_auth_fee = EXCLUDED.tier2_auth_fee,
                        tag_unit_cost = EXCLUDED.tag_unit_cost,
                        tier3_auth_fee = EXCLUDED.tier3_auth_fee,
                        nfc_unit_cost = EXCLUDED.nfc_unit_cost,
                        sew_fee = EXCLUDED.sew_fee,
                        qa_fee = EXCLUDED.qa_fee,
                        internal_rollout_cost = EXCLUDED.internal_rollout_cost,
                        currency = EXCLUDED.currency,
                        special_surcharges = EXCLUDED.special_surcharges,
                        updated_at = CURRENT_TIMESTAMP
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
                    JSON.stringify(pricing.special_surcharges || {})
                ]);
            }

            // Add audit log
            await client.query(`
                INSERT INTO hub_audit_log (hub_id, action, actor_id, details, created_at)
                VALUES ($1, 'updated', $2, $3, CURRENT_TIMESTAMP)
            `, [hubId, updatedBy, JSON.stringify(updateData)]);

            await client.query('COMMIT');
            return hubResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Archive hub
    static async archiveHub(hubId, archivedBy = 'system') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update hub status to archived
            await client.query(
                'UPDATE hubs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['archived', hubId]
            );

            // Add audit log
            await client.query(`
                INSERT INTO hub_audit_log (hub_id, action, actor_id, details, created_at)
                VALUES ($1, 'archived', $2, $3, CURRENT_TIMESTAMP)
            `, [hubId, archivedBy, JSON.stringify({ reason: 'Hub archived' })]);

            await client.query('COMMIT');
            return { success: true };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Duplicate hub
    static async duplicateHub(hubId, newHubData) {
        const originalHub = await this.getHubById(hubId);
        
        const duplicateData = {
            ...originalHub,
            name: newHubData.name,
            code: newHubData.code,
            address: {
                ...originalHub.address,
                ...newHubData.address
            }
        };

        return await this.createHub(duplicateData);
    }

    // Get hub capacity summary
    static async getHubCapacitySummary(hubId) {
        const query = `
            SELECT 
                cp.auth_capacity,
                cp.sewing_capacity,
                cp.qa_capacity,
                cp.working_days,
                cp.working_hours_start,
                cp.working_hours_end,
                -- Calculate current usage (you'd need to implement this based on your booking system)
                0 as auth_current_usage,
                0 as sewing_current_usage,
                0 as qa_current_usage
            FROM capacity_profiles cp
            WHERE cp.hub_id = $1 AND cp.state = 'published'
            ORDER BY cp.effective_date DESC
            LIMIT 1
        `;

        const result = await pool.query(query, [hubId]);
        return result.rows[0] || null;
    }

    // Get hub inventory summary
    static async getHubInventorySummary(hubId) {
        // This would integrate with your inventory system
        // For now, return mock data
        return {
            tags_free: 150,
            tags_total: 200,
            nfc_free: 75,
            nfc_total: 100
        };
    }
}

module.exports = HubManagementAPI;
