import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Catálogo de brókers/prop firms de DXtrade — editable por el dueño.
// DXtrade se despliega POR BRÓKER: cada uno tiene su propio HOST (donde entras a su
// plataforma web). Guardamos ese host + el dominio por defecto + si es demo/prop/copy.
const slug = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'server';
const cleanHost = (s: string) => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { data } = await supabaseAdmin.from('dx_servers').select('*').order('sort');
  return NextResponse.json({ servers: data || [] });
}

// POST · crear/editar. { code?, name, host, domain_default, demo_default, is_prop, copy_allowed, enabled, sort }
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const name = String(b.name || '').trim();
  const host = cleanHost(b.host);
  if (!name || !host) return NextResponse.json({ error: 'nombre y host requeridos', code: 'bad_input' }, { status: 400 });
  const code = String(b.code || slug(name));
  const row = {
    code, name, host, domain_default: String(b.domain_default || 'default').trim() || 'default',
    demo_default: !!b.demo_default,
    is_prop: !!b.is_prop, copy_allowed: b.copy_allowed == null ? true : !!b.copy_allowed,
    enabled: b.enabled == null ? true : !!b.enabled, sort: Number(b.sort) || 0,
  };
  await supabaseAdmin.from('dx_servers').upsert(row, { onConflict: 'code' });
  return NextResponse.json({ ok: true, code });
}

export async function DELETE(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (b.code) await supabaseAdmin.from('dx_servers').delete().eq('code', b.code);
  return NextResponse.json({ ok: true });
}
