'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Certificado verificable de Onyx Academy. Imprimible a PDF desde el navegador.
export default function Certificado() {
  const { code } = useParams<{ code: string }>();
  const { lang } = useLang();
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [c, setC] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    fetch('/api/academy/certificate?code=' + encodeURIComponent(String(code))).then((r) => r.json())
      .then((j) => { if (j.certificate) { setC(j.certificate); setState('ok'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }, [code]);

  if (state === 'loading') return <div className="wrap" style={{ padding: '60px 22px' }}><p className="muted">…</p></div>;
  if (state === 'missing') return <div className="wrap" style={{ padding: '60px 22px', textAlign: 'center' }}><h1>{L('Certificado no encontrado', 'Certificate not found')}</h1></div>;

  const date = new Date(c.issued_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="wrap" style={{ padding: '40px 22px 60px', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ border: '3px solid var(--gold)', borderRadius: 18, padding: '48px 40px', textAlign: 'center', background: 'var(--card)', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--brand)' }}><OnyxIcon name="graduation" size={30} /><span style={{ fontSize: 20, fontWeight: 800 }}>Onyx Academy</span></div>
        <div className="muted" style={{ textTransform: 'uppercase', letterSpacing: '.2em', fontSize: 13, marginTop: 22 }}>{L('Certificado de finalización', 'Certificate of completion')}</div>
        <div className="muted" style={{ fontSize: 15, marginTop: 20 }}>{L('Se otorga a', 'Awarded to')}</div>
        <h1 style={{ fontSize: 34, margin: '8px 0', letterSpacing: '-.5px' }}>{c.student}</h1>
        <div className="muted" style={{ fontSize: 15 }}>{L('por completar el curso', 'for completing the course')}</div>
        <div style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px', color: 'var(--gold)' }}>{c.title}</div>
        <div className="muted" style={{ fontSize: 14 }}>{L('en la academia', 'at')} <b style={{ color: 'var(--tx)' }}>{c.academy}</b></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 12.5, color: 'var(--mut)' }}>
          <span>{date}</span>
          <span>{L('Código de verificación', 'Verification code')}: {c.code}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 18 }} className="no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>{L('Descargar / Imprimir', 'Download / Print')}</button>
      </div>
    </div>
  );
}
