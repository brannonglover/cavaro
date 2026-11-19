/**
 * Taste profile and match types
 * @see CAVARO_PRODUCT_SPEC.md §9
 */

/** @typedef {'Mild' | 'Medium' | 'Medium-Full' | 'Full'} CigarStrength */

/**
 * @typedef {Object} TasteProfile
 * @property {string[]} favoriteWrappers
 * @property {string[]} dislikedWrappers
 * @property {string[]} favoriteCountries
 * @property {string[]} dislikedCountries
 * @property {string[]} favoriteVitolas
 * @property {string[]} dislikedVitolas
 * @property {string[]} favoriteFlavors
 * @property {string[]} dislikedFlavors
 * @property {CigarStrength} [preferredStrength]
 * @property {CigarStrength} [leastPreferredStrength]
 * @property {string[]} favoriteBrands
 * @property {string[]} dislikedBrands
 */

/** @typedef {'Excellent Match' | 'Good Match' | 'Mixed Experience' | 'Needs Another Chance' | 'Unlikely Match'} MatchLevel */

/**
 * @typedef {Object} CigarMatch
 * @property {string} cigarId
 * @property {number} score
 * @property {MatchLevel} level
 * @property {number} confidence 0–1 confidence score
 * @property {string[]} reasons
 */

/** @typedef {'low' | 'medium' | 'high'} ProfileConfidence */

export const MATCH_LEVELS = [
  'Excellent Match',
  'Good Match',
  'Mixed Experience',
  'Needs Another Chance',
  'Unlikely Match',
];

/** Scoring weights from spec §9.3 */
export const SCORE_WEIGHTS = {
  wrapperMatch: 20,
  countryMatch: 15,
  strengthMatch: 15,
  flavorMatch: 25,
  brandAffinity: 15,
  priorHighRating: 20,
  wouldBuyAgain: 15,
  priorLowRating: -20,
  dislikedFlavorOverlap: -20,
  strengthMismatch: -15,
  vitolaMatch: 10,
};

export const POSITIVE_RATING_THRESHOLD = 75;
export const NEGATIVE_RATING_THRESHOLD = 60;

/**
 * @returns {TasteProfile}
 */
export function createEmptyTasteProfile() {
  return {
    favoriteWrappers: [],
    dislikedWrappers: [],
    favoriteCountries: [],
    dislikedCountries: [],
    favoriteVitolas: [],
    dislikedVitolas: [],
    favoriteFlavors: [],
    dislikedFlavors: [],
    preferredStrength: undefined,
    leastPreferredStrength: undefined,
    favoriteBrands: [],
    dislikedBrands: [],
  };
}

/**
 * @param {'low'|'medium'|'high'} confidence
 * @returns {number}
 */
export function confidenceToScore(confidence) {
  if (confidence === 'high') return 0.9;
  if (confidence === 'medium') return 0.6;
  return 0.3;
}
