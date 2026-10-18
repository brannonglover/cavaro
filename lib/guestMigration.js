/**
 * Durable guest→account migration.
 *
 * Phases (docs/GUEST_MIGRATION_CONFLICTS.md §4):
 *   staged → awaiting_resolution → applying → completed
 *
 * Invariants this module exists to hold:
 *  - The guest's pre-merge rows are snapshotted before anything is written, so
 *    a crash or retry can always reconstruct them.
 *  - Nothing is written to `cigars` and nothing is pushed while conflicts are
 *    unresolved.
 *  - cavaro_migration_pending stays set until a run reaches `completed`, which
 *    keeps wipeLocalUserData from deleting unconfirmed guest data.
 *  - A run belonging to a different user_id is never applied or deleted.
 */

import * as Crypto from 'expo-crypto';
import { db, withSerializedTransaction } from '../db';
import { fetchUserCigars } from '../api/userCigars';
import { getLocalSyncableCigars } from './userCigarsSync';
import { markMigrationPending } from './authState';
import { cigarIdentityKey } from './cigarIdentity';
import {
  applyMigrationPlan,
  conflictKey,
  detectMigrationPlan,
} from './migrationConflicts';

export const PHASE = {
  STAGED: 'staged',
  AWAITING: 'awaiting_resolution',
  APPLYING: 'applying',
  COMPLETED: 'completed',
  // Another account's migration committed the same local rows first, so this
  // run's staged conflicts no longer describe anything on device.
  SUPERSEDED: 'superseded',
};

const ACTIVE_PHASES = [PHASE.STAGED, PHASE.AWAITING, PHASE.APPLYING];

/** Thrown when a pending migration belongs to a different account. */
export const MIGRATION_ACCOUNT_MISMATCH = 'MIGRATION_ACCOUNT_MISMATCH';

const json = (v) => JSON.stringify(v === undefined ? null : v);
const unjson = (v) => {
  if (v === null || v === undefined) return null;
  try { return JSON.parse(v); } catch { return v; }
};

/** The active (incomplete) run for this user, if any. */
export async function getActiveRun(userId) {
  if (!userId) return null;
  const row = await db.getFirstAsync(
    `SELECT * FROM migration_runs
     WHERE user_id = ? AND phase IN (${ACTIVE_PHASES.map(() => '?').join(',')})
     ORDER BY started_at DESC LIMIT 1`,
    userId, ...ACTIVE_PHASES
  );
  if (!row) return null;
  return { ...row, guest_snapshot: unjson(row.guest_snapshot) ?? [] };
}

/** An active run staged for some account other than this one. */
export async function getForeignActiveRun(userId) {
  const row = await db.getFirstAsync(
    `SELECT * FROM migration_runs
     WHERE user_id != ? AND phase IN (${ACTIVE_PHASES.map(() => '?').join(',')})
     ORDER BY started_at DESC LIMIT 1`,
    userId, ...ACTIVE_PHASES
  );
  if (!row) return null;
  return { ...row, guest_snapshot: unjson(row.guest_snapshot) ?? [] };
}

/**
 * Explicitly redirect a pending migration to a different account.
 *
 * Carries the ORIGINAL pre-merge snapshot across rather than re-reading local
 * rows, which may have been partially rewritten. Requires the caller to have
 * obtained real user confirmation; nothing calls this automatically.
 */
