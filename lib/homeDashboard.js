import { db, getHumidors } from '../db';
import { getCellaredItemsWithProgress } from './cellaring';
import { syncCatalogCache } from './catalogSync';
import { getCigarDisplayAssets } from './cigarImage';
import { getSmokeRecommendation } from './smokeRecommendation';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export async function getHomeDashboard() {
  await syncCatalogCache();

  const [inventoryRow, smokedRow, brandsRow, cellaredItems, humidors, smokeRecommendation] = await Promise.all([
    db.getFirstAsync(`
      SELECT COALESCE(SUM(quantity), 0) as n
      FROM cigars
      WHERE collection = 'cavaro' AND quantity > 0
    `),
    db.getFirstAsync('SELECT COUNT(*) as n FROM smoke_journal_entries'),
    db.getFirstAsync(`
      SELECT COUNT(DISTINCT brand) as n
      FROM cigars
      WHERE COALESCE(brand, '') != ''
        AND (
          (collection = 'cavaro' AND quantity > 0)
          OR id IN (SELECT DISTINCT cigar_id FROM smoke_journal_entries)
        )
    `),
    getCellaredItemsWithProgress(),
    getHumidors(),
    getSmokeRecommendation(),
  ]);

  const inventoryCount = inventoryRow?.n ?? 0;
  const smokedCount = smokedRow?.n ?? 0;
  const brandCount = brandsRow?.n ?? 0;
  const cellaredCount = cellaredItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  const readyFromCellar = cellaredItems
    .slice()
    .sort((a, b) => {
      if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
      return a.monthsRemaining - b.monthsRemaining;
    })
    .slice(0, 5);

  const cellaringInProgress = cellaredItems.filter((item) => !item.isReady);

  let enrichedSmokeRecommendation = smokeRecommendation;
  if (smokeRecommendation?.cigar) {
    const displayAssets = await getCigarDisplayAssets(smokeRecommendation.cigar);
    enrichedSmokeRecommendation = {
      ...smokeRecommendation,
      resolvedImage: displayAssets.imageUrl,
      displayWrapper: displayAssets.wrapper,
    };
  }

  return {
    greeting: getGreeting(),
    inventoryCount,
    cellaredCount,
    smokedCount,
    brandCount,
    humidors: humidors ?? [],
    readyFromCellar,
    cellaringInProgress,
    smokeRecommendation: enrichedSmokeRecommendation,
    isEmpty: inventoryCount === 0 && cellaredCount === 0 && smokedCount === 0,
  };
}
