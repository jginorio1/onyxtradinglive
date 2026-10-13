'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// "Mi tarjeta verificada": cualquier usuario (no solo proveedores de Copy) genera
// su certificado público compartible desde sus cuentas conectadas. Reusa el motor
// de Onyx Score (/api/copy/provider) con la bandera `showcase` (público, fuera del
// ranking de copia). La tarjeta pública vive en /copy/t/[id].
type Acc = { id: string; nickname?: string; broker?: string; platform?: string; connected?: boolean };
type Prov = { id: string; account_id: string; display_name?: string; tier?: string; score?: number; showcase?: boolean; listed?: boolean; stats?: any };

export default function MiTarjeta() {
  const { lang } = useLang();
  const es = lang === 'es';
  const L = (a: string, b: string) => (es ? a : b);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [providers, setProviders] = useState<Prov[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [refCode, setRefCode] = useState('');   // mi código "Invita y gana"
  const [myId, setMyId] = useState('');          // mi id de perfil → página pública /u/<id>

  async function load() {
    try {
      const r = await fetch('/api/copy/provider', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setAccounts(j.accounts || []); setProviders(j.providers || []); }
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  // Mi código de referido + mi id (la tarjeta pública es /u/<id>, única en la app).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/referral', { cache: 'no-store' });
        const j = await r.json();
        if (r.ok && j?.enabled && j?.code) setRefCode(String(j.code));
      } catch {}
      try {
        const r = await fetch('/api/account', { cache: 'no-store' });
        const j = await r.json();
        const p = j?.profile || j; if (p?.id) setMyId(String(p.id));
      } catch {}
    })();
  }, []);

  const provFor = (accId: string) => providers.find((p) => p.account_id === accId);

  async function generate(accId: string) {
    setErr(''); setBusy(accId);
    try {
      const r = await fetch('/api/copy/provider', { method: 'POST', body: JSON.stringify({ account_id: accId, showcase: true }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error || L('No se pudo generar la tarjeta.', 'Could not generate the card.'));
      else {
        // Enciende también la página pública /u/<id> para que el grado se vea ahí.
        try { await fetch('/api/account', { method: 'PATCH', body: JSON.stringify({ public_track: true }) }); } catch {}
        await load();
      }
    } catch { setErr(L('Error de red.', 'Network error.')); }
    setBusy('');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // La tarjeta pública es ÚNICA: /u/<miId> (perfil del trader con su Onyx Score).
  // El enlace lleva mi ?ref para captar referido si el visitante se registra.
  const urlFor = (_id?: string) => `${origin}/u/${myId}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;

  async function share(p: Prov) {
    const url = urlFor(p.id);
    const text = es
      ? `Mira mi track record verificado por Onyx AI (Onyx Score ${p.score}/100):`
      : `Check my Onyx AI-verified track record (Onyx Score ${p.score}/100):`;
    try {
      if (typeof (navigator as any).share === 'function') { await (navigator as any).share({ title: 'Onyx', text, url }); return; }
    } catch {}
    try { await navigator.clipboard.writeText(url); setCopied(p.id); setTimeout(() => setCopied(''), 1800); } catch {}
  }
  async function copyLink(p: Prov) {
    try { await navigator.clipboard.writeText(urlFor(p.id)); setCopied(p.id); setTimeout(() => setCopied(''), 1800); } catch {}
  }

  return (
    <div className="wrap" style={{ maxWidth: 760, padding: '28px 18px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(240,169,59,.14)', border: '1px solid rgba(240,169,59,.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)', flex: 'none' }}><OnyxIcon emoji="🏅" size={17} /></span>
        <h1 style={{ fontSize: 24, margin: 0 }}>{L('Mi tarjeta verificada', 'My verified card')}</h1>
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        {L('Genera tu certificado público calificado por Onyx AI y compártelo. No muestra las cifras de tu cuenta, solo tu Onyx Score y métricas de rendimiento.',
           'Generate your public Onyx AI-graded certificate and share it. It never shows your account figures — only your Onyx Score and performance metrics.')}
      </p>

      {err && <div style={{ background: 'rgba(226,59,85,.12)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '9px 13px', fontSize: 13, margin: '10px 0' }}>{err}</div>}

      {loading ? (
        <p className="muted" style={{ fontSize: 13 }}>{L('Cargando…', 'Loading…')}</p>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '26px 20px' }}>
          <div style={{ marginBottom: 8 }}><OnyxIcon emoji="🔌" size={24} /></div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{L('Conecta una cuenta primero', 'Connect an account first')}</div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{L('Necesitas una cuenta conectada y con historial para generar tu tarjeta.', 'You need a connected account with history to generate your card.')}</p>
          <Link className="btn btn-primary" href="/dashboard/keys">{L('Conectar cuenta', 'Connect account')}</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {accounts.map((a) => {
            const p = provFor(a.id);
            const has = !!p && typeof p.score === 'number';
            return (
              <div key={a.id} className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                {has && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--brand),#b8860b)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {has && (() => {
                    const sc = Math.max(0, Math.min(100, p!.score || 0));
                    const R = 33, C = 2 * Math.PI * R;
                    return (
                      <div style={{ position: 'relative', width: 76, height: 76, flex: 'none' }}>
                        <svg viewBox="0 0 76 76" width="76" height="76">
                          <circle cx="38" cy="38" r={R} fill="none" stroke="var(--bg2)" strokeWidth="7" />
                          <circle cx="38" cy="38" r={R} fill="none" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(sc / 100) * C} ${C}`} transform="rotate(-90 38 38)" />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', lineHeight: 1 }}>{p!.score}</div>
                          <div className="muted" style={{ fontSize: 8, letterSpacing: .5, textTransform: 'uppercase' }}>Score</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{a.nickname || a.broker || L('Mi cuenta', 'My account')}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{[a.broker, a.platform].filter(Boolean).join(' · ')} · {a.connected ? L('conectada', 'connected') : L('sin conexión', 'offline')}</div>
                    {has && p!.tier && <span style={{ display: 'inline-block', marginTop: 8, border: '1px solid var(--line)', color: 'var(--mut)', fontSize: 11, fontWeight: 700, padding: '2px 11px', borderRadius: 999, letterSpacing: .5, textTransform: 'uppercase' }}>{p!.tier === 'diamond' ? (es ? 'Onyx Diamond' : 'Onyx Diamond') : p!.tier === 'gold' ? 'Onyx Gold' : p!.tier === 'silver' ? 'Onyx Silver' : (es ? 'En evaluación' : 'In evaluation')}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {!has ? (
                    <button className="btn btn-primary" disabled={busy === a.id} onClick={() => generate(a.id)} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {busy === a.id ? L('Generando…', 'Generating…') : <><OnyxIcon emoji="🏅" size={14} /> {L('Generar mi tarjeta verificada', 'Generate my verified card')}</>}
                    </button>
                  ) : (
                    <>
                      {myId
                        ? <a className="btn btn-primary" href={`/u/${myId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="👁" size={14} /> {L('Ver mi tarjeta', 'View my card')}</a>
                        : <button className="btn btn-primary" disabled style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: .6 }}><OnyxIcon emoji="👁" size={14} /> {L('Cargando…', 'Loading…')}</button>}
                      <button className="btn btn-ghost" onClick={() => share(p!)} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="📤" size={14} /> {L('Compartir', 'Share')}</button>
                      <button className="btn btn-ghost" onClick={() => copyLink(p!)} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji={copied === p!.id ? '✅' : '🔗'} size={14} /> {copied === p!.id ? L('¡Copiado!', 'Copied!') : L('Copiar link', 'Copy link')}</button>
                      <button className="btn btn-ghost" disabled={busy === a.id} onClick={() => generate(a.id)} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="🔄" size={14} /> {L('Actualizar', 'Refresh')}</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Puente hacia Onyx Copy: tarjeta clicable (no texto muerto). */}
      <Link href="/dashboard/onyx-copy" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, background: 'linear-gradient(180deg,rgba(52,226,160,.06),transparent)', border: '1px solid rgba(52,226,160,.4)', borderRadius: 14, padding: '15px 18px', textDecoration: 'none', color: 'var(--tx)' }}>
        <span style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(52,226,160,.14)', border: '1px solid rgba(52,226,160,.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', flex: 'none' }}><OnyxIcon emoji="💸" size={19} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{L('¿Quieres que te copien y cobrar por ello?', 'Want people to copy you and earn from it?')}</span>
          <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>{L('Ofrece tu tarjeta en Onyx Copy, entra al ranking y gana con cada seguidor.', 'List your card in Onyx Copy, join the ranking and earn from every follower.')}</span>
        </span>
        <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{L('Ir a Onyx Copy →', 'Go to Onyx Copy →')}</span>
      </Link>

      <p className="muted" style={{ fontSize: 11.5, marginTop: 14 }}>
        {L('Tu tarjeta es pública y verificable por cualquiera con el enlace. No entra al ranking de copia a menos que la ofrezcas en Onyx Copy.',
           'Your card is public and verifiable by anyone with the link. It does not enter the copy ranking unless you list it in Onyx Copy.')}
      </p>
    </div>
  );
}
