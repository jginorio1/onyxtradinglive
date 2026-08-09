'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// Copy del mentor · panel dentro de la academia (comunidad).
//  · Mentor: "Ofrecer mi copy" + "Mis copiadores" (con popup de responsabilidades).
//  · Alumno: "Copiar al mentor" → popup de riesgos → pagar → conectar cuenta.
// Advertencias claras y consentimiento obligatorio para ambos. Reversible.
// ============================================================
const money = (c: number) => '$' + Math.round((c || 0) / 100).toLocaleString('en-US');

function Modal({ title, children, onClose, glow }: { title: string; children: any; onClose: () => void; glow?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }} onClick={onClose}>
      <div className="sk-card" style={{ maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        border: glow ? '2px solid var(--amber)' : undefined,
        boxShadow: glow ? '0 0 0 1px color-mix(in srgb,var(--amber) 60%,transparent), 0 0 40px color-mix(in srgb,var(--amber) 40%,transparent)' : undefined }} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <b style={{ fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--amber)' }}><OnyxIcon name="bell" size={18} /></span>{title}</b>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CopyPanel({ mentorId, isMentor, L }: { mentorId: string; isMentor: boolean; L: (es: string, en: string) => string }) {
  return isMentor ? <MentorCopy mentorId={mentorId} L={L} /> : <StudentCopy mentorId={mentorId} L={L} />;
}

