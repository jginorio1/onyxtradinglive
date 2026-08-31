'use client';
import { dictFor } from '@/lib/i18n';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { Article, CATEGORIES, ARTICLES } from '@/lib/guide';
import GuideBody from '../GuideBody';

const T: any = {
  es: {
    guide: 'Guía', back: '← Volver a la guía',
    helpful: '¿Te sirvió?', thanks: 'Gracias por decírnoslo.',
    next: 'Siguiente', prev: 'Anterior',
    signup: 'Crea tu cuenta gratis',
    min: 'min de lectura', updated: 'Nuevo',
  },
  en: {
    guide: 'Guide', back: '← Back to the guide',
    helpful: 'Was this useful?', thanks: 'Thanks for telling us.',
    next: 'Next', prev: 'Previous',
    signup: 'Create your free account',
    min: 'min read', updated: 'New',
  },
};

export default function ArticleView({ slug }: { slug: string }) {
  const { lang } = useLang();
  const t = dictFor(T, lang);
  const [voted, setVoted] = useState(false);

  // Guías fusionadas (código + las del dueño). Partimos de las del código para
  // pintar al instante, y traemos la lista completa del servidor.
  const [arts, setArts] = useState<Article[]>(ARTICLES);
  const [cats, setCats] = useState<any[]>(CATEGORIES);
  useEffect(() => {
    fetch('/api/guide').then((r) => r.json()).then((j) => {
      if (Array.isArray(j.articles)) setArts(j.articles);
      if (Array.isArray(j.categories)) setCats(j.categories);
    }).catch(() => {});
  }, []);

  // Si el CTA lleva a una zona con sesión y el visitante no la tiene,
  // enviarlo a registrarse en vez de rebotar contra el login.
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/install/status').then((r) => setAuthed(r.status !== 401)).catch(() => setAuthed(false));
  }, []);

  const a = arts.find((x) => x.slug === slug);
  if (!a) return null;

  const cat = cats.find((c) => c.id === a.cat);
  const siblings = arts.filter((x) => x.cat === a.cat);
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

      {/* Render compartido: exactamente lo que se ve (título, portada, bloques, zoom) */}
      <GuideBody article={a} lang={lang} />

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
