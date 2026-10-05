import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadNotifConfig } from '@/lib/notifConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Qué avisos (campana/push) puede elegir el trader. Solo mostramos los tipos y
// canales que el dueño dejó activos globalmente; el resto no aplica.
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
    const cfg = await loadNotifConfig();
    const { data: p } = await supabaseAdmin.from('profiles').select('notif_prefs,lang,plan').eq('id', user.id).maybeSingle();
    const prefs = (p as any)?.notif_prefs || {};
    const lang = (p as any)?.lang === 'en' ? 'en' : 'es';
    // ¿El PLAN del usuario incluye push? (apagado en Free, encendido en pago por defecto).
    // Así la columna Push no muestra interruptores falsos: si el plan no lo cubre, se bloquea.
    const planId = (p as any)?.plan || 'free';
    const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', planId).maybeSingle();
    const pushCap = (plan as any)?.capabilities?.push;
    const planHasPush = (pushCap === undefined || pushCap === null) ? (planId !== 'free') : !!pushCap;
    const items = Object.values(cfg)
      .filter((d: any) => d.on && (d.bell || d.push))
      .map((d: any) => ({
        key: d.key, group: d.group,
        title: d[lang].title, body: d[lang].body,
        // El push solo está disponible si el tipo lo permite Y el plan lo incluye.
        // pushType = el tipo de aviso admite push (para distinguir "bloqueado por plan" de "no aplica").
        bellAvail: !!d.bell, pushType: !!d.push, pushAvail: !!d.push && planHasPush,
        bell: (prefs[d.key]?.bell ?? true), push: (prefs[d.key]?.push ?? true),
      }));
    // planHasPush se usa en la UI para distinguir "bloqueado por plan" de "no aplica".
    return NextResponse.json({ items, lang, planHasPush });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// Guarda las preferencias del trader.
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    const cfg = await loadNotifConfig();
    const clean: Record<string, { bell: boolean; push: boolean }> = {};
    for (const [k, v] of Object.entries(b.prefs || {})) {
      if (!cfg[k] || !v || typeof v !== 'object') continue;
      clean[k] = { bell: !!(v as any).bell, push: !!(v as any).push };
    }
    const r = await supabaseAdmin.from('profiles').update({ notif_prefs: clean }).eq('id', user.id);
    if (r.error) return NextResponse.json({ error: r.error.message, code: 'no_column' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
