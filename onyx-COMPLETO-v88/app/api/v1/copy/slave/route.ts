import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authAccount } from '@/lib/copyAuth';
import { alertOncePerDay } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · la EA esclava pide sus comandos pendientes (y los marca como tomados).
export async function GET(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ error: 'invalid api key' }, { status: 401 });

  // Solo comandos "maduros": sin retraso (execute_after null) o cuya hora ya llegó.
  // El retraso aleatorio (jitter) hace que la apertura no se entregue hasta su hora.
  const nowIso = new Date().toISOString();
  const { data: cmds } = await supabaseAdmin.from('copy_commands')
    .select('id,action,master_ticket,base_symbol,side,volume_hint,sl,tp,price,payload,created_at,execute_after')
    .eq('slave_account_id', a.account.id).eq('status', 'pending')
    .or(`execute_after.is.null,execute_after.lte.${nowIso}`)
    .order('created_at', { ascending: true }).limit(50);

  if (cmds?.length) {
    await supabaseAdmin.from('copy_commands')
      .update({ status: 'taken', taken_at: new Date().toISOString() })
      .in('id', cmds.map((c) => c.id));
  }

  // Estado de pausa → el panel de la EA colorea el borde (rojo si está en pausa).
  const { data: prof } = await supabaseAdmin.from('profiles').select('copy_paused').eq('id', a.userId).maybeSingle();
  const paused = !!prof?.copy_paused || !!a.account.copy_paused;

  const now = Date.now();
  const out = (cmds || []).map((c: any) => {
    const { created_at, execute_after, ...rest } = c;
    // La antigüedad se mide desde execute_after (cuando había retraso deliberado) o
    // desde created_at: así el jitter NO cuenta como "señal vieja".
    const baseT = execute_after ? new Date(execute_after).getTime() : (created_at ? new Date(created_at).getTime() : now);
    const age_ms = Math.max(0, now - baseT);
    return { ...rest, age_ms };
  });
  return NextResponse.json({ commands: out, paused });
}

// POST · la EA esclava confirma el resultado de un comando. Escribe en el log.
export async function POST(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ error: 'invalid api key' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.command_id || '');
  if (!id) return NextResponse.json({ error: 'missing command_id' }, { status: 400 });

  const ok = !!b.ok;
  const SKIP = ['symbol_not_found', 'spread_high', 'risk_stop', 'signal_old', 'no_sl', 'max_positions', 'deviation', 'symbol_cap'];
  const status = ok ? 'done' : (SKIP.includes(String(b.error || '')) ? 'skipped' : 'failed');

  const { data: cmd } = await supabaseAdmin.from('copy_commands')
    .select('link_id,base_symbol,slave_account_id').eq('id', id).maybeSingle();
  // Solo el dueño de esa cuenta esclava puede confirmar.
  if (!cmd || cmd.slave_account_id !== a.account.id) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await supabaseAdmin.from('copy_commands').update({ status, done_at: new Date().toISOString(), error: b.error || null }).eq('id', id);
  await supabaseAdmin.from('copy_log').insert({
    owner_id: a.userId, link_id: cmd.link_id,
    kind: ok ? 'copied' : (status === 'skipped' ? 'skipped' : 'error'),
    symbol: cmd.base_symbol, ok, latency_ms: Number(b.latency_ms) || null,
    detail: { slave_ticket: b.slave_ticket || null, error: b.error || null },
  });

  // Aviso por Telegram cuando falla una copia (una vez al día por tipo de error,
  // para no saturar). Solo si el trader tiene ese aviso encendido.
  if (!ok) {
    const err = String(b.error || 'fallo');
    const labels: Record<string, string> = {
      symbol_not_found: 'símbolo no encontrado', spread_high: 'spread demasiado alto',
      risk_stop: 'límite de riesgo alcanzado', signal_old: 'señal llegó tarde',
      no_sl: 'operación sin Stop Loss', max_positions: 'máx posiciones alcanzado',
      deviation: 'precio se movió demasiado', symbol_cap: 'tope de lote por símbolo',
    };
    const label = labels[err] || err;
    alertOncePerDay(a.userId, 'copy_error', 'copy_' + err,
      `⚠ <b>No se copió una operación</b>\n${cmd.base_symbol || ''}: ${label}.\nRevisa tu Copy trading.`).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
