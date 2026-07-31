'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import { useLang } from '@/lib/lang';
import QrPop from '@/app/components/QrPop';
import ShareRow from '@/app/components/ShareRow';

// "Invita y gana": el enlace propio del usuario común + sus estadísticas y el
// puente para hacerse Embajador. La recompensa es CRÉDITO en su cuenta.
export default function ReferralCard() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [d, setD] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetch('/api/referral').then((r) => r.json()).then(setD).catch(() => {}); }, []);
  if (!d || d.enabled === false) return null;

  const link = d.link || '';
  const L = (a: string, b: string) => (es ? a : b);
  const shareMsg = es
    ? `Estoy usando Onyx Trading Live para analizar mi trading. Únete con mi enlace y ambos ganamos crédito 👇`
    : `I'm using Onyx Trading Live to analyze my trading. Join with my link and we both get credit 👇`;
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }

  const toBridge = Math.max(0, (d.bridge || 0) - (d.qualified || 0));
  const pct = d.bridge ? Math.min(100, Math.round((d.qualified / d.bridge) * 100)) : 0;

  return (
    <div className="card" id="referidos" style={{ marginTop: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 15 }}><OnyxIcon emoji="🎁" size={16} /> {es ? 'Invita y gana' : 'Invite & earn'}</b>
        {(d.pending > 0 || d.applied > 0) && (
          <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>
            ${d.applied} {es ? 'en crédito' : 'credit'}{d.pending > 0 ? ` · $${d.pending} ${es ? 'en camino' : 'coming'}` : ''}
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {es
          ? `Comparte tu enlace. Cuando un amigo se suscribe, tú recibes $${d.referrerCredit} de crédito y él $${d.friendCredit}. Se aplica solo a la próxima factura tras ${d.holdDays} días.`
          : `Share your link. When a friend subscribes, you get $${d.referrerCredit} credit and they get $${d.friendCredit}. Applied automatically to the next invoice after ${d.holdDays} days.`}
      </p>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 200, margin: 0, fontSize: 13 }} />
        <button className="btn btn-primary" onClick={copy} style={{ minWidth: 96 }}>{copied ? (es ? '¡Copiado!' : 'Copied!') : (es ? 'Copiar' : 'Copy')}</button>
      </div>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <ShareRow link={link} message={shareMsg} L={L} title={es ? 'Onyx Trading Live' : 'Onyx Trading Live'} />
        <QrPop data={link} poster="referral" label={es ? 'QR / Póster' : 'QR / Poster'} title={es ? 'Únete y ganamos los dos' : 'Join and we both win'} />
      </div>

      <div className="grid g3" style={{ gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}><div className="muted" style={{ fontSize: 12 }}>{es ? 'Invitados' : 'Invited'}</div><div style={{ fontSize: 20, fontWeight: 600 }}>{d.invited}</div></div>
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}><div className="muted" style={{ fontSize: 12 }}>{es ? 'Ya pagaron' : 'Subscribed'}</div><div style={{ fontSize: 20, fontWeight: 600 }}>{d.qualified}</div></div>
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}><div className="muted" style={{ fontSize: 12 }}>{es ? 'Crédito total' : 'Total credit'}</div><div style={{ fontSize: 20, fontWeight: 600 }}>${(d.pending + d.applied).toFixed(2)}</div></div>
      </div>

      {d.bridge > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {toBridge > 0 ? (
            <>
              <div className="row between" style={{ fontSize: 12.5, marginBottom: 6 }}>
                <span className="muted">{es ? `Faltan ${toBridge} para hacerte Embajador (comisión en efectivo)` : `${toBridge} more to become an Ambassador (cash commission)`}</span>
                <span className="muted">{d.qualified}/{d.bridge}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: 'var(--grad)' }} /></div>
            </>
          ) : (
            <div className="row between" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft-brand)' }}><OnyxIcon emoji="🚀" size={16} /> {es ? '¡Ya puedes ser Embajador y cobrar en efectivo!' : 'You can become an Ambassador and earn cash!'}</span>
              <a className="btn btn-primary" href="/embajadores" style={{ fontSize: 13 }}>{es ? 'Hacerme Embajador' : 'Become Ambassador'}</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
