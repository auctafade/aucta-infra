// =========================================
// Sprint 8: Incident Management API Service
// Real database-backed incident operations
// =========================================

const pool = require('../../database/connection');

class IncidentManagementAPI {
  
  // ===============================
  // Core Incident CRUD Operations
  // ===============================
  
  static async createIncident(incidentData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate incident ID
      const incidentId = `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      // Calculate SLA due time based on severity
      const slaHours = {
        'S1': 2,   // Critical: 2 hours
        'S2': 8,   // High: 8 hours  
        'S3': 24,  // Medium: 24 hours
        'S4': 48   // Low: 48 hours
      };
      
      const slaDueAt = new Date(Date.now() + slaHours[incidentData.severity] * 60 * 60 * 1000);
      
      // Determine tier based on severity
      const tier = incidentData.severity === 'S1' ? 3 : incidentData.severity === 'S2' ? 2 : 1;
      
      // Calculate priority score
      const severityPriority = { 'S1': 95, 'S2': 75, 'S3': 45, 'S4': 20 };
      const priority = severityPriority[incidentData.severity];
      
      // Check for duplicate incidents
      const duplicateCheck = await client.query(`
        SELECT id, incident_id, type, status 
        FROM incidents 
        WHERE shipment_id = $1 AND type = $2 AND status NOT IN ('resolved', 'canceled')
      `, [incidentData.shipment_id, incidentData.type]);
      
      let duplicateWarnings = [];
      if (duplicateCheck.rows.length > 0) {
        duplicateWarnings = duplicateCheck.rows.map(row => ({
          incident_id: row.incident_id,
          type: row.type,
          status: row.status,
          overlap_reason: `Duplicate ${row.type} incident already exists`
        }));
      }
      
      // Insert main incident record
      const insertResult = await client.query(`
        INSERT INTO incidents (
          incident_id, type, severity, status, tier, title, description,
          shipment_id, leg_id, hub_id, owner_name, client_name, contact_name,
          contact_email, contact_phone, sla_due_at, priority, leg_display,
          hub_name, carrier, tracking_id, tags, related_incidents,
          requires_post_mortem, blocks_passport_activation
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        ) RETURNING *
      `, [
        incidentId, incidentData.type, incidentData.severity, 'open', tier,
        incidentData.title, incidentData.description, incidentData.shipment_id,
        incidentData.leg_id, incidentData.hub_id, incidentData.assignee,
        incidentData.client_name, incidentData.contact_name, incidentData.contact_email,
        incidentData.contact_phone, slaDueAt, priority, incidentData.leg_display,
        incidentData.hub_name, incidentData.carrier, incidentData.tracking_id,
        incidentData.tags || [], duplicateWarnings.map(d => d.incident_id) || [],
        tier >= 2, (incidentData.type === 'damage' || incidentData.type === 'lost') && tier === 3
      ]);
      
      const incident = insertResult.rows[0];
      
      // Create initial timeline entry
      await client.query(`
        INSERT INTO incident_timeline (
          incident_id, entry_type, user_name, title, description, is_client_visible
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        incident.id, 'status_change', incidentData.created_by || 'System',
        'Incident created', `New ${incidentData.type} incident created with severity ${incidentData.severity}`, false
      ]);
      
