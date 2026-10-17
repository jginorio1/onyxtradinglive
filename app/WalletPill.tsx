'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Píldora de SALDO arriba a la derecha. Muestra el saldo del monedero y lleva a
// la página de recarga. Se refresca al montar y cuando la pestaña vuelve a foco
// (p. ej. tras volver del checkout de Stripe).
export default function WalletPill() {
  const [cents, setCents] = useState<number | null>(null);

  async function load() {
    try { const r = await fetch('/api/wallet', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setCents(Number(j.balanceCents) || 0); } catch {}
  }
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const txt = cents == null ? '—' : '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <Link href="/dashboard/wallet" title="Monedero · recargar saldo" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
      background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green)',
      border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)', borderRadius: 99,
      padding: '4px 10px', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden>💰</span>
      <span>{txt}</span>
      <span style={{ fontWeight: 900, fontSize: 14, lineHeight: 1, opacity: .9 }}>+</span>
    </Link>
  );
}
