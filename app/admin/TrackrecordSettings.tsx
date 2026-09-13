'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { toast } from '@/lib/toast';

// Control GLOBAL del trackrecord público: el admin decide qué campos se muestran
// en la página /u/ID de CUALQUIER trader que la encienda. Guardado en app_settings.
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function TrackrecordSettings() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [c, setC] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch('/api/admin/trackrecord').then((r) => r.json()).then(setC).catch(() => setC(null)); }, []);

  async function save(patch: any) {
    const next = { ...c, ...patch }; setC(next); setBusy(true);
    try {
      const r = await fetch('/api/admin/trackrecord', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) });
      const j = await r.json();
      if (!r.ok) { toast(j.error || 'error'); return; }
      setC(j);
    } finally { setBusy(false); }
  }

  if (!c) return <div className="muted" style={{ padding: 20 }}>…</div>;

  const rows: [string, string, string][] = [
    ['show_money', es ? 'Mostrar montos en $' : 'Show $ amounts', es ? 'Si se apaga, solo se ve % de rentabilidad y R (más seguro para compartir).' : 'If off, only % return and R show (safer to share).'],
    ['show_equity', es ? 'Curva de resultados' : 'Equity curve', es ? 'Gráfica de la evolución acumulada.' : 'Cumulative equity chart.'],
    ['show_winrate', es ? '% de aciertos' : 'Win rate', ''],
    ['show_pf', es ? 'Factor de beneficio' : 'Profit factor', ''],
    ['show_dd', es ? 'Drawdown máximo' : 'Max drawdown', ''],
    ['show_bysym', es ? 'Desglose por instrumento' : 'By instrument', ''],
    ['show_trades', es ? 'Nº de operaciones' : 'Trades count', ''],
    ['show_accounts', es ? 'Nº de cuentas' : 'Accounts count', ''],
    ['show_avatar', es ? 'Foto del trader' : 'Trader photo', ''],
    ['verified_badge', es ? 'Sello "Verificado por Onyx"' : '"Verified by Onyx" badge', ''],
  ];

  return (
    <div>
      <div className="tabhead"><div className="th-row"><span className="th-ic">🏆</span><span className="th-t">{es ? 'Trackrecord público' : 'Public trackrecord'}</span></div><div className="th-s">{es ? 'Controla qué se muestra en la página pública que cada trader puede encender (/u/ID).' : 'Control what shows on the public page each trader can enable (/u/ID).'}</div></div>

      <div className="card">
        {/* Función global on/off */}
        <div className="row between" style={{ gap: 10, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700 }}>{es ? 'Función disponible' : 'Feature available'}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{es ? 'Si la apagas, ninguna página pública se muestra (aunque el trader la tenga encendida).' : 'If off, no public page shows (even if a trader enabled it).'}</div>
          </div>
          <Toggle on={!!c.enabled} onClick={() => save({ enabled: !c.enabled })} />
        </div>

        {/* Campos visibles */}
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>{es ? 'Campos visibles' : 'Visible fields'}</div>
          {rows.map(([k, label, sub]) => (
            <div key={k} className="row between" style={{ gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{label}</div>
                {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
              </div>
              <Toggle on={!!c[k]} onClick={() => save({ [k]: !c[k] })} />
            </div>
          ))}
        </div>

        {/* Mínimo de operaciones */}
        <div className="row between" style={{ gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700 }}>{es ? 'Mínimo de operaciones para publicar' : 'Minimum trades to publish'}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{es ? 'Debajo de este número, la página muestra un aviso en vez de las estadísticas.' : 'Below this number, the page shows a notice instead of the stats.'}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {[0, 10, 20, 50, 100].map((n) => (
              <button key={n} className="btn btn-ghost" disabled={busy} onClick={() => save({ min_trades: n })}
                style={{ padding: '6px 11px', fontSize: 13, fontWeight: 700, border: '1px solid ' + (c.min_trades === n ? 'var(--brand)' : 'var(--line)'), background: c.min_trades === n ? 'rgba(124,140,255,.16)' : 'transparent', color: c.min_trades === n ? 'var(--soft-brand)' : 'var(--tx)' }}>{n}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
