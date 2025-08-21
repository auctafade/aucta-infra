const { Pool } = require('pg');

// Database connection with port 5433 as per project requirements
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'aucta_db',
  user: process.env.DB_USER || 'thiswillnotfade',
  password: process.env.DB_PASSWORD || '',
});

class AdminDashboard {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats() {
    const client = await pool.connect();
    
    try {
      // Get total active resales
      const activeResalesQuery = `
        SELECT COUNT(*) as count
        FROM resale_events 
        WHERE status IN ('ready_for_resale', 'buyer_assigned', 'pending_sale')
      `;
      
      // Get pending approvals
      const pendingApprovalsQuery = `
        SELECT COUNT(*) as count
        FROM resale_events 
        WHERE status = 'pending_sale'
      `;
      
      // Get total volume
      const totalVolumeQuery = `
        SELECT COALESCE(SUM(asking_price), 0) as total
        FROM resale_events 
        WHERE status IN ('sold', 'finalized')
      `;
      
      // Get average processing time
      const avgProcessingTimeQuery = `
        SELECT 
          COALESCE(
            AVG(
              EXTRACT(EPOCH FROM (sold_at - initiated_at)) / 3600
            ), 0
          ) as avg_hours
        FROM resale_events 
        WHERE status IN ('sold', 'finalized') 
        AND sold_at IS NOT NULL
      `;
      
      // Get compliance score (percentage of resales with proper royalty distribution)
      const complianceScoreQuery = `
        SELECT 
          COALESCE(
            (
              COUNT(CASE WHEN rd.status = 'completed' THEN 1 END) * 100.0 / 
              COUNT(*)
            ), 0
          ) as compliance_percentage
        FROM resale_events re
        LEFT JOIN royalty_distributions rd ON re.resale_id = rd.resale_id
        WHERE re.status IN ('sold', 'finalized')
      `;
      
      // Get external marketplace events count
      const externalMarketplaceQuery = `
        SELECT COUNT(*) as count
        FROM resale_events 
        WHERE marketplace_id IS NOT NULL
      `;
      
      // Execute all queries in parallel
      const [
        activeResalesResult,
        pendingApprovalsResult,
        totalVolumeResult,
        avgProcessingTimeResult,
        complianceScoreResult,
        externalMarketplaceResult
      ] = await Promise.all([
        client.query(activeResalesQuery),
        client.query(pendingApprovalsQuery),
        client.query(totalVolumeQuery),
        client.query(avgProcessingTimeQuery),
        client.query(complianceScoreQuery),
        client.query(externalMarketplaceQuery)
      ]);
      
      return {
        total_active_resales: parseInt(activeResalesResult.rows[0].count),
        pending_approvals: parseInt(pendingApprovalsResult.rows[0].count),
        total_volume: parseFloat(totalVolumeResult.rows[0].total),
        avg_processing_time: Math.round(parseFloat(avgProcessingTimeResult.rows[0].avg_hours) * 10) / 10,
        compliance_score: Math.round(parseFloat(complianceScoreResult.rows[0].compliance_percentage) * 10) / 10,
        external_marketplace_events: parseInt(externalMarketplaceResult.rows[0].count)
      };
      
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw new Error('Failed to retrieve dashboard statistics');
    } finally {
      client.release();
    }
  }

