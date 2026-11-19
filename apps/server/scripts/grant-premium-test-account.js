/**
 * Grant Premium to a test email in user_profiles (shared Postgres).
 * Usage: node scripts/grant-premium-test-account.js brannonglover@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const pool = require('../config/postgres');

const email = String(process.argv[2] || 'brannonglover@gmail.com').trim().toLowerCase();

async function findUserId() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    let page = 1;
    while (page <= 10) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const match = (data?.users ?? []).find((user) => user.email?.trim().toLowerCase() === email);
      if (match) return match.id;
      if (!data?.users?.length || data.users.length < 200) break;
      page += 1;
    }
  }

  const { rows } = await pool.query(
    'SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1',
    [email]
  );
  return rows[0]?.id ?? null;
}

async function main() {
  const userId = await findUserId();
  if (!userId) {
    console.error(`No Auth user found for ${email}`);
    process.exit(1);
  }

  const before = await pool.query(
    'SELECT id, tier, apple_original_transaction_id FROM user_profiles WHERE id = $1',
    [userId]
  );
  await pool.query(
    `INSERT INTO user_profiles (id, tier, apple_original_transaction_id, updated_at)
     VALUES ($1, 'premium', NULL, NOW())
     ON CONFLICT (id) DO UPDATE SET
       tier = 'premium',
       apple_original_transaction_id = NULL,
       updated_at = NOW()`,
    [userId]
  );
  const after = await pool.query(
    'SELECT id, tier, apple_original_transaction_id FROM user_profiles WHERE id = $1',
    [userId]
  );

  console.log(`Granted premium to ${email}`);
  console.log(`user_id: ${userId}`);
  console.log(`before: ${JSON.stringify(before.rows[0] || null)}`);
  console.log(`after: ${JSON.stringify(after.rows[0] || null)}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
