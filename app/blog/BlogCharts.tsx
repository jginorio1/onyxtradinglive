'use client';
import { useEffect } from 'react';

// Dibuja las gráficas del artículo. mdToHtml deja <canvas data-onyx-chart='JSON'>;
// aquí cargamos Chart.js (una sola vez, desde CDN) y renderizamos cada una.
// Datos siempre ilustrativos; nunca predicen el mercado.
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

function loadChartJs(): Promise<any> {
  const w = window as any;
  if (w.Chart) return Promise.resolve(w.Chart);
  if (w.__onyxChartPromise) return w.__onyxChartPromise;
  w.__onyxChartPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CDN; s.async = true;
    s.onload = () => resolve((window as any).Chart);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return w.__onyxChartPromise;
}

function cssVar(name: string, fallback: string): string {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; } catch { return fallback; }
}

export default function BlogCharts() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('canvas[data-onyx-chart]')) as HTMLCanvasElement[];
    if (!nodes.length) return;
    let charts: any[] = [];
    let cancelled = false;

    loadChartJs().then((Chart) => {
      if (!Chart || cancelled) return;
      const brand = cssVar('--brand', '#7c8cff');
      const green = cssVar('--green', '#22c55e');
      const amber = cssVar('--amber', '#f59e0b');
      const tx = cssVar('--tx', '#e8ecff');
      const mut = cssVar('--mut', '#97a1b6');
      const grid = 'rgba(148,163,184,.18)';
      const palette = [brand, green, amber, '#f472b6', '#38bdf8', '#a78bfa'];

      for (const el of nodes) {
        if ((el as any).__onyxDone) continue;
        let cfg: any;
        try { cfg = JSON.parse(el.getAttribute('data-onyx-chart') || '{}'); } catch { continue; }
        if (!cfg || !Array.isArray(cfg.y) || !cfg.y.length) continue;
        (el as any).__onyxDone = true;
        const labels = (cfg.x && cfg.x.length) ? cfg.x : cfg.y.map((_: any, i: number) => String(i + 1));
        const isRound = cfg.type === 'doughnut';
        const ds: any = isRound
          ? { data: cfg.y, backgroundColor: cfg.y.map((_: any, i: number) => palette[i % palette.length]), borderWidth: 0 }
          : { data: cfg.y, borderColor: brand, backgroundColor: 'rgba(124,140,255,.14)', fill: cfg.type === 'line', tension: .35, pointRadius: 2, borderWidth: 2, borderRadius: 6 };
        try {
          charts.push(new Chart(el, {
            type: cfg.type || 'line',
            data: { labels, datasets: [ds] },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: isRound, labels: { color: mut } } },
              scales: isRound ? {} : {
                y: { ticks: { color: mut }, grid: { color: grid } },
                x: { ticks: { color: mut }, grid: { display: false } },
              },
            },
          }));
        } catch {}
      }
    }).catch(() => {});

    return () => { cancelled = true; charts.forEach((c) => { try { c.destroy(); } catch {} }); };
  }, []);

  return null;
}
