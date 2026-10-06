'use client';
import { useEffect, useRef } from 'react';

// Fondo de RED DE PUNTOS 3D SOLO para la pantalla de login/registro: puntos
// (naranja + algún verde azulado) dentro de un cubo que rota MUY lento, con
// perspectiva (los de atrás salen más pequeños y tenues), que se UNEN con líneas
// cuando están cerca. Densidad alta y mayor alcance de enlace → malla más tupida.
// Va en su propio <canvas> detrás de la caja → su propia capa: NO parpadea el
// resto. Respeta prefers-reduced-motion (un fotograma estático).
export default function LoginParticles() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const x = c.getContext('2d'); if (!x) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const ORANGE = ['#ff7a1a', '#ff9d3d', '#ff6a2b', '#ffbf40'];
    const TEAL = '#34e2a0';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, pts: any[] = [], raf = 0, ay = 0;

    function build() {
      W = c!.width = Math.floor(window.innerWidth * DPR);
      H = c!.height = Math.floor(window.innerHeight * DPR);
      c!.style.width = window.innerWidth + 'px';
      c!.style.height = window.innerHeight + 'px';
      // DENSO: más puntos para una malla tupida que cubre toda la pantalla.
      const n = Math.max(70, Math.min(260, Math.round(window.innerWidth * window.innerHeight / 11000)));
      pts = [];
      for (let i = 0; i < n; i++) {
        const teal = Math.random() < 0.12;
        pts.push({
          x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 2 - 1,
          vz: (Math.random() - 0.5) * 0.0003,
          col: teal ? TEAL : ORANGE[(Math.random() * ORANGE.length) | 0], teal,
        });
      }
    }

    function frame() {
      ay += 0.0006; // MUY lento
      const ax = Math.sin(ay * 0.5) * 0.22;
      const cx = W / 2, cy = H / 2, spread = Math.max(W, H) * 0.72, FOV = 2.4;
      const cay = Math.cos(ay), say = Math.sin(ay), cax = Math.cos(ax), sax = Math.sin(ax);
      const P = pts.map((p) => {
        p.z += p.vz; if (p.z > 1) p.z = -1; if (p.z < -1) p.z = 1;
        let X = p.x * cay - p.z * say, Z = p.x * say + p.z * cay;
        let Y = p.y * cax - Z * sax; Z = p.y * sax + Z * cax;
        const s = FOV / (FOV + Z);
        return { sx: cx + X * spread * s, sy: cy + Y * spread * s, s, col: p.col, teal: p.teal };
      });
      x!.clearRect(0, 0, W, H);
      const LINK = 200 * DPR; // MÁS alcance => MÁS líneas
      for (let i = 0; i < P.length; i++) {
        for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy, d = Math.hypot(dx, dy);
          if (d < LINK) {
            x!.globalAlpha = (1 - d / LINK) * 0.5 * Math.min(a.s, b.s);
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
