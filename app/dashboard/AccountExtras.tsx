'use client';
import { useEffect, useRef, useState } from 'react';
import { ACC_TYPES, CH_STATUS, typeMeta, money2, type Lang } from '@/lib/accountMeta';

const A = {
  es: {
    settings: '⚙️ Ajustes de la cuenta', type: 'Tipo de cuenta', status: 'Estado del challenge', cost: 'Coste del challenge ($)', save: 'Guardar', saved: '✓ Guardado', pick: 'Elegir…',
    benefit: '💵 Beneficio real de la cuenta', profit: 'Profit (operaciones)', totalPaid: 'Total cobrado', chCost: 'Coste challenge', realBenefit: 'Beneficio real', roiNote: 'Beneficio real = total cobrado − coste del challenge',
    payouts: '🏦 Retiros / pagos', addPayout: '+ Añadir retiro', amount: 'Importe ($)', date: 'Fecha', note: 'Nota', receipt: 'Comprobante (opcional)', add: 'Añadir', noPayouts: 'Aún no has registrado retiros.', del: 'Borrar', view: 'Ver',
    docs: '📜 Documentos y certificados', addDoc: '+ Subir documento', docType: 'Tipo', title: 'Título', upload: 'Subir', uploading: 'Subiendo…', noDocs: 'Sin documentos. Sube tu certificado de challenge o comprobantes.',
    dtypes: [['certificate', 'Certificado'], ['payout', 'Comprobante de pago'], ['invoice', 'Factura'], ['kyc', 'KYC'], ['other', 'Otro']],
    self: 'Documentos aportados por ti (no verificados por Onyx).',
  },
  en: {
    settings: '⚙️ Account settings', type: 'Account type', status: 'Challenge status', cost: 'Challenge cost ($)', save: 'Save', saved: '✓ Saved', pick: 'Choose…',
    benefit: '💵 Real account benefit', profit: 'Profit (trades)', totalPaid: 'Total paid out', chCost: 'Challenge cost', realBenefit: 'Real benefit', roiNote: 'Real benefit = total paid out − challenge cost',
    payouts: '🏦 Payouts', addPayout: '+ Add payout', amount: 'Amount ($)', date: 'Date', note: 'Note', receipt: 'Receipt (optional)', add: 'Add', noPayouts: 'No payouts logged yet.', del: 'Delete', view: 'View',
    docs: '📜 Documents & certificates', addDoc: '+ Upload document', docType: 'Type', title: 'Title', upload: 'Upload', uploading: 'Uploading…', noDocs: 'No documents. Upload your challenge certificate or receipts.',
    dtypes: [['certificate', 'Certificate'], ['payout', 'Payout receipt'], ['invoice', 'Invoice'], ['kyc', 'KYC'], ['other', 'Other']],
    self: 'Documents provided by you (not verified by Onyx).',
  },
};

