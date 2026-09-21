'use client';
import { useEffect, useState } from 'react';

// Banner del landing personalizado: si el visitante llega con ?sv=CODE, muestra
// "Te invita <vendedor>" con su foto y bio. Se cierra y no vuelve en la sesión.
export default function RepInviteBanner() {
  const [rep, setRep] = useState<any>(null);
  useEffect(() => {
    try {
      const sv = new URLSearchParams(window.location.search).get('sv');
      if (!sv) return;
      if (sessionStorage.getItem('onyx_inv_hide') === sv) return;
      fetch(`/api/sales/rep?code=${encodeURIComponent(sv)}`, { cache: 'no-store' })
        .then((r) => r.json()).then((j) => { if (j && j.ok) setRep({ ...j, code: sv }); }).catch(() => {});
    } catch {}
  }, []);
  if (!rep) return null;
  const close = () => { try { sessionStorage.setItem('onyx_inv_hide', rep.code); } catch {} setRep(null); };
  return (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 60, maxWidth: 440, margin: '0 auto',
      background: 'var(--panel,#161c2e)', border: '1px solid var(--accent,#8b93ff)', borderRadius: 14,
      padding: '12px 14px', boxShadow: '0 10px 40px rgba(0,0,0,.35)', display: 'flex', gap: 12, alignItems: 'center' }}>
      {rep.photo
        ? <img src={rep.photo} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
        : <div style={{ width: 46, height: 46, borderRadius: '50%', flex: 'none', background: 'var(--accent,#8b93ff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{(rep.name || '?').slice(0, 1).toUpperCase()}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--tx,#e8ecf5)' }}>Te invita <b>{rep.name}</b>, tu asesor Onyx.</div>
        {rep.bio && <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{rep.bio}</div>}
      </div>
      <button onClick={close} aria-label="Cerrar" style={{ flex: 'none', background: 'none', border: 'none', color: 'var(--mut,#9aa6bd)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
    </div>
  );
}
