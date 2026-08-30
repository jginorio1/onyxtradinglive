'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';
import PlanCards from '@/app/PlanCards';

// Landing NATIVA del Constructor (opción A): iconos de línea (OnyxIcon), tema de
// la app, bilingüe con useLang, contador de robots en vivo (/api/stats) y precios
// desde tu Admin (/api/admin/plans). Cero datos escritos a mano.
//
// v166: contrastes arreglados (contador y CTA con degradado oscuro y texto claro),
// métricas con color por tipo, dos secciones "split" traídas del landing anterior
// (constructor + panel del EA), FAQ y reseñas (editables desde Admin → Módulos).
export default function LandingConstructor() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
  const [stats, setStats] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [annual, setAnnual] = useState(false);
  const [built, setBuilt] = useState(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

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

  // El bot es AUTÓNOMO: trae dentro sus reglas de fondeo, filtro de noticias y de
  // sesión. Lo único que necesita de Onyx es registrar las operaciones en tu panel.
  const feats = [
    ['🤖', L('Constructor de bots', 'Bot builder'), L('Por campos, con EA y guía en PDF. Sin programar.', 'By fields, with EA and PDF guide. No coding.')],
    ['🛡️', L('Protección integrada', 'Built-in protection'), L('Tus reglas de fondeo van dentro del bot: pérdida diaria, drawdown y objetivo. Se frena solo.', 'Your firm rules live inside the bot: daily loss, drawdown and target. It stops itself.')],
    ['📰', L('Filtro de noticias integrado', 'Built-in news filter'), L('El bot evita operar en alto impacto por sí mismo.', 'The bot avoids high-impact news on its own.')],
    ['⏰', L('Filtro de sesión', 'Session filter'), L('Opera solo en tu horario (Londres/NY), dentro del EA.', 'Trades only in your session (London/NY), inside the EA.')],
    ['🔄', L('Registro automático', 'Automatic logging'), L('Cada operación llega a tu panel: diario, métricas y portafolio.', 'Every trade reaches your dashboard: journal, metrics and portfolio.')],
    ['🌐', L('Multi-broker + bilingüe', 'Multi-broker & bilingual'), L('Encuentra tu símbolo solo. MT4 · MT5 · cTrader.', 'Finds your symbol on its own. MT4 · MT5 · cTrader.')],
  ];
  const steps = [
    [L('Arma tu receta', 'Build your recipe'), L('Completa las tarjetas: entrada, stop, TP, riesgo y reglas de fondeo.', 'Fill the cards: entry, stop, TP, risk and firm rules.')],
    [L('Descarga el EA', 'Download the EA'), L('Onyx genera el robot (.mq5), la config y una guía. Compilas y pruebas en demo.', 'Onyx generates the robot (.mq5), config and a guide. Compile and test on demo.')],
    [L('Opera y registra', 'Trade and log'), L('El bot ejecuta con sus propias reglas y registra cada operación en tu panel.', 'The bot runs with its own rules and logs every trade to your dashboard.')],
  ];
  const faqs = [
    [L('¿Necesito saber programar?', 'Do I need to know how to code?'), L('No. Armas el bot por campos (entrada, stop, TP, riesgo) y Onyx genera el robot listo para MT4, MT5 o cTrader, junto con una guía en PDF paso a paso.', 'No. You build the bot by fields (entry, stop, TP, risk) and Onyx generates the ready robot for MT4, MT5 or cTrader, plus a step-by-step PDF guide.')],
    [L('¿Funciona con mi prop firm?', 'Does it work with my prop firm?'), L('Sí. Defines las reglas de tu reto (pérdida diaria, drawdown, objetivo) y el bot las lleva dentro: se frena solo antes de romperlas. No necesitas activar ningún servicio extra.', 'Yes. You set your challenge rules (daily loss, drawdown, target) and the bot carries them inside: it stops itself before breaking them. No extra service to enable.')],
    [L('¿En qué plataformas corre?', 'Which platforms does it run on?'), L('MetaTrader 4, MetaTrader 5 y cTrader. El mismo constructor genera el archivo correcto para cada una.', 'MetaTrader 4, MetaTrader 5 and cTrader. The same builder generates the correct file for each.')],
    [L('¿Puedo probar sin arriesgar dinero?', 'Can I test without risking money?'), L('Sí. Todo se prueba primero en cuenta demo. Recomendamos validar la estrategia en demo antes de pasar a real.', 'Yes. Everything is tested first on a demo account. We recommend validating the strategy on demo before going live.')],
    [L('¿El bot garantiza ganancias?', 'Does the bot guarantee profit?'), L('No. Ninguna herramienta puede garantizar resultados. Onyx te da control, reglas automáticas y protección, pero el trading siempre conlleva riesgo.', 'No. No tool can guarantee results. Onyx gives you control, automatic rules and protection, but trading always carries risk.')],
  ];
  const reviews: any[] = Array.isArray(stats?.reviews) ? stats.reviews : [];
  // Si existe el plan de bot dedicado ('trader' = "Onyx Bot"), el landing muestra
  // SOLO los planes de bot (Gratis + Onyx Bot) — 2 planes por escala. El resto
  // (Pro/Elite/Black, para trading manual) vive en "ver comparación completa".
  const shown = useMemo(() => {
    if (plans.some((p: any) => p.id === 'trader')) {
      return plans.filter((p: any) => p.id === 'free' || p.id === 'trader');
    }
    return plans;
  }, [plans]);
  // Plan "para bots": si existe el plan dedicado 'trader', ese; si no, el pagado
  // más barato (el de entrada). Solo marca visual en este landing.
  const botPlanId = useMemo(() => {
    if (plans.some((p: any) => p.id === 'trader')) return 'trader';
    const paid = plans.filter((p: any) => p.id !== 'free' && Number(p.price_month) > 0)
      .sort((a: any, b: any) => Number(a.price_month) - Number(b.price_month));
    return paid[0]?.id || '';
  }, [plans]);
  const num = (n: number) => Number(n || 0).toLocaleString();

  return (
    <div className="lpc">
      <style>{`
      .lpc{max-width:1120px;margin:0 auto;padding:8px 0 40px}
      .lpc .hero{text-align:center;padding:44px 0 8px}
      .lpc .chip{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;padding:6px 14px;border-radius:99px;background:rgba(124,140,255,.14);background:color-mix(in srgb,var(--brand) 15%,transparent);border:1px solid color-mix(in srgb,var(--brand) 40%,transparent);color:var(--brand,#5b6cff)}
      .lpc h1{font-size:clamp(30px,5vw,50px);font-weight:800;line-height:1.12;margin:18px 0 0}
      .lpc .grad{background:linear-gradient(90deg,#7c8cff,#12b981);-webkit-background-clip:text;background-clip:text;color:transparent}
      .lpc .sub{color:var(--mut);font-size:clamp(15px,2vw,19px);max-width:620px;margin:16px auto 0}
      .lpc .cta{display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap}
      .lpc .trust{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-top:20px;color:var(--mut);font-size:13px}
      .lpc .trust span{display:inline-flex;align-items:center;gap:6px;color:var(--green)}
      .lpc .pricenote{display:flex;gap:12px;align-items:center;margin:22px auto 0;max-width:760px;padding:14px 16px;border:1px dashed color-mix(in srgb,var(--brand) 45%,transparent);border-radius:12px;background:rgba(124,140,255,.06);background:color-mix(in srgb,var(--brand) 8%,transparent);font-size:13px;color:var(--tx)}
      .lpc .pricenote>span{color:var(--mut)}
      .lpc .sec{padding:44px 0}
      .lpc .eyebrow{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--brand,#5b63d3);font-weight:700}
      .lpc h2{font-size:clamp(24px,3.5vw,34px);font-weight:800;margin-top:10px}
      .lpc .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}
      @media(max-width:820px){.lpc .grid{grid-template-columns:1fr}}
      .lpc .feat .fic{width:44px;height:44px;border-radius:12px;background:rgba(124,140,255,.14);background:color-mix(in srgb,var(--brand) 15%,transparent);display:flex;align-items:center;justify-content:center;color:var(--brand,#5b6cff);margin-bottom:12px}
      .lpc .stepn{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6f77ea,#5b63d3);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;margin-bottom:12px}
      /* Contador y CTA: degradado OSCURO con texto claro (contraste arreglado) */
      .lpc .banner{position:relative;border-radius:18px;padding:30px 20px;text-align:center;background:linear-gradient(135deg,#3a2f7a 0%,#211a45 55%,#141428 100%);border:1px solid rgba(139,147,255,.5);box-shadow:0 24px 60px rgba(30,20,80,.35)}
      .lpc .banner .eyebrow{color:#c8ccff}
      .lpc .counter .big{font-size:clamp(42px,8vw,64px);font-weight:800;letter-spacing:-1px;display:inline-flex;align-items:center;gap:12px;color:#fff;text-shadow:0 0 26px rgba(139,147,255,.55)}
      .lpc .live{font-size:12.5px;margin-top:4px;display:inline-flex;gap:6px;align-items:center;color:#8ff0cf}
      .lpc .live i{width:8px;height:8px;border-radius:50%;background:#5fe0aa;box-shadow:0 0 9px #5fe0aa;display:inline-block}
      .lpc .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:22px}
      @media(max-width:680px){.lpc .metrics{grid-template-columns:1fr 1fr}}
      .lpc .metric{border-radius:14px;padding:18px 10px;text-align:center;border:1px solid rgba(124,140,255,.3);border:1px solid color-mix(in srgb,var(--ac,var(--brand)) 35%,transparent);background:rgba(124,140,255,.08);background:color-mix(in srgb,var(--ac,var(--brand)) 10%,transparent)}
      .lpc .metric b{font-size:26px;font-weight:800;display:block;color:var(--ac,var(--brand))}
      .lpc .metric span{font-size:12px;color:var(--mut)}
      /* Secciones split (constructor / panel EA) */
      .lpc .split{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center;margin-top:26px}
      @media(max-width:820px){.lpc .split{grid-template-columns:1fr}}
      .lpc .li{display:flex;gap:10px;margin-top:12px;font-size:14.5px}
      .lpc .li i{color:#1d9e75;flex:none;font-weight:800}
      .lpc .demo{background:var(--card);border:1px solid rgba(124,140,255,.28);border-radius:16px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.14)}
      .lpc .drow{display:flex;justify-content:space-between;font-size:13.5px;padding:7px 0;border-bottom:1px solid var(--line,rgba(128,128,128,.14))}
      .lpc .drow:last-child{border-bottom:0}
      .lpc .bar{height:8px;border-radius:99px;background:rgba(128,128,128,.18);overflow:hidden;margin:5px 0 12px}
      .lpc .bar i{display:block;height:100%;border-radius:99px}
      /* FAQ */
      .lpc .faq{max-width:760px;margin:26px auto 0}
      .lpc .qa{border:1px solid var(--line,rgba(128,128,128,.16));border-radius:12px;padding:14px 16px;margin-top:10px;background:var(--card);cursor:pointer}
      .lpc .qa .q{display:flex;justify-content:space-between;align-items:center;gap:12px;font-weight:700;font-size:15px}
      .lpc .qa .a{color:var(--mut);font-size:14px;margin-top:9px;line-height:1.6}
      /* Reseñas */
      .lpc .reviews{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:24px}
      @media(max-width:820px){.lpc .reviews{grid-template-columns:1fr}}
      .lpc .rev .revtop{display:flex;align-items:center;justify-content:space-between}
      .lpc .rev .stars{color:#f2c265;font-size:14px;letter-spacing:2px}
      .lpc .rev .staroff{color:var(--line,rgba(128,128,128,.35))}
      .lpc .rev .revdate{font-size:11.5px;color:var(--mut)}
      .lpc .rev .txt{font-size:14px;margin-top:8px;line-height:1.6}
      .lpc .rev .who{font-size:12.5px;color:var(--mut);margin-top:10px;display:flex;align-items:center;gap:8px}
      .lpc .rev .who b{color:var(--tx)}
      .lpc .rev .ava{width:30px;height:30px;border-radius:50%;background:rgba(124,140,255,.16);background:color-mix(in srgb,var(--brand) 18%,transparent);color:var(--brand,#5b6cff);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
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
        <div className="trust">
          <span><OnyxIcon emoji="✅" size={13} /> {L('Sin tarjeta', 'No card')}</span>
          <span><OnyxIcon emoji="✅" size={13} /> {L('Prueba en demo', 'Test on demo')}</span>
          <span><OnyxIcon emoji="✅" size={13} /> {L('Cancela cuando quieras', 'Cancel anytime')}</span>
          <span><OnyxIcon emoji="✅" size={13} /> {L('En español y en inglés', 'Spanish and English')}</span>
        </div>
      </section>

      {/* Contador de robots + métricas */}
      <section className="sec" style={{ paddingTop: 18 }}>
        <div className="banner counter">
          <div className="eyebrow">{L('Robots construidos con Onyx', 'Bots built with Onyx')}</div>
          <div className="big" style={{ marginTop: 6 }}><OnyxIcon emoji="🤖" size={40} /><span>{num(built)}</span></div>
          <div className="live"><i /> {L('subiendo en vivo', 'growing live')}</div>
        </div>
        <div className="metrics">
          <div className="metric" style={{ ['--ac' as any]: 'var(--brand)' }}><b>{num(stats?.botStats?.platforms ?? 3)}</b><span>{L('Plataformas', 'Platforms')}: MT4 · MT5 · cTrader</span></div>
          <div className="metric" style={{ ['--ac' as any]: 'var(--green)' }}><b>{num(stats?.botStats?.opsByBots)}</b><span>{L('Operaciones de bots', 'Bot trades')}</span></div>
          <div className="metric" style={{ ['--ac' as any]: 'var(--amber)' }}><b>{num(stats?.botStats?.strategies)}</b><span>{L('Estrategias generadas', 'Strategies generated')}</span></div>
          <div className="metric" style={{ ['--ac' as any]: 'var(--cyan)' }}><b>{num(stats?.botStats?.traders)}</b><span>{L('Traders creando bots', 'Traders building bots')}</span></div>
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

      {/* Split 1: Constructor */}
      <section className="sec" id="constructor">
        <div className="split">
          <div>
            <span className="eyebrow">{L('Crea tu bot', 'Build a bot')}</span>
            <h2 style={{ marginTop: 8 }}>{L('Diseña estrategias, no líneas de código', 'Design strategies, not lines of code')}</h2>
            <div className="li"><i>✦</i> {L('Entrada, stop y TP por campos — en pips, RR, $ o %.', 'Entry, stop and TP by fields — in pips, RR, $ or %.')}</div>
            <div className="li"><i>✦</i> {L('Reglas de fondeo integradas (pérdida diaria, drawdown, objetivo).', 'Firm rules built in (daily loss, drawdown, target).')}</div>
            <div className="li"><i>✦</i> {L('EA listo y guía en PDF personalizada al instante.', 'Ready EA and a personalized PDF guide instantly.')}</div>
            <div style={{ marginTop: 18 }}><a className="btn btn-primary" href="/login?mode=signup">{L('Arma tu primer bot', 'Build your first bot')} →</a></div>
          </div>
          <div className="demo">
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{L('Constructor', 'Builder')} · EURUSD · H1</div>
            <div className="drow"><span className="muted">{L('Stop loss', 'Stop loss')}</span><span>25 pips</span></div>
            <div className="drow"><span className="muted">{L('Take profit', 'Take profit')}</span><span style={{ color: '#1d9e75', fontWeight: 700 }}>2.0 RR</span></div>
            <div className="drow"><span className="muted">{L('Riesgo por operación', 'Risk per trade')}</span><span>1%</span></div>
            <div className="drow"><span className="muted">{L('Pérdida diaria máx.', 'Max daily loss')}</span><span style={{ color: '#ba7517', fontWeight: 700 }}>4%</span></div>
            <div className="drow"><span className="muted">{L('Sesión', 'Session')}</span><span>Londres + NY</span></div>
          </div>
        </div>
      </section>

      {/* Split 2: Panel del EA / traders */}
      <section className="sec" id="traders">
        <div className="split">
          <div className="demo" style={{ background: 'linear-gradient(180deg,#1b1d27,#141620)', border: '1px solid rgba(139,147,255,.28)', color: '#e7e9f2' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Onyx Bot · FTMO 100K</div>
            <div style={{ fontSize: 11.5, color: '#9aa0b8', margin: '2px 0 12px' }}>{L('Fase 1 · en vivo', 'Phase 1 · live')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d7d9e0' }}><span>{L('Drawdown', 'Drawdown')}</span><span>3.2% / 10%</span></div>
            <div className="bar"><i style={{ width: '32%', background: 'linear-gradient(90deg,#5fe0aa,#54e6d0)' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d7d9e0' }}><span>{L('Objetivo', 'Target')}</span><span>6.1% / 8%</span></div>
            <div className="bar"><i style={{ width: '76%', background: 'linear-gradient(90deg,#6f77ea,#8b93ff)' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#8ff0cf', marginTop: 4 }}><span>● {L('Reglas del reto activas', 'Challenge rules on')}</span><span>{L('Noticias: filtrando', 'News: filtering')}</span></div>
          </div>
          <div>
            <span className="eyebrow">Traders</span>
            <h2 style={{ marginTop: 8 }}>{L('Hecho para pasar retos, no para romperlos', 'Made to pass challenges, not break them')}</h2>
            <div className="li"><i>✦</i> {L('El panel del bot muestra tu firma y el tamaño de tu cuenta.', 'The bot panel shows your firm and account size.')}</div>
            <div className="li"><i>✦</i> {L('Barras de drawdown y objetivo en vivo sobre el gráfico.', 'Live drawdown and target bars right on the chart.')}</div>
            <div className="li"><i>✦</i> {L('El bot se frena solo antes de romper tu reto — sin servicios extra.', 'The bot stops itself before breaking your challenge — no extra services.')}</div>
          </div>
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

      {/* Precios (desde Admin). Mensaje centrado en el bot: pagas por escala, no
          por lo que el bot ya hace solo. Guardian no se le cobra al de bots. */}
      <section className="sec" id="precios">
        <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Precios', 'Pricing')}</span><h2>{L('Paga por escala, no por lo que tu bot ya hace', 'Pay for scale, not for what your bot already does')}</h2>
          <p className="lead" style={{ maxWidth: 620, margin: '12px auto 0' }}>{L('El bot trae protección, noticias y sesión adentro. Solo pagas por construir más bots y registrar más cuentas.', 'The bot carries protection, news and session inside. You only pay to build more bots and register more accounts.')}</p>
          <div style={{ display: 'inline-flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
            <button className={'btn btn-ghost' + (!annual ? ' btn-primary' : '')} style={{ padding: '6px 14px' }} onClick={() => setAnnual(false)}>{L('Mensual', 'Monthly')}</button>
            <button className={'btn btn-ghost' + (annual ? ' btn-primary' : '')} style={{ padding: '6px 14px' }} onClick={() => setAnnual(true)}>{L('Anual', 'Annual')}</button>
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          {shown.length > 0
            ? <PlanCards plans={shown} lang={es ? 'es' : 'en'} annual={annual} botTagId={botPlanId} onChoose={(id: string, price: number) => { window.location.href = (price > 0 && id && id !== 'free') ? `/login?mode=signup&plan=${id}${annual ? '&annual=1' : ''}` : '/login?mode=signup'; }} />
            : <p className="muted" style={{ textAlign: 'center' }}>{L('Cargando planes…', 'Loading plans…')}</p>}
          <div className="pricenote">
            <OnyxIcon emoji="🤖" size={18} />
            <span>{L('Si solo quieres bots, el plan de entrada te basta: tu robot ya se frena solo, filtra noticias y respeta tu sesión. Onyx Guardian es un extra para quien también opera manual — no se le cobra al que usa bots.', 'If you only want bots, the entry plan is enough: your robot stops itself, filters news and respects your session. Onyx Guardian is an extra for those who also trade manually — bot users are not charged for it.')}</span>
          </div>
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}><a href="/pricing" style={{ color: 'var(--brand,#5b63d3)' }}>{L('Ver comparación completa de planes', 'See full plan comparison')} →</a></p>
        </div>
      </section>

      {/* Reseñas (editables desde Admin → Módulos). Si no hay, se oculta. */}
      {reviews.length > 0 && (
        <section className="sec" id="resenas">
          <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Lo que dicen', 'What people say')}</span><h2>{L('Traders que ya operan con Onyx', 'Traders already using Onyx')}</h2></div>
          <div className="reviews">
            {reviews.slice(0, 9).map((r: any, i: number) => {
              const name = String(r.name || r.n || '');
              const text = String(r.text || r.t || '');
              const meta = String(r.result || r.r || '');
              const date = String(r.date || '');
              const st = Math.max(1, Math.min(5, Number(r.stars || 5)));
              return (
                <div key={i} className="card rev">
                  <div className="revtop"><span className="stars">{'★'.repeat(st)}<span className="staroff">{'★'.repeat(5 - st)}</span></span>{date && <span className="revdate">{date}</span>}</div>
                  <div className="txt">“{text}”</div>
                  <div className="who"><span className="ava">{(name[0] || '?').toUpperCase()}</span><span><b>{name}</b>{meta ? ` · ${meta}` : ''}</span></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="sec" id="faq">
        <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Preguntas', 'Questions')}</span><h2>{L('Lo que suelen preguntar', 'What people usually ask')}</h2></div>
        <div className="faq">
          {faqs.map(([q, a], i) => (
            <div key={i} className="qa" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
              <div className="q"><span>{q}</span><span style={{ color: 'var(--brand,#5b63d3)', flex: 'none' }}>{faqOpen === i ? '−' : '+'}</span></div>
              {faqOpen === i && <div className="a">{a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="sec">
        <div className="banner" style={{ padding: '40px 24px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>{L('Tu próximo reto, mejor protegido', 'Your next challenge, better protected')}</h2>
          <p style={{ maxWidth: 520, margin: '12px auto 0', color: '#dfe1ff', fontSize: 15 }}>{L('Crea tu primer bot gratis y deja que Onyx cuide tu cuenta mientras operas.', 'Create your first bot free and let Onyx protect your account while you trade.')}</p>
          <div style={{ marginTop: 22 }}><a className="btn" href="/login?mode=signup" style={{ padding: '14px 26px', fontSize: 16, background: '#fff', color: '#2c2569', fontWeight: 800 }}>{L('Empezar gratis', 'Start free')} →</a></div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, textAlign: 'center', maxWidth: 780, margin: '18px auto 0', lineHeight: 1.6 }}>{L('Aviso de riesgo: el trading conlleva riesgo y puede no ser adecuado para todos. Los resultados pasados no garantizan resultados futuros. Onyx es una herramienta de software; no es asesoría financiera ni garantiza rentabilidad. Prueba todo en demo antes de real.', 'Risk notice: trading carries risk and may not be suitable for everyone. Past results do not guarantee future results. Onyx is a software tool; not financial advice and no profit guarantee. Test everything on demo before going live.')}</p>
      </section>
    </div>
  );
}
