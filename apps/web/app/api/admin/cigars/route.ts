import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminSession } from '@/lib/admin-auth';

async function requireAdmin() {
  const ok = await verifyAdminSession();
  if (!ok) {
    throw new Error('Unauthorized');
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await getSupabaseAdmin()
      .from('cigar_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cigars list error:', e);
    const detail =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: unknown }).message)
        : 'Failed to fetch cigars';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      brand,
      name,
      description,
      wrapper,
      binder,
      filler,
      length,
      image,
      line,
    } = body;

    const { data, error } = await getSupabaseAdmin()
      .from('cigar_catalog')
      .insert({
        brand: brand || null,
        name: name || null,
        description: description || null,
        wrapper: wrapper || null,
        binder: binder || null,
        filler: filler || null,
        length: length || null,
        image: image || null,
        line: line || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const errMsg = e instanceof Error ? e.message : String(e);
    if (
      errMsg.includes('cigar_catalog_brand_name_length_key') ||
      errMsg.includes('cigar_catalog_brand_name_line_length_key')
    ) {
      return NextResponse.json(
        {
          error:
            'A cigar with this brand, name, line, and length already exists. Use different values or edit the existing cigar instead.',
        },
        { status: 409 }
      );
    }
    console.error('Cigar create error:', e);
    return NextResponse.json({ error: 'Failed to create cigar' }, { status: 500 });
  }
}
