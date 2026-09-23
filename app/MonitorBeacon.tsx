'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

// Beacon de monitoreo EN VIVO — se monta solo con sesión iniciada.
//  · Presencia (efímera): publica {id,email,name,path} en un canal Realtime de
//    Supabase ("onyx-live") que el Command Center lee. No se guarda en la BD.
//  · Historial (guardado): cada cambio de pantalla se manda a /api/monitor/track.
// No hace nada en el navegador de un visitante anónimo (getUser() = null).
export default function MonitorBeacon() {
  const path = usePathname() || '/';
  const chan = useRef<any>(null);
  const me = useRef<{ id: string; email: string; name: string } | null>(null);

  // Identidad + canal de presencia (una sola vez).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data: { user } } = await sb.auth.getUser();
        if (!user || !alive) return;
        me.current = { id: user.id, email: user.email || '', name: ((user.user_metadata as any)?.full_name) || user.email || '' };
        const ch = sb.channel('onyx-live', { config: { presence: { key: user.id } } });
        ch.subscribe((s: string) => { if (s === 'SUBSCRIBED') { try { ch.track({ ...me.current, path: location.pathname, ts: Date.now() }); } catch {} } });
        chan.current = ch;
      } catch {}
    })();
    return () => { alive = false; try { chan.current?.unsubscribe(); } catch {} };
  }, []);

  // En cada cambio de ruta: actualiza presencia + registra en el historial.
  useEffect(() => {
    try { if (me.current) chan.current?.track({ ...me.current, path, ts: Date.now() }); } catch {}
    try {
      const body = JSON.stringify({ kind: 'page', path });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/monitor/track', new Blob([body], { type: 'application/json' }));
      else fetch('/api/monitor/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch {}
  }, [path]);

  // Latido: mantiene "en línea" aunque el usuario no navegue.
  useEffect(() => {
    const t = setInterval(() => { try { if (me.current) chan.current?.track({ ...me.current, path: location.pathname, ts: Date.now() }); } catch {} }, 25000);
    return () => clearInterval(t);
  }, []);

  return null;
}
