import { fetchUserCigars, saveUserCigars } from '../api/userCigars';
import { db } from '../db';

const LOCAL_SYNC_QUERY = `
  SELECT brand, name, line, description, wrapper, binder, filler, length, image,
         collection, is_favorite, quantity, smoked_date, smoke_notes, favorite_notes,
         flavor_profile, strength_profile, construction_quality, flavor_changes
  FROM cigars
  WHERE collection IN ('likes', 'dislikes')
     OR (collection = 'cavaro' AND is_favorite = 1)
`;

const INSERT_COLUMNS = [
  'brand', 'name', 'line', 'description', 'wrapper', 'binder', 'filler', 'length', 'image',
  'collection', 'is_favorite', 'quantity', 'smoked_date', 'smoke_notes', 'favorite_notes',
  'flavor_profile', 'strength_profile', 'construction_quality', 'flavor_changes',
];

function cigarValues(cigar) {
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
    Math.max(0, parseInt(cigar.quantity, 10) || 1),
    cigar.smoked_date ?? null,
    cigar.smoke_notes ?? null,
    cigar.favorite_notes ?? null,
    cigar.flavor_profile ?? null,
    cigar.strength_profile ?? null,
    cigar.construction_quality ?? null,
    cigar.flavor_changes ?? null,
  ];
}

function isValidCigarIdentity(cigar) {
  return !!(cigar?.brand?.trim() && cigar?.name?.trim() && cigar?.length?.trim());
}

export async function getLocalSyncableCigars() {
  const rows = await db.getAllAsync(LOCAL_SYNC_QUERY);
  return rows ?? [];
}

export async function mergeServerCigarsIntoLocal(serverCigars) {
  if (!serverCigars?.length) return;

  await db.withTransactionAsync(async () => {
    for (const cigar of serverCigars) {
      if (!isValidCigarIdentity(cigar)) continue;

      const brand = cigar.brand.trim();
      const name = cigar.name.trim();
      const length = cigar.length.trim();
      const existing = await db.getFirstAsync(
        'SELECT id FROM cigars WHERE brand = ? AND name = ? AND length = ?',
        brand,
        name,
        length
      );

      const values = cigarValues({ ...cigar, brand, name, length });

      if (existing) {
        await db.runAsync(
          `UPDATE cigars SET
            line = ?, description = ?, wrapper = ?, binder = ?, filler = ?, image = ?,
            collection = ?, is_favorite = ?, quantity = ?,
            smoked_date = ?, smoke_notes = ?, favorite_notes = ?,
            flavor_profile = ?, strength_profile = ?, construction_quality = ?, flavor_changes = ?
          WHERE id = ?`,
          values[2], values[3], values[4], values[5], values[6], values[8],
          values[9], values[10], values[11],
          values[12], values[13], values[14],
          values[15], values[16], values[17], values[18],
          existing.id
        );
      } else {
        await db.runAsync(
          `INSERT INTO cigars (${INSERT_COLUMNS.join(', ')}) VALUES (${INSERT_COLUMNS.map(() => '?').join(', ')})`,
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

let pushTimer = null;

export function schedulePushUserCigars(supabase) {
  if (!supabase) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await pushUserCigars(session.access_token);
    })().catch((err) => {
      console.warn('User cigars push failed:', err.message || err);
    });
  }, 800);
}
