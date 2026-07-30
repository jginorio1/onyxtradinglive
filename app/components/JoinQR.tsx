'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// QR para unirse a la academia. Genera el código en el cliente a partir del enlace.
export default function JoinQR({ url, size = 160 }: { url: string; size?: number }) {
  const [img, setImg] = useState('');
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: size * 2, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
      .then(setImg).catch(() => setImg(''));
  }, [url, size]);
  if (!img) return <div style={{ width: size, height: size, borderRadius: 12, background: 'var(--bg2)', display: 'grid', placeItems: 'center', color: 'var(--mut)', fontSize: 12 }}>…</div>;
  return <img src={img} alt="QR" width={size} height={size} style={{ borderRadius: 12, display: 'block', background: '#fff', padding: 6 }} />;
}
