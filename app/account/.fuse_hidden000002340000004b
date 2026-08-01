'use client';
import { useEffect, useRef, useState } from 'react';
import { getStripe, onyxAppearance } from '@/lib/stripeClient';

// ============================================================
// Cambiar tarjeta DENTRO de Onyx, con el Payment Element de Stripe.
// El formulario de tarjeta lo pinta Stripe (PCI), pero vive en tu página
// y combina con el tema oscuro. Al confirmar, la marca como predeterminada.
// ============================================================

const T: any = {
  es: { title: 'Método de pago', open: 'Cambiar tarjeta', cancel: 'Cancelar', save: 'Guardar tarjeta',
    saving: 'Guardando…', ok: '✓ Tarjeta actualizada', noKey: 'Falta configurar la clave pública de Stripe.', err: 'No se pudo guardar la tarjeta.' },
  en: { title: 'Payment method', open: 'Change card', cancel: 'Cancel', save: 'Save card',
    saving: 'Saving…', ok: '✓ Card updated', noKey: 'Stripe publishable key is not configured.', err: 'Could not save the card.' },
};

export default function BillingCard({ lang }: { lang: 'es' | 'en' }) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setErr(''); setReady(false);
      try {
        const stripe = await getStripe();
        const r = await fetch('/api/stripe/setup-intent', { method: 'POST' });
        const j = await r.json();
        if (!r.ok || !j.clientSecret) { setErr(j.error || t.err); return; }
        if (cancelled) return;
        const elements = stripe.elements({ clientSecret: j.clientSecret, appearance: onyxAppearance });
        const pe = elements.create('payment');
        pe.mount(box.current);
        stripeRef.current = stripe; elementsRef.current = elements;
        setReady(true);
      } catch (e: any) { setErr(String(e?.message || '').includes('PUBLISHABLE') ? t.noKey : t.err); }
    })();
    return () => { cancelled = true; try { elementsRef.current = null; if (box.current) box.current.innerHTML = ''; } catch {} };
  }, [open]);

  async function save() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true); setErr('');
    try {
      const { error, setupIntent } = await stripeRef.current.confirmSetup({ elements: elementsRef.current, redirect: 'if_required' });
      if (error) { setErr(error.message || t.err); return; }
      const pm = setupIntent?.payment_method;
      if (pm) await fetch('/api/stripe/default-pm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentMethodId: pm }) });
      setMsg(t.ok); setOpen(false); setTimeout(() => setMsg(''), 3000);
    } catch { setErr(t.err); } finally { setBusy(false); }
  }

  return (
    <div>
      {!open ? (
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setOpen(true)}>💳 {t.open}</button>
          {msg && <span style={{ color: 'var(--green)', fontSize: 13 }}>{msg}</span>}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginTop: 4 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{t.title}</div>
          <div ref={box} style={{ minHeight: 40 }} />
          {err && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy || !ready}>{busy ? t.saving : t.save}</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
