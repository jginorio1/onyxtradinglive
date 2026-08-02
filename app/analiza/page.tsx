'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

// Imán de leads público: pega tu reporte / operaciones y el AI te da 3 hallazgos.
export default function AnalizaPage() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [findings, setFindings] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const [lcPage, setLcPage] = useState<any>(null);
  const px = (k: string, fb: string) => lcPage?.[k]?.[lang] || fb;
  useEffect(() => { fetch('/api/landing-content', { cache: 'no-store' }).then((r) => r.json()).then((c) => setLcPage(c?.pages?.analiza || null)).catch(() => {}); }, []);

  async function run() {
    setBusy(true); setErr(''); setFindings(null);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Error'); return; }
      setFindings(j.findings || []);
    } finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 18px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 44, height: 44, objectFit: 'contain', marginBottom: 14 }} />
        <h1 style={{ marginBottom: 8 }}>{px('title', L('Analiza tu cuenta gratis 🔍', 'Analyze your account free 🔍'))}</h1>
        <p className="muted" style={{ fontSize: 15, maxWidth: 560, margin: '0 auto' }}>
          {px('sub', L('Pega tu reporte de MetaTrader o cTrader (o tu lista de operaciones cerradas) y Onyx AI te dará 3 hallazgos al instante. Sin registro.', 'Paste your MetaTrader or cTrader statement (or your list of closed trades) and Onyx AI gives you 3 findings instantly. No signup.'))}
        </p>
      </div>

      <div className="card">
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder={px('placeholder', L('Pega aquí tus operaciones (par, resultado, hora…) o el texto de tu reporte de MetaTrader o cTrader.', 'Paste your trades here (pair, result, time…) or your MetaTrader or cTrader statement text.'))}
          style={{ width: '100%', minHeight: 150, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={run} disabled={busy || text.trim().length < 30}>{busy ? L('Analizando…', 'Analyzing…') : '✨ ' + L('Analizar', 'Analyze')}</button>
          <span className="muted" style={{ fontSize: 12 }}>{px('privacy', L('No guardamos lo que pegas.', "We don't store what you paste."))}</span>
        </div>
        {err && <div style={{ marginTop: 12, color: 'var(--amber)', fontSize: 13 }}>⚠ {err}</div>}
      </div>

      {findings && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{L('Tus 3 hallazgos', 'Your 3 findings')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((f, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', background: 'var(--bg2)', borderRadius: 10, padding: '11px 13px' }}>
                <span style={{ fontSize: 16, color: 'var(--soft-brand)', fontWeight: 800, flex: 'none' }}>{i + 1}</span>
                <span style={{ fontSize: 14, lineHeight: 1.55 }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, textAlign: 'center', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 10 }}>{L('Conecta tu cuenta y ve TODO: sesiones, horas, pares, costes reales y Onyx Guardian cuidando tu riesgo.', 'Connect your account and see EVERYTHING: sessions, hours, pairs, real costs and Onyx Guardian protecting your risk.')}</p>
            <Link className="btn btn-primary" href="/login?mode=signup">{L('Crear cuenta gratis →', 'Create free account →')}</Link>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 18 }}>
        {px('disclaimer', L('Onyx analiza tu pasado para darte disciplina. No predice el mercado ni da señales.', 'Onyx analyzes your past to give you discipline. It does not predict the market or give signals.'))}
      </p>
    </div>
  );
}
