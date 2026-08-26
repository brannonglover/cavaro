/**
 * Catalog taste search and palate ranking.
 * Used by Taste Search to find cigars by flavor notes or by name.
 */

import { db } from '../db';
import { getJournalEntries } from '../db/journal';
import {
  getCigarMatch,
  getProfileConfidence,
  getTasteProfile,
} from './tasteProfile';
import {
  extractTasteProfile,
  parseStoredFlavors,
  TASTE_PROFILE_SYNONYMS,
} from './tasteVocabulary';

export const TASTE_SEARCH_FLAVORS = [
  'Chocolate',
  'Cocoa',
  'Coffee',
  'Cedar',
  'Leather',
  'Earth',
  'Pepper',
  'Spice',
  'Cream',
  'Nuts',
  'Vanilla',
  'Floral',
  'Citrus',
  'Fruit',
  'Wood',
  'Sweet',
];

const FLAVOR_SYNONYMS = TASTE_PROFILE_SYNONYMS;

function cigarTextBlob(cigar) {
  return [
    cigar?.name,
    cigar?.brand,
    cigar?.line,
    cigar?.wrapper,
    cigar?.binder,
    cigar?.filler,
    cigar?.description,
    cigar?.community_flavors,
    cigar?.flavor_profile,
    cigar?.favorite_notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function extractFlavorNotes(cigar) {
  const stored = parseStoredFlavors(cigar?.flavors);
  if (stored.length) return stored;

  const blob = cigarTextBlob(cigar);
  if (!blob.trim()) return [];
  const extracted = extractTasteProfile(blob);
  return extracted.flavors;
}

function termsFromKeywords(keywords) {
  return (keywords ?? [])
    .map((keyword) => String(keyword).trim().toLowerCase())
    .filter((keyword) => keyword.length > 1);
}

export function expandTasteKeywords(keywords) {
  const terms = new Set(termsFromKeywords(keywords));
  for (const keyword of [...terms]) {
    const match = FLAVOR_SYNONYMS.find(
      (entry) => entry.label.toLowerCase() === keyword || entry.terms.includes(keyword)
    );
    if (!match) continue;
    terms.add(match.label.toLowerCase());
    match.terms.forEach((term) => terms.add(term));
  }
  return [...terms];
}

function blendKey(cigar) {
  return `${String(cigar?.brand || '').trim().toLowerCase()}::${String(cigar?.name || '').trim().toLowerCase()}`;
}

function isJpegProductImage(url) {
  return String(url || '').toLowerCase().includes('.jpg');
}

/**
 * Catalog rows are one-per-size. Taste search is about the blend, so collapse
 * vitolas that share a brand + name (e.g. Rocky Patel Decade × 7 sizes).
 */
export function collapseCigarsByBlend(cigars) {
  const byKey = new Map();
  for (const cigar of cigars ?? []) {
    const key = blendKey(cigar);
    if (key === '::') continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, cigar);
      continue;
    }
    if (!isJpegProductImage(existing.image) && isJpegProductImage(cigar.image)) {
      byKey.set(key, cigar);
    }
  }
  return [...byKey.values()];
}

export function blendSizeSummary(cigar, catalog = []) {
  const sizes = [...new Set(
    (catalog ?? [])
      .filter((row) => blendKey(row) === blendKey(cigar))
      .map((row) => String(row.size_name || row.length || '').trim())
      .filter(Boolean)
  )];
  const primary = cigar?.size_name || cigar?.length || sizes[0] || '';
  if (sizes.length <= 1) return primary;
  if (sizes.length <= 3) return sizes.join(' · ');
  return primary ? `${primary} · ${sizes.length} sizes` : `${sizes.length} sizes`;
}

export function filterCatalogByTaste(catalog, keywords) {
  const terms = expandTasteKeywords(keywords);
  if (!terms.length || !catalog?.length) return [];
  const termSet = new Set(terms);

  const matches = catalog.filter((cigar) => {
    const stored = parseStoredFlavors(cigar.flavors);
    if (stored.length) {
      return stored.some((flavor) => (
        termSet.has(flavor.toLowerCase())
        || flavor.toLowerCase().split(/\s+/).some((part) => termSet.has(part))
      ));
    }
    const blob = cigarTextBlob(cigar);
    return terms.some((term) => blob.includes(term));
  });
  return collapseCigarsByBlend(matches);
}

export function filterCatalogByName(catalog, query) {
  const terms = termsFromKeywords(
    String(query || '')
      .toLowerCase()
      .split(/[\s,]+/)
  );
  if (!terms.length || !catalog?.length) return [];

  const matches = catalog.filter((cigar) => {
    const haystack = [cigar?.brand, cigar?.name, cigar?.line]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  return collapseCigarsByBlend(matches);
}

export function enrichCigarForMatch(cigar, extraNotes = []) {
  const flavors = [...extractFlavorNotes(cigar), ...extraNotes];
  const uniqueFlavors = [...new Set(flavors)];
  return {
    ...cigar,
    description: [cigar?.description, uniqueFlavors.join(' '), cigar?.community_flavors]
      .filter(Boolean)
      .join(' '),
  };
}

export function rankCigarsForPalate(cigars, palate, extraNotesById = {}) {
  const profile = palate?.profile;
  const entries = palate?.entries ?? [];
  const confidence = palate?.confidence ?? 'low';

  return (cigars ?? []).map((cigar) => {
    const extraNotes = extraNotesById[String(cigar.id)] ?? [];
    const flavors = [...new Set([...extractFlavorNotes(cigar), ...extraNotes])];
    const match = profile
      ? getCigarMatch(enrichCigarForMatch(cigar, extraNotes), profile, entries, confidence)
      : null;
    return { cigar, flavors, match };
  }).sort((a, b) => {
    const scoreA = a.match?.score ?? 0;
    const scoreB = b.match?.score ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const brandA = (a.cigar.brand || '').localeCompare(b.cigar.brand || '');
    if (brandA !== 0) return brandA;
    return (a.cigar.name || '').localeCompare(b.cigar.name || '');
  });
}

async function loadCigarsForEntries(entries) {
  const cigarIds = [...new Set(entries.map((entry) => Number(entry.cigarId)).filter(Boolean))];
  if (cigarIds.length === 0) return [];
  const placeholders = cigarIds.map(() => '?').join(', ');
  return db.getAllAsync(`SELECT * FROM cigars WHERE id IN (${placeholders})`, ...cigarIds);
}

export async function loadLocalCatalog() {
  return db.getAllAsync(
    'SELECT id, brand, name, line, description, wrapper, binder, filler, length, size_name, image, flavors, strength, taste_source FROM cigar_catalog ORDER BY brand, name, length'
  );
}

/**
 * @returns {Promise<{
 *   entries: import('../models/journal').SmokeJournalEntry[],
 *   profile: import('../models/tasteProfile').TasteProfile,
 *   confidence: import('../models/tasteProfile').ProfileConfidence,
 *   hasPalate: boolean,
 * }>}
 */
export async function loadPalateContext() {
  const entries = await getJournalEntries();
  if (!entries.length) {
    return {
      entries: [],
      profile: null,
      confidence: 'low',
      hasPalate: false,
    };
  }

  const cigars = await loadCigarsForEntries(entries);
  return {
    entries,
    profile: getTasteProfile(entries, cigars),
    confidence: getProfileConfidence(entries),
    hasPalate: true,
  };
}

export function palateFlavorChips(profile) {
  return (profile?.favoriteFlavors ?? []).filter(Boolean).slice(0, 6);
}
