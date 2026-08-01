import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { stripe } from '@/lib/stripe';
import { accountLimit, addonSettings, retentionSettings, ensureProfile } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FIELDS = 'id,email,plan,subscription_status,stripe_customer_id,stripe_subscription_id,full_name,timezone,lang,country,experience,trade_style,platform,prop_firm,goal,notify_email,notify_weekly,notify_funding,notify_marketing,marketing_emails,created_at,pending_plan,pending_plan_at,pending_keep';
// Sin las columnas del perfil de trader, por si aún no se corrió onboarding_v1.sql
const FIELDS_BASE = 'id,email,plan,subscription_status,stripe_customer_id,stripe_subscription_id,full_name,timezone,lang,notify_email,notify_weekly,notify_funding,notify_marketing,created_at';

// GET · todo lo que necesita la página Mi cuenta
export async function GET() {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    await ensureProfile(user.id, user.email);
    const first = await supabaseAdmin.from('profiles').select(FIELDS).eq('id', user.id).maybeSingle();
    let prof: any = first.data;
    // Si faltan las columnas nuevas (SQL sin correr), reintenta con las básicas
    if (first.error) { const r = await supabaseAdmin.from('profiles').select(FIELDS_BASE).eq('id', user.id).maybeSingle(); prof = r.data; }
    const { data: plans } = await supabaseAdmin.from('plans').select('*').eq('active', true).order('sort', { ascending: true });
    let accounts: any[] = [];
    {
      const r = await supabaseAdmin.from('trading_accounts').select('id,login,broker,server,platform,balance,last_sync_at,plan_paused').eq('user_id', user.id).order('created_at', { ascending: true });
      if (r.error) { const r2 = await supabaseAdmin.from('trading_accounts').select('id,login,broker,server,platform,balance,last_sync_at').eq('user_id', user.id).order('created_at', { ascending: true }); accounts = r2.data || []; }
      else accounts = r.data || [];
    }
    const { data: keys } = await supabaseAdmin.from('api_keys').select('key,label,revoked,last_used_at').eq('user_id', user.id).eq('revoked', false).limit(1);

    // Datos de la suscripción en Stripe (si tiene)
    let sub: any = null;
    if (prof?.stripe_subscription_id) {
      try {
        const s: any = await stripe.subscriptions.retrieve(prof.stripe_subscription_id);
        sub = {
          status: s.status,
          currentPeriodEnd: s.current_period_end ? s.current_period_end * 1000 : null,
          cancelAtPeriodEnd: !!s.cancel_at_period_end,
          interval: s.items?.data?.[0]?.price?.recurring?.interval || 'month',
          amount: (s.items?.data?.[0]?.price?.unit_amount || 0) / 100,
          currency: (s.items?.data?.[0]?.price?.currency || 'usd').toUpperCase(),
        };
      } catch { /* la suscripción pudo borrarse en Stripe */ }
    }

    const limit = await accountLimit(user.id);
    const addons = await addonSettings();
    const retention = await retentionSettings();

    // Cambio de plan programado (downgrade diferido): qué, cuándo y qué implica.
    let pending: any = null;
    if (prof?.pending_plan) {
      const pRow: any = (plans || []).find((x: any) => x.id === prof.pending_plan);
      const base = Number(pRow?.max_accounts ?? 1);
      const unlimited = base >= 999;
      const losesCopy = !(pRow?.capabilities as any)?.copy;
      pending = {
        plan: prof.pending_plan,
        planName: pRow?.name || prof.pending_plan,
        planNameEn: pRow?.name_en || pRow?.name || prof.pending_plan,
        at: prof.pending_plan_at,
        newMax: unlimited ? null : base,
        overBy: unlimited ? 0 : Math.max(0, accounts.length - base),
        losesCopy,
        keep: Array.isArray(prof.pending_keep) ? prof.pending_keep : [],
      };
    }

    return NextResponse.json({
      limit, addons, retention, pending,
      profile: prof || null,
      plans: plans || [],
      accounts,
      apiKey: keys?.[0]?.key || null,
      subscription: sub,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PATCH · guardar datos del perfil y preferencias
export async function PATCH(req: Request) {
  try {
    const sb = createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

    const b = await req.json();
    const fields: any = {};
    ['full_name', 'timezone', 'lang', 'country', 'prop_firm'].forEach((k) => { if (b[k] !== undefined) fields[k] = String(b[k] || '').slice(0, 120); });
    // Campos de lista del perfil con lista fija (experiencia y meta)
    const OPTS: Record<string, string[]> = {
      experience: ['novato', 'intermedio', 'avanzado', 'pro'],
      goal: ['pasar_challenge', 'consistencia', 'crecer', 'vivir'],
    };
    Object.keys(OPTS).forEach((k) => { if (b[k] !== undefined && (b[k] === '' || OPTS[k].includes(String(b[k])))) fields[k] = b[k] ? String(b[k]) : null; });
    // Plataforma y tipo de trader ahora vienen del catálogo del admin (editable),
    // así que aceptamos cualquier código saneado en vez de una lista fija.
    ['platform', 'trade_style'].forEach((k) => { if (b[k] !== undefined) fields[k] = b[k] ? String(b[k]).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) : null; });
    ['notify_email', 'notify_weekly', 'notify_funding', 'notify_marketing'].forEach((k) => { if (b[k] !== undefined) fields[k] = !!b[k]; });
    // El toggle "Novedades y ofertas" (notify_marketing) es la MISMA decisión que el
    // opt-out de campañas (marketing_emails). Los mantenemos sincronizados para que el
    // toggle controle de verdad quién recibe campañas.
    if (b.notify_marketing !== undefined) fields.marketing_emails = !!b.notify_marketing;
    // Cuentas a conservar cuando aplique un downgrade (solo ids propias, sanea)
    if (b.pending_keep !== undefined) {
      const ids = Array.isArray(b.pending_keep) ? b.pending_keep.map((x: any) => String(x)).slice(0, 100) : [];
      const { data: own } = await supabaseAdmin.from('trading_accounts').select('id').eq('user_id', user.id);
      const ownSet = new Set((own || []).map((a: any) => String(a.id)));
      fields.pending_keep = ids.filter((id: string) => ownSet.has(id));
    }
    if (!Object.keys(fields).length) return NextResponse.json({ ok: true });

    const { error } = await supabaseAdmin.from('profiles').update(fields).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
