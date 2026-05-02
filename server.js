/**
 * server.js - Visa Sponsor Checker UK
 */
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { findSponsor } = require('./matcher');
const { syncSponsors } = require('./sync');

const app = express();
const PORT = process.env.PORT || 8000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Visa Sponsor Checker UK' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.get('/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE rating = 'A') AS a_rated
       FROM sponsors WHERE status = 'active'`
    );
    res.json({ total_sponsors: parseInt(rows[0].total), a_rated: parseInt(rows[0].a_rated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/check-sponsor', async (req, res) => {
  const { company_name } = req.body;
  if (!company_name || typeof company_name !== 'string') {
    return res.status(400).json({ error: 'company_name is required' });
  }
  const name = company_name.trim();
  if (name.length < 2 || name.length > 200) {
    return res.status(400).json({ error: 'company_name length invalid' });
  }
  try {
    const result = await findSponsor(pool, name);
    res.json(result);
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Monthly sync endpoint — called by GitHub Actions
app.post('/sync-sponsors', async (req, res) => {
  const secret = req.headers['x-sync-secret'];
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const { csv_url } = req.body;
  if (!csv_url || !csv_url.startsWith('https://assets.publishing.service.gov.uk')) {
    return res.status(400).json({ error: 'Invalid csv_url' });
  }
  // Respond immediately, sync runs in background
  res.json({ status: 'sync_started', csv_url });
  try {
    const result = await syncSponsors(csv_url);
    console.log('[Sync] Complete:', result);
  } catch (err) {
    console.error('[Sync] Failed:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Visa Sponsor Checker running on port ${PORT}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'set ✓' : 'NOT SET ✗'}`);
  console.log(`   SYNC_SECRET:  ${process.env.SYNC_SECRET ? 'set ✓' : 'NOT SET ✗'}`);
});
