import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { defaultTemplates, TEMPLATE_META } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · plantillas de correo (valor efectivo = override o por defecto) + defaults.
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const defs = defaultTemplates();
  const ov = await getSetting<any>('email_tpl_overrides', {});
  const items = TEMPLATE_META.map((m) => {
    const d: any = defs[m.id]; const o: any = ov?.[m.id] || {};
    const one = (l: 'es' | 'en') => ({
      subject: (o[l]?.subject ?? d[l].subject) as string,
      body: (o[l]?.body ?? d[l].body) as string,
      defSubject: d[l].subject as string, defBody: d[l].body as string,
    });
    return { id: m.id, label: m.label, vars: m.vars, es: one('es'), en: one('en') };
  });
  return NextResponse.json({ items });
}

// PATCH · guardar overrides (owner). { overrides: { [id]: { es:{subject,body}, en:{...} } } }
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede editar los correos.' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const inc = b.overrides || {};
  const s = (v: any, max = 4000) => (v == null ? '' : String(v).slice(0, max));
  const valid = new Set(TEMPLATE_META.map((m) => m.id));
  const clean: any = {};
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
