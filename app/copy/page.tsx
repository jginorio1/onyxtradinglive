import type { Metadata } from 'next';
import Link from 'next/link';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tierLabel, type Tier } from '@/lib/copyScore';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const title = es ? 'Onyx Copy · Copia a traders calificados por Onyx AI' : 'Onyx Copy · Copy traders graded by Onyx AI';
  const description = es
    ? 'Onyx AI califica a cada trader por su disciplina, gestión de riesgo y KPIs, y lo ubica en un ranking (Silver, Gold, Diamond). Copia a los mejores y ellos ganan por su operativa.'
    : 'Onyx AI grades every trader by discipline, risk management and KPIs, and ranks them (Silver, Gold, Diamond). Copy the best and they earn from their trading.';
  return { title, description, alternates: localeAlternates('/copy'), openGraph: { title, description, url: `${SITE}/copy`, type: 'website' } };
}

const TIER_STYLE: Record<Tier, { bg: string; br: string; tx: string }> = {
  diamond: { bg: 'rgba(55,138,221,.14)', br: '#378ADD', tx: '#8fbdf0' },
  gold: { bg: 'rgba(255,192,77,.14)', br: 'var(--gold)', tx: 'var(--gold)' },
  silver: { bg: 'rgba(180,180,190,.14)', br: '#9aa0ac', tx: '#c7ccd6' },
  none: { bg: 'var(--bg2)', br: 'var(--line)', tx: 'var(--mut)' },
};

function money(n: any) { const v = Number(n) || 0; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }); }

