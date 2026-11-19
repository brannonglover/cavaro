/**
 * Pure validation + classification helpers for the Add Cigar screen.
 *
 * Kept free of React and native imports so scripts/verify-addcigar-logic.js can
 * exercise it in plain node (same approach as lib/cigarIdentity.js).
 *
 * These helpers decide three things:
 *   - which required fields are still missing (drives the inline hint + focus)
 *   - why a save attempt was rejected (drives add_cigar_validation_failed)
 *   - which bucket a thrown error falls into (drives add_cigar_save_failed)
 *
 * Analytics rule: every value returned here is a fixed, low-cardinality token.
 * Raw error messages are never returned, because they can contain file paths,
 * SQL fragments, or user-entered text.
 */

// Size format: #x## or #.#x## (e.g. 6x52, 7.5x50) - no slashes
export const SIZE_FORMAT = /^\d+(\.\d+)?x\d+(\.\d+)?$/;

/** Required fields, in the order they appear on screen. */
export const REQUIRED_CATALOG_FIELDS = ['brand', 'name', 'size'];
export const REQUIRED_CUSTOM_FIELDS = ['brand', 'name', 'size'];

export function isValidSizeFormat(size) {
  return !!(size?.trim() && SIZE_FORMAT.test(size.trim()));
}

function blank(value) {
  return !value || !String(value).trim();
}

/**
 * Required catalog fields that are still empty, in on-screen order.
 * The order matters: the first entry is the field we focus and name in the hint.
 */
export function missingCatalogFields({ brand, name, size } = {}) {
  const missing = [];
  if (blank(brand)) missing.push('brand');
  if (blank(name)) missing.push('name');
  if (blank(size)) missing.push('size');
  return missing;
}

/** Required custom-cigar fields that are still empty, in on-screen order. */
export function missingCustomFields({ brand, name, size } = {}) {
  const missing = [];
  if (blank(brand)) missing.push('brand');
  if (blank(name)) missing.push('name');
  if (blank(size)) missing.push('size');
  return missing;
}

/**
 * Why a save attempt cannot proceed, or null when it can.
 * `missing` wins over a bad size format: an empty size is missing, not malformed.
 */
export function validationReason({ missing = [], size, requireSizeFormat = false } = {}) {
  if (missing.length) return 'missing_fields';
  if (requireSizeFormat && !isValidSizeFormat(size)) return 'invalid_size_format';
  return null;
}

/** Human-readable field names for the inline hint. */
const FIELD_LABELS = {
  brand: 'Brand',
  name: 'Cigar name',
  size: 'Size',
};

export function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

/**
 * Sentence naming what the user still has to choose, e.g.
 *   ['size']                  -> "Select a size to continue."
 *   ['name', 'size']          -> "Select a cigar name and size to continue."
 *   ['brand', 'name', 'size'] -> "Select a brand, cigar name and size to continue."
 */
export function missingFieldsMessage(missing = []) {
  if (!missing.length) return '';
  const labels = missing.map((f) => fieldLabel(f).toLowerCase());
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `Select a ${list} to continue.`;
}

/**
 * Bucket a thrown error for analytics. Returns a fixed token, never the message.
 * Checked most specific first so a network error inside a DB helper is still
 * reported as network.
 */
export function categorizeError(err) {
  const message = (err?.message || '').toLowerCase();
  const name = (err?.name || '').toLowerCase();

  if (!message && !name) return 'unknown';
  if (
    message.includes('network request failed') ||
    message.includes('cannot reach server') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnrefused') ||
    name === 'typeerror'
  ) {
    return 'network';
  }
  if (message.includes('failed to fetch catalog') || message.includes('status 5') || message.includes('status 4')) {
    return 'server';
  }
  if (
    message.includes('sqlite') ||
    message.includes('database') ||
    message.includes('unique constraint') ||
    message.includes('no such table') ||
    message.includes('disk')
  ) {
    return 'database';
  }
  if (message.includes('permission') || message.includes('not authorized') || message.includes('401') || message.includes('403')) {
    return 'permission';
  }
  return 'unknown';
}

/**
 * Which state the catalog picker is in, so the screen can render exactly one of
 * loading / ready / empty / error instead of an inert form.
 *
 * `failed` means the API call threw AND the local cache gave us nothing; a
 * failed refresh that still has cached rows is `ready`, not `error`.
 */
export function catalogState({ loading = false, failed = false, itemCount = 0 } = {}) {
  if (itemCount > 0) return 'ready';
  if (loading) return 'loading';
  if (failed) return 'error';
  return 'empty';
}

/**
 * How far the user got before leaving, for add_cigar_abandoned.
 * Low cardinality by design: five fixed stages.
 */
export function progressStage({ brand, name, size, attempted = false } = {}) {
  if (attempted) return 'attempted';
  if (!blank(size)) return 'size_selected';
  if (!blank(name)) return 'name_selected';
  if (!blank(brand)) return 'brand_selected';
  return 'nothing_selected';
}

/**
 * The `cigar` breakdown key sent with cigar_added (brand + line + name).
 *
 * Catalog rows frequently repeat a value across fields — Arturo Fuente with
 * line "Don Carlos" and name "Don Carlos" produced "Arturo Fuente Don Carlos
 * Don Carlos". Segments are deduped case-insensitively, preserving order, so
 * the key reads like the cigar's actual name.
 */
export function buildCigarKey({ brand, line, name } = {}) {
  const seen = new Set();
  return [brand, line, name]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ');
}
