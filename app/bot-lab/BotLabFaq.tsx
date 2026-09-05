'use client';
import { useState } from 'react';
import { useLang } from '@/lib/lang';

// FAQ de Onyx Bot Lab, por categorías (comprar / vender / servicios / pagos / seguridad).
// Bilingüe. Acordeón con <details> (funciona aunque tarde el JS).
type QA = { q: string; a: string };
type Cat = { id: string; label: string; items: QA[] };

const DATA_ES: Cat[] = [
  { id: 'comprar', label: 'Comprar robots', items: [
    { q: '¿Qué es un robot y qué recibo al comprarlo?', a: 'Un robot (o EA/cBot) es un programa que opera por ti siguiendo reglas fijas. Al comprarlo obtienes una licencia: descargas el archivo para tu plataforma (MT4, MT5 o cTrader), lo instalas con la guía y empieza a operar en tu cuenta.' },
    { q: '¿Puedo probarlo antes de arriesgar dinero?', a: 'Sí. Recomendamos siempre correrlo primero en cuenta demo. Cada robot muestra su Onyx Score, su rendimiento de 90 días y su drawdown para que decidas con datos, no con promesas.' },
    { q: '¿Renta mensual o pago único?', a: 'Depende del robot. Algunos se rentan por mes (puedes cancelar cuando quieras) y otros son pago único de por vida. El precio y el tipo se ven claros antes de pagar.' },
    { q: '¿Funciona con mi bróker?', a: 'El robot detecta solo el sufijo de tu símbolo y se adapta a la mayoría de brókers de MT4, MT5 y cTrader. En la ficha de cada robot ves con qué plataformas es compatible.' },
    { q: '¿Dónde veo los robots que compré?', a: 'En tu panel, dentro de Bot Lab → "Mis robots". Ahí tienes la descarga y el estado (activo, pendiente, cancelado) de cada licencia.' },
  ] },
  { id: 'vender', label: 'Vender los tuyos', items: [
    { q: '¿Cómo publico mi robot para venderlo?', a: 'Desde tu panel: Bot Lab → Vender → Publicar robot. Pones nombre, precio y plataforma. Pasa por una revisión rápida de nuestro equipo y luego aparece en el Marketplace.' },
    { q: '¿Cuánto gano y cuánto se queda Onyx?', a: 'Tú te quedas el 80% de cada venta; Onyx retiene una comisión (por defecto 20%, editable). Nosotros procesamos el cobro y te depositamos: no manejas pagos ni tarjetas.' },
    { q: '¿Cuándo y cómo me pagan?', a: 'Cuando juntas al menos $10 disponibles, pides tu retiro desde el panel. Te pagamos a tu cuenta bancaria (Stripe) o en USDT, como prefieras.' },
    { q: '¿Cómo se verifica mi rendimiento?', a: 'Con el Onyx Score: evalúa tu operativa real (disciplina, riesgo y KPIs). Un robot con track record verificado vende más porque el comprador confía en el dato.' },
    { q: '¿Puedo poner mi robot a renta y a pago único?', a: 'Cada robot se publica con un tipo de precio, pero puedes publicar varias versiones del mismo (una en renta y otra de pago único) si quieres ofrecer ambas.' },
  ] },
  { id: 'servicios', label: 'Servicios a medida', items: [
    { q: '¿Qué es "Automatiza tu estrategia"?', a: 'Es nuestro servicio llave en mano: tú nos explicas cómo operas y nosotros construimos el robot a medida, lo probamos con backtest y cuenta demo, y lo dejamos operando en tu cuenta.' },
    { q: '¿Cuánto cuesta y cuánto tarda?', a: 'Los proyectos a medida arrancan desde un precio base y varían según la complejidad. La entrega promedio es de unos 3 días. Te damos un presupuesto sin compromiso al describir tu estrategia.' },
    { q: '¿Qué incluye la instalación asistida?', a: 'Un experto se conecta contigo por control remoto e instala y configura tus robots en vivo, contigo mirando. Ideal si no quieres pelear con la instalación.' },
    { q: '¿Y el plan Elite?', a: 'Desarrollo privado + optimización continua + VPS dedicado + monitoreo 24/7 con soporte por retainer mensual. Para quien quiere todo gestionado.' },
    { q: '¿Cómo empiezo?', a: 'Llena el formulario "Solicita tu propuesta" en Servicios. Recibimos tu solicitud, te contactamos y coordinamos una llamada estratégica para entender tu operativa.' },
  ] },
  { id: 'pagos', label: 'Pagos y USDT', items: [
    { q: '¿Cómo pago con USDT?', a: 'Eliges "USDT" al comprar. Te mostramos la dirección de wallet y la red (TRC20/ERC20/BEP20), envías el monto y pegas el hash de tu transacción. Activamos tu robot al confirmar el pago.' },
    { q: '¿Es seguro pagar en cripto aquí?', a: 'Sí. El pago queda registrado y tu robot se activa solo cuando confirmamos la transacción. Nunca te pedimos las claves de tu wallet, solo que envíes tú mismo el pago.' },
    { q: '¿Qué métodos aceptan?', a: 'Tarjeta, transferencia y USDT. Los creadores también pueden cobrar sus ganancias en USDT o a su banco.' },
    { q: '¿Puedo cancelar una suscripción?', a: 'Sí, cuando quieras, desde tu panel. Mantienes el acceso hasta el final del período que ya pagaste.' },
    { q: '¿Emiten factura?', a: 'Sí, los pagos con tarjeta generan comprobante. Para pagos en USDT queda el registro de la transacción con su hash.' },
  ] },
  { id: 'seguridad', label: 'Seguridad', items: [
    { q: '¿El trading con robots tiene riesgo?', a: 'Sí. Ningún robot garantiza ganancias y los resultados pasados no aseguran resultados futuros. Por eso mostramos el riesgo (drawdown) de cada uno y recomendamos siempre probar en demo primero.' },
    { q: '¿Cómo sé que un robot no es un fraude?', a: 'Todos pasan por revisión antes de publicarse y muestran un Onyx Score con datos reales. Los vendedores verificados llevan un sello. Aun así, invierte solo lo que puedas permitirte arriesgar.' },
    { q: '¿Mis datos y mi cuenta están protegidos?', a: 'Es tu misma cuenta segura de Onyx. Bot Lab no pide las credenciales de tu bróker ni de tu wallet: el robot opera con la conexión que tú autorizas.' },
  ] },
];

