/**
 * setup-db.js
 * Creates the database tables and loads sample sponsor data.
 * Run this ONCE from Railway after deploying:
 *   Railway dashboard → your service → Shell tab → node setup-db.js
 */

const { Pool } = require('pg');
const { normalizeName } = require('./normalize');

// Railway and Supabase both provide DATABASE_URL automatically
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log('Setting up database...');

    // Enable fuzzy matching
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    console.log('✓ pg_trgm enabled');

    // Sponsors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sponsors (
        id              SERIAL PRIMARY KEY,
        official_name   TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        licence_type    TEXT,
        rating          TEXT,
        status          TEXT DEFAULT 'active',
        city            TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Aliases table (trading names, short names, abbreviations)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sponsor_aliases (
        id               SERIAL PRIMARY KEY,
        sponsor_id       INTEGER REFERENCES sponsors(id) ON DELETE CASCADE,
        alias_name       TEXT NOT NULL,
        normalized_alias TEXT NOT NULL,
        confidence_score NUMERIC(3,2) DEFAULT 1.0
      );
    `);

    // Indexes for fast lookups
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sponsors_normalized ON sponsors(normalized_name);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sponsors_trgm ON sponsors USING GIN (normalized_name gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_aliases_normalized ON sponsor_aliases(normalized_alias);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_aliases_trgm ON sponsor_aliases USING GIN (normalized_alias gin_trgm_ops);`);

    console.log('✓ Tables and indexes created');

    // Check if data already loaded
    const { rows } = await client.query('SELECT COUNT(*) FROM sponsors');
    if (parseInt(rows[0].count) > 0) {
      console.log('ℹ Sample data already exists — skipping');
      return;
    }

    // Sample sponsors (replace with real CSV import for production)
    const samples = [
      {
        official_name: 'Amazon UK Services Ltd',
        normalized_name: 'amazon uk services',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Amazon', normalized: 'amazon', confidence: 0.95 },
          { alias: 'Amazon UK', normalized: 'amazon uk', confidence: 0.98 },
          { alias: 'AWS', normalized: 'aws', confidence: 0.80 },
          { alias: 'Amazon Web Services', normalized: 'amazon web services', confidence: 0.85 },
        ],
      },
      {
        official_name: 'Deloitte LLP',
        normalized_name: 'deloitte',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Deloitte UK', normalized: 'deloitte uk', confidence: 0.98 },
          { alias: 'Deloitte Consulting', normalized: 'deloitte consulting', confidence: 0.90 },
          { alias: 'Deloitte Digital', normalized: 'deloitte digital', confidence: 0.88 },
        ],
      },
      {
        official_name: 'NHS England',
        normalized_name: 'nhs england',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'NHS', normalized: 'nhs', confidence: 0.80 },
          { alias: 'National Health Service', normalized: 'national health service', confidence: 0.95 },
          { alias: 'NHS Trust', normalized: 'nhs trust', confidence: 0.75 },
          { alias: 'NHS Foundation Trust', normalized: 'nhs foundation trust', confidence: 0.80 },
        ],
      },
      {
        official_name: 'Google UK Limited',
        normalized_name: 'google uk',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Google', normalized: 'google', confidence: 0.95 },
          { alias: 'Google DeepMind', normalized: 'google deepmind', confidence: 0.85 },
          { alias: 'Google Cloud', normalized: 'google cloud', confidence: 0.85 },
        ],
      },
      {
        official_name: 'Microsoft Limited',
        normalized_name: 'microsoft',
        rating: 'A', city: 'Reading',
        aliases: [
          { alias: 'Microsoft UK', normalized: 'microsoft uk', confidence: 0.98 },
          { alias: 'Microsoft', normalized: 'microsoft', confidence: 1.0 },
        ],
      },
      {
        official_name: 'HSBC Bank PLC',
        normalized_name: 'hsbc bank',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'HSBC', normalized: 'hsbc', confidence: 0.95 },
          { alias: 'HSBC UK', normalized: 'hsbc uk', confidence: 0.98 },
        ],
      },
      {
        official_name: 'Barclays Bank PLC',
        normalized_name: 'barclays bank',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Barclays', normalized: 'barclays', confidence: 0.95 },
          { alias: 'Barclays UK', normalized: 'barclays uk', confidence: 0.98 },
        ],
      },
      {
        official_name: 'PricewaterhouseCoopers LLP',
        normalized_name: 'pricewaterhousecoopers',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'PwC', normalized: 'pwc', confidence: 0.98 },
          { alias: 'PricewaterhouseCoopers', normalized: 'pricewaterhousecoopers', confidence: 1.0 },
        ],
      },
      {
        official_name: 'Goldman Sachs International',
        normalized_name: 'goldman sachs international',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Goldman Sachs', normalized: 'goldman sachs', confidence: 0.98 },
          { alias: 'Goldman', normalized: 'goldman', confidence: 0.85 },
        ],
      },
      {
        official_name: 'Tesco PLC',
        normalized_name: 'tesco',
        rating: 'A', city: 'Welwyn Garden City',
        aliases: [
          { alias: 'Tesco Stores', normalized: 'tesco stores', confidence: 0.95 },
          { alias: 'Tesco', normalized: 'tesco', confidence: 1.0 },
        ],
      },
      {
        official_name: 'Meta Platforms Ireland Limited',
        normalized_name: 'meta platforms ireland',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Meta', normalized: 'meta', confidence: 0.90 },
          { alias: 'Facebook', normalized: 'facebook', confidence: 0.85 },
          { alias: 'Instagram', normalized: 'instagram', confidence: 0.75 },
        ],
      },
      {
        official_name: 'Apple Europe Limited',
        normalized_name: 'apple europe',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Apple', normalized: 'apple', confidence: 0.90 },
          { alias: 'Apple UK', normalized: 'apple uk', confidence: 0.95 },
        ],
      },
      {
        official_name: 'KPMG LLP',
        normalized_name: 'kpmg',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'KPMG UK', normalized: 'kpmg uk', confidence: 0.98 },
          { alias: 'KPMG', normalized: 'kpmg', confidence: 1.0 },
        ],
      },
      {
        official_name: 'Ernst & Young LLP',
        normalized_name: 'ernst young',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'EY', normalized: 'ey', confidence: 0.98 },
          { alias: 'Ernst and Young', normalized: 'ernst and young', confidence: 0.98 },
        ],
      },
      {
        official_name: 'Lloyds Bank PLC',
        normalized_name: 'lloyds bank',
        rating: 'A', city: 'London',
        aliases: [
          { alias: 'Lloyds', normalized: 'lloyds', confidence: 0.90 },
          { alias: 'Lloyds Banking Group', normalized: 'lloyds banking group', confidence: 0.95 },
        ],
      },
    ];

    for (const s of samples) {
      const { rows: inserted } = await client.query(
        `INSERT INTO sponsors (official_name, normalized_name, licence_type, rating, status, city)
         VALUES ($1, $2, 'Worker', $3, 'active', $4) RETURNING id`,
        [s.official_name, s.normalized_name, s.rating, s.city]
      );
      const id = inserted[0].id;
      for (const a of s.aliases) {
        await client.query(
          `INSERT INTO sponsor_aliases (sponsor_id, alias_name, normalized_alias, confidence_score)
           VALUES ($1, $2, $3, $4)`,
          [id, a.alias, a.normalized, a.confidence]
        );
      }
    }

    console.log(`✓ Loaded ${samples.length} sample sponsors`);
    console.log('\n✅ Database ready!');

  } finally {
    client.release();
    await pool.end();
  }
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
