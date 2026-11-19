/**
 * Taste profile and match scoring utilities
 * @see CAVARO_PRODUCT_SPEC.md §9
 */

import { getOverallStrength, strengthNumberToLabel } from './strength';
import {
  confidenceToScore,
  createEmptyTasteProfile,
  NEGATIVE_RATING_THRESHOLD,
  POSITIVE_RATING_THRESHOLD,
  SCORE_WEIGHTS,
} from '../models/tasteProfile';

export {
  createEmptyTasteProfile,
  MATCH_LEVELS,
  SCORE_WEIGHTS,
  NEGATIVE_RATING_THRESHOLD,
  POSITIVE_RATING_THRESHOLD,
  confidenceToScore,
} from '../models/tasteProfile';

function parseOrigins(text) {
  if (!text?.trim()) return [];
  return text
    .split(/[,;/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function increment(map, key, amount = 1) {
  if (!key?.trim()) return;
  const normalized = key.trim();
  map[normalized] = (map[normalized] || 0) + amount;
}

function topKeys(map, limit = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function normalizeScore(raw) {
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function cigarTextBlob(cigar) {
  return [cigar?.name, cigar?.brand, cigar?.wrapper, cigar?.binder, cigar?.filler, cigar?.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getCigarStrengthLabel(cigar) {
  if (cigar?.strength) return cigar.strength;
  return strengthNumberToLabel(getOverallStrength(cigar?.strength_profile));
}

/**
 * @param {import('../models/journal').SmokeJournalEntry[]} entries
 * @param {number|string} cigarId
 */
export function getCigarHistory(entries, cigarId) {
  return entries.filter((entry) => String(entry.cigarId) === String(cigarId));
}

/**
 * @param {import('../models/journal').SmokeJournalEntry[]} entries
 * @param {Object[]} cigars
 * @returns {import('../models/tasteProfile').TasteProfile}
 */
export function getTasteProfile(entries, cigars) {
  if (!entries?.length) return createEmptyTasteProfile();

  const cigarById = Object.fromEntries(cigars.map((c) => [String(c.id), c]));
  const posWrappers = {};
  const negWrappers = {};
  const posCountries = {};
  const negCountries = {};
  const posVitolas = {};
  const negVitolas = {};
  const flavorLikes = {};
  const flavorDislikes = {};
  const posBrands = {};
  const negBrands = {};

  let tooMild = 0;
  let tooStrong = 0;

  for (const entry of entries) {
    const cigar = cigarById[entry.cigarId];
    if (!cigar) continue;

    const positive =
      entry.rating >= POSITIVE_RATING_THRESHOLD || entry.wouldBuyAgain === true;
    const negative =
      (entry.rating != null && entry.rating < NEGATIVE_RATING_THRESHOLD) ||
      entry.wouldBuyAgain === false;

    if (positive) {
      increment(posWrappers, cigar.wrapper);
      increment(posBrands, cigar.brand);
      increment(posVitolas, cigar.length);
      for (const origin of parseOrigins(cigar.filler)) increment(posCountries, origin);
    }
    if (negative) {
      increment(negWrappers, cigar.wrapper);
      increment(negBrands, cigar.brand);
      increment(negVitolas, cigar.length);
      for (const origin of parseOrigins(cigar.filler)) increment(negCountries, origin);
    }

    for (const flavor of entry.likedFlavors ?? []) increment(flavorLikes, flavor);
    for (const flavor of entry.dislikedFlavors ?? []) increment(flavorDislikes, flavor);

    if (entry.strengthFeedback === 'Too Mild') tooMild += 1;
    if (entry.strengthFeedback === 'Too Strong') tooStrong += 1;
    if (entry.finish === 'Long' && positive) increment(flavorLikes, 'Long finish');
    if (entry.finish === 'Short' && negative) increment(flavorDislikes, 'Short finish');
    if (entry.strengthFeedback === 'Too Mild' && negative) increment(flavorDislikes, 'Mild body');
  }

  let preferredStrength;
  let leastPreferredStrength;
  if (tooMild > tooStrong) {
    preferredStrength = 'Medium-Full';
    leastPreferredStrength = 'Mild';
  } else if (tooStrong > tooMild) {
    preferredStrength = 'Mild';
    leastPreferredStrength = 'Full';
  }

  return {
    favoriteWrappers: topKeys(posWrappers, 3),
    dislikedWrappers: topKeys(negWrappers, 3),
    favoriteCountries: topKeys(posCountries, 3),
    dislikedCountries: topKeys(negCountries, 3),
    favoriteVitolas: topKeys(posVitolas, 3),
    dislikedVitolas: topKeys(negVitolas, 3),
    favoriteFlavors: topKeys(flavorLikes, 5),
    dislikedFlavors: topKeys(flavorDislikes, 5),
    preferredStrength,
    leastPreferredStrength,
    favoriteBrands: topKeys(posBrands, 3),
    dislikedBrands: topKeys(negBrands, 3),
  };
}

/**
 * @param {import('../models/journal').SmokeJournalEntry[]} entries
 * @returns {import('../models/tasteProfile').ProfileConfidence}
 */
export function getProfileConfidence(entries) {
  const count = entries.length;
  const withRating = entries.filter((entry) => entry.rating != null).length;
  const withFlavors = entries.filter(
    (entry) => (entry.likedFlavors?.length ?? 0) > 0 || (entry.dislikedFlavors?.length ?? 0) > 0
  ).length;
  const missingMetadata = entries.filter((entry) => {
    const cigarMissing =
      !entry.likedFlavors?.length &&
      !entry.dislikedFlavors?.length &&
      !entry.strengthFeedback &&
      entry.rating == null;
    return cigarMissing;
  }).length;

  if (count >= 20 && withRating >= 5 && withFlavors >= 3 && missingMetadata / count < 0.5) {
    return 'high';
  }
  if (count >= 5 && withRating >= 2) return 'medium';
  return 'low';
}

/**
 * @param {number} score
 * @param {import('../models/tasteProfile').ProfileConfidence} confidence
 * @param {import('../models/journal').SmokeJournalEntry[]} history
 * @returns {import('../models/tasteProfile').MatchLevel}
 */
export function getMatchLevel(score, confidence, history = []) {
  const ratings = history.map((entry) => entry.rating).filter((value) => value != null);
  const lowRatings = ratings.filter((value) => value < NEGATIVE_RATING_THRESHOLD);
  const ratingSpread =
    ratings.length > 1 ? Math.max(...ratings) - Math.min(...ratings) : 0;

  if (history.length === 1 && lowRatings.length === 1 && confidence === 'low') {
    return 'Needs Another Chance';
  }

  if (lowRatings.length >= 2 && confidence !== 'low') {
    return 'Unlikely Match';
  }

  if (history.length >= 2 && history.every((entry) => entry.wouldBuyAgain === false) && confidence !== 'low') {
    return 'Unlikely Match';
  }

  if (ratingSpread >= 25 && score >= 45 && score <= 69) {
    return 'Mixed Experience';
  }

  if (score >= 85 && confidence !== 'low') return 'Excellent Match';
  if (score >= 70 && confidence !== 'low') return 'Good Match';
  if (score >= 45 && score <= 69) return 'Mixed Experience';
  if (history.length === 1 && lowRatings.length === 1) return 'Needs Another Chance';

  return 'Mixed Experience';
}

/**
 * @param {Object} cigar
 * @param {import('../models/tasteProfile').TasteProfile} tasteProfile
 * @param {import('../models/journal').SmokeJournalEntry[]} entries
 */
export function getCigarMatchScore(cigar, tasteProfile, entries = []) {
  let raw = 50;
  const reasons = [];
  const cigarEntries = getCigarHistory(entries, cigar?.id);
  const textBlob = cigarTextBlob(cigar);
  const cigarStrength = getCigarStrengthLabel(cigar);

  if (cigar?.wrapper && tasteProfile.favoriteWrappers.includes(cigar.wrapper)) {
    raw += SCORE_WEIGHTS.wrapperMatch;
    reasons.push('Wrapper match');
  }
  if (cigar?.wrapper && tasteProfile.dislikedWrappers.includes(cigar.wrapper)) {
    raw -= SCORE_WEIGHTS.wrapperMatch;
    reasons.push('Wrapper not preferred');
  }

  const origins = parseOrigins(cigar?.filler);
  if (origins.some((origin) => tasteProfile.favoriteCountries.includes(origin))) {
    raw += SCORE_WEIGHTS.countryMatch;
    reasons.push('Country match');
  }
  if (origins.some((origin) => tasteProfile.dislikedCountries.includes(origin))) {
    raw -= SCORE_WEIGHTS.countryMatch;
    reasons.push('Country not preferred');
  }

  if (cigar?.length && tasteProfile.favoriteVitolas.includes(cigar.length)) {
    raw += SCORE_WEIGHTS.vitolaMatch;
    reasons.push('Vitola match');
  }

  if (cigar?.brand && tasteProfile.favoriteBrands.includes(cigar.brand)) {
    raw += SCORE_WEIGHTS.brandAffinity;
    reasons.push('Brand you enjoy');
  }
  if (cigar?.brand && tasteProfile.dislikedBrands.includes(cigar.brand)) {
    raw -= SCORE_WEIGHTS.brandAffinity;
    reasons.push('Brand not preferred');
  }

  if (
    tasteProfile.preferredStrength &&
    cigarStrength &&
    tasteProfile.preferredStrength === cigarStrength
  ) {
    raw += SCORE_WEIGHTS.strengthMatch;
    reasons.push('Strength match');
  }
  if (
    tasteProfile.leastPreferredStrength &&
    cigarStrength &&
    tasteProfile.leastPreferredStrength === cigarStrength
  ) {
    raw -= SCORE_WEIGHTS.strengthMismatch;
    reasons.push('Strength mismatch');
  }

  const likedFlavorHits = tasteProfile.favoriteFlavors.filter((flavor) =>
    textBlob.includes(flavor.toLowerCase())
  );
  if (likedFlavorHits.length > 0) {
    raw += SCORE_WEIGHTS.flavorMatch;
    reasons.push('Flavor match');
  }

  const dislikedFlavorHits = tasteProfile.dislikedFlavors.filter((flavor) =>
    textBlob.includes(flavor.toLowerCase())
  );
  if (dislikedFlavorHits.length > 0) {
    raw -= SCORE_WEIGHTS.dislikedFlavorOverlap;
    reasons.push('Disliked flavor overlap');
  }

  for (const entry of cigarEntries) {
    if (entry.rating >= POSITIVE_RATING_THRESHOLD) {
      raw += SCORE_WEIGHTS.priorHighRating;
      reasons.push('Prior high rating');
    }
    if (entry.rating != null && entry.rating < NEGATIVE_RATING_THRESHOLD) {
      raw -= SCORE_WEIGHTS.priorLowRating;
      reasons.push('Prior low rating');
    }
    if (entry.wouldBuyAgain === true) {
      raw += SCORE_WEIGHTS.wouldBuyAgain;
      reasons.push('Would buy again');
    }
    if (entry.strengthFeedback === 'Too Mild') {
      raw -= SCORE_WEIGHTS.strengthMismatch;
      reasons.push('Previously too mild');
    }
    if (entry.strengthFeedback === 'Too Strong') {
      raw -= SCORE_WEIGHTS.strengthMismatch;
      reasons.push('Previously too strong');
    }

    const entryDislikedOverlap = (entry.dislikedFlavors ?? []).filter((flavor) =>
      tasteProfile.dislikedFlavors.includes(flavor)
    );
    if (entryDislikedOverlap.length > 0) {
      raw -= SCORE_WEIGHTS.dislikedFlavorOverlap;
      reasons.push('Repeated disliked notes');
    }
  }

  return {
    score: normalizeScore(raw),
    reasons: [...new Set(reasons)],
  };
}

/**
 * @param {Object} cigar
 * @param {import('../models/tasteProfile').TasteProfile} tasteProfile
 * @param {import('../models/journal').SmokeJournalEntry[]} entries
 * @param {import('../models/tasteProfile').ProfileConfidence} [profileConfidence='low']
 * @returns {import('../models/tasteProfile').CigarMatch}
 */
export function getCigarMatch(cigar, tasteProfile, entries = [], profileConfidence = 'low') {
  const history = getCigarHistory(entries, cigar?.id);
  const { score, reasons } = getCigarMatchScore(cigar, tasteProfile, entries);
  const level = getMatchLevel(score, profileConfidence, history);

  return {
    cigarId: String(cigar?.id ?? `${cigar?.brand ?? 'unknown'}-${cigar?.name ?? 'cigar'}`),
    score,
    level,
    confidence: confidenceToScore(profileConfidence),
    reasons,
  };
}
