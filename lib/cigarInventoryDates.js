/**
 * Formats date_added (YYYY-MM-DD) into a human-readable aging duration.
 * Returns null if date is missing or invalid.
 */
export function formatAgingDuration(dateAddedStr) {
  if (!dateAddedStr || !dateAddedStr.trim()) return null;
  const parts = dateAddedStr.trim().slice(0, 10).split('-').map(Number);
  if (parts.length !== 3) return null;
  const added = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(added.getTime())) return null;
  const now = new Date();
  const diffMs = now - added;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return null;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  if (diffDays < 14) return '1 week';
  if (diffDays < 31) return `${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 60) return '1 month';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  if (diffDays < 730) return '1 year';
  return `${Math.floor(diffDays / 365)} years`;
}

/** Parses YYYY-MM-DD as local date (new Date(str) treats it as UTC midnight, shifting day in western TZ). */
export function formatDateStringLocal(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim().slice(0, 10);
  const parts = s.split('-').map(Number);
  if (parts.length !== 3) return str;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? str : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatLastSmoked(cigar) {
  const raw = cigar.last_smoked?.trim() || cigar.smoked_date?.trim();
  if (!raw) return null;
  return formatDateStringLocal(raw) ?? raw;
}
