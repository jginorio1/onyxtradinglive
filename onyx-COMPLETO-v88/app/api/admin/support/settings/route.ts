import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Ajustes de la auto-respuesta con IA (guardados en app_settings).
export async function GET() {
  try {
    const { ok } = await requirePerm('soporte', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const cfg = await getSetting<{ enabled: boolean }>('support_ai', { enabled: true });
    return NextResponse.json({ ...cfg });
  } catch (e: any) {
    await logError('support_settings', e);
    return NextResponse.json({ enabled: true });
  }
}

export async function POST(req: Request) {
  try {
    const g = await requirePerm('soporte', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const enabled = !!b.enabled;
    await saveSetting('support_ai', { enabled });
    await logAdmin(g.user?.email || '', 'support_ai_toggle', 'support_ai', { enabled });
    return NextResponse.json({ ok: true, enabled });
  } catch (e: any) {
    await logError('support_settings', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
