'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import { useVpsInfo, renderVps } from '@/app/components/VpsCallout';

// Nota automática para usuarios de Mac en el paso de descarga / la guía.
// - Solo aparece si el usuario está en un Mac de escritorio (no iPhone/iPad, no
//   Windows). En Windows no se muestra nada y el flujo queda idéntico.
// - MetaTrader (kind='mt'): tranquiliza — SÍ funciona en Mac — y sugiere VPS para 24/7.
// - cTrader (kind='ctrader'): avisa que no hay app de Mac y que use un VPS/PC.
// El enlace [[VPS]] lo resuelve renderVps con el afiliado configurado en Bot Lab.
export default function MacInstallNote({ kind }: { kind: 'mt' | 'ctrader' }) {
  const { lang } = useLang();
  const es = lang === 'es';
  const v = useVpsInfo();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    try {
      const s = (navigator.platform || '') + ' ' + (navigator.userAgent || '');
      // Mac de escritorio: contiene "Mac" pero NO es un iPhone/iPad/iPod.
      setIsMac(/Mac/i.test(s) && !/iPhone|iPad|iPod/i.test(s));
    } catch { /* sin navigator: no mostramos nada */ }
  }, []);

  if (!isMac) return null;

  const ctrader = kind === 'ctrader';
  const tint = ctrader ? 'var(--amber)' : 'var(--green)';
  const icoColor = ctrader ? 'var(--amber)' : 'var(--soft-green,var(--green))';
  const txt = ctrader
    ? (es
      ? 'cTrader no tiene app para Mac. Úsalo desde un [[VPS]] de Windows o una PC.'
      : 'cTrader has no Mac app. Use it from a Windows [[VPS]] or a PC.')
    : (es
      ? 'En Mac sí funciona: descarga MetaTrader para Mac desde tu bróker y sigue estos mismos pasos. Consejo: para que el robot no se detenga al cerrar tu Mac, usa un [[VPS]].'
      : 'It works on Mac: download MetaTrader for Mac from your broker and follow these same steps. Tip: to keep the robot from stopping when you close your Mac, use a [[VPS]].');

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12,
      background: `color-mix(in srgb, ${tint} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${tint} 34%, transparent)`,
      borderRadius: 9, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.55, color: 'var(--tx)',
    }}>
      <span aria-hidden style={{ color: icoColor, flex: 'none', marginTop: 1 }}><OnyxIcon emoji="🍎" size={15} /></span>
      <div>{renderVps(txt, v)}</div>
    </div>
  );
}
