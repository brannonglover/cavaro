const TASTE_PROFILE_SYNONYMS = [
  { label: 'Chocolate', terms: ['chocolate', 'cocoa', 'cacao'] },
  { label: 'Coffee', terms: ['coffee', 'espresso', 'mocha'] },
  { label: 'Cedar', terms: ['cedar'] },
  { label: 'Leather', terms: ['leather'] },
  { label: 'Earth', terms: ['earth', 'earthy', 'soil'] },
  { label: 'Pepper', terms: ['pepper', 'black pepper', 'white pepper'] },
  { label: 'Spice', terms: ['spice', 'spicy', 'cinnamon', 'nutmeg', 'clove'] },
  { label: 'Cream', terms: ['cream', 'creamy', 'butter'] },
  { label: 'Nuts', terms: ['nut', 'nuts', 'nutty', 'nuttiness', 'almond', 'walnut', 'hazelnut'] },
  { label: 'Vanilla', terms: ['vanilla'] },
  { label: 'Floral', terms: ['floral', 'flower', 'blossom'] },
  { label: 'Citrus', terms: ['citrus', 'orange', 'lemon', 'lime', 'grapefruit'] },
  { label: 'Fruit', terms: ['fruit', 'berry', 'dried fruit', 'raisin', 'fig', 'plum', 'cherry'] },
  { label: 'Wood', terms: ['wood', 'woody', 'oak', 'toast'] },
  { label: 'Sweet', terms: ['sweet', 'sweetness', 'honey', 'caramel', 'sugar', 'molasses', 'maple'] },
  { label: 'Hay', terms: ['hay', 'grass', 'grassy'] },
];

const STRENGTHS = [
  { label: 'Medium-Full', terms: ['medium-full', 'medium to full', 'medium/full', 'medium full'] },
  { label: 'Mild-Medium', terms: ['mild-medium', 'mild to medium', 'mild/medium', 'mild medium'] },
  { label: 'Full', terms: ['full-bodied', 'full bodied', 'full-body', 'full body', 'full-strength', 'full strength'] },
  { label: 'Medium', terms: ['medium-bodied', 'medium bodied', 'medium-body', 'medium body'] },
  { label: 'Mild', terms: ['mild-bodied', 'mild bodied', 'mild-body', 'mild body'] },
];

export const TASTE_PROFILE_FLAVORS = TASTE_PROFILE_SYNONYMS.map((entry) => entry.label);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTerm(blob, term) {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(blob);
}

export function parseStoredFlavors(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function canonicalLabelsFromKeywords(keywords = []) {
  const labels = new Set();
  for (const keyword of keywords) {
    const term = String(keyword).trim().toLowerCase();
    if (!term) continue;
    const match = TASTE_PROFILE_SYNONYMS.find(
      (entry) => entry.label.toLowerCase() === term || entry.terms.includes(term)
    );
    if (match) labels.add(match.label);
  }
  return [...labels];
}

export function extractTasteProfile(...parts) {
  const blob = parts.filter(Boolean).join(' ').toLowerCase();
  if (!blob.trim()) {
    return { flavors: [], strength: null };
  }

  const flavors = TASTE_PROFILE_SYNONYMS
    .filter((entry) => entry.terms.some((term) => hasTerm(blob, term)))
    .map((entry) => entry.label);

  let strength = null;
  for (const entry of STRENGTHS) {
    if (entry.terms.some((term) => hasTerm(blob, term))) {
      strength = entry.label;
      break;
    }
  }
  if (!strength) {
    if (hasTerm(blob, 'mild') || hasTerm(blob, 'mellow')) strength = 'Mild';
    else if (hasTerm(blob, 'full')) strength = 'Full';
    else if (hasTerm(blob, 'medium')) strength = 'Medium';
  }

  return { flavors: [...new Set(flavors)], strength };
}

export function serializeFlavors(flavors) {
  const unique = [...new Set(parseStoredFlavors(flavors))];
  return unique.length ? JSON.stringify(unique) : null;
}

export { TASTE_PROFILE_SYNONYMS };

