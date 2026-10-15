'use client';
import { dictFor } from '@/lib/i18n';
import { toast, toastErr } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { fmtDateTime } from '@/lib/fmtDate';
import { describeLog, CAT_STYLE } from '@/lib/logFormat';
import OnyxIcon from '@/app/components/OnyxIcon';

type Lang = 'es' | 'en';
const T: any = {
  es: { activity: 'Actividad de la cuenta', emails: 'Correos que le envió el sistema', none: 'Sin registros.', noEmails: 'Ningún correo aún.',
    by: 'por', write: 'Escribirle un correo', subj: 'Asunto', body: 'Mensaje', send: 'Enviar correo', sent: 'Correo enviado.', close: 'Cerrar',
    sentS: 'enviado', failed: 'falló', tabs: ['Expediente', 'Actividad', 'Correos', 'Crédito', 'Compras'],
    exTitle: 'Todo lo que recibe y hace', exNone: 'Sin registros todavía.', exAll: 'Todo', exUrgent: 'Urgentes',
    exReg: 'Registrado', exConf: 'Confirmó', exOnb: 'Onboarding', exPlan: 'Plan', exDev: 'Dispositivos', exAcc: 'Brókers', exAi: 'IA',
    exYes: 'Sí', exNo: 'No', exPending: 'Pendiente',
    exMore: 'Mostrar más', exLess: 'Mostrar menos', exTimes: 'veces', exHist: 'Ver historial',
    exOnline: 'En línea', exOffline: 'Fuera de línea', exIn: 'en', exLast: 'última vez',
    exNever: 'Nunca ha entrado', exAiNote: 'Se contabiliza desde que se active',
    exAiTitle: 'Consumo de Onyx AI · por módulo', exAiCap: 'Tope del mes', exAiPlan: 'Plan', exAiExtra: 'extra', exAiUnlim: 'Ilimitado (equipo o plan sin tope)',
    themes: { cuenta: 'Cuenta', dispositivo: 'Dispositivo', conexion: 'Bróker', correo: 'Correos', soporte: 'Soporte', admin: 'Admin', ia: 'Onyx AI' },
    puNone: 'Sin compras registradas.', puTerms: 'Términos', puDeliv: 'Entregas', puView: 'Ver en Stripe', puSubmit: 'Enviar evidencia', puDraft: 'Guardar borrador',
    puConfirm: '¿Enviar la evidencia a Stripe ahora? No se puede deshacer.', puDisputed: 'EN DISPUTA', puPaid: 'Pagado', puIp: 'IP',
    crT: 'Crédito en su plan', crAvail: 'Crédito disponible ahora', crAmount: 'Monto a añadir (USD)', crNote: 'Nota (obligatoria)',
    crAdd: 'Añadir crédito', crDone: 'Crédito aplicado.', crNote2: 'Se aplica como saldo a favor y se descuenta de su próxima factura. Usa un monto negativo para quitar crédito.',
    crNoteReq: 'La nota es obligatoria.', crConfT: 'Confirmar crédito', crYouCredit: 'Vas a acreditar a', crConfBtn: 'Confirmar y acreditar', crCancel: 'Cancelar', crNoteLbl: 'Nota',
    crNoCust: 'Este usuario aún no tiene cliente en Stripe (no ha iniciado ningún pago), así que no se le puede aplicar crédito todavía.',
    act: { plan: 'Cambió el plan', ban: 'Bloqueó la cuenta', unban: 'Desbloqueó la cuenta', admin: 'Cambió rol de admin', delete_user: 'Eliminó la cuenta', email_user: 'Le envió un correo', self_plan: 'Cambió su propio plan', user_credit: 'Le aplicó crédito' } },
  en: { activity: 'Account activity', emails: 'Emails the system sent them', none: 'No records.', noEmails: 'No emails yet.',
    by: 'by', write: 'Write them an email', subj: 'Subject', body: 'Message', send: 'Send email', sent: 'Email sent.', close: 'Close',
    sentS: 'sent', failed: 'failed', tabs: ['Record', 'Activity', 'Emails', 'Credit', 'Purchases'],
    exTitle: 'Everything they receive and do', exNone: 'No records yet.', exAll: 'All', exUrgent: 'Urgent',
    exReg: 'Registered', exConf: 'Confirmed', exOnb: 'Onboarding', exPlan: 'Plan', exDev: 'Devices', exAcc: 'Brokers', exAi: 'AI',
    exYes: 'Yes', exNo: 'No', exPending: 'Pending',
    exMore: 'Show more', exLess: 'Show less', exTimes: 'times', exHist: 'See history',
    exOnline: 'Online', exOffline: 'Offline', exIn: 'in', exLast: 'last seen',
    exNever: 'Never signed in', exAiNote: 'Counted from when you enable it',
    exAiTitle: 'Onyx AI usage · by module', exAiCap: 'Monthly cap', exAiPlan: 'Plan', exAiExtra: 'extra', exAiUnlim: 'Unlimited (staff or uncapped plan)',
    themes: { cuenta: 'Account', dispositivo: 'Device', conexion: 'Broker', correo: 'Emails', soporte: 'Support', admin: 'Admin', ia: 'Onyx AI' },
    puNone: 'No purchases recorded.', puTerms: 'Terms', puDeliv: 'Deliveries', puView: 'View in Stripe', puSubmit: 'Submit evidence', puDraft: 'Save draft',
    puConfirm: 'Submit the evidence to Stripe now? This cannot be undone.', puDisputed: 'DISPUTED', puPaid: 'Paid', puIp: 'IP',
    crT: 'Credit on their plan', crAvail: 'Credit available now', crAmount: 'Amount to add (USD)', crNote: 'Note (required)',
    crAdd: 'Add credit', crDone: 'Credit applied.', crNote2: 'Applied as account credit, deducted from their next invoice. Use a negative amount to remove credit.',
    crNoteReq: 'The note is required.', crConfT: 'Confirm credit', crYouCredit: 'You will credit', crConfBtn: 'Confirm and credit', crCancel: 'Cancel', crNoteLbl: 'Note',
    crNoCust: 'This user has no Stripe customer yet (never started a payment), so credit cannot be applied yet.',
    act: { plan: 'Changed plan', ban: 'Banned account', unban: 'Unbanned account', admin: 'Changed admin role', delete_user: 'Deleted account', email_user: 'Sent an email', self_plan: 'Changed own plan', user_credit: 'Applied credit' } },
};

