'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { errMsg } from '@/lib/i18nErrors';
import PlansCompareTable from '@/app/PlansCompareTable';
import EmbeddedCheckoutModal from '@/app/EmbeddedCheckoutModal';
import OnyxIcon from '@/app/components/OnyxIcon';
import PlanCards from '@/app/PlanCards';
import { getPending } from '@/lib/pendingCheckout';
import { planFacts, trialLine } from '@/lib/planFacts';

// FAQ de precios que se ARMA con los hechos reales de los planes (prueba, ahorro
// anual) — sin números fijos. Si cambias los días o precios en Admin → Planes,
// estas respuestas cambian solas. La pregunta de prueba solo aparece si hay prueba.
function buildFaqs(plans: any[], lang: 'es' | 'en'): [string, string][] {
  const f = planFacts(plans);
  const out: [string, string][] = [];
  if (lang === 'es') {
    out.push(['¿Necesito tarjeta para empezar?', 'No. El plan Free es gratis y sin tarjeta. Solo pides tarjeta o USDT cuando eliges un plan de pago.']);
    if (f.hasTrial) out.push(['¿Hay prueba gratis?', `Sí: ${trialLine(f, 'es')}. Entras con tarjeta pero no se te cobra hasta el día ${f.trialDays}; cancela antes y no pagas nada.`]);
    out.push(['¿Puedo cambiar o cancelar cuando quiera?', 'Sí. Subes o bajas de plan en un clic desde tu cuenta y cancelas cuando quieras; conservas el acceso hasta el fin del período.']);
    out.push(['¿Aceptan cripto?', 'Sí, pagas con tarjeta (Stripe) o USDT. El acceso se activa al confirmar el pago.']);
    if (f.annualPct > 0) out.push(['¿El anual ahorra?', `Sí: pagando al año ahorras un ${f.annualPct}%${f.annualMonthsFree > 0 ? ` (unos ${f.annualMonthsFree} meses gratis)` : ''} frente a pagar mes a mes.`]);
  } else {
    out.push(['Do I need a card to start?', 'No. The Free plan is free and card-free. We only ask for a card or USDT when you pick a paid plan.']);
    if (f.hasTrial) out.push(['Is there a free trial?', `Yes: ${trialLine(f, 'en')}. You enter with a card but you are not charged until day ${f.trialDays}; cancel before then and you pay nothing.`]);
    out.push(['Can I change or cancel anytime?', 'Yes. Upgrade or downgrade in one click from your account and cancel anytime; you keep access until the period ends.']);
    out.push(['Do you accept crypto?', 'Yes, pay with card (Stripe) or USDT. Access activates once the payment confirms.']);
    if (f.annualPct > 0) out.push(['Does annual save money?', `Yes: paying yearly saves you ${f.annualPct}%${f.annualMonthsFree > 0 ? ` (about ${f.annualMonthsFree} months free)` : ''} vs paying monthly.`]);
  }
  return out;
}

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null };
type Lang = 'es' | 'en';

const T = {
  es: { title: 'Planes para cada trader', sub: 'Empieza gratis · sin tarjeta · cancela cuando quieras', monthly: 'Mensual', annual: 'Anual', save: 'ahorra 2 meses', mo: 'mes', yr: 'año', free: 'Empezar gratis', choose: 'Elegir', account: 'Mi cuenta', login: 'Debes iniciar sesión primero', allOf: 'Todo lo de', andMore: 'y además:', popular: '★ Más popular', compareT: 'Compara los planes', accounts: 'Cuentas conectadas', unlimited: 'Ilimitadas', addonNote: 'Todos los planes de pago admiten cuentas extra y esclavas de copy adicionales como add-on, desde tu cuenta.',
    proof: ['Conecta sin comisión', 'Prueba en demo', 'Cancela cuando quieras'], compat: 'Compatible con FTMO, The5ers, FundedNext y +100 prop firms', paySeal: 'Pago seguro con Stripe · Tarjeta o USDT',
    faqT: 'Preguntas sobre los planes',
    faqs: [
      ['¿Necesito tarjeta para empezar?', 'No. El plan Free es gratis y sin tarjeta. Solo pides tarjeta o USDT cuando eliges un plan de pago.'],
      ['¿Puedo cambiar o cancelar cuando quiera?', 'Sí. Subes o bajas de plan en un clic desde tu cuenta y cancelas cuando quieras; conservas el acceso hasta el fin del período.'],
      ['¿Aceptan cripto?', 'Sí, pagas con tarjeta (Stripe) o USDT. El acceso se activa al confirmar el pago.'],
      ['¿El anual ahorra?', 'Sí: pagando al año te salen 2 meses gratis (unos 17% menos) frente a pagar mes a mes.'],
    ] as [string, string][],
  },
  en: { title: 'Plans for every trader', sub: 'Start free · no card · cancel anytime', monthly: 'Monthly', annual: 'Annual', save: 'save 2 months', mo: 'mo', yr: 'yr', free: 'Start free', choose: 'Choose', account: 'My account', login: 'You must log in first', allOf: 'Everything in', andMore: 'and more:', popular: '★ Most popular', compareT: 'Compare plans', accounts: 'Connected accounts', unlimited: 'Unlimited', addonNote: 'All paid plans support extra connected accounts and additional copy slaves as add-ons, from your account.',
    proof: ['Connect with no commission', 'Test on demo', 'Cancel anytime'], compat: 'Works with FTMO, The5ers, FundedNext and 100+ prop firms', paySeal: 'Secure payment with Stripe · Card or USDT',
    faqT: 'Questions about the plans',
    faqs: [
      ['Do I need a card to start?', 'No. The Free plan is free and card-free. We only ask for a card or USDT when you pick a paid plan.'],
      ['Can I change or cancel anytime?', 'Yes. Upgrade or downgrade in one click from your account and cancel anytime; you keep access until the period ends.'],
      ['Do you accept crypto?', 'Yes, pay with card (Stripe) or USDT. Access activates once the payment confirms.'],
      ['Does annual save money?', 'Yes: paying yearly gives you 2 months free (about 17% off) vs paying monthly.'],
    ] as [string, string][],
  },
};

