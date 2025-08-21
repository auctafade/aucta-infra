const db = require('../database');
const nfcEventEmitter = require('./nfcEventEmitter');

/**
 * NFC Inventory Management API - Backend integration for NFC Inventory System (Tier 3)
 * Manages NFC chip tracking by UID and lot for Tier 3 operations
 * Supports hub-level inventory control, reservations, and quality monitoring
 * Includes state transitions, audit logging, and event emission
 */

class NFCInventoryAPI {
  constructor() {
    this.db = db;
    this.eventEmitter = nfcEventEmitter;
  }

  // ====================
  // STATE TRANSITION HELPERS
  // ====================

  /**
   * Create audit log entry for NFC state transitions
   */
  async logStateTransition(nfcUid, fromStatus, toStatus, action, actorId, details = {}) {
    // Get the NFC record ID for audit logging
    const nfcResult = await this.db.query('SELECT id FROM inventory_nfc WHERE nfc_uid = $1', [nfcUid]);
    const recordId = nfcResult.rows[0]?.id;

    if (!recordId) {
      console.error(`Cannot log audit trail - NFC ${nfcUid} not found`);
      return null;
    }

    const query = `
      INSERT INTO inventory_audit_log (
        table_name, record_id, action, field_name, old_value, new_value, reason, changed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      'inventory_nfc',
      recordId,
      action,
      'status',
      fromStatus,
      toStatus,
      JSON.stringify(details),
      actorId
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Link evidence files to job processing (simplified approach)
   */
  async linkEvidence(auditLogId, evidenceFiles) {
    if (!evidenceFiles || evidenceFiles.length === 0) return;

    // For now, we'll store evidence references in hub_telemetry_events as documentation
    // In a full implementation, we'd need a proper job_id to link to hub_evidence_files
    
    for (const file of evidenceFiles) {
      await this.db.query(
        `INSERT INTO hub_telemetry_events (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'nfc.evidence.attached',
          JSON.stringify({
            auditLogId,
            fileName: file.name,
            fileType: file.type || 'document',
            filePath: file.path,
            uploadedBy: file.uploadedBy || 'system'
          }),
          file.uploadedBy || 'system'
        ]
      );
    }
  }

  /**
   * Validate state transition is allowed
   */
  validateStateTransition(fromStatus, toStatus, action) {
    // Use actual database status values: 'available', 'assigned', 'installed', 'defective', 'rma'
    const allowedTransitions = {
      'available': ['assigned', 'defective', 'rma'], // Stock can be reserved or marked defective
      'assigned': ['installed', 'available', 'defective', 'rma'], // Reserved can be installed, unreserved, or marked defective
      'installed': ['defective', 'rma'], // Write-once: only defective/RMA allowed
      'defective': ['rma'], // Defective can become RMA
      'rma': [] // Terminal state
    };

    const allowed = allowedTransitions[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  // ====================
  // ENHANCED STATE TRANSITION METHODS
  // ====================

  /**
   * Receive batch of NFCs at a hub (Enhanced with events)
   * State: n/a → stock (status=available, hubId=<hub>, lot=<lot>)
   */
  async receiveNFCBatchEnhanced(hubId, batchData, actorId = 'system') {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        const { lot, quantity, supplierRef, uids, evidenceFiles } = batchData;
        const receivedUIDs = [];
        const timestamp = new Date();

        // Create NFCs in batch
        for (let i = 0; i < quantity; i++) {
          const uid = uids && uids[i] ? uids[i] : `NFC-${lot}-${String(i + 1).padStart(4, '0')}`;
          
          const insertQuery = `
            INSERT INTO inventory_nfc (
              nfc_uid, batch_number, supplier, status, current_hub_id, 
              received_at, created_by, created_at, updated_at
            )
            VALUES ($1, $2, $3, 'available', $4, $5, $6, $5, $5)
            RETURNING id, nfc_uid
          `;

          const result = await client.query(insertQuery, [
            uid, lot, supplierRef, hubId, timestamp, actorId
          ]);
          
          receivedUIDs.push(result.rows[0].nfc_uid);

          // Log state transition (creation)
          const auditLogId = await this.logStateTransition(
            uid, 
            null, 
            'available', 
            'receive', 
            actorId,
            {
              hubId,
              lot,
              supplierRef,
              receivedAt: timestamp
            }
          );

          // Link evidence files if provided
          if (evidenceFiles && evidenceFiles.length > 0) {
            await this.linkEvidence(auditLogId, evidenceFiles);
          }
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitNFCReceived({
          hubId,
          lot,
          qty: quantity,
          actorId,
          ts: timestamp.toISOString(),
          uids: receivedUIDs,
          evidenceFiles: evidenceFiles || []
        });

        return {
          success: true,
          receivedUIDs,
          message: `Successfully received ${quantity} NFCs for lot ${lot}`,
          auditTrail: true
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in receiveNFCBatchEnhanced:', error);
      return {
        success: false,
        message: 'Failed to receive NFCs',
        error: error.message
      };
    }
  }

  /**
   * Assign NFC to shipment (Enhanced with events)
   * State: stock → reserved (status=assigned, assignedShipmentId=<id>)
   */
  async assignNFCtoShipmentEnhanced(nfcUid, shipmentId, hubId, actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        // Get current NFC status
        const currentNFC = await client.query(
          'SELECT status, current_hub_id, batch_number FROM inventory_nfc WHERE nfc_uid = $1',
          [nfcUid]
        );

        if (currentNFC.rows.length === 0) {
          throw new Error(`NFC ${nfcUid} not found`);
        }

        const currentStatus = currentNFC.rows[0].status;
        
        // Validate state transition  
        if (!this.validateStateTransition(currentStatus, 'assigned', 'assign')) {
          throw new Error(`Cannot assign NFC ${nfcUid}: invalid transition from ${currentStatus} to assigned`);
        }

        // Update NFC status
        const result = await client.query(
          `UPDATE inventory_nfc 
           SET status = 'assigned', 
               assigned_shipment_id = $2,
               assigned_hub_id = $3,
               assigned_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE nfc_uid = $1 AND status = $4
           RETURNING *`,
          [nfcUid, shipmentId, hubId, currentStatus]
        );

        if (result.rows.length === 0) {
          throw new Error(`Failed to assign NFC ${nfcUid} - status may have changed`);
        }

        // Log state transition
        const auditLogId = await this.logStateTransition(
          nfcUid, 
          currentStatus, 
          'assigned', 
          'assign', 
          actorId,
          {
            shipmentId,
            hubId,
            assignedAt: new Date()
          }
        );

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitNFCAssigned({
          uid: nfcUid,
          hubId,
          shipmentId,
          actorId,
          ts: new Date().toISOString(),
          previousStatus: currentStatus
        });

        return {
          success: true,
          data: {
            nfcUid,
            shipmentId,
            hubId,
            newStatus: 'assigned',
            previousStatus: currentStatus,
            assignedAt: new Date().toISOString()
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in assignNFCtoShipmentEnhanced:', error);
      return {
        success: false,
        message: 'Failed to assign NFC to shipment',
        error: error.message
      };
    }
  }

  /**
   * Install NFC (Enhanced with events) - Called from Hub Console
   * State: reserved → installed (status=installed, write-once)
   */
  async installNFCEnhanced(nfcUid, hubId, testResults = {}, evidenceFiles = [], actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        // Get current NFC status
        const currentNFC = await client.query(
          'SELECT status, assigned_shipment_id FROM inventory_nfc WHERE nfc_uid = $1',
          [nfcUid]
        );

        if (currentNFC.rows.length === 0) {
          throw new Error(`NFC ${nfcUid} not found`);
        }

        const currentStatus = currentNFC.rows[0].status;
        
        // Validate state transition (only from assigned/reserved to installed)
        if (!this.validateStateTransition(currentStatus, 'installed', 'install')) {
          throw new Error(`Cannot install NFC ${nfcUid}: invalid transition from ${currentStatus} to installed`);
        }

        // Update NFC to installed status (write-once)
        const result = await client.query(
          `UPDATE inventory_nfc 
           SET status = 'installed', 
               installed_at = CURRENT_TIMESTAMP,
               read_test_passed = $3,
               write_test_passed = $4,
               last_test_date = CURRENT_TIMESTAMP,
               test_notes = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE nfc_uid = $1 AND current_hub_id = $2 AND status = $6
           RETURNING *`,
          [
            nfcUid, 
            hubId, 
            testResults.readTest !== false, 
            testResults.writeTest !== false,
            testResults.notes || 'Installation test completed',
            currentStatus
          ]
        );

        if (result.rows.length === 0) {
          throw new Error(`Failed to install NFC ${nfcUid} - not found or status changed`);
        }

        const nfc = result.rows[0];

        // Log state transition
        const auditLogId = await this.logStateTransition(
          nfcUid, 
          currentStatus, 
          'installed', 
          'install', 
          actorId,
          {
            hubId,
            testResults,
            installedAt: new Date(),
            shipmentId: nfc.assigned_shipment_id
          }
        );

        // Link evidence files
        if (evidenceFiles && evidenceFiles.length > 0) {
          await this.linkEvidence(auditLogId, evidenceFiles);
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitNFCInstalled({
          uid: nfcUid,
          hubId,
          actorId,
          ts: new Date().toISOString(),
          testResults,
          evidenceFiles
        });

        return {
          success: true,
          data: {
            nfcUid,
            hubId,
            newStatus: 'installed',
            previousStatus: currentStatus,
            installedAt: nfc.installed_at,
            testResults
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in installNFCEnhanced:', error);
      return {
        success: false,
        message: 'Failed to install NFC',
        error: error.message
      };
    }
  }

  /**
   * Mark NFC as RMA (Enhanced with events)
   * State: any → rma (status=rma, removed from free stock)
   */
  async markNFCasRMAEnhanced(nfcUid, reasonCode, notes, replacementUid = null, evidenceFiles = [], actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        // Get current NFC data
        const currentNFC = await client.query(
          'SELECT status, batch_number, assigned_shipment_id FROM inventory_nfc WHERE nfc_uid = $1',
          [nfcUid]
        );

        if (currentNFC.rows.length === 0) {
          throw new Error(`NFC ${nfcUid} not found`);
        }

        const currentStatus = currentNFC.rows[0].status;
        const lot = currentNFC.rows[0].batch_number;
        const shipmentId = currentNFC.rows[0].assigned_shipment_id;

        // Update NFC to RMA status
        const result = await client.query(
          `UPDATE inventory_nfc 
           SET status = 'rma',
               rma_initiated_at = CURRENT_TIMESTAMP,
               rma_reason = $2,
               rma_reference = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE nfc_uid = $1
           RETURNING *`,
          [nfcUid, reasonCode, `${reasonCode}: ${notes}`]
        );

        if (result.rows.length === 0) {
          throw new Error(`Failed to mark NFC ${nfcUid} as RMA`);
        }

        // Log state transition
        const auditLogId = await this.logStateTransition(
          nfcUid, 
          currentStatus, 
          'rma', 
          'rma', 
          actorId,
          {
            reasonCode,
            notes,
            replacementUid,
            rmaInitiatedAt: new Date()
          }
        );

        // Link evidence files
        if (evidenceFiles && evidenceFiles.length > 0) {
          await this.linkEvidence(auditLogId, evidenceFiles);
        }

        // Handle replacement UID if specified
        if (replacementUid && shipmentId) {
          // Assign replacement UID to same shipment
          await this.assignNFCtoShipmentEnhanced(replacementUid, shipmentId, result.rows[0].current_hub_id, actorId);
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitNFCRMA({
          uid: nfcUid,
          lot,
          reason: reasonCode,
          actorId,
          ts: new Date().toISOString(),
          replacementUid,
          evidenceFiles
        });

        return {
          success: true,
          data: {
            nfcUid,
            reasonCode,
            notes,
            newStatus: 'rma',
            previousStatus: currentStatus,
            replacementUid,
            rmaInitiatedAt: new Date().toISOString()
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in markNFCasRMAEnhanced:', error);
      return {
        success: false,
        message: 'Failed to mark NFC as RMA',
        error: error.message
      };
    }
  }

  /**
   * Quarantine lot (Enhanced with events)
   * State: all non-installed UIDs of lot → quarantined (blocks assignment/transfer)
   */
  async quarantineLotEnhanced(lotId, hubId, reason, actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        // Get all non-installed UIDs in the lot
        const nfcsToQuarantine = await client.query(
          `SELECT nfc_uid, status FROM inventory_nfc 
           WHERE batch_number = $1 AND status IN ('available', 'assigned') 
           AND ($2 IS NULL OR current_hub_id = $2)`,
          [lotId, hubId]
        );

        const affectedUIDs = [];

        // Update each NFC to defective status with quarantine note
        for (const nfc of nfcsToQuarantine.rows) {
          const result = await client.query(
            `UPDATE inventory_nfc 
             SET status = 'defective',
                 test_notes = COALESCE(test_notes || '; ', '') || $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE nfc_uid = $1
             RETURNING *`,
            [nfc.nfc_uid, `QUARANTINE: ${reason}`]
          );

          if (result.rows.length > 0) {
            affectedUIDs.push(nfc.nfc_uid);

            // Log state transition for each UID
            await this.logStateTransition(
              nfc.nfc_uid, 
              nfc.status, 
              'defective', 
              'quarantine', 
              actorId,
              {
                lotId,
                reason,
                quarantinedAt: new Date(),
                quarantineType: 'lot_quarantine'
              }
            );
          }
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitLotQuarantineSet({
          lot: lotId,
          reason,
          actorId,
          ts: new Date().toISOString(),
          hubId,
          affectedUIDs: affectedUIDs.length
        });

        return {
          success: true,
          data: {
            lotId,
            reason,
            affectedCount: affectedUIDs.length,
            affectedUIDs,
            hubId
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in quarantineLotEnhanced:', error);
      return {
        success: false,
        message: 'Failed to quarantine lot',
        error: error.message
      };
    }
  }

  /**
   * Lift quarantine (Enhanced with events)
   * State: quarantined → stock (with reason)
   */
  async liftQuarantineEnhanced(lotId, hubId, reason, actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        // Get all quarantined UIDs in the lot (defective with quarantine notes)
        const quarantinedNFCs = await client.query(
          `SELECT nfc_uid FROM inventory_nfc 
           WHERE batch_number = $1 AND status = 'defective' 
           AND test_notes LIKE '%QUARANTINE%'
           AND ($2 IS NULL OR current_hub_id = $2)`,
          [lotId, hubId]
        );

        const restoredUIDs = [];

        // Restore each NFC to available status
        for (const nfc of quarantinedNFCs.rows) {
          const result = await client.query(
            `UPDATE inventory_nfc 
             SET status = 'available',
                 test_notes = COALESCE(test_notes || '; ', '') || $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE nfc_uid = $1
             RETURNING *`,
            [nfc.nfc_uid, `QUARANTINE LIFTED: ${reason}`]
          );

          if (result.rows.length > 0) {
            restoredUIDs.push(nfc.nfc_uid);

            // Log state transition
            await this.logStateTransition(
              nfc.nfc_uid, 
              'defective', 
              'available', 
              'lift_quarantine', 
              actorId,
              {
                lotId,
                reason,
                liftedAt: new Date()
              }
            );
          }
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitLotQuarantineLifted({
          lot: lotId,
          actorId,
          ts: new Date().toISOString(),
          hubId,
          reason,
          restoredUIDs: restoredUIDs.length
        });

        return {
          success: true,
          data: {
            lotId,
            reason,
            restoredCount: restoredUIDs.length,
            restoredUIDs,
            hubId
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in liftQuarantineEnhanced:', error);
      return {
        success: false,
        message: 'Failed to lift quarantine',
        error: error.message
      };
    }
  }

  /**
   * Transfer NFCs between hubs (Enhanced with events)
   * State: stock@A → in_transit → stock@B on arrival
   */
  async transferNFCsEnhanced(fromHubId, toHubId, uids, quantity, reason, eta, actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        const transferId = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const transferredUIDs = [];

        // If transferring by quantity, select available UIDs
        let actualUIDs = uids;
        if (quantity && (!uids || uids.length === 0)) {
          const availableResult = await client.query(
            `SELECT nfc_uid FROM inventory_nfc 
             WHERE current_hub_id = $1 AND status = 'available' 
             LIMIT $2`,
            [fromHubId, quantity]
          );
          actualUIDs = availableResult.rows.map(row => row.nfc_uid);
        }

        // Validate and update each NFC to in_transit
        for (const uid of actualUIDs) {
          const currentNFC = await client.query(
            'SELECT status FROM inventory_nfc WHERE nfc_uid = $1',
            [uid]
          );

          if (currentNFC.rows.length === 0) {
            throw new Error(`NFC ${uid} not found`);
          }

          const currentStatus = currentNFC.rows[0].status;

          // For transfers, we'll mark as defective temporarily and track via audit log
          // This is a simplified approach - in production you'd add a proper transfer status
          const result = await client.query(
            `UPDATE inventory_nfc 
             SET test_notes = COALESCE(test_notes || '; ', '') || $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE nfc_uid = $1 AND status = $2
             RETURNING *`,
            [uid, currentStatus, `TRANSFER: ${transferId} to Hub ${toHubId}`]
          );

          if (result.rows.length > 0) {
            transferredUIDs.push(uid);

            // Log state transition
            await this.logStateTransition(
              uid, 
              currentStatus, 
              currentStatus, // Status doesn't change in this simplified model
              'transfer_initiated', 
              actorId,
              {
                fromHubId,
                toHubId,
                transferId,
                reason,
                eta,
                transferredAt: new Date()
              }
            );
          }
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitNFCTransferred({
          fromHub: fromHubId,
          toHub: toHubId,
          uids: transferredUIDs,
          eta,
          actorId,
          ts: new Date().toISOString(),
          reason,
          transferId
        });

        return {
          success: true,
          data: {
            transferId,
            fromHubId,
            toHubId,
            transferredUIDs,
            reason,
            eta,
            transferredAt: new Date().toISOString()
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in transferNFCsEnhanced:', error);
      return {
        success: false,
        message: 'Failed to transfer NFCs',
        error: error.message
      };
    }
  }

  /**
   * Complete NFC transfer arrival (Enhanced with events)
   * State: in_transit → stock@destination
   */
  async completeNFCTransferEnhanced(transferId, toHubId, arrivedUIDs, actorId = 'system') {
    try {
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');

        const completedUIDs = [];

        // Update each UID to destination hub and clear transfer notes
        for (const uid of arrivedUIDs) {
          const result = await client.query(
            `UPDATE inventory_nfc 
             SET current_hub_id = $2,
                 test_notes = REGEXP_REPLACE(COALESCE(test_notes, ''), 'TRANSFER: [^;]*;?\\s*', '', 'g'),
                 updated_at = CURRENT_TIMESTAMP
             WHERE nfc_uid = $1 AND test_notes LIKE '%TRANSFER: ' || $3 || '%'
             RETURNING *`,
            [uid, toHubId, transferId]
          );

          if (result.rows.length > 0) {
            completedUIDs.push(uid);

            // Log state transition
            await this.logStateTransition(
              uid, 
              result.rows[0].status, 
              result.rows[0].status, 
              'transfer_completed', 
              actorId,
              {
                transferId,
                toHubId,
                arrivedAt: new Date()
              }
            );
          }
        }

        await client.query('COMMIT');

        // Emit event after successful transaction
        this.eventEmitter.emitNFCTransferArrived({
          toHub: toHubId,
          uids: completedUIDs,
          ts: new Date().toISOString(),
          transferId,
          actorId
        });

        return {
          success: true,
          data: {
            transferId,
            toHubId,
            completedUIDs,
            arrivedAt: new Date().toISOString()
          }
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error in completeNFCTransferEnhanced:', error);
      return {
        success: false,
        message: 'Failed to complete NFC transfer',
        error: error.message
      };
    }
  }

  // ====================
  // HUB OVERVIEW DASHBOARD
  // ====================

  /**
   * Get NFC inventory dashboard data for all hubs
   */
  async getNFCHubOverview() {
    try {
      const query = `
        SELECT 
          h.id as hub_id,
          h.hub_name,
          h.hub_code,
          h.city,
          h.country,
          
          -- Current NFC stock levels by status
          COUNT(nfc.id) FILTER (WHERE nfc.status = 'available') as stock_count,
          COUNT(nfc.id) FILTER (WHERE nfc.status = 'assigned') as reserved_count,
          COUNT(nfc.id) FILTER (WHERE nfc.status = 'installed') as installed_count,
          COUNT(nfc.id) FILTER (WHERE nfc.status = 'defective' OR nfc.status = 'rma') as rma_count,
          COUNT(nfc.id) FILTER (WHERE nfc.status = 'defective' AND nfc.test_notes LIKE '%QUARANTINE%') as quarantined_count,
          
          -- Total NFC inventory
          COUNT(nfc.id) as total_nfc,
          
          -- Burn rates (7-day and 30-day installation rates)
          COUNT(nfc.id) FILTER (
            WHERE nfc.status = 'installed' 
            AND nfc.installed_at >= CURRENT_DATE - INTERVAL '7 days'
          ) as installed_last_7_days,
          COUNT(nfc.id) FILTER (
            WHERE nfc.status = 'installed' 
            AND nfc.installed_at >= CURRENT_DATE - INTERVAL '30 days'
          ) as installed_last_30_days,
          
          -- Lot health metrics
          COUNT(DISTINCT nfc.batch_number) FILTER (
            WHERE nfc.status = 'defective' AND nfc.test_notes LIKE '%QUARANTINE%'
          ) as quarantined_lots,
          COUNT(DISTINCT nfc.batch_number) FILTER (
            WHERE nfc.read_test_passed = false OR nfc.write_test_passed = false
          ) as high_failure_lots,
          COUNT(DISTINCT nfc.batch_number) as total_lots,
          
          -- Hub metadata
          h.capacity_max,
          h.capacity_current,
          h.active,
          h.metadata

        FROM logistics_hubs h
        LEFT JOIN inventory_nfc nfc ON h.id = nfc.current_hub_id
        WHERE h.active = true
        GROUP BY h.id, h.hub_name, h.hub_code, h.city, h.country, h.capacity_max, h.capacity_current, h.active, h.metadata
        ORDER BY h.hub_name
      `;

      const result = await this.db.query(query);
      
      // Get upcoming T3 demand from processing jobs
      const demandQuery = `
        SELECT 
          hub_id,
          COUNT(*) FILTER (
            WHERE tier = 3 
            AND status IN ('awaiting_intake', 'in_progress')
            AND planned_intake_time <= CURRENT_DATE + INTERVAL '7 days'
          ) as demand_7d,
          COUNT(*) FILTER (
            WHERE tier = 3 
            AND status IN ('awaiting_intake', 'in_progress')
            AND planned_intake_time <= CURRENT_DATE + INTERVAL '14 days'
          ) as demand_14d
        FROM hub_processing_jobs
        GROUP BY hub_id
      `;

      const demandResult = await this.db.query(demandQuery);
      const demandMap = demandResult.rows.reduce((map, row) => {
        map[row.hub_id] = {
          demand7d: parseInt(row.demand_7d),
          demand14d: parseInt(row.demand_14d)
        };
        return map;
      }, {});

      // Transform data and add calculated metrics
      const hubData = result.rows.map(row => {
        const stockCount = parseInt(row.stock_count);
        const totalNfc = parseInt(row.total_nfc);
        const installedLast7Days = parseInt(row.installed_last_7_days);
        const installedLast30Days = parseInt(row.installed_last_30_days);
        
        const burnRate7d = installedLast7Days / 7;
        const burnRate30d = installedLast30Days / 30;
        const daysOfCover = burnRate7d > 0 ? Math.round(stockCount / burnRate7d) : Infinity;
        
        // Calculate threshold (30% of total stock or 200 minimum for NFC)
        const threshold = Math.max(totalNfc * 0.3, 200);
        
        // Calculate hub status based on stock levels and days of cover
        let statusColor = 'green';
        const stockRatio = stockCount / threshold;
        
        if (daysOfCover < 5 || stockRatio < 0.3) {
          statusColor = 'red';
        } else if (daysOfCover < 10 || stockRatio < 0.6) {
          statusColor = 'amber';
        }

        const demand = demandMap[row.hub_id] || { demand7d: 0, demand14d: 0 };

        return {
          id: row.hub_id,
          name: row.hub_name,
          code: row.hub_code,
          location: `${row.city}, ${row.country}`,
          
          status: {
            stock: stockCount,
            reserved: parseInt(row.reserved_count),
            installed: parseInt(row.installed_count),
            rma: parseInt(row.rma_count),
            quarantined: parseInt(row.quarantined_count)
          },
          
          threshold: Math.round(threshold),
          burnRate7d: parseFloat(burnRate7d.toFixed(1)),
          burnRate30d: parseFloat(burnRate30d.toFixed(1)),
          daysOfCover: daysOfCover === Infinity ? 'infinite' : daysOfCover,
          
          upcomingDemand7d: demand.demand7d,
          upcomingDemand14d: demand.demand14d,
          
          lotHealth: {
            quarantinedLots: parseInt(row.quarantined_lots),
            highFailureLots: parseInt(row.high_failure_lots),
            totalLots: parseInt(row.total_lots)
          },
          
          statusColor: statusColor,
          lowStock: statusColor === 'red' || stockCount < threshold,
          
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
      console.error('Error fetching NFC hub overview:', error);
      throw error;
    }
  }

  // ====================
  // HUB DETAIL MANAGEMENT
  // ====================

  /**
   * Get detailed NFC inventory for a specific hub
   */
  async getNFCHubDetail(hubId, filters = {}) {
    try {
      let query = `
        SELECT 
          nfc.id,
          nfc.nfc_uid,
          nfc.nfc_type,
          nfc.status,
          nfc.batch_number as lot,
          nfc.assigned_shipment_id as reserved_for,
          nfc.assigned_at,
          nfc.installed_at,
          nfc.received_at,
          nfc.created_at,
          nfc.updated_at,
          nfc.manufacture_date,
          nfc.supplier,
          
          -- Test results
          nfc.read_test_passed,
          nfc.write_test_passed,
          nfc.last_test_date,
          nfc.test_notes,
          
          -- RMA information
          nfc.rma_initiated_at,
          nfc.rma_reason,
          nfc.rma_reference,
          
          -- Hub information
          h.hub_name,
          h.hub_code
          
        FROM inventory_nfc nfc
        LEFT JOIN logistics_hubs h ON nfc.current_hub_id = h.id
        WHERE nfc.current_hub_id = $1
      `;

      const queryParams = [hubId];
      let paramCounter = 2;

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'quarantined') {
          query += ` AND nfc.status = 'defective' AND nfc.test_notes LIKE '%QUARANTINE%'`;
        } else if (filters.status === 'stock') {
          query += ` AND nfc.status = 'available'`;
        } else if (filters.status === 'reserved') {
          query += ` AND nfc.status = 'assigned'`;
        } else {
          query += ` AND nfc.status = $${paramCounter}`;
          queryParams.push(filters.status);
          paramCounter++;
        }
      }

      if (filters.lot && filters.lot !== 'all') {
        query += ` AND nfc.batch_number = $${paramCounter}`;
        queryParams.push(filters.lot);
        paramCounter++;
      }

      if (filters.searchQuery) {
        query += ` AND (nfc.nfc_uid ILIKE $${paramCounter} OR nfc.batch_number ILIKE $${paramCounter} OR nfc.assigned_shipment_id ILIKE $${paramCounter})`;
        queryParams.push(`%${filters.searchQuery}%`);
        paramCounter++;
      }

      if (filters.dateFrom && filters.dateTo) {
        query += ` AND nfc.received_at BETWEEN $${paramCounter} AND $${paramCounter + 1}`;
        queryParams.push(filters.dateFrom, filters.dateTo);
        paramCounter += 2;
      }

      query += ` ORDER BY nfc.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramCounter}`;
        queryParams.push(filters.limit);
      }

      const result = await this.db.query(query, queryParams);

      // Transform to frontend format
      const inventory = result.rows.map(row => {
        // Determine status (handle quarantined as special case, map DB status to frontend)
        let status = row.status;
        if (status === 'defective' && row.test_notes && row.test_notes.includes('QUARANTINE')) {
          status = 'quarantined';
        } else if (status === 'available') {
          status = 'stock';
        } else if (status === 'assigned') {
          status = 'reserved';
        } else if (status === 'defective' || status === 'rma') {
          status = 'rma';
        }

        return {
          uid: row.nfc_uid,
          lot: row.lot || row.batch_number,
          status: status,
          reservedFor: row.reserved_for,
          installedAt: row.installed_at,
          testResults: {
            readTest: row.read_test_passed,
            writeTest: row.write_test_passed,
            lastTest: row.last_test_date
          },
          rmaReason: row.rma_reason,
          hub: hubId,
          receivedDate: row.received_at,
          notes: row.test_notes || row.rma_reason || '',
          type: row.nfc_type,
          supplier: row.supplier,
          manufactureDate: row.manufacture_date,
          lastAction: row.updated_at
        };
      });

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
      console.error('Error fetching NFC hub detail:', error);
      throw error;
    }
  }

  /**
   * Get available NFC lots for filtering
   */
  async getNFCAvailableLots(hubId = null) {
    try {
      let query = `
        SELECT DISTINCT batch_number as lot, COUNT(*) as count
        FROM inventory_nfc
      `;
      
      const queryParams = [];
      if (hubId) {
        query += ` WHERE current_hub_id = $1`;
        queryParams.push(hubId);
      }
      
      query += ` GROUP BY batch_number ORDER BY batch_number`;

      const result = await this.db.query(query, queryParams);
      
      return {
        success: true,
        data: result.rows.map(row => ({
          lot: row.lot,
          count: parseInt(row.count)
        })),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching NFC available lots:', error);
      throw error;
    }
  }

  // ====================
  // NFC OPERATIONS
  // ====================

  /**
   * Reserve NFC chip for Tier 3 shipment
   */
  async reserveNFCForShipment(nfcUid, shipmentId, hubId, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Validate NFC can be reserved
      const nfcCheck = await client.query(
        'SELECT * FROM inventory_nfc WHERE nfc_uid = $1 AND current_hub_id = $2',
        [nfcUid, hubId]
      );

      if (nfcCheck.rows.length === 0) {
        throw new Error(`NFC ${nfcUid} not found at hub ${hubId}`);
      }

      const nfc = nfcCheck.rows[0];
      if (nfc.status !== 'available') {
        throw new Error(`NFC ${nfcUid} is not available (current status: ${nfc.status})`);
      }

      // Check test results
      if (!nfc.read_test_passed || !nfc.write_test_passed) {
        throw new Error(`NFC ${nfcUid} has failed tests and cannot be reserved`);
      }

      // Update NFC status
      await client.query(
        `UPDATE inventory_nfc 
         SET status = 'assigned', 
             assigned_shipment_id = $1, 
             assigned_hub_id = $2,
             assigned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE nfc_uid = $3`,
        [shipmentId, hubId, nfcUid]
      );

      // Log the reservation
      await client.query(
        `INSERT INTO inventory_audit_log 
         (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'inventory_nfc', 
          nfc.id, 
          'update', 
          'status', 
          'available', 
          'assigned',
          `Reserved for T3 shipment ${shipmentId}`,
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'nfc.inventory.reserved',
          JSON.stringify({ nfcUid, shipmentId, hubId, tier: 3 }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          nfcUid,
          shipmentId,
          hubId,
          newStatus: 'assigned',
          assignedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error reserving NFC for shipment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Install NFC (mark as installed after sewing + tests)
   */
  async installNFC(nfcUid, hubId, testResults = {}, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Validate and update NFC status
      const result = await client.query(
        `UPDATE inventory_nfc 
         SET status = 'installed', 
             installed_at = CURRENT_TIMESTAMP,
             read_test_passed = $3,
             write_test_passed = $4,
             last_test_date = CURRENT_TIMESTAMP,
             test_notes = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE nfc_uid = $1 AND current_hub_id = $2 AND status = 'assigned'
         RETURNING *`,
        [
          nfcUid, 
          hubId, 
          testResults.readTest !== false, 
          testResults.writeTest !== false,
          testResults.notes || 'Installation test completed'
        ]
      );

      if (result.rows.length === 0) {
        throw new Error(`NFC ${nfcUid} not found or not in assigned status at hub ${hubId}`);
      }

      const nfc = result.rows[0];

      // Log the installation
      await client.query(
        `INSERT INTO inventory_audit_log 
         (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'inventory_nfc', 
          nfc.id, 
          'update', 
          'status', 
          'assigned', 
          'installed',
          'NFC installed after sewing and testing',
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'nfc.inventory.installed',
          JSON.stringify({ 
            nfcUid, 
            hubId, 
            shipmentId: nfc.assigned_shipment_id,
            testResults 
          }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          nfcUid,
          hubId,
          newStatus: 'installed',
          installedAt: nfc.installed_at,
          testResults
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error installing NFC:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Quarantine NFC lot due to quality issues
   */
  async quarantineNFCLot(lotId, reason, affectedUIDs = [], actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update all NFCs in the lot or specific UIDs
      let query, params;
      if (affectedUIDs.length > 0) {
        query = `
          UPDATE inventory_nfc 
          SET status = 'defective',
              test_notes = COALESCE(test_notes || '; ', '') || $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE nfc_uid = ANY($2)
          RETURNING *
        `;
        params = [`QUARANTINE: ${reason}`, affectedUIDs];
      } else {
        query = `
          UPDATE inventory_nfc 
          SET status = 'defective',
              test_notes = COALESCE(test_notes || '; ', '') || $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE batch_number = $2 AND status IN ('available', 'assigned')
          RETURNING *
        `;
        params = [`QUARANTINE: ${reason}`, lotId];
      }

      const result = await client.query(query, params);
      const affectedNFCs = result.rows;

      // Log each quarantine action
      for (const nfc of affectedNFCs) {
        await client.query(
          `INSERT INTO inventory_audit_log 
           (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            'inventory_nfc', 
            nfc.id, 
            'update', 
            'status', 
            'available', 
            'defective',
            `Lot quarantine: ${reason}`,
            actorId
          ]
        );
      }

      // Create incident record
      const incidentId = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-3)}`;
      await client.query(
        `INSERT INTO hub_incidents 
         (incident_id, incident_type, severity, title, description, status, reported_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          incidentId,
          'quality_issue',
          'high',
          `NFC Lot Quarantine: ${lotId}`,
          `Lot ${lotId} quarantined due to: ${reason}. Affected ${affectedNFCs.length} NFC units.`,
          'open',
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'nfc.inventory.lot.quarantined',
          JSON.stringify({ 
            lotId, 
            reason, 
            affectedCount: affectedNFCs.length,
            incidentId
          }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          lotId,
          reason,
          affectedCount: affectedNFCs.length,
          incidentId,
          affectedUIDs: affectedNFCs.map(nfc => nfc.nfc_uid)
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error quarantining NFC lot:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process RMA for defective NFC
   */
  async processNFCRMA(nfcUid, rmaReason, rmaReference, actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update NFC with RMA information
      const result = await client.query(
        `UPDATE inventory_nfc 
         SET status = 'defective',
             rma_initiated_at = CURRENT_TIMESTAMP,
             rma_reason = $2,
             rma_reference = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE nfc_uid = $1
         RETURNING *`,
        [nfcUid, rmaReason, rmaReference]
      );

      if (result.rows.length === 0) {
        throw new Error(`NFC ${nfcUid} not found`);
      }

      const nfc = result.rows[0];

      // Log the RMA
      await client.query(
        `INSERT INTO inventory_audit_log 
         (table_name, record_id, action, field_name, old_value, new_value, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'inventory_nfc', 
          nfc.id, 
          'update', 
          'status', 
          nfc.status,
          'defective',
          `RMA: ${rmaReason} (Ref: ${rmaReference})`,
          actorId
        ]
      );

      // Emit telemetry event
      await client.query(
        `INSERT INTO hub_telemetry_events 
         (event_type, event_data, user_id, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          'nfc.inventory.rma',
          JSON.stringify({ nfcUid, rmaReason, rmaReference }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          nfcUid,
          rmaReason,
          rmaReference,
          newStatus: 'defective',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error processing NFC RMA:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ====================
  // STOCK VALIDATION FOR TIER GATE
  // ====================

  /**
   * Validate NFC stock availability for Tier 3 reservations
   */
  async validateNFCStock(hubId, requiredQuantity = 1) {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (
            WHERE status = 'available' 
            AND read_test_passed = true 
            AND write_test_passed = true
          ) as available_count,
          COUNT(*) FILTER (WHERE status = 'available') as total_available,
          h.hub_name,
          h.hub_code
        FROM inventory_nfc nfc
        LEFT JOIN logistics_hubs h ON nfc.current_hub_id = h.id
        WHERE nfc.current_hub_id = $1
        GROUP BY h.hub_name, h.hub_code
      `;

      const result = await this.db.query(query, [hubId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: `Hub ${hubId} not found or has no NFC inventory`,
          available: 0,
          availableTestedGood: 0,
          required: requiredQuantity
        };
      }

      const hubData = result.rows[0];
      const availableTestedGood = parseInt(hubData.available_count);
      const totalAvailable = parseInt(hubData.total_available);

      return {
        success: availableTestedGood >= requiredQuantity,
        available: totalAvailable,
        availableTestedGood: availableTestedGood,
        required: requiredQuantity,
        hubName: hubData.hub_name,
        hubCode: hubData.hub_code,
        canProceed: availableTestedGood >= requiredQuantity,
        suggestion: availableTestedGood < requiredQuantity 
          ? `Only ${availableTestedGood} tested NFC units available. Consider transferring stock or using another hub.`
          : null
      };

    } catch (error) {
      console.error('Error validating NFC stock:', error);
      throw error;
    }
  }

  // ====================
  // TRANSFER MANAGEMENT
  // ====================

  /**
   * Create NFC transfer between hubs
   */
  async createNFCTransfer(fromHubId, toHubId, nfcUIDs, transferReason, urgency = 'normal', actorId = 'system') {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const transferId = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Validate all NFCs are available at source hub
      const nfcCheck = await client.query(
        `SELECT nfc_uid, status, current_hub_id 
         FROM inventory_nfc 
         WHERE nfc_uid = ANY($1) AND current_hub_id = $2`,
        [nfcUIDs, fromHubId]
      );

      if (nfcCheck.rows.length !== nfcUIDs.length) {
        throw new Error('Not all specified NFCs found at source hub');
      }

      const unavailableNFCs = nfcCheck.rows.filter(nfc => nfc.status !== 'available');
      if (unavailableNFCs.length > 0) {
        throw new Error(`NFCs not available for transfer: ${unavailableNFCs.map(n => n.nfc_uid).join(', ')}`);
      }

      // Create transfer record (using hub_incidents table for now, could create dedicated table)
      await client.query(
        `INSERT INTO hub_incidents 
         (incident_id, incident_type, severity, title, description, status, reported_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          transferId,
          'inventory_transfer',
          urgency === 'urgent' ? 'high' : 'medium',
          `NFC Transfer: Hub ${fromHubId} → Hub ${toHubId}`,
          `Transfer of ${nfcUIDs.length} NFC units. Reason: ${transferReason}`,
          'open',
          actorId
        ]
      );

      // Log transfer initiation for each NFC
      for (const nfcUID of nfcUIDs) {
        await client.query(
          `INSERT INTO inventory_audit_log 
           (table_name, record_id, action, reason, changed_by)
           VALUES ($1, 
                   (SELECT id FROM inventory_nfc WHERE nfc_uid = $2), 
                   $3, $4, $5)`,
          [
            'inventory_nfc',
            nfcUID,
            'transfer_initiated',
            `Transfer ${transferId}: ${transferReason}`,
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
          'nfc.inventory.transfer.created',
          JSON.stringify({ 
            transferId, 
            fromHubId, 
            toHubId, 
            nfcCount: nfcUIDs.length,
            urgency,
            reason: transferReason
          }),
          actorId
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        data: {
          transferId,
          fromHubId,
          toHubId,
          nfcUIDs,
          transferReason,
          urgency,
          status: 'initiated',
          createdAt: new Date().toISOString()
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating NFC transfer:', error);
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

  async getHubInfo(hubId) {
    const result = await this.db.query(
      'SELECT hub_name, hub_code, city, country FROM logistics_hubs WHERE id = $1',
      [hubId]
    );
    return result.rows[0] || null;
  }
}

module.exports = new NFCInventoryAPI();
