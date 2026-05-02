/**
 * normalize.js
 * Cleans up company names so "Amazon UK Services Ltd" and "Amazon"
 * both reduce to the same thing for matching purposes.
 */

const SUFFIXES = [
  'limited liability partnership',
  'public limited company',
  'limited partnership',
  'community interest company',
  'limited',
  ' llp',
  ' plc',
  ' ltd',
  ' lp',
  ' cic',
  ' inc',
  ' corp',
  ' co',
  ' uk',
];

function normalizeName(name) {
  if (!name) return '';

  let n = name.toLowerCase();
  n = n.replace(/[^a-z0-9\s]/g, ' ');

  for (const suffix of SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix.trim()}\\s*$`);
    n = n.replace(pattern, '');
  }

  return n.replace(/\s+/g, ' ').trim();
}

module.exports = { normalizeName };
