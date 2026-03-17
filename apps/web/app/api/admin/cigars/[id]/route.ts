import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { Database } from '@/types/supabase';
import { verifyAdminSession } from '@/lib/admin-auth';

async function requireAdmin() {
  const ok = await verifyAdminSession();
  if (!ok) {
    throw new Error('Unauthorized');
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin()
      .from('cigar_catalog')
      .select('*')
      .eq('id', parseInt(id, 10))
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cigar get error:', e);
    return NextResponse.json({ error: 'Failed to fetch cigar' }, { status: 500 });
  }
}

function toStr(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val || null;
  return String(val);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
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

    const updates: Database['public']['Tables']['cigar_catalog']['Update'] = {};
    if (brand !== undefined) updates.brand = toStr(brand);
    if (name !== undefined) updates.name = toStr(name);
    if (description !== undefined) updates.description = toStr(description);
    if (wrapper !== undefined) updates.wrapper = toStr(wrapper);
    if (binder !== undefined) updates.binder = toStr(binder);
    if (filler !== undefined) updates.filler = toStr(filler);
    if (length !== undefined) updates.length = toStr(length);
    if (image !== undefined) updates.image = toStr(image);
    if (line !== undefined) updates.line = toStr(line);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from('cigar_catalog')
      .update(updates)
      .eq('id', parseInt(id, 10))
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
            'A cigar with this brand, name, line, and length already exists. Change one of those fields or edit the existing cigar instead.',
        },
        { status: 409 }
      );
    }
    console.error('Cigar update error:', e);
    const payload: { error: string; detail?: string } = { error: 'Failed to update cigar' };
    if (e instanceof Error) {
      payload.detail = e.message;
    } else if (e && typeof e === 'object' && 'message' in e) {
      payload.detail = String((e as { message: unknown }).message);
    }
    return NextResponse.json(payload, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { error } = await getSupabaseAdmin()
      .from('cigar_catalog')
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cigar delete error:', e);
    return NextResponse.json({ error: 'Failed to delete cigar' }, { status: 500 });
  }
}
