'use client';
import { useEffect, useState } from 'react';

type Lang = 'es' | 'en';
type Ev = { title: string; currency: string; impact: string; date: string; forecast: string; previous: string };

const FLAG: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳' };

const T = {
  es: { title: '📰 Noticias de alto impacto', next: 'Próxima', in: 'en', high: 'Alto', medium: '+ Medio', today: 'Hoy', prev: 'Prev', fcst: 'Fcst', none: 'No hay noticias próximas.', unavail: 'Calendario no disponible ahora.', legend: '●●● alto · ●● medio · en tu hora local · datos de Forex Factory', warn: 'en menos de 30 min — cuidado con operar', loading: 'Cargando calendario…' },
  en: { title: '📰 High-impact news', next: 'Next', in: 'in', high: 'High', medium: '+ Medium', today: 'Today', prev: 'Prev', fcst: 'Fcst', none: 'No upcoming news.', unavail: 'Calendar unavailable right now.', legend: '●●● high · ●● medium · in your local time · data from Forex Factory', warn: 'in under 30 min — careful trading', loading: 'Loading calendar…' },
};

export default function News({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [events, setEvents] = useState<Ev[] | null>(null);
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
  const list = events
    .filter((e) => showMed || e.impact === 'High')
    .map((e) => ({ ...e, ms: new Date(e.date).getTime() }))
    .filter((e) => e.ms >= now - 30 * 60000)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, 12);

  const next = list.find((e) => e.ms > now);
  const dots = (imp: string) => imp === 'High'
    ? <span style={{ color: '#ff6b7d', fontSize: 15, letterSpacing: -2 }}>●●●</span>
    : <span style={{ color: '#ffc04d', fontSize: 15, letterSpacing: -2 }}>●●</span>;
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (ms: number) => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? t.today : d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric' }); };
  const cd = (ms: number) => { const s = Math.max(0, Math.floor((ms - now) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return (h > 0 ? h + 'h ' : '') + m + 'm ' + ss + 's'; };

  const warnSoon = next && next.impact === 'High' && (next.ms - now) < 30 * 60000;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{t.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {next && <span className="muted" style={{ fontSize: 13 }}>{t.next}: <b>{FLAG[next.currency] || '🏳️'} {next.title}</b> {t.in} <b style={{ color: '#a9b4ff' }}>{cd(next.ms)}</b></span>}
          <button className={'btn ' + (showMed ? 'btn-primary' : 'btn-ghost')} style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setShowMed(!showMed)}>{t.medium}</button>
        </div>
      </div>
      {warnSoon && <div style={{ background: 'rgba(255,107,125,.14)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, margin: '4px 0 10px' }}>⚠ {FLAG[next!.currency] || ''} {next!.title} {t.warn}</div>}
      <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 12 }}>{t.legend}</div>

      {list.length === 0 ? <p className="muted">{events.length ? t.none : t.unavail}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((e, i) => { const soon = next && e.ms === next.ms; return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, background: soon ? 'rgba(124,140,255,.12)' : 'var(--bg2)', border: '1px solid ' + (soon ? '#7c8cff' : 'var(--line)') }}>
              <div style={{ width: 66, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--mut)' }}>{fmtDay(e.ms)}</div><div style={{ fontSize: 14, fontWeight: 800 }}>{fmtTime(e.ms)}</div></div>
              <div style={{ width: 48, textAlign: 'center' }}><span style={{ fontSize: 18 }}>{FLAG[e.currency] || '🏳️'}</span><div style={{ fontSize: 10, color: 'var(--mut)' }}>{e.currency}</div></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div><div style={{ fontSize: 11, color: 'var(--mut)' }}>{t.prev}: {e.previous || '—'} · {t.fcst}: {e.forecast || '—'}</div></div>
              <div style={{ textAlign: 'right' }}>{dots(e.impact)}{soon && e.ms > now && <div style={{ fontSize: 11, color: '#a9b4ff', fontWeight: 700, marginTop: 2 }}>{t.in} {cd(e.ms)}</div>}</div>
            </div>); })}
        </div>
      )}
    </div>
  );
}
