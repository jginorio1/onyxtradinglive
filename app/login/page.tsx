'use client';
import { Suspense, useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Lang = 'es' | 'en';

const T = {
  es: {
    signupT: 'Crear cuenta', loginT: 'Entrar', email: 'Email', pass: 'Contraseña',
    name: 'Nombre', namePh: 'Jerry', errName: 'Escribe tu nombre.',
    haveAcc: '¿Ya tienes cuenta?', noAcc: '¿No tienes cuenta?', goLogin: 'Entrar', goSignup: 'Crear una',
    back: '← Volver al inicio', loading: 'Cargando…',
    errBad: 'Email o contraseña incorrectos.',
    errExists: 'Ya existe una cuenta con ese email. Inicia sesión.',
    errShort: 'La contraseña debe tener al menos 8 caracteres.',
    errMail: 'Escribe un email válido.',
    errTerms: 'Debes aceptar los términos para crear la cuenta.',
    errGeneric: 'No pudimos completar la operación. Inténtalo de nuevo.',
    strength: ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Excelente'],
    strengthHint: 'Usa 8+ caracteres, con mayúsculas, números o símbolos.',
    terms: 'Acepto los', termsLink: 'términos y la política de privacidad',
    // Pantalla de confirmación
    checkT: 'Revisa tu correo',
    checkD: 'Te enviamos un enlace de confirmación a',
    checkD2: 'Haz clic en el enlace para activar tu cuenta y entrar.',
    checkSpam: '¿No lo ves? Mira en spam o promociones. Puede tardar 1-2 minutos.',
    resend: 'Reenviar enlace', resent: 'Enlace reenviado.', gotoLogin: 'Ya lo confirmé, entrar',
    // Si la confirmación está desactivada y ya hay sesión
    createdNow: 'Cuenta creada. Entrando…',
  },
  en: {
    signupT: 'Create account', loginT: 'Sign in', email: 'Email', pass: 'Password',
    name: 'Name', namePh: 'Jerry', errName: 'Enter your name.',
    haveAcc: 'Already have an account?', noAcc: 'No account yet?', goLogin: 'Sign in', goSignup: 'Create one',
    back: '← Back to home', loading: 'Loading…',
    errBad: 'Wrong email or password.',
    errExists: 'An account with that email already exists. Sign in instead.',
    errShort: 'Password must be at least 8 characters.',
    errMail: 'Enter a valid email address.',
    errTerms: 'You must accept the terms to create an account.',
    errGeneric: 'We could not complete the request. Please try again.',
    strength: ['Very weak', 'Weak', 'Okay', 'Strong', 'Excellent'],
    strengthHint: 'Use 8+ characters, with uppercase, numbers or symbols.',
    terms: 'I accept the', termsLink: 'terms and privacy policy',
    checkT: 'Check your email',
    checkD: 'We sent a confirmation link to',
    checkD2: 'Click the link to activate your account and sign in.',
    checkSpam: "Don't see it? Check spam or promotions. It may take 1-2 minutes.",
    resend: 'Resend link', resent: 'Link resent.', gotoLogin: 'I confirmed it, sign in',
    createdNow: 'Account created. Signing in…',
  },
};

// Traduce los mensajes que devuelve Supabase (siempre vienen en inglés)
function authMsg(raw: string, t: any) {
  const m = (raw || '').toLowerCase();
  if (m.includes('invalid login')) return t.errBad;
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) return t.errExists;
  if (m.includes('password') && (m.includes('6') || m.includes('8') || m.includes('short') || m.includes('least'))) return t.errShort;
  if (m.includes('valid email') || m.includes('invalid email')) return t.errMail;
  return raw || t.errGeneric;
}

