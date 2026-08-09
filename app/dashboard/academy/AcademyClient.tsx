'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import BrandIcon, { BRAND_COLOR } from '@/app/components/BrandIcon';
import ShareRow from '@/app/components/ShareRow';
import StudentBilling from '@/app/components/StudentBilling';
import LangToggle from '@/app/LangToggle';
import { COUNTRIES, flagOf, countryName } from '@/app/components/countries';
import JoinQR from '@/app/components/JoinQR';
import ScholarshipPanel from './ScholarshipPanel';
import RedeemBeca from './RedeemBeca';
import GuardianUpsell from './GuardianUpsell';
import CopyPanel from './CopyPanel';
import SectionCard from './SectionCard';

// Onyx Academy v2 — comunidad estilo Skool: feed, aulas con secciones y progreso,
// calendario con clase en vivo (countdown + EN VIVO), miembros, ranking, perfil,
// chat privado y barra inferior tipo app. Mentor con plantilla + wizard + cobros.

function embed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return 'https://www.youtube.com/embed/' + yt[1];
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return 'https://player.vimeo.com/video/' + vi[1];
  return null;
}
const initials = (n: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
function timeAgo(iso: string, es: boolean) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  for (const [sec, a] of [[86400, 'd'], [3600, 'h'], [60, 'm']] as [number, string][]) if (s >= sec) return Math.floor(s / sec) + a;
  return es ? 'ahora' : 'now';
}
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
}
async function uploadImage(file: File): Promise<string | null> {
  const data = await fileToDataUrl(file);
  const r = await fetch('/api/academy/upload', { method: 'POST', body: JSON.stringify({ name: file.name, data }) });
  const j = await r.json();
  return j.url || null;
}

function Avatar({ name, level, size = 40, onClick, img }: { name: string; level?: number; size?: number; onClick?: () => void; img?: string | null }) {
  return (
    <span className="sk-av" style={{ width: size, height: size, fontSize: size * 0.36, cursor: onClick ? 'pointer' : undefined, padding: 0, overflow: 'hidden' }} onClick={onClick}>
      {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials(name)}
      {level != null && <span className="sk-lvl">{level}</span>}
    </span>
  );
}
function Ring({ pct, size = 46 }: { pct: number; size?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(var(--green) ${p * 3.6}deg, color-mix(in srgb, var(--mut) 25%, transparent) 0deg)`, flex: 'none' }}>
      <div style={{ width: size - 8, height: size - 8, borderRadius: '50%', background: 'var(--card)', display: 'grid', placeItems: 'center', fontSize: size * 0.24, fontWeight: 800 }}>{p}%</div>
    </div>
  );
}
function Toast({ msg }: { msg: string }) { return <div className="sk-toast">{msg}</div>; }

// Botón para subir imagen (portada/miniatura).
function ImageUpload({ value, onChange, L, label }: any) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {label && <span className="muted" style={{ fontSize: 12 }}>{label}</span>}
      <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; setBusy(true);
          const url = await uploadImage(f); setBusy(false);
          if (url) onChange(url); else alert(L('No se pudo subir la imagen.', 'Could not upload image.'));
        }} />
        <button className="btn btn-ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? '…' : (L('Subir imagen', 'Upload image'))}</button>
        {value && <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => onChange('')}>{L('Quitar', 'Remove')}</button>}
      </div>
      {value && <div className="sk-course-cover" style={{ backgroundImage: `url(${value})`, borderRadius: 10, marginTop: 10 }} />}
    </div>
  );
}

// Botón de copiloto IA: genera texto y lo pasa a onText. kind define qué genera.
function AiBtn({ kind, getInput, onText, L }: any) {
  const [busy, setBusy] = useState(false);
  const lang = L('es', 'en');
  async function go() {
    let input = getInput ? getInput() : '';
    if (kind === 'post') { const idea = window.prompt(L('¿Sobre qué es el post? (ej: bienvenida, lección del día, motivación)', 'What is the post about? (e.g. welcome, lesson of the day, motivation)')); if (idea === null) return; input = idea; }
    if (!input || !String(input).trim()) { alert(L('Escribe primero un título/nombre para dar contexto a la IA.', 'Write a title/name first so the AI has context.')); return; }
    setBusy(true);
    const r = await fetch('/api/academy/ai', { method: 'POST', body: JSON.stringify({ kind, input, lang }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (j.ok && j.text) onText(j.text);
    else alert(j.error === 'no_key' ? L('La IA no está configurada (falta ANTHROPIC_API_KEY en Vercel).', 'AI not configured (ANTHROPIC_API_KEY missing in Vercel).') : L('No se pudo generar. Intenta de nuevo.', 'Could not generate. Try again.'));
  }
  return <button type="button" className="btn btn-ghost ai-btn" style={{ fontSize: 12, padding: '4px 10px' }} disabled={busy} onClick={go}>{busy ? '…' : '✨ ' + L('IA', 'AI')}</button>;
}

const EMOJIS = ['🔥', '💪', '🚀', '📈', '✅', '🙌', '👏', '🎯', '💰', '🧠', '⚡', '❤️', '😂', '👀', '🤝', '💎'];
function EmojiRow({ onPick }: any) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 15 }} onClick={() => setOpen((v) => !v)}>😊</button>
      {open && (
        <span style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 30, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 2, width: 210, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
          {EMOJIS.map((e) => <button key={e} type="button" onClick={() => { onPick(e); setOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 3 }}>{e}</button>)}
        </span>
      )}
    </span>
  );
}
function ImgAttach({ onUrl, L }: any) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return; setBusy(true);
        const url = await uploadImage(f); setBusy(false); if (ref.current) ref.current.value = '';
        if (url) onUrl(url); else alert(L('No se pudo subir la imagen (puede estar bloqueada por moderación).', 'Could not upload image (it may be blocked by moderation).'));
      }} />
      <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 15 }} disabled={busy} onClick={() => ref.current?.click()} title={L('Adjuntar foto', 'Attach photo')}>{busy ? '…' : '📷'}</button>
    </>
  );
}
// Sube un PDF al Storage (reutiliza /api/academy/upload) y devuelve su URL.
function PdfUpload({ onUrl, L }: any) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return; setBusy(true);
        const url = await uploadImage(f); setBusy(false); if (ref.current) ref.current.value = '';
        if (url) onUrl(url); else alert(L('No se pudo subir el PDF.', 'Could not upload the PDF.'));
      }} />
      <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} disabled={busy} onClick={() => ref.current?.click()}>{busy ? '…' : '📄 ' + L('Subir PDF', 'Upload PDF')}</button>
    </>
  );
}
// Vista previa de imagen adjunta con botón de quitar.
function ImgPreview({ url, onRemove }: any) {
  if (!url) return null;
  return (
    <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
      <img src={url} alt="" style={{ maxHeight: 120, borderRadius: 10, display: 'block' }} />
      <button type="button" onClick={onRemove} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12 }}>✕</button>
    </div>
  );
}

// ---- Redes sociales del mentor ----
const SOCIAL: { key: string; label: string; abbr: string; color: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', abbr: 'WA', color: '#25D366' },
  { key: 'instagram', label: 'Instagram', abbr: 'IG', color: '#E1306C' },
  { key: 'facebook', label: 'Facebook', abbr: 'FB', color: '#1877F2' },
  { key: 'youtube', label: 'YouTube', abbr: 'YT', color: '#FF0000' },
  { key: 'tiktok', label: 'TikTok', abbr: 'TT', color: '#000000' },
  { key: 'telegram', label: 'Telegram', abbr: 'TG', color: '#229ED9' },
  { key: 'x', label: 'X', abbr: 'X', color: '#000000' },
];
function socialUrl(key: string, val: string): string {
  const v = String(val || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, '');
  switch (key) {
    case 'whatsapp': return 'https://wa.me/' + v.replace(/[^\d]/g, '');
    case 'instagram': return 'https://instagram.com/' + h;
    case 'facebook': return 'https://facebook.com/' + h;
    case 'youtube': return 'https://youtube.com/@' + h;
    case 'tiktok': return 'https://tiktok.com/@' + h;
    case 'telegram': return 'https://t.me/' + h;
    case 'x': return 'https://x.com/' + h;
    default: return v;
  }
}
function SocialRow({ socials }: { socials: any }) {
  const items = SOCIAL.filter((s) => socials?.[s.key]);
  if (!items.length) return null;
  return (
    <div className="sk-social">
      {items.map((s) => (
        <a key={s.key} href={socialUrl(s.key, socials[s.key])} target="_blank" rel="noreferrer" title={s.label} style={{ color: BRAND_COLOR[s.key] || s.color }}><BrandIcon name={s.key} size={17} /></a>
      ))}
    </div>
  );
}
// El componente ShareRow (compartir a redes: WhatsApp, Telegram, Instagram, Facebook, X,
// correo y compartir nativo) es compartido en '@/app/components/ShareRow' para que sea
// idéntico en la academia y en referidos.

// Overlay modal para formularios (siempre visible al abrir, evita el bug de "no pasa nada").
function Modal({ onClose, children }: { onClose: () => void; children: any }) {
  return <div className="sk-modal-ov" onClick={onClose}><div className="sk-modal" onClick={(e) => e.stopPropagation()}>{children}</div></div>;
}

// ---- Confirmación de borrado global (popup iluminado) ----
// confirmDelete(...) devuelve una promesa que resuelve true si el usuario confirma.
// Cualquier acción destructiva (borrar comentario, PDF, archivo, alumno, etc.) la usa.
type ConfirmOpts = { title?: string; message?: string; confirmText?: string; itemName?: string };
let _askDelete: ((o: ConfirmOpts) => Promise<boolean>) | null = null;
function confirmDelete(o: ConfirmOpts = {}): Promise<boolean> {
  if (_askDelete) return _askDelete(o);
  if (typeof window !== 'undefined') return Promise.resolve(window.confirm(o.message || o.title || '¿Eliminar?'));
  return Promise.resolve(false);
}
function ConfirmHost({ lang }: { lang: string }) {
  const L = mkL(lang);
  const [st, setSt] = useState<{ o: ConfirmOpts; res: (v: boolean) => void } | null>(null);
  useEffect(() => { _askDelete = (o) => new Promise<boolean>((res) => setSt({ o, res })); return () => { _askDelete = null; }; }, []);
  if (!st) return null;
  const done = (v: boolean) => { st.res(v); setSt(null); };
  const o = st.o;
  return (
    <div className="sk-modal-ov" onClick={() => done(false)}>
      <div className="sk-modal sk-confirm" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
          <span className="sk-confirm-ic"><OnyxIcon emoji="🗑" size={20} /></span>
          <b style={{ fontSize: 16.5 }}>{o.title || L('¿Eliminar?', 'Delete?')}</b>
        </div>
        {o.itemName && <div className="sk-confirm-item">{o.itemName}</div>}
        <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 18px', lineHeight: 1.55 }}>{o.message || L('Esta acción no se puede deshacer.', 'This action cannot be undone.')}</p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => done(false)}>{L('Cancelar', 'Cancel')}</button>
          <button className="btn sk-btn-danger" onClick={() => done(true)}>{o.confirmText || L('Eliminar', 'Delete')}</button>
        </div>
      </div>
    </div>
  );
}

// Panel de gestión de un alumno (para el mentor), abrible desde cualquier nombre.
function StudentManageModal({ s, L, onClose, onAction, onDm }: any) {
  const [name, setName] = useState(s.display_name || '');
  const [editing, setEditing] = useState(false);
  const banned = !!s.banned; // desde miembros no viene 'banned'; los baneados no salen en miembros
  async function ban() {
    if (!banned && !await confirmDelete({ title: L('¿Banear alumno?', 'Ban student?'), itemName: s.name, message: L('Perderá acceso a la comunidad al instante. Puedes readmitirlo después.', 'They lose community access instantly. You can readmit later.'), confirmText: L('Banear', 'Ban') })) return;
    onAction({ action: 'student_ban', student_id: s.user_id, banned: !banned }, 'r'); onClose();
  }
  async function remove() {
    if (!await confirmDelete({ title: L('¿Quitar alumno?', 'Remove student?'), itemName: s.name, message: L('Se borra su inscripción a tu academia.', 'Their enrollment in your academy is deleted.'), confirmText: L('Quitar', 'Remove') })) return;
    onAction({ action: 'student_remove', student_id: s.user_id }, 'r'); onClose();
  }
  function saveName() { onAction({ action: 'student_name', student_id: s.user_id, name }, 'r'); setEditing(false); onClose(); }
  return (
    <Modal onClose={onClose}><div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <Avatar name={s.name} level={s.level} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 15 }}>{s.name}</b><div className="muted" style={{ fontSize: 12 }}>{L('Nivel', 'Level')} {s.level} · {s.points} {L('pts', 'pts')}{s.country ? ' · ' + countryName(s.country) : ''}</div></div>
      </div>
      {editing ? (
        <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L('Nombre visible en tu academia', 'Display name in your academy')} style={{ margin: 0, flex: 1, minWidth: 160 }} />
          <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={saveName}>{L('Guardar', 'Save')}</button>
        </div>
      ) : null}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => { setName(s.display_name || s.name || ''); setEditing((v) => !v); }}>✎ {L('Editar nombre', 'Edit name')}</button>
        <button className="btn btn-ghost" onClick={() => onDm(s.user_id)}><OnyxIcon name="chat" size={14} /> {L('Mensaje', 'Message')}</button>
        <button className="btn btn-ghost" style={{ color: banned ? 'var(--green)' : 'var(--gold)' }} onClick={ban}>{banned ? L('Readmitir', 'Unban') : L('Banear', 'Ban')}</button>
        <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={remove}>✕ {L('Quitar', 'Remove')}</button>
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{L('Los cambios afectan solo a tu academia; no tocan la cuenta de Onyx del alumno.', 'Changes affect only your academy; they don’t touch the student’s Onyx account.')}</p>
    </div></Modal>
  );
}

// Preferencias de notificaciones push del alumno (qué avisos quiere).
function NotifPrefs({ prefs, L }: { prefs: any; L: (a: string, b: string) => string }) {
  const init = (k: string) => (prefs || {})[k] !== false;
  const [p, setP] = useState({ announcements: init('announcements'), messages: init('messages'), classes: init('classes'), wins: init('wins') });
  const [open, setOpen] = useState(false);
  async function set(k: string, v: boolean) { const np = { ...p, [k]: v }; setP(np); await fetch('/api/academy/profile', { method: 'POST', body: JSON.stringify({ push_prefs: np }) }); }
  const rows: [string, string, string][] = [
    ['announcements', L('Anuncios del mentor', 'Mentor announcements'), 'chat'],
    ['messages', L('Mensajes privados', 'Private messages'), 'mail'],
    ['classes', L('Clases en vivo', 'Live classes'), 'calendar'],
    ['wins', L('Logros', 'Wins'), 'trophy'],
  ];
  return (
    <div className="sk-side-card">
      <button className="row between" onClick={() => setOpen((v) => !v)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignItems: 'center' }}>
        <b style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 7 }}><OnyxIcon emoji="🔔" size={14} /> {L('Notificaciones', 'Notifications')}</b>
        <span className="muted" style={{ fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(([k, lbl, ic]) => (
            <label key={k} className="row between" style={{ alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
              <span className="row" style={{ gap: 8, alignItems: 'center' }}><OnyxIcon name={ic as any} size={14} glow={false} /> {lbl}</span>
              <input type="checkbox" checked={(p as any)[k]} onChange={(e) => set(k, e.target.checked)} style={{ width: 'auto', margin: 0 }} />
            </label>
          ))}
          <p className="muted" style={{ fontSize: 11, marginTop: 2 }}>{L('Elige qué push quieres recibir en tu teléfono.', 'Choose which pushes you get on your phone.')}</p>
        </div>
      )}
    </div>
  );
}

// Banner (una vez) para instalar la app + activar notificaciones dentro de la academia.
function InstallBanner({ L }: { L: (a: string, b: string) => string }) {
  const [show, setShow] = useState(false);
  const [pubKey, setPubKey] = useState('');
  const [iosInstall, setIosInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const KEY = 'onyx_acad_notif_dismissed';
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    if (!supported) return;
    try { if (localStorage.getItem(KEY)) return; } catch {}
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    (async () => {
      try {
        const j = await (await fetch('/api/push')).json();
        if (!j.enabled) return; // sin claves VAPID → no molestamos
        setPubKey(j.publicKey || '');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) return; // ya suscrito
        if (iOS && !standalone) setIosInstall(true); // en iPhone primero hay que instalar
        setShow(true);
      } catch {}
    })();
  }, []);
  function dismiss() { try { localStorage.setItem(KEY, '1'); } catch {}; setShow(false); }
  function urlB64(base64: string) { const pad = '='.repeat((4 - (base64.length % 4)) % 4); const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(b64); const a = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { alert(L('Bloqueaste las notificaciones. Actívalas en los ajustes del navegador.', 'You blocked notifications. Enable them in your browser settings.')); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(pubKey) });
      await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      dismiss();
    } catch { alert(L('No se pudo activar. Intenta de nuevo.', 'Could not enable. Try again.')); }
    finally { setBusy(false); }
  }
  if (!show) return null;
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--brand) 45%,transparent)', background: 'color-mix(in srgb,var(--brand) 8%,var(--card))' }}>
      <div className="row between" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'color-mix(in srgb,var(--brand) 18%,transparent)', display: 'grid', placeItems: 'center', flex: 'none' }}><OnyxIcon emoji="🔔" size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{L('No te pierdas nada', 'Don’t miss a thing')}</b>
            <div className="muted" style={{ fontSize: 12.5 }}>{iosInstall ? L('Instala la app y activa las notificaciones para recibir clases en vivo, mensajes y anuncios.', 'Install the app and turn on notifications for live classes, messages and announcements.') : L('Activa las notificaciones para clases en vivo, mensajes y anuncios.', 'Turn on notifications for live classes, messages and announcements.')}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {!iosInstall && <button className="btn btn-primary" disabled={busy} onClick={enable}>{busy ? '…' : L('Activar', 'Turn on')}</button>}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={dismiss}>{L('Ahora no', 'Not now')}</button>
        </div>
      </div>
      {iosInstall && <div className="muted" style={{ fontSize: 12, marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>ℹ {L('En iPhone: toca «Compartir» en Safari → «Añadir a pantalla de inicio». Abre Onyx desde ahí y vuelve aquí para activar.', 'On iPhone: tap “Share” in Safari → “Add to Home Screen”. Open Onyx from there and come back to enable.')}</div>}
    </div>
  );
}

export default function AcademyClient() {
  const { lang } = useLang();
  const L = mkL(lang);
  const [d, setD] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [paywall, setPaywall] = useState<any>(null);
  const [joinCode, setJoinCode] = useState('');
  const [manage, setManage] = useState(false);

  async function load() { const r = await fetch('/api/academy'); setD(await r.json()); }
  async function openAcademy(mid: string) { const r = await fetch('/api/academy?m=' + mid); const j = await r.json(); if (j.active) { setPaywall(null); setActive(j.active); } else if (j.membershipRequired) { setActive(null); setPaywall(j.membershipRequired); } }
  useEffect(() => {
    (async () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        const jc = sp.get('join'); const ref = sp.get('ref') || '';
        if (jc) { const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: jc, ref }) }); const j = await r.json(); await load(); if (j.ok) openAcademy(j.mentor_id); return; }
      } catch {}
      load();
    })();
  }, []);
  async function join() {
    if (!joinCode.trim()) return;
    const r = await fetch('/api/academy/enroll', { method: 'POST', body: JSON.stringify({ code: joinCode.trim() }) });
    const j = await r.json(); setJoinCode('');
    if (j.ok) { await load(); openAcademy(j.mentor_id); }
    else if (j.closed) alert(j.note || L('Esta academia tiene las inscripciones cerradas por ahora.', 'This academy has enrollment closed right now.') + (j.reopenAt ? ' ' + L('Reabre pronto.', 'Reopens soon.') : ''));
    else alert(L('Código no válido.', 'Invalid code.'));
  }

  if (!d) return <div className="card muted">…</div>;
  if (manage && d.canMentor) return <MentorPanel lang={lang} onClose={() => { setManage(false); load(); }} openStudent={(mid: string) => { setManage(false); openAcademy(mid); }} />;
  if (paywall) return <Paywall pw={paywall} lang={lang} onBack={() => { setPaywall(null); load(); }} />;
  if (active) return <Community active={active} lang={lang} reload={() => openAcademy(active.mentor_id)} onExit={() => { setActive(null); load(); }} toMentor={d.canMentor ? () => setManage(true) : undefined} />;

  return (
    <div className="sk-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={24} /></span> Onyx Academy</h2>
          <div className="muted" style={{ fontSize: 13 }}>{L('Comunidades de trading: aprende, comparte y sube de nivel.', 'Trading communities: learn, share and level up.')}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {d.canMentor && <button className="btn btn-primary" onClick={() => setManage(true)}><OnyxIcon name="graduation" size={15} /> {L('Panel del mentor', 'Mentor panel')}</button>}
        </div>
      </div>

      <div className="sk-card">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <OnyxIcon emoji="🔑" size={16} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{L('Unirme a una academia', 'Join an academy')}</span>
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={L('Pega el código del mentor', 'Paste your mentor code')} style={{ margin: 0, flex: 1, minWidth: 160 }} onKeyDown={(e) => e.key === 'Enter' && join()} />
          <button className="btn btn-primary" onClick={join}>{L('Unirme', 'Join')}</button>
        </div>
      </div>

      <RedeemBeca L={L} onDone={(mid: string) => { load(); openAcademy(mid); }} />

      <GuardianUpsell L={L} />

      {d.isMentor && d.myMentorId && (
        <div>
          <div className="sk-sec-title">{L('Mi comunidad', 'My community')}</div>
          <button className="sk-course" style={{ maxWidth: 280 }} onClick={() => openAcademy(d.myMentorId)}>
            <div className="sk-course-cover" style={d.myLogoUrl ? { backgroundImage: `url(${d.myLogoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'var(--grad)' }}>{!d.myLogoUrl && <span style={{ color: 'rgba(255,255,255,.92)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={30} glow={false} /></span>}</div>
            <div className="sk-course-body">
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tx)' }}>{d.myAcademyName || 'Onyx Academy'}</div>
              <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--brand)' }}>{L('Entrar como mentor →', 'Enter as mentor →')}</div>
            </div>
          </button>
        </div>
      )}

      {(d.academies || []).length > 0 && (
        <div>
          <div className="sk-sec-title">{L('Academias en las que estoy', 'Academies I’m in')}</div>
          <div className="sk-grid-courses">{d.academies.map((a: any) => (
            <button key={a.mentor_id} className="sk-course" onClick={() => openAcademy(a.mentor_id)}>
              <div className="sk-course-cover" style={{ background: 'var(--grad)' }}><OnyxIcon name="graduation" size={30} /></div>
              <div className="sk-course-body">
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.academy_name}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.mentor_name}{a.tagline ? ' · ' + a.tagline : ''}</div>
              </div>
            </button>
          ))}</div>
        </div>
      )}
      {!d.isMentor && (d.academies || []).length === 0 && <div className="sk-card muted">{L('Todavía no estás en ninguna academia. Únete con un código o explora el directorio.', 'You are not in any academy yet. Join with a code or browse the directory.')}</div>}

      {/* Crear tu propia academia es una función de pago: los usuarios Gratis pueden ser
          alumnos, pero para TENER su academia necesitan un plan de pago. */}
      {!d.canMentor && (
        <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)', background: 'color-mix(in srgb,var(--brand) 6%,transparent)' }}>
          <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={16} /></span> {L('¿Quieres tu propia academia?', 'Want your own academy?')}</b>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{L('Crea tu comunidad, sube cursos y cobra membresías o niveles a tus alumnos. Disponible en los planes Pro, Elite y Black Onyx.', 'Build your community, upload courses and charge memberships or tiers to your students. Available on Pro, Elite and Black Onyx plans.')}</div>
            </div>
            <a className="btn btn-primary" href="/account#plan" style={{ whiteSpace: 'nowrap' }}>{L('Mejorar mi plan', 'Upgrade my plan')}</a>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook de "cuenta regresiva" — devuelve un now que cambia cada segundo.
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!active) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [active]);
  return now;
}
function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (d > 0) return `${d}d ${h}h ${m}m ${ss}s`;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  return `${m}m ${ss}s`;
}

// Hora de Nueva York (America/New_York) — la zona de referencia para las clases.
function nyTime(iso: string, lang: string, withDay = true) {
  return new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { timeZone: 'America/New_York', ...(withDay ? { weekday: 'short', day: 'numeric', month: 'short' } : {}), hour: '2-digit', minute: '2-digit' });
}
// UTC guardado → "hora de pared" de NY para el input datetime-local (YYYY-MM-DDTHH:mm).
function utcToNyInput(iso: string): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return `${g('year')}-${g('month')}-${g('day')}T${(g('hour') === '24' ? '00' : g('hour'))}:${g('minute')}`;
}
// "hora de pared" de NY (del input) → hora local del navegador (para el aviso "tu hora").
function nyInputToLocalHint(naive: string, lang: string): string {
  if (!naive || naive.length < 16) return '';
  const s = naive.length === 16 ? naive + ':00' : naive;
  const asUtc = new Date(s + 'Z');
  const shown = new Date(asUtc.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const utc = new Date(asUtc.getTime() + (asUtc.getTime() - shown.getTime()));
  return utc.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
// ---- Horarios a prueba de husos: guardamos un instante (UTC) y lo mostramos en la hora
// local de quien mira, con etiqueta de zona; más referencias (NY/UTC) y "añadir a calendario". ----
function localTime(iso: string, lang: string, withDay = true) {
  const opts: any = { ...(withDay ? { weekday: 'short', day: 'numeric', month: 'short' } : {}), hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
  return new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', opts);
}
function refTimes(iso: string, lang: string) {
  const d = new Date(iso);
  const ny = d.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
  const utc = d.toLocaleString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${ny} ${lang === 'en' ? 'New York' : 'Nueva York'} · ${utc} UTC`;
}
// UTC guardado → "YYYY-MM-DDTHH:mm" en la hora LOCAL del navegador (para el input del mentor).
function utcToLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function icsStamp(d: Date) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function gcalUrl(ev: any) {
  const start = new Date(ev.starts_at); const end = new Date(start.getTime() + (ev.duration_min || 60) * 60000);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title || 'Live class', dates: `${icsStamp(start)}/${icsStamp(end)}`, details: [ev.description || '', ev.join_url || ''].filter(Boolean).join('\n'), location: ev.join_url || '' });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
function downloadIcs(ev: any) {
  const start = new Date(ev.starts_at); const end = new Date(start.getTime() + (ev.duration_min || 60) * 60000);
  const esc = (s: any) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Onyx Academy//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${ev.id || Date.now()}@onyxtradinglive`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`, `SUMMARY:${esc(ev.title || 'Live class')}`, `DESCRIPTION:${esc([ev.description || '', ev.join_url || ''].filter(Boolean).join('\n'))}`, ev.join_url ? `URL:${esc(ev.join_url)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  a.download = `${(ev.title || 'clase').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function CalBtns({ ev, L }: any) {
  return (
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      <a className="btn btn-ghost" style={{ fontSize: 12 }} href={gcalUrl(ev)} target="_blank" rel="noreferrer"><OnyxIcon name="calendar" size={14} glow={false} /> {L('Añadir a Google', 'Add to Google')}</a>
      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => downloadIcs(ev)}><OnyxIcon name="install" size={14} glow={false} /> {L('Descargar .ics', 'Download .ics')}</button>
    </div>
  );
}
function LiveBanner({ ev, lang }: { ev: any; lang: string }) {
  const L = mkL(lang);
  const now = useNow(true);
  if (!ev) return null;
  const start = new Date(ev.starts_at).getTime();
  const live = now >= start && ev.live;
  return (
    <div className={'sk-live' + (live ? ' on' : '')}>
      {live ? <span className="sk-dot" /> : <OnyxIcon name="calendar" size={18} />}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {live ? <span style={{ color: 'var(--red)' }}>● {L('EN VIVO AHORA', 'LIVE NOW')}</span> : L('Próxima clase en vivo', 'Next live class')}
          {' · '}{ev.title}
        </div>
        {!live && <div className="muted" style={{ fontSize: 12 }}>{localTime(ev.starts_at, lang)} · {L('tu hora', 'your time')} · {L('empieza en', 'starts in')} <span className="sk-count" style={{ fontSize: 13 }}>{fmtCountdown(start - now)}</span></div>}
      </div>
      {ev.join_url && (live || start - now < 15 * 60000) && <a className="btn btn-primary" href={ev.join_url} target="_blank" rel="noreferrer">{L('Entrar', 'Join')}</a>}
    </div>
  );
}

// Pantalla de membresía requerida (comunidad de pago).
function Paywall({ pw, lang, onBack }: any) {
  const L = mkL(lang);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<any>(null);
  const cur = (pw.currency || 'usd').toUpperCase(); const sym = cur === 'USD' ? '$' : '';
  const money = (c: number) => sym ? sym + (c / 100).toLocaleString() : (c / 100).toLocaleString() + ' ' + cur;
  const price = money(pw.priceCents) + '/' + (pw.interval === 'year' ? L('año', 'yr') : L('mes', 'mo'));
  const hasYear = (pw.yearCents || 0) > 0;
  async function join(plan?: 'year') {
    setBusy(true);
    const r = await fetch('/api/academy/membership', { method: 'POST', body: JSON.stringify({ code: pw.code, plan: plan || 'month' }) });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else if (j.free || j.already) window.location.reload();
    else if (j.closed) { setBusy(false); setClosed(j); }
    else { setBusy(false); alert(j.error === 'mentor_not_ready' ? L('El mentor aún no ha activado los cobros.', 'The mentor has not enabled payments yet.') : L('No se pudo iniciar el pago.', 'Could not start checkout.')); }
  }
  if (closed) return <ClosedDoors pw={pw} closed={closed} lang={lang} onBack={onBack} />;
  return (
    <div className="sk-wrap" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 8 }}>
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Mis academias', 'My academies')}</button>
      <div className="sk-card" style={{ textAlign: 'center', overflow: 'hidden' }}>
        <div className="sk-hero-cover" style={{ borderRadius: 12, marginBottom: 14, ...(pw.cover_url ? { backgroundImage: `url(${pw.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }} />
        <div className="sk-chip" style={{ margin: '0 auto' }}><OnyxIcon name="guardian" size={12} /> {L('Comunidad privada', 'Private community')}</div>
        <h2 style={{ margin: '10px 0 4px' }}>{pw.academy_name}</h2>
        {pw.tagline && <div className="muted" style={{ fontSize: 13.5 }}>{pw.tagline}</div>}
        <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold)', margin: '16px 0 6px' }}>{price}</div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{L('Suscríbete para entrar a la comunidad, las aulas y las clases en vivo.', 'Subscribe to access the community, classrooms and live classes.')}</p>
        <button className="btn btn-primary" style={{ width: '100%', fontSize: 16, padding: '12px' }} disabled={busy} onClick={() => join()}>{busy ? '…' : L('Unirme mensual', 'Join monthly')}</button>
        {hasYear && (
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: 14.5, padding: '11px', marginTop: 10, border: '1px solid var(--gold)' }} disabled={busy} onClick={() => join('year')}>
            {L('Plan anual', 'Annual plan')} · {money(pw.yearCents)}/{L('año', 'yr')}
            {(pw.yearSavePct || 0) > 0 && <span className="sk-chip" style={{ marginLeft: 8, background: 'var(--soft-green)', color: '#04210f' }}>-{pw.yearSavePct}%</span>}
          </button>
        )}
        <a href={`/academia/${pw.code}`} target="_blank" rel="noreferrer" className="muted" style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5 }}>{L('Ver la página completa', 'See the full page')} →</a>
      </div>
    </div>
  );
}

