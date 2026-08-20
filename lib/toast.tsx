'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { errMsg } from '@/lib/i18nErrors';

// ============================================================
// Avisos (toasts) globales, con estilo Onyx y bilingües.
//
// Reemplaza los alert() del navegador. Cualquier componente cliente hace:
//   import { toast } from '@/lib/toast';
//   toast('Algo pasó');                       // texto directo (error)
//   toast({ es: '...', en: '...' }, 'ok');    // bilingüe + tipo
//   toast({ api: json });                     // traduce por code de la API
//
// El <Toaster/> vive UNA sola vez en el layout raíz y los pinta.
//
// Diseño (rediseño v2):
//   • Éxito / info  → píldora CENTRADA arriba, se desvanece sola.
//   • Error / aviso → MODAL CENTRADO con fondo desenfocado y borde glow;
//     no se cierra solo, y trae botón "Copiar detalle" para pasarlo a soporte.
// ============================================================

export type ToastMsg = string | { es: string; en: string } | { api: any };
type Kind = 'error' | 'ok' | 'info' | 'warn';
type Item = { id: number; msg: ToastMsg; kind: Kind; code?: string; path?: string; at: number };

let items: Item[] = [];
let subs: Array<() => void> = [];
let seq = 1;
const emit = () => subs.forEach((f) => f());

export function toast(msg: ToastMsg, kind: Kind = 'error') {
  const id = seq++;
  // Guardamos código y ruta al crear el aviso (para "Copiar detalle").
  let code: string | undefined;
  try { if (msg && typeof msg === 'object' && 'api' in (msg as any)) code = (msg as any).api?.code; } catch {}
  let path: string | undefined;
  try { path = typeof window !== 'undefined' ? window.location.pathname : undefined; } catch {}
  items = [...items, { id, msg, kind, code, path, at: Date.now() }];
  emit();
  // Solo se desvanecen solos los avisos ligeros (éxito/info). Los de error/aviso
  // se quedan hasta que el usuario los cierra, para que pueda copiar el detalle.
  if (kind === 'ok' || kind === 'info') {
    setTimeout(() => { items = items.filter((i) => i.id !== id); emit(); }, 3000);
  }
}

export function toastErr(apiJson: any, kind: Kind = 'error') {
  toast({ api: apiJson } as ToastMsg, kind);
}

// ── Confirmación (reemplaza el confirm() del navegador) ──────────────
// Uso:  if (await confirmDialog('¿Borrar?', { danger: true })) { ... }
// Devuelve una promesa que resuelve true/false. Modal CENTRADO e iluminado.
type ConfirmReq = { id: number; msg: ToastMsg; danger?: boolean; okLabel?: ToastMsg; cancelLabel?: ToastMsg; resolve: (v: boolean) => void };
let confirmReq: ConfirmReq | null = null;
export function confirmDialog(msg: ToastMsg, opts: { danger?: boolean; okLabel?: ToastMsg; cancelLabel?: ToastMsg } = {}): Promise<boolean> {
  return new Promise((resolve) => { confirmReq = { id: seq++, msg, resolve, ...opts }; emit(); });
}
function settleConfirm(v: boolean) { const r = confirmReq; confirmReq = null; emit(); try { r?.resolve(v); } catch {} }

const L = (es: string, en: string, lang: string) => (lang === 'es' ? es : en);

