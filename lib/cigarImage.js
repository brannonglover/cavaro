import { db } from '../db';

/**
 * AI catalog filler from generateCatalogImages.js (PNG lifestyle shots in catalog/).
 * Brand imports store real product photos as JPEGs.
 */
/**
 * AI lifestyle filler shots live at catalog/*.png.
 * Manual product PNGs are stored under catalog/product/.
 */
export function isLikelyAiLifestyleImage(url) {
  const value = String(url || '').toLowerCase();
  if (!value.includes('/catalog/')) return false;
  if (value.includes('/catalog/product/')) return false;
  return value.includes('.png');
}

export function productImageUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed || isLikelyAiLifestyleImage(trimmed)) return null;
  return trimmed;
}

/**
 * Priority: user photo → official brand product photo → null (wrapper fallback).
 * AI lifestyle catalog images are never shown as the cigar.
 */
export function resolveCigarImageUrl(cigar, catalogImage = null) {
  const rawOwn = cigar?.image?.trim() || null;
  if (rawOwn && !rawOwn.toLowerCase().includes('/catalog/')) return rawOwn;

  const rawCatalog = catalogImage?.trim() || cigar?.catalogImage?.trim() || null;
  return productImageUrl(rawCatalog) || productImageUrl(rawOwn) || null;
}

/**
 * Looks up catalog metadata for a cigar (brand + name, preferring matching vitola).
 */
export async function getCatalogMatchForCigar(cigar) {
  const brand = cigar?.brand?.trim();
  const name = cigar?.name?.trim();
  if (!brand || !name) return null;

  const length = cigar?.length?.trim() ?? '';
  const rows = await db.getAllAsync(
    `SELECT image, wrapper, length FROM cigar_catalog
     WHERE brand = ? AND name = ?`,
    brand,
    name
  ) ?? [];
  if (!rows.length) return null;

  const withProductImage = rows.filter((row) => productImageUrl(row.image));
  const exact = length
    ? rows.find((row) => (row.length || '').trim() === length)
    : null;
  const exactProduct = length
    ? withProductImage.find((row) => (row.length || '').trim() === length)
    : null;
  const chosen = exactProduct || withProductImage[0] || exact || rows[0];

  return {
    image: chosen.image,
    wrapper: exact?.wrapper || chosen.wrapper,
  };
}

/**
 * Looks up a catalog image for a cigar (brand + name, preferring matching vitola).
 */
export async function getCatalogImageForCigar(cigar) {
  const match = await getCatalogMatchForCigar(cigar);
  const image = match?.image?.trim();
  return image || null;
}

/**
 * Resolves the best available image URL for display.
 */
export async function getResolvedCigarImageUrl(cigar) {
  const catalogImage = await getCatalogImageForCigar(cigar);
  return resolveCigarImageUrl(cigar, catalogImage);
}

/**
 * Wrapper for display fallbacks — user value first, then catalog.
 */
export async function getDisplayWrapperForCigar(cigar) {
  const userWrapper = cigar?.wrapper?.trim();
  if (userWrapper) return userWrapper;

  const match = await getCatalogMatchForCigar(cigar);
  return match?.wrapper?.trim() || null;
}

/**
 * Looks up full catalog metadata for detail views (description, blend, image).
 */
export async function getCatalogDetailsForCigar(cigar) {
  const brand = cigar?.brand?.trim();
  const name = cigar?.name?.trim();
  if (!brand || !name) return null;

  const length = cigar?.length?.trim() ?? '';

  if (length) {
    const exact = await db.getFirstAsync(
      `SELECT description, wrapper, binder, filler, length, image, line
       FROM cigar_catalog
       WHERE brand = ? AND name = ? AND length = ?
       LIMIT 1`,
      brand,
      name,
      length
    );
    if (exact) return exact;
  }

  return db.getFirstAsync(
    `SELECT description, wrapper, binder, filler, length, image, line
     FROM cigar_catalog
     WHERE brand = ? AND name = ?
     LIMIT 1`,
    brand,
    name
  );
}

/**
 * Resolves image URL and display wrapper in one catalog lookup.
 */
export async function getCigarDisplayAssets(cigar) {
  const match = await getCatalogMatchForCigar(cigar);
  return {
    imageUrl: resolveCigarImageUrl(cigar, match?.image),
    wrapper: cigar?.wrapper?.trim() || match?.wrapper?.trim() || null,
  };
}
