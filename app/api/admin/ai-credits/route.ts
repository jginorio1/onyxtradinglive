import { NextResponse } from 'next/server';
import { getAdmin, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { aiAllowance } from '@/lib/aiLimits';
import { canUserAction } from '@/lib/perms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Consultas de Onyx AI de un usuario (gestión manual desde el panel de admin).
//  · GET  → su tope del mes, lo usado, lo que queda y los paquetes extra.
//  · POST → DAR consultas (regalo, cents=0, consumible del mes) o REINICIAR
//    (borrar los paquetes extra del mes en curso). Nunca cobra: es cortesía.
function periodNow(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: Request) {
  const { isAdmin } = await getAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  try {
    const allowance = await aiAllowance(id);
    const period = periodNow();
    const { data: packs } = await supabaseAdmin.from('ai_packs')
      .select('qty,cents,created_at').eq('user_id', id).eq('period', period)
      .order('created_at', { ascending: false });
    return NextResponse.json({ allowance, packs: packs || [], period });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin, user, role, perms } = await getAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    // Dar/reponer créditos de IA cuesta dinero: exige el permiso fino 'aicredits'.
    if (!canUserAction(role, perms, 'aicredits')) return NextResponse.json({ error: 'Sin permiso para dar/reponer créditos de IA', code: 'noperm' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const id = String(b.id || '');
    const action = String(b.action || 'grant');   // 'grant' | 'clear'
    if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const period = periodNow();

    if (action === 'clear') {
      await supabaseAdmin.from('ai_packs').delete().eq('user_id', id).eq('period', period);
      await logAdmin(user.email, 'ai_credits', id, { action: 'clear', period });
      const allowance = await aiAllowance(id);
      return NextResponse.json({ ok: true, allowance });
    }

    // grant: suma consultas de cortesía al mes en curso (sin cobro).
    const qty = Math.round(Number(b.qty));
    if (!Number.isFinite(qty) || qty === 0) return NextResponse.json({ error: 'Cantidad inválida.', code: 'bad_qty' }, { status: 400 });
    await supabaseAdmin.from('ai_packs').insert({ user_id: id, period, qty, cents: 0 });
    await logAdmin(user.email, 'ai_credits', id, { action: 'grant', qty, period });
    const allowance = await aiAllowance(id);
    return NextResponse.json({ ok: true, allowance, added: qty });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
