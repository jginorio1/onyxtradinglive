'use client';
import { dictFor } from '@/lib/i18n';
import { toast, toastErr } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { fmtDateTime } from '@/lib/fmtDate';
import { describeLog, CAT_STYLE } from '@/lib/logFormat';

type Lang = 'es' | 'en';
const T: any = {
  es: { activity: 'Actividad de la cuenta', emails: 'Correos que le envió el sistema', none: 'Sin registros.', noEmails: 'Ningún correo aún.',
    by: 'por', write: 'Escribirle un correo', subj: 'Asunto', body: 'Mensaje', send: 'Enviar correo', sent: 'Correo enviado.', close: 'Cerrar',
    sentS: 'enviado', failed: 'falló', tabs: ['Actividad', 'Correos', 'Crédito', 'Compras'],
    puNone: 'Sin compras registradas.', puTerms: 'Términos', puDeliv: 'Entregas', puView: 'Ver en Stripe', puSubmit: 'Enviar evidencia', puDraft: 'Guardar borrador',
    puConfirm: '¿Enviar la evidencia a Stripe ahora? No se puede deshacer.', puDisputed: 'EN DISPUTA', puPaid: 'Pagado', puIp: 'IP',
    crT: 'Crédito en su plan', crAvail: 'Crédito disponible ahora', crAmount: 'Monto a añadir (USD)', crNote: 'Nota (obligatoria)',
    crAdd: 'Añadir crédito', crDone: 'Crédito aplicado.', crNote2: 'Se aplica como saldo a favor y se descuenta de su próxima factura. Usa un monto negativo para quitar crédito.',
    crNoteReq: 'La nota es obligatoria.', crConfT: 'Confirmar crédito', crYouCredit: 'Vas a acreditar a', crConfBtn: 'Confirmar y acreditar', crCancel: 'Cancelar', crNoteLbl: 'Nota',
    crNoCust: 'Este usuario aún no tiene cliente en Stripe (no ha iniciado ningún pago), así que no se le puede aplicar crédito todavía.',
    act: { plan: 'Cambió el plan', ban: 'Bloqueó la cuenta', unban: 'Desbloqueó la cuenta', admin: 'Cambió rol de admin', delete_user: 'Eliminó la cuenta', email_user: 'Le envió un correo', self_plan: 'Cambió su propio plan', user_credit: 'Le aplicó crédito' } },
  en: { activity: 'Account activity', emails: 'Emails the system sent them', none: 'No records.', noEmails: 'No emails yet.',
    by: 'by', write: 'Write them an email', subj: 'Subject', body: 'Message', send: 'Send email', sent: 'Email sent.', close: 'Close',
    sentS: 'sent', failed: 'failed', tabs: ['Activity', 'Emails', 'Credit', 'Purchases'],
    puNone: 'No purchases recorded.', puTerms: 'Terms', puDeliv: 'Deliveries', puView: 'View in Stripe', puSubmit: 'Submit evidence', puDraft: 'Save draft',
    puConfirm: 'Submit the evidence to Stripe now? This cannot be undone.', puDisputed: 'DISPUTED', puPaid: 'Paid', puIp: 'IP',
    crT: 'Credit on their plan', crAvail: 'Credit available now', crAmount: 'Amount to add (USD)', crNote: 'Note (required)',
    crAdd: 'Add credit', crDone: 'Credit applied.', crNote2: 'Applied as account credit, deducted from their next invoice. Use a negative amount to remove credit.',
    crNoteReq: 'The note is required.', crConfT: 'Confirm credit', crYouCredit: 'You will credit', crConfBtn: 'Confirm and credit', crCancel: 'Cancel', crNoteLbl: 'Note',
    crNoCust: 'This user has no Stripe customer yet (never started a payment), so credit cannot be applied yet.',
    act: { plan: 'Changed plan', ban: 'Banned account', unban: 'Unbanned account', admin: 'Changed admin role', delete_user: 'Deleted account', email_user: 'Sent an email', self_plan: 'Changed own plan', user_credit: 'Applied credit' } },
};

