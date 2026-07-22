'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { ARTICLES, CATEGORIES, searchArticles, byCat } from '@/lib/guide';

const T: any = {
  es: {
    title: 'Guía de Onyx', sub: 'Todo lo que necesitas, explicado sin tecnicismos.',
    search: 'Buscar: break even, profit factor, cancelar plan…',
    noResults: 'Nada con esa palabra. Prueba con otra.',
    results: (n: number) => `${n} resultado(s)`,
    next: 'TU SIGUIENTE PASO',
    articles: (n: number) => `${n} artículo(s)`,
    all: 'Todos los artículos',
  },
  en: {
    title: 'Onyx guide', sub: 'Everything you need, explained without jargon.',
    search: 'Search: break even, profit factor, cancel plan…',
    noResults: 'Nothing with that word. Try another.',
    results: (n: number) => `${n} result(s)`,
    next: 'YOUR NEXT STEP',
    articles: (n: number) => `${n} article(s)`,
    all: 'All articles',
  },
};

// El siguiente paso depende de dónde esté de verdad, no de una lista fija.
const NEXT: any = {
  es: {
    guest:   { t: 'Empieza por aquí', d: 'Crea tu cuenta gratis y conecta tu MetaTrader. Se tarda unos minutos.', slug: 'conectar-cuenta' },
    noAcc:   { t: 'Conecta tu primera cuenta', d: 'Todavía no hay ninguna cuenta enviando datos. Es el paso que desbloquea todo lo demás.', slug: 'instalar-ea' },
    noMgr:   { t: 'Configura tu plan de trading', d: 'Ya tienes datos entrando. Ahora dile a Onyx cuándo tienes permiso para operar.', slug: 'plan-de-trading' },
    ready:   { t: 'Entiende tus números', d: 'Tu cuenta está conectada y el gestor activo. Ahora saca partido a lo que ya estás midiendo.', slug: 'expectancy' },
  },
  en: {
    guest:   { t: 'Start here', d: 'Create your free account and connect your MetaTrader. It takes a few minutes.', slug: 'conectar-cuenta' },
    noAcc:   { t: 'Connect your first account', d: 'No account is sending data yet. This is the step that unlocks everything else.', slug: 'instalar-ea' },
    noMgr:   { t: 'Set up your trading plan', d: 'Data is coming in. Now tell Onyx when you are allowed to trade.', slug: 'plan-de-trading' },
    ready:   { t: 'Understand your numbers', d: 'Your account is connected and the manager is on. Now get value from what you are already measuring.', slug: 'expectancy' },
  },
};

export default function GuideHome() {
  const { lang } = useLang();
  const t = T[lang];
  const [q, setQ] = useState('');
  const [state, setState] = useState<'guest' | 'noAcc' | 'noMgr' | 'ready'>('guest');

  // Miramos en qué punto está para no darle un consejo genérico
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/install/status');
        if (r.status === 401) { setState('guest'); return; }
        const j = await r.json();
        if (!j.connected) { setState('noAcc'); return; }
        const m = await fetch('/api/manager');
        if (!m.ok) { setState('noMgr'); return; }
        const mj = await m.json();
        const anyOn = (mj.accounts || []).some((a: any) => a.manager?.enabled);
        setState(anyOn ? 'ready' : 'noMgr');
      } catch { setState('guest'); }
    })();
  }, []);

  const found = useMemo(() => (q.trim().length >= 2 ? searchArticles(q, lang) : null), [q, lang]);
  const next = NEXT[lang][state];

  return (
    <div className="wrap" style={{ maxWidth: 900, padding: '38px 22px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <h1 style={{ fontSize: 32, letterSpacing: '-.5px' }}>{t.title}</h1>
        <p className="muted" style={{ fontSize: 15, marginTop: 8 }}>{t.sub}</p>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
        style={{ marginBottom: 22, fontSize: 15 }} aria-label={t.search} />

      {/* Resultados de búsqueda */}
      {found !== null ? (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.results(found.length)}</div>
          {!found.length && <p className="muted">{t.noResults}</p>}
          {found.map((a) => <ArticleRow key={a.slug} a={a} lang={lang} />)}
        </>
      ) : (
        <>
          {/* Siguiente paso, según su estado real */}
          <Link href={`/guia/${next.slug}`} className="card" style={{
            display: 'block', marginBottom: 26,
            border: '1px solid var(--brand)',
            background: 'linear-gradient(135deg, rgba(124,140,255,.10), transparent), var(--card)',
          }}>
            <div style={{ fontSize: 11, color: '#aeb7ff', letterSpacing: '.05em', marginBottom: 6 }}>{t.next}</div>
            <div style={{ fontSize: 18, marginBottom: 5 }}>{next.t}</div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{next.d}</div>
          </Link>

          {/* Categorías */}
          <div className="grid g2" style={{ gap: 12, marginBottom: 26 }}>
            {CATEGORIES.map((c) => {
              const n = byCat(c.id).length;
              return (
                <Link key={c.id} href={`/guia#${c.id}`} className="card" style={{ display: 'block' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontSize: 15, marginBottom: 3 }}>{(c.name as any)[lang]}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{t.articles(n)}</div>
                </Link>
              );
            })}
          </div>

          {/* Listado por categoría */}
          {CATEGORIES.map((c) => (
            <div key={c.id} id={c.id} style={{ marginBottom: 30 }}>
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>{c.icon} {(c.name as any)[lang]}</h2>
              {byCat(c.id).map((a) => <ArticleRow key={a.slug} a={a} lang={lang} />)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ArticleRow({ a, lang }: any) {
  return (
    <Link href={`/guia/${a.slug}`} style={{
      display: 'block', padding: '13px 15px', marginBottom: 8,
      background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12,
    }}>
      <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 17, lineHeight: 1.3 }}>{a.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, marginBottom: 2 }}>{a.title[lang]}</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{a.summary[lang]}</div>
        </div>
        <span className="muted" style={{ fontSize: 15 }}>→</span>
      </div>
    </Link>
  );
}
