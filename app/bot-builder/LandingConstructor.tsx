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
    [L('¿Necesito saber programar?', 'Do I need to know how to code?'), L('No, para nada. Armas el bot eligiendo opciones en tarjetas: qué par opera, cómo entra, dónde pone el stop y el take profit, cuánto arriesga y las reglas de tu fondeo. Al terminar, Onyx genera el robot listo (.mq5, .mq4 o .cs) y una guía en PDF con capturas para instalarlo paso a paso.', 'Not at all. You build the bot by picking options on cards: which pair it trades, how it enters, where it puts the stop and take profit, how much it risks and your firm rules. When you finish, Onyx generates the ready robot (.mq5, .mq4 or .cs) and a PDF guide with screenshots to install it step by step.')],
    [L('¿Cómo instalo el robot y lo pongo a operar?', 'How do I install the robot and get it trading?'), L('Descargas el archivo, lo abres en MetaTrader (MetaEditor → Compilar) o en cTrader (Automate → Build), lo arrastras al gráfico de tu par y pegas tu clave Onyx. Listo. La guía PDF personalizada de cada robot te lleva por cada paso, incluidas las URLs que hay que permitir en MetaTrader.', 'You download the file, open it in MetaTrader (MetaEditor → Compile) or cTrader (Automate → Build), drag it onto your pair chart and paste your Onyx key. Done. Each robot\'s personalized PDF guide walks you through every step, including the URLs to allow in MetaTrader.')],
    [L('¿Para qué sirve la clave Onyx y de dónde sale?', 'What is the Onyx key for and where does it come from?'), L('Es tu licencia personal: el robot la pide para activarse (en demo y en real) y así nadie puede revender tu bot. La sacas en Conectar cuenta; cada clave queda atada a un número de cuenta y el sistema la verifica al arrancar.', 'It\'s your personal license: the robot needs it to activate (on demo and live) so nobody can resell your bot. You get it in Connect account; each key is tied to an account number and the system verifies it on start.')],
    [L('¿Funciona con mi prop firm (FTMO, etc.)?', 'Does it work with my prop firm (FTMO, etc.)?'), L('Sí. Defines las reglas de tu reto —pérdida diaria, drawdown total, objetivo de fase— y el bot las lleva dentro: se frena solo antes de romperlas, con frenos suave, duro y total por debajo del límite del firm. No necesitas activar ningún servicio extra.', 'Yes. You set your challenge rules —daily loss, total drawdown, phase target— and the bot carries them inside: it stops itself before breaking them, with soft, hard and total brakes below the firm limit. No extra service to enable.')],
    [L('¿En qué plataformas corre?', 'Which platforms does it run on?'), L('MetaTrader 4, MetaTrader 5 y cTrader. El mismo constructor genera el archivo correcto para cada una, y el robot encuentra tu símbolo aunque tu broker use otro nombre o sufijo (GOLD, XAUUSD.m, etc.).', 'MetaTrader 4, MetaTrader 5 and cTrader. The same builder generates the correct file for each, and the robot finds your symbol even if your broker uses another name or suffix (GOLD, XAUUSD.m, etc.).')],
    [L('¿Puedo probar sin arriesgar dinero?', 'Can I test without risking money?'), L('Sí, y lo recomendamos. Todo se prueba primero en cuenta demo. En el módulo Mis robots verás los KPIs de cada robot (PF, aciertos, drawdown), un estado “Listo para vivo” con criterios de graduación, y podrás pasarlo a real con un clic cuando estés seguro.', 'Yes, and we recommend it. Everything is tested first on a demo account. In the My robots module you\'ll see each robot\'s KPIs (PF, win rate, drawdown), a “Ready for live” status with graduation criteria, and you can promote it to live in one click when you\'re confident.')],
    [L('¿Dónde veo cómo va cada robot?', 'Where do I see how each robot is doing?'), L('En Mis robots: cada cuenta es una tarjeta con su neto, mejor y peor bot y diversificación; entras y ves los KPIs por robot y sus métricas avanzadas (Sharpe, Sortino, Monte Carlo, walk-forward). Además hay un Laboratorio de portafolio para combinar robots y ver su correlación.', 'In My robots: each account is a card with its net, best and worst bot and diversification; you enter and see per-robot KPIs and advanced metrics (Sharpe, Sortino, Monte Carlo, walk-forward). There\'s also a Portfolio lab to combine robots and see their correlation.')],
    [L('¿Cuántos robots y cuentas puedo tener?', 'How many robots and accounts can I have?'), L('En Gratis creas 1 robot y conectas 1 cuenta. En Trader los robots son ilimitados y conectas hasta 3 cuentas. En Black Onyx, cuentas ilimitadas. Puedes ver el detalle en la tabla comparativa de arriba.', 'On Free you create 1 robot and connect 1 account. On Trader robots are unlimited and you connect up to 3 accounts. On Black Onyx, unlimited accounts. See the details in the comparison table above.')],
    [L('¿Puedo cambiar de plan o cancelar cuando quiera?', 'Can I change plan or cancel anytime?'), L('Sí. Subes o bajas de plan cuando quieras desde tu cuenta; los cambios se aplican según tu ciclo de cobro y no pierdes tu historial ni tus robots creados.', 'Yes. You upgrade or downgrade anytime from your account; changes apply according to your billing cycle and you don\'t lose your history or created robots.')],
    [L('¿El bot garantiza ganancias?', 'Does the bot guarantee profit?'), L('No. Ninguna herramienta puede garantizar resultados. Onyx te da control, reglas automáticas y protección, pero el trading siempre conlleva riesgo. Prueba en demo, opera con responsabilidad y usa solo capital que puedas permitirte arriesgar.', 'No. No tool can guarantee results. Onyx gives you control, automatic rules and protection, but trading always carries risk. Test on demo, trade responsibly and only use capital you can afford to risk.')],
  ];
  const allReviews: any[] = Array.isArray(stats?.reviews) ? stats.reviews : [];
  // Muestra reseñas del idioma actual; si hay pocas, completa con el resto.
  const curLang = es ? 'es' : 'en';
  const langReviews = allReviews.filter((r: any) => (r?.lang || 'es') === curLang);
  const reviews: any[] = langReviews.length >= 3 ? langReviews : allReviews;
  const rsum = stats?.reviewSummary || { total: 0, avg: 0, byStar: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 } };
  // Código de país ISO2 → emoji bandera (indicadores regionales).
  const flag = (cc: string) => {
    const c = String(cc || '').trim().toUpperCase();
    if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return '';
    return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
  };
  // Si existe el plan de bot dedicado ('trader' = "Onyx Bot"), el landing muestra
  // SOLO los planes de bot (Gratis + Onyx Bot) — 2 planes por escala. El resto
  // (Pro/Elite/Black, para trading manual) vive en "ver comparación completa".
  const shown = useMemo(() => {
    // Id del plan dedicado a bots. Prioriza 'bots', luego 'trader', y si no,
    // el plan de pago más barato (Onyx Builder es el de entrada).
    const botId = plans.some((p: any) => p.id === 'bots') ? 'bots'
      : plans.some((p: any) => p.id === 'trader') ? 'trader'
      : (plans.filter((p: any) => p.id !== 'free' && Number(p.price_month) > 0)
          .sort((a: any, b: any) => Number(a.price_month) - Number(b.price_month))[0]?.id || '');
    // En el landing de "crea tu robot" solo mostramos DOS planes: Gratis (para
    // empezar) y el plan de bots (Onyx Builder). Los demás planes viven en el
    // home / pricing; aquí sobran y distraen del gancho del constructor.
    const base = plans.filter((p: any) => p.id === 'free' || p.id === botId);
    // En el landing de bots, el plan Gratis debe dejar clarísimo el gancho: puedes
    // CREAR Y CONECTAR 1 robot gratis. Lo forzamos como primera viñeta (y ajustamos
    // el subtítulo al mensaje del constructor) sin tocar lo que el admin configuró.
    return base.map((p: any) => {
      // Plan de bots: subtítulo que ancla el valor concreto (no un lema vago).
      if (botId && p.id === botId) {
        return { ...p, desc_es: p.desc_es || 'Robots ilimitados para automatizar', desc_en: p.desc_en || 'Unlimited robots to automate' };
      }
      if (p.id !== 'free') return p;
      const leadEs = 'Crea y conecta 1 robot';
      const leadEn = 'Build & connect 1 robot';
      const has = (arr: any[]) => Array.isArray(arr) && arr.some((f) => String(f).toLowerCase().includes('robot') || String(f).toLowerCase().includes('bot'));
      const fEs = Array.isArray(p.features) ? p.features.slice() : [];
      const fEn = Array.isArray(p.features_en) ? p.features_en.slice() : [];
      return {
        ...p,
        desc_es: 'Construye tu primer robot gratis',
        desc_en: 'Build your first robot free',
        features: has(fEs) ? fEs : [leadEs, ...fEs],
        features_en: has(fEn) ? fEn : [leadEn, ...fEn],
      };
    });
  }, [plans]);
  // Plan "para bots": el plan dedicado ('bots' o 'trader') si existe; si no, el
  // pagado más barato (el de entrada). Solo es una marca visual en este landing.
  const botPlanId = useMemo(() => {
    if (plans.some((p: any) => p.id === 'bots')) return 'bots';
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
      /* Reseñas: resumen + carrusel */
      .lpc .revsum{display:flex;gap:26px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:560px;margin:20px auto 6px}
      .lpc .revavg{text-align:center}
      .lpc .revavg .n{font-size:42px;font-weight:800;line-height:1;color:var(--tx)}
      .lpc .revavg .stars{color:#f2c265;letter-spacing:2px;font-size:14px;margin-top:4px}
      .lpc .revbars{display:grid;gap:6px;min-width:240px;flex:1;max-width:320px}
      .lpc .revbarrow{display:flex;align-items:center;gap:8px;font-size:12px}
      .lpc .revbarrow .k{color:var(--mut);width:24px}
      .lpc .revbarrow .v{color:var(--mut);width:34px;text-align:right}
      .lpc .revbar{flex:1;height:8px;border-radius:99px;background:rgba(128,128,128,.18);overflow:hidden}
      .lpc .revbar>i{display:block;height:100%;background:#f2c265}
      /* Bucle infinito perfecto: la pista tiene el contenido DUPLICADO y se mueve
         exactamente -50% (una copia). La separación va como margin-right en cada
         tarjeta (no gap) para que el -50% caiga justo al inicio de la 2ª copia. */
      @keyframes lpcscroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
      .lpc .revmask{overflow:hidden;margin-top:22px;width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
      .lpc .revtrack{display:flex;width:max-content;animation:lpcscroll 60s linear infinite;will-change:transform}
      .lpc .revmask:hover .revtrack{animation-play-state:paused}
      .lpc .revcard{width:320px;flex:none;margin-right:14px}
      @media(max-width:520px){.lpc .revcard{width:260px;margin-right:12px}}
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
            ? <PlanCards plans={shown} lang={es ? 'es' : 'en'} annual={annual} botTagId={botPlanId}
                freeLabel={L('Crear mi primer robot', 'Build my first robot')}
                trust
                anchors={botPlanId ? { [botPlanId]: { es: 'Menos que un café a la semana · un robot a medida cuesta $300+', en: 'Less than a weekly coffee · a custom bot costs $300+' } } : undefined}
                onChoose={(id: string, price: number) => { window.location.href = (price > 0 && id && id !== 'free') ? `/login?mode=signup&plan=${id}${annual ? '&annual=1' : ''}` : '/login?mode=signup'; }} />
            : <p className="muted" style={{ textAlign: 'center' }}>{L('Cargando planes…', 'Loading plans…')}</p>}
          {/* Comparación de 3 niveles: todo lo del Bot Builder, fila por fila.
              Se dibuja desde la matriz editable en Admin (stats.botPlanMatrix +
              stats.botCapMeta). Si aún no cargó, cae a los defaults de aquí. */}
          {(() => {
            // Precio por tier: primero busca el plan real (por id o alias), luego un default.
            const prc = (ids: string[], def: number) => {
              const p = plans.find((pl: any) => ids.includes(String(pl.id)));
              return p ? (annual ? Number(p.price_year) : Number(p.price_month)) : def;
            };
            const priceFor = (id: string): number => {
              const k = String(id).toLowerCase();
              if (k === 'free') return 0;
              if (k === 'trader') return prc(['trader'], 15);
              if (['black', 'black_onyx', 'blackonyx'].includes(k)) return prc(['black', 'black_onyx', 'blackonyx'], annual ? 390 : 39);
              return prc([id], 0);
            };
            // Matriz desde Admin (con fallback a los defaults estáticos bilingües).
            const mtx: any = stats?.botPlanMatrix;
            const meta: any[] = Array.isArray(stats?.botCapMeta) ? stats.botCapMeta : [];
            const DEF_TIERS = [
              { id: 'free', es: 'Gratis', en: 'Free' },
              { id: 'trader', es: 'Trader', en: 'Trader' },
              { id: 'black', es: 'Black Onyx', en: 'Black Onyx' },
            ];
            const mtxTiers: any[] = (mtx?.tiers && Array.isArray(mtx.tiers) && mtx.tiers.length) ? mtx.tiers : DEF_TIERS;
            // El tier del medio (índice 1) se resalta como "popular".
            const hiId = mtxTiers[1]?.id;
            const tiers = mtxTiers.slice(0, 3).map((t: any) => ({ id: t.id, name: es ? t.es : (t.en || t.es), price: priceFor(t.id), hi: t.id === hiId }));
            const CH = <OnyxIcon name="check" size={13} glow={false} />;
            // Filas: desde botCapMeta si viene; si no, las estáticas de respaldo.
            const DEF_ROWS: { es: string; en: string; vals: any[] }[] = [
              { es: 'Robots que creas', en: 'Robots you create', vals: ['1', '∞', '∞'] },
              { es: 'Cuentas conectadas', en: 'Connected accounts', vals: ['1', '3', '∞'] },
              { es: 'Plataformas MT4 · MT5 · cTrader', en: 'Platforms MT4 · MT5 · cTrader', vals: [true, true, true] },
              { es: 'Gatillos, salidas, riesgo y frenos', en: 'Triggers, exits, risk & brakes', vals: [true, true, true] },
              { es: 'Reglas de fondeo + candado de activación', en: 'Firm rules + activation lock', vals: [true, true, true] },
              { es: 'Múltiples sesiones y días operables', en: 'Multiple sessions & trading days', vals: [true, true, true] },
              { es: 'Filtro de noticias integrado', en: 'Built-in news filter', vals: [true, true, true] },
              { es: 'Guía PDF personalizada + plantillas', en: 'Personalized PDF guide + templates', vals: [true, true, true] },
              { es: 'Descarga del EA (.mq5/.mq4/.cs) + .set', en: 'EA download (.mq5/.mq4/.cs) + .set', vals: [true, true, true] },
              { es: 'Mis robots: KPIs, pruebas vs vivo, graduación', en: 'My robots: KPIs, testing vs live, graduation', vals: [true, true, true] },
              { es: 'Registro automático de operaciones', en: 'Automatic trade logging', vals: [true, true, true] },
              { es: 'Historial de operaciones', en: 'Trade history', vals: [es ? '30 días' : '30 days', es ? 'completo' : 'full', es ? 'completo' : 'full'] },
              { es: 'Métricas avanzadas (Sharpe, Monte Carlo, walk-forward)', en: 'Advanced metrics (Sharpe, Monte Carlo, walk-forward)', vals: [false, true, true] },
              { es: 'Laboratorio de portafolio + correlación + sugerencias', en: 'Portfolio lab + correlation + suggestions', vals: [false, true, true] },
              { es: 'Copy trading incluido', en: 'Copy trading included', vals: [false, false, true] },
              { es: 'Soporte prioritario', en: 'Priority support', vals: [false, false, true] },
            ];
            const rows: { label: string; vals: any[] }[] = (meta.length && mtx?.caps)
              ? meta.map((m: any) => ({ label: es ? m.es : (m.en || m.es), vals: tiers.map((tr: any) => mtx.caps?.[m.key]?.[tr.id]) }))
              : DEF_ROWS.map((r) => ({ label: es ? r.es : r.en, vals: r.vals }));
            const cell = (v: any) => v === true ? CH : (v === false || v == null || v === '') ? <span style={{ color: 'var(--mut)' }}>—</span> : <span style={{ fontSize: 12.5 }}>{String(v)}</span>;
            const go = (id: string, price: number) => { window.location.href = (price > 0 && id !== 'free') ? `/login?mode=signup&plan=${id}${annual ? '&annual=1' : ''}` : '/login?mode=signup'; };
            return (
              <div style={{ maxWidth: 760, margin: '26px auto 0', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: 'var(--card)' }}>
                <div style={{ textAlign: 'center', padding: '12px 14px 4px', fontWeight: 700, fontSize: 14 }}>{L('Todo lo que trae el Bot Builder', 'Everything the Bot Builder includes')}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={{ textAlign: 'left', padding: '10px 14px' }}></th>
                      {tiers.map((tr: any) => (
                        <th key={tr.id} style={{ padding: '10px 8px', textAlign: 'center', width: 108, background: tr.hi ? 'color-mix(in srgb, var(--gold, #e8b923) 14%, transparent)' : 'transparent' }}>
                          <div style={{ fontWeight: 800, color: tr.hi ? 'var(--gold, #e8b923)' : 'var(--tx)' }}>{tr.name}</div>
                          <div style={{ fontSize: 15, fontWeight: 800 }}>${tr.price}<span className="muted" style={{ fontSize: 10 }}>/{annual ? (es ? 'año' : 'yr') : (es ? 'mes' : 'mo')}</span></div>
                        </th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '9px 14px', color: 'var(--tx)' }}>{r.label}</td>
                          {tiers.map((tr: any, ci: number) => (
                            <td key={tr.id} style={{ padding: '9px 8px', textAlign: 'center', background: tr.hi ? 'color-mix(in srgb, var(--gold, #e8b923) 9%, transparent)' : 'transparent' }}>{cell(r.vals[ci])}</td>
                          ))}
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '12px 14px' }}></td>
                        {tiers.map((tr: any) => (
                          <td key={tr.id} style={{ padding: '10px 8px', textAlign: 'center', background: tr.hi ? 'color-mix(in srgb, var(--gold, #e8b923) 9%, transparent)' : 'transparent' }}>
                            <button className={'btn ' + (tr.hi ? '' : 'btn-ghost')} style={tr.hi ? { fontSize: 11.5, padding: '6px 10px', width: '100%', background: 'var(--gold, #e8b923)', color: '#3a2a06', border: 'none', fontWeight: 800 } : { fontSize: 11.5, padding: '6px 10px', width: '100%' }} onClick={() => go(tr.id, tr.price)}>{tr.price === 0 ? L('Empezar', 'Start') : L('Elegir', 'Choose')}</button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          <div className="pricenote">
            <OnyxIcon emoji="🤖" size={18} />
            <span>{L('Si solo quieres bots, el plan de entrada te basta: tu robot ya se frena solo, filtra noticias y respeta tu sesión. Onyx Guardian es un extra para quien también opera manual — no se le cobra al que usa bots.', 'If you only want bots, the entry plan is enough: your robot stops itself, filters news and respects your session. Onyx Guardian is an extra for those who also trade manually — bot users are not charged for it.')}</span>
          </div>
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}><a href="/pricing" style={{ color: 'var(--brand,#5b63d3)' }}>{L('Ver comparación completa de planes', 'See full plan comparison')} →</a></p>
        </div>
      </section>

      {/* Reseñas: resumen (promedio + total + por estrella) + carrusel en movimiento
          (derecha→izquierda), con bandera por país. Editables desde Admin. */}
      {reviews.length > 0 && (
        <section className="sec" id="resenas">
          <div style={{ textAlign: 'center' }}><span className="eyebrow">{L('Lo que dicen', 'What people say')}</span><h2>{L('Traders que ya operan con Onyx', 'Traders already using Onyx')}</h2></div>

          {/* Resumen de valoraciones */}
          {rsum.total > 0 && (
            <div className="revsum">
              <div className="revavg">
                <div className="n">{Number(rsum.avg || 0).toFixed(1)}</div>
                <div className="stars">{'★'.repeat(Math.round(rsum.avg))}<span className="staroff">{'★'.repeat(5 - Math.round(rsum.avg))}</span></div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{Number(rsum.total).toLocaleString()} {L('reseñas', 'reviews')}</div>
              </div>
              <div className="revbars">
                {[5, 4, 3, 2, 1].map((s) => {
                  const n = Number(rsum.byStar?.[String(s)] || 0);
                  const pct = rsum.total ? Math.round((n / rsum.total) * 100) : 0;
                  return (
                    <div key={s} className="revbarrow"><span className="k">{s}★</span><span className="revbar"><i style={{ width: pct + '%' }} /></span><span className="v">{n}</span></div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Carrusel en movimiento (duplicado para bucle sin cortes; pausa al pasar el mouse) */}
          <div className="revmask">
            {(() => {
              // Base con suficientes tarjetas para llenar pantallas anchas; luego se
              // DUPLICA para el bucle (-50%). Así nunca queda hueco a la derecha.
              let base = reviews;
              while (base.length && base.length < 8) base = [...base, ...reviews];
              // La DURACIÓN escala con el nº de tarjetas por copia → velocidad en pantalla
              // constante y suave, aunque haya muchas reseñas (no se acelera).
              const dur = Math.min(240, Math.max(40, Math.round(base.length * 5)));
              return (
            <div className="revtrack" style={{ animationDuration: `${dur}s` }}>
              {[...base, ...base].map((r: any, i: number) => {
                const name = String(r.name || '');
                const text = String(r.text || '');
                const meta = String(r.result || '');
                const date = String(r.date || '');
                const fl = flag(r.country || '');
                const st = Math.max(1, Math.min(5, Number(r.stars || 5)));
                return (
                  <div key={i} className="card rev revcard">
                    <div className="revtop"><span className="stars">{'★'.repeat(st)}<span className="staroff">{'★'.repeat(5 - st)}</span></span>{date && <span className="revdate">{date}</span>}</div>
                    <div className="txt">“{text}”</div>
                    <div className="who"><span className="ava">{(name[0] || '?').toUpperCase()}</span><span>{fl ? fl + ' ' : ''}<b>{name}</b>{meta ? ` · ${meta}` : ''}</span></div>
                  </div>
                );
              })}
            </div>
              );
            })()}
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
