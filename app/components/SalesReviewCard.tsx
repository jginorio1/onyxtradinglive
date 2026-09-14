'use client';
import { useEffect, useState } from 'react';

// Tarjeta que pide al cliente una reseña de su asesor de ventas (interna).
// Se muestra sola si el cliente tiene vendedor asignado y ya toca pedirla.
export default function SalesReviewCard() {
  const [d, setD] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    try { const r = await fetch('/api/sales/review', { cache: 'no-store' }); const j = await r.json(); if (j.eligible) setD(j); } catch {}
  })(); }, []);

  if (!d || done) return null;

  async function send() {
    if (!rating) return; setBusy(true);
    try { await fetch('/api/sales/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rep_id: d.rep_id, rating, comment }) }); } catch {}
    setBusy(false); setDone(true);
  }

  return (
    <div style={{ background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tx,#e8ecf5)' }}>¿Cómo te ha atendido {d.rep_name || 'tu asesor'}?</div>
      <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>Tu opinión es privada y nos ayuda a mejorar la atención.</div>
      <div style={{ display: 'flex', gap: 4, margin: '12px 0' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, lineHeight: 1, color: (hover || rating) >= n ? '#e5b567' : 'var(--line,#3a4363)', padding: 0 }}
            aria-label={`${n} estrellas`}>{(hover || rating) >= n ? '★' : '☆'}</button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Cuéntanos por qué (opcional)"
        style={{ width: '100%', minHeight: 60, resize: 'vertical', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13.5 }} />
      <button onClick={send} disabled={!rating || busy} style={{ marginTop: 10, padding: '10px 18px', borderRadius: 10, border: 'none', background: rating ? 'var(--accent,#8b93ff)' : 'var(--line,#2a3350)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: rating ? 'pointer' : 'default', opacity: busy ? .6 : 1 }}>
        {busy ? 'Enviando…' : 'Enviar reseña'}
      </button>
    </div>
  );
}
