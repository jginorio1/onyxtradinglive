import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authAccount } from '@/lib/copyAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET · la EA esclava pide sus comandos pendientes (y los marca como tomados).
export async function GET(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ error: 'invalid api key' }, { status: 401 });

  const { data: cmds } = await supabaseAdmin.from('copy_commands')
    .select('id,action,master_ticket,base_symbol,side,volume_hint,sl,tp,price,payload')
    .eq('slave_account_id', a.account.id).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(50);

  if (cmds?.length) {
    await supabaseAdmin.from('copy_commands')
      .update({ status: 'taken', taken_at: new Date().toISOString() })
      .in('id', cmds.map((c) => c.id));
  }
  return NextResponse.json({ commands: cmds || [] });
}

// POST · la EA esclava confirma el resultado de un comando. Escribe en el log.
export async function POST(req: Request) {
  const a = await authAccount(req);
  if (!a) return NextResponse.json({ error: 'invalid api key' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.command_id || '');
  if (!id) return NextResponse.json({ error: 'missing command_id' }, { status: 400 });

  const ok = !!b.ok;
  const status = ok ? 'done' : (String(b.error || '') === 'symbol_not_found' ? 'skipped' : 'failed');

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
  return NextResponse.json({ ok: true });
}
