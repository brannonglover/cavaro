import { NextResponse } from 'next/server';
import { getClearCookieHeader } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', getClearCookieHeader());
  return response;
}
