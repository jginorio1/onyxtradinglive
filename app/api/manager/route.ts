import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mergeConfig, sanitize, partialsTotal, DEFAULT_CONFIG, PROP_TEMPLATES, configWarnings } from '@/lib/manager';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function me() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null as any, caps: {} as any };
  const { data: prof } = await supabaseAdmin.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const { data: plan } = await supabaseAdmin.from('plans').select('capabilities').eq('id', prof?.plan || 'free').maybeSingle();
  return { user, caps: plan?.capabilities || {} };
}

// GET · cuentas del usuario con su configuración, plantillas y últimos eventos
export async function GET() {
  try {
    const { user, caps } = await me();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });

    const { data: accounts } = await supabaseAdmin
      .from('trading_accounts').select('id,login,nickname,broker,acc_type,acc_size,last_sync_at,ea_version,server_offset,firm_template,balance,equity')
      .eq('user_id', user.id).order('created_at', { ascending: true });

    const { data: cfgs } = await supabaseAdmin.from('manager_configs').select('*').eq('user_id', user.id);
    const byAcc: any = {};
    (cfgs || []).forEach((c: any) => { byAcc[c.account_id] = c; });

    const { data: states } = await supabaseAdmin.from('manager_state').select('*').eq('user_id', user.id);
    const stByAcc: any = {};
    (states || []).forEach((s: any) => { stByAcc[s.account_id] = s; });

    const rows = (accounts || []).map((a: any) => {
      const c = byAcc[a.id];
      const live = a.last_sync_at ? (Date.now() - new Date(a.last_sync_at).getTime()) < 120000 : false;
      return {
        ...a,
        live,
        state: stByAcc[a.id] || null,
        manager: {
          enabled: !!c?.enabled,
          units: c?.units || 'pips',
          version: Number(c?.version || 0),
          config: mergeConfig(c?.config),
        },
      };
    });

    // Plantillas de prop firm: las de código, sobrescritas por las que el admin
    // haya corregido desde el panel (así se arreglan sin volver a desplegar).
    const custom = await getSetting<{ list: any[] }>('prop_templates', { list: [] });
    const firms = (custom?.list?.length ? custom.list : PROP_TEMPLATES);

    const { data: templates } = await supabaseAdmin
      .from('manager_templates').select('id,name,units,config').eq('user_id', user.id).order('created_at', { ascending: false });

    const { data: events } = await supabaseAdmin
      .from('manager_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);

    return NextResponse.json({ accounts: rows, templates: templates || [], events: events || [], caps, defaults: DEFAULT_CONFIG, firms });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// POST · guardar la configuración de una cuenta (sube la versión para que el EA la recoja)
export async function POST(req: Request) {
  try {
    const { user, caps } = await me();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    if (!caps?.manager) return NextResponse.json({ error: 'Manager not in your plan.', code: 'no_manager' }, { status: 403 });

    const b = await req.json();
    if (!b.account_id) return NextResponse.json({ error: 'Missing account.', code: 'missing_data' }, { status: 400 });

    // la cuenta tiene que ser suya
    const { data: acc } = await supabaseAdmin.from('trading_accounts').select('id').eq('id', b.account_id).eq('user_id', user.id).maybeSingle();
    if (!acc) return NextResponse.json({ error: 'Account not found.', code: 'missing_data' }, { status: 404 });

    const config = sanitize(b.config);
    if (config.partials.on && partialsTotal(config) > 100) {
      return NextResponse.json({ error: 'Partials over 100%.', code: 'partials_over' }, { status: 400 });
    }
    // los TP parciales son del plan avanzado
    if (config.partials.on && !caps?.manager_advanced) config.partials.on = false;
    // el bloqueo por noticias también
    if (config.news.on && !caps?.manager_news) config.news.on = false;

    // Estos dos son los que más se configuran mal, así que los exigimos
    // explícitamente en cuanto los límites están encendidos.
    if (config.limits.on) {
      if (!config.limits.base) {
        return NextResponse.json({ error: 'Choose the calculation base.', code: 'need_base' }, { status: 400 });
      }
      if (config.limits.reset_hour == null) {
        return NextResponse.json({ error: 'Choose the daily reset hour.', code: 'need_reset' }, { status: 400 });
      }
    }

    // Guardamos qué plantilla de firma aplicó, por si luego cambian sus reglas
    if (b.firm_template !== undefined) {
      await supabaseAdmin.from('trading_accounts')
        .update({ firm_template: String(b.firm_template || '').slice(0, 40) || null })
        .eq('id', b.account_id).eq('user_id', user.id);
    }

    const units = ['pips', 'r', 'money'].includes(b.units) ? b.units : 'pips';
    const { data: prev } = await supabaseAdmin.from('manager_configs').select('version').eq('account_id', b.account_id).maybeSingle();

    const { error } = await supabaseAdmin.from('manager_configs').upsert({
      user_id: user.id,
      account_id: b.account_id,
      enabled: !!b.enabled,
      units,
      config,
      version: Number(prev?.version || 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Avisos honestos: no bloquean, pero se muestran para que los revise
    return NextResponse.json({
      ok: true,
      version: Number(prev?.version || 0) + 1,
      warnings: configWarnings(config, b.lang === 'en' ? 'en' : 'es'),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}

// PUT · plantillas: guardar una nueva o borrar
export async function PUT(req: Request) {
  try {
    const { user } = await me();
    if (!user) return NextResponse.json({ error: 'Not signed in.', code: 'no_auth' }, { status: 401 });
    const b = await req.json();

    if (b.action === 'delete') {
      await supabaseAdmin.from('manager_templates').delete().eq('id', b.id).eq('user_id', user.id);
      return NextResponse.json({ ok: true });
    }

    const name = String(b.name || '').trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: 'Missing name.', code: 'missing_data' }, { status: 400 });

    const { error } = await supabaseAdmin.from('manager_templates').insert({
      user_id: user.id,
      name,
      units: ['pips', 'r', 'money'].includes(b.units) ? b.units : 'pips',
      config: sanitize(b.config),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
