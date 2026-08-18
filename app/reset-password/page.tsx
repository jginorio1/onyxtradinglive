'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Página que recibe el enlace del correo de "recuperar contraseña" y permite
// escribir una nueva. Supabase (createBrowserClient con detectSessionInUrl)
// procesa el token del enlace al cargar y deja una sesión de recuperación;
// entonces updateUser({ password }) la cambia.

const T = {
  es: {
    title: 'Nueva contraseña', help: 'Escribe tu nueva contraseña para entrar.',
    pass: 'Nueva contraseña', pass2: 'Repite la contraseña', save: 'Guardar y entrar',
    ok: 'Contraseña actualizada. Entrando…', back: '← Volver a entrar',
    weak: 'Usa 10+ caracteres con al menos una letra y un número.',
    mismatch: 'Las contraseñas no coinciden.',
    noSession: 'El enlace caducó o no es válido. Pide otro correo de recuperación desde “¿Olvidaste tu contraseña?”.',
    checking: 'Verificando el enlace…', show: 'Mostrar', hide: 'Ocultar',
  },
  en: {
    title: 'New password', help: 'Type your new password to sign in.',
    pass: 'New password', pass2: 'Repeat password', save: 'Save and sign in',
    ok: 'Password updated. Signing in…', back: '← Back to sign in',
    weak: 'Use 10+ characters with at least one letter and one number.',
    mismatch: 'Passwords do not match.',
    noSession: 'The link expired or is invalid. Request another recovery email from “Forgot your password?”.',
    checking: 'Checking the link…', show: 'Show', hide: 'Hide',
  },
};

const strong = (p: string) => p.length >= 10 && /[a-zA-Z]/.test(p) && /\d/.test(p);

function ResetInner() {
  const router = useRouter();
  const { lang } = useLang();
  const t = T[lang === 'en' ? 'en' : 'es'];
  const sb = supabaseBrowser();
  const [ready, setReady] = useState(false);      // hay sesión de recuperación
  const [checking, setChecking] = useState(true);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    // El evento PASSWORD_RECOVERY llega cuando Supabase procesa el enlace.
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session?.user && alive) { setReady(true); setChecking(false); }
    });
    // Respaldo: por si la sesión ya estaba lista al cargar.
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session?.user) { setReady(true); }
      setChecking(false);
    });
    const to = setTimeout(() => { if (alive) setChecking(false); }, 4000);
    return () => { alive = false; clearTimeout(to); sub.subscription.unsubscribe(); };
  }, []);

  async function save() {
    if (!strong(p1)) { setMsg(t.weak); return; }
    if (p1 !== p2) { setMsg(t.mismatch); return; }
    setBusy(true); setMsg('');
    try {
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) { setMsg(error.message || t.weak); return; }
      setDone(true);
      setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 900);
    } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 30, height: 30, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>{t.title}</h2>
        {checking && <p className="muted" style={{ fontSize: 14 }}>{t.checking}</p>}
        {!checking && !ready && <p className="muted" style={{ fontSize: 14 }}>{t.noSession}</p>}
        {!checking && ready && !done && (
          <>
            <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t.help}</p>
            <label>{t.pass}</label>
            <div style={{ position: 'relative' }}>
              <input type={show ? 'text' : 'password'} value={p1} onChange={(e) => setP1(e.target.value)} minLength={10} style={{ paddingRight: 66, width: '100%' }} autoComplete="new-password" />
              <button type="button" onClick={() => setShow((s) => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 12 }}>{show ? t.hide : t.show}</button>
            </div>
            <div style={{ height: 12 }} />
            <label>{t.pass2}</label>
            <input type={show ? 'text' : 'password'} value={p2} onChange={(e) => setP2(e.target.value)} minLength={10} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} autoComplete="new-password" />
            {msg && <p className="muted" style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{msg}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy} onClick={save}>{busy ? '…' : t.save}</button>
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
