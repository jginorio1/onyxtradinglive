import { notify } from '@/lib/notify';
import { sendPush } from '@/lib/push';
import { alertUser } from '@/lib/telegram';
import { loadNotifConfig } from '@/lib/notifConfig';

// Envía UN aviso por los canales que el dueño dejó activos (campana / push /
// Telegram), con los textos configurados en Admin → Notificaciones. Si el tipo
// está apagado, no hace nada. Nunca lanza: un fallo de un canal no rompe el resto.
export async function emitNotif(
  userId: string,
  key: string,
  opts: { lang?: string; url?: string; vars?: Record<string, string | number>; cfg?: any; title?: string; body?: string } = {}
): Promise<void> {
  try {
    const all = opts.cfg || (await loadNotifConfig());
    const d = all[key];
    if (!d || !d.on) return;
    const lang = opts.lang === 'en' ? 'en' : 'es';
    const sub = (s: string) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => String(opts.vars?.[k] ?? ''));
    // Si el que llama pasa un texto específico (p. ej. el motivo del robot), se usa
    // ese; si no, el texto configurado en Admin. Los canales/on-off mandan igual.
    const title = sub(opts.title ?? d[lang].title);
    const body = sub(opts.body ?? d[lang].body);
    const url = opts.url || d.url;

    if (d.bell) { try { await notify(userId, { kind: key, title, body, url }); } catch {} }
    if (d.push) { try { await sendPush(userId, { title, body, url }); } catch {} }
    if (d.telegram) { try { await alertUser(userId, d.tgKind as any, `<b>${title}</b>\n${body}`); } catch {} }
  } catch { /* nunca romper el flujo que llamó */ }
}

// Reexport útil para precargar la config una vez en bucles (crons).
export { loadNotifConfig } from '@/lib/notifConfig';
