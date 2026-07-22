import Link from 'next/link';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NAV_T, Lang } from '@/lib/lang';
import TopBarMenu from './TopBarMenu';
import LangToggle from './LangToggle';

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

  return (
    <div className="topbar">
      <div className="wrap-wide">
        <Link className="logo" href={user ? '/dashboard' : '/'}>
          <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          Onyx Trading Live
        </Link>

        {user ? (
          <div className="row" style={{ gap: 4 }}>
            <div className="navl" style={{ gap: 2, marginRight: 8 }}>
              <Link className="navlink" href="/dashboard">{t.dashboard}</Link>
              <Link className="navlink" href="/dashboard/keys">{t.accounts}</Link>
              <Link className="navlink" href="/dashboard/manager">{t.manager}</Link>
              {isAdmin && <Link className="navlink" href="/admin">{t.admin}</Link>}
            </div>

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
            <div className="navl" style={{ gap: 2, marginRight: 6 }}>
              <Link className="navlink" href="/pricing">{t.plans}</Link>
              <Link className="navlink" href="/embajadores">{t.ambassadors}</Link>
            </div>
            {/* Sin sesión el selector va visible: un visitante nuevo debe encontrarlo rápido */}
            <LangToggle compact />
            <Link className="btn btn-ghost" href="/login">{t.login}</Link>
            <Link className="btn btn-primary" href="/login?mode=signup">{t.signup}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
