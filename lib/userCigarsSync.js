import {
  fetchUserCigars, fetchUserCigarsWithRevision, saveUserCigars,
  fetchUserHumidors, saveUserHumidors,
  fetchUserCellared, saveUserCellared,
  fetchUserJournal, saveUserJournal,
} from '../api/userCigars';
import { db, whenDatabaseReady, withSerializedTransaction } from '../db';

// ---------------------------------------------------------------------------
// Cigars sync (broadened: all collections, includes humidor_name + date_added)
// ---------------------------------------------------------------------------

const LOCAL_CIGARS_QUERY = `
  SELECT c.brand, c.name, c.line, c.description, c.wrapper, c.binder, c.filler,
         c.length, c.image, c.collection, c.is_favorite, c.quantity,
         c.smoked_date, c.smoke_notes, c.favorite_notes,
         c.flavor_profile, c.strength_profile, c.construction_quality, c.flavor_changes,
         c.date_added,
         h.name AS humidor_name
  FROM cigars c
  LEFT JOIN humidors h ON h.id = c.humidor_id
`;

const CIGAR_INSERT_COLUMNS = [
  'brand', 'name', 'line', 'description', 'wrapper', 'binder', 'filler', 'length', 'image',
  'collection', 'is_favorite', 'quantity', 'smoked_date', 'smoke_notes', 'favorite_notes',
  'flavor_profile', 'strength_profile', 'construction_quality', 'flavor_changes',
  'date_added', 'humidor_id',
];

function cigarValues(cigar, humidorId) {
  return [
    cigar.brand ?? null,
    cigar.name ?? null,
    cigar.line ?? null,
    cigar.description ?? null,
    cigar.wrapper ?? null,
    cigar.binder ?? null,
    cigar.filler ?? null,
    cigar.length ?? null,
    cigar.image ?? null,
    cigar.collection ?? 'cavaro',
    cigar.is_favorite ? 1 : 0,
    Math.max(0, Number.isFinite(parseInt(cigar.quantity, 10)) ? parseInt(cigar.quantity, 10) : 1),
    cigar.smoked_date ?? null,
    cigar.smoke_notes ?? null,
    cigar.favorite_notes ?? null,
    cigar.flavor_profile ?? null,
    cigar.strength_profile ?? null,
    cigar.construction_quality ?? null,
    cigar.flavor_changes ?? null,
    cigar.date_added ?? null,
    humidorId,
  ];
}

function isValidCigarIdentity(cigar) {
  return !!(cigar?.brand?.trim() && cigar?.name?.trim() && cigar?.length?.trim());
}

export async function getLocalSyncableCigars() {
  const rows = await db.getAllAsync(LOCAL_CIGARS_QUERY);
  return rows ?? [];
}

async function resolveHumidorId(humidorName) {
  if (!humidorName) return 1;
  const row = await db.getFirstAsync('SELECT id FROM humidors WHERE name = ?', humidorName.trim());
  return row?.id ?? 1;
}

export async function mergeServerCigarsIntoLocal(serverCigars) {
  if (!serverCigars?.length) return;

  await withSerializedTransaction(async () => {
    for (const cigar of serverCigars) {
      if (!isValidCigarIdentity(cigar)) continue;

      const brand = cigar.brand.trim();
      const name = cigar.name.trim();
      const length = cigar.length.trim();
      const humidorId = await resolveHumidorId(cigar.humidor_name);
      const existing = await db.getFirstAsync(
        'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ?',
        brand, name, length
      );

      const values = cigarValues({ ...cigar, brand, name, length }, humidorId);

      if (existing) {
        await db.runAsync(
          `UPDATE cigars SET
            line = ?, description = ?, wrapper = ?, binder = ?, filler = ?, image = ?,
            collection = ?, is_favorite = ?, quantity = ?,
            smoked_date = ?, smoke_notes = ?, favorite_notes = ?,
            flavor_profile = ?, strength_profile = ?, construction_quality = ?, flavor_changes = ?,
            date_added = ?, humidor_id = ?
          WHERE id = ?`,
          values[2], values[3], values[4], values[5], values[6], values[8],
          values[9], values[10], values[11],
          values[12], values[13], values[14],
          values[15], values[16], values[17], values[18],
          values[19], values[20],
          existing.id
        );
      } else {
        await db.runAsync(
          `INSERT INTO cigars (${CIGAR_INSERT_COLUMNS.join(', ')}) VALUES (${CIGAR_INSERT_COLUMNS.map(() => '?').join(', ')})`,
          ...values
        );
      }
    }
  });
}

