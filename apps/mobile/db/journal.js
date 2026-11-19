import { db, withSerializedTransaction } from './index';
import {
  parseJournalEntry,
  serializeFlavorList,
  validateJournalEntryInput,
} from '../models/journal';

const ENTRY_COLUMNS = `
  id,
  user_id,
  cigar_id,
  smoked_date,
  rating,
  would_buy_again,
  notes,
  liked_flavors,
  disliked_flavors,
  strength_feedback,
  draw,
  burn,
  finish,
  smoked_from_humidor_item_id,
  created_at,
  updated_at
`;

function toDbWouldBuyAgain(value) {
  if (value == null) return null;
  return value ? 1 : 0;
}

function buildEntryValues(entry, timestamps) {
  const now = new Date().toISOString();
  return {
    userId: entry.userId ?? null,
    cigarId: Number(entry.cigarId),
    smokedDate: entry.smokedDate.trim(),
    rating: entry.rating ?? null,
    wouldBuyAgain: toDbWouldBuyAgain(entry.wouldBuyAgain),
    notes: entry.notes?.trim() || null,
    likedFlavors: serializeFlavorList(entry.likedFlavors),
    dislikedFlavors: serializeFlavorList(entry.dislikedFlavors),
    strengthFeedback: entry.strengthFeedback ?? null,
    draw: entry.draw ?? null,
    burn: entry.burn ?? null,
    finish: entry.finish ?? null,
    smokedFromHumidorItemId: entry.smokedFromHumidorItemId
      ? Number(entry.smokedFromHumidorItemId)
      : null,
    createdAt: timestamps?.createdAt ?? entry.createdAt ?? now,
    updatedAt: timestamps?.updatedAt ?? now,
  };
}

/**
 * @param {import('../models/journal').SmokeJournalEntry} entry
 * @returns {Promise<import('../models/journal').SmokeJournalEntry>}
 */
