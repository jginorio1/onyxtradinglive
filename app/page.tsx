import Link from 'next/link';

export default function Home() {
  return (
    <>
      <div className="topbar"><div className="wrap">
        <div className="logo"><span className="mark">◆</span> Onyx Trading Live</div>
        <div className="row">
          <Link className="btn btn-ghost" href="/login">Entrar</Link>
          <Link className="btn btn-primary" href="/login?mode=signup">Empieza gratis</Link>
        </div>
      </div></div>

      <div className="wrap" style={{ textAlign: 'center', padding: '80px 0 40px' }}>
        <span className="pill green">🔗 Conecta MT4 y MT5 · sincronización automática</span>
        <h1 style={{ fontSize: 48, margin: '20px 0' }}>
          Tu <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', color: 'transparent' }}>diario de trading</span><br />inteligente y automático
        </h1>
        <p className="muted" style={{ fontSize: 19, maxWidth: 620, margin: '0 auto 28px' }}>
          Conecta tus cuentas de MetaTrader y deja que Onyx registre, analice y visualice cada operación.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/login?mode=signup" style={{ padding: '14px 28px' }}>Empieza gratis →</Link>
          <Link className="btn btn-ghost" href="/pricing" style={{ padding: '14px 28px' }}>Ver precios</Link>
        </div>
      </div>

      <div className="wrap section">
        <div className="grid g3">
          <div className="card"><h3>🔗 Conexión MT4/MT5</h3><p className="muted">Vincula tus cuentas y sincroniza el historial automáticamente.</p></div>
          <div className="card"><h3>📈 Estadísticas</h3><p className="muted">Win rate, profit factor, expectancy, drawdown y curva de equity.</p></div>
          <div className="card"><h3>🏆 Reglas de fondeo</h3><p className="muted">Sigue tu drawdown y objetivo de FTMO y otras prop firms.</p></div>
        </div>
      </div>

      <div className="wrap section" style={{ textAlign: 'center', paddingBottom: 70 }}>
        <Link className="btn btn-primary" href="/login?mode=signup" style={{ padding: '15px 34px', fontSize: 17 }}>Crear cuenta gratis</Link>
        <p className="muted" style={{ marginTop: 30, fontSize: 13 }}>© 2026 Onyx Trading Live</p>
      </div>
    </>
  );
}
