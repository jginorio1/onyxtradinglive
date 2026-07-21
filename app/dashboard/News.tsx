'use client';
import { useEffect, useState } from 'react';

type Lang = 'es' | 'en';
type Ev = { title: string; currency: string; impact: string; date: string; forecast: string; previous: string };

const FLAG: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳' };

const T = {
  es: { title: '📰 Noticias', next: 'PRÓXIMA DE ALTO IMPACTO', in: 'en', med: '+ Medio', today: 'Hoy', prev: 'Prev', fcst: 'Fcst', none: 'No hay noticias próximas.', unavail: 'Calendario no disponible ahora.', warn: 'en menos de 30 min — cuidado', loading: 'Cargando…', all: 'Ver todas', hide: 'Ocultar', more: 'más esta semana' },
  en: { title: '📰 News', next: 'NEXT HIGH-IMPACT', in: 'in', med: '+ Medium', today: 'Today', prev: 'Prev', fcst: 'Fcst', none: 'No upcoming news.', unavail: 'Calendar unavailable now.', warn: 'in under 30 min — careful', loading: 'Loading…', all: 'See all', hide: 'Hide', more: 'more this week' },
};

export default function News({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [open, setOpen] = useState(false);
  const [showMed, setShowMed] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() { try { const r = await fetch('/api/news'); const j = await r.json(); if (!stop) setEvents(j.events || []); } catch { if (!stop) setEvents([]); } }
    load(); const iv = setInterval(load, 15 * 60 * 1000);
    const ti = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { stop = true; clearInterval(iv); clearInterval(ti); };
  }, []);

  if (events === null) return <div className="card"><p className="muted">{t.loading}</p></div>;

  const now = Date.now();
  const all = events.map((e) => ({ ...e, ms: new Date(e.date).getTime() })).filter((e) => e.ms >= now - 30 * 60000).sort((a, b) => a.ms - b.ms);
  const list = all.filter((e) => showMed || e.impact === 'High');
  const featured = list.find((e) => e.impact === 'High' && e.ms > now) || list.find((e) => e.ms > now);
  const rest = list.filter((e) => e !== featured);

  const dots = (imp: string) => imp === 'High' ? <span style={{ color: '#ff6b7d', fontSize: 14, letterSpacing: -2 }}>●●●</span> : <span style={{ color: '#ffc04d', fontSize: 14, letterSpacing: -2 }}>●●</span>;
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (ms: number) => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? t.today : d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric' }); };
  const cd = (ms: number) => { const s = Math.max(0, Math.floor((ms - now) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return (h > 0 ? h + 'h ' : '') + m + 'm ' + ss + 's'; };
  const warnSoon = featured && featured.impact === 'High' && (featured.ms - now) < 30 * 60000;

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</div>
        <button className={'btn ' + (showMed ? 'btn-primary' : 'btn-ghost')} style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => setShowMed(!showMed)}>{t.med}</button>
      </div>

      {!featured ? <p className="muted" style={{ fontSize: 13 }}>{events.length ? t.none : t.unavail}</p> : (<>
        {/* Destacada */}
        <div style={{ background: 'rgba(124,140,255,.12)', border: '1px solid #7c8cff', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 9, color: '#a9b4ff', fontWeight: 700, marginBottom: 4 }}>{t.next} {dots('High')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>{FLAG[featured.currency] || '🏳️'}</span>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{featured.title}</div><div style={{ fontSize: 11, color: 'var(--mut)' }}>{featured.currency} · {fmtDay(featured.ms)} {fmtTime(featured.ms)}</div></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#a9b4ff', marginTop: 6 }}>{t.in} {cd(featured.ms)}</div>
          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>{t.prev}: {featured.previous || '—'} · {t.fcst}: {featured.forecast || '—'}</div>
        </div>

        {warnSoon && <div style={{ background: 'rgba(255,107,125,.14)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 600, marginTop: 10 }}>⚠ {featured.title} {t.warn}</div>}

        {rest.length > 0 && (
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: 12 }} onClick={() => setOpen(!open)}>{open ? t.hide + ' ▲' : `${t.all} (${rest.length}) ▼`}</button>
        )}
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
            {rest.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 15 }}>{FLAG[e.currency] || '🏳️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div><div style={{ fontSize: 10, color: 'var(--mut)' }}>{fmtDay(e.ms)} {fmtTime(e.ms)}</div></div>
                {dots(e.impact)}
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}