const DATA_EN: Cat[] = [
  { id: 'comprar', label: 'Buying robots', items: [
    { q: 'What is a robot and what do I get when I buy one?', a: 'A robot (or EA/cBot) is a program that trades for you following fixed rules. When you buy it you get a license: download the file for your platform (MT4, MT5 or cTrader), install it with the guide and it starts trading in your account.' },
    { q: 'Can I test it before risking money?', a: 'Yes. We always recommend running it on a demo account first. Every robot shows its Onyx Score, 90-day performance and drawdown so you decide with data, not promises.' },
    { q: 'Monthly rental or one-time?', a: 'It depends on the robot. Some are rented monthly (cancel anytime) and others are a one-time lifetime purchase. The price and type are clear before you pay.' },
    { q: 'Does it work with my broker?', a: 'The robot detects your symbol suffix on its own and adapts to most MT4, MT5 and cTrader brokers. Each robot page shows which platforms it supports.' },
    { q: 'Where do I see the robots I bought?', a: 'In your panel, under Bot Lab → "My robots". You get the download and status (active, pending, canceled) of each license.' },
  ] },
  { id: 'vender', label: 'Selling yours', items: [
    { q: 'How do I publish my robot to sell it?', a: 'From your panel: Bot Lab → Sell → Publish robot. Set a name, price and platform. It goes through a quick review by our team and then shows up in the Marketplace.' },
    { q: 'How much do I earn and how much does Onyx keep?', a: 'You keep 80% of each sale; Onyx keeps a commission (20% by default, editable). We process the payment and pay you out: you never handle cards or payments.' },
    { q: 'When and how do I get paid?', a: 'Once you have at least $10 available, request your payout from the panel. We pay to your bank (Stripe) or in USDT, whichever you prefer.' },
    { q: 'How is my performance verified?', a: 'With the Onyx Score: it grades your real trading (discipline, risk and KPIs). A robot with a verified track record sells more because buyers trust the data.' },
    { q: 'Can I offer both rental and one-time?', a: 'Each robot is published with one price type, but you can publish several versions of the same one (rental and one-time) if you want to offer both.' },
  ] },
  { id: 'servicios', label: 'Bespoke services', items: [
    { q: 'What is "Automate your strategy"?', a: 'Our turnkey service: you explain how you trade and we build the bespoke robot, test it with backtest and demo, and leave it running in your account.' },
    { q: 'How much and how long?', a: 'Bespoke projects start from a base price and vary with complexity. Average delivery is about 3 days. We give you a no-commitment quote when you describe your strategy.' },
    { q: 'What does assisted install include?', a: 'An expert connects with you remotely and installs and configures your robots live, with you watching. Perfect if you would rather not fight the install.' },
    { q: 'And the Elite plan?', a: 'Private development + ongoing optimization + dedicated VPS + 24/7 monitoring with monthly retainer support. For those who want it all managed.' },
    { q: 'How do I start?', a: 'Fill the "Request your proposal" form under Services. We get your request, reach out and set up a strategy call to understand your trading.' },
  ] },
  { id: 'pagos', label: 'Payments & USDT', items: [
    { q: 'How do I pay with USDT?', a: 'Choose "USDT" at checkout. We show the wallet address and network (TRC20/ERC20/BEP20), you send the amount and paste your transaction hash. Your robot activates once we confirm the payment.' },
    { q: 'Is paying in crypto here safe?', a: 'Yes. The payment is recorded and your robot activates only when we confirm the transaction. We never ask for your wallet keys, only that you send the payment yourself.' },
    { q: 'What methods do you accept?', a: 'Card, transfer and USDT. Creators can also cash out their earnings in USDT or to their bank.' },
    { q: 'Can I cancel a subscription?', a: 'Yes, anytime, from your panel. You keep access until the end of the period you already paid for.' },
    { q: 'Do you issue receipts?', a: 'Yes, card payments generate a receipt. USDT payments keep the transaction record with its hash.' },
  ] },
  { id: 'seguridad', label: 'Safety', items: [
    { q: 'Is trading with robots risky?', a: 'Yes. No robot guarantees profits and past results do not ensure future results. That is why we show each one’s risk (drawdown) and always recommend testing on demo first.' },
    { q: 'How do I know a robot is not a scam?', a: 'They all go through review before publishing and show an Onyx Score with real data. Verified sellers carry a badge. Even so, only invest what you can afford to risk.' },
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
