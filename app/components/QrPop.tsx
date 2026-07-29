'use client';
import { useState } from 'react';
import { useLang } from '@/lib/lang';

// Botón reutilizable de "QR": abre una ventanita con el código QR de un enlace,
// permite descargar el QR y, para referido/embajador, un PÓSTER de marca listo
// para compartir en historias. El póster se compone en el navegador (canvas),
// así las fuentes siempre se renderizan.
export default function QrPop({ data, title, handle, poster = 'generic', label }: {
  data: string; title?: string; handle?: string; poster?: 'referral' | 'ambassador' | 'generic'; label?: string;
}) {
  const { lang } = useLang();
  const es = lang !== 'en';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qrSvg = `/api/qr?data=${encodeURIComponent(data)}&size=240`;
  const qrPng = `/api/qr?data=${encodeURIComponent(data)}&fmt=png&size=600&download=1`;
  const showPoster = poster !== 'generic';

  async function downloadPoster() {
    setBusy(true);
    try {
      const W = 1080, H = 1350;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d')!;
      // Fondo oscuro Onyx
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0c1226'); grad.addColorStop(1, '#161d33');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(124,140,255,.12)'; g.fillRect(0, 0, W, 10);
      // Marca
      g.fillStyle = '#9aa4ff'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('ONYX TRADING LIVE', W / 2, 120);
      // Título
      g.fillStyle = '#ffffff'; g.font = '800 66px system-ui, sans-serif';
      const t = title || (poster === 'ambassador' ? (es ? 'Únete con mi enlace' : 'Join with my link') : (es ? 'Únete y ganamos los dos' : 'Join and we both win'));
      wrap(g, t, W / 2, 230, 900, 74);
      // QR en tarjeta blanca
      const box = 620, bx = (W - box) / 2, by = 430;
      roundRect(g, bx, by, box, box, 40); g.fillStyle = '#ffffff'; g.fill();
      const img = await loadImg(`/api/qr?data=${encodeURIComponent(data)}&fmt=png&size=520&fg=0b1020`);
      g.drawImage(img, bx + 50, by + 50, box - 100, box - 100);
      // Handle
      if (handle) { g.fillStyle = '#9aa4ff'; g.font = '600 40px system-ui, sans-serif'; g.fillText(handle, W / 2, by + box + 90); }
      // Pie
      g.fillStyle = '#c7ccd6'; g.font = '500 36px system-ui, sans-serif';
      g.fillText(es ? 'Escanéame · onyxtradinglive.com' : 'Scan me · onyxtradinglive.com', W / 2, H - 80);

      await new Promise<void>((res) => c.toBlob((b) => {
        if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'onyx-invita.png'; a.click(); }
        res();
      }, 'image/png'));
    } finally { setBusy(false); }
  }

  return (
    <>
      <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>📱 {label || 'QR'}</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <b style={{ fontSize: 14 }}>{es ? 'Tu código QR' : 'Your QR code'}</b>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mut)', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 14, display: 'inline-block' }}>
              <img src={qrSvg} alt="QR" width={220} height={220} style={{ display: 'block' }} />
            </div>
            <div className="muted" style={{ fontSize: 11.5, margin: '10px 0', wordBreak: 'break-all' }}>{data}</div>
            <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" style={{ fontSize: 13 }} href={qrPng}>⬇ {es ? 'QR' : 'QR'}</a>
              {showPoster && <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={downloadPoster} disabled={busy}>{busy ? '…' : (es ? '⬇ Póster' : '⬇ Poster')}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrap(g: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number) {
  const words = text.split(' '); let line = ''; let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, cx, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) g.fillText(line, cx, yy);
}
