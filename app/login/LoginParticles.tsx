'use client';
import { useEffect, useRef } from 'react';

// Fondo de PUNTOS FLOTANDO LIBRES por toda la pantalla, SOLO en login/registro:
// cada punto tiene su propia deriva lenta (con profundidad z). Cuando dos quedan
// cerca se UNEN con una línea; al alejarse, la línea se SUELTA. Así la malla se
// arma y desarma sola, despacio. Va en su propio <canvas> detrás de la caja → su
// propia capa: NO parpadea el resto. Respeta prefers-reduced-motion (fija).
export default function LoginParticles() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const x = c.getContext('2d'); if (!x) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const ORANGE = ['#ff7a1a', '#ff9d3d', '#ff6a2b', '#ffbf40'];
    const TEAL = '#34e2a0';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, pts: any[] = [], raf = 0;

    function build() {
      W = c!.width = Math.floor(window.innerWidth * DPR);
      H = c!.height = Math.floor(window.innerHeight * DPR);
      c!.style.width = window.innerWidth + 'px';
      c!.style.height = window.innerHeight + 'px';
      const n = Math.round(window.innerWidth * window.innerHeight / 34000); // algunos puntos más
      pts = [];
      for (let i = 0; i < n; i++) {
        const teal = Math.random() < 0.12;
        pts.push({
          x: Math.random() * W, y: Math.random() * H, z: Math.random(), // z: profundidad 0..1
          vx: (Math.random() - 0.5) * 0.14 * DPR, vy: (Math.random() - 0.5) * 0.14 * DPR,
          vz: (Math.random() - 0.5) * 0.0006,
          col: teal ? TEAL : ORANGE[(Math.random() * ORANGE.length) | 0], teal,
        });
      }
    }

    function frame() {
      x!.clearRect(0, 0, W, H);
      // mover (lento) + rebote suave en los bordes + deriva de profundidad
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        if (p.z < 0.15 || p.z > 1) { p.vz *= -1; p.z = Math.max(0.15, Math.min(1, p.z)); }
      }
      // líneas: se unen al acercarse, se sueltan al alejarse (según distancia)
      const LINK = 95 * DPR; // uniones cortas: algunas líneas más
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < LINK) {
            x!.globalAlpha = (1 - d / LINK) * 0.5 * Math.min(a.z, b.z);
            x!.strokeStyle = '#ff8a3a'; x!.lineWidth = 0.6 * DPR;
            x!.beginPath(); x!.moveTo(a.x, a.y); x!.lineTo(b.x, b.y); x!.stroke();
          }
        }
      }
      // puntos (los de "más cerca" = z alto, se ven más grandes)
      for (const p of pts) {
        x!.globalAlpha = Math.min(1, 0.35 + p.z * 0.6); x!.fillStyle = p.col;
        x!.beginPath(); x!.arc(p.x, p.y, (p.teal ? 2.3 : 2.0) * p.z * DPR + 0.5, 0, 7); x!.fill();
      }
      x!.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    build();
    frame(); // dibuja; si reduce-motion, queda un solo fotograma estático
    const onR = () => build();
    window.addEventListener('resize', onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
  }, []);

  return <canvas ref={ref} aria-hidden="true"
    style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', display: 'block' }} />;
}