export async function confirmAccountChange(foreignMigrationId, newUserId, accessToken) {
  const foreign = await db.getFirstAsync(
    'SELECT * FROM migration_runs WHERE migration_id = ?', foreignMigrationId
  );
  if (!foreign) throw new Error('Migration not found');

  const guestSnapshot = unjson(foreign.guest_snapshot) ?? [];
  const serverCigars = await fetchUserCigars(accessToken);
  const { conflicts } = detectMigrationPlan(guestSnapshot, serverCigars);

  const migrationId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const phase = conflicts.length ? PHASE.AWAITING : PHASE.STAGED;

  await withSerializedTransaction(async () => {
    await db.runAsync(
      `INSERT INTO migration_runs
         (migration_id, user_id, phase, guest_snapshot, deferred, started_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      migrationId, newUserId, phase, json(guestSnapshot), now
    );
    for (const c of conflicts) {
      await db.runAsync(
        `INSERT OR IGNORE INTO migration_conflicts
           (migration_id, brand, name, length, field, guest_value, server_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        migrationId, c.brand, c.name, c.length, c.field,
        json(c.guest_value), json(c.server_value), now
      );
    }
    // The old run is retired, not deleted: its snapshot is preserved above.
    await db.runAsync(
      'UPDATE migration_runs SET phase = ?, completed_at = ? WHERE migration_id = ?',
      PHASE.SUPERSEDED, now, foreignMigrationId
    );
    await db.runAsync('DELETE FROM migration_conflicts WHERE migration_id = ?', foreignMigrationId);
  });

  return getActiveRun(newUserId);
}

/**
 * Rebuild a staged plan against a fresh server snapshot, preserving answers.
 *
 * An answer is kept only when BOTH sides are unchanged. If the server value
 * moved since the user decided, their choice referred to a value that no longer
 * exists, so the resolution is cleared and the question re-asked. Conflicts
 * that no longer exist are dropped; new ones are inserted unresolved.
 *
 * This is the client half of the concurrent-write retry strategy.
 */
