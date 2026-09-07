// ============================================================
// Onyx Bot Factory · Web Worker del Autopiloto.
// Corre TODA la búsqueda pesada (generar + backtestear + evolucionar + puntuar
// Onyx) en un HILO APARTE, para que la página NUNCA se congele ("Page
// Unresponsive"). El hilo principal solo manda los datos y recibe el progreso
// y los finalistas; luego crea los robots (poquitos) contra la API.
// ============================================================
import { runBacktest, type Spec, type Costs, type Bar } from '@/lib/backtest';
import { evolve, evaluate } from '@/lib/evolve';
import { sampleCandidates, enrichSpec } from '@/lib/stratgen';
import { onyxScore } from '@/lib/score';

const ctx: Worker = self as any;

type Msg = {
  bars: Bar[]; costs: Costs; cfg: Record<string, string[]>; dir: 'both' | 'long' | 'short';
  n: number; autoMode: 'random' | 'evolve'; keepN: number; minScore: number;
  evoCfg: { mut: number; restart: number }; oosPct: number; maxDd: number; minTr: number;
  blockMap: Record<string, any>;
};

ctx.onmessage = (e: MessageEvent) => {
  const d = e.data as Msg;
  const post = (msg: string) => ctx.postMessage({ type: 'progress', msg });
  try {
    const { bars, costs, cfg, dir, n, autoMode, keepN, minScore, evoCfg, oosPct, maxDd, minTr, blockMap } = d;
    const cut = Math.floor(bars.length * 0.7);
    const isB = bars.slice(0, cut), oosB = bars.slice(cut);
    let top: { spec: Spec }[] = [];
    let scanned = 0;
    // Contadores para el monitor en vivo (estilo StrategyQuant).
    const t0 = Date.now();
    const rej = { fewtrades: 0, ddhigh: 0, oosneg: 0, noedge: 0, onyxlow: 0 };
    let generated = 0, accepted = 0;
    const sendStats = () => ctx.postMessage({ type: 'stats', generated, accepted, rej: { ...rej }, elapsedMs: Date.now() - t0, target: n });

    if (autoMode === 'evolve') {
      post('Evolucionando (mutación + cruce)…');
      const gens = Math.max(6, Math.round(n / 400));      // sin tope: el worker no congela la UI
      const pop = Math.max(40, Math.round(n / 20));
      const pool = Math.max(24, Math.min(120, keepN * 5));
      const r = evolve(bars, costs, {
        pop, gens, keep: pool, mut: evoCfg.mut, restart: evoCfg.restart, oosPct: oosPct || 30,
        // Progreso EN VIVO por generación → alimenta el monitor (estilo StrategyQuant).
        onGen: ({ gen, gens: gTot, evaluated, scored, history }) => {
          for (const s of scored) {
            const ev = s.ev;
            generated++;
            if (ev.trades < minTr) rej.fewtrades++;
            else if (ev.dd > maxDd) rej.ddhigh++;
            else if (ev.oosPf < 1 || ev.oosNet <= 0) rej.oosneg++;
            else if (ev.fit <= 0) rej.noedge++;
            else accepted++;
          }
          post('Evolucionando · gen ' + (gen + 1) + '/' + gTot + ' · evaluadas ' + evaluated.toLocaleString('en-US') + ' · robustas ' + accepted.toLocaleString('en-US'));
          sendStats();
          ctx.postMessage({ type: 'evo', best: scored.slice(0, Math.max(keepN, 8)), history });
        },
      });
      const good = r.best.filter((s: any) => s.ev.oosPf >= 1 && s.ev.oosNet > 0 && s.ev.dd <= maxDd && s.ev.trades >= minTr);
      top = (good.length ? good : r.best).map((s: any) => ({ spec: { ...s.spec, dir } }));
      scanned = r.evaluated;
      ctx.postMessage({ type: 'evo', best: r.best.slice(0, Math.max(keepN, 8)), history: r.history });
    } else {
      const CHUNK = 5000; // en el worker el lote puede ser grande: no bloquea la página
      const keepPool = Math.max(24, keepN * 5);
      const survivors: { spec: Spec; fit: number }[] = [];
      for (let done = 0; done < n; done += CHUNK) {
        const size = Math.min(CHUNK, n - done);
        const cands = sampleCandidates(cfg, size) as Spec[];
        for (let i = 0; i < cands.length; i++) {
          const c = { ...cands[i], dir };
          const ev = evaluate(c, isB, oosB, costs);
          generated++;
          // Clasifica el motivo del rechazo (primero que falla) — para el monitor.
          if (ev.trades < minTr) rej.fewtrades++;
          else if (ev.dd > maxDd) rej.ddhigh++;
          else if (ev.oosPf < 1 || ev.oosNet <= 0) rej.oosneg++;
          else if (ev.fit <= 0) rej.noedge++;
          else { survivors.push({ spec: c, fit: ev.fit }); accepted++; }
        }
        if (survivors.length > keepPool * 8) { survivors.sort((a, b) => b.fit - a.fit); survivors.length = keepPool * 4; }
        scanned = done + size;
        post('Backtesteando ' + scanned.toLocaleString('en-US') + '/' + n.toLocaleString('en-US') + ' · robustos ' + survivors.length);
        sendStats();
      }
      survivors.sort((a, b) => b.fit - a.fit);
      top = survivors.slice(0, keepPool);
    }

    // Puntaje Onyx (Monte Carlo + walk-forward). Pesado, pero es otro hilo.
    const toScore = top.slice(0, Math.min(top.length, Math.max(40, keepN * 5)));
    const graded: { spec: Spec; score: number; grade: string; cx: number }[] = [];
    for (let i = 0; i < toScore.length; i++) {
      try {
        const sc = onyxScore(bars, enrichSpec({ ...toScore[i].spec, dir }, blockMap) as Spec, costs, oosPct || 30);
        if (sc.score >= minScore) graded.push({ spec: toScore[i].spec, score: sc.score, grade: sc.grade, cx: sc.cx });
        else rej.onyxlow++;
      } catch { /* descartar el que rompa */ }
      if (i % 3 === 0) { post('Puntuando robustez ' + (i + 1) + '/' + toScore.length); sendStats(); }
    }
    graded.sort((a, b) => b.score - a.score);
    const finalists = graded.slice(0, Math.max(1, keepN));
    const avg = finalists.length ? Math.round(finalists.reduce((s, f) => s + f.score, 0) / finalists.length) : 0;
    accepted = graded.length; sendStats();
    ctx.postMessage({ type: 'done', finalists, scanned, survivors: graded.length, avg });
  } catch (err: any) {
    ctx.postMessage({ type: 'error', message: String(err?.message || err) });
  }
};

export {};
