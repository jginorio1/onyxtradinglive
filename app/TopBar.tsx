import Link from 'next/link';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NAV_T, Lang } from '@/lib/navText';
import TopBarMenu from './TopBarMenu';
import LangToggle from './LangToggle';
import MainNav from './MainNav';

// ============================================================
// Barra de navegación única, en el layout raíz.
//
// Antes cada página dibujaba la suya, así que desaparecía según dónde
// estuvieras. Ahora hay una sola: lee la sesión y el idioma en el
// servidor y decide qué enseñar. Si estás dentro, la ves en todas
// partes — landing incluido.
// ============================================================
export default async function TopBar() {
  const lang: Lang = (cookies().get('onyx_lang')?.value === 'en' ? 'en' : 'es');
  const t = NAV_T[lang];

  let user: any = null;
  let plan = 'free';
  let planName = '';
  let isAdmin = false;
  let eaLive: boolean | null = null;

  try {
    const sb = createSupabaseServer();
    const r = await sb.auth.getUser();
    user = r.data?.user || null;

    if (user) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('plan,is_admin').eq('id', user.id).maybeSingle();
      plan = prof?.plan || 'free';
      isAdmin = !!prof?.is_admin;

      const { data: planRow } = await supabaseAdmin
        .from('plans').select('name,name_en').eq('id', plan).maybeSingle();
      planName = (lang === 'en' ? (planRow?.name_en || planRow?.name) : planRow?.name) || plan;

      // ¿Está reportando algún MetaTrader? Verde si sincronizó hace menos de 2 min.
      const { data: accs } = await supabaseAdmin
        .from('trading_accounts').select('last_sync_at').eq('user_id', user.id)
        .order('last_sync_at', { ascending: false }).limit(1);
      const last = accs?.[0]?.last_sync_at;
      if (last) eaLive = (Date.now() - new Date(last).getTime()) < 120000;
      else if (accs?.length) eaLive = false;
    }
  } catch { /* si falla, enseñamos la barra de invitado y ya */ }

  const initial = (user?.email || '?').slice(0, 1).toUpperCase();

  // Enlaces según haya sesión o no. "Planes" también va dentro: si no,
  // un usuario con sesión solo llega a precios por la píldora del plan.
  const navItems = user
    ? [
        { href: '/dashboard', label: t.dashboard },
        { href: '/dashboard/keys', label: t.accounts },
        { href: '/dashboard/manager', label: t.manager },
        { href: '/dashboard/soporte', label: t.support },
        { href: '/pricing', label: t.plans },
        ...(isAdmin ? [{ href: '/admin', label: t.admin }] : []),
      ]
    : [
        // "Inicio" explícito: el logo también lleva ahí, pero mucha gente no
        // sabe que un logo se puede pulsar, y desde Planes o Embajadores no
        // había ninguna otra forma de volver al landing.
        { href: '/', label: t.home },
        { href: '/pricing', label: t.plans },
        { href: '/embajadores', label: t.ambassadors },
        { href: '/guia', label: t.guide },
      ];

  return (
    <div className="topbar">
      <div className="wrap-wide">
        {/* El logo siempre vuelve al inicio. Para el panel ya está "Panel". */}
        <Link className="logo" href="/">
          <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          Onyx Trading Live
        </Link>

        {user ? (
          <div className="row" style={{ gap: 4 }}>
            <MainNav items={navItems} />

            {eaLive !== null && (
              <span className="ea-dot" title={eaLive ? t.eaOnTitle : t.eaOffTitle}>
                <span className="dot" style={{ background: eaLive ? '#34e2a0' : 'var(--amber)' }} />
                <span className="ea-dot-tx">{eaLive ? t.eaOn : t.eaOff}</span>
              </span>
            )}

            <Link className={'planpill' + (plan === 'free' ? ' free' : '')} href="/pricing">{planName}</Link>

            <TopBarMenu email={user.email || ''} initial={initial} isAdmin={isAdmin} t={t} />
          </div>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <MainNav items={navItems} />
            {/* Sin sesión el selector va visible: un visitante nuevo debe encontrarlo rápido */}
            <LangToggle compact />
            <Link className="btn btn-ghost btn-login" href="/login">{t.login}</Link>
            <Link className="btn btn-primary" href="/login?mode=signup">{t.signup}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
