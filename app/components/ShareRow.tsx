'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import BrandIcon, { BRAND_COLOR } from '@/app/components/BrandIcon';

// Fila de compartir reutilizable (misma en academia, referidos y donde haga falta).
// Incluye: compartir nativo del móvil, WhatsApp, Telegram, Instagram, Facebook, X y correo.
//
// Nota honesta sobre Instagram: NO existe un enlace web para publicar/compartir un
// link en Instagram (su compartir es solo dentro de la app). Por eso el botón de
// Instagram COPIA el texto+enlace al portapapeles y abre Instagram para que lo peguen.
export default function ShareRow({
  link, message, L, title = 'Onyx Trading Live',
}: {
  link: string;
  message: string;
  L: (a: string, b: string) => string;
  title?: string;
}) {
  const [igHint, setIgHint] = useState(false);
  const enc = encodeURIComponent;
  const full = message + ' ' + link;
  const msg = enc(full);

  const links: { key: string; color: string; href: string }[] = [
    { key: 'whatsapp', color: BRAND_COLOR.whatsapp, href: `https://wa.me/?text=${msg}` },
    { key: 'telegram', color: BRAND_COLOR.telegram, href: `https://t.me/share/url?url=${enc(link)}&text=${enc(message)}` },
    { key: 'facebook', color: BRAND_COLOR.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` },
    { key: 'x', color: BRAND_COLOR.x, href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(link)}` },
  ];

  const nativeShare = () => { try { (navigator as any).share?.({ title, text: message, url: link }); } catch {} };
  const hasNative = typeof navigator !== 'undefined' && !!(navigator as any).share;

  // Instagram: copia el mensaje y abre Instagram (no hay share web nativo de IG).
  const instagram = async () => {
    try { await navigator.clipboard.writeText(full); } catch {}
    setIgHint(true); setTimeout(() => setIgHint(false), 2500);
    window.open('https://www.instagram.com/', '_blank');
  };

  return (
    <div className="sk-share" style={{ position: 'relative' }}>
      {hasNative && (
        <a role="button" tabIndex={0} onClick={nativeShare} title={L('Compartir', 'Share')} style={{ color: 'var(--brand)', cursor: 'pointer' }}>
          <OnyxIcon emoji="🔗" size={16} />
        </a>
      )}
      {links.map((s) => (
        <a key={s.key} href={s.href} target="_blank" rel="noreferrer" title={s.key} style={{ color: s.color }}>
          <BrandIcon name={s.key} size={17} />
        </a>
      ))}
      <a role="button" tabIndex={0} onClick={instagram} title={L('Instagram (copia el texto y pégalo)', 'Instagram (copies the text to paste)')} style={{ color: BRAND_COLOR.instagram, cursor: 'pointer' }}>
        <BrandIcon name="instagram" size={17} />
      </a>
      <a href={`mailto:?subject=${enc(message)}&body=${enc(message + '\n\n' + link)}`} title={L('Correo', 'Email')} style={{ color: 'var(--tx)' }}>
        <OnyxIcon name="mail" size={16} />
      </a>
      {igHint && (
        <span style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, fontSize: 11.5, color: 'var(--soft-green,var(--green))', whiteSpace: 'nowrap' }}>
          {L('Texto copiado — pégalo en tu historia o publicación de Instagram', 'Text copied — paste it in your Instagram story or post')}
        </span>
      )}
    </div>
  );
}
