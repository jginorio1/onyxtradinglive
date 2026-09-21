'use client';
import { useState } from 'react';
import { useLang } from '@/lib/lang';

// Modal reutilizable de confirmación para acciones críticas del admin.
// Muestra qué se hará y (opcionalmente) exige una NOTA obligatoria que va al log.
export default function ConfirmNote({ act, onClose }: {
  act: { title: string; danger?: boolean; requireNote?: boolean; detail?: string; run: (note: string) => Promise<void> } | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const en = lang === 'en';
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!act) return null;
  const req = act.requireNote !== false; // por defecto la nota es obligatoria

  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 380, width: '100%', border: act.danger ? '1px solid var(--red)' : undefined }}>
        <div style={{ fontWeight: 700, marginBottom: act.detail ? 6 : 10, color: act.danger ? 'var(--red)' : undefined }}>{act.danger ? '⚠️ ' : ''}{act.title}</div>
        {act.detail && <div className="muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>{act.detail}</div>}
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{en ? `Note${req ? ' (required' : ' (optional'} — saved to the log)` : `Nota${req ? ' (obligatoria' : ' (opcional'} — queda en el registro)`}</div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={en ? 'Reason…' : 'Motivo…'} style={{ margin: '0 0 14px' }} />
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>{en ? 'Cancel' : 'Cancelar'}</button>
          <button className={act.danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy || (req && !note.trim())} style={{ opacity: (req && !note.trim()) ? .5 : 1 }}
            onClick={async () => { setBusy(true); try { await act.run(note.trim()); onClose(); } finally { setBusy(false); } }}>
            {busy ? '…' : (en ? 'Confirm' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
}
