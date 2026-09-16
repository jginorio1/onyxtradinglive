import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { listEvents, userTimeline, monitorStats, employeeBoard, geoStats, funnelStats } from '@/lib/monitor';
import { getAlertCfg, saveAlertCfg, runAlerts } from '@/lib/monitorAlerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · Command Center. Protegido por permiso de área 'diag' (owner siempre).
//   ?mode=feed      → stats + últimos eventos (para el vivo, se llama seguido)
//   ?mode=history   → eventos con filtros (actor, kind, role, hours)
//   ?mode=timeline  → rebobinar la sesión de un usuario (?who=email|id)
export async function GET(req: Request) {
  try {
    const { ok } = await requirePerm('diag', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const u = new URL(req.url);
    const mode = u.searchParams.get('mode') || 'feed';

    if (mode === 'timeline') {
      const who = u.searchParams.get('who') || '';
      return NextResponse.json({ timeline: who ? await userTimeline(who, Number(u.searchParams.get('hours') || 72)) : [] });
    }
    if (mode === 'history') {
      const events = await listEvents({
        hours: Number(u.searchParams.get('hours') || 24),
        actor: u.searchParams.get('actor') || '',
        kind: u.searchParams.get('kind') || '',
        role: u.searchParams.get('role') || '',
        limit: 200,
      });
      return NextResponse.json({ events });
    }
    if (mode === 'employees') {
      return NextResponse.json({ employees: await employeeBoard() });
    }
    if (mode === 'alertcfg') {
      return NextResponse.json({ cfg: await getAlertCfg() });
    }
    if (mode === 'geo') {
      const hours = Number(u.searchParams.get('hours') || 24);
      const [geo, funnel] = await Promise.all([geoStats(hours), funnelStats(hours)]);
      return NextResponse.json({ geo, funnel });
    }
    const [stats, feed] = await Promise.all([monitorStats(), listEvents({ hours: 2, limit: 40 })]);
    return NextResponse.json({ stats, feed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · guardar la configuración de alertas o dispararlas manualmente ("probar").
export async function POST(req: Request) {
  try {
    const { ok } = await requirePerm('diag', 'manage');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    if (b.action === 'test') { const r = await runAlerts(); return NextResponse.json({ ok: true, ...r }); }
    await saveAlertCfg(b.cfg || {});
    return NextResponse.json({ ok: true, cfg: await getAlertCfg() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
