import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = ['new', 'contacted', 'replied', 'joined', 'passed'];

// GET · pipeline de prospectos
export async function GET() {
  const p = await requirePerm('embajadores', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const { data } = await supabaseAdmin.from('ambassador_prospects').select('*').order('created_at', { ascending: false }).limit(500);
    return NextResponse.json({ prospects: data || [] });
  } catch (e: any) {
    await logError('amb_prospects_get', e);
    return NextResponse.json({ prospects: [] });
  }
}

// POST · añadir prospecto
export async function POST(req: Request) {
  const p = await requirePerm('embajadores', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!String(b.name || '').trim()) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
    const row = {
      name: String(b.name).slice(0, 120),
      platform: String(b.platform || 'youtube'),
      niche: String(b.niche || 'prop'),
      handle: b.handle ? String(b.handle).slice(0, 200) : null,
      email: b.email ? String(b.email).slice(0, 160) : null,
      note: b.note ? String(b.note).slice(0, 500) : null,
      status: 'new',
    };
    const { data, error } = await supabaseAdmin.from('ambassador_prospects').insert(row).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdmin(p.user?.email || '', 'ambassador_prospect_add', (data as any)?.id || '');
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    await logError('amb_prospects_post', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · mover de estado / editar
export async function PATCH(req: Request) {
  const p = await requirePerm('embajadores', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const patch: any = { updated_at: new Date().toISOString() };
    if (b.status && STATUSES.includes(b.status)) patch.status = b.status;
    if (b.note !== undefined) patch.note = String(b.note || '').slice(0, 500);
    for (const k of ['name', 'platform', 'niche', 'handle', 'email']) if (b[k] !== undefined) patch[k] = b[k] ? String(b[k]).slice(0, 200) : null;
    const { error } = await supabaseAdmin.from('ambassador_prospects').update(patch).eq('id', b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('amb_prospects_patch', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// DELETE · quitar prospecto
export async function DELETE(req: Request) {
  const p = await requirePerm('embajadores', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    await supabaseAdmin.from('ambassador_prospects').delete().eq('id', b.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('amb_prospects_del', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