// Puntúa la contraseña de 0 a 4 según longitud y variedad de caracteres.
function scorePass(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += 0.5;
  return Math.max(0, Math.min(4, Math.round(s)));
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [signup, setSignup] = useState(params.get('mode') === 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [terms, setTerms] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);       // se envió el correo de confirmación
  const [resent, setResent] = useState(false);
  const { lang } = useLang();
  const t = T[lang];
  const sb = supabaseBrowser();

  // Validación antes de llamar a Supabase, para dar el mensaje en su idioma
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passOk = pass.length >= 8;
  const nameOk = name.trim().length >= 2;
  const score = scorePass(pass);
  const formOk = mailOk && passOk && (!signup || (terms && nameOk));

  // A dónde vuelve el usuario tras confirmar el email o tras entrar.
  const nextRaw = params.get('next') || '/dashboard';
  const nextDest = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (signup && !nameOk) { setMsg(t.errName); return; }
    if (!mailOk) { setMsg(t.errMail); return; }
    if (!passOk) { setMsg(t.errShort); return; }
    if (signup && !terms) { setMsg(t.errTerms); return; }
    setLoading(true); setMsg('');
    try {
      if (signup) {
        // Tras confirmar el email, Supabase redirige aquí; el gate del dashboard
        // envía a /onboarding la primera vez.
        const emailRedirectTo = typeof window !== 'undefined'
          ? `${window.location.origin}/onboarding` : undefined;
        const { data, error } = await sb.auth.signUp({
          email: email.trim(), password: pass, options: { emailRedirectTo, data: { full_name: name.trim() } },
        });
        if (error) throw error;
        // Si la confirmación de email está ACTIVADA, no hay sesión todavía →
        // mostramos la pantalla de "revisa tu correo". Si está desactivada,
        // ya hay sesión y entramos directo al onboarding.
        if (data.session) { router.push('/onboarding'); router.refresh(); }
        else { setSent(true); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
        router.push(nextDest); router.refresh();
      }
    } catch (e: any) {
      setMsg(authMsg(e?.message || '', t));
    } finally { setLoading(false); }
  }

  async function resend() {
    setResent(false);
    try {
      const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined;
      await sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo } });
      setResent(true);
    } catch { setResent(true); }
  }

  // ── Pantalla "revisa tu correo" ──────────────────────────────
  if (sent) {
    return (
      <div className="center">
        <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
        </Link>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>📩</div>
          <h2 style={{ margin: '12px 0 8px' }}>{t.checkT}</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            {t.checkD} <b style={{ color: 'var(--tx)' }}>{email.trim()}</b>. {t.checkD2}
          </p>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{t.checkSpam}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={resend}>{t.resend}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setSent(false); setSignup(false); }}>{t.gotoLogin}</button>
          </div>
          {resent && <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>{t.resent}</p>}
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
          <Link href="/">{t.back}</Link>
        </p>
      </div>
    );
  }

  // ── Formulario de entrar / crear cuenta ──────────────────────
  const barColors = ['#e2531f', '#e2531f', '#f0a020', '#34e2a0', '#34e2a0'];
  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{signup ? t.signupT : t.loginT}</h2>
        <form onSubmit={submit}>
          {signup && (
            <>
              <label>{t.name}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} required autoComplete="given-name" />
              <div style={{ height: 12 }} />
            </>
          )}
          <label>{t.email}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div style={{ height: 12 }} />
          <label>{t.pass}</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={8} />

          {signup && pass.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < score ? barColors[score] : 'var(--line)' }} />
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {t.strength[score]} · {t.strengthHint}
              </p>
            </div>
          )}

          {signup && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--mut)', marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ width: 'auto', marginTop: 2 }} />
              <span>{t.terms} <Link href="/terms" style={{ color: 'var(--brand)' }} target="_blank">{t.termsLink}</Link>.</span>
            </label>
          )}

          <div style={{ height: 18 }} />
          <button className="btn btn-primary" style={{ width: '100%', opacity: formOk ? 1 : .5 }} disabled={loading || !formOk}>
            {loading ? '...' : signup ? t.signupT : t.loginT}
          </button>
        </form>
        {msg && <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>{msg}</p>}
        <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>
          {signup ? t.haveAcc : t.noAcc}{' '}
          <a style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={() => { setSignup(!signup); setMsg(''); }}>
            {signup ? t.goLogin : t.goSignup}
          </a>
        </p>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
        <Link href="/">{t.back}</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="center"><p className="muted">…</p></div>}>
      <LoginInner />
    </Suspense>
  );
}
