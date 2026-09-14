'use client';
import { useEffect, useState } from 'react';

// Panel ADMIN de DESEMPEÑO de la red de ventas: tablero con tarjetas de color,
// anillo de puntaje, gráficas SVG, reseñas de clientes, evaluaciones 360 y el
// "plan de manejo" (la IA recomienda; las acciones las decides tú).

const TIER = {
  star: { label: 'Estrella', bg: 'rgba(229,181,103,.14)', bd: 'rgba(229,181,103,.5)', fg: '#e5b567', ring: '#e5b567' },
  solid: { label: 'Sólido', bg: 'rgba(94,214,160,.12)', bd: 'rgba(94,214,160,.45)', fg: '#5ed6a0', ring: '#5ed6a0' },
  risk: { label: 'En riesgo', bg: 'rgba(240,115,111,.13)', bd: 'rgba(240,115,111,.5)', fg: '#f0736f', ring: '#f0736f' },
} as const;

const money = (n: number) => '$' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-US');
const stars = (r: number) => '★★★★★'.slice(0, Math.round(r)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r));

function Ring({ score, color, size = 66 }: { score: number; color: string; size?: number }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line,#2a3350)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.28} fontWeight="700" fill="var(--tx,#e8ecf5)">{score}</text>
    </svg>
  );
}
function Bar({ label, val, color = '#8b93ff' }: { label: string; val: number; color?: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginBottom: 3 }}><span>{label}</span><b style={{ color: 'var(--tx,#e8ecf5)' }}>{val}</b></div>
      <div style={{ height: 7, borderRadius: 4, background: 'var(--line,#2a3350)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(0, Math.min(100, val))}%`, background: color, borderRadius: 4 }} /></div>
    </div>
  );
}

export default function SalesPerf({ canManage = true, names }: { canManage?: boolean; names: any }) {
  const [cards, setCards] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any>(null);
  const lvName = (l: string) => (l === 'l2' ? names?.l2 || 'Director' : l === 'l1' ? names?.l1 || 'Lead' : names?.vendedor || 'Advisor');

  useEffect(() => { load(); }, []);
  async function load() {
    try { const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'scoreboard' }) }); const j = await r.json(); setCards(j.cards || []); } catch { setCards([]); }
  }

  if (!cards) return <div className="muted">Cargando desempeño…</div>;
  if (!cards.length) return <div className="muted">Aún no hay representantes con actividad para medir.</div>;

  const sum = (k: string) => cards.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const avgRating = (() => { const w = cards.filter((c) => c.reviews > 0); return w.length ? (w.reduce((a, c) => a + c.rating * c.reviews, 0) / w.reduce((a, c) => a + c.reviews, 0)).toFixed(1) : '—'; })();
  const atRisk = cards.filter((c) => c.tier === 'risk').length;

  const tile = (label: string, value: any, color?: string) => (
    <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: '12px 14px', minWidth: 120, flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--tx,#e8ecf5)', marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {tile('Representantes', cards.length)}
        {tile('Clientes activos', sum('active'), '#5ed6a0')}
        {tile('Ventas 30d', money(sum('revenue30')))}
        {tile('Comisión 30d', money(sum('earned30')), '#e5b567')}
        {tile('Satisfacción', avgRating === '—' ? '—' : avgRating + ' ★', '#e5b567')}
        {tile('En riesgo', atRisk, atRisk ? '#f0736f' : undefined)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {cards.map((c) => {
          const t = TIER[c.tier as keyof typeof TIER] || TIER.solid;
          return (
            <div key={c.rep_id} style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Ring score={c.score} color={t.ring} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--tx,#e8ecf5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: t.fg, fontWeight: 600 }}>{lvName(c.level)} · {t.label}</div>
                  <div style={{ fontSize: 12, color: '#e5b567', marginTop: 2 }}>{c.reviews ? `${stars(c.rating)} ${c.rating}` : <span className="muted">sin reseñas</span>}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10, fontSize: 12 }}>
                <Mini label="Clientes activos" v={`${c.active}/${c.clients}`} />
                <Mini label="Conversión prueba" v={`${c.trial_conv}%`} />
                <Mini label="Tickets abiertos" v={c.tickets_open} warn={c.tickets_open > 3} />
                <Mini label="Respuesta" v={c.resp_hrs == null ? '—' : `${c.resp_hrs}h`} warn={c.resp_hrs != null && c.resp_hrs > 12} />
                <Mini label="Comisión 30d" v={money(c.earned30)} />
                <Mini label="Disponible" v={money(c.available)} />
              </div>
              <button onClick={() => setSel(c)} style={{ marginTop: 10, width: '100%', padding: '7px', borderRadius: 8, border: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Ver desempeño + IA</button>
            </div>
          );
        })}
      </div>

      {sel && <Detail card={sel} canManage={canManage} lvName={lvName} onClose={() => setSel(null)} onChanged={load} />}
    </div>
  );
}

function Mini({ label, v, warn }: { label: string; v: any; warn?: boolean }) {
  return <div><div style={{ color: 'var(--mut,#9aa6bd)', fontSize: 10.5 }}>{label}</div><div style={{ fontWeight: 600, color: warn ? '#f0b74e' : 'var(--tx,#e8ecf5)' }}>{v}</div></div>;
}

