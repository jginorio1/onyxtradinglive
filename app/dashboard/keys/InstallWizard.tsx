'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ============================================================
// Asistente de instalación (multiplataforma).
//
// La página elige la plataforma (MT5, MT4, cTrader…) y nos pasa SUS pasos,
// SUS botones de descarga y SU lista de "no llega nada". Todo lo demás
// —el semáforo de conexión de las cuentas— es igual para todas, porque el
// endpoint /api/v1/sync es agnóstico de plataforma.
//
// Solo dos pasos se comprueban de verdad: la descarga (se pulsó aquí) y el
// final (la cuenta sincronizó). Los de en medio ocurren dentro de la
// plataforma y no los vemos. Si a los 90 s no llega señal, mostramos las
// causas habituales de esa plataforma.
// ============================================================

const POLL_MS = 5000;
const HELP_AFTER_MS = 90000;

export const WIZ: any = {
  es: {
    accStatusT: 'Estado de tus cuentas', accLive: 'Conectada', accStale: 'Sin señal',
    accWaiting: 'Esperando su primera señal…', accWaitN: 'en espera',
    accNewHint: 'Instala el conector en la cuenta nueva con su clave y se pondrá verde aquí sola.',

    waitT: (n: string) => `Esperando la primera señal de tu ${n}…`,
    checking: 'Comprobando cada 5 segundos',
    retry: 'Comprobar ahora',

    goDash: 'Ver mi dashboard', goManager: 'Configurar Onyx Guardian',

    stuckT: 'Todavía no llega nada',
    stuckD: 'Casi siempre es una de estas. Revísalas en orden:',
    keepWaiting: 'Seguir esperando',

    connectedT: (n: string) => `Tu ${n} está conectado`,
    connectedD: (l: any, b: string) => `Cuenta ${l}${b ? ' · ' + b : ''}`,
    expand: 'Conectar otra cuenta',
    staleT: 'Configurada, pero sin señal ahora',
    since: (m: number) => m < 1 ? 'hace segundos' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} día(s)`,
    lastSeen: 'Última señal',
    stepsT: 'Instálalo paso a paso',
    stepsD: (n: number) => `Sigue los ${n} pasos en orden.`,
    needKey: 'Antes de instalar, crea una clave arriba para tu cuenta.',
    srvNote: 'La dirección del servidor ya viene puesta en el conector. No la cambies.',
  },
  en: {
    accStatusT: 'Your accounts', accLive: 'Connected', accStale: 'No signal',
    accWaiting: 'Waiting for its first signal…', accWaitN: 'waiting',
    accNewHint: 'Install the connector on the new account with its key and it turns green here on its own.',

    waitT: (n: string) => `Waiting for the first signal from your ${n}…`,
    checking: 'Checking every 5 seconds',
    retry: 'Check now',

    goDash: 'Go to my dashboard', goManager: 'Set up Onyx Guardian',

    stuckT: 'Nothing has arrived yet',
    stuckD: 'It is almost always one of these. Check them in order:',
    keepWaiting: 'Keep waiting',

    connectedT: (n: string) => `Your ${n} is connected`,
    connectedD: (l: any, b: string) => `Account ${l}${b ? ' · ' + b : ''}`,
    expand: 'Connect another account',
    staleT: 'Set up, but not reporting now',
    since: (m: number) => m < 1 ? 'seconds ago' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} day(s) ago`,
    lastSeen: 'Last signal',
    stepsT: 'Install it step by step',
    stepsD: (n: number) => `Follow the ${n} steps in order.`,
    needKey: 'Before installing, create a key above for your account.',
    srvNote: 'The server address is already set in the connector. Do not change it.',
  },
};

function mmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function InstallWizard({
  t, w, lang, apiUrl, origin, apiKey, onDownload, copy, copied,
  steps, stuckList, dlButtons, conn,
}: any) {
  const [status, setStatus] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const startedAt = useRef(0);
  const platName = conn?.name || 'MetaTrader';

  const check = useCallback(async () => {
    try {
      const r = await fetch('/api/install/status');
      if (!r.ok) return null;
      const j = await r.json();
      setStatus(j);
      return j;
    } catch { return null; }
  }, []);

  useEffect(() => {
    check().then((j) => { if (j?.connected) setCollapsed(true); });
  }, [check]);

  const live = !!status?.live;
  useEffect(() => {
    if (live) return;
    if (!startedAt.current) startedAt.current = Date.now();
    const poll = setInterval(check, POLL_MS);
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [live, check]);

  const stripNum = (s: string) => (s || '').replace(/^\s*\d+\.\s*/, '');

  // ---- Ya configurado y plegado ----
  if (collapsed && status?.connected) {
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
              <div style={{ fontWeight: 700, color: col }}>{live ? w.connectedT(platName) : w.staleT}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {w.connectedD(status.account?.login, status.account?.broker)}
                {status.syncedAccounts > 1 && ` · ${status.syncedAccounts}`}
                {!live && ` · ${w.lastSeen}: ${w.since(mins)}`}
              </div>
              {!live && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{conn?.staleHint}</div>}
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
            onClick={() => setCollapsed(false)}>{w.expand}</button>
        </div>
      </div>
    );
  }

  const stuck = !live && elapsed > HELP_AFTER_MS;
  const nSteps = (steps || []).length;

  return (
    <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Pasos de la plataforma elegida */}
      <div className="card">
        <h3 style={{ marginBottom: 2 }}>{w.stepsT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>{w.stepsD(nSteps)}</p>
        {(steps || []).map((s: any, i: number) => (
          <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start', paddingTop: i ? 16 : 0, marginTop: i ? 16 : 0, borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flex: 'none', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--card2)', color: 'var(--tx)',
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{stripNum(s.t)}</div>
              {s.d && <div className="muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.6 }}>{s.d}</div>}
              <StepVisual viz={s.viz} origin={origin} apiUrl={apiUrl} lang={lang} dlButtons={dlButtons} />
              <StepExtras s={s} t={t} w={w} apiUrl={apiUrl} origin={origin} apiKey={apiKey}
                copy={copy} copied={copied} onDownload={onDownload} first={i === 0} dlButtons={dlButtons} />
            </div>
          </div>
        ))}
      </div>

      {/* Estado de conexión de TODAS tus cuentas (agnóstico de plataforma) */}
      {(() => {
        const accts: any[] = status?.accounts || [];
        const pend: any[] = status?.pending || [];
        const liveCount = accts.filter((a) => a.live).length;
        const anyLive = liveCount > 0;
        const hasRows = accts.length + pend.length > 0;
        const border = anyLive ? 'var(--green)' : 'var(--amber)';

        const stuckBox = stuck ? (
          <div style={{ marginTop: 16, textAlign: 'left', padding: '14px 16px', background: 'rgba(245,158,11,.06)', border: '1px solid var(--amber)', borderRadius: 10 }}>
            <div style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>{w.stuckT}</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{w.stuckD}</div>
            {(stuckList || []).map((x: any, i: number) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', borderTop: '1px solid var(--line)', padding: '9px 0' }}>
                <span className="muted" style={{ fontSize: 12 }}>{i + 1}</span>
                <div><div style={{ fontSize: 13 }}>{x.t}</div><div className="muted" style={{ fontSize: 12 }}>{x.d}</div></div>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ padding: '6px 13px', fontSize: 12, marginTop: 12 }} onClick={check}>{w.retry}</button>
          </div>
        ) : null;

        return (
          <div className="card" style={{ border: '1px solid ' + border }}>
            <div className="row between" style={{ marginBottom: hasRows ? 12 : 0, flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: anyLive ? 'var(--green)' : 'var(--amber)' }} />
                <h3 style={{ fontSize: 16 }}>{w.accStatusT}</h3>
              </div>
              {hasRows && (
                <span className="pill" style={{ color: anyLive ? 'var(--green)' : 'var(--amber)', background: anyLive ? 'rgba(52,226,160,.15)' : 'rgba(245,158,11,.15)' }}>
                  {[liveCount > 0 ? `${liveCount} ${w.accLive.toLowerCase()}` : '', pend.length > 0 ? `${pend.length} ${w.accWaitN}` : ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            {hasRows && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {accts.map((a, i) => {
                  const mins = a.lastSyncAt ? Math.max(0, Math.floor((Date.now() - new Date(a.lastSyncAt).getTime()) / 60000)) : 0;
                  return (
                    <div key={'a' + i} className="row between" style={{ gap: 10, flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px' }}>
                      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: a.live ? 'var(--green)' : 'var(--amber)' }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{a.login}{a.broker ? ' · ' + a.broker : ''}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{a.live ? w.accLive : `${w.accStale} · ${w.lastSeen}: ${w.since(mins)}`}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, color: a.live ? 'var(--green)' : 'var(--amber)' }}>{a.live ? '✓' : '⚠'}</span>
                    </div>
                  );
                })}
                {pend.map((k, i) => (
                  <div key={'p' + i} className="row between" style={{ gap: 10, flexWrap: 'wrap', border: '1px solid rgba(245,158,11,.4)', borderRadius: 10, padding: '9px 12px' }}>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: 'var(--amber)' }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{k.label || k.broker || (lang === 'en' ? 'New account' : 'Cuenta nueva')}{k.broker && k.label ? ' · ' + k.broker : ''}</div>
                        <div style={{ fontSize: 12, color: 'var(--amber)' }}>{w.accWaiting}</div>
                      </div>
                    </div>
                    <div className="spin" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--bg2)', borderTopColor: 'var(--amber)' }} />
                  </div>
                ))}
              </div>
            )}

            {!hasRows && (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div className="spin" style={{ width: 34, height: 34, borderRadius: '50%', margin: '0 auto 14px', border: '3px solid var(--bg2)', borderTopColor: 'var(--amber)' }} />
                <div style={{ fontSize: 16, marginBottom: 6, color: 'var(--amber)' }}>{w.waitT(platName)}</div>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>{conn?.waitD}</p>
                <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>{w.checking} · {mmss(elapsed)}</div>
                {stuckBox}
              </div>
            )}

            {hasRows && !anyLive && (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{w.checking} · {mmss(elapsed)}</div>
                {stuckBox}
              </div>
            )}

            {anyLive && (
              <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
                <Link className="btn btn-primary" href="/dashboard">{w.goDash}</Link>
                <Link className="btn btn-ghost" href="/dashboard/manager">{w.goManager}</Link>
              </div>
            )}

            {pend.length > 0 && (
              <div className="muted" style={{ fontSize: 12, marginTop: 12, textAlign: 'center' }}>{w.accNewHint}</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// Ilustración por paso. Casos 'ct-*' son de cTrader; los demás, MetaTrader.
function StepVisual({ viz, origin, lang, dlButtons }: any) {
  if (!viz) return null;
  const p = (es: string, en: string) => (lang === 'en' ? en : es);
  const box = { border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg2)', padding: 12, marginTop: 12 } as any;
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 9px', fontSize: 12 } as any;
  const code = { fontSize: 11, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 7px', wordBreak: 'break-all' } as any;
  const arrow = <span style={{ color: 'var(--mut)' }}>→</span>;
  const check = <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--green)', color: '#04120c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flex: 'none' }}>✓</span>;

  switch (viz) {
    // ---------- MetaTrader ----------
    case 'download':
      return <div style={box}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--mut)', fontSize: 18 }}>↑</span>
          <span className="muted" style={{ fontSize: 12 }}>{p('Usa el botón de arriba:', 'Use the button above:')}</span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {(dlButtons || []).map((b: any, i: number) => (
            <span key={i} style={{ ...chip, borderColor: b.primary ? 'var(--brand)' : 'var(--line)', color: 'var(--tx)' }}>⬇️ {b.label}</span>
          ))}
        </div>
      </div>;
    case 'folder':
      return <div style={box}>
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>{p('En MetaTrader:', 'In MetaTrader:')}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={chip}>{p('Archivo', 'File')}</span>{arrow}<span style={chip}>{p('Abrir carpeta de datos', 'Open Data Folder')}</span>{arrow}<span style={chip}>📁 MQL5</span>{arrow}<span style={chip}>📁 Experts</span>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{p('Pega ahí el archivo Onyx que descargaste.', 'Paste the Onyx file you downloaded there.')}</div>
      </div>;
    case 'compile':
      return <div style={box}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={chip}>⌨️ {p('Tecla F4', 'F4 key')}</span><span className="muted" style={{ fontSize: 12 }}>{p('abre MetaEditor (ya viene incluido)', 'opens MetaEditor (built in)')}</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={chip}>{p('Abre el archivo Onyx', 'Open the Onyx file')}</span>{arrow}<span style={chip}>▶️ {p('Compilar (F7)', 'Compile (F7)')}</span>
        </div>
        <div style={{ marginTop: 8, display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 8, padding: '6px 10px' }}>
          {check}<span style={{ fontSize: 12, color: 'var(--green)' }}>{p('Debe decir: 0 errores, 0 advertencias', 'It should say: 0 errors, 0 warnings')}</span>
        </div>
      </div>;
    case 'drag':
      return <div style={box}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 130, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--card2)' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{p('Navegador', 'Navigator')}</div>
            <div style={{ fontSize: 12 }}>📁 {p('Asesores Expertos', 'Expert Advisors')}</div>
            <div style={{ fontSize: 12, color: 'var(--brand)', paddingLeft: 14 }}>🤖 Onyx Connect</div>
          </div>
          {arrow}
          <div style={{ flex: 1, minWidth: 130, border: '1px dashed var(--line)', borderRadius: 8, padding: 8, textAlign: 'center', color: 'var(--mut)', fontSize: 12 }}>📈 {p('Suéltalo en un gráfico', 'Drop it on a chart')}</div>
        </div>
      </div>;
    case 'fields':
      return <div style={box}>
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>{p('En la ventana que se abre:', 'In the window that opens:')}</div>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>{check}<span style={{ fontSize: 12 }}>{p('Marca «Permitir Algo Trading» (pestaña Común)', 'Tick "Allow Algo Trading" (Common tab)')}</span></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: 12, minWidth: 70, color: 'var(--green)', fontWeight: 600 }}>ApiKey</span><code style={code}>{p('pega tu clave', 'paste your key')}</code><span style={{ fontSize: 11, color: 'var(--green)' }}>← {p('lo único que pegas', 'the only thing you paste')}</span></div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{p('No toques la dirección del servidor: ya viene puesta en el EA.', 'Do not touch the server address: it is already set in the EA.')}</div>
      </div>;
    case 'webrequest':
      return <div style={box}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={chip}>{p('Herramientas', 'Tools')}</span>{arrow}<span style={chip}>{p('Opciones', 'Options')}</span>{arrow}<span style={chip}>{p('Asesores Expertos', 'Expert Advisors')}</span>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>{check}<span style={{ fontSize: 12 }}>{p('Marca «Permitir WebRequest para las siguientes direcciones»', 'Tick "Allow WebRequest for listed URL"')}</span></div>
        <div className="row" style={{ gap: 6, alignItems: 'center', paddingLeft: 24 }}><span style={{ color: 'var(--green)' }}>＋</span><code style={code}>{origin}</code></div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8, paddingLeft: 24 }}>{p('Escríbela, pulsa Enter y luego OK.', 'Type it, press Enter, then OK.')}</div>
      </div>;
    case 'algo':
      return <div style={box}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--card2)' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{p('Barra de arriba', 'Top bar')}</div>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.12)', color: 'var(--green)', borderRadius: 6, padding: '5px 9px', fontSize: 12 }}>▶️ {p('Algo Trading (verde)', 'Algo Trading (green)')}</span>
          </div>
          <div style={{ flex: 1, minWidth: 140, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--card2)' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{p('Esquina del gráfico', 'Chart corner')}</div>
            <div style={{ fontSize: 12 }}><span style={{ color: 'var(--green)' }}>☺</span> = {p('activo', 'active')}</div>
            <div style={{ fontSize: 11, color: 'var(--red)' }}>✕ {p('triste = revisa Algo Trading', 'sad = check Algo Trading')}</div>
          </div>
        </div>
      </div>;

    // ---------- cTrader ----------
    case 'ct-download':
      return <div style={box}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--mut)', fontSize: 18 }}>↑</span>
          <span className="muted" style={{ fontSize: 12 }}>{p('Usa el botón de arriba:', 'Use the button above:')}</span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {(dlButtons || []).map((b: any, i: number) => (
            <span key={i} style={{ ...chip, borderColor: b.primary ? 'var(--brand)' : 'var(--line)' }}>⬇️ {b.label}</span>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{p('Es un archivo de texto (.cs) con el código del cBot.', 'It is a text file (.cs) with the cBot code.')}</div>
      </div>;
    case 'ct-new':
      return <div style={box}>
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>{p('En cTrader Desktop:', 'In cTrader Desktop:')}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={chip}>Automate</span>{arrow}<span style={chip}>＋ New cBot</span>{arrow}<span style={chip}>{p('Nómbralo: OnyxConnect', 'Name it: OnyxConnect')}</span>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{p('Se abre el editor de código.', 'The code editor opens.')}</div>
      </div>;
    case 'ct-build':
      return <div style={box}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={chip}>{p('Borra el ejemplo', 'Delete the sample')}</span>{arrow}<span style={chip}>{p('Pega el .cs', 'Paste the .cs')}</span>{arrow}<span style={chip}>🔨 Build (F6)</span>
        </div>
        <div style={{ marginTop: 4, display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.10)', border: '1px solid var(--green)', borderRadius: 8, padding: '6px 10px' }}>
          {check}<span style={{ fontSize: 12, color: 'var(--green)' }}>{p('Debe decir: Build succeeded', 'It should say: Build succeeded')}</span>
        </div>
      </div>;
    case 'ct-fields':
      return <div style={box}>
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>{p('En los parámetros del cBot:', 'In the cBot parameters:')}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: 12, minWidth: 70, color: 'var(--green)', fontWeight: 600 }}>API key</span><code style={code}>{p('pega tu clave', 'paste your key')}</code><span style={{ fontSize: 11, color: 'var(--green)' }}>← {p('lo único que pegas', 'the only thing you paste')}</span></div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{p('No toques el Server URL: ya viene puesto.', 'Do not touch the Server URL: it is already set.')}</div>
      </div>;
    case 'ct-run':
      return <div style={box}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--card2)' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{p('Aviso la 1ª vez', 'First-time prompt')}</div>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>{check}<span style={{ fontSize: 12 }}>{p('Acepta «Acceso completo» (red)', 'Accept "Full Access" (network)')}</span></div>
          </div>
          <div style={{ flex: 1, minWidth: 150, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--card2)' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{p('Barra del cBot', 'cBot bar')}</div>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(52,226,160,.12)', color: 'var(--green)', borderRadius: 6, padding: '5px 9px', fontSize: 12 }}>▶ Play</span>
          </div>
        </div>
      </div>;

    default: return null;
  }
}

// Lo que hay que copiar/descargar en cada paso
function StepExtras({ s, t, w, origin, apiKey, copy, copied, onDownload, first, dlButtons }: any) {
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
        {(dlButtons || []).map((b: any, i: number) => (
          <a key={i} className={b.primary ? 'btn btn-primary' : 'btn btn-ghost'} href={b.href} download onClick={onDownload}>
            <span className="ic">↓</span>{b.label}
          </a>
        ))}
      </div>
    );
  }
  if (s.copy === 'folder') return <Row label="" value={t.folderPath} tag="folder" />;
  if (s.copy === 'domain') return <Row label="" value={origin} tag="dom" />;
  if (s.copy === 'url') {
    return (
      <>
        {apiKey
          ? <Row label={s.viz === 'ct-fields' ? 'API key' : 'ApiKey'} value={apiKey} tag="wizkey" />
          : <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{w.needKey}</div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>ℹ️ {w.srvNote}</div>
      </>
    );
  }
  return null;
}