/**
 * Cigars-only push. No live callers today (pushAllUserData covers every path);
 * kept revision-aware so reviving it cannot produce an unversioned write.
 */
export async function pushUserCigars(accessToken) {
  if (!accessToken) return;
  await pushCigarsAtRevision(accessToken);
}

export async function restoreUserCigarsOnLogin(accessToken) {
  if (!accessToken) return;
  const serverCigars = await fetchUserCigars(accessToken);
  await mergeServerCigarsIntoLocal(serverCigars);
}

// ---------------------------------------------------------------------------
// Humidors sync
// ---------------------------------------------------------------------------

export async function getLocalHumidors() {
  const rows = await db.getAllAsync(
    'SELECT name, humidity, temperature, notes, created_at, updated_at FROM humidors ORDER BY id'
  );
  return rows ?? [];
}

export async function mergeServerHumidorsIntoLocal(serverHumidors) {
  if (!serverHumidors?.length) return;

  await withSerializedTransaction(async () => {
    for (const h of serverHumidors) {
      const name = h.name?.trim();
      if (!name) continue;

      const existing = await db.getFirstAsync('SELECT id FROM humidors WHERE name = ?', name);
      if (existing) {
        await db.runAsync(
          `UPDATE humidors SET humidity = ?, temperature = ?, notes = ?, updated_at = ? WHERE id = ?`,
          h.humidity ?? null, h.temperature ?? null, h.notes ?? null,
          h.updated_at ?? new Date().toISOString(),
          existing.id
        );
      } else {
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO humidors (name, humidity, temperature, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          name, h.humidity ?? null, h.temperature ?? null, h.notes ?? null,
          h.created_at ?? now, h.updated_at ?? now
        );
      }
    }
  });
}

export async function pushUserHumidors(accessToken) {
  if (!accessToken) return;
  const humidors = await getLocalHumidors();
  await saveUserHumidors(accessToken, humidors);
}

export async function restoreUserHumidorsOnLogin(accessToken) {
  if (!accessToken) return;
  const serverHumidors = await fetchUserHumidors(accessToken);
  await mergeServerHumidorsIntoLocal(serverHumidors);
}

// ---------------------------------------------------------------------------
// Cellared items sync
// ---------------------------------------------------------------------------

export async function getLocalCellaredItems() {
  const rows = await db.getAllAsync(`
    SELECT c.brand AS cigar_brand, c.name AS cigar_name, c.length AS cigar_length,
           h.name AS humidor_name,
           ci.quantity, ci.started_at, ci.target_months, ci.notes,
           ci.created_at, ci.updated_at
    FROM cellared_items ci
    JOIN cigars c ON c.id = ci.cigar_id
    LEFT JOIN humidors h ON h.id = ci.humidor_id
  `);
  return rows ?? [];
}