export function Toaster() {
  const { lang } = useLang();
  const [, force] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
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
  const dismiss = (id: number) => { items = items.filter((i) => i.id !== id); emit(); };

  const copyDetail = (i: Item) => {
    const when = new Date(i.at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
    const detail = [resolve(i.msg), i.code ? `[${i.code}]` : '', i.path || '', when].filter(Boolean).join(' · ');
    try { navigator.clipboard?.writeText(detail); } catch {}
    setCopied(i.id); setTimeout(() => setCopied((c) => (c === i.id ? null : c)), 1800);
  };

  const modals = items.filter((i) => i.kind === 'error' || i.kind === 'warn');
  const pills = items.filter((i) => i.kind === 'ok' || i.kind === 'info');

  // Colores por tipo (respetan el modo claro/oscuro vía variables + hex de marca).
  const tone = (k: Kind) => k === 'error'
    ? { c: '#ff6b7d', bg: 'rgba(255,107,125,.12)', ic: 'error' as const, title: L('Algo salió mal', 'Something went wrong', lang) }
    : { c: '#ffc04d', bg: 'rgba(255,192,77,.12)', ic: 'warn' as const, title: L('Atención', 'Heads up', lang) };

  return (
    <>
      {/* Píldoras (éxito / info): centradas arriba, se desvanecen solas */}
      {pills.length > 0 && (
        <div style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none', width: 'min(92vw,420px)' }}>
          {pills.map((i) => { const c = i.kind === 'ok' ? '#34e2a0' : '#7c8cff'; const bg = i.kind === 'ok' ? 'rgba(52,226,160,.12)' : 'rgba(124,140,255,.12)'; return (
            <div key={i.id} onClick={() => dismiss(i.id)} style={{ pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: 'var(--card,#141a29)', border: '1px solid ' + c, borderRadius: 12, padding: '10px 15px', color: 'var(--tx,#e6ebf2)', fontSize: 13.5, lineHeight: 1.45, boxShadow: '0 0 24px -8px ' + c + ', 0 10px 30px rgba(0,0,0,.4)', animation: 'onyxPill .2s ease' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: c, fontSize: 13, fontWeight: 800 }}>{i.kind === 'ok' ? '✓' : 'i'}</span>
              <span>{resolve(i.msg)}</span>
            </div>
          ); })}
        </div>
      )}

      {/* Modales (error / aviso): centrados, fondo oscuro, glow, con "Copiar detalle" */}
      {modals.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(6,9,16,.6)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
          onClick={() => dismiss(modals[modals.length - 1].id)}>
          {(() => { const i = modals[modals.length - 1]; const tn = tone(i.kind); return (
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(94vw,420px)', background: 'var(--card,#141a29)', border: '1px solid ' + tn.c, borderRadius: 18, padding: 24, textAlign: 'center', boxShadow: '0 0 0 1px ' + tn.c + ', 0 0 40px -8px ' + tn.c + ', 0 24px 60px rgba(0,0,0,.5)', animation: 'onyxModal .18s ease' }}>
              <div style={{ width: 48, height: 48, margin: '0 auto 12px', borderRadius: '50%', background: tn.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tn.c, fontSize: 26, fontWeight: 800 }}>{i.kind === 'error' ? '!' : '⚠'}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx,#e6ebf2)', marginBottom: 6 }}>{tn.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--mut,#9aa3b2)', lineHeight: 1.6 }}>{resolve(i.msg)}</div>
              {i.kind === 'error' && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--mut,#8a90a0)', fontFamily: 'ui-monospace,Menlo,monospace', background: 'var(--bg2,#0e1320)', borderRadius: 8, padding: '6px 10px', display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere' }}>{[i.code, i.path].filter(Boolean).join(' · ') || '—'}</div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                {i.kind === 'error' && (
                  <button onClick={() => copyDetail(i)} style={{ cursor: 'pointer', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line,#2a3346)', background: 'transparent', color: 'var(--tx,#e6ebf2)' }}>
                    {copied === i.id ? (L('¡Copiado!', 'Copied!', lang)) : (L('Copiar detalle', 'Copy details', lang))}
                  </button>
                )}
                <button onClick={() => dismiss(i.id)} style={{ cursor: 'pointer', fontSize: 13.5, padding: '9px 22px', borderRadius: 9, border: 'none', background: 'var(--brand,#5b6cff)', color: '#fff', fontWeight: 600 }}>{L('Entendido', 'Got it', lang)}</button>
              </div>
            </div>
          ); })()}
        </div>
      )}

      {/* Confirmación centrada (reemplaza confirm() del navegador) */}
      {confirmReq && (() => { const c = confirmReq!; const dc = c.danger ? '#ff6b7d' : '#7c8cff'; return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3200, background: 'rgba(6,9,16,.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onClick={() => settleConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(94vw,410px)', background: 'var(--card,#141a29)', border: '1px solid ' + dc, borderRadius: 18, padding: 22, boxShadow: '0 0 0 1px ' + dc + ', 0 0 40px -8px ' + dc + ', 0 24px 60px rgba(0,0,0,.5)', animation: 'onyxModal .18s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: c.danger ? 'rgba(255,107,125,.14)' : 'rgba(124,140,255,.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: dc, fontSize: 21, fontWeight: 800, flexShrink: 0 }}>?</span>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tx,#e6ebf2)', lineHeight: 1.5 }}>{resolve(c.msg)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => settleConfirm(false)} style={{ cursor: 'pointer', fontSize: 13.5, padding: '9px 16px', borderRadius: 9, border: '1px solid var(--line,#2a3346)', background: 'transparent', color: 'var(--tx,#e6ebf2)' }}>{c.cancelLabel ? resolve(c.cancelLabel) : L('Cancelar', 'Cancel', lang)}</button>
              <button onClick={() => settleConfirm(true)} style={{ cursor: 'pointer', fontSize: 13.5, padding: '9px 20px', borderRadius: 9, border: 'none', background: dc, color: '#fff', fontWeight: 600 }}>{c.okLabel ? resolve(c.okLabel) : L('Confirmar', 'Confirm', lang)}</button>
            </div>
          </div>
        </div>
      ); })()}

      <style>{`@keyframes onyxPill{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@keyframes onyxModal{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}`}</style>
    </>
  );
}