export async function createJournalEntry(entry) {
  validateJournalEntryInput(entry);
  const values = buildEntryValues(entry);

  const result = await db.runAsync(
    `INSERT INTO smoke_journal_entries (
      user_id, cigar_id, smoked_date, rating, would_buy_again, notes,
      liked_flavors, disliked_flavors, strength_feedback, draw, burn, finish,
      smoked_from_humidor_item_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values.userId,
    values.cigarId,
    values.smokedDate,
    values.rating,
    values.wouldBuyAgain,
    values.notes,
    values.likedFlavors,
    values.dislikedFlavors,
    values.strengthFeedback,
    values.draw,
    values.burn,
    values.finish,
    values.smokedFromHumidorItemId,
    values.createdAt,
    values.updatedAt
  );

  return getJournalEntry(result.lastInsertRowId);
}

/**
 * @param {number|string} id
 * @returns {Promise<import('../models/journal').SmokeJournalEntry|null>}
 */
export async function getJournalEntry(id) {
  const row = await db.getFirstAsync(
    `SELECT ${ENTRY_COLUMNS} FROM smoke_journal_entries WHERE id = ?`,
    Number(id)
  );
  return parseJournalEntry(row);
}

/**
 * @param {{ cigarId?: string|number, userId?: string, limit?: number, offset?: number }} [options]
 * @returns {Promise<import('../models/journal').SmokeJournalEntry[]>}
 */
export async function getJournalEntries(options = {}) {
  const { cigarId, userId, limit, offset = 0 } = options;
  const clauses = [];
  const params = [];

  if (cigarId != null) {
    clauses.push('cigar_id = ?');
    params.push(Number(cigarId));
  }
  if (userId) {
    clauses.push('user_id = ?');
    params.push(userId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limitClause = limit != null ? 'LIMIT ? OFFSET ?' : '';
  if (limit != null) {
    params.push(limit, offset);
  }

  const rows = await db.getAllAsync(
    `SELECT ${ENTRY_COLUMNS}
     FROM smoke_journal_entries
     ${where}
     ORDER BY smoked_date DESC, id DESC
     ${limitClause}`,
    ...params
  );

  return (rows ?? []).map(parseJournalEntry).filter(Boolean);
}

/**
 * @param {number|string} id
 * @param {Partial<import('../models/journal').SmokeJournalEntry>} updates
 * @returns {Promise<import('../models/journal').SmokeJournalEntry|null>}
 */
export async function updateJournalEntry(id, updates) {
  const existing = await getJournalEntry(id);
  if (!existing) return null;

  const merged = { ...existing, ...updates, id: existing.id, cigarId: existing.cigarId };
  validateJournalEntryInput(merged);
  const values = buildEntryValues(merged, { createdAt: existing.createdAt });

  await db.runAsync(
    `UPDATE smoke_journal_entries SET
      user_id = ?,
      smoked_date = ?,
      rating = ?,
      would_buy_again = ?,
      notes = ?,
      liked_flavors = ?,
      disliked_flavors = ?,
      strength_feedback = ?,
      draw = ?,
      burn = ?,
      finish = ?,
      smoked_from_humidor_item_id = ?,
      updated_at = ?
     WHERE id = ?`,
    values.userId,
    values.smokedDate,
    values.rating,
    values.wouldBuyAgain,
    values.notes,
    values.likedFlavors,
    values.dislikedFlavors,
    values.strengthFeedback,
    values.draw,
    values.burn,
    values.finish,
    values.smokedFromHumidorItemId,
    values.updatedAt,
    Number(id)
  );

  return getJournalEntry(id);
}

/**
 * @param {number|string} id
 */
export async function deleteJournalEntry(id) {
  await db.runAsync('DELETE FROM smoke_journal_entries WHERE id = ?', Number(id));
}

/**
 * Backfill journal rows from legacy smoke_history records.
 */
export async function migrateSmokeHistoryToJournal() {
  const rows = await db.getAllAsync(`
    SELECT sh.id, sh.cigar_id, sh.smoked_at
    FROM smoke_history sh
    WHERE NOT EXISTS (
      SELECT 1 FROM smoke_journal_entries j
      WHERE j.cigar_id = sh.cigar_id AND j.smoked_date = sh.smoked_at
    )
  `);

  if (!rows?.length) return 0;

  const now = new Date().toISOString();
  await withSerializedTransaction(async () => {
    for (const row of rows) {
      await db.runAsync(
        `INSERT INTO smoke_journal_entries (
          cigar_id, smoked_date, liked_flavors, disliked_flavors, created_at, updated_at
        ) VALUES (?, ?, '[]', '[]', ?, ?)`,
        row.cigar_id,
        row.smoked_at,
        row.smoked_at,
        now
      );
    }
  });

  return rows.length;
}

/**
 * Decrement humidor inventory and persist a journal entry (+ legacy smoke_history).
 * @param {{ cigarId: number|string, userId?: string, entry: Partial<import('../models/journal').SmokeJournalEntry> }} params
 */
export async function markCigarSmokedWithJournal({ cigarId, userId, entry }) {
  const journalInput = {
    ...entry,
    cigarId: String(cigarId),
    userId: userId ?? entry.userId,
    likedFlavors: entry.likedFlavors ?? [],
    dislikedFlavors: entry.dislikedFlavors ?? [],
  };
  validateJournalEntryInput(journalInput);
  const values = buildEntryValues(journalInput);

  await withSerializedTransaction(async () => {
    const cigar = await db.getFirstAsync(
      'SELECT quantity FROM cigars WHERE id = ?',
      Number(cigarId)
    );
    const quantity = Math.max(0, parseInt(cigar?.quantity, 10) || 0);
    if (quantity < 1) {
      throw new Error('No cigars left in inventory');
    }

    await db.runAsync(
      `INSERT INTO smoke_journal_entries (
        user_id, cigar_id, smoked_date, rating, would_buy_again, notes,
        liked_flavors, disliked_flavors, strength_feedback, draw, burn, finish,
        smoked_from_humidor_item_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values.userId,
      values.cigarId,
      values.smokedDate,
      values.rating,
      values.wouldBuyAgain,
      values.notes,
      values.likedFlavors,
      values.dislikedFlavors,
      values.strengthFeedback,
      values.draw,
      values.burn,
      values.finish,
      values.smokedFromHumidorItemId ?? values.cigarId,
      values.createdAt,
      values.updatedAt
    );

    await db.runAsync(
      'INSERT INTO smoke_history (cigar_id, smoked_at) VALUES (?, ?)',
      Number(cigarId),
      values.smokedDate
    );

    await db.runAsync(
      'UPDATE cigars SET quantity = ? WHERE id = ?',
      quantity - 1,
      Number(cigarId)
    );
  });

  const rows = await getJournalEntries({ cigarId, limit: 1 });
  return rows[0] ?? null;
}
