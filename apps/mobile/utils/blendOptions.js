const MULTI_VALUE_SEPARATOR = /[,;/]/;

/**
 * Collect distinct blend values from catalog/cigar rows.
 * Filler values are also split on comma/semicolon for individual suggestions.
 */
export function collectBlendValues(rows, field) {
  const set = new Set();
  for (const row of rows) {
    const raw = (row[field] || '').trim();
    if (!raw) continue;
    if (field === 'filler') {
      raw.split(MULTI_VALUE_SEPARATOR).forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) set.add(trimmed);
      });
    }
    set.add(raw);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Load known wrapper/binder/filler values from local catalog cache and user cigars.
 */
export async function loadKnownBlendOptions(db) {
  const [catalogRows, cigarRows] = await Promise.all([
    db.getAllAsync('SELECT wrapper, binder, filler FROM cigar_catalog'),
    db.getAllAsync('SELECT wrapper, binder, filler FROM cigars'),
  ]);
  const rows = [...catalogRows, ...cigarRows];
  return {
    wrapper: collectBlendValues(rows, 'wrapper'),
    binder: collectBlendValues(rows, 'binder'),
    filler: collectBlendValues(rows, 'filler'),
  };
}
