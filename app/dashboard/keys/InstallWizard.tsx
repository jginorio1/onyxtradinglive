'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ============================================================
// Asistente de instalación del EA.
//
// De los siete pasos, solo dos se pueden comprobar de verdad: la descarga
// (se pulsó aquí) y el final (el EA sincronizó). Los cinco de en medio
// ocurren dentro de MetaTrader y no los vemos, así que avanzan cuando el
// trader dice que los hizo.
//
// Pero el final NO se lo creemos: preguntamos al servidor hasta que llegue
// la primera señal real. Y si a los 90 segundos no ha llegado, enseñamos
// las cuatro causas habituales en orden de probabilidad.
// ============================================================

const POLL_MS = 5000;
const HELP_AFTER_MS = 90000;

export const WIZ: any = {
  es: {
    title: 'Instalar Onyx en MetaTrader',
    stepOf: (a: number, b: number) => `Paso ${a} de ${b}`,
    seeAll: 'Ver todos los pasos', seeWizard: 'Guíame paso a paso',
    back: 'Atrás', next: 'Ya lo hice', start: 'Empezar',
    needKey: 'Antes de instalar, crea una clave arriba para tu cuenta.',

    waitT: 'Esperando la primera señal de tu MetaTrader…',
    waitD: 'Enciende AlgoTrading (el botón verde de arriba). Suele tardar menos de un minuto.',
    checking: 'Comprobando cada 5 segundos',
    retry: 'Comprobar ahora',

    okT: 'Conectado',
    okD: (n: number) => `${n} operación(es) importada(s)`,
    okNone: 'Todavía sin operaciones en el historial, pero la conexión funciona.',
    goDash: 'Ver mi dashboard', goManager: 'Configurar el gestor',
    again: 'Conectar otra cuenta',

    stuckT: 'Todavía no llega nada',
    stuckD: 'Casi siempre es una de estas cuatro. Revísalas en orden:',
    stuck: [
      { t: 'El botón AlgoTrading no está verde', d: 'Es lo que falla el 80% de las veces.' },
      { t: 'Falta autorizar la URL', d: 'Herramientas → Opciones → Asesores Expertos → "Permitir WebRequest".' },
      { t: 'En el gráfico no sale la carita sonriente', d: 'Si hay una cruz, el EA no está activo en ese gráfico.' },
      { t: 'La clave se pegó mal', d: 'Vuelve al paso de los campos y cópiala otra vez.' },
    ],
    keepWaiting: 'Seguir esperando', backToFields: 'Volver a los campos',

    connectedT: 'Tu MetaTrader está conectado',
    connectedD: (l: any, b: string) => `Cuenta ${l}${b ? ' · ' + b : ''}`,
    expand: 'Conectar otra cuenta',
    staleT: 'Configurada, pero sin señal ahora',
    staleHint: 'Abre MetaTrader, pon el EA en un gráfico y activa AlgoTrading para que vuelva a sincronizar.',
    since: (m: number) => m < 1 ? 'hace segundos' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} día(s)`,
    lastSeen: 'Última señal',
  },
  en: {
    title: 'Install Onyx in MetaTrader',
    stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    seeAll: 'See all steps', seeWizard: 'Guide me step by step',
    back: 'Back', next: 'Done, next', start: 'Start',
    needKey: 'Before installing, create a key above for your account.',

    waitT: 'Waiting for the first signal from your MetaTrader…',
    waitD: 'Turn on AlgoTrading (the green button at the top). It usually takes under a minute.',
    checking: 'Checking every 5 seconds',
    retry: 'Check now',

    okT: 'Connected',
    okD: (n: number) => `${n} trade(s) imported`,
    okNone: 'No trades in your history yet, but the connection works.',
    goDash: 'Go to my dashboard', goManager: 'Set up the manager',
    again: 'Connect another account',

    stuckT: 'Nothing has arrived yet',
    stuckD: 'It is almost always one of these four. Check them in order:',
    stuck: [
      { t: 'The AlgoTrading button is not green', d: 'This is what fails 80% of the time.' },
      { t: 'The URL is not authorized', d: 'Tools → Options → Expert Advisors → "Allow WebRequest".' },
      { t: 'No smiley face on the chart', d: 'If you see a cross, the EA is not active on that chart.' },
      { t: 'The key was pasted wrong', d: 'Go back to the fields step and copy it again.' },
    ],
    keepWaiting: 'Keep waiting', backToFields: 'Back to the fields',

    connectedT: 'Your MetaTrader is connected',
    connectedD: (l: any, b: string) => `Account ${l}${b ? ' · ' + b : ''}`,
    expand: 'Connect another account',
    staleT: 'Set up, but not reporting now',
    staleHint: 'Open MetaTrader, put the EA on a chart and turn on AlgoTrading so it syncs again.',
    since: (m: number) => m < 1 ? 'seconds ago' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} day(s) ago`,
    lastSeen: 'Last signal',
  },
};

function mmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function InstallWizard({ t, w, apiUrl, origin, apiKey, onDownload, copy, copied }: any) {
  const total = t.steps.length;
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'wizard' | 'list'>('wizard');
  const [status, setStatus] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const startedAt = useRef(0);

  // Retomar donde lo dejó: instalar un EA obliga a saltar entre el
  // navegador y MetaTrader varias veces, y se pierde el hilo.
  useEffect(() => {
    try {
      const s = Number(localStorage.getItem('onyx_wiz_step') || 0);
      if (s > 0 && s < total) setStep(s);
      if (localStorage.getItem('onyx_wiz_mode') === 'list') setMode('list');
    } catch {}
  }, [total]);
  useEffect(() => { try { localStorage.setItem('onyx_wiz_step', String(step)); } catch {} }, [step]);

  const check = useCallback(async () => {
    try {
      const r = await fetch('/api/install/status');
      if (!r.ok) return null;
      const j = await r.json();
      setStatus(j);
      return j;
    } catch { return null; }
  }, []);

  // Al abrir: si ya hay una cuenta reportando, lo enseñamos plegado
  useEffect(() => {
    check().then((j) => { if (j?.connected) setCollapsed(true); });
  }, [check]);

  // En el último paso preguntamos al servidor hasta que llegue la señal
  const waiting = step === total - 1 && !status?.connected;
  useEffect(() => {
    if (!waiting) return;
    if (!startedAt.current) startedAt.current = Date.now();
    const poll = setInterval(check, POLL_MS);
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [waiting, check]);

  const lbl = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 4 } as any;

  // ---- Ya configurado y plegado ----
  // OJO: "connected" solo significa que la cuenta sincronizó ALGUNA vez.
  // Para decir "conectado" en verde usamos "live" (señal en los últimos 2 min).
  // Si no está viva, mostramos "sin señal ahora" en ámbar con la última hora.
  if (collapsed && status?.connected) {
    const live = !!status.live;
    const mins = status.account?.lastSyncAt
      ? Math.max(0, Math.floor((Date.now() - new Date(status.account.lastSyncAt).getTime()) / 60000))
      : 0;
    const col = live ? 'var(--green)' : 'var(--amber)';
    return (
      <div className="card" style={{ marginBottom: 18, border: '1px solid ' + col }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{
              width: 30, height: 30, borderRadius: '50%', flex: 'none',
              background: live ? 'rgba(52,226,160,.14)' : 'rgba(245,158,11,.14)', color: col,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>{live ? '✓' : '⚠'}</span>
            <div>
              <div style={{ fontWeight: 700, color: col }}>{live ? w.connectedT : w.staleT}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {w.connectedD(status.account?.login, status.account?.broker)}
                {status.syncedAccounts > 1 && ` · ${status.syncedAccounts}`}
                {!live && ` · ${w.lastSeen}: ${w.since(mins)}`}
              </div>
              {!live && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{w.staleHint}</div>}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
            onClick={() => { setCollapsed(false); setStep(0); }}>{w.expand}</button>
        </div>
      </div>
    );
  }

  // ---- Lista completa (para quien ya sabe) ----
  if (mode === 'list') {
    return (
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3>{t.step3}</h3>
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
            onClick={() => { setMode('wizard'); try { localStorage.setItem('onyx_wiz_mode', 'wizard'); } catch {} }}>
            {w.seeWizard}
          </button>
        </div>
        {t.steps.map((s: any, i: number) => (
          <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flex: 'none', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--line)', color: 'var(--mut)',
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{s.t}</div>
              {s.d && <div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.6 }}>{s.d}</div>}
              <StepExtras s={s} t={t} w={w} apiUrl={apiUrl} origin={origin} apiKey={apiKey} copy={copy} copied={copied} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---- Éxito ----
  if (status?.connected && step === total - 1) {
    return (
      <div className="card" style={{ marginBottom: 18, border: '1px solid var(--green)', textAlign: 'center', padding: 28 }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%', margin: '0 auto 14px',
          background: 'rgba(52,226,160,.14)', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>✓</div>
        <h3 style={{ color: 'var(--green)', fontSize: 20, marginBottom: 6 }}>{w.okT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {w.connectedD(status.account?.login, status.account?.broker)}
          {' · '}{status.trades > 0 ? w.okD(status.trades) : w.okNone}
        </p>
        <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/dashboard">{w.goDash}</Link>
          <Link className="btn btn-ghost" href="/dashboard/manager">{w.goManager}</Link>
        </div>
      </div>
    );
  }

  const s = t.steps[step];
  const stuck = waiting && elapsed > HELP_AFTER_MS;

  return (
    <div className="card" style={{ marginBottom: 18, border: waiting ? '1px solid var(--brand)' : undefined }}>
      {/* Progreso */}
      <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>{w.stepOf(step + 1, total)}</span>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => { setMode('list'); try { localStorage.setItem('onyx_wiz_mode', 'list'); } catch {} }}>
          {w.seeAll}
        </button>
      </div>
      <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ width: `${((step + 1) / total) * 100}%`, height: '100%', background: 'var(--brand)', transition: 'width .25s' }} />
      </div>

      {waiting ? (
        <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
          <div className="spin" style={{
            width: 34, height: 34, borderRadius: '50%', margin: '0 auto 14px',
            border: '3px solid var(--bg2)', borderTopColor: 'var(--brand)',
          }} />
          <div style={{ fontSize: 16, marginBottom: 6 }}>{w.waitT}</div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>{w.waitD}</p>
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>{w.checking} · {mmss(elapsed)}</div>

          {stuck && (
            <div style={{ marginTop: 20, textAlign: 'left', padding: '14px 16px', background: 'rgba(245,158,11,.06)', border: '1px solid var(--amber)', borderRadius: 10 }}>
              <div style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>{w.stuckT}</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{w.stuckD}</div>
              {w.stuck.map((x: any, i: number) => (
                <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', borderTop: '1px solid var(--line)', padding: '9px 0' }}>
                  <span className="muted" style={{ fontSize: 12 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13 }}>{x.t}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{x.d}</div>
                  </div>
                </div>
              ))}
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" style={{ padding: '6px 13px', fontSize: 12 }} onClick={check}>{w.retry}</button>
                <button className="btn btn-ghost" style={{ padding: '6px 13px', fontSize: 12 }}
                  onClick={() => setStep(4)}>{w.backToFields}</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 18, marginBottom: 8 }}>{s.t}</div>
          {s.d && <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>{s.d}</p>}
          <StepExtras s={s} t={t} w={w} apiUrl={apiUrl} origin={origin} apiKey={apiKey}
            copy={copy} copied={copied} onDownload={onDownload} first={step === 0} />
        </>
      )}

      {/* Navegación */}
      <div className="row between" style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-ghost" disabled={step === 0}
          style={{ opacity: step === 0 ? .4 : 1 }}
          onClick={() => setStep(Math.max(0, step - 1))}>{w.back}</button>
        {step < total - 1 && (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>{w.next} →</button>
        )}
      </div>
    </div>
  );
}

// Lo que hay que copiar en cada paso concreto
function StepExtras({ s, t, w, apiUrl, origin, apiKey, copy, copied, onDownload, first }: any) {
  const Row = ({ label, value, tag }: any) => (
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      {label && <span className="muted" style={{ fontSize: 12, width: 92, flex: 'none' }}>{label}</span>}
      <code style={{ flex: 1, minWidth: 150, wordBreak: 'break-all' }}>{value || '...'}</code>
      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
        onClick={() => copy(value, tag)}>{copied === tag ? t.copied : t.copy}</button>
    </div>
  );

  if (first) {
    return (
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        <a className="btn btn-primary" href="/OnyxManager_MT5.mq5" download onClick={onDownload}>
          <span className="ic">↓</span>{t.dlMt5}
        </a>
        <a className="btn btn-ghost" href="/OnyxManager_MT4.mq4" download onClick={onDownload}>
          <span className="ic">↓</span>{t.dlMt4}
        </a>
      </div>
    );
  }
  if (s.copy === 'folder') return <Row label="" value={t.folderPath} tag="folder" />;
  if (s.copy === 'domain') return <Row label="" value={origin} tag="dom" />;
  if (s.copy === 'url') {
    return (
      <>
        <Row label="ServidorUrl" value={apiUrl} tag="url" />
        {apiKey
          ? <Row label="ApiKey" value={apiKey} tag="wizkey" />
          : <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{w.needKey}</div>}
      </>
    );
  }
  return null;
}
