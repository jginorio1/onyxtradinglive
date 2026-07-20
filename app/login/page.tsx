'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [signup, setSignup] = useState(params.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const sb = supabaseBrowser();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    try {
      if (signup) {
        const { error } = await sb.auth.signUp({ email, password: pass });
        if (error) throw error;
        setMsg('Cuenta creada. Revisa tu email si te pide confirmación, o entra ya.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        router.push('/dashboard'); router.refresh();
      }
    } catch (e: any) {
      setMsg(e.message || 'Error');
    } finally { setLoading(false); }
  }

  return (
    <div className="center">
      <div className="logo" style={{ justifyContent: 'center', marginBottom: 24 }}>
        <span className="mark">◆</span> Onyx Trading Live
      </div>
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>{signup ? 'Crear cuenta' : 'Entrar'}</h2>
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div style={{ height: 12 }} />
          <label>Contraseña</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={6} />
          <div style={{ height: 18 }} />
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? '...' : signup ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>
        {msg && <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>{msg}</p>}
        <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>
          {signup ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <a style={{ color: 'var(--brand)', cursor: 'pointer' }} onClick={() => setSignup(!signup)}>
            {signup ? 'Entrar' : 'Crear una'}
          </a>
        </p>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
        <Link href="/">← Volver al inicio</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="center"><p className="muted">Cargando…</p></div>}>
      <LoginInner />
    </Suspense>
  );
}
