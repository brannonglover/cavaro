import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminSession } from '@/lib/admin-auth';

async function requireAdmin() {
  const ok = await verifyAdminSession();
  if (!ok) {
    throw new Error('Unauthorized');
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand')?.trim();
    const name = searchParams.get('name')?.trim();
    const line = searchParams.get('line')?.trim();

    if (!brand || !name) {
      return NextResponse.json({ error: 'brand and name required' }, { status: 400 });
    }

    // If line is provided, prefer exact match on brand+name+line
    if (line) {
      const { data: exactData, error: exactError } = await getSupabaseAdmin()
        .from('cigar_catalog')
        .select('id, brand, name, description, line, wrapper, binder, filler, length, image')
        .ilike('brand', brand)
        .ilike('name', name)
        .ilike('line', line)
        .not('description', 'is', null)
        .limit(1)
        .maybeSingle();

      if (exactError) throw exactError;
      if (exactData?.description?.trim()) {
        return NextResponse.json(exactData);
      }
    }

    // Fall back to brand+name only (line may be empty or no match with line)
    const { data, error } = await getSupabaseAdmin()
      .from('cigar_catalog')
      .select('id, brand, name, description, line, wrapper, binder, filler, length, image')
      .ilike('brand', brand)
      .ilike('name', name)
      .not('description', 'is', null)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.description?.trim()) {
      return NextResponse.json(null);
    }

    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cigar lookup error:', e);
    const detail =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: unknown }).message)
        : 'Failed to lookup cigar';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
