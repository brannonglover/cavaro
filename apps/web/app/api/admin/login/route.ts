import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession, getSessionCookieHeader } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
      return NextResponse.json({ error: 'Admin not configured' }, { status: 503 });
    }

    if (password !== expected) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const sessionValue = createAdminSession();
    const response = NextResponse.json({ ok: true });
    response.headers.set('Set-Cookie', getSessionCookieHeader(sessionValue));
    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
