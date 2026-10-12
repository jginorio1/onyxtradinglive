'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import DemoFrame from '@/app/DemoFrame';
import { DEFAULT_HOWTO, HOWTO_IMG_V, type Cat } from '@/lib/howtoDefault';

// ─────────────────────────────────────────────────────────────────────────────
// CENTRO DE GUÍAS "Cómo usar Onyx" — estilo universidad por temas.
// Pantalla completa, bilingüe (ES/EN) y pensado para verse en TEMA OSCURO.
//
// Cada guía tiene pasos; cada paso lleva una CAPTURA LIMPIA (se sube por /public
// o por el editor) y las LÍNEAS/CÍRCULOS se dibujan POR ENCIMA con `markers`
// (coordenadas en % sobre la imagen). Así la foto nunca se edita y las marcas
// quedan bilingües y ajustables.
//
// Para añadir las fotos reales: sube los PNG a /public/guia-img/ con el nombre
// `img` de cada paso (p. ej. /public/guia-img/conectar-1.png). Mientras no exista
// la imagen, se muestra un marco con el nombre del archivo que falta.
// ─────────────────────────────────────────────────────────────────────────────


const IMG_V = HOWTO_IMG_V;

export default function ComoUsar() {
  const { lang } = useLang();
  const es = lang === 'es';
  const L = (a: string, b: string) => (es ? a : b);
  const [guideId, setGuideId] = useState('conectar-cuenta');
  const [step, setStep] = useState(0);
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  // Contenido de la guía: por defecto el del código, pero si el dueño la editó en
  // Admin → Cómo usar, servimos esa versión (guardada en la nube). Así se actualiza
  // sin desplegar.
  const [cats, setCats] = useState<Cat[]>(DEFAULT_HOWTO);
  useEffect(() => {
    let alive = true;
    fetch('/api/howto').then((r) => r.json()).then((j) => {
      if (alive && Array.isArray(j?.cats) && j.cats.length) setCats(j.cats);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const allGuides = cats.flatMap((c) => c.guides);
  const guide = allGuides.find((g) => g.id === guideId) || allGuides[0];
  const total = guide.steps.length;
  const st = guide.steps[Math.min(step, total - 1)];

  function open(id: string) { setGuideId(id); setStep(0); setZoom(false); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function go(i: number) { setStep(Math.max(0, Math.min(total - 1, i))); setZoom(false); }

  // Flechas del teclado ← → para avanzar/retroceder
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (showDemo) { if (e.key === 'Escape') setShowDemo(false); return; }
      if (zoom) { if (e.key === 'Escape') setZoom(false); return; }
      if (e.key === 'ArrowRight') setStep((s) => Math.min(total - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [total, zoom, showDemo]);

  // Bloquea el scroll del fondo mientras el demo está abierto en la capa.
  useEffect(() => {
    if (!showDemo) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showDemo]);

  const ql = q.trim().toLowerCase();
  const match = (g: Guide) => !ql || (es ? g.es : g.en).toLowerCase().includes(ql);

  return (
    <div className="onyx-guias">
      <style>{`
        .onyx-guias{min-height:100vh}
        .onyx-guias .inner{max-width:1720px;margin:0 auto;padding:26px 30px 70px}
        .onyx-guias .gcat{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);margin:16px 0 6px;font-weight:700}
        .onyx-guias .glink{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;border:none;cursor:pointer;color:var(--mut);font-size:14px;padding:9px 11px;border-radius:10px;transition:.15s;line-height:1.3}
        .onyx-guias .glink:hover{color:var(--tx);background:var(--card2)}
        .onyx-guias .glink.on{color:var(--tx);background:color-mix(in srgb,var(--brand) 16%,transparent);font-weight:600}
        .onyx-guias .glink .gi{display:inline-flex;color:var(--brand)}
        .onyx-guias .gwrap{display:grid;grid-template-columns:270px minmax(0,1fr) 236px;gap:28px;align-items:start;width:100%;max-width:none}
        @media(max-width:1200px){.onyx-guias .gwrap{grid-template-columns:250px minmax(0,1fr)}.onyx-guias .toc{display:none}}
        @media(max-width:900px){.onyx-guias .gwrap{grid-template-columns:1fr}.onyx-guias .side{position:static!important;max-height:none!important}.onyx-guias .inner{padding:22px 15px 60px}}
        .onyx-guias .stepnum{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:20px;display:grid;place-items:center;flex:none;box-shadow:0 8px 20px -6px rgba(255,120,40,.6)}
        .onyx-guias .shot{position:relative;border-radius:16px;border:1px solid var(--line);overflow:hidden;background:#0c0e15;cursor:zoom-in;box-shadow:0 24px 60px -26px rgba(0,0,0,.75)}
        .onyx-guias .shot img{display:block;width:100%;height:auto}
        /* Indicador = recuadro resaltado translúcido (no tapa el contenido) + numerito en el borde */
        .onyx-guias .mk{position:absolute;transform:translate(-50%,-50%);z-index:2;border:2px solid var(--brand);border-radius:9px;background:color-mix(in srgb,var(--brand) 12%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 20%,transparent);animation:mkpulse 1.9s ease-in-out infinite;pointer-events:none}
        @keyframes mkpulse{0%,100%{box-shadow:0 0 0 2px color-mix(in srgb,var(--brand) 16%,transparent)}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--brand) 7%,transparent)}}
        .onyx-guias .mk .badge{position:absolute;top:-11px;left:-11px;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:12px;display:grid;place-items:center;box-shadow:0 2px 7px rgba(0,0,0,.55)}
        .onyx-guias .legend{display:flex;flex-wrap:wrap;gap:14px 20px;margin-top:12px;padding:12px 15px;background:var(--card2);border:1px solid var(--line);border-radius:12px}
        .onyx-guias .leg{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--tx)}
        .onyx-guias .leg .ld{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:12px;display:grid;place-items:center;flex:none}
        .onyx-guias .bc{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut);margin-bottom:12px;flex-wrap:wrap}
        .onyx-guias .bc a{color:var(--brand);text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:5px;background:color-mix(in srgb,var(--brand) 12%,transparent);padding:5px 11px;border-radius:9px}
        .onyx-guias .bc .sep{opacity:.5}
        .onyx-guias .toc{position:sticky;top:20px;align-self:start}
        .onyx-guias .tocl{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:800;margin-bottom:12px}
        .onyx-guias .tocrow{display:flex;gap:11px;align-items:center;width:100%;text-align:left;background:transparent;border:none;cursor:pointer;padding:9px 0 9px 13px;color:var(--mut);transition:.15s;border-left:2px solid var(--line);line-height:1.35}
        .onyx-guias .tocrow:hover{color:var(--tx)}
        .onyx-guias .tocrow.on{color:var(--tx);border-left-color:var(--brand)}
        .onyx-guias .tocrow.done .tdot{background:var(--brand);border-color:var(--brand)}
        .onyx-guias .tdot{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);flex:none;font-size:9px;font-weight:800;display:grid;place-items:center;color:var(--bg);transition:.15s}
        .onyx-guias .tocrow.on .tdot{border-color:var(--brand);background:transparent;color:var(--brand)}
        .onyx-guias .tocrow .tt{font-size:12.5px;font-weight:600}
        .onyx-guias .zoomwrap{position:fixed;inset:0;z-index:70;background:rgba(3,4,8,.92);display:flex;align-items:center;justify-content:center;padding:28px;cursor:zoom-out;backdrop-filter:blur(4px)}
        .onyx-guias .zoomwrap .zbox{position:relative;max-width:1500px;width:100%;max-height:92vh}
        .onyx-guias .zoomwrap img{display:block;width:100%;height:auto;max-height:92vh;object-fit:contain;border-radius:12px;border:1px solid rgba(255,255,255,.12)}
        /* Botón cerrar circular, siempre visible */
        .onyx-guias .zclose{position:absolute;top:calc(16px + env(safe-area-inset-top));right:16px;width:50px;height:50px;border-radius:50%;background:rgba(10,12,18,.92);border:1.5px solid rgba(255,255,255,.38);color:#fff;font-size:23px;line-height:1;display:grid;place-items:center;cursor:pointer;z-index:10;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 10px 26px -6px rgba(0,0,0,.7);transition:.15s}
        .onyx-guias .zclose:hover{background:linear-gradient(135deg,#ffcf5c,#ff6a2b);border-color:transparent;color:#241002}
        .onyx-guias .zhint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-size:11.5px;color:rgba(255,255,255,.7);background:rgba(10,12,18,.7);padding:5px 12px;border-radius:20px;z-index:8}
        /* Barra de navegación móvil fija */
        .onyx-guias .mnav{display:none}
        @media(max-width:900px){
          .onyx-guias .inner{padding-bottom:86px!important}
          .onyx-guias .mnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(14,17,23,.97);border-top:1px solid var(--line);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
          .onyx-guias .mnav .mb{flex:1;max-width:130px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer}
          .onyx-guias .mnav .mb.ghost{background:#1a1f2b;color:var(--tx);border:1px solid var(--line)}
          .onyx-guias .mnav .mb.prim{background:linear-gradient(100deg,#ffcf5c,#ff6a2b);color:#241002;border:none}
          .onyx-guias .mnav .mb:disabled{opacity:.4}
          .onyx-guias .mnav .mc{font-size:13px;color:var(--mut);font-weight:800;min-width:50px;text-align:center}
          /* En la guía (móvil) ocultamos el chat y la flechita "subir":
             estorbaban los botones Atrás/Sig. de la barra inferior. Este
             <style> solo existe mientras la guía está montada, así que la
             regla no afecta a otras páginas. */
          .onyx-support-root,.onyx-backtotop{display:none!important}
          /* El pie de navegación interno (Anterior/Siguiente) se oculta en
             móvil: ya tenemos la barra fija abajo y duplicaba los botones. */
          .onyx-guias .gnav-desktop{display:none!important}
        }
      `}</style>

      <div className="inner">
        {/* ───── Portada: botón que abre el demo (el mismo del landing) ─────
            No incrustamos el panel para no empujar las guías abajo; un botón
            lo abre a pantalla completa en una capa. Reutiliza DemoFrame →
            ruta pública /demo, así no hay UI que mantener aparte. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px 18px', maxWidth: 820, margin: '0 auto 26px', padding: '16px 20px', border: '1px solid var(--line)', borderRadius: 16, background: 'var(--card)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>{L('¿Nuevo en Onyx? Pruébalo tú mismo', 'New to Onyx? Try it yourself')}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{L('Explora el panel real con datos de ejemplo, sin registrarte.', 'Explore the real panel with example data, no sign-up.')}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowDemo(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, whiteSpace: 'nowrap' }}>
            <OnyxIcon name="play" size={16} glow={false} /> {L('Abrir demo', 'Open demo')}
          </button>
        </div>

        <div className="gwrap">
          {/* ───── Columna 1: temas ───── */}
          <aside className="side card" style={{ padding: 14, alignSelf: 'start', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 34px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--tx)', padding: '2px 4px 12px' }}>
              <span style={{ color: 'var(--brand)' }}><OnyxIcon name="book" size={18} glow={false} /></span> {L('Centro de guías', 'Guide center')}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Buscar guía…', 'Search guide…')} style={{ width: '100%', fontSize: 13.5, marginBottom: 6 }} />
            {cats.map((c) => {
              const gs = c.guides.filter(match);
              if (!gs.length) return null;
              return (
                <div key={c.es}>
                  <div className="gcat">{L(c.es, c.en)}</div>
                  {gs.map((g) => (
                    <button key={g.id} className={'glink' + (g.id === guideId ? ' on' : '')} onClick={() => open(g.id)}>
                      <span className="gi"><OnyxIcon name={g.icon} size={17} glow={false} /></span>{L(g.es, g.en)}
                    </button>
                  ))}
                </div>
              );
            })}
            <Link href="/guia" className="btn btn-ghost" style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: 13 }}>{L('Ver la guía completa', 'See full guide')}</Link>
          </aside>

          {/* ───── Columna 2: un paso a la vez ───── */}
          <main style={{ minWidth: 0 }}
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              if (touchX.current == null || touchY.current == null || zoom) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              const dy = e.changedTouches[0].clientY - touchY.current;
              if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0) go(step + 1); else go(step - 1); }
              touchX.current = null; touchY.current = null;
            }}>
            {/* Miga de pan: volver a la Guía desde cualquier paso */}
            <div className="bc">
              <Link href="/guia">← {L('Guía', 'Guide')}</Link>
              <span className="sep">/</span><span>{L('Cómo usar', 'How to use')}</span>
              <span className="sep">/</span><span style={{ color: 'var(--tx)', fontWeight: 600 }}>{L(guide.es, guide.en)}</span>
            </div>

            {/* Cabecera del paso */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
              <span className="stepnum">{step + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 2 }}>{L('Paso', 'Step')} {step + 1} {L('de', 'of')} {total} · ~{guide.mins} min</div>
                <h1 style={{ margin: 0, fontSize: 27, letterSpacing: '-.4px' }}>{L(st.es, st.en)}</h1>
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {guide.steps.map((_, i) => (
                <span key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i <= step ? 'var(--brand)' : 'var(--line)', transition: '.2s' }} />
              ))}
            </div>

            {/* Imagen grande (clic para ampliar) */}
            <div className="shot" onClick={() => setZoom(true)} title={L('Pulsa para ampliar', 'Click to enlarge')}>
              <img src={'/' + st.img + '?v=' + IMG_V} alt={L(st.es, st.en)}
                   onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; (t.nextElementSibling as HTMLElement).style.display = 'flex'; }} />
              <div style={{ display: 'none', minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--mut)', fontSize: 14, padding: 24, textAlign: 'center' }}>
                <span><OnyxIcon emoji="🖼️" size={24} glow={false} /> {L('Falta la captura', 'Screenshot pending')}: <code className="code">/public/{st.img}</code></span>
              </div>
              {/* Los marcadores van horneados en la propia imagen (alineación perfecta). La leyenda numerada va debajo. */}
            </div>
            {/* Leyenda numerada DEBAJO de la foto: nunca tapa el contenido */}
            {st.markers && st.markers.length > 0 && (
              <div className="legend">
                {st.markers.map((m, j) => (
                  <span key={j} className="leg"><span className="ld">{m.n ?? j + 1}</span> {L(m.es, m.en)}</span>
                ))}
              </div>
            )}
            <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>{L('Pulsa la imagen para ampliarla · usa ← → para navegar', 'Click the image to enlarge · use ← → to navigate')}</div>

            {/* Descripción */}
            <p style={{ fontSize: 16.5, lineHeight: 1.75, color: 'var(--tx)', marginTop: 18, maxWidth: 940, whiteSpace: 'pre-line' }}>{L(st.des_es, st.des_en)}</p>

            {/* Navegación (se oculta en móvil: abajo ya está la barra fija .mnav) */}
            <div className="row between gnav-desktop" style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)', alignItems: 'center' }}>
              <button className="btn btn-ghost" disabled={step === 0} onClick={() => go(step - 1)} style={{ fontSize: 13.5 }}>← {L('Anterior', 'Previous')}</button>
              <Link href="/guia" className="muted" style={{ fontSize: 11.5, textDecoration: 'none' }}>{L('¿Dudas? Lee los artículos o pregúntale a Onyx →', 'Questions? Read the articles or ask Onyx →')}</Link>
              {step < total - 1
                ? <button className="btn btn-primary" onClick={() => go(step + 1)} style={{ fontSize: 13.5 }}>{L('Siguiente', 'Next')} →</button>
                : <Link href="/dashboard" className="btn btn-primary" style={{ fontSize: 13.5 }}>{L('Ir a mi panel', 'Go to my panel')} →</Link>}
            </div>
          </main>

          {/* ───── Columna 3: riel de pasos (cambia el paso al instante) ───── */}
          <nav className="toc">
            <div className="tocl">{L('Pasos', 'Steps')} · {step + 1}/{total}</div>
            {guide.steps.map((s, i) => (
              <button key={i} className={'tocrow' + (i === step ? ' on' : '') + (i < step ? ' done' : '')} onClick={() => go(i)}>
                <span className="tdot">{i < step ? '✓' : i + 1}</span>
                <span className="tt">{L(s.es, s.en)}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Barra de navegación fija (solo móvil): botones grandes + contador */}
      <div className="mnav">
        <button className="mb ghost" disabled={step === 0} onClick={() => go(step - 1)}>‹ {L('Atrás', 'Back')}</button>
        <span className="mc">{step + 1} / {total}</span>
        {step < total - 1
          ? <button className="mb prim" onClick={() => go(step + 1)}>{L('Sig.', 'Next')} ›</button>
          : <Link href="/dashboard" className="mb prim" style={{ textDecoration: 'none' }}>{L('Panel', 'Panel')} ›</Link>}
      </div>

      {/* Lightbox a tamaño completo */}
      {zoom && (
        <div className="zoomwrap" onClick={() => setZoom(false)}>
          <div className="zbox" onClick={(e) => e.stopPropagation()}>
            <img src={'/' + st.img + '?v=' + IMG_V} alt={L(st.es, st.en)} />
          </div>
          <button className="zclose" aria-label={L('Cerrar', 'Close')} onClick={(e) => { e.stopPropagation(); setZoom(false); }}>✕</button>
          <div className="zhint">{L('Toca fuera o pulsa Esc para cerrar', 'Tap outside or press Esc to close')}</div>
        </div>
      )}

      {/* Demo a pantalla completa (capa): se abre con el botón de la portada.
          Reutiliza DemoFrame → /demo. Cerrar con la ✕ o pulsando Esc. */}
      {showDemo && (
        <div
          onClick={() => setShowDemo(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(6,8,13,.86)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: '14px', gap: 10 }}
        >
          <div className="row between" style={{ alignItems: 'center', flex: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, color: '#fff' }}>
              <OnyxIcon name="play" size={17} glow={false} /> {L('Demo interactivo', 'Interactive demo')}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDemo(false); }}
              aria-label={L('Cerrar demo y volver a la guía', 'Close demo and return to the guide')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: '#2a1e02', background: 'linear-gradient(100deg,#ffe08a,#e8b923)', border: 'none', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', boxShadow: '0 8px 22px -6px rgba(0,0,0,.6)' }}
            >
              ✕ {L('Cerrar y volver a la guía', 'Close and back to guide')}
            </button>
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, minHeight: 0, display: 'flex', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.14)' }}>
            <iframe
              src="/demo"
              title={L('Demo interactivo de Onyx', 'Interactive Onyx demo')}
              style={{ width: '100%', height: '100%', border: 0, background: 'var(--bg2)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