// ---------- MENTOR ----------
function MentorCopy({ L }: { mentorId: string; L: (es: string, en: string) => string }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [warn, setWarn] = useState(false);
  const [typed, setTyped] = useState('');   // el mentor escribe ACEPTO / I ACCEPT
  const [f, setF] = useState<any>({ enabled: false, master_account_id: '', price: '', min_capital: '', allow_funded: true });
  const ACCEPT_WORD = L('ACEPTO', 'I ACCEPT');

  async function load() {
    const r = await fetch('/api/academy/copy/mentor'); const j = await r.json();
    if (!j.error) {
      setD(j);
      const o = j.offer || {};
      setF({
        enabled: !!o.enabled, master_account_id: o.master_account_id || '',
        price: o.price_cents ? String(o.price_cents / 100) : '',
        min_capital: o.min_capital_cents ? String(o.min_capital_cents / 100) : '',
        allow_funded: o.allow_funded !== false,
      });
    }
  }
  useEffect(() => { load(); }, []);
  if (!d || !d.enabled) return null;

  async function doSave(accepted: boolean) {
    setBusy('save'); setWarn(false);
    await fetch('/api/academy/copy/mentor', { method: 'POST', body: JSON.stringify({
      action: 'save', enabled: f.enabled, accepted, master_account_id: f.master_account_id,
      price_cents: Math.round((Number(f.price) || 0) * 100),
      min_capital_cents: Math.round((Number(f.min_capital) || 0) * 100),
      allow_funded: f.allow_funded,
    }) });
    setBusy(''); load();
  }
  function onSave() {
    // Al activar por primera vez, exige aceptar responsabilidades.
    if (f.enabled && !d.offer?.terms_accepted_at) { setWarn(true); return; }
    doSave(true);
  }
  async function toggleCopier(studentId: string, active: boolean) {
    await fetch('/api/academy/copy/mentor', { method: 'POST', body: JSON.stringify({ action: 'copier', student_id: studentId, status: active ? 'active' : 'paused' }) });
    load();
  }

  const c = d.copiers || { copiers: [], count: 0, activeCount: 0, capital: 0 };
  return (
    <div className="sk-card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="sessions" size={18} /></span>
        <b>{L('Copy del mentor', 'Mentor copy')}</b>
        <span className="muted" style={{ fontSize: 12 }}>· Onyx {d.onyxFeePct}%</span>
        <button className="btn btn-ghost" style={{ fontSize: 11.5, marginLeft: 'auto' }} onClick={() => { setTyped(''); setWarn(true); }}>{L('Responsabilidades', 'Responsibilities')}</button>
      </div>

      <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 13.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.enabled} onChange={(e) => {
          const on = e.target.checked;
          setF({ ...f, enabled: on });
          // Al ACTIVAR por primera vez, el aviso de responsabilidades sale solo.
          if (on && !d.offer?.terms_accepted_at) { setTyped(''); setWarn(true); }
        }} style={{ width: 'auto', margin: 0 }} />
        {L('Ofrecer mi copy a mis alumnos', 'Offer my copy to my students')}
      </label>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12.5 }}>{L('Cuenta maestra', 'Master account')}
          <select value={f.master_account_id} onChange={(e) => setF({ ...f, master_account_id: e.target.value })} style={{ display: 'block', marginTop: 4, minWidth: 170 }}>
            <option value="">{L('Elige una cuenta…', 'Pick an account…')}</option>
            {(d.accounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.nickname || a.login} · {a.login}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12.5 }}>{L('Precio / mes', 'Price / mo')}
          <input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="49" style={{ display: 'block', width: 110, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12.5 }}>{L('Capital mínimo', 'Min capital')}
          <input type="number" min={0} value={f.min_capital} onChange={(e) => setF({ ...f, min_capital: e.target.value })} placeholder="500" style={{ display: 'block', width: 110, marginTop: 4 }} />
        </label>
      </div>
      <label className="row" style={{ gap: 8, alignItems: 'center', margin: '10px 0', fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.allow_funded} onChange={(e) => setF({ ...f, allow_funded: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
        {L('Permitir cuentas de fondeo (con Mi reto obligatorio)', 'Allow funded accounts (My challenge required)')}
      </label>
      <button className="btn btn-primary" disabled={busy === 'save'} onClick={onSave}>{busy === 'save' ? '…' : L('Guardar', 'Save')}</button>

      <div style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>{L('Mis copiadores', 'My copiers')}</b>
          <span className="muted" style={{ fontSize: 12 }}>{c.activeCount}/{c.count} · {money((c.capital || 0) * 100)} {L('copiando', 'copying')}</span>
        </div>
        {(c.copiers || []).length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{L('Aún no tienes copiadores.', 'No copiers yet.')}</p>}
        {(c.copiers || []).map((k: any) => (
          <div key={k.studentId} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13, gap: 8, flexWrap: 'wrap' }}>
            <span style={{ minWidth: 140 }}>{k.name}</span>
            <span className="muted" style={{ fontSize: 12 }}>{k.accountType === 'funded' ? L('Fondeo', 'Funded') : L('Propia', 'Own')}{k.balance != null ? ' · $' + Math.round(k.balance).toLocaleString('en-US') : ''} · {k.riskMultiplier}×</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: k.status === 'active' ? 'var(--green)' : 'var(--mut)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.status === 'active' ? 'var(--green)' : 'var(--mut)' }} />
              {k.status === 'active' ? L('Copiando', 'Copying') : L('Pausado', 'Paused')}
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleCopier(k.studentId, k.status !== 'active')}>{k.status === 'active' ? L('Pausar', 'Pause') : L('Reanudar', 'Resume')}</button>
          </div>
        ))}
      </div>

      {warn && (
        <Modal glow title={L('Tus responsabilidades como mentor', 'Your responsibilities as a mentor')} onClose={() => { setWarn(false); if (!d.offer?.terms_accepted_at) setF({ ...f, enabled: false }); }}>
          <ul style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--tx)', paddingLeft: 18, margin: '4px 0 12px' }}>
            <li>{L('Tus operaciones se replican con DINERO REAL en las cuentas de tus alumnos.', "Your trades replicate with REAL MONEY on your students' accounts.")}</li>
            <li>{L('Opera siempre con stop loss y riesgo sano; una mala racha afecta a todos.', 'Always trade with stop loss and sound risk; a bad streak affects everyone.')}</li>
            <li>{L('No uses martingala, grid agresivo ni operar en noticias: puede reventar cuentas de fondeo.', 'No martingale, aggressive grid or news trading: it can blow funded accounts.')}</li>
            <li>{L('Esto no es asesoría financiera. Cada alumno acepta el riesgo por su cuenta.', 'This is not financial advice. Each student accepts the risk on their own.')}</li>
          </ul>
          <div style={{ background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 40%,transparent)', borderRadius: 10, padding: '11px 13px', marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: 'var(--tx)', marginBottom: 8 }}>{L('Para confirmar, escribe ', 'To confirm, type ')}<b style={{ letterSpacing: '.5px' }}>{ACCEPT_WORD}</b>{L(' en mayúsculas:', ' in uppercase:')}</div>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={ACCEPT_WORD} autoFocus
              style={{ width: '100%', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontWeight: 700 }} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', opacity: typed.trim() === ACCEPT_WORD ? 1 : .5 }}
            disabled={typed.trim() !== ACCEPT_WORD || busy === 'save'}
            onClick={() => { setF({ ...f, enabled: true }); doSave(true); }}>
            {busy === 'save' ? '…' : L('Acepto y activo el copy', 'I accept and enable copy')}
          </button>
        </Modal>
      )}
    </div>
  );
}

