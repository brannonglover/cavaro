import { db } from '../db';

/**
 * Priority: user photo → catalog / AI lifestyle image → null (gradient fallback).
 */
export function resolveCigarImageUrl(cigar, catalogImage = null) {
  const userImage = cigar?.image?.trim();
  if (userImage) return userImage;

  const catalog = catalogImage?.trim() || cigar?.catalogImage?.trim();
  if (catalog) return catalog;

  return null;
}

/**
 * Looks up catalog metadata for a cigar (brand + name, preferring matching vitola).
 */
export async function getCatalogMatchForCigar(cigar) {
  const brand = cigar?.brand?.trim();
  const name = cigar?.name?.trim();
  if (!brand || !name) return null;

  const length = cigar?.length?.trim() ?? '';

  if (length) {
    const exact = await db.getFirstAsync(
      `SELECT image, wrapper FROM cigar_catalog
       WHERE brand = ? AND name = ? AND length = ?
       LIMIT 1`,
      brand,
      name,
      length
    );
    if (exact) return exact;
  }

  return db.getFirstAsync(
    `SELECT image, wrapper FROM cigar_catalog
     WHERE brand = ? AND name = ?
     LIMIT 1`,
    brand,
    name
  );
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
 * Resolves image URL and display wrapper in one catalog lookup.
 */
export async function getCigarDisplayAssets(cigar) {
  const match = await getCatalogMatchForCigar(cigar);
  return {
    imageUrl: resolveCigarImageUrl(cigar, match?.image),
    wrapper: cigar?.wrapper?.trim() || match?.wrapper?.trim() || null,
  };
}
