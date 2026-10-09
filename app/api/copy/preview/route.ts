import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { copyGuardForSlave, sizeScaleFromHeadroom } from '@/lib/copyGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Vista previa / replay de una copia (#9)
// Antes de activar (o para entender) una copia, muestra cómo se habría
// comportado con las ÚLTIMAS operaciones de su master: cuántas se habrían
// copiado vs filtrado, el tamaño que se aplicaría ahora (con el escalado del
// reto y el Guardián), y la latencia/slippage reales medidos. Solo lee datos
// que ya existen (copy_commands + copy_log); no manda ninguna orden.
// ============================================================
export async function GET(req: Request) {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });

  const linkId = new URL(req.url).searchParams.get('link') || '';
  if (!linkId) return NextResponse.json({ error: 'missing link' }, { status: 400 });

  const { data: link } = await supabaseAdmin.from('copy_links')
    .select('id,owner_id,slave_account_id,multiplier,mode,guard_prop_rules,guard_strict,size_by_challenge').eq('id', linkId).maybeSingle();
  if (!link || link.owner_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Últimos 20 comandos de apertura de esta copia.
  const { data: cmds } = await supabaseAdmin.from('copy_commands')
    .select('action,status,base_symbol,created_at').eq('link_id', linkId).eq('action', 'open')
    .order('created_at', { ascending: false }).limit(20);
  const rows = cmds || [];

  const copied = rows.filter((r: any) => r.status === 'done').length;
  const skipped = rows.filter((r: any) => r.status === 'skipped').length;
  const failed = rows.filter((r: any) => r.status === 'failed').length;
  const pending = rows.filter((r: any) => r.status === 'pending' || r.status === 'taken').length;

  // Latencia y slippage reales recientes (del log).
  const { data: logs } = await supabaseAdmin.from('copy_log')
    .select('latency_ms,detail').eq('owner_id', user.id).eq('link_id', linkId).eq('ok', true)
    .order('created_at', { ascending: false }).limit(30);
  const lats = (logs || []).map((l: any) => Number(l.latency_ms)).filter((n: number) => n > 0);
  const slips = (logs || []).map((l: any) => Number(l.detail?.slippage_pts)).filter((n: number) => !isNaN(n) && n >= 0);
  const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, n) => s + n, 0) / a.length) : null;
  const avgSlip = slips.length ? Math.round((slips.reduce((s, n) => s + n, 0) / slips.length) * 10) / 10 : null;

  // Tamaño que se aplicaría AHORA: multiplicador base × escalado del reto.
  let scale = 1; let verdict = 'na'; let headroom = 1;
  if (link.guard_prop_rules || link.size_by_challenge) {
    try {
      const g = await copyGuardForSlave(user.id, link.slave_account_id, { strict: !!link.guard_strict });
      verdict = g.verdict; headroom = g.headroom;
      if (link.size_by_challenge) scale = sizeScaleFromHeadroom(g.headroom);
    } catch {}
  }
  const effectiveMult = Math.round((Number(link.multiplier) || 1) * scale * 100) / 100;

  return NextResponse.json({
    sample: rows.length,
    copied, skipped, failed, pending,
    copyRate: rows.length ? Math.round((copied / rows.length) * 100) : null,
    avgLatencyMs: avg(lats), avgSlippagePts: avgSlip,
    baseMultiplier: Number(link.multiplier) || 1,
    sizeScalePct: Math.round(scale * 100),
    effectiveMultiplier: effectiveMult,
    guardVerdict: verdict, headroomPct: Math.round(headroom * 100),
    wouldBlockOpens: link.guard_prop_rules && (verdict === 'breach' || (link.guard_strict && verdict === 'watch')),
  });
}