export default async function CopyLanding() {
  const es = serverLang() === 'es';
  let providers: any[] = [];
  try {
    const { data } = await supabaseAdmin.from('strategy_providers')
      .select('id,display_name,avatar_url,tier,score,pillars,stats,style_note,followers,fee_month,verified')
      .eq('listed', true).eq('status', 'active').neq('tier', 'none')
      .order('score', { ascending: false }).limit(50);
    providers = data || [];
  } catch { providers = []; }

  const L = es ? {
    kicker: 'Onyx Copy', h1: 'Copia a traders calificados por Onyx AI',
    sub: 'Onyx AI evalúa a cada trader por su disciplina, su gestión de riesgo y sus KPIs, no por suerte. Los ubica en un ranking transparente y tú eliges a quién copiar.',
    ctaCopy: 'Ver el ranking', ctaApply: 'Postula tu cuenta',
    howT: 'Cómo se califica un trader', howSub: 'Un Onyx Score de 0 a 100 con cuatro pilares. Pesa más la disciplina que el retorno bruto: premia al sostenible, no al que apuesta.',
    p1: 'Disciplina y plan', p1d: 'Cumple su plan de trading y documenta sus operaciones.', p1w: '30%',
    p2: 'Gestión de riesgo', p2d: 'Drawdown bajo y sin romper sus propias reglas.', p2w: '25%',
    p3: 'Rendimiento', p3d: 'Profit factor y R:R ajustados, no ganancia bruta.', p3w: '25%',
    p4: 'Consistencia', p4d: 'Constancia en días operados y muestra suficiente.', p4w: '20%',
    tiersT: 'Los niveles', tiersSub: 'Se recalcula solo cada día: se sube y se baja según la operativa reciente.',
    silverT: 'Onyx Silver', silverD: 'Score ≥ 60 · 20+ ops · 20+ días · drawdown ≤ 15%',
    goldT: 'Onyx Gold', goldD: 'Score ≥ 75 · 60+ ops · PF ≥ 1.3 · drawdown ≤ 12% · cuenta verificada',
    diamondT: 'Onyx Diamond', diamondD: 'Score ≥ 88 · 150+ ops · PF ≥ 1.5 · drawdown ≤ 10% · verificada',
    rankT: 'Ranking en vivo', rankSub: 'Traders calificados ahora mismo, ordenados por Onyx Score.',
    empty: 'Pronto verás aquí a los primeros traders calificados. Si operas con disciplina, postula tu cuenta.',
    copies: 'copian', from: 'desde', month: 'mes', copyBtn: 'Copiar', soon: 'Pronto', verifiedTxt: 'verificada',
    moneyT: 'Cómo ganamos los dos', moneyD: 'El seguidor paga una suscripción mensual por copiar a un trader. Onyx retiene una parte y el resto va al trader calificado. Diamond cobra más que Silver.',
    faqT: 'Preguntas frecuentes',
    faq: [
      ['¿Cómo califica Onyx AI a un trader?', 'Con un Onyx Score de 0 a 100 basado en disciplina y cumplimiento del plan, gestión de riesgo (drawdown), rendimiento ajustado (profit factor, R:R) y consistencia. La IA aporta el resumen de estilo, pero los niveles los deciden reglas duras, no la IA.'],
      ['¿Puede un trader manipular su ranking?', 'Es difícil: exigimos muestra mínima de operaciones y días, cuentas live verificadas para Gold y Diamond, y un límite de drawdown. Si rompe su límite, baja de nivel automáticamente.'],
      ['¿Cómo gana el trader calificado?', 'Cobra una parte de la suscripción de cada seguidor que lo copia, mes a mes, mientras siga suscrito. Se paga por Stripe.'],
      ['¿Qué pasa si el trader empieza a perder?', 'El score se recalcula a diario sobre su operativa reciente, así que baja de nivel si su disciplina o su riesgo empeoran. Como seguidor mantienes tus propios controles de riesgo.'],
      ['¿Cuándo puedo empezar a copiar?', 'El ranking ya está en vivo. La ejecución de copia con tus controles de riesgo llega en la siguiente fase; apúntate para ser de los primeros.'],
    ],
    riskNote: 'Copiar operaciones conlleva riesgo. Los resultados pasados no garantizan resultados futuros. Onyx no gestiona tu dinero: tú mantienes el control y tus propios límites de riesgo.',
  } : {
    kicker: 'Onyx Copy', h1: 'Copy traders graded by Onyx AI',
    sub: 'Onyx AI grades every trader by discipline, risk management and KPIs — not luck. It ranks them transparently and you choose who to copy.',
    ctaCopy: 'See the ranking', ctaApply: 'List your account',
    howT: 'How a trader is graded', howSub: 'An Onyx Score from 0 to 100 across four pillars. Discipline weighs more than raw return: it rewards the sustainable trader, not the gambler.',
    p1: 'Discipline & plan', p1d: 'Follows their trading plan and journals their trades.', p1w: '30%',
    p2: 'Risk management', p2d: 'Low drawdown and no breaking their own rules.', p2w: '25%',
    p3: 'Performance', p3d: 'Adjusted profit factor and R:R, not gross profit.', p3w: '25%',
    p4: 'Consistency', p4d: 'Steady trading days and a large enough sample.', p4w: '20%',
    tiersT: 'The tiers', tiersSub: 'Recalculated daily: you move up and down with your recent trading.',
    silverT: 'Onyx Silver', silverD: 'Score ≥ 60 · 20+ trades · 20+ days · drawdown ≤ 15%',
    goldT: 'Onyx Gold', goldD: 'Score ≥ 75 · 60+ trades · PF ≥ 1.3 · drawdown ≤ 12% · verified account',
    diamondT: 'Onyx Diamond', diamondD: 'Score ≥ 88 · 150+ trades · PF ≥ 1.5 · drawdown ≤ 10% · verified',
    rankT: 'Live ranking', rankSub: 'Traders graded right now, sorted by Onyx Score.',
    empty: 'The first graded traders will show here soon. If you trade with discipline, list your account.',
    copies: 'copying', from: 'from', month: 'mo', copyBtn: 'Copy', soon: 'Soon', verifiedTxt: 'verified',
    moneyT: 'How we both earn', moneyD: 'The follower pays a monthly subscription to copy a trader. Onyx keeps a share and the rest goes to the graded trader. Diamond charges more than Silver.',
    faqT: 'FAQ',
    faq: [
      ['How does Onyx AI grade a trader?', 'With an Onyx Score from 0 to 100 based on discipline and plan adherence, risk management (drawdown), adjusted performance (profit factor, R:R) and consistency. The AI writes the style summary, but tiers are decided by hard rules, not the AI.'],
      ['Can a trader game the ranking?', 'It is hard: we require a minimum sample of trades and days, verified live accounts for Gold and Diamond, and a drawdown cap. Break your limit and you are demoted automatically.'],
      ['How does the graded trader earn?', 'They keep a share of each follower\'s subscription, month after month, while they stay subscribed. Paid out via Stripe.'],
      ['What if the trader starts losing?', 'The score is recomputed daily over recent trading, so they drop tiers if discipline or risk worsen. As a follower you keep your own risk controls.'],
      ['When can I start copying?', 'The ranking is already live. Copy execution with your own risk controls arrives next; sign up to be among the first.'],
    ],
    riskNote: 'Copy trading carries risk. Past results do not guarantee future results. Onyx does not manage your money: you stay in control with your own risk limits.',
  };

  const pillarRow = (label: string, val: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span className="muted" style={{ width: 74, flex: '0 0 auto' }}>{label}</span>
      <span style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${Math.max(3, Math.min(100, val))}%`, height: '100%', background: 'linear-gradient(90deg,var(--brand),var(--purple))' }} />
      </span>
    </div>
  );

  return (
    <div className="wrap section" style={{ maxWidth: 1000 }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 34 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'rgba(124,140,255,.12)', border: '1px solid var(--brand)', color: 'var(--soft-brand)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>◆ {L.kicker}</div>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, maxWidth: 780, marginInline: 'auto' }}>{L.h1}</h1>
        <p className="muted" style={{ fontSize: 17, marginTop: 12, maxWidth: 660, marginInline: 'auto' }}>{L.sub}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href="#ranking">{L.ctaCopy}</a>
          <Link className="btn btn-ghost" href="/dashboard/onyx-copy">{L.ctaApply}</Link>
        </div>
      </div>

      {/* Cómo se califica */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 24 }}>{L.howT}</h2>
        <p className="muted" style={{ fontSize: 15, marginTop: 6, maxWidth: 640, marginInline: 'auto' }}>{L.howSub}</p>
      </div>
      <div className="grid g4" style={{ gap: 14, marginBottom: 36 }}>
        {([[L.p1, L.p1d, L.p1w], [L.p2, L.p2d, L.p2w], [L.p3, L.p3d, L.p3w], [L.p4, L.p4d, L.p4w]] as const).map(([tt, dd, ww], i) => (
          <div key={i} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{ww}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{tt}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{dd}</div>
          </div>
        ))}
      </div>

      {/* Tiers */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 24 }}>{L.tiersT}</h2>
        <p className="muted" style={{ fontSize: 15, marginTop: 6 }}>{L.tiersSub}</p>
      </div>
      <div className="grid g3" style={{ gap: 14, marginBottom: 40 }}>
        {([['silver', L.silverT, L.silverD], ['gold', L.goldT, L.goldD], ['diamond', L.diamondT, L.diamondD]] as const).map(([k, tt, dd]) => {
          const st = TIER_STYLE[k as Tier];
          return (
            <div key={k} className="card" style={{ borderColor: st.br, boxShadow: `0 0 26px -14px ${st.br}` }}>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: st.bg, border: '1px solid ' + st.br, color: st.tx }}>{tt}</span>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 10, lineHeight: 1.6 }}>{dd}</p>
            </div>
          );
        })}
      </div>

      {/* Ranking en vivo */}
      <div id="ranking" style={{ textAlign: 'center', marginBottom: 16, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 24 }}>{L.rankT}</h2>
        <p className="muted" style={{ fontSize: 15, marginTop: 6 }}>{L.rankSub}</p>
      </div>

      {providers.length === 0 ? (
        <div className="card muted" style={{ textAlign: 'center', padding: 30, marginBottom: 40 }}>{L.empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          {providers.map((p, i) => {
            const st = TIER_STYLE[(p.tier as Tier) || 'none'];
            const s = p.stats || {}; const pl = p.pillars || {};
            const initials = String(p.display_name || 'O').split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={p.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderLeft: `3px solid ${st.br}` }}>
                <div style={{ width: 26, textAlign: 'center', fontWeight: 800, color: 'var(--mut)', flex: '0 0 auto' }}>{i + 1}</div>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: st.bg, color: st.tx, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 auto' }}>{p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials}</div>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b>{p.display_name}</b>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: st.bg, border: '1px solid ' + st.br, color: st.tx }}>{tierLabel(p.tier, es ? 'es' : 'en')}</span>
                    {p.verified && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {L.verifiedTxt}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>Win {s.winRate ?? 0}% · PF {s.pf ?? 0} · maxDD {s.maxDDpct ?? 0}% · {s.trades ?? 0} ops · {s.tradingDays ?? 0} {es ? 'días' : 'days'}</div>
                  <div style={{ maxWidth: 240, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {pillarRow(es ? 'Disciplina' : 'Discipline', pl.discipline || 0)}
                    {pillarRow(es ? 'Riesgo' : 'Risk', pl.risk || 0)}
                  </div>
                </div>
                <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: st.tx }}>{p.score}</div>
                  <div className="muted" style={{ fontSize: 10 }}>score</div>
                </div>
                <div style={{ textAlign: 'right', flex: '0 0 auto', minWidth: 92 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{p.followers || 0} {L.copies}</div>
                  {p.fee_month ? <div style={{ fontSize: 12, marginTop: 2 }}>{L.from} {money(p.fee_month)}/{L.month}</div> : null}
                  <Link href={`/copy/t/${p.id}`} className="btn btn-ghost" style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}>{es ? 'Ver certificado →' : 'View certificate →'}</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cómo ganamos los dos */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 34 }}>
        <h2 style={{ fontSize: 22 }}>{L.moneyT}</h2>
        <p className="muted" style={{ fontSize: 15, marginTop: 8, maxWidth: 680, marginInline: 'auto' }}>{L.moneyD}</p>
      </div>

      {/* FAQ */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}><h2 style={{ fontSize: 24 }}>{L.faqT}</h2></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
        {L.faq.map(([q, a], i) => (
          <div key={i} className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{q}</div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{a}</div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12, textAlign: 'center', maxWidth: 720, marginInline: 'auto' }}>{L.riskNote}</p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href="/dashboard/onyx-copy">{L.ctaApply}</Link>
        <Link className="btn btn-ghost" href="/pricing">{es ? 'Ver planes' : 'See plans'}</Link>
      </div>
    </div>
  );
}
