'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';

const T: any = {
  es: {
    h1: 'Invita a un amigo y ganen los dos',
    sub: 'Comparte tu enlace de Onyx. Cuando tu amigo se suscribe, tú recibes crédito y él también. Sin trámites, sin códigos que recordar.',
    youGet: 'Recibes tú', friendGets: 'Recibe tu amigo', credit: 'de crédito',
    creditNote: 'Se aplica solo a tu próxima factura tras {d} días.',
    calcT: 'Calcula tu crédito', calcFriends: 'Amigos que traes', calcYours: 'Tu crédito total', calcTheirs: 'Crédito para ellos',
    how: 'Cómo funciona',
    s1t: 'Comparte tu enlace', s1d: 'En Mi cuenta → Referidos tienes tu enlace propio. Compártelo por WhatsApp, Telegram o donde quieras.',
    s2t: 'Tu amigo se suscribe', s2d: 'Entra con tu enlace y se hace cliente de pago. La atribución es automática.',
    s3t: 'Ganan los dos', s3d: 'Pasada la ventana de seguridad, el crédito se aplica solo a la cuenta de cada uno.',
    bridgeT: '¿Traes muchos amigos?', bridgeD: 'Al llegar a {n} referidos que pagan, te invitamos a ser Embajador y pasar a comisión en efectivo recurrente.',
    ctaGuestT: 'Crea tu cuenta gratis y consigue tu enlace', ctaGuest: 'Crear cuenta o entrar →',
    ctaUserT: 'Tu enlace ya está listo', ctaUser: 'Ver mi enlace →',
    faqT: 'Preguntas frecuentes',
    faq: [
      ['¿Cuándo recibo el crédito?', 'Cuando tu amigo hace su primer pago y pasa la ventana anti-reembolso. Así evitamos fraudes.'],
      ['¿Cómo se me da el crédito?', 'Como saldo en tu cuenta: reduce tu próxima factura automáticamente. No hay códigos que teclear.'],
      ['¿Hay límite de amigos?', 'Puedes invitar a todos los que quieras. Cada amigo que paga te da crédito.'],
      ['¿Y si mi amigo cancela o pide reembolso?', 'Si ocurre dentro de la ventana, el crédito se anula. Solo premiamos referidos reales.'],
      ['¿En qué se diferencia de ser Embajador?', 'Aquí ganas crédito en tu cuenta; como Embajador ganas comisión en efectivo recurrente. Al traer varios amigos te invitamos a dar el salto.'],
      ['¿Puedo invitarme a mí mismo?', 'No. El sistema no cuenta auto-referidos ni cuentas duplicadas.'],
    ],
  },
  en: {
    h1: 'Invite a friend and you both win',
    sub: 'Share your Onyx link. When your friend subscribes, you get credit and so do they. No paperwork, no codes to remember.',
    youGet: 'You get', friendGets: 'Your friend gets', credit: 'credit',
    creditNote: 'Applied automatically to your next invoice after {d} days.',
    calcT: 'Calculate your credit', calcFriends: 'Friends you bring', calcYours: 'Your total credit', calcTheirs: 'Credit for them',
    how: 'How it works',
    s1t: 'Share your link', s1d: 'In My account → Referrals you have your own link. Share it on WhatsApp, Telegram, anywhere.',
    s2t: 'Your friend subscribes', s2d: 'They join with your link and become a paying customer. Attribution is automatic.',
    s3t: 'You both win', s3d: 'After the safety window, the credit is applied automatically to each account.',
    bridgeT: 'Bringing lots of friends?', bridgeD: 'When you reach {n} paying referrals, we invite you to become an Ambassador and switch to recurring cash commission.',
    ctaGuestT: 'Create your free account and get your link', ctaGuest: 'Create account or sign in →',
    ctaUserT: 'Your link is ready', ctaUser: 'See my link →',
    faqT: 'FAQ',
    faq: [
      ['When do I get the credit?', 'When your friend makes their first payment and clears the refund window. This prevents fraud.'],
      ['How is the credit given?', 'As account balance: it reduces your next invoice automatically. No codes to type.'],
      ['Is there a limit of friends?', 'Invite as many as you want. Every friend who pays gives you credit.'],
      ['What if my friend cancels or refunds?', 'If it happens within the window, the credit is voided. We only reward real referrals.'],
      ['How is it different from being an Ambassador?', 'Here you earn account credit; as an Ambassador you earn recurring cash commission. Bring several friends and we invite you to make the jump.'],
      ['Can I refer myself?', 'No. The system does not count self-referrals or duplicate accounts.'],
    ],
  },
};

