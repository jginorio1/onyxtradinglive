import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkoutForFollow, cancelFollowById } from '@/lib/copyFollow';
import { copyConfig } from '@/lib/copyScore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MODES = ['balance', 'multiplier', 'fixed', 'risk'];

// GET · mis copias (como seguidor) con datos del proveedor.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const { data: follows } = await supabaseAdmin.from('copy_follows')
      .select('id,provider_id,follower_account_id,lot_mode,lot_value,max_lot,max_drawdown_pct,require_sl,reverse,price_month,status,created_at')
      .eq('follower_id', user.id).order('created_at', { ascending: false });
    const provIds = Array.from(new Set((follows || []).map((f: any) => f.provider_id)));
    let provMap: Record<string, any> = {};
    if (provIds.length) {
      const { data: provs } = await supabaseAdmin.from('strategy_providers').select('id,display_name,tier,score,fee_month').in('id', provIds);
      (provs || []).forEach((p: any) => { provMap[p.id] = p; });
    }
    const out = (follows || []).map((f: any) => ({ ...f, provider: provMap[f.provider_id] || null }));
    return NextResponse.json({ ok: true, follows: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · empezar a copiar a un proveedor. Crea el follow (pending) y devuelve la
// URL de pago (Stripe). Al pagar, el webhook activa la copia y crea el enlace.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const providerId = String(b.provider_id || '').trim();
    const accountId = String(b.follower_account_id || '').trim();
    if (!providerId || !accountId) return NextResponse.json({ error: 'faltan datos', code: 'missing_data' }, { status: 400 });

    // Gating por plan (configurable en Admin → Onyx Copy). 'all' = cualquiera puede
    // copiar; 'copy' = solo planes con la capacidad de copy.
    const cfg: any = await copyConfig();
    if (cfg?.followGate === 'copy') {
      const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
      if (!((plan?.capabilities as any) || {}).copy) return NextResponse.json({ error: 'tu plan no permite copiar', code: 'plan_gate' }, { status: 403 });
    }

    // La cuenta esclava tiene que ser suya.
    const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', accountId).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'cuenta no encontrada', code: 'not_found' }, { status: 404 });

    // El proveedor tiene que existir, estar listado y ser cobrable.
    const { data: prov } = await supabaseAdmin.from('strategy_providers').select('id,user_id,display_name,fee_month,listed,status').eq('id', providerId).maybeSingle();
    if (!prov || !(prov as any).listed || (prov as any).status !== 'active') return NextResponse.json({ error: 'trader no disponible', code: 'not_found' }, { status: 404 });
    if ((prov as any).user_id === user.id) return NextResponse.json({ error: 'no puedes copiarte a ti mismo', code: 'self' }, { status: 400 });

    // Una cuenta = un trader. Si esta cuenta ya copia a OTRO trader activo/pendiente,
    // se bloquea (para no apilar estrategias ni sobre-apalancar). Debe dejar de copiar
    // al actual antes de conectarla a otro.
    const { data: busy } = await supabaseAdmin.from('copy_follows')
      .select('provider_id,status').eq('follower_account_id', accountId)
      .in('status', ['active', 'pending', 'past_due']).neq('provider_id', providerId).limit(1);
    if (busy && busy.length) {
      const { data: other } = await supabaseAdmin.from('strategy_providers').select('display_name').eq('id', (busy[0] as any).provider_id).maybeSingle();
      return NextResponse.json({ error: 'cuenta ocupada', code: 'account_busy', busyWith: (other as any)?.display_name || '—' }, { status: 409 });
    }

    // Precio y cuenta Connect del proveedor.
    const price = Number((prov as any).fee_month) || 0;
    const { data: provProf } = await supabaseAdmin.from('profiles').select('copy_stripe_account_id,copy_charges_enabled').eq('id', (prov as any).user_id).maybeSingle();
    const providerAccount = (provProf as any)?.copy_stripe_account_id;
    if (!price || !providerAccount || !(provProf as any)?.copy_charges_enabled) {
      return NextResponse.json({ error: 'este trader aún no tiene el cobro activado', code: 'not_payable' }, { status: 409 });
    }

    const lotMode = MODES.includes(b.lot_mode) ? b.lot_mode : 'balance';
    const row: any = {
      follower_id: user.id, provider_id: providerId, follower_account_id: accountId,
      lot_mode: lotMode, lot_value: Math.max(0.01, Number(b.lot_value) || 1),
      max_lot: Math.max(0.01, Number(b.max_lot) || 5),
      max_drawdown_pct: Math.max(0, Number(b.max_drawdown_pct) || 0),
      require_sl: !!b.require_sl, reverse: !!b.reverse,
      price_month: price, status: 'pending', updated_at: new Date().toISOString(),
    };
    const { data: follow, error } = await supabaseAdmin.from('copy_follows').upsert(row, { onConflict: 'follower_account_id,provider_id' }).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const session = await checkoutForFollow({
      followId: (follow as any).id, providerId, followerId: user.id,
      providerAccount, priceCents: Math.round(price * 100), customerEmail: user.email || undefined,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// PATCH · el seguidor ajusta sus controles de riesgo (se reflejan en el enlace).
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '').trim();
    if (!id) return NextResponse.json({ error: 'falta id', code: 'missing_data' }, { status: 400 });
    const { data: f } = await supabaseAdmin.from('copy_follows').select('*').eq('id', id).eq('follower_id', user.id).maybeSingle();
    if (!f) return NextResponse.json({ error: 'no encontrada', code: 'not_found' }, { status: 404 });
    const patch: any = { updated_at: new Date().toISOString() };
    if (b.lot_mode !== undefined && MODES.includes(b.lot_mode)) patch.lot_mode = b.lot_mode;
    if (b.lot_value !== undefined) patch.lot_value = Math.max(0.01, Number(b.lot_value) || 1);
    if (b.max_lot !== undefined) patch.max_lot = Math.max(0.01, Number(b.max_lot) || 5);
    if (b.max_drawdown_pct !== undefined) patch.max_drawdown_pct = Math.max(0, Number(b.max_drawdown_pct) || 0);
    if (b.require_sl !== undefined) patch.require_sl = !!b.require_sl;
    if (b.reverse !== undefined) patch.reverse = !!b.reverse;
    await supabaseAdmin.from('copy_follows').update(patch).eq('id', id);
    // Si está activa, reflejar en el copy_links.
    if ((f as any).status === 'active' && (f as any).link_id) {
      const lot_mode = patch.lot_mode ?? (f as any).lot_mode;
      const lot_value = patch.lot_value ?? (f as any).lot_value;
      const mode = lot_mode === 'fixed' ? 'fixed' : lot_mode === 'risk' ? 'risk' : 'balance';
      const multiplier = (lot_mode === 'multiplier' || lot_mode === 'fixed') ? Math.max(0.01, Number(lot_value) || 1) : 1;
      const risk_pct = lot_mode === 'risk' ? Math.max(0.1, Number(lot_value) || 1) : 1;
      await supabaseAdmin.from('copy_links').update({
        mode, multiplier, risk_pct,
        max_lot: patch.max_lot ?? (f as any).max_lot,
        reverse: patch.reverse ?? (f as any).reverse,
        max_drawdown_pct: patch.max_drawdown_pct ?? (f as any).max_drawdown_pct,
        require_sl: patch.require_sl ?? (f as any).require_sl,
      }).eq('id', (f as any).link_id);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// DELETE · el seguidor deja de copiar (cancela suscripción + para la copia).
export async function DELETE(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const id = String(new URL(req.url).searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'falta id', code: 'missing_data' }, { status: 400 });
    const r = await cancelFollowById(id, user.id);
    if (!r.ok) return NextResponse.json({ error: 'no encontrada', code: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
