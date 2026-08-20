'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Popup de la prueba de pago (cortesía):
//  • "por vencer": faltan pocos días → botón para elegir plan y pagar.
//  • "expiró": la prueba terminó → suscribirse o quedarse en Free.
// El "por vencer" se muestra una vez al día (localStorage). El "expiró" hasta que
// el usuario elija (pagar o seguir en Free).

type St =
  | { state: 'none' }
  | { state: 'active'; plan: string; daysLeft: number; expiring: boolean }
  | { state: 'expired'; plan: string };

const PLAN_LABEL: Record<string, string> = { pro: 'Pro', elite: 'Elite', black: 'Black Onyx' };

export default function CompTrialPopup() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [st, setSt] = useState<St>({ state: 'none' });
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    fetch('/api/comp').then((r) => r.json()).then((d: St) => {
      if (d.state === 'active' && d.expiring) {
        // "por vencer": máximo una vez al día
        const today = new Date().toISOString().slice(0, 10);
        try { if (localStorage.getItem('onyx_comp_warn') === today) return; } catch {}
        setSt(d);
      } else if (d.state === 'expired') {
        setSt(d);
      }
    }).catch(() => {});
  }, []);

  if (closed || st.state === 'none') return null;
  const planName = PLAN_LABEL[(st as any).plan] || (st as any).plan;
  const expired = st.state === 'expired';

  const goPay = () => { window.location.href = '/pricing'; };
  const dismissWarn = () => {
    try { localStorage.setItem('onyx_comp_warn', new Date().toISOString().slice(0, 10)); } catch {}
    setClosed(true);
  };
  const stayFree = () => {
    fetch('/api/comp', { method: 'POST' }).catch(() => {});
    setClosed(true);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
      onClick={expired ? undefined : dismissWarn}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, margin: '2px auto 12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: expired ? 'rgba(226,75,74,.14)' : 'rgba(255,199,117,.16)' }}>
          <span style={{ fontSize: 26 }}>{expired ? '🔒' : '⏳'}</span>
        </div>

        {expired ? (
          <>
            <h3 style={{ margin: '0 0 6px' }}>{L('Terminó tu prueba', 'Your trial ended')}</h3>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 18 }}>
              {L(`Tu acceso de prueba al plan ${planName} expiró. Elige un plan para seguir con todo, o continúa gratis.`,
                 `Your ${planName} trial access has ended. Pick a plan to keep everything, or continue for free.`)}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1, minWidth: 150 }} onClick={goPay}>{L('Suscribirme', 'Subscribe')}</button>
              <button className="btn btn-ghost" onClick={stayFree}>{L('Seguir en Free', 'Stay on Free')}</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 6px' }}>
              {L(`Te quedan ${(st as any).daysLeft} día(s) de prueba`, `${(st as any).daysLeft} day(s) left in your trial`)}
            </h3>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 18 }}>
              {L(`Estás probando el plan ${planName}. Suscríbete para no perder el acceso cuando termine la prueba.`,
                 `You're trying the ${planName} plan. Subscribe so you don't lose access when the trial ends.`)}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1, minWidth: 170 }} onClick={goPay}>{L('Elegir plan y pagar', 'Choose plan & pay')}</button>
              <button className="btn btn-ghost" onClick={dismissWarn}>{L('Ahora no', 'Not now')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
