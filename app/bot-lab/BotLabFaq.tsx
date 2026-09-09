'use client';
import { useState } from 'react';
import { useLang } from '@/lib/lang';

// FAQ de Onyx Bot Lab, por categorías (comprar / vender / servicios / pagos / seguridad).
// Bilingüe. Acordeón con <details> (funciona aunque tarde el JS).
type QA = { q: string; a: string };
type Cat = { id: string; label: string; items: QA[] };

const DATA_ES: Cat[] = [
  { id: 'comprar', label: 'Comprar robots', items: [
    { q: '¿En qué se diferencia Bot Lab de "Crea tu bot"?', a: '"Crea tu bot" es el CONSTRUCTOR: armas tu propio robot paso a paso, sin código, y lo descargas listo para instalar. Es para quien quiere su estrategia hecha a su medida. Bot Lab es el MARKETPLACE: compras robots ya hechos por traders verificados (o los vendes), sin construir nada. Es para quien quiere resultados rápidos sin armar. Ambos se conectan: un robot que creas en el constructor, cuando tiene historial real, lo puedes publicar en Bot Lab y cobrar a otros.' },
    { q: '¿Qué es un robot y qué recibo al comprarlo?', a: 'Un robot (o EA/cBot) es un programa que opera por ti siguiendo reglas fijas. Al comprarlo obtienes una licencia: descargas el archivo para tu plataforma (MT4, MT5 o cTrader), lo instalas con la guía y empieza a operar en tu cuenta.' },
    { q: '¿Puedo probarlo antes de arriesgar dinero?', a: 'Sí. Recomendamos siempre correrlo primero en cuenta demo. Cada robot muestra su Onyx Score, su rendimiento de 90 días y su drawdown para que decidas con datos, no con promesas.' },
    { q: '¿Cómo se paga?', a: 'En USDT (TRON o Ethereum): sin bancos, sin tarjetas y sin contracargos. La mayoría de robots son de pago único; el precio se ve claro antes de pagar. Activamos tu robot en cuanto confirmamos el pago en la blockchain.' },
    { q: '¿Funciona con mi bróker?', a: 'El robot detecta solo el sufijo de tu símbolo y se adapta a la mayoría de brókers de MT4, MT5 y cTrader. En la ficha de cada robot ves con qué plataformas es compatible.' },
    { q: '¿Dónde veo los robots que compré?', a: 'En tu panel, dentro de Bot Lab → "Mis robots". Ahí tienes la descarga y el estado (activo, pendiente, cancelado) de cada licencia.' },
  ] },
  { id: 'vender', label: 'Vender los tuyos', items: [
    { q: '¿Qué robots puedo vender y cómo los publico?', a: 'Los robots que creas en el constructor ("Crea tu bot"). Cuando uno acumula historial real, tocas "Vender" y se abre el formulario con el robot ya elegido. Un chequeo te dice si ya cumple (operaciones, Stop Loss, sin martingala ni alta frecuencia). Si cumple todo, se publica solo al instante en el Marketplace; si le falta, te avisa antes. Onyx genera el archivo protegido (con candado) para MT5, MT4 y cTrader al momento de cada compra.' },
    { q: '¿Cuánto gano y cuánto se queda Onyx?', a: 'Tú te quedas el 80% de cada venta; Onyx retiene una comisión (por defecto 20%, editable). Nosotros procesamos el cobro y te depositamos: no manejas pagos ni tarjetas.' },
    { q: '¿Cuándo y cómo me pagan?', a: 'Cuando juntas al menos $10 disponibles, pides tu retiro desde el panel. Te pagamos a tu cuenta bancaria (Stripe) o en USDT, como prefieras.' },
    { q: '¿Cómo se verifica mi rendimiento?', a: 'Con el Onyx Score: evalúa tu operativa real (disciplina, riesgo y KPIs). Un robot con track record verificado vende más porque el comprador confía en el dato.' },
    { q: '¿Cómo cobro mis ventas?', a: 'En USDT. Cuando juntas al menos $10 disponibles, pides tu retiro desde el panel (Bot Lab → Ganancias) e indicas tu dirección de wallet. Tú te quedas el 80% de cada venta y Onyx procesa el cobro: no manejas tarjetas ni pagos.' },
  ] },
  { id: 'servicios', label: 'Servicios a medida', items: [
    { q: '¿Qué es "Automatiza tu estrategia"?', a: 'Es nuestro servicio llave en mano: tú nos explicas cómo operas y nosotros construimos el robot a medida, lo probamos con backtest y cuenta demo, y lo dejamos operando en tu cuenta.' },
    { q: '¿Cuánto cuesta y cuánto tarda?', a: 'Los proyectos a medida arrancan desde un precio base y varían según la complejidad. La entrega promedio es de unos 3 días. Te damos un presupuesto sin compromiso al describir tu estrategia.' },
    { q: '¿Qué incluye la instalación asistida?', a: 'Un experto se conecta contigo por control remoto e instala y configura tus robots en vivo, contigo mirando. Ideal si no quieres pelear con la instalación.' },
    { q: '¿Y el plan Elite?', a: 'Desarrollo privado + optimización continua + VPS dedicado + monitoreo 24/7 con soporte por retainer mensual. Para quien quiere todo gestionado.' },
    { q: '¿Cómo empiezo?', a: 'Llena el formulario "Solicita tu propuesta" en Servicios. Recibimos tu solicitud, te contactamos y coordinamos una llamada estratégica para entender tu operativa.' },
  ] },
  { id: 'pagos', label: 'Pagos y USDT', items: [
    { q: '¿Cómo pago con USDT?', a: 'Eliges "USDT" al comprar y la red (TRON o Ethereum). Te mostramos la dirección de wallet, envías el monto y el sistema confirma el pago en la blockchain. Activamos tu robot en cuanto se confirma (normalmente en minutos).' },
    { q: '¿Es seguro pagar en cripto aquí?', a: 'Sí. Activamos tu robot en cuanto verificamos el pago en la blockchain. Nunca te pedimos las claves de tu wallet: tú mismo envías el pago desde la tuya.' },
    { q: '¿Qué métodos aceptan?', a: 'USDT (TRON · Ethereum): sin bancos ni tarjetas y sin contracargos. Los creadores cobran sus ganancias también en USDT.' },
    { q: '¿Emiten factura?', a: 'Sí, los pagos con tarjeta generan comprobante. Para pagos en USDT queda el registro de la transacción con su hash.' },
  ] },
  { id: 'seguridad', label: 'Seguridad', items: [
    { q: '¿El trading con robots tiene riesgo?', a: 'Sí. Ningún robot garantiza ganancias y los resultados pasados no aseguran resultados futuros. Por eso mostramos el riesgo (drawdown) de cada uno y recomendamos siempre probar en demo primero.' },
    { q: '¿Cómo sé que un robot no es un fraude?', a: 'Solo se publica un robot que cumple reglas medidas con sus operaciones REALES: mínimo de operaciones, Stop Loss obligatorio, sin martingala ni alta frecuencia. Cada uno muestra su Onyx Score con datos reales y los vendedores verificados llevan un sello. Aun así, invierte solo lo que puedas permitirte arriesgar.' },
    { q: '¿Mis datos y mi cuenta están protegidos?', a: 'Es tu misma cuenta segura de Onyx. Bot Lab no pide las credenciales de tu bróker ni de tu wallet: el robot opera con la conexión que tú autorizas.' },
  ] },
];