export default function Invita() {
  const { lang } = useLang();
  const t = dictFor(T, lang);
  const [d, setD] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [n, setN] = useState(5);
  const [lcFaqRaw, setLcFaqRaw] = useState<string[][] | null>(null);
  const [lcPage, setLcPage] = useState<any>(null);
  // FAQ editable del Landing Builder (si el admin la puso, reemplaza la del código).
  const faqRows: [string, string][] = (lcFaqRaw && lcFaqRaw.length)
    ? lcFaqRaw.map((r) => lang === 'es' ? [r[0], r[1]] : [r[2], r[3]])
    : t.faq;
  const px = (k: string, fb: string) => lcPage?.[k]?.[lang] || fb;

  useEffect(() => {
    fetch('/api/referral/info?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => setD({ referrerCredit: 10, friendCredit: 10, holdDays: 21, bridge: 5 }));
    fetch('/api/referral').then((r) => setLoggedIn(r.status !== 401)).catch(() => setLoggedIn(false));
    fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json())
      .then((c) => { const rows = c?.faq?.invita; if (Array.isArray(rows) && rows.length) setLcFaqRaw(rows); setLcPage(c?.pages?.invita || null); }).catch(() => {});
  }, []);

  const fill = (s: string, m: any) => Object.keys(m).reduce((x, k) => x.replace(`{${k}}`, m[k]), s);
  const you = d?.referrerCredit ?? 10;
  const friend = d?.friendCredit ?? 10;

  const steps: [string, string, string][] = [['link', t.s1t, t.s1d], ['users', t.s2t, t.s2d], ['gift', t.s3t, t.s3d]];

  return (
    <div className="wrap" style={{ padding: '52px 22px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="gift" size={40} /></div>
        <h1 style={{ fontSize: 36, letterSpacing: '-1px', marginTop: 8 }}>{px('h1', t.h1)}</h1>
        <p className="muted" style={{ margin: '12px auto 0', maxWidth: 620, fontSize: 17 }}>{px('sub', t.sub)}</p>
      </div>

      <div className="grid g2" style={{ maxWidth: 620, margin: '0 auto 12px', gap: 14 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 800, background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>${you}</div>
          <div style={{ fontWeight: 700 }}>{t.youGet}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.credit}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--green)' }}>${friend}</div>
          <div style={{ fontWeight: 700 }}>{t.friendGets}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.credit}</div>
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 13, maxWidth: 620, margin: '0 auto 34px' }}>{fill(t.creditNote, { d: d?.holdDays ?? 21 })}</p>

      {/* Calculadora iluminada · usa los importes reales de admin */}
      <div style={{ maxWidth: 520, margin: '0 auto 44px', background: 'var(--card)', border: '2px solid var(--brand)', borderRadius: 18, padding: 22, boxShadow: '0 0 0 1px rgba(124,140,255,.5), 0 0 44px rgba(124,140,255,.35)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, background: 'rgba(124,140,255,.15)', color: 'var(--brand)', padding: '5px 13px', borderRadius: 999, marginBottom: 16, fontWeight: 700 }}>
          <OnyxIcon name="coins" size={15} glow={false} /> {t.calcT}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13.5, color: 'var(--mut)', width: 130, flex: 'none' }}>{t.calcFriends}</label>
          <input type="range" min={1} max={20} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ flex: 1, margin: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, width: 30, textAlign: 'right', flex: 'none' }}>{n}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'rgba(124,140,255,.14)', borderRadius: 12, padding: '11px 13px' }}>
            <div style={{ fontSize: 12, color: 'var(--brand)' }}>{t.calcYours}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>${(you * n).toLocaleString('en-US')}</div>
          </div>
          <div style={{ background: 'rgba(35,197,120,.12)', borderRadius: 12, padding: '11px 13px' }}>
            <div style={{ fontSize: 12, color: 'var(--green)' }}>{t.calcTheirs}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>${(friend * n).toLocaleString('en-US')}</div>
          </div>
        </div>
      </div>

      <h2 style={{ textAlign: 'center', marginBottom: 20 }}>{t.how}</h2>
      <div className="grid g3" style={{ marginBottom: 40 }}>
        {steps.map(([ic, ti, de], i) => (
          <div key={i} className="card">
            <span style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124,140,255,.16)', color: 'var(--brand)', display: 'grid', placeItems: 'center', marginBottom: 10 }}><OnyxIcon name={ic} size={20} glow={false} /></span>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{ti}</div>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{de}</p>
          </div>
        ))}
      </div>

      {d?.bridge > 0 && (
        <div className="card" style={{ maxWidth: 620, margin: '0 auto 40px', textAlign: 'center', border: '1px solid var(--brand)' }}>
          <div style={{ color: 'var(--brand)', display: 'inline-flex', marginBottom: 4 }}><OnyxIcon name="up" size={24} /></div>
          <b style={{ fontSize: 16 }}>{t.bridgeT}</b>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>{fill(t.bridgeD, { n: d.bridge })}</p>
          <Link className="btn btn-ghost" href="/embajadores" style={{ marginTop: 10 }}>{lang === 'en' ? 'See the Ambassador program' : 'Ver el programa de Embajadores'}</Link>
        </div>
      )}

      <div className="card" style={{ maxWidth: 520, margin: '0 auto 44px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: 10 }}>{loggedIn ? t.ctaUserT : t.ctaGuestT}</h3>
        {loggedIn
          ? <Link className="btn btn-primary" href="/account#referidos">{t.ctaUser}</Link>
          : <Link className="btn btn-primary" href="/login?mode=signup">{t.ctaGuest}</Link>}
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
  );
}
