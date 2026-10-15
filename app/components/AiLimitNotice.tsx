'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import OnyxIcon from '@/app/components/OnyxIcon';
import { nativePlatform } from '@/lib/native';

// Aviso que aparece cuando el usuario alcanzó su tope mensual de Onyx AI.
// Se adapta al plan: los de pago pueden COMPRAR un paquete extra (pago único);
// los Gratis ven una invitación a SUBIR DE PLAN (no pueden comprar sin tarjeta).
//
// Modo de presentación:
//   · modal (por defecto): aparece como POPUP centrado con fondo oscurecido y una
//     "X" para cerrar, para que se note en iPhone y web por igual.
//   · inline (modal={false}): tarjeta embebida, por si se quiere dentro de otra.
type Allowance = {
  plan?: string; used?: number; limit?: number; unlimited?: boolean;
  canBuy?: boolean; packOn?: boolean; packQty?: number; packPrice?: number;
};
export default function AiLimitNotice({ allowance, lang = 'es', onBought, onClose, modal = true }: { allowance: Allowance; lang?: string; onBought?: () => void; onClose?: () => void; modal?: boolean }) {
  const en = lang === 'en';
  const L = (es: string, e: string) => (en ? e : es);
  const a = allowance || {};
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [needCard, setNeedCard] = useState(false);   // el cliente no tiene tarjeta guardada
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
      if (!r.ok) {
        if (j?.code === 'no_pm' || j?.code === 'no_customer') setNeedCard(true);   // no tiene tarjeta guardada
        setErr(j?.error || L('No se pudo comprar. Intenta de nuevo.', "Couldn't buy. Try again."));
        return;
      }
      setDone(true); onBought && onBought();
    } finally { setBusy(false); }
  }

  // --- Contenido de la tarjeta (igual en modal o inline) ---
  const card = done ? (
    <div style={{ background: 'rgba(52,199,120,.12)', border: '1px solid rgba(52,199,120,.35)', borderRadius: 12, padding: '16px 18px', fontSize: 13.5 }}>
      <b style={{ color: 'var(--green)' }}><OnyxIcon emoji="✅" size={15} /> {L('¡Listo! Se sumaron', 'Done! Added')} +{qty} {L('consultas a este mes.', 'questions to this month.')}</b>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{L('Ya puedes volver a usar Onyx AI.', 'You can use Onyx AI again now.')}</div>
      {onClose && <div style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={onClose} style={{ fontSize: 13 }}>{L('Entendido', 'Got it')}</button></div>}
    </div>
  ) : (
    <div style={{ background: 'var(--bg2)', border: '1px solid rgba(124,140,255,.35)', borderRadius: 12, padding: '18px 18px' }}>
      <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,140,255,.16)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><OnyxIcon emoji="✨" size={17} /></span>
        {L('Llegaste a tu límite de Onyx AI', 'You hit your Onyx AI limit')}
      </div>
      <div className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
        {a.limit != null
          ? L(`Usaste tus ${a.used ?? a.limit}/${a.limit} consultas de este mes.`, `You used your ${a.used ?? a.limit}/${a.limit} questions this month.`)
          : L('Usaste tus consultas de este mes.', 'You used this month\'s questions.')}{' '}
        {L('Se reinician el día 1 del próximo mes.', 'They reset on the 1st of next month.')}
      </div>

      {canBuy ? (
        <>
          <div style={{ background: 'rgba(124,140,255,.12)', border: '1px solid rgba(124,140,255,.3)', borderRadius: 10, padding: '10px 12px', margin: '14px 0' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--soft-brand, var(--brand))' }}><OnyxIcon emoji="⚡" size={14} /> {L(`Compra +${qty} consultas por $${price}`, `Buy +${qty} questions for $${price}`)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{L('Pago único. Se usan solo este mes, sin suscripción.', 'One-time. Used this month only, no subscription.')}</div>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {needCard
              ? <a href="/account" className="btn btn-primary" style={{ fontSize: 13.5, textDecoration: 'none' }}>{L('Agregar tarjeta', 'Add a card')}</a>
              : <button className="btn btn-primary" onClick={buy} disabled={busy} style={{ fontSize: 13.5 }}>{busy ? '…' : L(`Comprar +${qty} · $${price}`, `Buy +${qty} · $${price}`)}</button>}
            <a href="/pricing" className="btn btn-ghost" style={{ fontSize: 13.5, textDecoration: 'none' }}>{L('Subir de plan', 'Upgrade plan')}</a>
          </div>
        </>
      ) : (
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <a href="/pricing" className="btn btn-primary" style={{ fontSize: 13.5, textDecoration: 'none' }}>
            {(a.plan && a.plan !== 'free') ? L('Subir de plan', 'Upgrade plan') : L('Ver planes', 'See plans')}
          </a>
        </div>
      )}
    </div>
  );

  // --- Inline: la tarjeta tal cual (para incrustar donde se quiera) ---
  if (!modal) return card;

  // --- Modal: popup centrado con fondo oscurecido y botón de cerrar ---
  if (!mounted) return null;
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) (onClose)(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: -10, right: -10, width: 30, height: 30, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', cursor: 'pointer', fontSize: 15, lineHeight: 1, zIndex: 1 }}>✕</button>
        )}
        {card}
      </div>
    </div>,
    document.body,
  );
}
