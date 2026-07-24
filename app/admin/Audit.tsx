'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useT } from '@/lib/adminText';

const T: any = {
  es: {
    lastRun: 'Última auditoría', never: 'Nunca ejecutada', notRun: 'Sin ejecutar aún',
    lh: 'Lighthouse', perf: 'Rendimiento', a11y: 'Accesibilidad', seo: 'SEO', best: 'Buenas prácticas',
    vitals: 'Core Web Vitals', lcp: 'LCP · carga', inp: 'INP · respuesta', cls: 'CLS · estabilidad',
    flows: 'Botones y flujos', noFlows: 'Aún no hay resultados de flujos.',
    code: 'Código y dependencias', ts: 'Errores de TypeScript', vulns: 'Dependencias inseguras',
    howto: 'Cómo se configura', hide: 'Ocultar',
    steps: [
      'El archivo .github/workflows/audit.yml (incluido) corre en cada push a main y también a mano desde Actions.',
      'Añade en GitHub → Settings → Secrets → Actions: APP_URL (tu dominio) y CRON_SECRET (el mismo de Vercel).',
      'Corre Lighthouse (velocidad/SEO), un robot Playwright por los flujos, y avisa a esta página con el resultado.',
    ],
    empty: 'Todavía no se ha corrido ninguna auditoría. Configura el workflow y lánzalo desde Actions → Audit.',
    run: 'Ver en GitHub Actions',
  },
  en: {
    lastRun: 'Last audit', never: 'Never run', notRun: 'Not run yet',
    lh: 'Lighthouse', perf: 'Performance', a11y: 'Accessibility', seo: 'SEO', best: 'Best practices',
    vitals: 'Core Web Vitals', lcp: 'LCP · load', inp: 'INP · response', cls: 'CLS · stability',
    flows: 'Buttons and flows', noFlows: 'No flow results yet.',
    code: 'Code and dependencies', ts: 'TypeScript errors', vulns: 'Insecure dependencies',
    howto: 'How to set it up', hide: 'Hide',
    steps: [
      'The file .github/workflows/audit.yml (included) runs on every push to main and manually from Actions.',
      'Add in GitHub → Settings → Secrets → Actions: APP_URL (your domain) and CRON_SECRET (same as Vercel).',
      'It runs Lighthouse (speed/SEO), a Playwright robot over the flows, and pings this page with the result.',
    ],
    empty: 'No audit has run yet. Set up the workflow and launch it from Actions → Audit.',
    run: 'View in GitHub Actions',
  },
};

const scoreColor = (v: number) => (v >= 90 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)');
const vitalColor = (v: number, good: number, bad: number) => (v <= good ? 'var(--green)' : v <= bad ? 'var(--amber)' : 'var(--red)');

function Ring({ label, value }: { label: string; value: number }) {
  const r = 24, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  const col = scoreColor(value);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto' }}>
        <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="30" cy="30" r={r} fill="none" stroke="var(--bg2)" strokeWidth="6" />
          <circle cx="30" cy="30" r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: col }}>{value}</div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Audit() {
  const { lang } = useLang();
  const t = T[lang];
  const gt = useT();
  const [d, setD] = useState<any>(null);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => { fetch('/api/admin/audit').then((r) => r.json()).then(setD).catch(() => setD({})); }, []);

  const a = d?.audit || { at: null, lighthouse: null, vitals: null, flows: [], code: { ts_errors: 0, vulnerabilities: 0 } };
  const recent = a.at && (Date.now() - new Date(a.at).getTime()) < 8 * 86400000;
  const lh = a.lighthouse;
  const v = a.vitals;
  const tile = (label: string, value: any, color?: string) => (
    <div className="tile"><div className="muted" style={{ fontSize: 11.5 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700, marginTop: 3, color: color || 'var(--tx)' }}>{value}</div></div>
  );

  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="tabhead"><div className="th-row"><span className="th-ic">📈</span><span className="th-t">{gt.h_audit_t}</span></div><div className="th-s">{gt.h_audit_s}</div></div>
        {a.at
          ? <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: recent ? '#7fe9c0' : 'var(--mut)', background: recent ? 'rgba(52,226,160,.15)' : 'var(--card2)' }}>{recent && <span className="livedot" />}{t.lastRun}: {new Date(a.at).toLocaleString()}</span>
          : <span className="pill amber">{t.notRun}</span>}
      </div>

      {!a.at && (
        <div className="card" style={{ border: '1px solid var(--amber)', background: 'rgba(255,192,77,.06)' }}>
          <p style={{ fontSize: 13.5, margin: 0 }}>{t.empty}</p>
        </div>
      )}

      {/* Lighthouse */}
      {lh && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>{t.lh} · {lh.url}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <Ring label={t.perf} value={lh.performance} />
            <Ring label={t.a11y} value={lh.accessibility} />
            <Ring label={t.seo} value={lh.seo} />
            <Ring label={t.best} value={lh.best_practices} />
          </div>
          {v && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
              {tile(t.lcp, `${v.lcp} s`, vitalColor(v.lcp, 2.5, 4))}
              {tile(t.inp, `${v.inp} ms`, vitalColor(v.inp, 200, 500))}
              {tile(t.cls, `${v.cls}`, vitalColor(v.cls, 0.1, 0.25))}
            </div>
          )}
        </div>
      )}

      {/* Flujos */}
      <div className="card" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>{t.flows}</b>
        {!a.flows?.length && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t.noFlows}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0 20px', marginTop: a.flows?.length ? 6 : 0 }}>
          {(a.flows || []).map((f: any, i: number) => (
            <div key={i} className="row" style={{ gap: 9, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
              <span style={{ color: f.ok ? 'var(--green)' : 'var(--red)' }}>{f.ok ? '✓' : '✗'}</span>{f.name}
            </div>
          ))}
        </div>
      </div>

      {/* Código y dependencias */}
      <div className="card" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>{t.code}</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginTop: 10 }}>
          {tile(t.ts, a.code?.ts_errors ?? 0, (a.code?.ts_errors ?? 0) > 0 ? 'var(--amber)' : 'var(--green)')}
          {tile(t.vulns, a.code?.vulnerabilities ?? 0, (a.code?.vulnerabilities ?? 0) > 0 ? 'var(--red)' : 'var(--green)')}
        </div>
      </div>

      <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setShowHow(!showHow)}>{showHow ? t.hide : t.howto}</button>
      {showHow && (
        <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.7 }}>
          {t.steps.map((s: string, i: number) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
        </ol>
      )}
    </>
  );
}
