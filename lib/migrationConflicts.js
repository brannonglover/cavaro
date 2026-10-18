/**
 * Guest→account migration conflict rules.
 *
 * Pure functions, no native imports, so scripts/verify-migration-conflicts.js
 * can exercise them in plain node. See docs/GUEST_MIGRATION_CONFLICTS.md for
 * the design and the reasoning behind each classification.
 *
 * The contract: detectMigrationPlan never decides a user-owned field, and
 * applyMigrationPlan never writes a value the user did not choose. An
 * unresolved field keeps the guest value, so waiting is always non-destructive.
 */

import { cigarIdentityKey, hasCigarIdentity } from './cigarIdentity';

/** Fields the user must decide. Quantity is never summed or maxed. */
export const CONFLICT_FIELDS = [
  'quantity',
  'collection',
  'smoked_date',
  'humidor_name',
  'smoke_notes',
  'favorite_notes',
  'flavor_profile',
  'strength_profile',
  'construction_quality',
  'flavor_changes',
];

/** Conflict fields where "keep both" is meaningful (free text). */
export const TEXT_CONFLICT_FIELDS = [
  'smoke_notes',
  'favorite_notes',
  'flavor_profile',
  'strength_profile',
  'construction_quality',
  'flavor_changes',
];

/** Catalog-derived, never user-typed: auto-merged preferring the server. */
export const CATALOG_FIELDS = ['description', 'wrapper', 'binder', 'filler', 'image', 'line'];

/** Every field carried through a migration, in local-column order. */
export const MIGRATED_FIELDS = [
  'line', 'description', 'wrapper', 'binder', 'filler', 'image',
  'collection', 'is_favorite', 'quantity', 'smoked_date', 'smoke_notes',
  'favorite_notes', 'flavor_profile', 'strength_profile', 'construction_quality',
  'flavor_changes', 'date_added', 'humidor_name',
];

export const MERGED_FROM_LABEL = '— merged from your existing account —';

/** Blank means absent. Zero and false are meaningful values, not blanks. */
export function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function sameValue(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  }
  return String(a).trim() === String(b).trim();
}

function truthy(value) {
  if (typeof value === 'string') return value !== '' && value !== '0' && value !== 'false';
  return !!value;
}

/** Labelled concatenation so "keep both" stays reviewable rather than fused. */
export function combineText(guestValue, serverValue) {
  const g = isBlank(guestValue) ? '' : String(guestValue).trim();
  const s = isBlank(serverValue) ? '' : String(serverValue).trim();
  if (!g) return s || null;
  if (!s) return g;
  if (sameValue(g, s)) return g;
  return `${g}\n\n${MERGED_FROM_LABEL}\n${s}`;
}

export function conflictKey(brand, name, length, field) {
  return `${cigarIdentityKey({ brand, name, length })}|${field}`;
}

/**
 * Resolve one field. Returns { value, conflict } — when conflict is true the
 * value is the guest's, held only until the user decides.
 */
export function mergeField(field, guestValue, serverValue) {
  const gBlank = isBlank(guestValue);
  const sBlank = isBlank(serverValue);

  if (gBlank && sBlank) return { value: null, conflict: false };
  if (gBlank) return { value: serverValue, conflict: false };
  if (sBlank) return { value: guestValue, conflict: false };
  if (sameValue(guestValue, serverValue)) return { value: guestValue, conflict: false };

  // Both sides set and different.
  if (field === 'is_favorite') {
    // "Unfavorited" is not representable, so OR cannot erase an intent.
    return { value: truthy(guestValue) || truthy(serverValue) ? 1 : 0, conflict: false };
  }
  if (field === 'date_added') {
    // The cigar demonstrably entered the collection by the earlier date.
    const g = String(guestValue);
    const s = String(serverValue);
    return { value: g <= s ? g : s, conflict: false };
  }
  if (CATALOG_FIELDS.includes(field)) {
    return { value: serverValue, conflict: false };
  }
  if (CONFLICT_FIELDS.includes(field)) {
    return { value: guestValue, conflict: true };
  }
  return { value: serverValue, conflict: false };
}

/**
 * Collapse rows sharing an identity. First occurrence wins for fields it has
 * set; blanks are filled from later duplicates so nothing is needlessly lost.
 *
 * Local `cigars` has no UNIQUE on the identity triple, so duplicates exist in
 * the wild. The server's PUT already dedupes keeping the first occurrence, so
 * collapsing the same way matches what would happen anyway.
 */
