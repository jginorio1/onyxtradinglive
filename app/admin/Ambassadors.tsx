'use client';
import { mkL } from '@/lib/i18n';
import { toast, toastErr, confirmDialog } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/adminText';
import { useLang } from '@/lib/lang';
import RangeBar, { type Range, defaultRange } from './RangeBar';
import MemberReferralSettings from './MemberReferralSettings';
import QrPop from '@/app/components/QrPop';

const METHOD: any = { stripe: 'Stripe', paypal: 'PayPal', usdt: 'USDT', credit: 'Credit' };

// ---- Reclutar: mini-CRM de prospectos + invitación con AI ----
const PLATFORMS = ['youtube', 'instagram', 'tiktok', 'telegram', 'x', 'other'];
function Recruit({ lang }: { lang: 'es' | 'en' }) {
  const L = mkL(lang);
  const NICHES: [string, string][] = [['prop', L('Prop firms', 'Prop firms')], ['beginners', L('Principiantes', 'Beginners')], ['signals', L('Señales', 'Signals')], ['forex', 'Forex'], ['crypto', L('Cripto', 'Crypto')], ['other', L('Otro', 'Other')]];
  const STAT: Record<string, [string, string]> = {
    new: [L('Nuevo', 'New'), 'var(--mut)'], contacted: [L('Contactado', 'Contacted'), 'var(--amber)'],
    replied: [L('Respondió', 'Replied'), 'var(--soft-brand)'], joined: [L('Se unió', 'Joined'), 'var(--green)'], passed: [L('Descartado', 'Passed'), 'var(--red)'],
  };
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', platform: 'youtube', niche: 'prop', email: '' });
  const [sel, setSel] = useState<any>(null);
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [busy, setBusy] = useState('');

  async function load() { const r = await fetch('/api/admin/ambassadors/prospects'); const j = await r.json(); setList(j.prospects || []); }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim()) { toast(L('Falta el nombre.', 'Name is required.')); return; }
    setBusy('add');
    try { const r = await fetch('/api/admin/ambassadors/prospects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }); if (!r.ok) { toastErr(await r.json()); return; } setForm({ name: '', platform: 'youtube', niche: 'prop', email: '' }); load(); } finally { setBusy(''); }
  }
  async function setStatus(id: string, status: string) { await fetch('/api/admin/ambassadors/prospects', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) }); load(); }
  async function del(id: string) { if (!(await confirmDialog(L('¿Quitar prospecto?', 'Remove prospect?')))) return; await fetch('/api/admin/ambassadors/prospects', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); load(); if (sel?.id === id) { setSel(null); setDraft({ subject: '', body: '' }); } }

  function pick(p: any) { setSel(p); setDraft({ subject: '', body: '' }); }
  async function generate() {
    const p = sel || form;
    if (!p.name) { toast(L('Elige o escribe un creador.', 'Pick or type a creator.')); return; }
    setBusy('gen');
    try {
      const r = await fetch('/api/admin/ambassadors/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'draft', name: p.name, platform: p.platform, niche: p.niche, lang }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      setDraft({ subject: j.subject || '', body: j.body || '' });
    } finally { setBusy(''); }
  }
  async function send() {
    const email = sel?.email || form.email;
    if (!email) { toast(L('Este prospecto no tiene correo.', 'This prospect has no email.')); return; }
    if (!draft.body) { toast(L('Genera o escribe el mensaje.', 'Generate or write the message.')); return; }
    setBusy('send');
    try {
      const r = await fetch('/api/admin/ambassadors/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'send', prospectId: sel?.id, email, subject: draft.subject, body: draft.body, lang }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(L('Invitación enviada ✓', 'Invitation sent ✓'), 'ok'); setDraft({ subject: '', body: '' }); setSel(null); load();
    } finally { setBusy(''); }
  }

  const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)' } as any;
  const ta = { ...inp, minHeight: 120, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical' } as any;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>🧲 {L('Reclutar embajadores', 'Recruit ambassadors')}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L('Añade creadores, la IA redacta la invitación personalizada y la envías por correo.', 'Add creators, AI drafts a personalized invite, and you send it by email.')}</p>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)', gap: 14 }}>
        {/* Pipeline */}
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{L('Pipeline de prospectos', 'Prospect pipeline')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {!list.length && <div className="muted" style={{ fontSize: 13 }}>{L('Aún no hay prospectos.', 'No prospects yet.')}</div>}
            {list.map((p) => { const st = STAT[p.status] || STAT.new; return (
              <div key={p.id} style={{ background: sel?.id === p.id ? 'rgba(124,140,255,.12)' : 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
                <div className="row between" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => pick(p)}>{p.name} <span className="muted" style={{ fontWeight: 400, textTransform: 'capitalize' }}>· {p.platform}</span></span>
                  <span className="pill" style={{ color: st[1], background: st[1] + '22', fontSize: 11 }}>{st[0]}</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)} style={{ margin: 0, padding: '3px 6px', fontSize: 12, width: 'auto' }}>
                    {Object.keys(STAT).map((k) => <option key={k} value={k}>{STAT[k][0]}</option>)}
                  </select>
                  <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11.5 }} onClick={() => pick(p)}>✨ {L('Invitar', 'Invite')}</button>
                  <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11.5, marginLeft: 'auto' }} onClick={() => del(p.id)}>✕</button>
                </div>
              </div>
            ); })}
          </div>
          {/* Añadir prospecto */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={L('Nombre / @handle', 'Name / @handle')} style={inp} />
            <div className="row" style={{ gap: 6 }}>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={{ ...inp, textTransform: 'capitalize' }}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} style={inp}>{NICHES.map(([k, lb]) => <option key={k} value={k}>{lb}</option>)}</select>
            </div>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={L('Correo (para enviarle)', 'Email (to reach them)')} style={inp} />
            <button className="btn btn-ghost" onClick={add} disabled={busy === 'add'}>＋ {L('Añadir prospecto', 'Add prospect')}</button>
          </div>
        </div>

        {/* Invitación AI */}
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>✨ {L('Invitación con AI', 'AI invitation')} {sel && <b style={{ color: 'var(--tx)' }}>· {sel.name}</b>}</div>
          <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder={L('Asunto', 'Subject')} style={{ ...inp, flex: 1, minWidth: 160 }} />
            <button className="btn btn-ghost" onClick={generate} disabled={busy === 'gen'}>{busy === 'gen' ? '…' : '✨ ' + L('Generar', 'Generate')}</button>
          </div>
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={L('El mensaje aparecerá aquí. Elige un prospecto y pulsa Generar.', 'The message appears here. Pick a prospect and hit Generate.')} style={ta} />
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" onClick={send} disabled={busy === 'send'} style={{ marginLeft: 'auto' }}>{busy === 'send' ? '…' : '✉️ ' + L('Enviar invitación', 'Send invitation')}</button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{L('El AI usa el cerebro de Onyx (no inventa) y propone tu comisión y cupón.', 'AI uses the Onyx brain (no made-up features) and pitches your commission and coupon.')}</p>
        </div>
      </div>
    </div>
  );
}

