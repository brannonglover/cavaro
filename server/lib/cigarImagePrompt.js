const WRAPPER_HINTS = [
  { match: /connecticut|shade/i, hint: 'Connecticut shade wrapper with light tan color' },
  { match: /maduro|oscuro|broadleaf/i, hint: 'dark maduro wrapper' },
  { match: /habano|corojo/i, hint: 'rich reddish-brown habano wrapper' },
  { match: /cameroon/i, hint: 'tooth Cameroon wrapper with medium brown tone' },
  { match: /sumatra/i, hint: 'smooth Sumatra wrapper with medium tan color' },
  { match: /mexican|san andr/i, hint: 'dark Mexican San Andrés wrapper' },
  { match: /nicaragua/i, hint: 'Nicaraguan wrapper with warm brown tone' },
];

function getWrapperHint(wrapper) {
  const value = wrapper?.trim() ?? '';
  if (!value) return 'premium cigar wrapper';

  for (const entry of WRAPPER_HINTS) {
    if (entry.match.test(value)) return entry.hint;
  }

  return `${value} cigar wrapper`;
}

/**
 * Builds a lifestyle prompt for AI catalog imagery (no logos or readable band text).
 */
function buildCigarLifestylePrompt({ brand, name, line, wrapper }) {
  const identity = [brand, line, name].filter(Boolean).join(' ');
  const wrapperHint = getWrapperHint(wrapper);

  return [
    `Premium cigar lifestyle photograph for "${identity}".`,
    `Single cigar with ${wrapperHint},`,
    'resting on dark mahogany surface, warm amber side lighting,',
    'shallow depth of field, subtle smoke wisps, moody cigar lounge atmosphere,',
    'cinematic composition with cigar positioned left of center,',
    'no text, no logos, no brand markings, no readable bands, photorealistic.',
  ].join(' ');
}

module.exports = {
  buildCigarLifestylePrompt,
  getWrapperHint,
};
