import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
    const { data, error } = await supabaseAdmin
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

    const updates: Record<string, unknown> = {};
    if (brand !== undefined) updates.brand = brand || null;
    if (name !== undefined) updates.name = name || null;
    if (description !== undefined) updates.description = description || null;
    if (wrapper !== undefined) updates.wrapper = wrapper || null;
    if (binder !== undefined) updates.binder = binder || null;
    if (filler !== undefined) updates.filler = filler || null;
    if (length !== undefined) updates.length = length || null;
    if (image !== undefined) updates.image = image || null;
    if (line !== undefined) updates.line = line || null;

    const { data, error } = await supabaseAdmin
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
    console.error('Cigar update error:', e);
    return NextResponse.json({ error: 'Failed to update cigar' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { error } = await supabaseAdmin
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