function Detail({ card, canManage, lvName, onClose, onChanged }: any) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { (async () => {
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rep_detail', rep_id: card.rep_id, ai: true }) });
    setD(await r.json());
  })(); }, [card.rep_id]);

  async function act(body: any) {
    setBusy(true);
    await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, rep_id: card.rep_id }) });
    setBusy(false); onChanged?.();
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rep_detail', rep_id: card.rep_id, ai: false }) });
    const fresh = await r.json();
    setD((prev: any) => ({ ...fresh, insight: prev?.insight }));
  }

  const t = TIER[card.tier as keyof typeof TIER] || TIER.solid;
  const btn: React.CSSProperties = { padding: '6px 11px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,100%)', height: '100%', overflowY: 'auto', background: 'var(--bg,#0e1220)', borderLeft: '1px solid var(--line,#2a3350)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, color: 'var(--tx,#e8ecf5)' }}>{card.name}</h3>
            <div style={{ fontSize: 12.5, color: t.fg, fontWeight: 600 }}>{lvName(card.level)} · {t.label} · {card.score}/100</div>
          </div>
          <button onClick={onClose} style={btn}>✕</button>
        </div>

        {/* IA · plan de manejo */}
        <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 12, padding: 14, marginTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: t.fg, fontWeight: 700 }}>Lectura de la IA · plan de manejo</div>
          {!d ? <div className="muted" style={{ marginTop: 6 }}>Analizando…</div> : <>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx,#e8ecf5)', marginTop: 6 }}>{d.insight?.headline || '—'}</div>
            {d.insight?.summary && <p style={{ fontSize: 13, color: 'var(--tx,#e8ecf5)', margin: '6px 0 0', lineHeight: 1.5 }}>{d.insight.summary}</p>}
            {!!(d.insight?.actions || []).length && <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>{d.insight.actions.map((a: string, i: number) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}</ul>}
            <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)', marginTop: 8 }}>{d.insight?.ai ? 'Sugerencias de IA — tú decides y ejecutas.' : 'Sugerencias por reglas (IA no disponible).'}</div>
          </>}
        </div>

        {/* Sub-puntajes */}
        <div style={{ marginTop: 14 }}>
          <b style={{ fontSize: 13 }}>Cómo se compone el puntaje</b>
          <div style={{ marginTop: 8 }}>
            <Bar label="Satisfacción (reseñas)" val={card.parts.rating} color="#e5b567" />
            <Bar label="Conversión de pruebas" val={card.parts.conversion} color="#8b93ff" />
            <Bar label="Actividad / cartera" val={card.parts.activity} color="#5ed6a0" />
            <Bar label="Atención (tickets)" val={card.parts.service} color="#54c7ec" />
            <Bar label="Retención" val={card.parts.retention} color="#f0b74e" />
          </div>
        </div>

        {/* Acciones del plan de manejo */}
        {canManage && <div style={{ marginTop: 14, background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14 }}>
          <b style={{ fontSize: 13 }}>Registrar acción</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'praise', note, tier: card.tier })}>👏 Felicitar</button>
            <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'coach', note, tier: card.tier })}>🎯 Coaching</button>
            <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'warn', note, tier: card.tier })}>⚠ Advertir</button>
            <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'pause', note, tier: card.tier })}>⏸ Pausar pagos</button>
            <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'resume', note, tier: card.tier })}>▶ Reanudar</button>
            {card.level !== 'l2' && <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'promote', to_level: card.level === 'vendedor' ? 'l1' : 'l2', note: note || 'Ascenso', tier: card.tier })}>⬆ Ascender</button>}
            {card.level !== 'vendedor' && <button style={btn} disabled={busy} onClick={() => act({ action: 'log_action', kind: 'demote', to_level: card.level === 'l2' ? 'l1' : 'vendedor', note: note || 'Cambio de nivel', tier: card.tier })}>⬇ Bajar nivel</button>}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional) que queda en la bitácora" style={{ marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 12.5 }} />
        </div>}

        {/* Reseñas de clientes */}
        <div style={{ marginTop: 14 }}>
          <b style={{ fontSize: 13 }}>Reseñas de clientes {d?.reviews?.length ? `(${d.reviews.length})` : ''}</b>
          {!d?.reviews?.length ? <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Aún no hay reseñas.</div> :
            d.reviews.slice(0, 20).map((r: any) => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--line,#2a3350)', padding: '8px 0' }}>
                <div style={{ color: '#e5b567', fontSize: 13 }}>{stars(r.rating)} <span className="muted" style={{ fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString()}</span></div>
                {r.comment && <div style={{ fontSize: 12.5, color: 'var(--tx,#e8ecf5)', marginTop: 2 }}>{r.comment}</div>}
              </div>
            ))}
        </div>

        {/* Evaluaciones + bitácora */}
        <div style={{ marginTop: 14 }}>
          <b style={{ fontSize: 13 }}>Evaluaciones</b>
          {!d?.evals?.length ? <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Sin evaluaciones.</div> :
            d.evals.slice(0, 10).map((e: any) => (
              <div key={e.id} style={{ fontSize: 12.5, color: 'var(--tx,#e8ecf5)', padding: '6px 0', borderBottom: '1px solid var(--line,#2a3350)' }}>
                <b>{e.overall ? e.overall.toFixed(1) : '—'}/5</b> <span className="muted">· {e.direction === 'rep_to_sup' ? 'del vendedor a supervisor' : e.direction === 'sup_to_rep' ? 'del supervisor' : 'admin'} · {e.period}</span>
                {e.comment && <div className="muted" style={{ fontSize: 12 }}>{e.comment}</div>}
              </div>
            ))}
        </div>
        {!!d?.actions?.length && <div style={{ marginTop: 14 }}>
          <b style={{ fontSize: 13 }}>Bitácora</b>
          {d.actions.slice(0, 15).map((a: any) => (
            <div key={a.id} style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', padding: '4px 0' }}>{new Date(a.created_at).toLocaleDateString()} · <b style={{ color: 'var(--tx,#e8ecf5)' }}>{a.kind}</b>{a.note ? ` — ${a.note}` : ''}</div>
          ))}
        </div>}
      </div>
    </div>
  );
}
