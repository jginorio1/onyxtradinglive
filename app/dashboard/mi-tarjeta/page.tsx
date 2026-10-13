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

  async function load() {
    try {
      const r = await fetch('/api/copy/provider', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setAccounts(j.accounts || []); setProviders(j.providers || []); }
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  // Mi código de referido: así cada enlace que comparta capta referido (y me paga).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/referral', { cache: 'no-store' });
        const j = await r.json();
        if (r.ok && j?.enabled && j?.code) setRefCode(String(j.code));
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
      else await load();
    } catch { setErr(L('Error de red.', 'Network error.')); }
    setBusy('');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // El enlace compartido lleva mi ?ref para que, si el visitante se registra, se
  // atribuya a mí (cierra el bucle: comparto tarjeta → amigo entra → gano crédito).
  const urlFor = (id: string) => `${origin}/copy/t/${id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`;

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
      <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>{L('Mi tarjeta verificada', 'My verified card')}</h1>
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
              <div key={a.id} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{a.nickname || a.broker || L('Mi cuenta', 'My account')}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{[a.broker, a.platform].filter(Boolean).join(' · ')} · {a.connected ? L('conectada', 'connected') : L('sin conexión', 'offline')}</div>
                  </div>
                  {has && <div style={{ textAlign: 'right' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{p!.score}</div><div className="muted" style={{ fontSize: 10.5 }}>Onyx Score</div></div>}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {!has ? (
                    <button className="btn btn-primary" disabled={busy === a.id} onClick={() => generate(a.id)} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {busy === a.id ? L('Generando…', 'Generating…') : <><OnyxIcon emoji="🏅" size={14} /> {L('Generar mi tarjeta verificada', 'Generate my verified card')}</>}
                    </button>
                  ) : (
                    <>
                      <Link className="btn btn-primary" href={`/copy/t/${p!.id}`} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon emoji="👁" size={14} /> {L('Ver mi tarjeta', 'View my card')}</Link>
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

      {/* Puente hacia Onyx Copy: para quien quiere monetizar su track record. */}
      <Link href="/dashboard/onyx-copy" className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 18, textDecoration: 'none' }}>
        <OnyxIcon emoji="💸" size={14} /> {L('¿Quieres que te copien y cobrar por ello? Ofrécela en Onyx Copy →', 'Want people to copy you and earn from it? List it in Onyx Copy →')}
      </Link>

      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
        {L('Tu tarjeta es pública y verificable por cualquiera con el enlace. No entra al ranking de copia a menos que la ofrezcas en Onyx Copy.',
           'Your card is public and verifiable by anyone with the link. It does not enter the copy ranking unless you list it in Onyx Copy.')}
      </p>
    </div>
  );
}
