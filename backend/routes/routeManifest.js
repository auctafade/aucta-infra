// routes/routeManifest.js
// Route Manifest API endpoints

const express = require('express');
const router = express.Router();
const RouteManifestGenerator = require('../lib/sprint8/routeManifestGenerator');
const pool = require('../database/connection');

// Initialize manifest generator
const manifestGenerator = new RouteManifestGenerator();

/**
 * POST /api/shipments/:shipmentId/route-map
 * Generate route manifest (PDF and HTML) for operations
 */
router.post('/shipments/:shipmentId/route-map', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { route } = req.body;
    
    if (!route) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ROUTE', message: 'Route data is required' }
      });
    }
    
    // Get shipment data
    const shipmentResult = await pool.query(`
      SELECT s.*, 
             sc.full_name as sender_name, sc.address as sender_address,
             sc.city as sender_city, sc.country as sender_country,
             bc.full_name as buyer_name, bc.address as buyer_address, 
             bc.city as buyer_city, bc.country as buyer_country
      FROM shipments s
      LEFT JOIN logistics_contacts sc ON s.sender_id = sc.id
      LEFT JOIN logistics_contacts bc ON s.buyer_id = bc.id
      WHERE s.shipment_id = $1
    `, [shipmentId]);
    
    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'SHIPMENT_NOT_FOUND', message: 'Shipment not found' }
      });
    }
    
    const shipmentData = shipmentResult.rows[0];
    
    // Generate manifest
    const manifest = await manifestGenerator.generateRouteManifest(shipmentData, route);
    
    // Log manifest generation
    await pool.query(`
      INSERT INTO route_manifest_logs (
        shipment_id,
        manifest_id,
        route_type,
        pdf_path,
        html_path,
        generated_by,
        generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `, [
      shipmentData.id,
      manifest.manifestId,
      route.label,
      manifest.pdfPath,
      manifest.htmlPath,
      'api-user'
    ]);
    
    // Emit event
    if (global.io) {
      global.io.emit('route_map.generated', {
        shipmentId,
        manifestId: manifest.manifestId,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: {
        manifestId: manifest.manifestId,
        pdfUrl: `/api/manifests/${manifest.manifestId}/pdf`,
        htmlUrl: `/api/manifests/${manifest.manifestId}/html`,
        qrCode: manifest.qrCode
      }
    });
    
  } catch (error) {
    console.error('Error generating route manifest:', error);
    res.status(500).json({
      success: false,
      error: { code: 'MANIFEST_GENERATION_ERROR', message: error.message }
    });
  }
});

/**
 * GET /api/manifests/:manifestId/pdf
 * Download PDF manifest
 */
router.get('/manifests/:manifestId/pdf', async (req, res) => {
  try {
    const { manifestId } = req.params;
    
    // Get manifest record
    const manifestResult = await pool.query(`
      SELECT * FROM route_manifest_logs WHERE manifest_id = $1
    `, [manifestId]);
    
    if (manifestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'MANIFEST_NOT_FOUND', message: 'Manifest not found' }
      });
    }
    
    const manifest = manifestResult.rows[0];
    
    // Send PDF file
    res.download(manifest.pdf_path, `${manifestId}.pdf`);
    
  } catch (error) {
    console.error('Error downloading PDF manifest:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DOWNLOAD_ERROR', message: error.message }
    });
  }
});

/**
 * GET /api/manifests/:manifestId/html
 * View HTML manifest
 */
router.get('/manifests/:manifestId/html', async (req, res) => {
  try {
    const { manifestId } = req.params;
    
    // Get manifest record
    const manifestResult = await pool.query(`
      SELECT * FROM route_manifest_logs WHERE manifest_id = $1
    `, [manifestId]);
    
    if (manifestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'MANIFEST_NOT_FOUND', message: 'Manifest not found' }
      });
    }
    
    const manifest = manifestResult.rows[0];
    
    // Send HTML file
    res.sendFile(manifest.html_path);
    
  } catch (error) {
    console.error('Error viewing HTML manifest:', error);
    res.status(500).json({
      success: false,
      error: { code: 'VIEW_ERROR', message: error.message }
    });
  }
});

/**
 * GET /api/shipments/:shipmentId/manifests
 * List all manifests for a shipment
 */
router.get('/shipments/:shipmentId/manifests', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    
    const manifestsResult = await pool.query(`
      SELECT 
        rml.*,
        s.shipment_id as shipment_ref
      FROM route_manifest_logs rml
      JOIN shipments s ON rml.shipment_id = s.id
      WHERE s.shipment_id = $1
      ORDER BY rml.generated_at DESC
    `, [shipmentId]);
    
    res.json({
      success: true,
      data: {
        manifests: manifestsResult.rows.map(m => ({
          manifestId: m.manifest_id,
          routeType: m.route_type,
          generatedAt: m.generated_at,
          generatedBy: m.generated_by,
          pdfUrl: `/api/manifests/${m.manifest_id}/pdf`,
          htmlUrl: `/api/manifests/${m.manifest_id}/html`
        }))
      }
    });
    
  } catch (error) {
    console.error('Error listing manifests:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_ERROR', message: error.message }
    });
  }
});

module.exports = router;
