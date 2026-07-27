'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { errMsg } from '@/lib/i18nErrors';

// ============================================================
// Avisos (toasts) globales, con estilo Onyx y bilingües.
//
// Reemplaza los alert() del navegador. Cualquier componente cliente hace:
//   import { toast } from '@/lib/toast';
//   toast('Algo pasó');                       // texto directo
//   toast({ es: '...', en: '...' }, 'ok');    // bilingüe + tipo
//
// El <Toaster/> vive una sola vez en el layout raíz y los pinta.
// ============================================================

export type ToastMsg = string | { es: string; en: string } | { api: any };
type Kind = 'error' | 'ok' | 'info';
type Item = { id: number; msg: ToastMsg; kind: Kind };

let items: Item[] = [];
let subs: Array<() => void> = [];
let seq = 1;
const emit = () => subs.forEach((f) => f());

export function toast(msg: ToastMsg, kind: Kind = 'error') {
  const id = seq++;
  items = [...items, { id, msg, kind }];
  emit();
  setTimeout(() => { items = items.filter((i) => i.id !== id); emit(); }, 4500);
}

// Aviso a partir de la respuesta de una API: traduce por `code` según el idioma
// (el propio Toaster resuelve el idioma). No hace falta pasar lang aquí.
export function toastErr(apiJson: any, kind: Kind = 'error') {
  toast({ api: apiJson } as ToastMsg, kind);
}

export function Toaster() {
  const { lang } = useLang();
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.push(f);
    return () => { subs = subs.filter((s) => s !== f); };
  }, []);

  const resolve = (m: ToastMsg) => {
    if (typeof m === 'string') return m;
    if ('api' in m) return errMsg(m.api, lang);
    return lang === 'es' ? m.es : m.en;
  };
  const color = (k: Kind) => k === 'ok' ? '#34e2a0' : k === 'error' ? '#ff6b7d' : '#7c8cff';
  const dismiss = (id: number) => { items = items.filter((i) => i.id !== id); emit(); };

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      {items.map((i) => (
        <div key={i.id} onClick={() => dismiss(i.id)}
          style={{ background: '#141a29', border: '1px solid var(--line)', borderLeft: '3px solid ' + color(i.kind), borderRadius: 10, padding: '11px 14px', color: '#e6ebf2', fontSize: 13, lineHeight: 1.5, boxShadow: '0 10px 30px rgba(0,0,0,.45)', cursor: 'pointer', animation: 'onyxToastIn .2s ease' }}>
          {resolve(i.msg)}
        </div>
      ))}
      <style>{`@keyframes onyxToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
