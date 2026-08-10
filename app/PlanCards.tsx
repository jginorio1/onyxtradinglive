'use client';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Tarjetas de planes. FUENTE ÚNICA compartida por el landing y /pricing.
//
// Antes cada página dibujaba sus propias tarjetas (con precios y checks
// distintos) y se desincronizaban: el landing quedaba con precios viejos
// y el check antiguo. Ahora las dos usan este mismo componente, así lo que
// se ve es idéntico en los dos sitios y no vuelve a divergir.
// ============================================================
type Plan = {
  id: string; name: string; name_en?: string; desc_es?: string | null; desc_en?: string | null;
  price_month: number; price_year: number;
  features?: string[]; features_en?: string[]; badge?: string | null; badge_en?: string | null;
};

export default function PlanCards({
  plans, lang, annual, onChoose, loadingId = '',
}: {
  plans: Plan[]; lang: 'es' | 'en'; annual: boolean;
  onChoose: (planId: string, price: number) => void; loadingId?: string;
}) {
  const t = {
    yr: lang === 'es' ? 'año' : 'yr', mo: lang === 'es' ? 'mes' : 'mo',
    free: lang === 'es' ? 'Empezar gratis' : 'Start free',
    choose: lang === 'es' ? 'Elegir' : 'Choose',
    allOf: lang === 'es' ? 'Todo lo de' : 'Everything in',
    andMore: lang === 'es' ? 'y además:' : 'and more:',
  };

  return (
    <div className="pricing-grid" style={{ textAlign: 'left', alignItems: 'start', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', maxWidth: 760, margin: '0 auto' }}>
      {plans.map((p, i) => {
        const price = annual ? p.price_year : p.price_month;
        const name = lang === 'es' ? p.name : (p.name_en || p.name);
        const desc = lang === 'es' ? p.desc_es : (p.desc_en || p.desc_es);
        const feats = (lang === 'es' ? p.features : (p.features_en?.length ? p.features_en : p.features)) || [];
        const badge = lang === 'es' ? p.badge : (p.badge_en || p.badge);
        const pop = !!badge;
        const prev = plans[i - 1];
        const prevName = prev ? (lang === 'es' ? prev.name : (prev.name_en || prev.name)) : '';
        const isFree = p.id === 'free' || price === 0;
        return (
          <div key={p.id} className="card" style={pop ? { border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.25)', position: 'relative' } : { position: 'relative' }}>
            {pop && <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'var(--grad)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>★ {badge}</span>}
            <h3 style={{ marginTop: pop ? 6 : 0 }}>{name}</h3>
            {desc && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{desc}</p>}
            <div style={{ fontSize: 40, fontWeight: 800, margin: '10px 0 4px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? t.yr : t.mo}</span></div>
            <ul style={{ listStyle: 'none', margin: '16px 0' }}>
              {i > 0 && <li style={{ padding: '7px 0', color: 'var(--mut)', fontWeight: 700, fontSize: 13 }}>{t.allOf} {prevName}, {t.andMore}</li>}
              {feats.map((it, j) => (
                <li key={j} style={{ padding: '7px 0', color: 'var(--tx)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ flex: 'none', marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, background: 'var(--green)', color: '#04120b' }}><OnyxIcon name="check" size={13} glow={false} /></span>{it}
                </li>
              ))}
            </ul>
            <button className={'btn ' + (pop ? 'btn-primary' : 'btn-ghost')} style={{ width: '100%' }} onClick={() => onChoose(p.id, price)} disabled={loadingId === p.id}>
              {loadingId === p.id ? '...' : (isFree ? t.free : t.choose + ' ' + name)}
            </button>
          </div>
        );
      })}
    </div>
  );
}
