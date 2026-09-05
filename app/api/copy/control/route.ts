import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { copyPinCheck, copyPinHas } from '@/lib/copyPin';
import { alertUser } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function logControl(ownerId: string, action: string, target: string | null, source = 'web') {
  await supabaseAdmin.from('copy_control_log').insert({ owner_id: ownerId, action, target, source });
}

// GET · estado del control remoto: pausa global, pausa por cuenta, PIN puesto.
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const { data: prof } = await supabaseAdmin.from('profiles')
    .select('copy_paused,copy_paused_at').eq('id', user.id).maybeSingle();
  const { data: accs } = await supabaseAdmin.from('trading_accounts')
    .select('id,login,nickname,copy_paused').eq('user_id', user.id).order('login');
  return NextResponse.json({
    paused: !!prof?.copy_paused,
    pausedAt: prof?.copy_paused_at || null,
    hasPin: await copyPinHas(user.id),
    accounts: accs || [],
  });
}

// POST · pausar / reanudar. Pausar es inmediato. Reanudar pide el PIN si lo hay.
//   body: { action: 'pause_all'|'resume_all'|'pause_account'|'resume_account', accountId?, pin? }
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: 'no auth' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const action = String(b.action || '');
  const isResume = action.startsWith('resume');

  // Seguridad asimétrica: reanudar (encender la copia en vivo) exige el PIN.
  if (isResume) {
    const ok = await copyPinCheck(user.id, String(b.pin || ''));
    if (!ok) return NextResponse.json({ error: 'PIN incorrecto.', code: 'bad_pin' }, { status: 403 });
  }

  if (action === 'pause_all' || action === 'resume_all') {
    const paused = action === 'pause_all';
    await supabaseAdmin.from('profiles')
      .update({ copy_paused: paused, copy_paused_at: paused ? new Date().toISOString() : null })
      .eq('id', user.id);
    await logControl(user.id, action, null);
    alertUser(user.id, 'copy_paused', paused ? '⏸ <b>Copia PAUSADA</b>\nNo se replicará ninguna operación.' : '▶ <b>Copia ACTIVA</b>\nVolverá a replicar las operaciones de tu master.').catch(() => {});
    return NextResponse.json({ ok: true, paused });
  }

  if (action === 'pause_account' || action === 'resume_account') {
    const accId = String(b.accountId || '');
    const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', accId).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'Cuenta no válida.' }, { status: 400 });
    const paused = action === 'pause_account';
    await supabaseAdmin.from('trading_accounts').update({ copy_paused: paused }).eq('id', accId).eq('user_id', user.id);
    await logControl(user.id, action, accId);
    return NextResponse.json({ ok: true, paused });
  }

  return NextResponse.json({ error: 'acción no válida' }, { status: 400 });
}
