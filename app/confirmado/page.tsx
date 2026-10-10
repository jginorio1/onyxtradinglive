'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Página puente tras confirmar el email. Supabase redirige aquí desde el enlace del
// correo. AUTO-ENTRA SIEMPRE: en cuanto la sesión del enlace queda lista, manda al
// onboarding sin pedir nada. Si tras un instante la sesión NO se activó (p. ej. el
// enlace se abrió en otro dispositivo), reenvía al LOGIN PRINCIPAL —la misma pantalla
// de siempre, con 2FA, "olvidé mi contraseña" e idioma— llevando el aviso de email
// confirmado y el destino/plan. Ya no hay un mini-login propio en esta pantalla.

type Lang = 'es' | 'en';
const T: Record<Lang, any> = {
  es: { ok: '¡Email confirmado!', okSub: 'Entrando a tu cuenta…', loading: 'Confirmando…', home: '← Ir al inicio' },
  en: { ok: 'Email confirmed!', okSub: 'Signing you in…', loading: 'Confirming…', home: '← Back to home' },
};

function Inner() {
  const [lang, setLang] = useState<Lang>('es');
  const sb = supabaseBrowser();
  const t = T[lang];

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const lg = qs.get('lang') === 'en' ? 'en' : 'es';
    setLang(lg);
    const plan = (qs.get('plan') || '').replace(/[^a-z0-9_-]/gi, '');
    const annual = qs.get('annual') === '1';
    const promo = (qs.get('promo') || '').replace(/[^a-z0-9_-]/gi, '');
    const dest = plan ? `/onboarding?plan=${plan}${annual ? '&annual=1' : ''}${promo ? `&promo=${promo}` : ''}` : '/onboarding';

    let done = false;
    // Guarda el plan en la cuenta (BD) en cuanto haya sesión: así el checkout se
    // alcanza aunque más adelante se pierda la URL. Se hace una sola vez.
    let saved = false;
    const savePlan = () => {
      if (saved || !plan) return; saved = true;
      return fetch('/api/pending-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, annual }) }).catch(() => {});
    };
    const go = async () => { if (done) return; done = true; try { await savePlan(); } catch {} window.location.replace(dest); };

    // Con sesión → entramos directo al onboarding (auto-entrar siempre).
    sb.auth.getSession().then(({ data }) => { if (data.session?.user) go(); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (session?.user) go(); });

    // Respaldo: si tras unos segundos la sesión no se estableció (enlace abierto en
    // otro navegador/dispositivo), mandamos al LOGIN PRINCIPAL con aviso + destino.
    const fb = setTimeout(() => {
      if (done) return; done = true;
      const q = `confirmed=1&lang=${lg}&next=${encodeURIComponent(dest)}${plan ? `&plan=${plan}${annual ? '&annual=1' : ''}${promo ? `&promo=${promo}` : ''}` : ''}`;
      window.location.replace(`/login?${q}`);
    }, 2500);

    return () => { clearTimeout(fb); try { sub.subscription.unsubscribe(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, margin: '4px auto 14px', borderRadius: '50%', background: 'rgba(52,226,160,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--green, #34e2a0)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 style={{ margin: '0 0 8px' }}>{t.ok}</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 4 }}>{t.okSub}</p>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
        <Link href="/">{t.home}</Link>
      </p>
    </div>
  );
}

export default function ConfirmadoPage() {
  return (
    <Suspense fallback={<div className="center"><p className="muted">…</p></div>}>
      <Inner />
    </Suspense>
  );
}
