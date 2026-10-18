import type { Metadata } from 'next';
import Link from 'next/link';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { usageConfig } from '@/lib/usage';
import { aiLimitsSetting } from '@/lib/aiLimits';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import OnyxIcon from '@/app/components/OnyxIcon';

export const dynamic = 'force-dynamic';   // valores de Admin SIEMPRE en vivo

export async function generateMetadata(): Promise<Metadata> {
  const es = serverLang() === 'es';
  const title = es
    ? 'Monedero y pago por uso | Onyx Trading Live'
    : 'Wallet & pay-as-you-go | Onyx Trading Live';
  const description = es
    ? 'Usa Onyx sin mensualidad: plan gratis con cupo incluido y pago por uso desde tu saldo recargable. Recarga con tarjeta o USDT y paga solo unos centavos por lo que uses de más.'
    : 'Use Onyx with no monthly fee: free plan with an included allowance plus pay-as-you-go from your top-up balance. Top up by card or USDT and pay only a few cents for what you use over the allowance.';
  return { title, description, alternates: localeAlternates('/monedero'), openGraph: { title, description, url: `${SITE}/monedero`, type: 'website' } };
}

// Datos EN VIVO desde Admin: tarifas de uso + topes del plan gratis + plan más barato.
async function liveFacts() {
  const cfg = await usageConfig();
  let freeAi = 0, freeAccounts = 1;
  try {
    const { data: fp } = await supabaseAdmin.from('plans').select('capabilities,max_accounts').eq('id', 'free').maybeSingle();
    freeAccounts = Number((fp as any)?.max_accounts) || 1;
    const v = (fp as any)?.capabilities?.ai_monthly;
    if (v !== undefined && v !== null && Number.isFinite(Number(v))) freeAi = Number(v);
  } catch {}
  if (!freeAi) { try { const l = await aiLimitsSetting(); freeAi = Number((l as any)?.free ?? (l as any)?.default ?? 20); } catch { freeAi = 20; } }
  let cheapest: { name: string; price: number } | null = null;
  try {
    const { data } = await supabaseAdmin.from('plans').select('name,price_month,active').eq('active', true).gt('price_month', 0).order('price_month', { ascending: true }).limit(1);
    const p = (data || [])[0] as any;
    if (p) cheapest = { name: p.name, price: Number(p.price_month) || 0 };
  } catch {}
  return { cfg, freeAi, freeAccounts, cheapest };
}

const money = (cents: number) => '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');

