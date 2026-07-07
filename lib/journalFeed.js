import { db } from '../db';
import { getJournalEntries } from '../db/journal';

/**
 * Journal entries enriched with cigar display fields for the Journal tab.
 */
export async function getJournalFeed(limit = 100) {
  const entries = await getJournalEntries({ limit });
  if (!entries.length) return [];

  const cigarIds = [...new Set(entries.map((entry) => entry.cigarId))];
  const placeholders = cigarIds.map(() => '?').join(',');
  const cigars = await db.getAllAsync(
    `SELECT id, name, brand, line, image FROM cigars WHERE id IN (${placeholders})`,
    ...cigarIds.map(Number)
  );
  const byId = Object.fromEntries((cigars ?? []).map((cigar) => [String(cigar.id), cigar]));

  return entries.map((entry) => {
    const cigar = byId[String(entry.cigarId)] ?? {};
    const displayTitle =
      [cigar.brand, cigar.name].filter(Boolean).join(' ') || 'Unknown cigar';

    return {
      ...entry,
      cigarName: cigar.name,
      cigarBrand: cigar.brand,
      cigarLine: cigar.line,
      cigarImage: cigar.image,
      displayTitle,
    };
  });
}
