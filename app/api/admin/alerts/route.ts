import { NextResponse } from 'next/server';
import { requirePerm } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSetting, saveSetting } from '@/lib/settings';
import { computeRevenue } from '@/lib/revenue';
import { sendMessage, telegramEnabled } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Thresholds = { failedPayments: number; backupStaleDays: number; errorSpike: number; cancellationsDay: number; mrrDropPct: number };
type Snap = { date: string; mrr: number; activeSubs: number; collected: number; failed: number; cancellations: number; errors: number };
type FeedItem = { at: string; key: string; text: string };
type Alerts = { enabled: boolean; thresholds: Thresholds; lastFired: Record<string, string>; feed: FeedItem[]; snapshots: Snap[] };

const A0: Alerts = {
  enabled: true,
  thresholds: { failedPayments: 1, backupStaleDays: 2, errorSpike: 20, cancellationsDay: 3, mrrDropPct: 10 },
  lastFired: {}, feed: [], snapshots: [],
};

// Manda el aviso a todos los admins que tengan Telegram vinculado.
async function notifyAdmins(text: string) {
  if (!telegramEnabled()) return;
  try {
    const { data } = await supabaseAdmin.from('profiles').select('telegram_chat_id').eq('is_admin', true).not('telegram_chat_id', 'is', null);
    for (const p of data || []) if (p.telegram_chat_id) await sendMessage(p.telegram_chat_id, text, { kind: 'admin' });
  } catch {}
}

// POST · lo llama la tarea programada (CRON_SECRET). Toma foto y evalúa reglas.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const a = await getSetting<Alerts>('alerts', A0);
  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  // Métricas de las últimas 24 h
  const rev = await computeRevenue(Date.now() - 86400000, Date.now(), true);
  let errors = 0, cancellations = 0;
  try { const { count } = await supabaseAdmin.from('app_errors').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo); errors = count || 0; } catch {}
  try { const { count } = await supabaseAdmin.from('cancellations').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo); cancellations = count || 0; } catch {}

  // Foto diaria (una por día)
  const snap: Snap = { date: today, mrr: rev.mrr || 0, activeSubs: rev.activeSubs || 0, collected: rev.collected || 0, failed: rev.failed || 0, cancellations, errors };
  const snapshots = [...a.snapshots.filter((s) => s.date !== today), snap].slice(-120);

  const th = a.thresholds;
  const fired: FeedItem[] = [];
  const fire = (key: string, text: string) => { if (a.lastFired[key] === today) return; a.lastFired[key] = today; fired.push({ at: new Date().toISOString(), key, text }); };

  if (a.enabled) {
    if (rev.configured && rev.failed >= th.failedPayments) fire('failed', `⚠️ ${rev.failed} pago(s) fallido(s) en 24 h. Revisa los cobros en riesgo.`);
    if (cancellations >= th.cancellationsDay) fire('cancel', `📉 ${cancellations} cancelación(es) en 24 h.`);
    if (errors >= th.errorSpike) fire('errors', `🐞 ${errors} errores en 24 h. Revisa Diagnóstico.`);

    // Backup viejo
    try {
      const bk = await getSetting<any>('backup', { last_at: null });
      if (bk.last_at) { const days = (Date.now() - new Date(bk.last_at).getTime()) / 86400000; if (days >= th.backupStaleDays) fire('backup', `🗄️ La última copia de seguridad tiene ${Math.floor(days)} día(s).`); }
    } catch {}

    // MRR a la baja vs ~7 días atrás
    const past = [...snapshots].reverse().find((s) => (Date.now() - new Date(s.date).getTime()) >= 6 * 86400000);
    if (past && past.mrr > 0) { const drop = ((past.mrr - snap.mrr) / past.mrr) * 100; if (drop >= th.mrrDropPct) fire('mrr', `📉 Tu MRR bajó ${Math.round(drop)}% vs hace una semana (de $${past.mrr} a $${snap.mrr}).`); }
  }

  const feed = [...fired, ...a.feed].slice(0, 30);
  await saveSetting('alerts', { ...a, snapshots, feed });
  for (const f of fired) await notifyAdmins(f.text);
  return NextResponse.json({ ok: true, fired: fired.length, snapshot: snap });
}

// GET · config + feed para el panel (owner/ver ajustes)
export async function GET() {
  const { ok } = await requirePerm('ajustes', 'view');
  if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const a = await getSetting<Alerts>('alerts', A0);
  return NextResponse.json({ enabled: a.enabled, thresholds: a.thresholds, feed: a.feed, snapshots: a.snapshots.length, telegram: telegramEnabled() });
}

// PATCH · encender/apagar + límites (owner)
export async function PATCH(req: Request) {
  const { ok } = await requirePerm('ajustes', 'manage');
  if (!ok) return NextResponse.json({ error: 'Solo el Owner puede cambiar las alertas.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const a = await getSetting<Alerts>('alerts', A0);
  const th = { ...a.thresholds };
  for (const k of Object.keys(th) as (keyof Thresholds)[]) if (typeof b?.thresholds?.[k] === 'number' && b.thresholds[k] >= 0) th[k] = b.thresholds[k];
  await saveSetting('alerts', { ...a, enabled: b.enabled !== false, thresholds: th });
  return NextResponse.json({ ok: true });
}
