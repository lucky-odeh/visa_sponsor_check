/**
 * sync.js
 * Downloads the latest Home Office sponsor CSV and reloads the database.
 *
 * Called by:
 *   - POST /sync-sponsors (from GitHub Actions monthly cron)
 *   - Directly: node sync.js <csv_url>
 */

const { Pool } = require('pg');
const { normalizeName, parseTypeRating } = require('./normalize');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

/**
 * Main sync function.
 * @param {string} csvUrl - Direct URL to the Home Office CSV file
 * @returns {Promise<{imported: number, skipped: number, duration: string}>}
 */
async function syncSponsors(csvUrl) {
  const startTime = Date.now();
  console.log(`[Sync] Starting import from: ${csvUrl}`);

  // Fetch the CSV
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  console.log(`[Sync] Downloaded ${Math.round(csvText.length / 1024)}KB`);

  // Parse CSV manually (no external library needed for this simple format)
  const rows = parseCSV(csvText);
  console.log(`[Sync] Parsed ${rows.length} rows`);

  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;

  try {
    // Use a transaction so the database is never half-updated
    await client.query('BEGIN');

    // Clear existing data
    await client.query('TRUNCATE sponsors CASCADE');
    console.log('[Sync] Cleared existing data');

    // Insert in batches of 500 for performance
    const BATCH_SIZE = 500;
    const batch = [];

    for (const row of rows) {
      const officialName = (row['Organisation Name'] || '').trim();
      if (!officialName) { skipped++; continue; }

      const city = (row['Town/City'] || '').trim();
      const { licenceType, rating } = parseTypeRating(row['Type & Rating'] || '');
      const route = (row['Route'] || '').trim();
      const normalizedName = normalizeName(officialName);

      if (!normalizedName) { skipped++; continue; }

      batch.push({ officialName, normalizedName, licenceType, rating, city, route });

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        imported += batch.length;
        batch.length = 0;
        process.stdout.write(`\r[Sync] Imported ${imported}...`);
      }
    }

    // Insert remaining rows
    if (batch.length > 0) {
      await insertBatch(client, batch);
      imported += batch.length;
    }

    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    console.log(`\n[Sync] ✅ Done: ${imported} imported, ${skipped} skipped in ${duration}`);

    return { imported, skipped, duration };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Insert a batch of sponsor rows using a single query.
 */
async function insertBatch(client, batch) {
  // Build parameterised query for the batch
  const values = [];
  const placeholders = batch.map((row, i) => {
    const base = i * 6;
    values.push(
      row.officialName,
      row.normalizedName,
      row.licenceType,
      row.rating,
      row.city,
      row.route
    );
    return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, 'active', $${base+5}, $${base+6})`;
  });

  await client.query(
    `INSERT INTO sponsors (official_name, normalized_name, licence_type, rating, status, city, route)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT DO NOTHING`,
    values
  );
}

/**
 * Simple CSV parser that handles quoted fields with commas inside.
 * Handles the Home Office CSV format correctly.
 */
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim().replace(/^"|"$/g, '');
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

module.exports = { syncSponsors };

// Allow running directly: node sync.js <url>
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node sync.js <csv-url>');
    process.exit(1);
  }
  syncSponsors(url)
    .then(r => { console.log('Result:', r); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
