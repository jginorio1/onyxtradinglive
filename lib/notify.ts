import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Guarda una notificación dentro de la app para el trader (además del push/Telegram).
// Tolerante: si la tabla aún no existe, no rompe el flujo que la llamó.
export async function notify(userId: string | null | undefined, n: { kind?: string; title: string; body?: string; url?: string }) {
  if (!userId) return;
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      kind: n.kind || 'info',
      title: String(n.title || '').slice(0, 140),
      body: n.body ? String(n.body).slice(0, 300) : null,
      url: n.url || null,
    });
  } catch { /* si falta la tabla, silencioso */ }
}
