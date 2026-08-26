import {
  fetchUserCigars, saveUserCigars,
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

export async function pushUserCigars(accessToken) {
  if (!accessToken) return;
  const cigars = await getLocalSyncableCigars();
  await saveUserCigars(accessToken, cigars);
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
  await pushUnlessCloudWouldBeWiped({
    accessToken,
    label: 'cigars',
    getLocal: getLocalSyncableCigars,
    fetchRemote: fetchUserCigars,
    save: saveUserCigars,
  });
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

/**
 * Pull cloud inventory onto this device, then push local as the new snapshot.
 * Safe to call from multiple launch/login paths; only one run at a time.
 */
export async function hydrateUserData(accessToken) {
  if (!accessToken) return;
  if (hydrateInFlight) return hydrateInFlight;

  hydrateInFlight = (async () => {
    await restoreAllUserDataOnLogin(accessToken);
    await pushAllUserData(accessToken);
  })().finally(() => {
    hydrateInFlight = null;
  });

  return hydrateInFlight;
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
