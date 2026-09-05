'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import EarningsCalc from '@/app/EarningsCalc';
import { errMsg } from '@/lib/i18nErrors';

type Lang = 'es' | 'en';

const T: any = {
  es: {
    nav: 'Inicio', account: 'Mi cuenta',
    h1: 'Gana dinero cada mes con tu comunidad',
    sub: 'Recomienda Onyx a tus seguidores y cobra una comisión recurrente mientras sigan suscritos. Sin límite de ganancias.',
    k1: 'recurrente', k1s: 'de cada pago, todos los meses', k2: 'Mientras pague', k2s: 'mientras siga tu suscriptor', k3: 'de retiro', k3s: 'Stripe, cripto o crédito',
    how: 'Cómo funciona', h1t: 'Te apuntas', h1d: 'Rellenas el formulario contando dónde tienes tu comunidad. Lo revisamos y te aprobamos.',
    h2t: 'Compartes tu enlace', h2d: 'Recibes un enlace y un código de descuento propio. Tu audiencia entra con descuento y tú cobras.',
    h3t: 'Cobras solo', h3d: 'Por cada suscriptor activo se acredita tu comisión, y se te paga automático cuando madura (pasa la retención y supera el mínimo). Sin trámites.',
    tiers: 'Tus niveles', tier1: 'Plata', tier1d: 'desde tu primer suscriptor', tier2: 'Oro', tier2d: 'al llegar a 10 activos · se aplica también a los que ya tenías',
    applyT: 'Solicitar plaza', applyD: 'Cuéntanos de tu comunidad. Respondemos en pocos días.',
    fCode: 'Tu código', fCodeH: 'Aparecerá en tu enlace y será tu cupón de descuento.',
    fAud: '¿Dónde tienes tu comunidad?', fAudPh: 'Instagram @micuenta, canal de Telegram con 4.000 personas...',
    fFol: 'Seguidores aproximados', fMethod: 'Cómo quieres cobrar', fDet: 'Datos de cobro', fDetPh: 'dirección USDT (con Stripe te conectas luego en tu panel)',
    paypal: 'Stripe (a tu banco/tarjeta)', usdt: 'USDT (cripto)', credit: 'Crédito en mi plan',
    send: 'Enviar solicitud', sending: 'Enviando...',
    missT: 'Para enviar la solicitud te falta:', missAud: 'Contarnos dónde tienes tu comunidad (unas pocas palabras).', missDet: 'Tus datos de cobro.',
    okT: '¡Solicitud enviada!', okD: 'La revisaremos pronto. Te avisaremos por correo y verás el estado en Mi cuenta → Referidos.',
    needLogin: 'Crea tu cuenta gratis para solicitar', loginBtn: 'Crear cuenta o entrar →',
    already: 'Ya tienes una solicitud. Míralo en Mi cuenta → Referidos.', goPanel: 'Ir a mi panel →',
    faqT: 'Preguntas frecuentes',
    faq: [
      ['¿Cuánto dura mi comisión?', 'Mientras tu referido siga pagando su suscripción, según las condiciones vigentes del programa.'],
      ['¿Cuánto gano por cada referido?', 'Un porcentaje recurrente de cada pago. Empiezas en el nivel Silver y subes a Gold al llegar a 10 referidos activos, con una comisión mayor que se aplica también a los que ya tenías.'],
      ['¿Cómo y por dónde me pagan?', 'Por Stripe (a tu banco o tarjeta), en cripto (USDT) o como crédito en tu plan. Con Stripe el pago sale automático cuando tu saldo madura y supera el mínimo — no tienes que hacer nada. En cripto lo procesamos a mano. Tarda de 1 a 5 días hábiles.'],
      ['¿Cuándo puedo cobrar?', 'Las comisiones se retienen 30 días por si hay reembolsos. Después pasan a disponible y, al superar el mínimo, se pagan automáticamente (con Stripe). También puedes solicitarlo tú desde Mi cuenta → Retiros.'],
      ['¿Tiene algún costo ser embajador?', 'No, es gratis. Solo llenas el formulario, te aprobamos y empiezas a compartir tu enlace.'],
      ['¿Qué descuento reciben mis seguidores?', 'Entran con el descuento de tu código, un incentivo para que se suscriban con tu enlace y tú cobres por ellos.'],
      ['¿Dónde veo mis referidos y comisiones?', 'En Mi cuenta → Referidos ves tus referidos activos y tu enlace; en Mi cuenta → Retiros ves las comisiones pendientes, disponibles y pagadas, con su historial, y solicitas el pago.'],
      ['¿Tengo que ser cliente?', 'No hace falta, pero ayuda: es más fácil recomendar algo que usas todos los días.'],
      ['¿Puedo referirme a mí mismo?', 'No. El sistema no cuenta tu propia suscripción ni las cuentas duplicadas.'],
    ],
  },
  en: {
    nav: 'Home', account: 'My account',
    h1: 'Earn every month with your community',
    sub: 'Recommend Onyx to your followers and earn a recurring commission for as long as they stay subscribed. No earnings cap.',
    k1: 'recurring', k1s: 'of every payment, every month', k2: 'While they pay', k2s: 'while your subscriber stays', k3: 'minimum payout', k3s: 'Stripe, crypto or credit',
    how: 'How it works', h1t: 'You apply', h1d: 'Fill the form telling us where your community lives. We review and approve you.',
    h2t: 'You share your link', h2d: 'You get your own link and discount code. Your audience joins with a discount and you get paid.',
    h3t: 'You get paid automatically', h3d: 'For every active subscriber your commission is credited, and it pays out automatically once it matures (retention passed and above the minimum). No paperwork.',
    tiers: 'Your tiers', tier1: 'Silver', tier1d: 'from your first subscriber', tier2: 'Gold', tier2d: 'at 10 active referrals · applies to your existing ones too',
    applyT: 'Apply', applyD: 'Tell us about your community. We answer within a few days.',
    fCode: 'Your code', fCodeH: 'It will be in your link and will be your discount coupon.',
    fAud: 'Where is your community?', fAudPh: 'Instagram @myhandle, Telegram channel with 4,000 people...',
    fFol: 'Approximate followers', fMethod: 'How you want to get paid', fDet: 'Payout details', fDetPh: 'USDT address (with Stripe you connect later in your panel)',
    paypal: 'Stripe (to your bank/card)', usdt: 'USDT (crypto)', credit: 'Credit on my plan',
    send: 'Send application', sending: 'Sending...',
    missT: 'Before sending we still need:', missAud: 'A few words about where your community lives.', missDet: 'Your payout details.',
    okT: 'Application sent!', okD: 'We will review it soon. You will get an email and can track it in My account → Referrals.',
    needLogin: 'Create your free account to apply', loginBtn: 'Create account or sign in →',
    already: 'You already applied. Check My account → Referrals.', goPanel: 'Go to my panel →',
    faqT: 'FAQ',
    faq: [
      ['How long does my commission last?', 'As long as your referral keeps paying their subscription, under the program\'s current terms.'],
      ['How much do I earn per referral?', 'A recurring percentage of every payment. You start at Silver and move up to Gold at 10 active referrals, with a higher rate that also applies to the ones you already had.'],
      ['How and where do I get paid?', 'Via Stripe (to your bank or card), crypto (USDT) or as credit on your plan. With Stripe the payout goes out automatically once your balance matures and passes the minimum — nothing to do. Crypto we process by hand. It takes 1 to 5 business days.'],
      ['When can I withdraw?', 'Commissions are held 30 days in case of refunds. After that they become available and, once above the minimum, pay out automatically (with Stripe). You can also request it from My account → Payouts.'],
      ['Is there any cost to be an ambassador?', 'No, it is free. Just fill the form, get approved and start sharing your link.'],
      ['What discount do my followers get?', 'They join with your code\'s discount — an incentive so they subscribe through your link and you get paid for them.'],
      ['Where do I see my referrals and commissions?', 'In My account → Referrals you see your active referrals and your link; in My account → Payouts you see your pending, available and paid commissions with their history, and request the payout.'],
      ['Do I need to be a customer?', 'Not required, but it helps: it is easier to recommend something you use daily.'],
      ['Can I refer myself?', 'No. The system does not count your own subscription or duplicate accounts.'],
    ],
  },
};

