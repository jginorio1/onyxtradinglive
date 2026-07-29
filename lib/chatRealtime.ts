'use client';
// Tiempo real ligero para el chat, sobre Supabase Realtime (broadcast + presence).
// No usamos postgres_changes para no depender de RLS: cuando alguien envía un
// mensaje, emite un "ping" por el canal y los demás recargan por la API normal
// (service role). Presencia y "escribiendo…" son efímeros (broadcast), así que
// tampoco tocan la base de datos.
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export type Presence = { id: string; name: string };

// Engancha un canal de tiempo real por nombre (ej: `support:<ticketId>` o
// `team:<channelId>`). Devuelve helpers para avisar de mensajes/escritura y el
// estado de presencia + quién está escribiendo.
export function useChatRealtime(
  channelName: string | null,
  me: Presence | null,
  onPing: () => void,
) {
  const [online, setOnline] = useState<Presence[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const chanRef = useRef<any>(null);
  const onPingRef = useRef(onPing);
  onPingRef.current = onPing;
  const typingTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!channelName) return;
    let sb: any;
    try { sb = supabaseBrowser(); } catch { return; }
    const chan = sb.channel(channelName, { config: { presence: { key: me?.id || 'anon' } } });
    chanRef.current = chan;

    chan.on('broadcast', { event: 'ping' }, () => onPingRef.current());
    chan.on('broadcast', { event: 'typing' }, (p: any) => {
      const name = p?.payload?.name; const id = p?.payload?.id;
      if (!name || id === me?.id) return;
      setTyping((t) => (t.includes(name) ? t : [...t, name]));
      clearTimeout(typingTimers.current[name]);
      typingTimers.current[name] = setTimeout(() => setTyping((t) => t.filter((n) => n !== name)), 3500);
    });
    chan.on('presence', { event: 'sync' }, () => {
      const state = chan.presenceState();
      const list: Presence[] = [];
      Object.values(state).forEach((arr: any) => arr.forEach((m: any) => { if (m?.id) list.push({ id: m.id, name: m.name }); }));
      const seen = new Set<string>();
      setOnline(list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))));
    });

    chan.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' && me) chan.track({ id: me.id, name: me.name });
    });

    return () => {
      try { Object.values(typingTimers.current).forEach((t) => clearTimeout(t)); } catch {}
      try { sb.removeChannel(chan); } catch {}
    };
  }, [channelName, me?.id]);

  function ping() { try { chanRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} }); } catch {} }
  function sendTyping() { if (!me) return; try { chanRef.current?.send({ type: 'broadcast', event: 'typing', payload: { id: me.id, name: me.name } }); } catch {} }

  return { online, typing, ping, sendTyping };
}
