// Pantalla de carga instantánea para /dashboard y TODAS sus subrutas
// (Guardian, Copy, Mis robots, TradingView, Ganancia neta, Cuentas, Academy…)
// que no tengan su propio loading.tsx.
//
// Next.js la muestra EN EL ACTO al pulsar un tab, mientras el servidor
// renderiza la página real (auth + consultas). Así el clic responde al
// instante con un esqueleto en vez de dejar la sensación de que "no pasa
// nada". Es puramente visual: no pide datos ni bloquea nada.
export default function DashboardLoading() {
  const bar = (w: string, h = 14) => (
    <span className="sk-line" style={{ width: w, height: h }} />
  );
  return (
    <div className="wrap section" style={{ maxWidth: 1160, margin: '0 auto' }} aria-busy="true" aria-label="Cargando…">
      {/* Cabecera */}
      <div className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {bar('42%', 20)}
        {bar('66%')}
      </div>

      {/* Rejilla de tarjetas */}
      <div className="grid g3" style={{ gap: 14 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="sk-dot" />
            {bar('70%')}
            {bar('45%', 22)}
          </div>
        ))}
      </div>

      {/* Bloque ancho */}
      <div className="sk-card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bar('30%', 16)}
        {bar('92%')}
        {bar('84%')}
        {bar('60%')}
      </div>

      <style>{`
        .sk-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
        .sk-line, .sk-dot { display: inline-block; border-radius: 8px;
          background: linear-gradient(90deg, rgba(124,140,255,.06) 25%, rgba(124,140,255,.16) 37%, rgba(124,140,255,.06) 63%);
          background-size: 400% 100%; animation: sk-shine 1.4s ease infinite; }
        .sk-dot { width: 34px; height: 34px; border-radius: 10px; }
        @keyframes sk-shine { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
        @media (prefers-reduced-motion: reduce) { .sk-line, .sk-dot { animation: none; } }
      `}</style>
    </div>
  );
}
