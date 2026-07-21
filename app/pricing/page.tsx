'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null };
type Lang = 'es' | 'en';

const T = {
  es: { title: 'Planes para cada trader', sub: 'Cancela cuando quieras.', monthly: 'Mensual', annual: 'Anual', mo: 'mes', yr: 'año', free: 'Empezar gratis', choose: 'Elegir', account: 'Mi cuenta', login: 'Debes iniciar sesión primero' },
  en: { title: 'Plans for every trader', sub: 'Cancel anytime.', monthly: 'Monthly', annual: 'Annual', mo: 'mo', yr: 'yr', free: 'Start free', choose: 'Choose', account: 'My account', login: 'You must log in first' },
};

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState('');
  const [lang, setLang] = useState<Lang>('es');
  const t = T[lang];

  useEffect(() => {
    try { const s = localStorage.getItem('onyx_lang'); if (s === 'en' || s === 'es') setLang(s); } catch {}
    fetch('/api/admin/plans').then((r) => r.json()).then((j) => setPlans(j.plans || []));
  }, []);
  function switchLang(l: Lang) { setLang(l); try { localStorage.setItem('onyx_lang', l); } catch {} }

  async function subscribe(plan: string, price: number) {
    if (plan === 'free' || price === 0) { window.location.href = '/login?mode=signup'; return; }
    setLoading(plan);
    const r = await fetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan, annual }) });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else { alert(j.error || t.login); setLoading(''); }
  }

  return (
    <>
      <div className="topbar"><div className="wrap">
        <Link className="logo" href="/"><span className="mark">◆</span> Onyx Trading Live</Link>
        <div className="row">
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => switchLang(lang === 'es' ? 'en' : 'es')}>{lang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES'}</button>
          <Link className="btn btn-ghost" href="/dashboard">{t.account}</Link>
        </div>
      </div></div>

      <div className="wrap" style={{ padding: '48px 22px', textAlign: 'center' }}>
        <h1>{t.title}</h1>
        <p className="muted" style={{ margin: '10px 0 20px' }}>{t.sub}</p>

        <div className="row" style={{ justifyContent: 'center', marginBottom: 30 }}>
          <button className={'btn ' + (!annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(false)}>{t.monthly}</button>
          <button className={'btn ' + (annual ? 'btn-primary' : 'btn-ghost')} onClick={() => setAnnual(true)}>{t.annual}</button>
        </div>

        <div className="grid g3" style={{ textAlign: 'left' }}>
          {plans.map((p) => {
            const price = annual ? p.price_year : p.price_month;
            const name = lang === 'es' ? p.name : (p.name_en || p.name);
            const desc = lang === 'es' ? p.desc_es : (p.desc_en || p.desc_es);
            const feats = (lang === 'es' ? p.features : (p.features_en?.length ? p.features_en : p.features)) || [];
            const badge = lang === 'es' ? p.badge : (p.badge_en || p.badge);
            const pop = !!badge;
            return (
              <div key={p.id} className="card" style={pop ? { border: '2px solid var(--brand)' } : {}}>
                {badge && <span className="pill green" style={{ marginBottom: 8, display: 'inline-block' }}>{badge}</span>}
                <h3>{name}</h3>
                {desc && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{desc}</p>}
                <div style={{ fontSize: 40, fontWeight: 800, margin: '10px 0 4px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? t.yr : t.mo}</span></div>
                <ul style={{ listStyle: 'none', margin: '16px 0' }}>
                  {feats.map((it, i) => <li key={i} style={{ padding: '7px 0', color: '#cdd3e0' }}>✓ {it}</li>)}
                </ul>
                <button className={'btn ' + (pop ? 'btn-primary' : 'btn-ghost')} style={{ width: '100%' }} onClick={() => subscribe(p.id, price)} disabled={loading === p.id}>
                  {loading === p.id ? '...' : (price === 0 ? t.free : t.choose + ' ' + name)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
