'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast } from '@/lib/toast';
import CopyEarningsCalc from '@/app/copy/CopyEarningsCalc';
import OnyxIcon from '@/app/components/OnyxIcon';

type Lang = 'es' | 'en';
const TIERC: Record<string, string> = { diamond: '#378ADD', gold: 'var(--gold)', silver: '#9aa0ac', none: 'var(--mut)' };

function money(cents: number) { return '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Banderas anti-gaming explicadas en lenguaje simple (para el trader).
const FLAG_INFO: Record<string, { es: [string, string]; en: [string, string] }> = {
  small_sample: { es: ['Muestra pequeña', 'Menos de 20 operaciones: aún no hay datos suficientes para confiar. Se limpia sola al operar más.'], en: ['Small sample', 'Fewer than 20 trades: not enough data to trust yet. It clears on its own as you trade more.'] },
  single_day: { es: ['Un día domina', 'Una sola jornada concentra gran parte de la ganancia. Reparte tus resultados en varios días.'], en: ['One day dominates', 'A single day holds most of the profit. Spread your results across more days.'] },
  martingale: { es: ['Posible martingala', 'Win rate muy alto con una relación riesgo/beneficio muy baja. Sube tu R:R.'], en: ['Possible martingale', 'Very high win rate with a tiny risk/reward. Raise your R:R.'] },
  huge_loss: { es: ['Pérdida atroz', 'Tu peor pérdida es enorme frente a tu ganancia media. Respeta tu stop.'], en: ['Huge loss', 'Your worst loss is huge vs your average win. Respect your stop.'] },
};
const tierName = (t: string, es: boolean) => t === 'silver' ? 'Onyx Silver' : t === 'gold' ? 'Onyx Gold' : t === 'diamond' ? 'Onyx Diamond' : (es ? 'calificar' : 'qualify');

// Sugerencias deterministas: se arman de los requisitos que faltan + banderas.
function buildSug(prov: any, es: boolean): string[] {
  const out: string[] = [];
  const reqs = prov?.qualify?.reqs || [];
  const miss = (k: string) => reqs.find((r: any) => r.key === k && !r.ok);
  const mt = miss('trades'), md = miss('days');
  if (mt || md) {
    const parts: string[] = [];
    if (mt) parts.push(`${mt.req - mt.cur} ${es ? 'operaciones' : 'trades'}`);
    if (md) parts.push(`${md.req - md.cur} ${es ? 'días' : 'days'}`);
    out.push(es ? `Sigue operando tu plan: te faltan ${parts.join(' y ')}.` : `Keep trading your plan: you need ${parts.join(' and ')} more.`);
  }
  if (miss('score')) out.push(es ? 'Documenta cada trade en el Diario y cumple tu plan — sube tu Onyx Score.' : 'Journal every trade and follow your plan — it lifts your Onyx Score.');
  if (miss('dd')) out.push(es ? 'Baja tu drawdown: reduce lotes y respeta tu stop.' : 'Lower your drawdown: cut lot size and respect your stop.');
  if (miss('pf')) out.push(es ? 'Sube tu profit factor: corta pérdidas antes y deja correr las ganancias.' : 'Raise your profit factor: cut losers sooner, let winners run.');
  if (miss('verified')) out.push(es ? 'Verifica tu cuenta (súbela abajo) para acceder a Gold y Diamond.' : 'Verify your account (upload it below) to reach Gold and Diamond.');
  if ((prov?.flags || []).includes('single_day')) out.push(es ? 'Evita concentrar la ganancia en un solo día para quitar esa bandera.' : 'Avoid putting all profit in one day to clear that flag.');
  if (!out.length) out.push(es ? 'Vas bien. Mantén la constancia para asegurar el siguiente nivel.' : 'You are on track. Keep it steady to lock the next tier.');
  return out.slice(0, 4);
}

export default function OnyxCopyHub() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [tab, setTab] = useState<'copy' | 'mine' | 'trader'>('copy');
  const [providers, setProviders] = useState<any[]>([]);
  const [follows, setFollows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [myProviders, setMyProviders] = useState<any[]>([]);
  const [connect, setConnect] = useState<any>({ connected: false, chargesEnabled: false });
  const [openQual, setOpenQual] = useState<string | null>(null);
  const [perfEnabled, setPerfEnabled] = useState(false);
  const [feePct, setFeePct] = useState(30);
  const [earnings, setEarnings] = useState<any>({ totals: { net_cents: 0, gross_cents: 0, fee_cents: 0 }, recent: [] });
  const [cfg, setCfg] = useState<any>(null);      // proveedor que se está por copiar
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState('');  // account_id en verificación
  const [block, setBlock] = useState<any>(null);   // popup: cuenta ya ocupada por otro trader
  const vfileRef = useRef<HTMLInputElement>(null);
  const vAccRef = useRef<string>('');

  // Cuentas ya ocupadas copiando a otro trader (una cuenta = un trader).
  const busyMap = useMemo(() => {
    const m: Record<string, string> = {};
    (follows || []).forEach((f: any) => { if (['active', 'pending', 'past_due'].includes(f.status)) m[f.follower_account_id] = f.provider?.display_name || '—'; });
    return m;
  }, [follows]);

  const T = es ? {
    title: 'Onyx Copy', sub: 'Copia a traders calificados o pon tu cuenta a calificar.',
    tCopy: 'Copiar traders', tMine: 'Mis copias', tTrader: 'Soy trader calificado',
    copy: 'Copiar', from: 'desde', mo: 'mes', notPayable: 'aún no cobra', copies: 'copian',
    cfgTitle: 'Configura tu copia', account: 'Tu cuenta a copiar (esclava)', pickAcc: 'Elige una cuenta',
    lotMode: 'Tamaño de lote', mBalance: 'Por balance', mMult: 'Multiplicador', mFixed: 'Lote fijo', mRisk: '% de riesgo',
    lotVal: 'Valor', maxLot: 'Lote máximo', maxDD: 'Drawdown máx (%)', reqSl: 'Exigir SL', reverse: 'Invertir señales',
    pay: 'Ir a pagar y activar', cancel: 'Cancelar', noAcc: 'Primero conecta una cuenta de trading.',
    myEmpty: 'Aún no copias a nadie.', stop: 'Dejar de copiar', status: 'Estado',
    st_active: 'Activa', st_pending: 'Pendiente de pago', st_past_due: 'Pago pendiente', st_paused: 'Pausada', st_canceled: 'Cancelada',
    apply: 'Postular una cuenta', applyH: 'Onyx AI la califica y, si pasa, aparece en el ranking.', score: 'score', recompute: 'Recalcular',
    price: 'Precio mensual ($)', perfFee: 'Comisión rendimiento (%)', perfNote: 'de tus ganancias nuevas', perfEarn: 'De rendimiento', hwm: 'high-water mark', save: 'Guardar', connectT: 'Cobra tus copias', connectD: 'Conecta tu cuenta con Stripe para recibir tu parte de cada seguidor.',
    connectBtn: 'Conectar con Stripe', connected: 'Conectado y cobrando', pending: 'Falta terminar en Stripe', finishBtn: 'Continuar en Stripe', notConnected: 'Sin conectar',
    qToward: 'Qué te falta para', qFlags: 'Tus banderas, explicadas', qSug: 'Sugerencias de Onyx AI', qNext: 'Próximo recálculo', qAuto: 'Onyx AI recalifica cada día automáticamente', qShow: 'Qué me falta', qHide: 'Ocultar', qDone: 'Cumples todo para', qOf: 'de', qMissing: 'faltan', qReq: 'exige', qRecalcHint: 'También puedes pulsar Recalcular ahora.',
    earn: 'Tus cobros', net: 'Para ti (neto)', gross: 'Cobrado', fee: 'Comisión Onyx', followers: 'seguidores',
    tierGate: 'Para Gold/Diamond hace falta cuenta verificada. Súbela abajo y Onyx AI la verifica al instante.',
    verify: 'Verificar', verifying: 'Verificando…', verifiedTxt: 'Verificada',
    verifyOk: '✓ ¡Verificada! Tu cuenta quedó confirmada como live.',
    verifyNotLive: 'El estado de cuenta parece de una cuenta demo, no live.',
    verifyMismatch: 'El número de cuenta del documento no coincide con esta cuenta.',
    verifyBad: 'No pude leer el documento. Prueba con una captura o PDF más claro del bróker.',
    busyTitle: 'Esta cuenta ya está copiando', busyGo: 'Ir a Mis copias', busyClose: 'Entendido', busyOpt: 'copiando a',
    riskNote: 'Copiar conlleva riesgo. Mantienes tus propios límites; Onyx no gestiona tu dinero.',
  } : {
    title: 'Onyx Copy', sub: 'Copy graded traders or list your account to get graded.',
    tCopy: 'Copy traders', tMine: 'My copies', tTrader: 'I am a graded trader',
    copy: 'Copy', from: 'from', mo: 'mo', notPayable: 'not billing yet', copies: 'copying',
    cfgTitle: 'Set up your copy', account: 'Your account to copy on (slave)', pickAcc: 'Pick an account',
    lotMode: 'Lot size', mBalance: 'By balance', mMult: 'Multiplier', mFixed: 'Fixed lot', mRisk: 'Risk %',
    lotVal: 'Value', maxLot: 'Max lot', maxDD: 'Max drawdown (%)', reqSl: 'Require SL', reverse: 'Reverse signals',
    pay: 'Go to pay and activate', cancel: 'Cancel', noAcc: 'Connect a trading account first.',
    myEmpty: 'You are not copying anyone yet.', stop: 'Stop copying', status: 'Status',
    st_active: 'Active', st_pending: 'Pending payment', st_past_due: 'Payment due', st_paused: 'Paused', st_canceled: 'Canceled',
    apply: 'List an account', applyH: 'Onyx AI grades it and, if it passes, it appears in the ranking.', score: 'score', recompute: 'Recompute',
    price: 'Monthly price ($)', perfFee: 'Performance fee (%)', perfNote: 'of your new profits', perfEarn: 'Performance', hwm: 'high-water mark', save: 'Save', connectT: 'Get paid for your copies', connectD: 'Connect your account with Stripe to receive your share of each follower.',
    connectBtn: 'Connect with Stripe', connected: 'Connected and billing', pending: 'Finish setup in Stripe', finishBtn: 'Continue in Stripe', notConnected: 'Not connected',
    qToward: 'What you need for', qFlags: 'Your flags, explained', qSug: 'Onyx AI suggestions', qNext: 'Next recompute', qAuto: 'Onyx AI re-grades automatically every day', qShow: 'What I need', qHide: 'Hide', qDone: 'You meet everything for', qOf: 'of', qMissing: 'missing', qReq: 'needs', qRecalcHint: 'You can also hit Recompute now.',
    earn: 'Your earnings', net: 'For you (net)', gross: 'Charged', fee: 'Onyx fee', followers: 'followers',
    tierGate: 'Gold/Diamond require a verified account. Upload it below and Onyx AI verifies it instantly.',
    verify: 'Verify', verifying: 'Verifying…', verifiedTxt: 'Verified',
    verifyOk: '✓ Verified! Your account was confirmed as live.',
    verifyNotLive: 'The statement looks like a demo account, not live.',
    verifyMismatch: 'The account number in the document does not match this account.',
    verifyBad: 'Couldn\'t read the document. Try a clearer broker screenshot or PDF.',
    busyTitle: 'This account is already copying', busyGo: 'Go to My copies', busyClose: 'Got it', busyOpt: 'copying',
    riskNote: 'Copying carries risk. You keep your own limits; Onyx does not manage your money.',
  };
  const stLabel = (s: string) => (T as any)['st_' + s] || s;

  async function loadAll() {
    try {
      const [lb, mf, pv] = await Promise.all([
        fetch('/api/copy/leaderboard').then((r) => r.json()),
        fetch('/api/copy/follow').then((r) => r.json()),
        fetch('/api/copy/provider').then((r) => r.json()),
      ]);
      setProviders(lb.providers || []);
      setFollows(mf.follows || []);
      setAccounts(pv.accounts || []);
      setMyProviders(pv.providers || []);
      setPerfEnabled(!!pv.perfEnabled);
      if (Number(pv.feePct) >= 0) setFeePct(Number(pv.feePct));
    } catch {}
  }
  async function loadTrader() {
    try {
      const [c, e] = await Promise.all([
        fetch('/api/copy/connect').then((r) => r.json()),
        fetch('/api/copy/earnings').then((r) => r.json()),
      ]);
      setConnect(c || {}); setEarnings(e || { totals: {}, recent: [] });
    } catch {}
  }
  useEffect(() => { loadAll(); loadTrader();
    // Feedback de vuelta de Stripe.
    const q = new URLSearchParams(window.location.search);
    if (q.get('followed')) toast(es ? '✓ Copia activada. Conecta tu EA esclavo si aún no lo hiciste.' : '✓ Copy activated. Connect your slave EA if you haven\'t.', 'ok');
    if (q.get('connect') === 'done') toast(es ? '✓ Stripe conectado.' : '✓ Stripe connected.', 'ok');
  }, []);

  function openConfig(p: any) {
    if (!accounts.length) { toast(T.noAcc, 'warn'); return; }
    const free = accounts.find((a) => !busyMap[a.id] || busyMap[a.id] === p.display_name) || accounts[0];
    setCfg({ provider: p, follower_account_id: free.id, lot_mode: 'balance', lot_value: 1, max_lot: 2, max_drawdown_pct: 0, require_sl: false, reverse: false });
  }
  async function startCopy() {
    if (!cfg) return;
    setBusy(true);
    try {
      const r = await fetch('/api/copy/follow', { method: 'POST', body: JSON.stringify({ provider_id: cfg.provider.id, ...cfg, provider: undefined }) });
      const j = await r.json();
      if (j.url) { window.location.href = j.url; return; }
      if (j.code === 'account_busy') { setBlock({ trader: cfg.provider.display_name, other: j.busyWith }); setCfg(null); setBusy(false); return; }
      if (j.code === 'plan_gate') { toast(es ? 'Tu plan no incluye copy. Sube a Pro para copiar traders.' : 'Your plan doesn\'t include copy. Upgrade to Pro to copy traders.', 'warn'); setCfg(null); setBusy(false); return; }
      toast(j.error || 'Error', j.code === 'not_payable' ? 'warn' : 'error');
    } catch { toast('Error', 'error'); }
    setBusy(false);
  }
  async function stopCopy(id: string) {
    if (!confirm(es ? '¿Dejar de copiar a este trader?' : 'Stop copying this trader?')) return;
    await fetch('/api/copy/follow?id=' + id, { method: 'DELETE' });
    loadAll();
  }
  async function applyAccount(accountId: string) {
    setBusy(true);
    const r = await fetch('/api/copy/provider', { method: 'POST', body: JSON.stringify({ account_id: accountId }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) { toast(es ? '✓ Cuenta calificada.' : '✓ Account graded.', 'ok'); loadAll(); }
    else toast(j.error || 'Error', 'error');
  }
  async function saveProviderField(p: any, patch: any) {
    const r = await fetch('/api/copy/provider', { method: 'POST', body: JSON.stringify({ account_id: p.account_id, ...patch }) });
    const j = await r.json();
    if (j.ok) { toast(es ? '✓ Guardado.' : '✓ Saved.', 'ok'); loadAll(); } else toast(j.error || 'Error', 'error');
  }
  function startVerify(accountId: string) { vAccRef.current = accountId; vfileRef.current?.click(); }
  async function onVerifyFile(file: File) {
    const accountId = vAccRef.current; if (!accountId) return;
    setVerifying(accountId);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('account_id', accountId); fd.append('lang', lang);
      const r = await fetch('/api/copy/verify', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.verified) { toast(T.verifyOk, 'ok'); loadAll(); }
      else if (j.reason === 'not_live') toast(T.verifyNotLive, 'warn');
      else if (j.reason === 'login_mismatch') toast(T.verifyMismatch, 'warn');
      else toast(j.error || T.verifyBad, 'warn');
    } catch { toast(T.verifyBad, 'error'); }
    setVerifying('');
  }
  async function doConnect() {
    const r = await fetch('/api/copy/connect', { method: 'POST' });
    const j = await r.json();
    if (j.url) window.location.href = j.url; else toast(j.error || 'Error', 'error');
  }

  const TabBtn = ({ k, label }: { k: any; label: string }) => (
    <button onClick={() => setTab(k)} className={'btn ' + (tab === k ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 13 }}>{label}</button>
  );
  const badge = (t: string, txt: string) => <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid ' + (TIERC[t] || 'var(--line)'), color: TIERC[t] || 'var(--mut)' }}>{txt}</span>;

  return (
    <div className="wrap section" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>{T.title}</h2>
        <p className="muted" style={{ fontSize: 14 }}>{T.sub}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <TabBtn k="copy" label={T.tCopy} />
        <TabBtn k="mine" label={T.tMine + (follows.length ? ` (${follows.length})` : '')} />
        <TabBtn k="trader" label={T.tTrader} />
      </div>

      {/* COPIAR TRADERS */}
      {tab === 'copy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.length === 0 && <div className="card muted" style={{ textAlign: 'center', padding: 24 }}>{es ? 'Aún no hay traders calificados.' : 'No graded traders yet.'}</div>}
          {providers.map((p, i) => {
            const s = p.stats || {};
            return (
              <div key={p.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderLeft: `3px solid ${TIERC[p.tier] || 'var(--line)'}` }}>
                <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: 'var(--mut)' }}>{i + 1}</div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{p.display_name}</b> {badge(p.tier, p.tier === 'diamond' ? 'Onyx Diamond' : p.tier === 'gold' ? 'Onyx Gold' : 'Onyx Silver')} {p.verified && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>Win {s.winRate ?? 0}% · PF {s.pf ?? 0} · maxDD {s.maxDDpct ?? 0}% · {p.followers || 0} {T.copies}</div>
                </div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: TIERC[p.tier] }}>{p.score}</div><div className="muted" style={{ fontSize: 10 }}>{T.score}</div></div>
                <div style={{ textAlign: 'right', minWidth: 96 }}>
                  {p.fee_month ? <div style={{ fontSize: 12 }}>{T.from} ${p.fee_month}/{T.mo}</div> : <div className="muted" style={{ fontSize: 11 }}>{T.notPayable}</div>}
                  {p.perf_fee_pct > 0 && <div className="muted" style={{ fontSize: 10.5 }}>+{p.perf_fee_pct}% {T.perfNote}</div>}
                  <button className="btn btn-primary" style={{ fontSize: 12, marginTop: 6 }} onClick={() => openConfig(p)}>{T.copy}</button>
                </div>
              </div>
            );
          })}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{T.riskNote}</p>
        </div>
      )}

      {/* MIS COPIAS */}
      {tab === 'mine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {follows.length === 0 && <div className="card muted" style={{ textAlign: 'center', padding: 24 }}>{T.myEmpty}</div>}
          {follows.map((f) => (
            <div key={f.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <b>{f.provider?.display_name || '—'}</b> {f.provider && badge(f.provider.tier, f.provider.tier)}
                <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{T.status}: {stLabel(f.status)} · {f.lot_mode} {f.lot_value} · max {f.max_lot} lots{f.price_month ? ` · $${f.price_month}/${T.mo}` : ''}</div>
              </div>
              {f.status !== 'canceled' && <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(255,107,125,.5)' }} onClick={() => stopCopy(f.id)}>{T.stop}</button>}
            </div>
          ))}
        </div>
      )}

      {/* SOY TRADER CALIFICADO */}
      {tab === 'trader' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Connect */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{T.connectT}</div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{T.connectD}</p>
            {connect.chargesEnabled
              ? <span style={{ color: 'var(--green)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /> {T.connected}</span>
              : connect.connected
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ color: 'var(--amber)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} /> {T.pending}</span> <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={doConnect}>{T.finishBtn}</button></div>
                : <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ color: 'var(--mut)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mut)' }} /> {T.notConnected}</span> <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={doConnect}>{T.connectBtn}</button></div>}
          </div>

          {/* Postular cuentas */}
          <div className="card">
            <div style={{ fontWeight: 700 }}>{T.apply}</div>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>{T.applyH}</p>
            {accounts.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{T.noAcc}</div>}
            <input ref={vfileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onVerifyFile(f); e.currentTarget.value = ''; }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accounts.map((a) => {
                const prov = myProviders.find((p) => p.account_id === a.id);
                return (
                  <div key={a.id} style={{ background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                   <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px' }}>
                    <div style={{ flex: '1 1 160px' }}><b>{a.nickname || a.broker || a.id.slice(0, 6)}</b> <span className="muted" style={{ fontSize: 12 }}>{a.platform}</span></div>
                    {prov ? (
                      <>
                        <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, color: TIERC[prov.tier] }}>{prov.score}</div><div className="muted" style={{ fontSize: 10 }}>{T.score}</div></div>
                        {badge(prov.tier, prov.tier === 'none' ? (es ? 'En evaluación' : 'In review') : prov.tier)}
                        <input defaultValue={prov.fee_month || ''} placeholder={T.price} title={T.price} onBlur={(e) => { if (e.target.value !== String(prov.fee_month || '')) saveProviderField(prov, { fee_month: e.target.value }); }} style={{ width: 96, margin: 0, padding: '7px 9px', fontSize: 13 }} />
                        {perfEnabled && <input defaultValue={prov.perf_fee_pct || ''} placeholder={T.perfFee} title={T.perfFee + ' (' + T.hwm + ')'} onBlur={(e) => { if (e.target.value !== String(prov.perf_fee_pct || '')) saveProviderField(prov, { perf_fee_pct: e.target.value }); }} style={{ width: 70, margin: 0, padding: '7px 9px', fontSize: 13 }} />}
                        {Array.isArray(prov.flags) && prov.flags.length > 0 && <span title={prov.flags.join(', ')} style={{ fontSize: 11, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><OnyxIcon emoji="⚠" size={12} /> {prov.flags.length}</span>}
                        {prov.auto_delisted && <span style={{ fontSize: 11, color: 'var(--red)' }}>{es ? 'retirado (drawdown)' : 'delisted (drawdown)'}</span>}
                        {prov.verified
                          ? <span style={{ fontSize: 11.5, color: 'var(--green)' }}>✓ {T.verifiedTxt}</span>
                          : <button className="btn btn-ghost" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => startVerify(a.id)} disabled={verifying === a.id}>{verifying === a.id ? T.verifying : <><OnyxIcon emoji="🛡" size={13} /> {T.verify}</>}</button>}
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => applyAccount(a.id)} disabled={busy}>↻ {T.recompute}</button>
                        <button className="btn btn-ghost" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setOpenQual(openQual === a.id ? null : a.id)}><OnyxIcon emoji={openQual === a.id ? '📈' : '🎯'} size={13} /> {openQual === a.id ? T.qHide : T.qShow}</button>
                      </>
                    ) : (
                      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => applyAccount(a.id)} disabled={busy}>{T.apply}</button>
                    )}
                   </div>
                   {prov && openQual === a.id && (() => {
                     const q = prov.qualify; const nextT = q?.next || 'silver';
                     const flags: string[] = Array.isArray(prov.flags) ? prov.flags : [];
                     const sug = buildSug(prov, es);
                     return (
                       <div style={{ borderTop: '1px solid var(--bd)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                         {q && (
                           <div>
                             <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="🎯" size={14} /> {q.done ? `${T.qDone} ${tierName(nextT, es)}` : `${T.qToward} ${tierName(nextT, es)}`}</div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                               {q.reqs.map((r: any) => (
                                 <div key={r.key}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                                     <span style={{ color: 'var(--mut)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><OnyxIcon emoji={r.ok ? '✓' : '⚠'} size={13} /> {es ? r.label_es : r.label_en}</span>
                                     <span style={{ color: r.ok ? 'var(--green)' : 'var(--amber)' }}>{r.key === 'verified' ? (r.ok ? (es ? 'Sí' : 'Yes') : 'No') : `${r.cur}${r.unit || ''} / ${r.req}${r.unit || ''}`}{!r.ok && r.key !== 'verified' && r.key !== 'dd' && r.key !== 'score' && r.key !== 'pf' ? ` · ${T.qMissing} ${r.req - r.cur}` : ''}</span>
                                   </div>
                                   <div style={{ height: 6, borderRadius: 99, background: 'var(--card)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${r.pct}%`, background: r.ok ? 'var(--green)' : 'var(--amber)' }} /></div>
                                 </div>
                               ))}
                             </div>
                             {q.next !== 'silver' && <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 7 }}>{es ? 'Gold y Diamond exigen cuenta verificada.' : 'Gold and Diamond require a verified account.'}</div>}
                           </div>
                         )}

                         {flags.length > 0 && (
                           <div>
                             <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--amber)' }}><OnyxIcon emoji="⚠" size={14} /> {T.qFlags}</div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                               {flags.map((f) => { const info = FLAG_INFO[f]; const t = info ? (es ? info.es : info.en) : [f, '']; return (
                                 <div key={f} style={{ background: 'rgba(255,192,77,.1)', borderRadius: 8, padding: '7px 10px' }}>
                                   <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--amber)' }}>{t[0]}</div>
                                   <div style={{ fontSize: 12, color: 'var(--amber)', opacity: .85 }}>{t[1]}</div>
                                 </div>
                               ); })}
                             </div>
                           </div>
                         )}

                         <div>
                           <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--soft-brand)' }}><OnyxIcon emoji="✨" size={14} /> {T.qSug}</div>
                           <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--mut)', lineHeight: 1.7 }}>
                             {sug.map((s, i) => <li key={i}>{s}</li>)}
                           </ul>
                         </div>

                         <div style={{ fontSize: 11.5, color: 'var(--mut)', borderTop: '1px solid var(--bd)', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                           <OnyxIcon emoji="🔁" size={13} /> {T.qAuto}. {T.qRecalcHint}
                         </div>
                       </div>
                     );
                   })()}
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{T.tierGate}</p>
          </div>

          {/* Cobros */}
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{T.earn}</div>
            <div className="grid g3" style={{ gap: 10, marginBottom: 8 }}>
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, textAlign: 'center' }}><div className="muted" style={{ fontSize: 11 }}>{T.net}</div><b style={{ color: 'var(--green)', fontSize: 18 }}>{money(earnings.totals?.net_cents || 0)}</b></div>
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, textAlign: 'center' }}><div className="muted" style={{ fontSize: 11 }}>{T.gross}</div><b style={{ fontSize: 18 }}>{money(earnings.totals?.gross_cents || 0)}</b></div>
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12, textAlign: 'center' }}><div className="muted" style={{ fontSize: 11 }}>{T.fee}</div><b style={{ fontSize: 18 }}>{money(earnings.totals?.fee_cents || 0)}</b></div>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{(myProviders.reduce((s, p) => s + (p.followers || 0), 0))} {T.followers}{earnings.totals?.perf_net_cents ? ` · ${T.perfEarn}: ${money(earnings.totals.perf_net_cents)}` : ''}</div>
          </div>

          {/* Calculadora precargada con sus números reales */}
          {(() => {
            const primary = [...myProviders].sort((a, b) => (b.followers || 0) - (a.followers || 0))[0];
            const subs0 = primary?.followers || myProviders.reduce((s, p) => s + (p.followers || 0), 0) || 0;
            const price0 = Number(primary?.fee_month) || 29;
            return <CopyEarningsCalc feePct={feePct} subs0={subs0} price0={price0} lang={es ? 'es' : 'en'} live />;
          })()}
        </div>
      )}

      {/* Modal de configuración de copia */}
      {cfg && (
        <div onClick={() => setCfg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 460, width: '100%' }}>
            <div className="row between" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>{T.cfgTitle}: {cfg.provider.display_name}</h3><button className="btn btn-ghost" onClick={() => setCfg(null)}>✕</button></div>
            <label className="muted" style={{ fontSize: 12 }}>{T.account}</label>
            <select value={cfg.follower_account_id} onChange={(e) => setCfg({ ...cfg, follower_account_id: e.target.value })} style={{ width: '100%', margin: '4px 0 6px', padding: '8px 10px' }}>
              {accounts.map((a) => { const b = busyMap[a.id]; const busyOther = b && b !== cfg.provider.display_name; return <option key={a.id} value={a.id}>{a.nickname || a.broker || a.id.slice(0, 6)} · {a.platform}{busyOther ? ` · ${T.busyOpt} ${b}` : ''}</option>; })}
            </select>
            {(() => { const b = busyMap[cfg.follower_account_id]; return b && b !== cfg.provider.display_name ? (
              <div style={{ fontSize: 12, color: 'var(--amber)', background: 'rgba(255,192,77,.1)', border: '1px solid var(--amber)', borderRadius: 8, padding: '7px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="⚠" size={14} /> {es ? `Esta cuenta ya copia a ${b}. Elige otra cuenta o deja de copiarlo primero.` : `This account already copies ${b}. Pick another account or stop copying first.`}</div>
            ) : null; })()}
            <label className="muted" style={{ fontSize: 12 }}>{T.lotMode}</label>
            <select value={cfg.lot_mode} onChange={(e) => setCfg({ ...cfg, lot_mode: e.target.value })} style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px' }}>
              <option value="balance">{T.mBalance}</option><option value="multiplier">{T.mMult}</option><option value="fixed">{T.mFixed}</option><option value="risk">{T.mRisk}</option>
            </select>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {cfg.lot_mode !== 'balance' && <div><label className="muted" style={{ fontSize: 12 }}>{T.lotVal}</label><input value={cfg.lot_value} onChange={(e) => setCfg({ ...cfg, lot_value: e.target.value })} style={{ width: 90, margin: '4px 0', padding: '7px 9px' }} /></div>}
              <div><label className="muted" style={{ fontSize: 12 }}>{T.maxLot}</label><input value={cfg.max_lot} onChange={(e) => setCfg({ ...cfg, max_lot: e.target.value })} style={{ width: 90, margin: '4px 0', padding: '7px 9px' }} /></div>
              <div><label className="muted" style={{ fontSize: 12 }}>{T.maxDD}</label><input value={cfg.max_drawdown_pct} onChange={(e) => setCfg({ ...cfg, max_drawdown_pct: e.target.value })} style={{ width: 90, margin: '4px 0', padding: '7px 9px' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 16, margin: '10px 0' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={cfg.require_sl} onChange={(e) => setCfg({ ...cfg, require_sl: e.target.checked })} /> {T.reqSl}</label>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={cfg.reverse} onChange={(e) => setCfg({ ...cfg, reverse: e.target.checked })} /> {T.reverse}</label>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8 }}>
              {cfg.provider.fee_month ? `$${cfg.provider.fee_month}/${T.mo}` : ''}{cfg.provider.perf_fee_pct > 0 ? ` · +${cfg.provider.perf_fee_pct}% ${T.perfNote} (${T.hwm})` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setCfg(null)}>{T.cancel}</button>
              <button className="btn btn-primary" onClick={startCopy} disabled={busy}>{busy ? '...' : T.pay}</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup: una cuenta = un trader */}
      {block && (
        <div onClick={() => setBlock(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,9,16,.62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(94vw,430px)', background: 'var(--card)', border: '1px solid var(--amber)', borderRadius: 18, padding: 22, boxShadow: '0 0 0 1px var(--amber), 0 0 38px -8px var(--amber), 0 24px 60px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,192,77,.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}><OnyxIcon emoji="⚠" size={20} /></span>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{T.busyTitle}</div>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--mut)', lineHeight: 1.6 }}>
              {es
                ? <>No puedes copiar a <b style={{ color: 'var(--tx)' }}>{block.trader}</b> con esta cuenta porque ya está copiando a <b style={{ color: 'var(--tx)' }}>{block.other}</b>. Cada cuenta solo puede copiar a un trader. Para conectarla a <b style={{ color: 'var(--tx)' }}>{block.trader}</b>, primero deja de copiar a <b style={{ color: 'var(--tx)' }}>{block.other}</b> en “Mis copias” (o usa otra cuenta).</>
                : <>You can’t copy <b style={{ color: 'var(--tx)' }}>{block.trader}</b> with this account because it’s already copying <b style={{ color: 'var(--tx)' }}>{block.other}</b>. Each account can copy only one trader. To connect it to <b style={{ color: 'var(--tx)' }}>{block.trader}</b>, first stop copying <b style={{ color: 'var(--tx)' }}>{block.other}</b> in “My copies” (or use another account).</>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setBlock(null)}>{T.busyClose}</button>
              <button className="btn btn-primary" onClick={() => { setBlock(null); setTab('mine'); }}>{T.busyGo}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
