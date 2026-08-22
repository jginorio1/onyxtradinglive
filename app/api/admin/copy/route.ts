import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';
import { DEFAULT_COPY_CONFIG, computeScoreForAccount, type CopyConfig } from '@/lib/copyScore';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const num = (v: any, d: number) => { const n = Number(v); return isFinite(n) ? n : d; };

// GET · configuración de calificación + todos los proveedores (para gestionar).
export async function GET() {
  const p = await requirePerm('ajustes', 'view');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const config = await getSetting<CopyConfig>('copy_config', DEFAULT_COPY_CONFIG);
    const { data: providers } = await supabaseAdmin.from('strategy_providers')
      .select('id,user_id,account_id,display_name,tier,score,pillars,stats,flags,followers,fee_month,perf_fee_pct,verified,listed,auto_delisted,status,scored_at')
      .order('score', { ascending: false }).limit(500);
    const fees = { subscription: Number(process.env.ONYX_COPY_FEE_PCT || 30) };
    return NextResponse.json({ ok: true, config, providers: providers || [], fees });
  } catch (e: any) {
    await logError('admin_copy_get', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · guardar la configuración de calificación (pesos, gates, ventana).
export async function POST(req: Request) {
  const p = await requirePerm('ajustes', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const c = b.config || {};
    const w = c.weights || {};
    const gate = (g: any, d: any) => ({
      score: Math.max(0, Math.min(100, num(g?.score, d.score))),
      trades: Math.max(0, Math.round(num(g?.trades, d.trades))),
      days: Math.max(0, Math.round(num(g?.days, d.days))),
      pf: Math.max(0, num(g?.pf, d.pf)),
      maxDD: Math.max(0, Math.min(100, num(g?.maxDD, d.maxDD))),
      verified: typeof g?.verified === 'boolean' ? g.verified : d.verified,
    });
    const config: CopyConfig = {
      weights: {
        discipline: Math.max(0, num(w.discipline, DEFAULT_COPY_CONFIG.weights.discipline)),
        risk: Math.max(0, num(w.risk, DEFAULT_COPY_CONFIG.weights.risk)),
        performance: Math.max(0, num(w.performance, DEFAULT_COPY_CONFIG.weights.performance)),
        consistency: Math.max(0, num(w.consistency, DEFAULT_COPY_CONFIG.weights.consistency)),
      },
      gates: {
        silver: gate(c.gates?.silver, DEFAULT_COPY_CONFIG.gates.silver),
        gold: gate(c.gates?.gold, DEFAULT_COPY_CONFIG.gates.gold),
        diamond: gate(c.gates?.diamond, DEFAULT_COPY_CONFIG.gates.diamond),
      },
      windowDays: Math.max(30, Math.min(730, Math.round(num(c.windowDays, DEFAULT_COPY_CONFIG.windowDays)))),
      feePct: Math.max(0, Math.min(95, num(c.feePct, DEFAULT_COPY_CONFIG.feePct as number))),
      perfEnabled: !!c.perfEnabled,
      followGate: c.followGate === 'copy' ? 'copy' : 'all',
    };
    await saveSetting('copy_config', config);
    await logAdmin('copy_config_save', {});
    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    await logError('admin_copy_post', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · gestionar un proveedor: verificar, listar/ocultar, quitar o recalcular.
export async function PATCH(req: Request) {
  const p = await requirePerm('ajustes', 'manage');
  if (!p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  try {
    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '').trim();
    if (!id) return NextResponse.json({ error: 'falta id', code: 'missing_data' }, { status: 400 });
    const { data: prov } = await supabaseAdmin.from('strategy_providers').select('id,user_id,account_id,verified').eq('id', id).maybeSingle();
    if (!prov) return NextResponse.json({ error: 'no encontrado', code: 'not_found' }, { status: 404 });

    if (b.action === 'recompute') {
      const res = await computeScoreForAccount((prov as any).user_id, (prov as any).account_id, { verified: !!(prov as any).verified });
      await supabaseAdmin.from('strategy_providers').update({ score: res.score, tier: res.tier, pillars: res.pillars, stats: res.stats, flags: res.flags, scored_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      await logAdmin('copy_provider_recompute', { id, tier: res.tier, score: res.score });
      return NextResponse.json({ ok: true, tier: res.tier, score: res.score });
    }

    const patch: any = { updated_at: new Date().toISOString() };
    if (b.verified !== undefined) {
      patch.verified = !!b.verified;
      // Recalcular al verificar (habilita Gold/Diamond).
      const res = await computeScoreForAccount((prov as any).user_id, (prov as any).account_id, { verified: !!b.verified });
      patch.tier = res.tier; patch.score = res.score; patch.pillars = res.pillars; patch.stats = res.stats; patch.flags = res.flags; patch.scored_at = new Date().toISOString();
    }
    if (b.listed !== undefined) { patch.listed = !!b.listed; if (b.listed) patch.auto_delisted = false; }
    if (b.status !== undefined && ['active', 'paused', 'removed'].includes(b.status)) patch.status = b.status;
    if (b.fee_month !== undefined) patch.fee_month = (b.fee_month === '' || b.fee_month == null) ? null : Math.max(0, Number(b.fee_month) || 0);
    if (b.perf_fee_pct !== undefined) patch.perf_fee_pct = Math.max(0, Math.min(30, Number(b.perf_fee_pct) || 0));
    await supabaseAdmin.from('strategy_providers').update(patch).eq('id', id);
    await logAdmin('copy_provider_manage', { id, ...b });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('admin_copy_patch', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