export function collapseByIdentity(cigars) {
  const byKey = new Map();
  for (const cigar of cigars ?? []) {
    if (!hasCigarIdentity(cigar)) continue;
    const key = cigarIdentityKey(cigar);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...cigar });
      continue;
    }
    for (const field of MIGRATED_FIELDS) {
      if (isBlank(existing[field]) && !isBlank(cigar[field])) existing[field] = cigar[field];
    }
  }
  return [...byKey.values()];
}

/**
 * Diff the pre-merge guest snapshot against the server snapshot.
 *
 * Writes nothing. Returns the auto-merged base for every cigar plus a
 * field-level conflict list for the decisions only the user can make.
 */
export function detectMigrationPlan(guestCigars, serverCigars) {
  const guest = collapseByIdentity(guestCigars);
  const server = collapseByIdentity(serverCigars);

  const guestByKey = new Map(guest.map((c) => [cigarIdentityKey(c), c]));
  const serverByKey = new Map(server.map((c) => [cigarIdentityKey(c), c]));

  const rows = [];
  const conflicts = [];

  // Guest order first, then server-only cigars, for stable output.
  const keys = [...guestByKey.keys(), ...server.map(cigarIdentityKey).filter((k) => !guestByKey.has(k))];

  for (const key of keys) {
    const g = guestByKey.get(key);
    const s = serverByKey.get(key);
    const identity = g ?? s;
    const base = {
      brand: String(identity.brand).trim(),
      name: String(identity.name).trim(),
      length: String(identity.length).trim(),
    };
    const conflictFields = [];

    for (const field of MIGRATED_FIELDS) {
      if (!g) { base[field] = s[field] ?? null; continue; }
      if (!s) { base[field] = g[field] ?? null; continue; }

      const { value, conflict } = mergeField(field, g[field], s[field]);
      base[field] = value;
      if (conflict) {
        conflictFields.push(field);
        conflicts.push({
          brand: base.brand,
          name: base.name,
          length: base.length,
          field,
          guest_value: g[field],
          server_value: s[field],
        });
      }
    }

    rows.push({ ...base, conflictFields, origin: g && s ? 'both' : g ? 'guest' : 'server' });
  }

  return { rows, conflicts };
}

/**
 * Produce the final cigar set from a plan plus whatever the user has resolved.
 *
 * `resolutions` is keyed by conflictKey() with { resolution, resolved_value }.
 * A field with no resolution keeps the guest value — so calling this mid-way
 * through resolution is safe and loses nothing. Pure in its inputs, which is
 * what makes retries idempotent.
 */
export function applyMigrationPlan({ rows, conflicts }, resolutions = {}) {
  const conflictByKey = new Map(
    (conflicts ?? []).map((c) => [conflictKey(c.brand, c.name, c.length, c.field), c])
  );

  return (rows ?? []).map((row) => {
    const out = { ...row };
    delete out.conflictFields;
    delete out.origin;

    for (const field of row.conflictFields ?? []) {
      const key = conflictKey(row.brand, row.name, row.length, field);
      const conflict = conflictByKey.get(key);
      if (!conflict) continue;

      const decision = resolutions[key];
      if (!decision?.resolution) {
        out[field] = conflict.guest_value; // undecided: hold the guest value
        continue;
      }

      switch (decision.resolution) {
        case 'server':
          out[field] = conflict.server_value;
          break;
        case 'manual':
          out[field] = decision.resolved_value;
          break;
        case 'both':
          out[field] = isBlank(decision.resolved_value)
            ? combineText(conflict.guest_value, conflict.server_value)
            : decision.resolved_value;
          break;
        case 'guest':
        default:
          out[field] = conflict.guest_value;
          break;
      }
    }
    return out;
  });
}

/** Conflicts still awaiting a decision. */
export function unresolvedConflicts(conflicts) {
  return (conflicts ?? []).filter((c) => !c.resolution);
}

/** Group conflicts by cigar for display. */
export function groupConflictsByCigar(conflicts) {
  const byKey = new Map();
  for (const c of conflicts ?? []) {
    const key = cigarIdentityKey(c);
    if (!byKey.has(key)) {
      byKey.set(key, { brand: c.brand, name: c.name, length: c.length, fields: [] });
    }
    byKey.get(key).fields.push(c);
  }
  return [...byKey.values()];
}
