'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import AiLimitNotice from '@/app/components/AiLimitNotice';

// Convierte el texto de la IA (con **negrita**, # títulos, - listas) en JSX real,
// para que NO se vean los asteriscos ni las almohadillas.
function inline(s: string, key: string) {
  const clean = s.replace(/`/g, '');
  const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter((x) => x !== '');
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**'))
    ? <strong key={key + '-' + i}>{p.slice(2, -2)}</strong>
    : <span key={key + '-' + i}>{p}</span>);
}
function RichText({ text }: { text: string }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out: any[] = [];
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { out.push(<div key={i} style={{ height: 6 }} />); return; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(<div key={i} style={{ fontWeight: 700, fontSize: 15, margin: '8px 0 2px' }}>{inline(h[2], 'h' + i)}</div>); return; }
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) { out.push(<div key={i} style={{ display: 'flex', gap: 8, margin: '2px 0' }}><span style={{ color: 'var(--brand)' }}>•</span><span>{inline(bullet[1], 'b' + i)}</span></div>); return; }
    out.push(<div key={i} style={{ margin: '3px 0' }}>{inline(line, 'p' + i)}</div>);
  });
  return <>{out}</>;
}

// Coach AI: repaso honesto del rendimiento del trader, bajo demanda.
// Analiza EL MISMO rango de fechas que el filtro del dashboard (from/to). Si no
// hay rango, cae a los últimos 90 días. Muestra siempre qué período analizó.
export default function CoachCard({ from, to, account, rail = false, demo = false }: { from?: string; to?: string; account?: string; rail?: boolean; demo?: boolean }) {
  const { lang } = useLang();
  const L = mkL(lang);
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(true);
  const [sum, setSum] = useState<any>(null);
  const [actions, setActions] = useState<{ label: string; href: string }[]>([]);
  const [aiLimit, setAiLimit] = useState<any>(null);   // allowance si alcanzó el tope de IA
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function gen() {
    setBusy(true); setMsg(''); setTxt(''); setSum(null); setActions([]); setAiLimit(null);
    // Demo público: sin sesión no hay IA (ni gasto de créditos). Mostramos un
    // repaso de ejemplo en vez de llamar al endpoint.
    if (demo) {
      setTimeout(() => {
        setSum({ scope: lang === 'es' ? 'Portafolio' : 'Portfolio', periodLabel: lang === 'es' ? 'Últimos 90 días' : 'Last 90 days', trades: 128, tradingDays: 42, perDay: '3.0' });
        setTxt(lang === 'en'
          ? '## What is working\n- Your win rate on London-session trades is **64%**, well above your NY sessions.\n- You respect your stop on **9 of 10** trades — discipline is your edge.\n## Where you leak\n- Friday afternoons are your worst window: **-2.1R** on average.\n- Position size creeps up after a win (revenge sizing).\n## This week\n- Cut Friday-afternoon trades and keep risk flat after wins.'
          : '## Lo que va bien\n- Tu win rate en la sesión de Londres es **64%**, muy por encima de Nueva York.\n- Respetas tu stop en **9 de cada 10** operaciones — la disciplina es tu ventaja.\n## Dónde pierdes\n- Los viernes por la tarde son tu peor franja: **-2,1R** de media.\n- El tamaño sube después de una ganancia (sizing por euforia).\n## Esta semana\n- Evita operar viernes por la tarde y mantén el riesgo plano tras ganar.');
        setOpen(true); setBusy(false);
      }, 600);
      return;
    }
    try {
      const qs = new URLSearchParams({ lang });
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (account && account !== 'all') qs.set('account', account);
      const r = await fetch('/api/coach?' + qs.toString());
      const j = await r.json();
      if (j.locked) { setMsg(L('No disponible en tu plan.', 'Not available on your plan.')); return; }
      if (j.empty) { setMsg(L('Necesitas unas cuantas operaciones cerradas en este período para tu repaso.', 'You need a few closed trades in this period for your review.')); return; }
      if (!j.ok) { setMsg(L('No se pudo generar ahora. Inténtalo de nuevo.', "Couldn't generate now. Try again.")); return; }
      setTxt(j.review || ''); setSum(j.summary || null); setActions(Array.isArray(j.actions) ? j.actions : []); setOpen(true);
      if (j.aiLimit) setAiLimit(j.allowance || {});   // alcanzó el tope del mes → aviso de comprar/subir
    } catch { /* red/parse */
    } finally { setBusy(false); }
  }

  // Línea "Analizando: …" con el período real que devolvió la API.
  const windowLine = sum ? (() => {
    const scope = sum.scope ? `${sum.scope} · ` : '';
    const wl = sum.periodLabel || (sum.from && sum.to ? `${sum.from} → ${sum.to}` : '');
    const dias = sum.tradingDays ? `${sum.tradingDays} ${L('días operados', 'trading days')}` : '';
    const perDay = sum.perDay ? ` · ${sum.perDay}/${L('día', 'day')}` : '';
    return `${L('Analizando', 'Analyzing')}: ${scope}${wl} · ${sum.trades} ${L('operaciones', 'trades')}${dias ? ' · ' + dias : ''}${perDay}`;
  })() : '';

  // Cuerpo del repaso (se usa inline en modo normal, o dentro del modal en modo riel).
  const reviewBody = (
    <>
      {windowLine &&<div className="muted" style={{ fontSize: 11.5, marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="📅" size={13} /> {windowLine}</div>}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', fontSize: 14, lineHeight: 1.6 }}><RichText text={txt} /></div>
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {actions.map((a, k) => (
            <a key={k} href={a.href} className={'btn ' + (k === 0 ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12.5, textDecoration: 'none' }}>{a.label} →</a>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="card" style={{ margin: 0, border: '1px solid rgba(124,140,255,.3)' }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: (!rail && txt && open) ? 10 : 0 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(124,140,255,.16)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><OnyxIcon emoji="✨" size={20} /></span>
          <div><b style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 7 }}>Onyx Coach <span style={{ fontSize: 10, letterSpacing: '.3px', background: 'rgba(124,140,255,.16)', color: 'var(--soft-brand)', border: '1px solid rgba(124,140,255,.35)', borderRadius: 20, padding: '1px 7px' }}>{L('IA', 'AI')}</span></b>
            <div className="muted" style={{ fontSize: 12.5 }}>{L('Un repaso honesto de tu trading, en palabras claras.', 'An honest review of your trading, in plain words.')}</div></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {txt && <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? '▲ ' + L('Ocultar', 'Hide') : '▼ ' + L('Ver repaso', 'Show review')}</button>}
          <button className="btn btn-primary" onClick={gen} disabled={busy}>{busy ? '…' : (txt ? '↻ ' + L('Otra vez', 'Again') : '✨ ' + L('Generar repaso', 'Generate review'))}</button>
        </div>
      </div>
      {msg && <div className="muted" style={{ fontSize: 13 }}>{msg}</div>}

      {/* Repaso INLINE (uso normal, tarjeta a lo ancho). */}
      {!rail && txt && open && <div style={{ marginTop: 10 }}>{reviewBody}</div>}

      {/* Repaso EN PANEL CENTRAL (modo riel): el texto es largo y se leería apretado
          en una columna estrecha, así que se abre en un modal ancho y legible. */}
      {rail && txt && open && mounted && createPortal(
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) (() => setOpen(false))(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflow: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 660, padding: 20 }}>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 12 }}>
              <b style={{ fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}><OnyxIcon emoji="✨" size={18} /> Onyx Coach</b>
              <button className="btn btn-ghost" style={{ padding: '2px 10px' }} onClick={() => setOpen(false)}>✕</button>
            </div>
            {reviewBody}
          </div>
        </div>
      , document.body)}

      {/* Popup notable cuando se alcanza el tope mensual de Onyx AI. */}
      {aiLimit && <AiLimitNotice allowance={aiLimit} lang={lang} onBought={gen} onClose={() => setAiLimit(null)} />}
    </div>
  );
}
