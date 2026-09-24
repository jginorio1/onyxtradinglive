import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mtpBrokerId, discoverBrokerApi } from '@/lib/matchtraderPlatform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;   // la autodetección prueba varios hosts

// Catálogo de brókers/prop firms MatchTrader (Platform API) — editable por el dueño.
// El trader luego elige uno de aquí y conecta con su email+contraseña.
const slug = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'broker';

export async function GET() {
  const { ok } = await requirePerm('modulos', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const { data } = await supabaseAdmin.from('mt_brokers').select('*').order('sort');
  return NextResponse.json({ brokers: data || [] });
}

// POST · crear/editar. { code?, name, base_url, is_prop, copy_allowed, enabled, sort }
// Si no hay code, se deriva del nombre. Verifica la URL leyendo platform-details.
export async function POST(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));

  // Autodetectar la URL de la Platform API a partir de un dominio o nombre.
  if (b.action === 'discover') {
    const res = await discoverBrokerApi(String(b.query || b.name || '').trim(), b.useAi !== false);
    return NextResponse.json(res);
  }

  const name = String(b.name || '').trim();
  const base_url = String(b.base_url || '').trim().replace(/\/$/, '');
  if (!name || !/^https?:\/\//.test(base_url)) return NextResponse.json({ error: 'nombre y URL válida requeridos', code: 'bad_input' }, { status: 400 });
  const code = String(b.code || slug(name));
  // Verifica que la Platform API responde (opcional, no bloquea si falla).
  let brokerId: string | null = null;
  try { brokerId = await mtpBrokerId(base_url); } catch {}
  const row = {
    code, name, base_url,
    is_prop: !!b.is_prop, copy_allowed: b.copy_allowed == null ? true : !!b.copy_allowed,
    enabled: b.enabled == null ? true : !!b.enabled, sort: Number(b.sort) || 0,
  };
  await supabaseAdmin.from('mt_brokers').upsert(row, { onConflict: 'code' });
  return NextResponse.json({ ok: true, code, reachable: brokerId != null, brokerId });
}

export async function DELETE(req: Request) {
  const { ok } = await requirePerm('modulos', 'manage');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (b.code) await supabaseAdmin.from('mt_brokers').delete().eq('code', b.code);
  return NextResponse.json({ ok: true });
}
