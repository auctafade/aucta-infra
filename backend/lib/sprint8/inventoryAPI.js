const db = require('../database');

/**
 * Inventory Management API - Real backend integration for Tag Inventory System
 * Connects the Tag Inventory frontend to PostgreSQL database
 * Supports Tier 2 hub operations with complete audit trail
 */

class InventoryAPI {
  constructor() {
    this.db = db;
  }

  // ====================
  // HUB INVENTORY MANAGEMENT
  // ====================

  /**
   * Get hub inventory dashboard data with current stock levels
   */
  async getHubInventoryDashboard() {
    try {
      const query = `
        SELECT 
          h.id as hub_id,
          h.hub_name,
          h.hub_code,
          h.city,
          h.country,
          
          -- Current stock levels
          COUNT(it.id) FILTER (WHERE it.status = 'available') as free_tags,
          COUNT(it.id) FILTER (WHERE it.status = 'assigned') as reserved_tags,
          COUNT(it.id) FILTER (WHERE it.status = 'applied' AND it.applied_at::date = CURRENT_DATE) as applied_today,
          COUNT(it.id) FILTER (WHERE it.status = 'defective') as rma_tags,
          
          -- Total stock
          COUNT(it.id) as total_tags,
          
          -- Burn rates (7-day and 30-day)
          COUNT(it.id) FILTER (
            WHERE it.status = 'applied' 
            AND it.applied_at >= CURRENT_DATE - INTERVAL '7 days'
          ) as applied_last_7_days,
          COUNT(it.id) FILTER (
            WHERE it.status = 'applied' 
            AND it.applied_at >= CURRENT_DATE - INTERVAL '30 days'
          ) as applied_last_30_days,
          
          -- Hub metadata
          h.capacity_max,
          h.capacity_current,
          h.active,
          h.metadata

        FROM logistics_hubs h
        LEFT JOIN inventory_tags it ON h.id = it.current_hub_id
        WHERE h.active = true
        GROUP BY h.id, h.hub_name, h.hub_code, h.city, h.country, h.capacity_max, h.capacity_current, h.active, h.metadata
        ORDER BY h.hub_name
      `;

      const result = await this.db.query(query);
      
      // Transform data and add calculated metrics
      const hubData = result.rows.map(row => {
        const burnRate7d = row.applied_last_7_days / 7;
        const burnRate30d = row.applied_last_30_days / 30;
        const daysOfCover = burnRate7d > 0 ? Math.round(row.free_tags / burnRate7d) : Infinity;
        
        // Calculate hub status based on stock levels and days of cover
        let status = 'healthy';
        const stockRatio = row.free_tags / Math.max(row.total_tags * 0.5, 100); // Assume 50% of total or 100 minimum threshold
        
        if (daysOfCover < 7 || stockRatio < 0.5) {
          status = 'critical';
        } else if (daysOfCover < 14 || stockRatio < 0.8) {
          status = 'warning';
        }

        return {
          id: row.hub_id,
          name: row.hub_name,
          code: row.hub_code,
          location: `${row.city}, ${row.country}`,
          
          currentStock: {
            free: parseInt(row.free_tags),
            reserved: parseInt(row.reserved_tags),
            appliedToday: parseInt(row.applied_today),
            rma: parseInt(row.rma_tags),
            total: parseInt(row.total_tags)
          },
          
          burnRate: {
            sevenDay: parseFloat(burnRate7d.toFixed(2)),
            thirtyDay: parseFloat(burnRate30d.toFixed(2))
          },
          
          historical: {
            tagsAppliedLast7Days: parseInt(row.applied_last_7_days),
            tagsAppliedLast30Days: parseInt(row.applied_last_30_days)
          },
          
          metrics: {
            daysOfCover: daysOfCover === Infinity ? 'infinite' : daysOfCover,
            stockRatio: parseFloat(stockRatio.toFixed(2))
          },
          
          threshold: Math.max(parseInt(row.total_tags) * 0.3, 50), // 30% of total stock or 50 minimum
          status: status,
          capacity: {
            max: row.capacity_max,
            current: row.capacity_current
          },
          
          lastUpdate: new Date().toISOString()
        };
      });

      return {
        success: true,
        data: hubData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching hub inventory dashboard:', error);
      throw error;
    }
  }

  /**
   * Get detailed inventory for a specific hub
   */
  async getHubInventoryDetail(hubId, filters = {}) {
    try {
      let query = `
        SELECT 
          it.id,
          it.tag_id,
          it.tag_type,
          it.status,
          it.batch_number as lot,
          it.assigned_shipment_id as reserved_for,
          it.assigned_at,
          it.applied_at,
          it.received_at,
          it.created_at,
          it.updated_at,
          it.manufacture_date,
          it.expiry_date,
          it.quality_check_passed,
          it.quality_notes,
          
          -- Hub information
          h.hub_name,
          h.hub_code,
          
          -- Create batch range for display
          CASE 
            WHEN COUNT(*) OVER (PARTITION BY it.batch_number) > 1 
            THEN it.batch_number || ' (' || it.tag_id || ')'
            ELSE it.tag_id
          END as batch_range

        FROM inventory_tags it
        LEFT JOIN logistics_hubs h ON it.current_hub_id = h.id
        WHERE it.current_hub_id = $1
      `;

      const queryParams = [hubId];
      let paramCounter = 2;

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query += ` AND it.status = $${paramCounter}`;
        queryParams.push(filters.status);
        paramCounter++;
      }

      if (filters.lot && filters.lot !== 'all') {
        query += ` AND it.batch_number = $${paramCounter}`;
        queryParams.push(filters.lot);
        paramCounter++;
      }

      if (filters.searchQuery) {
        query += ` AND (it.tag_id ILIKE $${paramCounter} OR it.batch_number ILIKE $${paramCounter} OR it.assigned_shipment_id ILIKE $${paramCounter})`;
        queryParams.push(`%${filters.searchQuery}%`);
        paramCounter++;
      }

      if (filters.dateFrom && filters.dateTo) {
        query += ` AND it.received_at BETWEEN $${paramCounter} AND $${paramCounter + 1}`;
        queryParams.push(filters.dateFrom, filters.dateTo);
        paramCounter += 2;
      }

      query += ` ORDER BY it.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramCounter}`;
        queryParams.push(filters.limit);
      }

      const result = await this.db.query(query, queryParams);

      // Transform to frontend format
      const inventory = result.rows.map(row => ({
        id: row.tag_id,
        batchRange: row.batch_range,
        lot: row.batch_number,
        status: row.status,
        reservedFor: row.reserved_for,
        lastMovement: row.updated_at,
        notes: row.quality_notes || '',
        receivedDate: row.received_at,
        hub: hubId,
        type: row.tag_type,
        qualityPassed: row.quality_check_passed,
        manufactureDate: row.manufacture_date,
        expiryDate: row.expiry_date
      }));

      return {
        success: true,
        data: inventory,
        hubInfo: result.rows[0] ? {
          id: hubId,
          name: result.rows[0].hub_name,
          code: result.rows[0].hub_code
        } : null,
        filters: filters,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching hub inventory detail:', error);
      throw error;
    }
  }

