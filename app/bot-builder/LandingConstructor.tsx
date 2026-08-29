'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import PlanCards from '@/app/PlanCards';

// Landing NATIVA del Constructor (opción A): iconos de línea (OnyxIcon), tema de
// la app, bilingüe con useLang, contador de robots en vivo (/api/stats) y precios
// desde tu Admin (/api/admin/plans). Cero datos escritos a mano.
export default function LandingConstructor() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
  const [stats, setStats] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [annual, setAnnual] = useState(false);
  const [built, setBuilt] = useState(0);

  useEffect(() => {
    fetch('/api/stats?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then(setStats).catch(() => {});
    fetch('/api/admin/plans', { cache: 'no-store' }).then((r) => r.json()).then((j) => setPlans(j.plans || [])).catch(() => {});
  }, []);
  // Anima el contador de robots hasta el valor real.
  useEffect(() => {
    const target = Number(stats?.botsBuilt || 0); if (!target) return; let c = built;
    const iv = setInterval(() => { c += Math.ceil((target - c) / 12); if (c >= target) { c = target; clearInterval(iv); } setBuilt(c); }, 45);
    return () => clearInterval(iv);
  }, [stats?.botsBuilt]);

  const feats = [
    ['🤖', L('Constructor de bots', 'Bot builder'), L('Por campos, con EA y guía en PDF.', 'By fields, with EA and PDF guide.')],
    ['🛡️', 'Onyx Guardian', L('Frena antes de romper tu reto.', 'Stops before you break your challenge.')],
    ['👥', L('Copy trading', 'Copy trading'), L('Copia a verificados o comparte.', 'Copy verified traders or share.')],
    ['📊', L('Diario y métricas', 'Journal & metrics'), L('Costos por par, R:R, parciales.', 'Cost per pair, R:R, partials.')],
    ['📰', L('Filtro de noticias', 'News filter'), L('Deja de abrir en alto impacto.', 'Stops opening on high impact.')],
    ['🌐', L('Multi-broker + bilingüe', 'Multi-broker & bilingual'), L('Encuentra tu símbolo solo.', 'Finds your symbol on its own.')],
  ];
  const steps = [
    [L('Arma tu receta', 'Build your recipe'), L('Completa las tarjetas: entrada, stop, TP, riesgo y reglas de fondeo.', 'Fill the cards: entry, stop, TP, risk and firm rules.')],
    [L('Descarga el EA', 'Download the EA'), L('Onyx genera el robot (.mq5), la config y una guía. Compilas y pruebas en demo.', 'Onyx generates the robot (.mq5), config and a guide. Compile and test on demo.')],
    [L('Opera protegido', 'Trade protected'), L('El bot ejecuta y reporta. Guardian frena antes de que rompas la cuenta.', 'The bot executes and reports. Guardian stops before you break the account.')],
  ];
  const shown = useMemo(() => plans, [plans]);
  const num = (n: number) => Number(n || 0).toLocaleString();

  return (
    <div className="lpc">
      <style>{`
      .lpc{max-width:1120px;margin:0 auto;padding:8px 0 40px}
      .lpc .hero{text-align:center;padding:44px 0 8px}
      .lpc .chip{display:inline-flex;align-items:center;gap:7px;font-size:13px;padding:6px 13px;border-radius:99px;background:var(--soft-brand);border:1px solid rgba(124,140,255,.4);color:var(--brand,#5b63d3)}
      .lpc h1{font-size:clamp(30px,5vw,50px);font-weight:800;line-height:1.12;margin:18px 0 0}
      .lpc .grad{background:linear-gradient(90deg,var(--brand,#5b63d3),#54e6d0);-webkit-background-clip:text;background-clip:text;color:transparent}
      .lpc .sub{color:var(--mut);font-size:clamp(15px,2vw,19px);max-width:620px;margin:16px auto 0}
      .lpc .cta{display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap}
      .lpc .sec{padding:44px 0}
      .lpc .eyebrow{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--brand,#5b63d3);font-weight:700}
      .lpc h2{font-size:clamp(24px,3.5vw,34px);font-weight:800;margin-top:10px}
      .lpc .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}
      @media(max-width:820px){.lpc .grid{grid-template-columns:1fr}}
      .lpc .feat .fic{width:44px;height:44px;border-radius:12px;background:var(--soft-brand);display:flex;align-items:center;justify-content:center;color:var(--brand,#5b63d3);margin-bottom:12px}
      .lpc .stepn{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6f77ea,#5b63d3);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;margin-bottom:12px}
      .lpc .counter{text-align:center;background:linear-gradient(135deg,var(--soft-brand),transparent);border:1px solid rgba(124,140,255,.4);border-radius:18px;padding:30px 16px}
      .lpc .counter .big{font-size:clamp(42px,8vw,64px);font-weight:800;letter-spacing:-1px;display:inline-flex;align-items:center;gap:12px}
      .lpc .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:22px}
      @media(max-width:680px){.lpc .metrics{grid-template-columns:1fr 1fr}}
      `}</style>

      {/* Hero */}
      <section className="hero">
        <span className="chip"><OnyxIcon emoji="🤖" size={15} /> {L('Para MT4 · MT5 · cTrader', 'For MT4 · MT5 · cTrader')}</span>
        <h1>{L('Construye tu bot,', 'Build your bot,')}<br /><span className="grad">{L('protege tu cuenta.', 'protect your account.')}</span></h1>
        <p className="sub">{L('Arma robots sin programar, cuida tu cuenta de fondeo con reglas automáticas y copia a los mejores. Todo en un panel.', 'Build robots without coding, protect your funded account with automatic rules, and copy the best. All in one panel.')}</p>
        <div className="cta">
          <a className="btn btn-primary" href="/login?mode=signup">{L('Empezar gratis', 'Start free')} →</a>
          <a className="btn btn-ghost" href="#como">{L('Cómo funciona', 'How it works')}</a>
        </div>
      </section>

      {/* Contador de robots + métricas */}
      <section className="sec" style={{ paddingTop: 18 }}>
        <div className="counter">
          <div className="eyebrow">{L('Robots construidos con Onyx', 'Bots built with Onyx')}</div>
          <div className="big" style={{ marginTop: 6, color: 'var(--ink,#12141a)' }}><OnyxIcon emoji="🤖" size={40} /><span>{num(built)}</span></div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2, display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green,#1d9e75)', display: 'inline-block' }} /> {L('subiendo en vivo', 'growing live')}</div>
        </div>
        <div className="metrics">
          <div className="card" style={{ textAlign: 'center', padding: '18px 10px' }}><div style={{ fontSize: 26, fontWeight: 800 }}>3</div><div className="muted" style={{ fontSize: 12.5 }}>{L('Plataformas', 'Platforms')}: MT4 · MT5 · cTrader</div></div>
          <div className="card" style={{ textAlign: 'center', padding: '18px 10px' }}><div style={{ fontSize: 26, fontWeight: 800 }}>{num(stats?.trades)}</div><div className="muted" style={{ fontSize: 12.5 }}>{L('Operaciones analizadas', 'Trades analyzed')}</div></div>
          <div className="card" style={{ textAlign: 'center', padding: '18px 10px' }}><div style={{ fontSize: 26, fontWeight: 800 }}>{num(stats?.blocks)}</div><div className="muted" style={{ fontSize: 12.5 }}>{L('Frenos del Guardian', 'Guardian blocks')}</div></div>
          <div className="card" style={{ textAlign: 'center', padding: '18px 10px' }}><div style={{ fontSize: 26, fontWeight: 800 }}>{num(stats?.accounts)}</div><div className="muted" style={{ fontSize: 12.5 }}>{L('Cuentas conectadas', 'Connected accounts')}</div></div>
        </div>
      </section>

      {/* Funciones */}
      <section className="sec" id="funciones">
        <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Todo en un panel', 'All in one panel')}</span><h2>{L('Del gráfico al bot, sin fricción', 'From chart to bot, frictionless')}</h2></div>
        <div className="grid">
          {feats.map(([ic, t, d]) => (
            <div key={t} className="card feat">
              <span className="fic"><OnyxIcon emoji={ic} size={22} /></span>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>{t}</h3>
              <p className="muted" style={{ fontSize: 14 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="sec" id="como">
        <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Cómo funciona', 'How it works')}</span><h2>{L('Tres pasos y tu bot está operando', 'Three steps and your bot is trading')}</h2></div>
        <div className="grid">
          {steps.map(([t, d], i) => (
            <div key={i}><div className="stepn">{i + 1}</div><h3 style={{ fontSize: 17, marginBottom: 6 }}>{t}</h3><p className="muted" style={{ fontSize: 14 }}>{d}</p></div>
          ))}
        </div>
      </section>

      {/* Precios (desde Admin) */}
      <section className="sec" id="precios">
        <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Precios', 'Pricing')}</span><h2>{L('Empieza gratis. Escala cuando quieras.', 'Start free. Scale when you want.')}</h2>
          <div style={{ display: 'inline-flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
            <button className={'btn btn-ghost' + (!annual ? ' btn-primary' : '')} style={{ padding: '6px 14px' }} onClick={() => setAnnual(false)}>{L('Mensual', 'Monthly')}</button>
            <button className={'btn btn-ghost' + (annual ? ' btn-primary' : '')} style={{ padding: '6px 14px' }} onClick={() => setAnnual(true)}>{L('Anual', 'Annual')}</button>
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          {shown.length > 0
            ? <PlanCards plans={shown} lang={es ? 'es' : 'en'} annual={annual} onChoose={(id: string, price: number) => { window.location.href = (price > 0 && id && id !== 'free') ? `/login?mode=signup&plan=${id}${annual ? '&annual=1' : ''}` : '/login?mode=signup'; }} />
            : <p className="muted" style={{ textAlign: 'center' }}>{L('Cargando planes…', 'Loading plans…')}</p>}
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}><a href="/pricing" style={{ color: 'var(--brand,#5b63d3)' }}>{L('Ver comparación completa de planes', 'See full plan comparison')} →</a></p>
        </div>
      </section>

      {/* CTA */}
      <section className="sec">
        <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg,var(--soft-brand),transparent)', border: '1px solid rgba(124,140,255,.4)', padding: '40px 24px' }}>
          <h2 style={{ margin: 0 }}>{L('Tu próximo reto, mejor protegido', 'Your next challenge, better protected')}</h2>
          <p className="muted" style={{ maxWidth: 520, margin: '12px auto 0' }}>{L('Crea tu primer bot gratis y deja que Onyx cuide tu cuenta mientras operas.', 'Create your first bot free and let Onyx protect your account while you trade.')}</p>
          <div style={{ marginTop: 22 }}><a className="btn btn-primary" href="/login?mode=signup" style={{ padding: '14px 26px', fontSize: 16 }}>{L('Empezar gratis', 'Start free')} →</a></div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', maxWidth: 780, margin: '18px auto 0', lineHeight: 1.6 }}>{L('Aviso de riesgo: el trading conlleva riesgo y puede no ser adecuado para todos. Los resultados pasados no garantizan resultados futuros. Onyx es una herramienta de software; no es asesoría financiera ni garantiza rentabilidad. Prueba todo en demo antes de real.', 'Risk notice: trading carries risk and may not be suitable for everyone. Past results do not guarantee future results. Onyx is a software tool; not financial advice and no profit guarantee. Test everything on demo before going live.')}</p>
      </section>
    </div>
  );
}
