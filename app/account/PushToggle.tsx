'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { useEffect, useState } from 'react';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    t: 'Notificaciones al teléfono', s: 'Avisos de tu cuenta y tu reto aunque tengas Onyx cerrado.',
    on: 'Activar', off: 'Desactivar', test: 'Enviar prueba', denied: 'Bloqueaste las notificaciones en el navegador. Actívalas en los ajustes del sitio.',
    iosHint: 'En iPhone primero instala la app (arriba), ábrela desde tu pantalla de inicio y luego activa esto.',
    okOn: 'Notificaciones activadas.', okOff: 'Notificaciones desactivadas.', sent: 'Te envié una notificación de prueba.',
  },
  en: {
    t: 'Phone notifications', s: 'Account and challenge alerts even when Onyx is closed.',
    on: 'Turn on', off: 'Turn off', test: 'Send test', denied: 'You blocked notifications in the browser. Enable them in the site settings.',
    iosHint: 'On iPhone, first install the app (above), open it from your home screen, then turn this on.',
    okOn: 'Notifications enabled.', okOff: 'Notifications disabled.', sent: 'I sent you a test notification.',
  },
};

function urlB64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushToggle({ lang }: { lang: Lang }) {
  const L = dictFor(T, lang);
  const [enabled, setEnabled] = useState(false);   // configurado en el servidor
  const [pubKey, setPubKey] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosBlocked, setIosBlocked] = useState(false);

  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    if (!supported) return;
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const sa = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (iOS && !sa) setIosBlocked(true);
    (async () => {
      try {
        const r = await fetch('/api/push');
        const j = await r.json();
        setEnabled(!!j.enabled); setPubKey(j.publicKey || '');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {}
    })();
  }, [supported]);

  if (!supported || !enabled) return null;   // no soportado o sin claves VAPID → no se muestra

  async function turnOn() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast(L.denied); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(pubKey) });
      const r = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!r.ok) throw new Error();
      setSubscribed(true); toast(L.okOn, 'ok');
    } catch { toast({ es: 'No se pudo activar. Intenta de nuevo.', en: 'Could not enable. Try again.' }); }
    finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      setSubscribed(false); toast(L.okOff, 'ok');
    } catch {} finally { setBusy(false); }
  }
  async function test() { await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ test: true }) }); toast(L.sent, 'ok'); }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(52,226,160,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}><OnyxIcon emoji="🔔" size={16} /></span>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{L.t}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{L.s}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {subscribed && <button className="btn btn-ghost" onClick={test} disabled={busy}>{L.test}</button>}
          {subscribed
            ? <button className="btn btn-ghost" onClick={turnOff} disabled={busy}>{L.off}</button>
            : <button className="btn btn-primary" onClick={turnOn} disabled={busy || iosBlocked}>{L.on}</button>}
        </div>
      </div>
      {iosBlocked && <div className="muted" style={{ fontSize: 12, marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}><OnyxIcon emoji="ℹ" size={16} /> {L.iosHint}</div>}
    </div>
  );
}
