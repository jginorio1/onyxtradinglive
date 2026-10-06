'use client';
import { useEffect, useRef } from 'react';

// Fondo de "red de partículas" en 4D SOLO para la pantalla de login/registro:
// cada punto vive en 4 dimensiones (x,y,z,w) dentro de un hipercubo que rota en
// varios planos (incluido el 4º eje W). Se proyecta 4D->3D (lo "lejano" en W se
// encoge) y luego 3D->2D con perspectiva → los puntos parecen atravesarse y
// respirar. Denso: cubre TODA la pantalla. Va en su propio <canvas> detrás de la
// caja → es su propia capa: NO parpadea el resto. Lento. Respeta reduced-motion.
export default function LoginParticles() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const x = c.getContext('2d'); if (!x) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const ORANGE = ['#ff7a1a', '#ff9d3d', '#ff6a2b', '#ffbf40'];
    const TEAL = '#34e2a0';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, pts: any[] = [], raf = 0, t = 0;

    function build() {
      W = c!.width = Math.floor(window.innerWidth * DPR);
      H = c!.height = Math.floor(window.innerHeight * DPR);
      c!.style.width = window.innerWidth + 'px';
      c!.style.height = window.innerHeight + 'px';
      // DENSO: suficientes puntos para cubrir la pantalla completa.
      const n = Math.max(90, Math.min(240, Math.round(window.innerWidth * window.innerHeight / 9000)));
      pts = [];
      for (let i = 0; i < n; i++) {
        const teal = Math.random() < 0.12;
        pts.push({
          x: Math.random() * 2 - 1, y: Math.random() * 2 - 1,
          z: Math.random() * 2 - 1, w: Math.random() * 2 - 1,
          col: teal ? TEAL : ORANGE[(Math.random() * ORANGE.length) | 0], teal,
        });
      }
    }

    function frame() {
      t += 0.0012; // LENTO
      const ay = t, ax = Math.sin(t * 0.5) * 0.22;     // rot 3D
      const aw = t * 0.7, av = Math.sin(t * 0.33) * 0.6; // rot 4D (planos con W)
      const cx = W / 2, cy = H / 2, spread = Math.max(W, H) * 0.78, FOV = 2.6, WDIST = 2.8;
      const cay = Math.cos(ay), say = Math.sin(ay), cax = Math.cos(ax), sax = Math.sin(ax);
      const caw = Math.cos(aw), saw = Math.sin(aw), cav = Math.cos(av), sav = Math.sin(av);
      const P = pts.map((p) => {
        let X = p.x, Y = p.y, Z = p.z, Wd = p.w;
        const nx = X * caw - Wd * saw; Wd = X * saw + Wd * caw; X = nx;   // plano X-W
        const ny = Y * cav - Wd * sav; Wd = Y * sav + Wd * cav; Y = ny;   // plano Y-W
        const k = FOV / (WDIST + Wd * 0.9); X *= k; Y *= k; Z *= k;        // 4D -> 3D
        let rx = X * cay - Z * say, rz = X * say + Z * cay;                // rot Y
        let ry = Y * cax - rz * sax; rz = Y * sax + rz * cax;             // rot X
        const s = FOV / (FOV + rz);                                        // 3D -> 2D
        return { sx: cx + rx * spread * s, sy: cy + ry * spread * s, s, col: p.col, teal: p.teal };
      });
      x!.clearRect(0, 0, W, H);
      const LINK = 150 * DPR;
      for (let i = 0; i < P.length; i++) {
        for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy, d = Math.hypot(dx, dy);
          if (d < LINK) {
            x!.globalAlpha = (1 - d / LINK) * 0.42 * Math.min(a.s, b.s);
            x!.strokeStyle = '#ff8a3a'; x!.lineWidth = 0.6 * DPR;
            x!.beginPath(); x!.moveTo(a.sx, a.sy); x!.lineTo(b.sx, b.sy); x!.stroke();
          }
        }
      }
      P.sort((u, v) => u.s - v.s);
      for (const p of P) {
        x!.globalAlpha = Math.min(1, p.s * 0.9); x!.fillStyle = p.col;
        x!.beginPath(); x!.arc(p.sx, p.sy, (p.teal ? 2.3 : 2.0) * p.s * DPR, 0, 7); x!.fill();
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
