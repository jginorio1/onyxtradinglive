import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ensureProfile } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valores permitidos, para no guardar basura que venga del cliente.
const ALLOW: Record<string, string[]> = {
  experience: ['novato', 'intermedio', 'avanzado', 'pro'],
  goal: ['pasar_challenge', 'consistencia', 'crecer', 'vivir'],
};
// Plataforma y tipo de trader vienen del catálogo editable del admin: aceptamos
// cualquier código saneado en vez de una lista fija.

// POST · guarda el perfil de trader del onboarding y marca onboarded_at.
// Con { skip: true } solo marca la fecha (el usuario lo saltó).
export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    await ensureProfile(user.id, user.email);

    const b = await req.json().catch(() => ({}));
    const fields: any = { onboarded_at: new Date().toISOString() };

    if (!b?.skip) {
      // Texto libre acotado
      ['full_name', 'country', 'prop_firm'].forEach((k) => {
        if (b[k] !== undefined) fields[k] = String(b[k] || '').slice(0, 120);
      });
      // Campos de lista: solo si el valor es uno de los permitidos
      Object.keys(ALLOW).forEach((k) => {
        if (b[k] !== undefined && ALLOW[k].includes(String(b[k]))) fields[k] = String(b[k]);
      });
      // Plataforma y tipo de trader: código saneado del catálogo del admin
      ['platform', 'trade_style'].forEach((k) => {
        if (b[k] !== undefined) fields[k] = b[k] ? String(b[k]).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) : null;
      });
    }

    // Intención del usuario (pantalla "¿qué quieres hacer?"): qué servicios le
    // interesan. Se guarda para ordenar el panel y para marketing. Lista acotada.
    const INTENT_OK = ['monitor', 'guardian', 'copy', 'robots', 'academy', 'all'];
    if (Array.isArray(b?.intent)) {
      fields.onboard_intent = b.intent.map((x: any) => String(x)).filter((x: string) => INTENT_OK.includes(x)).slice(0, 6);
    }
    // El paywall de bienvenida solo se muestra una vez: lo marcamos cuando el
    // usuario lo ve (ya sea que compre, vea planes o siga gratis).
    if (b?.paywall_seen === true) fields.onboard_paywall_seen = true;

    // Lead source (de dónde nos conoció). Modelo híbrido: el front manda la
    // atribución auto-detectada (UTM + referrer) y, si quedó "directo/desconocido",
    // también la respuesta del usuario a "¿Cómo nos conociste?". No pisamos un
    // origen fuerte ya guardado (la columna puede no existir: va aparte y tolerante).
    const leadFields: any = {};
    if (b?.attr && typeof b.attr === 'object') {
      const a = b.attr;
      const src = String(a.source || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (src) { leadFields.lead_source = src; leadFields.lead_detected = true; }
      if (a.utm_source) leadFields.lead_utm_source = String(a.utm_source).slice(0, 60);
      if (a.utm_medium) leadFields.lead_utm_medium = String(a.utm_medium).slice(0, 60);
      if (a.utm_campaign) leadFields.lead_utm_campaign = String(a.utm_campaign).slice(0, 80);
      if (a.landing) leadFields.lead_landing = String(a.landing).slice(0, 120);
    }
    // Respuesta explícita del usuario: manda sobre "web/direct" pero no sobre una
    // fuente real ya detectada.
    const ans = String(b?.lead_answer || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    if (ans && (!leadFields.lead_source || ['web', 'direct'].includes(leadFields.lead_source))) {
      leadFields.lead_source = ans; leadFields.lead_detected = false;
    }

    const payload = { ...fields };
    const { error } = await supabaseAdmin.from('profiles').update(payload).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Guardado del lead en un update aparte y tolerante: si las columnas aún no
    // existen (SQL sin correr), no rompe el onboarding. Solo setea lo que falta.
    if (Object.keys(leadFields).length) {
      try {
        const { data: cur } = await supabaseAdmin.from('profiles').select('lead_source').eq('id', user.id).maybeSingle();
        const strong = cur && (cur as any).lead_source && !['web', 'direct', ''].includes(String((cur as any).lead_source).toLowerCase());
        if (!strong) await supabaseAdmin.from('profiles').update(leadFields).eq('id', user.id);
      } catch { /* columnas inexistentes: ignorar */ }
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
