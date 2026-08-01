import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NAV_T, Lang } from '@/lib/navText';
import { serverLang } from '@/lib/locale';
import TopBarMenu from './TopBarMenu';
import LangToggle from './LangToggle';
import ThemeToggle from './ThemeToggle';
import NotifBell from './NotifBell';
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
  const lang: Lang = serverLang();
  const t = NAV_T[lang] || NAV_T.en;

  let user: any = null;
  let plan = 'free';
  let planName = '';
  let isAdmin = false;
  let eaLive: boolean | null = null;
  let caps: any = {};
  let addonAlgo = false;
  let copyActive = false;   // hay copia corriendo (enlace activo y sin pausa global)

  try {
    const sb = createSupabaseServer();
    const r = await sb.auth.getUser();
    user = r.data?.user || null;

    if (user) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('plan,is_admin,copy_paused,addon_algo').eq('id', user.id).maybeSingle();
      plan = prof?.plan || 'free';
      isAdmin = !!prof?.is_admin;
      addonAlgo = !!(prof as any)?.addon_algo;

      const { data: planRow } = await supabaseAdmin
        .from('plans').select('name,name_en,capabilities').eq('id', plan).maybeSingle();
      planName = (lang === 'en' ? (planRow?.name_en || planRow?.name) : planRow?.name) || plan;
      caps = planRow?.capabilities || {};

      // ¿La copia está corriendo? Verde si hay al menos un enlace activo y no está en pausa global.
      if (caps.copy && !prof?.copy_paused) {
        const { count: activeLinks } = await supabaseAdmin
          .from('copy_links').select('*', { count: 'exact', head: true }).eq('owner_id', user.id).eq('enabled', true);
        copyActive = (activeLinks || 0) > 0;
      }

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
  // Arriba solo las 4 herramientas del día a día (con icono). Soporte y Planes
  // viven en el menú del avatar para no saturar. Admin sigue arriba para el owner.
  const navItems = user
    ? [
        { href: '/dashboard', label: t.dashboard, icon: '📊' },
        { href: '/dashboard/keys', label: t.accounts, icon: '🔌' },
        ...(caps.manager ? [{ href: '/dashboard/manager', label: t.manager, icon: '🛡️', dot: (eaLive ? 'on' : 'off') as 'on' | 'off', dim: !eaLive, dotTitle: eaLive ? t.eaOn : t.eaOff }] : []),
        ...(caps.copy ? [{ href: '/dashboard/copy', label: t.copy, icon: '🔁', dot: (copyActive ? 'on' : 'off') as 'on' | 'off', dim: !copyActive, dotTitle: (copyActive ? (lang === 'es' ? 'Copia activa' : 'Copy on') : (lang === 'es' ? 'Copia inactiva' : 'Copy off')) }] : []),
        ...((caps.algo || addonAlgo) ? [{ href: '/dashboard/bots', label: (t as any).bots, icon: '🤖' }] : []),
        ...(caps.expenses ? [{ href: '/dashboard/expenses', label: lang === 'en' ? 'Net profit' : 'Ganancia neta', icon: '🧮' }] : []),
        ...(isAdmin ? [{ href: '/admin', label: t.admin, icon: '🛠️' }] : []),
      ]
    : [
        // "Inicio" explícito: el logo también lleva ahí, pero mucha gente no
        // sabe que un logo se puede pulsar, y desde Planes o Embajadores no
        // había ninguna otra forma de volver al landing.
        { href: '/', label: t.home },
        { href: '/analiza', label: lang === 'en' ? 'Free analysis' : 'Analiza gratis' },
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
                {eaLive ? <span className="livedot" style={{ width: 8, height: 8 }} /> : <span className="dot" style={{ background: 'var(--amber)' }} />}
                <span className="ea-dot-tx">{eaLive ? t.eaOn : t.eaOff}</span>
              </span>
            )}

            <Link className={'planpill' + (plan === 'free' ? ' free' : '')} href="/pricing">{planName}</Link>

            <NotifBell />
            <ThemeToggle />
            <TopBarMenu email={user.email || ''} initial={initial} isAdmin={isAdmin} t={t} />
          </div>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            {/* En móvil el botón "Entrar" se oculta; por eso va también dentro del menú */}
            <MainNav items={navItems} authItems={[{ href: '/login', label: t.login }, { href: '/login?mode=signup', label: t.signup }]} />
            {/* Sin sesión el selector va visible: un visitante nuevo debe encontrarlo rápido */}
            <ThemeToggle />
            <LangToggle compact />
            <Link className="btn btn-ghost btn-login" href="/login">{t.login}</Link>
            <Link className="btn btn-primary" href="/login?mode=signup">{t.signup}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