// Puertas cerradas: countdown de reapertura + lista de espera.
function ClosedDoors({ pw, closed, lang, onBack }: any) {
  const L = mkL(lang);
  const now = useNow(true);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const reopen = closed.reopenAt ? Number(closed.reopenAt) : null;
  async function waitlist() {
    if (!email.trim()) return;
    await fetch('/api/academy/membership', { method: 'POST', body: JSON.stringify({ code: pw.code, action: 'waitlist', email }) });
    setSent(true);
  }
  return (
    <div className="sk-wrap" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 8 }}>
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Mis academias', 'My academies')}</button>
      <div className="sk-card" style={{ textAlign: 'center' }}>
        <div className="sk-confirm-ic" style={{ margin: '0 auto 12px', background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}><OnyxIcon name="guardian" size={22} /></div>
        <h2 style={{ margin: '0 0 6px' }}>{L('Inscripciones cerradas', 'Enrollment closed')}</h2>
        <p className="muted" style={{ fontSize: 13.5 }}>{closed.note || L('Por ahora la academia no acepta nuevos alumnos.', 'The academy is not accepting new students right now.')}</p>
        {reopen && reopen > now && (
          <div style={{ margin: '16px 0' }}>
            <div className="muted" style={{ fontSize: 12.5 }}>{L('Reabre en', 'Reopens in')}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>{fmtCountdown(reopen - now)}</div>
            <div className="muted" style={{ fontSize: 12 }}>{nyTime(new Date(reopen).toISOString(), lang)} (NY)</div>
          </div>
        )}
        {sent ? (
          <div className="sk-chip" style={{ margin: '14px auto 0', background: 'color-mix(in srgb,var(--green) 16%,transparent)', color: 'var(--soft-green,var(--green))' }}>✓ {L('Te avisaremos cuando reabra', 'We’ll notify you when it reopens')}</div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>{L('Déjanos tu correo para avisarte al reabrir:', 'Leave your email to be notified when it reopens:')}</div>
            <div className="row" style={{ gap: 8 }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={{ margin: 0, flex: 1 }} />
              <button className="btn btn-primary" onClick={waitlist} disabled={!email.trim()}>{L('Avisarme', 'Notify me')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =================== Comunidad ===================
function Community({ active, lang, reload, onExit, toMentor }: any) {
  const L = mkL(lang);
  const es = lang !== 'en';
  const [tab, setTab] = useState<'community' | 'classroom' | 'calendar' | 'members' | 'leaderboard' | 'logros' | 'profile' | 'chat'>('community');
  const [openMod, setOpenMod] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [post, setPost] = useState('');
  const [postImg, setPostImg] = useState('');
  const [postKind, setPostKind] = useState('community');
  const [postWinKind, setPostWinKind] = useState('payout');
  const [postAnn, setPostAnn] = useState(false);
  const [feedFilter, setFeedFilter] = useState('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentToast, setSentToast] = useState(false);
  const [sentPending, setSentPending] = useState(false);
  const [viewUser, setViewUser] = useState<string | null>(null);
  const [dmWith, setDmWith] = useState<string | null>(null);
  const [manageStudent, setManageStudent] = useState<any>(null);
  const [modOpen, setModOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const canModerateHere = !!(active.isMentorHere || active.myPerms?.moderate);
  const modBadge = (active.modPending || 0) + (active.modReports || 0);

  const link = typeof window !== 'undefined' ? `${window.location.origin}/academia/${active.code}` : '';
  const totalLessons = (active.content || []).reduce((s: number, m: any) => s + m.lessons.length, 0);
  const doneCount = (active.progress || []).length;

  async function api(body: any) { const r = await fetch('/api/academy', { method: 'POST', body: JSON.stringify(body) }); return r.json().catch(() => ({})); }
  async function sendPost() { if (!post.trim() && !postImg) return { ok: false }; const res = await api({ action: 'post', mentor_id: active.mentor_id, body: post, image_url: postImg, kind: postKind, win_kind: postKind === 'win' ? postWinKind : undefined, announcement: postAnn, pinned: postAnn }); setPost(''); setPostImg(''); setPostKind('community'); setPostAnn(false); reload(); return res || {}; }
  async function like(t: string, id: string) { await api({ action: 'like', mentor_id: active.mentor_id, target_type: t, target_id: id }); reload(); }
  async function comment(pid: string, body: string, image?: string) { const r = await api({ action: 'comment', post_id: pid, mentor_id: active.mentor_id, body, image_url: image || '' }); if (r?.error === 'blocked') alert((r.message || L('Tu comentario no cumple las normas.', 'Your comment does not meet the rules.')) + escalMsg(r.escalated, L)); else if (r?.error === 'muted') alert(L('Estás silenciado temporalmente y no puedes comentar ahora.', 'You are temporarily muted and cannot comment right now.')); reload(); }
  // Reportar un contenido (post/comentario) para que lo revise el equipo.
  async function report(targetType: string, id: string) {
    const reason = prompt(L('¿Por qué reportas esto? (opcional)', 'Why are you reporting this? (optional)')) ?? '';
    await fetch('/api/academy/moderation', { method: 'POST', body: JSON.stringify({ action: 'report', mentor_id: active.mentor_id, target_type: targetType, target_id: id, reason }) });
    alert(L('Gracias. El equipo lo revisará.', 'Thanks. The team will review it.'));
  }
  // Moderar (dueño/colaborador): ocultar o borrar un post/comentario directo desde el feed.
  async function modDelete(type: string, id: string) {
    if (!await confirmDelete({ title: L('¿Eliminar?', 'Delete?'), message: L('Se quitará de la comunidad.', 'It will be removed from the community.') })) return;
    await fetch('/api/academy/moderation', { method: 'POST', body: JSON.stringify({ action: 'review', mentor_id: active.mentor_id, type, id, decision: 'delete' }) });
    reload();
  }
  // Auto-gestión del alumno: borrar / editar SOLO lo suyo.
  async function selfDelete(type: 'post' | 'comment', id: string) {
    if (!await confirmDelete({ title: L('¿Borrar lo tuyo?', 'Delete yours?'), message: type === 'post' ? L('Se borrará tu publicación.', 'Your post will be deleted.') : L('Se borrará tu comentario.', 'Your comment will be deleted.') })) return;
    await api({ action: type === 'post' ? 'delete_post' : 'delete_comment', id }); reload();
  }
  async function selfEdit(type: 'post' | 'comment', id: string, body: string) {
    const r = await api({ action: type === 'post' ? 'edit_post' : 'edit_comment', id, mentor_id: active.mentor_id, body });
    if (r?.error === 'blocked') { alert((r.message || L('El texto no cumple las normas.', 'The text does not meet the rules.')) + escalMsg(r.escalated, L)); return false; }
    reload(); return true;
  }
  async function toggleLesson(l: any, done: boolean) { await api({ action: 'lesson', lesson_id: l.id, done }); reload(); }
  async function buy(productId: string) {
    const r = await fetch('/api/academy/checkout', { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else alert(j.error === 'mentor_not_ready' ? L('El mentor aún no ha activado los cobros.', 'The mentor has not enabled payments yet.') : L('No se pudo iniciar el pago.', 'Could not start checkout.'));
  }
  // Clic en un nombre: si soy el mentor de esta academia, abro el panel de gestión
  // del alumno (editar/banear/quitar). Si no, abro su perfil como siempre.
  function openProfile(uid: string) {
    if (active.isMentorHere && uid !== active.myUserId) {
      const mem = (active.members || []).find((m: any) => m.user_id === uid);
      if (mem && !mem.is_mentor) { setManageStudent(mem); return; }
    }
    setViewUser(uid); setTab('profile');
  }
  function openDm(uid: string) { setDmWith(uid); setTab('chat'); }
  async function manageAction(body: any, done?: string) { await fetch('/api/academy/mentor', { method: 'POST', body: JSON.stringify(body) }); if (done) reload(); }

  const TABS: [string, string, string][] = [
    ['community', 'chat', L('Comunidad', 'Community')],
    ['classroom', 'graduation', L('Aulas', 'Classroom')],
    ['calendar', 'calendar', L('Calendario', 'Calendar')],
    ['members', 'users', L('Miembros', 'Members')],
    ['leaderboard', 'trophy', L('Ranking', 'Leaderboard')],
    ['logros', 'trophy', L('Logros', 'Wins')],
  ];

  return (
    <div className="sk-wrap" data-tab={tab} style={{ paddingTop: 4 }}>
      <ConfirmHost lang={lang} />
      {manageStudent && <StudentManageModal s={manageStudent} L={L} onClose={() => setManageStudent(null)} onAction={manageAction} onDm={(uid: string) => { setManageStudent(null); openDm(uid); }} />}
      {modOpen && <ModerationPanel mentorId={active.mentor_id} isOwner={!!active.isMentorHere} L={L} lang={lang} onClose={() => setModOpen(false)} reload={reload} />}
      {billingOpen && (
        <Modal onClose={() => setBillingOpen(false)}>
          <div className="sk-card" style={{ border: '1px solid var(--brand)', maxWidth: 560, width: '100%' }}>
            <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="card" size={18} /></span> {L('Mi membresía', 'My membership')}</h3>
              <button className="btn btn-ghost" onClick={() => setBillingOpen(false)}>✕</button>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}><StudentBilling lang={lang} mentorId={active.mentor_id} /></div>
          </div>
        </Modal>
      )}
      {composeOpen && (
        <Modal onClose={() => setComposeOpen(false)}><div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
          <h3 style={{ marginBottom: 4 }}>{L('¿Qué tipo de publicación es?', 'What kind of post is this?')}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{L('Elige una categoría para tu post.', 'Pick a category for your post.')}</p>
          <PostTypePicker kind={postKind} setKind={setPostKind} winKind={postWinKind} setWinKind={setPostWinKind} L={L} />
          {(active.isMentorHere || active.myPerms?.announce) && (
            <label className="row" style={{ gap: 8, fontSize: 12.5, cursor: 'pointer', marginTop: 12 }}>
              <input type="checkbox" checked={postAnn} onChange={(e) => setPostAnn(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
              <OnyxIcon name="megaphone" size={13} /> {L('Anuncio (fija arriba + push a todos)', 'Announcement (pins on top + push to all)')}
            </label>
          )}
          <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setComposeOpen(false)}>{L('Cancelar', 'Cancel')}</button>
            <button className="btn btn-primary" onClick={async () => { const res = await sendPost(); setComposeOpen(false); if (res?.error === 'blocked') { alert((res.message || L('Tu publicación no cumple las normas de la comunidad.', 'Your post does not meet the community rules.')) + escalMsg(res.escalated, L)); return; } if (res?.error === 'muted') { alert(L('Estás silenciado temporalmente y no puedes publicar ahora.', 'You are temporarily muted and cannot post right now.')); return; } setSentPending(!!res?.pending); setSentToast(true); setTimeout(() => setSentToast(false), 2800); }}>{postKind === 'win' ? L('Publicar logro', 'Post win') : L('Publicar', 'Post')}</button>
          </div>
        </div></Modal>
      )}
      {sentToast && (
        <div className="sk-modal-ov" style={{ alignItems: 'center' }} onClick={() => setSentToast(false)}>
          <div className="sk-confirm" style={{ maxWidth: 340, textAlign: 'center', borderColor: 'color-mix(in srgb,var(--green) 55%,transparent)', animation: 'skConfirmGlowG 1.6s ease-in-out infinite' }} onClick={(e) => e.stopPropagation()}>
            <div className="sk-confirm-ic" style={{ margin: '0 auto 10px', background: 'color-mix(in srgb,var(--green) 16%,transparent)', color: 'var(--soft-green,var(--green))' }}><OnyxIcon emoji={sentPending ? '⏳' : '✅'} size={22} /></div>
            <b style={{ fontSize: 16 }}>{sentPending ? L('¡Enviado!', 'Sent!') : (postKind === 'win' ? L('¡Logro publicado!', 'Win posted!') : L('¡Publicado!', 'Posted!'))}</b>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6, marginBottom: 0 }}>{sentPending ? L('Tu logro aparecerá cuando la academia lo apruebe.', 'Your win will show once the academy approves it.') : L('Ya está visible en la comunidad.', 'It’s now visible in the community.')}</p>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}><InstallBanner L={L} /></div>
      <div className="sk-hero">
        <div className="sk-hero-cover" style={active.cover_url ? { backgroundImage: `url(${active.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="sk-hero-body">
          <span className="sk-hero-logo">{active.logo_url ? <img src={active.logo_url} alt="" /> : <OnyxIcon name="graduation" size={30} />}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 21 }}>{active.academy_name}</h2>{active.tagline && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{active.tagline}</div>}</div>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <LangToggle compact />
                {!active.isMentorHere && <button className="btn btn-ghost" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setBillingOpen(true)}><OnyxIcon name="card" size={14} /> {L('Mi membresía', 'My membership')}</button>}
                {canModerateHere && <button className="btn btn-ghost" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setModOpen(true)}><OnyxIcon name="shield" size={14} /> {L('Moderación', 'Moderation')}{modBadge > 0 && <span className="sk-chip" style={{ padding: '0 6px', background: 'var(--red)', color: '#fff', fontSize: 11 }}>{modBadge}</span>}</button>}
                {active.isMentorHere && toMentor && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={toMentor}>{L('Configurar', 'Manage')}</button>}
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onExit}>← {L('Mis academias', 'My academies')}</button>
              </div>
            </div>
            {active.socials && Object.keys(active.socials).length > 0 && <div style={{ marginTop: 10 }}><SocialRow socials={active.socials} /></div>}
          </div>
        </div>
      </div>

      {/* Banner de clase en vivo — arriba, antes de las pestañas (primero lo importante) */}
      <div style={{ marginTop: 12 }}><LiveBanner ev={active.live} lang={lang} /></div>

      <div className="sk-tabs big" style={{ marginTop: 4 }}>
        {TABS.map(([k, ic, lbl]) => (
          <button key={k} className={'sk-tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k as any); setOpenMod(null); setLesson(null); }}><OnyxIcon name={ic as any} size={16} /> {lbl}</button>
        ))}
      </div>

      {tab === 'profile' ? <ProfileView mentorId={active.mentor_id} userId={viewUser || active.myUserId} me={active.myUserId} lang={lang} onDm={openDm} onBack={() => setTab('members')} />
      : tab === 'chat' ? <ChatView mentorId={active.mentor_id} lang={lang} initialWith={dmWith} members={active.members || []} myUserId={active.myUserId} staffIds={active.staffIds || []} iAmStaff={!!active.myPerms?.isCollab} roles={active.roles || {}} />
      : (
      <div className="sk-grid" style={tab === 'classroom' ? { gridTemplateColumns: '1fr' } : undefined}>
        <div>
          {tab === 'community' && (
            <>
              {totalLessons >= 0 && <OnboardingChecklist active={active} L={L} onGo={(t: any) => setTab(t)} />}
              <div className="sk-card">
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name="•" level={active.me?.level} size={40} />
                  <div style={{ flex: 1 }}>
                    <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Comparte algo con la comunidad…', 'Share something with the community…')} style={{ width: '100%', margin: 0 }} />
                    <ImgPreview url={postImg} onRemove={() => setPostImg('')} />
                    <div className="row between" style={{ marginTop: 8, alignItems: 'center' }}>
                      <div className="row" style={{ gap: 2 }}><EmojiRow onPick={(e: string) => setPost((p) => p + e)} /><ImgAttach onUrl={(u: string) => setPostImg(u)} L={L} /></div>
                      <button className="btn btn-primary" onClick={() => { if (post.trim() || postImg) setComposeOpen(true); }} disabled={!post.trim() && !postImg}>{L('Publicar', 'Post')}</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '4px 0 10px' }}>
                <button className="sk-chip" onClick={() => setFeedFilter('all')} style={{ cursor: 'pointer', border: feedFilter === 'all' ? '1px solid var(--brand)' : '1px solid var(--line)', background: feedFilter === 'all' ? 'color-mix(in srgb,var(--brand) 14%,transparent)' : 'var(--bg2)', color: feedFilter === 'all' ? 'var(--brand)' : 'var(--mut)' }}>{L('Todo', 'All')}</button>
                {POST_TYPES.filter((t) => t.key !== 'community').map((t) => (
                  <button key={t.key} className="sk-chip" onClick={() => setFeedFilter(t.key)} style={{ cursor: 'pointer', border: feedFilter === t.key ? `1px solid ${t.color}` : '1px solid var(--line)', background: feedFilter === t.key ? `color-mix(in srgb,${t.color} 14%,transparent)` : 'var(--bg2)', color: feedFilter === t.key ? t.color : 'var(--mut)' }}>{L(t.es, t.en)}</button>
                ))}
              </div>
              {(feedFilter === 'all' || feedFilter === 'win') && (active.winsMinePending || []).map((w: any) => (
                <div key={'wp' + w.id} className="sk-card sk-pending">
                  <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <Avatar name="•" level={active.me?.level} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{L('Tu logro', 'Your win')} <span className="sk-chip" style={{ fontSize: 10.5, padding: '1px 6px', background: `color-mix(in srgb,${WIN_KINDS[w.kind]?.color || 'var(--gold)'} 16%,transparent)`, color: WIN_KINDS[w.kind]?.color || 'var(--gold)' }}>{L(WIN_KINDS[w.kind]?.es, WIN_KINDS[w.kind]?.en)}</span></div></div>
                    {w.status === 'rejected'
                      ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--red) 16%,transparent)', color: 'var(--red)' }}>{L('No aprobado', 'Not approved')}</span>
                      : <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{L('En revisión', 'In review')}</span>}
                  </div>
                  {w.title && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{w.title}</div>}
                  {w.image_url && <img src={w.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 12, marginTop: 8, display: 'block' }} />}
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{w.status === 'rejected' ? L('La academia no aprobó este logro.', 'The academy did not approve this win.') : L('Aparecerá en el muro de logros cuando la academia lo apruebe.', 'It will show on the wins wall once the academy approves it.')}</div>
                </div>
              ))}
              {(active.feed || []).filter((p: any) => feedFilter === 'all' || (p.kind || 'community') === feedFilter).map((p: any) => <PostCard key={p.id} p={p} onLike={like} onComment={comment} onProfile={openProfile} onReport={report} onModDelete={modDelete} onSelfDelete={selfDelete} onSelfEdit={selfEdit} canModerate={!!(active.isMentorHere || active.myPerms?.moderate)} myUserId={active.myUserId} L={L} es={es} />)}
              {(active.feed || []).length === 0 && <div className="sk-card muted">{L('Sé el primero en publicar en la comunidad.', 'Be the first to post in the community.')}</div>}
            </>
          )}

          {tab === 'classroom' && (
            lesson ? <LessonView lesson={lesson} course={openMod} done={(active.progress || []).includes(lesson.id)} progress={active.progress || []} onBack={() => setLesson(null)} onToggle={toggleLesson} onPick={setLesson} L={L} />
            : openMod ? <CourseView course={openMod} mentorId={active.mentor_id} progress={active.progress || []} onBack={() => setOpenMod(null)} onPick={(l: any) => setLesson(l)} L={L} />
            : (
              <>
                {(active.products || []).length > 0 && !active.hasAccessAll && <Tiers products={active.products} purchases={active.purchases || []} onBuy={buy} L={L} />}
                {(active.content || []).length === 0
                  ? <div className="sk-card muted">{L('El mentor aún no ha publicado aulas.', 'The mentor has not published classrooms yet.')}</div>
                  : <div className="sk-grid-courses">
                    {(active.content || []).map((m: any) => {
                      const total = m.lessons.length; const done = m.lessons.filter((l: any) => (active.progress || []).includes(l.id)).length;
                      return (
                        <button key={m.id} className="sk-course" onClick={() => setOpenMod(m)}>
                          <div className="sk-course-cover" style={m.cover_url ? { backgroundImage: `url(${m.cover_url})` } : { background: 'var(--grad)' }}>
                            {!m.cover_url && <span style={{ color: 'rgba(255,255,255,.92)', display: 'inline-flex' }}><OnyxIcon name={m.locked ? 'guardian' : 'modules'} size={30} glow={false} /></span>}
                            {m.locked && <span className="sk-chip" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.5)', color: 'var(--gold)' }}><OnyxIcon name="guardian" size={11} /> {L('Bloqueado', 'Locked')}</span>}
                          </div>
                          <div className="sk-course-body">
                            <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{total} {L('lecciones', 'lessons')}</div>
                              </div>
                              {total > 0 && !m.locked && <Ring pct={total ? (done / total) * 100 : 0} size={42} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>}
              </>
            )
          )}

          {tab === 'calendar' && <CalendarTab events={active.events || []} lang={lang} L={L} />}

          {tab === 'members' && (
            <div className="sk-grid-members">
              {(active.members || []).map((mem: any) => (
                <div key={mem.user_id} className="sk-member">
                  <span style={{ position: 'relative', flex: 'none' }}>
                    <Avatar name={mem.name} level={mem.level} size={44} onClick={() => openProfile(mem.user_id)} />
                    {mem.online && <i className="sk-online" title={L('En línea', 'Online')} />}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => openProfile(mem.user_id)}>
                      {mem.country && <span title={countryName(mem.country)}>{flagOf(mem.country)}</span>}{mem.name}{mem.is_mentor ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 18%,transparent)', color: 'var(--gold)' }}>{L('Mentor', 'Mentor')}</span> : (active.roles?.[mem.user_id] && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--brand) 18%,transparent)', color: 'var(--soft-brand, var(--brand))' }}>{active.roles[mem.user_id]}</span>)}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{L('Nivel', 'Level')} {mem.level} · {mem.points} {L('pts', 'pts')}{mem.joined_at ? ' · ' + new Date(mem.joined_at).toLocaleDateString(es ? 'es-ES' : 'en-US', { month: 'short', year: 'numeric' }) : ''}</div>
                  </div>
                  {mem.user_id !== active.myUserId && <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openDm(mem.user_id)}><OnyxIcon name="chat" size={14} /></button>}
                </div>
              ))}
            </div>
          )}

          {tab === 'leaderboard' && <Leaderboard mentorId={active.mentor_id} initial={active.leaderboard || []} L={L} />}

          {tab === 'logros' && <WinsWall active={active} lang={lang} reload={reload} L={L} />}
        </div>

        {tab !== 'classroom' && (
        <div className="sk-side">
          <div className="sk-side-card">
            <div style={{ fontWeight: 800, fontSize: 16 }}>{active.academy_name}</div>
            {active.about && <p className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{active.about}</p>}
            <div className="row" style={{ gap: 16, margin: '12px 0', textAlign: 'center' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{active.membersCount ?? (active.members || []).length}</div><div className="muted" style={{ fontSize: 11 }}>{L('Miembros', 'Members')}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18 }}>{(active.content || []).length}</div><div className="muted" style={{ fontSize: 11 }}>{L('Aulas', 'Classrooms')}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{active.me?.level ?? 1}</div><div className="muted" style={{ fontSize: 11 }}>{L('Tu nivel', 'Your level')}</div></div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { navigator.clipboard.writeText(link); alert(L('Enlace de invitación copiado.', 'Invite link copied.')); }}><OnyxIcon emoji="🔗" size={14} /> {L('Invitar', 'Invite')}</button>
          </div>

          {!active.isMentorHere && <CopyPanel mentorId={active.mentor_id} isMentor={false} L={L} />}
          <ReferralEarnings active={active} L={L} />
          {active.audit && (active.audit.hasAddon || active.audit.addon || active.audit.verified) && (
            <div className={'sk-side-card' + ((active.audit.addon && !active.audit.hasAddon) ? ' sk-featured' : '')} style={{ border: '1px solid color-mix(in srgb,var(--green) 32%,transparent)' }}>
              <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 14 }}>{L('Auditoría de tu plan', 'Your plan audit')}</b><OnyxIcon name="guardian" size={15} /></div>
              {active.audit.verified && <div className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)', marginBottom: 8, display: 'inline-flex' }}>✓ {L('Plan verificado por tu mentor', 'Plan verified by your mentor')}</div>}
              {active.audit.hasAddon ? (
                <>
                  <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{L('Tu mentor puede revisar tu trading real y darte un boletín. Tú controlas el permiso.', 'Your mentor can review your real trading and give you a report card. You control the permission.')}</p>
                  <label className="row" style={{ gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!active.audit.consent} onChange={async (e) => { await fetch('/api/academy/audit', { method: 'POST', body: JSON.stringify({ action: 'consent', mentor_id: active.mentor_id, on: e.target.checked }) }); reload(); }} style={{ width: 'auto', margin: 0 }} />
                    {L('Dejar que mi mentor audite mi trading', 'Let my mentor audit my trading')}
                  </label>
                  {!active.audit.consent && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Sin tu permiso, tu mentor no ve tus datos.', 'Without your permission, your mentor sees no data.')}</p>}
                </>
              ) : active.audit.addon ? (
                <>
                  <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{L('Activa el add-on para que tu mentor audite tu trading real, te dé un reporte AI y verifique tu plan.', 'Activate the add-on so your mentor audits your real trading, gives you an AI report and verifies your plan.')}</p>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => buy(active.audit.addon.id)}>{priceLabel(active.audit.addon, L)} · {L('Activar', 'Activate')}</button>
                </>
              ) : null}
            </div>
          )}
          {active.assistant_on && <AssistantCard mentorId={active.mentor_id} L={L} />}
          {!active.isMentorHere && <ReviewCard mentorId={active.mentor_id} L={L} />}
          <NotifPrefs prefs={active.myPushPrefs || {}} L={L} />
          {totalLessons > 0 && (
            <div className="sk-side-card">
              <div className="row between" style={{ fontSize: 13, marginBottom: 8 }}><b>{L('Tu progreso', 'Your progress')}</b><span className="muted">{doneCount}/{totalLessons}</span></div>
              <div className="statbar" style={{ ['--ac' as any]: 'var(--green)' }}><i style={{ width: (totalLessons ? (doneCount / totalLessons) * 100 : 0) + '%' }} /></div>
            </div>
          )}
          <div className="sk-side-card">
            <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 14 }}>{L('Ranking', 'Leaderboard')}</b><OnyxIcon name="trophy" size={15} /></div>
            {(active.leaderboard || []).length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>{L('Aún sin actividad. ¡Da likes y publica para sumar puntos!', 'No activity yet. Like and post to earn points!')}</div>}
            {(active.leaderboard || []).slice(0, 5).map((r: any) => (
              <div key={r.user_id} className="sk-board-row">
                <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)' } : undefined}>{r.rank}</span>
                <Avatar name={r.name} level={r.level} size={30} onClick={() => openProfile(r.user_id)} />
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <b style={{ fontSize: 12.5 }}>{r.points}</b>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      )}

      {/* Barra inferior tipo app (móvil) */}
      <div className="sk-bottom">
        <button className={'sk-bnav' + (['community', 'classroom', 'calendar', 'members', 'leaderboard'].includes(tab) ? ' on' : '')} onClick={() => setTab('community')}><OnyxIcon name="chat" size={20} /> {L('Inicio', 'Home')}</button>
        <button className={'sk-bnav' + (tab === 'chat' ? ' on' : '')} onClick={() => { setDmWith(null); setTab('chat'); }}><OnyxIcon name="mail" size={20} />{active.dmUnread > 0 && <span className="sk-bdot">{active.dmUnread}</span>} {L('Chat', 'Chat')}</button>
        <button className="sk-bnav" onClick={() => setTab('leaderboard')}><OnyxIcon name="trophy" size={20} /> {L('Ranking', 'Rank')}</button>
        <button className={'sk-bnav' + (tab === 'profile' ? ' on' : '')} onClick={() => { setViewUser(active.myUserId); setTab('profile'); }}><OnyxIcon name="users" size={20} /> {L('Perfil', 'Profile')}</button>
      </div>
    </div>
  );
}

function OnboardingChecklist({ active, L, onGo }: any) {
  const [hide, setHide] = useState(false);
  const watched = (active.progress || []).length > 0;
  const items = [
    [L('Mira la lección de bienvenida', 'Watch the welcome lesson'), watched, () => onGo('classroom')],
    [L('Encuentra un post y comenta', 'Find a post and comment'), false, () => onGo('community')],
    [L('Preséntate a la comunidad', 'Introduce yourself'), false, () => onGo('community')],
  ] as [string, boolean, () => void][];
  if (hide) return null;
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--brand) 40%,transparent)' }}>
      <div className="row between" style={{ marginBottom: 8 }}><b>{L('¡Bienvenido! Empieza aquí', 'Welcome! Start here')}</b><button className="btn btn-ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setHide(true)}>{L('Ocultar', 'Dismiss')}</button></div>
      {items.map(([lbl, done, go], i) => (
        <button key={i} className="row" style={{ gap: 10, alignItems: 'center', width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '6px 0' }} onClick={go}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid ' + (done ? 'var(--green)' : 'var(--mut)'), color: 'var(--green)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{done ? '✓' : ''}</span>
          <span style={{ fontSize: 13.5, color: 'var(--soft-brand)' }}>{lbl}</span>
        </button>
      ))}
    </div>
  );
}

// Calendario en cuadrícula (vista de mes) con las clases/eventos marcados.
function MonthCalendar({ events, lang }: any) {
  const now = useNow(true);
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const first = new Date(cur.y, cur.m, 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const todayKey = new Date().toDateString();
  const byDay: Record<string, any[]> = {};
  (events || []).forEach((e: any) => { const k = new Date(e.starts_at).toDateString(); (byDay[k] ||= []).push(e); });
  Object.values(byDay).forEach((arr) => arr.sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at)));
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) { const n = i - startOffset + 1; cells.push({ date: new Date(cur.y, cur.m, n), inMonth: n >= 1 && n <= daysInMonth }); }
  const monthLabel = first.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });
  const dows = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
  function shift(n: number) { let m = cur.m + n, y = cur.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setCur({ y, m }); }
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => shift(-1)}>←</button>
        <b style={{ textTransform: 'capitalize', fontSize: 15 }}>{monthLabel}</b>
        <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => shift(1)}>→</button>
      </div>
      <div className="sk-cal-head">{dows.map((d) => <div key={d} className="sk-cal-dow">{d}</div>)}</div>
      <div className="sk-cal-grid">
        {cells.map((c, i) => {
          const key = c.date.toDateString(); const evs = byDay[key] || []; const isToday = key === todayKey;
          return (
            <div key={i} className={'sk-cal-cell' + (c.inMonth ? '' : ' dim') + (isToday ? ' today' : '')}>
              <div className="sk-cal-day">{c.date.getDate()}</div>
              {evs.slice(0, 3).map((e: any) => {
                const start = new Date(e.starts_at).getTime(); const end = start + (e.duration_min || 60) * 60000; const live = now >= start && now < end;
                return <div key={e.id} className={'sk-cal-ev' + (live ? ' live' : '')} title={`${hhmm(e.starts_at)} · ${e.title}`} onClick={() => e.join_url && window.open(e.join_url, '_blank')}>{live ? '● ' : ''}<b>{hhmm(e.starts_at)}</b>{e.title}</div>;
              })}
              {evs.length > 3 && <div className="muted" style={{ fontSize: 10 }}>+{evs.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarTab({ events, lang, L }: any) {
  const now = useNow(true);
  const fmtD = (d: Date) => { const p = (n: number) => (n < 10 ? '0' + n : '' + n); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const [range, setRange] = useState(() => { const f = new Date(); f.setHours(0, 0, 0, 0); const t = new Date(f.getTime() + 7 * 86400000); return { from: fmtD(f), to: fmtD(t) }; });
  const thisWeek = () => { const f = new Date(); f.setHours(0, 0, 0, 0); const t = new Date(f.getTime() + 7 * 86400000); setRange({ from: fmtD(f), to: fmtD(t) }); };
  const fromMs = new Date(range.from + 'T00:00:00').getTime();
  const toMs = new Date(range.to + 'T23:59:59').getTime();
  const inRange = (events || []).filter((e: any) => { const ss = new Date(e.starts_at).getTime(); return ss >= fromMs && ss <= toMs; }).sort((a: any, b: any) => String(a.starts_at).localeCompare(String(b.starts_at)));
  const Row = (e: any) => {
    const start = new Date(e.starts_at).getTime(); const end = start + (e.duration_min || 60) * 60000; const live = now >= start && now < end;
    const isPast = end <= now;
    const liveEmbed = live ? embed(e.join_url || '') : '';
    const recEmbed = isPast ? embed(e.recording_url || '') : '';
    return (
      <div key={e.id} className="sk-card" style={{ margin: 0, ...(isPast ? { borderLeft: '3px solid var(--red)', opacity: 0.72 } : {}) }}>
        <div className="row between" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, textDecoration: isPast ? 'line-through' : 'none', textDecorationColor: isPast ? 'var(--red)' : undefined, textDecorationThickness: isPast ? 2 : undefined }}>{live && <span className="sk-dot" />}{e.title}</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>{localTime(e.starts_at, lang)} · <span className="muted">{L('tu hora', 'your time')} · {e.duration_min} min</span></div>
            {!isPast && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{refTimes(e.starts_at, lang)}</div>}
            {e.description && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{e.description}</div>}
            {!isPast && <CalBtns ev={e} L={L} />}
          </div>
          {e.join_url && (live || start - now < 15 * 60000) ? <a className="btn btn-primary" href={e.join_url} target="_blank" rel="noreferrer">{live ? L('Entrar EN VIVO', 'Join LIVE') : L('Entrar', 'Join')}</a>
            : isPast && e.recording_url ? <a className="btn btn-ghost" href={e.recording_url} target="_blank" rel="noreferrer"><OnyxIcon emoji="🎬" size={14} /> {L('Ver grabación', 'Watch replay')}</a>
            : isPast ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--red) 14%,transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb,var(--red) 40%,transparent)', fontWeight: 700, letterSpacing: '.02em' }}>✓ {L('Finalizada', 'Ended')}</span>
            : <span className="sk-chip">{fmtCountdown(start - now)}</span>}
        </div>
        {(liveEmbed || recEmbed) && (
          <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
            <iframe src={liveEmbed || recEmbed} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          </div>
        )}
      </div>
    );
  };
  const liveUp = inRange.filter((e: any) => new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 > now);
  // "Ya pasaron": mostramos solo las 7 más recientes; para ver más antiguas se usa el filtro de fecha.
  const donePastAll = inRange
    .filter((e: any) => new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 <= now)
    .sort((a: any, b: any) => String(b.starts_at).localeCompare(String(a.starts_at)));
  const donePast = donePastAll.slice(0, 7);
  const donePastHidden = donePastAll.length - donePast.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MonthCalendar events={events} lang={lang} />
      <div className="sk-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: 0 }}>
        <div><div className="muted" style={{ fontSize: 12 }}>{L('Desde', 'From')}</div><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <div><div className="muted" style={{ fontSize: 12 }}>{L('Hasta', 'To')}</div><input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
        <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={thisWeek}>{L('Esta semana', 'This week')}</button>
        <span className="muted" style={{ fontSize: 11.5, marginLeft: 'auto' }}>{L('Por defecto muestra 7 días. Cambia las fechas para ver anteriores.', 'Shows 7 days by default. Change dates to see past ones.')}</span>
      </div>
      <div className="sk-sec-title">{L('Clases en vivo', 'Live classes')}</div>
      {liveUp.length === 0 && donePast.length === 0 && <div className="sk-card muted">{L('No hay clases en este rango de fechas.', 'No classes in this date range.')}</div>}
      {liveUp.map(Row)}
      {donePast.length > 0 && <><div className="sk-sec-title">{L('Ya pasaron', 'Already passed')} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>· {L('últimas 7', 'last 7')}</span></div>{donePast.map(Row)}{donePastHidden > 0 && <div className="sk-card muted" style={{ fontSize: 12.5, textAlign: 'center' }}>{L(`Hay ${donePastHidden} clase(s) más antiguas en este rango. Ajusta las fechas de arriba para verlas.`, `${donePastHidden} older class(es) in this range. Adjust the dates above to see them.`)}</div>}</>}
    </div>
  );
}

function CourseView({ course, mentorId, progress, onBack, onPick, L }: any) {
  const [certBusy, setCertBusy] = useState(false);
  // Agrupa lecciones por sección.
  const groups: Record<string, any[]> = {};
  const order: string[] = [];
  (course.lessons || []).forEach((l: any) => { const s = l.section || L('Lecciones', 'Lessons'); if (!groups[s]) { groups[s] = []; order.push(s); } groups[s].push(l); });
  const total = course.lessons.length; const done = course.lessons.filter((l: any) => progress.includes(l.id)).length;
  const complete = total > 0 && done >= total;
  async function getCert() {
    setCertBusy(true);
    const r = await fetch('/api/academy/certificate', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, module_id: course.id }) });
    const j = await r.json(); setCertBusy(false);
    if (j.ok && j.code) window.open('/certificado/' + j.code, '_blank');
    else alert(L('Completa todas las lecciones para tu certificado.', 'Complete all lessons to get your certificate.'));
  }
  return (
    <div>
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Aulas', 'Classroom')}</button>
      <div className="sk-card">
        {course.cover_url && <div className="sk-course-cover" style={{ backgroundImage: `url(${course.cover_url})`, borderRadius: 12, marginBottom: 12 }} />}
        <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{course.title}</h3>
          <Ring pct={total ? (done / total) * 100 : 0} size={46} />
        </div>
        {course.description && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{course.description}</p>}
        {complete && <button className="btn btn-primary" style={{ marginBottom: 12 }} disabled={certBusy} onClick={getCert}><OnyxIcon name="graduation" size={14} /> {certBusy ? '…' : L('Descargar certificado', 'Download certificate')}</button>}
        {order.map((sec) => (
          <div key={sec}>
            <div className="sk-sec-title">{sec}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups[sec].map((l: any) => { const isDone = progress.includes(l.id); const open = !course.locked || l.is_free; return (
                <button key={l.id} onClick={() => open && onPick(l)} disabled={!open} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', textAlign: 'left', cursor: open ? 'pointer' : 'not-allowed', opacity: open ? 1 : .6, color: 'var(--tx)' }}>
                  <span style={{ color: !open ? 'var(--gold)' : isDone ? 'var(--green)' : 'var(--mut)', display: 'inline-flex' }}>{!open ? <OnyxIcon name="guardian" size={14} /> : isDone ? '✓' : '○'}</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: 'var(--tx)' }}>{l.title}</span>
                  {l.is_free && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>{L('gratis', 'free')}</span>}
                  {l.video_url && open && <OnyxIcon emoji="🎬" size={14} />}
                  {l.pdf_url && open && <OnyxIcon emoji="📄" size={14} />}
                </button>
              ); })}
            </div>
          </div>
        ))}
        {total === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{L('Sin lecciones todavía.', 'No lessons yet.')}</span>}
      </div>
    </div>
  );
}

function LessonView({ lesson, course, done, progress, onBack, onToggle, onPick, L }: any) {
  const emb = embed(lesson.video_url || '');
  const list = (course?.lessons || []).filter((l: any) => !course.locked || l.is_free);
  const idx = list.findIndex((l: any) => l.id === lesson.id);
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const prev = idx > 0 ? list[idx - 1] : null;
  // Marca completada y avanza a la siguiente lección automáticamente.
  async function completeAndNext() {
    if (!done) { await onToggle(lesson, true); if (next) onPick(next); }
    else { onToggle(lesson, false); }
  }
  // Menú de temas (izquierda) — reutilizable para desktop y móvil.
  const Menu = (
    <div className="sk-side-card">
      <b style={{ fontSize: 13.5 }}>{course?.title}</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {list.map((l: any) => { const isDone = (progress || []).includes(l.id); const cur = l.id === lesson.id; return (
          <button key={l.id} onClick={() => onPick(l)} style={{ display: 'flex', gap: 8, alignItems: 'center', background: cur ? 'var(--bg2)' : 'none', border: cur ? '1px solid color-mix(in srgb,var(--brand) 40%,transparent)' : '1px solid transparent', borderRadius: 8, padding: '8px 9px', textAlign: 'left', cursor: 'pointer', fontSize: 12.5, color: cur ? 'var(--tx)' : 'var(--mut)' }}>
            <span style={{ color: isDone ? 'var(--green)' : cur ? 'var(--brand)' : 'var(--mut)', flex: 'none' }}>{isDone ? '✓' : cur ? '▸' : '○'}</span>
            <span style={{ flex: 1 }}>{l.title}</span>
            {l.pdf_url && <OnyxIcon emoji="📄" size={12} />}{l.video_url && <OnyxIcon emoji="🎬" size={12} />}
          </button>
        ); })}
      </div>
    </div>
  );
  return (
    <div className="sk-grid sk-lesson">
      {/* IZQUIERDA: menú de temas */}
      <div className="sk-lesson-menu">{Menu}</div>
      {/* DERECHA: video / PDF / contenido */}
      <div className="sk-card">
        <div className="row between" style={{ alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onBack}>← {L('Aulas', 'Classroom')}</button>
          <span className="muted" style={{ fontSize: 12 }}>{idx >= 0 ? `${idx + 1} / ${list.length}` : ''}</span>
        </div>
        <h3 style={{ marginBottom: 12 }}>{lesson.title}</h3>
        {lesson.video_url && (emb
          ? <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}><iframe src={emb} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
          : <video src={lesson.video_url} controls style={{ width: '100%', borderRadius: 12, marginBottom: 12 }} />)}
        {lesson.pdf_url && <PdfViewer url={lesson.pdf_url} allowDownload={lesson.pdf_download !== false} L={L} />}
        {lesson.content && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{lesson.content}</div>}
        {(lesson.resources || []).length > 0 && <div style={{ marginBottom: 12 }}>{lesson.resources.map((r: any, i: number) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="sk-chip" style={{ marginRight: 8 }}>📎 {r.label || r.url}</a>)}</div>}
        <div className="row between" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button className="btn" style={done ? { background: 'color-mix(in srgb,var(--green) 22%,transparent)', border: '1px solid var(--green)', color: 'var(--soft-green, var(--green))', fontWeight: 700 } : { background: 'var(--brand)', color: '#fff' }} onClick={completeAndNext}>{done ? '✓ ' + L('Completada', 'Completed') : (next ? L('Completar y siguiente →', 'Complete & next →') : L('Marcar como completada', 'Mark as completed'))}</button>
          <div className="row" style={{ gap: 6 }}>
            {prev && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => onPick(prev)}>← {L('Anterior', 'Previous')}</button>}
            {next && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => onPick(next)}>{L('Siguiente', 'Next')} →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Visor de PDF con navegación por páginas (pdf.js desde CDN, sin dependencias del bundle).
function PdfViewer({ url, allowDownload = true, L }: { url: string; allowDownload?: boolean; L: (a: string, b: string) => string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<any>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [err, setErr] = useState(false);
  const [ready, setReady] = useState(false);

  // Carga pdf.js una sola vez.
  useEffect(() => {
    let cancelled = false;
    function ensureLib(): Promise<any> {
      const w = window as any;
      if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => { const lib = (window as any).pdfjsLib; if (lib) { lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve(lib); } else reject(new Error('no lib')); };
        s.onerror = () => reject(new Error('load error'));
        document.head.appendChild(s);
      });
    }
    ensureLib().then((lib) => lib.getDocument(url).promise).then((doc: any) => {
      if (cancelled) return;
      docRef.current = doc; setPages(doc.numPages); setPage(1); setReady(true);
    }).catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, [url]);

  // Renderiza la página actual.
  useEffect(() => {
    if (!ready || !docRef.current || !canvasRef.current) return;
    let cancelled = false;
    docRef.current.getPage(page).then((pg: any) => {
      if (cancelled) return;
      const canvas = canvasRef.current!; const ctx = canvas.getContext('2d');
      const wrapW = canvas.parentElement ? canvas.parentElement.clientWidth : 800;
      const base = pg.getViewport({ scale: 1 });
      // Escala CSS: ocupar el ancho disponible. Súper-muestreo por DPR (y algo extra)
      // para que se vea nítido al hacer zoom con los dedos en el móvil.
      const cssScale = Math.max(0.5, wrapW / base.width);
      const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
      const render = Math.min(6, cssScale * Math.max(2, dpr));  // resolución interna alta
      const vp = pg.getViewport({ scale: render });
      canvas.width = vp.width; canvas.height = vp.height;
      // El canvas se muestra al ancho CSS, pero guarda muchos más píxeles → nítido al ampliar.
      canvas.style.width = Math.round(base.width * cssScale) + 'px';
      canvas.style.height = 'auto';
      pg.render({ canvasContext: ctx, viewport: vp });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [page, ready]);

  if (err) return (
    <div className="sk-card" style={{ margin: '0 0 12px', textAlign: 'center' }}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{L('No se pudo mostrar el PDF aquí.', 'Could not display the PDF here.')}</p>
      {allowDownload && <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">{L('Abrir PDF', 'Open PDF')}</a>}
    </div>
  );
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, overflow: 'auto', textAlign: 'center', minHeight: 200 }}>
        {!ready && <div className="muted" style={{ fontSize: 13, padding: 24 }}>{L('Cargando PDF…', 'Loading PDF…')}</div>}
        <canvas ref={canvasRef} onContextMenu={(e) => { if (!allowDownload) e.preventDefault(); }} style={{ maxWidth: '100%', borderRadius: 8, display: ready ? 'inline-block' : 'none' }} />
      </div>
      <div className="row between" style={{ alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← {L('Anterior', 'Prev')}</button>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>{L('Siguiente', 'Next')} →</button>
        </div>
        <span className="muted" style={{ fontSize: 12.5 }}>{L('Página', 'Page')} {page} / {pages || '…'}</span>
        {allowDownload
          ? <a className="sk-chip" href={url} target="_blank" rel="noreferrer">⤓ {L('Descargar', 'Download')}</a>
          : <span className="sk-chip muted" style={{ opacity: .8 }}>🔒 {L('Solo lectura', 'View only')}</span>}
      </div>
    </div>
  );
}

function ProfileView({ mentorId, userId, me, lang, onDm, onBack }: any) {
  const L = mkL(lang);
  const [p, setP] = useState<any>(null);
  function reloadP() { fetch(`/api/academy/profile?m=${mentorId}&u=${userId}`).then((r) => r.json()).then((j) => setP(j.profile)); }
  useEffect(() => { setP(null); reloadP(); }, [mentorId, userId]);
  const [editP, setEditP] = useState(false); const [nm, setNm] = useState('');
  async function toggleShare(on: boolean) { await fetch('/api/academy/profile', { method: 'POST', body: JSON.stringify({ share: on }) }); reloadP(); }
  async function saveCountry(code: string) { await fetch('/api/academy/profile', { method: 'POST', body: JSON.stringify({ country: code }) }); reloadP(); }
  async function saveAvatar(url: string) { await fetch('/api/academy/profile', { method: 'POST', body: JSON.stringify({ avatar_url: url || null }) }); reloadP(); }
  async function saveName() { const r = await fetch('/api/academy/profile', { method: 'POST', body: JSON.stringify({ display_name: nm, mentor_id: mentorId }) }); const j = await r.json().catch(() => ({})); if (j?.error === 'blocked') { alert(L('Ese nombre no cumple las normas.', 'That name does not meet the rules.')); return; } setEditP(false); reloadP(); }
  if (!p) return <div className="sk-card muted">…</div>;
  const v = p.verified || {};
  const isSelf = userId === me;
  const lv = p.level;
  // Mapa de actividad: últimas 18 semanas.
  const cells: { key: string; n: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startDow = (today.getDay() + 6) % 7; // lunes=0
  const daysBack = 17 * 7 + startDow;
  for (let i = daysBack; i >= 0; i--) { const dt = new Date(today.getTime() - i * 864e5); const key = dt.toISOString().slice(0, 10); cells.push({ key, n: p.activity?.[key] || 0 }); }
  const shade = (n: number) => n === 0 ? 'color-mix(in srgb,var(--mut) 18%,transparent)' : n === 1 ? 'color-mix(in srgb,var(--green) 40%,transparent)' : n <= 3 ? 'color-mix(in srgb,var(--green) 65%,transparent)' : 'var(--green)';
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={onBack}>← {L('Miembros', 'Members')}</button>
      <div className="sk-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={p.name} img={p.avatar_url} size={84} />
            <span className="sk-lvl" style={{ width: 26, height: 26, fontSize: 13, right: 0, bottom: 0 }}>{lv.level}</span>
          </div>
          <div><div style={{ fontWeight: 800, fontSize: 20 }}>{p.name}</div><div style={{ color: 'var(--brand)', fontWeight: 700 }}>{L('Nivel', 'Level')} {lv.level}</div></div>
          {lv.next != null && <div className="muted" style={{ fontSize: 13 }}>{lv.next - p.points} {L('puntos para subir', 'points to level up')}</div>}
          {userId !== me && <button className="btn btn-primary" onClick={() => onDm(userId)}><OnyxIcon name="chat" size={14} /> {L('Enviar mensaje', 'Message')}</button>}
          {isSelf && !editP && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { setNm(p.display_name || ''); setEditP(true); }}>✎ {L('Editar mi perfil', 'Edit my profile')}</button>}
        </div>
        <div className="row" style={{ gap: 16, margin: '16px 0 0', textAlign: 'center', justifyContent: 'center' }}>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>{p.contributions}</div><div className="muted" style={{ fontSize: 11 }}>{L('Contribuciones', 'Contributions')}</div></div>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>{p.points}</div><div className="muted" style={{ fontSize: 11 }}>{L('Puntos', 'Points')}</div></div>
        </div>
        {isSelf ? (
          <div style={{ marginTop: 14 }}>
            <span className="muted" style={{ fontSize: 12 }}>{L('Tu país', 'Your country')}</span>
            <select value={p.country || ''} onChange={(e) => saveCountry(e.target.value)} style={{ margin: '4px auto 0', display: 'block', maxWidth: 260 }}>
              <option value="">{L('— Elige tu país —', '— Choose your country —')}</option>
              {COUNTRIES.map((c) => <option key={c[0]} value={c[0]}>{flagOf(c[0])} {c[1]}</option>)}
            </select>
          </div>
        ) : (p.country && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{flagOf(p.country)} {countryName(p.country)}</div>)}
        {isSelf && editP && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14, textAlign: 'left', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>{L('Tu foto de perfil', 'Your profile photo')}</div>
            <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <Avatar name={p.name} img={p.avatar_url} size={52} />
              <div style={{ flex: 1 }}><ImageUpload value={p.avatar_url || ''} onChange={saveAvatar} L={L} /></div>
              {p.avatar_url && <button className="btn btn-ghost" style={{ fontSize: 11.5 }} onClick={() => saveAvatar('')}>{L('Quitar', 'Remove')}</button>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>{L('Tu nombre en esta academia', 'Your name in this academy')}</div>
            <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={p.name} style={{ margin: 0, width: '100%' }} maxLength={60} />
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={saveName}>{L('Guardar', 'Save')}</button>
              <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setEditP(false)}>{L('Cerrar', 'Close')}</button>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              {p.email ? <>{L('Tu correo:', 'Your email:')} <b>{p.email}</b><br /></> : null}
              {L('El correo y la contraseña se cambian en Ajustes de cuenta. Tu mentor puede ajustar tu nombre si incumple las normas.', 'Email and password are changed in Account settings. Your mentor may adjust your name if it breaks the rules.')}
            </p>
          </div>
        )}
      </div>
      {/* Trader verificado — track record real (opt-in, sin promesas) */}
      {(v.hasData || isSelf) && (
        <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--green) 35%,transparent)' }}>
          <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
            <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--green)', display: 'inline-flex' }}><OnyxIcon name="guardian" size={16} /></span> {L('Trader verificado', 'Verified trader')}</b>
            {v.hasData && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Verificado por Onyx', 'Verified by Onyx')}</span>}
          </div>
          {v.hasData ? (
            <>
              <div className="row" style={{ gap: 16, textAlign: 'center', justifyContent: 'space-around' }}>
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{v.winRate}%</div><div className="muted" style={{ fontSize: 11 }}>{L('Aciertos', 'Win rate')}</div></div>
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{v.profitFactor}</div><div className="muted" style={{ fontSize: 11 }}>{L('Profit factor', 'Profit factor')}</div></div>
                <div><div style={{ fontWeight: 800, fontSize: 18 }}>{v.trades}</div><div className="muted" style={{ fontSize: 11 }}>{L('Operaciones', 'Trades')}</div></div>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 10, textAlign: 'center' }}>{L(`Rendimiento histórico real de los últimos ${v.days} días. No es una promesa de resultados futuros.`, `Real historical performance over the last ${v.days} days. Not a promise of future results.`)}</div>
            </>
          ) : isSelf ? (
            <p className="muted" style={{ fontSize: 13 }}>{v.shared ? L('Aún no tienes suficientes operaciones registradas para mostrar tu track record.', 'You don’t have enough recorded trades yet to show your track record.') : L('Activa esto para mostrar tu track record real (aciertos, profit factor y nº de operaciones) en tu perfil de la comunidad.', 'Turn this on to show your real track record (win rate, profit factor and trades) on your community profile.')}</p>
          ) : null}
          {isSelf && (
            <label className="row" style={{ gap: 8, fontSize: 13, marginTop: 10 }}>
              <input type="checkbox" checked={!!v.shared} onChange={(e) => toggleShare(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
              {L('Mostrar mi track record verificado a la comunidad', 'Show my verified track record to the community')}
            </label>
          )}
        </div>
      )}

      {(p.certificates || []).length > 0 && (
        <div className="sk-card">
          <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Certificados', 'Certificates')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {p.certificates.map((cert: any) => (
              <a key={cert.code} href={'/certificado/' + cert.code} target="_blank" rel="noreferrer" className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}><OnyxIcon name="graduation" size={15} /> {cert.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>{new Date(cert.issued_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')} →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {(p.audits || []).length > 0 && (
        <div className="sk-card">
          <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Auditorías de tu mentor (IA)', 'Your mentor’s audits (AI)')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {p.audits.map((au: any, i: number) => (
              <div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{new Date(au.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')} · {au.period} {au.metrics ? `· ${au.metrics.winRate}% · PF ${au.metrics.profitFactor}` : ''}</div>
                <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{au.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sk-card">
        <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Actividad', 'Activity')}</div>
        <div className="sk-heat">{cells.map((c) => <i key={c.key} title={c.key} style={{ background: shade(c.n) }} />)}</div>
      </div>
    </div>
  );
}

function ChatView({ mentorId, lang, initialWith, members, myUserId, staffIds = [], iAmStaff = false, roles = {} }: any) {
  const L = mkL(lang);
  const [threads, setThreads] = useState<any[]>([]);
  const [withId, setWithId] = useState<string | null>(initialWith || null);
  const [conv, setConv] = useState<any>(null);
  const [text, setText] = useState('');
  const [img, setImg] = useState('');
  const [picking, setPicking] = useState(false);

  async function loadThreads() { const r = await fetch(`/api/academy/dm?m=${mentorId}`); const j = await r.json(); setThreads(j.threads || []); }
  async function loadConv(uid: string) { const r = await fetch(`/api/academy/dm?m=${mentorId}&with=${uid}`); const j = await r.json(); setConv(j); }
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { if (withId) loadConv(withId); }, [withId]);
  useEffect(() => { if (!withId) return; const t = setInterval(() => loadConv(withId), 5000); return () => clearInterval(t); }, [withId]);

  async function send() {
    if ((!text.trim() && !img) || !withId) return;
    await fetch('/api/academy/dm', { method: 'POST', body: JSON.stringify({ m: mentorId, to: withId, body: text, image_url: img }) });
    setText(''); setImg(''); loadConv(withId); loadThreads();
  }
  // Chat privado: un alumno solo puede escribir al equipo (mentor/colaboradores).
  // El equipo puede escribir a cualquiera.
  const staffSet = new Set(staffIds);
  const others = (members || []).filter((mem: any) => mem.user_id !== myUserId && (iAmStaff || staffSet.has(mem.user_id)));

  if (withId && conv) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 12 }} onClick={() => { setWithId(null); setConv(null); loadThreads(); }}>← {L('Mensajes', 'Messages')}</button>
        <div className="sk-card">
          <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}><Avatar name={conv.name} size={38} /><b>{conv.name}</b></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto', marginBottom: 12 }}>
            {(conv.messages || []).map((msg: any) => {
              const mine = msg.from_id === myUserId;
              return <div key={msg.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%', background: mine ? 'var(--brand)' : 'var(--bg2)', color: mine ? '#111726' : 'var(--tx)', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}>
                {msg.body}
                {msg.image_url && <a href={msg.image_url} target="_blank" rel="noreferrer"><img src={msg.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, marginTop: msg.body ? 6 : 0, display: 'block' }} /></a>}
              </div>;
            })}
            {(conv.messages || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('Escribe el primer mensaje.', 'Write the first message.')}</div>}
          </div>
          <ImgPreview url={img} onRemove={() => setImg('')} />
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <EmojiRow onPick={(e: string) => setText((v) => v + e)} />
            <ImgAttach onUrl={(u: string) => setImg(u)} L={L} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Mensaje…', 'Message…')} style={{ margin: 0, flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn btn-primary" onClick={send}>{L('Enviar', 'Send')}</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>{L('Mensajes', 'Messages')}</h3><button className="btn btn-primary" onClick={() => setPicking((v) => !v)}>＋ {L('Nuevo', 'New')}</button></div>
      {picking && (
        <div className="sk-card" style={{ marginBottom: 12 }}>
          <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Escribir a…', 'Message…')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
            {others.map((mem: any) => <button key={mem.user_id} className="row" style={{ gap: 10, alignItems: 'center', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '6px 4px' }} onClick={() => { setPicking(false); setWithId(mem.user_id); }}><Avatar name={mem.name} level={mem.level} size={32} /> {mem.name}</button>)}
          </div>
        </div>
      )}
      {threads.length === 0 && !picking && <div className="sk-card muted">{L('No tienes conversaciones. Toca «Nuevo» para escribir a un miembro.', 'No conversations yet. Tap “New” to message a member.')}</div>}
      {threads.map((t: any) => (
        <button key={t.user_id} className="sk-card" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', margin: '0 0 10px' }} onClick={() => setWithId(t.user_id)}>
          <Avatar name={t.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{t.name}</div><div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last}</div></div>
          {t.unread > 0 && <span className="sk-bdot" style={{ position: 'static' }}>{t.unread}</span>}
        </button>
      ))}
    </div>
  );
}

// Tipos de publicación de la comunidad (etiqueta + color).
const POST_TYPES: { key: string; es: string; en: string; icon: string; color: string }[] = [
  { key: 'community', es: 'Comunidad', en: 'Community', icon: 'chat', color: 'var(--mut)' },
  { key: 'analysis', es: 'Análisis de mercado', en: 'Market analysis', icon: 'bars', color: 'var(--brand)' },
  { key: 'habits', es: 'Hábitos', en: 'Habits', icon: 'plan', color: 'var(--green)' },
  { key: 'question', es: 'Pregunta general', en: 'General question', icon: 'ai', color: 'var(--gold)' },
  { key: 'win', es: 'Logro', en: 'Win', icon: 'trophy', color: 'var(--soft-green, var(--green))' },
];
const POST_WIN_TYPES: { key: string; es: string; en: string }[] = [
  { key: 'payout', es: 'Retiro / payout', en: 'Payout' },
  { key: 'challenge', es: 'Challenge pasado', en: 'Challenge passed' },
  { key: 'goal', es: 'Meta personal', en: 'Personal goal' },
];
function PostTag({ kind, winKind, L }: any) {
  if (!kind || kind === 'community') return null;
  const t = POST_TYPES.find((x) => x.key === kind); if (!t) return null;
  const wl = kind === 'win' && winKind ? (POST_WIN_TYPES.find((w) => w.key === winKind)) : null;
  return <span className="sk-chip" style={{ background: `color-mix(in srgb,${t.color} 16%,transparent)`, color: t.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><OnyxIcon name={t.icon as any} size={11} glow={false} /> {L(t.es, t.en)}{wl ? ' · ' + L(wl.es, wl.en) : ''}</span>;
}
// Selector de tipo de post (chips) + subtipo de logro. Reutilizable.
function PostTypePicker({ kind, setKind, winKind, setWinKind, L }: any) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {POST_TYPES.map((t) => (
          <button key={t.key} type="button" onClick={() => setKind(t.key)} className="sk-chip" style={{ cursor: 'pointer', border: kind === t.key ? `1px solid ${t.color}` : '1px solid var(--line)', background: kind === t.key ? `color-mix(in srgb,${t.color} 16%,transparent)` : 'var(--bg2)', color: kind === t.key ? t.color : 'var(--mut)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <OnyxIcon name={t.icon as any} size={12} glow={false} /> {L(t.es, t.en)}
          </button>
        ))}
      </div>
      {kind === 'win' && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
          <span className="muted" style={{ fontSize: 11.5, alignSelf: 'center' }}>{L('Tipo de logro:', 'Win type:')}</span>
          {POST_WIN_TYPES.map((w) => (
            <button key={w.key} type="button" onClick={() => setWinKind(w.key)} className="sk-chip" style={{ cursor: 'pointer', border: winKind === w.key ? '1px solid var(--green)' : '1px solid var(--line)', background: winKind === w.key ? 'color-mix(in srgb,var(--green) 16%,transparent)' : 'var(--bg2)', color: winKind === w.key ? 'var(--soft-green,var(--green))' : 'var(--mut)' }}>{L(w.es, w.en)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
function PostCard({ p, onLike, onComment, onProfile, onReport, onModDelete, onSelfDelete, onSelfEdit, canModerate, myUserId, L, es }: any) {
  const [c, setC] = useState(''); const [cImg, setCImg] = useState(''); const [openC, setOpenC] = useState(false);
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(p.body || '');
  const sendComment = () => { if (c.trim() || cImg) { onComment(p.id, c, cImg); setC(''); setCImg(''); setOpenC(true); } };
  const mine = p.author_id === myUserId;
  const pending = p.status === 'pending';
  async function saveEdit() { const ok = await onSelfEdit?.('post', p.id, draft); if (ok) setEditing(false); }
  function editComment(c2: any) { const nv = window.prompt(L('Edita tu comentario:', 'Edit your comment:'), c2.body || ''); if (nv != null && nv.trim() !== (c2.body || '')) onSelfEdit?.('comment', c2.id, nv); }
  return (
    <div className={'sk-card' + (p.announcement ? ' sk-ann' : '') + (pending ? ' sk-pending' : '')}>
      {p.announcement && <div className="sk-ann-tag"><OnyxIcon name="megaphone" size={13} glow={false} /> {L('Anuncio', 'Announcement')}</div>}
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <Avatar name={p.author_name} img={p.author_avatar} level={p.author_level} size={38} onClick={() => onProfile(p.author_id)} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} onClick={() => onProfile(p.author_id)}>{p.author_name} <PostTag kind={p.kind} winKind={p.win_kind} L={L} /></div><div className="muted" style={{ fontSize: 11.5 }}>{timeAgo(p.created_at, es)}</div></div>
        {pending && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{L('En revisión', 'In review')}</span>}
        {p.pinned && <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>📌 {L('fijado', 'pinned')}</span>}
        {mine && onSelfEdit && !editing && <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 12 }} title={L('Editar', 'Edit')} onClick={() => { setDraft(p.body || ''); setEditing(true); }}>✎</button>}
        {mine && onSelfDelete && <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 12, color: 'var(--red)' }} title={L('Borrar', 'Delete')} onClick={() => onSelfDelete('post', p.id)}>✕</button>}
        {canModerate && !mine && <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 12, color: 'var(--red)' }} title={L('Eliminar (moderación)', 'Delete (moderation)')} onClick={() => onModDelete('post', p.id)}>✕</button>}
        {!mine && !canModerate && onReport && <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 11.5, color: 'var(--mut)' }} title={L('Reportar', 'Report')} onClick={() => onReport('post', p.id)}><OnyxIcon name="flag" size={13} glow={false} /></button>}
      </div>
      {editing ? (
        <div style={{ marginBottom: 6 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} style={{ width: '100%', margin: 0 }} />
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveEdit} disabled={!draft.trim()}>{L('Guardar', 'Save')}</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>{L('Cancelar', 'Cancel')}</button>
          </div>
        </div>
      ) : (p.body && <div style={{ fontSize: 14.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{p.body} {p.edited_at && <span className="muted" style={{ fontSize: 11 }}>· {L('editado', 'edited')}</span>}</div>)}
      {p.image_url && <a href={p.image_url} target="_blank" rel="noreferrer"><img src={p.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 12, marginTop: 8, display: 'block' }} /></a>}
      <div className="sk-post-actions">
        <button className={'sk-like' + (p.liked ? ' on' : '')} onClick={() => onLike('post', p.id)}><OnyxIcon name="heart" size={15} glow={false} /> {p.likes || 0}</button>
        <button className="sk-like" onClick={() => setOpenC((v) => !v)}><OnyxIcon name="chat" size={15} glow={false} /> {(p.comments || []).length}</button>
      </div>
      {openC && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(p.comments || []).map((c2: any) => (
            <div key={c2.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Avatar name={c2.author_name} img={c2.author_avatar} level={c2.author_level} size={28} onClick={() => onProfile(c2.author_id)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}><b style={{ fontSize: 12.5 }}>{c2.author_name}</b> {c2.body} {c2.status === 'pending' && <span className="sk-chip" style={{ fontSize: 10.5, padding: '1px 6px', background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{L('En revisión', 'In review')}</span>}</div>
                {c2.image_url && <a href={c2.image_url} target="_blank" rel="noreferrer"><img src={c2.image_url} alt="" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, marginTop: 4, display: 'block' }} /></a>}
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <button className={'sk-like' + (c2.liked ? ' on' : '')} style={{ fontSize: 11.5, padding: '2px 4px' }} onClick={() => onLike('comment', c2.id)}><OnyxIcon name="heart" size={12} glow={false} /> {c2.likes || 0}</button>
                  {c2.author_id === myUserId && onSelfEdit && <button className="btn btn-ghost" style={{ fontSize: 10.5, padding: '1px 6px' }} onClick={() => editComment(c2)} title={L('Editar', 'Edit')}>✎</button>}
                  {c2.author_id === myUserId && onSelfDelete && <button className="btn btn-ghost" style={{ fontSize: 10.5, padding: '1px 6px', color: 'var(--red)' }} onClick={() => onSelfDelete('comment', c2.id)}>✕</button>}
                  {canModerate && c2.author_id !== myUserId && <button className="btn btn-ghost" style={{ fontSize: 10.5, padding: '1px 6px', color: 'var(--red)' }} onClick={() => onModDelete('comment', c2.id)}>✕</button>}
                  {c2.author_id !== myUserId && !canModerate && onReport && <button className="btn btn-ghost" style={{ fontSize: 10.5, padding: '1px 6px', color: 'var(--mut)' }} onClick={() => onReport('comment', c2.id)} title={L('Reportar', 'Report')}><OnyxIcon name="flag" size={11} glow={false} /></button>}
                </div>
              </div>
            </div>
          ))}
          <ImgPreview url={cImg} onRemove={() => setCImg('')} />
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <EmojiRow onPick={(e: string) => setC((v) => v + e)} />
            <ImgAttach onUrl={(u: string) => setCImg(u)} L={L} />
            <input value={c} onChange={(e) => setC(e.target.value)} placeholder={L('Comentar…', 'Comment…')} style={{ margin: 0, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }} />
            <button className="btn btn-ghost" onClick={sendComment}>{L('Enviar', 'Send')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== Moderación de la comunidad ===================
const MOD_LEVELS = [
  { key: 'off', es: 'Apagado', en: 'Off', desc_es: 'Solo se corta lo más grave.', desc_en: 'Only the worst is blocked.' },
  { key: 'relaxed', es: 'Relajado', en: 'Relaxed', desc_es: 'Bloquea lo grave, deja pasar lo leve.', desc_en: 'Blocks severe, lets mild through.' },
  { key: 'normal', es: 'Normal', en: 'Normal', desc_es: 'Recomendado. Grave se bloquea, dudoso a revisión.', desc_en: 'Recommended. Severe blocked, doubtful to review.' },
  { key: 'strict', es: 'Estricto', en: 'Strict', desc_es: 'Todo lo dudoso pasa por revisión.', desc_en: 'Anything doubtful goes to review.' },
];
function ModerationPanel({ mentorId, isOwner, L, lang, onClose, reload }: any) {
  const [tab, setTab] = useState<'queue' | 'settings'>('queue');
  const [data, setData] = useState<any>(null);
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const es = lang !== 'en';
  async function load() { const r = await fetch(`/api/academy/moderation?m=${mentorId}`); const j = await r.json(); setData(j); setS(j.settings); }
  useEffect(() => { load(); }, []);
  async function act(body: any) { await fetch('/api/academy/moderation', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, ...body }) }); await load(); reload?.(); }
  async function review(type: string, id: string, decision: string) { await act({ action: 'review', type, id, decision }); }
  async function saveSettings() { setSaving(true); await act({ action: 'settings', settings: { ...s, words: normList(s.words), allow: normList(s.allow) } }); setSaving(false); }
  function normList(v: any) { return typeof v === 'string' ? v.split(/[\n,]/).map((x: string) => x.trim()).filter(Boolean) : (v || []); }
  const pending = data?.pending || { posts: [], comments: [] };
  const reports = data?.reports || [];
  const nPending = (pending.posts?.length || 0) + (pending.comments?.length || 0);

  return (
    <Modal onClose={onClose}>
      <div className="sk-card" style={{ border: '1px solid var(--brand)', maxWidth: 640, width: '100%' }}>
        <div className="row between" style={{ marginBottom: 10, alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="shield" size={18} /></span> {L('Moderación', 'Moderation')}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="sk-seg" style={{ marginBottom: 12 }}>
          <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>{L('Cola', 'Queue')}{nPending + reports.length > 0 ? ` (${nPending + reports.length})` : ''}</button>
          {isOwner && <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>{L('Ajustes', 'Settings')}</button>}
        </div>

        {tab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            {nPending === 0 && reports.length === 0 && <div className="sk-card muted" style={{ margin: 0 }}>{L('Nada pendiente. Todo limpio ✨', 'Nothing pending. All clear ✨')}</div>}

            {reports.length > 0 && <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{L('Reportado por la comunidad', 'Reported by the community')}</div>}
            {reports.map((r: any) => (
              <div key={r.target_type + r.target_id} className="sk-card" style={{ margin: 0, padding: 10, border: '1px solid color-mix(in srgb,var(--red) 40%,transparent)' }}>
                <div className="row between" style={{ alignItems: 'center' }}>
                  <b style={{ fontSize: 12.5 }}><OnyxIcon name="flag" size={12} glow={false} /> {r.count}× {L('reporte', 'report')} · {r.target_type}</b>
                  <div className="row" style={{ gap: 6 }}>
                    {(r.target_type === 'post' || r.target_type === 'comment') && <>
                      <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px', color: 'var(--red)' }} onClick={() => review(r.target_type, r.target_id, 'delete')}>{L('Borrar', 'Delete')}</button>
                      <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px' }} onClick={() => review(r.target_type, r.target_id, 'hide')}>{L('Ocultar', 'Hide')}</button>
                    </>}
                    <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px' }} onClick={() => act({ action: 'dismiss_report', target_type: r.target_type, target_id: r.target_id })}>{L('Descartar', 'Dismiss')}</button>
                    {r.target_type === 'profile' && <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px', color: 'var(--red)' }} onClick={() => act({ action: 'ban', student_id: r.target_id })}>{L('Banear', 'Ban')}</button>}
                  </div>
                </div>
                {r.reasons?.length > 0 && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{r.reasons.slice(0, 3).join(' · ')}</div>}
              </div>
            ))}

            {nPending > 0 && <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{L('Marcado por el filtro — esperando aprobación', 'Flagged by the filter — awaiting approval')}</div>}
            {[...(pending.posts || []), ...(pending.comments || [])].map((it: any) => (
              <div key={it.type + it.id} className="sk-card" style={{ margin: 0, padding: 10, background: 'var(--bg2)' }}>
                <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5 }}><b>{it.author_name}</b> <span className="sk-chip" style={{ fontSize: 10.5, padding: '1px 6px' }}>{it.type === 'post' ? L('post', 'post') : L('comentario', 'comment')}</span> {it.flag_reason && <span className="muted" style={{ fontSize: 11 }}>· {flagLabel(it.flag_reason, L)}</span>}</div>
                    <div style={{ fontSize: 13, marginTop: 3, whiteSpace: 'pre-wrap' }}>{it.body}</div>
                    {it.image_url && <img src={it.image_url} alt="" style={{ maxWidth: 160, borderRadius: 8, marginTop: 6, display: 'block' }} />}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={() => review(it.type, it.id, 'approve')}>✓ {L('Aprobar', 'Approve')}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px', color: 'var(--red)' }} onClick={() => review(it.type, it.id, 'delete')}>{L('Borrar', 'Delete')}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px', color: 'var(--red)' }} onClick={() => act({ action: 'mute', student_id: it.author_id, hours: 24 })} title={L('Silenciar 24h', 'Mute 24h')}>{L('Silenciar', 'Mute')}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'settings' && s && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '62vh', overflowY: 'auto' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{L('¿Cuán estricta es tu comunidad?', 'How strict is your community?')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {MOD_LEVELS.map((lv) => (
                  <button key={lv.key} onClick={() => setS({ ...s, level: lv.key })} className="sk-card" style={{ margin: 0, padding: 10, textAlign: 'left', cursor: 'pointer', border: s.level === lv.key ? '2px solid var(--brand)' : '1px solid var(--line)', background: s.level === lv.key ? 'color-mix(in srgb,var(--brand) 10%,transparent)' : 'var(--bg2)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{L(lv.es, lv.en)}{lv.key === 'normal' && <span className="sk-chip" style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', background: 'color-mix(in srgb,var(--brand) 16%,transparent)', color: 'var(--brand)' }}>{L('por defecto', 'default')}</span>}</div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{L(lv.desc_es, lv.desc_en)}</div>
                  </button>
                ))}
              </div>
            </div>
            <label className="row between" style={{ alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: 13 }}><b>{L('Moderación con IA', 'AI moderation')}</b><div className="muted" style={{ fontSize: 11.5 }}>{L('Entiende el contexto y evita falsos positivos. Recomendado.', 'Understands context and avoids false positives. Recommended.')}</div></span>
              <input type="checkbox" checked={!!s.ai} onChange={(e) => setS({ ...s, ai: e.target.checked })} />
            </label>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{L('Palabras prohibidas (tuyas)', 'Blocked words (yours)')}</div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>{L('Una por línea o separadas por comas. Se suman a la lista base.', 'One per line or comma-separated. Added to the base list.')}</div>
              <textarea rows={3} value={Array.isArray(s.words) ? s.words.join('\n') : s.words} onChange={(e) => setS({ ...s, words: e.target.value })} style={{ width: '100%', margin: 0 }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{L('Palabras permitidas', 'Allowed words')}</div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>{L('Nunca marques estas (evita falsos positivos).', 'Never flag these (avoids false positives).')}</div>
              <textarea rows={2} value={Array.isArray(s.allow) ? s.allow.join('\n') : s.allow} onChange={(e) => setS({ ...s, allow: e.target.value })} style={{ width: '100%', margin: 0 }} />
            </div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12.5 }}>{L('Nuevos miembros a revisión (primeros N posts)', 'New members to review (first N posts)')}<br /><input type="number" min={0} max={20} value={s.new_member_review} onChange={(e) => setS({ ...s, new_member_review: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 90 }} /></label>
              <label style={{ fontSize: 12.5 }}>{L('Auto-ocultar con N reportes', 'Auto-hide after N reports')}<br /><input type="number" min={0} max={50} value={s.report_threshold} onChange={(e) => setS({ ...s, report_threshold: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 90 }} /></label>
            </div>
            <div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>{L('Enlaces en publicaciones', 'Links in posts')}</div>
              <select value={s.link_policy} onChange={(e) => setS({ ...s, link_policy: e.target.value })} style={{ margin: 0 }}>
                <option value="allow">{L('Permitir', 'Allow')}</option>
                <option value="review">{L('Enviar a revisión', 'Send to review')}</option>
                <option value="members">{L('Solo miembros con antigüedad', 'Established members only')}</option>
              </select>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <label className="row between" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ fontSize: 13 }}><b>{L('Sanciones automáticas', 'Automatic sanctions')}</b><div className="muted" style={{ fontSize: 11.5 }}>{L('Al acumular mensajes bloqueados, silencia o expulsa solo.', 'When blocked messages pile up, auto-mutes or removes.')}</div></span>
                <input type="checkbox" checked={!!s.auto_escalate} onChange={(e) => setS({ ...s, auto_escalate: e.target.checked })} />
              </label>
              {s.auto_escalate && (
                <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                  <label style={{ fontSize: 12.5 }}>{L('Silenciar tras N bloqueos', 'Mute after N blocks')}<br /><input type="number" min={0} max={20} value={s.mute_after} onChange={(e) => setS({ ...s, mute_after: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 80 }} /></label>
                  <label style={{ fontSize: 12.5 }}>{L('Duración del silencio (h)', 'Mute duration (h)')}<br /><input type="number" min={1} max={720} value={s.mute_hours} onChange={(e) => setS({ ...s, mute_hours: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 80 }} /></label>
                  <label style={{ fontSize: 12.5 }}>{L('Banear tras N bloqueos (0 = nunca)', 'Ban after N blocks (0 = never)')}<br /><input type="number" min={0} max={50} value={s.ban_after} onChange={(e) => setS({ ...s, ban_after: Number(e.target.value) })} style={{ margin: '4px 0 0', width: 80 }} /></label>
                </div>
              )}
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Se cuenta por los últimos 30 días. El equipo siempre puede revertir un silencio o readmitir.', 'Counted over the last 30 days. The team can always undo a mute or readmit.')}</p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>{saving ? '…' : L('Guardar ajustes', 'Save settings')}</button>
              <button className="btn btn-ghost" onClick={onClose}>{L('Cerrar', 'Close')}</button>
            </div>
            <p className="muted" style={{ fontSize: 11 }}>{L('Las imágenes ya se revisan con IA al subirlas (contenido sexual/indebido se bloquea).', 'Images are already screened by AI on upload (sexual/inappropriate content is blocked).')}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
function escalMsg(escalated: string | null | undefined, L: any): string {
  if (escalated === 'mute') return '\n\n' + L('Por acumular avisos, quedas silenciado temporalmente.', 'For repeated flags, you are temporarily muted.');
  if (escalated === 'ban') return '\n\n' + L('Por incumplir las normas repetidamente, se te ha retirado el acceso a la comunidad.', 'For repeatedly breaking the rules, your community access has been removed.');
  return '';
}
function flagLabel(reason: string, L: any): string {
  const r = String(reason || '');
  if (r.startsWith('word:')) return L('palabra marcada', 'flagged word');
  if (r.startsWith('ai:')) return L('IA: contenido dudoso', 'AI: doubtful content');
  if (r.startsWith('strict:')) return L('modo estricto', 'strict mode');
  if (r.includes('spam') || r.includes('link')) return L('posible spam', 'possible spam');
  if (r === 'new_member') return L('miembro nuevo', 'new member');
  if (r === 'reports') return L('reportado', 'reported');
  return r;
}

// =================== Muro de Logros ===================
const WIN_KINDS: Record<string, { es: string; en: string; color: string; icon: string }> = {
  payout: { es: 'Retiro', en: 'Payout', color: '#1D9E75', icon: 'money' },
  challenge: { es: 'Reto superado', en: 'Challenge passed', color: '#7F77DD', icon: 'trophy' },
  certificate: { es: 'Certificado', en: 'Certificate', color: '#EF9F27', icon: 'graduation' },
  goal: { es: 'Meta', en: 'Goal', color: '#378ADD', icon: 'star' },
};
function winMoney(cents: number, cur: string) {
  if (!cents) return '';
  const c = (cur || 'usd').toUpperCase(); const sym = c === 'USD' ? '$' : c === 'EUR' ? '€' : '';
  const amt = Math.round(cents / 100).toLocaleString();
  return sym ? sym + amt : amt + ' ' + c;
}
function WinsWall({ active, lang, reload, L }: any) {
  const mentorId = active.mentor_id;
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const isMentor = !!active.isMentorHere;
  const canModerate = !!(active.isMentorHere || active.myPerms?.wins); // dueño o colaborador que aprueba logros
  const minePending = (active.winsMinePending || []) as any[];

  async function loadPending() { if (!canModerate) return; const r = await fetch(`/api/academy/wins?m=${mentorId}&pending=1`); const j = await r.json(); setPending(j.pending || []); }
  useEffect(() => { loadPending(); }, []);

  async function submit() {
    if (busy) return; setBusy(true);
    const body: any = { action: 'add', mentor_id: mentorId, kind: form.kind, title: form.title, prop_firm: form.prop_firm, image_url: form.image_url, currency: form.currency || 'usd' };
    if (form.amount) body.amount_cents = Math.round(Number(form.amount) * 100);
    await fetch('/api/academy/wins', { method: 'POST', body: JSON.stringify(body) });
    setBusy(false); setForm(null);
    alert(L('¡Enviado! Tu logro aparecerá cuando tu mentor lo apruebe.', 'Sent! Your win will show once your mentor approves it.'));
  }
  async function like(id: string) { await fetch('/api/academy/wins', { method: 'POST', body: JSON.stringify({ action: 'like', mentor_id: mentorId, win_id: id }) }); reload(); }
  async function review(id: string, decision: string, verified = false) { await fetch('/api/academy/wins', { method: 'POST', body: JSON.stringify({ action: 'review', mentor_id: mentorId, win_id: id, decision, verified }) }); loadPending(); reload(); }
  async function delWin(id: string) { if (!await confirmDelete({ title: L('¿Quitar logro?', 'Remove win?'), message: L('Se quitará del muro de logros.', 'It will be removed from the wins wall.') })) return; await fetch('/api/academy/wins', { method: 'POST', body: JSON.stringify({ action: 'delete', mentor_id: mentorId, win_id: id }) }); reload(); }

  const wins = (active.wins || []).filter((w: any) => filter === 'all' || w.kind === filter);
  return (
    <div>
      <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--gold)', display: 'inline-flex' }}><OnyxIcon name="trophy" size={18} /></span> {L('Muro de logros', 'Wins wall')}</h3>
        <button className="btn btn-primary" onClick={() => setForm({ kind: 'payout', title: '', amount: '', currency: 'usd', prop_firm: '', image_url: '' })}>＋ {L('Subir mi logro', 'Share my win')}</button>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center', padding: '8px 11px', borderRadius: 8, background: 'color-mix(in srgb,var(--gold) 10%,transparent)', marginBottom: 12 }}>
        <OnyxIcon name="guardian" size={14} /><span style={{ fontSize: 12, color: 'var(--soft-gold, var(--gold))' }}>{L('Logros reales de miembros. No son promesa de resultados.', 'Real member wins. Not a promise of results.')}</span>
      </div>

      <div className="sk-seg" style={{ marginBottom: 12 }}>
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{L('Todos', 'All')}</button>
        {Object.keys(WIN_KINDS).map((k) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{L(WIN_KINDS[k].es, WIN_KINDS[k].en)}</button>)}
      </div>

      {!canModerate && minePending.length > 0 && (
        <div className="sk-card" style={{ border: '1px dashed color-mix(in srgb,var(--gold) 45%,transparent)', marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 8 }}><b style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="calendar" size={14} /> {L('Esperando aprobación de la academia', 'Waiting for academy approval')}</b><span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{minePending.length}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {minePending.map((w: any) => (
              <div key={w.id} className="row" style={{ gap: 10, alignItems: 'center', background: 'var(--bg2)', borderRadius: 8, padding: 8 }}>
                {w.image_url ? <img src={w.image_url} alt="" style={{ width: 46, height: 46, borderRadius: 6, objectFit: 'cover', flex: 'none' }} /> : <span style={{ width: 46, height: 46, borderRadius: 6, background: 'var(--card2)', display: 'grid', placeItems: 'center', flex: 'none', color: WIN_KINDS[w.kind]?.color }}><OnyxIcon name={(WIN_KINDS[w.kind]?.icon as any) || 'trophy'} size={20} /></span>}
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}><b>{L(WIN_KINDS[w.kind]?.es, WIN_KINDS[w.kind]?.en)}</b>{w.amount_cents ? ' · ' + winMoney(w.amount_cents, w.currency) : ''}<div className="muted" style={{ fontSize: 11.5 }}>{w.title || ''}{w.prop_firm ? ' · ' + w.prop_firm : ''}</div></div>
                {w.status === 'rejected'
                  ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--red) 16%,transparent)', color: 'var(--red)' }}>{L('No aprobado', 'Not approved')}</span>
                  : <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{L('En revisión', 'In review')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {canModerate && pending.length > 0 && (
        <div className="sk-card" style={{ border: '1px dashed color-mix(in srgb,var(--gold) 45%,transparent)', marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 8 }}><b style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="calendar" size={14} /> {L('Por aprobar', 'To approve')}</b><span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{pending.length}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((w: any) => (
              <div key={w.id} className="row" style={{ gap: 10, alignItems: 'center', background: 'var(--bg2)', borderRadius: 8, padding: 8 }}>
                {w.image_url ? <img src={w.image_url} alt="" style={{ width: 46, height: 46, borderRadius: 6, objectFit: 'cover', flex: 'none' }} /> : <span style={{ width: 46, height: 46, borderRadius: 6, background: 'var(--card2)', display: 'grid', placeItems: 'center', flex: 'none', color: WIN_KINDS[w.kind]?.color }}><OnyxIcon name={(WIN_KINDS[w.kind]?.icon as any) || 'trophy'} size={20} /></span>}
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}><b>{w.author_name}</b> · {L(WIN_KINDS[w.kind]?.es, WIN_KINDS[w.kind]?.en)}{w.amount_cents ? ' · ' + winMoney(w.amount_cents, w.currency) : ''}<div className="muted" style={{ fontSize: 11.5 }}>{w.title || ''}{w.prop_firm ? ' · ' + w.prop_firm : ''}</div></div>
                <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 9px', color: 'var(--soft-green)' }} onClick={() => review(w.id, 'approve', true)} title={L('Aprobar y verificar', 'Approve & verify')}>✓✓</button>
                <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 9px', color: 'var(--soft-green)' }} onClick={() => review(w.id, 'approve', false)}>✓</button>
                <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px', color: 'var(--red)' }} onClick={() => review(w.id, 'reject')}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {wins.length === 0 ? <div className="sk-card muted">{L('Aún no hay logros publicados. ¡Sé el primero en compartir el tuyo!', 'No wins yet. Be the first to share yours!')}</div> : (
        <div className="sk-grid-courses">
          {wins.map((w: any) => (
            <div key={w.id} className="sk-card" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 130, position: 'relative', background: `color-mix(in srgb,${WIN_KINDS[w.kind]?.color} 16%, var(--bg2))`, display: 'grid', placeItems: 'center' }}>
                {w.image_url ? <img src={w.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: WIN_KINDS[w.kind]?.color }}><OnyxIcon name={(WIN_KINDS[w.kind]?.icon as any) || 'trophy'} size={34} /></span>}
                <span className="sk-chip" style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,.55)', color: WIN_KINDS[w.kind]?.color }}>{L(WIN_KINDS[w.kind]?.es, WIN_KINDS[w.kind]?.en)}</span>
                {w.verified && <span className="sk-chip" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.55)', color: 'var(--gold)' }}>✓ {L('Verificado', 'Verified')}</span>}
              </div>
              <div style={{ padding: '10px 12px' }}>
                {w.amount_cents ? <div style={{ fontSize: 18, fontWeight: 800 }}>{winMoney(w.amount_cents, w.currency)} {w.kind === 'payout' && <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{L('retiro', 'payout')}</span>}</div> : <div style={{ fontSize: 15, fontWeight: 700 }}>{w.title || L(WIN_KINDS[w.kind]?.es, WIN_KINDS[w.kind]?.en)}</div>}
                {(w.title && w.amount_cents) ? <div className="muted" style={{ fontSize: 12 }}>{w.title}</div> : null}
                {w.prop_firm && <div className="muted" style={{ fontSize: 12 }}>{w.prop_firm}</div>}
                <div className="row between" style={{ alignItems: 'center', marginTop: 9 }}>
                  <div className="row" style={{ gap: 7, alignItems: 'center', minWidth: 0 }}><Avatar name={w.author_name} size={22} /><span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.author_name}</span></div>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <button className={'sk-like' + (w.liked ? ' on' : '')} onClick={() => like(w.id)} style={{ fontSize: 12 }}><OnyxIcon name="heart" size={13} glow={false} /> {w.likes || 0}</button>
                    {canModerate && <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--red)' }} onClick={() => delWin(w.id)}>✕</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal onClose={() => setForm(null)}>
          <div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
            <h3 style={{ marginBottom: 12 }}>{L('Sube tu logro', 'Share your win')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ margin: 0 }}>
                {Object.keys(WIN_KINDS).map((k) => <option key={k} value={k}>{L(WIN_KINDS[k].es, WIN_KINDS[k].en)}</option>)}
              </select>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={L('Título (ej: Primer retiro, Fase 2 aprobada)', 'Title (e.g. First payout, Phase 2 passed)')} style={{ margin: 0 }} />
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={L('Monto (opcional)', 'Amount (optional)')} style={{ margin: 0, width: 150 }} />
                <span className="sk-chip">USD</span>
              </div>
              <input value={form.prop_firm} onChange={(e) => setForm({ ...form, prop_firm: e.target.value })} placeholder={L('Prop firm / bróker (opcional)', 'Prop firm / broker (optional)')} style={{ margin: 0 }} />
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{L('Prueba (captura o certificado)', 'Proof (screenshot or certificate)')}</span>
                <ImageUpload value={form.image_url} onChange={(v: string) => setForm({ ...form, image_url: v })} L={L} />
              </div>
              <p className="muted" style={{ fontSize: 11.5 }}>{L('Tu mentor revisará y aprobará tu logro antes de publicarlo.', 'Your mentor reviews and approves your win before it goes public.')}</p>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={submit} disabled={busy || (!form.title && !form.image_url)}>{busy ? '…' : L('Enviar', 'Send')}</button>
              <button className="btn btn-ghost" onClick={() => setForm(null)}>{L('Cancelar', 'Cancel')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Resumen semanal AI de la comunidad (mentor).
function MentorDigest({ L }: any) {
  const [d, setD] = useState<any>(null); const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  async function run() { setBusy(true); setOpen(true); const r = await fetch('/api/academy/digest'); const j = await r.json(); setBusy(false); setD(j); }
  const s = d?.stats;
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)' }}>
      <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <b style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="ai" size={16} /></span> {L('Resumen de la semana (AI)', 'Weekly summary (AI)')}</b>
        <button className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={busy} onClick={run}>{busy ? '…' : (d ? '✨ ' + L('Actualizar', 'Refresh') : '✨ ' + L('Generar', 'Generate'))}</button>
      </div>
      {open && s && (
        <div className="row" style={{ gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
          {[[L('Nuevos', 'New'), s.newMembers], [L('Activos', 'Active'), s.activeMembers], [L('Posts', 'Posts'), s.posts], [L('Logros', 'Wins'), s.winsApproved]].map(([lbl, v]: any) => (
            <span key={lbl} className="sk-chip" style={{ background: 'var(--bg2)' }}>{lbl}: <b style={{ marginLeft: 4 }}>{v}</b></span>
          ))}
        </div>
      )}
      {open && (d?.text ? <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 6 }}>{d.text}</div>
        : d && !d.text ? <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{L('Activa ANTHROPIC_API_KEY en Vercel para el resumen AI. Arriba tienes las métricas.', 'Enable ANTHROPIC_API_KEY in Vercel for the AI summary. Metrics are shown above.')}</p> : null)}
    </div>
  );
}

// Asistente AI del alumno (responde con la guía del mentor).
function AssistantCard({ mentorId, L }: any) {
  const [q, setQ] = useState(''); const [a, setA] = useState(''); const [busy, setBusy] = useState(false);
  async function ask() {
    if (!q.trim() || busy) return; setBusy(true); setA('');
    const r = await fetch('/api/academy/assistant', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, question: q }) });
    const j = await r.json(); setBusy(false);
    setA(j.ok ? j.text : (j.error === 'assistant_off' ? L('El asistente no está disponible ahora.', 'The assistant is not available right now.') : L('No se pudo responder. Intenta de nuevo.', 'Could not answer. Try again.')));
  }
  return (
    <div className="sk-side-card" style={{ border: '1px solid color-mix(in srgb,var(--brand) 32%,transparent)' }}>
      <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 14 }}>{L('Asistente AI', 'AI assistant')}</b><OnyxIcon name="ai" size={15} /></div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Pregunta sobre la academia; responde con la guía de tu mentor.', 'Ask about the academy; it answers from your mentor’s guide.')}</p>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} placeholder={L('Ej: ¿A qué hora es la clase en vivo?', 'e.g. What time is the live class?')} style={{ width: '100%', margin: 0 }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} />
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={busy || !q.trim()} onClick={ask}>{busy ? '…' : L('Preguntar', 'Ask')}</button>
      {a && <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>{a}</div>}
    </div>
  );
}

// Estrellas clicables / de solo lectura.
function Stars({ value, onPick, size = 18 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={onPick ? () => onPick(n) : undefined} style={{ cursor: onPick ? 'pointer' : 'default', color: n <= value ? 'var(--gold)' : 'var(--line)', fontSize: size, lineHeight: 1 }}>★</span>
      ))}
    </span>
  );
}

// Tarjeta de reseña del alumno (deja/actualiza; el mentor la aprueba).
function ReviewCard({ mentorId, L }: any) {
  const [mine, setMine] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    fetch('/api/academy/reviews?m=' + mentorId).then((r) => r.json()).then((j) => {
      if (j.mine) { setMine(j.mine); setRating(j.mine.rating || 5); setBody(j.mine.body || ''); }
    }).catch(() => {});
  }, [mentorId]);
  async function submit() {
    if (busy) return; setBusy(true);
    await fetch('/api/academy/reviews', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, rating, body }) });
    setBusy(false); setSent(true); setMine({ rating, body, status: 'pending' });
  }
  const status = mine?.status;
  return (
    <div className="sk-side-card" style={{ border: '1px solid color-mix(in srgb,var(--gold) 28%,transparent)' }}>
      <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 14 }}>{L('Tu reseña', 'Your review')}</b><OnyxIcon name="trophy" size={15} /></div>
      {status === 'approved'
        ? <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('¡Publicada! Gracias por tu reseña.', 'Published! Thanks for your review.')}</p>
        : status === 'pending' || sent
          ? <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Enviada. Tu mentor la revisará antes de publicarla.', 'Submitted. Your mentor will review it before publishing.')}</p>
          : <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Cuéntale a otros cómo te ha ido en la comunidad.', 'Tell others how the community worked for you.')}</p>}
      <Stars value={rating} onPick={setRating} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={L('Escribe tu reseña (opcional)', 'Write your review (optional)')} style={{ width: '100%', margin: '8px 0 0' }} />
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={submit}>{busy ? '…' : mine ? L('Actualizar reseña', 'Update review') : L('Enviar reseña', 'Send review')}</button>
    </div>
  );
}

// Cola de reseñas para el mentor (aprobar / rechazar).
function MentorReviews({ mentorId, L }: any) {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  function reload() { setLoading(true); fetch(`/api/academy/reviews?m=${mentorId}&pending=1`).then((r) => r.json()).then((j) => { setPending(j.pending || []); setLoading(false); }).catch(() => setLoading(false)); }
  useEffect(reload, [mentorId]);
  async function decide(id: string, approve: boolean) {
    await fetch('/api/academy/reviews', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, action: 'decide', id, approve }) });
    reload();
  }
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ display: 'flex', alignItems: 'center', gap: 9, margin: 0 }}><span className="card-ic"><OnyxIcon name="trophy" size={16} /></span> {L('Reseñas por aprobar', 'Reviews to approve')}</h3></div>
      {loading && <div className="muted" style={{ fontSize: 13 }}>…</div>}
      {!loading && pending.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('No hay reseñas pendientes. Las reseñas aprobadas salen en tu landing.', 'No pending reviews. Approved reviews show on your landing page.')}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map((r: any) => (
          <div key={r.id} className="sk-card" style={{ margin: 0 }}>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}><b style={{ fontSize: 13.5 }}>{r.name}</b><Stars value={r.rating} size={15} /></div>
            {r.body && <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{r.body}</p>}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => decide(r.id, true)}>{L('Aprobar', 'Approve')}</button>
              <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => decide(r.id, false)}>{L('Rechazar', 'Reject')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({ mentorId, initial, L }: any) {
  const [range, setRange] = useState<'7d' | '30d' | 'all' | 'traders'>('all');
  const [rows, setRows] = useState<any[]>(initial); const [loading, setLoading] = useState(false);
  async function pick(r: '7d' | '30d' | 'all' | 'traders') {
    setRange(r); setLoading(true);
    const res = await fetch(`/api/academy?m=${mentorId}&board=${r}`); const j = await res.json();
    setRows(r === 'traders' ? (j.traders || []) : (j.leaderboard || [])); setLoading(false);
  }
  const isTraders = range === 'traders';
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <b style={{ fontSize: 15 }}>{isTraders ? L('Traders verificados', 'Verified traders') : L('Ranking de la comunidad', 'Community leaderboard')}</b>
        <div className="sk-seg">
          {(['7d', '30d', 'all'] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => pick(r)}>{r === 'all' ? L('Total', 'All-time') : r}</button>)}
          <button className={isTraders ? 'on' : ''} onClick={() => pick('traders')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><OnyxIcon name="guardian" size={12} glow={false} /> {L('Traders', 'Traders')}</button>
        </div>
      </div>
      {loading && <div className="muted" style={{ fontSize: 13 }}>…</div>}
      {!loading && rows.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{isTraders ? L('Aún no hay traders que compartan su track record verificado.', 'No traders sharing a verified track record yet.') : L('Todavía nadie ha sumado puntos en este periodo.', 'Nobody has earned points in this period yet.')}</div>}
      {!loading && !isTraders && rows.map((r: any) => (
        <div key={r.user_id} className="sk-board-row" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)', fontSize: 15 } : undefined}>{r.rank}</span>
          <Avatar name={r.name} level={r.level} size={34} />
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
          <b>{r.points} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{L('pts', 'pts')}</span></b>
        </div>
      ))}
      {!loading && isTraders && rows.map((r: any) => (
        <div key={r.user_id} className="sk-board-row" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="sk-rank" style={r.rank <= 3 ? { color: 'var(--gold)', fontSize: 15 } : undefined}>{r.rank}</span>
          <Avatar name={r.name} size={34} />
          <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
          <span className="muted" style={{ fontSize: 12.5 }}>{r.winRate}% · PF {r.profitFactor} · {r.trades} ops</span>
        </div>
      ))}
      {!loading && isTraders && rows.length > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>{L('Rendimiento histórico real (90 días). No es promesa de resultados.', 'Real historical performance (90 days). Not a promise of results.')}</div>}
    </div>
  );
}

function priceLabel(p: any, L: (a: string, b: string) => string) {
  const amount = (p.price_cents / 100).toLocaleString(undefined, { minimumFractionDigits: p.price_cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const cur = (p.currency || 'usd').toUpperCase(); const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';
  const base = sym ? sym + amount : amount + ' ' + cur;
  if (p.kind === 'one_time') return base + ' · ' + L('pago único', 'one-time');
  if (p.kind === 'audit') return base + '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo')) + ' · ' + L('add-on', 'add-on');
  return base + '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo'));
}

function Tiers({ products, purchases, onBuy, L }: any) {
  const ownedIds = new Set((purchases || []).map((x: any) => x.product_id));
  return (
    <div className="sk-card" style={{ border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)', marginBottom: 12 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><span style={{ color: 'var(--gold)', display: 'inline-flex' }}><OnyxIcon name="gem" size={18} /></span> {L('Desbloquea más con estos niveles', 'Unlock more with these tiers')}</h3>
      <div className="sk-grid-courses">
        {products.map((p: any) => {
          const owned = ownedIds.has(p.id);
          return (
            <div key={p.id} className={'sk-card sk-tier-card' + (p.kind === 'audit' ? ' sk-featured' : '')} style={{ margin: 0, background: 'var(--bg2)', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              {p.description && <div className="muted" style={{ fontSize: 12.5, margin: '4px 0 8px' }}>{p.description}</div>}
              <div className="sk-price" style={{ margin: '8px 0' }}>{priceLabel(p, L)}</div>
              {p.kind === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ {L('Tu mentor audita tu trading real', 'Your mentor audits your real trading')}</span>
                  <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ {L('Reporte AI + verificación de tu plan', 'AI report + plan verification')}</span>
                </div>
              )}
              {p.perks?.guardian && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ Onyx Guardian</span>
                </div>
              )}
              {owned ? <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Ya lo tienes', 'You have it')}</span>
                : <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onBuy(p.id)}>{L('Desbloquear', 'Unlock')}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== Panel del mentor ===================
function MentorPanel({ lang, onClose, openStudent }: { lang: string; onClose: () => void; openStudent: (mid: string) => void }) {
  const L = mkL(lang);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'cursos' | 'envivo' | 'cobros' | 'becas' | 'alumnos' | 'auditoria' | 'retencion' | 'comunidad' | 'correos' | 'ajustes'>('cursos');
  const [newMod, setNewMod] = useState('');
  const [lessonForm, setLessonForm] = useState<any>(null);
  const [modForm, setModForm] = useState<any>(null);
  const [evForm, setEvForm] = useState<any>(null);
  const [evRange, setEvRange] = useState(() => { const f = new Date(); f.setHours(0, 0, 0, 0); const t = new Date(f.getTime() + 7 * 86400000); const p = (n: number) => (n < 10 ? '0' + n : '' + n); const fd = (d: Date) => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); return { from: fd(f), to: fd(t) }; });
  const [post, setPost] = useState('');
  const [postImg, setPostImg] = useState('');
  const [postWhen, setPostWhen] = useState('');
  const [postKind, setPostKind] = useState('community');
  const [postWinKind, setPostWinKind] = useState('payout');
  const [postAnn, setPostAnn] = useState(false);
  const [studentQ, setStudentQ] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [tourKey, setTourKey] = useState<string | null>(null);
  const [tourDone, setTourDone] = useState(false);
  const startTour = (key: string) => { const s = TOUR_STEPS.find((x) => x.key === key); if (s) { setTab(s.tab as any); setTourKey(key); } };

  async function load() { const r = await fetch('/api/academy/mentor'); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  async function api(body: any, done?: string) { await fetch('/api/academy/mentor', { method: 'POST', body: JSON.stringify(body) }); if (done) { setToast(done); setTimeout(() => setToast(''), 2200); } load(); }

  if (!d) return <div className="card muted">…</div>;
  if (d.error) return <div className="sk-card"><b>{L('Academia no disponible en tu plan', 'Academy not on your plan')}</b><p className="muted" style={{ marginTop: 6 }}>{L('El módulo Mentor está en el plan Mentor o como add-on.', 'The Mentor module is on the Mentor plan or as an add-on.')}</p></div>;

  const link = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/academy?join=${d.mentor.code}` : '';

  return (
    <div className="sk-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      <ConfirmHost lang={lang} />
      {toast && <Toast msg={toast} />}
      <GuidedTour stepKey={tourKey} o={d.onboarding || {}} L={L} academyName={d.mentor?.academy_name} onGoto={startTour} onFinish={() => { setTourKey(null); setTourDone(true); }} onClose={() => setTourKey(null)} />
      {tourDone && (
        <div className="sk-modal-ov" onClick={() => setTourDone(false)}>
          <div className="sk-modal sk-confirm" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="sk-confirm-ic" style={{ color: 'var(--brand)', background: 'color-mix(in srgb,var(--brand) 16%,transparent)', boxShadow: '0 0 16px -3px color-mix(in srgb,var(--brand) 60%,transparent)', width: 48, height: 48, margin: '0 auto' }}><OnyxIcon name="trophy" size={26} /></div>
            <h3 style={{ margin: '10px 0 6px' }}>{L('¡Felicidades! 🎉', 'Congrats! 🎉')}</h3>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{L('Terminaste de configurar tu academia. Ya está lista para recibir alumnos y empezar a vender.', 'You’ve finished setting up your academy. It’s ready to welcome students and start selling.')}</p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setTourDone(false); api({ action: 'onboarding_dismiss', on: true }); }}>{L('¡Vamos!', 'Let’s go!')}</button>
          </div>
        </div>
      )}
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div><h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={22} /></span> {d.mentor.academy_name}</h2><div className="muted" style={{ fontSize: 13 }}>{L('Panel del mentor · Onyx Academy', 'Mentor panel · Onyx Academy')}</div></div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-primary" onClick={() => openStudent(d.mentor.user_id)}>{L('Ver mi comunidad', 'View my community')}</button>
          <button className="btn btn-ghost" onClick={onClose}>← {L('Salir', 'Exit')}</button>
        </div>
      </div>

      {/* Onboarding del mentor: única lista de configuración con progreso.
          Layout de dos columnas: el checklist queda a la izquierda (columna estrecha)
          y todo lo demás (enlace, pestañas y contenido) sube al tope a la derecha. */}
      <div className="sk-academy-3col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,208px) minmax(0,1fr) minmax(0,300px)', gap: 16, alignItems: 'start' }}>
        {/* Opción D · navegación vertical (escritorio/tablet) + selector nativo en móvil (como Mi cuenta) */}
        {(() => {
          const mentorTabs = [['cursos', 'graduation', L('Aulas', 'Classroom')], ['envivo', 'calendar', L('En vivo', 'Live')], ['cobros', 'coins', L('Cobros', 'Payments')], ['becas', 'gift', L('Becas', 'Scholarships')], ['alumnos', 'users', L('Alumnos', 'Students')], ['auditoria', 'guardian', L('Auditoría', 'Audit')], ['retencion', 'trophy', L('Retención', 'Retention')], ['comunidad', 'chat', L('Comunidad', 'Community')], ['correos', 'mail', L('Correos', 'Emails')], ['ajustes', 'settings', L('Ajustes', 'Settings')]] as any[];
          return (
            <div style={{ minWidth: 0 }}>
              <select className="sk-nav-mobile" value={tab} onChange={(e) => setTab(e.target.value as any)} style={{ width: '100%', margin: 0 }}>
                {mentorTabs.map(([k, , lbl]) => <option key={k} value={k}>{lbl}</option>)}
              </select>
              <nav className="sk-vnav">
                {mentorTabs.map(([k, ic, lbl]) => (
                  <button key={k} className={'sk-vitem' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><OnyxIcon name={ic} size={16} /> <span>{lbl}</span></button>
                ))}
              </nav>
            </div>
          );
        })()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

      <div className="sk-card">
        <div className="muted" style={{ fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="key" size={14} glow={false} /></span> {L('Enlace de inscripción (compártelo con tus alumnos)', 'Enrollment link (share with your students)')}</div>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input readOnly value={link} style={{ margin: 0, flex: 1, minWidth: 160 }} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn sk-glow" onClick={() => { navigator.clipboard.writeText(link); setToast(L('Enlace copiado', 'Link copied')); setTimeout(() => setToast(''), 1500); }}><OnyxIcon name="card" size={14} glow={false} /> {L('Copiar', 'Copy')}</button>
              <button className="sk-code" onClick={() => { navigator.clipboard.writeText(d.mentor.code); setToast(L('Código copiado', 'Code copied')); setTimeout(() => setToast(''), 1500); }} style={{ border: 'none', cursor: 'pointer' }}>{d.mentor.code}</button>
            </div>
            <div className="muted" style={{ fontSize: 12, margin: '12px 0 8px' }}>{L('Compártelo por:', 'Share it via:')}</div>
            <ShareRow link={link} message={L(`Únete a mi academia de trading en Onyx: ${d.mentor.academy_name}`, `Join my trading academy on Onyx: ${d.mentor.academy_name}`)} L={L} />
            <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>{L('O que escaneen este QR para unirse:', 'Or have them scan this QR to join:')}</div>
          </div>
          <JoinQR url={link} size={150} actions L={L} />
        </div>
      </div>

      {tab === 'cursos' && (<>
        <div className="sk-card" data-onb="classroom">
          <div className="row" style={{ gap: 8 }}>
            <input value={newMod} onChange={(e) => setNewMod(e.target.value)} placeholder={L('Nombre del nuevo curso/aula', 'New course/classroom name')} style={{ margin: 0, flex: 1 }} />
            <button className="btn btn-primary" onClick={() => { if (newMod.trim()) { api({ action: 'module', title: newMod, position: (d.content?.length || 0) }, L('Aula creada', 'Classroom created')); setNewMod(''); } }}>＋ {L('Aula', 'Classroom')}</button>
          </div>
          <div className="row" style={{ marginTop: 8, alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>{L('¿Empezar rápido? Añade aulas de ejemplo con la plantilla Academia Onyx.', 'Want a quick start? Add sample classrooms with the Onyx Academy template.')}</span>
            <button className="btn btn-ghost" onClick={() => { if (confirm(L('Se añadirán aulas de ejemplo (Empieza aquí, Fundamentos, Estrategia) a tu academia. ¿Continuar?', 'Sample classrooms (Start here, Fundamentals, Strategy) will be added to your academy. Continue?'))) api({ action: 'template', force: true, lang: L('es', 'en') }, L('Plantilla aplicada', 'Template applied')); }}><OnyxIcon name="graduation" size={14} /> {L('Usar plantilla Academia Onyx', 'Use Onyx Academy template')}</button>
          </div>
        </div>
        {(d.content || []).map((m: any) => (
          <div key={m.id} className="sk-card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="modules" size={16} /></span> {m.title}</h3>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setModForm({ ...m })}>{L('Portada', 'Cover')}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setLessonForm({ module_id: m.id })}>＋ {L('Lección', 'Lesson')}</button>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={async () => { if (await confirmDelete({ title: L('¿Borrar aula?', 'Delete classroom?'), itemName: m.title, message: L('Se borrará el aula y todas sus lecciones. No se puede deshacer.', 'The classroom and all its lessons will be deleted. This cannot be undone.') })) api({ action: 'module_delete', id: m.id }); }}>✕</button>
              </div>
            </div>
            {m.cover_url && <div className="sk-course-cover" style={{ backgroundImage: `url(${m.cover_url})`, borderRadius: 10, marginBottom: 10 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.lessons.map((l: any) => (
                <div key={l.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                  <span>{l.section && <span className="muted" style={{ marginRight: 6 }}>[{l.section}]</span>}{l.title}{l.is_free && <span className="sk-chip" style={{ marginLeft: 6, background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>{L('gratis', 'free')}</span>}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setLessonForm({ ...l })}>✎</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={async () => { if (await confirmDelete({ title: L('¿Borrar lección?', 'Delete lesson?'), itemName: l.title })) api({ action: 'lesson_delete', id: l.id }); }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {modForm && <CoverForm form={modForm} setForm={setModForm} L={L} onSave={(f: any) => { api({ action: 'module', id: f.id, title: f.title, description: f.description, cover_url: f.cover_url }, L('Portada guardada', 'Cover saved')); setModForm(null); }} onCancel={() => setModForm(null)} />}
        {lessonForm && <LessonForm form={lessonForm} setForm={setLessonForm} L={L} onSave={(f: any) => { api({ action: 'lesson', ...f }, L('Lección guardada', 'Lesson saved')); setLessonForm(null); }} onCancel={() => setLessonForm(null)} />}
      </>)}

      {tab === 'envivo' && (<>
        <div className="sk-card" data-onb="liveclass">
          <div className="row between"><h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="calendar" size={16} /></span> {L('Clases en vivo', 'Live classes')}</h3><button className="btn btn-primary" onClick={() => setEvForm({ title: '', join_url: '', starts_at: '', duration_min: 60 })}>＋ {L('Programar', 'Schedule')}</button></div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{L('Programa tus sesiones Zoom/Meet. El alumno verá una cuenta regresiva fija y un aviso EN VIVO cuando empieces.', 'Schedule your Zoom/Meet sessions. Students see a fixed countdown and a LIVE banner when you start.')}</p>
        </div>
        {(d.events || []).length > 0 && <MonthCalendar events={d.events} lang={lang} />}
        {(() => {
          const nowMs = Date.now();
          const evRow = (e: any) => {
            const evPast = new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 <= nowMs;
            return (
              <div key={e.id} className="sk-card" style={{ opacity: evPast ? 0.72 : 1, ...(evPast ? { borderLeft: '3px solid var(--red)' } : {}) }}>
                <div className="row between" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div><b style={{ textDecoration: evPast ? 'line-through' : 'none', textDecorationColor: evPast ? 'var(--red)' : undefined, textDecorationThickness: evPast ? 2 : undefined }}>{e.title}</b> {evPast && <span className="sk-chip" style={{ marginLeft: 4, background: 'color-mix(in srgb,var(--red) 14%,transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb,var(--red) 40%,transparent)', fontWeight: 700 }}>✓ {L('Finalizada', 'Ended')}</span>}<div style={{ fontSize: 12.5, marginTop: 2 }}>{localTime(e.starts_at, lang)} · <span className="muted">{L('tu hora', 'your time')} · {e.duration_min} min</span> {e.recording_url && <span className="sk-chip" style={{ marginLeft: 6 }}>🎬 {L('grabación', 'replay')}</span>}</div><div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{refTimes(e.starts_at, lang)}</div></div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEvForm({ ...e, starts_at: e.starts_at ? utcToLocalInput(e.starts_at) : '' })}>✎</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={async () => { if (await confirmDelete({ title: L('¿Borrar clase en vivo?', 'Delete live class?'), itemName: e.title })) api({ action: 'event_delete', id: e.id }); }}>✕</button>
                  </div>
                </div>
              </div>
            );
          };
          const all = d.events || [];
          if (all.length === 0) return <div className="sk-card muted">{L('Aún no has programado clases.', 'No classes scheduled yet.')}</div>;
          const fromMs = new Date(evRange.from + 'T00:00:00').getTime();
          const toMs = new Date(evRange.to + 'T23:59:59').getTime();
          const inRange = all.filter((e: any) => { const ss = new Date(e.starts_at).getTime(); return ss >= fromMs && ss <= toMs; });
          const upcoming = inRange.filter((e: any) => new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 > nowMs).sort((a: any, b: any) => String(a.starts_at).localeCompare(String(b.starts_at)));
          const pastAll = inRange.filter((e: any) => new Date(e.starts_at).getTime() + (e.duration_min || 60) * 60000 <= nowMs).sort((a: any, b: any) => String(b.starts_at).localeCompare(String(a.starts_at)));
          const past = pastAll.slice(0, 7);
          const pastHidden = pastAll.length - past.length;
          const p = (n: number) => (n < 10 ? '0' + n : '' + n); const fd = (dd: Date) => dd.getFullYear() + '-' + p(dd.getMonth() + 1) + '-' + p(dd.getDate());
          return (<>
            <div className="sk-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: 0 }}>
              <div><div className="muted" style={{ fontSize: 12 }}>{L('Desde', 'From')}</div><input type="date" value={evRange.from} onChange={(e) => setEvRange({ ...evRange, from: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
              <div><div className="muted" style={{ fontSize: 12 }}>{L('Hasta', 'To')}</div><input type="date" value={evRange.to} onChange={(e) => setEvRange({ ...evRange, to: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
              <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { const f = new Date(); f.setHours(0, 0, 0, 0); const t = new Date(f.getTime() + 7 * 86400000); setEvRange({ from: fd(f), to: fd(t) }); }}>{L('Esta semana', 'This week')}</button>
              <span className="muted" style={{ fontSize: 11.5, marginLeft: 'auto', maxWidth: 200, textAlign: 'right' }}>{L('Por defecto muestra 7 días. Cambia las fechas para ver otras.', 'Shows 7 days by default. Change the dates to see others.')}</span>
            </div>
            {upcoming.length === 0 && past.length === 0 && <div className="sk-card muted">{L('No hay clases en este rango de fechas.', 'No classes in this date range.')}</div>}
            {upcoming.length > 0 && <><div className="sk-sec-title">{L('Próximas', 'Upcoming')}</div>{upcoming.map(evRow)}</>}
            {past.length > 0 && <><div className="sk-sec-title">{L('Ya pasaron', 'Already passed')} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>· {L('últimas 7', 'last 7')}</span></div>{past.map(evRow)}{pastHidden > 0 && <div className="sk-card muted" style={{ fontSize: 12.5, textAlign: 'center' }}>{L(`Hay ${pastHidden} clase(s) más antiguas en este rango. Ajusta las fechas de arriba para verlas.`, `${pastHidden} older class(es) in this range. Adjust the dates above to see them.`)}</div>}</>}
          </>);
        })()}
        {evForm && <EventForm form={evForm} setForm={setEvForm} L={L} onSave={(f: any) => {
          // Convertimos TODO en la zona horaria del navegador (la misma que ve el usuario en el
          // resto de la app). El día principal + cada día marcado -> UTC ISO, misma hora.
          const anchorLocal: string = f.starts_at || '';
          const time = anchorLocal.slice(11, 16);
          const uniqDays = Array.from(new Set([anchorLocal.slice(0, 10), ...((f.dates || []) as string[])].filter(Boolean)));
          const datesIso = uniqDays.map((d) => { try { return new Date(`${d}T${time}`).toISOString(); } catch { return ''; } }).filter(Boolean);
          const { dates, ...rest } = f; // 'dates' (locales) no se envía; usamos dates_iso ya en UTC
          api({ action: 'event', ...rest, starts_at: anchorLocal ? new Date(anchorLocal).toISOString() : '', dates_iso: datesIso.length > 1 ? datesIso : undefined }, L('Clase programada', 'Class scheduled'));
          setEvForm(null);
        }} onCancel={() => setEvForm(null)} />}
      </>)}

      {tab === 'cobros' && <MentorPayments modules={d.content || []} L={L} onChanged={load} />}
      {tab === 'cobros' && <CopyPanel mentorId="" isMentor L={L} />}

      {tab === 'becas' && <ScholarshipPanel L={L} />}

      {tab === 'alumnos' && <CollabManager d={d} api={api} L={L} />}

      {tab === 'alumnos' && (() => {
        const all = d.roster.students || [];
        const activeN = all.filter((s: any) => !s.banned).length;
        const bannedN = all.filter((s: any) => s.banned).length;
        const q = studentQ.trim().toLowerCase();
        const list = all.filter((s: any) => {
          if (studentFilter === 'banned' && !s.banned) return false;
          if (studentFilter === 'active' && s.banned) return false;
          if (!q) return true;
          return (s.name || '').toLowerCase().includes(q) || (s.real_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
        });
        return (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon name="users" size={16} /></span> {L('Alumnos', 'Students')} · {all.length}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginBottom: 12 }}>
            <div className="statcard" style={{ padding: '9px 11px' }}><div className="sc-lbl">{L('Total', 'Total')}</div><div className="sc-val">{all.length}</div></div>
            <div className="statcard" style={{ padding: '9px 11px' }}><div className="sc-lbl">{L('Activos', 'Active')}</div><div className="sc-val">{activeN}</div></div>
            <div className="statcard" style={{ padding: '9px 11px' }}><div className="sc-lbl">{L('Baneados', 'Banned')}</div><div className="sc-val">{bannedN}</div></div>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="row" style={{ gap: 6, alignItems: 'center', flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 9, padding: '2px 10px' }}>
              <OnyxIcon emoji="🔎" size={14} />
              <input value={studentQ} onChange={(e) => setStudentQ(e.target.value)} placeholder={L('Buscar por nombre o correo…', 'Search by name or email…')} style={{ margin: 0, border: 'none', background: 'transparent', flex: 1 }} />
              {studentQ && <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => setStudentQ('')}>✕</button>}
            </div>
            <div className="sk-seg">
              {(['all', 'active', 'banned'] as const).map((f) => <button key={f} className={studentFilter === f ? 'on' : ''} onClick={() => setStudentFilter(f)}>{f === 'all' ? L('Todos', 'All') : f === 'active' ? L('Activos', 'Active') : L('Baneados', 'Banned')}</button>)}
            </div>
          </div>
          {all.length === 0 ? <p className="muted">{L('Comparte tu enlace para que se inscriban.', 'Share your link so they enroll.')}</p>
            : list.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{L('Sin resultados.', 'No results.')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map((s: any) => <StudentRow key={s.id} s={s} total={d.roster.totalLessons} lang={lang} L={L} api={api} />)}
            </div>
          )}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{L('Para el dashboard completo de auditoría (KPIs, disciplina, reporte AI y verificación), ve a la pestaña Auditoría. Requiere que el alumno compre el add-on y dé su consentimiento.', 'For the full audit dashboard (KPIs, discipline, AI report and verification), go to the Audit tab. Requires the student to buy the add-on and give consent.')}</p>
        </div>
        ); })()}

      {tab === 'auditoria' && <MentorAudit mentorId={d.mentor.user_id} lang={lang} L={L} />}

      {tab === 'retencion' && <RetentionView lang={lang} L={L} goEmails={() => setTab('correos')} />}

      {tab === 'comunidad' && (<>
        <MentorDigest L={L} />
        <MentorReviews mentorId={d.mentor.user_id} L={L} />
        <div className="sk-card">
          <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{L('Tipo de publicación', 'Post type')}</div>
          <PostTypePicker kind={postKind} setKind={setPostKind} winKind={postWinKind} setWinKind={setPostWinKind} L={L} />
          <textarea value={post} onChange={(e) => setPost(e.target.value)} rows={2} placeholder={L('Escribe para tu comunidad…', 'Write for your community…')} style={{ width: '100%', margin: 0 }} />
          <ImgPreview url={postImg} onRemove={() => setPostImg('')} />
          <div className="row" style={{ gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={postAnn} onChange={(e) => setPostAnn(e.target.checked)} style={{ width: 'auto', margin: 0 }} /> <OnyxIcon name="megaphone" size={13} /> {L('Anuncio (fija arriba + push a todos)', 'Announcement (pins on top + push to all)')}</label>
            <span className="muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}><OnyxIcon name="calendar" size={13} /> {L('Programar', 'Schedule')}:</span>
            <input type="datetime-local" value={postWhen} onChange={(e) => setPostWhen(e.target.value)} style={{ margin: 0, width: 200 }} />
            {postWhen && <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setPostWhen('')}>{L('Ahora', 'Now')}</button>}
          </div>
          <div className="row between" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div className="row" style={{ gap: 2 }}><AiBtn kind="post" onText={(t: string) => setPost(t)} L={L} /><EmojiRow onPick={(e: string) => setPost((v) => v + e)} /><ImgAttach onUrl={(u: string) => setPostImg(u)} L={L} /></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { if (post.trim() || postImg) { api({ action: 'post', body: post, pinned: true, image_url: postImg, scheduled_at: postWhen, kind: postKind, win_kind: postKind === 'win' ? postWinKind : undefined }, postWhen ? L('Post programado', 'Post scheduled') : ''); setPost(''); setPostImg(''); setPostWhen(''); setPostKind('community'); setPostAnn(false); } }}>📌 {L('Fijar', 'Pin')}</button>
              <button className="btn btn-primary" onClick={() => { if (post.trim() || postImg) { api({ action: 'post', body: post, image_url: postImg, scheduled_at: postWhen, kind: postKind, win_kind: postKind === 'win' ? postWinKind : undefined, announcement: postAnn }, postWhen ? L('Post programado', 'Post scheduled') : ''); setPost(''); setPostImg(''); setPostWhen(''); setPostKind('community'); setPostAnn(false); } }}>{postWhen ? L('Programar', 'Schedule') : postAnn ? L('Publicar anuncio', 'Post announcement') : L('Publicar', 'Post')}</button>
            </div>
          </div>
        </div>
        {(d.feed || []).map((p: any) => (
          <div key={p.id} className={'sk-card' + (p.announcement ? ' sk-ann' : '')}>
            {p.announcement && <div className="sk-ann-tag"><OnyxIcon name="megaphone" size={13} glow={false} /> {L('Anuncio', 'Announcement')}</div>}
            <div className="row between"><b style={{ fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{p.author_name}{p.pinned && ' 📌'} <PostTag kind={p.kind} winKind={p.win_kind} L={L} />{p.scheduled_at && new Date(p.scheduled_at).getTime() > Date.now() && <span className="sk-chip" style={{ marginLeft: 8, background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>⏱ {L('programado', 'scheduled')} {new Date(p.scheduled_at).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}</b><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={async () => { if (await confirmDelete({ title: L('¿Borrar publicación?', 'Delete post?'), message: L('Se borrará para todos los alumnos.', 'It will be removed for all students.') })) api({ action: 'post_delete', id: p.id }); }}>✕</button></div>
            {p.body && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', marginTop: 4 }}>{p.body}</div>}
            {p.image_url && <img src={p.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 10, marginTop: 6, display: 'block' }} />}
          </div>
        ))}
      </>)}

      {tab === 'correos' && <MentorEmails lang={lang} L={L} />}

      {tab === 'ajustes' && <MentorSettings mentor={d.mentor} L={L} onSave={(b: any) => api({ action: 'settings', ...b }, L('Ajustes guardados', 'Settings saved'))} />}
        </div>
        {/* Columna derecha · guía de configuración de la academia */}
        <aside className="sk-onb-col" style={{ minWidth: 0 }}>
          <OnboardingCard d={d} L={L} api={api} goTab={setTab} startTour={startTour} openStudent={openStudent} />
        </aside>
      </div>
    </div>
  );
}

// Fila de alumno con botón de auditoría IA.
function StudentRow({ s, total, lang, L, api }: any) {
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.display_name || '');
  async function run() {
    setBusy(true);
    const r = await fetch('/api/academy/audit', { method: 'POST', body: JSON.stringify({ student_id: s.id, period: '30d', lang: L('es', 'en') }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) setAudit(j.text);
    else alert(j.error === 'no_addon' ? L('El alumno no tiene el add-on de auditoría activo. Véndelo en Cobros → Add-on auditoría.', 'The student has no active audit add-on. Sell it in Payments → Audit add-on.') : j.error === 'no_consent' ? L('El alumno no ha dado su consentimiento en su comunidad.', 'The student hasn’t given consent in their community.') : j.error === 'no_data' ? L('El alumno no tiene suficientes operaciones.', 'Not enough trades for this student.') : L('No se pudo generar (¿IA configurada?).', 'Could not generate (AI configured?).'));
  }
  function saveName() { api({ action: 'student_name', student_id: s.id, name }, L('Nombre actualizado', 'Name updated')); setEditing(false); }
  async function toggleBan() {
    if (!s.banned) {
      if (!await confirmDelete({ title: L('¿Banear alumno?', 'Ban student?'), itemName: s.name, message: L('Perderá acceso a la comunidad al instante. Puedes readmitirlo después.', 'They lose community access instantly. You can readmit later.'), confirmText: L('Banear', 'Ban') })) return;
    }
    api({ action: 'student_ban', student_id: s.id, banned: !s.banned }, s.banned ? L('Readmitido', 'Readmitted') : L('Baneado', 'Banned'));
  }
  async function remove() {
    if (!await confirmDelete({ title: L('¿Quitar alumno?', 'Remove student?'), itemName: s.name, message: L('Se borra su inscripción a tu academia.', 'Their enrollment in your academy is deleted.'), confirmText: L('Quitar', 'Remove') })) return;
    api({ action: 'student_remove', student_id: s.id }, L('Alumno quitado', 'Student removed'));
  }
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 13, opacity: s.banned ? 0.7 : 1 }}>
      <div className="row between" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: 'var(--tx)' }}>{s.name}</span>
          {s.banned && <span className="sk-chip" style={{ marginLeft: 6, background: 'color-mix(in srgb,var(--red) 16%,transparent)', color: 'var(--red)' }}>{L('Baneado', 'Banned')}</span>}
          {s.display_name && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({L('real', 'real')}: {s.real_name})</span>}
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>{s.done}/{total}</span>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px' }} onClick={() => { setName(s.display_name || s.real_name || ''); setEditing((v) => !v); }} title={L('Corregir nombre', 'Fix name')}>✎</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px' }} disabled={busy} onClick={run} title={L('Auditar', 'Audit')}>{busy ? '…' : '✨'}</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px', color: s.banned ? 'var(--green)' : 'var(--gold)' }} onClick={toggleBan}>{s.banned ? L('Readmitir', 'Unban') : L('Banear', 'Ban')}</button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 8px', color: 'var(--red)' }} onClick={remove} title={L('Quitar', 'Remove')}>✕</button>
        </div>
      </div>
      {editing && (
        <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L('Nombre visible en tu academia', 'Display name in your academy')} style={{ margin: 0, flex: 1, minWidth: 160 }} />
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveName}>{L('Guardar', 'Save')}</button>
          {s.display_name && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setName(''); api({ action: 'student_name', student_id: s.id, name: '' }, L('Nombre restablecido', 'Name reset')); setEditing(false); }}>{L('Usar el real', 'Use real')}</button>}
          <span className="muted" style={{ fontSize: 11, width: '100%' }}>{L('Solo cambia cómo se ve en tu academia; no toca su cuenta de Onyx.', 'Only changes how they appear in your academy; does not touch their Onyx account.')}</span>
        </div>
      )}
      {audit && <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>{audit}<div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Guardado. El alumno lo verá en su perfil.', 'Saved. The student sees it in their profile.')}</div></div>}
    </div>
  );
}

// =================== Dashboard de auditoría del mentor (add-on) ===================
const LIGHT = { green: '#1D9E75', amber: '#EF9F27', red: '#E24B4A', gray: 'var(--mut)' } as any;
function MentorAudit({ mentorId, lang, L }: { mentorId: string; lang: string; L: (a: string, b: string) => string }) {
  const [d, setD] = useState<any>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [trades, setTrades] = useState<any[] | null>(null);
  const [period, setPeriod] = useState<'30d' | '90d'>('30d');
  const [toast, setToast] = useState('');

  async function load() { const r = await fetch(`/api/academy/audit?roster=1&m=${mentorId}`); setD(await r.json()); }
  useEffect(() => { load(); }, []);
  const cur = (d?.students || []).find((s: any) => s.student_id === sel) || null;
  useEffect(() => {
    setReport(null); setTrades(null); setHistory([]);
    if (!cur) return;
    setNotes(cur.notes || '');
    fetch(`/api/academy/audit?m=${mentorId}&u=${cur.student_id}`).then((r) => r.json()).then((j) => { setHistory(j.audits || []); if ((j.audits || [])[0]) setReport(j.audits[0]); });
  }, [sel]);
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2000); }

  async function gen() {
    if (!cur) return; setBusy('gen');
    const r = await fetch('/api/academy/audit', { method: 'POST', body: JSON.stringify({ student_id: cur.student_id, period, lang: L('es', 'en') }) });
    const j = await r.json(); setBusy('');
    if (j.ok) { setReport({ text: j.text, metrics: j.metrics, created_at: new Date().toISOString(), period }); load(); }
    else alert(j.error === 'no_consent' ? L('El alumno no ha dado su consentimiento.', 'The student hasn’t given consent.') : j.error === 'no_addon' ? L('El alumno no tiene el add-on activo.', 'The student has no active add-on.') : j.error === 'no_data' ? L('No hay suficientes operaciones (mín. 5).', 'Not enough trades (min 5).') : L('No se pudo generar (¿IA configurada?).', 'Could not generate (AI set up?).'));
  }
  async function saveNote() { if (!cur) return; setBusy('note'); await fetch('/api/academy/audit', { method: 'POST', body: JSON.stringify({ action: 'note', student_id: cur.student_id, notes }) }); setBusy(''); flash(L('Nota guardada', 'Note saved')); }
  async function verify(on: boolean) { if (!cur) return; await fetch('/api/academy/audit', { method: 'POST', body: JSON.stringify({ action: 'verify', student_id: cur.student_id, on }) }); load(); }
  async function viewTrades() { if (!cur) return; setBusy('trades'); const r = await fetch(`/api/academy/audit?trades=1&m=${mentorId}&u=${cur.student_id}&period=${period}`); const j = await r.json(); setBusy(''); setTrades(j.trades || []); }

  if (!d) return <div className="sk-card muted">…</div>;
  if (d.error) return <div className="sk-card muted">{L('No disponible.', 'Not available.')}</div>;
  if (!d.addon) {
    return (
      <div className="sk-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}><span className="card-ic"><OnyxIcon name="guardian" size={16} /></span> {L('Auditoría de alumnos', 'Student audit')}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{L('Vende la auditoría como add-on: revisa el trading real de tus alumnos, dales un reporte AI y verifica su plan — con su consentimiento.', 'Sell audits as an add-on: review your students’ real trading, give them an AI report and verify their plan — with their consent.')}</p>
        <p className="muted" style={{ fontSize: 12.5 }}>{L('Créalo en', 'Create it in')} <b>{L('Cobros → Niveles → Add-on auditoría', 'Payments → Tiers → Audit add-on')}</b>.</p>
      </div>
    );
  }
  return (
    <div>
      {toast && <Toast msg={toast} />}
      <div className="sk-card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div><b style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><OnyxIcon name="guardian" size={16} /> {L('Auditoría de alumnos', 'Student audit')}</b><div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{L('Solo alumnos con el add-on activo. Sin consentimiento no ves sus datos.', 'Only students with the active add-on. No consent, no data.')}</div></div>
          <div className="sk-seg">{(['30d', '90d'] as const).map((p) => <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p}</button>)}</div>
        </div>
      </div>
      <div className="sk-grid" style={{ gridTemplateColumns: 'minmax(0,300px) 1fr' }}>
        <div className="sk-card" style={{ alignSelf: 'start' }}>
          <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{L('Alumnos', 'Students')}</div>
          {(d.students || []).length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{L('Aún nadie ha comprado el add-on de auditoría.', 'Nobody bought the audit add-on yet.')}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(d.students || []).map((s: any) => (
              <button key={s.student_id} onClick={() => setSel(s.student_id)} className="row" style={{ gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: '1px solid ' + (sel === s.student_id ? 'var(--brand)' : 'transparent'), background: sel === s.student_id ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : 'var(--bg2)' }}>
                <Avatar name={s.name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{s.name}{s.verified && <OnyxIcon name="guardian" size={12} />}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{!s.consent ? L('sin consentimiento', 'no consent') : s.kpis?.trades ? `${s.kpis.winRate}% · PF ${s.kpis.profitFactor}` : L('sin datos', 'no data')}</div>
                </div>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.consent ? LIGHT[s.kpis?.light || 'gray'] : 'var(--mut)' }} />
              </button>
            ))}
          </div>
          {d.waiting > 0 && <div className="row" style={{ gap: 8, marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg2)', fontSize: 12, color: 'var(--mut)' }}><OnyxIcon name="lock" size={14} /> {d.waiting} {L('alumnos sin el add-on', 'students without the add-on')}</div>}
        </div>

        <div>
          {!cur ? <div className="sk-card muted">{L('Elige un alumno para ver su auditoría.', 'Pick a student to see their audit.')}</div>
          : !cur.consent ? (
            <div className="sk-card">
              <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}><Avatar name={cur.name} size={38} /><b>{cur.name}</b></div>
              <div className="row" style={{ gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb,var(--gold) 10%,transparent)' }}><OnyxIcon name="lock" size={16} /><span style={{ fontSize: 13 }}>{L('Este alumno tiene el add-on pero aún no ha dado su consentimiento para compartir su track record. No puedes ver sus datos hasta que lo active en su comunidad.', 'This student has the add-on but hasn’t consented to share their track record yet. You can’t see their data until they enable it in their community.')}</span></div>
            </div>
          ) : (
            <div className="sk-card">
              <div className="row between" style={{ alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}><Avatar name={cur.name} size={40} /><div><b>{cur.name}</b>{cur.verified && <div style={{ fontSize: 12, color: 'var(--soft-green)', display: 'flex', alignItems: 'center', gap: 5 }}><OnyxIcon name="guardian" size={12} /> {L('Plan verificado por ti', 'Plan verified by you')}</div>}</div></div>
                <span style={{ fontSize: 12, color: 'var(--mut)' }}>{period === '90d' ? L('últimos 90 días', 'last 90 days') : L('últimos 30 días', 'last 30 days')}</span>
              </div>
              {cur.kpis && cur.kpis.trades > 0 ? (<>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8, marginBottom: 12 }}>
                  {[[L('Aciertos', 'Win rate'), cur.kpis.winRate + '%'], [L('Profit factor', 'Profit factor'), cur.kpis.profitFactor], [L('Trades', 'Trades'), cur.kpis.trades], [L('Max DD', 'Max DD'), cur.kpis.maxDDPct + '%'], [L('Expectativa', 'Expectancy'), cur.kpis.expectancy]].map(([lbl, val]) => (
                    <div key={lbl as string} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px' }}><div className="muted" style={{ fontSize: 11 }}>{lbl}</div><div style={{ fontSize: 19, fontWeight: 800 }}>{val}</div></div>
                  ))}
                </div>
                <div className="row" style={{ gap: 10, alignItems: 'center', padding: '9px 12px', borderRadius: 10, marginBottom: 12, background: 'color-mix(in srgb,' + LIGHT[cur.kpis.light] + ' 12%,transparent)' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: LIGHT[cur.kpis.light], flex: '0 0 auto' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{L('Disciplina', 'Discipline')} {cur.kpis.discipline}%</span>
                  <span className="muted" style={{ fontSize: 12 }}>· {cur.kpis.light === 'green' ? L('opera consistente', 'consistent') : cur.kpis.light === 'amber' ? L('a vigilar', 'watch') : L('riesgo alto', 'high risk')}</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '3px 9px' }} disabled={busy === 'trades'} onClick={viewTrades}>{busy === 'trades' ? '…' : L('Ver trades', 'View trades')}</button>
                </div>
              </>) : <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('El alumno aún no tiene operaciones registradas en este periodo.', 'No trades recorded for this student in this period.')}</p>}

              {trades && (
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 12 }}>
                  {trades.length === 0 ? <div className="muted" style={{ fontSize: 12.5, padding: 12 }}>{L('Sin operaciones.', 'No trades.')}</div> : trades.map((t: any, i: number) => (
                    <div key={i} className="row between" style={{ padding: '6px 12px', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                      <span style={{ flex: 1 }}>{t.symbol || '—'} <span className="muted">{t.side || ''}</span></span>
                      <span className="muted" style={{ fontSize: 11.5 }}>{t.close_time ? new Date(t.close_time).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES') : ''}</span>
                      <b style={{ minWidth: 64, textAlign: 'right', color: t.pnl >= 0 ? 'var(--soft-green)' : 'var(--red)' }}>{t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl)}</b>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div className="row between" style={{ marginBottom: 6, alignItems: 'center' }}>
                  <b style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="star" size={14} /> {L('Reporte de Onyx AI', 'Onyx AI report')}</b>
                  <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }} disabled={busy === 'gen'} onClick={gen}>{busy === 'gen' ? '…' : (report ? '✨ ' + L('Regenerar', 'Regenerate') : '✨ ' + L('Generar', 'Generate'))}</button>
                </div>
                {report ? <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{report.text}<div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Guardado. El alumno lo ve en su perfil.', 'Saved. The student sees it in their profile.')}</div></div>
                  : <p className="muted" style={{ fontSize: 12.5 }}>{L('Aún sin reporte. Genera uno con AI (factual, sin promesas ni predicciones).', 'No report yet. Generate one with AI (factual, no promises or predictions).')}</p>}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Notas privadas (solo tú las ves)', 'Private notes (only you)')}</div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={L('Ej: mejorar gestión de riesgo en NY…', 'e.g. improve risk management in NY session…')} style={{ width: '100%', margin: 0 }} />
                <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 6 }} disabled={busy === 'note'} onClick={saveNote}>{L('Guardar nota', 'Save note')}</button>
              </div>

              <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!cur.verified} onChange={(e) => verify(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                {L('Marcar «Plan verificado por su mentor» (lo ve el alumno)', 'Mark “Plan verified by mentor” (student sees it)')}
              </label>

              {history.length > 1 && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>{L('Historial', 'History')}</div>
                  {history.map((h: any, i: number) => (
                    <div key={i} className="muted" style={{ fontSize: 11.5, padding: '3px 0' }}>{new Date(h.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')} · {h.period} {h.metrics ? `· ${h.metrics.winRate}% · PF ${h.metrics.profitFactor}` : ''}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =================== Correos del mentor (campañas + automatizaciones) ===================
function MentorEmails({ lang, L }: { lang: string; L: (a: string, b: string) => string }) {
  const [d, setD] = useState<any>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [autos, setAutos] = useState<any>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() { const r = await fetch('/api/academy/emails'); const j = await r.json(); setD(j); setAutos(j.automations || null); }
  useEffect(() => { load(); }, []);
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200); }
  const setAuto = (k: string, field: string, v: any) => setAutos((a: any) => ({ ...a, [k]: { ...a[k], [field]: v } }));

  async function send(schedule: boolean) {
    if (!subject.trim() || !body.trim()) return;
    setBusy(true);
    const r = await fetch('/api/academy/emails', { method: 'POST', body: JSON.stringify({ action: schedule ? 'schedule' : 'send', subject, body, audience, scheduled_at: schedule ? when : undefined }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setSubject(''); setBody(''); setWhen(''); flash(schedule ? L('Campaña programada', 'Campaign scheduled') : L(`Enviado a ${j.sent} alumnos`, `Sent to ${j.sent} students`)); load(); }
    else alert(j.error === 'fecha_invalida' ? L('Elige una fecha futura.', 'Pick a future date.') : L('No se pudo. ¿Configuraste Resend?', 'Failed. Is Resend configured?'));
  }
  async function del(id: string) { await fetch('/api/academy/emails', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) }); load(); }
  function startEdit(k: any) { setEditing(k.id); setSubject(k.subject || ''); setBody(k.body || ''); setAudience(k.audience || 'all'); setWhen(k.scheduled_at ? new Date(k.scheduled_at).toISOString().slice(0, 16) : ''); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelEdit() { setEditing(null); setSubject(''); setBody(''); setWhen(''); setAudience('all'); }
  async function saveEdit() {
    if (!editing) return; setBusy(true);
    const r = await fetch('/api/academy/emails', { method: 'POST', body: JSON.stringify({ action: 'edit', id: editing, subject, body, audience, scheduled_at: when }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { flash(L('Campaña actualizada', 'Campaign updated')); cancelEdit(); load(); }
    else alert(j.error === 'fecha_invalida' ? L('Elige una fecha futura.', 'Pick a future date.') : L('No se pudo editar.', 'Could not edit.'));
  }
  async function saveAutos() { await fetch('/api/academy/emails', { method: 'POST', body: JSON.stringify({ action: 'automations', automations: autos }) }); flash(L('Automáticos guardados', 'Automations saved')); load(); }

  if (!d) return <div className="sk-card muted">…</div>;
  if (d.error) return <div className="sk-card muted">{L('No disponible.', 'Not available.')}</div>;
  const c = d.counts || {};
  const AUD: [string, string, number][] = [['all', L('Todos', 'All'), c.all], ['active', L('Activos', 'Active'), c.active], ['inactive', L('Inactivos', 'Inactive'), c.inactive], ['expiring', L('Por expirar', 'Expiring'), c.expiring]];
  const fmt = (iso: string) => iso ? new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {toast && <Toast msg={toast} />}
      {d.mailEnabled === false && <div className="sk-card" style={{ border: '1px solid var(--gold)' }}><b>{L('Correo no configurado', 'Email not configured')}</b><p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{L('Falta RESEND_API_KEY en Vercel para enviar correos.', 'RESEND_API_KEY missing in Vercel to send emails.')}</p></div>}

      {/* Redactar campaña */}
      <div className="sk-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}><span className="card-ic"><OnyxIcon name="mail" size={16} /></span> {L('Nueva campaña / promoción', 'New campaign / promo')}</h3>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={L('Asunto', 'Subject')} style={{ margin: '0 0 8px' }} />
        <div className="row between" style={{ alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Mensaje', 'Message')}</span><AiBtn kind="post" onText={(t: string) => setBody(t)} L={L} /></div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={L('Escribe tu correo o pulsa ✨ IA…', 'Write your email or hit ✨ AI…')} style={{ width: '100%', margin: '4px 0 0' }} />
        <div className="row" style={{ gap: 8, margin: '10px 0', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>{L('Enviar a', 'Send to')}:</span>
          {AUD.map(([k, lbl, n]) => <button key={k} className={'btn ' + (audience === k ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 12.5, padding: '5px 10px' }} onClick={() => setAudience(k)}>{lbl} ({n ?? 0})</button>)}
        </div>
        {editing ? (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--gold) 16%,transparent)', color: 'var(--gold)' }}>{L('Editando programada', 'Editing scheduled')}</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ margin: 0, width: 210 }} />
            <button className="btn btn-primary" disabled={busy || !when || !subject.trim() || !body.trim()} onClick={saveEdit}>{busy ? '…' : L('Guardar cambios', 'Save changes')}</button>
            <button className="btn btn-ghost" onClick={cancelEdit}>{L('Cancelar', 'Cancel')}</button>
          </div>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" disabled={busy || !subject.trim() || !body.trim()} onClick={() => send(false)}>{busy ? '…' : L('Enviar ahora', 'Send now')}</button>
            <span className="muted" style={{ fontSize: 12 }}>{L('o programar:', 'or schedule:')}</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ margin: 0, width: 210 }} />
            <button className="btn btn-ghost" disabled={busy || !when || !subject.trim() || !body.trim()} onClick={() => send(true)}>{L('Programar', 'Schedule')}</button>
          </div>
        )}
      </div>

      {/* Automatizaciones editables */}
      {autos && (
        <div className="sk-card">
          <div className="row between" style={{ marginBottom: 6, alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div><h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="ai" size={16} /></span> {L('Correos automáticos', 'Automated emails')}</h3><p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{L('Edita el asunto, el texto y el momento. Variables: {name}, {academy}, {join}, {class}, {classlink}.', 'Edit subject, copy and timing. Variables: {name}, {academy}, {join}, {class}, {classlink}.')}</p></div>
            <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={saveAutos}>{L('Guardar automáticos', 'Save automations')}</button>
          </div>
          {([
            ['welcome', L('Bienvenida al inscribirse', 'Welcome on join'), null],
            ['class_reminder', L('Recordatorio de clase en vivo', 'Live class reminder'), 'lead_min'],
            ['expiring', L('Membresía por vencer', 'Membership expiring'), 'days_before'],
          ] as [string, string, string | null][]).map(([k, lbl, timing]) => {
            const a = autos[k] || {};
            return (
              <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginTop: 10, opacity: a.enabled ? 1 : .7 }}>
                <label className="row between" style={{ alignItems: 'center', marginBottom: a.enabled ? 10 : 0, cursor: 'pointer' }}>
                  <b style={{ fontSize: 13.5 }}>{lbl}</b>
                  <input type="checkbox" checked={!!a.enabled} onChange={(e) => setAuto(k, 'enabled', e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                </label>
                {a.enabled && (<>
                  <input value={a.subject || ''} onChange={(e) => setAuto(k, 'subject', e.target.value)} placeholder={L('Asunto', 'Subject')} style={{ margin: '0 0 8px' }} />
                  <div className="row between" style={{ alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Mensaje', 'Message')}</span><AiBtn kind="post" onText={(t: string) => setAuto(k, 'body', t)} L={L} /></div>
                  <textarea value={a.body || ''} onChange={(e) => setAuto(k, 'body', e.target.value)} rows={4} style={{ width: '100%', margin: '4px 0 0' }} />
                  {timing === 'lead_min' && <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Enviar', 'Send')}</span><input type="number" min={5} max={1440} value={a.lead_min ?? 60} onChange={(e) => setAuto(k, 'lead_min', Number(e.target.value))} style={{ margin: 0, width: 90 }} /><span className="muted" style={{ fontSize: 12 }}>{L('min antes de la clase', 'min before class')}</span></div>}
                  {timing === 'days_before' && <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Avisar', 'Notify')}</span><input type="number" min={1} max={30} value={a.days_before ?? 3} onChange={(e) => setAuto(k, 'days_before', Number(e.target.value))} style={{ margin: 0, width: 90 }} /><span className="muted" style={{ fontSize: 12 }}>{L('días antes de vencer', 'days before expiry')}</span></div>}
                </>)}
              </div>
            );
          })}
        </div>
      )}

      {/* Historial */}
      <div className="sk-card">
        <h3 style={{ marginBottom: 10 }}>{L('Campañas', 'Campaigns')}</h3>
        {(d.campaigns || []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>{L('Aún no has enviado campañas.', 'No campaigns yet.')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(d.campaigns || []).map((k: any) => (
            <div key={k.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{k.subject}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {k.status === 'sent' ? `✓ ${L('enviada', 'sent')} · ${k.sent_count} ${L('correos', 'emails')}` : k.status === 'scheduled' ? `⏱ ${L('programada', 'scheduled')} ${fmt(k.scheduled_at)}` : k.status} · {k.audience}
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {k.status === 'scheduled' && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => startEdit(k)}>✎</button>}
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => del(k.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Colaboradores: el mentor asigna rol (etiqueta) y permisos a un alumno.
function CollabManager({ d, api, L }: any) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [role, setRole] = useState('');
  const [preset, setPreset] = useState('custom');
  const [perms, setPerms] = useState<any>({ wins: false, moderate: false, announce: false, message: false });
  const collabs = d.collaborators || [];
  const collabIds = new Set(collabs.map((c: any) => c.user_id));
  const candidates = (d.roster?.students || []).filter((s: any) => !collabIds.has(s.id));
  const PERMS: [string, string, string, string][] = [
    ['wins', L('Aprobar logros', 'Approve wins'), 'trophy', L('Revisar la cola de logros: aprobar, rechazar o verificar.', 'Review the wins queue: approve, reject or verify.')],
    ['moderate', L('Moderar el muro', 'Moderate the feed'), 'shield', L('Ver reportes, ocultar/borrar posts y comentarios, mutear o expulsar de la conversación.', 'See reports, hide/delete posts and comments, mute or remove from the conversation.')],
    ['announce', L('Publicar y fijar anuncios', 'Post & pin announcements'), 'megaphone', L('Fijar arriba y enviar push a todos los alumnos.', 'Pin on top and push to all students.')],
    ['message', L('Chatear con alumnos', 'Message students'), 'mail', L('Abrir chats privados con los alumnos de la comunidad.', 'Open private chats with community students.')],
  ];
  // Roles listos que preseleccionan permisos típicos (editables después).
  const PRESETS: [string, string, any][] = [
    ['custom', L('Personalizado', 'Custom'), null],
    ['moderador', L('Moderador', 'Moderator'), { wins: true, moderate: true }],
    ['coach', L('Coach', 'Coach'), { message: true }],
    ['cm', L('Community Manager', 'Community Manager'), { announce: true, moderate: true, message: true }],
    ['logros', L('Revisor de logros', 'Wins reviewer'), { wins: true }],
  ];
  function applyPreset(id: string) {
    setPreset(id);
    const p = PRESETS.find((x) => x[0] === id);
    if (p && p[2]) { setPerms({ wins: false, moderate: false, announce: false, message: false, ...p[2] }); if (!role.trim()) setRole(p[1]); }
  }
  function add() {
    if (!pick) return;
    api({ action: 'collab_add', user_id: pick, role: role || L('Colaborador', 'Collaborator'), perms }, L('Colaborador añadido', 'Collaborator added'));
    setOpen(false); setPick(''); setRole(''); setPreset('custom'); setPerms({ wins: false, moderate: false, announce: false, message: false });
  }
  return (
    <div className="sk-card">
      <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="guardian" size={16} /></span> {L('Colaboradores', 'Collaborators')}</h3>
        <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => setOpen((v) => !v)}>＋ {L('Añadir', 'Add')}</button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Suma a tu equipo: elige un rol listo o crea uno propio, y marca qué puede hacer dentro de la comunidad (aprobar logros, moderar el muro, anunciar, chatear con alumnos).', 'Build your team: pick a ready role or make your own, and choose what they can do in the community (approve wins, moderate the feed, announce, message students).')}</p>
      {collabs.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>{L('Aún no tienes colaboradores.', 'No collaborators yet.')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {collabs.map((c: any) => (
            <div key={c.user_id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 13, alignItems: 'center' }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}><Avatar name={c.name} size={26} /><span>{c.name}</span><span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--brand) 16%,transparent)', color: 'var(--soft-brand,var(--brand))' }}>{c.role}</span></div>
              <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                {(c.perms?.wins ?? c.perms?.moderate) && <span title={L('Logros', 'Wins')}><OnyxIcon name="trophy" size={13} /></span>}
                {c.perms?.moderate && <span title={L('Modera', 'Moderates')}><OnyxIcon name="shield" size={13} /></span>}
                {(c.perms?.announce ?? c.perms?.post) && <span title={L('Anuncia', 'Announces')}><OnyxIcon name="megaphone" size={13} /></span>}
                {c.perms?.message && <span title={L('Chatea', 'Messages')}><OnyxIcon name="mail" size={13} /></span>}
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={async () => { if (await confirmDelete({ title: L('¿Quitar colaborador?', 'Remove collaborator?'), itemName: c.name, message: L('Perderá sus permisos de gestión.', 'They lose their management permissions.'), confirmText: L('Quitar', 'Remove') })) api({ action: 'collab_remove', user_id: c.user_id }); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div style={{ border: '1px solid var(--brand)', borderRadius: 10, padding: 12, marginTop: 10 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ margin: '0 0 8px' }}>
            <option value="">{L('— Elige un alumno —', '— Pick a student —')}</option>
            {candidates.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Rol', 'Role')}</div>
          <select value={preset} onChange={(e) => applyPreset(e.target.value)} style={{ margin: '0 0 8px' }}>
            {PRESETS.map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
          </select>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={L('Etiqueta visible (ej: Moderador, Coach)', 'Visible tag (e.g. Moderator, Coach)')} style={{ margin: '0 0 10px' }} />
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Permisos', 'Permissions')}</div>
          {PERMS.map(([k, lbl, ic, desc]) => (
            <label key={k} className="row" style={{ gap: 8, fontSize: 13, marginBottom: 9, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!perms[k]} onChange={(e) => { setPerms({ ...perms, [k]: e.target.checked }); setPreset('custom'); }} style={{ width: 'auto', margin: '2px 0 0' }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name={ic as any} size={13} /> {lbl}</span>
                <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.35 }}>{desc}</span>
              </span>
            </label>
          ))}
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" onClick={add} disabled={!pick}>{L('Añadir colaborador', 'Add collaborator')}</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>{L('Cancelar', 'Cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Onboarding del mentor: checklist con barra de progreso. Se autocompleta con datos reales.
// ---- Guía interactiva del onboarding: flecha animada + campo iluminado + explicación ----
// Orden "identidad primero": nombre → branding (tu voz) → y solo entonces el copy con AI.
const TOUR_STEPS: { key: string; tab: string; sel: string; review?: boolean; manual?: boolean }[] = [
  { key: 'name', tab: 'ajustes', sel: 'name', review: true },
  { key: 'branding', tab: 'ajustes', sel: 'branding', manual: true },
  { key: 'logo', tab: 'ajustes', sel: 'logo' },
  { key: 'cover', tab: 'ajustes', sel: 'cover' },
  { key: 'content', tab: 'cursos', sel: 'classroom' },
  { key: 'monetize', tab: 'cobros', sel: 'tier' },
  { key: 'charges', tab: 'cobros', sel: 'stripe' },
  { key: 'liveClass', tab: 'envivo', sel: 'liveclass' },
];

// Onyx AI solo donde hay un campo de copy real. Escribe DIRECTO en ese campo (con todo el
// espacio), no en el tooltip. `field` = qué campo de MentorSettings rellenar vía evento.
const TOUR_AI: Record<string, { kind: string; field: string; input: (name: string) => string }> = {
  branding: { kind: 'about', field: 'brand_info', input: (n) => `${n} — academia de trading. Describe al mentor: experiencia, estilo de enseñanza y tono (cercano, directo, sin promesas).` },
};

function tourCopy(key: string, L: (a: string, b: string) => string): [string, string, string] {
  const M: Record<string, [string, string, string]> = {
    name: [L('Ponle nombre a tu academia', 'Name your academy'), L('Escribe aquí el nombre de tu academia. Puedes cambiarlo cuando quieras.', 'Type your academy’s name here. You can change it anytime.'), L('Es lo primero que ven tus alumnos y Onyx AI lo usará para escribir en tu voz. Empezamos por aquí para que todo lo demás salga con tu marca.', 'It’s the first thing students see and Onyx AI uses it to write in your voice. We start here so everything else comes out on-brand.')],
    content: [L('Crea tu primera aula', 'Create your first classroom'), L('Escribe aquí el nombre de un aula (curso o módulo) y pulsa “Aula”.', 'Type a classroom name (course or module) here and hit “Classroom”.'), L('Es donde vivirán tus lecciones. Puedes crear varias (Empieza aquí, Fundamentos…). ¿Con prisa? Usa la plantilla Academia Onyx.', 'It’s where your lessons live. Create several (Start here, Fundamentals…). In a hurry? Use the Onyx Academy template.')],
    logo: [L('Sube tu logo o foto', 'Upload your logo or photo'), L('Sube una imagen cuadrada. Reemplaza el ícono por defecto de tu academia.', 'Upload a square image. It replaces your academy’s default icon.'), L('Le da cara a tu marca en la comunidad, la página de ventas y los correos.', 'It gives your brand a face across the community, sales page and emails.')],
    cover: [L('Sube la portada de tu comunidad', 'Upload your community cover'), L('Sube una imagen ancha (tipo banner). Es lo primero que ve el visitante.', 'Upload a wide (banner) image. It’s the first thing a visitor sees.')  , L('Aparece arriba de tu comunidad y en tu página de ventas. Una buena portada sube las conversiones.', 'It shows at the top of your community and sales page. A good cover lifts conversions.')],
    monetize: [L('Crea tu membresía o un nivel de pago', 'Create your membership or a paid tier'), L('Pulsa “＋ Nivel” y define nombre, precio y qué aulas incluye.', 'Hit “＋ Tier” and set name, price and which classrooms it includes.'), L('Los niveles son lo que vendes (Básico, VIP, Bootcamp). Deja el precio en 0 para uno gratis.', 'Tiers are what you sell (Basic, VIP, Bootcamp). Set price to 0 for a free one.')],
    charges: [L('Conecta Stripe para cobrar', 'Connect Stripe to get paid'), L('Pulsa “Conectar Stripe” y verifica tu cuenta. Es lo que te deja cobrar de verdad.', 'Hit “Connect Stripe” and verify your account. This is what lets you actually get paid.'), L('Stripe procesa los pagos y te deposita. Sin esto tus niveles no se pueden vender.', 'Stripe processes payments and pays you out. Without it your tiers can’t be sold.')],
    liveClass: [L('Programa tu primera clase en vivo', 'Schedule your first live class'), L('Pulsa “Programar”, pega tu enlace de Zoom/Meet y elige fecha y hora (NY).', 'Hit “Schedule”, paste your Zoom/Meet link and pick date and time (NY).'), L('Tus alumnos verán una cuenta regresiva y un aviso EN VIVO cuando empieces.', 'Students see a countdown and a LIVE banner when you start.')],
    branding: [L('Configura tu branding y redes', 'Set your branding and socials'), L('Cuéntale a Onyx AI quién eres y tu estilo, y añade tus redes sociales.', 'Tell Onyx AI who you are and your style, and add your social links.'), L('El AI escribe en tu voz (about, lemas, posts, ventas) y tus redes aparecen en tu comunidad.', 'The AI writes in your voice (about, taglines, posts, sales) and your socials show on your community.')],
  };
  return M[key] || ['', '', ''];
}

function GuidedTour({ stepKey, o, L, onGoto, onFinish, onClose, academyName }: any) {
  const step = TOUR_STEPS.find((s) => s.key === stepKey);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(true);
  const done = step && !step.review ? !!o?.[step.key] : false;
  const ai = step ? TOUR_AI[step.key] : null;

  // Al cambiar de paso: limpiar el borrador y resaltar los botones ✨ IA de la pantalla (refuerzo B).
  useEffect(() => {
    setAiFilled(false); setTipOpen(true);
    if (typeof document === 'undefined') return;
    if (step && TOUR_AI[step.key]) document.body.classList.add('onb-ai-active');
    else document.body.classList.remove('onb-ai-active');
    return () => { if (typeof document !== 'undefined') document.body.classList.remove('onb-ai-active'); };
  }, [stepKey]);

  // Genera con Onyx AI y lo ESCRIBE en el campo real (vía evento), no en el tooltip.
  async function genAI() {
    if (!ai) return;
    setAiBusy(true);
    try {
      const r = await fetch('/api/academy/ai', { method: 'POST', body: JSON.stringify({ kind: ai.kind, input: ai.input(academyName || 'Mi academia'), lang: L('es', 'en') }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok && j.text) {
        window.dispatchEvent(new CustomEvent('onyx-ai-fill', { detail: { field: ai.field, text: j.text } }));
        setAiFilled(true);
      } else {
        alert(j.error === 'no_key' ? L('La IA no está configurada (falta ANTHROPIC_API_KEY en Vercel).', 'AI not configured (ANTHROPIC_API_KEY missing in Vercel).') : L('No se pudo generar. Intenta de nuevo.', 'Could not generate. Try again.'));
      }
    } catch { alert(L('No se pudo generar. Intenta de nuevo.', 'Could not generate. Try again.')); }
    setAiBusy(false);
  }

  // Medimos el campo objetivo con listeners (no en cada frame) para que la tarjeta
  // y el chip "Ver ayuda" no salten y sus clics no fallen.
  useEffect(() => {
    if (!step) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector(`[data-onb="${step.sel}"]`) as HTMLElement | null;
      if (el) { const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left, width: r.width, height: r.height }); }
    };
    const el = document.querySelector(`[data-onb="${step.sel}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    measure();
    const iv = setInterval(measure, 120);          // reasienta mientras el scroll suave termina
    const stop = setTimeout(() => clearInterval(iv), 1400);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { clearInterval(iv); clearTimeout(stop); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [stepKey]);

  useEffect(() => {
    if (!step || !done || step.manual) return; // los pasos "manual" (branding) no saltan solos
    const t = setTimeout(() => {
      // Solo avanzar HACIA ADELANTE: si el único incompleto quedó atrás, terminamos
      // en vez de rebotar a él (evita el bucle al saltar el último paso pendiente).
      const cur = TOUR_STEPS.findIndex((s) => s.key === step.key);
      const next = TOUR_STEPS.find((s, i) => i > cur && !s.review && !o?.[s.key]);
      if (next) onGoto(next.key); else onFinish();
    }, 1800);
    return () => clearTimeout(t);
  }, [done, stepKey]); // eslint-disable-line

  if (!step) return null;
  const [title, howTo, why] = tourCopy(step.key, L);
  const idx = TOUR_STEPS.findIndex((s) => s.key === step.key);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const below = rect ? rect.top + rect.height + 300 < vh : true;
  const tipTop = rect ? (below ? rect.top + rect.height + 26 : Math.max(12, rect.top - 260)) : 120;
  const tipLeft = rect ? Math.min(Math.max(12, rect.left), vw - 360) : 120;
  const Arrow = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {below ? <><line x1="12" y1="4" x2="12" y2="19" /><polyline points="6,13 12,19 18,13" /></> : <><line x1="12" y1="20" x2="12" y2="5" /><polyline points="6,11 12,5 18,11" /></>}
    </svg>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 92, pointerEvents: 'none' }}>
      {rect && <div className="onb-halo" style={{ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }} />}
      {rect && <div className="onb-arrow" style={{ top: below ? rect.top - 38 : rect.top + rect.height + 6, left: rect.left + Math.min(46, rect.width / 2), color: 'var(--brand)' }}><Arrow /></div>}
      {!tipOpen && !done && (
        <button className="onb-tip-mini" style={{ top: tipTop, left: tipLeft, pointerEvents: 'auto' }} onClick={() => setTipOpen(true)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="ai" size={14} glow={false} /> {L('Completa este paso', 'Complete this step')}</span>
          <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{L('Ver ayuda', 'Show tip')}</span>
        </button>
      )}
      {tipOpen && (
      <div className="onb-tip" style={{ top: tipTop, left: tipLeft }}>
        <div className="row between" style={{ marginBottom: 6, alignItems: 'center' }}>
          <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--brand) 16%,transparent)', color: 'var(--soft-brand,var(--brand))' }}>{L('Paso', 'Step')} {idx + 1}/{TOUR_STEPS.length}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={onClose}>✕</button>
        </div>
        <b style={{ fontSize: 15 }}>{title}</b>
        <p style={{ fontSize: 13, margin: '6px 0 4px', color: 'var(--tx)', lineHeight: 1.5 }}>{howTo}</p>
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 }}>{why}</p>
        {ai && (
          <div style={{ margin: '0 0 10px', padding: '9px 10px', borderRadius: 10, background: 'color-mix(in srgb,var(--brand) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--brand) 32%,transparent)' }}>
            <div className="row between" style={{ gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: aiFilled ? 'var(--soft-green)' : 'var(--soft-brand,var(--brand))', display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
                {aiFilled ? '✓ ' + L('Escrito en el campo — míralo abajo y edítalo.', 'Written in the field — see it below and edit.') : '✨ ' + L('Deja que Onyx AI lo escriba en el campo', 'Let Onyx AI write it in the field')}
              </span>
              <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px', flex: 'none' }} disabled={aiBusy} onClick={genAI}>{aiBusy ? L('Escribiendo…', 'Writing…') : aiFilled ? L('Otra versión', 'Another version') : L('Escribir con IA', 'Write with AI')}</button>
            </div>
          </div>
        )}
        {step.review ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, flex: 1 }} onClick={() => setTipOpen(false)}>{L('Ahora no', 'Not now')}</button>
            <button className="btn btn-primary" style={{ fontSize: 12, flex: 2 }} onClick={() => { const next = TOUR_STEPS[idx + 1]; if (next) onGoto(next.key); else onFinish(); }}>{L('Listo, siguiente →', 'Done, next →')}</button>
          </div>
        ) : done && step.manual ? (
          <div>
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 16%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Guardado', 'Saved')}</span>
              <span className="muted" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{L('Léelo y edítalo a tu gusto; cuando estés conforme, sigue.', 'Read and edit it as you like; when you’re happy, continue.')}</span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 12 }} onClick={() => { const next = TOUR_STEPS.find((s, i) => i > idx && !s.review && !o?.[s.key]); if (next) onGoto(next.key); else onFinish(); }}>{L('Revisado, siguiente →', 'Reviewed, next →')}</button>
          </div>
        ) : done ? (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 16%,transparent)', color: 'var(--soft-green)' }}>✓ {L('¡Completado!', 'Done!')}</span>
            <span className="muted" style={{ fontSize: 12 }}>{L('Pasando al siguiente…', 'Moving to next…')}</span>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, flex: 1 }} onClick={() => { const next = TOUR_STEPS.find((s, i) => i > idx && !s.review && !o?.[s.key]); if (next) onGoto(next.key); else onClose(); }}>{L('Saltar paso', 'Skip step')}</button>
            <button className="btn btn-primary" style={{ fontSize: 12, flex: 1 }} onClick={() => setTipOpen(false)}>{L('Entendido', 'Got it')}</button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function OnboardingCard({ d, L, api, goTab, startTour }: any) {
  const o = d.onboarding || {};
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem('onyx_onb_collapsed') === '1'); } catch {} }, []);
  const setCol = (v: boolean) => { setCollapsed(v); try { localStorage.setItem('onyx_onb_collapsed', v ? '1' : '0'); } catch {} };
  if (o.dismissed) return null;
  const go = (key: string) => (startTour ? startTour(key) : goTab(TOUR_STEPS.find((s) => s.key === key)?.tab || 'cursos'));
  const steps: [boolean, string, () => void][] = [
    [o.branding, L('Configura tu branding y redes (para el AI)', 'Set your branding and socials (for the AI)'), () => go('branding')],
    [o.logo, L('Sube tu logo o foto', 'Upload your logo or photo'), () => go('logo')],
    [o.cover, L('Sube la portada de tu comunidad', 'Upload your community cover'), () => go('cover')],
    [o.content, L('Crea tu primera aula (o usa la plantilla)', 'Create your first classroom (or use the template)'), () => go('content')],
    [o.monetize, L('Crea tu membresía o un nivel de pago', 'Create your membership or a paid tier'), () => go('monetize')],
    [o.charges, L('Conecta Stripe para cobrar', 'Connect Stripe to get paid'), () => go('charges')],
    [o.liveClass, L('Programa tu primera clase en vivo', 'Schedule your first live class'), () => go('liveClass')],
  ];
  const done = steps.filter((s) => s[0]).length;
  const pct = Math.round((done / steps.length) * 100);
  const allDone = done === steps.length;
  const pending = steps.length - done;
  // Colapsado: si todo está listo, se oculta del todo; si falta algo, deja una
  // píldora ILUMINADA como recordatorio (no desaparece hasta completar).
  if (collapsed) {
    if (allDone) return null;
    return (
      <button className="sk-onb-mini" onClick={() => setCol(false)}>
        <span className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
          <OnyxIcon name="graduation" size={15} />
          <b style={{ fontSize: 13.5 }}>{L('Configura tu academia', 'Set up your academy')}</b>
          <span className="muted" style={{ fontSize: 12 }}>· {pending} {L('pendiente(s)', 'pending')}</span>
        </span>
        <span style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 600, flex: 'none' }}>{L('Ver', 'Open')} →</span>
      </button>
    );
  }
  return (
    <div className={'sk-card' + (allDone ? '' : ' sk-onb-live')} style={{ border: '1px solid color-mix(in srgb,var(--brand) 40%,transparent)', width: '100%', margin: 0 }}>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={18} /></span> {allDone ? L('¡Tu academia está lista! 🎉', 'Your academy is ready! 🎉') : L('Configura tu academia', 'Set up your academy')}</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--brand) 16%,transparent)', color: 'var(--soft-brand,var(--brand))' }}>{done}/{steps.length}</span>
          {allDone
            ? <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => api({ action: 'onboarding_dismiss', on: true })}>{L('Ocultar', 'Dismiss')}</button>
            : <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setCol(true)}>{L('Ocultar', 'Hide')}</button>}
        </div>
      </div>
      <div className="statbar" style={{ ['--ac' as any]: 'var(--brand)', marginBottom: 10 }}><i style={{ width: pct + '%' }} /></div>
      {!allDone && startTour && (
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10, fontSize: 13 }} onClick={() => startTour(TOUR_STEPS[0].key)}>
          <OnyxIcon name="ai" size={14} glow={false} /> {L('Guíame paso a paso (con Onyx AI)', 'Guide me step by step (with Onyx AI)')}
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map(([ok, label, go], i) => (
          <button key={i} className="row between" onClick={go} style={{ alignItems: 'center', gap: 10, background: 'var(--bg2)', border: 'none', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', textAlign: 'left', opacity: ok ? .7 : 1 }}>
            <span className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12, background: ok ? 'var(--green)' : 'color-mix(in srgb,var(--brand) 22%,transparent)', color: ok ? '#04121a' : 'var(--soft-brand,var(--brand))' }}>{ok ? '✓' : i + 1}</span>
              <span style={{ fontSize: 13.5, color: ok ? 'var(--mut)' : 'var(--tx)', textDecoration: ok ? 'line-through' : 'none' }}>{label}</span>
            </span>
            {!ok && <span style={{ fontSize: 12, color: 'var(--brand)' }}>{L('Ir →', 'Go →')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Analíticas de retención (mentor).
function RetentionView({ lang, L, goEmails }: any) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/academy/retention').then((r) => r.json()).then(setD); }, []);
  if (!d) return <div className="sk-card muted">…</div>;
  if (d.error || !d.total) return <div className="sk-card muted">{L('Cuando tengas alumnos verás aquí su retención y quiénes están en riesgo.', 'Once you have students you’ll see retention and who’s at risk here.')}</div>;
  const maxW = Math.max(1, ...(d.newByWeek || []).map((w: any) => w.n));
  const daysAgo = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {[[L('Retención 30d', '30d retention'), d.retention30 + '%', 'guardian', 'var(--soft-green)'],
          [L('Activos 30d', 'Active 30d'), String(d.active30), 'users', 'var(--soft-green)'],
          [L('En riesgo', 'At risk'), String(d.atRisk.length), 'lock', '#EF9F27'],
          [L('Inactivos', 'Inactive'), String(d.inactive30), 'lock', 'var(--red)'],
          [L('Cancelados 30d', 'Churn 30d'), String(d.churn30), 'coins', 'var(--red)']].map(([lbl, v, ic, col]: any) => (
          <div key={lbl} className="statcard"><div className="statcard-ic" style={{ color: col }}><OnyxIcon name={ic} /></div><div><div className="sc-lbl">{lbl}</div><div className="sc-val">{v}</div></div></div>
        ))}
      </div>

      <div className="sk-card">
        <div className="sk-sec-title" style={{ marginTop: 0 }}>{L('Altas por semana', 'New joins per week')}</div>
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', height: 90 }}>
          {(d.newByWeek || []).map((w: any, i: number) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 66, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><div style={{ width: '70%', height: (w.n / maxW) * 66 + 'px', minHeight: w.n ? 6 : 2, background: w.n ? 'var(--grad)' : 'var(--line)', borderRadius: '6px 6px 0 0' }} /></div>
              <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>{w.label}</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{w.n}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sk-card">
        <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic" style={{ color: '#EF9F27' }}><OnyxIcon name="lock" size={16} /></span> {L('Alumnos en riesgo', 'At-risk students')} · {d.atRisk.length}</h3>
          {d.atRisk.length > 0 && <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={goEmails}><OnyxIcon name="mail" size={14} /> {L('Enviar correo de reactivación', 'Send re-engagement email')}</button>}
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{L('Sin actividad en 14+ días. Escríbeles o mándales un correo al segmento "Inactivos".', 'No activity in 14+ days. Message them or email the "Inactive" segment.')}</p>
        {d.atRisk.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{L('¡Nadie en riesgo ahora mismo! 🎉', 'Nobody at risk right now! 🎉')}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.atRisk.map((s: any) => {
              const dd = daysAgo(s.lastActive);
              return (
                <div key={s.user_id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, alignItems: 'center' }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}><Avatar name={s.name} size={26} /><span>{s.name}</span></div>
                  <span className="muted" style={{ fontSize: 12 }}>{dd == null ? L('nunca entró', 'never active') : L(`hace ${dd} días`, `${dd}d ago`)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Calendario grande de selección múltiple: el mentor pinta los días extra para la clase en vivo.
// Cada día marcado se sombrea; al guardar se crea una clase por día, todas a la misma hora.
function MultiDayPicker({ selected, onChange, timeStr, anchorDate, L }: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(() => { const d = anchorDate ? new Date(anchorDate + 'T00:00') : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const sel: string[] = Array.isArray(selected) ? selected : [];
  const isEs = L('es', 'en') === 'es';
  const toKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
  const toggle = (key: string) => onChange(sel.includes(key) ? sel.filter((k) => k !== key) : [...sel, key].sort());
  const dows = isEs ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells: any[] = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={'e' + i} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(view.y, view.m, d);
    const dt = new Date(view.y, view.m, d);
    const past = dt < today;
    const isAnchor = key === anchorDate;
    const on = sel.includes(key) || isAnchor;
    cells.push(
      <button type="button" key={key} disabled={past || isAnchor} title={isAnchor ? L('Día principal', 'Main day') : ''}
        onClick={() => { if (!past && !isAnchor) toggle(key); }}
        style={{
          height: 42, borderRadius: 10, border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'),
          background: isAnchor ? 'color-mix(in srgb,var(--brand) 40%,transparent)' : on ? 'color-mix(in srgb,var(--brand) 26%,transparent)' : 'var(--card)',
          color: past ? 'var(--mut)' : 'var(--tx)', opacity: past ? 0.32 : 1, position: 'relative',
          cursor: past || isAnchor ? 'default' : 'pointer', fontSize: 14, fontWeight: on ? 700 : 500, transition: '.12s',
        }}>{d}{isAnchor && <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 8.5, color: 'var(--brand)' }}>★</span>}</button>
    );
  }
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 13px' }}>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m - 1; return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m }; })}>‹</button>
        <b style={{ fontSize: 15, textTransform: 'capitalize' }}>{monthName}</b>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m + 1; return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m }; })}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
        {dows.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--mut)', textTransform: 'uppercase', fontWeight: 600 }}>{w}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>{cells}</div>
      <div className="row between" style={{ alignItems: 'center', marginTop: 10 }}>
        <span className="muted" style={{ fontSize: 11.5 }}>{sel.length > 0
          ? L(`${sel.length + (anchorDate ? 1 : 0)} días · misma hora ${timeStr || ''}`, `${sel.length + (anchorDate ? 1 : 0)} days · same time ${timeStr || ''}`)
          : L('Toca los días extra que quieras. Se van sombreando.', 'Tap the extra days you want. They shade in.')}</span>
        {sel.length > 0 && <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => onChange([])}>{L('Limpiar', 'Clear')}</button>}
      </div>
    </div>
  );
}

// Selector de fecha + hora colorido e intuitivo (con AM/PM), reemplaza al datetime-local nativo.
// Emite el mismo formato "YYYY-MM-DDTHH:mm" (hora local) que espera el resto del form.
function NiceDateTime({ value, onChange, L }: any) {
  const isEs = L('es', 'en') === 'es';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const datePart = (value || '').slice(0, 10);       // YYYY-MM-DD
  const timePart = (value || '').slice(11, 16);      // HH:mm
  const [open, setOpen] = useState(!datePart);
  const [view, setView] = useState(() => { const d = datePart ? new Date(datePart + 'T00:00') : new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const h24 = timePart ? parseInt(timePart.slice(0, 2), 10) : null;
  const minute = timePart ? timePart.slice(3, 5) : '00';
  const ampm: 'AM' | 'PM' = h24 == null ? 'PM' : (h24 >= 12 ? 'PM' : 'AM');
  const h12 = h24 == null ? 7 : (h24 % 12 === 0 ? 12 : h24 % 12);

  const emit = (dKey: string, hour12: number, min: string, ap: 'AM' | 'PM') => {
    const hh = ap === 'PM' ? (hour12 % 12) + 12 : (hour12 % 12);
    onChange(`${dKey}T${String(hh).padStart(2, '0')}:${min}`);
  };
  const pickDay = (dKey: string) => emit(dKey, timePart ? h12 : 7, timePart ? minute : '00', timePart ? ampm : 'PM');
  const setTime = (hour12: number, min: string, ap: 'AM' | 'PM') => { if (datePart) emit(datePart, hour12, min, ap); };

  // Resumen legible del valor elegido.
  let summary = '';
  if (datePart) {
    const d = new Date((value || (datePart + 'T00:00')));
    const ds = d.toLocaleDateString(isEs ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const ts = timePart ? `${h12}:${minute} ${ampm}` : (isEs ? 'elige hora' : 'pick time');
    summary = `${ds} · ${ts}`;
  }

  // Rejilla del mes.
  const toKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString(isEs ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
  const dows = isEs ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells: any[] = [];
  for (let i = 0; i < startDow; i++) cells.push(<div key={'e' + i} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(view.y, view.m, d);
    const dt = new Date(view.y, view.m, d);
    const past = dt < today;
    const on = key === datePart;
    const isToday = dt.getTime() === today.getTime();
    cells.push(
      <button type="button" key={key} disabled={past} onClick={() => pickDay(key)}
        style={{
          height: 40, borderRadius: 10,
          border: '1px solid ' + (on ? 'var(--brand)' : isToday ? 'color-mix(in srgb,var(--brand) 45%,var(--line))' : 'var(--line)'),
          background: on ? 'linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 60%,#000))' : 'var(--card)',
          color: on ? '#fff' : past ? 'var(--mut)' : 'var(--tx)', opacity: past ? 0.3 : 1,
          cursor: past ? 'default' : 'pointer', fontSize: 14, fontWeight: on ? 800 : 500,
          boxShadow: on ? '0 4px 14px -4px var(--brand)' : 'none', transition: '.12s', position: 'relative',
        }}>{d}{isToday && !on && <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 4, background: 'var(--brand)' }} />}</button>
    );
  }

  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  const selCss = { padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 15, fontWeight: 700, margin: 0, cursor: 'pointer' } as any;
  const apBtn = (ap: 'AM' | 'PM') => (
    <button type="button" key={ap} onClick={() => setTime(h12, minute, ap)}
      style={{
        flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: '.12s',
        border: '1px solid ' + (ampm === ap ? 'var(--brand)' : 'var(--line)'),
        background: ampm === ap ? 'linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 60%,#000))' : 'var(--card)',
        color: ampm === ap ? '#fff' : 'var(--mut)',
      }}>{ap}</button>
  );

  return (
    <div style={{ marginTop: 4 }}>
      {/* Chip resumen: abre/cierra el panel */}
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12,
          border: '1px solid ' + (datePart ? 'var(--brand)' : 'var(--line)'), cursor: 'pointer', textAlign: 'left',
          background: datePart ? 'color-mix(in srgb,var(--brand) 12%,var(--card))' : 'var(--card)', color: 'var(--tx)',
        }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 55%,#000))', flexShrink: 0 }}><OnyxIcon name="calendar" size={16} /></span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: datePart ? 700 : 500, color: datePart ? 'var(--tx)' : 'var(--mut)', textTransform: 'capitalize' }}>
          {summary || L('Elige fecha y hora', 'Pick date & time')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--mut)', transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }}>▾</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 13px' }}>
          <div className="row between" style={{ alignItems: 'center', marginBottom: 10 }}>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m - 1; return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m }; })}>‹</button>
            <b style={{ fontSize: 15, textTransform: 'capitalize' }}>{monthName}</b>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 18, lineHeight: 1 }} onClick={() => setView((v) => { const m = v.m + 1; return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m }; })}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
            {dows.map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--mut)', textTransform: 'uppercase', fontWeight: 600 }}>{w}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>{cells}</div>

          {/* Hora con AM/PM */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4, fontWeight: 700 }}>{L('Hora', 'Time')}</div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={h12} onChange={(e) => setTime(Number(e.target.value), minute, ampm)} style={{ ...selCss, minWidth: 62 }} disabled={!datePart}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <b style={{ fontSize: 18 }}>:</b>
              <select value={minute} onChange={(e) => setTime(h12, e.target.value, ampm)} style={{ ...selCss, minWidth: 66 }} disabled={!datePart}>
                {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="row" style={{ gap: 6, flex: '1 1 120px', minWidth: 120 }}>{apBtn('AM')}{apBtn('PM')}</div>
            </div>
            {!datePart && <div className="muted" style={{ fontSize: 11, marginTop: 7 }}>{L('Primero elige un día en el calendario.', 'Pick a day on the calendar first.')}</div>}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 18px' }} onClick={() => setOpen(false)} disabled={!datePart}>{L('Listo', 'Done')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventForm({ form, setForm, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  // Solo bloqueamos fecha pasada al CREAR. Al editar una clase ya pasada se permite (ej: añadir grabación).
  const isPastNew = !form.id && form.starts_at && form.starts_at.length >= 16 && (() => { try { return new Date(form.starts_at).getTime() < Date.now() - 60000; } catch { return false; } })();
  return (
    <Modal onClose={onCancel}><div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar clase', 'Edit class') : L('Programar clase en vivo', 'Schedule live class')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder={L('Título', 'Title')} style={{ margin: 0 }} />
        <input value={form.join_url || ''} onChange={(e) => set('join_url', e.target.value)} placeholder={L('Link para entrar (Zoom, Meet o YouTube Live)', 'Join link (Zoom, Meet or YouTube Live)')} style={{ margin: 0 }} />
        <div className="muted" style={{ fontSize: 11.5, marginTop: -2 }}>{L('Si pones un link de YouTube Live, se ve incrustado dentro de la academia.', 'A YouTube Live link plays embedded inside the academy.')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 260px', minWidth: 240 }}><span className="muted" style={{ fontSize: 12 }}>{L('Fecha y hora (tu hora local)', 'Date & time (your local time)')}</span><NiceDateTime value={form.starts_at || ''} onChange={(v: string) => set('starts_at', v)} L={L} />{form.starts_at && form.starts_at.length >= 16 && (() => { try { const utc = new Date(form.starts_at).toISOString(); return <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>{L('Cada alumno la verá en SU hora. Referencia:', 'Each student sees it in THEIR time. Reference:')} {refTimes(utc, L('es', 'en'))}</div>; } catch { return null; } })()}</div>
          <div><span className="muted" style={{ fontSize: 12 }}>{L('Duración (min)', 'Duration (min)')}</span><input type="number" value={form.duration_min ?? 60} onChange={(e) => set('duration_min', Number(e.target.value))} style={{ margin: '4px 0 0', width: 100 }} /></div>
        </div>
        {!form.id && (
          <div>
            <span className="muted" style={{ fontSize: 12 }}>{L('¿Varias clases? Marca más días (mismo horario)', 'Multiple classes? Mark more days (same time)')}</span>
            <div style={{ marginTop: 6 }}>
              <MultiDayPicker
                selected={form.dates || []}
                onChange={(d: string[]) => set('dates', d)}
                timeStr={(form.starts_at || '').slice(11, 16)}
                anchorDate={(form.starts_at || '').slice(0, 10) || null}
                L={L}
              />
            </div>
            {(form.dates || []).length > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L(`Se crearán ${(form.dates || []).length + 1} clases (el día principal ★ + los marcados), todas a la misma hora.`, `${(form.dates || []).length + 1} classes will be created (main day ★ + marked ones), all at the same time.`)}</div>}
          </div>
        )}
        <input value={form.recording_url || ''} onChange={(e) => set('recording_url', e.target.value)} placeholder={L('Link de la grabación (YouTube/Vimeo/.mp4) — opcional', 'Recording link (YouTube/Vimeo/.mp4) — optional')} style={{ margin: 0 }} />
        <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={2} placeholder={L('Descripción (opcional)', 'Description (optional)')} style={{ width: '100%', margin: 0 }} />
        {isPastNew && <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="⚠️" size={13} /> {L('Esa fecha y hora ya pasó. Elige un momento futuro.', 'That date and time is in the past. Pick a future moment.')}</div>}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.title || !form.starts_at || isPastNew}>{L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div></Modal>
  );
}

function CoverForm({ form, setForm, onSave, onCancel, L }: any) {
  return (
    <Modal onClose={onCancel}><div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{L('Portada del aula', 'Classroom cover')} · {form.title}</h3>
      <ImageUpload value={form.cover_url || ''} onChange={(v: string) => setForm({ ...form, cover_url: v })} L={L} label={L('Miniatura del curso (sube una imagen)', 'Course thumbnail (upload an image)')} />
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)}>{L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div></Modal>
  );
}

function LessonForm({ form, setForm, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  return (
    <Modal onClose={onCancel}><div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar lección', 'Edit lesson') : L('Nueva lección', 'New lesson')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder={L('Título de la lección', 'Lesson title')} style={{ margin: 0 }} />
        <input value={form.section || ''} onChange={(e) => set('section', e.target.value)} placeholder={L('Sección/tema (ej: Fundamentos) — opcional', 'Section/topic (e.g. Fundamentals) — optional')} style={{ margin: 0 }} />
        <input value={form.video_url || ''} onChange={(e) => set('video_url', e.target.value)} placeholder={L('URL del vídeo (YouTube, Vimeo o .mp4)', 'Video URL (YouTube, Vimeo or .mp4)')} style={{ margin: 0 }} />
        <div>
          <input value={form.pdf_url || ''} onChange={(e) => set('pdf_url', e.target.value)} placeholder={L('URL del PDF (se ve página por página)', 'PDF URL (viewed page by page)')} style={{ margin: 0 }} />
          <div className="row" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}><span className="muted" style={{ fontSize: 11.5 }}>{L('O sube un PDF:', 'Or upload a PDF:')}</span><PdfUpload onUrl={(u: string) => set('pdf_url', u)} L={L} />{form.pdf_url && <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => set('pdf_url', '')}>{L('Quitar PDF', 'Remove PDF')}</button>}</div>
          {form.pdf_url && <label className="row" style={{ gap: 8, fontSize: 12.5, marginTop: 6, cursor: 'pointer' }}><input type="checkbox" checked={form.pdf_download !== false} onChange={(e) => set('pdf_download', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Permitir que el alumno descargue el PDF', 'Let students download the PDF')}</label>}
        </div>
        <div className="row between" style={{ alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Notas de la lección (opcional)', 'Lesson notes (optional)')}</span><AiBtn kind="lesson_desc" getInput={() => form.title} onText={(t: string) => set('content', t)} L={L} /></div>
        <textarea value={form.content || ''} onChange={(e) => set('content', e.target.value)} rows={4} placeholder={L('Escribe o pulsa ✨ IA (usa el título como contexto).', 'Write or hit ✨ AI (uses the title as context).')} style={{ width: '100%', margin: 0 }} />
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={!!form.is_free} onChange={(e) => set('is_free', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Lección gratis (preview sin inscribirse)', 'Free lesson (preview without enrolling)')}</label>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.title}>{L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div></Modal>
  );
}

function MentorSettings({ mentor, onSave, L }: any) {
  const [f, setF] = useState({
    academy_name: mentor.academy_name, tagline: mentor.tagline || '', about: mentor.about || '', cover_url: mentor.cover_url || '', logo_url: mentor.logo_url || '',
    intro_video_url: mentor.intro_video_url || '', pitch: mentor.pitch || '',
    brand_info: mentor.brand_info || '', ai_emojis: mentor.ai_emojis !== false, socials: { ...(mentor.socials || {}) } as any,
    assistant_kb: mentor.assistant_kb || '', assistant_on: !!mentor.assistant_on,
    membership_price: ((mentor.membership_price_cents || 0) / 100).toString(), membership_year: ((mentor.membership_year_cents || 0) / 100).toString(), membership_currency: mentor.membership_currency || 'usd', membership_interval: mentor.membership_interval || 'month',
    subs_open: mentor.subs_open !== false, subs_reopen_at: mentor.subs_reopen_at ? new Date(mentor.subs_reopen_at).toISOString().slice(0, 16) : '', subs_closed_note: mentor.subs_closed_note || '',
  });
  const setSocial = (k: string, v: string) => setF((s: any) => ({ ...s, socials: { ...s.socials, [k]: v } }));
  // Guarda los ajustes (usado por el botón y por el auto-guardado de imágenes/nombre/branding).
  const commit = (extra: any = {}) => { const m = { ...f, ...extra }; onSave({ ...m, membership_price_cents: Math.round(Number(m.membership_price) * 100), membership_year_cents: Math.round(Number(m.membership_year) * 100), subs_reopen_at: m.subs_open ? '' : m.subs_reopen_at }); };
  // La guía interactiva puede pedir que Onyx AI escriba un texto DIRECTO en un campo (con todo
  // el espacio, sin recortes). Lo recibimos aquí, lo ponemos en el campo y lo guardamos.
  useEffect(() => {
    const onFill = (e: any) => { const { field, text } = e.detail || {}; if (!field || typeof text !== 'string') return; setF((s: any) => ({ ...s, [field]: text })); commit({ [field]: text }); };
    window.addEventListener('onyx-ai-fill', onFill as any);
    return () => window.removeEventListener('onyx-ai-fill', onFill as any);
  }, [f]); // eslint-disable-line
  const link = typeof window !== 'undefined' ? `${window.location.origin}/academia/${mentor.code}` : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="sk-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}><span className="card-ic"><OnyxIcon name="settings" size={16} /></span> {L('Ajustes de la academia', 'Academy settings')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div data-onb="name"><span className="muted" style={{ fontSize: 12 }}>{L('Nombre', 'Name')}</span><input value={f.academy_name} onChange={(e) => setF({ ...f, academy_name: e.target.value })} onBlur={() => { if (f.academy_name.trim()) commit(); }} style={{ margin: '4px 0 0' }} /></div>
          <div>
            <div className="row between" style={{ alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Lema', 'Tagline')}</span><AiBtn kind="tagline" getInput={() => `${f.academy_name}. ${f.about}`} onText={(t: string) => setF((s: any) => ({ ...s, tagline: t }))} L={L} /></div>
            <input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} style={{ margin: '4px 0 0' }} />
          </div>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 220px' }} data-onb="cover"><ImageUpload value={f.cover_url} onChange={(v: string) => { setF({ ...f, cover_url: v }); if (v) commit({ cover_url: v }); }} L={L} label={L('Portada de la comunidad', 'Community cover')} /></div>
            <div style={{ flex: '0 0 auto' }} data-onb="logo">
              <span className="muted" style={{ fontSize: 12 }}>{L('Logo / foto (reemplaza el ícono)', 'Logo / photo (replaces the icon)')}</span>
              <div className="row" style={{ gap: 10, marginTop: 6, alignItems: 'center' }}>
                <span className="sk-hero-logo" style={{ margin: 0, width: 56, height: 56 }}>{f.logo_url ? <img src={f.logo_url} alt="" /> : <OnyxIcon name="graduation" size={26} />}</span>
                <div><ImageUpload value={''} onChange={(v: string) => { setF({ ...f, logo_url: v }); if (v) commit({ logo_url: v }); }} L={L} />{f.logo_url && <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }} onClick={() => { setF({ ...f, logo_url: '' }); commit({ logo_url: '' }); }}>{L('Quitar logo', 'Remove logo')}</button>}</div>
              </div>
            </div>
          </div>
          <div>
            <div className="row between" style={{ alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Sobre la academia', 'About')}</span><AiBtn kind="about" getInput={() => `${f.academy_name}. ${f.tagline}`} onText={(t: string) => setF((s: any) => ({ ...s, about: t }))} L={L} /></div>
            <textarea value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} rows={3} style={{ width: '100%', margin: '4px 0 0' }} />
          </div>
        </div>
      </div>

      {/* Branding: info para el AI + redes sociales + toggle emojis */}
      <div className="sk-card" data-onb="branding">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><span className="card-ic"><OnyxIcon name="gem" size={16} /></span> {L('Branding y AI', 'Branding & AI')}</h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Cuéntale a Onyx AI quién eres y tu estilo. Lo usará para escribir en tu voz (about, lemas, posts, ventas).', 'Tell Onyx AI who you are and your style. It will write in your voice (about, taglines, posts, sales).')}</p>
        <textarea value={f.brand_info} onChange={(e) => setF({ ...f, brand_info: e.target.value })} onBlur={() => { if (f.brand_info.trim()) commit(); }} rows={4} placeholder={L('Ej: Soy trader de forex desde 2016, enseño price action con enfoque en disciplina. Tono cercano y directo, sin promesas.', 'e.g. I’m a forex trader since 2016, I teach price action focused on discipline. Warm, direct tone, no promises.')} style={{ width: '100%', margin: 0 }} />
        <label className="row" style={{ gap: 8, fontSize: 13, marginTop: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!f.ai_emojis} onChange={(e) => setF({ ...f, ai_emojis: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
          {L('Que el AI use emojis en los textos', 'Let AI use emojis in copy')}
        </label>
        <div className="muted" style={{ fontSize: 12, margin: '14px 0 8px' }}>{L('Redes sociales (usuario o enlace). Aparecen en tu comunidad y página de ventas.', 'Social links (handle or URL). Shown on your community and sales page.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
          {SOCIAL.map((s) => (
            <div key={s.key} className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: BRAND_COLOR[s.key] || s.color, flex: 'none' }}><BrandIcon name={s.key} size={16} /></span>
              <input value={f.socials[s.key] || ''} onChange={(e) => setSocial(s.key, e.target.value)} placeholder={s.label} style={{ margin: 0, flex: 1 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Asistente AI del alumno (base de conocimiento del mentor) */}
      <div className="sk-card">
        <div className="row between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="card-ic"><OnyxIcon name="ai" size={16} /></span> {L('Asistente AI de tus alumnos', 'Your students’ AI assistant')}</h3>
          <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={!!f.assistant_on} onChange={(e) => setF({ ...f, assistant_on: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {L('Activar', 'Enable')}</label>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{L('Pega tu guía / preguntas frecuentes. El asistente responderá a tus alumnos usando SOLO esto (no inventa). Si algo no está, les dice que te pregunten a ti.', 'Paste your guide / FAQ. The assistant answers your students using ONLY this (it won’t make things up). If something isn’t here, it tells them to ask you.')}</p>
        <textarea value={f.assistant_kb} onChange={(e) => setF({ ...f, assistant_kb: e.target.value })} rows={7} placeholder={L('Ej: Horario de clases, cómo conectar la cuenta, reglas de la comunidad, tu estrategia en resumen, preguntas frecuentes con sus respuestas…', 'e.g. Class schedule, how to connect an account, community rules, your strategy summary, FAQs with answers…')} style={{ width: '100%', margin: 0 }} />
      </div>

      <div className="sk-card" style={{ border: '1px solid color-mix(in srgb,var(--gold) 35%,transparent)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><span className="card-ic" style={{ color: 'var(--gold)' }}><OnyxIcon name="coins" size={16} /></span> {L('Membresía y página de ventas', 'Membership & sales page')}</h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Cobra una mensualidad para entrar a la comunidad. Deja 0 para que sea gratis. Necesitas conectar Stripe en Cobros.', 'Charge a monthly fee to enter the community. Leave 0 for free. You must connect Stripe in Payments.')}</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><span className="muted" style={{ fontSize: 12 }}>{L('Precio mensual', 'Monthly price')}</span><input type="number" min={0} step="0.01" value={f.membership_price} onChange={(e) => setF({ ...f, membership_price: e.target.value })} style={{ margin: '4px 0 0', width: 120 }} /></div>
          <div><span className="muted" style={{ fontSize: 12 }}>{L('Precio anual (opcional)', 'Annual price (optional)')}</span><input type="number" min={0} step="0.01" value={f.membership_year} onChange={(e) => setF({ ...f, membership_year: e.target.value })} placeholder={L('con descuento', 'discounted')} style={{ margin: '4px 0 0', width: 140 }} /></div>
          <span className="sk-chip" style={{ alignSelf: 'flex-end', padding: '9px 12px' }}>USD</span>
        </div>
        {Number(f.membership_price) > 0 && Number(f.membership_year) > 0 && (
          <div className="muted" style={{ fontSize: 12, marginTop: 6, color: 'var(--soft-green)' }}>{L('Los alumnos ahorran', 'Students save')} {Math.max(0, Math.round((1 - (Number(f.membership_year) / (Number(f.membership_price) * 12))) * 100))}% {L('con el plan anual.', 'with the annual plan.')}</div>
        )}
        <div className="sk-side-card" style={{ marginTop: 12, background: 'var(--bg2)' }}>
          <div className="row between" style={{ marginBottom: 4 }}><b style={{ fontSize: 13 }}>🎟️ {L('Cupones de lanzamiento', 'Launch coupons')}</b></div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{L('Crea cupones de descuento en tu panel de Stripe (Productos → Cupones / Códigos promocionales). Tus alumnos podrán aplicarlos en el checkout automáticamente.', 'Create discount coupons in your Stripe dashboard (Products → Coupons / Promotion codes). Students can apply them at checkout automatically.')}</p>
        </div>
        <div style={{ marginTop: 12 }}><span className="muted" style={{ fontSize: 12 }}>{L('Video de presentación (YouTube/Vimeo/.mp4)', 'Intro video (YouTube/Vimeo/.mp4)')}</span><input value={f.intro_video_url} onChange={(e) => setF({ ...f, intro_video_url: e.target.value })} placeholder="https://youtu.be/…" style={{ margin: '4px 0 0' }} /></div>
        <div style={{ marginTop: 10 }}>
          <div className="row between" style={{ alignItems: 'center' }}><span className="muted" style={{ fontSize: 12 }}>{L('Texto de ventas (qué incluye, casos de éxito…)', 'Sales copy (what’s included, testimonials…)')}</span><AiBtn kind="pitch" getInput={() => `${f.academy_name}. ${f.tagline}. ${f.about}`} onText={(t: string) => setF((s: any) => ({ ...s, pitch: t }))} L={L} /></div>
          <textarea value={f.pitch} onChange={(e) => setF({ ...f, pitch: e.target.value })} rows={6} placeholder={L('Escríbelo o pulsa ✨ IA para que Onyx AI te lo genere.', 'Write it or hit ✨ AI to let Onyx AI generate it.')} style={{ width: '100%', margin: '4px 0 0' }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>{L('Tu página de ventas:', 'Your sales page:')}</span>
          <a href={link} target="_blank" rel="noreferrer" className="sk-chip">{link}</a>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigator.clipboard.writeText(link)}>{L('Copiar', 'Copy')}</button>
        </div>
      </div>

      <div className="sk-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><span className="card-ic"><OnyxIcon name="guardian" size={16} /></span> {L('Puertas de la academia (nuevas suscripciones)', 'Academy doors (new subscriptions)')}</h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Controla si aceptas nuevos alumnos. Los que ya están dentro no se ven afectados. Ideal para lanzamientos por rondas.', 'Control whether you accept new students. Existing members are unaffected. Great for cohort launches.')}</p>
        <label className="row" style={{ gap: 10, alignItems: 'center', fontSize: 14, marginBottom: 10 }}>
          <input type="checkbox" checked={!!f.subs_open} onChange={(e) => setF({ ...f, subs_open: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
          {f.subs_open ? L('Abiertas — cualquiera puede unirse', 'Open — anyone can join') : L('Cerradas — no entran nuevos', 'Closed — no new members')}
        </label>
        {!f.subs_open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '3px solid var(--gold)', paddingLeft: 12 }}>
            <div><span className="muted" style={{ fontSize: 12 }}>{L('Fecha de reapertura (opcional) — se muestra un countdown', 'Reopen date (optional) — shows a countdown')}</span><input type="datetime-local" value={f.subs_reopen_at} onChange={(e) => setF({ ...f, subs_reopen_at: e.target.value })} style={{ margin: '4px 0 0' }} /></div>
            <div><span className="muted" style={{ fontSize: 12 }}>{L('Mensaje al visitante (opcional)', 'Message to visitors (optional)')}</span><input value={f.subs_closed_note} onChange={(e) => setF({ ...f, subs_closed_note: e.target.value })} placeholder={L('Ej: Abrimos cupos el 1 de cada mes', 'e.g. We open spots on the 1st each month')} style={{ margin: '4px 0 0' }} /></div>
            <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>{L('Los visitantes verán el countdown y podrán apuntarse a la lista de espera para avisarles.', 'Visitors see the countdown and can join a waitlist to be notified.')}</p>
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={() => onSave({ ...f, membership_price_cents: Math.round(Number(f.membership_price) * 100), membership_year_cents: Math.round(Number(f.membership_year) * 100), subs_reopen_at: f.subs_open ? '' : f.subs_reopen_at })}>{L('Guardar', 'Save')}</button>
    </div>
  );
}

// =================== Ingresos del mentor (saldo, payouts, ventas) ===================
function MentorEarnings({ L }: { L: (a: string, b: string) => string }) {
  const es = L('es', 'en') === 'es';
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/academy/earnings').then((r) => r.json()).then(setD).catch(() => setD({})); }, []);
  function money(c: number | null | undefined, cur = 'usd') {
    if (c == null) return '—'; const s = (cur || 'usd').toUpperCase(); const sym = s === 'USD' ? '$' : s === 'EUR' ? '€' : '';
    const n = (c / 100).toLocaleString(es ? 'es-ES' : 'en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
    return sym ? sym + n : n + ' ' + s;
  }
  function when(iso: string | null, t = false) { if (!iso) return '—'; try { const dt = new Date(iso); const dd = dt.toLocaleDateString(es ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }); return t ? dd + ' · ' + dt.toLocaleTimeString(es ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : dd; } catch { return '—'; } }
  const poStatus = (s: string) => s === 'paid' ? L('pagado', 'paid') : s === 'in_transit' ? L('en camino', 'in transit') : s === 'pending' ? L('pendiente', 'pending') : s === 'failed' ? L('fallido', 'failed') : s;
  if (!d) return null;
  const bal = d.balance; const payouts = d.payouts || []; const sales = d.sales || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '0 0 12px' }}>
      {/* Saldo en Stripe */}
      {bal && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <div className="statcard"><div className="statcard-ic" style={{ color: 'var(--soft-green)' }}><OnyxIcon name="coins" /></div><div><div className="sc-lbl">{L('Saldo disponible', 'Available balance')}</div><div className="sc-val">{money(bal.available, bal.currency)}</div></div></div>
          <div className="statcard"><div className="statcard-ic" style={{ color: 'var(--gold)' }}><OnyxIcon name="duration" /></div><div><div className="sc-lbl">{L('Pendiente de liberar', 'Pending')}</div><div className="sc-val">{money(bal.pending, bal.currency)}</div></div></div>
          <div className="statcard"><div className="statcard-ic"><OnyxIcon name="money" /></div><div><div className="sc-lbl">{L('Próximo depósito', 'Next payout')}</div><div className="sc-val" style={{ fontSize: 15 }}>{payouts.find((p: any) => p.status === 'pending' || p.status === 'in_transit') ? when(payouts.find((p: any) => p.status === 'pending' || p.status === 'in_transit').arrival) : L('según Stripe', 'per Stripe')}</div></div></div>
        </div>
      )}

      {/* Últimos depósitos (payouts) */}
      {payouts.length > 0 && (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, fontSize: 15 }}><span className="card-ic"><OnyxIcon name="money" size={15} /></span> {L('Depósitos a tu banco', 'Payouts to your bank')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {payouts.map((p: any, i: number) => (
              <div key={i} className="row between" style={{ fontSize: 13, alignItems: 'center' }}>
                <span className="muted">{when(p.arrival || p.created)}</span>
                <span className="row" style={{ gap: 10, alignItems: 'center' }}><b>{money(p.amount_cents, p.currency)}</b><span className="sk-chip" style={{ fontSize: 10.5, background: p.status === 'paid' ? 'color-mix(in srgb,var(--green) 15%,transparent)' : 'var(--card2)', color: p.status === 'paid' ? 'var(--soft-green)' : 'var(--mut)' }}>{poStatus(p.status)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ventas (quién pagó, cuánto, comisión, neto) */}
      {sales.length > 0 && (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, fontSize: 15 }}><span className="card-ic" style={{ color: 'var(--gold)' }}><OnyxIcon name="cart" size={15} /></span> {L('Ventas', 'Sales')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sales.slice(0, 20).map((s: any, i: number) => (
              <div key={i} className="row between" style={{ alignItems: 'center', gap: 8, borderTop: i ? '1px solid var(--line)' : 'none', paddingTop: i ? 8 : 0 }}>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.student}</div><div className="muted" style={{ fontSize: 11.5 }}>{s.product} · {when(s.date, true)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 14, fontWeight: 700 }}>{money(s.net_cents, s.currency)}</div><div className="muted" style={{ fontSize: 11 }}>{money(s.gross_cents, s.currency)} − {money(s.fee_cents, s.currency)} {L('Onyx', 'Onyx')}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =================== Cobros del mentor ===================
function MentorPayments({ modules, L, onChanged }: { modules: any[]; L: (a: string, b: string) => string; onChanged?: () => void }) {
  const [conn, setConn] = useState<any>(null);
  const [prods, setProds] = useState<any[]>([]);
  const [earn, setEarn] = useState<any>(null);
  const [subs, setSubs] = useState<any>(null);
  const [ents, setEnts] = useState<any[]>([]);
  const [affData, setAffData] = useState<any>(null);
  const [affForm, setAffForm] = useState<any>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState<any>(null);

  async function load() {
    const [c, p, a] = await Promise.all([
      fetch('/api/academy/connect').then((r) => r.json()).catch(() => ({})),
      fetch('/api/academy/products').then((r) => r.json()).catch(() => ({})),
      fetch('/api/academy/affiliate').then((r) => r.json()).catch(() => null),
    ]);
    setConn(c); setProds(p.products || []); setEarn(p.earnings || null); setSubs(p.subStats || null); setEnts(p.entitlements || []);
    if (a && a.settings) { setAffData(a); const s = a.settings; setAffForm({ type: s.type, reward: (s.reward_cents / 100).toString(), pct: String(s.pct || 0), recurring: !!s.recurring, hold_days: String(s.hold_days), min: (s.min_cents / 100).toString(), rail: s.rail, methods: s.payout_methods && s.payout_methods.length ? s.payout_methods : ['paypal', 'zelle', 'crypto'] }); }
  }
  useEffect(() => { load(); }, []);
  async function connect() { setBusy('connect'); const r = await fetch('/api/academy/connect', { method: 'POST' }); const j = await r.json(); if (j.url) window.location.href = j.url; else { setBusy(''); alert(L('No se pudo conectar Stripe.', 'Could not connect Stripe.')); } }
  async function saveProd(f: any) { setBusy('prod'); const body: any = { ...f, price_cents: Math.round(Number(f.price) * 100) }; delete body.price; await fetch('/api/academy/products', { method: 'POST', body: JSON.stringify(body) }); setBusy(''); setForm(null); load(); onChanged?.(); }
  async function delProd(id: string) { if (!await confirmDelete({ title: L('¿Borrar nivel?', 'Delete tier?'), message: L('Se dejará de vender este nivel.', 'This tier will stop being sold.') })) return; await fetch('/api/academy/products', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) }); load(); onChanged?.(); }
  async function saveAff() {
    if (!affForm) return; setBusy('aff');
    await fetch('/api/academy/affiliate', { method: 'POST', body: JSON.stringify({ action: 'settings', type: affForm.type, reward_cents: Math.round(Number(affForm.reward) * 100), pct: Number(affForm.pct) || 0, recurring: !!affForm.recurring, hold_days: Number(affForm.hold_days) || 0, min_cents: Math.round(Number(affForm.min) * 100), rail: affForm.rail, payout_methods: affForm.methods, currency: 'usd' }) });
    setBusy(''); load();
  }
  async function doPay(referrerId: string, method: string, note: string) {
    setBusy('pay'); await fetch('/api/academy/affiliate', { method: 'POST', body: JSON.stringify({ action: 'pay', referrer_id: referrerId, method, note }) }); setBusy(''); setPayTarget(null); load();
  }
  function exportAff() {
    const rows = (affData?.referrers || []) as any[];
    const head = 'Referido,Metodo,Contacto,Disponible,En espera,Pagado\n';
    const body = rows.map((r) => [r.name, r.method?.method || '', r.method?.handle || '', (r.availableCents / 100).toFixed(2), (r.pendingCents / 100).toFixed(2), (r.paidCents / 100).toFixed(2)].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'afiliados.csv'; a.click(); URL.revokeObjectURL(url);
  }

  if (!conn) return <div className="sk-card muted">…</div>;
  const money = (c: number) => '$' + (Math.round((c || 0) / 100)).toLocaleString();

  return (
    <>
      <div className="sk-cardgrid">
      <div className="sk-card sk-span-all" data-onb="stripe">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}><span className="card-ic"><OnyxIcon name="card" size={16} /></span> {L('Cobros con Stripe', 'Payments with Stripe')}</h3>
        {conn.configured === false ? <p className="muted" style={{ fontSize: 13 }}>{L('Los cobros aún no están habilitados en la plataforma.', 'Payments are not enabled on the platform yet.')}</p>
          : conn.chargesEnabled ? <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>✓ {L('Conectado y cobrando', 'Connected & charging')}</span>{conn.dashboard && <a className="btn btn-ghost" href={conn.dashboard} target="_blank" rel="noreferrer">{L('Abrir mi panel de Stripe', 'Open my Stripe dashboard')}</a>}</div>
          : <><p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{conn.connected ? L('Termina de verificar tu cuenta de Stripe para empezar a cobrar.', 'Finish verifying your Stripe account to start charging.') : L('Conecta una cuenta de Stripe para cobrar a tus alumnos.', 'Connect a Stripe account to charge your students.')}</p><button className="btn btn-primary" disabled={busy === 'connect'} onClick={connect}>{busy === 'connect' ? '…' : (conn.connected ? L('Continuar verificación', 'Continue verification') : L('Conectar Stripe', 'Connect Stripe'))}</button></>}
      </div>
      {earn && (
        <div className="sk-span-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {[[L('Ventas', 'Sales'), String(earn.sales || 0), 'cart'], [L('Bruto', 'Gross'), money(earn.grossCents), 'coins'], [L('Comisión Onyx', 'Onyx fee'), money(earn.feeCents), 'gem'], [L('Tu neto', 'Your net'), money(earn.netCents), 'money']].map(([lbl, val, ic]) => (
            <div key={lbl} className="statcard"><div className="statcard-ic"><OnyxIcon name={ic as any} /></div><div><div className="sc-lbl">{lbl}</div><div className="sc-val">{val}</div></div></div>
          ))}
        </div>
      )}
      {subs && (
        <div className="sk-span-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {[[L('Suscripciones activas', 'Active subs'), String(subs.activeMembers || 0), 'users', 'var(--soft-green)'], [L('Cancelados', 'Canceled'), String(subs.canceled || 0), 'lock', 'var(--red)'], [L('MRR estimado', 'Est. MRR'), money(subs.mrrCents), 'coins', 'var(--gold)']].map(([lbl, val, ic, col]) => (
            <div key={lbl} className="statcard"><div className="statcard-ic" style={{ color: col }}><OnyxIcon name={ic as any} /></div><div><div className="sc-lbl">{lbl}</div><div className="sc-val">{val}</div></div></div>
          ))}
        </div>
      )}
      {/* Detalle en vivo desde Stripe: saldo, depósitos a tu banco y ventas */}
      {conn.chargesEnabled && <div className="sk-span-all"><MentorEarnings L={L} /></div>}
      <SectionCard icon="gem" title={L('Niveles', 'Tiers')} summary={`${prods.length} ${L('niveles de pago', 'paid tiers')}`} wide>
        <div data-onb="tier" />
        <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}><span /><div className="row" style={{ gap: 6 }}><button className="btn btn-ghost" onClick={() => setForm({ name: L('Auditoría de mi plan', 'Plan audit'), kind: 'audit', interval: 'month', price: '', currency: 'usd', grants: [], active: true })}><OnyxIcon name="guardian" size={14} /> {L('Add-on auditoría', 'Audit add-on')}</button><button className="btn btn-primary" onClick={() => setForm({ name: '', kind: 'subscription', interval: 'month', price: '', currency: 'usd', grants: 'all', active: true })}>＋ {L('Nivel', 'Tier')}</button></div></div>
        {prods.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{L('Crea niveles como “Curso básico”, “VIP” o “Bootcamp”.', 'Create tiers like “Basic”, “VIP” or “Bootcamp”.')}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prods.map((p) => (
            <div key={p.id} className="row between" style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div><b style={{ fontSize: 14 }}>{p.name}</b>{!p.active && <span className="sk-chip" style={{ marginLeft: 6, color: 'var(--mut)', background: 'var(--card2)' }}>{L('inactivo', 'inactive')}</span>}<div className="muted" style={{ fontSize: 12 }}>{priceLabel(p, L)} · {p.grants === 'all' ? L('todas las aulas', 'all classrooms') : (Array.isArray(p.grants) ? p.grants.length : 0) + ' ' + L('aulas', 'classrooms')}</div></div>
              <div className="row" style={{ gap: 6 }}><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setForm({ ...p, price: (p.price_cents / 100).toString() })}>✎</button><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => delProd(p.id)}>✕</button></div>
            </div>
          ))}
        </div>
        {form && <TierForm form={form} setForm={setForm} modules={modules} busy={busy === 'prod'} onSave={saveProd} onCancel={() => setForm(null)} L={L} />}
      </SectionCard>

      {/* Afiliados del mentor · ajustes + pagos */}
      {affForm && (
        <SectionCard icon="gift" title={L('Afiliados y pagos', 'Affiliates & payouts')} summary={L('Comisiones y pagos a los alumnos que traen alumnos', 'Rewards and payouts to students who bring students')} wide>
          <div className="row between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <span />
            {(affData?.referrers?.length > 0) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportAff}><OnyxIcon emoji="⬇️" size={13} /> {L('Exportar CSV', 'Export CSV')}</button>}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{L('Premia a los miembros que traigan alumnos que paguen. Elige cómo pagas: crédito automático en la academia o pago manual (PayPal, Zelle, efectivo…).', 'Reward members who bring paying students. Choose how you pay: automatic academy credit or manual payout (PayPal, Zelle, cash…).')}</p>

          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
            {[[L('Por cobrar', 'Ready to pay'), money(affData?.totals?.availableCents || 0), 'var(--gold)'], [L('En espera', 'On hold'), money(affData?.totals?.pendingCents || 0), 'var(--mut)'], [L('Pagado', 'Paid'), money(affData?.totals?.paidCents || 0), 'var(--soft-green)']].map(([lbl, val, col]) => (
              <div key={lbl} className="statcard"><div><div className="sc-lbl">{lbl}</div><div className="sc-val" style={{ color: col }}>{val}</div></div></div>
            ))}
          </div>

          {/* Ajustes */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px', marginBottom: 14 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <span className="muted" style={{ fontSize: 12 }}>{L('Recompensa', 'Reward')}</span>
                <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', margin: '4px 0 0' }}>
                  {[['flat', L('$ fijo', '$ flat')], ['pct', L('% de la venta', '% of sale')]].map(([k, lbl]) => (
                    <button key={k} className="btn" style={{ borderRadius: 0, border: 'none', padding: '6px 12px', fontSize: 12.5, background: affForm.type === k ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'transparent', color: affForm.type === k ? 'var(--brand)' : 'var(--mut)' }} onClick={() => setAffForm({ ...affForm, type: k })}>{lbl}</button>
                  ))}
                </div>
              </div>
              {affForm.type === 'flat'
                ? <div><span className="muted" style={{ fontSize: 12 }}>{L('Monto (USD)', 'Amount (USD)')}</span><input type="number" min={0} step="0.01" value={affForm.reward} onChange={(e) => setAffForm({ ...affForm, reward: e.target.value })} style={{ margin: '4px 0 0', width: 110 }} /></div>
                : <div><span className="muted" style={{ fontSize: 12 }}>{L('Porcentaje', 'Percent')}</span><input type="number" min={0} max={90} step="1" value={affForm.pct} onChange={(e) => setAffForm({ ...affForm, pct: e.target.value })} style={{ margin: '4px 0 0', width: 90 }} /></div>}
              <div><span className="muted" style={{ fontSize: 12 }}>{L('Espera (días)', 'Hold (days)')}</span><input type="number" min={0} max={120} value={affForm.hold_days} onChange={(e) => setAffForm({ ...affForm, hold_days: e.target.value })} style={{ margin: '4px 0 0', width: 90 }} /></div>
              <div><span className="muted" style={{ fontSize: 12 }}>{L('Mínimo (USD)', 'Minimum (USD)')}</span><input type="number" min={0} step="0.01" value={affForm.min} onChange={(e) => setAffForm({ ...affForm, min: e.target.value })} style={{ margin: '4px 0 0', width: 100 }} /></div>
              <div><span className="muted" style={{ fontSize: 12 }}>{L('Cómo pagas', 'Payout rail')}</span><br /><select value={affForm.rail} onChange={(e) => setAffForm({ ...affForm, rail: e.target.value })} style={{ margin: '4px 0 0' }}><option value="manual">{L('Pago manual', 'Manual payout')}</option><option value="credit">{L('Crédito automático', 'Auto credit')}</option></select></div>
            </div>
            <label className="row" style={{ gap: 8, fontSize: 12.5, cursor: 'pointer', marginTop: 10 }}>
              <input type="checkbox" checked={!!affForm.recurring} onChange={(e) => setAffForm({ ...affForm, recurring: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
              {L('Pagar también en cada renovación (no solo el primer pago)', 'Pay on every renewal too (not just the first payment)')}
            </label>
            {affForm.rail === 'manual' && (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Métodos de cobro que ofrezco', 'Payout methods I offer')}</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {([['paypal', 'PayPal'], ['zelle', 'Zelle'], ['crypto', L('Cripto', 'Crypto')], ['bank', L('Banco', 'Bank')], ['cash', L('Efectivo', 'Cash')], ['other', L('Otro', 'Other')]] as [string, string][]).map(([k, lbl]) => {
                    const on = (affForm.methods || []).includes(k);
                    return (
                      <label key={k} className="sk-chip" style={{ cursor: 'pointer', gap: 6, background: on ? 'color-mix(in srgb,var(--brand) 16%,transparent)' : 'var(--bg2)', color: on ? 'var(--brand)' : 'var(--mut)', border: '1px solid var(--line)' }}>
                        <input type="checkbox" checked={on} onChange={(e) => { const cur = new Set(affForm.methods || []); e.target.checked ? cur.add(k) : cur.delete(k); setAffForm({ ...affForm, methods: Array.from(cur) }); }} style={{ width: 'auto', margin: 0 }} />
                        {lbl}
                      </label>
                    );
                  })}
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('El referido solo verá estos al elegir cómo cobrar. Cripto le pide red y billetera.', 'The referrer only sees these when choosing how to get paid. Crypto asks for network and wallet.')}</p>
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}><button className="btn btn-primary" disabled={busy === 'aff'} onClick={saveAff}>{busy === 'aff' ? '…' : L('Guardar ajustes', 'Save settings')}</button></div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{affForm.rail === 'credit' ? L('Riel A: al vencer la espera, la recompensa se aplica sola como crédito en la cuenta del referido.', 'Rail A: after the hold, the reward is auto-applied as account credit to the referrer.') : L('Riel B: al vencer la espera queda “por cobrar”; tú pagas por fuera y pulsas “Marcar pagado”.', 'Rail B: after the hold it becomes “ready to pay”; you pay externally and click “Mark paid”.')}</p>
          </div>

          {/* Lista de referidos */}
          {(!affData?.referrers || affData.referrers.length === 0) ? <p className="muted" style={{ fontSize: 12.5 }}>{L('Aún no hay referidos.', 'No referrals yet.')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {affData.referrers.map((a: any) => (
                <div key={a.user_id} className="row between" style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 12px', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 140 }}>
                    <b style={{ fontSize: 13.5 }}>{a.name}</b>
                    <div className="muted" style={{ fontSize: 11.5 }}>{a.method?.method ? `${a.method.method}${a.method.network ? ' (' + a.method.network.toUpperCase() + ')' : ''}${a.method.handle ? ' · ' + a.method.handle : ''}` : L('sin método de cobro', 'no payout method')}</div>
                  </div>
                  <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="muted" style={{ fontSize: 12 }}>{L('Por cobrar', 'Ready')} <b style={{ color: 'var(--gold)' }}>{money(a.availableCents)}</b> · {L('espera', 'hold')} {money(a.pendingCents)} · {L('pagado', 'paid')} {money(a.paidCents)}</span>
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 10px' }} disabled={a.availableCents <= 0} onClick={() => setPayTarget({ ...a, method: a.method?.method || 'manual', note: '' })}><OnyxIcon emoji="💸" size={13} /> {L('Marcar pagado', 'Mark paid')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historial de pagos */}
          {(affData?.payouts?.length > 0) && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Pagos realizados', 'Payouts made')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {affData.payouts.slice(0, 12).map((p: any, i: number) => (
                  <div key={i} className="row between" style={{ fontSize: 12.5, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 8 }}>
                    <span>{p.name} <span className="muted">· {p.method || '—'}</span></span>
                    <span className="muted">{money(p.total_cents)} · {new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      </div>{/* /sk-cardgrid */}

      {/* Modal: marcar pagado */}
      {payTarget && (
        <div className="sk-modal-ov" style={{ alignItems: 'center' }} onClick={() => setPayTarget(null)}>
          <div className="sk-modal sk-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ marginBottom: 4 }}>{L('Marcar pagado', 'Mark paid')}</h3>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L(`Vas a registrar ${money(payTarget.availableCents)} pagados a ${payTarget.name}. Esto no mueve dinero: confirma que ya le pagaste por fuera.`, `You'll record ${money(payTarget.availableCents)} paid to ${payTarget.name}. This moves no money: confirm you already paid them externally.`)}</p>
            <span className="muted" style={{ fontSize: 12 }}>{L('Método', 'Method')}</span><br />
            <select value={payTarget.method} onChange={(e) => setPayTarget({ ...payTarget, method: e.target.value })} style={{ margin: '4px 0 8px', width: '100%' }}>
              <option value="manual">{L('Manual', 'Manual')}</option>
              {(affData?.settings?.payout_methods && affData.settings.payout_methods.length ? affData.settings.payout_methods : ['paypal', 'zelle', 'crypto']).map((m: string) => (
                <option key={m} value={m}>{({ paypal: 'PayPal', zelle: 'Zelle', bank: L('Banco', 'Bank'), cash: L('Efectivo', 'Cash'), crypto: L('Cripto', 'Crypto'), other: L('Otro', 'Other') } as any)[m] || m}</option>
              ))}
            </select>
            <input placeholder={L('Nota / referencia (opcional)', 'Note / reference (optional)')} value={payTarget.note} onChange={(e) => setPayTarget({ ...payTarget, note: e.target.value })} style={{ marginBottom: 12, width: '100%' }} />
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Escribe', 'Type')} <code style={{ fontWeight: 700 }}>{L('CONFIRMAR', 'CONFIRM')}</code> {L('para continuar', 'to continue')}</div>
            <input value={payTarget.acc || ''} onChange={(e) => setPayTarget({ ...payTarget, acc: e.target.value.toUpperCase() })} placeholder={L('CONFIRMAR', 'CONFIRM')} style={{ marginBottom: 12, width: '100%', fontFamily: 'var(--font-mono, monospace)', letterSpacing: 1 }} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPayTarget(null)}>{L('Cancelar', 'Cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 2, opacity: (payTarget.acc || '').trim() === L('CONFIRMAR', 'CONFIRM') ? 1 : .5 }} disabled={busy === 'pay' || (payTarget.acc || '').trim() !== L('CONFIRMAR', 'CONFIRM')} onClick={() => doPay(payTarget.user_id, payTarget.method, payTarget.note)}>{busy === 'pay' ? '…' : L('Confirmar pago', 'Confirm payment')}</button>
            </div>
          </div>
        </div>
      )}

      {ents.filter((e: any) => e.perks?.guardian).length > 0 && (
        <div className="sk-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><span className="card-ic"><OnyxIcon name="guardian" size={16} /></span> {L('Accesos a dar (Onyx Guardian)', 'Access to grant (Onyx Guardian)')}</h3>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L('Estos alumnos compraron un nivel que incluye Onyx Guardian. Dales el acceso manualmente desde sus módulos — por seguridad no se activa solo.', 'These students bought a tier that includes Onyx Guardian. Grant them access manually — for safety it is not auto-enabled.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ents.filter((e: any) => e.perks?.guardian).map((e: any, i: number) => (
              <div key={i} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}>
                <span>{e.name} <span className="muted">· {e.tier}</span></span>
                <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--green) 15%,transparent)', color: 'var(--soft-green)' }}>Guardian</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Vista del REFERIDO: cuánto gana, cómo/ cuándo le pagan, método e historial.
function ReferralEarnings({ active, L }: any) {
  const r = active?.referral;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [mf, setMf] = useState<any>({ method: '', handle: '', network: 'usdt_trc20' });
  const [saved, setSaved] = useState(false);
  const s = r?.settings;
  // Solo los métodos que el mentor ofrece; nunca vacío.
  const offered: string[] = (s?.payout_methods && s.payout_methods.length ? s.payout_methods : ['paypal', 'zelle', 'crypto']);
  const methodLabel = (m: string) => ({ paypal: 'PayPal', zelle: 'Zelle', bank: L('Banco', 'Bank'), cash: L('Efectivo', 'Cash'), crypto: L('Cripto', 'Crypto'), other: L('Otro', 'Other') } as any)[m] || m;
  const NETWORKS = [['usdt_trc20', 'USDT · TRC20'], ['usdt_erc20', 'USDT · ERC20'], ['usdt_bsc', 'USDT · BSC (BEP20)'], ['btc', 'BTC'], ['eth', 'ETH'], ['other', L('Otra', 'Other')]];
  const hasReward = !!s && (s.reward_cents > 0 || (s.type === 'pct' && s.pct > 0));
  const money = (c: number) => '$' + Math.round((c || 0) / 100).toLocaleString();
  const rewardLabel = s ? (s.type === 'pct' ? `${s.pct}%` : money(s.reward_cents)) : '';
  const refLink = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/academy?join=${active.code}&ref=${active.myUserId}` : '';

  async function loadDetail() {
    const d = await fetch('/api/academy/affiliate?m=' + active.mentor_id).then((x) => x.json()).catch(() => null);
    if (d) {
      setDetail(d);
      const first = (d.settings?.payout_methods && d.settings.payout_methods.length ? d.settings.payout_methods[0] : 'paypal');
      if (d.method) setMf({ method: d.method.method || first, handle: d.method.handle || '', network: d.method.network || 'usdt_trc20' });
      else setMf((m: any) => ({ ...m, method: m.method || first }));
    }
  }
  async function openModal() { setOpen(true); setSaved(false); await loadDetail(); }
  async function saveMethod() {
    await fetch('/api/academy/affiliate', { method: 'POST', body: JSON.stringify({ action: 'method', mentor_id: active.mentor_id, method: mf.method, handle: mf.handle, network: mf.method === 'crypto' ? mf.network : undefined }) });
    setSaved(true); loadDetail();
  }
  if (!hasReward) return null;
  const t = r.totals || {};
  const stChip = (st: string) => st === 'paid' ? { t: L('pagado', 'paid'), c: 'var(--soft-green)' } : st === 'available' ? { t: L('por cobrar', 'ready'), c: 'var(--gold)' } : st === 'reversed' ? { t: L('anulado', 'reversed'), c: 'var(--red)' } : { t: L('en espera', 'on hold'), c: 'var(--mut)' };

  return (
    <>
      <div className="sk-side-card" style={{ border: '1px solid color-mix(in srgb,var(--gold) 35%,transparent)' }}>
        <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 14 }}>{L('Invita y gana', 'Refer & earn')}</b><OnyxIcon name="gift" size={15} /></div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{L(`Gana ${rewardLabel} por cada amigo que se una y pague.`, `Earn ${rewardLabel} for each friend who joins and pays.`)}</p>
        <div className="row" style={{ gap: 10, margin: '8px 0', textAlign: 'center' }}>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, color: 'var(--gold)' }}>{money(t.availableCents)}</div><div className="muted" style={{ fontSize: 10.5 }}>{L('Disponible', 'Available')}</div></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{money(t.pendingCents)}</div><div className="muted" style={{ fontSize: 10.5 }}>{L('En espera', 'On hold')}</div></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, color: 'var(--soft-green)' }}>{money(t.paidCents)}</div><div className="muted" style={{ fontSize: 10.5 }}>{L('Pagado', 'Paid')}</div></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { navigator.clipboard.writeText(refLink); alert(L('Tu enlace de afiliado copiado.', 'Your affiliate link copied.')); }}>{L('Copiar enlace', 'Copy link')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={openModal}>{L('Mis pagos', 'My payouts')}</button>
        </div>
      </div>

      {open && (
        <div className="sk-modal-ov" style={{ alignItems: 'center' }} onClick={() => setOpen(false)}>
          <div className="sk-modal sk-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="row between" style={{ marginBottom: 8 }}><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><OnyxIcon name="gift" size={17} /> {L('Mis ganancias', 'My earnings')}</h3><button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setOpen(false)}>✕</button></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[[L('Disponible', 'Available'), money(t.availableCents), 'var(--gold)'], [L('En espera', 'On hold'), money(t.pendingCents), 'var(--mut)'], [L('Pagado', 'Paid'), money(t.paidCents), 'var(--soft-green)']].map(([lbl, val, col]) => (
                <div key={lbl} className="statcard"><div><div className="sc-lbl">{lbl}</div><div className="sc-val" style={{ color: col }}>{val}</div></div></div>
              ))}
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div className="row between" style={{ marginBottom: 6 }}><b style={{ fontSize: 13 }}>{L('Cómo me pagan', 'How I get paid')}</b>
                <span className="sk-chip" style={{ background: 'color-mix(in srgb,var(--brand) 14%,transparent)', color: 'var(--brand)' }}>{s.rail === 'credit' ? L('crédito automático', 'auto credit') : L('pago manual', 'manual')}</span></div>
              {s.rail === 'credit'
                ? <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{L('Tu recompensa se aplica sola como crédito en tu cuenta al pasar la ventana de espera. No hace falta elegir método de cobro.', 'Your reward auto-applies as account credit after the hold window. No payout method needed.')}</p>
                : <>
                  <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Tu mentor te paga por fuera. Dile aquí a dónde enviarte el dinero.', 'Your mentor pays you externally. Tell them where to send the money.')}</p>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <select value={mf.method} onChange={(e) => { setMf({ ...mf, method: e.target.value }); setSaved(false); }} style={{ width: 120 }}>
                      {offered.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                    </select>
                    {mf.method === 'crypto' && (
                      <select value={mf.network} onChange={(e) => { setMf({ ...mf, network: e.target.value }); setSaved(false); }} style={{ width: 150 }}>
                        {NETWORKS.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                      </select>
                    )}
                    <input placeholder={mf.method === 'crypto' ? L('Dirección de billetera', 'Wallet address') : L('Correo / número / cuenta', 'Email / number / account')} value={mf.handle} onChange={(e) => { setMf({ ...mf, handle: e.target.value }); setSaved(false); }} style={{ flex: '1 1 150px' }} />
                    <button className="btn btn-primary" onClick={saveMethod}>{saved ? '✓' : L('Guardar', 'Save')}</button>
                  </div>
                  {mf.method === 'crypto' && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{L('Revisa bien la red: enviar a la red equivocada pierde los fondos.', 'Double-check the network: sending on the wrong one loses funds.')}</p>}
                </>}
            </div>

            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Historial', 'History')}</div>
            {(!detail || (detail.events || []).length === 0) ? <p className="muted" style={{ fontSize: 12.5 }}>{L('Aún no tienes movimientos.', 'No activity yet.')}</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                {(detail.events || []).map((e: any, i: number) => { const c = stChip(e.status); return (
                  <div key={i} className="row between" style={{ fontSize: 12.5, padding: '7px 10px', background: 'var(--bg2)', borderRadius: 8 }}>
                    <span>{e.kind === 'renewal' ? L('Renovación de un referido', 'A referral renewed') : e.kind === 'one_time' ? L('Compra de un referido', 'A referral purchased') : L('Un referido pagó', 'A referral paid')}<br /><span className="muted" style={{ fontSize: 11 }}>{new Date(e.created_at).toLocaleDateString()}{e.paid_at ? ' · ' + L('pagado', 'paid') + ' ' + new Date(e.paid_at).toLocaleDateString() : ''}{e.paid_method ? ' · ' + e.paid_method : ''}</span></span>
                    <span style={{ textAlign: 'right' }}><b style={{ color: e.status === 'reversed' ? 'var(--red)' : 'var(--tx)', textDecoration: e.status === 'reversed' ? 'line-through' : 'none' }}>{money(e.amount_cents)}</b><br /><span className="sk-chip" style={{ fontSize: 10.5, background: `color-mix(in srgb,${c.c} 16%,transparent)`, color: c.c }}>{c.t}</span></span>
                  </div>
                ); })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TierForm({ form, setForm, modules, busy, onSave, onCancel, L }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const grantsAll = form.grants === 'all';
  const grantIds: string[] = Array.isArray(form.grants) ? form.grants : [];
  const toggleMod = (id: string) => set('grants', grantIds.includes(id) ? grantIds.filter((x) => x !== id) : [...grantIds, id]);
  return (
    <Modal onClose={onCancel}><div className="sk-card" style={{ border: '1px solid var(--brand)' }}>
      <h3 style={{ marginBottom: 12 }}>{form.id ? L('Editar nivel', 'Edit tier') : L('Nuevo nivel', 'New tier')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder={L('Nombre (Curso básico, VIP, Bootcamp…)', 'Name (Basic, VIP, Bootcamp…)')} style={{ margin: 0 }} />
        <textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={2} placeholder={L('Descripción (opcional)', 'Description (optional)')} style={{ width: '100%', margin: 0 }} />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={form.kind} onChange={(e) => set('kind', e.target.value)} style={{ margin: 0 }}><option value="subscription">{L('Suscripción', 'Subscription')}</option><option value="one_time">{L('Pago único', 'One-time')}</option><option value="audit">{L('Add-on auditoría', 'Audit add-on')}</option></select>
          {form.kind !== 'one_time' && <select value={form.interval} onChange={(e) => set('interval', e.target.value)} style={{ margin: 0 }}><option value="month">{L('Mensual', 'Monthly')}</option><option value="year">{L('Anual', 'Yearly')}</option></select>}
          <input type="number" min={0} step="0.01" value={form.price ?? ''} onChange={(e) => set('price', e.target.value)} placeholder={L('Precio', 'Price')} style={{ margin: 0, width: 120 }} />
          <span className="sk-chip">USD</span>
        </div>
        {form.kind === 'audit' ? (
          <div className="row" style={{ gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb,var(--green) 10%,transparent)' }}>
            <OnyxIcon name="guardian" size={16} />
            <span style={{ fontSize: 12.5 }}>{L('Add-on de auditoría: los alumnos que lo compren podrán darte permiso para revisar su trading real, generarles un reporte AI y verificar su plan. No desbloquea aulas.', 'Audit add-on: students who buy it can let you review their real trading, generate an AI report and verify their plan. It does not unlock classrooms.')}</span>
          </div>
        ) : (<>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('¿Qué desbloquea?', 'What does it unlock?')}</div>
          <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 6 }}><input type="radio" checked={grantsAll} onChange={() => set('grants', 'all')} style={{ width: 'auto', margin: 0 }} /> {L('Todas las aulas', 'All classrooms')}</label>
          <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="radio" checked={!grantsAll} onChange={() => set('grants', [])} style={{ width: 'auto', margin: 0 }} /> {L('Aulas concretas', 'Specific classrooms')}</label>
          {!grantsAll && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, paddingLeft: 22 }}>{(modules || []).map((m: any) => <label key={m.id} className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={grantIds.includes(m.id)} onChange={() => toggleMod(m.id)} style={{ width: 'auto', margin: 0 }} /> {m.title}</label>)}{(modules || []).length === 0 && <span className="muted" style={{ fontSize: 12 }}>{L('Primero crea aulas.', 'First create classrooms.')}</span>}</div>}
        </div>
        </>)}
        <label className="row" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Activo (visible para alumnos)', 'Active (visible to students)')}</label>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name || !form.price || busy}>{busy ? '…' : L('Guardar', 'Save')}</button>
        <button className="btn btn-ghost" onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
      </div>
    </div></Modal>
  );
}
