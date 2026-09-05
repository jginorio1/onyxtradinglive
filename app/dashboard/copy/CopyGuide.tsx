'use client';
// Panel de ayuda del Copy Trading: flotante, arrastrable y minimizable.
// Se abre solo la primera vez (localStorage) y se queda abierto mientras el
// usuario configura, sin sacarlo de la página. Bilingüe ES/EN.
import { useEffect, useRef, useState, useCallback } from 'react';

type Props = { open: boolean; onClose: () => void; lang?: string };

const G: any = {
  es: {
    title: 'Guía rápida · Copy Trading',
    tagline: 'Deja abierto este panel mientras configuras. Puedes arrastrarlo o minimizarlo.',
    min: 'Minimizar', close: 'Cerrar',
    secIdea: 'La idea en 30 segundos',
    idea: [
      ['MASTER', 'La cuenta que MANDA. Cuando abre o cierra una operación, la orden viaja a la nube.'],
      ['ESCLAVA', 'La cuenta que RECIBE. Copia esa operación en su broker con el lote que tú decidas.'],
    ],
    ideaFoot: 'Tú eres dueño de las dos. Configuras el enlace aquí, instalas el EA en cada cuenta y listo.',
    secSteps: 'Pasos para activarlo',
    steps: [
      ['Genera la Clave Copy de cada cuenta', 'En Claves Copy pulsa Generar clave para la Master y para la Esclava. Cada cuenta tiene la suya (empieza por onyx_copy_...). Pulsa Copiar.'],
      ['Instala en MetaTrader', 'El Master ya va dentro de Onyx Connect (no instalas nada aparte). En la Esclava pulsa Instalar: baja la EA Esclava, ponla en MQL5 > Experts y pega su Clave Copy en el campo Copy API key. Activa Algo Trading.'],
      ['Crea el enlace Master to Esclava', 'Elige la Master, la Esclava y como se calcula el lote (Multiplicador / Balance % / Riesgo). Pulsa Crear enlace y confirma el aviso.'],
      ['Prueba en DEMO', 'Haz una operacion pequena en la Master. En segundos debe aparecer en la Esclava. Si aparece, funciona!'],
    ],
    secLot: 'Como se calcula el lote',
    lot: [
      ['Multiplicador', '1.0 = mismo lote, 0.5 = la mitad.'],
      ['Balance %', 'Ajusta el lote segun la diferencia de saldo entre cuentas.'],
      ['Riesgo % (RR)', 'Arriesga un % del saldo por operacion (necesita stop loss).'],
    ],
    secSym: 'Simbolos y sufijos',
    symBody: 'Cada broker nombra distinto el mismo instrumento (EURUSD, EURUSD.pro, EURUSDm, US100 vs NAS100). La EA Esclava lo resuelve sola: nombre exacto, mismo par con sufijo de letras, y tabla de equivalencias (GOLD/XAUUSD, US100/NAS100, GER40/DE40...).',
    symFtmo: 'FTMO usa .sim (ej. EURUSD.sim). Se detecta solo, este el sufijo en la Master o en la Esclava. No tienes que hacer nada.',
    symMap: 'Si un broker usa un nombre imposible, edita la Tabla de simbolos en dos columnas (En la master / En la esclava) dentro del enlace en el dashboard: viaja a la nube y la aplican MT4, MT5 y cTrader. Manda por encima de todo. Tambien existe el input SymbolMap en la EA por si copias 100% local.',
    secCtrl: 'Pausar y controlar',
    ctrlBody: 'En Control de copia puedes pausar todo al instante, o por cuenta/enlace. Pausar no cierra lo abierto; solo deja de copiar nuevas. Tambien funciona por Telegram (/copyoff, /copyon).',
    secWarn: 'Importante',
    warns: [
      'Opera dinero real: prueba siempre en DEMO antes.',
      'Prop firms (FTMO, etc.): muchas prohiben el copy o los EAs. Revisa sus reglas antes de conectar una cuenta de reto o fondeada.',
      'Autoriza la URL en MT: Opciones > Asesores Expertos > WebRequest > onyxtradinglive.com.',
    ],
  },
  en: {
    title: 'Quick guide · Copy Trading',
    tagline: 'Keep this panel open while you set things up. You can drag or minimize it.',
    min: 'Minimize', close: 'Close',
    secIdea: 'The idea in 30 seconds',
    idea: [
      ['MASTER', 'The account that LEADS. When it opens or closes a trade, the order goes to the cloud.'],
      ['SLAVE', 'The account that RECEIVES. It copies that trade on its broker with the lot size you choose.'],
    ],
    ideaFoot: 'You own both. Set the link here, install the EA on each account and you are done.',
    secSteps: 'Steps to turn it on',
    steps: [
      ['Generate each account Copy Key', 'In Copy Keys tap Generate key for the Master and the Slave. Each account has its own (starts with onyx_copy_...). Tap Copy.'],
      ['Install in MetaTrader', 'The Master is built into Onyx Connect (nothing to install). On the Slave tap Install: download the Slave EA, drop it in MQL5 > Experts and paste its Copy Key in Copy API key. Enable Algo Trading.'],
      ['Create the Master to Slave link', 'Pick the Master, the Slave and how the lot is sized (Multiplier / Balance % / Risk). Tap Create link and confirm.'],
      ['Test on DEMO', 'Open a small trade on the Master. Within seconds it should appear on the Slave. If it does, it works!'],
    ],
    secLot: 'How the lot is sized',
    lot: [
      ['Multiplier', '1.0 = same lot, 0.5 = half.'],
      ['Balance %', 'Scales the lot by the balance difference between accounts.'],
      ['Risk % (RR)', 'Risks a % of balance per trade (needs a stop loss).'],
    ],
    secSym: 'Symbols and suffixes',
    symBody: 'Each broker names the same instrument differently (EURUSD, EURUSD.pro, EURUSDm, US100 vs NAS100). The Slave EA resolves it automatically: exact name, same pair with a letter suffix, and an alias table (GOLD/XAUUSD, US100/NAS100, GER40/DE40...).',
    symFtmo: 'FTMO uses .sim (e.g. EURUSD.sim). It is detected automatically whether the suffix is on the Master or the Slave. Nothing to do.',
    symMap: 'If a broker uses an impossible name, edit the two-column Symbol table (On the master / On the slave) inside the link in the dashboard: it travels to the cloud and MT4, MT5 and cTrader apply it. It overrides everything. There is also a SymbolMap input in the EA for 100% local copying.',
    secCtrl: 'Pause and control',
    ctrlBody: 'In Copy control you can pause everything instantly, or per account/link. Pausing does not close open trades; it just stops copying new ones. Works via Telegram too (/copyoff, /copyon).',
    secWarn: 'Important',
    warns: [
      'It trades real money: always test on DEMO first.',
      'Prop firms (FTMO, etc.): many ban copying or EAs. Check their rules before connecting a challenge or funded account.',
      'Allow the URL in MT: Options > Expert Advisors > WebRequest > onyxtradinglive.com.',
    ],
  },
};

