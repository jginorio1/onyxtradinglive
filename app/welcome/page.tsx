'use client';
// ============================================================
// BIENVENIDA · "¿Qué quieres hacer en Onyx?" + planes (se muestra 1 sola vez)
//
// Tras crear la cuenta (y el perfil opcional), el trader llega aquí:
//   Paso 1 · elige qué servicios le interesan (puede elegir VARIOS).
//   Paso 2 · le mostramos el plan sugerido para incitar la compra, con la prueba
//            gratis, PERO siempre puede "Seguir con mi cuenta gratis".
//
// Reglas de Apple (son estrictos): el paywall SIEMPRE se puede cerrar (no bloquea
// el uso), y la compra real ocurre en /pricing, que en iOS usa la compra nativa
// de Apple (IAP) con Restaurar/Términos/Privacidad, y en web/Android usa Stripe.
// Usa los colores de marca (naranja chinita) del landing/login para congruencia.
// ============================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

type Intent = 'monitor' | 'guardian' | 'copy' | 'robots' | 'academy' | 'all';

// icon = nombre del set moderno de Onyx (líneas), no emoji → congruente con el resto de la app.
const OPTS: { id: Intent; icon: string; es: string; en: string; esSub: string; enSub: string }[] = [
  { id: 'monitor', icon: 'performance', es: 'Monitorear mis cuentas', en: 'Monitor my accounts', esSub: 'KPIs, diario, reto', enSub: 'KPIs, journal, challenge' },
  { id: 'guardian', icon: 'shield', es: 'Proteger mi reto', en: 'Protect my challenge', esSub: 'Onyx Guardian', enSub: 'Onyx Guardian' },
  { id: 'copy', icon: 'swap', es: 'Copiar operaciones', en: 'Copy trading', esSub: 'Onyx Copy', enSub: 'Onyx Copy' },
  { id: 'robots', icon: 'ai', es: 'Robots', en: 'Robots', esSub: 'Comprar o vender · Bot Lab', enSub: 'Buy or sell · Bot Lab' },
  { id: 'academy', icon: 'graduation', es: 'Montar mi academia', en: 'Build my academy', esSub: 'Onyx Academy', enSub: 'Onyx Academy' },
  { id: 'all', icon: 'star', es: 'Explorar todo', en: 'Explore everything', esSub: 'El ecosistema completo', enSub: 'The full ecosystem' },
];

// Plan sugerido según lo que elija (solo para el teaser; el detalle real está en /pricing).
function suggestPlan(sel: Intent[], es: boolean) {
  const has = (x: Intent) => sel.includes(x);
  if (has('all') || sel.length >= 3) return { name: 'Black Onyx', es: 'Todo el ecosistema sin límites.', en: 'The whole ecosystem, unlimited.' };
  if (has('robots')) return { name: 'Onyx Builder', es: 'Para crear, probar y vender robots.', en: 'To build, test and sell robots.' };
  if (has('academy')) return { name: 'Onyx Pro', es: 'Para montar y cobrar tu academia.', en: 'To build and charge for your academy.' };
  return { name: 'Onyx Pro', es: 'Monitoreo completo, Guardian y Mi reto.', en: 'Full monitoring, Guardian and Challenge.' };
}

