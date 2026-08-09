'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// ============================================================
// SectionCard · tarjeta compacta que, al pincharla, abre un popup con el
// contenido completo (editar / ver). Se usa en el panel del mentor para que los
// tabs (Cobros, Ajustes, Correos) no se estiren hacia abajo.
// ============================================================
export default function SectionCard({ icon, title, summary, badge, children, wide }: {
  icon?: string; title: string; summary?: string; badge?: { text: string; tone?: 'ok' | 'off' | 'brand' };
  children: any; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toneColor = badge?.tone === 'ok' ? { bg: 'rgba(35,197,120,.15)', fg: 'var(--green)' }
    : badge?.tone === 'off' ? { bg: 'var(--card2)', fg: 'var(--mut)' }
    : { bg: 'rgba(124,140,255,.15)', fg: 'var(--brand)' };

  return (
    <>
      <button onClick={() => setOpen(true)} className="sk-card" style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid var(--line)', background: 'var(--card)',
      }}>
        <span style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,140,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--brand)' }}>
          <OnyxIcon name={icon || 'card'} size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 15 }}>{title}</b>
            {badge && <span style={{ fontSize: 11, background: toneColor.bg, color: toneColor.fg, padding: '2px 8px', borderRadius: 999 }}>{badge.text}</span>}
          </span>
          {summary && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mut)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>}
        </span>
        <span style={{ color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none', fontSize: 12.5 }}>✎ ›</span>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 900, padding: '5vh 16px', overflowY: 'auto' }} onClick={() => setOpen(false)}>
          <div className="sk-card" style={{ width: '100%', maxWidth: wide ? 720 : 520, margin: 'auto 0' }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <b style={{ fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name={icon || 'card'} size={18} /></span>{title}</b>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setOpen(false)}>✕</button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
