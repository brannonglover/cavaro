/**
 * Smoke journal entry model
 * @see CAVARO_PRODUCT_SPEC.md §7.4
 */

/** @typedef {'Too Mild' | 'Just Right' | 'Too Strong'} StrengthFeedback */
/** @typedef {'Tight' | 'Good' | 'Loose'} DrawFeedback */
/** @typedef {'Poor' | 'Average' | 'Excellent'} BurnFeedback */
/** @typedef {'Short' | 'Medium' | 'Long'} FinishFeedback */

/**
 * @typedef {Object} SmokeJournalEntry
 * @property {string} id
 * @property {string} [userId]
 * @property {string} cigarId
 * @property {string} smokedDate ISO date (YYYY-MM-DD)
 * @property {number} [rating] 0–100
 * @property {boolean} [wouldBuyAgain]
 * @property {string} [notes]
 * @property {string[]} likedFlavors
 * @property {string[]} dislikedFlavors
 * @property {StrengthFeedback} [strengthFeedback]
 * @property {DrawFeedback} [draw]
 * @property {BurnFeedback} [burn]
 * @property {FinishFeedback} [finish]
 * @property {string} [smokedFromHumidorItemId]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const STRENGTH_FEEDBACK_OPTIONS = ['Too Mild', 'Just Right', 'Too Strong'];

export const DRAW_OPTIONS = ['Tight', 'Good', 'Loose'];

export const BURN_OPTIONS = ['Poor', 'Average', 'Excellent'];

export const FINISH_OPTIONS = ['Short', 'Medium', 'Long'];

/** App standard: journal ratings use a 0–100 scale */
export const JOURNAL_RATING_MIN = 0;
export const JOURNAL_RATING_MAX = 100;

export const SUGGESTED_FLAVOR_TAGS = [
  'Chocolate',
  'Coffee',
  'Espresso',
  'Cedar',
  'Leather',
  'Earth',
  'Pepper',
  'Cream',
  'Nuts',
  'Cocoa',
  'Cinnamon',
  'Vanilla',
  'Floral',
  'Fruit',
  'Toast',
  'Oak',
  'Hay',
  'Sweetness',
  'Spice',
];

export function parseFlavorList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function serializeFlavorList(flavors) {
  const list = parseFlavorList(flavors);
  return JSON.stringify(list);
}

function parseOptionalBoolean(value) {
  if (value == null) return undefined;
  if (typeof value === 'boolean') return value;
  return value === 1 || value === '1' || value === true;
}

function normalizeRating(value) {
  if (value == null || value === '') return undefined;
  const rating = Number(value);
  if (Number.isNaN(rating)) return undefined;
  return Math.min(JOURNAL_RATING_MAX, Math.max(JOURNAL_RATING_MIN, Math.round(rating)));
}

/**
 * Maps a SQLite row to a SmokeJournalEntry object.
 * @param {Object|null|undefined} row
 * @returns {SmokeJournalEntry|null}
 */
export function parseJournalEntry(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    userId: row.user_id ?? undefined,
    cigarId: String(row.cigar_id),
    smokedDate: row.smoked_date,
    rating: normalizeRating(row.rating),
    wouldBuyAgain: parseOptionalBoolean(row.would_buy_again),
    notes: row.notes?.trim() || undefined,
    likedFlavors: parseFlavorList(row.liked_flavors),
    dislikedFlavors: parseFlavorList(row.disliked_flavors),
    strengthFeedback: row.strength_feedback ?? undefined,
    draw: row.draw ?? undefined,
    burn: row.burn ?? undefined,
    finish: row.finish ?? undefined,
    smokedFromHumidorItemId:
      row.smoked_from_humidor_item_id != null
        ? String(row.smoked_from_humidor_item_id)
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {Partial<SmokeJournalEntry>} entry
 * @returns {SmokeJournalEntry}
 */
export function createEmptyJournalEntry(entry = {}) {
  const now = new Date().toISOString();
  return {
    id: entry.id ?? '',
    userId: entry.userId,
    cigarId: entry.cigarId ?? '',
    smokedDate: entry.smokedDate ?? now.slice(0, 10),
    rating: normalizeRating(entry.rating),
    wouldBuyAgain: entry.wouldBuyAgain,
    notes: entry.notes,
    likedFlavors: parseFlavorList(entry.likedFlavors),
    dislikedFlavors: parseFlavorList(entry.dislikedFlavors),
    strengthFeedback: entry.strengthFeedback,
    draw: entry.draw,
    burn: entry.burn,
    finish: entry.finish,
    smokedFromHumidorItemId: entry.smokedFromHumidorItemId,
    createdAt: entry.createdAt ?? now,
    updatedAt: entry.updatedAt ?? now,
  };
}

export function validateJournalEntryInput(entry) {
  if (!entry?.cigarId) {
    throw new Error('cigarId is required');
  }
  if (!entry?.smokedDate?.trim()) {
    throw new Error('smokedDate is required');
  }
  if (entry.rating != null && normalizeRating(entry.rating) == null) {
    throw new Error('rating must be a number between 0 and 100');
  }
  for (const field of ['strengthFeedback', 'draw', 'burn', 'finish']) {
    const options = {
      strengthFeedback: STRENGTH_FEEDBACK_OPTIONS,
      draw: DRAW_OPTIONS,
      burn: BURN_OPTIONS,
      finish: FINISH_OPTIONS,
    }[field];
    if (entry[field] != null && !options.includes(entry[field])) {
      throw new Error(`Invalid ${field}`);
    }
  }
}