export async function restageMigration(userId, accessToken) {
  const run = await getActiveRun(userId);
  if (!run) return null;

  const serverCigars = await fetchUserCigars(accessToken);
  const { conflicts } = detectMigrationPlan(run.guest_snapshot, serverCigars);
  const now = new Date().toISOString();
  const liveKeys = new Set(conflicts.map((c) => conflictKey(c.brand, c.name, c.length, c.field)));

  await withSerializedTransaction(async () => {
    for (const c of conflicts) {
      const gv = json(c.guest_value);
      const sv = json(c.server_value);
      const updated = await db.runAsync(
        `UPDATE migration_conflicts
           SET resolution     = CASE WHEN guest_value IS ? AND server_value IS ? THEN resolution     ELSE NULL END,
               resolved_value = CASE WHEN guest_value IS ? AND server_value IS ? THEN resolved_value ELSE NULL END,
               guest_value = ?, server_value = ?
         WHERE migration_id = ? AND brand = ? AND name = ? AND length = ? AND field = ?`,
        gv, sv, gv, sv, gv, sv,
        run.migration_id, c.brand, c.name, c.length, c.field
      );
      if (!updated?.changes) {
        await db.runAsync(
          `INSERT OR IGNORE INTO migration_conflicts
             (migration_id, brand, name, length, field, guest_value, server_value, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          run.migration_id, c.brand, c.name, c.length, c.field, gv, sv, now
        );
      }
    }
    // Drop conflicts the fresh plan no longer has.
    const stored = await db.getAllAsync(
      'SELECT brand, name, length, field FROM migration_conflicts WHERE migration_id = ?',
      run.migration_id
    );
    for (const s of stored ?? []) {
      if (!liveKeys.has(conflictKey(s.brand, s.name, s.length, s.field))) {
        await db.runAsync(
          `DELETE FROM migration_conflicts
           WHERE migration_id = ? AND brand = ? AND name = ? AND length = ? AND field = ?`,
          run.migration_id, s.brand, s.name, s.length, s.field
        );
      }
    }
    await db.runAsync(
      'UPDATE migration_runs SET phase = ? WHERE migration_id = ?',
      conflicts.length ? PHASE.AWAITING : PHASE.STAGED, run.migration_id
    );
  });

  return getActiveRun(userId);
}

export async function getConflicts(migrationId) {
  const rows = await db.getAllAsync(
    `SELECT * FROM migration_conflicts WHERE migration_id = ?
     ORDER BY brand, name, length, field`,
    migrationId
  );
  return (rows ?? []).map((r) => ({
    ...r,
    guest_value: unjson(r.guest_value),
    server_value: unjson(r.server_value),
    resolved_value: unjson(r.resolved_value),
  }));
}

export async function countUnresolved(migrationId) {
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS n FROM migration_conflicts WHERE migration_id = ? AND resolution IS NULL',
    migrationId
  );
  return row?.n ?? 0;
}

/**
 * Capture the guest snapshot and stage conflicts. Idempotent: an existing
 * active run for this user is returned untouched rather than restaged, so
 * already-made resolutions are never discarded.
 *
 * Performs no writes to `cigars`.
 */
export async function beginMigration(userId, accessToken) {
  if (!userId || !accessToken) return null;

  const existing = await getActiveRun(userId);
  if (existing) return existing;

  // An active run for a DIFFERENT account means this device's guest rows were
  // already staged for someone else. Staging them again here would silently
  // change the migration's destination account and re-snapshot from local rows
  // that the other run may have partially rewritten. Refuse and surface it —
  // the original snapshot stays on disk, untouched, and the pending flag stays
  // set so nothing is wiped.
  const foreign = await getForeignActiveRun(userId);
  if (foreign) {
    const blocked = new Error(
      'A pending migration belongs to a different account. Explicit confirmation is required before migrating to this one.'
    );
    blocked.code = MIGRATION_ACCOUNT_MISMATCH;
    blocked.foreignRun = { migrationId: foreign.migration_id, userId: foreign.user_id };
    throw blocked;
  }

  // Snapshot BEFORE any merge touches local rows — this is what makes retries
  // safe once mergeServerCigarsIntoLocal has overwritten things.
  const guestSnapshot = await getLocalSyncableCigars();
  await markMigrationPending();

  const serverCigars = await fetchUserCigars(accessToken);
  const { conflicts } = detectMigrationPlan(guestSnapshot, serverCigars);

  const migrationId = Crypto.randomUUID();
  const now = new Date().toISOString();
  const phase = conflicts.length ? PHASE.AWAITING : PHASE.STAGED;

  await withSerializedTransaction(async () => {
    await db.runAsync(
      `INSERT INTO migration_runs
         (migration_id, user_id, phase, guest_snapshot, deferred, started_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      migrationId, userId, phase, json(guestSnapshot), now
    );
    for (const c of conflicts) {
      // OR IGNORE keeps restaging from duplicating or clobbering resolutions.
      await db.runAsync(
        `INSERT OR IGNORE INTO migration_conflicts
           (migration_id, brand, name, length, field, guest_value, server_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        migrationId, c.brand, c.name, c.length, c.field,
        json(c.guest_value), json(c.server_value), now
      );
    }
  });

  return getActiveRun(userId);
}

/** Record one decision. Safe to call repeatedly; last write wins. */
export async function resolveConflict(migrationId, { brand, name, length, field }, resolution, resolvedValue = null) {
  if (!['guest', 'server', 'manual', 'both'].includes(resolution)) {
    throw new Error(`Unknown resolution "${resolution}"`);
  }
  await db.runAsync(
    `UPDATE migration_conflicts
       SET resolution = ?, resolved_value = ?, resolved_at = ?
     WHERE migration_id = ? AND brand = ? AND name = ? AND length = ? AND field = ?`,
    resolution, json(resolvedValue), new Date().toISOString(),
    migrationId, brand, name, length, field
  );
}

/** Mark the run as deferred — user chose "Decide later". Keeps data protected. */
export async function deferMigration(migrationId) {
  await db.runAsync('UPDATE migration_runs SET deferred = 1 WHERE migration_id = ?', migrationId);
}

export async function undeferMigration(migrationId) {
  await db.runAsync('UPDATE migration_runs SET deferred = 0 WHERE migration_id = ?', migrationId);
}

async function recordError(migrationId, message) {
  await db.runAsync(
    'UPDATE migration_runs SET last_error = ? WHERE migration_id = ?',
    String(message ?? '').slice(0, 500), migrationId
  );
}

/**
 * Write the resolved set into local `cigars`, replacing the rows this migration
 * owns. Idempotent: the output is a pure function of the snapshot plus the
 * stored resolutions, so re-running cannot duplicate or drift.
 *
 * Refuses while any conflict is unresolved.
 */
export async function applyMigration(userId, accessToken) {
  const run = await getActiveRun(userId);
  if (!run) return { applied: false, reason: 'no_active_run' };

  const conflicts = await getConflicts(run.migration_id);
  if (conflicts.some((c) => !c.resolution)) {
    return { applied: false, reason: 'unresolved_conflicts' };
  }

  // Re-derive the plan from the pre-merge snapshot rather than from current
  // local rows, which is what keeps repeated applies identical. If the server
  // is unreachable, the staged conflicts already carry both sides' values.
  const serverCigars = accessToken
    ? await fetchUserCigars(accessToken).catch(() => null)
    : null;
  const plan = detectMigrationPlan(
    run.guest_snapshot,
    serverCigars ?? conflictsToServerRows(conflicts, run.guest_snapshot)
  );

  const resolutions = {};
  for (const c of conflicts) {
    resolutions[conflictKey(c.brand, c.name, c.length, c.field)] = {
      resolution: c.resolution,
      resolved_value: c.resolved_value,
    };
  }

  const resolved = applyMigrationPlan(plan, resolutions);

  await db.runAsync('UPDATE migration_runs SET phase = ? WHERE migration_id = ?', PHASE.APPLYING, run.migration_id);

  await withSerializedTransaction(async () => {
    for (const cigar of resolved) {
      const humidorId = await resolveHumidorIdByName(cigar.humidor_name);
      const existing = await db.getFirstAsync(
        'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ?',
        cigar.brand, cigar.name, cigar.length
      );

      if (existing) {
        await db.runAsync(
          `UPDATE cigars SET
             line = ?, description = ?, wrapper = ?, binder = ?, filler = ?, image = ?,
             collection = ?, is_favorite = ?, quantity = ?,
             smoked_date = ?, smoke_notes = ?, favorite_notes = ?,
             flavor_profile = ?, strength_profile = ?, construction_quality = ?, flavor_changes = ?,
             date_added = ?, humidor_id = ?
           WHERE id = ?`,
          cigar.line ?? null, cigar.description ?? null, cigar.wrapper ?? null,
          cigar.binder ?? null, cigar.filler ?? null, cigar.image ?? null,
          cigar.collection ?? 'cavaro', cigar.is_favorite ? 1 : 0, normalizeQuantity(cigar.quantity),
          cigar.smoked_date ?? null, cigar.smoke_notes ?? null, cigar.favorite_notes ?? null,
          cigar.flavor_profile ?? null, cigar.strength_profile ?? null,
          cigar.construction_quality ?? null, cigar.flavor_changes ?? null,
          cigar.date_added ?? null, humidorId,
          existing.id
        );
        // Collapse pre-existing duplicate rows for this identity.
        //
        // Three tables carry a cigar_id FK: cellared_items, smoke_journal_entries
        // and smoke_history. The app never issues PRAGMA foreign_keys, so SQLite
        // leaves enforcement OFF and a bare DELETE would silently orphan those
        // rows (proved in scripts/verify-migration-db.js). Repoint them at the
        // surviving row first. Same transaction as the UPDATE above, so a
        // failure rolls the whole collapse back.
        const duplicates = await db.getAllAsync(
          'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ? AND id != ?',
          cigar.brand, cigar.name, cigar.length, existing.id
        );
        for (const dup of duplicates ?? []) {
          await db.runAsync('UPDATE cellared_items SET cigar_id = ? WHERE cigar_id = ?', existing.id, dup.id);
          await db.runAsync('UPDATE smoke_journal_entries SET cigar_id = ? WHERE cigar_id = ?', existing.id, dup.id);
          await db.runAsync('UPDATE smoke_history SET cigar_id = ? WHERE cigar_id = ?', existing.id, dup.id);
          await db.runAsync('DELETE FROM cigars WHERE id = ?', dup.id);
        }
      } else {
        await db.runAsync(
          `INSERT INTO cigars
             (brand, name, line, description, wrapper, binder, filler, length, image,
              collection, is_favorite, quantity, smoked_date, smoke_notes, favorite_notes,
              flavor_profile, strength_profile, construction_quality, flavor_changes,
              date_added, humidor_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          cigar.brand, cigar.name, cigar.line ?? null, cigar.description ?? null,
          cigar.wrapper ?? null, cigar.binder ?? null, cigar.filler ?? null,
          cigar.length, cigar.image ?? null,
          cigar.collection ?? 'cavaro', cigar.is_favorite ? 1 : 0, normalizeQuantity(cigar.quantity),
          cigar.smoked_date ?? null, cigar.smoke_notes ?? null, cigar.favorite_notes ?? null,
          cigar.flavor_profile ?? null, cigar.strength_profile ?? null,
          cigar.construction_quality ?? null, cigar.flavor_changes ?? null,
          cigar.date_added ?? null, humidorId
        );
      }
    }
  });

  return { applied: true, count: resolved.length, migrationId: run.migration_id };
}

/**
 * Mark the run finished. Only called once the push and cloud confirmation have
 * succeeded — the pending flag is cleared by the caller, which owns that check.
 */
export async function completeMigration(migrationId) {
  const now = new Date().toISOString();
  await withSerializedTransaction(async () => {
    await db.runAsync(
      'UPDATE migration_runs SET phase = ?, completed_at = ?, last_error = NULL WHERE migration_id = ?',
      PHASE.COMPLETED, now, migrationId
    );
    await db.runAsync('DELETE FROM migration_conflicts WHERE migration_id = ?', migrationId);

    // The local rows are now durably on a server. Any run still staged for a
    // different account describes data that has moved on, so its conflicts
    // would otherwise strand that user on the blocking screen forever. The
    // conflict rows are derived, never the only copy, so dropping them is safe.
    const stale = await db.getAllAsync(
      `SELECT migration_id FROM migration_runs
       WHERE migration_id != ? AND phase IN (${ACTIVE_PHASES.map(() => '?').join(',')})`,
      migrationId, ...ACTIVE_PHASES
    );
    for (const row of stale ?? []) {
      await db.runAsync(
        'UPDATE migration_runs SET phase = ?, completed_at = ? WHERE migration_id = ?',
        PHASE.SUPERSEDED, now, row.migration_id
      );
      await db.runAsync('DELETE FROM migration_conflicts WHERE migration_id = ?', row.migration_id);
    }
  });
}

export async function failMigration(migrationId, message) {
  await recordError(migrationId, message);
}

function normalizeQuantity(value) {
  const n = parseInt(value, 10);
  return Math.max(0, Number.isFinite(n) ? n : 1);
}

async function resolveHumidorIdByName(humidorName) {
  if (!humidorName) return 1;
  const row = await db.getFirstAsync('SELECT id FROM humidors WHERE name = ?', String(humidorName).trim());
  return row?.id ?? 1;
}

/**
 * Reconstruct the server side from staged conflicts when the network is down.
 * Only the conflicting fields are known from the conflict rows; everything else
 * falls back to the guest snapshot, which is correct because non-conflicting
 * fields were by definition auto-mergeable.
 */
function conflictsToServerRows(conflicts, guestSnapshot) {
  const byKey = new Map();
  for (const g of guestSnapshot ?? []) byKey.set(cigarIdentityKey(g), { ...g });
  for (const c of conflicts) {
    const key = cigarIdentityKey(c);
    if (!byKey.has(key)) byKey.set(key, { brand: c.brand, name: c.name, length: c.length });
    byKey.get(key)[c.field] = c.server_value;
  }
  return [...byKey.values()];
}
