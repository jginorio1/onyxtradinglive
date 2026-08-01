'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errMsg } from '@/lib/i18nErrors';
import QrPop from '@/app/components/QrPop';

type Lang = 'es' | 'en';

const A: any = {
  es: {
    joinT: 'Gana dinero con tu comunidad', joinD: 'Si tienes seguidores, canal o grupo, cobra una comisión recurrente por cada persona que se suscriba contigo.', joinBtn: 'Ver el programa →',
    pend: 'Solicitud en revisión', pendD: 'Estamos revisando tu solicitud. Te avisaremos por correo en cuanto esté aprobada.',
    rej: 'Solicitud no aprobada', rejD: 'Por ahora no hemos podido aprobar tu solicitud. Escríbenos si crees que es un error.',
    paused: 'Programa en pausa', pausedD: 'Tu participación está pausada temporalmente. Contáctanos para reactivarla.',
    tierS: 'Plata', tierG: 'Oro', lvl: 'Nivel', act: 'activos',
    toGold: 'suscriptores más y subes a Oro:', toGold2: 'en todos, también en los que ya tienes.', isGold: 'Estás en el nivel máximo. ¡Bien hecho!',
    link: 'Tu enlace', coupon: 'Tu cupón de descuento', couponD: 'Tu audiencia lo escribe al pagar y recibe descuento.',
    copy: 'Copiar', copied: 'Copiado',
    clicks: 'Clics', signups: 'Registros', active: 'Activos', conv: 'Conversión',
    pending: 'Pendiente', available: 'Disponible', paid: 'Pagado',
    holdNote: 'Pendiente = comisiones de los últimos 30 días, retenidas por si hay reembolsos.',
    req: 'Solicitar pago', reqing: '...', minNote: 'Mínimo para cobrar:', reqOk: 'Solicitud enviada. Te pagaremos en los próximos días.',
    payT: 'Datos de cobro', method: 'Método', details: 'Datos', save: 'Guardar', saved: 'Guardado',
    paypal: 'PayPal', usdt: 'USDT', credit: 'Crédito en mi plan',
    hist: 'Historial de pagos', noHist: 'Todavía no has solicitado ningún pago.',
    stReq: 'solicitado', stPaid: 'pagado', stRej: 'rechazado',
    aiKitT: 'Generar publicaciones con AI', aiKitD: 'Elige tu plataforma y la IA te crea un post listo, con tu enlace y código ya puestos.',
    aiGen: 'Generar', aiAgain: 'Otra versión', banners: 'Banners + logos', aiEmpty: 'Pulsa Generar para crear tu publicación.',
    kitT: 'Kit de materiales', kitD: 'Copia estos textos y adáptalos a tu estilo. Cambia el enlace por el tuyo.',
    kIg: 'Para Instagram o X', kTg: 'Para Telegram o WhatsApp', kVid: 'Guion de video (30 segundos)',
    txtIg: 'Dejé de anotar mis operaciones en Excel. Conecto mi cuenta (MetaTrader o cTrader) a Onyx y veo mi win rate, mis horas buenas y mis errores automáticamente. Pruébalo gratis con mi enlace y llévate descuento:',
    txtTg: 'Os dejo la herramienta que uso para llevar mi diario de trading. Se conecta sola a MetaTrader y cTrader y te muestra estadísticas reales: rachas, mejores horas, costes y reglas de fondeo. Hay plan gratis, y con mi código tenéis descuento el primer mes:',
    txtVid: '1) Enseña tu MT5 lleno de operaciones: "así llevaba yo mis números". 2) Abre tu dashboard de Onyx: "y así los llevo ahora". 3) Señala tu win rate y tus mejores horas. 4) "Se conecta solo, hay versión gratis, mi código está abajo".',
  },
  en: {
    joinT: 'Earn with your community', joinD: 'If you have followers, a channel or a group, earn a recurring commission for everyone who subscribes through you.', joinBtn: 'See the program →',
    pend: 'Application under review', pendD: 'We are reviewing your application. We will email you as soon as it is approved.',
    rej: 'Application not approved', rejD: 'We could not approve your application for now. Write to us if you think this is a mistake.',
    paused: 'Participation paused', pausedD: 'Your participation is temporarily paused. Contact us to reactivate it.',
    tierS: 'Silver', tierG: 'Gold', lvl: 'Tier', act: 'active',
    toGold: 'more subscribers to reach Gold:', toGold2: 'on everyone, including the ones you already have.', isGold: 'You are at the top tier. Well done!',
    link: 'Your link', coupon: 'Your discount code', couponD: 'Your audience types it at checkout and gets a discount.',
    copy: 'Copy', copied: 'Copied',
    clicks: 'Clicks', signups: 'Signups', active: 'Active', conv: 'Conversion',
    pending: 'Pending', available: 'Available', paid: 'Paid',
    holdNote: 'Pending = commissions from the last 30 days, held in case of refunds.',
    req: 'Request payout', reqing: '...', minNote: 'Minimum payout:', reqOk: 'Request sent. We will pay you in the next few days.',
    payT: 'Payout details', method: 'Method', details: 'Details', save: 'Save', saved: 'Saved',
    paypal: 'PayPal', usdt: 'USDT', credit: 'Credit on my plan',
    hist: 'Payout history', noHist: 'You have not requested any payout yet.',
    stReq: 'requested', stPaid: 'paid', stRej: 'rejected',
    aiKitT: 'Generate posts with AI', aiKitD: 'Pick your platform and AI writes a ready-to-post caption, with your link and code already in it.',
    aiGen: 'Generate', aiAgain: 'Another version', banners: 'Banners + logos', aiEmpty: 'Hit Generate to create your post.',
    kitT: 'Marketing kit', kitD: 'Copy these texts and make them your own. Swap the link for yours.',
    kIg: 'For Instagram or X', kTg: 'For Telegram or WhatsApp', kVid: 'Video script (30 seconds)',
    txtIg: 'I stopped tracking my trades in a spreadsheet. I connect my account (MetaTrader or cTrader) to Onyx and it shows my win rate, my best hours and my mistakes automatically. Try it free with my link and get a discount:',
    txtTg: 'Here is the tool I use for my trading journal. It connects to MetaTrader and cTrader by itself and shows real stats: streaks, best hours, costs and prop-firm rules. There is a free plan, and with my code you get a discount on your first month:',
    txtVid: '1) Show your MT5 full of trades: "this is how I used to track my numbers". 2) Open your Onyx dashboard: "and this is how I track them now". 3) Point at your win rate and your best hours. 4) "It connects by itself, there is a free version, my code is below".',
  },
};

