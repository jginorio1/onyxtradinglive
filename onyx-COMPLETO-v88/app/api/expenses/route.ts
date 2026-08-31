import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logError } from '@/lib/errlog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATS = ['funding', 'vps', 'software', 'data', 'internet', 'journal', 'education', 'fees', 'other'];
const PHASES = ['p1', 'p2', 'funded', 'reset'];

async function hasExpenses(userId: string): Promise<boolean> {
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', userId).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', (prof as any)?.plan || 'free').maybeSingle();
  return !!(plan?.capabilities as any)?.expenses;
}

function monthRange(month?: string | null) {
  const now = new Date();
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, mo] = m.split('-').map(Number);
  const endDate = new Date(y, mo, 0);
  return { m, y, start: `${m}-01`, end: `${m}-${String(endDate.getDate()).padStart(2, '0')}` };
}
// Costo real de un gasto = lo pagado menos lo recuperado.
const realCost = (e: any) => Math.max(0, (Number(e.amount) || 0) - (Number(e.recovered) || 0));

export async function GET(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if (!(await hasExpenses(user.id))) return NextResponse.json({ locked: true });

    const { m, y, start, end } = monthRange(new URL(req.url).searchParams.get('month'));

    // Cuentas del usuario (para el selector y para el bruto por cuenta).
    const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id,login,nickname').eq('user_id', user.id);
    const accList = (accs || []).map((a: any) => ({ id: a.id, name: a.nickname || String(a.login) }));
    const ids = (accs || []).map((a: any) => a.id);

    // Bruto de trading del mes.
    let gross = 0;
    if (ids.length) {
      const { data: trades } = await supabaseAdmin.from('trades').select('net_profit')
        .in('account_id', ids).gte('close_time', start + 'T00:00:00').lte('close_time', end + 'T23:59:59').limit(100000);
      gross = (trades || []).reduce((s: number, t: any) => s + (Number(t.net_profit) || 0), 0);
    }

    // Gastos: los del mes + recurrentes con inicio <= fin de mes.
    const { data: all } = await supabaseAdmin.from('expenses').select('*').eq('user_id', user.id).lte('spent_on', end).order('spent_on', { ascending: false }).limit(5000);
    const applies = (e: any) => e.recurring ? true : (e.spent_on >= start && e.spent_on <= end);
    const items = (all || []).filter(applies);
    const totalExp = items.reduce((s: number, e: any) => s + realCost(e), 0);
    const byCategory: Record<string, number> = {};
    for (const e of items) byCategory[e.category] = (byCategory[e.category] || 0) + realCost(e);

    // ROI por prop firm (TODO el año): gastado vs recuperado vs ganado.
    const fundAll = (all || []).filter((e: any) => e.category === 'funding' && (e.firm || '').trim());
    const firmByAcc: Record<string, string> = {};
    const byFirm: Record<string, { spent: number; recovered: number; earned: number }> = {};
    for (const e of fundAll) {
      const f = String(e.firm).trim();
      if (!byFirm[f]) byFirm[f] = { spent: 0, recovered: 0, earned: 0 };
      byFirm[f].spent += Number(e.amount) || 0;
      byFirm[f].recovered += Number(e.recovered) || 0;
      if (e.account_id) firmByAcc[e.account_id] = f;
    }
    const firmAccs = Object.keys(firmByAcc);
    if (firmAccs.length) {
      const { data: yt } = await supabaseAdmin.from('trades').select('net_profit,account_id')
        .in('account_id', firmAccs).gte('close_time', `${y}-01-01T00:00:00`).limit(100000);
      for (const t of (yt || []) as any[]) {
        const f = firmByAcc[t.account_id]; if (f && byFirm[f]) byFirm[f].earned += Number(t.net_profit) || 0;
      }
    }
    const firms = Object.entries(byFirm).map(([firm, v]) => ({
      firm, spent: Math.round(v.spent * 100) / 100, recovered: Math.round(v.recovered * 100) / 100,
      earned: Math.round(v.earned * 100) / 100,
      roi: v.spent > 0 ? Math.round(((v.recovered + v.earned - v.spent) / v.spent) * 100) : 0,
    })).sort((a, b) => b.roi - a.roi);

    const net = Math.round((gross - totalExp) * 100) / 100;
    return NextResponse.json({
      locked: false, month: m, accounts: accList,
      gross: Math.round(gross * 100) / 100, expenses: Math.round(totalExp * 100) / 100, net,
      breakeven: Math.max(0, Math.round((totalExp - gross) * 100) / 100),
      byCategory, firms, items,
    });
  } catch (e: any) {
    await logError('expenses_get', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

function cleanRow(b: any, userId: string) {
  const amount = Number(b.amount);
  const row: any = {
    category: CATS.includes(b.category) ? b.category : 'other',
    label: b.label ? String(b.label).slice(0, 80) : null,
    amount: Math.round((amount || 0) * 100) / 100,
    currency: String(b.currency || 'USD').slice(0, 4),
    spent_on: /^\d{4}-\d{2}-\d{2}$/.test(b.spent_on) ? b.spent_on : new Date().toISOString().slice(0, 10),
    recurring: !!b.recurring,
    note: b.note ? String(b.note).slice(0, 200) : null,
    provider: b.provider ? String(b.provider).slice(0, 60) : null,
    firm: b.firm ? String(b.firm).slice(0, 40) : null,
    acc_size: b.acc_size ? Number(b.acc_size) || null : null,
    phase: PHASES.includes(b.phase) ? b.phase : null,
    account_id: b.account_id || null,
    refundable: !!b.refundable,
    recovered: Math.round((Number(b.recovered) || 0) * 100) / 100,
  };
  return row;
}

export async function POST(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if (!(await hasExpenses(user.id))) return NextResponse.json({ error: 'plan' }, { status: 403 });
    const b = await req.json().catch(() => ({} as any));
    if (!Number(b.amount) || Number(b.amount) <= 0) return NextResponse.json({ error: 'monto' }, { status: 400 });
    const { error } = await supabaseAdmin.from('expenses').insert({ user_id: user.id, ...cleanRow(b, user.id) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('expenses_post', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    const { error } = await supabaseAdmin.from('expenses').update(cleanRow(b, user.id)).eq('id', b.id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('expenses_patch', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    const b = await req.json().catch(() => ({} as any));
    if (!b.id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
    await supabaseAdmin.from('expenses').delete().eq('id', b.id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await logError('expenses_del', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
