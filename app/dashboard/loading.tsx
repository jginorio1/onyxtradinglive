// Pantalla de carga instantánea para /dashboard y TODAS sus subrutas
// (Guardian, Copy, Mis robots, TradingView, Ganancia neta, Cuentas, Academy…)
// que no tengan su propio loading.tsx.
//
// Next.js la muestra EN EL ACTO al entrar (login → dashboard) o al pulsar un tab,
// mientras el servidor renderiza la página real (auth + consultas). Antes, en la
// app móvil, ese hueco se veía NEGRO unos segundos. Ahora se ve de inmediato el
// fondo de marca + el logo Onyx con un anillo girando, y debajo un esqueleto con
// los colores chinita del landing/login, para que haya congruencia. Es puramente
// visual: no pide datos ni bloquea nada.
export default function DashboardLoading() {
  const bar = (w: string, h = 14) => (
    <span className="sk-line" style={{ width: w, height: h }} />
  );
  return (
    <div className="onyx-load" aria-busy="true" aria-label="Cargando…">
      {/* Marca centrada: lo primero que se ve, nunca una pantalla negra */}
      <div className="onyx-load-brand">
        <span className="onyx-load-ring" />
        <span className="onyx-load-word">ONYX</span>
      </div>

      {/* Esqueleto por debajo, con el naranja de marca */}
      <div className="wrap section" style={{ maxWidth: 1160, margin: '0 auto', opacity: .6 }}>
        <div className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {bar('42%', 20)}
          {bar('66%')}
        </div>
        <div className="grid g3" style={{ gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="sk-dot" />
              {bar('70%')}
              {bar('45%', 22)}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        /* Fondo de marca a pantalla completa: mata el flash negro del WebView. */
        .onyx-load { position: relative; min-height: 100vh; min-height: 100dvh; background: var(--bg); padding-top: 26vh; }
        .onyx-load-brand { position: absolute; top: 0; left: 0; right: 0; height: 26vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
        .onyx-load-ring { width: 40px; height: 40px; border-radius: 50%; border: 3px solid var(--line);
          border-top-color: var(--brand); animation: onyx-spin .8s linear infinite; }
        .onyx-load-word { font-size: 15px; font-weight: 800; letter-spacing: .32em; padding-left: .32em;
          color: transparent; background: linear-gradient(90deg, var(--brand), var(--brand2)); -webkit-background-clip: text; background-clip: text; }
        @keyframes onyx-spin { to { transform: rotate(360deg); } }
        .sk-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
        .sk-line, .sk-dot { display: inline-block; border-radius: 8px;
          background: linear-gradient(90deg, rgba(255,157,61,.07) 25%, rgba(255,157,61,.20) 37%, rgba(255,157,61,.07) 63%);
          background-size: 400% 100%; animation: sk-shine 1.4s ease infinite; }
        .sk-dot { width: 34px; height: 34px; border-radius: 10px; }
        @keyframes sk-shine { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
        @media (prefers-reduced-motion: reduce) { .sk-line, .sk-dot, .onyx-load-ring { animation: none; } }
      `}</style>
    </div>
  );
}
