'use client';
import { useEffect, useState } from 'react';
import Help from '@/app/Help';

// ============================================================
// Fase 2 del gestor: mi plan de trading, límites de la cuenta,
// noticias y el espejo de disciplina.
//
// Estas pantallas no gestionan la operación abierta: gestionan al trader.
// Por eso el tono es distinto — aquí se trata de que respete lo que él mismo
// decidió cuando estaba tranquilo.
// ============================================================

export const P2: any = {
  es: {
    tabTrade: 'Operación', tabPlan: 'Mi plan', tabLimits: 'Límites', tabNews: 'Noticias', tabHist: 'Historial',

    // --- Mi plan ---
    planT: 'Mi plan de trading', planD: 'Decide ahora, con la cabeza fría, cuándo tienes permiso para operar. Después el gestor te lo recuerda aunque no quieras oírlo.',
    days: 'Días que opero', dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    windows: 'Franjas horarias', windowsD: 'En tu hora local. Abajo te decimos a qué hora del bróker corresponde.',
    from: 'Desde', to: 'Hasta', brokerTime: 'Hora del bróker ahora',
    wknd: 'Cerrar todo antes del fin de semana', wkndD: 'Evita el hueco del domingo y el swap del finde.',
    wkndDay: 'Día', wkndTime: 'Hora',
    maxTrades: 'Máximo de operaciones al día', maxTradesD: '0 = sin límite.',
    cooldown: 'Espera después de una pérdida (min)', cooldownD: 'El mejor antídoto contra la operación de venganza.',
    tiltT: 'Freno por racha de pérdidas', tiltD: 'Tras varias pérdidas seguidas, el gestor te para un rato.',
    tiltLosses: 'Pérdidas seguidas', tiltPause: 'Pausa (min)',
    rigidT: '¿Qué pasa si intento saltármelo?',
    rigSoft: 'Solo avísame', rigSoftD: 'Ves el aviso y decides tú. No bloquea nada.',
    rigFriction: 'Hazme esperar', rigFrictionD: 'Puedes saltártelo, pero antes esperas unos minutos. Suele bastar para que se te pase.',
    rigHard: 'Bloquéame hasta mañana', rigHardD: 'Sin salida. Elígelo solo si de verdad lo quieres.',
    friction: 'Minutos de espera',

    // --- Límites ---
    limT: 'Límites de la cuenta', limD: 'Las dos preguntas que casi todo el mundo falla: sobre qué se mide y a qué hora empieza el día. Confírmalas con tu firma.',
    firmT: 'Parte de una plantilla', firmD: 'Son un punto de partida, NO la norma oficial. Cada firma cambia sus reglas. Compruébalo en tu contrato.',
    apply: 'Aplicar',
    baseT: 'Base de cálculo *', baseD: 'Sobre qué número se calcula el porcentaje.',
    baseBal: 'Balance al empezar el día', baseBalD: 'Lo más habitual en firmas de fondeo.',
    baseEq: 'Equity al empezar el día', baseEqD: 'Cuenta también lo que tenías abierto.',
    baseInit: 'Balance inicial de la cuenta', baseInitD: 'Fijo, no se mueve.',
    resetT: 'Hora de reinicio del día *', resetD: 'Hora del servidor de tu bróker a la que empieza un día nuevo. Muchas firmas no usan medianoche.',
    dLoss: 'Pérdida máxima del día', dTarget: 'Objetivo del día', tLoss: 'Pérdida máxima total',
    targetD: 'Al llegar, el gestor te invita a parar. Puedes saltártelo.',
    lossD: 'Al llegar, se acabó. Esto no se puede saltar.',
    pct: '%', money: '$',
    margin: 'Margen de seguridad', marginD: 'Reserva un % del límite. Con 20%, el gestor te para al llegar al 80% del tope real.',
    maxLots: 'Lotaje máximo por operación', maxOpen: 'Posiciones abiertas a la vez',
    breachT: 'Cuando se pasa el límite', bWarn: 'Solo avisar', bBlock: 'No dejar abrir más', bClose: 'Cerrar todo y bloquear',
    zero: '0 = sin límite',

    // --- Noticias ---
    newsT: 'Bloqueo por noticias', newsD: 'Evita operar alrededor de datos de alto impacto.',
    impact: 'Qué noticias', iHigh: 'Solo alto impacto', iBoth: 'Alto y medio',
    before: 'Minutos antes', after: 'Minutos después',
    onlySym: 'Solo si afecta a la divisa del par', onlySymD: 'Si lo apagas, bloquea con cualquier noticia relevante.',
    newsWarn: 'El calendario viene de un proveedor externo. Puede fallar o mover una hora sin avisar. No lo uses como única protección.',

    // --- Estado / disciplina ---
    todayT: 'Hoy', discT: 'Disciplina (30 días)', discD: 'No es una nota. Es un espejo: cuántas veces te frenó y cuántas te lo saltaste.',
    dRespect: 'Veces que paraste', dOverride: 'Veces que te lo saltaste', dSaved: 'Intervenciones del gestor',
    blockedNow: 'Ahora mismo estás bloqueado', notBlocked: 'Sin bloqueos activos',
    tradesUsed: 'Operaciones hoy', dayPnl: 'Resultado del día',
    overrideBtn: 'Quiero saltármelo', overrideWait: 'Espera activa', overrideCancel: 'Cancelar y seguir el plan',
    overrideWaitD: (m: number) => `Podrás saltártelo en ${m} minuto(s). Piénsalo mientras tanto.`,
    overrideOk: 'Permiso concedido por 60 minutos. Queda registrado.',
    overrideNo: 'Los límites de pérdida no se pueden saltar. Es justo el motivo por el que los pusiste.',
    overrideHard: 'Elegiste el modo sin salida. Hasta mañana.',

    reasons: {
      schedule: 'Fuera de horario', daily_loss: 'Pérdida diaria', total_loss: 'Pérdida total',
      target: 'Objetivo cumplido', tilt: 'Racha de pérdidas', cooldown: 'Enfriamiento',
      max_trades: 'Tope de operaciones', max_open: 'Demasiadas abiertas', news: 'Noticia cerca',
    },
    kinds2: { override: 'Se lo saltó', limit: 'Límite', news: 'Noticia', schedule: 'Horario', tilt: 'Racha' },
    reqField: '* Obligatorio',
  },
  en: {
    tabTrade: 'Trade', tabPlan: 'My plan', tabLimits: 'Limits', tabNews: 'News', tabHist: 'History',

    planT: 'My trading plan', planD: 'Decide now, with a clear head, when you are allowed to trade. Later the manager reminds you, even when you would rather not hear it.',
    days: 'Days I trade', dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    windows: 'Time windows', windowsD: 'In your local time. Below we show the matching broker time.',
    from: 'From', to: 'To', brokerTime: 'Broker time now',
    wknd: 'Close everything before the weekend', wkndD: 'Avoids the Sunday gap and weekend swap.',
    wkndDay: 'Day', wkndTime: 'Time',
    maxTrades: 'Maximum trades per day', maxTradesD: '0 = no limit.',
    cooldown: 'Wait after a loss (min)', cooldownD: 'The best antidote to revenge trading.',
    tiltT: 'Losing-streak brake', tiltD: 'After several losses in a row, the manager stops you for a while.',
    tiltLosses: 'Losses in a row', tiltPause: 'Pause (min)',
    rigidT: 'What happens if I try to skip it?',
    rigSoft: 'Just warn me', rigSoftD: 'You see the warning and decide. Nothing is blocked.',
    rigFriction: 'Make me wait', rigFrictionD: 'You can skip it, but you wait a few minutes first. Usually that is enough.',
    rigHard: 'Lock me until tomorrow', rigHardD: 'No way out. Pick this only if you really mean it.',
    friction: 'Minutes to wait',

    limT: 'Account limits', limD: 'The two questions almost everyone gets wrong: what it is measured on, and when the day starts. Confirm both with your firm.',
    firmT: 'Start from a template', firmD: 'A starting point, NOT the official rule. Firms change their rules. Check your contract.',
    apply: 'Apply',
    baseT: 'Calculation base *', baseD: 'Which number the percentage is calculated on.',
    baseBal: 'Balance at day start', baseBalD: 'The most common in funded firms.',
    baseEq: 'Equity at day start', baseEqD: 'Counts what you had open too.',
    baseInit: 'Initial account balance', baseInitD: 'Fixed, never moves.',
    resetT: 'Daily reset hour *', resetD: 'Broker server hour when a new day starts. Many firms do not use midnight.',
    dLoss: 'Maximum daily loss', dTarget: 'Daily target', tLoss: 'Maximum total loss',
    targetD: 'On reaching it the manager invites you to stop. You can override this.',
    lossD: 'On reaching it, you are done. This cannot be overridden.',
    pct: '%', money: '$',
    margin: 'Safety margin', marginD: 'Reserve a % of the limit. At 20%, you are stopped at 80% of the real cap.',
    maxLots: 'Maximum lots per trade', maxOpen: 'Open positions at once',
    breachT: 'When the limit is crossed', bWarn: 'Warn only', bBlock: 'Block new trades', bClose: 'Close everything and block',
    zero: '0 = no limit',

    newsT: 'News blackout', newsD: 'Avoid trading around high-impact releases.',
    impact: 'Which news', iHigh: 'High impact only', iBoth: 'High and medium',
    before: 'Minutes before', after: 'Minutes after',
    onlySym: 'Only if it affects the pair currency', onlySymD: 'Turn it off to block on any relevant release.',
    newsWarn: 'The calendar comes from an external provider. It can fail or shift a time without notice. Do not rely on it alone.',

    todayT: 'Today', discT: 'Discipline (30 days)', discD: 'Not a grade. A mirror: how often it stopped you, and how often you overrode it.',
    dRespect: 'Times you stopped', dOverride: 'Times you overrode', dSaved: 'Manager actions',
    blockedNow: 'You are blocked right now', notBlocked: 'No active blocks',
    tradesUsed: 'Trades today', dayPnl: 'Day result',
    overrideBtn: 'I want to override', overrideWait: 'Wait running', overrideCancel: 'Cancel and follow the plan',
    overrideWaitD: (m: number) => `You can override in ${m} minute(s). Think about it meanwhile.`,
    overrideOk: 'Granted for 60 minutes. It is on the record.',
    overrideNo: 'Loss limits cannot be overridden. That is exactly why you set them.',
    overrideHard: 'You picked the no-way-out mode. See you tomorrow.',

    reasons: {
      schedule: 'Outside hours', daily_loss: 'Daily loss', total_loss: 'Total loss',
      target: 'Target reached', tilt: 'Losing streak', cooldown: 'Cooldown',
      max_trades: 'Trade cap', max_open: 'Too many open', news: 'News nearby',
    },
    kinds2: { override: 'Overrode', limit: 'Limit', news: 'News', schedule: 'Schedule', tilt: 'Streak' },
    reqField: '* Required',
  },
};

