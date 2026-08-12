'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { ARTICLES, CATEGORIES, searchArticles, byCat } from '@/lib/guide';
import OnyxIcon from '@/app/components/OnyxIcon';

const T: any = {
  es: {
    title: 'Guía de Onyx', sub: 'Pregunta lo que sea, o explora por tema. Sin scroll infinito.',
    ask: 'Pregunta o busca: break even, ¿cómo evito romper mi cuenta?…',
    askBtn: 'Preguntar a Onyx', askHint: 'Onyx responde con la guía · o te lleva al artículo exacto',
    thinking: 'Onyx está pensando…', sources: 'Artículos relacionados', clear: 'Nueva pregunta',
    route: 'TU RUTA', explore: 'EXPLORA POR TEMA', results: (n: number) => `${n} resultado(s)`,
    noResults: 'Nada con esa palabra. Prueba a preguntar a Onyx.', articles: (n: number) => `${n} artículo(s)`,
    routes: ['Conecta', 'Recibe datos', 'Guardian', 'Domina'],
  },
  en: {
    title: 'Onyx guide', sub: 'Ask anything, or explore by topic. No endless scroll.',
    ask: 'Ask or search: break even, how do I avoid blowing my account?…',
    askBtn: 'Ask Onyx', askHint: 'Onyx answers from the guide · or takes you to the exact article',
    thinking: 'Onyx is thinking…', sources: 'Related articles', clear: 'New question',
    route: 'YOUR PATH', explore: 'EXPLORE BY TOPIC', results: (n: number) => `${n} result(s)`,
    noResults: 'Nothing with that word. Try asking Onyx.', articles: (n: number) => `${n} article(s)`,
    routes: ['Connect', 'Get data', 'Guardian', 'Master'],
  },
};

// El siguiente paso depende de dónde esté de verdad, no de una lista fija.
const NEXT: any = {
  es: {
    guest:   { t: 'Empieza por aquí', d: 'Crea tu cuenta gratis y conecta tu plataforma (MetaTrader o cTrader). Se tarda unos minutos.', slug: 'conectar-cuenta' },
    noAcc:   { t: 'Conecta tu primera cuenta', d: 'Todavía no hay ninguna cuenta enviando datos. Es el paso que desbloquea todo lo demás.', slug: 'instalar-ea' },
    noMgr:   { t: 'Configura tu plan de trading', d: 'Ya tienes datos entrando. Ahora dile a Onyx cuándo tienes permiso para operar.', slug: 'plan-de-trading' },
    ready:   { t: 'Entiende tus números', d: 'Tu cuenta está conectada y Onyx Guardian activo. Ahora saca partido a lo que ya estás midiendo.', slug: 'expectancy' },
  },
  en: {
    guest:   { t: 'Start here', d: 'Create your free account and connect your platform (MetaTrader or cTrader). It takes a few minutes.', slug: 'conectar-cuenta' },
    noAcc:   { t: 'Connect your first account', d: 'No account is sending data yet. This is the step that unlocks everything else.', slug: 'instalar-ea' },
    noMgr:   { t: 'Set up your trading plan', d: 'Data is coming in. Now tell Onyx when you are allowed to trade.', slug: 'plan-de-trading' },
    ready:   { t: 'Understand your numbers', d: 'Your account is connected and Onyx Guardian is on. Now get value from what you are already measuring.', slug: 'expectancy' },
  },
};

const STAGE: Record<string, number> = { guest: 0, noAcc: 1, noMgr: 2, ready: 3 };
const ROUTE_ICON = ['install', 'performance', 'guardian', 'trophy'];

