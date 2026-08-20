import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { NOTIF_CATALOG, type NotifOverride } from '@/lib/notifConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · catálogo de avisos + los cambios guardados por el dueño.
export async function GET() {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const overrides = await getSetting<Record<string, NotifOverride>>('notif_config', {}) || {};
  return NextResponse.json({ catalog: NOTIF_CATALOG, overrides });
}

// POST · guarda los cambios (on/off, canales, textos) del dueño.
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const valid = new Set(NOTIF_CATALOG.map((d) => d.key));
  const clean: Record<string, NotifOverride> = {};
  for (const [k, v] of Object.entries(b.overrides || {})) {
    if (!valid.has(k) || !v || typeof v !== 'object') continue;
    const o = v as any;
    clean[k] = {
      on: !!o.on,
      bell: !!o.bell, push: !!o.push, telegram: !!o.telegram,
      title_es: o.title_es != null ? String(o.title_es).slice(0, 140) : undefined,
      title_en: o.title_en != null ? String(o.title_en).slice(0, 140) : undefined,
      body_es: o.body_es != null ? String(o.body_es).slice(0, 300) : undefined,
      body_en: o.body_en != null ? String(o.body_en).slice(0, 300) : undefined,
    };
  }
  await saveSetting('notif_config', clean);
  return NextResponse.json({ ok: true });
}
