'use client';
import { useEffect, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';
import Link from 'next/link';
import QrPop from '@/app/components/QrPop';

// ============================================================
// Conectar Telegram, desde Mi cuenta → Avisos.
//
// Para el usuario es un clic: pulsa "Conectar Telegram", se abre el bot
// con el código ya puesto, le da a Start y queda vinculado. Aquí solo
// generamos el enlace y comprobamos cada pocos segundos si ya se enlazó.
// ============================================================

const T: any = {
  es: {
    title: 'Avisos por Telegram', badge: 'Elite',
    intro: 'Recibe en tu Telegram cuando el Guardian te frene, cuando toques un límite de riesgo o cuando te acerques a una regla de fondeo.',
    lockT: 'Los avisos por Telegram son del plan Elite',
    lockCta: 'Ver planes →',
    connect: 'Conectar Telegram', opening: 'Abriendo…',
    step: 'Se abrirá Telegram con el bot. Pulsa Start y vuelve aquí.',
    waiting: 'Esperando a que abras el bot en Telegram…',
    plan_b_t: '¿No te pide pulsar Start?',
    plan_b_d: 'Copia este código y pégalo como mensaje al bot:',
    open_bot: 'Abrir el bot',
    connected: 'Conectado', as: 'como', unlink: 'Desconectar',
    prefsT: 'Qué avisos quieres aquí',
    prefs: {
      tg_blocks: 'Cuando el Guardian te frena',
      tg_limits: 'Límites de pérdida y objetivo',
      tg_funding: 'Cerca de una regla de fondeo',
      tg_offline: 'Guardian sin señal (EA caído)',
      tg_goal: 'Objetivo de fondeo alcanzado',
      tg_manager: 'Break even, trailing y parciales',
      tg_daily: 'Resumen del día',
      tg_weekly: 'Informe semanal',
      tg_copy_paused: 'Copia pausada o reanudada',
      tg_copy_error: 'Fallo al copiar (símbolo, spread…)',
    },
    reportT: 'Reporte de rendimiento (con PDF y gráfico)',
    reportOff: 'No enviar', reportWeekly: 'Semanal (lunes)', reportMonthly: 'Mensual (día 1)',
    reportHint: 'Recibe tu resumen, tu gráfico, tu PDF y tu CSV de operaciones directo en Telegram.',
    off: 'Los avisos generales están apagados. Enciéndelos arriba para recibir nada por Telegram.',
    saved: 'Guardado', test: 'Enviar prueba', testOk: 'Enviado ✓', testSending: '...',
    rtestBtn: '📤 Enviarme un reporte de prueba ahora', rtestSending: 'Enviando…', rtestOk: '✓ Enviado a tu Telegram', rtestEmpty: 'Enviado, pero no tienes operaciones esta semana.',
    grpGuardian: 'Guardian', grpRisk: 'Riesgo y fondeo', grpSummary: 'Resúmenes', grpCopy: 'Copy trading',
    cmdsT: 'Comandos del bot',
    cmdEstado: 'Resumen de tus últimas 24h, sin abrir la web.',
    cmdInforme: 'Reporte de la semana con gráfico, PDF y CSV.',
    cmdMes: 'Reporte del mes con gráfico, PDF y CSV.',
    cmdCopy: 'Estado del copy: activo o pausado.',
    cmdCopyOff: 'Pausar toda la copia al instante.',
    cmdCopyOn: 'Reanudar la copia (pide tu PIN).',
    cmdStop: 'Deja de recibir avisos. Los reactivas desde aquí.',
    cmdExample: 'ASÍ SE VE EN TELEGRAM',
    cmdMsgT: 'Últimas 24h', cmdMsg1: 'Operaciones: 3', cmdMsg2: 'Resultado: +$182.40', cmdMsg3: 'El Guardian te frenó: 1 vez',
    unavailable: 'Los avisos por Telegram aún no están disponibles. Vuelve pronto.',
  },
  en: {
    title: 'Telegram alerts', badge: 'Elite',
    intro: 'Get a message on Telegram when the Guardian stops you, when you hit a risk limit, or when you get close to a funding rule.',
    lockT: 'Telegram alerts are on the Elite plan',
    lockCta: 'See plans →',
    connect: 'Connect Telegram', opening: 'Opening…',
    step: 'Telegram will open with the bot. Tap Start and come back here.',
    waiting: 'Waiting for you to open the bot on Telegram…',
    plan_b_t: 'No Start button showing?',
    plan_b_d: 'Copy this code and send it as a message to the bot:',
    open_bot: 'Open the bot',
    connected: 'Connected', as: 'as', unlink: 'Disconnect',
    prefsT: 'Which alerts you want here',
    prefs: {
      tg_blocks: 'When the Guardian stops you',
      tg_limits: 'Loss and target limits',
      tg_funding: 'Close to a funding rule',
      tg_offline: 'Guardian offline (EA down)',
      tg_goal: 'Funding target reached',
      tg_manager: 'Break even, trailing and partials',
      tg_daily: 'Daily summary',
      tg_weekly: 'Weekly report',
      tg_copy_paused: 'Copy paused or resumed',
      tg_copy_error: 'Copy failed (symbol, spread…)',
    },
    reportT: 'Performance report (with PDF and chart)',
    reportOff: 'Do not send', reportWeekly: 'Weekly (Monday)', reportMonthly: 'Monthly (1st)',
    reportHint: 'Get your summary, chart, PDF and trades CSV straight to Telegram.',
    off: 'General alerts are off. Turn them on above to receive anything on Telegram.',
    saved: 'Saved', test: 'Send a test', testOk: 'Sent ✓', testSending: '...',
    rtestBtn: '📤 Send me a test report now', rtestSending: 'Sending…', rtestOk: '✓ Sent to your Telegram', rtestEmpty: 'Sent, but you have no trades this week.',
    grpGuardian: 'Guardian', grpRisk: 'Risk and funding', grpSummary: 'Summaries', grpCopy: 'Copy trading',
    cmdsT: 'Bot commands',
    cmdEstado: 'A summary of your last 24h, without opening the web.',
    cmdInforme: 'Week report with chart, PDF and CSV.',
    cmdMes: 'Month report with chart, PDF and CSV.',
    cmdCopy: 'Copy status: active or paused.',
    cmdCopyOff: 'Pause all copying instantly.',
    cmdCopyOn: 'Resume copying (asks your PIN).',
    cmdStop: 'Stop receiving alerts. Turn them back on here.',
    cmdExample: 'THIS IS HOW IT LOOKS ON TELEGRAM',
    cmdMsgT: 'Last 24h', cmdMsg1: 'Trades: 3', cmdMsg2: 'Result: +$182.40', cmdMsg3: 'The Guardian stopped you: 1 time',
    unavailable: 'Telegram alerts are not available yet. Check back soon.',
  },
};

// Mini-chats de ejemplo por comando (lo que ve el trader en Telegram).
function tgPreviews(lang: 'es' | 'en'): any[] {
  const es = lang === 'es';
  return [
    { cmd: '/estado', tag: es ? 'texto' : 'text', title: es ? 'Últimas 24h' : 'Last 24h',
      lines: es ? ['Operaciones: 3', 'Resultado: +$182.40', 'El Guardian te frenó: 1 vez'] : ['Trades: 3', 'Result: +$182.40', 'The Guardian stopped you: 1 time'] },
    { cmd: '/report', tag: es ? 'con adjuntos' : 'with files', title: es ? 'Reporte semanal' : 'Weekly report',
      lines: es ? ['Neto: +$540.20', 'Aciertos: 62%', 'Factor: 1.8'] : ['Net: +$540.20', 'Win rate: 62%', 'Profit factor: 1.8'],
      attach: ['🖼️ ' + (es ? 'resumen.png' : 'summary.png'), '📄 ' + (es ? 'reporte.pdf' : 'report.pdf'), '📊 ' + (es ? 'operaciones.csv' : 'trades.csv')] },
    { cmd: '/mes', tag: es ? 'con adjuntos' : 'with files', title: es ? 'Reporte mensual' : 'Monthly report',
      lines: es ? ['Neto: +$2,110', 'Aciertos: 58%'] : ['Net: +$2,110', 'Win rate: 58%'],
      attach: ['🖼️ ' + (es ? 'resumen.png' : 'summary.png'), '📄 ' + (es ? 'reporte.pdf' : 'report.pdf')] },
    { cmd: '/copy', tag: es ? 'estado' : 'status', title: es ? 'Copia: ACTIVA ▶' : 'Copy: ACTIVE ▶',
      lines: es ? ['Enlaces activos: 2', 'Última señal: 2 s'] : ['Active links: 2', 'Last signal: 2 s'] },
    { cmd: '/copyoff', tag: es ? 'acción' : 'action', title: es ? 'Copia PAUSADA ⏸' : 'Copy PAUSED ⏸',
      lines: es ? ['No se replicará ninguna operación.', 'Reanuda con /copyon'] : ['Nothing will be copied.', 'Resume with /copyon'] },
    { cmd: '/copyon', tag: es ? 'pide PIN' : 'asks PIN', title: es ? 'Copia: ACTIVA ▶' : 'Copy: ACTIVE ▶',
      lines: es ? ['Volverá a copiar tus operaciones.'] : ['It will copy your trades again.'] },
  ];
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function TelegramCard({ lang }: { lang: 'es' | 'en' }) {
  const t = T[lang] || T.en;
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [link, setLink] = useState<{ url: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try { const r = await fetch('/api/account/telegram'); setD(await r.json()); } catch {}
  }
  useEffect(() => { load(); }, []);

  // Mientras espera a que pulse Start, preguntamos cada 3s si ya se vinculó
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(async () => {
      const r = await fetch('/api/account/telegram'); const j = await r.json();
      if (j.linked) { setD(j); setWaiting(false); }
    }, 3000);
    const stop = setTimeout(() => setWaiting(false), 180000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [waiting]);

  async function connect() {
    setBusy('link');
    const r = await fetch('/api/account/telegram', { method: 'POST', body: JSON.stringify({ action: 'link' }) });
    const j = await r.json(); setBusy('');
    if (j.url) { setLink({ url: j.url, code: j.code }); window.open(j.url, '_blank'); setWaiting(true); }
  }
  async function unlink() {
    setBusy('unlink');
    await fetch('/api/account/telegram', { method: 'POST', body: JSON.stringify({ action: 'unlink' }) });
    setBusy(''); load();
  }
  async function setPref(k: string, v: boolean) {
    setD({ ...d, prefs: { ...d.prefs, [k]: v } });
    await fetch('/api/account/telegram', { method: 'POST', body: JSON.stringify({ action: 'prefs', [k]: v }) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function setReport(v: string) {
    setD({ ...d, report: v });
    await fetch('/api/account/telegram', { method: 'POST', body: JSON.stringify({ action: 'prefs', tg_report: v }) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  const [tested, setTested] = useState('');
  async function sendTest() {
    setTested('sending');
    const r = await fetch('/api/account/telegram', { method: 'POST', body: JSON.stringify({ action: 'test' }) });
    setTested(r.ok ? 'ok' : ''); setTimeout(() => setTested(''), 2500);
  }
  const [rtest, setRtest] = useState('');
  async function sendReportTest() {
    setRtest('sending');
    try {
      const r = await fetch('/api/account/telegram', { method: 'POST', body: JSON.stringify({ action: 'report_test' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setRtest('err:' + (j.error || 'Error')); return; }
      setRtest(j.trades > 0 ? 'ok' : 'empty');
    } catch { setRtest('err'); }
    setTimeout(() => setRtest(''), 6000);
  }

  if (!d) return <div className="muted" style={{ fontSize: 13 }}>…</div>;

  const head = (
    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
      <h3 style={{ fontSize: 16 }}>{t.title}</h3>
      <span className="pill" style={{ color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)', border: '1px solid var(--green)' }}>{t.badge}</span>
    </div>
  );

  // No disponible en el servidor (falta el token del bot)
  if (!d.available) {
    return <>{head}<p className="muted" style={{ fontSize: 13 }}>{t.unavailable}</p></>;
  }

  // No está en su plan
  if (!d.inPlan) {
    return (
      <>{head}
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t.lockT}</p>
        <Link className="btn btn-ghost" href="/pricing" style={{ fontSize: 13 }}>{t.lockCta}</Link>
      </>
    );
  }

  return (
    <>{head}
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.intro}</p>

      {d.linked ? (
        <>
          <div className="row between" style={{ padding: '10px 12px', background: 'rgba(52,226,160,.06)', border: '1px solid var(--green)', borderRadius: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: 'var(--green)' }}>✓ {t.connected}{d.username ? ` · ${d.username}` : ''}</span>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={unlink} disabled={busy === 'unlink'}>{t.unlink}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {([[t.grpGuardian, ['tg_blocks', 'tg_manager', 'tg_offline']], [t.grpRisk, ['tg_limits', 'tg_funding', 'tg_goal']], [t.grpSummary, ['tg_daily', 'tg_weekly']], [t.grpCopy, ['tg_copy_paused', 'tg_copy_error']]] as [string, string[]][]).map(([grp, keys], gi) => (
              <div key={gi} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--mut)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>{grp}</div>
                {keys.map((k, i) => (
                  <div key={k} className="row between" style={{ padding: '7px 0', borderTop: i ? '1px solid var(--line)' : 'none', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{t.prefs[k]}</span>
                    <Toggle on={!!d.prefs[k]} onClick={() => setPref(k, !d.prefs[k])} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Reporte + comandos, en dos columnas (a lo ancho) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, marginTop: 16, alignItems: 'start' }}>
            {/* Reporte destacado */}
            <div style={{ background: 'rgba(124,140,255,.08)', border: '1px solid rgba(124,140,255,.35)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--soft-brand)' }}><OnyxIcon emoji="📊" size={16} /> {t.reportT}</div>
              <div className="muted" style={{ fontSize: 11.5, margin: '2px 0 10px' }}>{t.reportHint}</div>
              <select value={d.report || 'off'} onChange={(e) => setReport(e.target.value)} style={{ margin: 0, width: '100%', padding: '7px 10px' }}>
                <option value="off">{t.reportOff}</option>
                <option value="weekly">{t.reportWeekly}</option>
                <option value="monthly">{t.reportMonthly}</option>
              </select>
              <button className="btn btn-primary" style={{ fontSize: 13, marginTop: 10, width: '100%' }} onClick={sendReportTest} disabled={rtest === 'sending'}>
                {rtest === 'sending' ? t.rtestSending : t.rtestBtn}
              </button>
              {rtest === 'ok' && <div style={{ color: 'var(--green)', fontSize: 12.5, marginTop: 8 }}>{t.rtestOk}</div>}
              {rtest === 'empty' && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{t.rtestEmpty}</div>}
              {rtest.startsWith('err') && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{rtest.slice(4) || 'Error'}</div>}
              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={sendTest} disabled={tested === 'sending'}>
                  {tested === 'ok' ? t.testOk : tested === 'sending' ? t.testSending : t.test}
                </button>
                {saved && <span style={{ color: 'var(--green)', fontSize: 12 }}>{t.saved}</span>}
              </div>
            </div>

            {/* Comandos del bot */}
            <div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>{t.cmdsT}</div>
              {([['/estado', t.cmdEstado], ['/report', t.cmdInforme], ['/mes', t.cmdMes], ['/copy', t.cmdCopy], ['/copyoff', t.cmdCopyOff], ['/copyon', t.cmdCopyOn], ['/stop', t.cmdStop]] as [string, string][]).map(([cmd, desc]) => (
                <div key={cmd} className="row" style={{ gap: 8, marginBottom: 9, alignItems: 'flex-start' }}>
                  <code style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 7, padding: '3px 9px', color: '#aeb7ff', fontSize: 12.5, flex: 'none' }}>{cmd}</code>
                  <span className="muted" style={{ fontSize: 12.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vistas previas por comando, centradas */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 10, letterSpacing: '.03em', textAlign: 'center' }}>{t.cmdExample}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12, maxWidth: 720, margin: '0 auto' }}>
              {tgPreviews(lang).map((x, i) => (
                <div key={i} style={{ background: '#17212b', borderRadius: 12, padding: 11 }}>
                  <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ background: '#2b5278', color: '#fff', fontSize: 12.5, padding: '4px 10px', borderRadius: '12px 12px 3px 12px' }}>{x.cmd}</span>
                    <span style={{ fontSize: 9.5, color: '#8a97a5', border: '0.5px solid #2a333d', borderRadius: 999, padding: '1px 7px' }}>{x.tag}</span>
                  </div>
                  <div className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#111726' }}>O</span>
                    <div style={{ background: '#212d3b', borderRadius: '12px 12px 12px 3px', padding: '8px 10px', fontSize: 12.5, lineHeight: 1.6, color: '#e6ebf2', flex: 1 }}>
                      <OnyxIcon emoji="📊" size={16} /> <b>{x.title}</b><br />{x.lines.map((ln: string, j: number) => <span key={j}>{ln}<br /></span>)}
                      {x.attach && <span style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>{x.attach.map((a: string, j: number) => <span key={j} style={{ background: '#2a3646', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#c7ced6' }}>{a}</span>)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : waiting ? (
        <>
          <div className="row" style={{ gap: 10, marginBottom: 14 }}>
            <span className="spin" style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--bg2)', borderTopColor: 'var(--brand)', flex: 'none' }} />
            <span className="muted" style={{ fontSize: 13 }}>{t.waiting}</span>
          </div>

          {/* Plan B: si el bot ya estaba abierto, no aparece "Start".
              El usuario pega este código en el chat y queda vinculado igual. */}
          {link && (
            <div style={{ padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t.plan_b_t}</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{t.plan_b_d}</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 16, letterSpacing: 2, padding: '7px 12px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }}>{link.code}</code>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => { navigator.clipboard.writeText(link.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? '✓' : (lang === 'es' ? 'Copiar' : 'Copy')}
                </button>
                <a className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} href={link.url} target="_blank" rel="noreferrer">{t.open_bot}</a>
                <QrPop data={link.url} label={lang === 'es' ? 'Escanear' : 'Scan'} />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button className="btn btn-primary" onClick={connect} disabled={busy === 'link'}>
            {busy === 'link' ? t.opening : t.connect}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.step}</p>
        </>
      )}
    </>
  );
}