export async function mergeServerCellaredIntoLocal(serverItems) {
  if (!serverItems?.length) return;

  await withSerializedTransaction(async () => {
    for (const item of serverItems) {
      const brand = item.cigar_brand?.trim();
      const name = item.cigar_name?.trim();
      const length = item.cigar_length?.trim();
      if (!brand || !name || !length) continue;

      const cigar = await db.getFirstAsync(
        'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ?',
        brand, name, length
      );
      if (!cigar) continue;

      const humidorId = await resolveHumidorId(item.humidor_name);

      const existing = await db.getFirstAsync(
        'SELECT id FROM cellared_items WHERE cigar_id = ? AND started_at = ?',
        cigar.id, item.started_at
      );

      if (existing) {
        await db.runAsync(
          `UPDATE cellared_items SET humidor_id = ?, quantity = ?, target_months = ?,
           notes = ?, updated_at = ? WHERE id = ?`,
          humidorId, item.quantity ?? 1, item.target_months ?? null,
          item.notes ?? null, item.updated_at ?? new Date().toISOString(),
          existing.id
        );
      } else {
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO cellared_items (cigar_id, humidor_id, quantity, started_at, target_months, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          cigar.id, humidorId, item.quantity ?? 1, item.started_at,
          item.target_months ?? null, item.notes ?? null,
          item.created_at ?? now, item.updated_at ?? now
        );
      }
    }
  });
}

export async function pushUserCellared(accessToken) {
  if (!accessToken) return;
  const items = await getLocalCellaredItems();
  await saveUserCellared(accessToken, items);
}

export async function restoreUserCellaredOnLogin(accessToken) {
  if (!accessToken) return;
  const serverItems = await fetchUserCellared(accessToken);
  await mergeServerCellaredIntoLocal(serverItems);
}

// ---------------------------------------------------------------------------
// Journal entries sync
// ---------------------------------------------------------------------------

export async function getLocalJournalEntries() {
  const rows = await db.getAllAsync(`
    SELECT c.brand AS cigar_brand, c.name AS cigar_name, c.length AS cigar_length,
           j.smoked_date, j.rating, j.would_buy_again, j.notes,
           j.liked_flavors, j.disliked_flavors, j.strength_feedback,
           j.draw, j.burn, j.finish,
           j.created_at, j.updated_at
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
  `);
  return (rows ?? []).map((r) => ({
    ...r,
    would_buy_again: r.would_buy_again != null ? !!r.would_buy_again : null,
  }));
}

export async function mergeServerJournalIntoLocal(serverEntries) {
  if (!serverEntries?.length) return;

  await withSerializedTransaction(async () => {
    for (const entry of serverEntries) {
      const brand = entry.cigar_brand?.trim();
      const name = entry.cigar_name?.trim();
      const length = entry.cigar_length?.trim();
      if (!brand || !name || !length || !entry.smoked_date) continue;

      const cigar = await db.getFirstAsync(
        'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ?',
        brand, name, length
      );
      if (!cigar) continue;

      const existing = await db.getFirstAsync(
        'SELECT id FROM smoke_journal_entries WHERE cigar_id = ? AND smoked_date = ?',
        cigar.id, entry.smoked_date
      );

      const wouldBuyAgain = entry.would_buy_again != null ? (entry.would_buy_again ? 1 : 0) : null;

      if (existing) {
        await db.runAsync(
          `UPDATE smoke_journal_entries SET
            rating = ?, would_buy_again = ?, notes = ?,
            liked_flavors = ?, disliked_flavors = ?, strength_feedback = ?,
            draw = ?, burn = ?, finish = ?, updated_at = ?
          WHERE id = ?`,
          entry.rating ?? null, wouldBuyAgain, entry.notes ?? null,
          entry.liked_flavors ?? '[]', entry.disliked_flavors ?? '[]',
          entry.strength_feedback ?? null,
          entry.draw ?? null, entry.burn ?? null, entry.finish ?? null,
          entry.updated_at ?? new Date().toISOString(),
          existing.id
        );
      } else {
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT INTO smoke_journal_entries (
            cigar_id, smoked_date, rating, would_buy_again, notes,
            liked_flavors, disliked_flavors, strength_feedback,
            draw, burn, finish, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          cigar.id, entry.smoked_date, entry.rating ?? null, wouldBuyAgain,
          entry.notes ?? null,
          entry.liked_flavors ?? '[]', entry.disliked_flavors ?? '[]',
          entry.strength_feedback ?? null,
          entry.draw ?? null, entry.burn ?? null, entry.finish ?? null,
          entry.created_at ?? now, entry.updated_at ?? now
        );
      }
    }
  });
}

