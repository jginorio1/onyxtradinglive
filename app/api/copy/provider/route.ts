import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeScoreForAccount, copyConfig, qualifyToward, DEFAULT_COPY_CONFIG } from '@/lib/copyScore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · mis proveedores (cuentas que puse a calificar) + mis cuentas disponibles.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const [{ data: providers }, { data: accounts }] = await Promise.all([
      supabaseAdmin.from('strategy_providers').select('id,account_id,display_name,tier,score,pillars,stats,followers,fee_month,perf_fee_pct,flags,verified,listed,auto_delisted,status,scored_at').eq('user_id', user.id),
      supabaseAdmin.from('trading_accounts').select('id,nickname,broker,platform,last_sync_at').eq('user_id', user.id),
    ]);
    // Una cuenta está "conectada" si su EA reportó hace poco (últimos 15 min).
    // Si la desconectaste o revocaste la clave, deja de sincronizar → no conectada.
    const FRESH_MS = 15 * 60 * 1000;
    const nowMs = Date.now();
    const accs = (accounts || []).map((a: any) => ({ ...a, connected: !!a.last_sync_at && (nowMs - new Date(a.last_sync_at).getTime()) < FRESH_MS }));
    const cfg: any = await copyConfig().catch(() => ({}));
    const gates = cfg?.gates || DEFAULT_COPY_CONFIG.gates;
    // Adjunta la escalera de calificación (qué falta para el siguiente tier) a cada proveedor.
    const withQual = (providers || []).map((p: any) => {
      let qualify = null;
      try {
        if (p?.stats && typeof p.score === 'number') qualify = qualifyToward(p.score, p.stats, !!p.verified, p.tier || 'none', gates);
      } catch { qualify = null; }
      return { ...p, qualify };
    });
    return NextResponse.json({ ok: true, providers: withQual, accounts: accs, perfEnabled: !!cfg?.perfEnabled, feePct: Number(cfg?.feePct) >= 0 ? Number(cfg.feePct) : 30 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · postular/recalcular una cuenta en el ranking. body:
//   { account_id, display_name?, fee_month?, listed? }
// Calcula el Onyx Score y guarda/actualiza el proveedor. `verified` NO se puede
// activar desde aquí (lo aprueba el dueño): gate para Gold/Diamond.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const accountId = String(b.account_id || '').trim();
    if (!accountId) return NextResponse.json({ error: 'falta la cuenta', code: 'missing_data' }, { status: 400 });

    // La cuenta tiene que ser suya.
    const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id,nickname,broker,last_sync_at').eq('id', accountId).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'cuenta no encontrada', code: 'not_found' }, { status: 404 });
    // No se puede postular una cuenta desconectada (EA sin reportar / clave revocada).
    const lastSync = (acc as any).last_sync_at ? new Date((acc as any).last_sync_at).getTime() : 0;
    const connected = lastSync > 0 && (Date.now() - lastSync) < 15 * 60 * 1000;
    const { data: existingProv } = await supabaseAdmin.from('strategy_providers').select('id').eq('account_id', accountId).maybeSingle();
    if (!connected && !existingProv) {
      return NextResponse.json({ error: 'Conecta la cuenta antes de postularla al ranking.', code: 'not_connected' }, { status: 409 });
    }

    // Proveedor existente (para respetar verified/listed/fee ya guardados).
    const { data: existing } = await supabaseAdmin.from('strategy_providers').select('*').eq('account_id', accountId).maybeSingle();
    const verified = !!(existing as any)?.verified;

    const res = await computeScoreForAccount(user.id, accountId, { verified });
    const { data: prof } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const displayName = String(b.display_name || (existing as any)?.display_name || (prof as any)?.full_name || (acc as any).nickname || 'Onyx Trader').slice(0, 40);
    const feeMonth = b.fee_month === undefined ? (existing as any)?.fee_month ?? null : (b.fee_month === '' || b.fee_month == null ? null : Math.max(0, Math.min(999, Number(b.fee_month) || 0)));
    const listed = b.listed === undefined ? ((existing as any)?.listed ?? true) : !!b.listed;
    const cfg: any = await copyConfig().catch(() => ({}));
    let perfFee = b.perf_fee_pct === undefined ? ((existing as any)?.perf_fee_pct ?? 0) : Math.max(0, Math.min(30, Number(b.perf_fee_pct) || 0));
    if (!cfg?.perfEnabled) perfFee = 0;   // comisión por rendimiento desactivada globalmente

    const row: any = {
      user_id: user.id, account_id: accountId, display_name: displayName,
      score: res.score, tier: res.tier, pillars: res.pillars, stats: res.stats, flags: res.flags,
      fee_month: feeMonth, perf_fee_pct: perfFee, listed, status: (existing as any)?.status || 'active',
      scored_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabaseAdmin.from('strategy_providers').upsert(row, { onConflict: 'account_id' }).select('id,account_id,display_name,tier,score,pillars,stats,followers,fee_month,verified,listed,status,scored_at').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, provider: saved, reasons: res.reasons });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// PATCH · el trader pausa/lista o cambia el precio de su propio proveedor.
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado', code: 'no_auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '').trim();
    if (!id) return NextResponse.json({ error: 'falta id', code: 'missing_data' }, { status: 400 });
    const patch: any = { updated_at: new Date().toISOString() };
    if (b.listed !== undefined) patch.listed = !!b.listed;
    if (b.status !== undefined && ['active', 'paused', 'removed'].includes(b.status)) patch.status = b.status;
    if (b.fee_month !== undefined) patch.fee_month = (b.fee_month === '' || b.fee_month == null) ? null : Math.max(0, Math.min(999, Number(b.fee_month) || 0));
    if (b.display_name !== undefined) patch.display_name = String(b.display_name).slice(0, 40);
    const { error } = await supabaseAdmin.from('strategy_providers').update(patch).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
