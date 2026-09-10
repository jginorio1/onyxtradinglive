'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import { checkWallet, maskAddress, lastChars, toChecksumEvm } from '@/lib/walletChecksum';

export default function PayoutSettingsPage() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [d, setD] = useState<any>(null);
  const [trc, setTrc] = useState('');
  const [erc, setErc] = useState('');
  const [trcTail, setTrcTail] = useState('');  // confirmación: solo los últimos 6
  const [ercTail, setErcTail] = useState('');
  const [net, setNet] = useState('trc20');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Validación por CHECKSUM (no solo formato): el dígito de control cuadra.
  const trcChk = checkWallet('trc20', trc);
  const ercChk = checkWallet('erc20', erc);
  const trcOk = trc.trim() === '' || trcChk.ok;
  const ercOk = erc.trim() === '' || ercChk.ok;
  // Confirmación ligera: solo los últimos 6 caracteres (no reescribir todo).
  const trcTailOk = trc.trim() === '' || (trcOk && trcTail.trim().toLowerCase() === lastChars(trc, 6).toLowerCase());
  const ercTailOk = erc.trim() === '' || (ercOk && ercTail.trim().toLowerCase() === lastChars(erc, 6).toLowerCase());
  const anyWallet = trc.trim() !== '' || erc.trim() !== '';
  const canSave = trcOk && ercOk && trcTailOk && ercTailOk && (!anyWallet || confirm);

  async function load() {
    try { const r = await fetch('/api/payout-node', { cache: 'no-store' }); const j = await r.json(); setD(j); setTrc(j.wallets?.trc20 || ''); setErc(j.wallets?.erc20 || ''); setNet(j.wallets?.network || 'trc20'); setTrcTail(j.wallets?.trc20 ? lastChars(j.wallets.trc20, 6) : ''); setErcTail(j.wallets?.erc20 ? lastChars(j.wallets.erc20, 6) : ''); } catch {}
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
  const inp: any = { padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 13.5, width: '100%', boxSizing: 'border-box' };
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
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{es ? 'Pega tu dirección USDT: comprobamos su dígito de control al instante. No hace falta reescribirla entera — solo confirmas los últimos 6 caracteres.' : 'Paste your USDT address: we check its control digit instantly. No need to retype it whole — you just confirm the last 6 characters.'}</p>
        <div style={{ display: 'grid', gap: 14 }}>
          <WalletField
            es={es} label={es ? 'Wallet USDT · TRON (TRC20)' : 'USDT wallet · TRON (TRC20)'} placeholder="T…"
            value={trc} onChange={(v) => { setTrc(v); setTrcTail(''); setConfirm(false); }}
            chk={trcChk} ok={trcOk} tail={trcTail} onTail={(v) => { setTrcTail(v); setConfirm(false); }} tailOk={trcTailOk}
            inp={inp}
          />
          <WalletField
            es={es} label={es ? 'Wallet USDT · Ethereum (ERC20)' : 'USDT wallet · Ethereum (ERC20)'} placeholder="0x…"
            value={erc} onChange={(v) => { setErc(v); setErcTail(''); setConfirm(false); }}
            chk={ercChk} ok={ercOk} tail={ercTail} onTail={(v) => { setErcTail(v); setConfirm(false); }} tailOk={ercTailOk}
            inp={inp} onNormalize={erc.trim() && ercOk && toChecksumEvm(erc) !== erc.trim() ? () => { setErc(toChecksumEvm(erc)); setErcTail(''); setConfirm(false); } : undefined}
          />
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
        {es ? 'El dígito de control (checksum) de la dirección detecta casi cualquier error de tecleo por sí solo, así que es más seguro que copiarla dos veces. Cada programa mantiene su maduración y protecciones; este nodo solo unifica la conexión y las wallets.' : 'The address checksum catches almost any typo on its own, so it is safer than copying it twice. Each program keeps its maturation and protections; this node just unifies the connection and wallets.'}
      </div>
    </div>
  );
}

function WalletField({ es, label, placeholder, value, onChange, chk, ok, tail, onTail, tailOk, inp, onNormalize }: any) {
  const filled = value.trim() !== '';
  const shield = (color: string, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
      {text}
    </span>
  );
  return (
    <div>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <input style={{ ...inp, borderColor: !filled ? 'var(--line)' : ok ? 'var(--green)' : 'var(--red)' }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
      {filled && (
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {ok
            ? shield('var(--green)', es ? 'Checksum válido' : 'Checksum valid')
            : <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--red)' }}>{chk.reason === 'checksum' ? (es ? '✗ El dígito de control no cuadra — revísala' : '✗ Control digit does not match — check it') : (es ? '✗ Formato incorrecto' : '✗ Wrong format')}</span>}
          {ok && onNormalize && <button type="button" onClick={onNormalize} style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{es ? 'Poner mayúsculas oficiales' : 'Apply official casing'}</button>}
        </div>
      )}
      {filled && ok && (
        <div style={{ marginTop: 8, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 12.5, fontFamily: 'ui-monospace,Menlo,monospace', letterSpacing: '.5px', marginBottom: 8, wordBreak: 'break-all' }}>{maskAddress(value, 8, 8)}</div>
          <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'Confirma los últimos 6 caracteres (cotéjalos con tu exchange):' : 'Confirm the last 6 characters (check them against your exchange):'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <input style={{ ...inp, width: 130, textTransform: 'none', fontFamily: 'ui-monospace,Menlo,monospace', letterSpacing: '2px', borderColor: tailOk ? 'var(--green)' : 'var(--line)' }} maxLength={6} placeholder="••••••" value={tail} onChange={(e) => onTail(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
            {tail.trim() !== '' && <span style={{ fontSize: 11.5, fontWeight: 800, color: tailOk ? 'var(--green)' : 'var(--red)' }}>{tailOk ? (es ? '✓ Coincide' : '✓ Matches') : (es ? '✗ No coincide' : '✗ Does not match')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
