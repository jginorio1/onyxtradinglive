import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting, supportRoutingSettings, supportEscalationSettings, type SupportRouting, type SupportEscalation } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Config de RUTEO automático + ESCALAMIENTO por niveles. Guardado en app_settings.

export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const routing = await supportRoutingSettings();
    const escalation = await supportEscalationSettings();
    return NextResponse.json({ routing, escalation });
  } catch (e: any) {
    await logError('support_routing', e);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const curR = await supportRoutingSettings();
    const curE = await supportEscalationSettings();
    const bb = (v: any, d: boolean) => (v !== undefined ? !!v : d);
    const num = (v: any, d: number, min: number) => (v !== undefined ? Math.max(min, Math.round(Number(v) || d)) : d);

    if (b.routing) {
      const r: SupportRouting = {
        on: bb(b.routing.on, curR.on),
        byLanguage: bb(b.routing.byLanguage, curR.byLanguage),
        byCategory: bb(b.routing.byCategory, curR.byCategory),
        balanceLoad: bb(b.routing.balanceLoad, curR.balanceLoad),
        onlyAvailable: bb(b.routing.onlyAvailable, curR.onlyAvailable),
      };
      await saveSetting('support_routing', r);
    }
    if (b.escalation) {
      const e: SupportEscalation = {
        on: bb(b.escalation.on, curE.on),
        l2AfterMin: num(b.escalation.l2AfterMin, curE.l2AfterMin, 10),
        l3AfterMin: num(b.escalation.l3AfterMin, curE.l3AfterMin, 20),
        supervisorEmail: b.escalation.supervisorEmail !== undefined ? String(b.escalation.supervisorEmail || '').trim().slice(0, 160) : curE.supervisorEmail,
      };
      if (e.l3AfterMin <= e.l2AfterMin) e.l3AfterMin = e.l2AfterMin + 60;   // N3 siempre después de N2
      await saveSetting('support_escalation', e);
    }
    await logAdmin(g.user?.email || '', 'support_routing', 'support_routing', {});
    const routing = await supportRoutingSettings();
    const escalation = await supportEscalationSettings();
    return NextResponse.json({ ok: true, routing, escalation });
  } catch (e: any) {
    await logError('support_routing', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