export async function pushUserJournal(accessToken) {
  if (!accessToken) return;
  const entries = await getLocalJournalEntries();
  await saveUserJournal(accessToken, entries);
}

export async function restoreUserJournalOnLogin(accessToken) {
  if (!accessToken) return;
  const serverEntries = await fetchUserJournal(accessToken);
  await mergeServerJournalIntoLocal(serverEntries);
}

// ---------------------------------------------------------------------------
// Full sync orchestration
// ---------------------------------------------------------------------------

let restoreCompleted = false;

export async function restoreAllUserDataOnLogin(accessToken) {
  if (!accessToken) return;
  await whenDatabaseReady();
  // Humidors first (cigars and cellared items reference them)
  await restoreUserHumidorsOnLogin(accessToken);
  await restoreUserCigarsOnLogin(accessToken);
  await restoreUserCellaredOnLogin(accessToken);
  await restoreUserJournalOnLogin(accessToken);
  restoreCompleted = true;
}

/**
 * Restore everything EXCEPT cigars.
 *
 * The guest-migration path must not run restoreUserCigarsOnLogin after
 * applyMigration: mergeServerCigarsIntoLocal UPDATEs matching local rows from
 * server values, which would overwrite every quantity and note the user just
 * chose. The server's cigars are already folded in by detectMigrationPlan, so
 * re-merging them is both redundant and destructive.
 */
export async function restoreNonCigarUserData(accessToken) {
  if (!accessToken) return;
  await whenDatabaseReady();
  await restoreUserHumidorsOnLogin(accessToken);
  await restoreUserCellaredOnLogin(accessToken);
  await restoreUserJournalOnLogin(accessToken);
  restoreCompleted = true;
}

/** Humidors alone — needed before apply so humidor_name resolves to an id. */
export async function restoreHumidorsOnly(accessToken) {
  if (!accessToken) return;
  await whenDatabaseReady();
  await restoreUserHumidorsOnLogin(accessToken);
}

async function pushUnlessCloudWouldBeWiped({ getLocal, fetchRemote, save, accessToken, label }) {
  const local = await getLocal();
  if (!local.length) {
    const remote = await fetchRemote(accessToken);
    if (remote?.length) {
      console.warn(`Skipping empty ${label} push; cloud still has ${remote.length} records`);
      return;
    }
  }
  await save(accessToken, local);
}

/**
 * Cigars-only variant of the above, guarded by the server snapshot revision.
 *
 * Reads the current revision immediately before writing so the window another
 * device could slip into is one round trip rather than the whole migration.
 * A 409 means the server refused and changed nothing; the caller decides
 * whether to rebuild and retry.
 *
 * Humidors, cellared items and journal entries are untouched by this change —
 * only /api/user/cigars carries a revision.
 */
async function pushCigarsAtRevision(accessToken) {
  const { cigars: remote, revision } = await fetchUserCigarsWithRevision(accessToken);
  const local = await getLocalSyncableCigars();
  if (!local.length && remote?.length) {
    console.warn(`Skipping empty cigars push; cloud still has ${remote.length} records`);
    return { skipped: true };
  }
  await saveUserCigars(accessToken, local, revision);
  return { skipped: false, revision };
}

