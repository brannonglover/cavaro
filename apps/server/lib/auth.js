const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const DEFAULT_PREMIUM_TEST_EMAILS = ['brannonglover@gmail.com'];

function premiumTestEmails() {
  const extra = String(process.env.PREMIUM_TEST_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_PREMIUM_TEST_EMAILS, ...extra]);
}

function emailFromAuthUser(user) {
  const direct = user?.email?.trim().toLowerCase();
  if (direct) return direct;
  const identityEmail = user?.identities
    ?.map((identity) => identity?.identity_data?.email)
    .find(Boolean);
  return String(identityEmail || '').trim().toLowerCase();
}

function isPremiumTestUser(user) {
  const email = emailFromAuthUser(user);
  return Boolean(email && premiumTestEmails().has(email));
}

function effectiveTierForUser(user, storedTier) {
  if (isPremiumTestUser(user)) return 'premium';
  return storedTier === 'premium' ? 'premium' : 'free';
}

async function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

module.exports = {
  resolveUserId,
  supabase,
  isPremiumTestUser,
  effectiveTierForUser,
};