  /**
   * Get all resale events with detailed information
   */
  async getAllResaleEvents(limit = 100, offset = 0, filters = {}) {
    const client = await pool.connect();
    
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;
      
      // Apply filters
      if (filters.status && filters.status !== 'all') {
        paramCount++;
        whereClause += ` AND re.status = $${paramCount}`;
        params.push(filters.status);
      }
      
      if (filters.platform && filters.platform !== 'all') {
        if (filters.platform === 'internal') {
          whereClause += ' AND re.marketplace_id IS NULL';
        } else if (filters.platform === 'external') {
          whereClause += ' AND re.marketplace_id IS NOT NULL';
        }
      }
      
      if (filters.search) {
        paramCount++;
        whereClause += ` AND (
          re.resale_id ILIKE $${paramCount} OR
          p.metadata->>'brand' ILIKE $${paramCount} OR
          p.metadata->>'object_name' ILIKE $${paramCount} OR
          c.name ILIKE $${paramCount}
        )`;
        params.push(`%${filters.search}%`);
      }
      
      if (filters.dateRange) {
        const days = parseInt(filters.dateRange);
        if (days > 0) {
          paramCount++;
          whereClause += ` AND re.initiated_at >= NOW() - INTERVAL '${days} days'`;
        }
      }
      
      const query = `
        SELECT 
          re.*,
          p.nfc_uid,
          p.status as passport_status,
          p.metadata as passport_metadata,
          c.name as seller_name,
          c.email as seller_email,
          c.wallet_address as seller_wallet,
          c.city as seller_city,
          c.country as seller_country,
          cb.name as buyer_name,
          cb.email as buyer_email,
          cb.wallet_address as buyer_wallet,
          cb.city as buyer_city,
          cb.country as buyer_country
        FROM resale_events re
        LEFT JOIN passports p ON re.passport_id = p.id
        LEFT JOIN clients c ON re.seller_id = c.id
        LEFT JOIN clients cb ON re.buyer_id = cb.id
        ${whereClause}
        ORDER BY re.updated_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      
      // Transform the data to match frontend expectations
      return result.rows.map(row => ({
        id: row.id,
        resale_id: row.resale_id,
        passport_id: row.passport_id,
        seller_id: row.seller_id,
        buyer_id: row.buyer_id,
        asking_price: parseFloat(row.asking_price),
        minimum_price: row.minimum_price ? parseFloat(row.minimum_price) : undefined,
        currency: row.currency,
        marketplace_id: row.marketplace_id,
        external_listing_ref: row.external_listing_ref,
        status: row.status,
        current_valuation_id: row.current_valuation_id,
        product_hash: row.product_hash,
        client_hash: row.client_hash,
        metadata: row.metadata,
        initiated_at: row.initiated_at,
        buyer_assigned_at: row.buyer_assigned_at,
        listed_at: row.listed_at,
        sold_at: row.sold_at,
        cancelled_at: row.cancelled_at,
        updated_at: row.updated_at,
        passport: {
          id: row.passport_id,
          nfc_uid: row.nfc_uid,
          status: row.passport_status,
          metadata: row.passport_metadata
        },
        seller: {
          id: row.seller_id,
          name: row.seller_name,
          email: row.seller_email,
          wallet_address: row.seller_wallet,
          city: row.seller_city,
          country: row.seller_country
        },
        buyer: row.buyer_id ? {
          id: row.buyer_id,
          name: row.buyer_name,
          email: row.buyer_email,
          wallet_address: row.buyer_wallet,
          city: row.buyer_city,
          country: row.buyer_country
        } : undefined
      }));
      
    } catch (error) {
      console.error('Error getting resale events:', error);
      throw new Error('Failed to retrieve resale events');
    } finally {
      client.release();
    }
  }

  /**
   * Get royalty distributions for compliance checking
   */
  async getRoyaltyDistributions() {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          rd.*,
          re.asking_price,
          re.currency
        FROM royalty_distributions rd
        LEFT JOIN resale_events re ON rd.resale_id = re.resale_id
        ORDER BY rd.calculated_at DESC
        LIMIT 50
      `;
      
      const result = await client.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        resale_id: row.resale_id,
        seller_amount: parseFloat(row.seller_amount),
        brand_royalty: parseFloat(row.brand_royalty),
        aucta_commission: parseFloat(row.aucta_commission),
        cashback_amount: parseFloat(row.cashback_amount),
        calculated_at: row.calculated_at,
        status: row.status
      }));
      
    } catch (error) {
      console.error('Error getting royalty distributions:', error);
      throw new Error('Failed to retrieve royalty distributions');
    } finally {
      client.release();
    }
  }

  /**
   * Get marketplace integrations for external feed monitoring
   */
  async getMarketplaceIntegrations() {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          mi.*,
          COUNT(re.id) as active_listings
        FROM marketplace_integrations mi
        LEFT JOIN resale_events re ON mi.id = re.marketplace_id
        WHERE mi.active = true
        GROUP BY mi.id, mi.name, mi.echo_enabled, mi.commission_rate, mi.created_at
        ORDER BY mi.created_at DESC
        LIMIT 50
      `;
      
      const result = await client.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        echo_enabled: row.echo_enabled,
        commission_rate: row.commission_rate,
        active_listings: parseInt(row.active_listings),
        status: row.active ? 'active' : 'inactive',
        created_at: row.created_at
      }));
      
    } catch (error) {
      console.error('Error getting marketplace integrations:', error);
      throw new Error('Failed to retrieve marketplace integrations');
    } finally {
      client.release();
    }
  }

  /**
   * Approve a resale event
   */
  async approveResale(resaleId, adminData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update resale status
      const updateQuery = `
        UPDATE resale_events 
        SET status = 'approved', updated_at = NOW()
        WHERE resale_id = $1
      `;
      
      await client.query(updateQuery, [resaleId]);
      
      // Log admin action
      const logQuery = `
        INSERT INTO audit_trail (
          action_category, action_type, resource_type, resource_id, 
          new_values, admin_user, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await client.query(logQuery, [
        'resale_management',
        'approve_resale',
        'resale_event',
        resaleId,
        JSON.stringify({ status: 'approved', admin: adminData }),
        adminData.userId || 'admin'
      ]);
      
      await client.query('COMMIT');
      
      return { success: true, message: 'Resale approved successfully' };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error approving resale:', error);
      throw new Error('Failed to approve resale');
    } finally {
      client.release();
    }
  }

  /**
   * Block a resale event
   */
  async blockResale(resaleId, reason, adminData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update resale status
      const updateQuery = `
        UPDATE resale_events 
        SET status = 'blocked', updated_at = NOW()
        WHERE resale_id = $1
      `;
      
      await client.query(updateQuery, [resaleId]);
      
      // Log admin action
      const logQuery = `
        INSERT INTO audit_trail (
          action_category, action_type, resource_type, resource_id, 
          new_values, admin_user, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      await client.query(logQuery, [
        'resale_management',
        'block_resale',
        'resale_event',
        resaleId,
        JSON.stringify({ status: 'blocked', reason, admin: adminData }),
        adminData.userId || 'admin'
      ]);
      
      await client.query('COMMIT');
      
      return { success: true, message: 'Resale blocked successfully' };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error blocking resale:', error);
      throw new Error('Failed to block resale');
    } finally {
      client.release();
    }
  }

  /**
   * Get real-time updates for WebSocket/polling
   */
  async getRealTimeUpdates(lastUpdateTime) {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT 
          'resale_event' as type,
          re.id,
          re.resale_id,
          re.status,
          re.updated_at,
          p.metadata->>'brand' as brand,
          p.metadata->>'object_name' as product_name
        FROM resale_events re
        LEFT JOIN passports p ON re.passport_id = p.id
        WHERE re.updated_at > $1
        
        UNION ALL
        
        SELECT 
          'royalty_distribution' as type,
          rd.id,
          rd.resale_id,
          rd.status,
          rd.calculated_at as updated_at,
          NULL as brand,
          NULL as product_name
        FROM royalty_distributions rd
        WHERE rd.calculated_at > $1
        
        ORDER BY updated_at DESC
        LIMIT 100
      `;
      
      const result = await client.query(query, [lastUpdateTime]);
      
      return result.rows;
      
    } catch (error) {
      console.error('Error getting real-time updates:', error);
      throw new Error('Failed to retrieve real-time updates');
    } finally {
      client.release();
    }
  }
}

module.exports = new AdminDashboard();