const DATA_EN: Cat[] = [
  { id: 'comprar', label: 'Buying robots', items: [
    { q: 'How is Bot Lab different from "Build a bot"?', a: '"Build a bot" is the BUILDER: you assemble your own robot step by step, no code, and download it ready to install — for those who want a strategy tailored to them. Bot Lab is the MARKETPLACE: you buy ready-made robots from verified traders (or sell yours), no building — for those who want fast results without assembling. They connect: a robot you build, once it has a real track record, you can list it on Bot Lab and charge others.' },
    { q: 'What is a robot and what do I get when I buy one?', a: 'A robot (or EA/cBot) is a program that trades for you following fixed rules. When you buy it you get a license: download the file for your platform (MT4, MT5 or cTrader), install it with the guide and it starts trading in your account.' },
    { q: 'Can I test it before risking money?', a: 'Yes. We always recommend running it on a demo account first. Every robot shows its Onyx Score, 90-day performance and drawdown so you decide with data, not promises.' },
    { q: 'How do I pay?', a: 'In USDT (TRON or Ethereum): no banks, no cards and no chargebacks. Most robots are a one-time purchase; the price is clear before you pay. We activate your robot as soon as the payment confirms on-chain.' },
    { q: 'Does it work with my broker?', a: 'The robot detects your symbol suffix on its own and adapts to most MT4, MT5 and cTrader brokers. Each robot page shows which platforms it supports.' },
    { q: 'Where do I see the robots I bought?', a: 'In your panel, under Bot Lab → "My robots". You get the download and status (active, pending, canceled) of each license.' },
  ] },
  { id: 'vender', label: 'Selling yours', items: [
    { q: 'What robots can I sell and how do I publish them?', a: 'The robots you create in the builder ("Build a bot"). Once one has a real track record, you hit "Sell" and the form opens with that robot already picked. A quick check tells you if it qualifies (number of trades, Stop Loss, no martingale or high frequency). If it passes everything, it publishes itself instantly in the Marketplace; if something is missing, it tells you first. Onyx generates the protected (locked) file for MT5, MT4 and cTrader at the moment of each purchase.' },
    { q: 'How much do I earn and how much does Onyx keep?', a: 'You keep 80% of each sale; Onyx keeps a commission (20% by default, editable). We process the payment and pay you out: you never handle cards or payments.' },
    { q: 'How is my performance verified?', a: 'With the Onyx Score: it grades your real trading (discipline, risk and KPIs). A robot with a verified track record sells more because buyers trust the data.' },
    { q: 'How do I collect my sales?', a: 'In USDT. Once you have at least $10 available, request your payout from the panel (Bot Lab → Earnings) and enter your wallet address. You keep 80% of each sale and Onyx processes the payment: you never handle cards or payments.' },
  ] },
  { id: 'servicios', label: 'Bespoke services', items: [
    { q: 'What is "Automate your strategy"?', a: 'Our turnkey service: you explain how you trade and we build the bespoke robot, test it with backtest and demo, and leave it running in your account.' },
    { q: 'How much and how long?', a: 'Bespoke projects start from a base price and vary with complexity. Average delivery is about 3 days. We give you a no-commitment quote when you describe your strategy.' },
    { q: 'What does assisted install include?', a: 'An expert connects with you remotely and installs and configures your robots live, with you watching. Perfect if you would rather not fight the install.' },
    { q: 'And the Elite plan?', a: 'Private development + ongoing optimization + dedicated VPS + 24/7 monitoring with monthly retainer support. For those who want it all managed.' },
    { q: 'How do I start?', a: 'Fill the "Request your proposal" form under Services. We get your request, reach out and set up a strategy call to understand your trading.' },
  ] },
  { id: 'pagos', label: 'Payments & USDT', items: [
    { q: 'How do I pay with USDT?', a: 'Choose "USDT" at checkout and the network (TRON or Ethereum). We show the wallet address, you send the amount and the system confirms the payment on-chain. Your robot activates as soon as it confirms (usually within minutes).' },
    { q: 'Is paying in crypto here safe?', a: 'Yes. Your robot activates as soon as we verify the payment on-chain. We never ask for your wallet keys: you send the payment yourself from your own wallet.' },
    { q: 'What methods do you accept?', a: 'USDT (TRON · Ethereum): no banks or cards and no chargebacks. Creators cash out their earnings in USDT too.' },
    { q: 'Do you issue receipts?', a: 'Every USDT payment keeps the on-chain transaction record with its hash, which serves as proof of payment.' },
  ] },
  { id: 'seguridad', label: 'Safety', items: [
    { q: 'Is trading with robots risky?', a: 'Yes. No robot guarantees profits and past results do not ensure future results. That is why we show each one’s risk (drawdown) and always recommend testing on demo first.' },
    { q: 'How do I know a robot is not a scam?', a: 'A robot only gets published if it passes rules measured against its REAL trades: a minimum number of trades, mandatory Stop Loss, no martingale and no high frequency. Each one shows its Onyx Score with real data and verified sellers carry a badge. Even so, only invest what you can afford to risk.' },
    { q: 'Are my data and account protected?', a: 'It is your same secure Onyx account. Bot Lab never asks for your broker or wallet credentials: the robot trades with the connection you authorize.' },
  ] },
];

