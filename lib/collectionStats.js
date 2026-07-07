import { db } from '../db';
import { getCigarDisplayAssets } from './cigarImage';

function parseOrigins(text) {
  if (!text?.trim()) return [];
  return text
    .split(/[,;/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function buildMilestones({ totalSmoked, brandsTried, ratingsLogged, uniqueCigars }) {
  const definitions = [
    { id: 'first-smoke', label: 'First Cigar Logged', achieved: totalSmoked >= 1 },
    { id: '100-smoked', label: 'First 100 Cigars', achieved: totalSmoked >= 100 },
    { id: '25-brands', label: '25 Brands Tried', achieved: brandsTried >= 25 },
    { id: '100-ratings', label: '100 Ratings Logged', achieved: ratingsLogged >= 100 },
    { id: '50-unique', label: '50 Unique Cigars', achieved: uniqueCigars >= 50 },
  ];
  return definitions.filter((item) => item.achieved);
}

/**
 * Lifetime collection stats derived from journal entries (not current inventory).
 */
export async function getCollectionStats() {
  const totalRow = await db.getFirstAsync('SELECT COUNT(*) as n FROM smoke_journal_entries');
  const totalSmoked = totalRow?.n ?? 0;

  if (totalSmoked === 0) {
    return {
      isEmpty: true,
      totalSmoked: 0,
      uniqueCigars: 0,
      brandsTried: 0,
      countriesTried: 0,
      countries: [],
      ratingsLogged: 0,
      favoriteBrands: [],
      topRated: [],
      mostSmoked: [],
      wrapperBreakdown: [],
      milestones: [],
    };
  }

  const uniqueRow = await db.getFirstAsync(
    'SELECT COUNT(DISTINCT cigar_id) as n FROM smoke_journal_entries'
  );
  const brandsRow = await db.getFirstAsync(`
    SELECT COUNT(DISTINCT c.brand) as n
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
    WHERE COALESCE(c.brand, '') != ''
  `);
  const ratingsRow = await db.getFirstAsync(
    'SELECT COUNT(*) as n FROM smoke_journal_entries WHERE rating IS NOT NULL'
  );

  const favoriteBrands = await db.getAllAsync(`
    SELECT c.brand, COUNT(*) as smoke_count
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
    WHERE COALESCE(c.brand, '') != ''
    GROUP BY c.brand
    ORDER BY smoke_count DESC
    LIMIT 5
  `);

  const topRated = await db.getAllAsync(`
    SELECT c.id, c.brand, c.name, c.line, c.length, c.image, c.wrapper,
      MAX(j.rating) as best_rating,
      COUNT(j.id) as review_count
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
    WHERE j.rating IS NOT NULL
    GROUP BY c.id
    ORDER BY best_rating DESC, review_count DESC
    LIMIT 5
  `);

  const mostSmoked = await db.getAllAsync(`
    SELECT c.id, c.brand, c.name, c.line, c.length, c.image, c.wrapper,
      COUNT(j.id) as smoke_count
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
    GROUP BY c.id
    ORDER BY smoke_count DESC
    LIMIT 5
  `);

  const wrapperBreakdown = await db.getAllAsync(`
    SELECT c.wrapper, COUNT(*) as cnt
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
    WHERE COALESCE(c.wrapper, '') != ''
    GROUP BY c.wrapper
    ORDER BY cnt DESC
    LIMIT 8
  `);

  const fillerRows = await db.getAllAsync(`
    SELECT DISTINCT c.filler
    FROM smoke_journal_entries j
    JOIN cigars c ON c.id = j.cigar_id
    WHERE COALESCE(c.filler, '') != ''
  `);
  const countrySet = new Set();
  for (const row of fillerRows ?? []) {
    for (const origin of parseOrigins(row.filler)) {
      countrySet.add(origin);
    }
  }
  const countries = [...countrySet].sort((a, b) => a.localeCompare(b));

  const enrichCigar = async (cigar) => {
    const displayAssets = await getCigarDisplayAssets(cigar);
    return {
      ...cigar,
      resolvedImage: displayAssets.imageUrl,
      displayWrapper: displayAssets.wrapper,
    };
  };

  const [enrichedTopRated, enrichedMostSmoked] = await Promise.all([
    Promise.all((topRated ?? []).map(enrichCigar)),
    Promise.all((mostSmoked ?? []).map(enrichCigar)),
  ]);

  return {
    isEmpty: false,
    totalSmoked,
    uniqueCigars: uniqueRow?.n ?? 0,
    brandsTried: brandsRow?.n ?? 0,
    countriesTried: countries.length,
    countries,
    ratingsLogged: ratingsRow?.n ?? 0,
    favoriteBrands: favoriteBrands ?? [],
    topRated: enrichedTopRated,
    mostSmoked: enrichedMostSmoked,
    wrapperBreakdown: wrapperBreakdown ?? [],
    milestones: buildMilestones({
      totalSmoked,
      brandsTried: brandsRow?.n ?? 0,
      ratingsLogged: ratingsRow?.n ?? 0,
      uniqueCigars: uniqueRow?.n ?? 0,
    }),
  };
}
