'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import EarningsCalc from '@/app/EarningsCalc';
import { errMsg } from '@/lib/i18nErrors';
import OnyxIcon from '@/app/components/OnyxIcon';

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
    tiers: 'Tus niveles', tier1: 'Plata', tier1d: 'desde tu primer suscriptor', tier2: 'Oro', tier2d: 'al llegar a 10 activos · sube TODO tu portafolio (retroactivo)',
    heroPill: 'Ejemplo: con 20 suscriptores de $19/mes',
    snowT: 'Tu ingreso crece solo', snowS: 'Recurrente mensual al acumular suscriptores', snowEnd: '/mes al mes 12', snowM1: 'mes 1',
    reqT: 'Requisitos para cobrar', req1: 'Referido con pago completado', req2: 'Pasó la ventana anti-reembolso', req3: 'Saldo sobre el mínimo', req4: 'Pago automático, sin trámites',
    bridgeT2: '¿Apenas empiezas?', bridgeD2: 'En «Invita y gana» ganas crédito por cada amigo. Al llegar a varios referidos que pagan, subes aquí y cobras en efectivo recurrente.', bridgeBtn2: 'Ver Invita y gana →',
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
      ['¿Cuánto dura mi comisión?', 'Todos los meses que tu referido siga pagando. No hay tope de meses ni de monto: mientras él pague, tú cobras.'],
      ['¿Qué pasa si mi referido cancela o pide reembolso?', 'Si cancela, dejas de cobrar de esa cuenta desde ese mes; lo que ya cobraste es tuyo. Si pide reembolso dentro de la ventana anti-reembolso, esa comisión se revierte. Solo premiamos referidos reales.'],
      ['¿El % nuevo aplica a mis referidos viejos?', 'Sí. Al subir de nivel (de Plata a Oro), tu comisión sube para TODO tu portafolio, no solo para los nuevos. Es retroactivo.'],
      ['¿Cómo y por dónde me pagan?', 'Por Stripe (a tu banco o tarjeta), en cripto (USDT) o como crédito en tu plan. Con Stripe el pago sale automático cuando tu saldo madura y supera el mínimo — no tienes que hacer nada. En cripto lo procesamos a mano, de 1 a 5 días hábiles.'],
      ['¿Cuándo puedo cobrar?', 'Las comisiones se retienen unos días por si hay reembolsos. Después pasan a disponible y, al superar el mínimo, se pagan automáticamente (con Stripe). También puedes solicitarlo desde Mi cuenta → Retiros.'],
      ['¿Hay límite de ganancias o de referidos?', 'No. A más suscriptores activos, mayor tu nivel y tu porcentaje. Sin techo.'],
      ['¿Tiene algún costo ser embajador?', 'No, es gratis. Llenas el formulario, te aprobamos y empiezas a compartir tu enlace.'],
      ['¿Cómo se atribuye un referido?', 'Automático por tu enlace y tu código de descuento. Tu audiencia entra con descuento y queda ligada a ti; no hay códigos que teclear.'],
      ['¿Cuál es la diferencia con «Invita y gana»?', 'En Invita y gana ganas crédito en tu cuenta por cada amigo; como Embajador ganas comisión en efectivo recurrente. Es el siguiente escalón: empiezas con crédito y gradúas a efectivo.'],
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
    tiers: 'Your tiers', tier1: 'Silver', tier1d: 'from your first subscriber', tier2: 'Gold', tier2d: 'at 10 active referrals · your WHOLE book jumps up (retroactive)',
    heroPill: 'Example: with 20 subscribers at $19/mo',
    snowT: 'Your income grows on its own', snowS: 'Monthly recurring as you stack subscribers', snowEnd: '/mo by month 12', snowM1: 'month 1',
    reqT: 'Requirements to get paid', req1: 'Referral with completed payment', req2: 'Passed the refund window', req3: 'Balance above the minimum', req4: 'Automatic payout, no paperwork',
    bridgeT2: 'Just getting started?', bridgeD2: 'In “Invite & earn” you get credit for each friend. Once you bring several paying referrals, you move up here and earn recurring cash.', bridgeBtn2: 'See Invite & earn →',
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
      ['How long does my commission last?', 'Every month your referral keeps paying. No cap on months or amount: while they pay, you get paid.'],
      ['What if my referral cancels or refunds?', 'If they cancel, you stop earning from that account that month; what you already earned is yours. If they refund within the refund window, that commission is reversed. We only reward real referrals.'],
      ['Does the new rate apply to my old referrals?', 'Yes. When you move up (Silver to Gold), your rate rises for your WHOLE book, not just the new ones. It is retroactive.'],
      ['How and where do I get paid?', 'Via Stripe (to your bank or card), crypto (USDT) or as credit on your plan. With Stripe the payout goes out automatically once your balance matures and passes the minimum — nothing to do. Crypto we process by hand, 1 to 5 business days.'],
      ['When can I withdraw?', 'Commissions are held a few days in case of refunds. After that they become available and, once above the minimum, pay out automatically (with Stripe). You can also request it from My account → Payouts.'],
      ['Is there an earnings or referral cap?', 'No. The more active subscribers, the higher your tier and rate. No ceiling.'],
      ['Is there any cost to be an ambassador?', 'No, it is free. Fill the form, get approved and start sharing your link.'],
      ['How is a referral attributed?', 'Automatically via your link and discount code. Your audience joins with a discount and stays tied to you — no codes to type.'],
      ['How is it different from “Invite & earn”?', 'In Invite & earn you get account credit per friend; as an Ambassador you earn recurring cash. It is the next step: start with credit, graduate to cash.'],
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
  // Héroe/bola de nieve: ejemplo con 20 suscriptores de $19, usando el % en vivo del panel.
  const heroPrice = 19, heroSubs = 20;
  const heroMonthly = Math.round(heroPrice * heroSubs * rate / 100);
  const snow = Array.from({ length: 12 }, (_, i) => { const subs = Math.max(1, Math.round(heroSubs * (i + 1) / 12)); return Math.round(heroPrice * subs * rate / 100); });
  const snowMax = Math.max(...snow, 1);
  const snowPts = snow.map((v, i) => `${8 + 196 * (i / 11)},${86 - 72 * (v / snowMax)}`).join(' ');
  const money = (v: number) => '$' + Math.round(v).toLocaleString('en-US');

  return (
    <>

      <div className="wrap" style={{ padding: '52px 22px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, letterSpacing: '-1px' }}>{px('h1', t.h1)}</h1>
          <p className="muted" style={{ margin: '12px auto 0', maxWidth: 620, fontSize: 17 }}>{px('sub', t.sub)}</p>
          <div style={{ display: 'inline-block', marginTop: 16, background: 'rgba(35,197,120,.10)', border: '1px solid var(--green)', borderRadius: 12, padding: '10px 20px' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{t.heroPill}</span>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green)' }}>{money(heroMonthly)}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> /mes {t.k1}</span></div>
          </div>
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

        {/* BOLA DE NIEVE: el ingreso recurrente crece al acumular suscriptores (usa el % en vivo) */}
        <div className="card" style={{ maxWidth: 620, margin: '0 auto 44px' }}>
          <b style={{ fontSize: 15 }}>{t.snowT}</b>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t.snowS}</div>
          <svg width="100%" height="96" viewBox="0 0 212 92" preserveAspectRatio="none" style={{ display: 'block' }}>
            <polygon points={`8,86 ${snowPts} 204,86`} fill="var(--green)" opacity="0.14" />
            <polyline points={snowPts} fill="none" stroke="var(--green)" strokeWidth="2" />
            <circle cx="204" cy={86 - 72 * (snow[11] / snowMax)} r="3" fill="var(--green)" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="muted" style={{ fontSize: 11 }}>{t.snowM1}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{money(snow[11])}<span className="muted" style={{ fontSize: 11, fontWeight: 400 }}> {t.snowEnd}</span></span>
          </div>
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

        {/* REQUISITOS PARA COBRAR (transparencia · usa el mínimo en vivo) */}
        <div style={{ maxWidth: 760, margin: '0 auto 28px' }}>
          <b style={{ fontSize: 15, display: 'block', marginBottom: 10 }}>{t.reqT}</b>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[t.req1, t.req2, `${t.req3} (${money(minP)})`, t.req4].map((r: string) => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 9, padding: '7px 11px', fontSize: 13 }}>
                <OnyxIcon name="check" size={14} glow={false} /><span className="muted">{r}</span>
              </span>
            ))}
          </div>
        </div>

        {/* PUENTE hacia Invita y gana (crédito → efectivo) */}
        <div className="card" style={{ maxWidth: 620, margin: '0 auto 44px', textAlign: 'center' }}>
          <b style={{ fontSize: 16 }}>{t.bridgeT2}</b>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{t.bridgeD2}</p>
          <Link className="btn btn-ghost" href="/invita" style={{ marginTop: 10 }}>{t.bridgeBtn2}</Link>
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
              <div style={{ fontSize: 34, marginBottom: 8 }}><OnyxIcon emoji="🎉" size={15} /></div>
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
        {/* Datos estructurados FAQPage (SEO): mismas preguntas visibles, en JSON-LD. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqRows.filter(([q, a]) => q && a).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
        }) }} />
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