export default function UserDrawer({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const { lang } = useLang() as { lang: Lang };
  const t = dictFor(T, lang);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [subj, setSubj] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [credit, setCredit] = useState<any>(null);   // estado del crédito del usuario
  const [crAmt, setCrAmt] = useState('');
  const [crNote, setCrNote] = useState('');
  const [crConfirm, setCrConfirm] = useState(false); // popup de confirmación
  const [purchases, setPurchases] = useState<any[] | null>(null); // compras/evidencia
  const [pAct, setPAct] = useState('');

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000); // auto-refresco de actividad y correos
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => { clearInterval(iv); document.removeEventListener('keydown', esc); };
  }, []);
  async function load() { try { const r = await fetch('/api/admin/user-activity?id=' + userId); setD(await r.json()); } catch { setD({ activity: [], emails: [] }); } }
  async function loadCredit() { try { const r = await fetch('/api/admin/credit?id=' + userId); setCredit(await r.json()); } catch { setCredit({ hasCustomer: false, balance: 0 }); } }
  async function loadPurchases() { try { const r = await fetch('/api/admin/evidence?userId=' + userId); const j = await r.json(); setPurchases(j.rows || []); } catch { setPurchases([]); } }
  useEffect(() => { if (tab === 2 && !credit) loadCredit(); if (tab === 3 && !purchases) loadPurchases(); }, [tab]);

  // Enviar (o guardar borrador de) la evidencia de una disputa a Stripe.
  async function sendEvidence(disputeId: string, submit: boolean) {
    if (submit && !confirm(t.puConfirm)) return;
    setPAct(disputeId);
    try {
      const r = await fetch('/api/admin/evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: submit ? 'submit' : 'draft', disputeId }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); } else { toast(j.note || 'OK', 'ok'); loadPurchases(); }
    } finally { setPAct(''); }
  }

  // Paso 1: valida (nota obligatoria) y abre la confirmación.
  function askCredit() {
    const amount = Number(crAmt);
    if (!Number.isFinite(amount) || amount === 0) return;
    if (!crNote.trim()) { toast(t.crNoteReq); return; }
    setCrConfirm(true);
  }
  // Paso 2: aplica el crédito tras confirmar.
  async function doCredit() {
    const amount = Number(crAmt);
    setBusy(true);
    try {
      const r = await fetch('/api/admin/credit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: userId, amount, note: crNote }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(t.crDone, 'ok'); setCrAmt(''); setCrNote(''); setCrConfirm(false); setCredit(j); load();
    } finally { setBusy(false); }
  }

  async function send() {
    if (!subj.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/user-activity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: userId, subject: subj, body }) });
      const j = await r.json(); if (!r.ok) { toastErr(j); return; }
      toast(t.sent, 'ok'); setSubj(''); setBody(''); load();
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 80, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,100%)', height: '100%', background: 'var(--bg)', borderLeft: '1px solid var(--line)', overflowY: 'auto', padding: 20 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}>{email}</b>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          {t.tabs.map((tt: string, i: number) => <button key={i} className={'btn ' + (tab === i ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setTab(i)}>{tt}</button>)}
        </div>

        {!d && <div className="muted">…</div>}

        {d && tab === 0 && (
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>{t.activity}</div>
            {!d.activity?.length && <div className="muted" style={{ fontSize: 13 }}>{t.none}</div>}
            {(d.activity || []).map((a: any, i: number) => {
              const dl = describeLog(a, lang); const cs = CAT_STYLE[dl.cat];
              return (
                <div key={i} style={{ borderLeft: `3px solid ${cs.color}`, background: cs.bg, borderRadius: '0 8px 8px 0', padding: '8px 10px', marginTop: i ? 6 : 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--tx)' }}><span style={{ marginRight: 6 }}>{cs.icon}</span>{dl.text}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.by} {a.admin_email || '—'} · {fmtDateTime(a.created_at, lang)}</div>
                </div>
              );
            })}
          </div>
        )}

        {d && tab === 1 && (
          <>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>{t.emails}</div>
              {!d.emails?.length && <div className="muted" style={{ fontSize: 13 }}>{t.noEmails}</div>}
              {(d.emails || []).map((e: any, i: number) => (
                <div key={i} className="row between" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '9px 0', fontSize: 13, gap: 8 }}>
                  <span>{e.subject || '—'}</span>
                  <span style={{ fontSize: 11, color: e.status === 'sent' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>{e.status === 'sent' ? t.sentS : t.failed} · {fmtDateTime(e.created_at, lang)}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>✉️ {t.write}</div>
              <input placeholder={t.subj} value={subj} onChange={(e) => setSubj(e.target.value)} style={{ margin: 0 }} />
              <textarea placeholder={t.body} value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ width: '100%', marginTop: 8, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={send} disabled={busy || !subj.trim() || !body.trim()}>{busy ? '…' : t.send}</button>
            </div>
          </>
        )}

        {tab === 2 && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🎁 {t.crT}</div>
            {!credit && <div className="muted">…</div>}
            {credit && !credit.hasCustomer && <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{t.crNoCust}</div>}
            {credit && credit.hasCustomer && (
              <>
                <div className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 12 }}>
                  <span className="muted" style={{ fontSize: 13 }}>{t.crAvail}</span>
                  <b style={{ fontSize: 18, color: 'var(--green)' }}>${credit.balance || 0}</b>
                </div>
                <span style={{ fontSize: 12, color: 'var(--mut)' }}>{t.crAmount}</span>
                <input type="number" step="0.01" value={crAmt} onChange={(e) => setCrAmt(e.target.value)} placeholder="10" style={{ margin: '4px 0 10px', maxWidth: 160 }} />
                <span style={{ fontSize: 12, color: 'var(--mut)' }}>{t.crNote}</span>
                <input value={crNote} onChange={(e) => setCrNote(e.target.value)} placeholder={t.crNoteLbl} style={{ margin: '4px 0 12px' }} />
                <button className="btn btn-primary" onClick={askCredit} disabled={busy || !Number(crAmt) || !crNote.trim()}
                  style={{ opacity: (Number(crAmt) && crNote.trim()) ? 1 : .5 }}>{busy ? '…' : t.crAdd}</button>
                <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{t.crNote2}</div>
              </>
            )}
          </div>
        )}

        {tab === 3 && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🧾 {t.tabs[3]}</div>
            {!purchases && <div className="muted">…</div>}
            {purchases && purchases.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{t.puNone}</div>}
            {(purchases || []).map((p: any) => {
              const disputed = p.status === 'disputed';
              return (
                <div key={p.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
                  <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.product || p.kind}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {p.amount != null ? `$${p.amount} ${p.currency} · ` : ''}{fmtDateTime(p.createdAt, lang)}
                      </div>
                    </div>
                    <span className="pill" style={{ fontSize: 11, fontWeight: 700, background: disputed ? 'rgba(255,69,58,.16)' : 'rgba(52,199,120,.14)', color: disputed ? '#c62f26' : '#1f9d57' }}>
                      {disputed ? t.puDisputed : t.puPaid}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
                    {t.puIp}: {p.ip || '—'} · {t.puTerms}: {p.consent ? `✔ ${p.termsVersion || ''}` : '—'} · {t.puDeliv}: {(p.deliveryLog || []).length}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {p.stripePayUrl && <a className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} href={p.stripePayUrl} target="_blank" rel="noreferrer">Stripe →</a>}
                    {disputed && (
                      <>
                        {p.stripeDisputeUrl && <a className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} href={p.stripeDisputeUrl} target="_blank" rel="noreferrer">{t.puView}</a>}
                        <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} disabled={pAct === p.disputeId} onClick={() => sendEvidence(p.disputeId, false)}>{t.puDraft}</button>
                        <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '4px 10px' }} disabled={pAct === p.disputeId} onClick={() => sendEvidence(p.disputeId, true)}>{pAct === p.disputeId ? '…' : t.puSubmit}</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Popup de confirmación del crédito */}
        {crConfirm && (
          <div onClick={() => setCrConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 340, width: '100%' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>🎁 {t.crConfT}</div>
              <div style={{ background: 'rgba(52,226,160,.12)', borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--green)' }}>{t.crYouCredit} {email}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{Number(crAmt) >= 0 ? '+' : ''}${Number(crAmt)}</div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 12 }}><span className="muted">{t.crNoteLbl}:</span> {crNote}</div>
              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setCrConfirm(false)}>{t.crCancel}</button>
                <button className="btn btn-primary" onClick={doCredit} disabled={busy}>{busy ? '…' : t.crConfBtn}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