export default function Ambassadors() {
  const t = useT();
  const { lang } = useLang();
  const L = mkL(lang);   // bilingüe local (igual que en Recruit): evita ReferenceError en el modal de pago
  const [range, setRange] = useState<Range>(() => defaultRange('month'));
  const ST: any = {
    pending: { t: t.st_pending, c: 'var(--amber)' },
    approved: { t: t.st_approved, c: 'var(--green)' },
    rejected: { t: t.st_rejected, c: 'var(--red)' },
    paused: { t: t.st_paused, c: 'var(--mut)' },
  };
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [s, setS] = useState<any>({});
  const [payM, setPayM] = useState<any>(null);   // payout que se está confirmando
  const [txid, setTxid] = useState('');
  const [paynote, setPaynote] = useState('');    // nota interna del pago (además del txid)

  useEffect(() => { load(); }, []);
  async function load() {
    const r = await fetch('/api/admin/ambassadors');
    const j = await r.json();
    setD(j); setS(j.settings || {});
  }
  async function act(action: string, id?: string, value?: any, note?: string, extra?: any) {
    setBusy(String(id || action));
    const r = await fetch('/api/admin/ambassadors', { method: 'PATCH', body: JSON.stringify({ action, id, value, note, ...(extra || {}) }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toastErr(j); return; }
    if (action === 'approve' && j.promo === false) toast(t.am_promoFail);
    if (action === 'pay' && j.transfer_id) toast(L('Pago enviado por Stripe ✓', 'Payout sent via Stripe ✓'));
    load();
  }
  // Abre el modal de confirmación (Stripe automático o cripto con QR + txid).
  function payPayout(p: any) { setTxid(''); setPaynote(''); setPayM(p); }

  // Ejecuta el pago de Stripe (transferencia real) desde el modal.
  async function doStripePay() {
    if (!payM) return;
    await act('pay', payM.id, null, undefined, { note: paynote || null });
    setPayM(null);
  }
  // Marca pagado a mano (cripto/otro) con la referencia escrita.
  async function doManualPay() {
    if (!payM) return;
    await act('mark_paid', payM.id, null, undefined, { tx_ref: txid, note: paynote || null });
    setPayM(null);
  }

  if (!d) return <div className="card muted">…</div>;
  const list: any[] = d.ambassadors || [];
  const pend = list.filter((a) => a.status === 'pending');
  const payouts: any[] = d.payouts || [];
  const totalOwed = list.reduce((t, a) => t + (a.balances?.available || 0), 0);
  const totalActive = list.reduce((t, a) => t + (a.active || 0), 0);
  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
  const num = { margin: 0, width: 90, padding: '6px 8px' } as any;

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🎁</span><span className="th-t">{t.h_embajadores_t}</span></div><div className="th-s">{t.h_embajadores_s}</div></div>
      <RangeBar value={range} onChange={setRange}
        pdfUrl={(f, tt) => `/api/admin/ambassadors/report?from=${f}&to=${tt}&lang=${lang}`}
        csvUrl={(f, tt) => `/api/admin/ambassadors/report?export=csv&from=${f}&to=${tt}&lang=${lang}`} />
      <MemberReferralSettings />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="lbl">{t.am_ambassadors}</div><div className="val">{list.filter((a) => a.status === 'approved').length}</div></div>
        <div className="card kpi"><div className="lbl">{t.am_requests}</div><div className="val" style={{ color: pend.length ? 'var(--amber)' : undefined }}>{pend.length}</div></div>
        <div className="card kpi"><div className="lbl">{t.am_brought}</div><div className="val pos">{totalActive}</div></div>
        <div className="card kpi"><div className="lbl">{t.am_toPay}</div><div className="val">${Math.round(totalOwed * 100) / 100}</div></div>
      </div>

      {/* Pagos solicitados */}
      {!!payouts.length && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--amber)' }}>
          <h3 style={{ marginBottom: 10, color: 'var(--amber)' }}>{t.am_payouts} ({payouts.length})</h3>
          {payouts.map((p) => {
            const amb = list.find((a) => a.id === p.ambassador_id);
            return (
              <div key={p.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '10px 0', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b>${p.amount}</b> · {amb?.email || '—'} <span className="muted">({METHOD[p.method] || p.method})</span>
                  {(p.method || p.amb_method) === 'stripe' && (
                    <span className="pill" style={{ marginLeft: 6, fontSize: 11, color: p.stripe_ready ? 'var(--green)' : 'var(--amber)' }}>
                      {p.stripe_ready ? (lang === 'en' ? 'Stripe ready' : 'Stripe listo') : (lang === 'en' ? 'Stripe not connected' : 'Stripe sin conectar')}
                    </span>
                  )}
                  <div className="muted" style={{ fontSize: 12 }}>{p.details}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {p.method === 'usdt' && p.details && <QrPop data={p.details} label={lang === 'en' ? 'USDT QR' : 'QR USDT'} />}
                  <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => payPayout(p)} disabled={busy === p.id}>
                    {(p.method || p.amb_method) === 'stripe' && p.stripe_ready ? (lang === 'en' ? 'Pay via Stripe' : 'Pagar por Stripe') : t.am_markPaid}
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { const n = prompt(t.am_rejectReason) || ''; act('reject_payout', p.id, null, n); }}>{t.am_reject}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ajustes del programa */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>{t.am_rules}</h3>
        <div className="grid g4" style={{ gap: 12 }}>
          <div><span style={lbl}>{t.am_baseRate}</span><input type="number" value={s.base_rate ?? 20} onChange={(e) => setS({ ...s, base_rate: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_goldRate}</span><input type="number" value={s.tier_rate ?? 30} onChange={(e) => setS({ ...s, tier_rate: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_goldActive}</span><input type="number" value={s.tier_threshold ?? 10} onChange={(e) => setS({ ...s, tier_threshold: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_holdDays}</span><input type="number" value={s.hold_days ?? 30} onChange={(e) => setS({ ...s, hold_days: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_minPayout}</span><input type="number" value={s.min_payout ?? 50} onChange={(e) => setS({ ...s, min_payout: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_couponPct}</span><input type="number" value={s.coupon_percent ?? 20} onChange={(e) => setS({ ...s, coupon_percent: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_couponMonths}</span><input type="number" value={s.coupon_months ?? 1} onChange={(e) => setS({ ...s, coupon_months: Number(e.target.value) })} style={num} /></div>
          <div><span style={lbl}>{t.am_commMonths}</span><input type="number" min={0} value={s.commission_months ?? 0} onChange={(e) => setS({ ...s, commission_months: Math.max(0, Number(e.target.value)) })} style={num} /></div>
        </div>
        <label className="row" style={{ gap: 8, marginTop: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.enabled !== false} onChange={(e) => setS({ ...s, enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> {t.am_open}
        </label>

        {/* Automatización: simple + protegido + escalable */}
        <div style={{ marginTop: 14, background: 'var(--bg2)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="row" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={s.auto_promote !== false} onChange={(e) => setS({ ...s, auto_promote: e.target.checked })} style={{ width: 'auto', margin: '3px 0 0' }} />
            <span>{L('Auto-ascenso a Embajador', 'Auto-promote to Ambassador')}<br /><span className="muted" style={{ fontSize: 12 }}>{L('Al llegar al umbral de referidos, el usuario se vuelve embajador solo (reversible).', 'On hitting the referral threshold, the user becomes an ambassador automatically (reversible).')}</span></span>
          </label>
          <label className="row" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={s.auto_payout !== false} onChange={(e) => setS({ ...s, auto_payout: e.target.checked })} style={{ width: 'auto', margin: '3px 0 0' }} />
            <span>{L('Pago automático', 'Automatic payout')}<br /><span className="muted" style={{ fontSize: 12 }}>{L('Paga solo cuando el saldo madura: pasó retención, supera el mínimo y Stripe está verificado.', 'Pays only when the balance matures: retention passed, above minimum and Stripe verified.')}</span></span>
          </label>
          <label className="row" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={s.review_before_pay === true} onChange={(e) => setS({ ...s, review_before_pay: e.target.checked })} style={{ width: 'auto', margin: '3px 0 0' }} />
            <span>{L('Revisar antes de pagar (freno global)', 'Review before paying (global brake)')}<br /><span className="muted" style={{ fontSize: 12 }}>{L('Encola el pago pero lo apruebas tú. Apagado = pago 100% automático.', 'Queues the payout for you to approve. Off = fully automatic.')}</span></span>
          </label>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => act('settings', undefined, s)} disabled={busy === 'settings'}>{t.am_saveRules}</button>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.am_couponNote}</p>
      </div>

      {/* Reclutar (mini-CRM + invitación con AI) */}
      <Recruit lang={lang as 'es' | 'en'} />

      {/* Lista */}
      <h3 style={{ marginBottom: 12 }}>{t.am_list} ({list.length})</h3>
      {!list.length && <div className="card muted">{t.am_empty}</div>}
      {list.map((a) => {
        const st = ST[a.status] || ST.pending;
        return (
          <div key={a.id} className="card" style={{ marginBottom: 12, borderLeft: '3px solid ' + st.c }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b>{a.email || '—'}</b>
                  <span className="pill" style={{ color: st.c, background: st.c + '22' }}>{st.t}</span>
                  {a.status === 'approved' && <span className="pill" style={{ color: a.tier === 'gold' ? 'var(--gold)' : '#c7ccd6' }}>{a.tier === 'gold' ? t.am_gold : t.am_silver} · {a.rate}%</span>}
                  {a.on_hold && <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(255,192,77,.15)' }}>{L('Pago retenido', 'Payout held')}</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {t.am_code} <b>{a.code}</b> · {METHOD[a.payout_method] || '—'} {a.payout_details ? `· ${a.payout_details}` : ''} {a.followers ? `· ${Number(a.followers).toLocaleString()} ${t.am_followers}` : ''}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {a.status === 'pending' && <>
                  <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('approve', a.id)} disabled={busy === a.id}>{t.am_approve}</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('status', a.id, 'rejected')}>{t.am_reject}</button>
                </>}
                {a.status === 'approved' && <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, color: a.on_hold ? 'var(--green)' : 'var(--amber)' }} onClick={() => act('hold', a.id, !a.on_hold)} disabled={busy === a.id} title={L('Retiene o reanuda el pago automático de este embajador', 'Holds or resumes this ambassador’s automatic payout')}>{a.on_hold ? L('Reanudar pago', 'Resume payout') : L('Retener pago', 'Hold payout')}</button>}
                {a.status === 'approved' && <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('status', a.id, 'paused')}>{t.am_pause}</button>}
                {(a.status === 'paused' || a.status === 'rejected') && <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => act('status', a.id, 'approved')}>{t.am_reactivate}</button>}
              </div>
            </div>

            {a.audience && <div className="muted" style={{ fontSize: 13, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>{a.audience}</div>}

            {a.status === 'approved' && (
              <>
                <div className="grid g4" style={{ gap: 10, marginBottom: 10 }}>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_clicks}</div><b>{a.clicks}</b></div>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_signups}</div><b>{a.signups}</b></div>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_active}</div><b style={{ color: 'var(--green)' }}>{a.active}</b></div>
                  <div><div className="muted" style={{ fontSize: 12 }}>{t.am_conversion}</div><b>{a.clicks ? Math.round((a.signups / a.clicks) * 100) : 0}%</b></div>
                </div>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <span className="muted">{t.am_pending} <b style={{ color: 'var(--tx)' }}>${a.balances?.pending || 0}</b></span>
                  <span className="muted">{t.am_available} <b style={{ color: 'var(--green)' }}>${a.balances?.available || 0}</b></span>
                  <span className="muted">{t.am_paid} <b style={{ color: 'var(--tx)' }}>${a.balances?.paid || 0}</b></span>
                  <span style={{ flex: 1 }} />
                  <span className="muted" style={{ fontSize: 12 }}>{t.am_ownRate}</span>
                  <input defaultValue={a.rate ?? ''} placeholder="auto" onBlur={(e) => { const v = e.target.value.trim(); act('rate', a.id, v === '' ? null : Number(v)); }} style={{ margin: 0, width: 70, padding: '4px 8px' }} />
                  <span className="muted" style={{ fontSize: 12 }}>{t.am_ownRateHint}</span>
                </div>
              </>
            )}
          </div>
        );
      })}

      {payM && (() => {
        const isStripe = (payM.method || payM.amb_method) === 'stripe';
        const isUsdt = (payM.method || payM.amb_method) === 'usdt';
        const amb = list.find((a) => a.id === payM.ambassador_id);
        return (
          <div onClick={() => setPayM(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ marginBottom: 12 }}>{L('Confirmar pago', 'Confirm payout')}</h3>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                <div className="row between"><span className="muted">{L('Monto', 'Amount')}</span><b>${payM.amount}</b></div>
                <div className="row between"><span className="muted">{L('Embajador', 'Ambassador')}</span><span>{amb?.email || payM.amb_code || '—'}</span></div>
                <div className="row between"><span className="muted">{L('Método', 'Method')}</span><span>{METHOD[payM.method || payM.amb_method] || '—'}{isUsdt && payM.amb_network ? ` · ${payM.amb_network}` : ''}</span></div>
              </div>

              {/* Nota interna del pago (queda en el registro de actividad, además del txid). */}
              <div style={{ marginBottom: 12 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{L('Nota interna (opcional)', 'Internal note (optional)')}</span>
                <textarea value={paynote} onChange={(e) => setPaynote(e.target.value)} rows={2} placeholder={L('Ej: pago de la comisión de julio', 'e.g. July commission payout')} style={{ width: '100%', margin: 0 }} />
              </div>

              {isStripe ? (
                p_stripeReady(payM) ? (
                  <>
                    <div style={{ background: 'rgba(55,138,221,.12)', borderRadius: 10, padding: '9px 11px', fontSize: 12, color: 'var(--soft-brand)', marginBottom: 12 }}>
                      {L('Se transferirá el monto a su cuenta de Stripe. Puede tardar 1–5 días laborables en llegar a su banco.', 'The amount will be transferred to their Stripe account. It can take 1–5 business days to reach their bank.')}
                    </div>
                    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => setPayM(null)}>{L('Cancelar', 'Cancel')}</button>
                      <button className="btn btn-primary" onClick={doStripePay} disabled={busy === payM.id}>{L('Pagar por Stripe', 'Pay via Stripe')}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: 'rgba(240,160,20,.12)', borderRadius: 10, padding: '9px 11px', fontSize: 12, color: 'var(--amber)', marginBottom: 12 }}>
                      {L('Aún no terminó de conectar Stripe. Puedes marcarlo pagado a mano.', 'They have not finished connecting Stripe. You can mark it paid manually.')}
                    </div>
                    <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder={L('Referencia (opcional)', 'Reference (optional)')} style={{ marginBottom: 12 }} />
                    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => setPayM(null)}>{L('Cancelar', 'Cancel')}</button>
                      <button className="btn btn-primary" onClick={doManualPay} disabled={busy === payM.id}>{t.am_markPaid}</button>
                    </div>
                  </>
                )
              ) : (
                <>
                  {isUsdt && payM.amb_details && (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                      <img src={`/api/qr?data=${encodeURIComponent(payM.amb_details)}&size=160`} alt="QR" width={96} height={96} style={{ borderRadius: 8, background: '#fff', padding: 4 }} />
                      <div style={{ fontSize: 12, minWidth: 0 }}>
                        <div className="muted">{payM.amb_network || 'USDT'}</div>
                        <div style={{ wordBreak: 'break-all' }}>{payM.amb_details}</div>
                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12, marginTop: 6 }} onClick={() => navigator.clipboard.writeText(payM.amb_details)}>{L('Copiar dirección', 'Copy address')}</button>
                      </div>
                    </div>
                  )}
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L('Escanea, envía desde tu wallet y pega el txid:', 'Scan, send from your wallet and paste the txid:')}</div>
                  <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="txid" style={{ marginBottom: 12 }} />
                  <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={() => setPayM(null)}>{L('Cancelar', 'Cancel')}</button>
                    <button className="btn btn-primary" onClick={doManualPay} disabled={busy === payM.id}>{t.am_markPaid}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

function p_stripeReady(p: any): boolean { return !!p.stripe_ready; }
