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

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null };
type Lang = 'es' | 'en';

const T = {
  es: { title: 'Planes para cada trader', sub: 'Empieza gratis · sin tarjeta · cancela cuando quieras', monthly: 'Mensual', annual: 'Anual', save: 'ahorra 2 meses', mo: 'mes', yr: 'año', free: 'Empezar gratis', choose: 'Elegir', account: 'Mi cuenta', login: 'Debes iniciar sesión primero', allOf: 'Todo lo de', andMore: 'y además:', popular: '★ Más popular', compareT: 'Compara los planes', accounts: 'Cuentas conectadas', unlimited: 'Ilimitadas', addonNote: 'Todos los planes de pago admiten cuentas extra y esclavas de copy adicionales como add-on, desde tu cuenta.' },
  en: { title: 'Plans for every trader', sub: 'Start free · no card · cancel anytime', monthly: 'Monthly', annual: 'Annual', save: 'save 2 months', mo: 'mo', yr: 'yr', free: 'Start free', choose: 'Choose', account: 'My account', login: 'You must log in first', allOf: 'Everything in', andMore: 'and more:', popular: '★ Most popular', compareT: 'Compare plans', accounts: 'Connected accounts', unlimited: 'Unlimited', addonNote: 'All paid plans support extra connected accounts and additional copy slaves as add-ons, from your account.' },
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
          <button className="btn" style={{ borderRadius: 30, background: annual ? 'var(--grad)' : 'transparent', color: annual ? '#fff' : 'var(--mut)' }} onClick={() => setAnnual(true)}>{t.annual} · {t.save}</button>
        </div>

        {/* Tarjetas (componente compartido con el landing) */}
        <PlanCards plans={shown as any} lang={lang} annual={annual} loadingId={loading} onChoose={(id, price) => subscribe(id, price)} />

        <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, margin: '14px auto 0', maxWidth: 620 }}>➕ {t.addonNote}</p>

        {/* Tabla comparativa (misma que el landing, componente compartido) */}
        <PlansCompareTable plans={shown as any} lang={lang} annual={annual} loadingId={loading}
          onChoose={(id, price) => subscribe(id, price)} />
      </div>
      {co && <EmbeddedCheckoutModal plan={co.plan} annual={annual} lang={lang} coupon={promo} onClose={() => setCo(null)} />}
    </>
  );
}
