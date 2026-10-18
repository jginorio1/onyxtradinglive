'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Panel del trader: qué avisos quiere en la campana (dentro de la app) y en el
// push del móvil. Telegram se controla aparte en la tarjeta de Telegram.
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function NotifPrefs({ lang }: { lang: 'es' | 'en' }) {
  const es = lang === 'es';
  const [items, setItems] = useState<any[] | null>(null);
  const [planHasPush, setPlanHasPush] = useState(true);
  const [staffLock, setStaffLock] = useState(false);
  const [saved, setSaved] = useState(false);
  // Rutina: horas de Check-in (mañana) y Check-out (noche), en la zona del trader.
  const [inAt, setInAt] = useState('08:00');
  const [outAt, setOutAt] = useState('21:00');
  const [routSaved, setRoutSaved] = useState(false);

  async function load() {
    try { const r = await fetch('/api/account/notif-prefs'); const j = await r.json(); setItems(j.items || []); setPlanHasPush(j.planHasPush !== false); setStaffLock(!!j.staffLock); } catch { setItems([]); }
    try { const r = await fetch('/api/account/routine'); const j = await r.json(); if (j.checkin_at) setInAt(j.checkin_at); if (j.checkout_at) setOutAt(j.checkout_at); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function saveRoutine(ci: string, co: string) {
    try { await fetch('/api/account/routine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ checkin_at: ci, checkout_at: co }) }); setRoutSaved(true); setTimeout(() => setRoutSaved(false), 1400); } catch {}
  }

  async function save(next: any[]) {
    const prefs: any = {};
    next.forEach((it) => { prefs[it.key] = { bell: !!it.bell, push: !!it.push }; });
    try { await fetch('/api/account/notif-prefs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefs }) }); setSaved(true); setTimeout(() => setSaved(false), 1400); } catch {}
  }
  function toggle(key: string, ch: 'bell' | 'push') {
    if (!items || staffLock) return;   // equipo: no puede apagar (lo exige el dueño)
    const next = items.map((it) => it.key === key ? { ...it, [ch]: !it[ch] } : it);
    setItems(next); save(next);
  }
  // Interruptor bloqueado (siempre on, no editable) para el equipo.
  const LockedOn = () => (
    <span title={es ? 'Lo exige tu empresa' : 'Required by your company'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 20, borderRadius: 999, background: 'var(--green)', opacity: .85 }}>
      <OnyxIcon name="lock" size={11} glow={false} />
    </span>
  );

  if (!items) return <div className="muted" style={{ fontSize: 13 }}>…</div>;
  if (!items.length) return null;

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
        <h3 style={{ fontSize: 16 }}><OnyxIcon emoji="🔔" size={15} /> {es ? 'Avisos en la app y el móvil' : 'App and mobile alerts'}</h3>
        {saved && <span style={{ color: 'var(--green)', fontSize: 12 }}>{es ? 'Guardado' : 'Saved'}</span>}
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{es ? 'Elige qué recibir en la campana (dentro de la app) y en el push del móvil.' : 'Choose what to get in the bell (in-app) and mobile push.'}</p>

      {staffLock && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'color-mix(in srgb, var(--green) 12%, var(--bg2))', border: '1px solid color-mix(in srgb, var(--green) 35%, var(--line))', borderRadius: 12, padding: '11px 13px', marginBottom: 14 }}>
          <span style={{ flex: 'none', marginTop: 1 }}><OnyxIcon name="lock" size={16} glow={false} /></span>
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <b>{es ? 'Notificaciones del equipo obligatorias.' : 'Team notifications are required.'}</b>{' '}
            {es ? 'Como eres parte del equipo, los avisos de la campana y el push se mantienen activos y no se pueden apagar. Lo gestiona la dirección para que nadie se pierda un ticket urgente o un mensaje del equipo.' : 'As a team member, bell and push alerts stay on and cannot be turned off. Management controls this so no one misses an urgent ticket or a team message.'}
          </div>
        </div>
      )}

      {/* Mi rutina diaria: horas de Check-in y Check-out, en la zona horaria del trader. */}
      <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, border: '1px solid var(--line)' }}>
        <div className="row between" style={{ marginBottom: 2 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{es ? 'Mi rutina diaria' : 'My daily routine'}</div>
          {routSaved && <span style={{ color: 'var(--green)', fontSize: 12 }}>{es ? 'Guardado' : 'Saved'}</span>}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>{es ? 'Te recordamos revisar tu plan en la mañana y cerrar tu día en la noche, a tu hora local.' : 'We remind you to review your plan in the morning and close your day at night, in your local time.'}</p>
        <div className="grid g2" style={{ gap: 10 }}>
          <label style={{ fontSize: 12.5 }}><span className="row" style={{ gap: 6, marginBottom: 4 }}><OnyxIcon emoji="🌅" size={14} /> {es ? 'Check-in (mañana)' : 'Check-in (morning)'}</span>
            <input type="time" value={inAt} onChange={(e) => { setInAt(e.target.value); saveRoutine(e.target.value, outAt); }} style={{ width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
          </label>
          <label style={{ fontSize: 12.5 }}><span className="row" style={{ gap: 6, marginBottom: 4 }}><OnyxIcon emoji="🌙" size={14} /> {es ? 'Check-out (noche)' : 'Check-out (night)'}</span>
            <input type="time" value={outAt} onChange={(e) => { setOutAt(e.target.value); saveRoutine(inAt, e.target.value); }} style={{ width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
          </label>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{es ? 'Para apagarlos, desactiva “Tu check-in de hoy” y “Cierra tu check-in” abajo.' : 'To turn them off, disable “Your daily check-in” and “Close your check-in” below.'}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row between" style={{ fontSize: 11, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em', padding: '0 2px' }}>
          <span>{es ? 'Aviso' : 'Alert'}</span>
          <span className="row" style={{ gap: 22 }}><span style={{ width: 46, textAlign: 'center' }}>{es ? 'Campana' : 'Bell'}</span><span style={{ width: 46, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>Push{!planHasPush && <OnyxIcon name="lock" size={11} glow={false} />}</span></span>
        </div>
        {items.map((it) => (
          <div key={it.key} className="row between" style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 12px', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.title}</div>
              <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.body}</div>
            </div>
            <span className="row" style={{ gap: 22, flex: 'none' }}>
              <span style={{ width: 46, display: 'flex', justifyContent: 'center' }}>{it.bellAvail ? (it.locked ? <LockedOn /> : <Toggle on={!!it.bell} onClick={() => toggle(it.key, 'bell')} />) : <span className="muted" style={{ fontSize: 11 }}>—</span>}</span>
              <span style={{ width: 46, display: 'flex', justifyContent: 'center' }}>{
                it.locked && it.pushAvail
                  ? <LockedOn />
                  : it.pushAvail
                  ? <Toggle on={!!it.push} onClick={() => toggle(it.key, 'push')} />
                  : it.pushType
                    // El tipo admite push pero el PLAN no lo incluye → candado gris (no un interruptor falso).
                    ? <span title={es ? 'Disponible en un plan con push' : 'Available on a plan with push'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'var(--card2)', color: 'var(--mut)' }}><OnyxIcon name="lock" size={12} glow={false} /></span>
                    // El tipo de aviso no tiene push → simplemente no aplica.
                    : <span className="muted" style={{ fontSize: 11 }}>—</span>
              }</span>
            </span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{es ? 'El push necesita que actives las notificaciones del móvil. Los avisos de Telegram se ajustan en la tarjeta de arriba.' : 'Push needs mobile notifications enabled. Telegram alerts are set in the card above.'}</p>
    </>
  );
}
