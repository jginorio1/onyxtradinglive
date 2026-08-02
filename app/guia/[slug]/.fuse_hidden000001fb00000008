'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { Article, Block, CATEGORIES, ARTICLES } from '@/lib/guide';

const T: any = {
  es: {
    guide: 'Guía', back: '← Volver a la guía',
    helpful: '¿Te sirvió?', thanks: 'Gracias por decírnoslo.',
    next: 'Siguiente', prev: 'Anterior',
    signup: 'Crea tu cuenta gratis',
  },
  en: {
    guide: 'Guide', back: '← Back to the guide',
    helpful: 'Was this useful?', thanks: 'Thanks for telling us.',
    next: 'Next', prev: 'Previous',
    signup: 'Create your free account',
  },
};

export default function ArticleView({ slug }: { slug: string }) {
  const { lang } = useLang();
  const t = T[lang];
  const [voted, setVoted] = useState(false);

  // Si el CTA lleva a una zona con sesión y el visitante no la tiene,
  // enviarlo a registrarse en vez de rebotar contra el login.
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/install/status').then((r) => setAuthed(r.status !== 401)).catch(() => setAuthed(false));
  }, []);

  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return null;

  const cat = CATEGORIES.find((c) => c.id === a.cat);
  const siblings = ARTICLES.filter((x) => x.cat === a.cat);
  const idx = siblings.findIndex((x) => x.slug === slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    // Ancho de lectura, no ancho de pantalla: pasados los 70 caracteres
    // por línea el ojo se pierde al saltar de renglón.
    <div className="wrap" style={{ maxWidth: 680, padding: '30px 22px 60px' }}>
      <Link href="/guia" className="muted" style={{ fontSize: 13 }}>{t.back}</Link>

      <div className="muted" style={{ fontSize: 12, margin: '18px 0 10px' }}>
        {t.guide} · {cat ? (cat.name as any)[lang] : ''}
      </div>
      <h1 style={{ fontSize: 26, letterSpacing: '-.4px', marginBottom: 18, lineHeight: 1.3 }}>{a.title[lang]}</h1>

      {a.body[lang].map((b, i) => <BlockView key={i} b={b} />)}

      {a.cta && (
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
          {authed === false
            ? <Link className="btn btn-primary" href="/login?mode=signup">{t.signup}</Link>
            : <Link className="btn btn-primary" href={a.cta.href}>{a.cta.label[lang]}</Link>}
        </div>
      )}

      {/* Navegación entre artículos de la misma categoría.
          Dos tarjetas que se apilan bien en móvil, en vez de dos botones
          con título largo que se montaban uno sobre otro. */}
      {(prev || next) && (
        <div className="artnav" style={{ marginTop: 24 }}>
          {prev ? (
            <Link href={`/guia/${prev.slug}`} className="artnav-card">
              <span className="muted" style={{ fontSize: 12 }}>← {t.prev}</span>
              <span style={{ fontSize: 14, marginTop: 3 }}>{prev.title[lang]}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link href={`/guia/${next.slug}`} className="artnav-card" style={{ textAlign: 'right' }}>
              <span className="muted" style={{ fontSize: 12 }}>{t.next} →</span>
              <span style={{ fontSize: 14, marginTop: 3 }}>{next.title[lang]}</span>
            </Link>
          )}
        </div>
      )}

      {/* Señal simple de si el artículo sirve. Sin formularios ni encuestas. */}
      <div className="row" style={{ gap: 10, marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        {voted ? (
          <span className="muted" style={{ fontSize: 13 }}>{t.thanks}</span>
        ) : (
          <>
            <span className="muted" style={{ fontSize: 13 }}>{t.helpful}</span>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}
              onClick={() => setVoted(true)} aria-label="Sí">👍</button>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}
              onClick={() => setVoted(true)} aria-label="No">👎</button>
          </>
        )}
      </div>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  const any = b as any;

  if (any.h) return <h2 style={{ fontSize: 18, margin: '26px 0 10px' }}>{any.h}</h2>;

  if (any.p) return (
    <p style={{ fontSize: 15, lineHeight: 1.85, color: '#c9d2e3', marginBottom: 14 }}>{any.p}</p>
  );

  if (any.note) return (
    <div style={{
      background: 'var(--bg2)', borderLeft: '3px solid var(--amber)',
      padding: '13px 15px', marginBottom: 16, borderRadius: 0,
    }}>
      {any.title && <div style={{ color: 'var(--amber)', fontSize: 12, marginBottom: 5 }}>{any.title}</div>}
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{any.note}</div>
    </div>
  );

  if (any.warn) return (
    <div style={{
      background: 'rgba(255,107,125,.06)', border: '1px solid var(--red)',
      padding: '13px 15px', marginBottom: 16, borderRadius: 10,
    }}>
      {any.title && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 5 }}>{any.title}</div>}
      <div style={{ fontSize: 14, lineHeight: 1.75, color: '#e8d5d8' }}>{any.warn}</div>
    </div>
  );

  if (any.list) return (
    <ul style={{ margin: '0 0 16px 20px', padding: 0 }}>
      {any.list.map((x: string, i: number) => (
        <li key={i} style={{ fontSize: 15, lineHeight: 1.8, color: '#c9d2e3', marginBottom: 7 }}>{x}</li>
      ))}
    </ul>
  );

  if (any.steps) return (
    <div style={{ marginBottom: 16 }}>
      {any.steps.map((x: string, i: number) => (
        <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flex: 'none', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--card2)', color: 'var(--mut)',
          }}>{i + 1}</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.7, color: '#c9d2e3' }}>{x}</span>
        </div>
      ))}
    </div>
  );

  return null;
}
