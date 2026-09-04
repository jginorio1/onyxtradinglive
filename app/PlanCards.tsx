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
  plans, lang, annual, onChoose, loadingId = '', botTagId = '', freeLabel = '', anchors, trust = false,
}: {
  plans: Plan[]; lang: 'es' | 'en'; annual: boolean;
  onChoose: (planId: string, price: number) => void; loadingId?: string;
  // Marca opcional "Para bots" en un plan (solo landing del constructor). Vacío = sin marca.
  botTagId?: string;
  // Ventas (opcional, solo donde se pasen): CTA del plan gratis, ancla de precio por
  // plan (id → {es,en}) y micro-sellos de confianza bajo el botón.
  freeLabel?: string;
  anchors?: Record<string, { es: string; en: string }>;
  trust?: boolean;
}) {
  const t = {
    yr: lang === 'es' ? 'año' : 'yr', mo: lang === 'es' ? 'mes' : 'mo',
    free: lang === 'es' ? 'Empezar gratis' : 'Start free',
    choose: lang === 'es' ? 'Elegir' : 'Choose',
    allOf: lang === 'es' ? 'Todo lo de' : 'Everything in',
    andMore: lang === 'es' ? 'y además:' : 'and more:',
  };

  // Rejilla FLEX con ajuste centrado, TOPE de 3 por fila: en pantalla ancha van
  // 3 arriba y las 2 restantes centradas debajo; al achicar pasan a 2+2+1 y
  // luego apiladas. Limitamos el ancho a ~3 tarjetas para que nunca queden 5
  // en una sola línea. flex-wrap + justify-content:center centra la última fila.
  const cols = Math.max(1, plans.length);
  const perRow = Math.min(3, cols);
  const maxW = perRow * 272 + (perRow - 1) * 16;
  return (
    <div className="pricing-grid" style={{ textAlign: 'left', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch', gap: 16, maxWidth: maxW, margin: '0 auto' }}>
      {plans.map((p, i) => {
        const price = annual ? p.price_year : p.price_month;
        const name = lang === 'es' ? p.name : (p.name_en || p.name);
        const desc = lang === 'es' ? p.desc_es : (p.desc_en || p.desc_es);
        const feats = (lang === 'es' ? p.features : (p.features_en?.length ? p.features_en : p.features)) || [];
        const badgeRaw = lang === 'es' ? p.badge : (p.badge_en || p.badge);
        const hasBadge = !!badgeRaw;
        // Un solo héroe dorado: "Más popular" → dorado (recomendado); cualquier OTRO
        // badge (p. ej. el tope de gama) → morado premium, para que no compita con el oro.
        const isPopular = /popular/i.test(badgeRaw || '');
        // Reemplazo amable de rótulos internos ("high-ticket" suena a "caro").
        const badgeText = /high[\s-]?ticket|alto\s*valor/i.test(badgeRaw || '')
          ? (lang === 'es' ? 'El definitivo' : 'The ultimate')
          : badgeRaw;
        const gold = 'var(--gold, #e8b923)';
        const goldDark = '#3a2a06';
        const prev = plans[i - 1];
        const prevName = prev ? (lang === 'es' ? prev.name : (prev.name_en || prev.name)) : '';
        const isFree = p.id === 'free' || price === 0;
        const botTag = !!botTagId && p.id === botTagId;
        const goldHi = isPopular || botTag;   // recomendado en DORADO: "popular" en /pricing, "Para bots" en el constructor
        return (
          <div key={p.id} className="card" style={{ flex: '1 1 240px', minWidth: 230, maxWidth: 320, display: 'flex', flexDirection: 'column', ...(goldHi ? { border: `2px solid ${gold}`, boxShadow: '0 0 30px rgba(232,185,35,.28)', position: 'relative' } : hasBadge ? { border: '2px solid var(--brand)', boxShadow: '0 0 30px rgba(124,140,255,.25)', position: 'relative' } : { position: 'relative' }) }}>
            {hasBadge && (isPopular
              ? <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: gold, color: goldDark, fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>★ {badgeText}</span>
              : <span style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'var(--grad)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>◆ {badgeText}</span>)}
            {botTag && <span style={{ position: 'absolute', top: 12, right: 12, background: 'color-mix(in srgb, var(--gold, #e8b923) 20%, transparent)', color: 'var(--gold, #e8b923)', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, border: '1px solid color-mix(in srgb, var(--gold, #e8b923) 45%, transparent)', whiteSpace: 'nowrap' }}>★ {lang === 'es' ? 'Para bots' : 'For bots'}</span>}
            <h3 style={{ marginTop: hasBadge ? 6 : 0 }}>{name}</h3>
            {desc && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{desc}</p>}
            <div style={{ fontSize: 40, fontWeight: 800, margin: '10px 0 4px' }}>${price}<span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/{annual ? t.yr : t.mo}</span></div>
            {anchors?.[p.id] && <div className="muted" style={{ fontSize: 12, marginBottom: 2, lineHeight: 1.4 }}>{lang === 'es' ? anchors[p.id].es : anchors[p.id].en}</div>}
            <ul style={{ listStyle: 'none', margin: '16px 0', flexGrow: 1 }}>
              {i > 0 && <li style={{ padding: '7px 0', color: 'var(--mut)', fontWeight: 700, fontSize: 13 }}>{t.allOf} {prevName}, {t.andMore}</li>}
              {feats.map((it, j) => (
                <li key={j} style={{ padding: '7px 0', color: 'var(--tx)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ flex: 'none', marginTop: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, background: 'var(--green)', color: '#04120b' }}><OnyxIcon name="check" size={13} glow={false} /></span>{it}
                </li>
              ))}
            </ul>
            <button className={'btn ' + (goldHi ? '' : hasBadge ? 'btn-primary' : 'btn-ghost')} style={goldHi ? { width: '100%', background: gold, color: goldDark, border: 'none', fontWeight: 800 } : { width: '100%' }} onClick={() => onChoose(p.id, price)} disabled={loadingId === p.id}>
              {loadingId === p.id ? '...' : (isFree ? (freeLabel || t.free) : t.choose + ' ' + name)}
            </button>
            {trust && <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <OnyxIcon name="check" size={11} glow={false} /> {isFree ? (lang === 'es' ? 'Sin tarjeta · Sin compromiso' : 'No card · No commitment') : (lang === 'es' ? 'Cancela cuando quieras' : 'Cancel anytime')}
            </div>}
          </div>
        );
      })}
    </div>
  );
}
