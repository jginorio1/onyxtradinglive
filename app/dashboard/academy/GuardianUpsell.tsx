'use client';
import { toast, confirmDialog } from '@/lib/toast';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Tarjeta iluminada para que el alumno se suscriba a Onyx Guardian dentro de la
// academia. Se muestra solo si el dueño lo activó y el alumno aún no tiene ese
// nivel. Si ya tiene Pro, solo ofrece el salto a Elite. El cobro va a Onyx.
type L = (es: string, en: string) => string;

const money = (cents: number, cur: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'usd').toUpperCase(), maximumFractionDigits: 0 }).format((cents || 0) / 100);

export default function GuardianUpsell({ L }: { L: L }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    fetch('/api/academy/guardian').then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  async function buy(tier: 'pro' | 'elite') {
    setBusy(tier);
    try {
      const r = await fetch('/api/academy/guardian', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier }) });
      const j = await r.json();
      if (j.url) { window.location.href = j.url; return; }
      toast(j.error || 'Error');
    } catch { toast('Error'); }
    setBusy('');
  }

  if (!d || !d.enabled || d.hasElite) return null;   // ya tiene el máximo o está apagado
  const onlyElite = d.hasManager;                    // ya tiene Pro (o plan con Guardian): solo Elite

  const proFeats = [
    L('Break even que cubre costes', 'Break even that covers costs'),
    L('Trailing stop', 'Trailing stop'),
    L('Límites con margen de seguridad', 'Limits with safety margin'),
    L('Indicador de disciplina', 'Discipline indicator'),
  ];
  const eliteFeats = [
    L('Todo lo de Pro, y además:', 'Everything in Pro, plus:'),
    L('Cierres parciales (varios TP)', 'Partial closes (multiple TPs)'),
    L('Bloqueo por noticias', 'News blackout'),
    L('Alertas e informe por Telegram', 'Telegram alerts and report'),
  ];

  const Feat = ({ t }: { t: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx)' }}>
      <span style={{ color: 'var(--green)', display: 'inline-flex', flex: 'none' }}>✓</span>{t}
    </div>
  );

  const Tier = ({ tier, name, badge, cents, feats, glow }: any) => (
    <div className="gdn-card" style={{ '--gc': glow } as any}>
      {badge && <span className="gdn-badge">{badge}</span>}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
        <b style={{ fontSize: 15, color: 'var(--tx)' }}>{name}</b>
        <span style={{ fontSize: 12, color: glow }}>{tier === 'elite' ? L('completo', 'complete') : L('básico', 'basic')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx)' }}>{money(cents, d.currency)}</span>
        <span style={{ fontSize: 12.5, color: 'var(--mut)' }}>/{L('mes', 'mo')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {feats.map((f: string) => <Feat key={f} t={f} />)}
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!!busy} onClick={() => buy(tier)}>
        {busy === tier ? '…' : (tier === 'elite' ? L('Activar Elite', 'Get Elite') : L('Activar Pro', 'Get Pro'))}
      </button>
    </div>
  );

  return (
    <div className="sk-card gdn-wrap">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 4 }}>
        <span className="gdn-ic"><OnyxIcon name="guardian" size={18} /></span>
        <b style={{ fontSize: 15.5, color: 'var(--tx)' }}>{L('Protege tu cuenta con Onyx Guardian', 'Protect your account with Onyx Guardian')}</b>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--mut)', margin: '0 0 14px', lineHeight: 1.55 }}>
        {onlyElite
          ? L('Ya tienes Guardian básico. Sube a Elite y desbloquea cierres parciales, bloqueo por noticias y alertas por Telegram.',
              'You already have basic Guardian. Upgrade to Elite for partial closes, news blackout and Telegram alerts.')
          : L('El gestor de riesgo que cuida tu operativa por ti: límites automáticos, break even y disciplina. Actívalo sin salir de la academia.',
              'The risk manager that guards your trading for you: automatic limits, break even and discipline. Activate it without leaving the academy.')}
      </p>

      <div className="gdn-grid" style={onlyElite ? { gridTemplateColumns: '1fr', maxWidth: 340 } : undefined}>
        {!onlyElite && <Tier tier="pro" name="Guardian Pro" cents={d.proCents} feats={proFeats} glow="var(--brand)" />}
        <Tier tier="elite" name="Guardian Elite" badge={L('Recomendado', 'Recommended')} cents={d.eliteCents} feats={eliteFeats} glow="var(--gold)" />
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--mut)', margin: '12px 0 0', textAlign: 'center' }}>
        {L('Cancelas cuando quieras. Si cancelas, Guardian se desactiva al terminar el mes pagado.',
           'Cancel anytime. If you cancel, Guardian turns off when the paid month ends.')}
      </p>
    </div>
  );
}
