'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Tarjeta dentro de la academia para invitar al alumno a un plan de Onyx (que YA
// incluye Onyx Guardian). Opción A: enseñamos los MISMOS planes/nombres/precios
// que /pricing — una sola fuente de precios, sin producto paralelo ni confusión.
// Reglas de aparición:
//   • Solo si el alumno ya está en al menos una academia (inAcademy).
//   • Solo si el dueño dejó activa la oferta (enabled, ajuste guardian_academy).
//   • Se oculta si el alumno ya tiene Guardian por su plan (hasManager/hasElite).
type L = (es: string, en: string) => string;

// Planes reales de Onyx (mismos nombres y precios que la página /pricing).
// Si cambias precios, hazlo también en app/pricing/page.tsx (fuente visible).
const PLANS = (L: L) => [
  {
    id: 'pro', name: 'Pro', price: 19, glow: 'var(--brand)', badge: '',
    feats: [
      L('Onyx Guardian (break even, trailing, límites)', 'Onyx Guardian (break even, trailing, limits)'),
      L('Hasta 5 cuentas conectadas', 'Up to 5 connected accounts'),
      L('Estadísticas e historial ilimitado', 'Stats and unlimited history'),
    ],
  },
  {
    id: 'elite', name: 'Elite', price: 79, glow: 'var(--gold)', badge: L('Recomendado', 'Recommended'),
    feats: [
      L('Todo lo de Pro, y además:', 'Everything in Pro, plus:'),
      L('Guardian completo: parciales y bloqueo por noticias', 'Full Guardian: partials and news blackout'),
      L('Alertas e informe por Telegram', 'Telegram alerts and report'),
    ],
  },
  {
    id: 'black', name: 'Black Onyx', price: 199, glow: 'var(--brand)', badge: '',
    feats: [
      L('Todo lo de Elite, y además:', 'Everything in Elite, plus:'),
      L('Cuentas conectadas ilimitadas', 'Unlimited connected accounts'),
      L('Copy trading ilimitado', 'Unlimited copy trading'),
    ],
  },
];

export default function GuardianUpsell({ L, inAcademy }: { L: L; inAcademy?: boolean }) {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    if (!inAcademy) return;
    fetch('/api/academy/guardian').then((r) => r.json()).then(setD).catch(() => {});
  }, [inAcademy]);

  // Solo tras unirse a una academia; solo si el dueño la dejó activa; y si el
  // alumno aún no tiene Guardian por su plan (para no ofrecerle lo que ya paga).
  if (!inAcademy || !d || !d.enabled || d.hasManager || d.hasElite) return null;

  const plans = PLANS(L);

  const Feat = ({ t }: { t: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx)' }}>
      <span style={{ color: 'var(--green)', display: 'inline-flex', flex: 'none' }}>✓</span>{t}
    </div>
  );

  const Tier = ({ p }: { p: any }) => (
    <div className="gdn-card" style={{ '--gc': p.glow } as any}>
      {p.badge && <span className="gdn-badge">{p.badge}</span>}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
        <b style={{ fontSize: 15, color: 'var(--tx)' }}>{p.name}</b>
        <span style={{ fontSize: 12, color: p.glow }}>{L('plan', 'plan')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx)' }}>${p.price}</span>
        <span style={{ fontSize: 12.5, color: 'var(--mut)' }}>/{L('mes', 'mo')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {p.feats.map((f: string) => <Feat key={f} t={f} />)}
      </div>
      <a className="btn btn-primary" style={{ width: '100%', textAlign: 'center', textDecoration: 'none' }} href={`/pricing?plan=${p.id}`}>
        {L('Ver plan', 'See plan')}
      </a>
    </div>
  );

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
        {plans.map((p) => <Tier key={p.id} p={p} />)}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--mut)', margin: '12px 0 0', textAlign: 'center' }}>
        {L('Son los mismos planes de Onyx. Cancelas cuando quieras.',
           'These are the same Onyx plans. Cancel anytime.')}
      </p>
    </div>
  );
}
