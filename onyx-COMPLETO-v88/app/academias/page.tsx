'use client';
import { mkL } from '@/lib/i18n';
import { useLang } from '@/lib/lang';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';

// Onyx Academy es PRIVADA: no hay directorio público. Solo se entra con el código,
// el enlace o el QR del mentor. Esta página solo explica cómo unirse.
export default function Academias() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [lcPage, setLcPage] = useState<any>(null);
  const px = (k: string, fb: string) => lcPage?.[k]?.[lang] || fb;
  useEffect(() => { fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setLcPage(c?.pages?.academias || null)).catch(() => {}); }, []);
  return (
    <div className="wrap" style={{ padding: '64px 22px 80px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, letterSpacing: '-1px', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={28} /></span> Onyx Academy
      </h1>
      <p className="muted" style={{ margin: '14px auto 0', fontSize: 17 }}>
        {px('intro', L('Las academias son privadas. Solo puedes unirte con el código, el enlace o el código QR que te comparta tu mentor.',
           'Academies are private. You can only join with the code, link or QR your mentor shares with you.'))}
      </p>
      <div className="card" style={{ marginTop: 26, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><OnyxIcon emoji="🔑" size={16} /><b>{px('codeTitle', L('¿Tienes un código?', 'Have a code?'))}</b></div>
        <p className="muted" style={{ fontSize: 14 }}>{px('codeText', L('Entra a tu cuenta y pégalo en Dashboard → Onyx Academy → «Unirme a una academia».', 'Sign in and paste it in Dashboard → Onyx Academy → “Join an academy”.'))}</p>
        <Link className="btn btn-primary" href="/dashboard/academy" style={{ marginTop: 10 }}>{L('Ir a Onyx Academy', 'Go to Onyx Academy')}</Link>
      </div>
    </div>
  );
}