export async function pushAllUserData(accessToken) {
  if (!accessToken) return;
  await whenDatabaseReady();
  if (!restoreCompleted) {
    console.warn('Skipping cloud push until restore finishes');
    return;
  }
  await pushUnlessCloudWouldBeWiped({
    accessToken,
    label: 'humidors',
    getLocal: getLocalHumidors,
    fetchRemote: fetchUserHumidors,
    save: saveUserHumidors,
  });
  // Cigars are the only revision-guarded collection. Normal sign-in sync is
  // otherwise unchanged: same local set, same full-replace, now with a
  // precondition so a stale write is refused instead of clobbering.
  await pushCigarsAtRevision(accessToken);
  await pushUnlessCloudWouldBeWiped({
    accessToken,
    label: 'cellared items',
    getLocal: getLocalCellaredItems,
    fetchRemote: fetchUserCellared,
    save: saveUserCellared,
  });
  await pushUnlessCloudWouldBeWiped({
    accessToken,
    label: 'journal',
    getLocal: getLocalJournalEntries,
    fetchRemote: fetchUserJournal,
    save: saveUserJournal,
  });
}

let hydrateInFlight = null;

import { trackEvent } from './analytics';
import { clearMigrationPending, isMigrationPending } from './authState';
import { findCigarsMissingFromCloud } from './cigarIdentity';

/**
 * Verify the server now holds every local cigar, by identity triple.
 *
 * pushAllUserData is silent when it declines to write (restore incomplete, or
 * the empty-local guard), so a resolved promise is not proof of persistence.
 * Throws when anything local is still missing server-side, which keeps the
 * migration-pending flag set and the local rows protected.
 */
async function confirmCloudHasLocalCigars(accessToken) {
  const local = await getLocalSyncableCigars();
  if (!local.length) return;

  const remote = await fetchUserCigars(accessToken);
  const missing = findCigarsMissingFromCloud(local, remote);

  if (missing.length) {
    throw new Error(
      `Cloud is missing ${missing.length} of ${local.length} local cigars after push`
    );
  }
}

/**
 * Pull cloud inventory onto this device, then push local as the new snapshot.
 * Safe to call from multiple launch/login paths; only one run at a time.
 *
 * `isGuestMigration` diverts to the staged, conflict-aware path in
 * lib/guestMigration.js. Non-migrating sign-ins take exactly the same route
 * they always have: restore, push, and (only if a flag is left over from an
 * earlier failure) confirm.
 */
export async function hydrateUserData(accessToken, { isGuestMigration = false, userId = null } = {}) {
  if (!accessToken) return;
  if (hydrateInFlight) return hydrateInFlight;

  hydrateInFlight = (async () => {
    // A flag left over from an earlier failed migration still means "local is
    // the only copy", so this run has to confirm and clear it too — otherwise
    // one failure would disable wipeLocalUserData permanently.
    const hadPendingMigration = await isMigrationPending();

    // A pending flag means this device holds local rows the server has never
    // confirmed — true after a deferred or failed migration, including when a
    // DIFFERENT account signs in next. Routing those through the staged path
    // stops the normal full-replace push from silently writing one person's
    // guest collection into another's account.
    //
    // Users who never migrated have no flag, so their path is unchanged.
    if ((isGuestMigration || hadPendingMigration) && userId) {
      await runGuestMigration(accessToken, userId);
      return;
    }

    await restoreAllUserDataOnLogin(accessToken);
    await pushAllUserData(accessToken);
    if (hadPendingMigration) {
      // An earlier migration never confirmed. Only clear once this sync proves
      // the server holds everything local.
      await confirmCloudHasLocalCigars(accessToken);
      await clearMigrationPending();
    }
  })().finally(() => {
    hydrateInFlight = null;
  });

  return hydrateInFlight;
}

/**
 * Guest→account migration. Stages conflicts without writing, and stops short of
 * touching `cigars` or pushing while any decision is outstanding.
 *
 * Resumable: an existing active run is picked up rather than restaged, so
 * resolutions already made survive restarts and connectivity loss.
 */
