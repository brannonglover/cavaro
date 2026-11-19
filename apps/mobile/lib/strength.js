/**
 * Computes overall strength (1-5) from strength_profile JSON.
 */
export function getOverallStrength(strengthProfileJson) {
  if (!strengthProfileJson?.trim()) return 0;
  try {
    const parsed = JSON.parse(strengthProfileJson);
    const thirds = parsed.thirds ?? [];
    const values = thirds.slice(0, 3).map((t) => t.strength ?? 0).filter((v) => v > 0);
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg);
  } catch {
    return 0;
  }
}

export function strengthNumberToLabel(strength) {
  if (!strength) return null;
  if (strength <= 1) return 'Mild';
  if (strength === 2) return 'Medium';
  if (strength === 3) return 'Medium-Full';
  return 'Full';
}