export default function WelcomePage() {
  const router = useRouter();
  const { lang } = useLang();
  const es = lang !== 'en';
  const [step, setStep] = useState<1 | 2>(1);
  const [sel, setSel] = useState<Intent[]>([]);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  // Se muestra UNA sola vez: si ya la vio, al panel directo.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch('/api/account', { cache: 'no-store' }).then((r) => r.json());
        if (alive && j?.profile?.onboard_paywall_seen) { router.replace('/dashboard'); return; }
      } catch {}
      if (alive) setChecked(true);
    })();
    return () => { alive = false; };
  }, [router]);

  const toggle = (id: Intent) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  async function saveIntent() {
    try { await fetch('/api/onboarding', { method: 'POST', body: JSON.stringify({ skip: true, intent: sel }) }); } catch {}
  }
  async function markSeen() {
    try { await fetch('/api/onboarding', { method: 'POST', body: JSON.stringify({ skip: true, paywall_seen: true }) }); } catch {}
  }

  const goStep2 = async () => { setBusy(true); await saveIntent(); setBusy(false); setStep(2); };
  const seePlans = async () => { setBusy(true); await markSeen(); window.location.href = '/pricing'; };
  const skipFree = async () => { setBusy(true); await markSeen(); router.push('/dashboard'); router.refresh(); };

  if (!checked) {
    return <div className="onyx-welcome" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="ow-ring" />
      <style>{css}</style>
    </div>;
  }

  const plan = suggestPlan(sel, es);

  return (
    <div className="onyx-welcome">
      <div className="ow-card">
        {step === 1 ? (
          <>
            <div className="ow-step">{es ? 'Paso 1 · ¿Qué quieres hacer en Onyx?' : 'Step 1 · What do you want to do in Onyx?'}</div>
            <h1 className="ow-h1">{es ? 'Elige por dónde empezar' : 'Choose where to start'}</h1>
            <p className="ow-sub">{es ? 'Puedes elegir varias. Esto ordena tu panel; no te obliga a pagar.' : 'Pick several. This arranges your dashboard; it does not force you to pay.'}</p>
            <div className="ow-grid">
              {OPTS.map((o) => {
                const on = sel.includes(o.id);
                return (
                  <button key={o.id} type="button" onClick={() => toggle(o.id)} className={'ow-opt' + (on ? ' on' : '')}>
                    <span className="ow-ic"><OnyxIcon name={o.icon} size={22} /></span>
                    <span className="ow-ot">{es ? o.es : o.en}</span>
                    <span className="ow-os">{es ? o.esSub : o.enSub}</span>
                    {on && <span className="ow-check">✓</span>}
                  </button>
                );
              })}
            </div>
            <button className="ow-primary" disabled={busy} onClick={goStep2}>{es ? 'Continuar' : 'Continue'}</button>
            <button className="ow-ghost" disabled={busy} onClick={skipFree}>{es ? 'Saltar, seguir gratis' : 'Skip, keep free'}</button>
          </>
        ) : (
          <>
            <div className="ow-step">{es ? 'Paso 2 · Plan sugerido para lo que elegiste' : 'Step 2 · Suggested plan for your choice'}</div>
            <div className="ow-plan">
              <div className="ow-plan-top">
                <span className="ow-plan-name">{plan.name}</span>
                <span className="ow-trial">{es ? 'Prueba gratis' : 'Free trial'}</span>
              </div>
              <p className="ow-plan-sub">{es ? plan.es : plan.en}</p>
              <button className="ow-primary" disabled={busy} onClick={seePlans}>{es ? 'Ver planes y probar gratis' : 'See plans and start free'}</button>
              <p className="ow-fine">{es
                ? 'En iOS la compra es con Apple. Se renueva solo; cancela cuando quieras en Ajustes.'
                : 'On iOS the purchase is through Apple. Auto-renews; cancel anytime in Settings.'}</p>
            </div>
            <button className="ow-ghost strong" disabled={busy} onClick={skipFree}>{es ? 'Seguir con mi cuenta gratis' : 'Continue with my free account'}</button>
            <button className="ow-back" disabled={busy} onClick={() => setStep(1)}>{es ? '← Volver' : '← Back'}</button>
          </>
        )}
      </div>
      <style>{css}</style>
    </div>
  );
}

const css = `
  .onyx-welcome { min-height: 100vh; min-height: 100dvh; background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
  .ow-card { width: 100%; max-width: 460px; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 22px; }
  .ow-step { font-size: 11px; color: var(--brand); margin-bottom: 10px; }
  .ow-h1 { font-size: 20px; margin: 0 0 4px; color: var(--tx); }
  .ow-sub { font-size: 12.5px; color: var(--mut); margin: 0 0 14px; line-height: 1.5; }
  .ow-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .ow-opt { position: relative; text-align: left; background: var(--card2); border: 1px solid var(--line); border-radius: 12px; padding: 11px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; transition: border-color .15s, background .15s; }
  .ow-opt.on { border-color: var(--brand); background: rgba(255,157,61,.10); }
  .ow-ic { color: var(--brand); display: inline-flex; margin-bottom: 2px; }
  .ow-ot { font-size: 13px; font-weight: 600; color: var(--tx); }
  .ow-os { font-size: 11px; color: var(--mut); }
  .ow-check { position: absolute; top: 9px; right: 10px; width: 18px; height: 18px; border-radius: 50%; background: var(--brand); color: #1a1205; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .ow-primary { width: 100%; margin-top: 14px; border: none; border-radius: 11px; padding: 12px; font-size: 14px; font-weight: 700; cursor: pointer; color: #1a1205; background: linear-gradient(90deg, var(--brand), var(--brand2)); }
  .ow-primary:disabled { opacity: .6; }
  .ow-ghost { width: 100%; margin-top: 9px; background: none; border: none; color: var(--mut); font-size: 13px; cursor: pointer; padding: 6px; }
  .ow-ghost.strong { color: var(--tx); border: 1px solid var(--line); border-radius: 11px; padding: 11px; margin-top: 12px; }
  .ow-back { width: 100%; margin-top: 4px; background: none; border: none; color: var(--mut); font-size: 12px; cursor: pointer; padding: 6px; }
  .ow-plan { border: 2px solid var(--brand); border-radius: 14px; padding: 15px; background: rgba(255,157,61,.06); }
  .ow-plan-top { display: flex; align-items: center; justify-content: space-between; }
  .ow-plan-name { font-size: 17px; font-weight: 700; color: var(--tx); }
  .ow-trial { font-size: 11px; color: var(--green2, #2fbf7a); background: rgba(52,199,120,.16); border-radius: 20px; padding: 3px 10px; }
  .ow-plan-sub { font-size: 12.5px; color: var(--mut); margin: 8px 0 0; line-height: 1.5; }
  .ow-fine { font-size: 10.5px; color: var(--mut); text-align: center; margin: 9px 0 0; line-height: 1.5; }
  .ow-ring { width: 40px; height: 40px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--brand); animation: ow-spin .8s linear infinite; }
  @keyframes ow-spin { to { transform: rotate(360deg); } }
`;
