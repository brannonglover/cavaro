import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function createAdminSession(): string {
  const secret = getSecret();
  if (!secret) throw new Error('ADMIN_PASSWORD is not set');
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
  return `${timestamp}.${hmac}`;
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [timestamp, hmac] = value.split('.');
  if (!timestamp || !hmac) return false;

  const age = Date.now() - parseInt(timestamp, 10);
  if (age > MAX_AGE * 1000) return false;

  const secret = getSecret();
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
}

export function getSessionCookieHeader(value: string): string {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function getClearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
