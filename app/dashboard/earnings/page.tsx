'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

const GOLD = '#ffd45e';
const money = (c: number) => '$' + (Math.round((c || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type Prog = { key: string; es: string; en: string; descEs: string; descEn: string; icon: string; kind: 'withdraw' | 'credit' | 'direct'; availableCents: number; pendingCents: number; paidCents: number; href: string };
type Data = { currency: string; totalAvailableCents: number; totalCreditCents: number; totalPendingCents: number; totalPaidCents: number; programs: Prog[] };

export default function EarningsCenterPage() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/earnings-center', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setD(j); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const kindLabel = (k: string) => k === 'withdraw' ? (es ? 'Retirable' : 'Withdrawable') : k === 'credit' ? (es ? 'Crédito en tu plan' : 'Plan credit') : (es ? 'Directo a tu Stripe' : 'Straight to your Stripe');
  const kindColor = (k: string) => k === 'withdraw' ? 'var(--green)' : k === 'credit' ? 'var(--brand)' : 'var(--mut)';

  const active = (d?.programs || []).filter((p) => (p.availableCents + p.pendingCents + p.paidCents) > 0);

  return (
    <div className="wrap" style={{ maxWidth: 960, margin: '0 auto', padding: '18px 16px 70px' }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>{es ? 'Centro de ganancias' : 'Earnings center'}</h1>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>{es ? 'Todo lo que ganas en Onyx, en un solo lugar: ventas, referidos, comisiones y créditos.' : 'Everything you earn on Onyx, in one place: sales, referrals, commissions and credits.'}</p>
        </div>
        <Link href="/dashboard/payout-settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', textDecoration: 'none', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
          <OnyxIcon emoji="⚙️" size={16} /> {es ? 'Configuración de cobro' : 'Payout settings'}
        </Link>
      </div>

      {/* Resumen grande */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ borderRadius: 16, padding: 18, background: 'linear-gradient(135deg, color-mix(in srgb,var(--green) 20%,var(--card)), var(--card))', border: '1px solid color-mix(in srgb,var(--green) 35%,var(--line))' }}>
          <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Disponible para retirar' : 'Available to withdraw'}</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--green)' }}>{money(d?.totalAvailableCents || 0)}</div>
        </div>
        <Kpi label={es ? 'En espera' : 'Pending'} value={money(d?.totalPendingCents || 0)} color="var(--amber)" hint={es ? 'Madurando' : 'Maturing'} />
        <Kpi label={es ? 'Crédito en tu plan' : 'Plan credit'} value={money(d?.totalCreditCents || 0)} color="var(--brand)" hint={es ? 'Se aplica solo' : 'Auto-applied'} />
        <Kpi label={es ? 'Cobrado (histórico)' : 'Earned (all time)'} value={money(d?.totalPaidCents || 0)} color="var(--tx)" hint={es ? 'Total de todos los programas' : 'Across all programs'} />
      </div>

      {loading ? (
        <div className="muted" style={{ padding: 30, textAlign: 'center' }}>{es ? 'Cargando tus ganancias…' : 'Loading your earnings…'}</div>
      ) : active.length === 0 ? (
        <EmptyState es={es} />
      ) : (
        <>
          <h2 style={{ fontSize: 16, margin: '4px 0 12px' }}>{es ? 'Por programa' : 'By program'}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {active.map((p) => (
              <Link key={p.key} href={p.href} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ borderRadius: 14, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', transition: '.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}>
                  <span style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><OnyxIcon emoji={p.icon} size={24} /></span>
                  <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 15 }}>{es ? p.es : p.en}</b>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: kindColor(p.kind), border: `1px solid color-mix(in srgb,${kindColor(p.kind)} 40%,transparent)`, borderRadius: 99, padding: '2px 8px' }}>{kindLabel(p.kind)}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{es ? p.descEs : p.descEn}</div>
                  </div>
                  {/* montos por programa */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {p.kind === 'withdraw' && <Mini label={es ? 'Disponible' : 'Available'} value={money(p.availableCents)} color="var(--green)" />}
                    {p.kind === 'withdraw' && p.pendingCents > 0 && <Mini label={es ? 'En espera' : 'Pending'} value={money(p.pendingCents)} color="var(--amber)" />}
                    {p.kind === 'credit' && <Mini label={es ? 'Crédito' : 'Credit'} value={money(p.availableCents + p.pendingCents)} color="var(--brand)" />}
                    <Mini label={p.kind === 'direct' ? (es ? 'Cobrado' : 'Earned') : (es ? 'Pagado' : 'Paid')} value={money(p.paidCents)} color="var(--mut)" />
                  </div>
                  <span style={{ color: 'var(--brand)', fontWeight: 800, fontSize: 13, flex: 'none' }}>{p.kind === 'withdraw' ? (es ? 'Retirar →' : 'Withdraw →') : (es ? 'Ver →' : 'View →')}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Nota de claridad */}
      <div className="muted" style={{ fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
        {es
          ? 'Cada programa conserva su propio retiro y su propia protección (maduración anti-reembolso, verificación de cobro y reversa por reembolso). Este centro solo reúne los saldos para que los veas juntos; para retirar, entra al programa correspondiente.'
          : 'Each program keeps its own withdrawal and its own protection (anti-refund maturation, payout verification and refund reversal). This center just gathers the balances so you see them together; to withdraw, open the matching program.'}
      </div>
    </div>
  );
}

function Kpi({ label, value, color, hint }: any) {
  return (
    <div style={{ borderRadius: 16, padding: 18, background: 'var(--card)', border: '1px solid var(--line)' }}>
      <div className="muted" style={{ fontSize: 12.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {hint && <div className="muted" style={{ fontSize: 11 }}>{hint}</div>}
    </div>
  );
}
function Mini({ label, value, color }: any) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="muted" style={{ fontSize: 10.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function EmptyState({ es }: { es: boolean }) {
  const ways: [string, string, string, string][] = [
    ['🤖', 'Bot Lab', es ? 'Vende tus robots o comparte los de otros' : 'Sell your robots or share others\'', '/dashboard/bot-lab?tab=ganancias'],
    ['📣', es ? 'Embajador' : 'Ambassador', es ? 'Comisión recurrente por cada suscriptor' : 'Recurring commission per subscriber', '/account?refv=embajador#referidos'],
    ['🎁', es ? 'Invita y gana' : 'Invite & earn', es ? 'Crédito por invitar amigos' : 'Credit for inviting friends', '/account?refv=invita#referidos'],
    ['🏆', 'Onyx Copy', es ? 'Cobra a quienes copian tu estrategia' : 'Charge those who copy your strategy', '/dashboard/onyx-copy'],
  ];
  return (
    <div style={{ borderRadius: 16, padding: 24, background: 'var(--card)', border: '1px solid var(--line)', textAlign: 'center' }}>
      <div style={{ fontSize: 34 }}>💰</div>
      <h3 style={{ margin: '8px 0 4px' }}>{es ? 'Aún no tienes ganancias' : 'No earnings yet'}</h3>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 480, margin: '0 auto 16px' }}>{es ? 'Estas son las formas de ganar dinero dentro de Onyx. Empieza por la que más te encaje.' : 'These are the ways to earn money inside Onyx. Start with whichever fits you best.'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, textAlign: 'left', alignItems: 'stretch' }}>
        {ways.map(([ic, t, dsc, href]) => (
          <Link key={t} href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', height: '100%', minHeight: 64, boxSizing: 'border-box' }}>
              <span style={{ flex: 'none', display: 'inline-flex' }}><OnyxIcon emoji={ic} size={20} /></span>
              <div><b style={{ fontSize: 13.5 }}>{t}</b><div className="muted" style={{ fontSize: 11.5 }}>{dsc}</div></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
