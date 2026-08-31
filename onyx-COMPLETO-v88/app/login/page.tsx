'use client';
import { dictFor } from '@/lib/i18n';
import { Suspense, useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser, passkeySupported } from '@/lib/supabaseBrowser';
import TwoFactor from '@/app/TwoFactor';
import Turnstile, { TURNSTILE_KEY } from '@/app/Turnstile';
import { setPending } from '@/lib/pendingCheckout';

type Lang = 'es' | 'en';

const T = {
  es: {
    signupT: 'Crear cuenta', loginT: 'Entrar', email: 'Email', pass: 'Contraseña',
    name: 'Nombre', namePh: 'Jerry', lastName: 'Apellido', lastNamePh: 'Pérez', errName: 'Escribe tu nombre y tu apellido.',
    haveAcc: '¿Ya tienes cuenta?', noAcc: '¿No tienes cuenta?', goLogin: 'Entrar', goSignup: 'Crear una',
    back: '← Volver al inicio', loading: 'Cargando…',
    errBad: 'Email o contraseña incorrectos.',
    errExists: 'Ya existe una cuenta con ese email. Inicia sesión.',
    errShort: 'La contraseña debe tener al menos 8 caracteres.',
    errWeak: 'Contraseña muy débil. Usa 10+ caracteres con al menos una letra y un número.',
    errMail: 'Escribe un email válido.',
    errTerms: 'Debes aceptar los términos para crear la cuenta.',
    errCaptcha: 'Completa la verificación de seguridad.',
    errGeneric: 'No pudimos completar la operación. Inténtalo de nuevo.',
    strength: ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Excelente'],
    strengthHint: 'Usa 10+ caracteres con al menos una letra y un número.',
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
    name: 'First name', namePh: 'Jerry', lastName: 'Last name', lastNamePh: 'Smith', errName: 'Enter your first and last name.',
    haveAcc: 'Already have an account?', noAcc: 'No account yet?', goLogin: 'Sign in', goSignup: 'Create one',
    back: '← Back to home', loading: 'Loading…',
    errBad: 'Wrong email or password.',
    errExists: 'An account with that email already exists. Sign in instead.',
    errShort: 'Password must be at least 8 characters.',
    errWeak: 'Password too weak. Use 10+ characters with at least one letter and one number.',
    errMail: 'Enter a valid email address.',
    errTerms: 'You must accept the terms to create an account.',
    errCaptcha: 'Complete the security check.',
    errGeneric: 'We could not complete the request. Please try again.',
    strength: ['Very weak', 'Weak', 'Okay', 'Strong', 'Excellent'],
    strengthHint: 'Use 10+ characters with at least one letter and one number.',
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

// Contraseñas demasiado comunes: se rechazan aunque cumplan la longitud.
const COMMON_PASS = new Set(['password', 'password1', 'passw0rd', '12345678', '123456789', '1234567890', 'qwertyuiop', '11111111', '00000000', 'contraseña', 'onyxtrading', 'trading123', 'iloveyou1', 'letmein123', 'administrador']);
// Regla de registro: mínimo 10 caracteres, al menos UNA LETRA y UN NÚMERO, y que
// no sea una contraseña común. Es exactamente la misma regla que exige Supabase
// (Letters and digits), para que nunca haya un rechazo inesperado del servidor.
function strongEnough(p: string): boolean {
  if (p.length < 10) return false;
  if (COMMON_PASS.has(p.toLowerCase())) return false;
  return /[a-zA-Z]/.test(p) && /\d/.test(p);
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Abre en "crear cuenta" si lo pide el modo, o si el destino es unirse a una
  // academia de un mentor (?join=) o traer un referido (?ref=): el prospecto casi
  // siempre es nuevo, así que le mostramos el registro primero.
  const [signup, setSignup] = useState(params.get('mode') === 'signup' || /[?&](join|ref)=/.test(params.get('next') || ''));
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [terms, setTerms] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);       // se envió el correo de confirmación
  const [resent, setResent] = useState(false);
  const [mfa, setMfa] = useState(false);          // pide el código de 2 pasos
  const [hp, setHp] = useState('');               // honeypot: humanos lo dejan vacío
  const [captcha, setCaptcha] = useState('');     // token de Turnstile (si está activo)
  const [showPass, setShowPass] = useState(false); // mostrar/ocultar contraseña
  const [pkOk, setPkOk] = useState(false);         // navegador+SDK soportan passkey
  useEffect(() => { setPkOk(passkeySupported()); }, []);
  const { lang } = useLang();
  const t = dictFor(T, lang);
  const sb = supabaseBrowser();

  // Validación antes de llamar a Supabase, para dar el mensaje en su idioma
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passOk = pass.length >= 8;                 // login: mínimo histórico
  const passStrong = strongEnough(pass);           // registro: regla fuerte
  const nameOk = name.trim().length >= 2 && lastName.trim().length >= 2; // nombre Y apellido
  const fullName = `${name.trim()} ${lastName.trim()}`.trim();
  const score = scorePass(pass);
  const formOk = mailOk && passOk && (!signup || (terms && nameOk && passStrong));

  // Plan preseleccionado (desde el landing de mentores). Si viene, tras registrarse
  // o entrar lo mandamos directo al checkout de ese plan en /pricing.
  const planParam = (params.get('plan') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const annualParam = params.get('annual') === '1';
  const planDest = planParam ? '/pricing?plan=' + planParam + (annualParam ? '&annual=1' : '') : '';

  // A dónde vuelve el usuario tras confirmar el email o tras entrar.
  const nextRaw = params.get('next') || planDest || '/dashboard';
  const nextDest = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';

  // Entrar con passkey (huella/Face ID). El autenticador resuelve la cuenta solo.
  async function signInPasskey() {
    if (TURNSTILE_KEY && !captcha) { setMsg(t.errCaptcha); return; }   // espera al captcha
    setLoading(true); setMsg('');
    try {
      const { error } = await (sb as any).auth.signInWithPasskey(captcha ? { options: { captchaToken: captcha } } : undefined);
      if (error) throw error;
      try {
        const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') { setMfa(true); return; }
      } catch { /* seguimos */ }
      router.push(nextDest); router.refresh();
    } catch (e: any) {
      setMsg(authMsg(e?.message || '', t));
    } finally { setLoading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hp) { setSent(true); return; }   // honeypot relleno → es un bot; fingimos éxito
    if (signup && !nameOk) { setMsg(t.errName); return; }
    if (!mailOk) { setMsg(t.errMail); return; }
    if (!passOk) { setMsg(t.errShort); return; }
    if (signup && !passStrong) { setMsg(t.errWeak); return; }
    if (signup && !terms) { setMsg(t.errTerms); return; }
    if (TURNSTILE_KEY && !captcha) { setMsg(t.errCaptcha); return; }
    setLoading(true); setMsg('');
    const cap = captcha || undefined;
    try {
      if (signup) {
        // Respaldo local (por si el correo se abre en el mismo navegador).
        if (planParam) setPending(planParam, annualParam);
        // DURADERO: el plan viaja por la URL del correo. Tras confirmar, Supabase
        // vuelve a /confirmado (página de bienvenida con login rápido) llevando el
        // idioma y el plan; de ahí al onboarding y al checkout. Así no se pierde
        // aunque el correo se abra en otro dispositivo/navegador.
        const planQS = planParam ? `&plan=${planParam}${annualParam ? '&annual=1' : ''}` : '';
        const onbDest = planParam ? `/onboarding?plan=${planParam}${annualParam ? '&annual=1' : ''}` : '/onboarding';
        const emailRedirectTo = typeof window !== 'undefined'
          ? `${window.location.origin}/confirmado?lang=${lang}${planQS}` : undefined;
        // CLAVE: guardamos el plan pendiente en los METADATOS de la cuenta, en el
        // mismo instante del registro (momento garantizado). El servidor del
        // dashboard lo lee y lleva al checkout. Esto NO depende del navegador, del
        // dispositivo, de /confirmado ni de que haya sesión al confirmar el email.
        const { data, error } = await sb.auth.signUp({
          email: email.trim(), password: pass, options: {
            emailRedirectTo,
            data: { full_name: fullName, first_name: name.trim(), last_name: lastName.trim(), lang, pending_plan: planParam || null, pending_plan_annual: annualParam },
            captchaToken: cap,
          },
        });
        if (error) throw error;
        // Confirmación ACTIVADA → aún sin sesión: "revisa tu correo". Si está
        // desactivada, ya hay sesión y entramos directo al onboarding con el plan.
        if (data.session) { router.push(onbDest); router.refresh(); }
        else { setSent(true); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass, options: { captchaToken: cap } });
        if (error) throw error;
        // ¿Tiene verificación en dos pasos? Si el nivel requerido es aal2 y aún
        // no lo alcanzó, pedimos el código antes de entrar.
        try {
          const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
          if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') { setMfa(true); return; }
        } catch { /* si falla la comprobación, seguimos */ }
        router.push(nextDest); router.refresh();
      }
    } catch (e: any) {
      setMsg(authMsg(e?.message || '', t));
    } finally { setLoading(false); }
  }

  async function resend() {
    setResent(false);
    try {
      const planQS = planParam ? `&plan=${planParam}${annualParam ? '&annual=1' : ''}` : '';
      const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/confirmado?lang=${lang}${planQS}` : undefined;
      await sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo } });
      setResent(true);
    } catch { setResent(true); }
  }

  // ── Pantalla de verificación en dos pasos ────────────────────
  if (mfa) {
    return (
      <div className="center">
        <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
        </Link>
        <div className="card">
          <TwoFactor mode="challenge" lang={lang} onDone={() => { router.push(nextDest); router.refresh(); }} />
        </div>
      </div>
    );
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
  const barColors = ['#e2531f', '#e2531f', '#f0a020', 'var(--green)', 'var(--green)'];
  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{signup ? t.signupT : t.loginT}</h2>
        <form onSubmit={submit}>
          {/* Honeypot: invisible para humanos, los bots lo rellenan. */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
          {signup && (
            <>
              <label>{t.name}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} required autoComplete="given-name" />
              <div style={{ height: 12 }} />
              <label>{t.lastName}</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t.lastNamePh} required autoComplete="family-name" />
              <div style={{ height: 12 }} />
            </>
          )}
          <label>{t.email}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" inputMode="email" />
          <div style={{ height: 12 }} />
          <label>{t.pass}</label>
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} required minLength={8} style={{ paddingRight: 44, width: '100%' }} autoComplete={signup ? 'new-password' : 'current-password'} />
            <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? (lang === 'en' ? 'Hide password' : 'Ocultar contraseña') : (lang === 'en' ? 'Show password' : 'Mostrar contraseña')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--mut)', display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}>
              {showPass ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>

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

          <Turnstile onToken={setCaptcha} />

          <div style={{ height: 18 }} />
          <button className="btn btn-primary" style={{ width: '100%', opacity: formOk ? 1 : .5 }} disabled={loading || !formOk}>
            {loading ? '...' : signup ? t.signupT : t.loginT}
          </button>

          {!signup && pkOk && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--mut)', fontSize: 12 }}>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />{lang === 'en' ? 'or' : 'o'}<span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              <button type="button" className="btn btn-ghost" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={loading} onClick={signInPasskey}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3 19 4" /><path d="m16 6 3 3" /><path d="m14 8 2 2" /></svg>
                {lang === 'en' ? 'Sign in with passkey' : 'Entrar con passkey'}
              </button>
            </>
          )}
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