// "Para quién es" cada plan (ancla de persona) y CTA por beneficio.
const ANCHORS: Record<string, { es: string; en: string }> = {
  free: { es: 'Para empezar con 1 cuenta.', en: 'To start with 1 account.' },
  pro: { es: 'Para el que va por el fondeo.', en: 'For the funded-account trader.' },
  elite: { es: 'Para varias cuentas y copy.', en: 'For multiple accounts and copy.' },
  black: { es: 'Para gestores y salas.', en: 'For managers and trading rooms.' },
};
const CTAS: Record<string, { es: string; en: string }> = {
  pro: { es: 'Proteger mi cuenta', en: 'Protect my account' },
  elite: { es: 'Empezar a copiar', en: 'Start copying' },
  black: { es: 'Ir sin límites', en: 'Go unlimited' },
};

// Fallback: si la API no devuelve planes (tabla vacía o sin conexión), mostramos
// estos por defecto para que la página nunca se vea vacía. Los reales (de la BD)
// siempre tienen prioridad.
const DEFAULT_PLANS: Plan[] = [
  { id: 'free', name: 'Free', name_en: 'Free', desc_es: null, desc_en: null, price_month: 0, price_year: 0, max_accounts: 1,
    features: ['1 cuenta conectada', 'Estadísticas básicas', '30 días de historial'],
    features_en: ['1 connected account', 'Basic stats', '30 days of history'], badge: null, badge_en: null },
  { id: 'pro', name: 'Pro', name_en: 'Pro', desc_es: null, desc_en: null, price_month: 19, price_year: 190, max_accounts: 5,
    features: ['5 cuentas conectadas', 'Onyx Guardian: freno de riesgo', 'Historial ilimitado y reglas de fondeo', 'Diario, costes y exportar CSV', 'Crea tu academia (Onyx Academy)'],
    features_en: ['5 connected accounts', 'Onyx Guardian: risk brake', 'Unlimited history & funding rules', 'Journal, costs & CSV export', 'Build your academy (Onyx Academy)'], badge: 'Más popular', badge_en: 'Most popular' },
  { id: 'elite', name: 'Elite', name_en: 'Elite', desc_es: null, desc_en: null, price_month: 79, price_year: 790, max_accounts: 999,
    features: ['Cuentas ilimitadas', 'Copy trading (1 master · 5 esclavas)', 'Cierres parciales y bloqueo por noticias', 'Alertas e informe por Telegram', 'Soporte prioritario'],
    features_en: ['Unlimited accounts', 'Copy trading (1 master · 5 slaves)', 'Partial closes & news blackout', 'Telegram alerts & report', 'Priority support'], badge: null, badge_en: null },
  { id: 'black', name: 'Black Onyx', name_en: 'Black Onyx', desc_es: null, desc_en: null, price_month: 199, price_year: 1990, max_accounts: 999,
    features: ['Copy trading ilimitado (masters y esclavas)', 'Todo sin límites', 'Soporte prioritario'],
    features_en: ['Unlimited copy trading (masters & slaves)', 'Everything with no limits', 'Priority support'], badge: null, badge_en: null },
];


