'use client';
import { dictFor } from '@/lib/i18n';
import OnyxIcon from '@/app/components/OnyxIcon';
import { toast } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    title: 'Mi reto', sub: 'Mira en vivo si sigues cumpliendo las reglas de tu prop firm.',
    locked: 'Onyx Guardian (incluido en planes superiores) activa tu marcador del reto.',
    none: 'Enciende "Medir mi reto" en una cuenta para ver su marcador.',
    on: 'Medir mi reto', firm: 'Prop firm', phase: 'Fase', ph1: 'Fase 1', ph2: 'Fase 2', phf: 'Fondeada',
    dloss: 'Pérdida diaria', tloss: 'Pérdida máx. total', target: 'Objetivo de ganancia',
    mindays: 'Días mínimos', consist: 'Consistencia (máx % de un día)', base: 'Se mide sobre', reset: 'Hora de reinicio del día',
    weekend: 'Cerrar antes del fin de semana', save: 'Guardar reglas', saved: 'Reglas guardadas',
    baseDSB: 'Balance al inicio del día', baseDSE: 'Equity al inicio del día', baseInit: 'Balance inicial',
    onTrack: 'En camino', watch: 'Vigila', breach: 'Regla rota',
    closest: 'Lo más cerca de romperse', note: 'Estimación según las reglas que cargaste. Confírmalas con tu contrato; no es la norma oficial de la firma. Para BLOQUEAR de verdad, activa los límites en Onyx Guardian.',
    aiRead: 'Pega las reglas y las leo con AI', aiPlaceholder: 'Pega aquí las reglas de tu prop firm (del contrato o de su web) y las convierto en números…', aiBtn: 'Leer con AI', aiDone: 'Reglas leídas — revisa y guarda.',
    editRules: 'Reglas del reto',
    intro: 'Copia los datos de tu contrato. Elige tu firma y te ponemos un punto de partida; ajusta lo que haga falta.',
    secFirm: 'DE QUÉ FIRMA ES', secNums: 'LOS NÚMEROS DE TU RETO',
    hFirm: 'Al elegirla, rellenamos los números por ti.',
    hPhase: 'Fase 1, 2 o ya fondeada. Cambia el objetivo.',
    hBase: 'Base del cálculo. FTMO suele usar el balance al abrir el día.',
    hDloss: 'Lo máximo que puedes perder en un día.',
    hTloss: 'Lo máximo que puedes perder desde el inicio de la cuenta.',
    hTarget: 'Cuánto debes ganar para pasar la fase (0 si ya estás fondeada).',
    hMindays: 'Días que debes operar como mínimo. 0 = sin regla.',
    hConsist: 'Un día no puede ser más de este % de tu ganancia total. 0 = sin regla.',
    hReset: 'Hora del SERVIDOR de tu bróker en que la firma reinicia el día (FTMO 00:00, Topstep 17:00). No es tu hora local.',
    hWeekend: 'Márcalo si tu firma exige no dejar posiciones abiertas el fin de semana.',
    hUnit: '% del balance o dólares',
  },
  en: {
    title: 'My challenge', sub: 'See in real time whether you still meet your prop-firm rules.',
    locked: 'Onyx Guardian (included in higher plans) unlocks your challenge scoreboard.',
    none: 'Turn on "Track my challenge" for an account to see its scoreboard.',
    on: 'Track my challenge', firm: 'Prop firm', phase: 'Phase', ph1: 'Phase 1', ph2: 'Phase 2', phf: 'Funded',
    dloss: 'Daily loss', tloss: 'Max total loss', target: 'Profit target',
    mindays: 'Minimum days', consist: 'Consistency (max % of one day)', base: 'Measured on', reset: 'Day reset hour',
    weekend: 'Flat before weekend', save: 'Save rules', saved: 'Rules saved',
    baseDSB: 'Day-start balance', baseDSE: 'Day-start equity', baseInit: 'Initial balance',
    onTrack: 'On track', watch: 'Watch', breach: 'Rule broken',
    closest: 'Closest to breaking', note: 'Estimate based on the rules you entered. Confirm them with your contract; it is not the firm official rule. To actually BLOCK, enable limits in Onyx Guardian.',
    aiRead: 'Paste the rules and I read them with AI', aiPlaceholder: 'Paste your prop firm rules here (from the contract or their site) and I turn them into numbers…', aiBtn: 'Read with AI', aiDone: 'Rules read — review and save.',
    editRules: 'Challenge rules',
    intro: 'Copy the numbers from your contract. Pick your firm and we prefill a starting point; adjust as needed.',
    secFirm: 'WHICH FIRM IT IS', secNums: 'YOUR CHALLENGE NUMBERS',
    hFirm: 'Picking it prefills the numbers for you.',
    hPhase: 'Phase 1, 2 or funded. Changes the target.',
    hBase: 'What the math is measured on. FTMO usually uses day-start balance.',
    hDloss: 'The most you can lose in a single day.',
    hTloss: 'The most you can lose since the account started.',
    hTarget: 'How much you must gain to pass the phase (0 if already funded).',
    hMindays: 'Minimum days you must trade. 0 = no rule.',
    hConsist: 'A single day cannot be more than this % of your total profit. 0 = no rule.',
    hReset: 'Your broker SERVER hour when the firm resets the day (FTMO 00:00, Topstep 17:00). Not your local time.',
    hWeekend: 'Check it if your firm requires no open positions over the weekend.',
    hUnit: '% of balance or dollars',
  },
};

