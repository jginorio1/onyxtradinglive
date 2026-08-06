'use client';
import { toast, toastErr } from '@/lib/toast';
import { fmtDate, fmtDateTime } from '@/lib/fmtDate';
import { useEffect, useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import Ambassadors from './Ambassadors';
import Retention from './Retention';
import Addons from './Addons';
import CleanSignups from './CleanSignups';
import UserDrawer from './UserDrawer';
import { describeLog, CAT_STYLE } from '@/lib/logFormat';
import ConfirmNote from './ConfirmNote';
import Emails from './Emails';
import Campaigns from './Campaigns';
import SeoPanel from './SeoPanel';
import TestConsole from './TestConsole';
import Firms from './Firms';
import CatalogAdmin from './CatalogAdmin';
import SupportInbox from './SupportInbox';
import Diagnostics from './Diagnostics';
import KbEditor from './KbEditor';
import BlogEditor from './BlogEditor';
import Backups from './Backups';
import Audit from './Audit';
import Optimize from './Optimize';
import AdminLock from './AdminLock';
import Revenue from './Revenue';
import Finanzas from './Finanzas';
import AcademyAdmin from './AcademyAdmin';
import Facturacion from './Facturacion';
import OnyxIcon from '@/app/components/OnyxIcon';
import LandingBuilder from './LandingBuilder';
import EnvSwitch from './EnvSwitch';
import ChatWidgetEditor from './ChatWidgetEditor';
import OnlineNowControl from './OnlineNowControl';
import AdminLeadAlert from './AdminLeadAlert';
import TeamChat from './TeamChat';
import BackupCodes from './BackupCodes';
import RangeBar, { type Range, defaultRange } from './RangeBar';
import { AREAS, effectivePerms } from '@/lib/perms';
import { useT } from '@/lib/adminText';
import { useLang } from '@/lib/lang';
import { blankPromo, newId, THEMES, pickActiveBar } from '@/lib/promo';

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; stripe_price_id: string | null; stripe_price_id_year: string | null; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null; active: boolean; sort: number; capabilities: any };
type User = { id: string; email: string; full_name?: string | null; plan: string; subscription_status: string | null; banned: boolean; is_admin: boolean; created_at: string; accounts: number; lastSync: string | null; email_confirmed?: boolean };
type Team = { id: string; email: string; role: string | null; is_admin: boolean; perms?: any; available?: boolean; last_active?: string | null };
type Tab = 'resumen' | 'facturacion' | 'ingresos' | 'finanzas' | 'academy' | 'usuarios' | 'correos' | 'campanas' | 'blog' | 'seo' | 'planes' | 'landing' | 'equipo' | 'embajadores' | 'retencion' | 'pruebas' | 'firms' | 'catalogos' | 'modulos' | 'soporte' | 'chat' | 'kb' | 'diag' | 'backups' | 'audit' | 'optim' | 'ajustes';

const CAPS: string[] = ['journal', 'compare', 'funding', 'costs', 'export', 'reports', 'telegram', 'manager', 'manager_advanced', 'manager_news', 'copy', 'tv', 'algo', 'expenses', 'coach', 'academy'];
const CAP_FALLBACK: Record<string, string> = { tv: 'TradingView (señales → EA)' };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}
const roleColor = (r?: string | null) => (r === 'owner' ? 'var(--soft-brand2)' : r === 'support' ? 'var(--gold)' : 'var(--green)');

