import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tierLabel, type Tier } from '@/lib/copyScore';
import PrintButton from './PrintButton';
import ShareCert from './ShareCert';

export const dynamic = 'force-dynamic';

const TIER_STYLE: Record<Tier, { br: string; tx: string; bg: string }> = {
  diamond: { br: '#378ADD', tx: '#8fbdf0', bg: 'rgba(55,138,221,.10)' },
  gold: { br: '#BA7517', tx: 'var(--gold)', bg: 'rgba(255,192,77,.10)' },
  silver: { br: '#9aa0ac', tx: '#c7ccd6', bg: 'rgba(180,180,190,.10)' },
  none: { br: 'var(--line)', tx: 'var(--mut)', bg: 'var(--bg2)' },
};

async function getProvider(id: string) {
  try {
    // Pública si está en el ranking de copia (listed) O si el trader generó su
    // tarjeta verificada para compartir (showcase). En ambos casos status activo.
    const { data } = await supabaseAdmin.from('strategy_providers')
      .select('id,display_name,avatar_url,tier,score,pillars,stats,followers,fee_month,perf_fee_pct,verified,scored_at,listed,showcase')
      .eq('id', id).eq('status', 'active').or('listed.eq.true,showcase.eq.true').maybeSingle();
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
      {/* Estilos de impresión: solo el certificado, en una página, sin botones ni
          barras. Así "Descargar certificado" genera un documento limpio. */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* El certificado de impresión solo existe al imprimir (landscape, 1 pág). */
        .print-cert { display: none; }
        @media print {
          @page { size: letter landscape; margin: 0; }
          html, body { background: #0b1020 !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Oculta TODO lo que no contiene ni es el certificado (barra de la app,
             widgets, la vista web). Solo queda el certificado como único contenido
             → exactamente una página Carta landscape. */
          body *:not(:has(.print-cert)):not(.print-cert):not(.print-cert *) { display: none !important; }
          /* Respaldo para motores sin :has — oculta las superficies conocidas. */
          .no-print, .cert-area { display: none !important; }
          .wrap.section { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          /* El contenedor ES la página completa (oscura) y centra el certificado
             dentro, así no queda ninguna franja blanca arriba ni abajo. */
          .print-cert { display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100vh !important; background: #0b1020 !important; overflow: hidden !important; page-break-inside: avoid !important; break-inside: avoid !important; break-after: avoid !important; page-break-after: avoid !important; }
        }
      ` }} />
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Link href="/copy" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>← Onyx Copy</Link>
        <PrintButton label={L('Descargar certificado', 'Download certificate')} />
      </div>
      <div className="cert-area">

      {/* Certificado */}
      <div className="card" style={{ border: `2px solid ${st.br}`, background: st.bg, textAlign: 'center', padding: '30px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mut)', marginBottom: 16 }}>
          <img src="/onyx-symbol.png" alt="Onyx Trading Live" width={18} height={18} style={{ width: 18, height: 18, objectFit: 'contain', display: 'block' }} />
          <span>Onyx Trading Live · {L('Trader certificado', 'Certified trader')}</span>
        </div>
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

      <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 16, maxWidth: 620, marginInline: 'auto' }}>
        {L('Certificado verificable en', 'Verifiable certificate at')} {SITE}/copy/t/{p.id}. {L('Los resultados pasados no garantizan resultados futuros.', 'Past results do not guarantee future results.')}
      </p>
      </div>{/* /cert-area */}

      {/* Compartir: Web Share nativo + copiar link + X. El botón de copiar a este
          trader solo aparece si está realmente a la venta (listed). */}
      <div className="no-print">
      <ShareCert
        url={`${SITE}/copy/t/${p.id}`}
        name={p.display_name}
        tier={tierLabel(p.tier, es ? 'es' : 'en')}
        score={p.score}
        lang={es ? 'es' : 'en'}
      />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        {p.listed && <Link className="btn btn-primary" href="/dashboard/onyx-copy">{L('Copiar a este trader', 'Copy this trader')}</Link>}
        <Link className="btn btn-ghost" href="/copy">{L('Ver el ranking', 'See the ranking')}</Link>
      </div>
      </div>

      {/* Conversión: el visitante que llega por un enlace compartido ve un camino
          claro para unirse gratis (su atribución de referido ya la guardó el
          middleware desde ?ref). Cierra el bucle: comparten → entran → crecen. */}
      <div className="card no-print" style={{ marginTop: 18, textAlign: 'center', padding: '22px 20px', border: `1px solid ${st.br}`, background: st.bg }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
          {L('¿Quieres tu propia tarjeta verificada?', 'Want your own verified card?')}
        </div>
        <p className="muted" style={{ fontSize: 13.5, margin: '0 auto 14px', maxWidth: 480 }}>
          {L('Conecta tu cuenta, deja que Onyx AI califique tu track record y compártelo. Empieza gratis, sin tarjeta.',
             'Connect your account, let Onyx AI grade your track record and share it. Start free, no card required.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/login?mode=signup">{L('Empieza gratis', 'Start free')}</Link>
          <Link className="btn btn-ghost" href="/">{L('Conocer Onyx', 'Explore Onyx')}</Link>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 16, maxWidth: 620, marginInline: 'auto' }}>
        {L('Certificado verificable en', 'Verifiable certificate at')} {SITE}/copy/t/{p.id}. {L('Los resultados pasados no garantizan resultados futuros.', 'Past results do not guarantee future results.')}
      </p>

      {/* ====== CERTIFICADO DE IMPRESIÓN (landscape, 1 página, diseño formal) ======
          Solo se ve al imprimir. Marco dorado, sello, firma y métricas del trader. */}
      {(() => {
        // Certificado en tema OSCURO (fondo onyx a sangre completa).
        const accent = p.tier === 'diamond' ? '#6BB5F0' : p.tier === 'gold' ? '#E2B84B' : p.tier === 'silver' ? '#C7CCD6' : '#C9A227';
        const ink = '#e8ecf4', soft = '#8b94a7', line = '#2a3450', paper = '#0b1020', gold = '#C9A227', goldSoft = '#1d2740';
        const certNo = String(p.id).replace(/-/g, '').slice(0, 10).toUpperCase();
        // El certificado se genera en el idioma actual del panel (es/en), no bilingüe.
        const bi = (a: string, b: string) => (es ? a : b);
        // Curva (forma normalizada ±1)
        const c: number[] = Array.isArray(s.curve) ? s.curve : [];
        const CW = 560, CH = 92, cp = 6;
        let dLine = '', dArea = '';
        if (c.length >= 2) {
          const cx = (i: number) => cp + (i / (c.length - 1)) * (CW - cp * 2);
          const cy = (v: number) => CH / 2 - v * (CH / 2 - cp);
          dLine = c.map((v, i) => `${i === 0 ? 'M' : 'L'} ${cx(i).toFixed(1)} ${cy(v).toFixed(1)}`).join(' ');
          dArea = dLine + ` L ${cx(c.length - 1).toFixed(1)} ${(CH / 2).toFixed(1)} L ${cx(0).toFixed(1)} ${(CH / 2).toFixed(1)} Z`;
        }
        const curveUp = c.length ? c[c.length - 1] >= 0 : true;
        const curveCol = curveUp ? '#1f9d55' : '#c0392b';
        const stat = (big: string, lbl: string) => (
          <div style={{ textAlign: 'center', padding: '0 10px' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: ink, lineHeight: 1 }}>{big}</div>
            <div style={{ fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: soft, marginTop: 4 }}>{lbl}</div>
          </div>
        );
        const pbar = (lbl: string, val: number) => (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: soft, marginBottom: 3 }}><span>{lbl}</span><span style={{ color: ink, fontWeight: 700 }}>{val}</span></div>
            <div style={{ height: 5, background: goldSoft, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.max(3, Math.min(100, val))}%`, height: '100%', background: gold }} /></div>
          </div>
        );
        return (
          <div className="print-cert">
            <div style={{ position: 'relative', width: '10in', height: '7.3in', flex: 'none', background: paper, color: ink, boxSizing: 'border-box', padding: '0.35in', overflow: 'hidden', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {/* Filigrana tenue de fondo + número de score en marca de agua */}
              <svg width="100%" height="100%" viewBox="0 0 1040 713" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.05 }}>
                <defs><pattern id={`gui-${certNo}`} width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="11" fill="none" stroke={gold} strokeWidth="1" /></pattern></defs>
                <rect width="1040" height="713" fill={`url(#gui-${certNo})`} />
              </svg>
              <div style={{ position: 'absolute', right: '12mm', bottom: '-10mm', fontSize: 340, fontWeight: 800, color: gold, opacity: 0.05, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>{p.score}</div>

              {/* Marco doble dorado + esquinas */}
              <div style={{ position: 'absolute', inset: '6mm', border: `0.8mm solid ${gold}`, borderRadius: 3 }} />
              <div style={{ position: 'absolute', inset: '8mm', border: `0.3mm solid ${gold}`, opacity: 0.55 }} />
              {[['6mm', '6mm', 'left', 'top'], ['6mm', '6mm', 'right', 'top'], ['6mm', '6mm', 'left', 'bottom'], ['6mm', '6mm', 'right', 'bottom']].map((_, i) => (
                <div key={i} style={{ position: 'absolute', [i % 2 === 0 ? 'left' : 'right']: '6mm', [i < 2 ? 'top' : 'bottom']: '6mm', width: 30, height: 30, [`border${i % 2 === 0 ? 'Left' : 'Right'}`]: `0.9mm solid ${ink}`, [`border${i < 2 ? 'Top' : 'Bottom'}`]: `0.9mm solid ${ink}` }} />
              ))}

              <div style={{ position: 'relative', height: '100%', padding: '6mm 10mm', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                {/* Cabecera */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src="/onyx-symbol.png" alt="" width={26} height={26} style={{ width: 26, height: 26, objectFit: 'contain' }} />
                    <span style={{ fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: ink, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>Onyx Trading Live</span>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ fontSize: 8.5, letterSpacing: 1.5, color: soft, textTransform: 'uppercase' }}>{bi('Certificado Nº', 'Certificate No.')}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: ink, letterSpacing: 1 }}>{certNo}</div>
                  </div>
                </div>

                {/* Título */}
                <div style={{ textAlign: 'center', marginTop: '3mm' }}>
                  <div style={{ fontSize: 10, letterSpacing: 4, color: gold, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{bi('Certificado de desempeño', 'Certificate of performance')}</div>
                  <div style={{ fontSize: 24, letterSpacing: 1, color: ink, fontWeight: 700, marginTop: 2 }}>{bi('Trader Verificado', 'Verified Trader')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: '3mm' }}>
                    <span style={{ width: 90, height: 1, background: gold }} /><span style={{ color: gold, fontSize: 13 }}>❖</span><span style={{ width: 90, height: 1, background: gold }} />
                  </div>
                </div>

                {/* Cuerpo: izquierda identidad + score · derecha métricas + curva */}
                <div style={{ display: 'flex', gap: '12mm', marginTop: '5mm', flex: 1, alignItems: 'center' }}>
                  {/* Izquierda */}
                  <div style={{ width: '38%', textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: soft, fontStyle: 'italic' }}>{bi('Se certifica que', 'This certifies that')}</div>
                    <div style={{ fontSize: 34, fontWeight: 700, color: ink, margin: '2mm 0', lineHeight: 1.1 }}>{p.display_name}</div>
                    <div style={{ display: 'inline-block', border: `1.5px solid ${accent}`, color: accent, padding: '3px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, fontFamily: 'Arial, sans-serif', letterSpacing: 1 }}>{tierLabel(p.tier, es ? 'es' : 'en')}</div>
                    {/* Onyx Score grande con anillo */}
                    <div style={{ marginTop: '6mm', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <div style={{ position: 'relative', width: 96, height: 96 }}>
                        <svg viewBox="0 0 96 96" width="96" height="96">
                          <circle cx="48" cy="48" r="42" fill="none" stroke={goldSoft} strokeWidth="8" />
                          <circle cx="48" cy="48" r="42" fill="none" stroke={gold} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, p.score)) / 100) * 264} 264`} transform="rotate(-90 48 48)" />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontSize: 30, fontWeight: 800, color: ink, lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>{p.score}</div>
                          <div style={{ fontSize: 8, letterSpacing: 1, color: soft, textTransform: 'uppercase' }}>Onyx Score</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Derecha */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`, padding: '4mm 0', fontFamily: 'Arial, sans-serif' }}>
                      {stat(`${s.winRate ?? 0}%`, 'Win rate')}
                      {stat(String(s.pf ?? 0), 'Profit factor')}
                      {stat(`${s.maxDDpct ?? 0}%`, bi('Drawdown máx.', 'Max DD'))}
                      {stat(`${s.trades ?? 0}`, bi('Operaciones', 'Trades'))}
                    </div>
                    {/* Curva */}
                    <div style={{ marginTop: '4mm' }}>
                      <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: soft, marginBottom: 2, fontFamily: 'Arial, sans-serif' }}>{bi('Curva de resultados', 'Equity curve')}</div>
                      {dLine ? (
                        <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" height="64" preserveAspectRatio="none" style={{ display: 'block' }}>
                          <line x1="0" y1={CH / 2} x2={CW} y2={CH / 2} stroke={line} strokeWidth="1" strokeDasharray="4 4" />
                          <path d={dArea} fill={curveCol} opacity="0.1" />
                          <path d={dLine} fill="none" stroke={curveCol} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        </svg>
                      ) : <div style={{ height: 64, border: `1px dashed ${line}`, borderRadius: 4 }} />}
                    </div>
                    {/* Pilares */}
                    <div style={{ display: 'flex', gap: 14, marginTop: '4mm', fontFamily: 'Arial, sans-serif' }}>
                      {pbar(bi('Disciplina', 'Discipline'), pl.discipline || 0)}
                      {pbar(bi('Riesgo', 'Risk'), pl.risk || 0)}
                      {pbar(bi('Rendimiento', 'Performance'), pl.performance || 0)}
                      {pbar(bi('Consistencia', 'Consistency'), pl.consistency || 0)}
                    </div>
                  </div>
                </div>

                {/* Pie: firma · sello · verificación */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '4mm', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ textAlign: 'center', width: '32%' }}>
                    <div style={{ fontSize: 17, color: ink, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{bi('Equipo Onyx', 'Onyx Team')}</div>
                    <div style={{ borderTop: `1px solid ${ink}`, marginTop: 2, paddingTop: 3, fontSize: 8.5, color: soft }}>{bi('Verificado por Onyx Trading Live', 'Verified by Onyx Trading Live')}</div>
                  </div>
                  <div style={{ textAlign: 'center', width: '34%' }}>
                    <div style={{ width: 66, height: 66, margin: '0 auto', borderRadius: '50%', border: `2px solid ${gold}`, boxShadow: `0 0 0 3px ${goldSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: paper }}>
                      <img src="/onyx-symbol.png" alt="Onyx" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: 7.5, color: soft, marginTop: 4, letterSpacing: 1 }}>{bi('Sello oficial Onyx', 'Official Onyx seal')}</div>
                  </div>
                  <div style={{ width: '32%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: ink, fontWeight: 700 }}>{issued}</div>
                      <div style={{ borderTop: `1px solid ${ink}`, marginTop: 2, paddingTop: 3, fontSize: 8.5, color: soft }}>{bi('Fecha de emisión', 'Issue date')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <img src={`/api/qr?data=${encodeURIComponent(`${SITE}/copy/t/${p.id}`)}&size=200&fmt=png&fg=0b1020&bg=ffffff`} alt="QR" width={52} height={52} style={{ width: 52, height: 52, background: '#fff', borderRadius: 6, padding: 3, display: 'block' }} />
                      <div style={{ fontSize: 6.5, color: soft, marginTop: 2, letterSpacing: .5 }}>{bi('Escanéame', 'Scan me')}</div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: 8, color: soft, marginTop: '3mm', fontFamily: 'Arial, sans-serif' }}>
                  {bi('Verificable en', 'Verifiable at')} {SITE}/copy/t/{p.id} · {L('Los resultados pasados no garantizan resultados futuros.', 'Past results do not guarantee future results.')}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