export default function CopyGuide({ open, onClose, lang }: Props) {
  const g = G[lang === 'es' ? 'es' : 'en'] || G.en;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [min, setMin] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && pos === null && typeof window !== 'undefined') {
      const w = Math.min(400, window.innerWidth - 24);
      setPos({ x: window.innerWidth - w - 18, y: Math.max(70, window.innerHeight - 560) });
    }
  }, [open, pos]);

  const onMove = useCallback((cx: number, cy: number) => {
    if (!drag.current) return;
    const w = panelRef.current?.offsetWidth || 380;
    const h = panelRef.current?.offsetHeight || 200;
    let x = cx - drag.current.dx;
    let y = cy - drag.current.dy;
    x = Math.max(6, Math.min(x, window.innerWidth - w - 6));
    y = Math.max(6, Math.min(y, window.innerHeight - h - 6));
    setPos({ x, y });
  }, []);

  useEffect(() => {
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const up = () => { drag.current = null; };
    window.addEventListener('mousemove', mm);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [onMove]);

  function startDrag(cx: number, cy: number) {
    if (!panelRef.current) return;
    const r = panelRef.current.getBoundingClientRect();
    drag.current = { dx: cx - r.left, dy: cy - r.top };
  }

  if (!open) return null;
  const p = pos || { x: 20, y: 80 };

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    cursor: 'grab', userSelect: 'none', borderBottom: '1px solid var(--line,#242a3a)',
    background: 'linear-gradient(180deg,rgba(108,123,255,.16),rgba(108,123,255,.04))',
    borderTopLeftRadius: 14, borderTopRightRadius: 14, touchAction: 'none',
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={g.title}
      style={{
        position: 'fixed', left: p.x, top: p.y, zIndex: 1400,
        width: min ? 220 : 'min(400px, calc(100vw - 24px))',
        maxHeight: min ? 'auto' : 'min(78vh, 620px)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--card,#12151d)', color: 'var(--ink,#eaf0f7)',
        border: '1px solid var(--accent,#6c7bff)', borderRadius: 14,
        boxShadow: '0 18px 60px rgba(0,0,0,.55)', overflow: 'hidden',
      }}
    >
      <div
        style={headerStyle}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={(e) => { if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
      >
        <span style={{ fontSize: 15 }}>📘</span>
        <b style={{ fontSize: 13.5, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</b>
        <button title={g.min} onClick={() => setMin(!min)} style={btn}>{min ? '▢' : '—'}</button>
        <button title={g.close} onClick={onClose} style={btn}>✕</button>
      </div>

      {!min && (
        <div style={{ padding: '12px 14px', overflowY: 'auto', fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 12px', color: 'var(--muted,#9aa6b8)', fontSize: 12 }}>{g.tagline}</p>

          <Section title={g.secIdea}>
            {g.idea.map((r: string[], i: number) => (
              <p key={i} style={{ margin: '4px 0' }}>
                <span style={pill(r[0] === 'MASTER' ? 'var(--brand,#8a7dff)' : 'var(--green,#34e2a0)')}>{r[0]}</span>{' '}{r[1]}
              </p>
            ))}
            <p style={{ margin: '8px 0 0', color: 'var(--muted,#9aa6b8)' }}>{g.ideaFoot}</p>
          </Section>

          <Section title={g.secSteps}>
            <ol style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
              {g.steps.map((s: string[], i: number) => (
                <li key={i} style={{ display: 'flex', gap: 9, padding: '6px 0', borderBottom: '1px dashed var(--line,#242a3a)' }}>
                  <span style={num}>{i + 1}</span>
                  <span><b>{s[0]}</b><br /><span style={{ color: 'var(--muted,#9aa6b8)' }}>{s[1]}</span></span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title={g.secLot}>
            {g.lot.map((r: string[], i: number) => (
              <p key={i} style={{ margin: '3px 0' }}><b style={{ color: 'var(--accent,#8a97ff)' }}>{r[0]}</b> — {r[1]}</p>
            ))}
          </Section>

          <Section title={g.secSym}>
            <p style={{ margin: '3px 0' }}>{g.symBody}</p>
            <p style={note}>{g.symFtmo}</p>
            <p style={{ margin: '6px 0 0' }}>{g.symMap}</p>
          </Section>

          <Section title={g.secCtrl}>
            <p style={{ margin: '3px 0' }}>{g.ctrlBody}</p>
          </Section>

          <Section title={g.secWarn} last>
            {g.warns.map((w: string, i: number) => (
              <p key={i} style={warnStyle}>⚠ {w}</p>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 7, border: '1px solid var(--line,#2a3142)',
  background: 'transparent', color: 'var(--ink,#eaf0f7)', cursor: 'pointer', fontSize: 12, lineHeight: 1,
};
const num: React.CSSProperties = {
  minWidth: 22, height: 22, borderRadius: 7, background: 'var(--card2,#171b25)',
  border: '1px solid var(--line,#242a3a)', color: 'var(--accent,#8a97ff)', fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
};
const note: React.CSSProperties = {
  margin: '8px 0 0', padding: '8px 10px', borderRadius: 8, fontSize: 12.5,
  background: 'rgba(56,189,248,.08)', borderLeft: '3px solid #38bdf8',
};
const warnStyle: React.CSSProperties = {
  margin: '5px 0', padding: '7px 10px', borderRadius: 8, fontSize: 12.5,
  background: 'rgba(251,191,36,.08)', borderLeft: '3px solid #fbbf24',
};
function pill(color: string): React.CSSProperties {
  return { display: 'inline-block', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, color, border: '1px solid ' + color, background: 'transparent' };
}
function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent,#8a97ff)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}
