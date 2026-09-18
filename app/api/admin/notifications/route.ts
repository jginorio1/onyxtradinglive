import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { NOTIF_CATALOG, type NotifOverride } from '@/lib/notifConfig';
import { emitNotif } from '@/lib/emitNotif';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valores de ejemplo para que los {placeholders} se vean con algo al probar.
const TEST_VARS: Record<string, string | number> = {
  acc: 'Demo 123456', pct: 4, rule: 'Pérdida diaria excedida', days: 5, count: 3,
  sym: 'US30', net: '+250.00', event: 'NFP', mins: 30, title: 'Clase en vivo (demo)',
  body: 'Este es un aviso de prueba de Onyx.', name: 'Robot Demo', amount: '$25.00', bot: 'Robot Demo',
};

// GET · catálogo de avisos + los cambios guardados por el dueño.
export async function GET() {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const overrides = await getSetting<Record<string, NotifOverride>>('notif_config', {}) || {};
  return NextResponse.json({ catalog: NOTIF_CATALOG, overrides });
}

// POST · guarda los cambios (on/off, canales, textos) del dueño.
//   { test: '<key>' } → dispara ESE aviso al propio admin para verlo llegar
//   (campana + push forzados, sin importar el on/off configurado).
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const valid = new Set(NOTIF_CATALOG.map((d) => d.key));

  // ---- Prueba: enviar un aviso concreto al admin ----
  if (b.test) {
    const key = String(b.test);
    const def = NOTIF_CATALOG.find((d) => d.key === key);
    if (!def) return NextResponse.json({ error: 'tipo desconocido' }, { status: 400 });
    let uid = '';
    try { const sb = createSupabaseServer(); const { data } = await sb.auth.getUser(); uid = data?.user?.id || ''; } catch {}
    if (!uid) return NextResponse.json({ error: 'sin sesión' }, { status: 401 });
    // Config forzada SOLO para este envío: prendido, campana + push (sin Telegram
    // para no molestar a los suscriptores del canal al probar).
    const cfg = { [key]: { ...def, on: true, bell: true, push: true, telegram: false } } as any;
    const lang = b.lang === 'en' ? 'en' : 'es';
    const prefix = lang === 'en' ? '[TEST] ' : '[PRUEBA] ';
    try {
      await emitNotif(uid, key, { cfg, lang, vars: TEST_VARS, title: prefix + (def as any)[lang].title });
    } catch (e: any) { return NextResponse.json({ error: 'no se pudo enviar', detail: String(e?.message || e) }, { status: 500 }); }
    return NextResponse.json({ ok: true, sent: true });
  }

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
