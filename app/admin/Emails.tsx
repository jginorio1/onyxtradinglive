'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { useT } from '@/lib/adminText';
import { fmtDateTime } from '@/lib/fmtDate';

export default function Emails() {
  const { lang } = useLang();
  const t = useT();
  const es = lang === 'es';
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState('');

  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [q]);
  async function load() {
    try { const r = await fetch('/api/admin/emails' + (q ? '?q=' + encodeURIComponent(q) : '')); setD(await r.json()); } catch { setD({ emails: [] }); }
  }

  const kindLabel: any = { billing: es ? 'Cobro' : 'Billing', admin: es ? 'Manual' : 'Manual', support: es ? 'Soporte' : 'Support', challenge: es ? 'Reto' : 'Challenge' };

  return (
    <>
      <div className="tabhead"><div className="th-row"><span className="th-ic">✉️</span><span className="th-t">{t.h_correos_t}</span></div><div className="th-s">{t.h_correos_s}</div></div>
      <div className="card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <span className="muted" style={{ fontSize: 13 }}>{d ? `${d.total ?? 0} ${es ? 'enviados en total' : 'sent in total'}` : '…'}</span>
          <input placeholder={es ? 'Buscar correo o asunto…' : 'Search email or subject…'} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, margin: 0 }} />
        </div>
        {!d && <div className="muted">…</div>}
        {d && !d.emails?.length && <div className="muted" style={{ fontSize: 13 }}>{es ? 'Aún no hay correos registrados. Se llenará con cada envío del sistema.' : 'No emails yet. It fills up with each system send.'}</div>}
        {d && !!d.emails?.length && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>{es ? 'Para' : 'To'}</th><th>{es ? 'Asunto' : 'Subject'}</th><th>{es ? 'Tipo' : 'Type'}</th><th>{es ? 'Estado' : 'Status'}</th><th>{es ? 'Fecha' : 'Date'}</th></tr></thead>
              <tbody>
                {d.emails.map((e: any, i: number) => (
                  <tr key={i}>
                    <td>{e.to_email}</td>
                    <td>{e.subject || '—'}</td>
                    <td className="muted">{kindLabel[e.kind] || e.kind || '—'}</td>
                    <td><span className="pill" style={{ color: e.status === 'sent' ? 'var(--green)' : 'var(--red)', background: e.status === 'sent' ? 'rgba(52,226,160,.15)' : 'rgba(255,107,125,.15)' }}>{e.status === 'sent' ? (es ? 'Enviado' : 'Sent') : (es ? 'Falló' : 'Failed')}</span></td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