export default function GuideHome() {
  const { lang } = useLang();
  const t = dictFor(T, lang);
  const [q, setQ] = useState('');
  const [state, setState] = useState<'guest' | 'noAcc' | 'noMgr' | 'ready'>('guest');
  const [selCat, setSelCat] = useState<string>(CATEGORIES[0]?.id || 'start');

  // Guías fusionadas (código + las del dueño). Partimos de las del código.
  const [arts, setArts] = useState<any[]>(ARTICLES);
  const [cats, setCats] = useState<any[]>(CATEGORIES);
  useEffect(() => {
    fetch('/api/guide').then((r) => r.json()).then((j) => {
      if (Array.isArray(j.articles)) setArts(j.articles);
      if (Array.isArray(j.categories) && j.categories.length) setCats(j.categories);
    }).catch(() => {});
  }, []);
  const byCatL = (c: string) => arts.filter((a) => a.cat === c);
  const searchL = (q: string, lg: string) => {
    const needle = q.trim().toLowerCase(); if (needle.length < 2) return [];
    return arts.filter((a) => {
      const hay = [a.title?.[lg], a.summary?.[lg], ...(a.body?.[lg] || []).map((b: any) => b.p || b.h || b.note || b.warn || b.tip || b.caption || (b.list || b.steps || []).join(' ') || (b.walk ? b.walk.map((s: any) => (s.t || '') + ' ' + (s.d || '')).join(' ') : ''))].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  };

  // Respuesta de Onyx (IA sobre la guía)
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState('');
  const [refs, setRefs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

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

  const found = useMemo(() => (q.trim().length >= 2 && !asked ? searchL(q, lang) : null), [q, lang, asked, arts]);
  const next = NEXT[lang][state];
  const stage = STAGE[state] ?? 0;

  async function askOnyx() {
    const question = q.trim();
    if (question.length < 2) return;
    setBusy(true); setAsked(question); setAnswer(''); setRefs([]);
    try {
      const r = await fetch('/api/support/ai', { method: 'POST', body: JSON.stringify({ question, history: [], lang }) });
      const j = await r.json();
      setAnswer(j.answer || '…'); setRefs(j.articles || []);
    } catch { setAnswer('…'); }
    setBusy(false);
  }
  function reset() { setAsked(''); setAnswer(''); setRefs([]); setQ(''); }

  return (
    <div className="wrap" style={{ maxWidth: 900, padding: '38px 22px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <h1 style={{ fontSize: 32, letterSpacing: '-.5px' }}>{t.title}</h1>
        <p className="muted" style={{ fontSize: 15, marginTop: 8 }}>{t.sub}</p>
      </div>

      {/* Barra "Pregúntale a Onyx" */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--brand)', borderRadius: 14, padding: '8px 10px 8px 14px', background: 'linear-gradient(135deg, rgba(124,140,255,.08), transparent), var(--card)' }}>
        <span style={{ color: 'var(--brand)', display: 'inline-flex', flex: 'none' }}><OnyxIcon name="ai" size={20} /></span>
        <input value={q} onChange={(e) => { setQ(e.target.value); if (asked) { setAsked(''); setAnswer(''); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') askOnyx(); }}
          placeholder={t.ask} aria-label={t.ask}
          style={{ flex: 1, margin: 0, border: 'none', background: 'transparent', fontSize: 15, padding: '6px 2px' }} />
        <button className="btn btn-primary" style={{ flex: 'none', whiteSpace: 'nowrap' }} onClick={askOnyx} disabled={busy || q.trim().length < 2}>
          {busy ? t.thinking : t.askBtn}
        </button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', margin: '8px 0 22px' }}>{t.askHint}</div>

      {asked ? (
        /* ---- Respuesta de Onyx ---- */
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--brand)', display: 'inline-flex', flex: 'none', marginTop: 2 }}><OnyxIcon name="ai" size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 6 }}>{asked}</div>
                {busy ? <div className="muted" style={{ fontSize: 14 }}>{t.thinking}</div>
                  : <div style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{answer}</div>}
              </div>
            </div>
          </div>
          {refs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.sources}</div>
              {refs.map((a) => <ArticleRow key={a.slug} a={arts.find((x) => x.slug === a.slug) || { slug: a.slug, icon: '📖', title: { [lang]: a.title }, summary: { [lang]: '' } }} lang={lang} />)}
            </div>
          )}
          <button className="btn btn-ghost" onClick={reset}>{t.clear}</button>
        </div>
      ) : found !== null ? (
        /* ---- Búsqueda en vivo ---- */
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.results(found.length)}</div>
          {!found.length && <p className="muted">{t.noResults}</p>}
          {found.map((a) => <ArticleRow key={a.slug} a={a} lang={lang} />)}
        </>
      ) : (
        /* ---- Hub: ruta + categorías filtrables ---- */
        <>
          {/* Tu ruta */}
          <div style={{ fontSize: 11, color: 'var(--mut)', letterSpacing: '.05em', marginBottom: 10 }}>{t.route}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 2, marginBottom: 14 }}>
            {t.routes.map((r: string, i: number) => {
              const on = i === stage, done = i < stage;
              const col = on ? 'var(--brand)' : done ? 'var(--green)' : 'var(--line)';
              const tc = on ? 'var(--tx)' : 'var(--mut)';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 74 }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + col, background: on ? 'rgba(124,140,255,.14)' : 'var(--bg2)', color: on ? 'var(--brand)' : done ? 'var(--green)' : 'var(--mut)' }}><OnyxIcon name={ROUTE_ICON[i]} size={18} /></span>
                    <span style={{ fontSize: 11.5, color: tc }}>{r}</span>
                  </div>
                  {i < t.routes.length - 1 && <div style={{ width: 30, height: 2, background: done ? 'var(--green)' : 'var(--line)' }} />}
                </div>
              );
            })}
          </div>

          {/* Siguiente paso, según su estado real */}
          <Link href={`/guia/${next.slug}`} className="card" style={{ display: 'block', marginBottom: 24, border: '1px solid var(--brand)', background: 'linear-gradient(135deg, rgba(124,140,255,.10), transparent), var(--card)' }}>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--brand)', display: 'inline-flex', flex: 'none' }}><OnyxIcon name={ROUTE_ICON[Math.min(stage, 3)]} size={22} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, marginBottom: 3 }}>{next.t}</div>
                <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{next.d}</div>
              </div>
              <span className="muted" style={{ fontSize: 16, flex: 'none' }}>→</span>
            </div>
          </Link>

          {/* Chips de categoría (filtran, no apilan) */}
          <div style={{ fontSize: 11, color: 'var(--mut)', letterSpacing: '.05em', marginBottom: 10 }}>{t.explore}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {cats.map((c) => {
              const active = c.id === selCat;
              return (
                <button key={c.id} onClick={() => setSelCat(c.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 22, padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                  border: '1px solid ' + (active ? 'var(--brand)' : 'var(--line)'),
                  background: active ? 'rgba(124,140,255,.14)' : 'var(--bg2)',
                  color: active ? 'var(--tx)' : 'var(--mut)',
                }}>
                  <span style={{ color: active ? 'var(--brand)' : (c.color || 'var(--brand)'), display: 'inline-flex' }}><OnyxIcon emoji={c.icon} size={16} /></span>
                  {(c.name as any)[lang]}
                  <span className="muted" style={{ fontSize: 11 }}>{byCatL(c.id).length}</span>
                </button>
              );
            })}
          </div>

          {/* Artículos de la categoría elegida */}
          <div>
            {byCatL(selCat).map((a) => <ArticleRow key={a.slug} a={a} lang={lang} />)}
          </div>
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
      <div className="row" style={{ gap: 11, alignItems: 'center' }}>
        {a.cover
          ? <img src={a.cover} alt="" loading="lazy" style={{ width: 58, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', flex: 'none' }} />
          : <span style={{ color: 'var(--brand)', display: 'inline-flex', flex: 'none' }}><OnyxIcon emoji={a.icon} size={18} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 7, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5 }}>{a.title[lang]}</span>
            {a.updated && <span className="pill" style={{ fontSize: 9.5, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.15)' }}>{lang === 'en' ? 'New' : 'Nuevo'}</span>}
          </div>
          {a.summary?.[lang] && <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{a.summary[lang]}</div>}
        </div>
        <span className="muted" style={{ fontSize: 15, flex: 'none' }}>→</span>
      </div>
    </Link>
  );
}
