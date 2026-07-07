import { db } from '../db';

export const HUMIDOR_FILTER_ALL = null;

export const INVENTORY_SEGMENTS = {
  ALL: 'all',
  RECENT: 'recent',
  FAVORITES: 'favorites',
  CELLARED: 'cellared',
};

export const INVENTORY_SEGMENT_OPTIONS = [
  { id: INVENTORY_SEGMENTS.ALL, label: 'All Cigars' },
  { id: INVENTORY_SEGMENTS.RECENT, label: 'Recently Added' },
  { id: INVENTORY_SEGMENTS.FAVORITES, label: 'Favorites' },
  { id: INVENTORY_SEGMENTS.CELLARED, label: 'Cellared' },
];

function formatHumidity(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `${value}% RH`;
}

function formatTemperature(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `${value}°F`;
}

export function computeHumidorsOverview(humidors = []) {
  const humidorCount = humidors.length;
  const cigarCount = humidors.reduce((sum, humidor) => sum + (humidor.cigar_count ?? 0), 0);

  const humidityReadings = humidors
    .map((humidor) => Number(humidor.humidity))
    .filter((value) => !Number.isNaN(value));
  const temperatureReadings = humidors
    .map((humidor) => Number(humidor.temperature))
    .filter((value) => !Number.isNaN(value));

  const avgHumidity = humidityReadings.length
    ? Math.round(humidityReadings.reduce((sum, value) => sum + value, 0) / humidityReadings.length)
    : null;
  const avgTemperature = temperatureReadings.length
    ? Math.round(temperatureReadings.reduce((sum, value) => sum + value, 0) / temperatureReadings.length)
    : null;

  return {
    humidorCount,
    cigarCount,
    avgHumidity,
    avgTemperature,
  };
}

function formatHumidorMeta(humidor) {
  const count = humidor.cigar_count ?? 0;
  return [
    `${count} ${count === 1 ? 'Cigar' : 'Cigars'}`,
    formatHumidity(humidor.humidity),
    formatTemperature(humidor.temperature),
  ].filter(Boolean);
}

export function buildInventorySummary(humidors = [], selectedHumidorId = null) {
  if (humidors.length === 0) {
    return { title: 'Humidors', metaParts: [] };
  }

  if (humidors.length === 1) {
    const humidor = humidors[0];
    return {
      title: humidor.name,
      metaParts: formatHumidorMeta(humidor),
    };
  }

  if (selectedHumidorId == null) {
    const overview = computeHumidorsOverview(humidors);
    return {
      title: 'All Humidors',
      metaParts: [
        `${overview.cigarCount} Cigars`,
        `${overview.humidorCount} Humidors`,
        overview.avgHumidity != null ? `Avg. ${overview.avgHumidity}% RH` : null,
        overview.avgTemperature != null ? `Avg. ${overview.avgTemperature}°F` : null,
      ].filter(Boolean),
    };
  }

  const humidor = humidors.find((item) => item.id === selectedHumidorId) ?? humidors[0];
  return {
    title: humidor.name,
    metaParts: formatHumidorMeta(humidor),
  };
}

export async function loadCellaringByCigarId() {
  const rows = await db.getAllAsync(`
    SELECT ci.cigar_id, ci.quantity, ci.started_at, ci.target_months
    FROM cellared_items ci
  `);

  const map = {};
  for (const row of rows ?? []) {
    const key = String(row.cigar_id);
    if (!map[key]) map[key] = [];
    map[key].push(row);
  }
  return map;
}
