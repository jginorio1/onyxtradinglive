'use client';
import { useEffect, useRef, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import { shareLink, shareImage, saveImage } from '@/lib/nativeShare';

// Compartir tu trackrecord desde el saludo del dashboard: activar/desactivar la
// página pública, copiar el enlace, abrir el QR (escanear/copiar/descargar con
// marca de agua Onyx) y compartir (Web Share en móvil; copia en PC).
export default function TrackShare({ lang = 'es', name = '' }: { lang?: string; name?: string }) {
  const es = lang !== 'en';
  const [prof, setProf] = useState<{ id: string; on: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const cvRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch('/api/account').then((r) => r.json()).then((d) => {
      const p = d?.profile || d; if (p?.id) setProf({ id: p.id, on: !!p.public_track });
    }).catch(() => {});
  }, []);

  if (!prof) return null;
  const url = (typeof window !== 'undefined' ? window.location.origin : '') + '/u/' + prof.id;
  const qrSrc = `/api/qr?data=${encodeURIComponent(url)}&size=520&fg=0b1020&bg=ffffff`;
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 1800); };

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const r = await fetch('/api/account', { method: 'PATCH', body: JSON.stringify({ public_track: next }) });
      if (r.ok) setProf((o) => o && { ...o, on: next });
    } finally { setBusy(false); }
  }
  async function copyLink() { try { await navigator.clipboard.writeText(url); flash(es ? 'Enlace copiado' : 'Link copied'); } catch {} }
  async function share() {
    const r = await shareLink({ title: 'Onyx Trading', text: es ? 'Mi trackrecord real' : 'My real trackrecord', url });
    if (r === 'copied') flash(es ? 'Enlace copiado' : 'Link copied');
  }

  // Compone un PNG de marca (tarjeta blanca + logo + QR + url) para descargar/copiar.
  function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  async function buildBranded(): Promise<Blob | null> {
    const W = 640, H = 780;
    const cv = cvRef.current || document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); if (!ctx) return null;
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
    // Tarjeta blanca
    const pad = 36; const cw = W - pad * 2;
    ctx.fillStyle = '#ffffff'; ctx.beginPath();
    const r = 28, x = pad, y = pad, w = cw, h = H - pad * 2;
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
    // Encabezado (logo + marca)
    try { const logo = await loadImg('/onyx-symbol.png'); ctx.drawImage(logo, pad + 26, pad + 30, 40, 40); } catch {}
    ctx.fillStyle = '#0b1020'; ctx.font = '700 26px Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('Onyx Trading Live', pad + 78, pad + 50);
    ctx.fillStyle = '#64748b'; ctx.font = '400 15px Arial, sans-serif';
    ctx.fillText(es ? 'Trackrecord verificado' : 'Verified trackrecord', pad + 78, pad + 74);
    // QR
    try {
      const qr = await loadImg(qrSrc);
      const q = 400, qx = W / 2 - q / 2, qy = pad + 110;
      ctx.drawImage(qr, qx, qy, q, q);
    } catch {}
    // Nombre + URL
    ctx.textAlign = 'center';
    if (name) { ctx.fillStyle = '#0b1020'; ctx.font = '700 22px Arial, sans-serif'; ctx.fillText(name, W / 2, pad + 110 + 400 + 34); }
    ctx.fillStyle = '#4f46e5'; ctx.font = '600 17px Arial, sans-serif';
    ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, pad + 110 + 400 + (name ? 64 : 40));
    ctx.fillStyle = '#94a3b8'; ctx.font = '400 13px Arial, sans-serif';
    ctx.fillText(es ? 'Escanéame para ver el historial real' : 'Scan me to see the real trackrecord', W / 2, H - pad - 26);
    ctx.textAlign = 'left';
    return await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/png'));
  }
  async function downloadQR() {
    const b = await buildBranded(); if (!b) { flash(es ? 'No se pudo generar' : 'Could not generate'); return; }
    const r = await saveImage(b, 'onyx-trackrecord-qr.png', { title: 'Onyx Trading', text: es ? 'Mi trackrecord' : 'My trackrecord' });
    if (r === 'downloaded') flash(es ? 'Imagen descargada' : 'Image downloaded');
    else if (r === 'shared') flash(es ? 'Listo' : 'Done');
  }
  async function shareQR() {
    const b = await buildBranded(); if (!b) { flash(es ? 'No se pudo generar' : 'Could not generate'); return; }
    await shareImage(b, 'onyx-trackrecord-qr.png', { title: 'Onyx Trading', text: es ? 'Mi trackrecord real' : 'My real trackrecord' });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title={es ? 'Compartir mi trackrecord' : 'Share my trackrecord'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.12)', border: '1px solid rgba(124,140,255,.35)', borderRadius: 999, padding: '4px 11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <OnyxIcon emoji="📈" size={15} /> {es ? 'Trackrecord' : 'Trackrecord'}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, padding: 18 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><OnyxIcon emoji="📈" size={15} /> {es ? 'Mi trackrecord público' : 'My public trackrecord'}</div>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: '4px 10px' }}>✕</button>
            </div>

            {/* Activar */}
            <div className="row between" style={{ gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{prof.on ? (es ? 'Activo' : 'Active') : (es ? 'Desactivado' : 'Off')}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{es ? 'Enciéndelo para tener tu enlace público.' : 'Turn it on to get your public link.'}</div>
              </div>
              <span className="toggle" onClick={() => !busy && toggle(!prof.on)} style={{ background: prof.on ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: prof.on ? 21 : 3 }} /></span>
            </div>

            {prof.on && (<>
              {/* Enlace */}
              <div className="row" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
                <input value={url} readOnly onFocus={(e) => e.currentTarget.select()} style={{ margin: 0, flex: 1, fontSize: 12.5 }} />
                <button className="btn btn-ghost" onClick={copyLink}>{es ? 'Copiar' : 'Copy'}</button>
              </div>

              {/* QR */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}>
                <img src={qrSrc} alt="QR" width={190} height={190} style={{ borderRadius: 14, background: '#fff', padding: 10, border: '1px solid var(--line)' }} />
              </div>

              <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={downloadQR}><OnyxIcon emoji="⬇" size={15} /> {es ? 'Descargar QR' : 'Download QR'}</button>
                <button className="btn btn-ghost" onClick={shareQR}><OnyxIcon emoji="🖼️" size={15} /> {es ? 'Compartir QR' : 'Share QR'}</button>
                <button className="btn btn-primary" onClick={share}><OnyxIcon emoji="📤" size={15} /> {es ? 'Compartir enlace' : 'Share link'}</button>
                <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">{es ? 'Ver' : 'View'}</a>
              </div>
              {note && <div className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 8, color: 'var(--green)' }}>{note}</div>}
              <canvas ref={cvRef} style={{ display: 'none' }} />
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
