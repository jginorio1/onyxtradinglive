'use client';
import { useEffect, useRef, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import { shareImage, saveImage, openExternal } from '@/lib/nativeShare';

// ============================================================
// Compartir el rendimiento del trader desde el dashboard, SIN salir de Onyx.
// Genera una tarjeta profesional (canvas) con marca de agua Onyx, lista para
// redes: Compartir (Web Share en móvil / copiar en PC), Descargar imagen,
// Imprimir/PDF y Ver reporte completo. Interruptor $ / % para no exponer montos.
// ============================================================

type Summary = {
  name: string; avatar: string; style: string; currency: string; from: string; to: string;
  net: number; pct: number; winRate: number; pf: number; trades: number; best: number; worst: number; equity: number[];
};

export default function ShareReport({
  lang = 'es', from, to, pdfHref,
}: { lang?: string; from: string; to: string; pdfHref: string }) {
  const es = lang !== 'en';
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [showMoney, setShowMoney] = useState(false); // por defecto solo %
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState('');
  const cvRef = useRef<HTMLCanvasElement | null>(null);

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 1800); };
  const jsonHref = `/api/dashboard/report?export=json&from=${from}&to=${to}&lang=${lang}`;
  // Abrir el reporte/PDF: en la app usa el navegador del sistema (un <a target=_blank>
  // no siempre abre dentro del WebView). En web abre pestaña nueva.
  const openReport = () => openExternal(pdfHref.startsWith('http') ? pdfHref : (typeof location !== 'undefined' ? location.origin : '') + pdfHref);

  useEffect(() => {
    if (!open || data) return;
    setFailed(false);
    fetch(jsonHref)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then((d) => { if (d && typeof d.net === 'number') setData(d); else setFailed(true); })
      .catch(() => setFailed(true));
  }, [open]);

  // Redibuja la tarjeta cada vez que cambian los datos o el modo $/%.
  useEffect(() => { if (open && data) buildCard().then((u) => u && setPreview(u)); }, [open, data, showMoney]);

  const money = (v: number) => (v < 0 ? '-' : '+') + (data?.currency || 'USD') + ' ' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const pctS = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

  function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }

  // Compone el PNG de marca (fondo Onyx + KPIs + mini curva + marca de agua).
  async function buildCard(): Promise<string | null> {
    const d = data; if (!d) return null;
    const W = 1080, H = 1080, cv = cvRef.current || document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); if (!ctx) return null;
    const up = d.net >= 0;
    const GREEN = '#34e2a0', RED = '#ff6b6b', INK = '#0b1020', MUT = '#8891c9', TXT = '#eef1ff';
    // Fondo degradado Onyx.
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#141a30');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Halo suave.
    const rad = ctx.createRadialGradient(W * 0.8, 120, 40, W * 0.8, 120, 640);
    rad.addColorStop(0, 'rgba(124,140,255,.18)'); rad.addColorStop(1, 'rgba(124,140,255,0)');
    ctx.fillStyle = rad; ctx.fillRect(0, 0, W, H);

    const M = 88;
    // Marca de agua sutil (logo + nombre arriba a la izquierda).
    ctx.save();
    ctx.fillStyle = '#7c8cff'; roundRect(ctx, M, M, 44, 44, 12); ctx.fill();
    ctx.fillStyle = TXT; ctx.font = '600 34px Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText('Onyx Trading Live', M + 60, M + 22);
    ctx.restore();
    // Período (derecha).
    ctx.textAlign = 'right'; ctx.fillStyle = MUT; ctx.font = '400 26px Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtPeriod(d.from, d.to, es), W - M, M + 22);
    ctx.textAlign = 'left';

    // Nombre + estilo.
    let y = M + 120;
    try { if (d.avatar) { const a = await loadImg(d.avatar); ctx.save(); ctx.beginPath(); ctx.arc(M + 30, y + 26, 30, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(a, M, y - 4, 60, 60); ctx.restore(); } } catch {}
    const nx = d.avatar ? M + 76 : M;
    ctx.fillStyle = TXT; ctx.font = '600 40px Arial, sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText((d.name || (es ? 'Mi rendimiento' : 'My performance')).slice(0, 26), nx, y + 34);
    if (d.style) { ctx.fillStyle = MUT; ctx.font = '400 26px Arial, sans-serif'; ctx.fillText(d.style, nx, y + 66); }

    // Cifra grande (según modo).
    y += 150;
    ctx.fillStyle = MUT; ctx.font = '500 30px Arial, sans-serif';
    ctx.fillText(es ? 'Resultado del período' : 'Period result', M, y);
    y += 96;
    ctx.fillStyle = up ? GREEN : RED; ctx.font = '700 130px Arial, sans-serif';
    ctx.fillText(showMoney ? money(d.net) : pctS(d.pct), M, y);

    // Mini curva de equity.
    y += 70;
    const eq = d.equity || [];
    if (eq.length > 1) {
      const cw = W - M * 2, ch = 150, cx = M, cy = y;
      const mn = Math.min(0, ...eq), mx = Math.max(0, ...eq), span = (mx - mn) || 1;
      ctx.strokeStyle = up ? GREEN : RED; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath();
      eq.forEach((v, i) => {
        const px = cx + (i / (eq.length - 1)) * cw;
        const py = cy + ch - ((v - mn) / span) * ch;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
      y += ch + 60;
    } else { y += 40; }

    // KPIs en fila (tarjetas).
    const kpis: [string, string][] = [
      [es ? 'Aciertos' : 'Win rate', d.winRate + '%'],
      [es ? 'Factor' : 'Profit factor', String(d.pf)],
      [es ? 'Operaciones' : 'Trades', String(d.trades)],
    ];
    const gap = 26, cardW = (W - M * 2 - gap * 2) / 3, cardH = 150;
    kpis.forEach(([lab, val], i) => {
      const x = M + i * (cardW + gap);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; roundRect(ctx, x, y, cardW, cardH, 20); ctx.fill();
      ctx.fillStyle = TXT; ctx.font = '600 56px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(val, x + cardW / 2, y + 78);
      ctx.fillStyle = MUT; ctx.font = '400 26px Arial, sans-serif'; ctx.fillText(lab, x + cardW / 2, y + 118);
      ctx.textAlign = 'left';
    });

    // Pie: web + aviso.
    ctx.fillStyle = MUT; ctx.font = '500 28px Arial, sans-serif';
    ctx.fillText('onyxtradinglive.com', M, H - M);
    ctx.textAlign = 'right'; ctx.fillStyle = '#5a628f'; ctx.font = '400 22px Arial, sans-serif';
    ctx.fillText(es ? 'Histórico · no garantiza resultados' : 'Historical · not a guarantee', W - M, H - M);
    ctx.textAlign = 'left';

    return cv.toDataURL('image/png');
  }

  async function blobFromCanvas(): Promise<Blob | null> {
    await buildCard();
    return await new Promise<Blob | null>((res) => (cvRef.current || document.createElement('canvas')).toBlob((b) => res(b), 'image/png'));
  }
  const shareUrl = typeof location !== 'undefined' ? location.origin : 'https://onyxtradinglive.com';
  async function download() {
    const b = await blobFromCanvas(); if (!b) { flash(es ? 'No se pudo generar' : 'Could not generate'); return; }
    const r = await saveImage(b, `onyx-rendimiento-${from}.png`, { title: 'Onyx Trading Live', text: es ? 'Mi rendimiento' : 'My performance', url: shareUrl });
    if (r === 'downloaded') flash(es ? 'Imagen descargada' : 'Image downloaded');
    else if (r === 'error') flash(es ? 'No se pudo compartir' : 'Could not share');
  }
  async function share() {
    const b = await blobFromCanvas(); if (!b) { flash(es ? 'No se pudo generar' : 'Could not generate'); return; }
    const r = await shareImage(b, 'onyx-rendimiento.png', { title: 'Onyx Trading Live', text: es ? 'Mi rendimiento en Onyx Trading Live' : 'My performance on Onyx Trading Live', url: shareUrl });
    if (r === 'error') flash(es ? 'No se pudo compartir' : 'Could not share');
    else if (r === 'downloaded') flash(es ? 'Imagen descargada' : 'Image downloaded');
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title={es ? 'Compartir mi rendimiento' : 'Share my performance'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#fff', background: 'linear-gradient(135deg,#4b3ff0,#7c8cff)', border: 'none', borderRadius: 9, padding: '7px 13px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
        <OnyxIcon emoji="📤" size={15} /> {es ? 'Compartir' : 'Share'}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, padding: 16 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><OnyxIcon emoji="📤" size={15} /> {es ? 'Compartir mi rendimiento' : 'Share my performance'}</div>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: '4px 10px' }}>✕</button>
            </div>

            {failed ? (
              <div style={{ textAlign: 'center', padding: '24px 6px' }}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{es ? 'No se pudo preparar la tarjeta. Puedes ver el reporte completo:' : 'Could not prepare the card. You can view the full report:'}</div>
                <button className="btn btn-primary" onClick={openReport}>{es ? 'Ver reporte' : 'View report'}</button>
              </div>
            ) : !data ? (
              <div className="muted" style={{ textAlign: 'center', padding: '30px 0', fontSize: 13 }}>{es ? 'Preparando tu tarjeta…' : 'Preparing your card…'}</div>
            ) : (<>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: '#0b1020' }}>
                {preview
                  ? <img src={preview} alt="preview" style={{ width: '100%', display: 'block' }} />
                  : <div style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', color: '#8891c9', fontSize: 12 }}>…</div>}
              </div>

              {/* $ / % */}
              <div className="row between" style={{ gap: 10, marginTop: 12, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg2)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{showMoney ? (es ? 'Mostrando montos $' : 'Showing $ amounts') : (es ? 'Solo porcentaje %' : 'Percent only %')}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{es ? 'Protege tus montos reales al compartir.' : 'Hide real amounts when sharing.'}</div>
                </div>
                <span className="toggle" onClick={() => setShowMoney((v) => !v)} style={{ background: showMoney ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: showMoney ? 21 : 3 }} /></span>
              </div>

              {/* Acciones */}
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-primary" onClick={share}><OnyxIcon emoji="📤" size={15} /> {es ? 'Compartir' : 'Share'}</button>
                <button className="btn btn-ghost" onClick={download}><OnyxIcon emoji="⬇" size={15} /> {es ? 'Imagen' : 'Image'}</button>
                <button className="btn btn-ghost" onClick={openReport}><OnyxIcon emoji="🖨️" size={15} /> {es ? 'Imprimir / PDF' : 'Print / PDF'}</button>
              </div>
              {note && <div className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 8, color: 'var(--green)' }}>{note}</div>}
            </>)}
            <canvas ref={cvRef} style={{ display: 'none' }} />
          </div>
        </div>
      )}
    </>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fmtPeriod(from: string, to: string, es: boolean): string {
  const f = (s: string) => { const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' }); };
  try { return f(from) + ' – ' + f(to); } catch { return from + ' – ' + to; }
}
