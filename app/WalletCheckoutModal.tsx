'use client';
import { useEffect, useRef, useState } from 'react';
import { getStripe, onyxAppearance } from '@/lib/stripeClient';
import { isNativeApp } from '@/lib/native';

// ============================================================
// Recarga del monedero / guardar tarjeta DENTRO de Onyx.
//  · topup  → checkout EMBEBIDO de Stripe (es un cobro).
//  · setup  → Payment Element con el tema OSCURO de Onyx (igual que la
//             suscripción), sin salir al checkout alojado. Así "Guardar tarjeta"
//             combina con el panel y no sale en blanco.
// En la app nativa (Android/iOS) ambos abren un checkout ALOJADO en el navegador.
// ============================================================

export default function WalletCheckoutModal({
  amount, lang, onClose, mode = 'topup', onSaved,
}: { amount?: number; lang: 'es' | 'en'; onClose: () => void; mode?: 'topup' | 'setup'; onSaved?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const [nativeUrl, setNativeUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const checkoutRef = useRef<any>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const es = lang === 'es';
  const isSetup = mode === 'setup';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // ── App nativa: checkout alojado en el navegador del sistema ──────────
        if (isNativeApp()) {
          const endpoint = isSetup ? '/api/wallet/autoreload/setup' : '/api/wallet/topup';
          const body = isSetup ? {} : { method: 'card', amount, lang };
          const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const j = await r.json();
          if (cancelled) return;
          if (!r.ok || !j.url) { setErr(j.error || (es ? 'No se pudo abrir.' : 'Could not open.')); return; }
          setNativeUrl(j.url);
          try { window.open(j.url, '_blank'); } catch { /* el usuario puede usar el botón */ }
          return;
        }

        const stripe = await getStripe();

        // ── GUARDAR TARJETA (setup) · Payment Element oscuro, dentro de Onyx ───
        if (isSetup) {
          const r = await fetch('/api/wallet/autoreload/setup-intent', { method: 'POST' });
          const j = await r.json();
          if (cancelled) return;
          if (!r.ok || !j.clientSecret) { setErr(j.error || (es ? 'No se pudo abrir.' : 'Could not open.')); return; }
          const elements = stripe.elements({ clientSecret: j.clientSecret, appearance: onyxAppearance() });
          const pe = elements.create('payment');
          pe.mount(box.current);
          stripeRef.current = stripe; elementsRef.current = elements;
          setReady(true);
          return;
        }

        // ── RECARGAR SALDO (topup) · checkout embebido de Stripe ──────────────
        const r = await fetch('/api/wallet/topup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'card', amount, lang, embedded: true }) });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok || !j.clientSecret) { setErr(j.error || (es ? 'No se pudo abrir.' : 'Could not open.')); return; }
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: j.clientSecret });
        checkout.mount(box.current);
        checkoutRef.current = checkout;
      } catch (e: any) {
        setErr(String(e?.message || '').includes('PUBLISHABLE')
          ? (es ? 'Falta la clave pública de Stripe.' : 'Stripe publishable key is missing.')
          : (es ? 'No se pudo abrir.' : 'Could not open.'));
      }
    })();
    return () => {
      cancelled = true;
      try { checkoutRef.current?.destroy(); } catch {}
      try { elementsRef.current = null; if (box.current) box.current.innerHTML = ''; } catch {}
    };
  }, [amount, mode]);

  // Confirma el SetupIntent y registra la tarjeta para la auto-recarga.
  async function saveCard() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true); setErr('');
    try {
      const { error, setupIntent } = await stripeRef.current.confirmSetup({ elements: elementsRef.current, redirect: 'if_required' });
      if (error) { setErr(error.message || (es ? 'No se pudo guardar la tarjeta.' : 'Could not save the card.')); return; }
      const pm = setupIntent?.payment_method ? (typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method.id) : null;
      if (pm) await fetch('/api/wallet/autoreload/save-pm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentMethodId: pm }) });
      onSaved && onSaved();
      onClose();
    } catch { setErr(es ? 'No se pudo guardar la tarjeta.' : 'Could not save the card.'); } finally { setBusy(false); }
  }

  const title = isSetup
    ? (es ? 'Guardar una tarjeta' : 'Save a card')
    : (es ? `Recargar $${amount}` : `Top up $${amount}`);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 80, padding: 16, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 760, width: '100%', marginTop: 24 }}>
        <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
          <b style={{ fontSize: 15 }}>{title}</b>
          <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        {err ? <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>
          : nativeUrl ? (
            <div style={{ textAlign: 'center', padding: '18px 8px' }}>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--tx)' }}>
                {es
                  ? 'Tu pago se abrió en el navegador para completarlo de forma segura. Al terminar, vuelve a la app.'
                  : 'Your payment opened in the browser to complete it securely. When you’re done, come back to the app.'}
              </p>
              <a className="btn btn-primary" href={nativeUrl} target="_blank" rel="noreferrer" style={{ marginTop: 10, display: 'inline-block' }}>
                {es ? 'Abrir el pago en el navegador' : 'Open payment in browser'}
              </a>
            </div>
          ) : (
            <>
              <div ref={box} style={{ minHeight: isSetup ? 40 : 260 }} />
              {/* En modo "guardar tarjeta" el botón lo ponemos nosotros (Payment Element) */}
              {isSetup && (
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={saveCard} disabled={busy || !ready}>{busy ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Guardar tarjeta' : 'Save card')}</button>
                  <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{es ? 'Cancelar' : 'Cancel'}</button>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
