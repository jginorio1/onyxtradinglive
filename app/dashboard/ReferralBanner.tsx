'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Banner compacto de "Invita y gana" para el dashboard: una línea, copiar enlace
// y acceso a la sección completa. Discreto, no intrusivo.
export default function ReferralBanner() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [d, setD] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetch('/api/referral').then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  if (!d || d.enabled === false || !d.link) return null;

  async function copy() { try { await navigator.clipboard.writeText(d.link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }

  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderLeft: '3px solid var(--brand)' }}>
      <span style={{ display: 'inline-flex', color: 'var(--gold)' }}><OnyxIcon emoji="🎁" size={22} /></span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{es ? `Invita y gana $${d.referrerCredit} en crédito` : `Invite & earn $${d.referrerCredit} credit`}</div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {es ? `Tu amigo también recibe $${d.friendCredit}.` : `Your friend also gets $${d.friendCredit}.`}
          {(d.pending > 0 || d.applied > 0) && <span style={{ color: 'var(--soft-green)' }}> {es ? 'Ya llevas' : 'You have'} ${(d.pending + d.applied).toFixed(2)}.</span>}
        </div>
      </div>
      <button className="btn btn-primary" onClick={copy} style={{ fontSize: 13 }}>{copied ? (es ? '¡Copiado!' : 'Copied!') : (es ? 'Copiar enlace' : 'Copy link')}</button>
      <Link className="btn btn-ghost" href="/account#referidos" style={{ fontSize: 13 }}>{es ? 'Ver más' : 'See more'}</Link>
    </div>
  );
}
