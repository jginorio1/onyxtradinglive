'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { errMsg } from '@/lib/i18nErrors';
import PlansCompareTable from '@/app/PlansCompareTable';
import EmbeddedCheckoutModal from '@/app/EmbeddedCheckoutModal';

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null };
type Lang = 'es' | 'en';

const T = {
  es: { title: 'Planes para cada trader', sub: 'Empieza gratis · sin tarjeta · cancela cuando quieras', monthly: 'Mensual', annual: 'Anual', save: 'ahorra 2 meses', mo: 'mes', yr: 'año', free: 'Empezar gratis', choose: 'Elegir', account: 'Mi cuenta', login: 'Debes iniciar sesión primero', allOf: 'Todo lo de', andMore: 'y además:', popular: '★ Más popular', compareT: 'Compara los planes', accounts: 'Cuentas MT', unlimited: 'Ilimitadas', addonNote: 'Todos los planes de pago admiten cuentas MT extra y esclavas de copy adicionales como add-on, desde tu cuenta.' },
  en: { title: 'Plans for every trader', sub: 'Start free · no card · cancel anytime', monthly: 'Monthly', annual: 'Annual', save: 'save 2 months', mo: 'mo', yr: 'yr', free: 'Start free', choose: 'Choose', account: 'My account', login: 'You must log in first', allOf: 'Everything in', andMore: 'and more:', popular: '★ Most popular', compareT: 'Compare plans', accounts: 'MT accounts', unlimited: 'Unlimited', addonNote: 'All paid plans support extra MT accounts and additional copy slaves as add-ons, from your account.' },
};


export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState('');
  const { lang, setLang } = useLang();
  const t = T[lang];

  useEffect(() => {
    fetch('/api/admin/plans').then((r) => r.json()).then((j) => setPlans(j.plans || []));
  }, []);

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
        <div className="grid" style={{ textAlign: 'left', alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
          {plans.map((p, i) => {
            const price = annual ? p.price_year : p.price_month;
            const name = lang === 'es' ? p.name : (p.name_en || p.name);
            const desc = lang === 'es' ? p.desc_es : (p.desc_en || p.desc_es);
            const feats = (lang === 'es' ? p.features : (p.features_en?.length ? p.features_en : p.features)) || [];
            const badge = lang === 'es' ? p.badge : (p.badge_en || p.badge);
            const pop = !!badge;
            const prev = plans[i - 1];
            const prevName = prev ? (lang === 'es' ? prev.name : (prev.name_en || prev.name)) : '';
            return (
              <div key={p.id} className="card" style={pop ? { border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.25)', position: 'relative' } : { position: 'relative' }}>
                {pop && <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'var(--grad)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>★ {badge}</span>}
                <h3 style={{ marginTop: pop ? 6 : 0 }}>{name}</h3>
                {desc && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{desc}</p>}
                <div style={{ fontSize: 40, fontWeight: 800, margin: '10px 0 4px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? t.yr : t.mo}</span></div>
                <ul style={{ listStyle: 'none', margin: '16px 0' }}>
                  {i > 0 && <li style={{ padding: '7px 0', color: 'var(--mut)', fontWeight: 700, fontSize: 13 }}>{t.allOf} {prevName}, {t.andMore}</li>}
                  {feats.map((it, j) => <li key={j} style={{ padding: '7px 0', color: '#cdd3e0' }}><span style={{ color: '#34e2a0' }}>✓</span> {it}</li>)}
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
        <PlansCompareTable plans={plans as any} lang={lang} annual={annual} loadingId={loading}
          onChoose={(id, price) => subscribe(id, price)} />
      </div>
      {co && <EmbeddedCheckoutModal plan={co.plan} annual={annual} lang={lang} onClose={() => setCo(null)} />}
    </>
  );
}
