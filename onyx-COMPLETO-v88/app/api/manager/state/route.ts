import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mergeConfig, discipline } from '@/lib/manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function ownsAccount(userId: string, accountId: string) {
  if (!accountId) return false;
  const { data } = await supabaseAdmin
    .from('trading_accounts').select('id').eq('id', accountId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// GET · estado del día de una cuenta + indicador de disciplina
export async function GET(req: Request) {
  try {
    const user = await me();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const accountId = new URL(req.url).searchParams.get('account_id') || '';
    if (accountId && !(await ownsAccount(user.id, accountId))) {
      return NextResponse.json({ error: 'Account not found.', code: 'not_found' }, { status: 404 });
    }

    let state: any = null;
    if (accountId) {
      const { data } = await supabaseAdmin.from('manager_state').select('*').eq('account_id', accountId).maybeSingle();
      state = data || null;
    }

    const disc = await discipline(user.id, accountId || null, 30);

    // últimas intervenciones, para el historial
    let q = supabaseAdmin.from('manager_events')
      .select('id,kind,detail,symbol,ticket,amount,created_at,meta')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(60);
    if (accountId) q = q.eq('account_id', accountId);
    const { data: events } = await q;

    return NextResponse.json({ state, discipline: disc, events: events || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}

// POST · pedir o cancelar el permiso temporal para saltarse una regla
//
// No es un botón de "apagar". Es fricción a propósito: pides el permiso,
// esperas los minutos que tú mismo configuraste, y solo entonces se activa.
// Todo queda registrado, porque el objetivo es que lo veas después.
export async function POST(req: Request) {
  try {
    const user = await me();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const b = await req.json().catch(() => ({} as any));
    const accountId = String(b.account_id || '').trim();
    if (!accountId) return NextResponse.json({ error: 'Missing account.', code: 'missing_data' }, { status: 400 });
    if (!(await ownsAccount(user.id, accountId))) {
      return NextResponse.json({ error: 'Account not found.', code: 'not_found' }, { status: 404 });
    }

    const { data: cfgRow } = await supabaseAdmin.from('manager_configs').select('config,enabled').eq('account_id', accountId).maybeSingle();
    const cfg = mergeConfig(cfgRow?.config);
    const now = new Date();

    // Cancelar: siempre se puede volver atrás, y eso no penaliza
    if (b.action === 'cancel') {
      await supabaseAdmin.from('manager_state')
        .update({ override_until: null, override_requested_at: null, updated_at: now.toISOString() })
        .eq('account_id', accountId);
      return NextResponse.json({ ok: true, state: 'cancelled' });
    }

    // En modo rígido no hay salida hasta el día siguiente. Fue su decisión.
    if (cfg.plan.rigidity === 'hard') {
      return NextResponse.json({ error: 'Locked until tomorrow.', code: 'override_locked' }, { status: 403 });
    }

    const { data: st } = await supabaseAdmin.from('manager_state').select('*').eq('account_id', accountId).maybeSingle();

    // Los límites de pérdida nunca se pueden saltar: son el motivo de todo esto
    if (st?.blocked_reason === 'daily_loss' || st?.blocked_reason === 'total_loss') {
      return NextResponse.json({ error: 'Loss limits cannot be overridden.', code: 'override_forbidden' }, { status: 403 });
    }

    const waitMs = (cfg.plan.rigidity === 'soft' ? 0 : cfg.plan.friction_min) * 60000;

    // Primera vez: arrancamos la cuenta atrás
    if (!st?.override_requested_at) {
      await supabaseAdmin.from('manager_state').upsert({
        user_id: user.id, account_id: accountId,
        override_requested_at: now.toISOString(), override_until: null,
        updated_at: now.toISOString(),
      }, { onConflict: 'account_id' });

      if (waitMs > 0) {
        return NextResponse.json({
          ok: true, state: 'waiting',
          ready_at: new Date(now.getTime() + waitMs).toISOString(),
          wait_min: cfg.plan.friction_min,
        });
      }
    }

    // ¿Ya pasó la espera?
    const requestedAt = new Date(st?.override_requested_at || now);
    const readyAt = new Date(requestedAt.getTime() + waitMs);
    if (readyAt > now) {
      return NextResponse.json({
        ok: true, state: 'waiting', ready_at: readyAt.toISOString(),
        remaining_min: Math.ceil((readyAt.getTime() - now.getTime()) / 60000),
      });
    }

    // Concedido: vale 60 minutos y queda registrado
    const until = new Date(now.getTime() + 60 * 60000);
    await supabaseAdmin.from('manager_state').update({
      override_until: until.toISOString(), blocked: false, updated_at: now.toISOString(),
    }).eq('account_id', accountId);

    await supabaseAdmin.from('manager_events').insert({
      user_id: user.id, account_id: accountId, kind: 'override',
      detail: `Se saltó la regla: ${st?.blocked_reason || 'desconocida'}`,
      meta: { reason: st?.blocked_reason || null, waited_min: cfg.plan.friction_min },
    });

    return NextResponse.json({ ok: true, state: 'granted', until: until.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error', code: 'generic' }, { status: 500 });
  }
}
