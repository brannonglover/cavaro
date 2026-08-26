const HIT_PRIORITY = [
  'Flavor match',
  'Wrapper match',
  'Brand you enjoy',
  'Strength match',
  'Country match',
  'Vitola match',
  'Prior high rating',
  'Would buy again',
];

const MISS_PRIORITY = [
  'Disliked flavor overlap',
  'Repeated disliked notes',
  'Strength mismatch',
  'Wrapper not preferred',
  'Previously too strong',
  'Previously too mild',
  'Prior low rating',
  'Brand not preferred',
  'Country not preferred',
];

const HIT_PHRASE = {
  'Flavor match': 'flavors you like',
  'Wrapper match': 'a wrapper you like',
  'Brand you enjoy': 'a brand you already enjoy',
  'Strength match': 'body in your usual range',
  'Country match': 'an origin you like',
  'Vitola match': 'a size you tend to like',
  'Prior high rating': 'a cigar you have rated highly',
  'Would buy again': 'one you would buy again',
};

const MISS_PHRASE = {
  'Disliked flavor overlap': 'some notes you usually skip',
  'Repeated disliked notes': 'notes you have not liked before',
  'Strength mismatch': 'the body may be off',
  'Wrapper not preferred': 'a wrapper you usually skip',
  'Previously too strong': 'it has felt too strong before',
  'Previously too mild': 'it has felt too mild before',
  'Prior low rating': 'a lower rating from you',
  'Brand not preferred': 'a brand you have not liked',
  'Country not preferred': 'an origin you usually skip',
};

export const MATCH_REASON_COPY = {
  'Wrapper match': 'Uses a wrapper you tend to like',
  'Wrapper not preferred': 'The wrapper is one you usually skip',
  'Country match': 'Tobacco origin you usually enjoy',
  'Country not preferred': 'The origin is not usually your preference',
  'Vitola match': 'A size you tend to like',
  'Brand you enjoy': 'From a brand you already like',
  'Brand not preferred': 'From a brand you have not liked',
  'Strength match': 'Body is in your usual range',
  'Strength mismatch': 'Body may be off from what you like',
  'Flavor match': 'Has flavor notes you like',
  'Disliked flavor overlap': 'Has notes you have not liked',
  'Prior high rating': 'You rated this highly before',
  'Prior low rating': 'You rated this lower before',
  'Would buy again': 'You said you would buy it again',
  'Previously too mild': 'You found it too mild before',
  'Previously too strong': 'You found it too strong before',
  'Repeated disliked notes': 'Notes you dislike showed up again',
};

function pickFirst(reasons, priority) {
  return priority.find((reason) => reasons.includes(reason)) ?? null;
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function splitReasons(reasons = []) {
  const hits = reasons.filter((reason) => HIT_PHRASE[reason]);
  const misses = reasons.filter((reason) => MISS_PHRASE[reason]);
  return { hits, misses };
}

function mixedCopy(hits, misses, confidence) {
  const hit = pickFirst(hits, HIT_PRIORITY);
  const miss = pickFirst(misses, MISS_PRIORITY);

  if (hits.includes('Prior high rating') && misses.includes('Prior low rating')) {
    return {
      headline: "You've been split on this",
      detail: 'Your past ratings for this cigar do not agree yet.',
    };
  }

  if (confidence === 'low' && hits.length + misses.length < 2) {
    return {
      headline: 'Some overlap, not enough of your history yet',
      detail: 'A few more journal notes would make this ranking sharper.',
      weakSignal: true,
    };
  }

  if (hit && miss) {
    const headline = capitalize(`${HIT_PHRASE[hit]}, but ${MISS_PHRASE[miss]}`);
    return {
      headline,
      detail: `${MATCH_REASON_COPY[hit]}. ${MATCH_REASON_COPY[miss]}.`,
    };
  }

  if (hit) {
    return {
      headline: `Some overlap: ${HIT_PHRASE[hit]}`,
      detail: `${MATCH_REASON_COPY[hit]}, but not enough else lines up for a clear yes.`,
    };
  }

  if (miss) {
    return {
      headline: capitalize(MISS_PHRASE[miss]),
      detail: `${MATCH_REASON_COPY[miss]}. Not a write-off, just not a clear match.`,
    };
  }

  return {
    headline: 'No clear fit yet',
    detail: 'Cavaro does not have a strong signal yet for how this lines up with you.',
    weakSignal: true,
  };
}

/**
 * Turns a scored match into copy a user can understand.
 * Internal levels stay the same; Mixed Experience is never shown as the label.
 */
export function explainCigarMatch(match, confidence = 'low') {
  if (!match) return null;

  const { hits, misses } = splitReasons(match.reasons);
  const resolvedConfidence = match.confidence != null && match.confidence < 0.5 ? 'low' : confidence;

  if (match.level === 'Excellent Match') {
    const hit = pickFirst(hits, HIT_PRIORITY);
    return {
      headline: 'Strong match for you',
      detail: hit
        ? `${MATCH_REASON_COPY[hit]}. This lines up well with what you already enjoy.`
        : 'This lines up well with what you already enjoy.',
      tone: 'gold',
      level: match.level,
    };
  }

  if (match.level === 'Good Match') {
    const hit = pickFirst(hits, HIT_PRIORITY);
    return {
      headline: 'Likely your style',
      detail: hit
        ? `${MATCH_REASON_COPY[hit]}. A few more smokes would make this more certain.`
        : 'This is in the neighborhood of your palate.',
      tone: 'success',
      level: match.level,
    };
  }

  if (match.level === 'Needs Another Chance') {
    return {
      headline: 'Needs another chance',
      detail: 'Only one weaker smoke so far — not enough to write it off.',
      tone: 'muted',
      level: match.level,
    };
  }

  if (match.level === 'Unlikely Match') {
    const miss = pickFirst(misses, MISS_PRIORITY);
    return {
      headline: 'Probably not your profile',
      detail: miss
        ? `${MATCH_REASON_COPY[miss]}. Repeated signals say this is usually not your style.`
        : 'Repeated signals say this is usually not your style.',
      tone: 'danger',
      level: match.level,
    };
  }

  const mixed = mixedCopy(hits, misses, resolvedConfidence);
  return {
    ...mixed,
    weakSignal: Boolean(mixed.weakSignal),
    tone: resolvedConfidence === 'low' ? 'muted' : 'warning',
    level: match.level,
  };
}

export function humanizeMatchReason(reason) {
  return MATCH_REASON_COPY[reason] || reason;
}
