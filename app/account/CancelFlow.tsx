'use client';
import { useState } from 'react';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const C: any = {
  es: {
    open: 'Cancelar suscripción',
    q: 'Antes de irte, ¿qué pasó?', qd: 'Tu respuesta nos ayuda a mejorar y quizá podamos arreglarlo.',
    r: { price: 'Es muy caro para mí', unused: 'No lo estoy usando', missing: 'Le falta algo que necesito', stopped: 'Dejé de operar por ahora', other: 'Otro motivo' },
    detail: 'Cuéntanos más (opcional)', next: 'Continuar', back: 'Volver', close: 'Cerrar',
    offT: 'Espera, tenemos algo para ti',
    dT: 'Quédate con {p}% de descuento', dD: 'Los próximos {m} meses pagas menos. Se aplica solo, no tienes que hacer nada más.', dBtn: 'Acepto el descuento',
    pT: 'Pausa {m} meses', pD: 'No te cobramos durante ese tiempo y tus datos se quedan intactos. Vuelve cuando quieras operar de nuevo.', pBtn: 'Pausar mi plan',
    gT: 'Baja a {n}', gD: 'Pagas menos y sigues teniendo lo esencial.', gBtn: 'Cambiar a {n}',
    anyway: 'Cancelar igualmente',
    okD: '¡Listo! Tu descuento ya está aplicado. Lo verás en tu próxima factura.',
    okP: 'Tu plan está en pausa. No te cobraremos hasta que vuelva a activarse.',
    okG: 'Plan cambiado. El ajuste se refleja en tu próxima factura.',
    okC: 'Tu suscripción se cancelará al final del periodo. Mantienes el acceso hasta entonces y no perderás tu historial.',
    conf: '¿Seguro que quieres cancelar? Perderás el acceso a las funciones de tu plan al final del periodo.',
    resume: 'Reactivar mi suscripción', resumeOk: 'Suscripción reactivada.',
    canceling: 'Tu suscripción está programada para cancelarse.',
  },
  en: {
    open: 'Cancel subscription',
    q: 'Before you go, what happened?', qd: 'Your answer helps us improve, and we might be able to fix it.',
    r: { price: 'It is too expensive for me', unused: 'I am not using it', missing: 'It is missing something I need', stopped: 'I stopped trading for now', other: 'Other reason' },
    detail: 'Tell us more (optional)', next: 'Continue', back: 'Back', close: 'Close',
    offT: 'Wait, we have something for you',
    dT: 'Stay with {p}% off', dD: 'You pay less for the next {m} months. Applied automatically, nothing else to do.', dBtn: 'I accept the discount',
    pT: 'Pause for {m} months', pD: 'We stop charging you and your data stays intact. Come back whenever you trade again.', pBtn: 'Pause my plan',
    gT: 'Switch to {n}', gD: 'You pay less and keep the essentials.', gBtn: 'Switch to {n}',
    anyway: 'Cancel anyway',
    okD: 'Done! Your discount is applied. You will see it on your next invoice.',
    okP: 'Your plan is paused. We will not charge you until it resumes.',
    okG: 'Plan changed. The adjustment shows on your next invoice.',
    okC: 'Your subscription will cancel at the end of the period. You keep access until then and will not lose your history.',
    conf: 'Are you sure? You will lose your plan features at the end of the period.',
    resume: 'Reactivate my subscription', resumeOk: 'Subscription reactivated.',
    canceling: 'Your subscription is scheduled to cancel.',
  },
};

