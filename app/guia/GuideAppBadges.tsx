'use client';
// Pie compartido de la sección Guía: una sola vez por página (portada y artículo),
// una línea discreta + los dos badges en tamaño xs. Se oculta dentro de la app
// nativa (ahí no tiene sentido ofrecer descargarla).
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { isNativeApp } from '@/lib/native';
import GooglePlayBadge from '@/app/components/GooglePlayBadge';
import AppStoreBadge from '@/app/components/AppStoreBadge';

export default function GuideAppBadges() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [isNative, setIsNative] = useState(false);
  useEffect(() => { try { setIsNative(isNativeApp()); } catch {} }, []);
  if (isNative) return null;

  return (
    <div style={{
      marginTop: 30, paddingTop: 18, borderTop: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
    }}>
      <span className="muted" style={{ fontSize: 13 }}>
        {es ? '📱 Lleva Onyx en el móvil — Android e iPhone' : '📱 Carry Onyx on your phone — Android & iPhone'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <GooglePlayBadge size="xs" />
        <AppStoreBadge size="xs" />
      </div>
    </div>
  );
}
