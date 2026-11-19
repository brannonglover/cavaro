import { db } from '../db';
import { getJournalEntries } from '../db/journal';
import {
  getCigarMatch,
  getMatchLevel,
  getProfileConfidence,
  getTasteProfile,
  NEGATIVE_RATING_THRESHOLD,
} from './tasteProfile';

async function loadCigarsForEntries(entries) {
  const cigarIds = [...new Set(entries.map((entry) => Number(entry.cigarId)).filter(Boolean))];
  if (cigarIds.length === 0) return [];

  const placeholders = cigarIds.map(() => '?').join(', ');
  return db.getAllAsync(`SELECT * FROM cigars WHERE id IN (${placeholders})`, ...cigarIds);
}

function cigarKey(cigar) {
  return `${(cigar.brand ?? '').trim().toLowerCase()}|${(cigar.name ?? '').trim().toLowerCase()}|${(cigar.length ?? '').trim().toLowerCase()}`;
}

function groupEntriesByCigar(entries) {
  const grouped = {};
  for (const entry of entries) {
    if (!grouped[entry.cigarId]) grouped[entry.cigarId] = [];
    grouped[entry.cigarId].push(entry);
  }
  return grouped;
}

export function buildTasteSummary(profile) {
  return [
    profile.preferredStrength,
    profile.favoriteWrappers[0],
    profile.favoriteCountries[0],
    profile.favoriteFlavors[0],
    profile.favoriteFlavors[1],
  ]
    .filter(Boolean)
    .join('  ·  ');
}

export function buildWhatYouLove(profile) {
  const items = [];
  for (const wrapper of profile.favoriteWrappers.slice(0, 2)) {
    items.push(`${wrapper} wrappers`);
  }
  for (const country of profile.favoriteCountries.slice(0, 2)) {
    items.push(`${country} tobacco`);
  }
  for (const vitola of profile.favoriteVitolas.slice(0, 1)) {
    items.push(`${vitola} vitolas`);
  }
  for (const flavor of profile.favoriteFlavors.slice(0, 3)) {
    items.push(`${flavor} notes`);
  }
  if (profile.preferredStrength) {
    items.push(`${profile.preferredStrength} body`);
  }
  return [...new Set(items)];
}

export function buildNotYourPreference(profile) {
  const items = [];
  if (profile.leastPreferredStrength) {
    items.push(`${profile.leastPreferredStrength} body`);
  }
  for (const flavor of profile.dislikedFlavors.slice(0, 3)) {
    items.push(`${flavor} notes`);
  }
  for (const wrapper of profile.dislikedWrappers.slice(0, 2)) {
    items.push(`${wrapper} wrappers`);
  }
  if (profile.dislikedFlavors.includes('Short finish')) {
    items.push('Short finish');
  }
  return [...new Set(items)];
}

export function getWorthRevisiting(entries, cigarById) {
  const grouped = groupEntriesByCigar(entries);
  const results = [];

  for (const [cigarId, history] of Object.entries(grouped)) {
    if (history.length !== 1) continue;
    const entry = history[0];
    const lowRating = entry.rating != null && entry.rating < NEGATIVE_RATING_THRESHOLD;
    const declined = entry.wouldBuyAgain === false;
    if (!lowRating && !declined) continue;

    const cigar = cigarById[cigarId];
    if (!cigar) continue;

    results.push({
      cigar,
      level: 'Needs Another Chance',
      reason: 'One low rating. Not enough data yet.',
    });
  }

  return results.slice(0, 5);
}

export function getUnlikelyMatches(entries, cigarById, confidence) {
  const grouped = groupEntriesByCigar(entries);
  const results = [];

  for (const [cigarId, history] of Object.entries(grouped)) {
    const lowCount = history.filter(
      (entry) => entry.rating != null && entry.rating < NEGATIVE_RATING_THRESHOLD
    ).length;
    const allDeclined = history.length >= 2 && history.every((entry) => entry.wouldBuyAgain === false);
    if (lowCount < 2 && !allDeclined) continue;

    const cigar = cigarById[cigarId];
    if (!cigar) continue;

    const notes = [];
    if (lowCount >= 2) notes.push(`${lowCount} low ratings`);
    if (history.some((entry) => entry.strengthFeedback === 'Too Mild')) {
      notes.push('Often noted as too mild');
    }
    if (history.some((entry) => entry.strengthFeedback === 'Too Strong')) {
      notes.push('Often noted as too strong');
    }

    const level = getMatchLevel(35, confidence, history);
    results.push({
      cigar,
      level: level === 'Unlikely Match' ? level : 'Unlikely Match',
      reason: notes.join('. ') || 'Repeated low ratings',
    });
  }

  return results.slice(0, 5);
}

async function fetchBuyNextRecommendations(profile, entries, smokedCigars, confidence) {
  const smokedKeys = new Set(smokedCigars.map(cigarKey));
  const catalogRows = await db.getAllAsync(
    'SELECT * FROM cigar_catalog ORDER BY brand, name LIMIT 250'
  );

  return (catalogRows ?? [])
    .filter((cigar) => !smokedKeys.has(cigarKey(cigar)))
    .map((cigar) => {
      const match = getCigarMatch(cigar, profile, entries, confidence);
      return { cigar, ...match };
    })
    .filter((item) => item.level === 'Excellent Match' || item.level === 'Good Match')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Aggregates My Taste screen data from journal entries.
 */
export async function getMyTasteInsights() {
  const entries = await getJournalEntries();
  if (entries.length === 0) {
    return { isEmpty: true, entryCount: 0 };
  }

  const cigars = await loadCigarsForEntries(entries);
  const cigarById = Object.fromEntries(cigars.map((cigar) => [String(cigar.id), cigar]));
  const profile = getTasteProfile(entries, cigars);
  const confidence = getProfileConfidence(entries);

  return {
    isEmpty: false,
    entryCount: entries.length,
    confidence,
    profile,
    tasteSummary: buildTasteSummary(profile),
    whatYouLove: buildWhatYouLove(profile),
    notYourPreference: buildNotYourPreference(profile),
    worthRevisiting: getWorthRevisiting(entries, cigarById),
    unlikelyMatches: getUnlikelyMatches(entries, cigarById, confidence),
    buyNext: await fetchBuyNextRecommendations(profile, entries, cigars, confidence),
  };
}
