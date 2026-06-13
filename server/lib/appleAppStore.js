const crypto = require('crypto');
const { AppStoreServerAPIClient, Environment, Status } = require('@apple/app-store-server-library');

const P8_HEADER = '-----BEGIN PRIVATE KEY-----';
const P8_FOOTER = '-----END PRIVATE KEY-----';

function decodeJwsPayload(jws) {
  if (!jws || typeof jws !== 'string') return null;
  const parts = jws.split('.');
  if (parts.length < 2) return null;
  const json = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(json);
}

function getBundleId() {
  return process.env.APP_STORE_BUNDLE_ID || 'com.brannonglover.cavaro';
}

function getPremiumProductId() {
  return process.env.APP_STORE_PREMIUM_PRODUCT_ID || 'com.gloverlabs.cavaro.monthly_premium';
}

function getEnvironment() {
  return process.env.APP_STORE_ENV === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
}

/**
 * App Store Server API client (JWT auth). Requires .p8 key in APP_STORE_PRIVATE_KEY.
 */
function normalizeP8Key(raw) {
  if (!raw?.trim()) return null;
  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\n/g, '\n');

  if (!key.includes(P8_HEADER)) {
    try {
      const decoded = Buffer.from(key.replace(/\s/g, ''), 'base64').toString('utf8');
      if (decoded.includes(P8_HEADER)) {
        key = decoded.replace(/\\n/g, '\n');
      } else {
        const compact = key.replace(/\s/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 100) {
          const body = compact.match(/.{1,64}/g)?.join('\n') || compact;
          key = `${P8_HEADER}\n${body}\n${P8_FOOTER}`;
        }
      }
    } catch {
      /* keep original */
    }
  }

  return key.trim();
}

function validateP8Key(key) {
  if (!key) {
    return { ok: false, error: 'APP_STORE_PRIVATE_KEY is not set' };
  }
  if (!key.includes(P8_HEADER) || !key.includes(P8_FOOTER)) {
    return {
      ok: false,
      error:
        'APP_STORE_PRIVATE_KEY must be the full .p8 PEM from App Store Connect (including BEGIN/END lines)',
    };
  }
  const body = key.replace(P8_HEADER, '').replace(P8_FOOTER, '').replace(/\s/g, '');
  if (body.length < 100) {
    return {
      ok: false,
      error:
        'APP_STORE_PRIVATE_KEY looks truncated. Paste the entire .p8 file contents, not just the header line.',
    };
  }
  try {
    crypto.createPrivateKey({ key, format: 'pem', type: 'pkcs8' });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: `APP_STORE_PRIVATE_KEY is invalid for ES256: ${e.message}`,
    };
  }
}

function getNormalizedP8Key() {
  return normalizeP8Key(process.env.APP_STORE_PRIVATE_KEY);
}

function getIapConfigIssues() {
  const issues = [];
  if (!process.env.APP_STORE_PRIVATE_KEY) issues.push('APP_STORE_PRIVATE_KEY');
  if (!process.env.APP_STORE_KEY_ID) issues.push('APP_STORE_KEY_ID');
  if (!process.env.APP_STORE_ISSUER_ID) issues.push('APP_STORE_ISSUER_ID');
  if (process.env.APP_STORE_PRIVATE_KEY) {
    const validation = validateP8Key(getNormalizedP8Key());
    if (!validation.ok) issues.push(validation.error);
  }
  return issues;
}

function createApiClient() {
  const key = getNormalizedP8Key();
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const bundleId = getBundleId();
  if (!key || !keyId || !issuerId) return null;

  const validation = validateP8Key(key);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return new AppStoreServerAPIClient(key, keyId, issuerId, bundleId, getEnvironment());
}

function iapConfigured() {
  return getIapConfigIssues().length === 0;
}

function formatAppleApiError(err) {
  const msg = err?.message || String(err);
  if (/asymmetric key|ES256|invalid for ES256|truncated|must be the full/i.test(msg)) {
    return `${msg}. Download a fresh In-App Purchase key (.p8) from App Store Connect → Users and Access → Integrations → In-App Purchase, set APP_STORE_PRIVATE_KEY in server/.env (use \\n for newlines on one line), then restart the server.`;
  }
  return msg;
}

/**
 * Fetches signed transaction from Apple and returns decoded JWSTransaction payload.
 * Trust boundary: response is from Apple's authenticated API.
 */
async function getTransactionFromApple(transactionId) {
  const client = createApiClient();
  if (!client) throw new Error('App Store API not configured');
  const res = await client.getTransactionInfo(transactionId);
  if (!res?.signedTransactionInfo) throw new Error('No transaction data from Apple');
  const tx = decodeJwsPayload(res.signedTransactionInfo);
  if (!tx) throw new Error('Invalid transaction data');
  return { tx, client };
}

function assertTransactionMatchesUser(tx, userId) {
  const bundleId = getBundleId();
  const productId = getPremiumProductId();
  if (tx.bundleId && tx.bundleId !== bundleId) {
    throw new Error('Invalid app bundle for this purchase');
  }
  if (tx.productId !== productId) {
    throw new Error('Invalid subscription product');
  }
  if (tx.appAccountToken && tx.appAccountToken.toLowerCase() !== String(userId).toLowerCase()) {
    throw new Error('This Apple subscription is linked to a different Cavaro account');
  }
  if (tx.revocationDate) {
    throw new Error('This purchase was revoked');
  }
  const expires = tx.expiresDate;
  if (expires && expires < Date.now()) {
    throw new Error('Subscription has expired');
  }
}

/**
 * Reconcile tier with Apple using stored original transaction id (renewals, expiry).
 */
async function syncSubscriptionTierFromApple(pool, userId) {
  const client = createApiClient();
  if (!client) return null;

  const { rows } = await pool.query(
    'SELECT tier, apple_original_transaction_id FROM user_profiles WHERE id = $1',
    [userId]
  );
  const row = rows[0];
  if (!row?.apple_original_transaction_id) {
    return row?.tier === 'premium' ? 'premium' : 'free';
  }

  const otid = row.apple_original_transaction_id;

  try {
    const status = await client.getAllSubscriptionStatuses(otid);
    const last = status?.data?.[0]?.lastTransactions?.[0];
    if (!last) {
      await pool.query("UPDATE user_profiles SET tier = 'free', updated_at = NOW() WHERE id = $1", [userId]);
      return 'free';
    }
    const st = last.status;
    const active = st === Status.ACTIVE || st === 1;
    if (active) {
      await pool.query("UPDATE user_profiles SET tier = 'premium', updated_at = NOW() WHERE id = $1", [userId]);
      return 'premium';
    }
    await pool.query("UPDATE user_profiles SET tier = 'free', updated_at = NOW() WHERE id = $1", [userId]);
    return 'free';
  } catch (e) {
    console.error('Apple getAllSubscriptionStatuses error:', e);
    return row.tier === 'premium' ? 'premium' : 'free';
  }
}

module.exports = {
  decodeJwsPayload,
  getBundleId,
  getPremiumProductId,
  getEnvironment,
  normalizeP8Key,
  validateP8Key,
  getIapConfigIssues,
  createApiClient,
  iapConfigured,
  formatAppleApiError,
  getTransactionFromApple,
  assertTransactionMatchesUser,
  syncSubscriptionTierFromApple,
};
