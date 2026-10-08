'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TwoFactor from '@/app/TwoFactor';
import LoginParticles from '@/app/login/LoginParticles';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Portón de 2FA del panel de administración: obligatorio.
// enroll = aún no lo activó · challenge = lo tiene, pedimos el código.
// Mismo chrome que el login (partículas + caja login-box + logo grande + título
// centrado) para que todos los 2FA del sitio sean congruentes.
export default function TwoFactorGate({ mode, lang }: { mode: 'enroll' | 'challenge'; lang: 'es' | 'en' }) {
  const router = useRouter();
  const es = lang === 'es';
  const title = mode === 'challenge'
    ? (es ? 'Verificación en dos pasos' : 'Two-step verification')
    : (es ? 'Activa la verificación en dos pasos' : 'Enable two-step verification');
  const sub = mode === 'challenge'
    ? (es ? 'Escribe el código de 6 dígitos de tu app de autenticación' : 'Enter the 6-digit code from your authenticator app')
    : (es ? 'El panel de administración la requiere. Actívala una vez para continuar.' : 'The admin panel requires it. Set it up once to continue.');
  return (
    <div className="center auth-center">
      <LoginParticles />
      <div className="card login-box" style={{ width: '100%', maxWidth: 460, position: 'relative' }}>
        <div className="lb-left">
          <Link href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'inherit', marginBottom: 18 }}>
            <img className="login-logo" src="/onyx-symbol.png" alt="Onyx Trading Live" style={{ width: 54, height: 54, borderRadius: 15 }} />
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.01em' }}>Onyx Trading Live</span>
          </Link>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 5 }}>{sub}</p>
          </div>
        </div>
        <div className="lb-right">
          <TwoFactor mode={mode} lang={lang} bare={mode === 'challenge'} onDone={() => router.refresh()} />
          {/* Volver a entrar: cierra la sesión (aún sin pasar 2FA) y regresa al login. */}
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12.5 }}
            onClick={async () => { try { await supabaseBrowser().auth.signOut(); } catch {} router.push('/login'); router.refresh(); }}>
            {es ? '← Volver a entrar' : '← Back to sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
