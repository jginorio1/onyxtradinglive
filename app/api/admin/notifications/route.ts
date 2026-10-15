import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin';
import { getSetting, saveSetting } from '@/lib/settings';
import { NOTIF_CATALOG, loadNotifConfig, type NotifOverride } from '@/lib/notifConfig';
import { emitNotif, pushDiagForUser } from '@/lib/emitNotif';
import { broadcastFcm, fcmEnabled } from '@/lib/fcm';
import { pushEnabled } from '@/lib/push';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valores de ejemplo para que los {placeholders} se vean con algo al probar.
const TEST_VARS: Record<string, string | number> = {
  acc: 'Demo 123456', pct: 4, rule: 'Pérdida diaria excedida', days: 5, count: 3,
  sym: 'US30', net: '+250.00', event: 'NFP', mins: 30, title: 'Clase en vivo (demo)',
  body: 'Este es un aviso de prueba de Onyx.', name: 'Robot Demo', amount: '$25.00', bot: 'Robot Demo',
};

// GET · catálogo de avisos + los cambios guardados por el dueño.
//   ?diag=1 → en lugar del catálogo, devuelve el DIAGNÓSTICO de push de TU cuenta:
//   si eres staff, tu plan, si el candado lo permite y cuántos dispositivos tienes
//   registrados (nativo FCM + web). Sirve para entender por qué llega (o no) una
//   automática, ya que el botón "Probar" salta esos filtros.
export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a.isAdmin || a.role !== 'owner') return NextResponse.json({ error: 'no autorizado' }, { status: 403 });

  if (new URL(req.url).searchParams.get('diag')) {
    const uid = a.user?.id || '';
    const diag = await pushDiagForUser(uid);
    let nativeTokens = 0, webSubs = 0;
    try { const { count } = await supabaseAdmin.from('native_push_tokens').select('id', { count: 'exact', head: true }).eq('user_id', uid); nativeTokens = count || 0; } catch {}
    try { const { count } = await supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', uid); webSubs = count || 0; } catch {}
    return NextResponse.json({
      ...diag,
      fcmEnabled: fcmEnabled(),      // variables FCM_* presentes (push nativa)
      webPushEnabled: pushEnabled(), // variables VAPID presentes (push web/PWA)
      nativeTokens,                  // dispositivos de la app (iOS/Android)
      webSubs,                       // navegadores/PWA suscritos
    });
  }

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
    // Usamos la configuración GUARDADA (catálogo + tus ediciones), no el texto de
    // fábrica. Así la prueba muestra EXACTAMENTE el mensaje y los iconos que el
    // trader recibirá de verdad (título, cuerpo y emojis que tú editaste).
    const all = await loadNotifConfig();
    const def = (all as any)[key] || NOTIF_CATALOG.find((d) => d.key === key);
    if (!def) return NextResponse.json({ error: 'tipo desconocido' }, { status: 400 });
    let uid = '';
    try { const sb = createSupabaseServer(); const { data } = await sb.auth.getUser(); uid = data?.user?.id || ''; } catch {}
    if (!uid) return NextResponse.json({ error: 'sin sesión' }, { status: 401 });
    // Config forzada SOLO para este envío: prendido, campana + push (sin Telegram
    // para no molestar a los suscriptores del canal al probar). Partimos de tu
    // config guardada para conservar el texto y los iconos editados.
    const cfg = { [key]: { ...def, on: true, bell: true, push: true, telegram: false } } as any;
    // Idioma de la PRUEBA: el idioma guardado en TU perfil (profiles.lang), para que
    // la prueba llegue igual que un aviso real. Antes usaba el idioma del panel de
    // admin, que podía no coincidir con el idioma de la app. Cae a 'es' si no hay.
    let lang: 'es' | 'en' = 'es';
    try { const { data } = await supabaseAdmin.from('profiles').select('lang').eq('id', uid).maybeSingle(); lang = (data as any)?.lang === 'en' ? 'en' : 'es'; } catch {}
    const prefix = lang === 'en' ? '[TEST] ' : '[PRUEBA] ';
    try {
      await emitNotif(uid, key, { cfg, lang, vars: TEST_VARS, title: prefix + (def as any)[lang].title, ignorePlan: true });
    } catch (e: any) { return NextResponse.json({ error: 'no se pudo enviar', detail: String(e?.message || e) }, { status: 500 }); }
    return NextResponse.json({ ok: true, sent: true });
  }

  // ---- Restablecer a valores de fábrica: borra la config guardada ----
  // Al dejar notif_config vacío, loadNotifConfig vuelve a usar los defaults del
  // catálogo (NOTIF_CATALOG) para todos los tipos. No toca las prefs de cada trader.
  if (b.reset) {
    await saveSetting('notif_config', {});
    return NextResponse.json({ ok: true, reset: true });
  }

  // ---- Difusión: push escrita a mano a TODOS los usuarios con dispositivo ----
  if (b.broadcast) {
    const m = b.broadcast || {};
    const title_es = String(m.title_es || m.title || '').trim().slice(0, 140);
    const body_es = String(m.body_es || m.body || '').trim().slice(0, 300);
    if (!title_es || !body_es) return NextResponse.json({ error: 'Falta título o mensaje.' }, { status: 400 });
    const res = await broadcastFcm({
      title_es, body_es,
      title_en: m.title_en ? String(m.title_en).trim().slice(0, 140) : undefined,
      body_en: m.body_en ? String(m.body_en).trim().slice(0, 300) : undefined,
      url: m.url ? String(m.url).slice(0, 300) : undefined,
    });
    return NextResponse.json({ ok: true, ...res });
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