export default function AccountExtras({ acc, net, lang, onSaved }: { acc: any; net: number; lang: Lang; onSaved: (f: any) => void }) {
  const t = A[lang];
  const [payouts, setPayouts] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);

  // ajustes
  const [f, setF] = useState<any>({ acc_type: acc.acc_type || '', challenge_status: acc.challenge_status || '', challenge_cost: acc.challenge_cost ?? '' });
  const [savingS, setSavingS] = useState(false); const [okS, setOkS] = useState(false);
  useEffect(() => { setF({ acc_type: acc.acc_type || '', challenge_status: acc.challenge_status || '', challenge_cost: acc.challenge_cost ?? '' }); }, [acc.id]);

  // nuevo retiro
  const [pAmt, setPAmt] = useState(''); const [pDate, setPDate] = useState(''); const [pNote, setPNote] = useState(''); const [pBusy, setPBusy] = useState(false);
  const pFile = useRef<HTMLInputElement>(null);
  // nuevo documento
  const [dType, setDType] = useState('certificate'); const [dTitle, setDTitle] = useState(''); const [dBusy, setDBusy] = useState(false);
  const dFile = useRef<HTMLInputElement>(null);

  async function loadPayouts() { const r = await fetch('/api/payouts'); const j = await r.json(); setPayouts((j.payouts || []).filter((x: any) => x.account_id === acc.id)); }
  async function loadDocs() { const r = await fetch('/api/documents'); const j = await r.json(); setDocs((j.documents || []).filter((x: any) => x.account_id === acc.id)); }
  useEffect(() => { loadPayouts(); loadDocs(); }, [acc.id]);

  async function saveSettings() {
    setSavingS(true);
    await fetch('/api/accounts', { method: 'PATCH', body: JSON.stringify({ id: acc.id, ...f }) });
    setSavingS(false); setOkS(true); setTimeout(() => setOkS(false), 1500); onSaved(f);
  }
  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd }); const j = await r.json();
    if (!j.url) throw new Error(j.error || 'error'); return j.url;
  }
  async function addPayout() {
    setPBusy(true);
    try {
      let receipt = ''; const file = pFile.current?.files?.[0]; if (file) receipt = await uploadFile(file);
      await fetch('/api/payouts', { method: 'POST', body: JSON.stringify({ account_id: acc.id, amount: pAmt, date: pDate || null, note: pNote, receipt_url: receipt }) });
      setPAmt(''); setPDate(''); setPNote(''); if (pFile.current) pFile.current.value = ''; await loadPayouts();
    } catch (e: any) { alert(e.message); }
    setPBusy(false);
  }
  async function delPayout(id: string) { await fetch('/api/payouts', { method: 'DELETE', body: JSON.stringify({ id }) }); await loadPayouts(); }
  async function addDoc() {
    const file = dFile.current?.files?.[0]; if (!file) return;
    setDBusy(true);
    try {
      const url = await uploadFile(file);
      await fetch('/api/documents', { method: 'POST', body: JSON.stringify({ account_id: acc.id, doc_type: dType, title: dTitle, image_url: url }) });
      setDTitle(''); if (dFile.current) dFile.current.value = ''; await loadDocs();
    } catch (e: any) { alert(e.message); }
    setDBusy(false);
  }
  async function delDoc(id: string) { await fetch('/api/documents', { method: 'DELETE', body: JSON.stringify({ id }) }); await loadDocs(); }

  const totalPaid = payouts.reduce((s, x) => s + (+x.amount || 0), 0);
  const chCost = Number(acc.challenge_cost) || 0;
  const realBenefit = totalPaid - chCost;
  const isChallenge = f.acc_type === 'challenge';
  const inp = { margin: 0, padding: '8px 10px' } as any;
  const lbl = { fontSize: 12, color: 'var(--mut)', margin: '0 0 4px', display: 'block' } as any;
  const kpi = { background: 'var(--bg2)', borderRadius: 10, padding: 12, textAlign: 'center' as const };

  return (
    <>
      {/* Ajustes */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t.settings}</h3>
        <div className="grid g3">
          <div><span style={lbl}>{t.type}</span>
            <select value={f.acc_type} onChange={(e) => setF({ ...f, acc_type: e.target.value })} style={inp}>
              <option value="">{t.pick}</option>
              {ACC_TYPES.map((x) => <option key={x.key} value={x.key}>{lang === 'es' ? x.es : x.en}</option>)}
            </select>
          </div>
          {isChallenge && <div><span style={lbl}>{t.status}</span>
            <select value={f.challenge_status} onChange={(e) => setF({ ...f, challenge_status: e.target.value })} style={inp}>
              <option value="">{t.pick}</option>
              {CH_STATUS.map((x) => <option key={x.key} value={x.key}>{lang === 'es' ? x.es : x.en}</option>)}
            </select>
          </div>}
          <div><span style={lbl}>{t.cost}</span><input type="number" value={f.challenge_cost} onChange={(e) => setF({ ...f, challenge_cost: e.target.value })} style={inp} /></div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveSettings} disabled={savingS}>{savingS ? '...' : (okS ? t.saved : t.save)}</button>
      </div>

      {/* Beneficio real */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t.benefit}</h3>
        <div className="grid g4">
          <div style={kpi}><div className="muted" style={{ fontSize: 12 }}>{t.profit}</div><div className={net >= 0 ? 'pos' : 'neg'} style={{ fontSize: 20, fontWeight: 800 }}>{money2(net)}</div></div>
          <div style={kpi}><div className="muted" style={{ fontSize: 12 }}>{t.totalPaid}</div><div className="pos" style={{ fontSize: 20, fontWeight: 800 }}>{money2(totalPaid)}</div></div>
          <div style={kpi}><div className="muted" style={{ fontSize: 12 }}>{t.chCost}</div><div style={{ fontSize: 20, fontWeight: 800, color: chCost ? 'var(--red)' : 'var(--mut)' }}>{chCost ? money2(-chCost) : '—'}</div></div>
          <div style={{ ...kpi, border: '1px solid ' + (realBenefit >= 0 ? 'var(--green)' : 'var(--red)') }}><div className="muted" style={{ fontSize: 12 }}>{t.realBenefit}</div><div className={realBenefit >= 0 ? 'pos' : 'neg'} style={{ fontSize: 20, fontWeight: 800 }}>{money2(realBenefit)}</div></div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t.roiNote}</p>
      </div>

      {/* Retiros */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t.payouts}</h3>
        {payouts.length ? (
          <table style={{ marginBottom: 14 }}><thead><tr><th>{t.date}</th><th style={{ textAlign: 'right' }}>{t.amount}</th><th>{t.note}</th><th></th><th></th></tr></thead>
            <tbody>{payouts.map((x) => (
              <tr key={x.id}>
                <td className="muted">{x.date || '—'}</td>
                <td style={{ textAlign: 'right' }} className="pos">{money2(+x.amount)}</td>
                <td className="muted">{x.note || ''}</td>
                <td>{x.receipt_url ? <a href={x.receipt_url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }}>{t.view}</a> : ''}</td>
                <td><button className="btn btn-danger" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => delPayout(x.id)}>🗑</button></td>
              </tr>))}</tbody>
          </table>
        ) : <p className="muted" style={{ marginBottom: 14 }}>{t.noPayouts}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="number" placeholder={t.amount} value={pAmt} onChange={(e) => setPAmt(e.target.value)} style={{ ...inp, width: 130 }} />
          <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} style={{ ...inp, width: 'auto' }} />
          <input placeholder={t.note} value={pNote} onChange={(e) => setPNote(e.target.value)} style={{ ...inp, width: 160 }} />
          <input ref={pFile} type="file" accept="image/*" style={{ fontSize: 12, width: 'auto', margin: 0, padding: 0, background: 'none', border: 'none' }} title={t.receipt} />
          <button className="btn btn-primary" onClick={addPayout} disabled={pBusy || !pAmt}>{pBusy ? '...' : t.add}</button>
        </div>
      </div>

      {/* Documentos */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>{t.docs}</h3>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t.self}</p>
        {docs.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
            {docs.map((d) => (
              <div key={d.id} style={{ background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <a href={d.image_url} target="_blank" rel="noreferrer"><img src={d.image_url} alt={d.title || 'doc'} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} /></a>
                <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{d.title || (t.dtypes.find((x) => x[0] === d.doc_type)?.[1]) || d.doc_type}</span>
                  <button className="btn btn-danger" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => delDoc(d.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="muted" style={{ marginBottom: 14 }}>{t.noDocs}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={dType} onChange={(e) => setDType(e.target.value)} style={{ ...inp, width: 'auto' }}>{t.dtypes.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input placeholder={t.title} value={dTitle} onChange={(e) => setDTitle(e.target.value)} style={{ ...inp, width: 160 }} />
          <input ref={dFile} type="file" accept="image/*" style={{ fontSize: 12, width: 'auto', margin: 0, padding: 0, background: 'none', border: 'none' }} />
          <button className="btn btn-primary" onClick={addDoc} disabled={dBusy}>{dBusy ? t.uploading : t.upload}</button>
        </div>
      </div>
    </>
  );
}
