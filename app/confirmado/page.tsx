'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Página de bienvenida tras confirmar el email. Supabase redirige aquí desde el
// enlace del correo. Muestra "email confirmado" con la marca Onyx y, si la sesión
// aún no está lista, un login rápido en la misma pantalla. Bilingüe según ?lang.
// El plan (si venía a comprar) viaja por la URL y se pasa al onboarding.

type Lang = 'es' | 'en';
const T: Record<Lang, any> = {
  es: {
    ok: '¡Email confirmado!',
    okSub: 'Tu cuenta está lista. Continúa para terminar de configurar tu perfil.',
    continue: 'Continuar',
    needLogin: 'Inicia sesión para continuar',
    needSub: 'Tu email quedó confirmado. Entra con tu contraseña para seguir.',
    email: 'Email', pass: 'Contraseña', enter: 'Entrar',
    bad: 'Email o contraseña incorrectos.',
    loading: 'Confirmando…',
    home: '← Ir al inicio',
  },
  en: {
    ok: 'Email confirmed!',
    okSub: 'Your account is ready. Continue to finish setting up your profile.',
    continue: 'Continue',
    needLogin: 'Sign in to continue',
    needSub: 'Your email is confirmed. Sign in with your password to continue.',
    email: 'Email', pass: 'Password', enter: 'Sign in',
    bad: 'Wrong email or password.',
    loading: 'Confirming…',
    home: '← Back to home',
  },
};

function Inner() {
  const [lang, setLang] = useState<Lang>('es');
  const [authed, setAuthed] = useState<boolean | null>(null); // null = comprobando
  const [dest, setDest] = useState('/onboarding');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sb = supabaseBrowser();
  const t = T[lang];

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setLang(qs.get('lang') === 'en' ? 'en' : 'es');
    const plan = (qs.get('plan') || '').replace(/[^a-z0-9_-]/gi, '');
    const annual = qs.get('annual') === '1';
    setDest(plan ? `/onboarding?plan=${plan}${annual ? '&annual=1' : ''}` : '/onboarding');
    // Guarda el plan en la cuenta (BD) en cuanto haya sesión: así el checkout se
    // alcanza aunque más adelante se pierda la URL. Se hace una sola vez.
    let saved = false;
    const savePlan = () => {
      if (saved || !plan) return; saved = true;
      fetch('/api/pending-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, annual }) }).catch(() => {});
    };
    // La sesión puede tardar un instante en establecerse desde el enlace del correo.
    sb.auth.getSession().then(({ data }) => { const ok = !!data.session?.user; setAuthed(ok); if (ok) savePlan(); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { const ok = !!session?.user; setAuthed(ok); if (ok) savePlan(); });
    return () => { try { sub.subscription.unsubscribe(); } catch {} };
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) throw error;
      window.location.href = dest;
    } catch { setMsg(t.bad); } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card" style={{ textAlign: 'center' }}>
        {/* Marca de verificación en verde menta */}
        <div style={{ width: 64, height: 64, margin: '4px auto 14px', borderRadius: '50%', background: 'rgba(52,226,160,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--green, #34e2a0)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>

        {authed === null && <p className="muted" style={{ fontSize: 14 }}>{t.loading}</p>}

        {authed === true && (
          <>
            <h2 style={{ margin: '0 0 8px' }}>{t.ok}</h2>
            <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>{t.okSub}</p>
            <a className="btn btn-primary" href={dest} style={{ width: '100%' }}>{t.continue} →</a>
          </>
        )}

        {authed === false && (
          <>
            <h2 style={{ margin: '0 0 6px' }}>{t.ok}</h2>
            <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>{t.needSub}</p>
            <form onSubmit={login} style={{ textAlign: 'left' }}>
              <label>{t.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" inputMode="email" />
              <div style={{ height: 12 }} />
              <label>{t.pass}</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
              <div style={{ height: 18 }} />
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? '…' : t.enter}</button>
            </form>
            {msg && <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>{msg}</p>}
          </>
        )}
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
