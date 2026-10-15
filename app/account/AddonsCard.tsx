'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import { nativePlatform } from '@/lib/native';

// Tarjeta "Complementos y límites" en Mi cuenta: muestra al usuario su consumo de
// Onyx AI del mes (usadas / tope), el tope de su plan + los paquetes extra que
// compró este mes, y le deja comprar más. En iPhone se OCULTAN precios y el botón
// de comprar (política de Apple); el consumo sí se ve.
type Ai = {
  plan?: string; quota?: number; extra?: number; limit?: number; used?: number;
  remaining?: number; unlimited?: boolean; staff?: boolean;
  canBuy?: boolean; packOn?: boolean; packQty?: number; packPrice?: number;
  packs?: { qty: number; cents: number; created_at: string }[];
};
export default function AddonsCard({ ai, lang = 'es', onBought }: { ai: Ai | null; lang?: string; onBought?: () => void }) {
  const en = lang === 'en';
  const L = (es: string, e: string) => (en ? e : es);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!ai) return null;

  const ios = nativePlatform() === 'ios';
  const unlimited = !!ai.unlimited;
  const used = Number(ai.used || 0);
  const limit = Number(ai.limit || 0);
  const quota = Number(ai.quota || 0);
  const extra = Number(ai.extra || 0);
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const packs = Array.isArray(ai.packs) ? ai.packs : [];
  const canBuy = !!ai.canBuy && ai.packOn !== false && !ios;
  const qty = Number(ai.packQty || 100);
  const price = Number(ai.packPrice || 5);

  // Color de la barra según cuánto queda.
  const barColor = unlimited ? 'var(--green)' : pct >= 100 ? 'var(--red)' : pct >= 80 ? '#e8b923' : 'var(--brand)';

  async function buy() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/account/addons/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qty: 1 }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j?.error || L('No se pudo comprar. Intenta de nuevo.', "Couldn't buy. Try again.")); return; }
      setMsg(L(`¡Listo! +${qty} consultas este mes.`, `Done! +${qty} questions this month.`));
      onBought && onBought();
    } finally { setBusy(false); }
  }

  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(en ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short' }); } catch { return ''; } };

  return (
    <div className="card">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124,140,255,.16)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><OnyxIcon emoji="⚡" size={17} /></span>
        <div>
          <b style={{ fontSize: 15 }}>{L('Complementos y límites', 'Add-ons & limits')}</b>
          <div className="muted" style={{ fontSize: 12.5 }}>{L('Tu consumo de Onyx AI este mes y los paquetes que compraste.', 'Your Onyx AI usage this month and the packs you bought.')}</div>
        </div>
      </div>

      {/* Consumo de Onyx AI */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginTop: 12 }}>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}><OnyxIcon emoji="✨" size={14} /> {L('Consultas de Onyx AI', 'Onyx AI questions')}</b>
          <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>
            {unlimited ? L('Ilimitado', 'Unlimited') : `${used} / ${limit}`}
          </span>
        </div>
        {!unlimited && (
          <>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width .3s' }} />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {remaining > 0
                ? L(`Te quedan ${remaining} este mes.`, `${remaining} left this month.`)
                : L('Llegaste a tu límite del mes.', 'You hit your monthly limit.')}{' '}
              {L('Se reinician el día 1 del próximo mes.', 'Reset on the 1st of next month.')}
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
              {L('Incluidas en tu plan', 'Included in your plan')}: <b>{quota === 0 ? L('ilimitadas', 'unlimited') : quota}</b>
              {extra > 0 && <> · {L('paquetes extra este mes', 'extra packs this month')}: <b style={{ color: 'var(--brand)' }}>+{extra}</b></>}
            </div>
          </>
        )}

        {/* Comprar más — SOLO web/Android (en iPhone se oculta por política de Apple) */}
        {canBuy && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5 }} className="muted">{L(`Paquete extra: +${qty} consultas por $${price} (pago único).`, `Extra pack: +${qty} questions for $${price} (one-time).`)}</span>
              <button className="btn btn-primary" onClick={buy} disabled={busy} style={{ fontSize: 13 }}>{busy ? '…' : L(`Comprar +${qty} · $${price}`, `Buy +${qty} · $${price}`)}</button>
            </div>
            {msg && <div style={{ fontSize: 12, marginTop: 6, color: msg.includes('!') || msg.includes('Done') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>}
          </div>
        )}
        {/* En iPhone, si llegó al tope, lo mandamos a subir de plan (vía pago nativo). */}
        {ios && !unlimited && remaining <= 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <a href="/pricing" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>{L('Subir de plan', 'Upgrade plan')}</a>
          </div>
        )}
      </div>

      {/* Paquetes comprados este mes */}
      {packs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Paquetes comprados este mes', 'Packs bought this month')}</div>
          {packs.map((p, i) => (
            <div key={i} className="row between" style={{ fontSize: 13, padding: '6px 0', borderBottom: i < packs.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span><OnyxIcon emoji="⚡" size={13} /> +{p.qty} {L('consultas', 'questions')} <span className="muted" style={{ fontSize: 11.5 }}>· {fmtDate(p.created_at)}</span></span>
              {!ios && <span className="muted" style={{ fontSize: 12.5 }}>${(Number(p.cents || 0) / 100).toFixed(2)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
