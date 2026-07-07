import { db } from '../db';

function parseDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function monthsBetween(startDateStr, endDate = new Date()) {
  const start = parseDate(startDateStr);
  if (!start) return 0;
  const end = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  return Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );
}

/**
 * @param {Object} item cellared_items row
 */
export function getCellaringProgress(item) {
  const targetMonths = Math.max(1, parseInt(item.target_months, 10) || 12);
  const currentMonths = monthsBetween(item.started_at);
  const progress = Math.min(1, currentMonths / targetMonths);
  const monthsRemaining = Math.max(0, targetMonths - currentMonths);
  const isReady = monthsRemaining === 0;

  let readyLabel;
  if (isReady) {
    readyLabel = 'Ready to smoke';
  } else if (monthsRemaining === 1) {
    readyLabel = 'Ready in 1 month';
  } else {
    readyLabel = `Ready in ${monthsRemaining} months`;
  }

  return {
    currentMonths,
    targetMonths,
    progress,
    monthsRemaining,
    isReady,
    readyLabel,
  };
}

function mapCellaredRow(row) {
  const progress = getCellaringProgress(row);
  return {
    id: row.id,
    cigarId: row.cigar_id,
    humidorId: row.humidor_id,
    quantity: row.quantity,
    startedAt: row.started_at,
    targetMonths: progress.targetMonths,
    notes: row.notes,
    brand: row.brand,
    name: row.name,
    line: row.line,
    image: row.image,
    ...progress,
  };
}

export async function getCellaredItemsWithProgress() {
  const rows = await db.getAllAsync(`
    SELECT ci.*, c.brand, c.name, c.line, c.image
    FROM cellared_items ci
    JOIN cigars c ON c.id = ci.cigar_id
    ORDER BY ci.started_at ASC, ci.id ASC
  `);
  return (rows ?? []).map(mapCellaredRow);
}

export async function getCellaredItemsForCigar(cigarId) {
  const rows = await db.getAllAsync(
    `
    SELECT ci.*, c.brand, c.name, c.line, c.image
    FROM cellared_items ci
    JOIN cigars c ON c.id = ci.cigar_id
    WHERE ci.cigar_id = ?
    ORDER BY ci.started_at ASC, ci.id ASC
    `,
    Number(cigarId)
  );
  return (rows ?? []).map(mapCellaredRow);
}

export async function getCellaredStickCount() {
  const row = await db.getFirstAsync(
    'SELECT COALESCE(SUM(quantity), 0) as n FROM cellared_items'
  );
  return row?.n ?? 0;
}

export async function getReadyFromCellar(limit = 5) {
  const items = await getCellaredItemsWithProgress();
  return items
    .slice()
    .sort((a, b) => {
      if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
      return a.monthsRemaining - b.monthsRemaining;
    })
    .slice(0, limit);
}
