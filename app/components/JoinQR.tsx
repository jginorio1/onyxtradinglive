'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import OnyxIcon from '@/app/components/OnyxIcon';
import { saveImage, shareImage } from '@/lib/nativeShare';

// QR para unirse a la academia. Genera el código en el cliente. Con `actions`
// muestra botones para descargar la imagen o copiarla al portapapeles.
export default function JoinQR({ url, size = 160, actions = false, L }: { url: string; size?: number; actions?: boolean; L?: (a: string, b: string) => string }) {
  const [img, setImg] = useState('');
  const [msg, setMsg] = useState('');
  const t = (a: string, b: string) => (L ? L(a, b) : a);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: size * 3, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
      .then(setImg).catch(() => setImg(''));
  }, [url, size]);

  // "Copiar" en la app abre la hoja de compartir nativa (WhatsApp, guardar en fotos…),
  // porque el portapapeles de imagen no funciona en el WebView; en web copia al portapapeles.
  async function copyImg() {
    try {
      const blob = await (await fetch(img)).blob();
      const r = await shareImage(blob, 'academia-qr.png', { title: 'Onyx Academy', text: t('Únete a la academia', 'Join the academy'), url });
      if (r === 'shared') return;
      // @ts-ignore ClipboardItem existe en navegadores modernos
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash(t('QR copiado', 'QR copied'));
    } catch { flash(t('No se pudo copiar', 'Could not copy')); }
  }
  async function download() {
    try {
      const blob = await (await fetch(img)).blob();
      const r = await saveImage(blob, 'academia-qr.png', { title: 'Onyx Academy', text: t('Únete a la academia', 'Join the academy'), url });
      if (r === 'downloaded') flash(t('QR descargado', 'QR downloaded'));
      else if (r === 'error') flash(t('No se pudo', 'Could not'));
    } catch { flash(t('No se pudo descargar', 'Could not download')); }
  }
  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 1600); }

  if (!img) return <div style={{ width: size, height: size, borderRadius: 14, background: 'var(--bg2)', display: 'grid', placeItems: 'center', color: 'var(--mut)', fontSize: 12 }}>…</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div className="sk-qr-frame" style={{ width: size + 16, height: size + 16 }}>
        <img src={img} alt="QR" width={size} height={size} style={{ display: 'block', borderRadius: 8 }} />
      </div>
      {actions && (
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={download}><OnyxIcon emoji="⬇" size={15} /> {t('Descargar', 'Download')}</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={copyImg}>⧉ {t('Copiar', 'Copy')}</button>
        </div>
      )}
      {msg && <span style={{ fontSize: 11, color: 'var(--soft-green)' }}>{msg}</span>}
    </div>
  );
}
