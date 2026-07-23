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
    haveAcc: '¿Ya tienes cuenta?', noAcc: '¿No tienes cuenta?', goLogin: 'Entrar', goSignup: 'Crear una',
    back: '← Volver al inicio', loading: 'Cargando…',
    created: 'Cuenta creada. Revisa tu email si te pide confirmación, o entra ya.',
    errBad: 'Email o contraseña incorrectos.',
    errExists: 'Ya existe una cuenta con ese email. Inicia sesión.',
    errShort: 'La contraseña debe tener al menos 6 caracteres.',
    errMail: 'Escribe un email válido.',
    errGeneric: 'No pudimos completar la operación. Inténtalo de nuevo.',
  },
  en: {
    signupT: 'Create account', loginT: 'Sign in', email: 'Email', pass: 'Password',
    haveAcc: 'Already have an account?', noAcc: 'No account yet?', goLogin: 'Sign in', goSignup: 'Create one',
    back: '← Back to home', loading: 'Loading…',
    created: 'Account created. Check your email if confirmation is required, or sign in now.',
    errBad: 'Wrong email or password.',
    errExists: 'An account with that email already exists. Sign in instead.',
    errShort: 'Password must be at least 6 characters.',
    errMail: 'Enter a valid email address.',
    errGeneric: 'We could not complete the request. Please try again.',
  },
};

// Traduce los mensajes que devuelve Supabase (siempre vienen en inglés)
function authMsg(raw: string, t: any) {
  const m = (raw || '').toLowerCase();
  if (m.includes('invalid login')) return t.errBad;
  if (m.includes('already registered') || m.includes('already been registered')) return t.errExists;
  if (m.includes('password') && m.includes('6')) return t.errShort;
  if (m.includes('valid email') || m.includes('invalid email')) return t.errMail;
  return raw || t.errGeneric;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [signup, setSignup] = useState(params.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { lang } = useLang();
  const t = T[lang];
  const sb = supabaseBrowser();

  // Validacion antes de llamar a Supabase, para dar el mensaje en su idioma
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passOk = pass.length >= 6;
  const formOk = mailOk && passOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mailOk) { setMsg(t.errMail); return; }
    if (!passOk) { setMsg(t.errShort); return; }
    setLoading(true); setMsg('');
    try {
      if (signup) {
        const { error } = await sb.auth.signUp({ email: email.trim(), password: pass });
        if (error) throw error;
        setMsg(t.created);
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
        // Volver a donde el usuario intentaba entrar, si venía de una página protegida
        const raw = params.get('next') || '/dashboard';
        const dest = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
        router.push(dest); router.refresh();
      }
    } catch (e: any) {
      setMsg(authMsg(e?.message || '', t));
    } finally { setLoading(false); }
  }

  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{signup ? t.signupT : t.loginT}</h2>
        <form onSubmit={submit}>
          <label>{t.email}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div style={{ height: 12 }} />
          <label>{t.pass}</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={6} />
          <div style={{ height: 18 }} />
          <button className="btn btn-primary" style={{ width: '100%', opacity: formOk ? 1 : .5 }} disabled={loading || !formOk}>
            {loading ? '...' : signup ? t.signupT : t.loginT}
          </button>
        </form>
        {msg && <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>{msg}</p>}
        <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>
          {signup ? t.haveAcc : t.noAcc}{' '}
          <a style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setSignup(!signup)}>
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
