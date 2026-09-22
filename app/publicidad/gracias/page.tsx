'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function Gracias() {
  const sp = useSearchParams();
  const sid = sp.get('session_id') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'review' | 'pending' | 'error'>('loading');
  const [token, setToken] = useState('');
  const es = (typeof document !== 'undefined' && document.documentElement.lang === 'en') ? false : true;
  const L = (a: string, b: string) => (es ? a : b);

  useEffect(() => {
    if (!sid) { setState('error'); return; }
    fetch(`/api/ads/confirm?session_id=${encodeURIComponent(sid)}`).then((r) => r.json()).then((j) => {
      if (j.ok && j.paid) { setToken(j.reportToken || ''); setState(j.review ? 'review' : 'ok'); }
      else if (j.paid === false) setState('pending');
      else setState('error');
    }).catch(() => setState('error'));
  }, [sid]);

  return (
    <div className="wrap section" style={{ maxWidth: 600, textAlign: 'center' }}>
      {state === 'loading' && <p className="muted">{L('Confirmando tu pago…', 'Confirming your payment…')}</p>}
      {state === 'ok' && (
        <div className="card" style={{ padding: 30 }}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <h1 style={{ fontSize: 26, margin: '8px 0' }}>{L('¡Tu anuncio está activo!', 'Your ad is live!')}</h1>
          <p className="muted" style={{ fontSize: 15 }}>{L('Ya se está mostrando en la web. Sigue sus resultados con este enlace:', 'It’s now showing on the site. Track its results with this link:')}</p>
          {token && <Link className="btn btn-primary" href={`/publicidad/reporte/${token}`} style={{ marginTop: 12 }}>{L('Ver mi reporte', 'View my report')}</Link>}
          <div style={{ marginTop: 14 }}><Link href="/publicidad" style={{ color: 'var(--brand)', fontSize: 13.5 }}>{L('Comprar otro espacio', 'Buy another space')}</Link></div>
        </div>
      )}
      {state === 'review' && (
        <div className="card" style={{ padding: 30 }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <h1 style={{ fontSize: 24, margin: '8px 0' }}>{L('Pago recibido · en revisión', 'Payment received · under review')}</h1>
          <p className="muted" style={{ fontSize: 15 }}>{L('Nuestro equipo revisa tu arte y tu enlace (normalmente en menos de 24 h). En cuanto se apruebe, tu anuncio saldrá live automáticamente y te avisaremos.', 'Our team is reviewing your creative and link (usually under 24 h). Once approved, your ad goes live automatically and we’ll notify you.')}</p>
          {token && <Link className="btn btn-primary" href={`/publicidad/reporte/${token}`} style={{ marginTop: 12 }}>{L('Ver estado / reporte', 'View status / report')}</Link>}
        </div>
      )}
      {state === 'pending' && <div className="card" style={{ padding: 26 }}><h1 style={{ fontSize: 22 }}>{L('Pago en proceso', 'Payment processing')}</h1><p className="muted">{L('En cuanto Stripe confirme, tu anuncio se activará solo.', 'As soon as Stripe confirms, your ad will activate automatically.')}</p></div>}
      {state === 'error' && <div className="card" style={{ padding: 26 }}><h1 style={{ fontSize: 22 }}>{L('Algo salió mal', 'Something went wrong')}</h1><p className="muted">{L('No pudimos confirmar el pago. Escríbenos y lo revisamos.', 'We couldn’t confirm the payment. Contact us and we’ll check.')}</p><Link href="/publicidad" style={{ color: 'var(--brand)' }}>← {L('Volver', 'Back')}</Link></div>}
    </div>
  );
}

export default function GraciasPage() {
  return <Suspense fallback={null}><Gracias /></Suspense>;
}
