'use client';
import { mkL } from '@/lib/i18n';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Verificación pública de un folio de certificado del Centro de formación Onyx.
// El QR del PDF apunta aquí (…/verificar-certificado?folio=OT-XXXXXX).
export default function Page() {
  return <Suspense fallback={<div className="wrap" style={{ padding: '60px 22px' }} />}><VerificarCertificado /></Suspense>;
}

function VerificarCertificado() {
  const sp = useSearchParams();
  const { lang } = useLang();
  const L = mkL(lang);
  const [folio, setFolio] = useState('');
  const [r, setR] = useState<any>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const check = async (f: string) => {
    const q = f.trim();
    if (!q) return;
    setState('loading'); setR(null);
    try {
      const res = await fetch('/api/training/verify?folio=' + encodeURIComponent(q));
      setR(await res.json());
    } catch { setR({ valid: false }); }
    setState('done');
  };

  useEffect(() => {
    const f = sp.get('folio') || sp.get('code') || '';
    if (f) { setFolio(f); check(f); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="wrap" style={{ padding: '48px 22px 70px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--brand)' }}>
          <OnyxIcon name="guardian" size={26} />
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)' }}>{L('Verificación de certificado', 'Certificate verification')}</span>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
          {L('Introduce el folio del certificado para comprobar su autenticidad.', 'Enter the certificate ID to check its authenticity.')}
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); check(folio); }} style={{ display: 'flex', gap: 8, maxWidth: 460, margin: '0 auto 28px' }}>
        <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="OT-XXXXXX"
          style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '.06em' }} />
        <button className="btn btn-primary" type="submit" disabled={state === 'loading'}>
          {state === 'loading' ? '…' : L('Verificar', 'Verify')}
        </button>
      </form>

      {state === 'done' && r && !r.valid && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '28px 24px', textAlign: 'center', background: 'var(--card)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--red, #d94a52)', fontWeight: 700, fontSize: 16 }}>
            <OnyxIcon name="warn" size={18} /> {L('Folio no encontrado', 'ID not found')}
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            {L('Este folio no corresponde a ningún certificado emitido. Revisa que esté escrito correctamente.', 'This ID does not match any issued certificate. Please check it is typed correctly.')}
          </p>
        </div>
      )}

      {state === 'done' && r && r.valid && (
        <div style={{ border: '2px solid var(--gold)', borderRadius: 16, padding: '34px 30px', background: 'var(--card)', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 16, right: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: r.expired ? 'rgba(217,150,30,.12)' : 'rgba(28,170,110,.12)',
            color: r.expired ? '#b8791a' : '#1caa6e',
          }}>
            <OnyxIcon name={r.expired ? 'duration' : 'check'} size={13} />
            {r.expired ? L('Caducado', 'Expired') : L('Válido', 'Valid')}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--brand)' }}>
            <OnyxIcon name="graduation" size={24} />
            <span style={{ fontWeight: 800, color: 'var(--tx)' }}>{r.brand}</span>
          </div>
          <div className="muted" style={{ textTransform: 'uppercase', letterSpacing: '.2em', fontSize: 12, marginTop: 20 }}>
            {L('Certificado de finalización', 'Certificate of completion')}
          </div>
          <h1 style={{ fontSize: 30, margin: '6px 0 2px', letterSpacing: '-.5px' }}>{r.personName}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{L('completó la ruta', 'completed the track')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 0', color: 'var(--gold)' }}>{r.trackTitle}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 26px', marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--mut)' }}>
            <span><b style={{ color: 'var(--tx)' }}>{r.score}/100</b> · {L('calificación', 'score')}</span>
            <span>{L('Emitido', 'Issued')}: {fmt(r.issuedAt)}</span>
            <span>{L('Válido hasta', 'Valid until')}: {r.expiresAt ? fmt(r.expiresAt) : L('No caduca', 'No expiry')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
