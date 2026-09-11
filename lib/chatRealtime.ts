'use client';
// Tiempo real ligero para el chat, sobre Supabase Realtime (broadcast + presence).
// No usamos postgres_changes para no depender de RLS: cuando alguien envía un
// mensaje, emite un "ping" por el canal y los demás recargan por la API normal.
// Presencia y "escribiendo…" son efímeros (broadcast), así que tampoco tocan la BD.
//
// IMPORTANTE: Supabase NO deja tener dos suscripciones al MISMO canal (topic) en
// el mismo navegador; si lo intentas lanza "cannot add presence callbacks after
// subscribe()". Como el panel principal y las ventanas acopladas pueden abrir el
// mismo canal a la vez, aquí compartimos UNA sola conexión por canal y repartimos
// los eventos a todos los que la usan (registro con contador de referencias).
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export type Presence = { id: string; name: string };

type Entry = {
  chan: any;
  refs: number;
  pingCbs: Set<() => void>;
  typingCbs: Set<(name: string, id: string) => void>;
  presenceCbs: Set<(list: Presence[]) => void>;
};
const registry: Map<string, Entry> = new Map();

function getEntry(topic: string, me: Presence | null): Entry {
  const cur = registry.get(topic);
  if (cur) { cur.refs++; return cur; }
  const sb = supabaseBrowser();
  const chan = sb.channel(topic, { config: { presence: { key: me?.id || 'anon' } } });
  const e: Entry = { chan, refs: 1, pingCbs: new Set(), typingCbs: new Set(), presenceCbs: new Set() };
  // Los callbacks se añaden UNA vez, ANTES de subscribe(); luego cada hook solo
  // se apunta a los Sets de arriba (nunca vuelve a llamar chan.on()).
  chan.on('broadcast', { event: 'ping' }, () => e.pingCbs.forEach((f) => f()));
  chan.on('broadcast', { event: 'typing' }, (p: any) => {
    const name = p?.payload?.name; const id = p?.payload?.id;
    if (name) e.typingCbs.forEach((f) => f(name, id));
  });
  chan.on('presence', { event: 'sync' }, () => {
    const st = chan.presenceState();
    const list: Presence[] = [];
    Object.values(st).forEach((arr: any) => arr.forEach((m: any) => { if (m?.id) list.push({ id: m.id, name: m.name }); }));
    const seen = new Set<string>();
    e.presenceCbs.forEach((f) => f(list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))));
  });
  chan.subscribe((status: string) => { if (status === 'SUBSCRIBED' && me) { try { chan.track({ id: me.id, name: me.name }); } catch {} } });
  registry.set(topic, e);
  return e;
}

function release(topic: string) {
  const e = registry.get(topic); if (!e) return;
  e.refs--;
  if (e.refs <= 0) { try { supabaseBrowser().removeChannel(e.chan); } catch {} registry.delete(topic); }
}

export function useChatRealtime(channelName: string | null, me: Presence | null, onPing: () => void) {
  const [online, setOnline] = useState<Presence[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const onPingRef = useRef(onPing); onPingRef.current = onPing;
  const entryRef = useRef<Entry | null>(null);
  const typingTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!channelName) return;
    let e: Entry;
    try { e = getEntry(channelName, me); } catch { return; }
    entryRef.current = e;

    const onPingCb = () => onPingRef.current();
    const onTypingCb = (name: string, id: string) => {
      if (id === me?.id) return;
      setTyping((t) => (t.includes(name) ? t : [...t, name]));
      clearTimeout(typingTimers.current[name]);
      typingTimers.current[name] = setTimeout(() => setTyping((t) => t.filter((n) => n !== name)), 3500);
    };
    const onPresCb = (list: Presence[]) => setOnline(list);
    e.pingCbs.add(onPingCb); e.typingCbs.add(onTypingCb); e.presenceCbs.add(onPresCb);
    // Si el canal ya estaba suscrito por otra ventana, asegura mi presencia.
    if (me) { try { e.chan.track({ id: me.id, name: me.name }); } catch {} }

    return () => {
      e.pingCbs.delete(onPingCb); e.typingCbs.delete(onTypingCb); e.presenceCbs.delete(onPresCb);
      try { Object.values(typingTimers.current).forEach((t) => clearTimeout(t)); } catch {}
      release(channelName);
      entryRef.current = null;
    };
  }, [channelName, me?.id]);

  function ping() { try { entryRef.current?.chan.send({ type: 'broadcast', event: 'ping', payload: {} }); } catch {} }
  function sendTyping() { if (!me) return; try { entryRef.current?.chan.send({ type: 'broadcast', event: 'typing', payload: { id: me.id, name: me.name } }); } catch {} }

  return { online, typing, ping, sendTyping };
}
