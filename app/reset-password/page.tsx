'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import TwoFactor from '@/app/TwoFactor';

// Página que recibe el enlace del correo de "recuperar contraseña" y permite
// escribir una nueva. Supabase (createBrowserClient con detectSessionInUrl)
// procesa el token del enlace al cargar y deja una sesión de recuperación.
// Si la cuenta tiene 2FA (MFA), Supabase exige nivel aal2 para cambiar la
// contraseña: primero pedimos el código de la app de autenticación.

const T = {
  es: {
    title: 'Nueva contraseña', help: 'Escribe tu nueva contraseña para entrar.',
    pass: 'Nueva contraseña', pass2: 'Repite la contraseña', save: 'Guardar y entrar',
    ok: 'Contraseña actualizada. Entrando…', back: '← Volver a entrar',
    weak: 'Usa 10+ caracteres con al menos una letra y un número.',
    mismatch: 'Las contraseñas no coinciden.',
    noSession: 'El enlace caducó o no es válido. Pide otro correo desde “¿Olvidaste tu contraseña?”.',
    checking: 'Verificando el enlace…', show: 'Mostrar', hide: 'Ocultar',
    mfaH: 'Tu cuenta tiene verificación en dos pasos. Escribe el código de tu app para continuar.',
    strength: ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Excelente'],
  },
  en: {
    title: 'New password', help: 'Type your new password to sign in.',
    pass: 'New password', pass2: 'Repeat password', save: 'Save and sign in',
    ok: 'Password updated. Signing in…', back: '← Back to sign in',
    weak: 'Use 10+ characters with at least one letter and one number.',
    mismatch: 'Passwords do not match.',
    noSession: 'The link expired or is invalid. Request another from “Forgot your password?”.',
    checking: 'Checking the link…', show: 'Show', hide: 'Hide',
    mfaH: 'Your account has two-step verification. Enter the code from your app to continue.',
    strength: ['Very weak', 'Weak', 'Okay', 'Strong', 'Excellent'],
  },
};

const strong = (p: string) => p.length >= 10 && /[a-zA-Z]/.test(p) && /\d/.test(p);
function scorePass(p: string) {
  if (!p) return 0; let s = 0;
  if (p.length >= 8) s++; if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++; else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += 0.5;
  return Math.max(0, Math.min(4, Math.round(s)));
}
const barColors = ['#e2531f', '#e2531f', '#f0a020', 'var(--green)', 'var(--green)'];

function ResetInner() {
  const router = useRouter();
  const { lang } = useLang();
  const es = lang !== 'en';
  const t = T[es ? 'es' : 'en'];
  const sb = supabaseBrowser();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);       // hay sesión de recuperación
  const [needMfa, setNeedMfa] = useState(false);    // la cuenta exige código 2FA
  const [mfaDone, setMfaDone] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  // ¿La cuenta necesita elevar a aal2 (2FA) antes de cambiar la contraseña?
  async function checkMfa() {
    try {
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== 'aal2' && aal.nextLevel === 'aal2') { setNeedMfa(true); return; }
    } catch {}
    try {
      const { data: f } = await sb.auth.mfa.listFactors();
      if ((f?.totp || []).some((x: any) => x.status === 'verified')) setNeedMfa(true);
    } catch {}
  }

  useEffect(() => {
    let alive = true;
    const onReady = async () => { if (!alive) return; setReady(true); setChecking(false); await checkMfa(); };
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (session?.user && alive && !ready) onReady(); });
    sb.auth.getSession().then(({ data }) => { if (!alive) return; if (data.session?.user) onReady(); else setChecking(false); });
    const to = setTimeout(() => { if (alive) setChecking(false); }, 4000);
    return () => { alive = false; clearTimeout(to); sub.subscription.unsubscribe(); };
  }, []);

  const score = scorePass(p1);

  async function save() {
    if (!strong(p1)) { setMsg(t.weak); return; }
    if (p1 !== p2) { setMsg(t.mismatch); return; }
    setBusy(true); setMsg('');
    try {
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) {
        // Si aún falta el 2FA (aal2), mostramos el paso del código.
        if (/aal2|mfa|assurance/i.test(error.message || '')) { setNeedMfa(true); setMfaDone(false); setMsg(''); return; }
        setMsg(error.message || t.weak); return;
      }
      setDone(true);
      setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 900);
    } finally { setBusy(false); }
  }

  const showMfa = ready && needMfa && !mfaDone;
  const showForm = ready && (!needMfa || mfaDone) && !done;

  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>{t.title}</h2>
        {checking && <p className="muted" style={{ fontSize: 14 }}>{t.checking}</p>}
        {!checking && !ready && <p className="muted" style={{ fontSize: 14 }}>{t.noSession}</p>}

        {showMfa && (
          <>
            <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t.mfaH}</p>
            <TwoFactor mode="challenge" lang={es ? 'es' : 'en'} onDone={() => setMfaDone(true)} />
          </>
        )}

        {showForm && (
          <>
            <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t.help}</p>
            <label>{t.pass}</label>
            <div style={{ position: 'relative' }}>
              <input type={show ? 'text' : 'password'} value={p1} onChange={(e) => setP1(e.target.value)} minLength={10} style={{ paddingRight: 66, width: '100%' }} autoComplete="new-password" />
              <button type="button" onClick={() => setShow((s) => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 12 }}>{show ? t.hide : t.show}</button>
            </div>
            {p1.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < score ? barColors[score] : 'var(--line)' }} />)}
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t.strength[score]} · {t.weak}</p>
              </div>
            )}
            <div style={{ height: 12 }} />
            <label>{t.pass2}</label>
            <input type={show ? 'text' : 'password'} value={p2} onChange={(e) => setP2(e.target.value)} minLength={10} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} autoComplete="new-password" />
            {msg && <p className="muted" style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{msg}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy || !strong(p1) || p1 !== p2} onClick={save}>{busy ? '…' : t.save}</button>
          </>
        )}

        {done && <p style={{ marginTop: 8, fontSize: 14 }}>{t.ok}</p>}
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
        <Link href="/login">{t.back}</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="center"><p className="muted">…</p></div>}>
      <ResetInner />
    </Suspense>
  );
}