export default function BotLabFaq() {
  const { lang } = useLang();
  const es = lang === 'es';
  const data = es ? DATA_ES : DATA_EN;
  const [cat, setCat] = useState(data[0].id);
  const active = data.find((c) => c.id === cat) || data[0];
  const GOLD = 'var(--gold, #ffd45e)';

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand2, #a06bff)' }}>{es ? 'Preguntas frecuentes' : 'FAQ'}</span>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '8px 0' }}>{es ? 'Todo lo que quieres saber' : 'Everything you want to know'}</h1>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
        {data.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{ fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 99, cursor: 'pointer', border: '1px solid ' + (cat === c.id ? GOLD : 'var(--line)'), background: cat === c.id ? `color-mix(in srgb,${GOLD} 14%,transparent)` : 'transparent', color: cat === c.id ? GOLD : 'var(--mut)' }}>{c.label}</button>
        ))}
      </div>
      <div>
        {active.items.map((it, i) => (
          <details key={i} open={i === 0} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
            <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '16px 18px', fontWeight: 700, fontSize: 15.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>{it.q}</div>
              <b style={{ flex: 'none', color: GOLD, fontSize: 20, fontWeight: 400 }}>+</b>
            </summary>
            <div style={{ padding: '0 18px 18px', color: 'var(--mut)', fontSize: 14.5, lineHeight: 1.7 }}>{it.a}</div>
          </details>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 26 }}>
        <a href="/bot-lab#servicio" style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 12, fontWeight: 800, background: `linear-gradient(120deg,${GOLD},#ffb020)`, color: '#3a2a06' }}>{es ? '¿Otra duda? Escríbenos →' : 'Another question? Contact us →'}</a>
      </div>
    </div>
  );
}
