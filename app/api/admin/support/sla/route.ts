import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { SLA_DEFAULT, type SupportSla } from '@/lib/supportSla';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Config del SLA de soporte (tiempos de recordatorio/cierre al cliente y de
// aviso/vencido al equipo). Guardado en app_settings bajo 'support_sla'.

export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const cfg = await getSetting<SupportSla>('support_sla', SLA_DEFAULT);
    return NextResponse.json({ ...SLA_DEFAULT, ...cfg });
  } catch (e: any) {
    await logError('support_sla', e);
    return NextResponse.json({ ...SLA_DEFAULT });
  }
}

export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const cur = await getSetting<SupportSla>('support_sla', SLA_DEFAULT);
    const num = (v: any, def: number, min: number) => (v !== undefined ? Math.max(min, Math.round(Number(v) || def)) : def);
    const next: SupportSla = {
      on: b.on !== undefined ? !!b.on : cur.on,
      reminderH: num(b.reminderH, cur.reminderH, 1),
      closeH: num(b.closeH, cur.closeH, 2),
      ackMin: num(b.ackMin, cur.ackMin, 5),
      overdueMin: num(b.overdueMin, cur.overdueMin, 10),
    };
    // Coherencia: cierre siempre después del recordatorio; vencido después del aviso.
    if (next.closeH <= next.reminderH) next.closeH = next.reminderH + 1;
    if (next.overdueMin <= next.ackMin) next.overdueMin = next.ackMin + 10;
    await saveSetting('support_sla', next);
    await logAdmin(g.user?.email || '', 'support_sla', 'support_sla', { on: next.on });
    return NextResponse.json({ ok: true, ...next });
  } catch (e: any) {
    await logError('support_sla', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