export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState('');
  const { lang, setLang } = useLang();
  const t = dictFor(T, lang);

  useEffect(() => {
    fetch('/api/admin/plans', { cache: 'no-store' }).then((r) => r.json()).then((j) => setPlans(j.plans || [])).catch(() => setPlans([]));
  }, []);

  // Si la BD no devolvió planes, usamos los de por defecto para no dejar la página vacía.
  // Además garantizamos que Black Onyx siempre aparezca como 4º plan (para el 2×2).
  const _base = plans.length ? plans : DEFAULT_PLANS;
  const _black = DEFAULT_PLANS.find((p) => p.id === 'black');
  const shown = (_base.some((p) => /black/i.test(p.id || '')) || !_black) ? _base : [..._base, _black];
  // Hechos de venta reales (prueba, ahorro anual) para toggle y FAQ. Sin números fijos.
  const facts = planFacts(shown as any);
  const dynFaqs = buildFaqs(shown as any, lang);

  // Al volver desde Stripe con el botón "atrás", el navegador restaura la página congelada:
  // reactivamos los botones para que no queden en "cargando".
  useEffect(() => {
    const reset = () => setLoading('');
    window.addEventListener('pageshow', reset);
    window.addEventListener('focus', reset);
    document.addEventListener('visibilitychange', reset);
    return () => { window.removeEventListener('pageshow', reset); window.removeEventListener('focus', reset); document.removeEventListener('visibilitychange', reset); };
  }, []);

  // Checkout embebido: se abre dentro de Onyx (mismo diseño), sin redirigir a Stripe.
  const [co, setCo] = useState<{ plan: string } | null>(null);
  // Cupón del enlace ?promo=CODE (descuento "solo por enlace"). Se pasa al checkout.
  const [promo, setPromo] = useState('');
  useEffect(() => { if (typeof window !== 'undefined') setPromo((new URLSearchParams(window.location.search).get('promo') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)); }, []);

  // Si llegamos con ?plan=<id> (desde el landing de mentores tras registrarse),
  // abrimos el checkout de ese plan automáticamente. Solo una vez.
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (autoTried || typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    // Plan desde la URL o, como respaldo, la intención guardada en el navegador.
    const pend = getPending();
    const pid = ((qs.get('plan') || pend?.plan || '')).replace(/[^a-z0-9_-]/gi, '');
    if (!pid) return;
    const p = shown.find((x) => x.id === pid);
    if (!p) return;                                  // esperamos a que carguen los planes
    const wantAnnual = qs.get('annual') === '1' || !!pend?.annual;  // periodo elegido antes del registro
    if (wantAnnual && !annual) setAnnual(true);
    setAutoTried(true);
    // La intención se limpia cuando el checkout ABRE de verdad (con sesión), dentro
    // del modal. Así, si aquí faltara la sesión (recién confirmado el email) y el
    // checkout devuelve 401, no la perdemos y el flujo de registro sigue vivo.
    const price = wantAnnual ? p.price_year : p.price_month;
    if (price > 0) setCo({ plan: p.id });
  }, [plans, autoTried, annual]);
  async function subscribe(plan: string, price: number) {
    if (plan === 'free' || price === 0) { window.location.href = '/login?mode=signup'; return; }
    setCo({ plan });
  }

  return (
    <>

      <div className="wrap" style={{ padding: '48px 22px 60px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30 }}>{t.title}</h1>
        <p className="muted" style={{ margin: '10px 0 22px' }}>{t.sub}</p>

        <div style={{ display: 'inline-flex', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 30, padding: 4, marginBottom: 30 }}>
          <button className="btn" style={{ borderRadius: 30, background: !annual ? 'var(--grad)' : 'transparent', color: !annual ? '#fff' : 'var(--mut)' }} onClick={() => setAnnual(false)}>{t.monthly}</button>
          <button className="btn" style={{ borderRadius: 30, background: annual ? 'var(--grad)' : 'transparent', color: annual ? '#fff' : 'var(--mut)', display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => setAnnual(true)}>{t.annual} · {t.save} {facts.annualPct > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#04120b', background: 'var(--green)', borderRadius: 20, padding: '1px 7px' }}>−{facts.annualPct}%</span>}</button>
        </div>

        {/* Tira de confianza: sellos rápidos + compatibilidad con prop firms */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', margin: '-8px auto 20px' }}>
          {(t.proof as string[]).map((p) => (
            <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 99, padding: '6px 13px' }}>
              <OnyxIcon name="check" size={12} glow={false} /> {p}
            </span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '-8px auto 22px', maxWidth: 560 }}><OnyxIcon name="shield" size={13} glow={false} /> {t.compat}</p>

        {/* Tarjetas (componente compartido con el landing) */}
        <PlanCards plans={shown as any} lang={lang} annual={annual} loadingId={loading} onChoose={(id, price) => subscribe(id, price)} trust anchors={ANCHORS} ctas={CTAS} />

        {/* Sello de pago seguro */}
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, margin: '16px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><OnyxIcon name="lock" size={13} glow={false} /> {t.paySeal}</p>

        <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, margin: '10px auto 0', maxWidth: 620 }}>➕ {t.addonNote}</p>

        {/* Tabla comparativa (misma que el landing, componente compartido) */}
        <PlansCompareTable plans={shown as any} lang={lang} annual={annual} loadingId={loading}
          onChoose={(id, price) => subscribe(id, price)} />

        {/* Mini-FAQ de precios: resuelve objeciones de compra ahí mismo */}
        <div style={{ maxWidth: 720, margin: '44px auto 0', textAlign: 'left' }}>
          <h2 style={{ fontSize: 20, textAlign: 'center', marginBottom: 16 }}>{t.faqT}</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {dynFaqs.map(([qq, aa], i) => (
              <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 5 }}>{qq}</div>
                <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{aa}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {co && <EmbeddedCheckoutModal plan={co.plan} annual={annual} lang={lang} coupon={promo} onClose={() => setCo(null)} />}
    </>
  );
}