export async function runGuestMigration(accessToken, userId) {
  // Imported lazily: guestMigration.js imports getLocalSyncableCigars from this
  // module, so a static import would be a cycle at module-eval time.
  const {
    PHASE, applyMigration, beginMigration, completeMigration, countUnresolved, failMigration,
  } = await import('./guestMigration');

  let run;
  try {
    run = await beginMigration(userId, accessToken);
  } catch (err) {
    if (err?.code === 'MIGRATION_ACCOUNT_MISMATCH') {
      // Not a failure — a refusal. The other account's snapshot and answers
      // stay on disk and the pending flag stays set, so nothing is written,
      // pushed or wiped. Needs explicit user confirmation to redirect.
      trackEvent('guest_data_migration_account_mismatch');
      return {
        phase: 'needs_account_confirmation',
        foreignRun: err.foreignRun,
        migrationId: err.foreignRun?.migrationId ?? null,
      };
    }
    trackEvent('guest_data_migration_failed', { error: err.message || 'stage_failed' });
    throw err;
  }
  if (!run) return { phase: null };

  // Gate on outstanding answers only, never on the stored phase. A run staged
  // as `awaiting_resolution` keeps that phase after the user answers the last
  // conflict, so checking the phase here would strand every resolved migration
  // short of apply/push/complete.
  const unresolved = await countUnresolved(run.migration_id);
  if (unresolved > 0) {
    trackEvent('guest_data_migration_conflicts_staged', {
      conflict_count: unresolved,
      cigar_count: run.guest_snapshot?.length ?? 0,
    });
    // Nothing written, nothing pushed, pending flag still set.
    return { phase: PHASE.AWAITING, unresolved, migrationId: run.migration_id };
  }

  trackEvent('guest_data_migration_started', { cigar_count: run.guest_snapshot?.length ?? 0 });

  try {
    // Humidors must exist before apply so humidor_name resolves to a real id.
    await restoreHumidorsOnly(accessToken);

    const result = await applyMigration(userId, accessToken);
    if (!result.applied) {
      return { phase: PHASE.AWAITING, unresolved: await countUnresolved(run.migration_id), migrationId: run.migration_id };
    }

    // Everything EXCEPT cigars — restoring cigars here would re-merge server
    // values over the resolutions applyMigration just wrote.
    await restoreNonCigarUserData(accessToken);

    try {
      await pushAllUserData(accessToken);
    } catch (err) {
      if (err?.code !== 'REVISION_CONFLICT') throw err;

      // Another device wrote while this migration was being resolved. The
      // server changed nothing. Rebuild the plan against the newer snapshot,
      // keeping only answers whose guest AND server values are unchanged.
      trackEvent('guest_data_migration_revision_conflict');
      const { restageMigration, applyMigration: reapply, countUnresolved: recount } =
        await import('./guestMigration');
      await restageMigration(userId, accessToken);

      const stillUnresolved = await recount(run.migration_id);
      if (stillUnresolved > 0) {
        // The newer server values invalidated some answers — ask again rather
        // than guess. Nothing written, nothing pushed, pending flag still set.
        return {
          phase: PHASE.AWAITING,
          unresolved: stillUnresolved,
          migrationId: run.migration_id,
          rebuiltAfterConflict: true,
        };
      }
      await reapply(userId, accessToken);
      await pushAllUserData(accessToken);
    }

    await confirmCloudHasLocalCigars(accessToken);

    await completeMigration(run.migration_id);
    await clearMigrationPending();
    trackEvent('guest_data_migration_completed', { cigar_count: result.count });
    return { phase: PHASE.COMPLETED, migrationId: run.migration_id };
  } catch (err) {
    await failMigration(run.migration_id, err.message).catch(() => {});
    trackEvent('guest_data_migration_failed', { error: err.message || 'unknown' });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Debounced push (used by screens on data changes)
// ---------------------------------------------------------------------------

let pushTimer = null;

export function schedulePushUserCigars(supabase) {
  scheduleFullPush(supabase);
}

export function scheduleFullPush(supabase) {
  if (!supabase) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await pushAllUserData(session.access_token);
    })().catch((err) => {
      console.warn('User data push failed:', err.message || err);
    });
  }, 800);
}
