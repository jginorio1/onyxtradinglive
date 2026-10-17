'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { nativePlatform } from '@/lib/native';
import OnyxIcon from '@/app/components/OnyxIcon';

// Píldora de SALDO arriba a la derecha. Muestra el saldo del monedero y lleva a
// la página de recarga. Se refresca al montar y cuando la pestaña vuelve a foco
// (p. ej. tras volver del checkout de Stripe).
// En la app de iPhone NO se muestra: Apple no permite vender saldo usable en la
// app por fuera de su compra integrada (misma regla que los CTAs de compra).
export default function WalletPill() {
  const [cents, setCents] = useState<number | null>(null);
  const [ios, setIos] = useState(false);

  async function load() {
    try { const r = await fetch('/api/wallet', { cache: 'no-store' }); const j = await r.json(); if (r.ok) setCents(Number(j.balanceCents) || 0); } catch {}
  }
  useEffect(() => {
    try { if (nativePlatform() === 'ios') { setIos(true); return; } } catch {}
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (ios) return null;

  const txt = cents == null ? '—' : '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <Link href="/dashboard/wallet" title="Monedero · recargar saldo" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
      background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green)',
      border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)', borderRadius: 99,
      padding: '4px 10px', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <OnyxIcon name="money" size={14} glow={false} />
      <span>{txt}</span>
      <span style={{ fontWeight: 900, fontSize: 14, lineHeight: 1, opacity: .9 }}>+</span>
    </Link>
  );
}
