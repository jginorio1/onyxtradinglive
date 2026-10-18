'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import NotifPreview from './previews/NotifPreview';
import OnyxIcon from '@/app/components/OnyxIcon';

// Admin → Notificaciones. El dueño edite, por cada tipo de aviso: on/off, canales
// (campana / push / Telegram) y los textos ES/EN. Los "extra" nacen apagados.
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function NotifAdmin({ lang }: { lang: 'es' | 'en' }) {
  const es = lang === 'es';
  const [cat, setCat] = useState<any[]>([]);
  const [ov, setOv] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  // Composer de difusión: push escrita a mano para TODOS los usuarios.
  const [bc, setBc] = useState({ title: '', body: '', title_en: '', body_en: '', url: '' });
  const [bcBusy, setBcBusy] = useState(false);
  async function sendBroadcast() {
    if (!bc.title.trim() || !bc.body.trim()) { toast(es ? 'Escribe título y mensaje.' : 'Write a title and message.'); return; }
    if (!window.confirm(es ? '¿Enviar este push a TODOS los usuarios con la app instalada?' : 'Send this push to ALL users with the app installed?')) return;
    setBcBusy(true);
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ broadcast: { title_es: bc.title, body_es: bc.body, title_en: bc.title_en || undefined, body_en: bc.body_en || undefined, url: bc.url || undefined } }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast((es ? 'Enviado a ' : 'Sent to ') + (j.ok ?? 0) + (es ? ' usuarios.' : ' users.'), 'ok'); setBc({ title: '', body: '', title_en: '', body_en: '', url: '' }); }
      else toast(j.error || 'Error');
    } catch { toast('Error'); }
    setBcBusy(false);
  }

  // Push OBLIGATORIO para el equipo + cumplimiento (quién tiene push activo).
  const [staffReq, setStaffReq] = useState(true);
  const [comp, setComp] = useState<any>(null);
  const [compBusy, setCompBusy] = useState(false);
  async function loadComp() {
    setCompBusy(true);
    try { const r = await fetch('/api/admin/notifications?compliance=1'); const j = await r.json(); if (r.ok) { setComp(j); setStaffReq(j.required !== false); } } catch {}
    setCompBusy(false);
  }
  async function toggleStaffReq() {
    const next = !staffReq; setStaffReq(next);
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ staffPush: { required: next } }) });
      if (r.ok) toast(next ? (es ? 'Push obligatorio activado para el equipo' : 'Mandatory push enabled for the team') : (es ? 'Push obligatorio desactivado' : 'Mandatory push disabled'), 'ok');
      else { setStaffReq(!next); toast('Error'); }
    } catch { setStaffReq(!next); toast('Error'); }
  }

  // Diagnóstico de push de TU cuenta (por qué llega o no una automática).
  const [diag, setDiag] = useState<any>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  async function loadDiag() {
    setDiagBusy(true);
    try { const r = await fetch('/api/admin/notifications?diag=1'); const j = await r.json(); if (r.ok) setDiag(j); else toast(j.error || 'Error'); }
    catch { toast('Error'); }
    setDiagBusy(false);
  }

  async function load() {
    try {
      const r = await fetch('/api/admin/notifications'); const j = await r.json();
      setCat(j.catalog || []);
      // Semilla: parte de los valores por defecto del catálogo mezclados con overrides.
      const seed: Record<string, any> = {};
      for (const d of (j.catalog || [])) {
        const o = (j.overrides || {})[d.key] || {};
        seed[d.key] = {
          on: o.on ?? !d.extra,
          bell: o.bell ?? d.bell, push: o.push ?? d.push, telegram: o.telegram ?? d.telegram,
          urgent: o.urgent ?? d.urgent ?? false,
          title_es: o.title_es ?? d.es.title, title_en: o.title_en ?? d.en.title,
          body_es: o.body_es ?? d.es.body, body_en: o.body_en ?? d.en.body,
        };
      }
      setOv(seed);
    } catch {}
  }
  useEffect(() => { load(); loadDiag(); loadComp(); }, []);

  const set = (k: string, f: string, v: any) => setOv((p) => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const [aiKey, setAiKey] = useState('');       // qué tarjeta tiene abierta la IA
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState('');
  async function runAi(k: string) {
    setAiBusy(k);
    try {
      const r = await fetch('/api/admin/notifications/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: k, instruction: aiText[k] || '' }) });
      const j = await r.json();
      if (!r.ok) { toast(j.error || 'Error'); }
      else { setOv((p) => ({ ...p, [k]: { ...p[k], title_es: j.title_es, title_en: j.title_en, body_es: j.body_es, body_en: j.body_en } })); toast(es ? 'Redactado ✨' : 'Drafted ✨', 'ok'); }
    } catch { toast('Error'); }
    setAiBusy('');
  }
  // Prueba: dispara ESE aviso al propio admin (campana + push) para verlo llegar.
  const [testBusy, setTestBusy] = useState('');
  async function runTest(k: string) {
    setTestBusy(k);
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ test: k, lang }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast(es ? 'Enviado · revisa tu campana/móvil' : 'Sent · check your bell/phone', 'ok');
      else toast(j.error || 'Error');
    } catch { toast('Error'); }
    setTestBusy('');
  }
  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ overrides: ov }) });
      if (r.ok) toast(es ? 'Guardado' : 'Saved', 'ok'); else toast('Error');
    } catch { toast('Error'); }
    setBusy(false);
  }

  // Restablecer a valores de fábrica: borra la config guardada y recarga los defaults.
  async function resetDefaults() {
    if (!window.confirm(es
      ? '¿Restablecer todos los avisos a los valores de fábrica? Se perderán los cambios de canales/textos que hayas guardado (las preferencias de cada trader no se tocan).'
      : 'Reset all alerts to factory defaults? Your saved channel/text changes will be lost (each trader\'s preferences are untouched).')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reset: true }) });
      if (r.ok) { toast(es ? 'Restablecido a valores de fábrica' : 'Reset to factory defaults', 'ok'); await load(); }
      else toast('Error');
    } catch { toast('Error'); }
    setBusy(false);
  }

  const groups = Array.from(new Set(cat.map((d) => d.group)));
  const inp = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12.5, fontFamily: 'inherit', margin: 0 } as any;
  const chLabel = (c: string) => c === 'bell' ? (es ? 'Campana' : 'Bell') : c === 'push' ? 'Push' : 'Telegram';

  return (
    <div style={{ maxWidth: 'none' }}>
      <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}><OnyxIcon emoji="🔔" size={15} /> {es ? 'Notificaciones' : 'Notifications'}</h2>
          <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{es ? 'Prende/apaga cada aviso, elige sus canales y edita el texto. Usa {llaves} como variables.' : 'Turn each alert on/off, pick its channels and edit the text. Use {braces} as variables.'}</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={resetDefaults} disabled={busy} title={es ? 'Volver a la configuración recomendada de fábrica' : 'Return to recommended factory config'}>{es ? 'Valores de fábrica' : 'Factory defaults'}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : (es ? 'Guardar cambios' : 'Save changes')}</button>
        </div>
      </div>

      {/* Push OBLIGATORIO para el equipo: el empleado no puede apagar campana/push. */}
      <div className="card" style={{ padding: 14, marginBottom: 18, border: '1px solid color-mix(in srgb, var(--green) 40%, var(--line))' }}>
        <div className="row between" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}><OnyxIcon name="lock" size={13} glow={false} /> {es ? 'Notificaciones obligatorias del equipo' : 'Mandatory team notifications'}</div>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 0', maxWidth: 560 }}>{es ? 'Con esto activo, empleados y admins reciben SIEMPRE la campana y el push de los avisos que tengas encendidos: no pueden apagarlos desde su cuenta. Así nadie se pierde un ticket urgente ni un mensaje del equipo.' : 'When on, employees and admins ALWAYS receive bell and push for the alerts you have enabled: they cannot turn them off from their account. No one misses an urgent ticket or a team message.'}</p>
          </div>
          <Toggle on={staffReq} onClick={toggleStaffReq} />
        </div>

        {comp && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{es ? 'Estado del equipo' : 'Team status'} · <span style={{ color: comp.active === comp.total ? 'var(--green)' : 'var(--amber,#e0a33e)' }}>{comp.active}/{comp.total}</span> {es ? 'con push activo' : 'with push on'}</div>
              <button className="btn btn-ghost" style={{ fontSize: 11.5 }} onClick={loadComp} disabled={compBusy}>{compBusy ? '…' : (es ? 'Actualizar' : 'Refresh')}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {(comp.staff || []).map((s: any) => (
                <div key={s.id} className="row between" style={{ background: 'var(--bg2)', borderRadius: 8, padding: '6px 10px', gap: 8 }}>
                  <div style={{ minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}{s.owner && <span className="muted" style={{ fontSize: 10.5 }}> · {es ? 'dueño' : 'owner'}</span>}
                  </div>
                  <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: s.active ? 'var(--green)' : 'var(--amber,#e0a33e)' }}>
                    {s.active ? (es ? '✓ activo' : '✓ on') : (es ? '⚠ sin activar' : '⚠ not on')}
                    {s.active && <span className="muted" style={{ fontWeight: 500 }}> · {[s.native && (es ? 'app' : 'app'), s.web && 'web'].filter(Boolean).join(' + ')}</span>}
                  </span>
                </div>
              ))}
              {!(comp.staff || []).length && <div className="muted" style={{ fontSize: 12 }}>{es ? 'No hay miembros de equipo (perfiles con permiso de admin).' : 'No team members (profiles with admin permission).'}</div>}
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'El push obligatorio se fuerza en el envío. En web, el navegador aún pide permiso una vez; en la app (Android/iOS) se pide al abrir. Los que aparecen “sin activar” deben abrir la app o aceptar el permiso del navegador.' : 'Mandatory push is enforced on send. On web the browser still asks once; in the app (Android/iOS) it is requested on open. Those “not on” must open the app or accept the browser permission.'}</p>
          </div>
        )}
      </div>

      {/* Composer: push escrita a mano para TODOS los usuarios (ícono Onyx por defecto). */}
      <div className="card" style={{ padding: 14, marginBottom: 18, border: '1px solid var(--brand)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}><OnyxIcon emoji="📣" size={14} /> {es ? 'Enviar aviso a todos' : 'Send announcement to everyone'}</div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>{es ? 'Escribe un push y llega a todos los que tienen la app instalada. Lleva el ícono de Onyx por defecto.' : 'Write a push that reaches everyone with the app installed. It uses the Onyx icon by default.'}</p>
        <input value={bc.title} onChange={(e) => setBc({ ...bc, title: e.target.value })} placeholder={es ? 'Título' : 'Title'} maxLength={140} style={{ ...inp, marginBottom: 8, fontSize: 14 }} />
        <textarea value={bc.body} onChange={(e) => setBc({ ...bc, body: e.target.value })} placeholder={es ? 'Mensaje…' : 'Message…'} maxLength={300} rows={3} style={{ ...inp, marginBottom: 8, resize: 'vertical' }} />
        <details style={{ marginBottom: 8 }}>
          <summary className="muted" style={{ fontSize: 11.5, cursor: 'pointer' }}>{es ? 'Opcional: versión en inglés + enlace' : 'Optional: English version + link'}</summary>
          <input value={bc.title_en} onChange={(e) => setBc({ ...bc, title_en: e.target.value })} placeholder="Title (EN)" maxLength={140} style={{ ...inp, margin: '8px 0' }} />
          <textarea value={bc.body_en} onChange={(e) => setBc({ ...bc, body_en: e.target.value })} placeholder="Message (EN)" maxLength={300} rows={2} style={{ ...inp, marginBottom: 8, resize: 'vertical' }} />
          <input value={bc.url} onChange={(e) => setBc({ ...bc, url: e.target.value })} placeholder={es ? 'Enlace al tocar (ej. /dashboard)' : 'Link on tap (e.g. /dashboard)'} style={{ ...inp }} />
        </details>
        <button className="btn btn-primary" onClick={sendBroadcast} disabled={bcBusy}>{bcBusy ? '…' : (es ? 'Enviar a todos' : 'Send to everyone')}</button>
      </div>

      {/* Diagnóstico de push de TU cuenta: explica por qué llega o no una automática. */}
      <div className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="row between" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: diag ? 10 : 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}><OnyxIcon emoji="🩺" size={14} /> {es ? 'Diagnóstico de push (tu cuenta)' : 'Push diagnostics (your account)'}</div>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>{es ? 'El botón “Probar” salta los filtros; esto muestra si una automática te llegaría de verdad.' : 'The “Test” button skips the filters; this shows whether an automatic one would actually reach you.'}</p>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={loadDiag} disabled={diagBusy}>{diagBusy ? '…' : (es ? 'Actualizar' : 'Refresh')}</button>
        </div>
        {diag && (() => {
          const ok = (b: boolean) => b ? { t: es ? 'Sí' : 'Yes', c: 'var(--green)' } : { t: 'No', c: 'var(--red, #e5484d)' };
          const Row = ({ label, state, hint }: { label: string; state: { t: string; c: string }; hint?: string }) => (
            <div className="row between" style={{ alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>{hint && <div className="muted" style={{ fontSize: 11 }}>{hint}</div>}</div>
              <span className="pill" style={{ fontSize: 11, fontWeight: 700, color: state.c, border: `1px solid ${state.c}`, whiteSpace: 'nowrap' }}>{state.t}</span>
            </div>
          );
          const verdict = !!diag.willReceiveAuto && diag.nativeTokens + diag.webSubs > 0;
          return (
            <div>
              <div style={{ background: verdict ? 'rgba(48,164,108,.12)' : 'rgba(229,72,77,.1)', border: `1px solid ${verdict ? 'var(--green)' : 'var(--red, #e5484d)'}`, borderRadius: 10, padding: '9px 11px', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                {verdict
                  ? (es ? '✅ Tu cuenta recibirá las push automáticas (de los tipos con push encendido).' : '✅ Your account will receive automatic push (for types with push enabled).')
                  : (es ? '⚠️ Una automática NO te llegaría todavía. Revisa los puntos en rojo abajo.' : '⚠️ An automatic one would NOT reach you yet. Check the red items below.')}
              </div>
              <Row label={es ? 'Eres staff (dueño/admin)' : 'You are staff (owner/admin)'} state={ok(diag.isStaff)} hint={es ? 'El staff recibe push aunque su plan sea Free.' : 'Staff receive push even on a Free plan.'} />
              <Row label={es ? `Tu plan permite push (plan: ${diag.planId})` : `Your plan allows push (plan: ${diag.planId})`} state={ok(diag.planAllowsPush)} hint={es ? 'Capacidad push del plan. Free no la tiene por defecto.' : 'Plan push capability. Free lacks it by default.'} />
              <Row label={es ? 'Veredicto del candado (staff o plan)' : 'Gate verdict (staff or plan)'} state={ok(diag.willReceiveAuto)} />
              <Row label={es ? 'Dispositivos de la app (iOS/Android)' : 'App devices (iOS/Android)'} state={diag.nativeTokens > 0 ? { t: String(diag.nativeTokens), c: 'var(--green)' } : { t: '0', c: 'var(--red, #e5484d)' }} hint={es ? 'Tokens FCM registrados por la app.' : 'FCM tokens registered by the app.'} />
              <Row label={es ? 'Navegadores/PWA suscritos' : 'Browsers/PWA subscribed'} state={{ t: String(diag.webSubs), c: diag.webSubs > 0 ? 'var(--green)' : 'var(--mut)' }} />
              <Row label={es ? 'Servidor: push nativa activa (FCM)' : 'Server: native push on (FCM)'} state={ok(diag.fcmEnabled)} hint={es ? 'Variables FCM_* en el servidor.' : 'FCM_* vars on the server.'} />
              <div className="row between" style={{ alignItems: 'center', gap: 10, padding: '7px 0' }}>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{es ? 'Servidor: push web activa (VAPID)' : 'Server: web push on (VAPID)'}</div></div>
                <span className="pill" style={{ fontSize: 11, fontWeight: 700, color: ok(diag.webPushEnabled).c, border: `1px solid ${ok(diag.webPushEnabled).c}`, whiteSpace: 'nowrap' }}>{ok(diag.webPushEnabled).t}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{g}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(480px,1fr))', gap: 10, alignItems: 'start' }}>
            {cat.filter((d) => d.group === g).map((d) => {
              const o = ov[d.key] || {};
              const chans: string[] = d.editableChannels || ['bell', 'push', 'telegram'];
              return (
                <div key={d.key} className="card" style={{ padding: 12, opacity: o.on ? 1 : 0.6 }}>
                  <div className="row between" style={{ alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{es ? o.title_es : o.title_en} {d.extra && <span className="pill" style={{ fontSize: 10, background: 'rgba(124,140,255,.15)', color: 'var(--soft-brand)' }}>{es ? 'extra' : 'extra'}</span>}</b>
                    <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}><Toggle on={!!o.on} onClick={() => set(d.key, 'on', !o.on)} /> {o.on ? (es ? 'Activo' : 'On') : (es ? 'Apagado' : 'Off')}</label>
                  </div>
                  <div className="row" style={{ gap: 14, margin: '8px 0 2px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {chans.map((c) => (
                      <label key={c} className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}><Toggle on={!!o[c]} onClick={() => set(d.key, c, !o[c])} /> {chLabel(c)}</label>
                    ))}
                    <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
                    {/* Urgente: lo marcas aquí. En la campanita el aviso se resalta en rojo. */}
                    <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }} title={es ? 'Lo resalta en rojo en la campanita del trader.' : 'Highlights it in red in the trader’s bell.'}><Toggle on={!!o.urgent} onClick={() => set(d.key, 'urgent', !o.urgent)} /> <span style={{ color: o.urgent ? 'var(--red)' : 'inherit', fontWeight: o.urgent ? 700 : 400 }}>{es ? 'Urgente' : 'Urgent'}</span></label>
                  </div>
                  <div style={{ marginTop: 8, background: 'rgba(124,140,255,.08)', border: '1px solid rgba(124,140,255,.25)', borderRadius: 8, padding: 8 }}>
                    {aiKey === d.key ? (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <input placeholder={es ? 'Instrucción (ej: más motivador y corto)' : 'Instruction (e.g. more motivating and short)'} value={aiText[d.key] || ''} onChange={(e) => setAiText((p) => ({ ...p, [d.key]: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 160 }} />
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => runAi(d.key)} disabled={aiBusy === d.key}>{aiBusy === d.key ? '…' : (es ? 'Redactar' : 'Draft')}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAiKey('')}>✕</button>
                      </div>
                    ) : (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAiKey(d.key)}><OnyxIcon emoji="✨" size={15} /> {es ? 'Redactar con IA' : 'Write with AI'}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => runTest(d.key)} disabled={testBusy === d.key} title={es ? 'Te lo envía a ti para verlo' : 'Sends it to you to preview'}>{testBusy === d.key ? '…' : <><OnyxIcon emoji="🔔" size={15} /> {es ? 'Probar' : 'Test'}</>}</button>
                      </div>
                    )}
                  </div>
                  <div className="grid g2" style={{ gap: 8, marginTop: 8 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Título (ES)</div>
                      <input style={inp} value={o.title_es || ''} onChange={(e) => set(d.key, 'title_es', e.target.value)} />
                      <textarea style={{ ...inp, marginTop: 6, minHeight: 42, resize: 'vertical' }} value={o.body_es || ''} onChange={(e) => set(d.key, 'body_es', e.target.value)} />
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Title (EN)</div>
                      <input style={inp} value={o.title_en || ''} onChange={(e) => set(d.key, 'title_en', e.target.value)} />
                      <textarea style={{ ...inp, marginTop: 6, minHeight: 42, resize: 'vertical' }} value={o.body_en || ''} onChange={(e) => set(d.key, 'body_en', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 5 }}>{es ? 'Vista previa (como le llega al trader)' : 'Preview (as the trader receives it)'}</div>
                    <NotifPreview
                      title={es ? o.title_es : o.title_en}
                      body={es ? o.body_es : o.body_en}
                      bell={chans.includes('bell') ? !!o.bell : false}
                      push={chans.includes('push') ? !!o.push : false}
                      telegram={chans.includes('telegram') ? !!o.telegram : false}
                      es={es}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