  /**
   * Get available lots for filtering
   */
  async getAvailableLots(hubId = null) {
    try {
      let query = `
        SELECT DISTINCT batch_number as lot
        FROM inventory_tags
      `;
      
      const queryParams = [];
      if (hubId) {
        query += ` WHERE current_hub_id = $1`;
        queryParams.push(hubId);
      }
      
      query += ` ORDER BY batch_number`;

      const result = await this.db.query(query, queryParams);
      
      return {
        success: true,
        data: result.rows.map(row => row.lot),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching available lots:', error);
      throw error;
    }
  }

  // ====================
  // TAG OPERATIONS
  // ====================

  /**
   * Assign tag to shipment
   */
  async assignTagToShipment(tagId, shipmentId, hubId, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Validate tag can be assigned
      const tagCheck = await client.query(
        'SELECT * FROM inventory_tags WHERE tag_id = $1 AND current_hub_id = $2',
        [tagId, hubId]
      );

      if (tagCheck.rows.length === 0) {
        throw new Error(`Tag ${tagId} not found at hub ${hubId}`);
      }

      const tag = tagCheck.rows[0];
      if (tag.status !== 'available') {
        throw new Error(`Tag ${tagId} is not available (current status: ${tag.status})`);
      }

      // Update tag status
      await client.query(
        `UPDATE inventory_tags 
         SET status = 'assigned', 
             assigned_shipment_id = $1, 
             assigned_hub_id = $2,
             assigned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tag_id = $3`,
        [shipmentId, hubId, tagId]
      );

      // Log the assignment
      await client.query(
        `INSERT INTO inventory_audit_log 
         (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'inventory_tags', 
          tag.id, 
          'update', 
          'status', 
          'available', 
          'assigned',
          `Assigned to shipment ${shipmentId}`,
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'inventory.tag.assigned',
          JSON.stringify({ tagId, shipmentId, hubId }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          tagId,
          shipmentId,
          hubId,
          newStatus: 'assigned',
          assignedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error assigning tag to shipment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Apply tag (mark as applied during hub processing)
   */
  async applyTag(tagId, hubId, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update tag status
      const result = await client.query(
        `UPDATE inventory_tags 
         SET status = 'applied', 
             applied_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tag_id = $1 AND current_hub_id = $2 AND status = 'assigned'
         RETURNING *`,
        [tagId, hubId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Tag ${tagId} not found or not in assigned status at hub ${hubId}`);
      }

      const tag = result.rows[0];

      // Log the application
      await client.query(
        `INSERT INTO inventory_audit_log 
         (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'inventory_tags', 
          tag.id, 
          'update', 
          'status', 
          'assigned', 
          'applied',
          'Tag applied during hub processing',
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'inventory.tag.applied',
          JSON.stringify({ tagId, hubId, shipmentId: tag.assigned_shipment_id }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          tagId,
          hubId,
          newStatus: 'applied',
          appliedAt: tag.applied_at
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error applying tag:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark tag as RMA (defective)
   */
  async markTagRMA(tagId, reason, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update tag status
      const result = await client.query(
        `UPDATE inventory_tags 
         SET status = 'defective', 
             quality_check_passed = false,
             quality_notes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE tag_id = $1
         RETURNING *`,
        [tagId, `RMA: ${reason}`]
      );

      if (result.rows.length === 0) {
        throw new Error(`Tag ${tagId} not found`);
      }

      const tag = result.rows[0];

      // Log the RMA
      await client.query(
        `INSERT INTO inventory_audit_log 
         (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'inventory_tags', 
          tag.id, 
          'update', 
          'status', 
          tag.status, // Previous status
          'defective',
          reason,
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'inventory.tag.rma',
          JSON.stringify({ tagId, reason, previousStatus: tag.status }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          tagId,
          newStatus: 'defective',
          reason,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error marking tag as RMA:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get tag movement history
   */
  async getTagHistory(tagId) {
    try {
      const query = `
        SELECT 
          ial.*,
          it.tag_id,
          it.batch_number,
          h.hub_name
        FROM inventory_audit_log ial
        LEFT JOIN inventory_tags it ON ial.record_id = it.id
        LEFT JOIN logistics_hubs h ON it.current_hub_id = h.id
        WHERE it.tag_id = $1
        ORDER BY ial.created_at DESC
      `;

      const result = await this.db.query(query, [tagId]);

      const history = result.rows.map(row => ({
        id: row.id,
        action: row.action,
        fieldName: row.field_name,
        oldValue: row.old_value,
        newValue: row.new_value,
        reason: row.reason,
        changedBy: row.changed_by,
        timestamp: row.created_at,
        hubName: row.hub_name
      }));

      return {
        success: true,
        data: {
          tagId,
          history
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching tag history:', error);
      throw error;
    }
  }

  // ====================
  // STOCK VALIDATION
  // ====================

  /**
   * Validate hub stock for Tier Gate integration
   */
  async validateHubStock(hubId, requiredQuantity = 1) {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'available') as available_count,
          h.hub_name,
          h.hub_code
        FROM inventory_tags it
        LEFT JOIN logistics_hubs h ON it.current_hub_id = h.id
        WHERE it.current_hub_id = $1
        GROUP BY h.hub_name, h.hub_code
      `;

      const result = await this.db.query(query, [hubId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: `Hub ${hubId} not found or has no inventory`,
          available: 0,
          required: requiredQuantity
        };
      }

      const hubData = result.rows[0];
      const available = parseInt(hubData.available_count);

      return {
        success: available >= requiredQuantity,
        available,
        required: requiredQuantity,
        hubName: hubData.hub_name,
        hubCode: hubData.hub_code,
        canProceed: available >= requiredQuantity,
        suggestion: available < requiredQuantity 
          ? `Only ${available} tags available. Consider transferring stock or using another hub.`
          : null
      };

    } catch (error) {
      console.error('Error validating hub stock:', error);
      throw error;
    }
  }

  // ====================
  // BATCH OPERATIONS
  // ====================

  /**
   * Receive new tags batch into hub inventory
   */
  async receiveBatch(hubId, batchData, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const { lot, quantity, tagIds = [], supplierReference = '' } = batchData;
      const tags = [];

      // Generate tag IDs if not provided
      const finalTagIds = tagIds.length > 0 ? tagIds : [];
      if (finalTagIds.length < quantity) {
        for (let i = finalTagIds.length; i < quantity; i++) {
          const hubCode = await this.getHubCode(hubId);
          const tagId = `TAG-${hubCode}-${Date.now()}-${String(i + 1).padStart(3, '0')}`;
          finalTagIds.push(tagId);
        }
      }

      // Insert tags
      for (const tagId of finalTagIds.slice(0, quantity)) {
        const insertResult = await client.query(
          `INSERT INTO inventory_tags 
           (tag_id, tag_type, batch_number, current_hub_id, status, received_at, created_by)
           VALUES ($1, $2, $3, $4, 'available', CURRENT_TIMESTAMP, $5)
           RETURNING *`,
          [tagId, 'qr', lot, hubId, actorId]
        );

        tags.push(insertResult.rows[0]);

        // Log receipt
        await client.query(
          `INSERT INTO inventory_audit_log 
           (table_name, record_id, action, reason, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            'inventory_tags', 
            insertResult.rows[0].id, 
            'insert',
            `Batch received: ${lot} (${supplierReference})`,
            actorId
          ]
        );
      }

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'inventory.batch.received',
          JSON.stringify({ hubId, lot, quantity, supplierReference }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          hubId,
          lot,
          quantity,
          tagIds: tags.map(t => t.tag_id),
          receivedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error receiving batch:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  async getHubCode(hubId) {
    const result = await this.db.query(
      'SELECT hub_code FROM logistics_hubs WHERE id = $1',
      [hubId]
    );
    return result.rows[0]?.hub_code || 'HUB';
  }
}

module.exports = new InventoryAPI();
