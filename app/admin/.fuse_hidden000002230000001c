'use client';
import { useRouter } from 'next/navigation';
import TwoFactor from '@/app/TwoFactor';

// Portón de 2FA del panel de administración: obligatorio.
// enroll = aún no lo activó · challenge = lo tiene, pedimos el código.
export default function TwoFactorGate({ mode, lang }: { mode: 'enroll' | 'challenge'; lang: 'es' | 'en' }) {
  const router = useRouter();
  const es = lang === 'es';
  return (
    <div className="wrap" style={{ padding: '50px 22px' }}>
      <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
        {mode === 'enroll' && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            {es ? 'El panel de administración requiere verificación en dos pasos. Actívala una vez para continuar.'
                : 'The admin panel requires two-step verification. Set it up once to continue.'}
          </p>
        )}
        <TwoFactor mode={mode} lang={lang} onDone={() => router.refresh()} />
      </div>
    </div>
  );
}
