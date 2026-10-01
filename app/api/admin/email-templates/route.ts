import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { defaultTemplates, TEMPLATE_META, EMAIL_CATEGORIES } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · plantillas de correo (valor efectivo = override o por defecto) + defaults.
// Cualquier admin puede verlas (viven en la pestaña Correos, no en Ajustes).
export async function GET() {
  try {
    const a = await getAdmin();
    if (!a.isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const defs = defaultTemplates();
    const ov = await getSetting<any>('email_tpl_overrides', {});
    const items = TEMPLATE_META.map((m) => {
      const d: any = defs[m.id]; const o: any = ov?.[m.id] || {};
      const edited = !!(o?.es?.subject || o?.es?.body || o?.en?.subject || o?.en?.body);
      const one = (l: 'es' | 'en') => ({
        subject: (o[l]?.subject ?? d[l].subject) as string,
        body: (o[l]?.body ?? d[l].body) as string,
        defSubject: d[l].subject as string, defBody: d[l].body as string,
      });
      return { id: m.id, cat: m.cat, es_label: m.es, en_label: m.en, to: m.to, vars: m.vars, edited, es: one('es'), en: one('en') };
    });
    return NextResponse.json({ items, categories: EMAIL_CATEGORIES });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', items: [], categories: EMAIL_CATEGORIES }, { status: 500 });
  }
}

// PATCH · guardar overrides. Cualquier admin con acceso a la pestaña puede editar.
export async function PATCH(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const inc = b.overrides || {};
  const s = (v: any, max = 4000) => (v == null ? '' : String(v).slice(0, max));
  const valid = new Set(TEMPLATE_META.map((m) => m.id));
  // Combina con lo ya guardado para no borrar overrides de otras plantillas.
  const prev = await getSetting<any>('email_tpl_overrides', {});
  const clean: any = { ...(prev || {}) };
  for (const id of Object.keys(inc)) {
    if (!valid.has(id)) continue;
    const e = inc[id] || {};
    clean[id] = {
      es: { subject: s(e.es?.subject, 200), body: s(e.es?.body) },
      en: { subject: s(e.en?.subject, 200), body: s(e.en?.body) },
    };
  }
  await saveSetting('email_tpl_overrides', clean);
  return NextResponse.json({ ok: true });
}