// Cabecera común de cada pestaña: icono + título + subtítulo.
function Head({ ic, t, s }: { ic: string; t: string; s: string }) {
  return <div className="tabhead"><div className="th-row"><span className="th-ic">{ic}</span><span className="th-t">{t}</span></div><div className="th-s">{s}</div></div>;
}
const initials = (email: string) => (email || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();

// Barra de descuentos del landing: contenido, programación, apariencia,
// segmentación y métricas. Todo editable desde aquí.
function PromoControl() {
  const t = useT();
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [bars, setBars] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [openId, setOpenId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<Record<string, string>>({});
  const [cpMsg, setCpMsg] = useState<Record<string, string>>({});
  const [cpBusy, setCpBusy] = useState('');
  useEffect(() => { fetch('/api/admin/promo').then((r) => r.json()).then((d) => { setBars(d.bars || []); setStats(d.stats || {}); }).catch(() => {}); }, []);

  const upd = (id: string, k: string, v: any) => setBars((bs) => bs.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const addBar = (patch: any = {}) => { const nb = { ...blankPromo(), id: newId(), ...patch }; setBars((bs) => [...bs, nb]); setOpenId(nb.id); };
  const dupBar = (id: string) => { const src = bars.find((b) => b.id === id); if (!src) return; const nb = { ...src, id: newId(), name: (src.name || 'Barra') + ' ' + L('copia', 'copy') }; setBars((bs) => [...bs, nb]); setOpenId(nb.id); };
  const delBar = (id: string) => { if (window.confirm(L('¿Borrar esta barra?', 'Delete this bar?'))) setBars((bs) => bs.filter((b) => b.id !== id)); };
  const move = (id: string, dir: -1 | 1) => setBars((bs) => { const i = bs.findIndex((b) => b.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= bs.length) return bs; const c = [...bs]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  async function save(extra?: any) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/promo', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bars, ...(extra || {}) }) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error'); else { setBars(d.bars || []); setStats(d.stats || {}); setMsg(t.pr_saved); }
    } finally { setBusy(false); }
  }
  // Crea o valida el cupón en Stripe para que el descuento se aplique solo.
  async function stripeCoupon(b: any) {
    if (!b.coupon) { setCpMsg((m) => ({ ...m, [b.id]: L('Escribe un código primero.', 'Enter a code first.') })); return; }
    setCpBusy(b.id); setCpMsg((m) => ({ ...m, [b.id]: '' }));
    try {
      const r = await fetch('/api/admin/promo/coupon', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: b.coupon, percent: Number(pct[b.id]) || 0, endsAt: b.endsAt }) });
      const d = await r.json();
      if (!r.ok) setCpMsg((m) => ({ ...m, [b.id]: d.error || 'Error' }));
      else if (d.replaced) setCpMsg((m) => ({ ...m, [b.id]: L(`✓ Actualizado a −${d.percent}% (reemplazó −${d.oldPercent}%)`, `✓ Updated to −${d.percent}% (replaced −${d.oldPercent}%)`) }));
      else if (d.created) setCpMsg((m) => ({ ...m, [b.id]: L(`✓ Creado en Stripe (−${d.percent}%)`, `✓ Created in Stripe (−${d.percent}%)`) }));
      else if (d.existed) setCpMsg((m) => ({ ...m, [b.id]: L(`✓ Ya existe en Stripe${d.percent ? ` (−${d.percent}%)` : ''}`, `✓ Already in Stripe${d.percent ? ` (−${d.percent}%)` : ''}`) }));
      else setCpMsg((m) => ({ ...m, [b.id]: L('No existe. Pon el % y créalo.', "Doesn't exist. Set % and create it.") }));
    } finally { setCpBusy(''); }
  }

  const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', width: '100%', marginTop: 4 } as any;
  const sec = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginTop: 10 } as any;
  const secTitle = { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--mut)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 } as any;
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 } as any;
  const now = Date.now();
  const activeId = pickActiveBar(bars as any, now, { lang, isLanding: true, isPricing: false, loggedIn: false, plan: 'free' })?.id || '';
  const statusOf = (b: any) => {
    if (!b.on) return { t: L('Apagada', 'Off'), c: 'var(--mut)', bg: 'var(--bg2)' };
    if (b.endsAt && new Date(b.endsAt).getTime() <= now) return { t: L('Finalizada', 'Ended'), c: 'var(--mut)', bg: 'var(--bg2)' };
    if (b.startsAt && new Date(b.startsAt).getTime() > now) return { t: L('Próxima', 'Upcoming'), c: 'var(--soft-brand)', bg: 'rgba(124,140,255,.15)' };
    if (b.id === activeId) return { t: L('Activa ahora', 'Active now'), c: 'var(--soft-green)', bg: 'rgba(52,226,160,.15)' };
    return { t: L('Programada', 'Scheduled'), c: 'var(--mut)', bg: 'var(--bg2)' };
  };
  const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString(lang === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short' }) : '—');

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>📣 {t.pr_title}</h3>
        <span className="row" style={{ gap: 8 }}>
          <a className="btn btn-ghost" href="/" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>👁 {L('Ver en vivo', 'View live')}</a>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => addBar({ on: true })}>＋ {L('Nueva barra', 'New bar')}</button>
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{L('Programa varias barras por temporada. El sitio muestra sola la que toca por fecha.', 'Schedule several bars by season. The site shows the one that fits the date automatically.')}</p>

      {/* Biblioteca de temas */}
      <div style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Biblioteca de temas — un clic crea una barra con ese estilo:', 'Theme library — one click creates a bar with that style:')}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {THEMES.map((th) => {
            const bg = th.patch.gradient ? `linear-gradient(90deg,${th.patch.bg},${th.patch.bg2})` : th.patch.bg;
            return <button key={th.key} onClick={() => addBar({ name: th.name, ...th.patch })} style={{ cursor: 'pointer', border: 'none', borderRadius: 20, padding: '6px 13px', fontSize: 12.5, fontWeight: 600, background: bg, color: th.patch.fg }}>{th.patch.emoji} {th.name}</button>;
          })}
        </div>
      </div>

      {/* Cola de barras */}
      {!bars.length && <p className="muted" style={{ fontSize: 13, padding: '10px 0' }}>{L('No hay barras. Crea una desde un tema o con "Nueva barra".', 'No bars yet. Create one from a theme or with "New bar".')}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.map((b, i) => {
          const st = statusOf(b);
          const bgPrev = b.gradient && b.bg2 ? `linear-gradient(90deg,${b.bg},${b.bg2})` : (b.bg || 'var(--brand)');
          const s = stats[b.id] || { views: 0, clicks: 0 };
          const ctr = s.views ? Math.round((s.clicks / s.views) * 1000) / 10 : 0;
          const opened = openId === b.id;
          return (
            <div key={b.id} style={{ border: opened ? '1px solid var(--soft-brand)' : '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Tira de vista previa */}
              <div style={{ background: bgPrev, color: b.fg || '#0a0d14', padding: '7px 12px', fontSize: 12.5, fontWeight: 600, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {(b.emoji ? b.emoji + ' ' : '') + ((lang === 'es' ? b.text_es : b.text_en) || t.pr_ph) + (b.coupon ? '  [' + b.coupon + ']' : '') + ((lang === 'es' ? b.cta_es : b.cta_en) ? '  →' : '')}
              </div>
              {/* Fila de gestión */}
              <div className="row between" style={{ gap: 10, padding: '8px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 90 }}>{b.name || L('Barra', 'Bar')}</span>
                <span className="muted" style={{ fontSize: 12 }}>📅 {fmtDate(b.startsAt)} → {fmtDate(b.endsAt)}</span>
                <span className="pill" style={{ fontSize: 11, color: st.c, background: st.bg }}>{st.t}</span>
                <span className="row" style={{ gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                  <Toggle on={!!b.on} onClick={() => upd(b.id, 'on', !b.on)} />
                  <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => setOpenId(opened ? '' : b.id)}>{opened ? L('Cerrar', 'Close') : '✏️'}</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} title={L('Duplicar', 'Duplicate')} onClick={() => dupBar(b.id)}>⧉</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 12 }} title={L('Subir', 'Up')} onClick={() => move(b.id, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 12 }} title={L('Bajar', 'Down')} onClick={() => move(b.id, 1)} disabled={i === bars.length - 1}>↓</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => delBar(b.id)}>🗑️</button>
                </span>
              </div>

              {/* Editor expandido */}
              {opened && (
                <div style={{ padding: '0 12px 12px' }}>
                  {/* Contenido */}
                  <div style={sec}>
                    <div style={secTitle}>💬 {L('Contenido', 'Content')}</div>
                    <div style={grid}>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Nombre interno', 'Internal name')}<input value={b.name || ''} onChange={(e) => upd(b.id, 'name', e.target.value)} placeholder="Halloween" style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Emoji / icono', 'Emoji / icon')}<input value={b.emoji || ''} onChange={(e) => upd(b.id, 'emoji', e.target.value)} placeholder="🔥" style={inp} maxLength={8} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_textEs}<input value={b.text_es} onChange={(e) => upd(b.id, 'text_es', e.target.value)} placeholder="−30% en el plan Pro" style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_textEn}<input value={b.text_en} onChange={(e) => upd(b.id, 'text_en', e.target.value)} placeholder="−30% on Pro" style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_ctaEs}<input value={b.cta_es} onChange={(e) => upd(b.id, 'cta_es', e.target.value)} placeholder="Aprovéchalo" style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_ctaEn}<input value={b.cta_en} onChange={(e) => upd(b.id, 'cta_en', e.target.value)} placeholder="Grab it" style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_link}<input value={b.link} onChange={(e) => upd(b.id, 'link', e.target.value)} placeholder="/pricing" style={inp} /></label>
                    </div>
                    {/* Cupón + descuento automático en Stripe */}
                    <div style={{ ...grid, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', alignItems: 'end' }}>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Cupón (copiable)', 'Coupon (copyable)')}<input value={b.coupon || ''} onChange={(e) => upd(b.id, 'coupon', e.target.value.toUpperCase())} placeholder="PRO30" style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('% descuento', '% off')}<input type="number" min={1} max={100} value={pct[b.id] ?? ''} onChange={(e) => setPct((m) => ({ ...m, [b.id]: e.target.value }))} placeholder="30" style={inp} /></label>
                      <button className="btn btn-ghost" style={{ fontSize: 12.5 }} disabled={cpBusy === b.id} onClick={() => stripeCoupon(b)}>{cpBusy === b.id ? '…' : L('Crear/validar en Stripe', 'Create/validate in Stripe')}</button>
                    </div>
                    {cpMsg[b.id] && <div style={{ fontSize: 12, marginTop: 6, color: cpMsg[b.id].startsWith('✓') ? 'var(--soft-green)' : 'var(--amber)' }}>{cpMsg[b.id]}</div>}
                    <label className="row" style={{ gap: 8, marginTop: 10, fontSize: 13, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!b.newTab} onChange={(e) => upd(b.id, 'newTab', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Abrir el enlace en pestaña nueva', 'Open link in a new tab')}
                    </label>
                  </div>

                  {/* Programación */}
                  <div style={sec}>
                    <div style={secTitle}>⏱ {L('Programación y contador', 'Schedule & countdown')}</div>
                    <div style={grid}>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Empieza (opcional)', 'Starts (optional)')}<input type="datetime-local" value={b.startsAt ? b.startsAt.slice(0, 16) : ''} onChange={(e) => upd(b.id, 'startsAt', e.target.value ? new Date(e.target.value).toISOString() : '')} style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_ends}<input type="datetime-local" value={b.endsAt ? b.endsAt.slice(0, 16) : ''} onChange={(e) => upd(b.id, 'endsAt', e.target.value ? new Date(e.target.value).toISOString() : '')} style={inp} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Formato del contador', 'Countdown format')}<select value={b.countdownFmt || 'dhms'} onChange={(e) => upd(b.id, 'countdownFmt', e.target.value)} style={inp}><option value="dhms">2d 3h 4m</option><option value="hms">03:04:05</option></select></label>
                    </div>
                    <label className="row" style={{ gap: 8, marginTop: 10, fontSize: 13, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={b.countdown !== false} onChange={(e) => upd(b.id, 'countdown', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Mostrar el contador (si hay fecha de fin)', 'Show countdown (if there is an end date)')}
                    </label>
                  </div>

                  {/* Apariencia */}
                  <div style={sec}>
                    <div style={secTitle}>🎨 {L('Apariencia', 'Appearance')}</div>
                    <div style={grid}>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_bg}<input type="color" value={b.bg || '#7c8cff'} onChange={(e) => upd(b.id, 'bg', e.target.value)} style={{ ...inp, height: 38, padding: 3 }} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Color de fondo 2', 'Background 2')}<input type="color" value={b.bg2 || '#9a6bff'} onChange={(e) => upd(b.id, 'bg2', e.target.value)} style={{ ...inp, height: 38, padding: 3 }} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{t.pr_fg}<input type="color" value={b.fg || '#0a0d14'} onChange={(e) => upd(b.id, 'fg', e.target.value)} style={{ ...inp, height: 38, padding: 3 }} /></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Posición', 'Position')}<select value={b.position || 'top'} onChange={(e) => upd(b.id, 'position', e.target.value)} style={inp}><option value="top">{L('Arriba', 'Top')}</option><option value="bottom">{L('Abajo', 'Bottom')}</option></select></label>
                      {(b.position || 'top') === 'top' && (
                        <label className="muted" style={{ fontSize: 12 }}>{L('Al hacer scroll', 'On scroll')}<select value={b.sticky === false ? 'no' : 'yes'} onChange={(e) => upd(b.id, 'sticky', e.target.value === 'yes')} style={inp}><option value="yes">{L('Fija (sigue arriba)', 'Fixed (stays on top)')}</option><option value="no">{L('Se desplaza con la página', 'Scrolls with page')}</option></select></label>
                      )}
                      <label className="muted" style={{ fontSize: 12 }}>{L('Animación', 'Animation')}<select value={b.anim || 'slide'} onChange={(e) => upd(b.id, 'anim', e.target.value)} style={inp}><option value="none">{L('Ninguna', 'None')}</option><option value="slide">{L('Deslizar', 'Slide')}</option><option value="pulse">{L('Latido', 'Pulse')}</option><option value="marquee">{L('Marquesina', 'Marquee')}</option></select></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Velocidad', 'Speed')}<select value={b.speed || 'normal'} onChange={(e) => upd(b.id, 'speed', e.target.value)} style={inp}><option value="slow">{L('Lenta', 'Slow')}</option><option value="normal">{L('Normal', 'Normal')}</option><option value="fast">{L('Rápida', 'Fast')}</option></select></label>
                    </div>
                    <label className="row" style={{ gap: 8, marginTop: 10, fontSize: 13, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!b.gradient} onChange={(e) => upd(b.id, 'gradient', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('Fondo en degradado (2 colores)', 'Gradient background (2 colors)')}
                    </label>
                  </div>

                  {/* Dónde y a quién */}
                  <div style={sec}>
                    <div style={secTitle}>🎯 {L('Dónde y a quién', 'Where & who')}</div>
                    <div style={grid}>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Páginas', 'Pages')}<select value={b.pages || 'all'} onChange={(e) => upd(b.id, 'pages', e.target.value)} style={inp}><option value="all">{L('Todas las públicas', 'All public pages')}</option><option value="landing">{L('Solo el landing', 'Landing only')}</option><option value="pricing">{L('Solo precios', 'Pricing only')}</option></select></label>
                      <label className="muted" style={{ fontSize: 12 }}>{L('Público', 'Audience')}<select value={b.audience || 'all'} onChange={(e) => upd(b.id, 'audience', e.target.value)} style={inp}><option value="all">{L('Todos', 'Everyone')}</option><option value="guests">{L('Solo sin cuenta', 'Logged-out only')}</option><option value="free">{L('Sin cuenta o plan Free', 'Logged-out or Free plan')}</option></select></label>
                    </div>
                    <label className="row" style={{ gap: 8, marginTop: 10, fontSize: 13, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={b.dismissible !== false} onChange={(e) => upd(b.id, 'dismissible', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L('El visitante puede cerrarla (se recuerda)', 'Visitor can close it (remembered)')}
                    </label>
                  </div>

                  {/* Rendimiento por barra */}
                  <div style={sec}>
                    <div style={secTitle}>📊 {L('Rendimiento', 'Performance')}</div>
                    <div className="row" style={{ gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div><div className="muted" style={{ fontSize: 12 }}>{L('Vistas', 'Views')}</div><div style={{ fontSize: 20, fontWeight: 800 }}>{Number(s.views || 0).toLocaleString()}</div></div>
                      <div><div className="muted" style={{ fontSize: 12 }}>{L('Clics', 'Clicks')}</div><div style={{ fontSize: 20, fontWeight: 800 }}>{Number(s.clicks || 0).toLocaleString()}</div></div>
                      <div><div className="muted" style={{ fontSize: 12 }}>CTR</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--soft-green)' }}>{ctr}%</div></div>
                      <button className="btn btn-ghost" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={() => { if (window.confirm(L('¿Reiniciar las métricas de esta barra?', 'Reset this bar\'s stats?'))) save({ resetStatsId: b.id }); }}>{L('Reiniciar', 'Reset')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => save()} disabled={busy}>{busy ? '…' : t.pr_save}</button>
        {msg && <span style={{ fontSize: 12.5, color: 'var(--soft-green)' }}>{msg}</span>}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.pr_note}</p>
    </div>
  );
}

// Seguridad: cada admin fija su PIN de bloqueo por inactividad (6 dígitos).
function SecurityControl({ idleMin }: { idleMin: number }) {
  const t = useT();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => fetch('/api/admin/security').then((r) => r.json()).then((d) => setHasPin(!!d.hasPin)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function save(clear = false) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/security', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: clear ? '' : pin }) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error');
      else { setMsg(clear ? t.sec_cleared : t.sec_saved); setPin(''); load(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>🔒 {t.sec_title}</h3>
        <span className="pill" style={hasPin ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--amber)', background: 'rgba(255,192,77,.16)' }}>
          {hasPin === null ? '…' : hasPin ? t.sec_on : t.sec_off}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>{t.sec_body.replace('{n}', String(idleMin))}</p>
      <label className="muted" style={{ fontSize: 12.5 }}>{t.sec_setPin}</label>
      <div className="row" style={{ gap: 8, margin: '4px 0 6px', flexWrap: 'wrap' }}>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••" inputMode="numeric" maxLength={6}
          style={{ width: 130, letterSpacing: 4, textAlign: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }} />
        <button className="btn btn-primary" onClick={() => save(false)} disabled={busy || pin.length !== 6} style={{ padding: '8px 14px' }}>{busy ? '…' : t.sec_save}</button>
        {hasPin && <button className="btn btn-ghost" onClick={() => save(true)} disabled={busy} style={{ padding: '8px 12px' }}>{t.sec_clear}</button>}
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--soft-green)' }}>{msg}</div>}
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.sec_note}</p>
    </div>
  );
}

// Alertas: el Owner enciende el vigilante y ajusta los límites. Avisa por Telegram.
function AlertsControl() {
  const t = useT();
  const { lang } = useLang();
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => fetch('/api/admin/alerts').then((r) => r.json()).then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  const setTh = (k: string, v: number) => setD((o: any) => ({ ...o, thresholds: { ...o.thresholds, [k]: v } }));

  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/alerts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: d.enabled, thresholds: d.thresholds }) });
      if (!r.ok) { const j = await r.json(); setMsg(j.error || 'Error'); } else setMsg(t.al_saved);
    } finally { setBusy(false); }
  }
  if (!d) return null;
  const rules: [string, string][] = [
    ['failedPayments', t.al_failed], ['cancellationsDay', t.al_cancel], ['errorSpike', t.al_errors], ['backupStaleDays', t.al_backup], ['mrrDropPct', t.al_mrr],
  ];
  const inp = { width: 80, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', textAlign: 'center' } as any;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>🔔 {t.al_title}</h3>
        <span className="row" style={{ gap: 8 }}>
          <span className="pill" style={d.enabled ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--mut)' }}>{d.enabled ? t.al_on : t.al_off}</span>
          <Toggle on={!!d.enabled} onClick={() => setD((o: any) => ({ ...o, enabled: !o.enabled }))} />
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t.al_body}</p>
      {!d.telegram && <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 8 }}>⚠ {t.al_noTg}</p>}

      <div style={{ marginTop: 8 }}>
        {rules.map(([k, label]) => (
          <div key={k} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 160 }}>{label}</span>
            <input type="number" min={0} value={d.thresholds[k]} onChange={(e) => setTh(k, Math.max(0, Number(e.target.value) || 0))} style={inp} />
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : t.al_save}</button>
        {msg && <span style={{ fontSize: 12.5, color: 'var(--soft-green)' }}>{msg}</span>}
      </div>

      {!!(d.feed || []).length && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t.al_recent}</div>
          {d.feed.slice(0, 6).map((f: any, i: number) => (
            <div key={i} className="row between" style={{ padding: '6px 0', fontSize: 12.5, gap: 8, flexWrap: 'wrap' }}>
              <span>{f.text}</span><span className="muted">{fmtDate(f.at, lang)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{t.al_note}</p>
    </div>
  );
}

// Modo beta: el Owner fija un PIN de 6 dígitos y activa/desactiva la vista beta.
function BetaControl() {
  const t = useT();
  const [st, setSt] = useState<{ hasPin: boolean; active: boolean } | null>(null);
  const [pin, setPin] = useState('');
  const [entry, setEntry] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => fetch('/api/admin/beta').then((r) => r.json()).then(setSt).catch(() => {});
  useEffect(() => { load(); }, []);

  async function savePin() {
    setBusy('pin'); setMsg('');
    try {
      const r = await fetch('/api/admin/beta', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error');
      else { setMsg(pin ? t.bt_pinSaved : t.bt_pinCleared); setPin(''); load(); }
    } finally { setBusy(''); }
  }
  async function enter(off = false) {
    setBusy(off ? 'off' : 'in'); setMsg('');
    try {
      const r = await fetch('/api/admin/beta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(off ? { off: true } : { pin: entry }) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error');
      else { setEntry(''); load(); if (typeof window !== 'undefined') window.location.reload(); }
    } finally { setBusy(''); }
  }

  return (
    <div className="card">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>🧪 {t.bt_title}</h3>
        <span className="pill" style={st?.active ? { color: '#0a0d14', background: '#ffd166' } : { color: 'var(--mut)' }}>
          {st?.active ? t.bt_on : (st?.hasPin ? t.bt_ready : t.bt_noPin)}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>{t.bt_body}</p>

      {/* Fijar / cambiar PIN (Owner) */}
      <label className="muted" style={{ fontSize: 12.5 }}>{t.bt_setPin}</label>
      <div className="row" style={{ gap: 8, margin: '4px 0 6px', flexWrap: 'wrap' }}>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••" inputMode="numeric" maxLength={6}
          style={{ width: 130, letterSpacing: 4, textAlign: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }} />
        <button className="btn btn-primary" onClick={savePin} disabled={busy === 'pin'} style={{ padding: '8px 14px' }}>{busy === 'pin' ? '…' : t.bt_save}</button>
        {st?.hasPin && <button className="btn btn-ghost" onClick={() => { setPin(''); savePin(); }} disabled={busy === 'pin'} style={{ padding: '8px 12px' }}>{t.bt_clear}</button>}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginBottom: 12 }}>{t.bt_hint}</p>

      {/* Entrar / salir de la beta */}
      {st?.hasPin && !st?.active && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <label className="muted" style={{ fontSize: 12.5 }}>{t.bt_enterLabel}</label>
          <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <input value={entry} onChange={(e) => setEntry(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••" inputMode="numeric" maxLength={6}
              style={{ width: 130, letterSpacing: 4, textAlign: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' }} />
            <button className="btn btn-primary" onClick={() => enter(false)} disabled={busy === 'in' || entry.length !== 6} style={{ padding: '8px 14px' }}>{busy === 'in' ? '…' : t.bt_enter}</button>
          </div>
        </div>
      )}
      {st?.active && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <button className="btn btn-ghost" onClick={() => enter(true)} disabled={busy === 'off'} style={{ padding: '8px 14px' }}>{busy === 'off' ? '…' : t.bt_exit}</button>
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--soft-green)' }}>{msg}</div>}
      <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>{t.bt_note}</p>
    </div>
  );
}

export default function AdminClient({ meEmail, role, perms = {}, accounts, trades, hasPin = false, idleMin = 20 }: { meEmail: string; role: string; perms?: Record<string, string>; accounts: number; trades: number; hasPin?: boolean; idleMin?: number }) {
  const t = useT();
  // Qué áreas puede ver este admin (owner ve todo). Mapa tab → área de permiso.
  const areaOf: Record<string, string> = { resumen: 'resumen', facturacion: 'planes', ingresos: 'planes', finanzas: 'finanzas', academy: 'academy', usuarios: 'usuarios', correos: 'usuarios', campanas: 'campanas', planes: 'planes', landing: 'planes', equipo: 'equipo', embajadores: 'embajadores', retencion: 'retencion', pruebas: 'diag', firms: 'firms', catalogos: 'catalogos', modulos: 'modulos', blog: 'modulos', soporte: 'soporte', chat: 'chat', kb: 'soporte', diag: 'diag', backups: 'ajustes', audit: 'ajustes', optim: 'ajustes', ajustes: 'ajustes', seo: 'ajustes' };
  const has = (a: string) => role === 'owner' || (perms[a] && perms[a] !== 'none');
  // Facturación (hub) es visible si el admin puede ver CUALQUIERA de las tres áreas.
  const canBilling = has('planes') || has('finanzas') || has('academy');
  // Ajustes siempre visible: cada admin/empleado necesita entrar a fijar su PIN
  // de bloqueo. Dentro, lo del Owner (roles, promo, beta) se muestra solo a él.
  const canSee = (k: string) => k === 'ajustes' || (k === 'facturacion' ? canBilling : (role === 'owner' || (perms[areaOf[k]] && perms[areaOf[k]] !== 'none')));
  const [available, setAvailable] = useState(false);
  async function toggleAvail() { const next = !available; setAvailable(next); await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ available: next }) }); }
  // El tab vive en la URL (#soporte) para que el refresh te deje donde estabas.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') { const h = window.location.hash.replace('#', ''); if (h) return h as Tab; }
    return 'resumen';
  });
  useEffect(() => { try { window.history.replaceState(null, '', '#' + tab); } catch {} }, [tab]);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [team, setTeam] = useState<Team[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [uRange, setURange] = useState<Range>(() => defaultRange('month'));
  const [uDrawer, setUDrawer] = useState<{ id: string; email: string } | null>(null);
  const { lang } = useLang();

  const [diag, setDiag] = useState<any>(null);
  const [supCounts, setSupCounts] = useState<any>(null);
  async function loadUsers() { const r = await fetch('/api/admin/users'); const j = await r.json(); setUsers(j.users || []); }
  async function loadPlans() { const r = await fetch('/api/admin/plans'); const j = await r.json(); setPlans(j.plans || []); }
  async function loadTeam() { const r = await fetch('/api/admin/team'); const j = await r.json(); setTeam(j.team || []); const mine = (j.team || []).find((t: Team) => t.email === meEmail); if (mine) setAvailable(!!mine.available); }
  useEffect(() => { loadUsers(); loadPlans(); loadTeam(); }, []);
  // Datos para el bloque "Necesita tu atención" del Resumen (silencioso si no hay permiso)
  useEffect(() => {
    fetch('/api/admin/diag').then((r) => r.ok ? r.json() : null).then((j) => j && setDiag(j)).catch(() => {});
    fetch('/api/admin/support').then((r) => r.ok ? r.json() : null).then((j) => j && setSupCounts(j.counts || {})).catch(() => {});
  }, []);

  const priceOf = useMemo(() => { const m: Record<string, number> = {}; plans.forEach((p) => (m[p.id] = p.price_month)); return m; }, [plans]);
  // Un plan de pago cuenta como "cortesía" si no tiene suscripción de Stripe activa.
  const isActiveSub = (u: User) => ['active', 'trialing', 'past_due'].includes(String(u.subscription_status || ''));
  const paidUsers = users.filter((u) => u.plan && u.plan !== 'free' && isActiveSub(u));
  const compUsers = users.filter((u) => u.plan && u.plan !== 'free' && !isActiveSub(u));
  const paid = paidUsers.length;         // solo los que realmente pagan
  const comped = compUsers.length;       // planes de cortesía (no cuentan en MRR)
  const unconfirmed = users.filter((u) => u.email_confirmed === false).length; // registro a medias
  const mrr = paidUsers.reduce((s, u) => s + (priceOf[u.plan] || 0), 0);
  const availableCount = team.filter((m) => m.available).length;
  const bannedCount = users.filter((u) => u.banned).length;

  // Acción crítica pendiente de confirmar (con nota obligatoria).
  const [pendAct, setPendAct] = useState<{ title: string; danger?: boolean; confirmWord?: string; detail?: string; run: (note: string) => Promise<void> } | null>(null);
  const [pendNote, setPendNote] = useState('');
  const [pendWord, setPendWord] = useState('');   // palabra tecleada para acciones que la exigen (ej. CAMBIAR)
  const [menuFor, setMenuFor] = useState<string | null>(null);   // menú "⋯" abierto por usuario
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);   // posición fija del menú (evita recorte en última fila)
  // Abre el menú "⋯" anclado al botón, con posición fija en viewport; si está cerca del
  // borde inferior, se abre HACIA ARRIBA para que nunca quede cortado.
  function openRowMenu(e: React.MouseEvent, id: string) {
    if (menuFor === id) { setMenuFor(null); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const MENU_W = 214, MENU_H = 232;
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    const top = (r.bottom + MENU_H > window.innerHeight - 8) ? Math.max(8, r.top - MENU_H - 6) : r.bottom + 6;
    setMenuPos({ left, top }); setMenuFor(id);
  }

  async function userAction(id: string, action: string, value?: any, note?: string) { setBusy(id + action); const r = await fetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ id, action, value, note }) }); const j = await r.json(); if (!r.ok) toastErr(j); await loadUsers(); setBusy(''); }
  async function delUser(u: User) {
    setPendAct({ title: (lang === 'en' ? 'Delete ' : 'Borrar ') + u.email + (lang === 'en' ? ' and ALL their data?' : ' y TODOS sus datos?'), danger: true, run: async (note) => {
      setBusy(u.id + 'del'); const r = await fetch('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ id: u.id, note }) }); const j = await r.json(); if (!r.ok) toastErr(j); await loadUsers(); setBusy('');
    } });
    setPendNote('');
  }
  // Abre el modal de confirmación con nota para acciones críticas (ban/admin).
  function askAction(title: string, danger: boolean, id: string, action: string, value?: any) {
    setPendAct({ title, danger, run: async (note) => userAction(id, action, value, note) });
    setPendNote(''); setPendWord('');
  }
  // Cambio de plan de un usuario: exige teclear CAMBIAR / CHANGE + nota antes de aplicar.
  function askPlanChange(u: User, target: string) {
    const from = plans.find((p) => p.id === u.plan)?.name || u.plan;
    const to = plans.find((p) => p.id === target)?.name || target;
    const word = lang === 'en' ? 'CHANGE' : 'CAMBIAR';
    setPendAct({
      title: lang === 'en' ? `Change ${u.email}'s plan: ${from} → ${to}` : `Cambiar el plan de ${u.email}: ${from} → ${to}`,
      detail: lang === 'en' ? `Type ${word} to confirm.` : `Escribe ${word} para confirmar.`,
      confirmWord: word,
      run: async (note) => userAction(u.id, 'plan', target, note),
    });
    setPendNote(''); setPendWord('');
  }
  async function resetPass(u: User) { setBusy(u.id + 'rst'); const r = await fetch('/api/admin/reset-password', { method: 'POST', body: JSON.stringify({ email: u.email }) }); const j = await r.json(); setBusy(''); if (!r.ok) { toastErr(j); return; } if (j.link) { navigator.clipboard.writeText(j.link); toast((lang === 'en' ? 'Recovery link copied:\n\n' : 'Enlace de recuperación copiado:\n\n') + j.link); } else toast(lang === 'en' ? 'Recovery email sent.' : 'Email de recuperación enviado.'); }

  const filtered = users.filter((u) => (u.email + ' ' + (u.full_name || '')).toLowerCase().includes(q.toLowerCase()));
  // Admins arriba (el dueño primero), luego el resto. Grupos con cabecera propia.
  const uAdmins = filtered.filter((u) => u.is_admin).sort((a, b) => (a.email === meEmail ? -1 : 0) - (b.email === meEmail ? -1 : 0));
  const uOthers = filtered.filter((u) => !u.is_admin);
  const uOrdered = [...uAdmins, ...uOthers];
  // Etiqueta de cobro: Pago (suscripción Stripe activa), Cortesía (plan de pago sin suscripción), o Free.
  const planTag = (u: User): 'paid' | 'comp' | 'free' => {
    if (!u.plan || u.plan === 'free') return 'free';
    return ['active', 'trialing', 'past_due'].includes(String(u.subscription_status || '')) ? 'paid' : 'comp';
  };
  const NAV_GROUPS: { g: string; items: [Tab, string, string][] }[] = [
    { g: t.g_op, items: [['resumen', '📊', t.nav_resumen], ['facturacion', '💳', lang === 'en' ? 'Billing' : 'Facturación'], ['usuarios', '👥', t.nav_usuarios], ['correos', '✉️', t.nav_correos], ['soporte', '🎫', t.nav_soporte], ['chat', '💬', lang === 'en' ? 'Team chat' : 'Chat equipo'], ['equipo', '🛡️', t.nav_equipo]] },
    { g: t.g_prod, items: [['planes', '💳', t.nav_planes], ['landing', '🧩', lang === 'en' ? 'Landing Builder' : 'Landing Builder'], ['modulos', '🧩', t.nav_modulos], ['firms', '🏛️', t.nav_firms], ['catalogos', '🗂️', lang === 'en' ? 'Catalogs' : 'Catálogos']] },
    { g: t.g_growth, items: [['campanas', '📣', lang === 'en' ? 'Campaigns' : 'Campañas'], ['blog', '📝', 'Blog'], ['seo', '🔎', 'SEO'], ['embajadores', '🎁', t.nav_embajadores], ['retencion', '🛟', t.nav_retencion]] },
    { g: t.g_sys, items: [['kb', '🧠', t.nav_kb], ['diag', '🩺', t.nav_diag], ['backups', '🗄️', t.nav_backups], ['audit', '📈', t.nav_audit], ['optim', '🚀', t.nav_optim], ['pruebas', '🧪', t.nav_pruebas], ['ajustes', '⚙️', t.nav_ajustes]] },
  ];
  const groups = NAV_GROUPS.map((gr) => ({ ...gr, items: gr.items.filter(([k]) => canSee(k)) })).filter((gr) => gr.items.length);
  const flatNav = groups.flatMap((gr) => gr.items);
  useEffect(() => { if (flatNav.length && !flatNav.some(([k]) => k === tab)) setTab(flatNav[0][0]); }, []);

  return (
    <>
      <AdminLock hasPin={hasPin} idleMin={idleMin} />
      <AdminLeadAlert available={available} />

      <div className="wrap-wide" style={{ padding: '22px 0' }}>
        <div className="adminlayout">
          <div className="adminnav card" style={{ padding: 12 }}>
            {/* Móvil: selector agrupado (se adapta como el menú de arriba) */}
            <select className="adminnav-mobile" value={tab} onChange={(e) => setTab(e.target.value)} style={{ margin: 0, width: '100%' }}>
              {groups.map((gr) => (
                <optgroup key={gr.g} label={gr.g}>
                  {gr.items.map(([k, ic, label]) => <option key={k} value={k}>{`${ic}  ${label}`}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="adminnav-items adminnav-grouped">
              {groups.map((gr) => (
                <div key={gr.g}>
                  <div className="adminnav-group">{gr.g}</div>
                  {gr.items.map(([k, ic, label]) => (
                    <button key={k} className={'adminnav-item' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
                      <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}><OnyxIcon emoji={ic} size={16} /></span><span>{label}</span><span className="navdot" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10 }}>
              <button className={'availpill ' + (available ? 'on' : 'off')} onClick={toggleAvail}>
                <span className="avdot" />
                <span>{available ? t.avail_on : t.avail_off}</span>
                <span className="toggle" style={{ marginLeft: 'auto', background: available ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: available ? 21 : 3 }} /></span>
              </button>
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            {tab === 'resumen' && (
              <>
              <Head ic="📊" t={t.h_resumen_t} s={t.h_resumen_s} />
              <div className="grid g3" style={{ marginBottom: 12 }}>
                <div className="card kpi"><div className="lbl">{t.r_mrr}</div><div className="val pos">${mrr.toLocaleString()}</div><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{paid} {t.r_paying}{comped > 0 && <> · {comped} {lang === 'en' ? 'comp' : 'cortesía'}</>} · {users.length ? Math.round((paid / users.length) * 100) : 0}% {t.r_conversion}</div></div>
                <div className="card kpi"><div className="lbl">{t.r_users}</div><div className="val">{users.length}</div><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{accounts} {t.r_mtAccounts} · {trades.toLocaleString()} {t.r_trades}{unconfirmed > 0 && <> · <span style={{ color: 'var(--amber)' }}>{unconfirmed} {lang === 'en' ? 'unconfirmed' : 'sin confirmar'}</span></>}</div></div>
                <div className="card kpi"><div className="lbl">{t.r_team}</div><div className="val">{team.length}</div><div style={{ fontSize: 12, marginTop: 4, color: availableCount ? 'var(--green)' : 'var(--mut)' }}>● {availableCount} {availableCount === 1 ? t.r_availableNow1 : t.r_availableNow}</div></div>
              </div>

              <div className="grid g4" style={{ marginBottom: 12 }}>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_mtAccounts}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{accounts}</div></div>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_trades}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{trades.toLocaleString()}</div></div>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_paying}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: 'var(--green)' }}>{paid}</div></div>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_banned}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: bannedCount ? 'var(--red)' : 'var(--tx)' }}>{bannedCount}</div></div>
              </div>

              {(() => {
                const missing = (diag?.migrations || []).filter((m: any) => !m.ok);
                const svc = (diag?.services || []).filter((s: any) => !s.ok);
                const openT = supCounts?.open ?? null;
                const items: { txt: string; go?: Tab; cta?: string }[] = [];
                if (missing.length) items.push({ txt: `${missing.length} ${t.r_sqlMissing}`, go: 'diag', cta: t.r_seeDiag });
                if (openT) items.push({ txt: `${openT} ${t.r_ticketsOpen}`, go: 'soporte', cta: t.r_openQueue });
                if (svc.length) items.push({ txt: `${svc.length} ${t.r_svcConfig} (${svc.map((s: any) => s.name).slice(0, 3).join(', ')})`, go: 'diag', cta: t.r_review });
                if (bannedCount) items.push({ txt: `${bannedCount} ${t.r_bannedUsers}`, go: 'usuarios', cta: t.r_seeUsers });
                if (!diag && !supCounts) return null;
                if (!items.length) return (
                  <div className="card" style={{ border: '1px solid rgba(52,226,160,.4)', background: 'rgba(52,226,160,.06)' }}>
                    <b style={{ color: 'var(--green)' }}>✓ {t.r_allGood}</b>
                    <span className="muted" style={{ fontSize: 13 }}>{t.r_noPending}</span>
                  </div>
                );
                return (
                  <div className="card" style={{ border: '1px solid var(--amber)', background: 'rgba(255,192,77,.06)' }}>
                    <div className="row between" style={{ marginBottom: 8 }}>
                      <b style={{ color: 'var(--amber)' }}>{t.r_needs}</b>
                      <span className="pill amber">{items.length}</span>
                    </div>
                    {items.map((it, i) => (
                      <div key={i} className="row between" style={{ padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5 }}>{it.txt}</span>
                        {it.go && <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 12 }} onClick={() => setTab(it.go!)}>{it.cta} →</button>}
                      </div>
                    ))}
                  </div>
                );
              })()}
              </>
            )}

            {tab === 'usuarios' && (
              <>
              <Head ic="👥" t={t.h_usuarios_t} s={`${filtered.length} ${t.h_usuarios_registered}`} />
              <RangeBar value={uRange} onChange={setURange}
                pdfUrl={(f, tt) => `/api/admin/users/report?from=${f}&to=${tt}&lang=${lang}`}
                csvUrl={(f, tt) => `/api/admin/users/report?export=csv&from=${f}&to=${tt}&lang=${lang}`} />
              <CleanSignups />
              <div className="card">
                <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  {unconfirmed > 0 && (
                    <button className="btn btn-ghost" style={{ fontSize: 12.5, color: 'var(--amber)' }} disabled={busy === 'resendall'}
                      onClick={async () => {
                        if (!window.confirm(lang === 'en' ? `Resend the confirmation email to ${unconfirmed} unconfirmed users?` : `¿Reenviar el correo de confirmación a ${unconfirmed} usuarios sin confirmar?`)) return;
                        setBusy('resendall');
                        const r = await fetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ action: 'resend_confirm_all' }) });
                        const j = await r.json(); setBusy('');
                        if (!r.ok) { toastErr(j); return; }
                        toast(lang === 'en' ? `Sent to ${j.sent} of ${j.total}.` : `Enviado a ${j.sent} de ${j.total}.`);
                      }}>
                      {busy === 'resendall' ? '…' : `✉️ ${lang === 'en' ? 'Resend to all' : 'Reenviar a todos'} (${unconfirmed})`}
                    </button>
                  )}
                  <input placeholder={t.u_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, margin: 0, marginLeft: 'auto' }} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th>Email</th><th>Plan</th><th>{lang === 'en' ? 'Status' : 'Estado'}</th><th>{lang === 'en' ? 'Accounts' : 'Cuentas'}</th><th>{lang === 'en' ? 'Last sync' : 'Últ. sync'}</th><th style={{ minWidth: 260 }}>{lang === 'en' ? 'Actions' : 'Acciones'}</th></tr></thead>
                    <tbody>
                      {uOrdered.map((u, i) => (
                        <Fragment key={u.id}>
                        {i === 0 && uAdmins.length > 0 && (
                          <tr><td colSpan={6} style={{ background: 'var(--bg2)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--soft-brand,var(--brand))', padding: '7px 12px' }}>🛡️ {lang === 'en' ? 'Administrators' : 'Administradores'} · {uAdmins.length}</td></tr>
                        )}
                        {i === uAdmins.length && uOthers.length > 0 && (
                          <tr><td colSpan={6} style={{ background: 'var(--bg2)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--mut)', padding: '7px 12px' }}>👥 {lang === 'en' ? 'Users' : 'Usuarios'} · {uOthers.length}</td></tr>
                        )}
                        <tr>
                          <td><div className="row" style={{ gap: 9 }}><span className="avatar-init" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(u.full_name || u.email)}</span><span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block' }}>{u.full_name || u.email}{u.is_admin && <span className="pill brand" style={{ marginLeft: 6 }}>{u.email === meEmail ? (lang === 'en' ? 'Owner' : 'Dueño') : t.u_admin}</span>}</span>
                  {u.full_name && <span className="muted" style={{ fontSize: 12, display: 'block' }}>{u.email}</span>}
                </span></div></td>
                          <td><div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><select value={u.plan} onChange={(e) => { if (e.target.value !== u.plan) askPlanChange(u, e.target.value); }} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{!plans.find((p) => p.id === u.plan) && <option value={u.plan}>{u.plan}</option>}</select>{planTag(u) === 'paid' ? <span className="pill" style={{ color: 'var(--green)', background: 'rgba(52,226,160,.15)', fontSize: 11 }}>{lang === 'en' ? 'Paid' : 'Pago'}</span> : planTag(u) === 'comp' ? <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(240,160,20,.15)', fontSize: 11 }}>🎁 {lang === 'en' ? 'Comp' : 'Cortesía'}</span> : null}</div></td>
                          <td>{u.banned ? <span className="pill red">● {t.u_banned}</span> : u.email_confirmed === false ? <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(240,160,20,.15)' }}>✉ {lang === 'en' ? 'Unconfirmed' : 'Sin confirmar'}</span> : <span className="pill" style={{ color: 'var(--green)', background: 'rgba(52,226,160,.15)' }}>● {u.subscription_status || t.u_active}</span>}</td>
                          <td className="muted">{u.accounts}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{u.lastSync ? fmtDate(u.lastSync, lang) : '—'}</td>
                          <td><div className="row" style={{ gap: 8, alignItems: 'center' }}>
                            <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={() => setUDrawer({ id: u.id, email: u.email })}>
                              {lang === 'en' ? 'Manage' : 'Gestionar'}
                            </button>
                            <div style={{ position: 'relative' }}>
                              <button className="btn btn-ghost" style={{ padding: '6px 11px', fontSize: 15, lineHeight: 1 }} title={lang === 'en' ? 'More' : 'Más'} onClick={(e) => openRowMenu(e, u.id)}>⋯</button>
                              {menuFor === u.id && menuPos && (
                                <>
                                  <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                                  <div style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 14px 34px rgba(0,0,0,.4)', zIndex: 41, width: 214, overflow: 'hidden' }}>
                                    {[
                                      { ic: '✏️', label: lang === 'en' ? 'Edit name' : 'Editar nombre', on: () => { setMenuFor(null); const nn = window.prompt(lang === 'en' ? 'Full name for ' + u.email : 'Nombre para ' + u.email, u.full_name || ''); if (nn !== null) userAction(u.id, 'name', nn.trim()); } },
                                      ...(u.email_confirmed === false ? [{ ic: '✉️', label: lang === 'en' ? 'Resend confirmation' : 'Reenviar confirmación', on: async () => { setMenuFor(null); await userAction(u.id, 'resend_confirm'); toast(lang === 'en' ? 'Confirmation email sent.' : 'Correo de confirmación enviado.'); } }] : []),
                                      { ic: '🔑', label: lang === 'en' ? 'Reset password' : 'Restablecer contraseña', on: () => { setMenuFor(null); resetPass(u); } },
                                      u.banned
                                        ? { ic: '✅', label: lang === 'en' ? 'Unban account' : 'Desbloquear cuenta', on: () => { setMenuFor(null); askAction((lang === 'en' ? 'Unban ' : 'Desbloquear ') + u.email, false, u.id, 'unban'); } }
                                        : { ic: '🚫', label: lang === 'en' ? 'Ban account' : 'Bloquear cuenta', on: () => { setMenuFor(null); askAction((lang === 'en' ? 'Ban ' : 'Bloquear ') + u.email, true, u.id, 'ban'); } },
                                      { ic: '🛡️', label: u.is_admin ? (lang === 'en' ? 'Remove admin' : 'Quitar admin') : (lang === 'en' ? 'Make admin' : 'Hacer admin'), on: () => { setMenuFor(null); askAction((u.is_admin ? (lang === 'en' ? 'Remove admin from ' : 'Quitar admin a ') : (lang === 'en' ? 'Make admin ' : 'Hacer admin a ')) + u.email, false, u.id, 'admin', !u.is_admin); } },
                                    ].map((it, i) => (
                                      <button key={i} onClick={it.on} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', padding: '10px 13px', cursor: 'pointer', color: 'var(--tx)', fontSize: 13 }}>
                                        <span style={{ width: 16, textAlign: 'center' }}>{it.ic}</span>{it.label}
                                      </button>
                                    ))}
                                    {u.email !== meEmail && (
                                      <button onClick={() => { setMenuFor(null); delUser(u); }} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 13px', cursor: 'pointer', color: 'var(--red)', fontSize: 13 }}>
                                        <span style={{ width: 16, textAlign: 'center' }}>🗑️</span>{lang === 'en' ? 'Delete account' : 'Borrar cuenta'}
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div></td>
                        </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}

            {tab === 'correos' && <Emails />}
            {tab === 'campanas' && <Campaigns />}
            {tab === 'seo' && <SeoPanel />}
            {uDrawer && <UserDrawer userId={uDrawer.id} email={uDrawer.email} onClose={() => setUDrawer(null)} />}
            {/* Confirmación con nota obligatoria para acciones críticas */}
            {pendAct && (
              <div onClick={() => setPendAct(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,16,.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '100%', borderRadius: 16, padding: '20px 22px',
                  background: 'linear-gradient(180deg, color-mix(in srgb,var(--card) 92%, #fff 8%), var(--card))',
                  border: '2px solid ' + (pendAct.danger ? 'var(--red)' : 'var(--brand)'),
                  boxShadow: (pendAct.danger ? '0 0 0 4px rgba(226,75,75,.14), 0 24px 60px -18px rgba(226,75,75,.55)' : '0 0 0 4px color-mix(in srgb,var(--brand) 16%,transparent), 0 24px 60px -18px var(--brand)') }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: pendAct.detail ? 6 : 12 }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, flexShrink: 0, fontSize: 17,
                      background: pendAct.danger ? 'rgba(226,75,75,.16)' : 'rgba(124,140,255,.18)' }}>{pendAct.danger ? '⚠️' : '🔁'}</span>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: pendAct.danger ? 'var(--red)' : 'var(--tx)' }}>{pendAct.title}</div>
                  </div>
                  {pendAct.detail && <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{pendAct.detail}</div>}
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{lang === 'en' ? 'Note (required — saved to the log)' : 'Nota (obligatoria — queda en el registro)'}</div>
                  <input value={pendNote} onChange={(e) => setPendNote(e.target.value)} placeholder={lang === 'en' ? 'Reason…' : 'Motivo…'} style={{ margin: '0 0 12px' }} />
                  {pendAct.confirmWord && (() => {
                    const okWord = pendWord.trim().toUpperCase() === pendAct.confirmWord;
                    return (<>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{lang === 'en' ? `Type ` : 'Escribe '}<b style={{ color: 'var(--tx)' }}>{pendAct.confirmWord}</b>{lang === 'en' ? ' to confirm' : ' para confirmar'}</div>
                      <input value={pendWord} onChange={(e) => setPendWord(e.target.value)} placeholder={pendAct.confirmWord} autoCapitalize="characters"
                        style={{ margin: '0 0 14px', letterSpacing: 1, fontWeight: 700, borderColor: pendWord ? (okWord ? 'var(--green)' : 'var(--red)') : undefined }} />
                    </>);
                  })()}
                  <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={() => setPendAct(null)}>{lang === 'en' ? 'Cancel' : 'Cancelar'}</button>
                    {(() => {
                      const wordOk = !pendAct.confirmWord || pendWord.trim().toUpperCase() === pendAct.confirmWord;
                      const ready = !!pendNote.trim() && wordOk;
                      return (
                        <button className={pendAct.danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={!ready} style={{ opacity: ready ? 1 : .5 }}
                          onClick={async () => { const fn = pendAct.run; setPendAct(null); await fn(pendNote.trim()); }}>{lang === 'en' ? 'Confirm' : 'Confirmar'}</button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            {tab === 'planes' && <PlansTab plans={plans} reload={loadPlans} />}
            {tab === 'landing' && <LandingBuilder />}
            {tab === 'equipo' && <Equipo team={team} role={role} meEmail={meEmail} reload={loadTeam} canManage={role === 'owner' || perms.equipo === 'manage'} />}
            {tab === 'embajadores' && <Ambassadors />}
            {tab === 'retencion' && <Retention />}
            {tab === 'pruebas' && <TestConsole meEmail={meEmail} />}
            {tab === 'firms' && <Firms />}
            {tab === 'catalogos' && <CatalogAdmin />}

            {tab === 'facturacion' && <Facturacion
              showIngresos={has('planes')}
              showAcademia={has('academy')}
              showFinanzas={has('finanzas')}
              canManageFinanzas={role === 'owner' || perms.finanzas === 'manage'}
              canManageAcademy={role === 'owner' || perms.academy === 'manage'}
            />}

            {/* Ramas sueltas conservadas para deep-links antiguos (?tab=ingresos/finanzas/academy) */}
            {tab === 'ingresos' && <Revenue />}
            {tab === 'finanzas' && <Finanzas canManage={role === 'owner' || perms.finanzas === 'manage'} />}
            {tab === 'academy' && <AcademyAdmin canManage={role === 'owner' || perms.academy === 'manage'} />}

            {tab === 'modulos' && <Modules />}

            {tab === 'soporte' && <SupportInbox />}

            {tab === 'chat' && <TeamChat />}

            {tab === 'kb' && <KbEditor />}
            {tab === 'blog' && <BlogEditor />}

            {tab === 'diag' && <Diagnostics />}

            {tab === 'backups' && <Backups />}

            {tab === 'audit' && <Audit />}

            {tab === 'optim' && <Optimize />}

            {tab === 'ajustes' && (
              <div style={{ maxWidth: 640 }}>
                <Head ic="⚙️" t={t.h_ajustes_t} s={t.h_ajustes_s} />
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <span>{t.a_yourRole}</span>
                    <span className="pill" style={{ color: roleColor(role), background: 'rgba(124,140,255,.12)' }}>{(t as any)['role_' + role] || role}</span>
                  </div>
                </div>
                {/* Tu seguridad personal: visible para todo admin/empleado. */}
                <SecurityControl idleMin={idleMin} />
                <BackupCodes />

                {/* Solo el Owner: roles, barra de descuentos y modo beta. */}
                {role === 'owner' && (
                  <>
                    <div className="card" style={{ marginBottom: 12 }}>
                      <h3 style={{ marginBottom: 6 }}>{t.a_rolesTitle}</h3>
                      <p className="muted" style={{ fontSize: 13.5, marginBottom: 8 }}>{t.a_rolesBody}</p>
                      <p className="muted" style={{ fontSize: 13 }}>{t.a_rolesEnv}</p>
                    </div>
                    <EnvSwitch />
                    <PromoControl />
                    <OnlineNowControl />
                    <AlertsControl />
                    <BetaControl />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Estado real de los módulos, con métricas en vivo de la base de datos.
function Modules() {
  const t = useT();
  const { lang } = useLang();
  const [m, setM] = useState<any>(null);
  const [lf, setLf] = useState<any>(null);          // base editable de las cifras del landing
  const [savingL, setSavingL] = useState(false);
  const [savedL, setSavedL] = useState(false);
  const [ver, setVer] = useState<any>(null);        // versión de la app (canales)
  const [verBusy, setVerBusy] = useState('');
  const [verModal, setVerModal] = useState<'promote' | 'rollback' | null>(null);   // popup de confirmación
  const [verNote, setVerNote] = useState('');
  const [verPin, setVerPin] = useState('');
  const [verErr, setVerErr] = useState('');
  const loadVer = () => fetch('/api/admin/version').then((r) => r.json()).then(setVer).catch(() => {});
  useEffect(() => { loadVer(); }, []);
  function openVerModal(action: 'promote' | 'rollback') { setVerModal(action); setVerNote(''); setVerPin(''); setVerErr(''); }
  async function confirmVer() {
    if (!verModal) return;
    setVerBusy(verModal); setVerErr('');
    try {
      const r = await fetch('/api/admin/version', { method: 'POST', body: JSON.stringify({ action: verModal, note: verNote, pin: verPin }) });
      const j = await r.json();
      if (!r.ok) { setVerErr(j.error || 'Error'); return; }
      setVer(j); setVerModal(null);
    } finally { setVerBusy(''); }
  }
  async function saveVer(patch: any) {   // notas / número de beta (sin PIN)
    setVerBusy('set'); try { const r = await fetch('/api/admin/version', { method: 'POST', body: JSON.stringify({ action: 'set', ...patch }) }); setVer(await r.json()); } finally { setVerBusy(''); }
  }
  // Auto-refresco en vivo: los contadores suben solos sin pulsar Refrescar.
  useEffect(() => {
    const load = () => fetch('/api/admin/modules').then((r) => r.json()).then((d: any) => {
      setM(d);
      // Solo la primera vez, para no pisar lo que el admin esté escribiendo.
      setLf((prev: any) => prev ?? { trades_base: d.landing?.trades_base || 0, blocks_base: d.landing?.blocks_base || 0, accounts_base: d.landing?.accounts_base || 0, platforms: d.landing?.platforms ?? 4, readonly: d.landing?.readonly ?? 100 });
    }).catch(() => setM((v: any) => v || {}));
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, []);
  async function saveLanding() {
    if (!lf) return;
    setSavingL(true);
    try { await fetch('/api/admin/modules', { method: 'PATCH', body: JSON.stringify(lf) }); setSavedL(true); setTimeout(() => setSavedL(false), 2200); }
    finally { setSavingL(false); }
  }
  const es = lang === 'es';
  const LiveBadge = () => <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.mo_liveBadge}</span>;

  const StatusPill = ({ on, txt }: { on: boolean; txt: string }) => (
    <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...(on ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--soft-purple)', background: 'rgba(160,107,255,.18)' }) }}>
      {on ? <span className="livedot" /> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--soft-purple)' }} />}{txt}
    </span>
  );
  const Tile = ({ label, value, live, color }: { label: string; value: any; live?: boolean; color?: string }) => (
    <div className="tile" style={live ? { boxShadow: 'inset 0 0 0 1px rgba(52,226,160,.35)' } : undefined}>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div className="row" style={{ gap: 7, marginTop: 3 }}>
        <span style={{ fontSize: typeof value === 'number' ? 24 : 15, fontWeight: 800, lineHeight: 1, color: color || 'var(--tx)' }}>{typeof value === 'number' ? Number(value).toLocaleString() : value}</span>
        {live && <span className="livedot" />}
      </div>
    </div>
  );
  const Ic = ({ e }: { e: string }) => <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{e}</span>;

  if (!m) return <div className="muted">…</div>;
  const tiles = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(92px,1fr))', gap: 10 } as any;
  const gLive = (m.guardian?.liveNow ?? 0) > 0;
  const tgLive = (m.telegram?.linked ?? 0) > 0;

  return (
    <>
    <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
      <Head ic="🧩" t={t.h_modulos_t} s={t.h_modulos_s} />
      <LiveBadge />
    </div>
    <div className="grid g2">
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><div className="row" style={{ gap: 10 }}><Ic e="🛡️" /><h3>Onyx Guardian</h3></div><StatusPill on txt={t.mo_active} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.mo_guardian_desc}</p>
        <div style={tiles}>
          <Tile label={t.mo_connected} value={m.guardian?.connected ?? 0} />
          <Tile label={t.mo_liveNow} value={m.guardian?.liveNow ?? 0} live={gLive} color={gLive ? 'var(--green)' : undefined} />
          <Tile label={t.mo_withGuardian} value={m.guardian?.accounts ?? 0} color="var(--soft-brand)" />
          <Tile label={t.mo_blocks} value={m.guardian?.blocks ?? 0} />
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><div className="row" style={{ gap: 10 }}><Ic e="📣" /><h3>Telegram</h3></div><StatusPill on={!!m.telegram?.active} txt={m.telegram?.active ? t.mo_active : t.mo_notoken} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.mo_tg_desc}</p>
        <div style={tiles}>
          <Tile label={t.mo_tg_connected} value={m.telegram?.linked ?? 0} live={tgLive} color={tgLive ? 'var(--green)' : undefined} />
          <Tile label={t.mo_tg_sent7d} value={m.telegram?.sent7d ?? 0} />
          <Tile label={t.mo_tg_status} value={m.telegram?.status ?? 0} />
          <Tile label={t.mo_tg_failed} value={m.telegram?.failed7d ?? 0} color={(m.telegram?.failed7d ?? 0) > 0 ? 'var(--amber)' : undefined} />
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><div className="row" style={{ gap: 10 }}><Ic e="📄" /><h3>{t.mo_weekly_t}</h3></div><StatusPill on txt={t.mo_active} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.mo_weekly_desc}</p>
        <div style={tiles}>
          <Tile label={t.mo_rep_sent} value={m.reports?.sent ?? 0} />
          <Tile label={t.mo_rep_eligible} value={m.reports?.eligible ?? 0} color="var(--soft-brand)" />
          <Tile label={t.mo_rep_next} value={nextSunday()} />
        </div>
      </div>

      {lf && (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 10 }}><Ic e="🌐" /><h3>{es ? 'Cifras del landing' : 'Landing numbers'}</h3></div>
            <LiveBadge />
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{es ? 'Fija una base para cada cifra. Lo que se ve en el landing = tu base + lo real de todos los usuarios, y sube solo en vivo.' : 'Set a base for each number. What the landing shows = your base + real user activity, and it grows live on its own.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            {[
              ['trades_base', es ? 'Operaciones analizadas' : 'Trades analyzed', m?.landing?.realTrades ?? 0],
              ['blocks_base', es ? 'Frenos del Guardian' : 'Guardian blocks', m?.landing?.realBlocks ?? 0],
              ['accounts_base', es ? 'Cuentas conectadas' : 'Connected accounts', m?.landing?.realAccounts ?? 0],
            ].map(([k, label, real]: any) => (
              <div key={k}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
                <input type="number" min={0} value={lf[k]} onChange={(e) => setLf({ ...lf, [k]: Math.max(0, Number(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} />
                <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                  {es ? 'Real ahora' : 'Real now'}: <b>{Number(real).toLocaleString()}</b> · {es ? 'se muestra' : 'shows'}: <b style={{ color: 'var(--soft-brand)' }}>{(Number(lf[k] || 0) + Number(real)).toLocaleString()}</b>
                </div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, margin: '16px 0 6px', fontWeight: 700 }}>{es ? 'Valores fijos (no dependen del uso)' : 'Fixed values (independent of usage)'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{es ? 'Plataformas' : 'Platforms'}</div>
              <input type="number" min={0} value={lf.platforms ?? 4} onChange={(e) => setLf({ ...lf, platforms: Math.max(0, Number(e.target.value) || 0) })} style={{ margin: 0, width: '100%' }} />
              <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>{es ? 'Se muestra como' : 'Shows as'}: <b style={{ color: 'var(--soft-brand)' }}>{Number(lf.platforms ?? 4)}</b></div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{es ? 'Conexión solo lectura (%)' : 'Read-only connection (%)'}</div>
              <input type="number" min={0} max={100} value={lf.readonly ?? 100} onChange={(e) => setLf({ ...lf, readonly: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ margin: 0, width: '100%' }} />
              <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>{es ? 'Se muestra como' : 'Shows as'}: <b style={{ color: 'var(--soft-brand)' }}>{Number(lf.readonly ?? 100)}%</b></div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveLanding} disabled={savingL}>
            {savingL ? (es ? 'Guardando…' : 'Saving…') : savedL ? (es ? '✓ Guardado' : '✓ Saved') : (es ? 'Guardar cifras' : 'Save numbers')}
          </button>
        </div>
      )}

      {ver && (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 10 }}><Ic e="🏷️" /><h3>{es ? 'Versión de la app' : 'App version'}</h3></div>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{es ? 'Canales Stable ← Production ← Beta. Production es lo que ven todos (sale en el footer).' : 'Channels Stable ← Production ← Beta. Production is what everyone sees (shown in the footer).'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card2)' }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Stable</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{ver.stable ? 'v' + ver.stable : '—'}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{es ? 'respaldo' : 'rollback'}</div>
            </div>
            <div style={{ padding: 12, border: '2px solid var(--green)', borderRadius: 10, background: 'rgba(52,226,160,.08)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--green)' }}>Production</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>v{ver.production}</div>
              <div style={{ fontSize: 11.5, color: 'var(--green)' }}>{es ? 'lo que ven todos' : 'everyone sees'}</div>
            </div>
            <div style={{ padding: 12, border: '2px solid var(--brand)', borderRadius: 10, background: 'rgba(124,140,255,.08)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--soft-brand)' }}>Beta</div>
              <input value={ver.beta} onChange={(e) => setVer({ ...ver, beta: e.target.value })} onBlur={(e) => saveVer({ beta: e.target.value })}
                style={{ margin: '2px 0', width: '100%', fontSize: 20, fontWeight: 800, background: 'transparent', border: 'none', color: 'var(--soft-brand)' }} />
              <div style={{ fontSize: 11.5, color: 'var(--soft-brand)' }}>{es ? 'solo testers' : 'testers only'}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{es ? 'Notas de la Beta (changelog)' : 'Beta notes (changelog)'}</div>
            <textarea value={ver.notes?.[ver.beta] || ''} onChange={(e) => setVer({ ...ver, notes: { ...ver.notes, [ver.beta]: e.target.value } })}
              onBlur={(e) => saveVer({ notes: { [ver.beta]: e.target.value } })} rows={2} placeholder={es ? 'Qué hay de nuevo en esta versión…' : 'What\'s new in this version…'}
              style={{ width: '100%', margin: 0 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => openVerModal('promote')} disabled={!!verBusy}>🚀 {es ? 'Promover Beta → Production' : 'Promote Beta → Production'}</button>
            <button className="btn btn-ghost" onClick={() => openVerModal('rollback')} disabled={!!verBusy || !ver.stable} title={!ver.stable ? (es ? 'No hay versión Stable a la que volver' : 'No Stable version to roll back to') : ''}>↩︎ {es ? 'Rollback a Stable' : 'Rollback to Stable'}</button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{es ? `Al promover: v${ver.production} → Stable · v${ver.beta} → Production · nueva Beta automática. Cada cambio pide tu PIN.` : `On promote: v${ver.production} → Stable · v${ver.beta} → Production · new Beta auto-opens. Each change asks for your PIN.`}</p>

          {/* Historial de cambios automático */}
          {!!(ver.log && ver.log.length) && (
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 700 }}>{es ? 'Historial de cambios' : 'Change log'}</div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                {ver.log.slice(0, 8).map((e: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ flex: 'none', color: e.action === 'promote' ? 'var(--green)' : e.action === 'rollback' ? 'var(--amber)' : 'var(--mut)' }}>{e.action === 'promote' ? '🚀' : e.action === 'rollback' ? '↩︎' : '✏️'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {e.action === 'promote' ? (es ? `Promovió v${e.from} → v${e.to}` : `Promoted v${e.from} → v${e.to}`)
                          : e.action === 'rollback' ? (es ? `Rollback: v${e.from} → v${e.to} (Stable)` : `Rollback: v${e.from} → v${e.to} (Stable)`)
                          : (es ? `Editó la Beta v${e.from} → v${e.to}` : `Edited Beta v${e.from} → v${e.to}`)}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{e.by} · {new Date(e.at).toLocaleString(es ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{e.note ? ` · “${e.note}”` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Popup de confirmación iluminado con PIN */}
      {verModal && ver && (
        <div onClick={() => !verBusy && setVerModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6vh 16px' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 400, padding: 22, border: '2px solid var(--brand)', boxShadow: '0 0 40px rgba(124,140,255,.4)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{verModal === 'promote' ? '🚀 ' : '↩︎ '}{es ? 'Confirmar cambio de versión' : 'Confirm version change'}</div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>{verModal === 'promote' ? (es ? 'Promover Beta → Production. Cambia lo que ven todos.' : 'Promote Beta → Production. Changes what everyone sees.') : (es ? 'Revertir Production a la versión Stable.' : 'Revert Production to the Stable version.')}</div>
            <div className="row between" style={{ background: 'var(--card2)', borderRadius: 10, padding: 12, marginBottom: 14, gap: 8 }}>
              <div style={{ textAlign: 'center', flex: 1 }}><div className="muted" style={{ fontSize: 11 }}>{es ? 'Production ahora' : 'Production now'}</div><div style={{ fontSize: 18, fontWeight: 800 }}>v{ver.production}</div></div>
              <span style={{ color: 'var(--brand)' }}>→</span>
              <div style={{ textAlign: 'center', flex: 1 }}><div style={{ fontSize: 11, color: 'var(--soft-brand)' }}>{es ? 'quedará' : 'will be'}</div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--soft-brand)' }}>v{verModal === 'promote' ? ver.beta : ver.stable}</div></div>
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{es ? 'Notas del cambio (van al historial)' : 'Change notes (go to the log)'}</div>
            <textarea value={verNote} onChange={(e) => setVerNote(e.target.value)} rows={2} placeholder={es ? 'Qué se corrigió o añadió…' : 'What was fixed or added…'} style={{ width: '100%', marginBottom: 12 }} />
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{es ? 'PIN de seguridad' : 'Security PIN'}</div>
            <input type="password" inputMode="numeric" value={verPin} onChange={(e) => setVerPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="••••••" style={{ width: '100%', letterSpacing: 6, textAlign: 'center', marginBottom: 14 }} />
            {verErr && <p style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 10 }}>{verErr}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setVerModal(null)} disabled={!!verBusy}>{es ? 'Cancelar' : 'Cancel'}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmVer} disabled={!!verBusy}>{verBusy ? (es ? 'Aplicando…' : 'Applying…') : (es ? 'Confirmar' : 'Confirm')}</button>
            </div>
          </div>
        </div>
      )}

      <ChatWidgetEditor />

      <div className="muted" style={{ fontSize: 12, gridColumn: '1 / -1' }}>{t.mo_needLog}</div>
    </div>
    </>
  );
}

// Agrupa las acciones del registro por tema, para filtrarlo con botones.
const LOG_TOPICS: [string, string, string][] = [['all', 'Todos', '🗂️'], ['equipo', 'Equipo', '🛡️'], ['soporte', 'Soporte', '🎫'], ['campanas', 'Campañas', '📣'], ['baseia', 'Base IA', '🧠'], ['usuarios', 'Usuarios', '👥'], ['planes', 'Planes', '💳']];
function topicOf(action: string): string {
  const a = String(action || '').toLowerCase();
  if (a.startsWith('team')) return 'equipo';
  if (a.startsWith('campaign')) return 'campanas';   // antes de 'delete'/'plan' para no clasificarse mal
  if (a.startsWith('support') || a.startsWith('ticket')) return 'soporte';
  if (a.startsWith('kb')) return 'baseia';
  if (a.includes('plan')) return 'planes';
  if (['ban', 'admin', 'reset', 'user', 'delete'].some((x) => a.includes(x))) return 'usuarios';
  return 'otros';
}
const topicIcon: any = { equipo: '🛡️', soporte: '🎫', campanas: '📣', baseia: '🧠', usuarios: '👥', planes: '💳', otros: '•' };

// Fecha del próximo domingo (el informe semanal sale los domingos a las 06:00).
function nextSunday(): string {
  const d = new Date();
  const add = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) + ' · 06:00';
}

function Equipo({ team, role, meEmail, reload, canManage }: { team: Team[]; role: string; meEmail: string; reload: () => void; canManage: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('support');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState('');
  const [log, setLog] = useState<any[]>([]);
  const [logMember, setLogMember] = useState('');
  const [logTopic, setLogTopic] = useState('all');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [logAll, setLogAll] = useState(false);
  const [logQ, setLogQ] = useState('');   // búsqueda por palabra en el registro
  const [secPins, setSecPins] = useState<string[]>([]);      // ids de miembros con PIN (owner)
  const [pinEditId, setPinEditId] = useState('');
  const [pinVal, setPinVal] = useState('');
  const loadSec = () => fetch('/api/admin/security').then((r) => r.json()).then((d) => setSecPins(d.managed || [])).catch(() => {});
  useEffect(() => { if (canManage) loadSec(); }, []);
  async function assignPin(memberId: string, pin: string) {
    const r = await fetch('/api/admin/security', { method: 'PATCH', body: JSON.stringify({ userId: memberId, pin }) });
    const j = await r.json(); if (!r.ok) { toastErr(j); return; }
    setPinEditId(''); setPinVal(''); loadSec();
  }
  function logQuick(days: number | null) {
    if (days === null) { setLogFrom(''); setLogTo(''); return; }
    setLogFrom(new Date(Date.now() - days * 86400000).toISOString().slice(0, 10));
    setLogTo(new Date().toISOString().slice(0, 10));
  }

  async function add() { if (!email) return; setBusy(true); const r = await fetch('/api/admin/team', { method: 'POST', body: JSON.stringify({ email, role: newRole }) }); const j = await r.json(); setBusy(false); if (!r.ok) { toastErr(j); return; } setEmail(''); reload(); loadSec(); if (j.tempPin) toast((j.emailed ? t.t_addedEmailed : t.t_addedNoMail).replace('{pin}', j.tempPin)); }
  async function changeRole(id: string, r2: string) { const r = await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ id, role: r2 }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } reload(); }
  async function savePerm(id: string, area: string, level: string, current: any) { const perms = { ...(current || {}), [area]: level }; const r = await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ id, perms }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } reload(); }
  async function remove(id: string) { if (!confirm(lang === 'en' ? 'Remove admin access from this person?' : '¿Quitar acceso de administrador a esta persona?')) return; const r = await fetch('/api/admin/team', { method: 'DELETE', body: JSON.stringify({ id }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } reload(); }
  async function loadLog(member = '') { setLogMember(member); const r = await fetch('/api/admin/activity' + (member ? '?member=' + encodeURIComponent(member) : '')); const j = await r.json(); setLog(j.log || []); }
  useEffect(() => { loadLog(); }, []);

  return (
    <>
      <Head ic="🛡️" t={t.h_equipo_t} s={canManage ? t.h_equipo_s : t.h_equipo_s_ro} />
      <div className="card" style={{ marginBottom: 14 }}>
        {team.map((m, i) => (
          <div key={m.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '13px 0' }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 11, alignItems: 'center' }}>
                <span style={{ position: 'relative' }}>
                  <span className="avatar-init">{initials(m.email)}</span>
                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--card)', background: m.available ? 'var(--green)' : 'var(--line)' }} title={m.available ? 'Disponible' : 'Ausente'} />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.email}{m.email === meEmail && <span className="muted" style={{ fontSize: 12 }}>{t.t_you}</span>}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{m.last_active ? t.t_lastActivity + fmtDateTime(m.last_active, lang) : t.t_noActivity}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {canManage && m.role !== 'owner' ? (
                  <select value={m.role || 'support'} onChange={(e) => changeRole(m.id, e.target.value)} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}>
                    <option value="admin">{t.role_admin}</option><option value="support">{t.role_support}</option><option value="marketing">{t.role_marketing}</option><option value="custom">{t.role_custom}</option>
                  </select>
                ) : <span className="pill" style={{ color: roleColor(m.role), background: 'rgba(124,140,255,.12)' }}>{(t as any)['role_' + (m.role || 'admin')]}</span>}
                {canManage && m.role !== 'owner' && <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setEditId(editId === m.id ? '' : m.id)}>{editId === m.id ? t.t_close : t.t_perms}</button>}
                {canManage && <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => { setPinEditId(pinEditId === m.id ? '' : m.id); setPinVal(''); }}>🔒 {secPins.includes(m.id) ? t.t_pinSet : t.t_pinAssign}</button>}
                {canManage && m.role !== 'owner' && m.email !== meEmail && <button className="btn btn-danger" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => remove(m.id)}>{t.t_remove}</button>}
              </div>
            </div>

            {editId === m.id && canManage && (
              <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t.t_permsByArea} <span style={{ opacity: .7 }}>{t.t_permsHint}</span></div>
                {AREAS.map((a) => {
                  const eff = effectivePerms(m.role || 'support', m.perms || {});
                  const cur = (eff[a.id] as string) || 'none';
                  const dcol = cur === 'manage' ? 'var(--green)' : cur === 'view' ? 'var(--brand)' : 'var(--line)';
                  return (
                    <div key={a.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dcol, flex: 'none' }} />
                      <span style={{ fontSize: 13, flex: 1, minWidth: 120 }}>{(t as any)['nav_' + a.id] || a.label}</span>
                      <div className="seg">
                        {(['none', 'view', 'manage'] as const).map((lv) => (
                          <button key={lv} className={'segbtn' + (cur === lv ? ' on-' + lv : '')} onClick={() => savePerm(m.id, a.id, lv, m.perms)}>{(t as any)['lvl_' + lv]}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pinEditId === m.id && canManage && (
              <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🔒 {t.t_pinTitle} — {secPins.includes(m.id) ? <span style={{ color: 'var(--soft-green)' }}>{t.t_pinHas}</span> : t.t_pinNone}</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <input value={pinVal} onChange={(e) => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" maxLength={6}
                    style={{ width: 120, letterSpacing: 4, textAlign: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)' }} />
                  <button className="btn btn-primary" style={{ padding: '6px 12px' }} disabled={pinVal.length !== 6} onClick={() => assignPin(m.id, pinVal)}>{t.t_pinAssignBtn}</button>
                  {secPins.includes(m.id) && <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={() => assignPin(m.id, '')}>{t.t_pinReset}</button>}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t.t_pinHint}</div>
              </div>
            )}
          </div>
        ))}

        {canManage && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 6 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.t_invite}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input placeholder={t.t_invitePh} value={email} onChange={(e) => setEmail(e.target.value)} style={{ margin: 0, maxWidth: 240 }} />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ margin: 0, width: 'auto' }}>
                <option value="admin">{t.role_admin}</option><option value="support">{t.role_support}</option><option value="marketing">{t.role_marketing}</option><option value="custom">{t.role_custom}</option>
              </select>
              <button className="btn btn-primary" onClick={add} disabled={busy || !email}>{busy ? '...' : t.t_inviteBtn}</button>
            </div>
          </div>
        )}
      </div>

      {/* Registro de actividad: filtro por fecha, tema y miembro */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>🕘 {t.t_activity}</h3>
          {(() => { const qp = `${logFrom ? `from=${logFrom}&` : ''}${logTo ? `to=${logTo}&` : ''}${logMember ? `member=${encodeURIComponent(logMember)}&` : ''}lang=${lang}`; return (
            <span className="row" style={{ gap: 8 }}>
              <a className="btn btn-ghost" href={`/api/admin/activity/report?${qp}`} target="_blank" rel="noreferrer" style={{ padding: '5px 11px', fontSize: 12 }}>🖨️ PDF</a>
              <a className="btn btn-ghost" href={`/api/admin/activity/report?export=csv&${qp}`} style={{ padding: '5px 11px', fontSize: 12 }}>⤓ CSV</a>
            </span>
          ); })()}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          <div><label className="muted" style={{ fontSize: 11.5, display: 'block' }}>{t.t_from}</label>
            <input type="date" value={logFrom} onChange={(e) => { setLogFrom(e.target.value); setLogAll(true); }} style={{ width: 150, marginTop: 3 }} /></div>
          <div><label className="muted" style={{ fontSize: 11.5, display: 'block' }}>{t.t_to}</label>
            <input type="date" value={logTo} onChange={(e) => { setLogTo(e.target.value); setLogAll(true); }} style={{ width: 150, marginTop: 3 }} /></div>
          <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { logQuick(1); setLogAll(true); }}>{t.t_today}</button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { logQuick(7); setLogAll(true); }}>{t.q7}</button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { logQuick(null); setLogAll(false); }}>{t.qAll}</button>
          </div>
        </div>
        {/* Búsqueda por palabra: acción, admin, destino, nota… */}
        <div style={{ position: 'relative', marginBottom: 10, maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--mut)' }}>🔍</span>
          <input value={logQ} onChange={(e) => { setLogQ(e.target.value); setLogAll(true); }} placeholder={lang === 'es' ? 'Buscar: crédito, email, plan, nota…' : 'Search: credit, email, plan, note…'} style={{ width: '100%', margin: 0, paddingLeft: 32 }} />
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {LOG_TOPICS.map(([k, label, ic]) => {
            const n = k === 'all' ? log.length : log.filter((e) => topicOf(e.action) === k).length;
            if (k !== 'all' && !n) return null;
            return <button key={k} className={'segbtn' + (logTopic === k ? ' on-view' : '')} style={{ background: logTopic === k ? undefined : 'var(--card2)', padding: '5px 11px', fontSize: 12 }} onClick={() => setLogTopic(k)}>{ic} {(t as any)['lt_' + k] || label}{k !== 'all' ? ` ${n}` : ''}</button>;
          })}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t.t_member}</span>
          <button className={'segbtn' + (!logMember ? ' on-view' : '')} style={{ background: !logMember ? undefined : 'var(--card2)', padding: '4px 10px', fontSize: 12 }} onClick={() => loadLog('')}>{t.t_all}</button>
          {team.map((m) => <button key={m.id} className={'segbtn' + (logMember === m.email ? ' on-view' : '')} style={{ background: logMember === m.email ? undefined : 'var(--card2)', padding: '4px 10px', fontSize: 12 }} onClick={() => loadLog(m.email)}>{m.email.split('@')[0]}</button>)}
        </div>
        {(() => {
          const fromMs = logFrom ? new Date(logFrom + 'T00:00:00').getTime() : -Infinity;
          const toMs = logTo ? new Date(logTo + 'T23:59:59').getTime() : Infinity;
          const q = logQ.trim().toLowerCase();
          const matched = log.filter((e) => {
            if (logTopic !== 'all' && topicOf(e.action) !== logTopic) return false;
            const m = new Date(e.created_at).getTime();
            if (!(m >= fromMs && m <= toMs)) return false;
            if (q) {
              const hay = (describeLog(e, lang).text + ' ' + (e.admin_email || '') + ' ' + (e.target || '') + ' ' + JSON.stringify(e.meta || {})).toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          });
          if (!matched.length) return <p className="muted" style={{ fontSize: 14 }}>{t.t_noActivityTopic}</p>;
          const shown = logAll ? matched : matched.slice(0, 8);
          const hidden = matched.length - shown.length;
          return (
            <>
              {shown.map((e, i) => {
                const dl = describeLog(e, lang); const cs = CAT_STYLE[dl.cat];
                return (
                  <div key={i} style={{ borderLeft: `3px solid ${cs.color}`, background: cs.bg, borderRadius: '0 8px 8px 0', padding: '8px 11px', marginTop: i ? 6 : 0 }}>
                    <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--tx)' }}><span style={{ marginRight: 6 }}>{cs.icon}</span><b>{e.admin_email?.split('@')[0]}</b> · {dl.text}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{fmtDateTime(e.created_at, lang)}</span>
                    </div>
                  </div>
                );
              })}
              {(hidden > 0 || (logAll && matched.length > 8)) && (
                <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: 12.5, color: 'var(--mut)' }} onClick={() => setLogAll(!logAll)}>
                  {logAll ? `▲ ${t.t_showLess}` : `▼ ${t.t_showMore.replace('{n}', String(hidden))}`}
                </button>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}

function PlansTab({ plans, reload }: { plans: Plan[]; reload: () => void }) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Head ic="💳" t={t.h_planes_t} s={t.h_planes_s} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}>{t.pl_new}</button>
      </div>
      {creating && <PlanCard plan={{ id: '', name: '', name_en: '', desc_es: '', desc_en: '', price_month: 0, price_year: 0, stripe_price_id: '', stripe_price_id_year: '', max_accounts: 1, features: [], features_en: [], badge: '', badge_en: '', active: true, sort: plans.length, capabilities: {} } as any} isNew reload={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />}
      <div className="grid g3">{plans.map((p) => <PlanCard key={p.id} plan={p} reload={reload} />)}</div>
      <Addons />
    </>
  );
}

function PlanCard({ plan, isNew, reload, onCancel }: { plan: Plan; isNew?: boolean; reload: () => void; onCancel?: () => void }) {
  const t = useT();
  const [p, setP] = useState<Plan>({ ...plan, features: plan.features || [], features_en: plan.features_en || [], capabilities: plan.capabilities || {} });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Plan, v: any) => setP({ ...p, [k]: v });
  const setCap = (k: string, v: any) => setP({ ...p, capabilities: { ...p.capabilities, [k]: v } });
  const norm = (f: any) => (Array.isArray(f) ? f : String(f || '').split('\n')).map((s: any) => String(s).trim()).filter(Boolean);

  async function save() {
    setSaving(true);
    const caps = { ...p.capabilities, history_days: Number(p.capabilities?.history_days) || 0 };
    const body = { ...p, features: norm(p.features), features_en: norm(p.features_en), capabilities: caps };
    const r = await fetch('/api/admin/plans', { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(body) });
    const j = await r.json(); setSaving(false);
    if (!r.ok) { toastErr(j); return; } reload();
  }
  const [cf, setCf] = useState<any>(null);
  function del() {
    setCf({ title: `${t.pl_confirmDel} "${p.name}"?`, danger: true, run: async (note: string) => {
      const r = await fetch('/api/admin/plans', { method: 'DELETE', body: JSON.stringify({ id: p.id, note }) }); const j = await r.json(); if (!r.ok) { toastErr(j); return; } reload();
    } });
  }

  const featES = Array.isArray(p.features) ? p.features.join('\n') : (p.features as any);
  const featEN = Array.isArray(p.features_en) ? p.features_en.join('\n') : (p.features_en as any);
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 8, display: 'block' } as any;
  const ta = { width: '100%', marginTop: 4, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' } as any;
  const flag = { fontSize: 12, fontWeight: 700, letterSpacing: '.5px', color: 'var(--brand)', margin: '14px 0 2px', display: 'block' } as any;

  const popular = !!(p.badge && p.badge.trim());
  return (
    <div className="card" style={{ ...(p.active ? {} : { opacity: .6 }), ...(popular ? { border: '2px solid var(--brand)' } : {}), position: 'relative' }}>
      {popular && <span className="pill brand" style={{ position: 'absolute', top: -11, left: 16 }}>★ {p.badge}</span>}
      <div className="row" style={{ gap: 8 }}>
        <input placeholder={t.pl_id} value={p.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} style={{ margin: 0, width: 90 }} />
        <div style={{ flex: 1 }}><span style={lbl}>{t.pl_month}</span><input type="number" value={p.price_month} onChange={(e) => set('price_month', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
        <div style={{ flex: 1 }}><span style={lbl}>{t.pl_year}</span><input type="number" value={p.price_year} onChange={(e) => set('price_year', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
      </div>

      <span style={flag}>{t.pl_es}</span>
      <input placeholder={t.pl_name} value={p.name} onChange={(e) => set('name', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder={t.pl_desc} value={p.desc_es || ''} onChange={(e) => set('desc_es', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder={t.pl_badge} value={p.badge || ''} onChange={(e) => set('badge', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>{t.pl_features}</span>
      <textarea value={featES} onChange={(e) => set('features', e.target.value.split('\n') as any)} rows={4} style={ta} />

      <span style={flag}>{t.pl_en}</span>
      <input placeholder={t.pl_nameEn} value={p.name_en || ''} onChange={(e) => set('name_en', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder={t.pl_descEn} value={p.desc_en || ''} onChange={(e) => set('desc_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder={t.pl_badgeEn} value={p.badge_en || ''} onChange={(e) => set('badge_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>{t.pl_featuresEn}</span>
      <textarea value={featEN} onChange={(e) => set('features_en', e.target.value.split('\n') as any)} rows={4} style={ta} />

      <span style={flag}>{t.pl_caps}</span>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '6px 0 8px' }}>
        <span style={{ fontSize: 13, flex: 1 }}>{t.pl_mtAccounts}</span>
        <input type="number" value={p.max_accounts} onChange={(e) => set('max_accounts', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
      </div>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '0 0 10px' }}>
        <span style={{ fontSize: 13, flex: 1 }}>{t.pl_historyDays} <span className="muted">{t.pl_unlimited}</span></span>
        <input type="number" value={p.capabilities?.history_days ?? 0} onChange={(e) => setCap('history_days', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
      </div>
      {CAPS.map((k) => (
        <div key={k} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 13 }}>{(t as any)['cap_' + k] || CAP_FALLBACK[k] || k}</span>
          <Toggle on={!!p.capabilities?.[k]} onClick={() => setCap(k, !p.capabilities?.[k])} />
        </div>
      ))}
      {p.capabilities?.copy && (
        <>
          <div className="row" style={{ gap: 10, alignItems: 'center', padding: '6px 0 2px' }}>
            <span style={{ fontSize: 13, flex: 1 }}>{t.pl_copySlaves}</span>
            <input type="number" value={p.capabilities?.copy_slaves ?? 2} onChange={(e) => setCap('copy_slaves', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'center', padding: '2px 0' }}>
            <span style={{ fontSize: 13, flex: 1 }}>{t.pl_copyMasters}</span>
            <input type="number" value={p.capabilities?.copy_masters ?? 1} onChange={(e) => setCap('copy_masters', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
          </div>
        </>
      )}

      <span style={flag}>{t.pl_stripe}</span>
      <input placeholder={t.pl_priceIdM} value={p.stripe_price_id || ''} onChange={(e) => set('stripe_price_id', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder={t.pl_priceIdY} value={p.stripe_price_id_year || ''} onChange={(e) => set('stripe_price_id_year', e.target.value)} style={{ margin: '8px 0 0' }} />

      <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}><input type="checkbox" checked={p.active} onChange={(e) => set('active', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {t.pl_activeChk}</label>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : (isNew ? t.pl_create : t.pl_save)}</button>
        {isNew ? <button className="btn btn-ghost" onClick={onCancel}>{t.pl_cancel}</button> : (p.id !== 'free' && <button className="btn btn-danger" onClick={del}>{t.pl_delete}</button>)}
        <ConfirmNote act={cf} onClose={() => setCf(null)} />
      </div>
    </div>
  );
}
