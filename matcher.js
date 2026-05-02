/**
 * matcher.js
 * Finds the best sponsor match using 3 layers:
 *   1. Exact — direct normalized name match
 *   2. Alias — known alternative names
 *   3. Fuzzy — trigram similarity for typos / partial names
 */

const { normalizeName } = require('./normalize');

const FUZZY_THRESHOLD = 0.3;

async function findSponsor(pool, companyName) {
  const normalized = normalizeName(companyName);
  if (!normalized) return noMatch();

  // Layer 1: Exact match
  const exact = await pool.query(
    `SELECT official_name, rating, city FROM sponsors
     WHERE normalized_name = $1 AND status = 'active' LIMIT 1`,
    [normalized]
  );
  if (exact.rows.length > 0) {
    const s = exact.rows[0];
    return { status: 'match', match_type: 'exact', confidence: 1.0, official_name: s.official_name, rating: s.rating, city: s.city };
  }

  // Layer 2: Alias match
  const alias = await pool.query(
    `SELECT s.official_name, s.rating, s.city, a.confidence_score
     FROM sponsor_aliases a
     JOIN sponsors s ON s.id = a.sponsor_id
     WHERE a.normalized_alias = $1 AND s.status = 'active'
     ORDER BY a.confidence_score DESC LIMIT 1`,
    [normalized]
  );
  if (alias.rows.length > 0) {
    const s = alias.rows[0];
    const conf = parseFloat(s.confidence_score);
    return { status: conf >= 0.85 ? 'match' : 'possible', match_type: 'alias', confidence: conf, official_name: s.official_name, rating: s.rating, city: s.city };
  }

  // Layer 3: Fuzzy trigram match
  const fuzzy = await pool.query(
    `SELECT s.official_name, s.rating, s.city,
       GREATEST(
         similarity(s.normalized_name, $1),
         COALESCE((SELECT MAX(similarity(a.normalized_alias, $1)) FROM sponsor_aliases a WHERE a.sponsor_id = s.id), 0)
       ) AS sim
     FROM sponsors s
     WHERE s.status = 'active'
       AND (similarity(s.normalized_name, $1) > $2
            OR EXISTS (SELECT 1 FROM sponsor_aliases a WHERE a.sponsor_id = s.id AND similarity(a.normalized_alias, $1) > $2))
     ORDER BY sim DESC LIMIT 1`,
    [normalized, FUZZY_THRESHOLD]
  );
  if (fuzzy.rows.length > 0) {
    const s = fuzzy.rows[0];
    return { status: 'possible', match_type: 'fuzzy', confidence: parseFloat(parseFloat(s.sim).toFixed(2)), official_name: s.official_name, rating: s.rating, city: s.city };
  }

  return noMatch();
}

function noMatch() {
  return { status: 'none', match_type: 'none', confidence: 0, official_name: null, rating: null, city: null };
}

module.exports = { findSponsor };
