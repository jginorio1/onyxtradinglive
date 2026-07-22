import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { PROP_TEMPLATES } from '@/lib/manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Plantillas de prop firm. Se editan desde el panel para poder corregirlas
// cuando una firma cambie sus reglas, sin volver a desplegar la web.
export async function GET() {
  try {
    const { isAdmin } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const s = await getSetting<{ list: any[] }>('prop_templates', { list: [] });
    return NextResponse.json({ list: s?.list?.length ? s.list : PROP_TEMPLATES, isDefault: !s?.list?.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

const BASES = ['day_start_balance', 'day_start_equity', 'initial_balance'];

export async function POST(req: Request) {
  try {
    const { isAdmin, user } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

    const b = await req.json().catch(() => ({} as any));
    if (b.action === 'reset') {
      await saveSetting('prop_templates', { list: [] });
      await logAdmin(user.email, 'firms_reset', 'prop_templates', {});
      return NextResponse.json({ ok: true, list: PROP_TEMPLATES });
    }

    if (!Array.isArray(b.list)) {
      return NextResponse.json({ error: 'Missing list.', code: 'missing_data' }, { status: 400 });
    }

    const clean = b.list.slice(0, 30).map((f: any) => {
      const id = String(f.id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
      const name = String(f.name || '').trim().slice(0, 40);
      return {
        id, name,
        daily_loss: Math.max(0, Math.min(100, Number(f.daily_loss) || 0)),
        total_loss: Math.max(0, Math.min(100, Number(f.total_loss) || 0)),
        base: BASES.includes(f.base) ? f.base : 'day_start_balance',
        reset_hour: Math.max(0, Math.min(23, Number(f.reset_hour) || 0)),
        note_es: String(f.note_es || '').slice(0, 200),
        note_en: String(f.note_en || '').slice(0, 200),
      };
    }).filter((f: any) => f.id && f.name);

    if (!clean.length) {
      return NextResponse.json({ error: 'Each template needs id and name.', code: 'missing_data' }, { status: 400 });
    }

    await saveSetting('prop_templates', { list: clean });
    await logAdmin(user.email, 'firms_save', 'prop_templates', { count: clean.length });
    return NextResponse.json({ ok: true, list: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