export default function CancelFlow({ lang, canceling, planName, onDone }: { lang: Lang; canceling: boolean; planName: string; onDone: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [id, setId] = useState('');
  const [s, setS] = useState<any>({});
  const [downs, setDowns] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');
  const t = C[lang];
  const fill = (txt: string, m: any) => Object.keys(m).reduce((x, k) => x.replace(`{${k}}`, m[k]), txt);

  async function call(body: any) {
    setBusy(body.action);
    const r = await fetch('/api/account/cancel', { method: 'POST', body: JSON.stringify(body) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return null; }
    return j;
  }

  async function sendReason() {
    if (!reason) return;
    const j = await call({ action: 'reason', reason, detail });
    if (!j) return;
    setId(j.id); setS(j.settings || {}); setDowns(j.downgrades || []);
    setStep(2);
  }
  async function accept(action: string, plan?: string) {
    const j = await call({ action, id, plan, reason });
    if (!j) return;
    setDone(action === 'discount' ? t.okD : action === 'pause' ? t.okP : action === 'downgrade' ? t.okG : t.okC);
    setStep(3);
  }
  async function resume() {
    const j = await call({ action: 'resume' });
    if (!j) return;
    alert(t.resumeOk); onDone();
  }

  // Ya está cancelando: solo ofrecemos reactivar
  if (canceling) {
    return (
      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.canceling}</div>
        <button className="btn btn-primary" onClick={resume} disabled={busy === 'resume'}>{busy === 'resume' ? '...' : t.resume}</button>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, color: 'var(--mut)' }} onClick={() => setStep(1)}>{t.open}</button>
      </div>
    );
  }

  const cardIn = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginTop: 14 } as any;
  const opt = (k: string) => ({
    border: '1px solid ' + (reason === k ? 'var(--brand)' : 'var(--line)'),
    background: reason === k ? 'rgba(124,140,255,.12)' : 'transparent',
    borderRadius: 10, padding: '10px 12px', fontSize: 14, cursor: 'pointer', marginBottom: 8,
  } as any);

  return (
    <div style={cardIn}>
      {step === 1 && (
        <>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{t.q}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.qd}</div>
          {Object.keys(t.r).map((k) => (
            <div key={k} style={opt(k)} onClick={() => setReason(k)}>{t.r[k]}</div>
          ))}
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder={t.detail}
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={sendReason} disabled={!reason || busy === 'reason'}>{busy === 'reason' ? '...' : t.next}</button>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>{t.back}</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>{t.offT}</div>

          {(reason === 'price' || reason === 'other') && Number(s.discount_percent) > 0 && (
            <div className="card" style={{ marginBottom: 10, border: '1px solid var(--brand)' }}>
              <div style={{ fontWeight: 700 }}>{fill(t.dT, { p: s.discount_percent })}</div>
              <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{fill(t.dD, { m: s.discount_months })}</p>
              <button className="btn btn-primary" onClick={() => accept('discount')} disabled={busy === 'discount'}>{busy === 'discount' ? '...' : t.dBtn}</button>
            </div>
          )}

          {(reason === 'unused' || reason === 'stopped' || reason === 'missing' || reason === 'other') && Number(s.pause_months) > 0 && (
            <div className="card" style={{ marginBottom: 10, border: '1px solid var(--green)' }}>
              <div style={{ fontWeight: 700 }}>{fill(t.pT, { m: s.pause_months })}</div>
              <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{fill(t.pD, { m: s.pause_months })}</p>
              <button className="btn btn-primary" onClick={() => accept('pause')} disabled={busy === 'pause'}>{busy === 'pause' ? '...' : t.pBtn}</button>
            </div>
          )}

          {s.allow_downgrade && downs.map((p) => (
            <div key={p.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{fill(t.gT, { n: lang === 'en' ? (p.name_en || p.name) : p.name })} · ${p.price_month}</div>
              <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{t.gD}</p>
              <button className="btn btn-ghost" onClick={() => accept('downgrade', p.id)} disabled={busy === 'downgrade'}>{fill(t.gBtn, { n: lang === 'en' ? (p.name_en || p.name) : p.name })}</button>
            </div>
          ))}

          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={() => { if (confirm(t.conf)) accept('cancel'); }} disabled={busy === 'cancel'}>{busy === 'cancel' ? '...' : t.anyway}</button>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>{t.back}</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ fontSize: 26, marginBottom: 6 }}>✅</div>
          <p style={{ fontSize: 15, marginBottom: 12 }}>{done}</p>
          <button className="btn btn-primary" onClick={() => { setStep(0); onDone(); }}>{t.close}</button>
        </>
      )}
    </div>
  );
}