export default async function WalletGuide() {
  const es = serverLang() === 'es';
  const { cfg, freeAi, freeAccounts, cheapest } = await liveFacts();
  const aiCents = Math.max(1, Math.round(cfg.ai_call_cents));
  const acctCents = Math.max(0, Math.round(cfg.account_month_cents));
  const packAnalyses = Math.max(1, Math.round(1000 / aiCents)); // $10 = 1000¢
  // Tramos de comisión de recarga, de menor monto a mayor (más claro para leer).
  const tiers = [...cfg.topup_fee_tiers].sort((a, b) => a.min - b.min);

  const L = (a: string, b: string) => (es ? a : b);

  const faqs: [string, string][] = es ? [
    ['¿Qué es el monedero de Onyx?', 'Es un saldo recargable dentro de tu cuenta, como un monedero. Lo usas para pagar solo por lo que consumas de más en el plan gratis, sin mensualidad. No es retirable: solo sirve dentro de Onyx.'],
    ['¿Qué incluye gratis cada mes?', `El plan gratis incluye cada mes ${freeAccounts} cuenta(s) conectada(s) y un cupo de ${freeAi} análisis de Onyx AI, sin coste. Solo pagas si superas ese cupo.`],
    ['¿Cuánto cuesta usar de más?', `Cada análisis de Onyx AI por encima del cupo cuesta ${money(aiCents)}${acctCents > 0 ? `, y cada cuenta extra conectada ${money(acctCents)} al mes` : ''}. Se descuenta de tu saldo.`],
    ['¿Cómo recargo el saldo?', 'Con tarjeta (Stripe) o con USDT. Eliges el monto; con tarjeta se aplica una pequeña comisión de servicio que baja cuanto más recargas; con USDT se abona a valor nominal.'],
    ['¿Qué pasa si mi saldo llega a $0?', 'Las funciones de pago por uso se pausan hasta que recargues; nada se cobra sin saldo. Puedes activar la auto-recarga para que nunca se corte.'],
    ['¿Me conviene un plan en vez de pagar por uso?', 'Depende de cuánto uses. La app te avisa cuándo un plan te saldría más barato que seguir pagando por uso. Tú decides cuándo cambiarte.'],
  ] : [
    ['What is the Onyx wallet?', "It's a top-up balance inside your account, like a wallet. You use it to pay only for what you consume beyond the free plan, with no monthly fee. It's not withdrawable: it only works inside Onyx."],
    ['What is included free each month?', `The free plan includes each month ${freeAccounts} connected account(s) and an allowance of ${freeAi} Onyx AI analyses, at no cost. You only pay if you go over that allowance.`],
    ['How much does going over cost?', `Each Onyx AI analysis above the allowance costs ${money(aiCents)}${acctCents > 0 ? `, and each extra connected account ${money(acctCents)} per month` : ''}. It comes out of your balance.`],
    ['How do I top up?', 'By card (Stripe) or USDT. You pick the amount; card top-ups carry a small service fee that drops the more you add; USDT is credited at face value.'],
    ['What if my balance hits $0?', 'Pay-as-you-go features pause until you top up; nothing is charged without balance. You can turn on auto-reload so it never cuts off.'],
    ['Is a plan better than paying per use?', 'It depends on how much you use. The app tells you when a plan would be cheaper than paying per use. You decide when to switch.'],
  ];

  const sec: React.CSSProperties = { maxWidth: 820, margin: '0 auto' };
  const h2: React.CSSProperties = { marginTop: 36, marginBottom: 12 };
  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px' };

  return (
    <div className="wrap section" style={sec}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--green)', background: 'rgba(52,226,160,.12)', border: '1px solid rgba(52,226,160,.3)', borderRadius: 99, padding: '5px 14px' }}>
          <OnyxIcon name="money" size={14} glow={false} /> {L('Plan gratis · pago por uso', 'Free plan · pay as you go')}
        </span>
      </div>
      <h1 style={{ textAlign: 'center' }}>{L('El monedero de Onyx: paga solo por lo que uses', 'The Onyx wallet: pay only for what you use')}</h1>
      <p className="muted" style={{ textAlign: 'center', fontSize: 16.5, lineHeight: 1.6, margin: '12px auto 0', maxWidth: 680 }}>
        {L('Empieza gratis, sin mensualidad. Cada mes tienes un cupo incluido; si usas de más, se descuenta unos centavos de tu saldo recargable. Tú controlas el gasto y subes a un plan solo cuando te convenga.',
           'Start free, with no monthly fee. Each month you get an included allowance; if you go over, a few cents come out of your top-up balance. You stay in control and move to a plan only when it pays off.')}
      </p>

      <h2 style={h2}>{L('1. Qué incluye gratis cada mes', '1. What is included free each month')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{freeAccounts}</div><div className="muted" style={{ fontSize: 13.5 }}>{L('cuenta(s) conectada(s) incluida(s)', 'connected account(s) included')}</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{freeAi}</div><div className="muted" style={{ fontSize: 13.5 }}>{L('análisis de Onyx AI al mes', 'Onyx AI analyses per month')}</div></div>
        <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>$0</div><div className="muted" style={{ fontSize: 13.5 }}>{L('sin mensualidad, sin tarjeta', 'no monthly fee, no card')}</div></div>
      </div>

      <h2 style={h2}>{L('2. Qué pagas si usas de más', '2. What you pay if you go over')}</h2>
      <p className="muted" style={{ fontSize: 15, lineHeight: 1.65 }}>
        {L('Solo cuando superas el cupo gratis se descuenta de tu saldo, a estos precios (los fija el equipo de Onyx y se actualizan aquí en vivo):',
           'Only when you go over the free allowance does it come out of your balance, at these prices (set by the Onyx team and updated here live):')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <div style={card}><div style={{ fontWeight: 700, marginBottom: 2 }}>{L('Análisis de IA extra', 'Extra AI analysis')}</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{money(aiCents)}</div><div className="muted" style={{ fontSize: 13 }}>{L('por análisis, pasado el cupo', 'per analysis, over the allowance')}</div></div>
        {acctCents > 0 && <div style={card}><div style={{ fontWeight: 700, marginBottom: 2 }}>{L('Cuenta extra conectada', 'Extra connected account')}</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{money(acctCents)}</div><div className="muted" style={{ fontSize: 13 }}>{L('al mes, por cuenta adicional', 'per month, per extra account')}</div></div>}
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 10 }}>
        {L(`Ejemplo: recargas $10 y te alcanzan para unos ${packAnalyses} análisis extra de Onyx AI.`,
           `Example: top up $10 and it covers about ${packAnalyses} extra Onyx AI analyses.`)}
      </p>

      <h2 style={h2}>{L('3. Cómo recargar tu saldo', '3. How to top up your balance')}</h2>
      <p className="muted" style={{ fontSize: 15, lineHeight: 1.65 }}>
        {L('Recargas el monto que quieras con tarjeta o USDT. Con tarjeta se aplica una comisión de servicio que baja cuanto más recargas; con USDT se abona a valor nominal (sin comisión).',
           'Top up any amount by card or USDT. Card top-ups carry a service fee that drops the more you add; USDT is credited at face value (no fee).')}
      </p>
      <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="cmp-tbl" style={{ minWidth: 360 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--mut)' }}>{L('Recarga con tarjeta', 'Card top-up')}</th>
            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--mut)' }}>{L('Comisión de servicio', 'Service fee')}</th>
          </tr></thead>
          <tbody>
            {tiers.map((t, i) => {
              const next = tiers[i + 1];
              const range = next ? `$${t.min} – $${next.min - 1}` : (t.min > 0 ? `$${t.min}+` : `$0 – $${(tiers[1]?.min ?? 25) - 1}`);
              return <tr key={i}>
                <td style={{ padding: '11px 16px' }}>{range}</td>
                <td style={{ textAlign: 'center', padding: '11px 16px', fontWeight: 700 }}>{t.pct}%</td>
              </tr>;
            })}
            <tr>
              <td style={{ padding: '11px 16px' }}>USDT (TRC-20 / ERC-20)</td>
              <td style={{ textAlign: 'center', padding: '11px 16px', fontWeight: 700, color: 'var(--green)' }}>0%</td>
            </tr>
          </tbody>
        </table>
      </div>
      {cfg.topup_fee_min_cents > 0 && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{L(`Comisión mínima por recarga con tarjeta: ${money(cfg.topup_fee_min_cents)}.`, `Minimum card top-up fee: ${money(cfg.topup_fee_min_cents)}.`)}</p>}

      <h2 style={h2}>{L('4. Auto-recarga (para no quedarte sin saldo)', '4. Auto-reload (so you never run out)')}</h2>
      <p className="muted" style={{ fontSize: 15, lineHeight: 1.65 }}>
        {L('Guardas una tarjeta y, cuando tu saldo baja de un mínimo que tú eliges, Onyx recarga solo el monto que configures. Así las funciones de pago por uso nunca se cortan. Lo activas y lo apagas cuando quieras desde tu cuenta.',
           'Save a card and, when your balance drops below a minimum you choose, Onyx tops up the amount you set automatically. That way pay-as-you-go features never cut off. Turn it on or off anytime from your account.')}
      </p>

      <h2 style={h2}>{L('5. ¿Y cuándo conviene un plan?', '5. When does a plan make sense?')}</h2>
      <p className="muted" style={{ fontSize: 15, lineHeight: 1.65 }}>
        {cheapest
          ? L(`Si un mes gastas por uso más de lo que cuesta un plan (el más barato es ${cheapest.name}, $${cheapest.price}/mes), te conviene suscribirte: pagas menos y desbloqueas todo lo del plan. La propia app te avisa cuándo te sale más barato. Tú decides, siempre.`,
               `If one month you spend more on usage than a plan costs (the cheapest is ${cheapest.name}, $${cheapest.price}/mo), subscribing pays off: you pay less and unlock everything in the plan. The app itself tells you when it's cheaper. You always decide.`)
          : L('Cuando un plan te salga más barato que seguir pagando por uso, la propia app te lo dice. Tú decides, siempre.',
               'When a plan would be cheaper than paying per use, the app itself tells you. You always decide.')}
      </p>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <Link className="btn btn-primary" href="/login?mode=signup">{L('Empezar gratis', 'Start free')}</Link>
        <Link className="btn btn-ghost" href="/pricing">{L('Ver los planes', 'See the plans')}</Link>
      </div>

      <h2 style={h2}>{L('Preguntas frecuentes del monedero', 'Wallet frequently asked questions')}</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {faqs.map(([q, a], i) => (
          <details key={i} className="card" style={{ padding: '14px 18px', cursor: 'pointer' }}>
            <summary style={{ fontWeight: 700, fontSize: 15 }}>{q}</summary>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 8 }}>{a}</div>
          </details>
        ))}
      </div>

      {/* FAQPage (SEO): mismas preguntas en JSON-LD. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      }) }} />
    </div>
  );
}
