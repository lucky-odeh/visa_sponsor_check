/**
 * normalize.js
 * Cleans company names for consistent matching.
 * Handles the real Home Office CSV format where names have leading spaces,
 * legal suffixes, punctuation, and trading name patterns like "X T/A Y".
 */

const SUFFIXES = [
  'limited liability partnership',
  'public limited company',
  'limited partnership',
  'community interest company',
  'charitable incorporated organisation',
  'limited',
  ' llp',
  ' plc',
  ' ltd',
  ' lp',
  ' cic',
  ' cio',
  ' inc',
  ' corp',
  ' co',
  ' uk',
];

/**
 * Normalise a company name for matching.
 * Also handles "X T/A Y" trading name format — returns the trading name (Y).
 */
function normalizeName(name) {
  if (!name) return '';

  let n = name.trim().toLowerCase();

  // Handle "X T/A Y" — extract trading name as it's more recognisable
  if (n.includes(' t/a ')) {
    n = n.split(' t/a ').pop().trim();
  }

  // Remove punctuation except spaces
  n = n.replace(/[^a-z0-9\s]/g, ' ');

  // Strip legal suffixes
  for (const suffix of SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix.trim()}\\s*$`);
    n = n.replace(pattern, '');
  }

  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Parse the "Type & Rating" column from the Home Office CSV.
 * e.g. "Worker (A rating)" → { licenceType: 'Worker', rating: 'A' }
 */
function parseTypeRating(typeRating) {
  if (!typeRating) return { licenceType: 'Worker', rating: 'A' };

  const licenceType = typeRating.includes('Worker') ? 'Worker' : 'Student';

  let rating = 'A';
  const ratingMatch = typeRating.match(/\(([AB])\s*rating\)/i);
  if (ratingMatch) {
    rating = ratingMatch[1].toUpperCase();
  } else if (typeRating.toLowerCase().includes('provisional')) {
    rating = 'Provisional';
  }

  return { licenceType, rating };
}

module.exports = { normalizeName, parseTypeRating };
