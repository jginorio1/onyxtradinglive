'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';

// Página pública de una academia (Onyx Academy). Muestra vitrina + niveles + CTA.
export default function AcademiaPublic() {
  const { code } = useParams<{ code: string }>();
  const { lang } = useLang();
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [a, setA] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    fetch('/api/academy/public?code=' + encodeURIComponent(String(code)))
      .then((r) => r.json())
      .then((j) => { if (j.academy) { setA(j.academy); setState('ok'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }, [code]);

  const price = (p: any) => {
    const cur = (p.currency || 'usd').toUpperCase();
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';
    const amt = (p.price_cents / 100).toLocaleString(undefined, { minimumFractionDigits: p.price_cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
    const base = sym ? sym + amt : amt + ' ' + cur;
    if (p.kind === 'one_time') return base + ' · ' + L('pago único', 'one-time');
    return base + '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo'));
  };
  const join = `/dashboard/academy?join=${code}`;

  if (state === 'loading') return <div className="wrap" style={{ padding: '60px 22px' }}><p className="muted">…</p></div>;
  if (state === 'missing') return (
    <div className="wrap" style={{ padding: '60px 22px', textAlign: 'center' }}>
      <h1>{L('Academia no encontrada', 'Academy not found')}</h1>
      <Link className="btn btn-primary" href="/academias" style={{ marginTop: 16 }}>{L('Ver todas las academias', 'Browse all academies')}</Link>
    </div>
  );

  const totalFree = (a.modules || []).reduce((s: number, m: any) => s + m.freeCount, 0);

  return (
    <div className="wrap" style={{ padding: '48px 22px 60px', maxWidth: 940, margin: '0 auto' }}>
      <Link href="/academias" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>← Onyx Academy</Link>

      {/* Hero */}
      <div className="card" style={{ marginTop: 14, background: 'var(--grad-soft, var(--bg2))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={28} /></span>
          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-.5px' }}>{a.academy_name}</h1>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{a.mentor_name}{a.tagline ? ' · ' + a.tagline : ''}</div>
        <div className="row" style={{ gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><OnyxIcon name="users" size={14} /> {a.students} {L('alumnos', 'students')}</span>
          <span className="muted" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}><OnyxIcon name="modules" size={14} /> {(a.modules || []).length} {L('módulos', 'modules')}</span>
          {totalFree > 0 && <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{totalFree} {L('lecciones gratis', 'free lessons')}</span>}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" href={join}>{L('Unirme a la academia', 'Join the academy')}</Link>
        </div>
      </div>

      {a.about && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>{L('Sobre la academia', 'About')}</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.about}</p>
        </div>
      )}

      {/* Niveles */}
      {(a.products || []).length > 0 && (
        <>
          <h2 style={{ margin: '10px 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ color: 'var(--gold)', display: 'inline-flex' }}><OnyxIcon name="gem" size={20} /></span> {L('Niveles', 'Tiers')}
          </h2>
          <div className="grid g3">
            {a.products.map((p: any) => (
              <div key={p.id} className="card">
                <div style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</div>
                {p.description && <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{p.description}</p>}
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', margin: '8px 0 12px' }}>{price(p)}</div>
                <Link className="btn btn-primary" href={join} style={{ width: '100%', textAlign: 'center' }}>{L('Empezar', 'Get started')}</Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Vitrina de módulos */}
      {(a.modules || []).length > 0 && (
        <>
          <h2 style={{ margin: '18px 0 4px' }}>{L('Contenido', 'Content')}</h2>
          {a.modules.map((m: any) => (
            <div key={m.id} className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: m.description ? 4 : 10 }}>
                <span className="card-ic"><OnyxIcon name="modules" size={16} /></span> {m.title}
              </h3>
              {m.description && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{m.description}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {m.lessons.map((l: any) => (
                  <div key={l.id} className="row" style={{ gap: 10, alignItems: 'center', fontSize: 13.5 }}>
                    <span style={{ color: l.is_free ? 'var(--green)' : 'var(--mut)', display: 'inline-flex' }}>
                      {l.is_free ? '▷' : <OnyxIcon name="guardian" size={13} />}
                    </span>
                    <span style={{ flex: 1 }}>{l.title}</span>
                    {l.is_free && <span className="pill" style={{ fontSize: 10, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('gratis', 'free')}</span>}
                  </div>
                ))}
                {m.lessons.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{L('Próximamente.', 'Coming soon.')}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link className="btn btn-primary" href={join}>{L('Unirme a la academia', 'Join the academy')}</Link>
      </div>
    </div>
  );
}
