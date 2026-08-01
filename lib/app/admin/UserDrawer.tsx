'use client';
import { dictFor } from '@/lib/i18n';
import { toast, toastErr } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { fmtDateTime } from '@/lib/fmtDate';

type Lang = 'es' | 'en';
const T: any = {
  es: { activity: 'Actividad de la cuenta', emails: 'Correos que le envió el sistema', none: 'Sin registros.', noEmails: 'Ningún correo aún.',
    by: 'por', write: 'Escribirle un correo', subj: 'Asunto', body: 'Mensaje', send: 'Enviar correo', sent: 'Correo enviado.', close: 'Cerrar',
    sentS: 'enviado', failed: 'falló', tabs: ['Actividad', 'Correos'],
    act: { plan: 'Cambió el plan', ban: 'Bloqueó la cuenta', unban: 'Desbloqueó la cuenta', admin: 'Cambió rol de admin', delete_user: 'Eliminó la cuenta', email_user: 'Le envió un correo', self_plan: 'Cambió su propio plan' } },
  en: { activity: 'Account activity', emails: 'Emails the system sent them', none: 'No records.', noEmails: 'No emails yet.',
    by: 'by', write: 'Write them an email', subj: 'Subject', body: 'Message', send: 'Send email', sent: 'Email sent.', close: 'Close',
    sentS: 'sent', failed: 'failed', tabs: ['Activity', 'Emails'],
    act: { plan: 'Changed plan', ban: 'Banned account', unban: 'Unbanned account', admin: 'Changed admin role', delete_user: 'Deleted account', email_user: 'Sent an email', self_plan: 'Changed own plan' } },
};

export default function UserDrawer({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const { lang } = useLang() as { lang: Lang };
  const t = dictFor(T, lang);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [subj, setSubj] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000); // auto-refresco de actividad y correos
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => { clearInterval(iv); document.removeEventListener('keydown', esc); };
  }, []);
  async function load() { try { const r = await fetch('/api/admin/user-activity?id=' + userId); setD(await r.json()); } catch { setD({ activity: [], emails: [] }); } }

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
            {(d.activity || []).map((a: any, i: number) => (
              <div key={i} style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '9px 0', fontSize: 13 }}>
                <div>{t.act[a.action] || a.action}{a.meta?.plan ? `: ${a.meta.plan}` : a.meta?.value !== undefined ? `: ${a.meta.value}` : ''}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.by} {a.admin_email || '—'} · {fmtDateTime(a.created_at, lang)}</div>
              </div>
            ))}
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
      </div>
    </div>
  );
}
