import { db } from '../db';
import { getJournalEntries } from '../db/journal';
import {
  getCigarMatch,
  getProfileConfidence,
  getTasteProfile,
} from './tasteProfile';

function buildReason(match) {
  const positiveReasons = (match.reasons ?? []).filter(
    (reason) => !reason.toLowerCase().includes('not preferred')
  );

  if (positiveReasons.length > 0) {
    return positiveReasons.slice(0, 2).join(' · ');
  }

  if (match.level === 'Excellent Match' || match.level === 'Good Match') {
    return 'A strong fit for your palate tonight.';
  }

  return 'A cigar from your humidor, ready to enjoy tonight.';
}

/**
 * Picks the best cigar from current humidor inventory for tonight.
 */
export async function getSmokeRecommendation() {
  const [entries, inventory] = await Promise.all([
    getJournalEntries(),
    db.getAllAsync(`
      SELECT *
      FROM cigars
      WHERE collection = 'cavaro' AND quantity > 0
      ORDER BY date_added DESC, id DESC
    `),
  ]);

  if (!inventory?.length) return null;

  if (!entries.length) {
    const cigar = inventory[0];
    return {
      cigar,
      score: null,
      level: null,
      reason: 'Recently added to your humidor and ready to smoke.',
      reasons: ['Recently added to your humidor'],
    };
  }

  const journalCigars = await db.getAllAsync(`
    SELECT DISTINCT c.*
    FROM cigars c
    INNER JOIN smoke_journal_entries j ON j.cigar_id = c.id
  `);

  const cigarById = new Map();
  for (const cigar of [...journalCigars, ...inventory]) {
    cigarById.set(String(cigar.id), cigar);
  }

  const profile = getTasteProfile(entries, [...cigarById.values()]);
  const confidence = getProfileConfidence(entries);

  const ranked = inventory
    .map((cigar) => ({
      cigar,
      ...getCigarMatch(cigar, profile, entries, confidence),
    }))
    .filter((item) => item.level !== 'Unlikely Match')
    .sort((a, b) => b.score - a.score);

  const top = ranked[0] ?? {
    cigar: inventory[0],
    score: null,
    level: null,
    reasons: [],
  };

  return {
    cigar: top.cigar,
    score: top.score,
    level: top.level,
    reason: buildReason(top),
    reasons: top.reasons ?? [],
  };
}
