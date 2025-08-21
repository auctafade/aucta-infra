#!/usr/bin/env node

const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'aucta_db',
  user: 'thiswillnotfade',
  password: ''
});

// Simple POST route for testing
app.post('/api/hubs', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    
    const {
      code = 'TEST',
      name = 'Test Hub',
      location = 'Test Location',
      timezone = 'UTC',
      status = 'active',
      roles = ['authenticator']
    } = req.body;
    
    console.log('Extracted data:', { code, name, location, timezone, status, roles });
    
    const result = await pool.query(`
      INSERT INTO hubs (code, name, location, timezone, status, roles)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, code, name
    `, [code, name, location, timezone, status, JSON.stringify(roles)]);
    
    console.log('Database result:', result.rows[0]);
    
    res.status(201).json({
      success: true,
      hub: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating hub:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test server working!' });
});

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on http://localhost:${PORT}`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