// Estilo por tema del expediente (icono + color), para leer de un vistazo.
const THEME_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  cuenta: { icon: '👤', color: '#c8a24b', bg: 'rgba(200,162,75,.10)' },
  dispositivo: { icon: '📱', color: '#5e9bd6', bg: 'rgba(94,155,214,.10)' },
  conexion: { icon: '🔌', color: '#34c778', bg: 'rgba(52,199,120,.10)' },
  correo: { icon: '✉', color: '#8a7fd6', bg: 'rgba(138,127,214,.10)' },
  soporte: { icon: '🛟', color: '#d6903e', bg: 'rgba(214,144,62,.10)' },
  admin: { icon: '🛡', color: '#9aa0a6', bg: 'rgba(154,160,166,.10)' },
  ia: { icon: '🤖', color: '#49c5c0', bg: 'rgba(73,197,192,.10)' },
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
  const [tl, setTl] = useState<any>(null);        // expediente unificado (timeline)
  const [tlFilter, setTlFilter] = useState<string>(''); // '' = todo, 'urgent', o un tema
  const [tlAll, setTlAll] = useState(false);      // "mostrar más"

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
  async function loadTimeline() { try { const r = await fetch('/api/admin/user-timeline?id=' + userId); setTl(await r.json()); } catch { setTl({ summary: {}, events: [] }); } }
  useEffect(() => { if (tab === 0 && !tl) loadTimeline(); if (tab === 3 && !credit) loadCredit(); if (tab === 4 && !purchases) loadPurchases(); }, [tab]);

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

        {tab === 0 && (
          <div>
            {!tl && <div className="muted">…</div>}
            {tl && (() => {
              const s = tl.summary || {}; const evs: any[] = tl.events || [];
              const pr = s.presence || {};
              const filtered = evs.filter((e) => !tlFilter ? true : tlFilter === 'urgent' ? e.urgent : e.theme === tlFilter);
              // Agrupa eventos repetidos seguidos (p. ej. "Cambió de plan" ×8) en una
              // sola línea con su conteo, para que la lista no crezca sin fin.
              const groups: any[] = [];
              for (const e of filtered) {
                const last = groups[groups.length - 1];
                if (last && last.title === e.title && last.theme === e.theme && !e.urgent && !last.urgent) { last.count++; last.lastTs = last.lastTs || last.ts; last.ts = last.ts; last.firstTs = e.ts; }
                else groups.push({ ...e, count: 1, firstTs: e.ts });
              }
              const LIMIT = 6;
              const visible = tlAll ? groups : groups.slice(0, LIMIT);
              const themesPresent = Array.from(new Set(evs.map((e) => e.theme)));
              const chip = (key: string, label: string) => (
                <button key={key} className={'btn ' + (tlFilter === key ? 'btn-primary' : 'btn-ghost')} style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => { setTlFilter(key); setTlAll(false); }}>{label}</button>
              );
              const aiVal = s.aiCalls ? `${s.aiCalls} · $${((s.aiCents || 0) / 100).toFixed(2)}` : t.exAiNote;
              return (
                <>
                  {/* Presencia: en línea / fuera de línea + sección + IP/ciudad */}
                  <div className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${pr.online ? 'var(--green,#34c778)' : 'var(--line)'}` }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: pr.online ? 'var(--green,#34c778)' : 'var(--mut,#888)', flexShrink: 0 }} />
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: pr.online ? 'var(--green,#1f9d57)' : 'var(--tx)' }}>
                        {pr.online ? `${t.exOnline}${pr.section ? ` · ${t.exIn} ${pr.section}` : ''}`
                          : pr.lastSeen ? `${t.exOffline} · ${t.exLast} ${fmtDateTime(pr.lastSeen, lang)}` : t.exNever}
                      </div>
                    </div>
                    {(pr.ip || pr.city || pr.country) && (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                        {[pr.ip ? `IP ${pr.ip}` : '', [pr.city, pr.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  {/* Resumen de un vistazo */}
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 10 }}>{t.exTitle}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                      {[
                        [t.exReg, s.plan ? s.plan : '—', false],
                        [t.exConf, s.confirmed ? t.exYes : t.exPending, false],
                        [t.exOnb, s.onboarded ? t.exYes : t.exNo, false],
                        [t.exDev, (s.devices || []).join(', ') || '—', false],
                        [t.exAcc, String(s.accounts || 0), false],
                        [t.exAi, aiVal, !s.aiCalls],
                      ].map(([k, v, note]: any, i: number) => (
                        <div key={i} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '7px 9px' }}>
                          <div className="muted" style={{ fontSize: 10.5 }}>{k}</div>
                          <div style={{ fontSize: note ? 10.5 : 13, fontWeight: note ? 400 : 600, marginTop: 1, color: note ? 'var(--mut)' : 'var(--tx)', lineHeight: note ? 1.3 : 1.2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consumo de IA desglosado por módulo + tope del plan */}
                  {(() => { const af = s.aiFeatures || []; const al = s.aiAllowance; if (!af.length && !al) return null;
                    const max = Math.max(1, ...af.map((f: any) => f.calls));
                    return (
                      <div className="card" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 10 }}>{t.exAiTitle}</div>
                        {af.map((f: any, i: number) => (
                          <div key={i} style={{ marginTop: i ? 8 : 0 }}>
                            <div className="row between" style={{ fontSize: 12.5 }}>
                              <span>{f.label}</span>
                              <span className="muted">{f.calls} · ${(f.cents / 100).toFixed(2)}</span>
                            </div>
                            <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, marginTop: 3 }}>
                              <div style={{ width: `${Math.round((f.calls / max) * 100)}%`, height: '100%', background: 'var(--brand,#c8a24b)', borderRadius: 3 }} />
                            </div>
                          </div>
                        ))}
                        {al && (
                          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 9 }}>
                            <div className="row between" style={{ fontSize: 12.5, fontWeight: 600 }}>
                              <span>{t.exAiCap}</span>
                              <span>{al.unlimited ? '∞' : `${al.used} / ${al.limit}`}</span>
                            </div>
                            {!al.unlimited && (
                              <div style={{ height: 7, background: 'var(--bg2)', borderRadius: 4, marginTop: 5 }}>
                                <div style={{ width: `${Math.min(100, Math.round((al.used / Math.max(1, al.limit)) * 100))}%`, height: '100%', background: al.used >= al.limit ? 'var(--red,#e5484d)' : al.used / Math.max(1, al.limit) > 0.85 ? 'var(--amber,#e0a73e)' : 'var(--green,#34c778)', borderRadius: 4 }} />
                              </div>
                            )}
                            <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                              {al.unlimited ? t.exAiUnlim : `${t.exAiPlan} ${al.plan}${al.extra ? ` · +${al.extra} ${t.exAiExtra}` : ''}`}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Filtros por tema / urgencia */}
                  <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    {chip('', t.exAll)}
                    {evs.some((e) => e.urgent) && chip('urgent', '⚠ ' + t.exUrgent)}
                    {themesPresent.map((th: string) => chip(th, (THEME_STYLE[th]?.icon || '') + ' ' + (t.themes[th] || th)))}
                  </div>

                  {/* Línea de tiempo (agrupada + acotada) */}
                  <div className="card">
                    {!visible.length && <div className="muted" style={{ fontSize: 13 }}>{t.exNone}</div>}
                    {visible.map((e: any, i: number) => {
                      const st = THEME_STYLE[e.theme] || THEME_STYLE.admin;
                      const many = e.count > 1;
                      return (
                        <div key={i} style={{ borderLeft: `3px solid ${e.urgent ? 'var(--red,#e5484d)' : st.color}`, background: e.urgent ? 'rgba(229,72,77,.08)' : st.bg, borderRadius: '0 8px 8px 0', padding: '8px 10px', marginTop: i ? 6 : 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: e.urgent ? 700 : 500 }}>
                            <span style={{ marginRight: 6 }}>{st.icon}</span>{e.title}
                            {many && <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}> · {e.count} {t.exTimes}</span>}
                            {e.urgent && <span className="pill" style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, background: 'rgba(229,72,77,.18)', color: '#c62f26' }}>URGENTE</span>}
                          </div>
                          {!many && e.detail && <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{e.detail}</div>}
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {many && e.firstTs && e.firstTs !== e.ts
                              ? `${fmtDateTime(e.firstTs, lang)} – ${fmtDateTime(e.ts, lang)}`
                              : (e.ts ? fmtDateTime(e.ts, lang) : '—')}
                          </div>
                        </div>
                      );
                    })}
                    {groups.length > LIMIT && (
                      <div style={{ textAlign: 'center', marginTop: 10 }}>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setTlAll(!tlAll)}>
                          {tlAll ? t.exLess : `${t.exMore} (${groups.length - LIMIT})`}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {!d && tab !== 0 && <div className="muted">…</div>}

        {d && tab === 1 && (
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

        {d && tab === 2 && (
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
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}><OnyxIcon emoji="✉" size={15} />️ {t.write}</div>
              <input placeholder={t.subj} value={subj} onChange={(e) => setSubj(e.target.value)} style={{ margin: 0 }} />
              <textarea placeholder={t.body} value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ width: '100%', marginTop: 8, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={send} disabled={busy || !subj.trim() || !body.trim()}>{busy ? '…' : t.send}</button>
            </div>
          </>
        )}

        {tab === 3 && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}><OnyxIcon emoji="🎁" size={15} /> {t.crT}</div>
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

        {tab === 4 && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}><OnyxIcon emoji="🧾" size={15} /> {t.tabs[4]}</div>
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
                    <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {disputed && p.dueBy && (() => { const n = Math.ceil((new Date(p.dueBy).getTime() - Date.now()) / 864e5); const u = n <= 3; return <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, background: u ? 'rgba(255,69,58,.16)' : 'rgba(255,159,10,.16)', color: u ? '#c62f26' : '#b26a00' }}><OnyxIcon emoji="⏳" size={15} /> {n < 0 ? (lang === 'en' ? 'Overdue' : 'Vencido') : n === 0 ? (lang === 'en' ? 'Today' : 'Hoy') : (lang === 'en' ? `${n}d` : `${n}d`)}</span>; })()}
                      <span className="pill" style={{ fontSize: 11, fontWeight: 700, background: disputed ? 'rgba(255,69,58,.16)' : 'rgba(52,199,120,.14)', color: disputed ? '#c62f26' : '#1f9d57' }}>
                        {disputed ? t.puDisputed : t.puPaid}
                      </span>
                    </div>
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
              <div style={{ fontWeight: 700, marginBottom: 12 }}><OnyxIcon emoji="🎁" size={15} /> {t.crConfT}</div>
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
