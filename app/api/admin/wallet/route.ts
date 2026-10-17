import { NextResponse } from 'next/server';
import { requirePerm, logAdmin } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { balance, movements, adminAdjust } from '@/lib/wallet';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET ?q=email · busca un usuario y devuelve su saldo + movimientos.
export async function GET(req: Request) {
  try {
    const { ok } = await requirePerm('finanzas', 'view');
    if (!ok) return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
    const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase();
    if (!q) return NextResponse.json({ user: null });
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,email,full_name').ilike('email', `%${q}%`).limit(10);
    const list = (profs || []) as any[];
    if (!list.length) return NextResponse.json({ user: null, results: [] });
    // Si hay varios, devolvemos la lista para elegir; si uno, su detalle.
    if (list.length > 1 && !list.some((p) => p.email?.toLowerCase() === q)) {
      return NextResponse.json({ results: list.map((p) => ({ id: p.id, email: p.email, name: p.full_name })) });
    }
    const u = list.find((p) => p.email?.toLowerCase() === q) || list[0];
    const [bal, mv] = await Promise.all([balance(u.id), movements(u.id, 50)]);
    return NextResponse.json({ user: { id: u.id, email: u.email, name: u.full_name }, balanceCents: bal, movements: mv });
  } catch (e: any) { await logError('admin_wallet_get', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}

// POST · ajuste manual: { userId, deltaCents, kind:'adjust'|'refund', note }
export async function POST(req: Request) {
  try {
    const g = await requirePerm('finanzas', 'manage');
    if (!g.ok) return NextResponse.json({ error: 'sin permiso' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    const userId = String(b.userId || '');
    const delta = Math.round(Number(b.deltaCents) || 0);
    const kind = b.kind === 'refund' ? 'refund' : 'adjust';
    const note = String(b.note || (kind === 'refund' ? 'Reembolso al monedero' : 'Ajuste manual')).slice(0, 200);
    if (!userId || delta === 0) return NextResponse.json({ error: 'faltan datos' }, { status: 400 });
    const r = await adminAdjust(userId, delta, kind, note, g.user?.email);
    if (!r.ok) return NextResponse.json({ error: r.reason === 'insufficient' ? 'El usuario no tiene saldo suficiente para quitar.' : 'No se pudo aplicar.' }, { status: 400 });
    try { await logAdmin(g.user?.email || '', 'wallet_adjust', userId, { deltaCents: delta, kind }); } catch {}
    return NextResponse.json({ ok: true, balanceCents: await balance(userId) });
  } catch (e: any) { await logError('admin_wallet_post', e); return NextResponse.json({ error: e?.message || 'error' }, { status: 500 }); }
}
