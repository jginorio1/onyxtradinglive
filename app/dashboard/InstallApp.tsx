'use client';
import { useEffect, useState } from 'react';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    t: 'Instala Onyx en tu teléfono', s: 'Ábrela como una app: ícono en tu pantalla de inicio, sin barra del navegador.',
    btn: 'Instalar app', ios1: 'En tu iPhone:', ios2: 'Toca', share: 'Compartir', ios3: 'y luego', add: 'Añadir a pantalla de inicio', done: 'Ya está instalada. Ábrela desde tu pantalla de inicio.',
  },
  en: {
    t: 'Install Onyx on your phone', s: 'Open it like an app: icon on your home screen, no browser bar.',
    btn: 'Install app', ios1: 'On your iPhone:', ios2: 'Tap', share: 'Share', ios3: 'then', add: 'Add to Home Screen', done: 'Already installed. Open it from your home screen.',
  },
};

export default function InstallApp({ lang }: { lang: Lang }) {
  const L = T[lang];
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const sa = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsIOS(iOS); setStandalone(sa);
    setCanInstall(!!(window as any).__onyxInstall);
    const on = () => setCanInstall(!!(window as any).__onyxInstall);
    const off = () => { setCanInstall(false); setStandalone(true); };
    window.addEventListener('onyx-installable', on);
    window.addEventListener('onyx-installed', off);
    return () => { window.removeEventListener('onyx-installable', on); window.removeEventListener('onyx-installed', off); };
  }, []);

  if (standalone) return null;              // ya está instalada / abierta como app
  if (!canInstall && !isIOS) return null;   // el navegador no permite instalar aquí

  async function install() {
    const e = (window as any).__onyxInstall;
    if (e) { e.prompt(); try { await e.userChoice; } catch {} (window as any).__onyxInstall = null; setCanInstall(false); return; }
    if (isIOS) setShowIOS((v) => !v);
  }

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
        <button className="btn btn-primary" onClick={install} style={{ whiteSpace: 'nowrap' }}>{L.btn}</button>
      </div>
      {showIOS && isIOS && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12, fontSize: 13, lineHeight: 1.7 }}>
          <b>{L.ios1}</b> {L.ios2} <b>{L.share}</b> <span style={{ display: 'inline-block', transform: 'translateY(2px)' }}>⬆️</span> {L.ios3} <b>“{L.add}”</b>.
        </div>
      )}
    </div>
  );
}
