'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

type Stats = { winRate?: string | null; profitFactor?: string | null; expectancyR?: string | null; maxDrawdown?: string | null };
type Result = { findings: string[]; quickWin?: string; score?: number | null; summary?: string; stats?: Stats };

// Datos de muestra para que alguien SIN cuenta pueda probar el analizador.
const SAMPLE = `EURUSD,buy,+42.5,2024-05-02 09:15
GBPUSD,sell,-30.0,2024-05-02 10:40
US30,buy,+120.0,2024-05-02 15:20
XAUUSD,buy,+88.0,2024-05-03 11:05
EURUSD,sell,-55.0,2024-05-03 16:10
GBPJPY,buy,-70.0,2024-05-03 16:35
US30,sell,+35.0,2024-05-06 09:50
EURUSD,buy,+18.0,2024-05-06 10:20
XAUUSD,sell,-95.0,2024-05-06 15:40
GBPUSD,buy,-40.0,2024-05-06 16:05
NAS100,buy,+150.0,2024-05-07 14:30
EURUSD,sell,-60.0,2024-05-07 17:10`;

// Imán de leads público: pega/sube/prueba tu reporte y el AI te da un análisis.
export default function AnalizaPage() {
  const { lang } = useLang();
  const L = mkL(lang);
  const es = lang !== 'en';
  const [tab, setTab] = useState<'paste' | 'file'>('paste');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [howto, setHowto] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lcPage, setLcPage] = useState<any>(null);
  const px = (k: string, fb: string) => lcPage?.[k]?.[lang] || fb;
  useEffect(() => { fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setLcPage(c?.pages?.analiza || null)).catch(() => {}); }, []);

  async function run(over?: string) {
    const payload = (over ?? text).trim();
    if (payload.length < 30) { setErr(L('Pega un poco más de tu reporte u operaciones (o pulsa "Probar con un ejemplo").', 'Paste a bit more of your statement or trades (or hit "Try an example").')); return; }
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: payload, lang }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Error'); return; }
      setRes({ findings: j.findings || [], quickWin: j.quickWin, score: j.score, summary: j.summary, stats: j.stats });
    } catch { setErr('Error'); } finally { setBusy(false); }
  }

  function tryExample() { setTab('paste'); setText(SAMPLE); run(SAMPLE); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setErr(L('Archivo muy grande (máx 2 MB). Prueba pegando el texto.', 'File too large (max 2 MB). Try pasting the text.')); return; }
    const rd = new FileReader();
    rd.onload = () => { const t = String(rd.result || '').slice(0, 8000); setText(t); setTab('paste'); };
    rd.onerror = () => setErr(L('No pude leer el archivo. Prueba pegando el texto.', "Couldn't read the file. Try pasting the text."));
    rd.readAsText(f);
  }

  function copyResult() {
    if (!res) return;
    const lines = [res.summary, ...res.findings.map((f, i) => `${i + 1}. ${f}`), res.quickWin ? `▸ ${res.quickWin}` : ''].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(lines).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  const chip = (active: boolean) => ({ fontSize: 12.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', border: '1px solid ' + (active ? 'var(--brand)' : 'var(--line)'), background: active ? 'rgba(124,140,255,.14)' : 'transparent', color: active ? 'var(--soft-brand)' : 'var(--mut)', fontWeight: 600 } as any);
  const statCards = res?.stats ? ([
    [L('Win rate', 'Win rate'), res.stats.winRate],
    [L('Profit factor', 'Profit factor'), res.stats.profitFactor],
    [L('Expectativa', 'Expectancy'), res.stats.expectancyR],
    [L('Drawdown máx', 'Max drawdown'), res.stats.maxDrawdown],
  ].filter(([, v]) => v)) : [];

  return (
    <div className="wrap" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 18px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 14 }} />
        <h1 style={{ marginBottom: 8 }}>{px('title', L('Analiza tu cuenta gratis 🔍', 'Analyze your account free 🔍'))}</h1>
        <p className="muted" style={{ fontSize: 15, maxWidth: 560, margin: '0 auto' }}>
          {px('sub', L('Pega tu reporte de MetaTrader o cTrader (o tu lista de operaciones cerradas) y Onyx AI te da estadísticas, un score de disciplina y 3 hallazgos al instante. Sin registro.', 'Paste your MetaTrader or cTrader statement (or your closed-trades list) and Onyx AI gives you stats, a discipline score and 3 findings instantly. No signup.'))}
        </p>
      </div>

      <div className="card">
        {/* Pestañas de entrada */}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={chip(tab === 'paste')} onClick={() => setTab('paste')}>📋 {L('Pegar texto', 'Paste text')}</span>
          <span style={chip(tab === 'file')} onClick={() => { setTab('file'); fileRef.current?.click(); }}>⬆ {L('Subir archivo', 'Upload file')}</span>
          <span style={{ ...chip(false), marginLeft: 'auto', borderColor: 'var(--brand)', color: 'var(--soft-brand)' }} onClick={tryExample}>✨ {L('Probar con un ejemplo', 'Try an example')}</span>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.log,.htm,.html,text/*" onChange={onFile} style={{ display: 'none' }} />
        </div>

        {/* Pista de plataforma */}
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 11.5 }}>{L('Sirve para', 'Works with')}: MT4 · MT5 · cTrader</span>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11.5, padding: '2px 8px', marginLeft: 'auto' }} onClick={() => setHowto((v) => !v)}>❓ {L('¿Cómo saco mi reporte?', 'How do I get my report?')}</button>
        </div>
        {howto && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 12.5 }}>
            <div><b>MetaTrader 4/5:</b> {L('pestaña Historial → clic derecho → Guardar como informe (o copia las filas). Pega el texto aquí.', 'History tab → right-click → Save as Report (or copy the rows). Paste the text here.')}</div>
            <div style={{ marginTop: 4 }}><b>cTrader:</b> {L('History → exporta a CSV y súbelo, o copia las operaciones cerradas.', 'History → export to CSV and upload it, or copy your closed trades.')}</div>
            <div className="muted" style={{ marginTop: 4 }}>{L('Con par, resultado y hora ya es suficiente para empezar.', 'Pair, result and time are enough to get started.')}</div>
          </div>
        )}

        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder={px('placeholder', L('Pega aquí tus operaciones (par, resultado, hora…) o el texto de tu reporte de MetaTrader o cTrader.', 'Paste your trades here (pair, result, time…) or your MetaTrader or cTrader statement text.'))}
          style={{ width: '100%', minHeight: 150, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => run()} disabled={busy || text.trim().length < 30}>{busy ? L('Analizando…', 'Analyzing…') : '✨ ' + L('Analizar', 'Analyze')}</button>
          <span className="muted" style={{ fontSize: 12 }}>{px('privacy', L('No guardamos lo que pegas.', "We don't store what you paste."))}</span>
        </div>
        {err && <div style={{ marginTop: 12, color: 'var(--amber)', fontSize: 13 }}>⚠ {err}</div>}
      </div>

      {res && (
        <div className="card" style={{ marginTop: 16 }}>
          {/* Score + resumen */}
          {(res.score != null || res.summary) && (
            <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              {res.score != null && (() => {
                const c = res.score >= 70 ? 'var(--green)' : res.score >= 45 ? 'var(--amber)' : 'var(--red)';
                const deg = Math.round((res.score / 100) * 360);
                return (
                  <div style={{ width: 92, height: 92, borderRadius: '50%', flex: 'none', background: `conic-gradient(${c} ${deg}deg, var(--line) ${deg}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{res.score}</div>
                      <div className="muted" style={{ fontSize: 10 }}>/ 100</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{L('Score de disciplina', 'Discipline score')}</div>
                {res.summary && <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{res.summary}</div>}
              </div>
            </div>
          )}

          {/* Estadísticas estimadas */}
          {statCards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 14 }}>
              {statCards.map(([lbl, v]) => (
                <div key={lbl as string} style={{ background: 'var(--bg2)', borderRadius: 10, padding: 10 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{lbl}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Hallazgos */}
          <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{L('Tus hallazgos', 'Your findings')}</h3>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={copyResult}>{copied ? L('Copiado ✓', 'Copied ✓') : '⧉ ' + L('Copiar', 'Copy')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {res.findings.map((f, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', background: 'var(--bg2)', borderRadius: 10, padding: '11px 13px' }}>
                <span style={{ fontSize: 16, color: 'var(--soft-brand)', fontWeight: 800, flex: 'none' }}>{i + 1}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Acción rápida */}
          {res.quickWin && (
            <div style={{ marginTop: 12, background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 2 }}>🎯 {L('Acción rápida', 'Quick win')}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{res.quickWin}</div>
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 16, textAlign: 'center', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 10 }}>{L('Crea tu cuenta gratis para guardar esto y activar Onyx Guardian: diario automático, sesiones, horas, costes reales y tu riesgo cuidado.', 'Create your free account to save this and turn on Onyx Guardian: automatic journal, sessions, hours, real costs and your risk protected.')}</p>
            <Link className="btn btn-primary" href="/login?mode=signup">{L('Crear cuenta gratis →', 'Create free account →')}</Link>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 18 }}>
        {px('disclaimer', L('Onyx analiza tu pasado para darte disciplina. No predice el mercado ni da señales. Los números son una estimación con lo que pegas.', 'Onyx analyzes your past to give you discipline. It does not predict the market or give signals. Figures are an estimate from what you paste.'))}
      </p>
    </div>
  );
}
