'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import QrPop from '@/app/components/QrPop';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    t: 'Instala Onyx en tu teléfono', s: 'Ábrela como una app: ícono en tu pantalla de inicio, sin barra del navegador.',
    btn: 'Instalar app', how: 'Cómo instalar',
    ios: 'En tu iPhone (Safari): toca Compartir ⬆️ abajo y luego “Añadir a pantalla de inicio”.',
    macSafari: 'En Mac (Safari): menú Archivo → “Añadir al Dock”.',
    desktop: 'En tu navegador: usa el ícono de instalar ⤓ en la barra de direcciones, o el menú (⋮) → “Instalar Onyx”.',
    androidHint: 'Si no aparece el instalador, usa el menú (⋮) del navegador → “Instalar app / Añadir a pantalla de inicio”.',
  },
  en: {
    t: 'Install Onyx on your phone', s: 'Open it like an app: icon on your home screen, no browser bar.',
    btn: 'Install app', how: 'How to install',
    ios: 'On your iPhone (Safari): tap Share ⬆️ below, then “Add to Home Screen”.',
    macSafari: 'On Mac (Safari): File menu → “Add to Dock”.',
    desktop: 'In your browser: use the install icon ⤓ in the address bar, or the menu (⋮) → “Install Onyx”.',
    androidHint: 'If no installer shows, use the browser menu (⋮) → “Install app / Add to Home Screen”.',
  },
};

export default function InstallApp({ lang }: { lang: Lang }) {
  const L = T[lang] || T.en;
  const [canInstall, setCanInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [show, setShow] = useState(false);
  const [ua, setUa] = useState({ ios: false, macSafari: false });

  useEffect(() => {
    const s = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(s) || (/Macintosh/.test(s) && (navigator as any).maxTouchPoints > 1);
    const isSafari = /^((?!chrome|chromium|crios|android|edg).)*safari/i.test(s);
    const macSafari = /Macintosh/.test(s) && isSafari && !ios;
    setUa({ ios, macSafari });
    const sa = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setStandalone(sa);
    setCanInstall(!!(window as any).__onyxInstall);
    const on = () => setCanInstall(!!(window as any).__onyxInstall);
    const off = () => setStandalone(true);
    window.addEventListener('onyx-installable', on);
    window.addEventListener('onyx-installed', off);
    return () => { window.removeEventListener('onyx-installable', on); window.removeEventListener('onyx-installed', off); };
  }, []);

  if (standalone) return null;   // ya está instalada / abierta como app

  async function click() {
    const e = (window as any).__onyxInstall;
    if (e) { e.prompt(); try { await e.userChoice; } catch {} (window as any).__onyxInstall = null; setCanInstall(false); return; }
    setShow((v) => !v);   // sin instalador automático → mostramos los pasos
  }

  const steps = ua.ios ? L.ios : ua.macSafari ? L.macSafari : canInstall ? L.androidHint : L.desktop;

  return (
    <div className="card" style={{ marginBottom: 14, border: '1px solid rgba(124,140,255,.35)', background: 'rgba(124,140,255,.06)' }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(124,140,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>📲</span>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{L.t}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{L.s}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={click} style={{ whiteSpace: 'nowrap' }}>{canInstall ? L.btn : L.how}</button>
          {typeof window !== 'undefined' && <QrPop data={window.location.origin} label={lang === 'es' ? 'Escanear' : 'Scan'} />}
        </div>
      </div>
      {(show || (!canInstall && (ua.ios || ua.macSafari))) && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12, fontSize: 13, lineHeight: 1.7 }}>{steps}</div>
      )}
    </div>
  );
}
