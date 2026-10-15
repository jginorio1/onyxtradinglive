'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import { nativePlatform } from '@/lib/native';

// Aviso que aparece cuando el usuario alcanzó su tope mensual de Onyx AI.
// Se adapta al plan: los de pago pueden COMPRAR un paquete extra (pago único);
// los Gratis ven una invitación a SUBIR DE PLAN (no pueden comprar sin tarjeta).
type Allowance = {
  plan?: string; used?: number; limit?: number; unlimited?: boolean;
  canBuy?: boolean; packOn?: boolean; packQty?: number; packPrice?: number;
};
export default function AiLimitNotice({ allowance, lang = 'es', onBought }: { allowance: Allowance; lang?: string; onBought?: () => void }) {
  const en = lang === 'en';
  const L = (es: string, e: string) => (en ? e : es);
  const a = allowance || {};
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  // En iOS, Apple NO permite vender el paquete de IA (bien digital consumible) con
  // Stripe. Ahí se oculta el botón de comprar el pack, pero SÍ se deja "subir de
  // plan" porque el upgrade en la app de iPhone va por el pago nativo de Apple.
  const ios = nativePlatform() === 'ios';
  const canBuy = !!a.canBuy && a.packOn !== false && !ios;
  const qty = a.packQty || 100;
  const price = a.packPrice || 5;

  async function buy() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/account/addons/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qty: 1 }) });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error || L('No se pudo comprar. Intenta de nuevo.', "Couldn't buy. Try again.")); return; }
      setDone(true); onBought && onBought();
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={{ background: 'rgba(52,199,120,.12)', border: '1px solid rgba(52,199,120,.35)', borderRadius: 12, padding: '14px 16px', fontSize: 13.5 }}>
        <b style={{ color: 'var(--green)' }}><OnyxIcon emoji="✅" size={15} /> {L('¡Listo! Se sumaron', 'Done! Added')} +{qty} {L('consultas a este mes.', 'questions to this month.')}</b>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{L('Ya puedes volver a usar Onyx AI.', 'You can use Onyx AI again now.')}</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
        <OnyxIcon emoji="✨" size={16} /> {L('Llegaste a tu límite de Onyx AI', 'You hit your Onyx AI limit')}
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
        {a.limit != null
          ? L(`Usaste tus ${a.used ?? a.limit}/${a.limit} consultas de este mes.`, `You used your ${a.used ?? a.limit}/${a.limit} questions this month.`)
          : L('Usaste tus consultas de este mes.', 'You used this month\'s questions.')}{' '}
        {L('Se reinician el día 1 del próximo mes.', 'They reset on the 1st of next month.')}
      </div>

      {canBuy ? (
        <>
          <div style={{ background: 'rgba(124,140,255,.12)', border: '1px solid rgba(124,140,255,.3)', borderRadius: 10, padding: '9px 11px', margin: '10px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft-brand, var(--brand))' }}><OnyxIcon emoji="⚡" size={14} /> {L(`Compra +${qty} consultas por $${price}`, `Buy +${qty} questions for $${price}`)}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{L('Pago único. Se usan solo este mes, sin suscripción.', 'One-time. Used this month only, no subscription.')}</div>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={buy} disabled={busy} style={{ fontSize: 13 }}>{busy ? '…' : L(`Comprar +${qty} · $${price}`, `Buy +${qty} · $${price}`)}</button>
            <a href="/pricing" className="btn btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>{L('Subir de plan', 'Upgrade plan')}</a>
          </div>
        </>
      ) : (
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <a href="/pricing" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
            {(a.plan && a.plan !== 'free') ? L('Subir de plan', 'Upgrade plan') : L('Ver planes', 'See plans')}
          </a>
        </div>
      )}
    </div>
  );
}
