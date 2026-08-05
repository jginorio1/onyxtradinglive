import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ============================================================
// Segmentos dinámicos: se calculan en vivo desde la base (no son listas que
// haya que mantener a mano). Cada campaña apunta a un segmento; el motor
// resuelve quién está dentro AHORA y le envía (respetando el opt-out y el
// anti-repetición). Todo esto alimenta lib/campaigns.ts.
// ============================================================

export type Recipient = { id: string; email: string; name: string; lang: 'es' | 'en'; plan: string };

// Segmentos disponibles (para el desplegable del panel). id + etiquetas es/en.
export const SEGMENTS: Array<{ id: string; es: string; en: string; auto?: boolean }> = [
  { id: 'all', es: 'Todos los traders (activos)', en: 'All traders (opted-in)' },
  { id: 'free', es: 'Plan gratis', en: 'Free plan' },
  { id: 'paid', es: 'Con plan de pago', en: 'Paying customers' },
  { id: 'black', es: 'Black Onyx', en: 'Black Onyx' },
  { id: 'connected', es: 'Con cuenta MT conectada', en: 'With MT account connected' },
  { id: 'no_connect', es: 'Sin conectar su cuenta', en: 'Never connected an account', auto: true },
  { id: 'inactive', es: 'Inactivos (sin sync)', en: 'Inactive (no sync)', auto: true },
  { id: 'trial_expiring', es: 'Prueba por expirar', en: 'Trial expiring', auto: true },
  { id: 'new_signup', es: 'Recién registrados', en: 'New signups', auto: true },
  { id: 'cancelled', es: 'Cancelaron su suscripción', en: 'Cancelled subscription', auto: true },
  { id: 'anniversary', es: 'Aniversario de cuenta', en: 'Account anniversary', auto: true },
];

export function segmentLabel(id: string, lang: 'es' | 'en'): string {
  const s = SEGMENTS.find((x) => x.id === id);
  return s ? s[lang] : id;
}

const DAY = 86400000;
const days = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity);

type Trigger = { days?: number; maxDays?: number };

// Devuelve la lista de destinatarios de un segmento AHORA MISMO.
// `trigger` permite ajustar las ventanas de días de los segmentos automáticos
// (ej. "sin conectar tras N días", "inactivo N días").
export async function resolveSegment(segment: string, trigger: Trigger = {}): Promise<Recipient[]> {
  // 1) Traer perfiles que aceptan marketing (opt-out real).
  const { data: profs } = await supabaseAdmin
    .from('profiles')
    .select('id,email,full_name,lang,plan,created_at,marketing_emails,subscription_status')
    .not('email', 'is', null)
    .limit(5000);

  const rows = (profs || []).filter((p: any) => p.marketing_emails !== false && p.email);

  // 2) Última sincronización por usuario (señal de actividad / conexión).
  const { data: accs } = await supabaseAdmin
    .from('trading_accounts')
    .select('user_id,last_sync_at');
  const lastSync = new Map<string, string | null>();
  for (const a of (accs || []) as any[]) {
    const prev = lastSync.get(a.user_id);
    if (!prev || (a.last_sync_at && new Date(a.last_sync_at) > new Date(prev))) lastSync.set(a.user_id, a.last_sync_at);
  }
  const hasAccount = (id: string) => lastSync.has(id);

  const toRec = (p: any): Recipient => ({
    id: p.id, email: p.email,
    name: (p.full_name || '').split(' ')[0] || '',
    lang: p.lang === 'es' ? 'es' : 'en',
    plan: p.plan || 'free',
  });

  const minD = Number(trigger.days) || 0;
  const maxD = Number(trigger.maxDays) || 0;

  const keep = rows.filter((p: any) => {
    const plan = p.plan || 'free';
    const age = days(p.created_at);
    const sync = days(lastSync.get(p.id));
    switch (segment) {
      case 'all': return true;
      case 'free': return plan === 'free';
      case 'paid': return plan && plan !== 'free';
      case 'black': return plan === 'black';
      case 'connected': return hasAccount(p.id);
      case 'no_connect':
        // Registrado pero sin cuenta; tras N días (def. 3) y sin pasarse (def. 60).
        return !hasAccount(p.id) && age >= (minD || 3) && age <= (maxD || 60);
      case 'inactive':
        // Tiene cuenta pero lleva N días (def. 14) sin sincronizar (tope def. 90).
        return hasAccount(p.id) && sync >= (minD || 14) && sync <= (maxD || 90);
      case 'trial_expiring':
        return (p.subscription_status || '') === 'trialing';
      case 'new_signup':
        // Registrado hace poco (def. hasta 2 días). Bienvenida, una sola vez.
        return age <= (maxD || 2);
      case 'cancelled':
        // Canceló su suscripción (para reactivación / "te extrañamos").
        return ['canceled', 'cancelled', 'unpaid'].includes((p.subscription_status || '').toLowerCase());
      case 'anniversary': {
        // El día (aprox.) de su aniversario de registro, cada año.
        if (age < 360) return false;
        const rem = age % 365;
        return rem < 1.2;
      }
      default: return false;
    }
  });

  return keep.map(toRec);
}

// Solo el conteo (para la vista previa "X lo recibirán"), sin traer todo el detalle.
export async function segmentCount(segment: string, trigger: Trigger = {}): Promise<number> {
  const r = await resolveSegment(segment, trigger);
  return r.length;
}
