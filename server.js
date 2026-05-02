/**
 * server.js
 * Visa Sponsor Checker UK — Express API
 *
 * Designed to run on Railway.
 * Reads DATABASE_URL from environment variables (set automatically by Railway
 * when you add a Supabase database connection).
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { findSponsor } = require('./matcher');

const app = express();
const PORT = process.env.PORT || 8000;

// ── Database ─────────────────────────────────────────────────────────────────
// Railway sets DATABASE_URL automatically. Supabase requires SSL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors()); // Allow requests from Chrome extension + any origin

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — Railway uses this to confirm the app started
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Visa Sponsor Checker UK' }));
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Stats — total sponsor count for popup display
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

// Main endpoint — check if a company is a licensed sponsor
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Visa Sponsor Checker running on port ${PORT}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'set ✓' : 'NOT SET ✗'}`);
});