// ---------- ALUMNO ----------
function StudentCopy({ mentorId, L }: { mentorId: string; L: (es: string, en: string) => string }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [riskOpen, setRiskOpen] = useState(false);
  const [sTyped, setSTyped] = useState('');   // escribe ACEPTO / I ACCEPT antes del pago
  const [cTyped, setCTyped] = useState('');   // escribe ACEPTO / I ACCEPT al conectar (ir en vivo)
  const [w, setW] = useState<any>({ slave: '', type: 'own', mult: '1', daily: '', maxdd: '' });
  const ACCEPT_WORD = L('ACEPTO', 'I ACCEPT');

  async function load() {
    const r = await fetch('/api/academy/copy/student?mentor_id=' + mentorId); const j = await r.json();
    if (!j.error) setD(j);
  }
  useEffect(() => { load(); }, [mentorId]);
  if (!d || !d.info?.available) return null;

  const info = d.info; const sub = d.sub;

  async function subscribe() {
    setBusy('sub'); setRiskOpen(false);
    const r = await fetch('/api/academy/copy/checkout', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId }) });
    const j = await r.json(); setBusy('');
    if (j.url) window.location.href = j.url;
  }
  async function connect() {
    if (!w.slave || cTyped.trim() !== ACCEPT_WORD) return;
    setBusy('connect');
    await fetch('/api/academy/copy/student', { method: 'POST', body: JSON.stringify({
      action: 'connect', mentor_id: mentorId, slave_account_id: w.slave, account_type: w.type,
      risk_multiplier: Number(w.mult) || 1, consent: true,
      funded_daily: w.type === 'funded' ? Number(w.daily) || null : null,
      funded_max_dd: w.type === 'funded' ? Number(w.maxdd) || null : null,
    }) });
    setBusy(''); load();
  }


  // Estado 1: no suscrito → tarjeta de venta.
  if (!sub || sub.status === 'canceled') {
    return (
      <div className="sk-card" style={{ marginBottom: 12, border: '1px solid color-mix(in srgb,var(--brand) 35%,transparent)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="sessions" size={18} /></span>
          <b>{L('Copia las operaciones del mentor', "Copy the mentor's trades")}</b>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 10px', lineHeight: 1.5 }}>
          {L('Sus operaciones se replican solas en tu cuenta, escaladas a tu capital y con Guardian de red de seguridad.', 'Their trades auto-replicate on your account, scaled to your capital and with Guardian as a safety net.')}
        </p>
        <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(info.priceCents)}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>/{L('mes', 'mo')}</span></div>
          <button className="btn btn-primary" disabled={busy === 'sub'} onClick={() => { setSTyped(''); setRiskOpen(true); }}>{L('Copiar al mentor', 'Copy the mentor')}</button>
        </div>
        {info.minCapitalCents > 0 && <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{L('Capital mínimo: ', 'Min capital: ')}{money(info.minCapitalCents)}</p>}
        {riskOpen && (
          <Modal glow title={L('Antes de copiar: riesgos', 'Before copying: risks')} onClose={() => setRiskOpen(false)}>
            <ul style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--tx)', paddingLeft: 18, margin: '4px 0 12px' }}>
              <li>{L('Copiarás operaciones con DINERO REAL. El trading conlleva riesgo de pérdida, incluso total.', 'You will copy trades with REAL MONEY. Trading carries risk of loss, even total.')}</li>
              <li>{L('Los resultados del mentor NO garantizan resultados futuros.', "The mentor's results do NOT guarantee future results.")}</li>
              <li>{L('Guardian se activa con límites de seguridad; en fondeo respeta las reglas de tu firma, pero nada elimina el riesgo.', 'Guardian applies safety limits; on funded accounts it respects your firm rules, but nothing removes the risk.')}</li>
              <li>{L('Esto no es asesoría financiera. Decides tú, bajo tu responsabilidad.', 'This is not financial advice. You decide, at your own responsibility.')}</li>
            </ul>
            <div style={{ background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--amber) 40%,transparent)', borderRadius: 10, padding: '11px 13px', marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--tx)', marginBottom: 8 }}>{L('Para confirmar, escribe ', 'To confirm, type ')}<b style={{ letterSpacing: '.5px' }}>{ACCEPT_WORD}</b>{L(' en mayúsculas:', ' in uppercase:')}</div>
              <input value={sTyped} onChange={(e) => setSTyped(e.target.value)} placeholder={ACCEPT_WORD} autoFocus
                style={{ width: '100%', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontWeight: 700 }} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', opacity: sTyped.trim() === ACCEPT_WORD ? 1 : .5 }} disabled={sTyped.trim() !== ACCEPT_WORD || busy === 'sub'} onClick={subscribe}>
              {busy === 'sub' ? '…' : L('Acepto los riesgos · continuar al pago', 'I accept the risks · continue to payment')}
            </button>
          </Modal>
        )}
      </div>
    );
  }

  // Estado 2: pagó pero falta conectar cuenta → asistente con consentimiento.
  if (sub.status === 'pending_connect') {
    return (
      <div className="sk-card" style={{ marginBottom: 12, border: '1px solid var(--brand)' }}>
        <b>{L('Conecta tu cuenta para empezar a copiar', 'Connect your account to start copying')}</b>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
          <label style={{ fontSize: 12.5 }}>{L('Tu cuenta', 'Your account')}
            <select value={w.slave} onChange={(e) => setW({ ...w, slave: e.target.value })} style={{ display: 'block', marginTop: 4, minWidth: 160 }}>
              <option value="">{L('Elige…', 'Pick…')}</option>
              {(d.accounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.nickname || a.login} · {a.login}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12.5 }}>{L('Tipo', 'Type')}
            <select value={w.type} onChange={(e) => setW({ ...w, type: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
              <option value="own">{L('Capital propio', 'Own capital')}</option>
              {info.allowFunded && <option value="funded">{L('Cuenta de fondeo', 'Funded account')}</option>}
            </select>
          </label>
          <label style={{ fontSize: 12.5 }}>{L('Riesgo', 'Risk')}
            <select value={w.mult} onChange={(e) => setW({ ...w, mult: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
              <option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
            </select>
          </label>
        </div>
        {w.type === 'funded' && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
            <label style={{ fontSize: 12.5 }}>{L('Pérdida diaria de la firma %', 'Firm daily loss %')}
              <input type="number" value={w.daily} onChange={(e) => setW({ ...w, daily: e.target.value })} placeholder="5" style={{ display: 'block', width: 100, marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12.5 }}>{L('Drawdown máx. %', 'Max drawdown %')}
              <input type="number" value={w.maxdd} onChange={(e) => setW({ ...w, maxdd: e.target.value })} placeholder="10" style={{ display: 'block', width: 100, marginTop: 4 }} />
            </label>
          </div>
        )}
        <div style={{ background: 'color-mix(in srgb,var(--amber) 12%,transparent)', border: '2px solid color-mix(in srgb,var(--amber) 45%,transparent)', borderRadius: 10, padding: '11px 13px', margin: '10px 0', boxShadow: '0 0 22px color-mix(in srgb,var(--amber) 22%,transparent)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--tx)', lineHeight: 1.5, marginBottom: 8 }}>
            {L('Copiarás con DINERO REAL y puedes perder. No es asesoría financiera. Para autorizar, escribe ', 'You will copy with REAL MONEY and you can lose. This is not financial advice. To authorize, type ')}<b style={{ letterSpacing: '.5px' }}>{ACCEPT_WORD}</b>{L(' en mayúsculas:', ' in uppercase:')}
          </div>
          <input value={cTyped} onChange={(e) => setCTyped(e.target.value)} placeholder={ACCEPT_WORD} style={{ width: '100%', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontWeight: 700 }} />
        </div>
        <button className="btn btn-primary" style={{ opacity: (w.slave && cTyped.trim() === ACCEPT_WORD) ? 1 : .5 }} disabled={!w.slave || cTyped.trim() !== ACCEPT_WORD || busy === 'connect'} onClick={connect}>{busy === 'connect' ? '…' : L('Empezar a copiar', 'Start copying')}</button>
      </div>
    );
  }

  // Estado 3: copiando + guía de conexión del EA.
  return (
    <div className="sk-card" style={{ marginBottom: 12 }}>
      <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sub.status === 'active' ? 'var(--green)' : 'var(--mut)' }} />
          {sub.status === 'active' ? L('Copiando al mentor', 'Copying the mentor') : L('Copy pausado', 'Copy paused')}
        </span>
        <label style={{ fontSize: 12.5 }}>{L('Riesgo', 'Risk')}
          <select value={String(sub.risk_multiplier || 1)} onChange={async (e) => { await fetch('/api/academy/copy/student', { method: 'POST', body: JSON.stringify({ action: 'multiplier', mentor_id: mentorId, risk_multiplier: Number(e.target.value) }) }); load(); }} style={{ marginLeft: 6 }}>
            <option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
          </select>
        </label>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: '10px 0 0' }}>
        {L('¿Aún no ves operaciones? Instala Onyx Connect como esclava en tu cuenta desde ', 'Not seeing trades yet? Install Onyx Connect as a slave on your account from ')}
        <a href="/dashboard/copy" style={{ color: 'var(--brand)' }}>{L('Copy trading', 'Copy trading')}</a>.
      </p>
    </div>
  );
}
