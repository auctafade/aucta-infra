const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

// Database connection using our existing connection setup
const db = require('../database');

/**
 * Hub Console API - Real backend integration for Hub processing workflows
 * This API connects the Hub Console frontend to our PostgreSQL database
 */

class HubConsoleAPI {
  constructor() {
    this.db = db;
  }

  // ====================
  // JOB MANAGEMENT
  // ====================

  /**
   * Get hub processing jobs for a specific hub
   */
  async getHubJobs(hubId, filters = {}) {
    try {
      let query = `
        SELECT 
          hpj.*,
          lh.hub_name,
          lh.hub_code,
          s.shipment_id,
          s.reference_sku,
          s.declared_value,
          s.currency,
          s.brand,
          s.category,
          s.weight,
          s.urgency_level,
          s.high_value,
          lc_sender.full_name as sender_name,
          lc_buyer.full_name as buyer_name,
          it.tag_id as reserved_tag_id,
          inf.nfc_uid as reserved_nfc_uid
        FROM hub_processing_jobs hpj
        LEFT JOIN logistics_hubs lh ON hpj.hub_id = lh.id
        LEFT JOIN shipments s ON hpj.shipment_id = s.shipment_id
        LEFT JOIN logistics_contacts lc_sender ON s.sender_id = lc_sender.id
        LEFT JOIN logistics_contacts lc_buyer ON s.buyer_id = lc_buyer.id
        LEFT JOIN inventory_tags it ON hpj.reserved_tag_id = it.tag_id
        LEFT JOIN inventory_nfc inf ON hpj.reserved_nfc_uid = inf.nfc_uid
        WHERE hpj.hub_id = $1
      `;
      
      const params = [hubId];
      let paramCount = 1;

      // Apply filters
      if (filters.tier && filters.tier !== 'all') {
        paramCount++;
        query += ` AND hpj.tier = $${paramCount}`;
        params.push(parseInt(filters.tier));
      }

      if (filters.status && filters.status !== 'all') {
        paramCount++;
        query += ` AND hpj.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.priority && filters.priority !== 'all') {
        paramCount++;
        query += ` AND hpj.priority = $${paramCount}`;
        params.push(filters.priority);
      }

      if (filters.when) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        if (filters.when === 'today') {
          paramCount++;
          query += ` AND hpj.planned_intake_time >= $${paramCount}`;
          params.push(today.toISOString());
          paramCount++;
          query += ` AND hpj.planned_intake_time < $${paramCount}`;
          params.push(tomorrow.toISOString());
        } else if (filters.when === 'tomorrow') {
          paramCount++;
          query += ` AND hpj.planned_intake_time >= $${paramCount}`;
          params.push(tomorrow.toISOString());
          paramCount++;
          query += ` AND hpj.planned_intake_time < $${paramCount}`;
          params.push(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString());
        } else if (filters.when === 'overdue') {
          paramCount++;
          query += ` AND hpj.sla_deadline < $${paramCount}`;
          params.push(now.toISOString());
        }
      }

      if (filters.search) {
        paramCount++;
        query += ` AND (
          hpj.shipment_id ILIKE $${paramCount} OR
          s.reference_sku ILIKE $${paramCount} OR
          s.brand ILIKE $${paramCount} OR
          lc_sender.full_name ILIKE $${paramCount} OR
          lc_buyer.full_name ILIKE $${paramCount}
        )`;
        params.push(`%${filters.search}%`);
      }

      query += ` ORDER BY 
        CASE 
          WHEN hpj.sla_deadline < NOW() THEN 1 
          ELSE 2 
        END,
        hpj.priority DESC,
        hpj.planned_intake_time ASC
      `;

      const result = await this.db.query(query, params);
      
      // Calculate additional fields
      const jobs = result.rows.map(job => ({
        ...job,
        isOverdue: new Date(job.sla_deadline) < new Date(),
        hoursOverdue: new Date(job.sla_deadline) < new Date() 
          ? Math.floor((new Date() - new Date(job.sla_deadline)) / (1000 * 60 * 60))
          : 0,
        evidenceStatus: this.calculateEvidenceStatus(job),
        checklistProgress: this.calculateChecklistProgress(job)
      }));

      return jobs;
    } catch (error) {
      console.error('Error fetching hub jobs:', error);
      throw error;
    }
  }

  /**
   * Get a specific job with detailed information
   */
  async getJobDetails(shipmentId) {
    try {
      const result = await this.db.query(`
        SELECT 
          hpj.*,
          lh.hub_name,
          lh.hub_code,
          s.*,
          lc_sender.full_name as sender_name,
          lc_sender.email as sender_email,
          lc_sender.phone as sender_phone,
          lc_sender.street_address as sender_address,
          lc_sender.city as sender_city,
          lc_sender.country as sender_country,
          lc_buyer.full_name as buyer_name,
          lc_buyer.email as buyer_email,
          lc_buyer.phone as buyer_phone,
          lc_buyer.street_address as buyer_address,
          lc_buyer.city as buyer_city,
          lc_buyer.country as buyer_country,
          it.tag_id as reserved_tag_id,
          it.status as tag_status,
          inf.nfc_uid as reserved_nfc_uid,
          inf.status as nfc_status,
          inf.read_test_passed,
          inf.write_test_passed
        FROM hub_processing_jobs hpj
        LEFT JOIN logistics_hubs lh ON hpj.hub_id = lh.id
        LEFT JOIN shipments s ON hpj.shipment_id = s.shipment_id
        LEFT JOIN logistics_contacts lc_sender ON s.sender_id = lc_sender.id
        LEFT JOIN logistics_contacts lc_buyer ON s.buyer_id = lc_buyer.id
        LEFT JOIN inventory_tags it ON hpj.reserved_tag_id = it.tag_id
        LEFT JOIN inventory_nfc inf ON hpj.reserved_nfc_uid = inf.nfc_uid
        WHERE hpj.shipment_id = $1
      `, [shipmentId]);

      if (result.rows.length === 0) {
        throw new Error(`Job not found: ${shipmentId}`);
      }

      const job = result.rows[0];
      
      // Get evidence files
      const evidenceResult = await this.db.query(`
        SELECT * FROM hub_evidence_files 
        WHERE job_id = $1 
        ORDER BY created_at DESC
      `, [job.id]);

      job.evidenceFiles = evidenceResult.rows;
      
      return job;
    } catch (error) {
      console.error('Error fetching job details:', error);
      throw error;
    }
  }

  /**
   * Create a new hub processing job
   */
  async createHubJob(jobData) {
    try {
      const result = await this.db.query(`
        INSERT INTO hub_processing_jobs (
          shipment_id, hub_id, tier, product_category, declared_value,
          planned_intake_time, sla_deadline, priority, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        jobData.shipmentId,
        jobData.hubId,
        jobData.tier,
        jobData.productCategory,
        jobData.declaredValue,
        jobData.plannedIntakeTime,
        jobData.slaDeadline,
        jobData.priority || 'normal',
        jobData.createdBy || 'system'
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating hub job:', error);
      throw error;
    }
  }

  /**
   * Update job status and timeline
   */
  async updateJobStatus(shipmentId, status, updateData = {}) {
    try {
      const fields = ['status = $2'];
      const params = [shipmentId, status];
      let paramCount = 2;

      // Add timeline updates based on status
      const now = new Date().toISOString();
      
      if (status === 'in_progress' && !updateData.intake_started_at) {
        paramCount++;
        fields.push(`intake_started_at = $${paramCount}`);
        params.push(now);
      }
      
      if (updateData.intake_completed_at) {
        paramCount++;
        fields.push(`intake_completed_at = $${paramCount}`);
        params.push(updateData.intake_completed_at);
      }

      if (updateData.processing_completed_at) {
        paramCount++;
        fields.push(`processing_completed_at = $${paramCount}`);
        params.push(updateData.processing_completed_at);
      }

      if (updateData.qa_completed_at) {
        paramCount++;
        fields.push(`qa_completed_at = $${paramCount}`);
        params.push(updateData.qa_completed_at);
      }

      if (updateData.tag_applied !== undefined) {
        paramCount++;
        fields.push(`tag_applied = $${paramCount}`);
        params.push(updateData.tag_applied);
      }

      if (updateData.nfc_installed !== undefined) {
        paramCount++;
        fields.push(`nfc_installed = $${paramCount}`);
        params.push(updateData.nfc_installed);
      }

      if (updateData.qa_status) {
        paramCount++;
        fields.push(`qa_status = $${paramCount}`);
        params.push(updateData.qa_status);
      }

      if (updateData.qa_notes) {
        paramCount++;
        fields.push(`qa_notes = $${paramCount}`);
        params.push(updateData.qa_notes);
      }

      const query = `
        UPDATE hub_processing_jobs 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE shipment_id = $1
        RETURNING *
      `;

      const result = await this.db.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  // ====================
  // INVENTORY MANAGEMENT
  // ====================

  /**
   * Get available inventory for a hub
   */
  async getAvailableInventory(hubId, type = 'both') {
    try {
      const results = {};

      if (type === 'tags' || type === 'both') {
        const tagResult = await this.db.query(`
          SELECT * FROM inventory_tags 
          WHERE current_hub_id = $1 AND status = 'available'
          ORDER BY created_at ASC
        `, [hubId]);
        results.tags = tagResult.rows;
      }

      if (type === 'nfc' || type === 'both') {
        const nfcResult = await this.db.query(`
          SELECT * FROM inventory_nfc 
          WHERE current_hub_id = $1 AND status = 'available'
          AND read_test_passed = true AND write_test_passed = true
          ORDER BY created_at ASC
        `, [hubId]);
        results.nfc = nfcResult.rows;
      }

      return results;
    } catch (error) {
      console.error('Error fetching available inventory:', error);
      throw error;
    }
  }

  /**
   * Reserve inventory for a job
   */
  async reserveInventory(shipmentId, hubId, tier) {
    try {
      await this.db.query('BEGIN');

      let tagId = null;
      let nfcUid = null;

      if (tier === 2 || tier === 3) {
        // Reserve a tag for Tier 2 or 3
        const tagResult = await this.db.query(`
          UPDATE inventory_tags 
          SET status = 'assigned', assigned_shipment_id = $1, assigned_hub_id = $2, assigned_at = NOW()
          WHERE id = (
            SELECT id FROM inventory_tags 
            WHERE current_hub_id = $2 AND status = 'available'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING tag_id
        `, [shipmentId, hubId]);

        if (tagResult.rows.length > 0) {
          tagId = tagResult.rows[0].tag_id;
        }
      }

      if (tier === 3) {
        // Reserve NFC for Tier 3
        const nfcResult = await this.db.query(`
          UPDATE inventory_nfc 
          SET status = 'assigned', assigned_shipment_id = $1, assigned_hub_id = $2, assigned_at = NOW()
          WHERE id = (
            SELECT id FROM inventory_nfc 
            WHERE current_hub_id = $2 AND status = 'available'
            AND read_test_passed = true AND write_test_passed = true
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING nfc_uid
        `, [shipmentId, hubId]);

        if (nfcResult.rows.length > 0) {
          nfcUid = nfcResult.rows[0].nfc_uid;
        }
      }

      // Update the job with reserved inventory
      await this.db.query(`
        UPDATE hub_processing_jobs 
        SET reserved_tag_id = $2, reserved_nfc_uid = $3
        WHERE shipment_id = $1
      `, [shipmentId, tagId, nfcUid]);

      await this.db.query('COMMIT');

      return { tagId, nfcUid };
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('Error reserving inventory:', error);
      throw error;
    }
  }

  /**
   * Apply tag or install NFC
   */
  async applyInventory(shipmentId, itemId, itemType) {
    try {
      const table = itemType === 'tag' ? 'inventory_tags' : 'inventory_nfc';
      const idField = itemType === 'tag' ? 'tag_id' : 'nfc_uid';
      const statusValue = itemType === 'tag' ? 'applied' : 'installed';
      const timestampField = itemType === 'tag' ? 'applied_at' : 'installed_at';

      const result = await this.db.query(`
        UPDATE ${table}
        SET status = $1, ${timestampField} = NOW()
        WHERE ${idField} = $2 AND assigned_shipment_id = $3
        RETURNING *
      `, [statusValue, itemId, shipmentId]);

      if (result.rows.length === 0) {
        throw new Error(`${itemType} not found or not assigned to this shipment`);
      }

      return result.rows[0];
    } catch (error) {
      console.error(`Error applying ${itemType}:`, error);
      throw error;
    }
  }

  /**
   * Swap inventory item (for edge cases)
   */
  async swapInventory(shipmentId, oldItemId, newItemId, itemType, reason, changedBy) {
    try {
      await this.db.query('BEGIN');

      const table = itemType === 'tag' ? 'inventory_tags' : 'inventory_nfc';
      const idField = itemType === 'tag' ? 'tag_id' : 'nfc_uid';

      // Release old item
      await this.db.query(`
        UPDATE ${table}
        SET status = 'available', assigned_shipment_id = NULL, assigned_hub_id = NULL, assigned_at = NULL
        WHERE ${idField} = $1
      `, [oldItemId]);

      // Assign new item
      await this.db.query(`
        UPDATE ${table}
        SET status = 'assigned', assigned_shipment_id = $1, assigned_at = NOW()
        WHERE ${idField} = $2
      `, [shipmentId, newItemId]);

      // Update job
      const reservedField = itemType === 'tag' ? 'reserved_tag_id' : 'reserved_nfc_uid';
      await this.db.query(`
        UPDATE hub_processing_jobs
        SET ${reservedField} = $2
        WHERE shipment_id = $1
      `, [shipmentId, newItemId]);

      // Log the change
      await this.db.query(`
        INSERT INTO inventory_audit_log (
          table_name, record_id, action, field_name, old_value, new_value, reason, changed_by
        ) VALUES ($1, 0, 'swap', $2, $3, $4, $5, $6)
      `, [table, idField, oldItemId, newItemId, reason, changedBy]);

      await this.db.query('COMMIT');

      return { success: true, newItemId };
    } catch (error) {
      await this.db.query('ROLLBACK');
      console.error('Error swapping inventory:', error);
      throw error;
    }
  }

  // ====================
  // EVIDENCE MANAGEMENT
  // ====================

  /**
   * Store evidence file
   */
  async storeEvidenceFile(jobId, fileData) {
    try {
      const result = await this.db.query(`
        INSERT INTO hub_evidence_files (
          job_id, filename, original_filename, file_path, file_size,
          mime_type, file_hash, evidence_type, validated, captured_at, captured_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        jobId,
        fileData.filename,
        fileData.originalFilename,
        fileData.filePath,
        fileData.fileSize,
        fileData.mimeType,
        fileData.fileHash,
        fileData.evidenceType,
        fileData.validated || false,
        fileData.capturedAt,
        fileData.capturedBy
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error storing evidence file:', error);
      throw error;
    }
  }

  /**
   * Get evidence files for a job
   */
  async getEvidenceFiles(jobId, evidenceType = null) {
    try {
      let query = 'SELECT * FROM hub_evidence_files WHERE job_id = $1';
      const params = [jobId];

      if (evidenceType) {
        query += ' AND evidence_type = $2';
        params.push(evidenceType);
      }

      query += ' ORDER BY created_at DESC';

      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching evidence files:', error);
      throw error;
    }
  }

  // ====================
  // INCIDENT MANAGEMENT
  // ====================

  /**
   * Create incident
   */
  async createIncident(incidentData) {
    try {
      const result = await this.db.query(`
        INSERT INTO hub_incidents (
          incident_id, job_id, incident_type, severity, title, description,
          job_paused, paused_at, reported_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        incidentData.incidentId,
        incidentData.jobId,
        incidentData.incidentType,
        incidentData.severity,
        incidentData.title,
        incidentData.description,
        incidentData.jobPaused || false,
        incidentData.pausedAt,
        incidentData.reportedBy
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating incident:', error);
      throw error;
    }
  }

  // ====================
  // TELEMETRY
  // ====================

  /**
   * Track telemetry event
   */
  async trackTelemetry(eventData) {
    try {
      await this.db.query(`
        INSERT INTO hub_telemetry_events (
          event_type, session_id, job_id, hub_id, user_id, user_role,
          event_data, duration_ms, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        eventData.event_type,
        eventData.session_id,
        eventData.job_id,
        eventData.hub_id,
        eventData.user_id,
        eventData.user_role,
        JSON.stringify(eventData.event_data),
        eventData.duration_ms,
        eventData.ip_address,
        eventData.user_agent
      ]);
    } catch (error) {
      console.error('Error tracking telemetry:', error);
      // Don't throw - telemetry should be non-blocking
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  calculateEvidenceStatus(job) {
    // This would normally check against hub_evidence_files
    // For now, return a basic status
    if (job.status === 'completed') return 'complete';
    if (job.status === 'in_progress') return 'partial';
    return 'pending';
  }

  calculateChecklistProgress(job) {
    let completed = 0;
    let total = 4; // intake, processing, qa, outbound

    if (job.intake_completed_at) completed++;
    if (job.processing_completed_at) completed++;
    if (job.qa_completed_at) completed++;
    if (job.outbound_completed_at) completed++;

    return Math.round((completed / total) * 100);
  }
}

module.exports = new HubConsoleAPI();