const STCOL: any = { ok: 'var(--green)', watch: 'var(--amber)', breach: 'var(--red)', na: 'var(--mut)' };

export default function Challenge({ lang }: { lang: Lang }) {
  const L = dictFor(T, lang);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState<any>({});   // account_id -> rules en edición
  const [aiText, setAiText] = useState<any>({});  // account_id -> texto de reglas para el lector AI

  useEffect(() => { load(); }, []);

  // Convierte un File a base64 (sin el prefijo data:).
  function fileToB64(file: File): Promise<{ media_type: string; data: string }> {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => { const s = String(rd.result || ''); resolve({ media_type: file.type || 'application/octet-stream', data: s.slice(s.indexOf(',') + 1) }); };
      rd.onerror = reject; rd.readAsDataURL(file);
    });
  }
  // Adjunta un contrato (foto o PDF) y lo lee con IA para prellenar el reto.
  async function readFile(id: string, file: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast(lang === 'es' ? 'El archivo es muy grande (máx 8 MB).' : 'File too large (max 8 MB).'); return; }
    setBusy('ai' + id);
    try {
      const f = await fileToB64(file);
      await sendParse(id, { file: f, text: String(aiText[id] || '') });
    } catch { toast('Error'); } finally { setBusy(''); }
  }
  // Lee las reglas pegadas con AI y prellena los campos (el trader confirma y guarda).
  async function readRules(id: string) {
    const text = String(aiText[id] || '');
    if (text.trim().length < 15) { toast(L.aiPlaceholder); return; }
    setBusy('ai' + id);
    try { await sendParse(id, { text }); } finally { setBusy(''); }
  }
  // Envía texto y/o archivo a la IA y aplica las reglas (incluida firma y fase).
  async function sendParse(id: string, body: { text?: string; file?: { media_type: string; data: string } }) {
    const r = await fetch('/api/challenge/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, lang }) });
    const j = await r.json();
    if (!r.ok) { toast(j.error || 'Error'); return; }
    const ru = j.rules || {};
    // Firma nueva que la IA añadió al catálogo → la metemos en la lista y la seleccionamos.
    if (j.addedFirm) {
      setData((d: any) => d ? ({ ...d, firms: [...(d.firms || []), j.addedFirm] }) : d);
      toast(lang === 'es' ? `Añadí "${j.addedFirm.name}" al catálogo de firmas.` : `Added "${j.addedFirm.name}" to the firm catalog.`, 'ok');
    } else if (ru.firm) {
      // Firma detectada que ya está en el catálogo → la preselecciona.
      const match = (data?.firms || []).find((x: any) => {
        const n = String(x.name || '').toLowerCase(), en = String(x.name_en || '').toLowerCase(), f = String(ru.firm).toLowerCase();
        return n && (n.includes(f) || f.includes(n) || (en && (en.includes(f) || f.includes(en))));
      });
      if (match) applyFirm(id, match.id);
    }
    setDraft((p: any) => {
      const cur = { ...p[id] };
      const set = (k: string, v: any) => { if (v !== undefined) cur[k] = v; };
      if (j.addedFirm) { cur.firm = j.addedFirm.id; cur.base = j.addedFirm.base; cur.reset_hour = j.addedFirm.reset_hour; }
      set('daily_loss', ru.daily_loss); set('daily_loss_pct', ru.daily_loss_pct);
      set('total_loss', ru.total_loss); set('total_loss_pct', ru.total_loss_pct);
      set('profit_target', ru.profit_target); set('profit_target_pct', ru.profit_target_pct);
      set('min_days', ru.min_days); set('consistency', ru.consistency);
      set('no_weekend_hold', ru.weekend_flat);
      // Fase detectada: p1→'1', p2→'2', funded→'funded'
      if (ru.phase) set('phase', ru.phase === 'p1' ? '1' : ru.phase === 'p2' ? '2' : 'funded');
      return { ...p, [id]: cur };
    });
    toast(L.aiDone, 'ok');
  }
  async function load() {
    try {
      const r = await fetch('/api/challenge'); const j = await r.json();
      setData(j);
      const d: any = {};
      (j.accounts || []).forEach((a: any) => { d[a.id] = { ...a.rules }; });
      setDraft(d);
    } catch { setData({ boards: [], accounts: [] }); }
  }
  const boardFor = (id: string) => (data?.boards || []).find((b: any) => b.accountId === id);

  function applyFirm(id: string, firmId: string) {
    const f = (data?.firms || []).find((x: any) => x.id === firmId);
    setDraft((p: any) => ({ ...p, [id]: {
      ...p[id], firm: firmId,
      ...(f ? { daily_loss: f.daily_loss, daily_loss_pct: true, total_loss: f.total_loss, total_loss_pct: true,
        base: f.base, reset_hour: f.reset_hour, profit_target: f.profit_target, profit_target_pct: true,
        min_days: f.min_days, consistency: f.consistency } : {}),
    } }));
  }
  function setF(id: string, k: string, v: any) { setDraft((p: any) => ({ ...p, [id]: { ...p[id], [k]: v } })); }

  async function save(id: string) {
    setBusy(id);
    const r = await fetch('/api/challenge', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_id: id, ...draft[id] }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    toast(L.saved, 'ok'); load();
  }

  if (!data) return <div className="card muted">…</div>;
  if (data.locked || data.code === 'no_plan') {
    return <div style={{ maxWidth: 820, margin: '0 auto' }}><div className="card muted" style={{ textAlign: 'center', padding: 28 }}>🔒 {L.locked}</div></div>;
  }

  const lbl = { fontSize: 12.5, color: 'var(--tx)', display: 'block', marginBottom: 3 } as any;
  const hint = (txt: string) => <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, lineHeight: 1.35 }}>{txt}</div>;
  const grp = { fontSize: 10.5, letterSpacing: '.4px', color: '#6f7c96', textTransform: 'uppercase', margin: '16px 0 8px' } as any;
  const unitSel = (id: string, key: string) => (
    <select value={draft[id]?.[key] ? '%' : '$'} onChange={(e) => setF(id, key, e.target.value === '%')} style={{ margin: 0, width: 58, padding: '6px 4px' }}>
      <option value="%">%</option><option value="$">$</option>
    </select>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <span style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 13, background: 'rgba(124,140,255,.16)', alignItems: 'center', justifyContent: 'center', fontSize: 21, marginBottom: 8 }}>🏁</span>
        <h2 style={{ fontSize: 20, marginBottom: 2 }}>{L.title}</h2>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{L.sub}</p>
      </div>

      {!data.accounts?.length && <div className="card muted">{L.none}</div>}

      {(data.accounts || []).map((a: any) => {
        const d = draft[a.id] || {};
        const board = boardFor(a.id);
        const vpill = board ? (board.verdict === 'breach' ? { t: L.breach, c: 'var(--red)', bg: 'rgba(255,107,125,.15)' }
          : board.verdict === 'watch' ? { t: L.watch, c: 'var(--amber)', bg: 'rgba(255,192,77,.15)' }
          : { t: L.onTrack, c: 'var(--green)', bg: 'rgba(52,226,160,.15)' }) : null;
        return (
          <div key={a.id} className="card">
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <b style={{ fontSize: 15 }}>{a.name} <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>· #{a.login}</span></b>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                {vpill && <span className="pill" style={{ color: vpill.c, background: vpill.bg }}>{vpill.t}</span>}
                <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={!!d.on} onChange={(e) => setF(a.id, 'on', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {L.on}
                </label>
              </div>
            </div>

            {/* Marcador en vivo */}
            {board && board.rules?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {board.rules.map((r: any) => (
                  <div key={r.key}>
                    <div className="row between" style={{ fontSize: 13, marginBottom: 4 }}>
                      <span>{lang === 'es' ? r.es : r.en}</span>
                      <span style={{ color: STCOL[r.status] }}>{lang === 'es' ? r.valEs : r.valEn}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 20, overflow: 'hidden' }}>
                      <div style={{ width: Math.max(0, Math.min(100, r.pct)) + '%', height: '100%', background: STCOL[r.status], borderRadius: 20, boxShadow: `0 0 10px -2px color-mix(in srgb, ${STCOL[r.status]} 70%, transparent)` }} />
                    </div>
                  </div>
                ))}
                {board.closest && board.verdict !== 'on_track' && (
                  <div style={{ fontSize: 12.5, color: 'var(--amber)' }}>🔥 {L.closest}: {lang === 'es' ? board.closest.es : board.closest.en}</div>
                )}
              </div>
            )}

            {/* Editor de reglas */}
            {d.on && (
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
                <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid rgba(124,140,255,.25)', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, color: 'var(--soft-brand)', lineHeight: 1.4 }}>ℹ️ {L.intro}</div>

                {/* Lector de reglas con AI */}
                <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                  <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>✨ {L.aiRead}</div>
                  {/* Adjuntar contrato: foto o PDF. La IA lo lee igual que el texto. */}
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed rgba(124,140,255,.5)', borderRadius: 10, padding: '13px', cursor: busy === 'ai' + a.id ? 'default' : 'pointer', fontSize: 12.5, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.06)', marginBottom: 8 }}>
                    <OnyxIcon emoji="📎" size={15} /> {busy === 'ai' + a.id ? (lang === 'es' ? 'Leyendo…' : 'Reading…') : (lang === 'es' ? 'Adjuntar contrato (foto o PDF)' : 'Attach contract (photo or PDF)')}
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={busy === 'ai' + a.id}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(a.id, f); e.currentTarget.value = ''; }} />
                  </label>
                  <div className="muted" style={{ fontSize: 11, textAlign: 'center', margin: '2px 0 8px' }}>{lang === 'es' ? '— o pega el texto —' : '— or paste the text —'}</div>
                  <textarea value={aiText[a.id] || ''} maxLength={30000} onChange={(e) => setAiText((p: any) => ({ ...p, [a.id]: e.target.value }))} placeholder={L.aiPlaceholder}
                    style={{ width: '100%', minHeight: 70, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                  <div className="row between" style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => readRules(a.id)} disabled={busy === 'ai' + a.id}>{busy === 'ai' + a.id ? '…' : '✨ ' + L.aiBtn}</button>
                    <span className="muted" style={{ fontSize: 11 }}>{(aiText[a.id] || '').length} / 30.000</span>
                  </div>
                </div>

                <div style={grp}>{L.secFirm}</div>
                <div className="grid g3" style={{ gap: 12 }}>
                  <div>
                    <span style={lbl}>{L.firm}</span>
                    <select value={d.firm || 'custom'} onChange={(e) => applyFirm(a.id, e.target.value)} style={{ margin: 0 }}>
                      {(data.firms || []).map((f: any) => <option key={f.id} value={f.id}>{lang === 'es' ? f.name : (f.name_en || f.name)}</option>)}
                    </select>
                    {hint(L.hFirm)}
                  </div>
                  <div>
                    <span style={lbl}>{L.phase}</span>
                    <select value={d.phase || '1'} onChange={(e) => setF(a.id, 'phase', e.target.value)} style={{ margin: 0 }}>
                      <option value="1">{L.ph1}</option><option value="2">{L.ph2}</option><option value="funded">{L.phf}</option>
                    </select>
                    {hint(L.hPhase)}
                  </div>
                  <div>
                    <span style={lbl}>{L.base}</span>
                    <select value={d.base || 'day_start_balance'} onChange={(e) => setF(a.id, 'base', e.target.value)} style={{ margin: 0 }}>
                      <option value="day_start_balance">{L.baseDSB}</option>
                      <option value="day_start_equity">{L.baseDSE}</option>
                      <option value="initial_balance">{L.baseInit}</option>
                    </select>
                    {hint(L.hBase)}
                  </div>
                </div>

                <div style={grp}>{L.secNums}</div>
                <div className="grid g3" style={{ gap: 12 }}>
                  <div>
                    <span style={lbl}>{L.dloss}</span>
                    <div className="row" style={{ gap: 6 }}><input type="number" value={d.daily_loss ?? 0} onChange={(e) => setF(a.id, 'daily_loss', Number(e.target.value))} style={{ margin: 0 }} />{unitSel(a.id, 'daily_loss_pct')}</div>
                    {hint(L.hDloss)}
                  </div>
                  <div>
                    <span style={lbl}>{L.tloss}</span>
                    <div className="row" style={{ gap: 6 }}><input type="number" value={d.total_loss ?? 0} onChange={(e) => setF(a.id, 'total_loss', Number(e.target.value))} style={{ margin: 0 }} />{unitSel(a.id, 'total_loss_pct')}</div>
                    {hint(L.hTloss)}
                  </div>
                  <div>
                    <span style={lbl}>{L.target}</span>
                    <div className="row" style={{ gap: 6 }}><input type="number" value={d.profit_target ?? 0} onChange={(e) => setF(a.id, 'profit_target', Number(e.target.value))} style={{ margin: 0 }} />{unitSel(a.id, 'profit_target_pct')}</div>
                    {hint(L.hTarget)}
                  </div>
                  <div>
                    <span style={lbl}>{L.mindays}</span>
                    <input type="number" value={d.min_days ?? 0} onChange={(e) => setF(a.id, 'min_days', Number(e.target.value))} style={{ margin: 0 }} />
                    {hint(L.hMindays)}
                  </div>
                  <div>
                    <span style={lbl}>{L.consist}</span>
                    <input type="number" value={d.consistency ?? 0} onChange={(e) => setF(a.id, 'consistency', Number(e.target.value))} style={{ margin: 0 }} />
                    {hint(L.hConsist)}
                  </div>
                  <div>
                    <span style={lbl}>{L.reset}</span>
                    <select value={d.reset_hour ?? 0} onChange={(e) => setF(a.id, 'reset_hour', Number(e.target.value))} style={{ margin: 0 }}>
                      {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                    {hint(L.hReset)}
                  </div>
                </div>

                <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={!!d.no_weekend_hold} onChange={(e) => setF(a.id, 'no_weekend_hold', e.target.checked)} style={{ width: 'auto', margin: '2px 0 0' }} />
                  <span>{L.weekend}<span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 1 }}>{L.hWeekend}</span></span>
                </label>
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={() => save(a.id)} disabled={busy === a.id}>{busy === a.id ? '…' : L.save}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, textAlign: 'center' }}>ℹ️ {L.note}</p>
    </div>
  );
}
