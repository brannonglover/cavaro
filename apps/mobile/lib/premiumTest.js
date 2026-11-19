const PREMIUM_TEST_EMAILS = ['brannonglover@gmail.com'];

export function emailFromAuthUser(user) {
  const direct = user?.email?.trim().toLowerCase();
  if (direct) return direct;
  const identityEmail = user?.identities
    ?.map((identity) => identity?.identity_data?.email)
    .find(Boolean);
  return String(identityEmail || '').trim().toLowerCase();
}

export function isPremiumTestUser(user) {
  const email = emailFromAuthUser(user);
  return Boolean(email && PREMIUM_TEST_EMAILS.includes(email));
}
