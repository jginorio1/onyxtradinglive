'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { errMsg } from '@/lib/i18nErrors';
import PlansCompareTable from '@/app/PlansCompareTable';
import EmbeddedCheckoutModal from '@/app/EmbeddedCheckoutModal';

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
    features: ['5 cuentas conectadas', 'Todas las estadísticas', 'Historial ilimitado', 'Calendario y gráficas', 'Reglas de fondeo'],
    features_en: ['5 connected accounts', 'All stats', 'Unlimited history', 'Calendar & charts', 'Prop-firm rules'], badge: 'Más popular', badge_en: 'Most popular' },
  { id: 'elite', name: 'Elite', name_en: 'Elite', desc_es: null, desc_en: null, price_month: 39, price_year: 390, max_accounts: 999,
    features: ['Cuentas ilimitadas', 'Todo lo de Pro', 'Informes automáticos', 'Alertas por Telegram', 'Soporte prioritario'],
    features_en: ['Unlimited accounts', 'Everything in Pro', 'Automatic reports', 'Telegram alerts', 'Priority support'], badge: null, badge_en: null },
  { id: 'black', name: 'Black Onyx', name_en: 'Black Onyx', desc_es: null, desc_en: null, price_month: 99, price_year: 990, max_accounts: 999,
    features: ['Todo ilimitado', 'Copy trading ilimitado', 'Onyx Guardian completo', 'Academia + Telegram', 'Soporte prioritario'],
    features_en: ['Everything unlimited', 'Unlimited copy trading', 'Full Onyx Guardian', 'Academy + Telegram', 'Priority support'], badge: null, badge_en: null },
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

        {/* Tarjetas */}
        <div className="pricing-grid" style={{ textAlign: 'left', alignItems: 'start', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', maxWidth: 760, margin: '0 auto' }}>
          {shown.map((p, i) => {
            const price = annual ? p.price_year : p.price_month;
            const name = lang === 'es' ? p.name : (p.name_en || p.name);
            const desc = lang === 'es' ? p.desc_es : (p.desc_en || p.desc_es);
            const feats = (lang === 'es' ? p.features : (p.features_en?.length ? p.features_en : p.features)) || [];
            const badge = lang === 'es' ? p.badge : (p.badge_en || p.badge);
            const pop = !!badge;
            const prev = shown[i - 1];
            const prevName = prev ? (lang === 'es' ? prev.name : (prev.name_en || prev.name)) : '';
            return (
              <div key={p.id} className="card" style={pop ? { border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.25)', position: 'relative' } : { position: 'relative' }}>
                {pop && <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'var(--grad)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>★ {badge}</span>}
                <h3 style={{ marginTop: pop ? 6 : 0 }}>{name}</h3>
                {desc && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{desc}</p>}
                <div style={{ fontSize: 40, fontWeight: 800, margin: '10px 0 4px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? t.yr : t.mo}</span></div>
                <ul style={{ listStyle: 'none', margin: '16px 0' }}>
                  {i > 0 && <li style={{ padding: '7px 0', color: 'var(--mut)', fontWeight: 700, fontSize: 13 }}>{t.allOf} {prevName}, {t.andMore}</li>}
                  {feats.map((it, j) => <li key={j} style={{ padding: '7px 0', color: '#cdd3e0' }}><span style={{ color: 'var(--green)' }}>✓</span> {it}</li>)}
                </ul>
                <button className={'btn ' + (pop ? 'btn-primary' : 'btn-ghost')} style={{ width: '100%' }} onClick={() => subscribe(p.id, price)} disabled={loading === p.id}>
                  {loading === p.id ? '...' : (price === 0 ? t.free : t.choose + ' ' + name)}
                </button>
              </div>
            );
          })}
        </div>

        <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, margin: '14px auto 0', maxWidth: 620 }}>➕ {t.addonNote}</p>

        {/* Tabla comparativa (misma que el landing, componente compartido) */}
        <PlansCompareTable plans={shown as any} lang={lang} annual={annual} loadingId={loading}
          onChoose={(id, price) => subscribe(id, price)} />
      </div>
      {co && <EmbeddedCheckoutModal plan={co.plan} annual={annual} lang={lang} onClose={() => setCo(null)} />}
    </>
  );
}