export default function Ambassador({ lang }: { lang: Lang }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [pm, setPm] = useState('paypal');
  const [pd, setPd] = useState('');
  const [origin, setOrigin] = useState('');
  const [plat, setPlat] = useState('instagram');
  const [aiText, setAiText] = useState('');
  const t = dictFor(A, lang);

  async function genPost() {
    setBusy('ai');
    try {
      const r = await fetch('/api/ambassador/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ platform: plat, lang, niche: 'prop' }) });
      const j = await r.json();
      if (!r.ok) { toast(j.error || 'Error'); return; }
      setAiText(j.text || '');
    } finally { setBusy(''); }
  }

  useEffect(() => { setOrigin(window.location.origin); load(); }, []);
  async function load() {
    try {
      const r = await fetch('/api/ambassador');
      if (!r.ok) { setD({ ambassador: null }); return; }
      const j = await r.json();
      setD(j);
      if (j.ambassador) { setPm(j.ambassador.payout_method || 'paypal'); setPd(j.ambassador.payout_details || ''); }
    } catch { setD({ ambassador: null }); }
  }
  function copy(text: string, tag: string) { navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(''), 1800); }

  async function savePayout() {
    // Sin datos de cobro no podriamos pagarle, asi que no dejamos guardar vacio
    if (String(pd || '').trim().length < 4) { toast(errMsg({ code: 'need_details' }, lang)); return; }
    setBusy('pay');
    const r = await fetch('/api/ambassador', { method: 'PATCH', body: JSON.stringify({ payout_method: pm, payout_details: pd }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    setCopied('saved'); setTimeout(() => setCopied(''), 2000);
  }
  async function requestPayout() {
    setBusy('req');
    const r = await fetch('/api/ambassador/payout', { method: 'POST' });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    toast(t.reqOk); load();
  }

  if (!d) return <div className="card muted">…</div>;

  const a = d.ambassador;
  const s = d.settings || {};

  if (!a) return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}><OnyxIcon emoji="🎁" size={16} /></div>
      <h3 style={{ marginBottom: 8 }}>{t.joinT}</h3>
      <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t.joinD}</p>
      <Link className="btn btn-primary" href="/embajadores">{t.joinBtn}</Link>
    </div>
  );

  if (a.status !== 'approved') {
    const map: any = { pending: [t.pend, t.pendD, 'var(--amber)'], rejected: [t.rej, t.rejD, 'var(--red)'], paused: [t.paused, t.pausedD, 'var(--mut)'] };
    const [ti, de, col] = map[a.status] || map.pending;
    return (
      <div className="card" style={{ maxWidth: 560, border: '1px solid ' + col }}>
        <h3 style={{ marginBottom: 8, color: col }}>{ti}</h3>
        <p className="muted" style={{ fontSize: 14 }}>{de}</p>
      </div>
    );
  }

  const link = `${origin}/?ref=${a.code}`;
  const bal = d.balances || { pending: 0, available: 0, paid: 0 };
  const thr = Number(s.tier_threshold || 10);
  const isGold = a.tier === 'gold';
  const pctTier = isGold ? 100 : Math.min(100, Math.round((a.active / Math.max(thr, 1)) * 100));
  const conv = a.clicks ? Math.round((a.signups / a.clicks) * 100) : 0;
  const canReq = bal.available >= Number(s.min_payout || 50);
  const box = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } as any;
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 10, display: 'block' } as any;

  return (
    <>
      {/* Nivel */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <b style={{ color: isGold ? 'var(--gold)' : '#c7ccd6' }}>{t.lvl} {isGold ? t.tierG : t.tierS} · {a.rate}%</b>
          <span className="muted" style={{ fontSize: 13 }}>{a.active} {isGold ? t.act : `/ ${thr} ${t.act}`}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: pctTier + '%', height: '100%', background: isGold ? 'linear-gradient(90deg,var(--gold),#ffb020)' : 'var(--grad)', transition: '.3s' }} />
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          {isGold ? t.isGold : `${Math.max(0, thr - a.active)} ${t.toGold} ${s.tier_rate || 30}% ${t.toGold2}`}
        </p>
      </div>

      {/* Enlace y cupón */}
      <div className="card" style={{ marginBottom: 14 }}>
        <span style={lbl}>{t.link}</span>
        <div style={{ ...box, marginTop: 4 }}>
          <code style={{ flex: 1, minWidth: 180, wordBreak: 'break-all' }}>{link}</code>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => copy(link, 'link')}>{copied === 'link' ? t.copied : t.copy}</button>
          <QrPop data={link} poster="ambassador" handle={'@' + a.code} label="QR / Póster" title={lang === 'en' ? 'Join with my link' : 'Únete con mi enlace'} />
        </div>
        {Number(s.coupon_percent) > 0 && (
          <>
            <span style={lbl}>{t.coupon}</span>
            <div style={{ ...box, marginTop: 4 }}>
              <code style={{ flex: 1, minWidth: 120, letterSpacing: 1, fontWeight: 700 }}>{a.code.toUpperCase()}</code>
              <span className="pill green">-{s.coupon_percent}%</span>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => copy(a.code.toUpperCase(), 'cup')}>{copied === 'cup' ? t.copied : t.copy}</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t.couponD}</div>
          </>
        )}
      </div>

      {/* Métricas */}
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="card kpi"><div className="lbl">{t.clicks}</div><div className="val">{a.clicks}</div></div>
        <div className="card kpi"><div className="lbl">{t.signups}</div><div className="val">{a.signups}</div></div>
        <div className="card kpi"><div className="lbl">{t.active}</div><div className="val pos">{a.active}</div></div>
        <div className="card kpi"><div className="lbl">{t.conv}</div><div className="val">{conv}%</div></div>
      </div>

      {/* Saldos */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="grid g3" style={{ gap: 12 }}>
          <div><div className="muted" style={{ fontSize: 13 }}>{t.pending}</div><div style={{ fontSize: 22, fontWeight: 800 }}>${bal.pending}</div></div>
          <div><div className="muted" style={{ fontSize: 13 }}>{t.available}</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>${bal.available}</div></div>
          <div><div className="muted" style={{ fontSize: 13 }}>{t.paid}</div><div style={{ fontSize: 22, fontWeight: 800 }}>${bal.paid}</div></div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '10px 0 12px' }}>{t.holdNote}</p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={requestPayout} disabled={!canReq || busy === 'req'}>{busy === 'req' ? t.reqing : t.req}</button>
          {!canReq && <span className="muted" style={{ fontSize: 13 }}>{t.minNote} ${s.min_payout || 50}</span>}
        </div>
      </div>

      {/* Datos de cobro */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 4 }}>{t.payT}</h3>
        <span style={lbl}>{t.method}</span>
        <select value={pm} onChange={(e) => setPm(e.target.value)} style={{ margin: '4px 0 0', maxWidth: 260 }}>
          <option value="paypal">{t.paypal}</option><option value="usdt">{t.usdt}</option><option value="credit">{t.credit}</option>
        </select>
        <span style={lbl}>{t.details}</span>
        <input value={pd} onChange={(e) => setPd(e.target.value)} style={{ margin: '4px 0 0', maxWidth: 380 }} />
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={savePayout} disabled={busy === 'pay' || String(pd || '').trim().length < 4}
            style={{ opacity: String(pd || '').trim().length < 4 ? .5 : 1 }}>{busy === 'pay' ? '...' : t.save}</button>
          {copied === 'saved' && <span style={{ color: 'var(--green)', fontSize: 13 }}>{t.saved}</span>}
        </div>
      </div>

      {/* Historial */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 10 }}>{t.hist}</h3>
        {!d.payouts?.length && <p className="muted" style={{ fontSize: 14 }}>{t.noHist}</p>}
        {(d.payouts || []).map((p: any) => (
          <div key={p.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '9px 0', fontSize: 14 }}>
            <span>${p.amount} · {p.method}</span>
            <span className="pill" style={{ color: p.status === 'paid' ? 'var(--green)' : p.status === 'rejected' ? 'var(--red)' : 'var(--amber)' }}>
              {p.status === 'paid' ? t.stPaid : p.status === 'rejected' ? t.stRej : t.stReq}
            </span>
          </div>
        ))}
      </div>

      {/* Generar publicaciones con AI */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}><OnyxIcon emoji="✨" size={16} /> {t.aiKitT}</h3>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {['youtube', 'instagram', 'tiktok', 'telegram'].map((pf) => (
              <button key={pf} className="pill" onClick={() => setPlat(pf)}
                style={{ cursor: 'pointer', textTransform: 'capitalize', ...(plat === pf ? { color: 'var(--soft-brand)', background: 'rgba(124,140,255,.18)' } : { color: 'var(--mut)', background: 'var(--bg2)' }) }}>{pf}</button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.aiKitD}</p>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 1.6, minHeight: 64, whiteSpace: 'pre-wrap' }}>
          {aiText || <span className="muted">{t.aiEmpty}</span>}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={genPost} disabled={busy === 'ai'}>{busy === 'ai' ? '…' : (aiText ? '↻ ' + t.aiAgain : '✨ ' + t.aiGen)}</button>
          {aiText && <button className="btn btn-ghost" onClick={() => copy(aiText, 'ai')}>{copied === 'ai' ? t.copied : t.copy}</button>}
          <a className="btn btn-ghost" href={`/api/ambassador/banner?lang=${lang}`} style={{ marginLeft: 'auto' }}>⤓ {t.banners}</a>
        </div>
      </div>

      {/* Kit de materiales */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>{t.kitT}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{t.kitD}</p>
        {([['ig', t.kIg, `${t.txtIg} ${link}`], ['tg', t.kTg, `${t.txtTg} ${link}`], ['vid', t.kVid, t.txtVid]] as [string, string, string][]).map(([k, ti, txt]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{ti}</div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 1.6 }}>{txt}</div>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, marginTop: 6 }} onClick={() => copy(txt, k)}>{copied === k ? t.copied : t.copy}</button>
          </div>
        ))}
      </div>
    </>
  );
}
