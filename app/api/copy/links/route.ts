import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { addonSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// "HH:MM" válido (24h) o null. Evita guardar basura en la franja horaria.
function cleanHHMM(v: any): string | null {
  const s = String(v || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}
// Devuelve capacidades del plan + esclavas extra compradas.
async function planCaps(userId: string) {
  const { data: p } = await supabaseAdmin.from('profiles').select('plan,extra_slaves').eq('id', userId).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', p?.plan || 'free').maybeSingle();
  const caps = (plan?.capabilities || {}) as any;
  const extra = Number(p?.extra_slaves) || 0;
  const base = Number(caps.copy_slaves) || 2;
  return { caps, extra, base, max: base + extra };
}

// GET · cuentas del trader + sus enlaces + si el plan incluye copy.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const pc = await planCaps(user.id);
  const s = await addonSettings();
  const { data: accounts } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,broker,balance').eq('user_id', user.id).order('login');
  const { data: links } = await supabaseAdmin.from('copy_links')
    .select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json({
    inPlan: !!pc.caps.copy,
    maxSlaves: pc.max, baseSlaves: pc.base, extraSlaves: pc.extra,
    addon: { enabled: !!s.extra_slave_enabled && !!s.extra_slave_price_id, price: s.extra_slave_price },
    accounts: accounts || [], links: links || [],
  });
}

// POST · crear o editar un enlace master→esclava.
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const pc = await planCaps(user.id);
  if (!pc.caps.copy) return NextResponse.json({ error: 'Tu plan no incluye copy trading.', code: 'no_plan' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const master = String(b.master_account_id || ''), slave = String(b.slave_account_id || '');
  if (!master || !slave || master === slave) return NextResponse.json({ error: 'Elige una master y una esclava distintas.' }, { status: 400 });

  // Ambas cuentas deben ser del usuario.
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', user.id).in('id', [master, slave]);
  if ((accs || []).length !== 2) return NextResponse.json({ error: 'Cuenta no válida.' }, { status: 400 });

  const patch: any = {
    owner_id: user.id, master_account_id: master, slave_account_id: slave,
    mode: ['balance', 'risk', 'pips', 'fixed'].includes(b.mode) ? b.mode : 'balance',
    multiplier: Math.max(0, Number(b.multiplier) || 1),
    risk_pct: Math.max(0, Number(b.risk_pct) || 1),
    pip_risk: Math.max(0, Number(b.pip_risk) || 20),
    max_lot: Math.max(0, Number(b.max_lot) || 50),
    reverse: !!b.reverse,
    symbol_map: (b.symbol_map && typeof b.symbol_map === 'object') ? b.symbol_map : {},
    enabled: b.enabled !== false,
    // Controles de riesgo (se configuran desde el tab, no en la EA):
    daily_loss_pct: Math.max(0, Number(b.daily_loss_pct) || 0),
    max_drawdown_pct: Math.max(0, Number(b.max_drawdown_pct) || 0),
    max_spread: Math.max(0, Number(b.max_spread) || 0),
    session_from: cleanHHMM(b.session_from),
    session_to: cleanHHMM(b.session_to),
    symbol_whitelist: Array.isArray(b.symbol_whitelist)
      ? b.symbol_whitelist.map((s: any) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 40)
      : [],
  };

  if (b.id) {
    await supabaseAdmin.from('copy_links').update(patch).eq('id', b.id).eq('owner_id', user.id);
    return NextResponse.json({ ok: true });
  }

  // Límite de esclavas del plan (base) + esclavas extra compradas (add-on).
  const { count } = await supabaseAdmin.from('copy_links').select('*', { count: 'exact', head: true }).eq('owner_id', user.id);
  if ((count || 0) >= pc.max) return NextResponse.json({ error: `Llegaste al máximo de ${pc.max} enlaces. Añade cuentas esclava extra como add-on.`, code: 'limit' }, { status: 403 });

  const { error } = await supabaseAdmin.from('copy_links').insert(patch);
  if (error) return NextResponse.json({ error: error.message.includes('duplicate') ? 'Ese enlace ya existe.' : 'No se pudo crear.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE · borrar un enlace.
export async function DELETE(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (id) await supabaseAdmin.from('copy_links').delete().eq('id', id).eq('owner_id', user.id);
  return NextResponse.json({ ok: true });
}
