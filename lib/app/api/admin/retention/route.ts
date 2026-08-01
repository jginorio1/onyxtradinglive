import { NextResponse } from 'next/server';
import { getAdmin, logAdmin, requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { retentionSettings, addonSettings, saveSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · motivos de baja, tasa de rescate y ajustes
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('retencion', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const { data: rows } = await supabaseAdmin.from('cancellations').select('*').order('created_at', { ascending: false }).limit(500);
    const list = rows || [];

    const byReason: Record<string, number> = {};
    let saved = 0, canceled = 0;
    list.forEach((c: any) => {
      byReason[c.reason || 'other'] = (byReason[c.reason || 'other'] || 0) + 1;
      if (String(c.outcome || '').startsWith('saved_')) saved++;
      else if (c.outcome === 'canceled') canceled++;
    });
    const resolved = saved + canceled;
    const saveRate = resolved ? Math.round((saved / resolved) * 100) : 0;

    return NextResponse.json({
      recent: list.slice(0, 60),
      byReason, saved, canceled, saveRate, total: list.length,
      retention: await retentionSettings(),
      addons: await addonSettings(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · guardar reglas de retención o de complementos
export async function PATCH(req: Request) {
  try {
    const { isAdmin, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const _p = await requirePerm('retencion', 'view'); if (!_p.ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const b = await req.json();
    if (b.key !== 'retention' && b.key !== 'addons') return NextResponse.json({ error: 'clave desconocida' }, { status: 400 });
    const current = b.key === 'retention' ? await retentionSettings() : await addonSettings();
    await saveSetting(b.key, { ...current, ...(b.value || {}) });
    await logAdmin(user.email, 'settings_' + b.key, b.key, b.value);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
