import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Catálogo de brókers/prop firms de TradeLocker — editable por el dueño.
// A diferencia de MatchTrader NO hay URL de API que buscar: TradeLocker usa un único
// endpoint (demo/live). Solo se guarda el "server" (el mismo que el trader usa para
// entrar a TradeLocker) + si es demo por defecto, si es prop y si permite copy.
const slug = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'server';

export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { data } = await supabaseAdmin.from('tl_servers').select('*').order('sort');
  return NextResponse.json({ servers: data || [] });
}

// POST · crear/editar. { code?, name, server, demo_default, is_prop, copy_allowed, enabled, sort }
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const name = String(b.name || '').trim();
  const server = String(b.server || '').trim();
  if (!name || !server) return NextResponse.json({ error: 'nombre y server requeridos', code: 'bad_input' }, { status: 400 });
  const code = String(b.code || slug(name));
  const row = {
    code, name, server,
    demo_default: !!b.demo_default,
    is_prop: !!b.is_prop, copy_allowed: b.copy_allowed == null ? true : !!b.copy_allowed,
    enabled: b.enabled == null ? true : !!b.enabled, sort: Number(b.sort) || 0,
  };
  await supabaseAdmin.from('tl_servers').upsert(row, { onConflict: 'code' });
  return NextResponse.json({ ok: true, code });
}

export async function DELETE(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (b.code) await supabaseAdmin.from('tl_servers').delete().eq('code', b.code);
  return NextResponse.json({ ok: true });
}
