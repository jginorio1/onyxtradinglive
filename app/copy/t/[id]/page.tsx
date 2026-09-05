import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tierLabel, type Tier } from '@/lib/copyScore';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

const TIER_STYLE: Record<Tier, { br: string; tx: string; bg: string }> = {
  diamond: { br: '#378ADD', tx: '#8fbdf0', bg: 'rgba(55,138,221,.10)' },
  gold: { br: '#BA7517', tx: 'var(--gold)', bg: 'rgba(255,192,77,.10)' },
  silver: { br: '#9aa0ac', tx: '#c7ccd6', bg: 'rgba(180,180,190,.10)' },
  none: { br: 'var(--line)', tx: 'var(--mut)', bg: 'var(--bg2)' },
};

async function getProvider(id: string) {
  try {
    const { data } = await supabaseAdmin.from('strategy_providers')
      .select('id,display_name,avatar_url,tier,score,pillars,stats,followers,fee_month,perf_fee_pct,verified,scored_at')
      .eq('id', id).eq('listed', true).eq('status', 'active').maybeSingle();
    return data as any;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProvider(params.id);
  const es = serverLang() === 'es';
  if (!p) return { title: 'Onyx Copy', robots: { index: false } };
  const t = tierLabel(p.tier, es ? 'es' : 'en');
  const title = `${p.display_name} · ${t} · Onyx Copy`;
  const description = es
    ? `${p.display_name} es un ${t} certificado por Onyx AI (score ${p.score}/100). Verifica su calificación y cópialo en Onyx Trading Live.`
    : `${p.display_name} is an Onyx AI-certified ${t} (score ${p.score}/100). Verify their grade and copy them on Onyx Trading Live.`;
  return { title, description, alternates: localeAlternates(`/copy/t/${params.id}`), openGraph: { title, description, url: `${SITE}/copy/t/${params.id}`, type: 'profile' } };
}

export default async function TraderCertificate({ params }: { params: { id: string } }) {
  const p = await getProvider(params.id);
  if (!p) notFound();
  const es = serverLang() === 'es';
  const st = TIER_STYLE[(p.tier as Tier) || 'none'];
  const s = p.stats || {}; const pl = p.pillars || {};
  const initials = String(p.display_name || 'O').split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase();
  const issued = p.scored_at ? new Date(p.scored_at).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const L = (a: string, b: string) => (es ? a : b);
  const pill = (label: string, val: number) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}><span className="muted">{label}</span><span style={{ color: 'var(--tx)' }}>{val}</span></div>
      <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${Math.max(3, Math.min(100, val))}%`, height: '100%', background: 'linear-gradient(90deg,var(--brand),var(--purple))' }} /></div>
    </div>
  );

  return (
    <div className="wrap section" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Link href="/copy" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>← Onyx Copy</Link>
        <PrintButton label={L('Descargar certificado', 'Download certificate')} />
      </div>

      {/* Certificado */}
      <div className="card" style={{ border: `2px solid ${st.br}`, background: st.bg, textAlign: 'center', padding: '30px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mut)', marginBottom: 16 }}>◆ Onyx Trading Live · {L('Trader certificado', 'Certified trader')}</div>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: st.bg, border: `2px solid ${st.br}`, color: st.tx, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, margin: '0 auto 14px' }}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials}</div>
        <h1 style={{ fontSize: 28, margin: 0 }}>{p.display_name}</h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 16px', borderRadius: 999, border: `1px solid ${st.br}`, color: st.tx, fontWeight: 700, fontSize: 16 }}>{tierLabel(p.tier, es ? 'es' : 'en')}{p.verified && <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ {L('verificado', 'verified')}</span>}</div>
        <div style={{ marginTop: 18, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 34, fontWeight: 800, color: st.tx }}>{p.score}</div><div className="muted" style={{ fontSize: 11 }}>Onyx Score</div></div>
          <div><div style={{ fontSize: 34, fontWeight: 800 }}>{s.winRate ?? 0}%</div><div className="muted" style={{ fontSize: 11 }}>Win rate</div></div>
          <div><div style={{ fontSize: 34, fontWeight: 800 }}>{s.pf ?? 0}</div><div className="muted" style={{ fontSize: 11 }}>Profit factor</div></div>
          <div><div style={{ fontSize: 34, fontWeight: 800 }}>{s.maxDDpct ?? 0}%</div><div className="muted" style={{ fontSize: 11 }}>Max drawdown</div></div>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>{L('Calificado por Onyx AI el', 'Graded by Onyx AI on')} {issued} · {s.trades ?? 0} {L('operaciones', 'trades')} · {s.tradingDays ?? 0} {L('días', 'days')} · {p.followers || 0} {L('copiándolo', 'copying')}</div>
      </div>

      {/* Curva de equity (forma normalizada, sin cifras) */}
      {Array.isArray(s.curve) && s.curve.length >= 2 && (() => {
        const W = 640, H = 96, pad = 6;
        const c: number[] = s.curve;
        const up = c[c.length - 1] >= 0;
        const col = up ? 'var(--green)' : 'var(--red)';
        const x = (i: number) => pad + (i / (c.length - 1)) * (W - pad * 2);
        const y = (v: number) => H / 2 - v * (H / 2 - pad);   // v en ±1
        const d = c.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
        const area = d + ` L ${x(c.length - 1).toFixed(1)} ${(H / 2).toFixed(1)} L ${x(0).toFixed(1)} ${(H / 2).toFixed(1)} Z`;
        return (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{L('Curva de resultados', 'Equity curve')}</div>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>{L('Evolución de su P&L acumulado en la ventana analizada (forma, sin cifras de la cuenta).', 'Cumulative P&L over the analyzed window (shape only, no account figures).')}</div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="96" preserveAspectRatio="none" style={{ display: 'block' }}>
              <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--line)" strokeWidth="1" strokeDasharray="4 4" />
              <path d={area} fill={col} opacity="0.12" />
              <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
        );
      })()}

      {/* Desglose */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{L('Desglose del Onyx Score', 'Onyx Score breakdown')}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {pill(L('Disciplina', 'Discipline'), pl.discipline || 0)}
          {pill(L('Riesgo', 'Risk'), pl.risk || 0)}
          {pill(L('Rendimiento', 'Performance'), pl.performance || 0)}
          {pill(L('Consistencia', 'Consistency'), pl.consistency || 0)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href="/dashboard/onyx-copy">{L('Copiar a este trader', 'Copy this trader')}</Link>
        <Link className="btn btn-ghost" href="/copy">{L('Ver el ranking', 'See the ranking')}</Link>
      </div>
      <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 16, maxWidth: 620, marginInline: 'auto' }}>
        {L('Certificado verificable en', 'Verifiable certificate at')} {SITE}/copy/t/{p.id}. {L('Los resultados pasados no garantizan resultados futuros.', 'Past results do not guarantee future results.')}
      </p>
    </div>
  );
}
