function capitalizeName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function firstToken(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] || null;
}

function nameFromEmail(email) {
  const local = String(email || '').split('@')[0]?.trim();
  if (!local) return null;

  const segment = local.split(/[._-]/)[0];
  return capitalizeName(segment);
}

export default function getUserFirstName(user) {
  if (!user) return null;

  const meta = user.user_metadata || {};
  const identityData = user.identities?.[0]?.identity_data || {};

  const candidates = [
    meta.first_name,
    meta.given_name,
    identityData.given_name,
    firstToken(meta.full_name),
    firstToken(meta.name),
    firstToken(identityData.full_name),
    firstToken(identityData.name),
    nameFromEmail(user.email),
  ];

  for (const candidate of candidates) {
    const name = capitalizeName(candidate);
    if (name) return name;
  }

  return null;
}
