'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    waiting: 'Esperando a que pulses Start en Telegram…',
    connected: 'Conectado', as: 'como', unlink: 'Desconectar',
    prefsT: 'Qué avisos quieres aquí',
    prefs: {
      tg_blocks: 'Cuando el Guardian te frena',
      tg_limits: 'Límites de pérdida y objetivo',
      tg_manager: 'Break even, trailing y parciales',
      tg_funding: 'Cerca de una regla de fondeo',
      tg_daily: 'Resumen del día',
    },
    off: 'Los avisos generales están apagados. Enciéndelos arriba para recibir nada por Telegram.',
    saved: 'Guardado',
    unavailable: 'Los avisos por Telegram aún no están disponibles. Vuelve pronto.',
  },
  en: {
    title: 'Telegram alerts', badge: 'Elite',
    intro: 'Get a message on Telegram when the Guardian stops you, when you hit a risk limit, or when you get close to a funding rule.',
    lockT: 'Telegram alerts are on the Elite plan',
    lockCta: 'See plans →',
    connect: 'Connect Telegram', opening: 'Opening…',
    step: 'Telegram will open with the bot. Tap Start and come back here.',
    waiting: 'Waiting for you to tap Start on Telegram…',
    connected: 'Connected', as: 'as', unlink: 'Disconnect',
    prefsT: 'Which alerts you want here',
    prefs: {
      tg_blocks: 'When the Guardian stops you',
      tg_limits: 'Loss and target limits',
      tg_manager: 'Break even, trailing and partials',
      tg_funding: 'Close to a funding rule',
      tg_daily: 'Daily summary',
    },
    off: 'General alerts are off. Turn them on above to receive anything on Telegram.',
    saved: 'Saved',
    unavailable: 'Telegram alerts are not available yet. Check back soon.',
  },
};

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : 'var(--line)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function TelegramCard({ lang }: { lang: 'es' | 'en' }) {
  const t = T[lang];
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [saved, setSaved] = useState(false);

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
    if (j.url) { window.open(j.url, '_blank'); setWaiting(true); }
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

  if (!d) return <div className="muted" style={{ fontSize: 13 }}>…</div>;

  const head = (
    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
      <h3 style={{ fontSize: 16 }}>{t.title}</h3>
      <span className="pill" style={{ color: '#7fe9c0', background: 'rgba(52,226,160,.15)', border: '1px solid #34e2a0' }}>{t.badge}</span>
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

          <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 8 }}>{t.prefsT}</div>
          {(['tg_blocks', 'tg_limits', 'tg_funding', 'tg_manager', 'tg_daily'] as string[]).map((k) => (
            <div key={k} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14 }}>{t.prefs[k]}</span>
              <Toggle on={!!d.prefs[k]} onClick={() => setPref(k, !d.prefs[k])} />
            </div>
          ))}
          {!d.prefs.tg_alerts && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t.off}</div>}
          {saved && <span style={{ color: 'var(--green)', fontSize: 12 }}>{t.saved}</span>}
        </>
      ) : waiting ? (
        <div className="row" style={{ gap: 10 }}>
          <span className="spin" style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--bg2)', borderTopColor: 'var(--brand)', flex: 'none' }} />
          <span className="muted" style={{ fontSize: 13 }}>{t.waiting}</span>
        </div>
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
