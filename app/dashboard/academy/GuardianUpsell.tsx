'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Tarjeta dentro de la academia que invita al alumno a un plan de Onyx (que YA
// incluye Onyx Guardian). Opción A + a prueba de futuro: los planes, nombres,
// precios y features salen de la MISMA fuente que /pricing (GET /api/admin/plans,
// que lee la BD). Si cambias un precio en Admin → Planes, aquí se actualiza solo.
// Reglas de aparición:
//   • Solo si el alumno ya está en al menos una academia (inAcademy).
//   • Solo si el dueño dejó activa la oferta (enabled, ajuste guardian_academy).
//   • Se oculta si el alumno ya tiene Guardian por su plan (hasManager/hasElite).
type L = (es: string, en: string) => string;

export default function GuardianUpsell({ L, inAcademy }: { L: L; inAcademy?: boolean }) {
  const es = L('es', 'en') === 'es';
  const [g, setG] = useState<any>(null);        // estado Guardian (enabled, hasManager, hasElite)
  const [plans, setPlans] = useState<any[]>([]); // planes reales desde la BD (misma fuente que /pricing)

  useEffect(() => {
    if (!inAcademy) return;
    fetch('/api/academy/guardian').then((r) => r.json()).then(setG).catch(() => {});
    fetch('/api/admin/plans', { cache: 'no-store' }).then((r) => r.json()).then((j) => setPlans(j.plans || [])).catch(() => {});
  }, [inAcademy]);

  // Solo tras unirse a una academia; solo si el dueño la dejó activa; y si el
  // alumno aún no tiene Guardian por su plan (para no ofrecerle lo que ya paga).
  if (!inAcademy || !g || !g.enabled || g.hasManager || g.hasElite) return null;

  // Planes de pago (precio > 0), ordenados por precio, máximo 3. Nombres/precios/features
  // vienen de la BD, así que coinciden siempre con la página de precios.
  const paid = (plans || [])
    .filter((p) => Number(p?.price_month) > 0)
    .sort((a, b) => Number(a.price_month) - Number(b.price_month))
    .slice(0, 3);
  if (!paid.length) return null;   // aún cargando o sin planes: no mostramos nada

  const Feat = ({ t }: { t: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx)' }}>
      <span style={{ color: 'var(--green)', display: 'inline-flex', flex: 'none' }}>✓</span>{t}
    </div>
  );

  const Tier = ({ p }: { p: any }) => {
    const name = (es ? p.name : (p.name_en || p.name)) || p.id;
    const badge = es ? p.badge : (p.badge_en || p.badge);
    const featsRaw = (es ? p.features : (p.features_en || p.features));
    const feats: string[] = Array.isArray(featsRaw) ? featsRaw.slice(0, 4) : [];
    const glow = badge ? 'var(--gold)' : 'var(--brand)';
    return (
      <div className="gdn-card" style={{ '--gc': glow } as any}>
        {badge && <span className="gdn-badge">{badge}</span>}
        <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
          <b style={{ fontSize: 15, color: 'var(--tx)' }}>{name}</b>
          <span style={{ fontSize: 12, color: glow }}>{L('plan', 'plan')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx)' }}>${Number(p.price_month)}</span>
          <span style={{ fontSize: 12.5, color: 'var(--mut)' }}>/{L('mes', 'mo')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {feats.map((f, i) => <Feat key={i} t={f} />)}
        </div>
        <a className="btn btn-primary" style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }} href={`/pricing?plan=${p.id}`}>
          {L('Ver plan', 'See plan')}
        </a>
      </div>
    );
  };

  return (
    <div className="sk-card gdn-wrap">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 4 }}>
        <span className="gdn-ic"><OnyxIcon name="guardian" size={18} /></span>
        <b style={{ fontSize: 15.5, color: 'var(--tx)' }}>{L('Protege tu cuenta con Onyx Guardian', 'Protect your account with Onyx Guardian')}</b>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--mut)', margin: '0 0 14px', lineHeight: 1.55 }}>
        {L('Onyx Guardian viene incluido en tu plan de Onyx: gestiona tu riesgo, cubre costes y respeta las reglas de tu prop firm. Elige el plan que te sirva y actívalo en tu propia cuenta.',
           'Onyx Guardian is included in your Onyx plan: it manages your risk, covers costs and respects your prop-firm rules. Pick the plan that fits and activate it on your own account.')}
      </p>

      <div className="gdn-grid">
        {paid.map((p) => <Tier key={p.id} p={p} />)}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--mut)', margin: '12px 0 0', textAlign: 'center' }}>
        {L('Son los mismos planes de Onyx. Cancelas cuando quieras.',
           'These are the same Onyx plans. Cancel anytime.')}
      </p>
    </div>
  );
}
