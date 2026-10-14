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
    const { data: p } = await supabaseAdmin.from('profiles').select('notif_prefs,lang,plan,is_admin').eq('id', user.id).maybeSingle();
    const prefs = (p as any)?.notif_prefs || {};
    const lang = (p as any)?.lang === 'en' ? 'en' : 'es';
    // ¿El usuario recibe push? MISMA regla que lib/emitNotif.planAllowsPush: cualquier
    // plan de pago activo (plan != 'free') recibe push; 'free' no. Y el STAFF (dueño/admin)
    // siempre, aunque esté en Free. Así el panel no muestra el Push bloqueado para quien sí
    // lo recibe. (Antes dependía de plans.capabilities.push, que ya no gobierna el envío.)
    const planId = (p as any)?.plan || 'free';
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const isStaff = !!(p as any)?.is_admin || admins.includes((user.email || '').toLowerCase());
    const planHasPush = isStaff || planId !== 'free';

    // FILTRO POR MÓDULO: el trader solo ve los avisos de los módulos que usa (o que su
    // plan incluye). El staff ve todo. Ante cualquier fallo de detección, se MUESTRA
    // (nunca ocultamos por un error de consulta). Capacidades del plan + uso real.
    const uid = user.id;
    let caps: any = {};
    try { const { data: pl } = await supabaseAdmin.from('plans').select('capabilities').eq('id', planId).maybeSingle(); caps = (pl as any)?.capabilities || {}; } catch {}
    const cnt = async (q: any): Promise<boolean> => { try { const { count } = await q; return (count || 0) > 0; } catch { return true; } };
    const feats = new Set<string>();
    if (isStaff) {
      ['academy', 'copy', 'bots', 'botlab'].forEach((f) => feats.add(f));
    } else {
      const [acAcademy, acCopyFollow, acCopyProv, acBots, acBotlab] = await Promise.all([
        cnt(supabaseAdmin.from('academy_memberships').select('id', { count: 'exact', head: true }).or(`student_id.eq.${uid},mentor_id.eq.${uid}`)),
        cnt(supabaseAdmin.from('copy_follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid)),
        cnt(supabaseAdmin.from('strategy_providers').select('id', { count: 'exact', head: true }).eq('user_id', uid)),
        cnt(supabaseAdmin.from('bots').select('user_id', { count: 'exact', head: true }).eq('user_id', uid)),
        cnt(supabaseAdmin.from('bot_products').select('id', { count: 'exact', head: true }).eq('seller_id', uid)),
      ]);
      if (!!caps.academy || acAcademy) feats.add('academy');
      if (!!caps.copy || acCopyFollow || acCopyProv) feats.add('copy');
      if (!!caps.algo || acBots) feats.add('bots');
      if (acBotlab) feats.add('botlab');
    }

    const items = Object.values(cfg)
      .filter((d: any) => d.on && (d.bell || d.push) && (!d.feature || feats.has(d.feature)))
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
