'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

export default function PayoutSettingsPage() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [d, setD] = useState<any>(null);
  const [trc, setTrc] = useState('');
  const [erc, setErc] = useState('');
  const [trc2, setTrc2] = useState('');  // segunda captura (confirmación)
  const [erc2, setErc2] = useState('');
  const [net, setNet] = useState('trc20');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Validación de formato (misma que el servidor) para avisar antes de guardar.
  const isTron = (a: string) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test((a || '').trim());
  const isEvm = (a: string) => /^0x[a-fA-F0-9]{40}$/.test((a || '').trim());
  const trcOk = trc.trim() === '' || isTron(trc);
  const ercOk = erc.trim() === '' || isEvm(erc);
  // Doble captura: la confirmación debe coincidir EXACTA con la primera.
  const trcMatch = trc.trim() === '' || trc.trim() === trc2.trim();
  const ercMatch = erc.trim() === '' || erc.trim() === erc2.trim();
  const anyWallet = trc.trim() !== '' || erc.trim() !== '';
  const canSave = trcOk && ercOk && trcMatch && ercMatch && (!anyWallet || confirm);

  async function load() {
    try { const r = await fetch('/api/payout-node', { cache: 'no-store' }); const j = await r.json(); setD(j); setTrc(j.wallets?.trc20 || ''); setErc(j.wallets?.erc20 || ''); setNet(j.wallets?.network || 'trc20'); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function act(body: any) {
    setBusy(true); setMsg('');
    try { const r = await fetch('/api/payout-node', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }
    catch (e: any) { setMsg(e?.message || 'error'); }
    finally { setBusy(false); }
  }

  const st = d?.status || {};
  const ready = st.connected && st.payoutsEnabled;
  const inp: any = { padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5, width: '100%' };
  const card: any = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 };

  return (
    <div className="wrap" style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px 70px' }}>
      <Link href="/dashboard/earnings" className="muted" style={{ fontSize: 13 }}>{es ? '← Centro de ganancias' : '← Earnings center'}</Link>
      <h1 style={{ fontSize: 24, margin: '10px 0 4px' }}>{es ? 'Configuración de cobro' : 'Payout settings'}</h1>
      <p className="muted" style={{ fontSize: 14, margin: '0 0 20px' }}>{es ? 'Conecta tu banco y guarda tu wallet USDT UNA sola vez. Todos tus programas (Bot Lab, embajador, Onyx Copy, academia) cobran por aquí.' : 'Connect your bank and save your USDT wallet ONCE. All your programs (Bot Lab, ambassador, Onyx Copy, academy) get paid through here.'}</p>

      {/* Stripe · banco */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🏦</span>
          <b style={{ fontSize: 16 }}>{es ? 'Cobro a tu banco (Stripe)' : 'Bank payout (Stripe)'}</b>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, color: ready ? 'var(--green)' : st.connected ? 'var(--amber)' : 'var(--mut)', border: `1px solid color-mix(in srgb,${ready ? 'var(--green)' : st.connected ? 'var(--amber)' : 'var(--mut)'} 40%,transparent)`, borderRadius: 99, padding: '3px 10px' }}>
            {ready ? (es ? '✓ Listo' : '✓ Ready') : st.connected ? (es ? 'Por verificar' : 'Verifying') : (es ? 'Sin conectar' : 'Not connected')}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{es ? 'Una sola cuenta Stripe Express para recibir tus pagos en el banco. Solo lo haces una vez.' : 'A single Stripe Express account to receive your payouts to the bank. You only do this once.'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={async () => { const j = await act({ action: 'connect' }); if (j?.url) window.location.href = j.url; }} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer', background: 'var(--brand)', color: '#0b1020' }}>
            {st.connected ? (es ? 'Continuar / actualizar datos' : 'Continue / update details') : (es ? 'Conectar mi banco' : 'Connect my bank')}
          </button>
          {st.connected && <button disabled={busy} onClick={async () => { const j = await act({ action: 'express' }); if (j?.url) window.open(j.url, '_blank'); }} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--line)', fontWeight: 800, cursor: 'pointer', background: 'transparent', color: 'var(--tx)' }}>{es ? 'Ver mi panel Stripe ↗' : 'Open my Stripe panel ↗'}</button>}
        </div>
      </div>

      {/* USDT */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>₮</span>
          <b style={{ fontSize: 16 }}>{es ? 'Cobro en USDT' : 'USDT payout'}</b>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{es ? 'Tus direcciones USDT. Se usan por defecto en cualquier retiro en cripto, sin volver a escribirlas.' : 'Your USDT addresses. Used by default in any crypto withdrawal, no need to retype them.'}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <span className="muted" style={{ fontSize: 12 }}>{es ? 'Wallet USDT · TRON (TRC20)' : 'USDT wallet · TRON (TRC20)'}</span>
            <input style={{ ...inp, borderColor: trcOk ? 'var(--line)' : 'var(--red)' }} placeholder="T…" value={trc} onChange={(e) => { setTrc(e.target.value); setConfirm(false); }} />
            {trc.trim() !== '' && <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, color: trcOk ? 'var(--green)' : 'var(--red)' }}>{trcOk ? (es ? '✓ Formato TRON válido' : '✓ Valid TRON format') : (es ? '✗ Debe empezar con "T" y tener 34 caracteres' : '✗ Must start with "T" and be 34 characters')}</div>}
            {trc.trim() !== '' && trcOk && <>
              <input style={{ ...inp, marginTop: 6, borderColor: trcMatch ? 'var(--line)' : 'var(--red)' }} placeholder={es ? 'Vuelve a escribir la dirección TRON' : 'Re-enter the TRON address'} value={trc2} onChange={(e) => { setTrc2(e.target.value); setConfirm(false); }} onPaste={(e) => e.preventDefault()} />
              <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, color: trcMatch ? 'var(--green)' : 'var(--red)' }}>{trc2.trim() === '' ? (es ? 'Escríbela otra vez para confirmar (no se puede pegar)' : 'Type it again to confirm (paste disabled)') : trcMatch ? (es ? '✓ Coincide' : '✓ Matches') : (es ? '✗ No coincide' : '✗ Does not match')}</div>
            </>}
          </div>
          <div>
            <span className="muted" style={{ fontSize: 12 }}>{es ? 'Wallet USDT · Ethereum (ERC20)' : 'USDT wallet · Ethereum (ERC20)'}</span>
            <input style={{ ...inp, borderColor: ercOk ? 'var(--line)' : 'var(--red)' }} placeholder="0x…" value={erc} onChange={(e) => { setErc(e.target.value); setConfirm(false); }} />
            {erc.trim() !== '' && <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, color: ercOk ? 'var(--green)' : 'var(--red)' }}>{ercOk ? (es ? '✓ Formato Ethereum válido' : '✓ Valid Ethereum format') : (es ? '✗ Debe empezar con "0x" y tener 42 caracteres' : '✗ Must start with "0x" and be 42 characters')}</div>}
            {erc.trim() !== '' && ercOk && <>
              <input style={{ ...inp, marginTop: 6, borderColor: ercMatch ? 'var(--line)' : 'var(--red)' }} placeholder={es ? 'Vuelve a escribir la dirección Ethereum' : 'Re-enter the Ethereum address'} value={erc2} onChange={(e) => { setErc2(e.target.value); setConfirm(false); }} onPaste={(e) => e.preventDefault()} />
              <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, color: ercMatch ? 'var(--green)' : 'var(--red)' }}>{erc2.trim() === '' ? (es ? 'Escríbela otra vez para confirmar (no se puede pegar)' : 'Type it again to confirm (paste disabled)') : ercMatch ? (es ? '✓ Coincide' : '✓ Matches') : (es ? '✗ No coincide' : '✗ Does not match')}</div>
            </>}
          </div>
          <label><span className="muted" style={{ fontSize: 12 }}>{es ? 'Red preferida' : 'Preferred network'}</span>
            <select style={inp} value={net} onChange={(e) => setNet(e.target.value)}><option value="trc20">TRON (TRC20)</option><option value="erc20">Ethereum (ERC20)</option></select>
          </label>
          {anyWallet && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'color-mix(in srgb,var(--amber) 10%,var(--bg2))', border: '1px solid color-mix(in srgb,var(--amber) 30%,var(--line))', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ width: 17, height: 17, marginTop: 1, flex: 'none' }} />
              <span style={{ fontSize: 12.5 }}>{es ? 'Confirmo que estas direcciones son correctas y en la red indicada. Un error en la wallet significa perder el dinero: es irreversible.' : 'I confirm these addresses are correct and on the right network. A wrong wallet means losing the money: it is irreversible.'}</span>
            </label>
          )}
          <button disabled={busy || !canSave} onClick={async () => { const j = await act({ action: 'save_wallets', trc20: trc, erc20: erc, network: net }); if (j?.ok) { setMsg(es ? 'Guardado ✓' : 'Saved ✓'); setConfirm(false); } }} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.5, background: 'var(--green)', color: '#0b1020', justifySelf: 'start' }}>{es ? 'Guardar wallets' : 'Save wallets'}</button>
        </div>
      </div>

      {msg && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: msg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>}

      <div className="muted" style={{ fontSize: 12, marginTop: 18, lineHeight: 1.6 }}>
        {es ? 'Nota: cada programa mantiene su maduración y protecciones. Este nodo solo unifica la conexión y las wallets, para que las configures una vez y no en cada sitio.' : 'Note: each program keeps its maturation and protections. This node only unifies the connection and wallets, so you set them up once instead of everywhere.'}
      </div>
    </div>
  );
}