export default function Embajadores() {
  const { lang, setLang } = useLang();
  const [s, setS] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'guest' | 'form' | 'sent' | 'has'>('loading');
  const [f, setF] = useState<any>({ code: '', audience: '', followers: '', payout_method: 'stripe', payout_details: '' });
  const [busy, setBusy] = useState(false);
  const [lcFaqRaw, setLcFaqRaw] = useState<string[][] | null>(null);
  const [lcPage, setLcPage] = useState<any>(null);
  const t = dictFor(T, lang);
  // FAQ editable del Landing Builder (si el admin la puso, reemplaza la del código).
  const _validFaq = (lcFaqRaw || []).filter((r) => (r?.[0] || '').trim() || (r?.[2] || '').trim());
  const faqRows: [string, string][] = _validFaq.length
    ? _validFaq.map((r) => lang === 'es' ? [r[0], r[1]] : [r[2], r[3]])
    : t.faq;
  // Textos editables de la página (vacío = texto del código).
  const px = (k: string, fb: string) => lcPage?.[k]?.[lang] || fb;

  useEffect(() => {
    fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json())
      .then((c) => { const rows = c?.faq?.embajadores; if (Array.isArray(rows) && rows.length) setLcFaqRaw(rows); setLcPage(c?.pages?.embajadores || null); })
      .catch(() => {});
    fetch('/api/ambassador').then(async (r) => {
      if (r.status === 401) {
        setState('guest');
        // Invitado: no puede leer la config privada, pero SÍ la pública de /api/stats,
        // para que los tiers/mínimo reflejen siempre lo que hay en el panel admin.
        try {
          const sr = await fetch('/api/stats', { cache: 'no-store' }); const sj = await sr.json();
          setS({ base_rate: Number(sj.ambBase || 20), tier_rate: Number(sj.ambRate || 30), min_payout: Number(sj.ambMinPayout || 50), coupon_percent: Number(sj.ambCoupon || 20) });
        } catch { /* si falla, los fallbacks del render se encargan */ }
        return;
      }
      const j = await r.json();
      setS(j.settings);
      setState(j.ambassador ? 'has' : 'form');
    }).catch(() => setState('guest'));
  }, []);

  // Lo que falta por rellenar. El boton no se activa hasta que este todo.
  const missing: string[] = [];
  if (String(f.audience || '').trim().length < 10) missing.push(t.missAud);
  if (String(f.payout_details || '').trim().length < 4) missing.push(t.missDet);

  async function send() {
    setBusy(true);
    try {
      const r = await fetch('/api/ambassador', { method: 'POST', body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) { toast(errMsg(j, lang)); setBusy(false); return; }
      setState('sent');
    } catch { toast(errMsg({ code: 'network' }, lang)); }
    setBusy(false);
  }

  const rate = s?.tier_rate || 30;
  const minP = s?.min_payout || 50;
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 12, display: 'block' } as any;

  return (
    <>

      <div className="wrap" style={{ padding: '52px 22px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, letterSpacing: '-1px' }}>{px('h1', t.h1)}</h1>
          <p className="muted" style={{ margin: '12px auto 0', maxWidth: 620, fontSize: 17 }}>{px('sub', t.sub)}</p>
        </div>

        <div className="grid g3" style={{ marginBottom: 44 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 38, fontWeight: 800, background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{rate}%</div>
            <div style={{ fontWeight: 700 }}>{t.k1}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.k1s}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--green)', marginTop: 6 }}>{t.k2}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t.k2s}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 38, fontWeight: 800 }}>${minP}</div>
            <div style={{ fontWeight: 700 }}>{t.k3}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.k3s}</div>
          </div>
        </div>

        {/* CALCULADORA DE COMISIÓN (tarjeta iluminada) */}
        <div style={{ marginBottom: 44 }}>
          <EarningsCalc mode="ambassador" pct={rate} lang={lang} />
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>{t.how}</h2>
        <div className="grid g3" style={{ marginBottom: 44 }}>
          {[['1', t.h1t, t.h1d], ['2', t.h2t, t.h2d], ['3', t.h3t, t.h3d]].map(([n, ti, de]) => (
            <div key={n} className="card">
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--grad)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 10 }}>{n}</span>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{ti}</div>
              <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{de}</p>
            </div>
          ))}
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>{t.tiers}</h2>
        <div className="grid g2" style={{ marginBottom: 44 }}>
          <div className="card"><div className="row between"><b style={{ color: '#c7ccd6' }}>{t.tier1}</b><span style={{ fontSize: 26, fontWeight: 800 }}>{s?.base_rate || 20}%</span></div><p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t.tier1d}</p></div>
          <div className="card" style={{ border: '1px solid var(--gold)' }}><div className="row between"><b style={{ color: 'var(--gold)' }}>{t.tier2}</b><span style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)' }}>{s?.tier_rate || 30}%</span></div><p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t.tier2d}</p></div>
        </div>

        <div className="card" style={{ maxWidth: 560, margin: '0 auto 44px' }}>
          {state === 'loading' && <p className="muted">…</p>}

          {state === 'guest' && (
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: 10 }}>{t.needLogin}</h3>
              <Link className="btn btn-primary" href="/login?mode=signup">{t.loginBtn}</Link>
            </div>
          )}

          {state === 'has' && (
            <div style={{ textAlign: 'center' }}>
              <p className="muted" style={{ marginBottom: 12 }}>{t.already}</p>
              <Link className="btn btn-primary" href="/account">{t.goPanel}</Link>
            </div>
          )}

          {state === 'sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🎉</div>
              <h3 style={{ marginBottom: 8 }}>{t.okT}</h3>
              <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t.okD}</p>
              <Link className="btn btn-primary" href="/account">{t.goPanel}</Link>
            </div>
          )}

          {state === 'form' && (
            <>
              <h3 style={{ marginBottom: 4 }}>{t.applyT}</h3>
              <p className="muted" style={{ fontSize: 13 }}>{t.applyD}</p>
              <span style={lbl}>{t.fCode}</span>
              <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="Ej: carlosfx" style={{ margin: '4px 0 0' }} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.fCodeH}</div>
              <span style={lbl}>{t.fAud}</span>
              <textarea value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} rows={3} placeholder={t.fAudPh}
                style={{ width: '100%', marginTop: 4, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' }} />
              <span style={lbl}>{t.fFol}</span>
              <input value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} placeholder="Ej: 4000" style={{ margin: '4px 0 0' }} />
              <span style={lbl}>{t.fMethod}</span>
              <select value={f.payout_method} onChange={(e) => setF({ ...f, payout_method: e.target.value })} style={{ margin: '4px 0 0' }}>
                <option value="stripe">{t.paypal}</option><option value="usdt">{t.usdt}</option><option value="credit">{t.credit}</option>
              </select>
              <span style={lbl}>{t.fDet}</span>
              <input value={f.payout_details} onChange={(e) => setF({ ...f, payout_details: e.target.value })} placeholder={t.fDetPh} style={{ margin: '4px 0 0' }} />

              {missing.length > 0 && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(245,158,11,.08)', border: '1px solid var(--amber)', borderRadius: 10, fontSize: 13 }}>
                  <b style={{ color: 'var(--amber)' }}>{t.missT}</b>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              )}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 18, opacity: missing.length ? .5 : 1 }}
                onClick={send} disabled={busy || missing.length > 0}>{busy ? t.sending : t.send}</button>
            </>
          )}
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: 22 }}>{t.faqT}</h2>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {faqRows.map(([q, a]: [string, string]) => (
            <details key={q} className="card" style={{ padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}>
              <summary style={{ fontWeight: 700, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--brand)' }}>▶</span> {q}
              </summary>
              <p className="muted" style={{ fontSize: 14.5, marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
