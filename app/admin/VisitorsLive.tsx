'use client';
import { useEffect, useRef, useState } from 'react';
import { mkL } from '@/lib/i18n';
import { useLang } from '@/lib/lang';

// ============================================================
// Admin → SEO · Pulso en vivo de VISITANTES (datos reales, sin cookies).
// Número "en línea ahora" + feed + toggle Hoy/7d/30d + únicos deduplicados +
// nuevos vs recurrentes + gráfico 24h + tops de páginas/países/origen.
// Se refresca solo cada 15s. Todo sale de /api/admin/visitors.
// ============================================================

// ISO-2 (MX) → emoji de bandera 🇲🇽. Si no hay país, globo.
const flag = (cc: string) => {
  if (!cc || cc.length !== 2) return '🌐';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.toUpperCase().charCodeAt(0) - 65, A + cc.toUpperCase().charCodeAt(1) - 65);
};
const nf = (n: number) => new Intl.NumberFormat('en-US').format(n || 0);
const REF_LABEL: Record<string, string> = { directo: 'Directo', google: 'Google', bing: 'Bing', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', x: 'X / Twitter', telegram: 'Telegram', reddit: 'Reddit', linkedin: 'LinkedIn' };

export default function VisitorsLive() {
  const { lang } = useLang();
  const L = mkL(lang);
  const es = lang !== 'en';
  const [days, setDays] = useState<1 | 7 | 30>(1);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);
  const daysRef = useRef(days);
  daysRef.current = days;

  async function load(n = daysRef.current) {
    try {
      const r = await fetch('/api/admin/visitors?days=' + n);
      const j = await r.json();
      if (j?.notReady) { setErr(true); return; }
      setErr(false); setD(j);
    } catch { setErr(true); }
  }
  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);
  useEffect(() => { const iv = setInterval(() => load(), 15000); return () => clearInterval(iv); }, []);

  const seg = (n: 1 | 7 | 30, t: string) => (
    <button className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{t}</button>
  );
  const agoTxt = (s: number) => s < 60 ? (es ? `hace ${s}s` : `${s}s ago`) : s < 3600 ? (es ? `hace ${Math.floor(s / 60)} min` : `${Math.floor(s / 60)}m ago`) : (es ? `hace ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`);

  const maxS = d ? Math.max(1, ...d.series) : 1;
  const total = d ? Math.max(1, d.newV + d.returning) : 1;
  const retPct = d ? Math.round((d.returning / total) * 100) : 0;

  return (
    <div className="vlz">
      <div className="vhead">
        <div>
          <div className="vttl"><span className="ld" /> {L('Pulso en vivo · Visitantes', 'Live pulse · Visitors')}</div>
          <div className="vsub">{L('Datos reales de tu app · deduplicado por persona (no cuenta recargas)', 'Real data from your app · deduplicated per person (reloads don’t count)')}</div>
        </div>
        <div className="vseg">
          {seg(1, L('Hoy', 'Today'))}{seg(7, es ? '7 días' : '7 days')}{seg(30, es ? '30 días' : '30 days')}
        </div>
      </div>

      {err && <div className="vcard vmut">{L('Aún no hay datos. Corre supabase/visitors_v1.sql y despliega; empezará a contar visitas al instante.', 'No data yet. Run supabase/visitors_v1.sql and deploy; it starts counting visits right away.')}</div>}

      {!err && !d && <div className="vcard vmut">…</div>}

      {!err && d && (<>
        <div className="vg1">
          <div className="vcard vlive">
            <div className="vlbl">{L('EN LÍNEA AHORA', 'ONLINE NOW')}</div>
            <div className="vbig">{nf(d.online)}<span className="pulse" /></div>
            <div className="vfoot">{L('personas navegando ahora mismo', 'people browsing right now')}</div>
            <div className="vmini">
              {(d.feed || []).slice(0, 4).map((f: any, i: number) => (
                <div key={i} className="ev"><b>{flag(f.country)} {f.country || '—'}</b> {es ? 'vio' : 'saw'} <b>{f.path}</b> · {agoTxt(f.ago)}</div>
              ))}
              {!(d.feed || []).length && <div className="ev vmut">{L('Sin visitas recientes.', 'No recent visits.')}</div>}
            </div>
          </div>

          <div className="vkpis">
            <div className="vcard vk">
              <div className="ki">{L('Visitantes únicos', 'Unique visitors')}</div>
              <div className="kv">{nf(d.unique)}</div>
              <div className="kd">{L('personas distintas', 'distinct people')}</div>
            </div>
            <div className="vcard vk">
              <div className="ki">{L('Páginas vistas', 'Page views')}</div>
              <div className="kv">{nf(d.pageviews)}</div>
              <div className="kd">{d.perVisitor} {L('por visitante', 'per visitor')}</div>
            </div>
            <div className="vcard vk">
              <div className="ki">{L('Recurrentes', 'Returning')}</div>
              <div className="kv">{retPct}%</div>
              <div className="kd">{nf(d.returning)} {L('volvieron', 'came back')}</div>
            </div>
            <div className="vcard vk">
              <div className="ki">{L('Nuevos', 'New')}</div>
              <div className="kv">{100 - retPct}%</div>
              <div className="kd">{nf(d.newV)} {L('primera visita', 'first visit')}</div>
            </div>
          </div>
        </div>

        <div className="vg2">
          <div className="vcard">
            <div className="vch">{L('Visitantes únicos · últimas 24 h', 'Unique visitors · last 24 h')}</div>
            <div className="bars">
              {d.series.map((v: number, i: number) => (
                <div key={i} className="bar" style={{ height: Math.max(3, (v / maxS) * 100) + '%' }} title={String(v)} />
              ))}
            </div>
            <div className="vaxis"><span>-24h</span><span>-12h</span><span>{L('ahora', 'now')}</span></div>
          </div>
          <div className="vcard">
            <div className="vch">{L('Nuevos vs Recurrentes', 'New vs Returning')}</div>
            <div className="donutrow">
              <svg viewBox="0 0 120 120" className="donut">
                <circle cx="60" cy="60" r="46" fill="none" stroke="var(--line)" strokeWidth="16" />
                <circle cx="60" cy="60" r="46" fill="none" stroke="var(--brand,#7c8cff)" strokeWidth="16" strokeLinecap="round"
                  strokeDasharray={`${(retPct / 100) * 289} 289`} transform="rotate(-90 60 60)" />
              </svg>
              <div className="leg">
                <div><span className="dot" style={{ background: 'var(--brand,#7c8cff)' }} /> {L('Recurrentes', 'Returning')} <b>{retPct}%</b></div>
                <div><span className="dot" style={{ background: 'var(--line)' }} /> {L('Nuevos', 'New')} <b>{100 - retPct}%</b></div>
                <div className="vmut sm">{L('Deduplicado por identificador anónimo.', 'Deduplicated by anonymous id.')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="vg3">
          <div className="vcard">
            <div className="vch">{L('Páginas top', 'Top pages')}</div>
            {(d.topPages || []).map((r: any, i: number) => <div key={i} className="vrow"><span>{r.k}</span><b>{nf(r.n)}</b></div>)}
            {!(d.topPages || []).length && <div className="vmut sm">—</div>}
          </div>
          <div className="vcard">
            <div className="vch">{L('Países top', 'Top countries')}</div>
            {(d.topCountries || []).map((r: any, i: number) => <div key={i} className="vrow"><span>{flag(r.k)} {r.k}</span><b>{nf(r.n)}</b></div>)}
            {!(d.topCountries || []).length && <div className="vmut sm">—</div>}
          </div>
          <div className="vcard">
            <div className="vch">{L('De dónde llegan', 'Where they come from')}</div>
            {(d.topRefs || []).map((r: any, i: number) => <div key={i} className="vrow"><span>{REF_LABEL[r.k] || r.k}</span><b>{nf(r.n)}</b></div>)}
            {!(d.topRefs || []).length && <div className="vmut sm">—</div>}
          </div>
        </div>
      </>)}

      <style dangerouslySetInnerHTML={{ __html: `
        .vlz { margin-bottom: 18px; }
        .vlz .vhead { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
        .vlz .vttl { font-weight:700; font-size:15px; display:flex; align-items:center; gap:8px; }
        .vlz .ld { width:9px; height:9px; border-radius:50%; background:#22d3a8; animation:vpulse 1.8s infinite; }
        @keyframes vpulse { 0%{ box-shadow:0 0 0 0 rgba(34,211,168,.5);}70%{box-shadow:0 0 0 7px rgba(34,211,168,0);}100%{box-shadow:0 0 0 0 rgba(34,211,168,0);} }
        .vlz .vsub { color:var(--muted); font-size:11.5px; margin-top:3px; }
        .vlz .vseg { display:flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .vlz .vseg button { background:transparent; border:none; color:var(--muted); padding:6px 12px; font-size:12px; cursor:pointer; font-family:inherit; }
        .vlz .vseg button.on { background:color-mix(in srgb,var(--brand,#7c8cff) 20%,transparent); color:var(--tx); font-weight:600; }
        .vlz .vcard { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:13px 15px; }
        .vlz .vmut { color:var(--muted); } .vlz .sm { font-size:10.5px; }
        .vlz .vg1 { display:grid; grid-template-columns:1fr 1.35fr; gap:10px; margin-bottom:10px; }
        .vlz .vlive { display:flex; flex-direction:column; }
        .vlz .vlbl { font-size:10.5px; letter-spacing:.12em; color:var(--muted); font-weight:700; }
        .vlz .vbig { font-size:48px; font-weight:800; line-height:1.05; margin:2px 0; display:flex; align-items:center; gap:10px; }
        .vlz .pulse { width:12px; height:12px; border-radius:50%; background:#22d3a8; box-shadow:0 0 12px #22d3a8; animation:vpulse 1.8s infinite; }
        .vlz .vfoot { color:var(--muted); font-size:11.5px; }
        .vlz .vmini { margin-top:10px; border-top:1px dashed var(--line); padding-top:8px; display:flex; flex-direction:column; gap:5px; min-height:80px; }
        .vlz .ev { font-size:11.5px; color:var(--muted); }
        .vlz .ev b { color:var(--tx); font-weight:600; }
        .vlz .vkpis { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .vlz .vk { display:flex; flex-direction:column; justify-content:center; }
        .vlz .ki { color:var(--muted); font-size:11.5px; }
        .vlz .kv { font-size:26px; font-weight:800; margin:2px 0; }
        .vlz .kd { font-size:11px; color:var(--muted); }
        .vlz .vg2 { display:grid; grid-template-columns:1.5fr 1fr; gap:10px; margin-bottom:10px; }
        .vlz .vch { font-weight:700; font-size:12.5px; margin-bottom:10px; }
        .vlz .bars { display:flex; align-items:flex-end; gap:2px; height:96px; }
        .vlz .bar { flex:1; background:linear-gradient(180deg,var(--brand,#7c8cff),color-mix(in srgb,var(--brand,#7c8cff) 30%,transparent)); border-radius:2px 2px 0 0; min-width:2px; }
        .vlz .vaxis { display:flex; justify-content:space-between; color:var(--muted); font-size:10px; margin-top:4px; }
        .vlz .donutrow { display:flex; align-items:center; gap:14px; }
        .vlz .donut { width:104px; height:104px; flex-shrink:0; }
        .vlz .leg { font-size:12px; display:flex; flex-direction:column; gap:7px; }
        .vlz .leg b { color:var(--tx); }
        .vlz .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; }
        .vlz .vg3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
        .vlz .vrow { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--line); font-size:12px; gap:10px; }
        .vlz .vrow:last-child { border-bottom:none; }
        .vlz .vrow span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .vlz .vrow b { font-weight:700; }
        @media(max-width:820px){ .vlz .vg1,.vlz .vg2,.vlz .vg3,.vlz .vkpis { grid-template-columns:1fr; } }
      ` }} />
    </div>
  );
}
