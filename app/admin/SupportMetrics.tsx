'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Tablero de métricas de soporte: primera respuesta, resolución, backlog, CSAT,
// y desgloses por categoría, por AGENTE y por LEAD SOURCE (de dónde vienen).
// Se abre dentro de Admin → Soporte. Lee /api/admin/support/metrics.

type M = any;

const SRC_LABEL: Record<string, string> = {
  web: 'Web', facebook: 'Facebook', instagram: 'Instagram', google: 'Google', bing: 'Bing',
  youtube: 'YouTube', tiktok: 'TikTok', whatsapp: 'WhatsApp', telegram: 'Telegram', twitter: 'X',
  linkedin: 'LinkedIn', reddit: 'Reddit', email: 'Email', referral: 'Referido', ads: 'Ads',
  direct: 'Directo', team: 'Equipo',
};
const SRC_EMOJI: Record<string, string> = {
  web: '🌐', facebook: '📘', instagram: '📸', google: '🔍', bing: '🔎', youtube: '▶️', tiktok: '🎵',
  whatsapp: '🟢', telegram: '✈️', twitter: '✖️', linkedin: '💼', reddit: '👽', email: '✉️',
  referral: '🤝', ads: '📣', direct: '🔗', team: '👥',
};

export default function SupportMetrics() {
  const { lang } = useLang(); const es = lang !== 'en';
  const [days, setDays] = useState(30);
  const [m, setM] = useState<M | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/support/metrics?days=${days}`).then((r) => r.json()).then((j) => { setM(j); setLoading(false); }).catch(() => setLoading(false));
  }, [days]);

  const card = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 } as const;
  const big = { fontSize: 26, fontWeight: 800, color: 'var(--tx)', lineHeight: 1.1 } as const;
  const lbl = { fontSize: 11.5, color: 'var(--mut)', marginTop: 2 } as const;
  const fmtMin = (x: number) => x >= 60 ? `${(x / 60).toFixed(1)} h` : `${x} min`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>{es ? 'Métricas de soporte' : 'Support metrics'}</b>
        <span style={{ flex: 1 }} />
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (days === d ? 'var(--brand)' : 'var(--line)'), background: days === d ? 'color-mix(in srgb, var(--brand) 16%, var(--bg2))' : 'var(--bg2)', color: days === d ? 'var(--brand)' : 'var(--tx)' }}>{d}{es ? 'd' : 'd'}</button>
        ))}
      </div>

      {loading && <div className="muted" style={{ fontSize: 13, padding: 10 }}>{es ? 'Cargando…' : 'Loading…'}</div>}
      {!loading && m && (<>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <div style={card}><div style={big}>{m.totals?.created ?? 0}</div><div style={lbl}>{es ? 'Tickets creados' : 'Tickets created'}</div></div>
          <div style={card}><div style={big}>{m.totals?.backlog ?? 0}</div><div style={lbl}>{es ? 'Pendientes (backlog)' : 'Open backlog'}</div></div>
          <div style={card}><div style={big}>{m.firstResponse?.measured ? fmtMin(m.firstResponse.medianMin) : '—'}</div><div style={lbl}>{es ? 'Primera respuesta (mediana)' : 'First response (median)'}</div></div>
          <div style={card}><div style={big}>{m.resolution?.measured ? `${m.resolution.medianHr} h` : '—'}</div><div style={lbl}>{es ? 'Resolución (mediana)' : 'Resolution (median)'}</div></div>
          <div style={card}><div style={big}>{m.csat?.count ? `${m.csat.avg}/5` : '—'}</div><div style={lbl}>CSAT {m.csat?.count ? `(${m.csat.count})` : ''}</div></div>
          <div style={card}><div style={big}>{m.reopenRate ?? 0}%</div><div style={lbl}>{es ? 'Reaperturas' : 'Reopen rate'}</div></div>
          <div style={card}><div style={big}>{m.escalated ?? 0}</div><div style={lbl}>{es ? 'Escalados (N2+)' : 'Escalated (L2+)'}</div></div>
          <div style={card}><div style={big}>{m.totals?.leads ?? 0}</div><div style={lbl}>{es ? 'Leads (sin cuenta)' : 'Leads (no account)'}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {/* LEAD SOURCE — de dónde vienen los clientes */}
          <Bars title={es ? '📍 De dónde vienen (lead source)' : '📍 Where they come from'} rows={(m.bySource || []).map((s: any) => ({ label: `${SRC_EMOJI[s.key] || '•'} ${SRC_LABEL[s.key] || s.key}`, count: s.count }))} empty={es ? 'Sin datos de fuente' : 'No source data'} />
          {/* Categoría */}
          <Bars title={es ? '🗂 Por categoría' : '🗂 By category'} rows={(m.byCategory || []).map((s: any) => ({ label: s.key, count: s.count }))} empty="—" />
          {/* Prioridad */}
          <Bars title={es ? '⚡ Por prioridad' : '⚡ By priority'} rows={(m.byPriority || []).map((s: any) => ({ label: s.key, count: s.count }))} empty="—" />
        </div>

        {/* Por agente */}
        <div style={card}>
          <b style={{ fontSize: 13 }}>{es ? '🧑‍💻 Por agente' : '🧑‍💻 By agent'}</b>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ color: 'var(--mut)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>{es ? 'Agente' : 'Agent'}</th>
                <th style={{ padding: '6px 8px' }}>{es ? 'Abiertos' : 'Open'}</th>
                <th style={{ padding: '6px 8px' }}>{es ? 'Resueltos' : 'Resolved'}</th>
                <th style={{ padding: '6px 8px' }}>{es ? '1ª resp.' : '1st resp.'}</th>
                <th style={{ padding: '6px 8px' }}>CSAT</th>
              </tr></thead>
              <tbody>
                {(m.byAgent || []).length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 8 }}>{es ? 'Sin asignaciones en el periodo.' : 'No assignments in range.'}</td></tr>}
                {(m.byAgent || []).map((a: any) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{a.name || a.email || a.id.slice(0, 6)}</td>
                    <td style={{ padding: '6px 8px' }}>{a.open}</td>
                    <td style={{ padding: '6px 8px' }}>{a.resolved}</td>
                    <td style={{ padding: '6px 8px' }}>{a.firstRespMin ? fmtMin(a.firstRespMin) : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{a.csat ? `${a.csat}/5` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11 }}>{es ? 'Primera respuesta = primer mensaje de un humano del equipo. Resolución = de creado a resuelto.' : 'First response = first human team reply. Resolution = created to resolved.'}</div>
      </>)}
    </div>
  );
}

function Bars({ title, rows, empty }: { title: string; rows: Array<{ label: string; count: number }>; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <b style={{ fontSize: 13 }}>{title}</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
        {rows.length === 0 && <span className="muted" style={{ fontSize: 12 }}>{empty}</span>}
        {rows.slice(0, 10).map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, width: 110, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
            <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--line)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.round((r.count / max) * 100)}%`, background: 'var(--grad)', borderRadius: 5 }} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, width: 34, textAlign: 'right' }}>{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
