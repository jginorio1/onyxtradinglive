import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { alertUser, alertOncePerDay } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// Tareas periódicas de Telegram. Lo llama Vercel Cron (ver vercel.json).
//   ?job=offline  → avisa si el Guardian de alguien lleva rato sin señal
//   ?job=daily    → manda el resumen del día a quien lo quiera
//
// Protegido con CRON_SECRET: Vercel manda el header, y nadie más puede
// dispararlo. Sin el secret configurado, solo lo acepta en local.
// ============================================================
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;                      // sin secret, permitido (dev)
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('key') || '';
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const job = new URL(req.url).searchParams.get('job') || '';

  if (job === 'offline') return offlineCheck();
  if (job === 'daily') return dailySummary();
  return NextResponse.json({ error: 'job desconocido (offline | daily)' }, { status: 400 });
}

// ---- EA caído: el Guardian está activo pero la cuenta no reporta ----
async function offlineCheck() {
  // Cuentas con gestor encendido que llevan entre 8 y 60 min sin sincronizar.
  // El rango evita avisar por un lag puntual (8 min) y no repetir en cuentas
  // que llevan días apagadas (>60 min: ya se avisó o no operaba).
  const now = Date.now();
  const { data: cfgs } = await supabaseAdmin.from('manager_configs')
    .select('account_id,user_id,enabled').eq('enabled', true);

  let sent = 0;
  for (const c of cfgs || []) {
    const { data: acc } = await supabaseAdmin.from('trading_accounts')
      .select('nickname,login,last_sync_at').eq('id', c.account_id).maybeSingle() as any;
    if (!acc?.last_sync_at) continue;
    const mins = (now - new Date(acc.last_sync_at).getTime()) / 60000;
    if (mins >= 8 && mins <= 60) {
      const name = acc.nickname || acc.login;
      const ok = await alertOncePerDay(c.user_id, 'offline', `offline_${c.account_id}`,
        `⚠️ Onyx Guardian\nTu Guardian en ${name} lleva ${Math.round(mins)} min sin señal. Ahora mismo NO te está protegiendo.\nAbre MetaTrader y comprueba que AlgoTrading sigue encendido.`);
      if (ok) sent++;
    }
  }
  return NextResponse.json({ job: 'offline', accountsChecked: (cfgs || []).length, alertsSent: sent });
}

// ---- Resumen del día ----
async function dailySummary() {
  // Solo a quien lo tiene encendido y tiene Telegram conectado
  const { data: users } = await supabaseAdmin.from('profiles')
    .select('id').eq('tg_daily', true).not('telegram_chat_id', 'is', null);

  let sent = 0;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  for (const u of users || []) {
    // sus cuentas
    const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', u.id);
    const ids = (accs || []).map((a: any) => a.id);
    if (!ids.length) continue;

    // operaciones cerradas en las últimas 24h
    const { data: trades } = await supabaseAdmin.from('trades')
      .select('profit,commission,swap,close_time').in('account_id', ids).gte('close_time', since);
    const n = (trades || []).length;
    const net = (trades || []).reduce((s: number, t: any) =>
      s + Number(t.profit || 0) + Number(t.commission || 0) + Number(t.swap || 0), 0);

    // bloqueos y saltos del día (del guardián)
    const { count: blocks } = await supabaseAdmin.from('manager_events')
      .select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('kind', 'blocked').gte('created_at', since);
    const { count: overrides } = await supabaseAdmin.from('manager_events')
      .select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('kind', 'override').gte('created_at', since);

    if (n === 0 && !blocks && !overrides) continue;   // día sin actividad: no molestamos

    const sign = net >= 0 ? '+' : '-';
    const msg =
      `📊 Onyx Guardian · resumen del día\n` +
      `Operaciones: ${n}\n` +
      `Resultado: ${sign}$${Math.abs(net).toFixed(2)}\n` +
      `Te frenó: ${blocks || 0} vez(ces)\n` +
      `Te lo saltaste: ${overrides || 0} vez(ces)`;
    const ok = await alertUser(u.id, 'daily', msg);
    if (ok) sent++;
  }
  return NextResponse.json({ job: 'daily', users: (users || []).length, sent });
}