const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;
const num = { margin: 0, width: 100, padding: '7px 10px' } as any;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : 'var(--line)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

// Tarjeta seleccionable con título y explicación
function Choice({ on, title, desc, onClick }: any) {
  return (
    <div onClick={onClick} style={{
      border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'),
      background: on ? 'rgba(124,140,255,.10)' : 'transparent',
      borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {desc && <div className="muted" style={{ fontSize: 12 }}>{desc}</div>}
    </div>
  );
}

// ============================================================
// Pestaña: Mi plan de trading
// ============================================================
export function PlanTab({ cfg, set, setCfg, t, acc }: any) {
  const p = cfg?.plan || {};

  // La hora del bróker, para que vea la diferencia con la suya
  const [brokerNow, setBrokerNow] = useState('');
  useEffect(() => {
    const off = Number(acc?.server_offset || 0);
    const tick = () => {
      const b = new Date(Date.now() + off * 60000);
      setBrokerNow(String(b.getUTCHours()).padStart(2, '0') + ':' + String(b.getUTCMinutes()).padStart(2, '0'));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [acc?.server_offset]);

  const toggleDay = (dow: number) => {
    const days = p.days.includes(dow) ? p.days.filter((x: number) => x !== dow) : [...p.days, dow].sort();
    setCfg({ ...cfg, plan: { ...p, days } });
  };
  const setWin = (i: number, k: string, v: any) => {
    const windows = p.windows.map((w: any, ix: number) => (ix === i ? { ...w, [k]: v } : w));
    setCfg({ ...cfg, plan: { ...p, windows } });
  };
  const setWk = (k: string, v: any) => setCfg({ ...cfg, plan: { ...p, weekend_close: { ...p.weekend_close, [k]: v } } });
  const setTilt = (k: string, v: any) => setCfg({ ...cfg, plan: { ...p, tilt: { ...p.tilt, [k]: v } } });

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 4 }}>
          <h3>{t.planT}</h3><Help slug="plan-de-trading" />
          <Toggle on={!!p.on} onClick={() => set('plan.on', !p.on)} />
        </div>
        <p className="muted" style={{ fontSize: 13 }}>{t.planD}</p>
      </div>

      {p.on && (
        <>
          {/* Días y franjas */}
          <div className="card" style={{ marginBottom: 14 }}>
            <span style={lbl}>{t.days}</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
              {t.dayNames.map((n: string, i: number) => (
                <button key={i} className={'btn ' + (p.days.includes(i) ? 'btn-primary' : 'btn-ghost')}
                  style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => toggleDay(i)}>{n}</button>
              ))}
            </div>

            <span style={lbl}>{t.windows}</span>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {t.windowsD} {brokerNow && <>· <b>{t.brokerTime}: {brokerNow}</b></>}
            </div>
            {p.windows.map((w: any, i: number) => (
              <div key={i} className="row" style={{ gap: 10, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ paddingBottom: 4 }}><Toggle on={!!w.on} onClick={() => setWin(i, 'on', !w.on)} /></div>
                <div><span style={lbl}>{t.from}</span><input type="time" value={w.from} onChange={(e) => setWin(i, 'from', e.target.value)} style={{ ...num, width: 120 }} /></div>
                <div><span style={lbl}>{t.to}</span><input type="time" value={w.to} onChange={(e) => setWin(i, 'to', e.target.value)} style={{ ...num, width: 120 }} /></div>
              </div>
            ))}
          </div>

          {/* Fin de semana */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>{t.wknd}</div>
                <div className="muted" style={{ fontSize: 13 }}>{t.wkndD}</div>
              </div>
              <Toggle on={!!p.weekend_close?.on} onClick={() => setWk('on', !p.weekend_close?.on)} />
            </div>
            {p.weekend_close?.on && (
              <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <span style={lbl}>{t.wkndDay}</span>
                  <select value={p.weekend_close.day} onChange={(e) => setWk('day', Number(e.target.value))} style={{ margin: 0, width: 140 }}>
                    {t.dayNames.map((n: string, i: number) => <option key={i} value={i}>{n}</option>)}
                  </select>
                </div>
                <div><span style={lbl}>{t.wkndTime}</span><input type="time" value={p.weekend_close.time} onChange={(e) => setWk('time', e.target.value)} style={{ ...num, width: 120 }} /></div>
              </div>
            )}
          </div>

          {/* Ritmo */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <span style={lbl}>{t.maxTrades}</span>
                <input type="number" min={0} value={p.max_trades_day} onChange={(e) => set('plan.max_trades_day', Number(e.target.value))} style={num} />
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.maxTradesD}</div>
              </div>
              <div>
                <span style={lbl}>{t.cooldown}</span>
                <input type="number" min={0} value={p.cooldown_min} onChange={(e) => set('plan.cooldown_min', Number(e.target.value))} style={num} />
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.cooldownD}</div>
              </div>
            </div>

            <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>{t.tiltT}</div>
                <div className="muted" style={{ fontSize: 13 }}>{t.tiltD}</div>
              </div>
              <Toggle on={!!p.tilt?.on} onClick={() => setTilt('on', !p.tilt?.on)} />
            </div>
            {p.tilt?.on && (
              <div className="row" style={{ gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                <div><span style={lbl}>{t.tiltLosses}</span><input type="number" min={2} value={p.tilt.losses} onChange={(e) => setTilt('losses', Number(e.target.value))} style={num} /></div>
                <div><span style={lbl}>{t.tiltPause}</span><input type="number" min={5} value={p.tilt.pause_min} onChange={(e) => setTilt('pause_min', Number(e.target.value))} style={num} /></div>
              </div>
            )}
          </div>

          {/* Rigidez */}
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 10 }}>{t.rigidT}</h3>
            <Choice on={p.rigidity === 'soft'} title={t.rigSoft} desc={t.rigSoftD} onClick={() => set('plan.rigidity', 'soft')} />
            <Choice on={p.rigidity === 'friction'} title={t.rigFriction} desc={t.rigFrictionD} onClick={() => set('plan.rigidity', 'friction')} />
            <Choice on={p.rigidity === 'hard'} title={t.rigHard} desc={t.rigHardD} onClick={() => set('plan.rigidity', 'hard')} />
            {p.rigidity === 'friction' && (
              <div style={{ marginTop: 10 }}>
                <span style={lbl}>{t.friction}</span>
                <input type="number" min={1} max={240} value={p.friction_min} onChange={(e) => set('plan.friction_min', Number(e.target.value))} style={num} />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// Pestaña: Límites de la cuenta
// ============================================================
export function LimitsTab({ cfg, set, setCfg, t, firms, firmSel, setFirmSel, lang }: any) {
  const l = cfg?.limits || {};

  function applyFirm(id: string) {
    const f = (firms || []).find((x: any) => x.id === id);
    if (!f) return;
    setFirmSel(id);
    setCfg({
      ...cfg,
      limits: {
        ...l, on: true,
        daily_loss: Number(f.daily_loss || 0), daily_loss_pct: true,
        total_loss: Number(f.total_loss || 0), total_loss_pct: true,
        base: f.base || 'day_start_balance',
        reset_hour: Number(f.reset_hour || 0),
      },
    });
  }
  const firm = (firms || []).find((x: any) => x.id === firmSel);

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 4 }}>
          <h3>{t.limT}</h3><Help slug="limites-cuenta" />
          <Toggle on={!!l.on} onClick={() => set('limits.on', !l.on)} />
        </div>
        <p className="muted" style={{ fontSize: 13 }}>{t.limD}</p>
      </div>

      {l.on && (
        <>
          {/* Plantillas de firma */}
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 4 }}>{t.firmT}</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.firmD}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {(firms || []).map((f: any) => (
                <button key={f.id} className={'btn ' + (firmSel === f.id ? 'btn-primary' : 'btn-ghost')}
                  style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => applyFirm(f.id)}>{f.name}</button>
              ))}
            </div>
            {firm && (
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                {lang === 'en' ? (firm.note_en || firm.note_es) : (firm.note_es || firm.note_en)}
              </div>
            )}
          </div>

          {/* Los dos campos que todo el mundo falla */}
          <div className="card" style={{ marginBottom: 14, border: '1px solid var(--brand)' }}>
            <span style={lbl}>{t.baseT}</span>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.baseD}</div>
            <Choice on={l.base === 'day_start_balance'} title={t.baseBal} desc={t.baseBalD} onClick={() => set('limits.base', 'day_start_balance')} />
            <Choice on={l.base === 'day_start_equity'} title={t.baseEq} desc={t.baseEqD} onClick={() => set('limits.base', 'day_start_equity')} />
            <Choice on={l.base === 'initial_balance'} title={t.baseInit} desc={t.baseInitD} onClick={() => set('limits.base', 'initial_balance')} />

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
              <span style={lbl}>{t.resetT}</span>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t.resetD}</div>
              <select value={l.reset_hour} onChange={(e) => set('limits.reset_hour', Number(e.target.value))} style={{ margin: 0, width: 160 }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>{t.reqField}</div>
          </div>

          {/* Números */}
          <div className="card" style={{ marginBottom: 14 }}>
            {([
              ['daily_loss', 'daily_loss_pct', t.dLoss, t.lossD],
              ['total_loss', 'total_loss_pct', t.tLoss, t.lossD],
              ['daily_target', 'daily_target_pct', t.dTarget, t.targetD],
            ] as [string, string, string, string][]).map(([k, pk, label, desc]) => (
              <div key={k} style={{ marginBottom: 16 }}>
                <span style={lbl}>{label}</span>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <input type="number" min={0} value={l[k]} onChange={(e) => set('limits.' + k, Number(e.target.value))} style={num} />
                  <button className={'btn ' + (l[pk] ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 12px' }} onClick={() => set('limits.' + pk, true)}>{t.pct}</button>
                  <button className={'btn ' + (!l[pk] ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 12px' }} onClick={() => set('limits.' + pk, false)}>{t.money}</button>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{desc}</div>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <span style={lbl}>{t.margin}</span>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="number" min={0} max={90} value={l.safety_margin} onChange={(e) => set('limits.safety_margin', Number(e.target.value))} style={num} />
                <span className="muted" style={{ fontSize: 13 }}>%</span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t.marginD}</div>
            </div>

            <div className="row" style={{ gap: 18, flexWrap: 'wrap', marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div>
                <span style={lbl}>{t.maxLots}</span>
                <input type="number" min={0} step={0.01} value={l.max_lots} onChange={(e) => set('limits.max_lots', Number(e.target.value))} style={num} />
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.zero}</div>
              </div>
              <div>
                <span style={lbl}>{t.maxOpen}</span>
                <input type="number" min={0} value={l.max_open} onChange={(e) => set('limits.max_open', Number(e.target.value))} style={num} />
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.zero}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 10 }}>{t.breachT}</h3>
            <Choice on={l.on_breach === 'warn'} title={t.bWarn} onClick={() => set('limits.on_breach', 'warn')} />
            <Choice on={l.on_breach === 'block_new'} title={t.bBlock} onClick={() => set('limits.on_breach', 'block_new')} />
            <Choice on={l.on_breach === 'close_and_block'} title={t.bClose} onClick={() => set('limits.on_breach', 'close_and_block')} />
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// Pestaña: Noticias
// ============================================================
export function NewsTab({ cfg, set, t, canNews, advLabel }: any) {
  const n = cfg?.news || {};
  return (
    <div className="card" style={{ marginBottom: 14, opacity: canNews ? 1 : .75 }}>
      <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <h3>{t.newsT}</h3>
          {!canNews && <span className="pill" style={{ color: '#7fe9c0', background: 'rgba(52,226,160,.15)', border: '1px solid #34e2a0' }}>🔒 {advLabel}</span>}
        </div>
        {canNews && <Toggle on={!!n.on} onClick={() => set('news.on', !n.on)} />}
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: canNews && n.on ? 14 : 0 }}>{t.newsD}</p>

      {canNews && n.on && (
        <>
          <span style={lbl}>{t.impact}</span>
          <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className={'btn ' + (n.impact === 'high' ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 12px' }} onClick={() => set('news.impact', 'high')}>{t.iHigh}</button>
            <button className={'btn ' + (n.impact === 'high_medium' ? 'btn-primary' : 'btn-ghost')} style={{ padding: '6px 12px' }} onClick={() => set('news.impact', 'high_medium')}>{t.iBoth}</button>
          </div>

          <div className="row" style={{ gap: 18, flexWrap: 'wrap', marginBottom: 16 }}>
            <div><span style={lbl}>{t.before}</span><input type="number" min={0} value={n.before_min} onChange={(e) => set('news.before_min', Number(e.target.value))} style={num} /></div>
            <div><span style={lbl}>{t.after}</span><input type="number" min={0} value={n.after_min} onChange={(e) => set('news.after_min', Number(e.target.value))} style={num} /></div>
          </div>

          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14 }}>{t.onlySym}</div>
              <div className="muted" style={{ fontSize: 12 }}>{t.onlySymD}</div>
            </div>
            <Toggle on={!!n.only_symbol} onClick={() => set('news.only_symbol', !n.only_symbol)} />
          </div>

          <h3 style={{ marginBottom: 10, fontSize: 15 }}>{t.breachT}</h3>
          <Choice on={n.action === 'warn'} title={t.bWarn} onClick={() => set('news.action', 'warn')} />
          <Choice on={n.action === 'block_new'} title={t.bBlock} onClick={() => set('news.action', 'block_new')} />
          <Choice on={n.action === 'close_and_block'} title={t.bClose} onClick={() => set('news.action', 'close_and_block')} />

          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(245,158,11,.08)', border: '1px solid var(--amber)', borderRadius: 10 }}>
            <div style={{ fontSize: 13 }}>{t.newsWarn}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Pestaña: Estado de hoy, disciplina e historial
// ============================================================
export function StateTab({ t, tMain, lang, accountId }: any) {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/manager/state?account_id=' + encodeURIComponent(accountId || ''));
      if (!r.ok) { setS({ state: null, discipline: null, events: [] }); return; }
      setS(await r.json());
    } catch { setS({ state: null, discipline: null, events: [] }); }
  }
  useEffect(() => { load(); }, [accountId]);

  async function override(action?: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/manager/state', { method: 'POST', body: JSON.stringify({ account_id: accountId, action }) });
      const j = await r.json();
      if (!r.ok) {
        alert(j.code === 'override_forbidden' ? t.overrideNo : j.code === 'override_locked' ? t.overrideHard : (j.error || ''));
      } else if (j.state === 'granted') {
        alert(t.overrideOk);
      } else if (j.state === 'waiting') {
        alert(t.overrideWaitD(j.remaining_min ?? j.wait_min ?? 0));
      }
      await load();
    } catch { /* sin conexión */ }
    setBusy(false);
  }

  if (!s) return <div className="card muted">…</div>;
  const st = s.state;
  const disc = s.discipline;
  const waiting = st?.override_requested_at && !(st?.override_until && new Date(st.override_until) > new Date());

  return (
    <>
      {/* Estado de hoy */}
      <div className="card" style={{ marginBottom: 14, border: st?.blocked ? '1px solid var(--amber)' : undefined }}>
        <h3 style={{ marginBottom: 10 }}>{t.todayT}</h3>
        {st?.blocked ? (
          <>
            <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: 4 }}>
              🔒 {t.blockedNow} · {t.reasons[st.blocked_reason] || st.blocked_reason}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {waiting
                ? <button className="btn btn-ghost" onClick={() => override('cancel')} disabled={busy}>{t.overrideCancel}</button>
                : <button className="btn btn-ghost" onClick={() => override()} disabled={busy}>{t.overrideBtn}</button>}
              {waiting && <span className="pill" style={{ color: 'var(--amber)' }}>{t.overrideWait}</span>}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--green)', fontWeight: 600 }}>✓ {t.notBlocked}</div>
        )}

        <div className="row" style={{ gap: 24, marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14, flexWrap: 'wrap' }}>
          <div><div className="muted" style={{ fontSize: 12 }}>{t.tradesUsed}</div><b style={{ fontSize: 20 }}>{st?.trades_today ?? 0}</b></div>
          <div><div className="muted" style={{ fontSize: 12 }}>{t.dRespect}</div><b style={{ fontSize: 20 }}>{disc?.blocked ?? 0}</b></div>
          <div><div className="muted" style={{ fontSize: 12 }}>{t.dOverride}</div><b style={{ fontSize: 20, color: (disc?.overrides || 0) > 0 ? 'var(--amber)' : undefined }}>{disc?.overrides ?? 0}</b></div>
        </div>
      </div>

      {/* Disciplina */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 4 }}>{t.discT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.discD}</p>
        <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: (disc?.score ?? 100) >= 80 ? 'var(--green)' : (disc?.score ?? 0) >= 50 ? 'var(--amber)' : 'var(--red)' }}>
            {disc?.score ?? 100}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ height: 8, background: 'var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ width: `${disc?.score ?? 100}%`, height: '100%', background: 'var(--grad)' }} />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t.dSaved}: {disc?.saved ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>{tMain.evT}</h3>
        {!s.events?.length && <p className="muted" style={{ fontSize: 14 }}>{tMain.evNone}</p>}
        {(s.events || []).map((e: any) => {
          const name = tMain.kinds[e.kind] || t.kinds2[e.kind] || e.kind;
          const isOverride = e.kind === 'override';
          return (
            <div key={e.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '9px 0', fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: isOverride ? 'var(--amber)' : undefined }}>
                <b>{name}</b>{e.symbol ? ` · ${e.symbol}` : ''}{e.detail ? ` · ${e.detail}` : ''}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