      // Create playbook record
      const playbookSteps = this.generatePlaybookSteps(incidentData.type);
      await client.query(`
        INSERT INTO incident_playbooks (
          incident_id, playbook_type, total_steps, required_steps, steps_data
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        incident.id, incidentData.type, playbookSteps.length,
        playbookSteps.filter(s => s.required).length, JSON.stringify(playbookSteps)
      ]);
      
      await client.query('COMMIT');
      
      return {
        success: true,
        data: {
          ...incident,
          duplicate_warnings: duplicateWarnings,
          playbook_steps: playbookSteps
        }
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating incident:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  static async getIncidents(filters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramCount = 0;
      
      // Build dynamic WHERE clause based on filters
      if (filters.type?.length > 0) {
        paramCount++;
        whereClause += ` AND type = ANY($${paramCount})`;
        params.push(filters.type);
      }
      
      if (filters.severity?.length > 0) {
        paramCount++;
        whereClause += ` AND severity = ANY($${paramCount})`;
        params.push(filters.severity);
      }
      
      if (filters.status?.length > 0) {
        paramCount++;
        whereClause += ` AND status = ANY($${paramCount})`;
        params.push(filters.status);
      }
      
      if (filters.owner_name) {
        paramCount++;
        whereClause += ` AND owner_name = $${paramCount}`;
        params.push(filters.owner_name);
      }
      
      if (filters.shipment_id) {
        paramCount++;
        whereClause += ` AND shipment_id = $${paramCount}`;
        params.push(filters.shipment_id);
      }
      
      if (filters.search) {
        paramCount++;
        whereClause += ` AND (
          incident_id ILIKE $${paramCount} OR 
          title ILIKE $${paramCount} OR 
          shipment_id ILIKE $${paramCount} OR
          client_name ILIKE $${paramCount} OR
          contact_name ILIKE $${paramCount}
        )`;
        params.push(`%${filters.search}%`);
      }
      
      // Build ORDER BY clause
      const sortBy = filters.sort_by || 'priority';
      const sortOrder = filters.sort_order || 'desc';
      
      // Always prioritize overdue incidents
      let orderClause = `ORDER BY is_overdue DESC, ${sortBy} ${sortOrder}, created_at DESC`;
      
      // Add pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      
      const query = `
        SELECT i.*, 
               t.sla_breached, 
               t.time_to_own_ms, 
               t.time_to_resolve_ms,
               t.client_notifications_sent,
               CASE 
                 WHEN i.sla_due_at < NOW() AND i.status NOT IN ('resolved', 'canceled') THEN true
                 ELSE false
               END as is_currently_overdue
        FROM incidents i
        LEFT JOIN incident_telemetry t ON i.id = t.incident_id
        ${whereClause}
        ${orderClause}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) FROM incidents i ${whereClause}`;
      const countResult = await pool.query(countQuery, params.slice(0, paramCount));
      
      return {
        success: true,
        data: {
          incidents: result.rows,
          total_count: parseInt(countResult.rows[0].count),
          page_info: {
            limit,
            offset,
            has_more: result.rows.length === limit
          }
        }
      };
      
    } catch (error) {
      console.error('Error fetching incidents:', error);
      throw error;
    }
  }
  
  static async getIncidentById(incidentId) {
    try {
      const result = await pool.query(`
        SELECT i.*, 
               t.sla_breached, 
               t.time_to_own_ms, 
               t.time_to_resolve_ms,
               t.reopen_count,
               t.escalation_count,
               t.client_notifications_sent
        FROM incidents i
        LEFT JOIN incident_telemetry t ON i.id = t.incident_id
        WHERE i.incident_id = $1
      `, [incidentId]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Incident not found' };
      }
      
      const incident = result.rows[0];
      
      // Get timeline
      const timelineResult = await pool.query(`
        SELECT * FROM incident_timeline 
        WHERE incident_id = $1 
        ORDER BY timestamp DESC
      `, [incident.id]);
      
      // Get playbook
      const playbookResult = await pool.query(`
        SELECT * FROM incident_playbooks 
        WHERE incident_id = $1
      `, [incident.id]);
      
      // Get files
      const filesResult = await pool.query(`
        SELECT * FROM incident_files 
        WHERE incident_id = $1 
        ORDER BY uploaded_at DESC
      `, [incident.id]);
      
      // Get communications
      const commsResult = await pool.query(`
        SELECT * FROM incident_communications 
        WHERE incident_id = $1 
        ORDER BY created_at DESC
      `, [incident.id]);
      
      // Get active conflicts
      const conflictsResult = await pool.query(`
        SELECT * FROM incident_conflicts 
        WHERE incident_id = $1 AND is_resolved = false
        ORDER BY detected_at DESC
      `, [incident.id]);
      
      return {
        success: true,
        data: {
          incident,
          timeline: timelineResult.rows,
          playbook: playbookResult.rows[0],
          files: filesResult.rows,
          communications: commsResult.rows,
          active_conflicts: conflictsResult.rows
        }
      };
      
    } catch (error) {
      console.error('Error fetching incident:', error);
      throw error;
    }
  }
  
  // ===============================
  // Incident Updates and Actions
  // ===============================
  
  static async updateIncident(incidentId, updates, actorName = 'System') {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current incident
      const currentResult = await client.query(`
        SELECT * FROM incidents WHERE incident_id = $1
      `, [incidentId]);
      
      if (currentResult.rows.length === 0) {
        throw new Error('Incident not found');
      }
      
      const currentIncident = currentResult.rows[0];
      
      // Check for conflicts before update
      const conflicts = await this.detectConflicts(currentIncident, updates);
      if (conflicts.length > 0 && conflicts.some(c => c.severity === 'blocking')) {
        return {
          success: false,
          error: 'Update blocked by conflicts',
          conflicts: conflicts
        };
      }
      
      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;
      
      Object.keys(updates).forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);
          updateValues.push(updates[field]);
        }
      });
      
      if (updateFields.length === 0) {
        return { success: false, error: 'No valid updates provided' };
      }
      
      // Add incident ID as last parameter
      paramCount++;
      updateValues.push(incidentId);
      
      const updateQuery = `
        UPDATE incidents 
        SET ${updateFields.join(', ')}
        WHERE incident_id = $${paramCount}
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, updateValues);
      const updatedIncident = updateResult.rows[0];
      
      // Log changes in timeline
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = currentIncident[field];
        if (oldValue !== newValue) {
          await client.query(`
            INSERT INTO incident_timeline (
              incident_id, entry_type, user_name, title, description, is_client_visible
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            updatedIncident.id, 'status_change', actorName,
            `${field.replace('_', ' ')} updated`,
            `Changed ${field} from "${oldValue}" to "${newValue}"`,
            ['status', 'severity', 'priority'].includes(field)
          ]);
          
          // Log manual update
          await client.query(`
            INSERT INTO incident_manual_updates (
              incident_id, field_name, old_value, new_value, reason, 
              update_source, user_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            updatedIncident.id, field, String(oldValue), String(newValue),
            updates.update_reason || 'Manual update', 'manual', actorName
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        data: updatedIncident
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating incident:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  static async resolveIncident(incidentId, resolutionData, actorName = 'System') {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current incident with playbook
      const incidentResult = await client.query(`
        SELECT i.*, p.steps_data, p.required_steps, p.completed_required_steps
        FROM incidents i
        LEFT JOIN incident_playbooks p ON i.id = p.incident_id
        WHERE i.incident_id = $1
      `, [incidentId]);
      
      if (incidentResult.rows.length === 0) {
        throw new Error('Incident not found');
      }
      
      const incident = incidentResult.rows[0];
      
      // Validate resolution requirements
      const validationResult = await this.validateResolution(incident);
      if (!validationResult.can_resolve && !resolutionData.admin_override) {
        return {
          success: false,
          error: 'Resolution requirements not met',
          validation_errors: validationResult.reasons
        };
      }
      
      // Update incident to resolved
      const updateResult = await client.query(`
        UPDATE incidents 
        SET status = 'resolved', 
            resolution = $1, 
            resolution_notes = $2,
            resolved_at = CURRENT_TIMESTAMP,
            post_mortem_completed = $3,
            post_mortem_data = $4,
            passport_hold_override = $5,
            passport_hold_override_reason = $6
        WHERE incident_id = $7
        RETURNING *
      `, [
        resolutionData.reason,
        resolutionData.post_mortem,
        !!resolutionData.post_mortem,
        resolutionData.post_mortem ? { 
          root_cause: resolutionData.reason,
          completed_by: actorName,
          completed_at: new Date().toISOString()
        } : null,
        !!resolutionData.override_passport_hold,
        resolutionData.override_reason,
        incidentId
      ]);
      
      const resolvedIncident = updateResult.rows[0];
      
      // Add resolution timeline entry
      await client.query(`
        INSERT INTO incident_timeline (
          incident_id, entry_type, user_name, title, description, is_client_visible
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        resolvedIncident.id, 'status_change', actorName,
        'Incident resolved',
        `Resolution: ${resolutionData.reason}${resolutionData.post_mortem ? ' | Post-mortem completed' : ''}`,
        true
      ]);
      
      await client.query('COMMIT');
      
      return {
        success: true,
        data: resolvedIncident
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error resolving incident:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // ===============================
  // Timeline and Communication
  // ===============================
  
  static async addTimelineEntry(incidentId, entryData) {
    try {
      const result = await pool.query(`
        INSERT INTO incident_timeline (
          incident_id, entry_type, user_name, title, description, 
          is_client_visible, metadata
        ) VALUES (
          (SELECT id FROM incidents WHERE incident_id = $1),
          $2, $3, $4, $5, $6, $7
        ) RETURNING *
      `, [
        incidentId, entryData.entry_type, entryData.user_name,
        entryData.title, entryData.description, entryData.is_client_visible || false,
        entryData.metadata || {}
      ]);
      
      return {
        success: true,
        data: result.rows[0]
      };
      
    } catch (error) {
      console.error('Error adding timeline entry:', error);
      throw error;
    }
  }
  
  static async sendClientCommunication(incidentId, communicationData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check communication policy
      const policyCheck = await this.checkCommunicationPolicy(incidentId, communicationData.template_id);
      if (!policyCheck.allowed) {
        return {
          success: false,
          error: 'Communication blocked by policy',
          reason: policyCheck.reason,
          cooldown_minutes: policyCheck.cooldown_minutes
        };
      }
      
      // Insert communication record
      const commResult = await client.query(`
        INSERT INTO incident_communications (
          incident_id, communication_type, channel, template_id,
          subject, content, status
        ) VALUES (
          (SELECT id FROM incidents WHERE incident_id = $1),
          $2, $3, $4, $5, $6, 'sent'
        ) RETURNING *
      `, [
        incidentId, communicationData.type, communicationData.channel,
        communicationData.template_id, communicationData.subject,
        communicationData.content
      ]);
      
      // Update incident communication count
      await client.query(`
        UPDATE incidents 
        SET client_notifications_count = client_notifications_count + 1,
            last_client_notification = CURRENT_TIMESTAMP
        WHERE incident_id = $1
      `, [incidentId]);
      
      // Add timeline entry
      await client.query(`
        INSERT INTO incident_timeline (
          incident_id, entry_type, user_name, title, description, is_client_visible
        ) VALUES (
          (SELECT id FROM incidents WHERE incident_id = $1),
          'client_notification', $2, $3, $4, true
        )
      `, [
        incidentId, communicationData.sent_by || 'System',
        'Client notified', `Sent: ${communicationData.subject}`
      ]);
      
      await client.query('COMMIT');
      
      return {
        success: true,
        data: commResult.rows[0]
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error sending communication:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // ===============================
  // Edge Case Handling
  // ===============================
  
  static async checkOwnershipGaps() {
    try {
      const result = await pool.query(`
        SELECT i.*, 
               EXTRACT(EPOCH FROM (NOW() - i.created_at)) * 1000 as time_unassigned_ms
        FROM incidents i
        WHERE i.owner_name IS NULL 
          AND i.status NOT IN ('resolved', 'canceled')
          AND (
            (i.severity = 'S1' AND i.created_at < NOW() - INTERVAL '5 minutes') OR
            (i.severity = 'S2' AND i.created_at < NOW() - INTERVAL '15 minutes') OR
            (i.severity = 'S3' AND i.created_at < NOW() - INTERVAL '1 hour') OR
            (i.severity = 'S4' AND i.created_at < NOW() - INTERVAL '4 hours')
          )
        ORDER BY i.created_at ASC
      `);
      
      return {
        success: true,
        data: result.rows.map(row => ({
          incident: row,
          time_unassigned_ms: parseInt(row.time_unassigned_ms),
          escalation_required: true
        }))
      };
      
    } catch (error) {
      console.error('Error checking ownership gaps:', error);
      throw error;
    }
  }
  
  static async autoEscalateIncident(incidentId, reason) {
    try {
      const result = await this.updateIncident(incidentId, {
        owner_name: 'Ops Lead',
        escalation_count: pool.raw('escalation_count + 1'),
        priority: pool.raw('priority + 25')
      }, 'Auto-Escalation System');
      
      if (result.success) {
        await this.addTimelineEntry(incidentId, {
          entry_type: 'escalation',
          user_name: 'System',
          title: 'Auto-escalated due to ownership gap',
          description: reason,
          is_client_visible: false
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Error auto-escalating incident:', error);
      throw error;
    }
  }
  
  // ===============================
  // Helper Functions
  // ===============================
  
  static generatePlaybookSteps(incidentType) {
    const playbooks = {
      customs: [
        { id: 'commercial_invoice', label: 'Commercial invoice present', required: true, completed: false },
        { id: 'hs_code', label: 'HS code verified', required: true, completed: false },
        { id: 'incoterm', label: 'Incoterm (DAP) confirmed', required: true, completed: false },
        { id: 'insured_value', label: 'Insured value documented', required: true, completed: false },
        { id: 'broker_contact', label: 'Broker contacted', required: true, completed: false },
        { id: 'docs_sent', label: 'Documents sent timestamp', required: true, completed: false }
      ],
      delay: [
        { id: 'root_cause', label: 'Root cause identified', required: true, completed: false },
        { id: 'replan_option', label: 'Replan option selected', required: true, completed: false },
        { id: 'client_notified', label: 'Client notified of delay', required: true, completed: false },
        { id: 'new_eta', label: 'New ETA confirmed', required: true, completed: false }
      ],
      damage: [
        { id: 'damage_photos', label: 'Damage photos taken', required: true, completed: false },
        { id: 'condition_report', label: 'Condition report filed', required: true, completed: false },
        { id: 'carrier_claim', label: 'Carrier claim opened', required: true, completed: false },
        { id: 'client_contacted', label: 'Client contacted', required: true, completed: false },
        { id: 'resolution_path', label: 'Resolution path agreed', required: true, completed: false }
      ],
      lost: [
        { id: 'last_scan', label: 'Last scan location confirmed', required: true, completed: false },
        { id: 'carrier_trace', label: 'Carrier trace initiated', required: true, completed: false },
        { id: 'wg_contact', label: 'WG team contacted', required: true, completed: false },
        { id: 'cctv_check', label: 'CCTV/Hub check completed', required: false, completed: false },
        { id: 'insurance_claim', label: 'Insurance claim filed', required: true, completed: false }
      ]
    };
    
    return playbooks[incidentType] || [];
  }
  
  static async detectConflicts(incident, proposedAction) {
    const conflicts = [];
    
    // Implementation would check for various conflict types
    // This is a simplified version
    
    return conflicts;
  }
  
  static async validateResolution(incident) {
    const reasons = [];
    
    // Check playbook completion
    if (incident.steps_data) {
      const steps = JSON.parse(incident.steps_data);
      const requiredSteps = steps.filter(s => s.required);
      const completedRequired = requiredSteps.filter(s => s.completed);
      
      if (completedRequired.length < requiredSteps.length) {
        reasons.push(`${requiredSteps.length - completedRequired.length} required playbook steps incomplete`);
      }
    }
    
    // Check type-specific requirements
    if (incident.type === 'damage') {
      // Would check for damage photos in files table
      const filesResult = await pool.query(`
        SELECT COUNT(*) FROM incident_files 
        WHERE incident_id = $1 AND 'damage' = ANY(tags)
      `, [incident.id]);
      
      if (parseInt(filesResult.rows[0].count) === 0) {
        reasons.push('Damage photos required before resolution');
      }
    }
    
    return {
      can_resolve: reasons.length === 0,
      reasons
    };
  }
  
  static async checkCommunicationPolicy(incidentId, templateId) {
    try {
      // Check recent communications
      const recentResult = await pool.query(`
        SELECT COUNT(*) as recent_count
        FROM incident_communications 
        WHERE incident_id = (SELECT id FROM incidents WHERE incident_id = $1)
          AND created_at > NOW() - INTERVAL '1 hour'
      `, [incidentId]);
      
      const recentCount = parseInt(recentResult.rows[0].recent_count);
      
      if (recentCount >= 3) {
        return {
          allowed: false,
          reason: 'Maximum 3 communications per hour exceeded',
          cooldown_minutes: 60
        };
      }
      
      // Check for duplicate template in last 30 minutes
      const duplicateResult = await pool.query(`
        SELECT created_at
        FROM incident_communications 
        WHERE incident_id = (SELECT id FROM incidents WHERE incident_id = $1)
          AND template_id = $2
          AND created_at > NOW() - INTERVAL '30 minutes'
        ORDER BY created_at DESC
        LIMIT 1
      `, [incidentId, templateId]);
      
      if (duplicateResult.rows.length > 0) {
        return {
          allowed: false,
          reason: 'Similar communication sent within last 30 minutes',
          cooldown_minutes: 30
        };
      }
      
      return { allowed: true };
      
    } catch (error) {
      console.error('Error checking communication policy:', error);
      return { allowed: false, reason: 'Policy check failed' };
    }
  }
  
  // ===============================
  // Analytics and Telemetry
  // ===============================
  
  static async getIncidentAnalytics(timeRange = '7d') {
    try {
      const interval = timeRange === '24h' ? '1 day' : 
                     timeRange === '7d' ? '7 days' :
                     timeRange === '30d' ? '30 days' : '7 days';
      
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_incidents,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
          COUNT(*) FILTER (WHERE is_overdue = true) as overdue_count,
          COUNT(*) FILTER (WHERE severity = 'S1') as critical_count,
          COUNT(*) FILTER (WHERE owner_name IS NULL) as unassigned_count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE resolved_at IS NOT NULL) * 1000 as avg_resolution_time_ms,
          AVG(t.time_to_own_ms) FILTER (WHERE t.time_to_own_ms IS NOT NULL) as avg_time_to_own_ms
        FROM incidents i
        LEFT JOIN incident_telemetry t ON i.id = t.incident_id
        WHERE i.created_at > NOW() - INTERVAL '${interval}'
      `);
      
      const typeBreakdown = await pool.query(`
        SELECT type, COUNT(*) as count
        FROM incidents
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY type
        ORDER BY count DESC
      `);
      
      const severityBreakdown = await pool.query(`
        SELECT severity, COUNT(*) as count
        FROM incidents
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY severity
        ORDER BY 
          CASE severity
            WHEN 'S1' THEN 1
            WHEN 'S2' THEN 2
            WHEN 'S3' THEN 3
            WHEN 'S4' THEN 4
          END
      `);
      
      return {
        success: true,
        data: {
          summary: result.rows[0],
          type_breakdown: typeBreakdown.rows,
          severity_breakdown: severityBreakdown.rows,
          time_range: timeRange
        }
      };
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }
}

module.exports = IncidentManagementAPI;


