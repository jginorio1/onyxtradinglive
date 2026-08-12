// ============================================================
// Contenido de la guía.
//
// Sin 'use client': la portada y los artículos se dibujan en el servidor
// (para que Google los lea), y la búsqueda los usa en el cliente.
//
// Cada artículo tiene un `slug` estable: los botones "?" de las pantallas
// apuntan a esos slugs, así que no los cambies sin buscar sus usos.
// ============================================================

export type Lang = 'es' | 'en';

export type Block =
  | { p: string }                    // párrafo
  | { h: string }                    // subtítulo
  | { note: string; title?: string } // recuadro con ejemplo o aviso
  | { warn: string; title?: string } // recuadro de advertencia honesta
  | { tip: string; title?: string }  // recuadro verde de consejo
  | { img: string; alt: string; caption?: string } // ilustración o captura
  | { list: string[] }
  | { steps: string[] }
  // Recorrido visual: cada paso con título, detalle, imagen y consejo opcionales.
  | { walk: { t: string; d?: string; img?: string; alt?: string; tip?: string }[] };

export type Article = {
  slug: string;
  cat: string;
  icon: string;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  body: Record<Lang, Block[]>;
  cta?: { href: string; label: Record<Lang, string> };
  cover?: string;    // imagen de portada del artículo (ruta en /public)
  updated?: boolean; // marca "Nuevo/Actualizado" en la portada
};

export const CATEGORIES = [
  { id: 'start',   icon: '🔌', color: 'var(--green)',  name: { es: 'Primeros pasos',        en: 'Getting started' } },
  { id: 'numbers', icon: '📊', color: 'var(--brand)',  name: { es: 'Entender tus números',  en: 'Understanding your numbers' } },
  { id: 'manager', icon: '🛡️', color: 'var(--amber)',  name: { es: 'Onyx Guardian',             en: 'Onyx Guardian' } },
  { id: 'funded',  icon: '🏆', color: 'var(--purple)', name: { es: 'Cuentas de fondeo',     en: 'Funded accounts' } },
  { id: 'account', icon: '⚙️', color: 'var(--cyan)',   name: { es: 'Tu cuenta y tu plan',   en: 'Your account and plan' } },
  { id: 'alerts',  icon: '📣', color: 'var(--brand2)', name: { es: 'Avisos y soporte',      en: 'Alerts and support' } },
  { id: 'tools',   icon: '🧰', color: 'var(--green)',  name: { es: 'Herramientas del panel', en: 'Dashboard tools' } },
  { id: 'academy', icon: '🎓', color: 'var(--gold)',   name: { es: 'Onyx Academy',           en: 'Onyx Academy' } },
];

export const ARTICLES: Article[] = [
  // ---------- PRIMEROS PASOS ----------
  {
    slug: 'conectar-cuenta',
    cat: 'start', icon: '🔌', cover: '/guia/key.svg',
    title: { es: 'Conectar tu cuenta de MetaTrader', en: 'Connecting your MetaTrader account' },
    summary: {
      es: 'Qué es la clave API, por qué una por cuenta, y qué pasa si te equivocas.',
      en: 'What the API key is, why one per account, and what happens if you get it wrong.',
    },
    cta: { href: '/dashboard/keys', label: { es: 'Ir a conectar mi cuenta', en: 'Go connect my account' } },
    body: {
      es: [
        { p: 'Onyx no entra en tu cuenta de MetaTrader. Es al revés: instalas un pequeño programa (el EA) dentro de tu MetaTrader, y ese programa nos envía tus operaciones. Nosotros nunca tenemos tu contraseña ni podemos mover tu dinero.' },
        { h: 'La clave API' },
        { p: 'Es una contraseña que identifica a tu cuenta. Se crea desde Cuentas, se pega en el EA, y ya está. La primera vez que el EA sincroniza, esa clave queda atada al número de cuenta y no acepta otra.' },
        { note: 'Eso es a propósito. Si alguien te copiara la clave, no podría usarla con su cuenta.', title: 'Por qué se ata' },
        { h: 'Una clave por cuenta' },
        { p: 'Cada cuenta de MetaTrader necesita la suya. Tu plan decide cuántas puedes tener activas a la vez. Si llegas al límite, puedes revocar una clave para liberar el sitio: eso no borra el historial que ya subiste.' },
        { warn: 'Si desinstalas MetaTrader o formateas el ordenador, la clave sigue siendo válida. Solo tienes que volver a instalar el EA y pegarla otra vez.' },
      ],
      en: [
        { p: 'Onyx does not log into your MetaTrader account. It is the other way round: you install a small program (the EA) inside your MetaTrader, and that program sends us your trades. We never have your password and cannot move your money.' },
        { h: 'The API key' },
        { p: 'It is a password that identifies your account. You create it in Accounts, paste it into the EA, and that is it. The first time the EA syncs, that key gets bound to the account number and will not accept another.' },
        { note: 'That is deliberate. If someone copied your key, they could not use it with their own account.', title: 'Why it binds' },
        { h: 'One key per account' },
        { p: 'Every MetaTrader account needs its own. Your plan decides how many you can have active at once. If you hit the limit you can revoke a key to free a slot: that does not delete the history you already uploaded.' },
        { warn: 'If you reinstall MetaTrader or wipe your computer, the key is still valid. You only need to install the EA again and paste it back.' },
      ],
    },
  },
  {
    slug: 'instalar-ea',
    cat: 'start', icon: '⚙️', cover: '/guia/instalar-ea.svg',
    title: { es: 'Instalar el EA en MetaTrader', en: 'Installing the EA in MetaTrader' },
    summary: {
      es: 'Los siete pasos, y las cuatro cosas que fallan cuando no sincroniza.',
      en: 'The seven steps, and the four things that fail when it does not sync.',
    },
    cta: { href: '/dashboard/keys', label: { es: 'Abrir el asistente', en: 'Open the wizard' } },
    body: {
      es: [
        { p: 'En Cuentas tienes un asistente que te lleva paso a paso y espera hasta confirmar que funcionó. Aquí lo tienes todo explicado con imágenes por si prefieres ir por tu cuenta. Tardas unos 3 minutos la primera vez.' },
        { walk: [
          { t: 'Descarga el archivo de tu plataforma', d: 'En la pantalla de instalación, pulsa descargar: .mq5 si usas MetaTrader 5, .mq4 si usas MetaTrader 4. Es un archivo pequeño; fíjate en tu carpeta de Descargas.' },
          { t: 'Abre la carpeta Experts de MetaTrader', d: 'En MetaTrader, arriba: Archivo → Abrir carpeta de datos. Se abre una ventana del explorador; entra en la carpeta MQL5 (o MQL4) y luego en Experts. Copia ahí el archivo que descargaste.', img: '/guia/ea-experts.svg', alt: 'Menú Archivo, Abrir carpeta de datos, y la carpeta Experts' },
          { t: 'Compílalo en MetaEditor', d: 'Pulsa F4 para abrir MetaEditor. En la lista de la izquierda haz doble clic en el archivo de Onyx y pulsa Compilar (F7). Abajo debe decir "0 errors": eso significa que quedó listo.', img: '/guia/ea-compile.svg', alt: 'MetaEditor con el botón Compilar (F7) y 0 errores' },
          { t: 'Arrastra Onyx a un gráfico', d: 'Vuelve a MetaTrader. Abre el Navegador (Ctrl+N), despliega Asesores Expertos, y arrastra "Onyx" encima de cualquier gráfico abierto. Da igual el par o la temporalidad.', img: '/guia/ea-drag.svg', alt: 'Arrastrar el EA Onyx desde el Navegador hasta un gráfico' },
          { t: 'Pega tu clave API', d: 'Al soltarlo se abre una ventana. En la pestaña de parámetros, pega tu clave API (la que copiaste en Cuentas) y deja la URL del servidor tal como viene. Pulsa Aceptar.', tip: 'Copia y pega la clave entera; un espacio de más al principio o al final hace que no conecte.' },
          { t: 'Permite la URL de Onyx', d: 'Arriba: Herramientas → Opciones → Asesores Expertos. Marca "Permitir WebRequest" y añade la URL de Onyx a la lista. Es lo que deja que el EA nos envíe tus operaciones.' },
          { t: 'Enciende AlgoTrading', d: 'Pulsa el botón "AlgoTrading" de la barra superior hasta que se ponga verde. En unos segundos el panel dentro del gráfico dirá "Conectado".', img: '/guia/ea-connected.svg', alt: 'Botón AlgoTrading en verde y el panel del gráfico diciendo Conectado', tip: 'Si en la esquina del gráfico ves una carita triste en vez de sonriente, AlgoTrading no está activo aún.' },
        ] },
        { h: '⌨️ Las teclas F4, F7 y Ctrl+N' },
        { p: 'F4 y F7 son teclas de función: están en la fila de arriba del teclado (F1, F2, F3…). Ctrl+N significa mantener pulsada la tecla Ctrl y, sin soltarla, pulsar la N.' },
        { note: 'En Windows: pulsa F4 y F7 directamente.\nEn Mac: MetaTrader es un programa de Windows, así que corre dentro de un envoltorio (el que da tu bróker, o PlayOnMac/Wine). Ahí puede que necesites pulsar Fn + F4 o Fn + F7 para que funcionen las teclas de función, y en algunos casos Cmd en vez de Ctrl. Todos los menús (Archivo, Herramientas…) están igual, así que siempre puedes usar el ratón en vez de las teclas.', title: 'Windows vs Mac' },
        { h: 'Si no sincroniza' },
        { p: 'Casi siempre es una de estas cuatro, en este orden de probabilidad:' },
        { list: [
          'El botón AlgoTrading no está verde. Es la causa de la mayoría de los casos.',
          'Falta autorizar la URL en Opciones → Asesores Expertos.',
          'En la esquina del gráfico hay una cruz en vez de una carita sonriente: el EA no está activo ahí.',
          'La clave se pegó con un espacio de más o incompleta.',
        ] },
        { warn: 'Un EA solo funciona con MetaTrader abierto y con conexión. Si apagas el ordenador, deja de registrar y deja de proteger. Si operas en serio, plantéate un VPS.' },
      ],
      en: [
        { p: 'In Accounts there is a wizard that walks you through it and waits until it confirms it worked. Here is everything explained with images in case you prefer doing it yourself. It takes about 3 minutes the first time.' },
        { walk: [
          { t: 'Download the file for your platform', d: 'On the install screen, hit download: .mq5 if you use MetaTrader 5, .mq4 if you use MetaTrader 4. It is a small file; check your Downloads folder.' },
          { t: 'Open MetaTrader’s Experts folder', d: 'In MetaTrader, top menu: File → Open Data Folder. A file explorer opens; go into the MQL5 (or MQL4) folder and then Experts. Copy the file you downloaded there.', img: '/guia/ea-experts.svg', alt: 'File menu, Open Data Folder, and the Experts folder' },
          { t: 'Compile it in MetaEditor', d: 'Press F4 to open MetaEditor. In the left list double-click the Onyx file and press Compile (F7). The bottom should say "0 errors": that means it is ready.', img: '/guia/ea-compile.svg', alt: 'MetaEditor with the Compile (F7) button and 0 errors' },
          { t: 'Drag Onyx onto a chart', d: 'Back in MetaTrader, open the Navigator (Ctrl+N), expand Expert Advisors, and drag "Onyx" onto any open chart. The pair or timeframe does not matter.', img: '/guia/ea-drag.svg', alt: 'Dragging the Onyx EA from the Navigator onto a chart' },
          { t: 'Paste your API key', d: 'When you drop it, a window opens. On the inputs tab, paste your API key (the one you copied in Accounts) and leave the server URL as it comes. Click OK.', tip: 'Copy and paste the whole key; an extra space at the start or end will stop it from connecting.' },
          { t: 'Allow the Onyx URL', d: 'Top menu: Tools → Options → Expert Advisors. Tick "Allow WebRequest" and add the Onyx URL to the list. That is what lets the EA send us your trades.' },
          { t: 'Turn on AlgoTrading', d: 'Press the "AlgoTrading" button in the top bar until it turns green. Within seconds the panel inside the chart will say "Connected".', img: '/guia/ea-connected.svg', alt: 'AlgoTrading button green and the chart panel saying Connected', tip: 'If you see a sad face instead of a smiley in the chart corner, AlgoTrading is not active yet.' },
        ] },
        { h: '⌨️ The F4, F7 and Ctrl+N keys' },
        { p: 'F4 and F7 are function keys: they sit on the top row of your keyboard (F1, F2, F3…). Ctrl+N means hold the Ctrl key and, without releasing it, press N.' },
        { note: 'On Windows: press F4 and F7 directly.\nOn Mac: MetaTrader is a Windows program, so it runs inside a wrapper (your broker’s, or PlayOnMac/Wine). There you may need to press Fn + F4 or Fn + F7 for the function keys to work, and in some cases Cmd instead of Ctrl. All menus (File, Tools…) are the same, so you can always use the mouse instead of the keys.', title: 'Windows vs Mac' },
        { h: 'If it does not sync' },
        { p: 'It is almost always one of these four, in this order of likelihood:' },
        { list: [
          'The AlgoTrading button is not green. This causes most cases.',
          'The URL is not authorized in Options → Expert Advisors.',
          'There is a cross instead of a smiley in the chart corner: the EA is not active there.',
          'The key was pasted with an extra space or incomplete.',
        ] },
        { warn: 'An EA only works with MetaTrader open and connected. If you shut down your computer, it stops recording and stops protecting. If you trade seriously, consider a VPS.' },
      ],
    },
  },
  {
    slug: 'que-hace-onyx',
    cat: 'start', icon: '👁️', cover: '/guia/onyx-flujo.svg',
    title: { es: 'Qué hace Onyx y qué no hace', en: 'What Onyx does and does not do' },
    summary: {
      es: 'Los límites reales, dichos antes de que te lleves una sorpresa.',
      en: 'The real limits, said before you get a surprise.',
    },
    body: {
      es: [
        { h: 'Lo que hace' },
        { list: [
          'Registra cada operación cerrada con sus costes reales: comisión, swap y resultado neto.',
          'Calcula tus estadísticas y te enseña qué pares, sesiones y horas te funcionan.',
          'Gestiona tus operaciones abiertas: break even, trailing y cierres por partes.',
          'Hace cumplir el plan de trading y los límites que tú mismo configuraste.',
        ] },
        { h: 'Lo que no hace' },
        { list: [
          'No abre operaciones. Nunca. No es un bot de trading y no lo será.',
          'No puede impedir que envíes una orden: MetaTrader no lo permite. Lo que hace es cerrarla en cuanto aparece, si va contra tu plan.',
          'No protege con MetaTrader cerrado. Sin el programa abierto no hay nadie vigilando.',
          'No garantiza nada. Un hueco de mercado se salta cualquier stop, el tuyo y el nuestro.',
        ] },
        { warn: 'Cuando Onyx Guardian cierra una operación que abriste fuera de tu horario, esa entrada te ha costado el spread y la comisión. No es un fallo: es el precio de saltarte tu propio plan, y está puesto a propósito.' },
      ],
      en: [
        { h: 'What it does' },
        { list: [
          'Records every closed trade with its real costs: commission, swap and net result.',
          'Computes your stats and shows which pairs, sessions and hours work for you.',
          'Manages your open trades: break even, trailing and partial closes.',
          'Enforces the trading plan and limits you set yourself.',
        ] },
        { h: 'What it does not do' },
        { list: [
          'It does not open trades. Ever. It is not a trading bot and will not become one.',
          'It cannot stop you from sending an order: MetaTrader does not allow that. What it does is close it as soon as it appears, if it goes against your plan.',
          'It does not protect with MetaTrader closed. With the program shut, nobody is watching.',
          'It guarantees nothing. A market gap jumps over any stop, yours and ours.',
        ] },
        { warn: 'When Onyx Guardian closes a trade you opened outside your hours, that entry cost you the spread and commission. Not a bug: it is the price of breaking your own plan, and it is there on purpose.' },
      ],
    },
  },

  // ---------- ENTENDER TUS NÚMEROS ----------
  {
    slug: 'profit-factor',
    cat: 'numbers', icon: '📊',
    title: { es: 'Profit factor: qué es y cuándo te engaña', en: 'Profit factor: what it is and when it lies' },
    summary: {
      es: 'El número más citado del trading, y el que peor se interpreta.',
      en: 'The most quoted number in trading, and the worst understood.',
    },
    body: {
      es: [
        { p: 'El profit factor divide todo lo que ganaste entre todo lo que perdiste. Si ganaste $3.000 y perdiste $2.000, tu profit factor es 1,5: por cada dólar perdido, ganaste uno y medio.' },
        { note: 'Por debajo de 1 estás perdiendo dinero. Entre 1 y 1,3 apenas cubres costes. Por encima de 1,5 sostenido es un resultado sólido.', title: 'Cómo leerlo' },
        { h: 'Dónde engaña' },
        { p: 'Con pocas operaciones no significa nada. Con 12 operaciones, una sola ganancia grande te puede dar un profit factor de 3, y no dice nada sobre si tu método funciona. Por debajo de 30 operaciones, míralo con desconfianza. Por debajo de 100, no lo presumas.' },
        { p: 'Tampoco te dice cómo lo conseguiste. Un profit factor de 2 con un drawdown del 40% es mucho peor negocio que uno de 1,4 con un drawdown del 8%. El primero te habrá hecho pasar noches muy malas.' },
        { warn: 'Si tu profit factor sube mucho después de una sola operación, no ha mejorado tu método: has tenido suerte una vez.' },
      ],
      en: [
        { p: 'Profit factor divides everything you won by everything you lost. If you won $3,000 and lost $2,000, your profit factor is 1.5: for every dollar lost, you made one and a half.' },
        { note: 'Below 1 you are losing money. Between 1 and 1.3 you barely cover costs. Sustained above 1.5 is a solid result.', title: 'How to read it' },
        { h: 'Where it lies' },
        { p: 'With few trades it means nothing. With 12 trades, a single big win can give you a profit factor of 3, and it says nothing about whether your method works. Below 30 trades, treat it with suspicion. Below 100, do not brag about it.' },
        { p: 'It also does not tell you how you got there. A profit factor of 2 with a 40% drawdown is a far worse business than 1.4 with an 8% drawdown. The first one will have cost you some very bad nights.' },
        { warn: 'If your profit factor jumps after a single trade, your method did not improve: you got lucky once.' },
      ],
    },
  },
  {
    slug: 'expectancy',
    cat: 'numbers', icon: '🎯',
    title: { es: 'Expectancy: cuánto ganas por operación', en: 'Expectancy: what each trade is worth' },
    summary: {
      es: 'El único número que responde a "¿merece la pena seguir operando así?".',
      en: 'The only number that answers "is it worth trading this way?".',
    },
    body: {
      es: [
        { p: 'La expectancy te dice cuánto esperas ganar, de media, cada vez que abres una operación. Si es de $18, eso significa que a la larga cada entrada vale dieciocho dólares — aunque muchas individuales pierdan.' },
        { note: 'Ejemplo: aciertas el 40% de las veces, ganando $300 cuando aciertas y perdiendo $120 cuando fallas.\n(0,40 × $300) − (0,60 × $120) = $120 − $72 = $48 por operación.\nCon un 40% de aciertos, ganas dinero.', title: 'Cómo se calcula' },
        { h: 'Por qué importa más que el win rate' },
        { p: 'Un 80% de aciertos suena espectacular hasta que ves que ganas $10 cuando aciertas y pierdes $60 cuando fallas. Esa estrategia pierde dinero: (0,80 × 10) − (0,20 × 60) = −$4 por operación.' },
        { p: 'La expectancy junta las dos cosas que importan — con qué frecuencia aciertas y cuánto sacas cuando aciertas — en un solo número. Por eso es la métrica que miramos primero.' },
        { p: 'Multiplica tu expectancy por las operaciones que haces al mes y tendrás una estimación honesta de lo que puedes esperar. Si sale poco, el problema no es que necesites operar más: es que necesitas operar mejor.' },
      ],
      en: [
        { p: 'Expectancy tells you how much you expect to make, on average, every time you open a trade. If it is $18, each entry is worth eighteen dollars in the long run — even though many individual ones lose.' },
        { note: 'Example: you win 40% of the time, making $300 when right and losing $120 when wrong.\n(0.40 × $300) − (0.60 × $120) = $120 − $72 = $48 per trade.\nWith a 40% win rate, you make money.', title: 'How it is calculated' },
        { h: 'Why it matters more than win rate' },
        { p: 'An 80% win rate sounds spectacular until you see you make $10 when right and lose $60 when wrong. That strategy loses money: (0.80 × 10) − (0.20 × 60) = −$4 per trade.' },
        { p: 'Expectancy combines the two things that matter — how often you are right and how much you take when you are — into one number. That is why we look at it first.' },
        { p: 'Multiply your expectancy by the trades you take per month for an honest estimate of what to expect. If it comes out small, the answer is not to trade more: it is to trade better.' },
      ],
    },
  },
  {
    slug: 'que-es-r',
    cat: 'numbers', icon: '📐',
    title: { es: 'Qué es 1R y por qué deberías usarlo', en: 'What 1R is and why you should use it' },
    summary: {
      es: 'Medir en R en vez de en dinero cambia cómo ves tus resultados.',
      en: 'Measuring in R instead of money changes how you see your results.',
    },
    body: {
      es: [
        { p: '1R es lo que arriesgas en una operación: la distancia entre tu entrada y tu stop loss, en dinero. Si entras arriesgando $200, entonces 1R = $200 para esa operación.' },
        { note: 'Ganaste $600 con un riesgo de $200 → ganaste 3R.\nPerdiste $200 → perdiste 1R.\nAsí puedes comparar una operación de 0,1 lotes con otra de 2 lotes.', title: 'Con números' },
        { h: 'Por qué cambia las cosas' },
        { p: 'En dinero, una ganancia de $500 parece mejor que una de $300. Pero si la primera fue arriesgando $500 (1R) y la segunda arriesgando $60 (5R), la segunda operación fue muchísimo mejor. En R lo ves de inmediato; en dólares, no.' },
        { p: 'Además te quita la emoción del dinero. "Perdí 1R" duele menos que "perdí 400 euros", y te deja pensar con la cabeza en vez de con el estómago.' },
        { p: 'En Onyx Guardian puedes configurar tus niveles en R. Así, el break even o el trailing se adaptan solos a cada operación sin que tengas que recalcular pips.' },
      ],
      en: [
        { p: '1R is what you risk on a trade: the distance between your entry and your stop loss, in money. If you enter risking $200, then 1R = $200 for that trade.' },
        { note: 'You made $600 risking $200 → you made 3R.\nYou lost $200 → you lost 1R.\nThis lets you compare a 0.1 lot trade with a 2 lot one.', title: 'With numbers' },
        { h: 'Why it changes things' },
        { p: 'In money, a $500 win looks better than a $300 one. But if the first risked $500 (1R) and the second risked $60 (5R), the second trade was far better. In R you see it instantly; in dollars you do not.' },
        { p: 'It also takes the emotion out of the money. "I lost 1R" hurts less than "I lost 400 euros", and lets you think with your head instead of your stomach.' },
        { p: 'In Onyx Guardian you can set your levels in R. That way break even or trailing adapt to each trade without you recalculating pips.' },
      ],
    },
  },
  {
    slug: 'drawdown',
    cat: 'numbers', icon: '📉',
    title: { es: 'Drawdown: la métrica que decide si aguantas', en: 'Drawdown: the metric that decides if you last' },
    summary: {
      es: 'Cuánto caíste desde tu mejor momento, y por qué importa tanto.',
      en: 'How far you fell from your best moment, and why it matters so much.',
    },
    body: {
      es: [
        { p: 'El drawdown mide cuánto has caído desde tu punto más alto. Si llegaste a $12.000 y bajaste a $10.200, tu drawdown es de $1.800, un 15%.' },
        { h: 'La matemática que duele' },
        { p: 'Recuperarse de un drawdown no es simétrico. Si pierdes un 20%, necesitas ganar un 25% para volver a donde estabas. Si pierdes un 50%, necesitas un 100%. Por eso proteger el capital importa más que ganar rápido.' },
        { note: 'Pierdes 10% → necesitas +11% para volver\nPierdes 25% → necesitas +33%\nPierdes 50% → necesitas +100%\nPierdes 75% → necesitas +300%', title: 'Cuánto cuesta recuperarse' },
        { h: 'El drawdown que de verdad importa' },
        { p: 'No es el número: es si vas a seguir operando igual después de vivirlo. Casi nadie abandona por perder dinero; abandonan por perder la confianza. Un drawdown que te lleva a doblar el lotaje para recuperar es un drawdown que te va a costar la cuenta.' },
        { p: 'Si estás en una cuenta de fondeo, además es una regla dura: la firma te cierra la cuenta al llegar al límite. Por eso Onyx Guardian te avisa antes, con margen.' },
      ],
      en: [
        { p: 'Drawdown measures how far you have fallen from your highest point. If you reached $12,000 and dropped to $10,200, your drawdown is $1,800, or 15%.' },
        { h: 'The maths that hurts' },
        { p: 'Recovering from a drawdown is not symmetric. Lose 20% and you need 25% to get back. Lose 50% and you need 100%. That is why protecting capital matters more than winning fast.' },
        { note: 'Lose 10% → need +11% to get back\nLose 25% → need +33%\nLose 50% → need +100%\nLose 75% → need +300%', title: 'What recovery costs' },
        { h: 'The drawdown that really matters' },
        { p: 'It is not the number: it is whether you will keep trading the same way after living through it. Almost nobody quits from losing money; they quit from losing confidence. A drawdown that pushes you to double your lot size to recover is a drawdown that will cost you the account.' },
        { p: 'On a funded account it is also a hard rule: the firm closes you when you hit the limit. That is why Onyx Guardian warns you before, with margin.' },
      ],
    },
  },
  {
    slug: 'costes-reales',
    cat: 'numbers', icon: '💸',
    title: { es: 'Comisiones y swap: el dinero que no ves', en: 'Commission and swap: the money you do not see' },
    summary: {
      es: 'Por qué tu resultado real casi nunca es el que te enseña la plataforma.',
      en: 'Why your real result is almost never the one the platform shows.',
    },
    body: {
      es: [
        { p: 'Cada operación tiene tres partidas: el resultado del precio, la comisión que cobra el bróker, y el swap si la dejaste abierta de un día para otro. Onyx guarda las tres por separado y siempre te enseña el neto.' },
        { note: '0,50 lotes en EURUSD con $7 de comisión ida y vuelta.\nSales "a cero" de precio → tu resultado real es −$7.\nEn veinte operaciones son $140 que desaparecieron sin que los vieras.', title: 'El coste de no mirarlo' },
        { h: 'El swap se acumula en silencio' },
        { p: 'En posiciones que aguantas semanas, el swap puede comerse buena parte de la ganancia. En algunos pares es positivo y te paga a ti, pero en la mayoría de las combinaciones que operan los minoristas, resta.' },
        { p: 'En la sección de Costes del dashboard tienes cuánto te llevaron entre comisiones y swap en el periodo que elijas. Es un número que suele sorprender la primera vez.' },
        { p: 'Por eso el break even de Onyx Guardian puede cubrir estos costes automáticamente: lee lo que te cobró el bróker en esa operación concreta y mueve el stop lo suficiente para que salir sea salir de verdad a cero.' },
      ],
      en: [
        { p: 'Every trade has three parts: the price result, the commission your broker charges, and swap if you held it overnight. Onyx stores all three separately and always shows you the net.' },
        { note: '0.50 lots on EURUSD with $7 round-trip commission.\nYou exit "at zero" on price → your real result is −$7.\nOver twenty trades that is $140 gone without you seeing it.', title: 'The cost of not looking' },
        { h: 'Swap builds up quietly' },
        { p: 'On positions you hold for weeks, swap can eat a good chunk of the profit. On some pairs it is positive and pays you, but on most combinations retail traders take, it subtracts.' },
        { p: 'In the Costs section of the dashboard you can see what commissions and swap took from you over any period. It is a number that usually surprises people the first time.' },
        { p: 'That is why Onyx Guardian\'s break even can cover these costs automatically: it reads what your broker charged on that specific trade and moves the stop far enough that exiting really means exiting at zero.' },
      ],
    },
  },

  // ---------- EL GESTOR ----------
  {
    slug: 'break-even',
    cat: 'manager', icon: '🎯',
    title: { es: '¿Qué es el break even de verdad?', en: 'What real break even means' },
    summary: {
      es: 'Poner el stop en la entrada no es salir a cero. Te explicamos por qué.',
      en: 'Putting the stop at entry is not breaking even. Here is why.',
    },
    cta: { href: '/dashboard/manager', label: { es: 'Configurarlo ahora', en: 'Set it up now' } },
    body: {
      es: [
        { p: 'Casi todo el mundo mueve el stop al precio de entrada y cree que ya no puede perder. No es cierto: aún pagas la comisión y el swap de esa operación.' },
        { note: '0,50 lotes en EURUSD con $7 de comisión. Si sales "a cero" de precio, sales con −$7. En veinte operaciones son $140.', title: 'Con números' },
        { h: 'Las tres opciones que te da Onyx' },
        { list: [
          'Por debajo de la entrada: le das aire a la operación. Aún puede perder un poco, pero la dejas respirar y evitas que te saquen por ruido.',
          'Justo en la entrada: el clásico. Cierras a cero de precio, pero pierdes las comisiones.',
          'Por encima, cubriendo costes: break even de verdad. Onyx lee lo que te cobró el bróker en esa operación y mueve el stop lo justo para que salgas a cero real.',
        ] },
        { h: 'Cuándo se activa' },
        { p: 'Tú eliges cuánta ganancia hace falta antes de mover el stop. Ponerlo demasiado pronto es un error común: te saca de operaciones buenas que solo estaban respirando. Si te pasa a menudo, sube el disparador.' },
        { warn: 'Onyx Guardian solo puede mover stops si MetaTrader está abierto, AlgoTrading encendido y hay conexión. Y un hueco de mercado se salta cualquier stop.' },
      ],
      en: [
        { p: 'Almost everyone moves the stop to the entry price and believes they can no longer lose. Not true: you still pay the commission and swap on that trade.' },
        { note: '0.50 lots on EURUSD with $7 commission. If you exit "at zero" on price, you exit at −$7. Over twenty trades that is $140.', title: 'With numbers' },
        { h: 'The three options Onyx gives you' },
        { list: [
          'Below entry: you give the trade room. It can still lose a little, but you avoid being taken out by noise.',
          'Exactly at entry: the classic. Zero on price, but you lose the fees.',
          'Above entry, covering costs: real break even. Onyx reads what your broker charged on that trade and moves the stop just enough to exit at true zero.',
        ] },
        { h: 'When it triggers' },
        { p: 'You choose how much profit is needed before the stop moves. Setting it too early is a common mistake: it takes you out of good trades that were only breathing. If that happens often, raise the trigger.' },
        { warn: 'Onyx Guardian can only move stops with MetaTrader open, AlgoTrading on and a live connection. And a market gap jumps over any stop.' },
      ],
    },
  },
  {
    slug: 'trailing-stop',
    cat: 'manager', icon: '📈',
    title: { es: 'Trailing stop: asegurar sin cortar demasiado pronto', en: 'Trailing stop: locking in without cutting too early' },
    summary: {
      es: 'Persigue al precio, pero mal configurado te saca de tus mejores operaciones.',
      en: 'It follows price, but set wrong it takes you out of your best trades.',
    },
    cta: { href: '/dashboard/manager', label: { es: 'Configurarlo ahora', en: 'Set it up now' } },
    body: {
      es: [
        { p: 'El trailing mueve el stop detrás del precio mientras la operación va a tu favor. Nunca lo mueve en tu contra: si el precio retrocede, el stop se queda donde estaba.' },
        { h: 'Los dos números' },
        { list: [
          'Cuándo empieza: cuánta ganancia hace falta antes de que el trailing entre en acción.',
          'Distancia: a qué separación del precio va persiguiendo.',
        ] },
        { h: 'El error habitual' },
        { p: 'Una distancia demasiado corta te saca en la primera respiración del mercado. Una operación que iba a darte 5R te da 1R porque el trailing la cortó en el primer retroceso normal.' },
        { p: 'Regla práctica: mira tus operaciones ganadoras pasadas y fíjate cuánto retrocedían antes de seguir subiendo. Tu distancia debería ser mayor que ese retroceso típico.' },
        { warn: 'Si pones el trailing para que arranque antes que el break even, el break even casi nunca llegará a aplicarse. Onyx te avisa si detecta esa combinación.' },
      ],
      en: [
        { p: 'Trailing moves the stop behind price while the trade goes your way. It never moves against you: if price pulls back, the stop stays where it was.' },
        { h: 'The two numbers' },
        { list: [
          'When it starts: how much profit is needed before trailing kicks in.',
          'Distance: how far behind price it follows.',
        ] },
        { h: 'The usual mistake' },
        { p: 'Too short a distance takes you out on the market\'s first breath. A trade that was going to give you 5R gives you 1R because trailing cut it on the first normal pullback.' },
        { p: 'Rule of thumb: look at your past winners and see how far they pulled back before continuing. Your distance should be larger than that typical pullback.' },
        { warn: 'If trailing starts before break even, break even will rarely ever apply. Onyx warns you if it spots that combination.' },
      ],
    },
  },
  {
    slug: 'plan-de-trading',
    cat: 'manager', icon: '⏰',
    title: { es: 'Tu plan de trading: horarios, rachas y fricción', en: 'Your trading plan: hours, streaks and friction' },
    summary: {
      es: 'Decidir cuándo puedes operar mientras estás tranquilo, para que se cumpla cuando no lo estés.',
      en: 'Deciding when you may trade while calm, so it holds when you are not.',
    },
    cta: { href: '/dashboard/manager', label: { es: 'Configurar mi plan', en: 'Set up my plan' } },
    body: {
      es: [
        { p: 'Casi nadie pierde dinero por no saber analizar un gráfico. Se pierde operando a deshora, doblando después de una pérdida, o entrando por aburrimiento un viernes por la tarde.' },
        { p: 'Esta pantalla te deja escribir esas reglas cuando estás tranquilo. Después, Onyx Guardian te las recuerda aunque no quieras oírlas.' },
        { h: 'Lo que puedes fijar' },
        { list: [
          'Días y franjas horarias en las que operas, en tu hora local.',
          'Máximo de operaciones al día.',
          'Espera obligatoria después de cerrar una pérdida — el antídoto contra la operación de venganza.',
          'Freno por racha: tras varias pérdidas seguidas, te para un rato.',
          'Cierre antes del fin de semana, para evitar el hueco del domingo.',
        ] },
        { h: 'La pregunta importante: ¿qué pasa si intento saltármelo?' },
        { list: [
          'Solo avísame: ves el aviso y decides tú. No bloquea nada.',
          'Hazme esperar: puedes saltártelo, pero antes esperas los minutos que tú fijaste. Suele bastar para que se te pase.',
          'Bloquéame hasta mañana: sin salida. Elígelo solo si de verdad lo quieres.',
        ] },
        { note: 'Cada vez que te saltas una regla queda registrado. Ese registro es el punto: al final del mes ves cuántas veces te frenó y cuántas pasaste por encima.', title: 'Por qué se apunta todo' },
        { warn: 'MetaTrader no permite que un EA impida una orden antes de enviarse. Si operas fuera de tu horario, Onyx la cierra en uno o dos segundos — y esa entrada te habrá costado el spread. Esa es la fricción.' },
      ],
      en: [
        { p: 'Almost nobody loses money because they cannot read a chart. People lose trading at the wrong hours, doubling up after a loss, or entering out of boredom on a Friday afternoon.' },
        { p: 'This screen lets you write those rules while you are calm. Later, Onyx Guardian reminds you even when you would rather not hear it.' },
        { h: 'What you can set' },
        { list: [
          'Days and time windows you trade, in your local time.',
          'Maximum trades per day.',
          'A mandatory wait after closing a loss — the antidote to revenge trading.',
          'Streak brake: after several losses in a row, it stops you for a while.',
          'Closing before the weekend, to avoid the Sunday gap.',
        ] },
        { h: 'The important question: what if I try to skip it?' },
        { list: [
          'Just warn me: you see the warning and decide. Nothing is blocked.',
          'Make me wait: you can skip it, but first you wait the minutes you set. Usually that is enough.',
          'Lock me until tomorrow: no way out. Pick it only if you mean it.',
        ] },
        { note: 'Every time you break a rule it is recorded. That record is the point: at the end of the month you see how often it stopped you and how often you overrode it.', title: 'Why everything is logged' },
        { warn: 'MetaTrader does not let an EA block an order before it is sent. If you trade outside your hours, Onyx closes it within a second or two — and that entry cost you the spread. That is the friction.' },
      ],
    },
  },
  {
    slug: 'limites-cuenta',
    cat: 'manager', icon: '🛡️',
    title: { es: 'Límites: base de cálculo y hora de reinicio', en: 'Limits: calculation base and reset hour' },
    summary: {
      es: 'Las dos preguntas que casi todo el mundo configura mal, y cuestan cuentas.',
      en: 'The two questions almost everyone gets wrong, and they cost accounts.',
    },
    cta: { href: '/dashboard/manager', label: { es: 'Revisar mis límites', en: 'Review my limits' } },
    body: {
      es: [
        { p: 'Un límite de pérdida diaria del 5% suena claro hasta que preguntas: ¿5% de qué, y desde qué hora?' },
        { h: 'Base de cálculo' },
        { p: 'Es el número sobre el que se calcula el porcentaje. Puede ser el balance al empezar el día, el equity al empezar el día, o el balance inicial de la cuenta. No es lo mismo, y las firmas no lo definen igual entre ellas.' },
        { note: 'Cuenta con $100.000 de balance y $102.000 de equity (tienes operaciones abiertas en ganancia).\nSobre balance: tu límite del 5% son $5.000.\nSobre equity: son $5.100.\nParece poco, pero es la diferencia entre pasar y romper la cuenta.', title: 'Por qué importa' },
        { h: 'Hora de reinicio' },
        { p: 'Es la hora del servidor de tu bróker a la que empieza un día nuevo. Muchas firmas no usan la medianoche. Si tu día empieza a las 17:00 y tú lo configuraste a las 00:00, tus pérdidas de la tarde se están contando en el día equivocado.' },
        { h: 'Margen de seguridad' },
        { p: 'Onyx te deja reservar un porcentaje del límite. Si tu firma permite el 5% y reservas un 20%, Onyx Guardian te para al 4%. Llegar justo al límite ya es incumplirlo: entre el slippage y una vela mala, te lo saltas sin querer.' },
        { warn: 'Las plantillas de prop firms que ves son un punto de partida, no la norma oficial. Cada firma cambia sus reglas y hay variantes por tipo de cuenta. Confirma los dos campos con tu contrato.' },
      ],
      en: [
        { p: 'A 5% daily loss limit sounds clear until you ask: 5% of what, and starting from what hour?' },
        { h: 'Calculation base' },
        { p: 'It is the number the percentage is calculated on. It can be balance at day start, equity at day start, or the initial account balance. They are not the same, and firms do not define it the same way.' },
        { note: 'Account with $100,000 balance and $102,000 equity (you hold winning open trades).\nOn balance: your 5% limit is $5,000.\nOn equity: it is $5,100.\nIt looks small, but it is the difference between passing and blowing the account.', title: 'Why it matters' },
        { h: 'Reset hour' },
        { p: 'It is the broker server hour when a new day starts. Many firms do not use midnight. If your day starts at 17:00 and you set it to 00:00, your afternoon losses are counting on the wrong day.' },
        { h: 'Safety margin' },
        { p: 'Onyx lets you reserve a percentage of the limit. If your firm allows 5% and you reserve 20%, Onyx Guardian stops you at 4%. Hitting the exact limit already breaks it: between slippage and one bad candle, you cross it by accident.' },
        { warn: 'The prop firm templates you see are a starting point, not the official rule. Firms change their rules and there are variants per account type. Confirm both fields against your contract.' },
      ],
    },
  },
  {
    slug: 'parciales',
    cat: 'manager', icon: '✂️',
    title: { es: 'Cierres parciales: cobrar por partes', en: 'Partial closes: taking profit in pieces' },
    summary: {
      es: 'Cerrar en varios niveles, y el detalle del lote mínimo que sorprende a todos.',
      en: 'Closing at several levels, and the minimum lot detail that surprises everyone.',
    },
    cta: { href: '/dashboard/manager', label: { es: 'Configurar parciales', en: 'Set up partials' } },
    body: {
      es: [
        { p: 'Puedes cerrar tu posición en tres tramos (TP1, TP2, TP3) según avanza a tu favor. Por ejemplo: el 40% al llegar a 20 pips, el 30% a 40 pips, el 20% a 60 pips. Los porcentajes son del tamaño ORIGINAL de la posición y deben sumar 100% o menos.' },
        { h: 'El Runner: el trozo que dejas correr' },
        { p: 'El último bloque ya no es un TP más: es el Runner. No lleva porcentaje propio, cierra "el resto" (100% menos la suma de tus TP). Puedes dejarlo correr con el trailing para capturar un movimiento grande, o cerrarlo al llegar a una distancia. Si tus TP suman 100%, no queda runner y Onyx te avisa.' },
        { p: 'La ventaja psicológica es real: aseguras algo pronto, y eso te quita la ansiedad de ver una ganancia evaporarse. La desventaja también: si cierras demasiado pronto, tus operaciones ganadoras se quedan pequeñas y tu expectancy baja. Por eso existe el runner: banqueas parte y dejas correr el resto.' },
        { note: 'En el dashboard, la tarjeta "Salidas · Full TP vs parciales" te muestra cuántas cerraste al objetivo completo, cuántas por partes, la ganancia banqueada en TP1/TP2 y el aporte del runner, más el motivo de cada salida.', title: 'Lo ves en tus estadísticas' },
        { warn: 'Si tu operación es de 0,01 lotes, el bróker no deja partirla: no existe media unidad. En ese caso el parcial se salta y Onyx lo apunta en el historial para que sepas por qué no pasó nada.' },
        { h: 'Un detalle de MT4 y del trailing' },
        { p: 'En MT4, al cerrar parte de una posición el resto recibe un número de ticket nuevo; Onyx lo agrupa por otro camino. Y en MetaTrader un cierre por trailing figura como "Stop (SL)" en el motivo de salida, porque un trailing es un stop que se movió: la plataforma no los distingue.' },
        { p: 'Los cierres parciales están disponibles en el plan Elite. Para ver el desglose necesitas la última versión del EA instalada.' },
      ],
      en: [
        { p: 'You can close your position in up to four chunks as it moves your way. For example: 50% at 20 pips, 30% at 40 pips, and let the rest run.' },
        { p: 'The psychological benefit is real: you bank something early, which removes the anxiety of watching a profit evaporate. So is the downside: close too early and your winners stay small, dragging your expectancy down.' },
        { warn: 'If your trade is 0.01 lots, the broker will not split it: there is no half unit. In that case the partial is skipped and Onyx logs it in your history so you know why nothing happened.' },
        { h: 'An MT4-only detail' },
        { p: 'On MT4, closing part of a position gives the rest a new ticket number. Onyx accounts for this and tracks it another way, but if you see anything odd in your history, tell us.' },
        { p: 'Partial closes are available on the Elite plan.' },
      ],
    },
  },

  // ---------- CUENTAS DE FONDEO ----------
  {
    slug: 'reglas-fondeo',
    cat: 'funded', icon: '🏆',
    title: { es: 'Seguir las reglas de tu prop firm', en: 'Tracking your prop firm rules' },
    summary: {
      es: 'Configurar objetivo, pérdida diaria y total para que Onyx te avise antes.',
      en: 'Setting target, daily and total loss so Onyx warns you in time.',
    },
    cta: { href: '/dashboard', label: { es: 'Configurar mi cuenta', en: 'Configure my account' } },
    body: {
      es: [
        { p: 'En cada cuenta puedes marcar si es un challenge, una cuenta fondeada o capital propio, y meter los números de tu contrato: objetivo, pérdida máxima diaria y pérdida máxima total.' },
        { p: 'Con eso, el dashboard te muestra en todo momento cuánto te queda de margen y cuánto te falta para el objetivo, sin que tengas que calcularlo a mano cada mañana.' },
        { h: 'Y Onyx Guardian lo hace cumplir' },
        { p: 'Si además activas los límites en Onyx Guardian, no solo te informa: te para. Con el margen de seguridad que hayas elegido, para que nunca llegues al borde real.' },
        { note: 'La mayoría de cuentas de fondeo no se pierden por una mala racha, sino por una sola operación tomada con el límite ya casi tocado. Ahí es donde un freno automático vale lo que cuesta.', title: 'Dónde se pierden las cuentas' },
        { warn: 'Onyx no habla con tu prop firm. No sabemos tus reglas reales: usamos los números que tú metes. Si tu contrato cambia, tienes que actualizarlos aquí.' },
      ],
      en: [
        { p: 'On each account you can mark whether it is a challenge, a funded account or your own capital, and enter the numbers from your contract: target, maximum daily loss and maximum total loss.' },
        { p: 'With that, the dashboard shows at all times how much margin you have left and how far you are from the target, without you calculating it by hand every morning.' },
        { h: 'And Onyx Guardian enforces it' },
        { p: 'If you also turn on limits in Onyx Guardian, it does not just inform you: it stops you. With whatever safety margin you chose, so you never reach the real limit.' },
        { note: 'Most funded accounts are not lost to a bad streak, but to a single trade taken with the limit already nearly touched. That is where an automatic brake earns its keep.', title: 'Where accounts are lost' },
        { warn: 'Onyx does not talk to your prop firm. We do not know your real rules: we use the numbers you enter. If your contract changes, you have to update them here.' },
      ],
    },
  },
  {
    slug: 'varias-cuentas',
    cat: 'funded', icon: '🗂️',
    title: { es: 'Llevar varias cuentas a la vez', en: 'Running several accounts at once' },
    summary: {
      es: 'Portafolio conjunto, comparar cuentas y cómo funcionan los cupos.',
      en: 'Combined portfolio, comparing accounts and how slots work.',
    },
    body: {
      es: [
        { p: 'Puedes conectar tantas cuentas como permita tu plan: reales, demo, challenges y fondeadas. Cada una necesita su propia clave y su propio EA en un gráfico de ese terminal.' },
        { h: 'Cupos' },
        { p: 'Una clave activa ocupa un cupo. Si revocas una clave, el cupo se libera al instante y puedes usarlo para otra cuenta. El historial que ya subiste no se borra al revocar.' },
        { p: 'Si necesitas más cuentas de las que trae tu plan, puedes comprar cuentas extra como complemento en Mi cuenta, sin cambiar de plan.' },
        { h: 'Comparar' },
        { p: 'En el dashboard puedes ver el portafolio sumado o entrar cuenta por cuenta. La pantalla de comparación es útil para ver si de verdad operas igual en demo que en real — la respuesta suele ser que no.' },
      ],
      en: [
        { p: 'You can connect as many accounts as your plan allows: live, demo, challenges and funded. Each one needs its own key and its own EA on a chart in that terminal.' },
        { h: 'Slots' },
        { p: 'An active key takes one slot. If you revoke a key the slot frees immediately and you can use it for another account. The history you already uploaded is not deleted when you revoke.' },
        { p: 'If you need more accounts than your plan includes, you can buy extra accounts as an add-on in My account, without changing plan.' },
        { h: 'Comparing' },
        { p: 'On the dashboard you can see the combined portfolio or go account by account. The comparison screen is useful to see whether you really trade the same on demo as on live — the answer is usually no.' },
      ],
    },
  },

  // ---------- TU CUENTA ----------
  {
    slug: 'planes-y-pagos',
    cat: 'account', icon: '💳',
    title: { es: 'Planes, cambios y cancelación', en: 'Plans, changes and cancellation' },
    summary: {
      es: 'Subir, bajar, pausar o cancelar, y qué pasa con tus datos.',
      en: 'Upgrade, downgrade, pause or cancel, and what happens to your data.',
    },
    cta: { href: '/account', label: { es: 'Ir a Mi cuenta', en: 'Go to My account' } },
    body: {
      es: [
        { p: 'Todo se gestiona desde Mi cuenta. Puedes cambiar de plan cuando quieras: al subir se cobra la diferencia proporcional, al bajar se aplica al siguiente ciclo.' },
        { h: 'Si te vas' },
        { p: 'Antes de cancelar te ofrecemos alternativas reales: un descuento temporal, pausar la suscripción unos meses, o bajar a un plan más barato. No es un truco para retenerte — a veces lo que necesitas es parar un tiempo, no irte del todo.' },
        { p: 'Si aun así cancelas, mantienes el acceso hasta el final del periodo que ya pagaste. Tus datos siguen ahí por si vuelves.' },
        { h: 'Borrar la cuenta' },
        { p: 'Es distinto de cancelar. Borrar elimina tu cuenta y tus operaciones de forma permanente, y no se puede deshacer. Por eso te pedimos escribirlo a mano para confirmar.' },
        { warn: 'Si bajas a un plan con menos cuentas de las que tienes conectadas, las que sobren dejarán de sincronizar. Revoca las que no uses antes de bajar.' },
      ],
      en: [
        { p: 'Everything is managed from My account. You can change plan whenever you want: upgrading charges the prorated difference, downgrading applies from the next cycle.' },
        { h: 'If you leave' },
        { p: 'Before cancelling we offer real alternatives: a temporary discount, pausing the subscription for a few months, or moving to a cheaper plan. It is not a trick to keep you — sometimes what you need is to stop for a while, not leave entirely.' },
        { p: 'If you cancel anyway, you keep access until the end of the period you already paid for. Your data stays there in case you come back.' },
        { h: 'Deleting your account' },
        { p: 'That is different from cancelling. Deleting removes your account and your trades permanently, and cannot be undone. That is why we ask you to type it out to confirm.' },
        { warn: 'If you downgrade to a plan with fewer accounts than you have connected, the extra ones will stop syncing. Revoke the ones you do not use before downgrading.' },
      ],
    },
  },
  {
    slug: 'privacidad-seguridad',
    cat: 'account', icon: '🔒',
    title: { es: 'Qué datos guardamos y qué no', en: 'What data we keep and what we do not' },
    summary: {
      es: 'Sin contraseñas de bróker, sin acceso a tu dinero. Aquí está el detalle.',
      en: 'No broker passwords, no access to your money. Here is the detail.',
    },
    body: {
      es: [
        { h: 'Lo que guardamos' },
        { list: [
          'Tus operaciones cerradas: par, dirección, volumen, precios, horas y costes.',
          'Datos básicos de la cuenta: número, bróker, servidor, balance y equity.',
          'Lo que tú escribas: notas del diario, etiquetas y configuración.',
        ] },
        { h: 'Lo que no tenemos' },
        { list: [
          'Tu contraseña de MetaTrader. No la pedimos y no nos sirve.',
          'La contraseña de inversor. Tampoco.',
          'Capacidad de retirar, transferir o mover tu dinero. El EA no puede hacerlo aunque quisiera.',
        ] },
        { h: 'Los pagos' },
        { p: 'Los procesa Stripe. Los datos de tu tarjeta nunca pasan por nuestros servidores ni los guardamos.' },
        { note: 'El EA solo tiene permiso para gestionar operaciones existentes: mover stops y cerrar. No puede abrir posiciones ni tocar fondos.', title: 'Qué puede hacer el EA' },
      ],
      en: [
        { h: 'What we store' },
        { list: [
          'Your closed trades: pair, direction, volume, prices, times and costs.',
          'Basic account data: number, broker, server, balance and equity.',
          'Whatever you write: journal notes, tags and settings.',
        ] },
        { h: 'What we do not have' },
        { list: [
          'Your MetaTrader password. We do not ask for it and it would be useless to us.',
          'The investor password. Not that either.',
          'Any ability to withdraw, transfer or move your money. The EA could not do it even if it wanted to.',
        ] },
        { h: 'Payments' },
        { p: 'Handled by Stripe. Your card details never pass through our servers and we do not store them.' },
        { note: 'The EA is only allowed to manage existing trades: move stops and close. It cannot open positions or touch funds.', title: 'What the EA can do' },
      ],
    },
  },

  // ---------- AVISOS Y SOPORTE ----------
  {
    slug: 'avisos-telegram',
    cat: 'alerts', icon: '📣', cover: '/guia/notificaciones.svg',
    title: { es: 'Avisos por Telegram', en: 'Telegram alerts' },
    summary: {
      es: 'Recibe en el móvil lo importante: límites, EA caído, resumen del día e informe semanal.',
      en: 'Get what matters on your phone: limits, EA down, daily summary and weekly report.',
    },
    cta: { href: '/account', label: { es: 'Conectar Telegram', en: 'Connect Telegram' } },
    body: {
      es: [
        { p: 'Onyx puede avisarte por Telegram sin que tengas que abrir la web. Vinculas tu cuenta una vez y eliges qué avisos quieres recibir.' },
        { h: 'Cómo se conecta' },
        { walk: [
          { t: 'Abre Conectar Telegram', d: 'En Mi cuenta → Avisos, pulsa "Conectar Telegram". Si es la primera vez, te pedirá abrir la app de Telegram.' },
          { t: 'Pulsa Iniciar en el bot', d: 'Se abre el bot de Onyx con un código de vinculación ya escrito. Solo tienes que pulsar el botón Iniciar (o /start): no tecleas nada.', img: '/guia/tg-start.svg', alt: 'El bot de Telegram abierto con el código puesto y el botón Iniciar' },
          { t: 'Listo, ya estás vinculado', d: 'El bot te confirma con un mensaje. A partir de ahí recibes los avisos que tengas encendidos en Mi cuenta → Avisos.' },
        ] },
        { h: 'Qué te puede avisar' },
        { list: [
          'Cuando Onyx Guardian te frena o cierra una operación por tu plan.',
          'Cuando te acercas a un límite de fondeo, antes de tocarlo.',
          'Si tu EA deja de reportar (MetaTrader cerrado o sin conexión).',
          'Un resumen del día y un informe del rendimiento cada domingo.',
        ] },
        { h: 'Comandos' },
        { list: [
          '/estado — resumen rápido de las últimas 24 horas.',
          '/informe — tu semana: resultado, aciertos, mejor par y disciplina.',
          '/stop — dejar de recibir avisos (puedes reconectar cuando quieras).',
        ] },
        { note: 'Cada aviso respeta tus interruptores: enciendes solo los que quieres y apagas el resto desde Mi cuenta → Avisos.', title: 'Tú decides qué llega' },
        { warn: 'Los avisos por Telegram forman parte del plan Elite. Si tu plan cambia, dejan de enviarse, pero tu vínculo se conserva por si vuelves.' },
      ],
      en: [
        { p: 'Onyx can alert you on Telegram without you opening the web. You link your account once and choose which alerts you want.' },
        { h: 'How to connect' },
        { walk: [
          { t: 'Open Connect Telegram', d: 'In My account → Alerts, tap "Connect Telegram". The first time, it will ask to open the Telegram app.' },
          { t: 'Tap Start in the bot', d: 'The Onyx bot opens with a linking code already typed. You just tap the Start button (or /start): you type nothing.', img: '/guia/tg-start.svg', alt: 'The Telegram bot open with the code filled in and the Start button' },
          { t: 'Done, you are linked', d: 'The bot confirms with a message. From then on you get the alerts you have turned on in My account → Alerts.' },
        ] },
        { h: 'What it can alert you about' },
        { list: [
          'When Onyx Guardian stops or closes a trade because of your plan.',
          'When you approach a funding limit, before you hit it.',
          'If your EA stops reporting (MetaTrader closed or offline).',
          'A daily summary and a performance report every Sunday.',
        ] },
        { h: 'Commands' },
        { list: [
          '/estado — quick summary of the last 24 hours.',
          '/informe — your week: result, win rate, best pair and discipline.',
          '/stop — stop receiving alerts (you can reconnect anytime).',
        ] },
        { note: 'Every alert respects your switches: turn on only the ones you want and turn off the rest from My account → Alerts.', title: 'You decide what arrives' },
        { warn: 'Telegram alerts are part of the Elite plan. If your plan changes they stop, but your link is kept in case you come back.' },
      ],
    },
  },
  {
    slug: 'soporte-onyx-ai',
    cat: 'alerts', icon: '💬',
    title: { es: 'Pedir ayuda: Onyx AI y soporte', en: 'Getting help: Onyx AI and support' },
    summary: {
      es: 'Respuestas al instante con la IA, y una persona del equipo cuando de verdad hace falta.',
      en: 'Instant answers from the AI, and a real person when you actually need one.',
    },
    cta: { href: '/dashboard/soporte', label: { es: 'Abrir el soporte', en: 'Open support' } },
    body: {
      es: [
        { p: 'En cualquier pantalla tienes la burbuja de ayuda abajo a la derecha. La abre y le preguntas en tu idioma; Onyx AI responde al instante usando esta misma guía.' },
        { h: 'Onyx AI' },
        { p: 'Es una IA que responde solo con lo que sabe de Onyx: cómo conectar, qué significa una métrica, cómo configurar el Guardian, precios y planes. No inventa: si algo no lo sabe, te lo dice y te pasa con una persona.' },
        { h: 'Hablar con una persona' },
        { p: 'Si prefieres a alguien del equipo, abres un ticket desde el Centro de soporte. Te respondemos por correo, y si hay alguien disponible en ese momento, el chat lo indica en vivo.' },
        { note: 'Aunque no tengas cuenta todavía, puedes preguntar desde la burbuja y dejar tu correo: te contestamos igual.', title: 'También sin cuenta' },
        { h: 'Antes de escribir' },
        { p: 'Muchas dudas ya están resueltas aquí en la guía, con el buscador de arriba. Si tu problema es que el EA no sincroniza, mira primero el artículo de instalación: casi siempre es una de cuatro cosas.' },
      ],
      en: [
        { p: 'On any screen you have the help bubble at the bottom right. Open it and ask in your language; Onyx AI answers instantly using this same guide.' },
        { h: 'Onyx AI' },
        { p: 'It is an AI that answers only with what it knows about Onyx: how to connect, what a metric means, how to set up the Guardian, prices and plans. It does not make things up: if it does not know, it tells you and hands you to a person.' },
        { h: 'Talking to a person' },
        { p: 'If you prefer someone from the team, open a ticket from the Support center. We reply by email, and if someone is available at that moment, the chat shows it live.' },
        { note: 'Even without an account yet, you can ask from the bubble and leave your email: we reply all the same.', title: 'Also without an account' },
        { h: 'Before you write' },
        { p: 'Many questions are already answered here in the guide, with the search at the top. If your problem is the EA not syncing, check the install article first: it is almost always one of four things.' },
      ],
    },
  },
  {
    slug: 'programa-embajadores',
    cat: 'account', icon: '🎁',
    title: { es: 'Programa de embajadores', en: 'Ambassador program' },
    summary: {
      es: 'Gana una comisión recurrente por cada persona que traigas, y dale un descuento a tu gente.',
      en: 'Earn a recurring commission for everyone you bring, and give your people a discount.',
    },
    cta: { href: '/embajadores', label: { es: 'Ver el programa', en: 'See the program' } },
    body: {
      es: [
        { p: 'Si tienes comunidad de traders, puedes convertirte en embajador de Onyx. Recibes un enlace y un cupón: quien se suscriba con él consigue un descuento, y tú cobras una comisión recurrente mientras siga siendo cliente.' },
        { h: 'Cómo funciona' },
        { list: [
          'Solicitas entrar desde la página de embajadores y te aprobamos.',
          'Compartes tu enlace o tu cupón con tu audiencia.',
          'Ganas un porcentaje de cada suscripción activa que traigas, mes a mes.',
        ] },
        { h: 'Niveles' },
        { p: 'Empiezas en el nivel base. Cuando superas cierto número de suscriptores activos, subes a Oro y tu porcentaje aumenta. Todo lo ves en tu panel de embajador: clics, registros, activos y cuánto llevas ganado.' },
        { h: 'Cobros' },
        { p: 'Las comisiones pasan por un periodo de retención (por si hay reembolsos) y luego quedan disponibles para retirar a partir de un mínimo. Eliges tu método de pago en tu panel.' },
        { warn: 'Las comisiones se generan solo con suscripciones reales y activas. Los reembolsos y las bajas dentro del periodo de retención no cuentan.' },
      ],
      en: [
        { p: 'If you have a trading community, you can become an Onyx ambassador. You get a link and a coupon: whoever subscribes with it gets a discount, and you earn a recurring commission for as long as they stay a customer.' },
        { h: 'How it works' },
        { list: [
          'You apply from the ambassadors page and we approve you.',
          'You share your link or coupon with your audience.',
          'You earn a percentage of every active subscription you bring, month after month.',
        ] },
        { h: 'Tiers' },
        { p: 'You start at the base tier. Once you pass a certain number of active subscribers you move up to Gold and your percentage increases. You see everything in your ambassador panel: clicks, signups, active users and how much you have earned.' },
        { h: 'Payouts' },
        { p: 'Commissions go through a hold period (in case of refunds) and then become available to withdraw above a minimum. You choose your payout method in your panel.' },
        { warn: 'Commissions are generated only from real, active subscriptions. Refunds and cancellations within the hold period do not count.' },
      ],
    },
  },
  {
    slug: 'precios-planes',
    cat: 'account', icon: '💳',
    title: { es: 'Precios y planes', en: 'Pricing and plans' },
    summary: {
      es: 'Qué incluye cada plan, mensual o anual, y cómo cambiar de plan.',
      en: 'What each plan includes, monthly or yearly, and how to change plans.',
    },
    cta: { href: '/pricing', label: { es: 'Ver precios', en: 'See pricing' } },
    body: {
      es: [
        { p: 'Onyx tiene varios planes para que pagues solo por lo que necesitas. El precio siempre actualizado está en la página de precios; ahí ves cada plan con su importe y lo que incluye.' },
        { h: 'Qué cambia entre planes' },
        { list: [
          'Cuántas cuentas de MetaTrader puedes conectar a la vez.',
          'Qué funciones de Onyx Guardian tienes (límites, protección de ganancias, aviso de noticias).',
          'Copy trading entre tus cuentas y cuántas maestras/esclavas.',
          'Alertas por Telegram y otros extras.',
        ] },
        { h: 'Mensual o anual' },
        { p: 'Puedes pagar mes a mes o de forma anual. El plan anual sale más barato que pagar 12 meses sueltos.' },
        { h: 'Empezar gratis' },
        { p: 'Puedes crear tu cuenta gratis y probar Onyx antes de suscribirte. Cuando quieras más cuentas o más funciones, subes de plan.' },
        { h: 'Cambiar de plan' },
        { p: 'Se hace desde Mi cuenta → Suscripción. Subir de plan es inmediato. Bajar de plan se aplica al final del periodo que ya pagaste: no pierdes lo que pagaste y conservas las funciones hasta que termine.' },
        { warn: 'Los precios pueden cambiar con el tiempo. El importe que manda siempre es el que ves en la página de precios.' },
      ],
      en: [
        { p: 'Onyx has several plans so you pay only for what you need. The always‑current price is on the pricing page; there you see each plan with its amount and what it includes.' },
        { h: 'What changes between plans' },
        { list: [
          'How many MetaTrader accounts you can connect at once.',
          'Which Onyx Guardian features you get (limits, profit protection, news warning).',
          'Copy trading between your accounts and how many masters/slaves.',
          'Telegram alerts and other extras.',
        ] },
        { h: 'Monthly or yearly' },
        { p: 'You can pay month to month or yearly. The yearly plan is cheaper than paying 12 separate months.' },
        { h: 'Start free' },
        { p: 'You can create your account for free and try Onyx before subscribing. When you want more accounts or features, you upgrade.' },
        { h: 'Changing plans' },
        { p: 'You do it from My account → Subscription. Upgrading is immediate. Downgrading applies at the end of the period you already paid: you do not lose what you paid and you keep the features until it ends.' },
        { warn: 'Prices can change over time. The amount that always applies is the one you see on the pricing page.' },
      ],
    },
  },

  // ---------- cTrader ----------
  {
    slug: 'conectar-ctrader',
    cat: 'start', icon: '🔌', cover: '/guia/ctrader.svg',
    title: { es: 'Conectar tu cuenta de cTrader', en: 'Connecting your cTrader account' },
    summary: {
      es: 'En cTrader no se usa un EA sino un cBot. Es el mismo Onyx, escrito para cTrader.',
      en: 'In cTrader you don\'t use an EA but a cBot. Same Onyx, written for cTrader.',
    },
    cta: { href: '/dashboard/keys?platform=ctrader', label: { es: 'Conectar cTrader', en: 'Connect cTrader' } },
    body: {
      es: [
        { p: 'Onyx funciona igual en cTrader que en MetaTrader: lee tus operaciones en solo lectura, nunca opera ni toca tu dinero. La diferencia es que en cTrader el conector se llama cBot (en MetaTrader es EA), pero hace lo mismo.' },
        { h: 'Pasos' },
        { walk: [
          { t: 'Elige la plataforma cTrader', d: 'En Onyx, en Conectar cuenta, selecciona cTrader. Verás el botón para descargar el conector y el sitio donde crear tu clave API.' },
          { t: 'Descarga el cBot de Onyx', d: 'Baja el conector: el archivo .algo (listo para usar) o el código .cs si prefieres compilarlo tú. Guárdalo a mano.' },
          { t: 'Añádelo en Automate', d: 'Abre cTrader Desktop y ve a la pestaña Automate. Importa o pega el cBot de Onyx, compílalo y arrástralo a cualquier gráfico.' },
          { t: 'Pega tu clave y pulsa Play', d: 'En los parámetros del cBot pega tu clave API de Onyx. Asegúrate de que el botón global de automatización de cTrader está activado, y pulsa Play.', tip: 'Si Play está en gris, activa primero el interruptor global de automatización arriba a la derecha de cTrader.' },
        ] },
        { note: 'Cuando el cBot reporte, tu cuenta aparecerá conectada y verás tus estadísticas en segundos.', title: 'Confirmación' },
        { p: 'El Onyx Guardian y el copy trading también existen para cTrader, como cBots separados, con los mismos ajustes que en MetaTrader.' },
      ],
      en: [
        { p: 'Onyx works the same on cTrader as on MetaTrader: it reads your trades read-only, never trades or touches your money. The difference is that in cTrader the connector is a cBot (in MetaTrader it\'s an EA), but it does the same thing.' },
        { h: 'Steps' },
        { walk: [
          { t: 'Pick the cTrader platform', d: 'In Onyx, on Connect account, select cTrader. You will see the button to download the connector and where to create your API key.' },
          { t: 'Download the Onyx cBot', d: 'Grab the connector: the .algo file (ready to use) or the .cs source if you prefer compiling it yourself. Keep it handy.' },
          { t: 'Add it in Automate', d: 'Open cTrader Desktop and go to the Automate tab. Import or paste the Onyx cBot, compile it and drag it onto any chart.' },
          { t: 'Paste your key and hit Play', d: 'In the cBot parameters paste your Onyx API key. Make sure cTrader’s global automation button is on, and hit Play.', tip: 'If Play is greyed out, first turn on the global automation switch at the top right of cTrader.' },
        ] },
        { note: 'When the cBot reports, your account shows as connected and your stats appear in seconds.', title: 'Confirmation' },
        { p: 'Onyx Guardian and copy trading also exist for cTrader, as separate cBots, with the same settings as on MetaTrader.' },
      ],
    },
  },

  // ---------- TradingView → EA ----------
  {
    slug: 'tradingview-senales',
    cat: 'start', icon: '📈', cover: '/guia/tradingview.svg',
    title: { es: 'TradingView → Onyx: ejecutar tus alertas', en: 'TradingView → Onyx: execute your alerts' },
    summary: {
      es: 'Haz que tus alertas de TradingView abran la operación en tu cuenta real, solas.',
      en: 'Make your TradingView alerts open the trade in your real account, automatically.',
    },
    cta: { href: '/dashboard/tradingview', label: { es: 'Ir a TradingView', en: 'Go to TradingView' } },
    body: {
      es: [
        { p: 'Onyx puede recibir las alertas de TradingView por webhook y ejecutarlas en tu cuenta real usando el EA de Copy que ya tienes instalado. No hace falta cambiar el EA.' },
        { h: 'Qué necesitas' },
        { list: [
          'Una cuenta conectada con el EA de Copy (OnyxCopySlave) corriendo.',
          'Un plan que incluya TradingView.',
          'Una cuenta de TradingView de pago (los webhooks no están en su plan gratis).',
        ] },
        { h: 'Pasos' },
        { walk: [
          { t: 'Activa TradingView en Onyx', d: 'En Onyx entra en TradingView y enciende la función para tu cuenta. Te dará una URL de webhook y un mensaje JSON únicos, tuyos.' },
          { t: 'Pega tu URL de webhook', d: 'Al crear una alerta en TradingView, ve a la pestaña Notificaciones, marca "Webhook URL" y pega la URL que te dio Onyx.', img: '/guia/tv-webhook.svg', alt: 'Campo Webhook URL de una alerta de TradingView con la URL de Onyx pegada' },
          { t: 'Pega el mensaje JSON', d: 'Copia el mensaje JSON de Onyx y pégalo en el campo "Mensaje" de la alerta. Ese texto le dice a Onyx qué operar y en qué sentido.' },
          { t: 'Fija tus límites', d: 'En Onyx pon tu lote por defecto, tu lote máximo y los símbolos permitidos. Así una señal nunca abre más de lo que tú decides.' },
          { t: 'Manda una señal de prueba', d: 'Dispara la alerta una vez para comprobar que la operación entra en tu cuenta con tu Guardian y tu Stop Loss aplicados.', tip: 'La ejecución respeta tu Guardian: si estás en tu límite del día, la señal no abre.' },
        ] },
        { note: '🛡️ El Onyx Guardian sigue vigilando esa cuenta: si tu pérdida diaria está alcanzada, el EA no abrirá aunque llegue la señal.', title: 'Seguridad' },
        { warn: 'El token del webhook no es la clave del EA. Si se filtra, solo permite mandar señales con tope de lote, y lo puedes rotar con un clic.' },
      ],
      en: [
        { p: 'Onyx can receive TradingView alerts via webhook and execute them in your real account using the Copy EA you already have installed. No need to change the EA.' },
        { h: 'What you need' },
        { list: [
          'A connected account with the Copy EA (OnyxCopySlave) running.',
          'A plan that includes TradingView.',
          'A paid TradingView account (webhooks aren\'t in their free plan).',
        ] },
        { h: 'Steps' },
        { walk: [
          { t: 'Enable TradingView in Onyx', d: 'In Onyx open TradingView and turn it on for your account. It gives you a unique webhook URL and JSON message, yours only.' },
          { t: 'Paste your webhook URL', d: 'When creating an alert in TradingView, go to the Notifications tab, tick "Webhook URL" and paste the URL Onyx gave you.', img: '/guia/tv-webhook.svg', alt: 'Webhook URL field of a TradingView alert with the Onyx URL pasted' },
          { t: 'Paste the JSON message', d: 'Copy the JSON message from Onyx and paste it into the alert’s "Message" field. That text tells Onyx what to trade and in which direction.' },
          { t: 'Set your limits', d: 'In Onyx set your default lot, your max lot and the allowed symbols. That way a signal never opens more than you decide.' },
          { t: 'Send a test signal', d: 'Fire the alert once to check the trade lands in your account with your Guardian and Stop Loss applied.', tip: 'Execution respects your Guardian: if you are at your daily limit, the signal will not open.' },
        ] },
        { note: '🛡️ Onyx Guardian still watches that account: if your daily loss is hit, the EA won\'t open even if a signal arrives.', title: 'Safety' },
        { warn: 'The webhook token isn\'t the EA key. If leaked, it only allows sending signals with a lot cap, and you can rotate it with one click.' },
      ],
    },
  },

  // ---------- ONYX ACADEMY ----------
  {
    slug: 'academia-que-es',
    cat: 'academy', icon: '🎓',
    title: { es: 'Qué es Onyx Academy', en: 'What Onyx Academy is' },
    summary: {
      es: 'Una plataforma para que traders con experiencia creen su propia academia y comunidad, y para que los alumnos aprendan en un solo sitio.',
      en: 'A platform for experienced traders to build their own academy and community, and for students to learn all in one place.',
    },
    cta: { href: '/dashboard/academy', label: { es: 'Ir a Onyx Academy', en: 'Go to Onyx Academy' } },
    body: {
      es: [
        { p: 'Onyx Academy es el espacio de formación dentro de Onyx. Un mentor (un trader con experiencia) monta su propia academia con marca propia: cursos en vídeo, clases en vivo, una comunidad tipo foro y, si quiere, membresía de pago. Los alumnos entran, aprenden, participan y siguen su progreso.' },
        { h: 'Dos roles' },
        { list: [
          'Mentor: crea y gestiona la academia (cursos, clases, comunidad, precios y cobros).',
          'Alumno: se inscribe, ve los cursos, entra a las clases en vivo y participa en la comunidad.',
        ] },
        { h: 'Qué incluye' },
        { list: [
          'Cursos con secciones y lecciones (vídeo, PDF y notas), con progreso guardado.',
          'Clases en vivo por Zoom/Meet/YouTube, con calendario y cuenta regresiva.',
          'Comunidad con publicaciones, likes, puntos y niveles (estilo comunidad).',
          'Membresía de pago opcional, cupones y certificados al terminar.',
        ] },
        { note: 'Cada academia tiene su propia página pública (con su nombre, logo y portada). El alumno la ve como una marca independiente, aunque por dentro corre sobre Onyx.', title: 'Marca propia' },
        { warn: 'Onyx Academy es formación y comunidad. No es señales de compra/venta ni promete rentabilidad; el contenido lo pone cada mentor bajo su responsabilidad.' },
      ],
      en: [
        { p: 'Onyx Academy is the learning space inside Onyx. A mentor (an experienced trader) builds their own branded academy: video courses, live classes, a forum-style community and, if they want, a paid membership. Students join, learn, take part and track their progress.' },
        { h: 'Two roles' },
        { list: [
          'Mentor: creates and runs the academy (courses, classes, community, pricing and payouts).',
          'Student: enrolls, watches courses, joins live classes and takes part in the community.',
        ] },
        { h: 'What it includes' },
        { list: [
          'Courses with sections and lessons (video, PDF and notes), with saved progress.',
          'Live classes via Zoom/Meet/YouTube, with a calendar and countdown.',
          'A community with posts, likes, points and levels (community-style).',
          'Optional paid membership, coupons and certificates on completion.',
        ] },
        { note: 'Each academy has its own public page (with its name, logo and cover). Students see it as an independent brand, even though it runs on Onyx underneath.', title: 'Own brand' },
        { warn: 'Onyx Academy is education and community. It is not buy/sell signals and does not promise profits; each mentor is responsible for their own content.' },
      ],
    },
  },
  {
    slug: 'academia-crear-mentor',
    cat: 'academy', icon: '🧑‍🏫', cover: '/guia/academia-mentor.svg',
    title: { es: 'Montar tu academia (mentor)', en: 'Set up your academy (mentor)' },
    summary: {
      es: 'De cero a publicada: nombre y marca, cursos, clases en vivo y comunidad.',
      en: 'From zero to live: name and brand, courses, live classes and community.',
    },
    cta: { href: '/dashboard/academy', label: { es: 'Crear mi academia', en: 'Create my academy' } },
    body: {
      es: [
        { p: 'Desde el dashboard entras a Onyx Academy y creas tu academia con un asistente. Puedes tenerla lista en minutos y mejorarla con calma después.' },
        { h: 'Paso a paso' },
        { walk: [
          { t: 'Ponle nombre y lema', d: 'Dale a tu academia un nombre claro y una frase corta que diga a quién ayudas. Es lo primero que ve tu alumno.' },
          { t: 'Sube tu logo y portada', d: 'Sube tu logo y una imagen de portada. A partir de ahí todo se ve con tu marca (nombre, colores), no con la de Onyx.' },
          { t: 'Crea tu primer curso', d: 'Añade un curso, divídelo en secciones y, dentro, mete lecciones con vídeo (YouTube, Vimeo o .mp4), PDF y notas. El alumno ve su progreso a medida que avanza.' },
          { t: 'Programa una clase en vivo', d: 'Desde el calendario, pega tu enlace de Zoom/Meet o YouTube Live y elige día y hora. Puedes marcar varios días de golpe para una serie de clases.' },
          { t: 'Comparte tu enlace público', d: 'Copia el enlace público de tu academia y compártelo. Cualquiera puede entrar a ver la portada y apuntarse a tus niveles.' },
        ] },
        { h: 'Clases en vivo' },
        { p: 'El alumno ve una cuenta regresiva y un aviso EN VIVO cuando empiezas. Cada uno la ve en SU hora local. Después puedes añadir la grabación al mismo evento.' },
        { h: 'Comunidad' },
        { p: 'Tu academia trae un muro donde tú y los alumnos publican, dan like y suben de nivel con puntos. Ayuda a que la gente se quede y participe.' },
        { note: 'Tienes moderación: puedes fijar reglas, revisar publicaciones reportadas, borrar comentarios y gestionar a los alumnos (renombrar, silenciar o quitar).', title: 'Control' },
        { warn: 'Antes de invitar gente, prueba tú mismo el flujo con una cuenta de alumno: inscríbete, entra a una clase de prueba y revisa que todo se vea bien.' },
      ],
      en: [
        { p: 'From the dashboard you open Onyx Academy and create your academy with a wizard. You can have it ready in minutes and polish it later.' },
        { h: 'Step by step' },
        { steps: [
          'Name your academy and add a short tagline.',
          'Upload your logo and a cover (so it shows your brand, not Onyx\'s).',
          'Create your first course: add sections and, inside, lessons with video (YouTube/Vimeo/.mp4), PDF and notes.',
          'Schedule a live class from the calendar: paste your Zoom/Meet or YouTube Live link and pick day and time. You can mark several days at once.',
          'Share your academy\'s public link so people can join.',
        ] },
        { h: 'Live classes' },
        { p: 'Students see a countdown and a LIVE banner when you start. Each one sees it in THEIR local time. Afterwards you can add the replay to the same event.' },
        { h: 'Community' },
        { p: 'Your academy comes with a feed where you and your students post, like and level up with points. It helps people stick around and take part.' },
        { note: 'You have moderation: set rules, review reported posts, delete comments and manage students (rename, mute or remove).', title: 'Control' },
        { warn: 'Before inviting people, try the flow yourself with a student account: enroll, join a test class and check everything looks right.' },
      ],
    },
  },
  {
    slug: 'academia-cobrar-mentor',
    cat: 'academy', icon: '💳',
    title: { es: 'Cobrar por tu academia (mentor)', en: 'Charge for your academy (mentor)' },
    summary: {
      es: 'Membresía de pago, cobros con Stripe, cupones, certificados y afiliados.',
      en: 'Paid membership, Stripe payouts, coupons, certificates and affiliates.',
    },
    cta: { href: '/dashboard/academy', label: { es: 'Configurar cobros', en: 'Set up payments' } },
    body: {
      es: [
        { p: 'Puedes ofrecer tu academia gratis o de pago. Para cobrar, conectas tu cuenta de Stripe (Stripe Connect): el dinero de tus alumnos entra en TU cuenta de Stripe, no en la de Onyx.' },
        { h: 'Poner precio' },
        { list: [
          'Defines el precio de la membresía (mensual y/o anual) en dólares.',
          'Puedes abrir o cerrar las inscripciones cuando quieras.',
          'Puedes crear cupones de descuento para campañas o para tu comunidad.',
        ] },
        { h: 'Cobros y comisión' },
        { p: 'Los pagos se procesan con Stripe. Onyx aplica una comisión de plataforma sobre las ventas (el porcentaje lo ves en tu panel). Las comisiones de Stripe y esa comisión se descuentan automáticamente; el resto llega a tu Stripe.' },
        { h: 'Afiliados' },
        { p: 'Puedes activar un programa de afiliados: tus alumnos comparten su enlace y ganan una comisión por cada suscriptor que traigan. Tú fijas el porcentaje y ves los pagos pendientes y hechos en tu panel.' },
        { h: 'Certificados' },
        { p: 'Al terminar un curso, el alumno recibe un certificado con el nombre de TU academia.' },
        { note: 'Todo esto se gestiona desde el panel de la academia (Cobros y Afiliados). No necesitas saber de programación.', title: 'Dónde' },
        { warn: 'Cumplir las leyes fiscales y las condiciones de Stripe de tu país es tu responsabilidad. Onyx te da la herramienta de cobro, no asesoría fiscal.' },
      ],
      en: [
        { p: 'You can offer your academy free or paid. To charge, you connect your Stripe account (Stripe Connect): your students\' money goes into YOUR Stripe account, not Onyx\'s.' },
        { h: 'Set a price' },
        { list: [
          'Set the membership price (monthly and/or yearly) in US dollars.',
          'Open or close enrollments whenever you want.',
          'Create discount coupons for campaigns or for your community.',
        ] },
        { h: 'Payouts and fee' },
        { p: 'Payments are processed by Stripe. Onyx applies a platform fee on sales (you see the percentage in your panel). Stripe\'s fees and that fee are deducted automatically; the rest lands in your Stripe.' },
        { h: 'Affiliates' },
        { p: 'You can turn on an affiliate program: your students share their link and earn a commission for every subscriber they bring. You set the percentage and see pending and paid amounts in your panel.' },
        { h: 'Certificates' },
        { p: 'When a student finishes a course, they get a certificate with YOUR academy\'s name.' },
        { note: 'All of this is managed from the academy panel (Payments and Affiliates). No coding needed.', title: 'Where' },
        { warn: 'Complying with tax laws and Stripe\'s terms in your country is your responsibility. Onyx gives you the payment tool, not tax advice.' },
      ],
    },
  },
  {
    slug: 'academia-alumno',
    cat: 'academy', icon: '👩‍🎓',
    title: { es: 'Usar la academia (alumno)', en: 'Using the academy (student)' },
    summary: {
      es: 'Inscribirte, ver cursos, entrar a las clases en vivo, participar y tu certificado.',
      en: 'Enroll, watch courses, join live classes, take part and your certificate.',
    },
    cta: { href: '/dashboard/academy', label: { es: 'Ir a la academia', en: 'Go to the academy' } },
    body: {
      es: [
        { p: 'Entras a una academia desde su enlace público o desde Onyx Academy en tu dashboard. Si es gratis, te inscribes al momento; si es de pago, pagas la membresía con tarjeta (seguro, con Stripe) y ya tienes acceso.' },
        { h: 'Qué puedes hacer' },
        { list: [
          'Ver los cursos: avanzas por secciones y lecciones, y tu progreso se guarda solo.',
          'Entrar a las clases en vivo: verás una cuenta regresiva y un botón "Entrar EN VIVO" cuando empiecen (en tu hora local). Si hay grabación, queda disponible después.',
          'Participar en la comunidad: publicar, dar like y subir de nivel con puntos.',
          'Recibir tu certificado al completar un curso.',
        ] },
        { h: 'Tu perfil' },
        { p: 'Puedes poner tu nombre y foto. El mentor puede moderar la comunidad, así que participa con respeto.' },
        { note: 'Cada academia es de su mentor. Las dudas del contenido se las haces al mentor dentro de la comunidad; las dudas de la plataforma (pagos, acceso) las puedes preguntar a Onyx AI o a soporte.', title: 'A quién preguntar' },
        { warn: 'Antes de pagar una membresía, revisa qué incluye y la política del mentor. Onyx procesa el pago, pero el contenido y las condiciones los define cada academia.' },
      ],
      en: [
        { p: 'You enter an academy from its public link or from Onyx Academy in your dashboard. If it\'s free, you enroll instantly; if it\'s paid, you pay the membership by card (securely, with Stripe) and you\'re in.' },
        { h: 'What you can do' },
        { list: [
          'Watch courses: move through sections and lessons, and your progress saves automatically.',
          'Join live classes: you\'ll see a countdown and a "Join LIVE" button when they start (in your local time). If there\'s a replay, it stays available afterwards.',
          'Take part in the community: post, like and level up with points.',
          'Get your certificate when you complete a course.',
        ] },
        { h: 'Your profile' },
        { p: 'You can set your name and photo. The mentor can moderate the community, so take part respectfully.' },
        { note: 'Each academy belongs to its mentor. Ask content questions to the mentor inside the community; ask platform questions (payments, access) to Onyx AI or support.', title: 'Who to ask' },
        { warn: 'Before paying a membership, check what it includes and the mentor\'s policy. Onyx processes the payment, but each academy defines its content and terms.' },
      ],
    },
  },
  {
    slug: 'copy-sin-baneos',
    cat: 'funded', icon: '🛡️',
    title: { es: 'Copy trading sin baneos: buenas prácticas anti-baneo', en: 'Copy trading without bans: anti-ban best practices' },
    summary: {
      es: 'Cómo evita Onyx la huella de IP compartida y qué tienes que hacer tú (VPS/IP por cuenta, reglas de la firma) para no arriesgar tu fondeo.',
      en: 'How Onyx avoids a shared-IP fingerprint and what you must do (VPS/IP per account, firm rules) to protect your funded account.',
    },
    cta: { href: '/dashboard/copy', label: { es: 'Ir a Copy trading', en: 'Go to Copy trading' } },
    body: {
      es: [
        { p: 'Muchas prop firms banean cuentas por "problemas de IP": cuando detectan varias cuentas operando desde la misma IP, o copia entre cuentas por un patrón de tiempo idéntico. Aquí va cómo lo maneja el copiador de Onyx y qué depende de ti.' },
        { h: 'Onyx no centraliza la ejecución' },
        { p: 'La nube de Onyx solo transmite la señal (qué se abrió o cerró). La orden real al bróker la ejecuta el Onyx Connect corriendo en TU terminal (tu PC o tu VPS). La operación le llega a la firma desde la IP de esa terminal, no desde nuestros servidores.' },
        { note: 'Esto es una ventaja frente a copiadores "en la nube" donde todas las copias salen de la misma infraestructura y dejan una IP compartida idéntica en cientos de cuentas. Con Onyx eso no pasa.', title: 'Por qué importa' },
        { h: 'Regla de oro: un VPS/IP por cuenta' },
        { p: 'La firma ve la IP de DONDE corre la esclava. Si pones la master y la(s) esclava(s) —o varias cuentas fondeadas— en la MISMA máquina/VPS, comparten IP y la firma puede correlacionarlas. Para minimizar el riesgo, corre cada cuenta (sobre todo si son de firmas o identidades distintas) en un VPS/IP separado.' },
        { h: 'Retraso aleatorio (jitter)' },
        { p: 'En cada enlace de Copy puedes activar "Retraso aleatorio (s)". Onyx añade un retraso al azar (0…N s) antes de copiar cada apertura, para que el timing de la esclava NO sea idéntico al de la master y no salte por patrón. Los cierres siempre salen al instante para no dejar operaciones huérfanas.' },
        { note: 'Un valor de 2–8 s suele bastar para romper el patrón sin perder la operación. Ponlo a 0 para desactivarlo.', title: 'Cuánto poner' },
        { h: 'La IP es solo una señal' },
        { p: 'Las firmas también detectan copia por: timing casi idéntico, ratios de lote iguales, mismo device fingerprint, y —lo más importante— muchas PROHÍBEN en sus reglas copiar entre cuentas fondeadas o entre traders distintos, sin importar la IP. Ninguna herramienta técnica te protege de incumplir el reglamento.' },
        { warn: 'Esto es información técnica, no asesoría de compliance. Las reglas cambian y varían por firma: lee SIEMPRE el reglamento de tu prop firm antes de copiar entre cuentas.' },
      ],
      en: [
        { p: 'Many prop firms ban accounts for "IP problems": when they detect several accounts trading from the same IP, or copying between accounts with an identical timing pattern. Here is how the Onyx copier handles it and what is on you.' },
        { h: 'Onyx does not centralize execution' },
        { p: 'The Onyx cloud only relays the signal (what opened or closed). The actual order to the broker is placed by the Onyx Connect running on YOUR terminal (your PC or VPS). The firm sees the trade coming from that terminal\'s IP, not from our servers.' },
        { note: 'This is an advantage over "cloud" copiers where every copy comes from the same infrastructure and leaves an identical shared IP across hundreds of accounts. That does not happen with Onyx.', title: 'Why it matters' },
        { h: 'Golden rule: one VPS/IP per account' },
        { p: 'The firm sees the IP of WHERE the slave runs. If you put the master and slave(s) —or several funded accounts— on the SAME machine/VPS, they share an IP and the firm can correlate them. To minimize risk, run each account (especially across different firms or identities) on a separate VPS/IP.' },
        { h: 'Random delay (jitter)' },
        { p: 'On each Copy link you can turn on "Random delay (s)". Onyx adds a random delay (0…N s) before copying each open, so the slave\'s timing is NOT identical to the master and does not flag by pattern. Closes always go out instantly so no trade is left orphaned.' },
        { note: 'A value of 2–8 s is usually enough to break the pattern without missing the trade. Set 0 to turn it off.', title: 'How much' },
        { h: 'IP is only one signal' },
        { p: 'Firms also flag copying by: near-identical timing, equal lot ratios, same device fingerprint, and —most importantly— many PROHIBIT copying between funded accounts or across different traders in their rules, regardless of IP. No technical tool protects you from breaking the rulebook.' },
        { warn: 'This is technical information, not compliance advice. Rules change and vary by firm: ALWAYS read your prop firm\'s rulebook before copying between accounts.' },
      ],
    },
  },

  // ---------- HERRAMIENTAS DEL PANEL ----------
  {
    slug: 'mis-robots',
    cat: 'tools', icon: '🤖',
    title: { es: 'Mis robots: seguir tus EAs por magic number', en: 'My robots: tracking your EAs by magic number' },
    summary: {
      es: 'Cómo Onyx separa las operaciones de cada robot y qué significan sus tres estados.',
      en: 'How Onyx separates each robot\'s trades and what its three states mean.',
    },
    cta: { href: '/dashboard/bots', label: { es: 'Ver Mis robots', en: 'Open My robots' } },
    body: {
      es: [
        { p: 'Si operas con EAs (robots), Onyx los separa solos. Cada robot marca sus operaciones con un número identificador —el magic number— y Onyx agrupa por cuenta y por magic, así ves el rendimiento de cada robot por separado, no todo mezclado.' },
        { h: 'Los tres estados' },
        { list: ['Operando: tiene una posición abierta ahora mismo.', 'En línea: tu EA sincroniza y el robot está presente (ya operó o lo registraste), pero sin posición abierta.', 'Sin actividad: no hay señal reciente de ese robot.'] },
        { h: 'Añadir un robot a mano' },
        { p: 'Si tu robot aún no ha operado, puedes registrarlo por su magic number para verlo desde ya. Al añadirlo, Onyx te muestra los magics que detectó en tu cuenta para que no tengas que adivinar.' },
        { note: 'Cada operación se atribuye al robot por su magic. Si dos robots comparten el mismo magic, Onyx no puede separarlos: ponle un magic distinto a cada uno en su configuración.', title: 'Por qué importa el magic' },
        { warn: 'Onyx solo mide y monitorea tus robots: nunca los enciende, apaga ni cambia su configuración. Eso lo haces tú en tu MetaTrader.' },
      ],
      en: [
        { p: 'If you trade with EAs (robots), Onyx separates them for you. Each robot tags its trades with an identifier —the magic number— and Onyx groups by account and by magic, so you see each robot\'s performance on its own, not all mixed together.' },
        { h: 'The three states' },
        { list: ['Running: it has an open position right now.', 'Online: your EA is syncing and the robot is present (it has traded or you registered it), but with no open position.', 'No activity: no recent signal from that robot.'] },
        { h: 'Adding a robot manually' },
        { p: 'If your robot has not traded yet, you can register it by its magic number to see it right away. When you add it, Onyx shows the magics it detected on your account so you do not have to guess.' },
        { note: 'Each trade is attributed to a robot by its magic. If two robots share the same magic, Onyx cannot separate them: give each one a different magic in its settings.', title: 'Why the magic matters' },
        { warn: 'Onyx only measures and monitors your robots: it never starts, stops or changes their settings. You do that in your MetaTrader.' },
      ],
    },
  },
  {
    slug: 'ganancia-neta',
    cat: 'tools', icon: '🧮',
    title: { es: 'Ganancia neta: lo que ganaste de verdad', en: 'Net profit: what you actually kept' },
    summary: {
      es: 'Resta tus gastos (retos, comisiones de firma, herramientas) a tu ganancia de trading.',
      en: 'Subtract your costs (challenges, firm fees, tools) from your trading profit.',
    },
    cta: { href: '/dashboard/expenses', label: { es: 'Ver Ganancia neta', en: 'Open Net profit' } },
    body: {
      es: [
        { p: 'Tu ganancia de trading no es lo que te queda. Entre medio están el costo de los challenges, las comisiones de la prop firm, tus herramientas y suscripciones. Ganancia neta los resta para enseñarte el número real: bruto de trading menos gastos.' },
        { h: 'Qué apuntar' },
        { list: ['El costo de cada challenge o cuenta de fondeo (y si te lo reembolsaron al pasar).', 'Comisiones o cuotas de la firma.', 'Herramientas, datos, VPS y suscripciones.'] },
        { note: 'Ejemplo: ganaste $3.000 de trading pero pagaste tres challenges de $200 y un VPS de $30. Tu neto real es $3.000 − $630 = $2.370. Eso es lo que de verdad entró.', title: 'Con números' },
        { h: 'ROI por prop firm' },
        { p: 'Como registras qué gastaste con cada firma y cuánto ganaste con sus cuentas, Onyx te calcula el retorno por firma: cuáles te salen a cuenta y cuáles solo te comen challenges.' },
        { warn: 'Ganancia neta está en los planes de pago. Es solo para tu control: Onyx no te cobra por gasto ni comparte estos números.' },
      ],
      en: [
        { p: 'Your trading profit is not what you keep. In between sit the cost of challenges, prop-firm fees, your tools and subscriptions. Net profit subtracts them to show the real number: trading gross minus costs.' },
        { h: 'What to log' },
        { list: ['The cost of each challenge or funded account (and whether it was refunded on passing).', 'Firm fees or charges.', 'Tools, data, VPS and subscriptions.'] },
        { note: 'Example: you made $3,000 trading but paid three $200 challenges and a $30 VPS. Your real net is $3,000 − $630 = $2,370. That is what actually came in.', title: 'With numbers' },
        { h: 'ROI per prop firm' },
        { p: 'Because you log what you spent with each firm and how much you made on its accounts, Onyx computes the return per firm: which ones pay off and which only eat challenges.' },
        { warn: 'Net profit is on paid plans. It is for your own tracking only: Onyx does not charge per expense or share these numbers.' },
      ],
    },
  },
  {
    slug: 'metas-ganancia',
    cat: 'tools', icon: '🎯',
    title: { es: 'Mis metas de ganancia: semanal, mensual y anual', en: 'My profit goals: weekly, monthly and annual' },
    summary: {
      es: 'Fija cuánto quieres ganar por período y sigue tu progreso y lo que te falta.',
      en: 'Set how much you want to make per period and track your progress and what is left.',
    },
    cta: { href: '/dashboard', label: { es: 'Ver mis metas', en: 'See my goals' } },
    body: {
      es: [
        { p: 'En Logros y metas fijas tres objetivos de ganancia: semanal, mensual y anual. Cada uno muestra un anillo de progreso, lo que llevas en el período y una etiqueta de "Te faltan $X" para saber de un vistazo cuánto te queda.' },
        { h: 'Suman todas tus cuentas' },
        { p: 'Son metas personales, así que juntan el resultado de todas tus cuentas. No las confundas con el "Objetivo de fondeo", que es el profit que te pide una cuenta de prop firm concreta.' },
        { h: 'En tu zona horaria' },
        { p: 'El progreso se calcula con la hora de tu propio dispositivo: la semana va de lunes a domingo, y el mes y el año cortan a tu medianoche local. Un cierre a las 11 de la noche cuenta en tu día, no en el siguiente.' },
        { note: 'Tus metas se guardan en tu cuenta, no en el navegador. Por eso ya no se borran al limpiar la caché, cambiar de dispositivo o al salir una versión nueva.', title: 'Se guardan de verdad' },
      ],
      en: [
        { p: 'In Achievements & goals you set three profit targets: weekly, monthly and annual. Each shows a progress ring, what you have made in the period and a "$X to go" tag so you can see at a glance how much is left.' },
        { h: 'They add up all your accounts' },
        { p: 'These are personal goals, so they combine the result of all your accounts. Do not confuse them with the "Prop-firm target", which is the profit a specific funded account requires.' },
        { h: 'In your timezone' },
        { p: 'Progress is computed using your own device clock: the week runs Monday to Sunday, and the month and year cut at your local midnight. A trade closed at 11 PM counts on your day, not the next.' },
        { note: 'Your goals are saved to your account, not the browser. That is why they no longer disappear when you clear the cache, switch devices or a new version ships.', title: 'Saved for real' },
      ],
    },
  },
  {
    slug: 'academia-copiar-mentor',
    cat: 'academy', icon: '🔁',
    title: { es: 'Copiar a tu mentor en la academia', en: 'Copying your mentor in the academy' },
    summary: {
      es: 'Cómo funciona el copy del mentor, qué controla Onyx y qué nunca ve tu mentor.',
      en: 'How mentor copy works, what Onyx controls and what your mentor never sees.',
    },
    cta: { href: '/dashboard/academy', label: { es: 'Ir a Onyx Academy', en: 'Go to Onyx Academy' } },
    body: {
      es: [
        { p: 'Si tu mentor ofrece copy, al suscribirte y conectar tu cuenta, Onyx replica sus operaciones en la tuya, escaladas por tu capital. Usa el mismo motor de copy de las cuentas normales, con los mismos filtros de riesgo.' },
        { h: 'Nadie ve ni toca tu cuenta' },
        { p: 'Tú nunca compartes tu contraseña, y tu mentor nunca ve ni opera tu cuenta. Solo se copian las señales; el dinero y el control siguen siendo tuyos.' },
        { h: 'Ajustado a tu riesgo' },
        { list: ['Escala proporcional por capital: si tienes menos que el mentor, se copia más pequeño.', 'Un multiplicador de riesgo (0,1× a 3×) que tú ajustas.', 'Guardian y Stop Loss obligatorios; en cuentas de fondeo se usan límites al 80% de la regla de la firma.'] },
        { note: 'Tu cuenta no puede recibir de dos fuentes a la vez ni ser máster y esclava al mismo tiempo: es la misma regla que en el copy normal, para no cruzar órdenes.', title: 'Una sola fuente' },
        { p: 'Pausar o cancelar tu suscripción apaga la copia al instante, sin borrar nada. Al reactivar, vuelve a copiar.' },
        { warn: 'Copiar a otro trader puede estar prohibido por tu prop firm. Lee su reglamento antes de conectar una cuenta de fondeo.' },
      ],
      en: [
        { p: 'If your mentor offers copy, when you subscribe and connect your account, Onyx replicates their trades on yours, scaled to your capital. It uses the same copy engine as normal accounts, with the same risk filters.' },
        { h: 'Nobody sees or touches your account' },
        { p: 'You never share your password, and your mentor never sees or trades your account. Only the signals are copied; the money and the control stay yours.' },
        { h: 'Fitted to your risk' },
        { list: ['Proportional scaling by capital: if you have less than the mentor, it copies smaller.', 'A risk multiplier (0.1× to 3×) that you adjust.', 'Guardian and Stop Loss required; on funded accounts limits are set to 80% of the firm rule.'] },
        { note: 'Your account cannot receive from two sources at once, nor be master and follower at the same time: same rule as normal copy, to avoid crossed orders.', title: 'One source only' },
        { p: 'Pausing or cancelling your subscription turns copy off instantly, without deleting anything. When you reactivate, it copies again.' },
        { warn: 'Copying another trader may be forbidden by your prop firm. Read its rulebook before connecting a funded account.' },
      ],
    },
  },

  // ---------- NOVEDADES (con imágenes) ----------
  {
    slug: 'plan-habitos-checkin',
    cat: 'manager', icon: '🎯', updated: true, cover: '/guia/plan-adherencia.svg',
    title: { es: 'Tu plan, hábitos y check-in diario', en: 'Your plan, habits and daily check-in' },
    summary: {
      es: 'Marca tus hábitos cada día, mide tu adherencia real y sigue tu progreso en un mapa de 30 días.',
      en: 'Tick your habits daily, measure your real adherence and track progress on a 30-day map.',
    },
    cta: { href: '/dashboard?view=plan', label: { es: 'Abrir Mi plan', en: 'Open My plan' } },
    body: {
      es: [
        { p: 'Onyx no solo mide tus números: también mide tu disciplina. Escribes tu plan (estilo, riesgo, sesiones y reglas), eliges los hábitos que quieres seguir, y cada día haces un check-in rápido. Con eso Onyx calcula tu adherencia.' },
        { img: '/guia/plan-adherencia.svg', alt: 'Anillo de adherencia, lista de check-in y mapa de cumplimiento de 30 días', caption: 'Tu adherencia combina tus hábitos con tu disciplina real en las operaciones.' },
        { h: 'El check-in de hoy' },
        { p: 'Cada mañana aparece un popup con tus hábitos agrupados por momento: ☀️ antes de operar, 🕒 durante y después, y 🌙 al cerrar el día. Marca cada uno cuando lo hagas; puedes volver a lo largo del día sin perder tu racha.' },
        { tip: 'Onyx premarca solo lo que ya detecta de tus operaciones (por ejemplo, que registraste y respetaste tus sesiones). Tú solo confirmas.', title: 'Se marca solo' },
        { h: 'Adherencia adaptativa' },
        { p: 'Tu adherencia mezcla lo que reportas con tu disciplina real (respetar tu máximo de operaciones). Si tienes el Guardian activo, sus frenos también cuentan. Si no lo tienes, esa parte simplemente no te penaliza.' },
        { h: 'El mapa de 30 días' },
        { p: 'En la pestaña Hoy verás un mapa con una celda por día: verde si cumpliste, ámbar si flojeaste, rojo si rompiste una regla. Cambia el rango a 7, 30 o 90 días y todos los números se recalculan.' },
        { note: 'El mapa se llena a partir de una foto diaria automática. Los primeros días puede verse vacío; es normal, se completa solo.', title: 'Se llena cada día' },
      ],
      en: [
        { p: 'Onyx measures more than your numbers: it measures your discipline too. You write your plan (style, risk, sessions and rules), pick the habits you want to keep, and do a quick check-in each day. From that, Onyx computes your adherence.' },
        { img: '/guia/plan-adherencia.svg', alt: 'Adherence ring, check-in list and a 30-day compliance map', caption: 'Your adherence blends your habits with your real trading discipline.' },
        { h: 'Today check-in' },
        { p: 'Each morning a popup shows your habits grouped by moment: ☀️ before trading, 🕒 during and after, and 🌙 at end of day. Tick each as you do it; you can come back through the day without losing your streak.' },
        { tip: 'Onyx pre-ticks what it already detects from your trades (for example, that you journaled and respected your sessions). You just confirm.', title: 'Auto-ticked' },
        { h: 'Adaptive adherence' },
        { p: 'Your adherence blends what you report with your real discipline (respecting your max trades). If the Guardian is on, its stops count too. If you do not have it, that part simply does not penalize you.' },
        { h: 'The 30-day map' },
        { p: 'On the Today tab you get a map with one cell per day: green if you followed through, amber if weak, red if you broke a rule. Switch the range to 7, 30 or 90 days and every number recomputes.' },
        { note: 'The map fills from an automatic daily snapshot. The first days may look empty; that is normal, it completes on its own.', title: 'Fills daily' },
      ],
    },
  },
  {
    slug: 'proteger-cuenta-guardian',
    cat: 'manager', icon: '🛡️', updated: true, cover: '/guia/proteger.svg',
    title: { es: 'Proteger una cuenta con el Guardian', en: 'Protecting an account with the Guardian' },
    summary: {
      es: 'Pon dos números —pérdida diaria y máximo de operaciones— y Onyx Guardian frena esa cuenta cuando los rompes.',
      en: 'Set two numbers —daily loss and max trades— and Onyx Guardian stops that account when you break them.',
    },
    cta: { href: '/dashboard?view=plan&tab=limites', label: { es: 'Ir a Límites y cuentas', en: 'Go to Limits & accounts' } },
    body: {
      es: [
        { p: 'En Mi plan → Límites y cuentas verás todas tus cuentas con un semáforo. Rojo: sin proteger. Al pulsar Proteger se abre un editor guiado, sin saltos ni pantallas raras.' },
        { img: '/guia/proteger.svg', alt: 'Editor guiado para proteger una cuenta con pérdida diaria y máximo de operaciones', caption: 'Dos pasos: pérdida diaria máxima y máximo de operaciones. Guardas y listo.' },
        { h: 'Los dos números' },
        { steps: [
          'Paso 1 · Pérdida diaria máxima: el % de tu balance que estás dispuesto a perder en un día. Si lo tocas, el Guardian frena la cuenta.',
          'Paso 2 · Máximo de operaciones al día: cuántas operaciones te permites. 0 significa sin tope.',
          'Guardar y proteger: se aplica solo a esa cuenta y el punto pasa a verde.',
        ] },
        { tip: 'Empieza suave: 1% de pérdida diaria es un buen punto de partida. Siempre puedes subirlo cuando cojas ritmo.', title: 'Consejo' },
        { h: 'A qué cuenta se aplica' },
        { p: 'El editor te dice con claridad a qué cuenta afecta. Si quieres el mismo límite en todas, usa "Todas"; o "Por tipo" para aplicarlo solo a las de fondeo, por ejemplo.' },
        { warn: 'Si la cuenta recibe copias (es esclava), el límite se pone en la cuenta maestra. Onyx te avisa con un aviso ámbar cuando toca hacerlo así.' },
      ],
      en: [
        { p: 'In My plan → Limits & accounts you see all your accounts with a traffic light. Red: unprotected. Tapping Protect opens a guided editor, with no jumps or odd screens.' },
        { img: '/guia/proteger.svg', alt: 'Guided editor to protect an account with daily loss and max trades', caption: 'Two steps: max daily loss and max trades. Save and you are done.' },
        { h: 'The two numbers' },
        { steps: [
          'Step 1 · Max daily loss: the % of your balance you are willing to lose in a day. If you hit it, the Guardian stops the account.',
          'Step 2 · Max trades per day: how many trades you allow yourself. 0 means no cap.',
          'Save and protect: it applies only to that account and the dot turns green.',
        ] },
        { tip: 'Start gentle: 1% daily loss is a good starting point. You can always raise it once you find your rhythm.', title: 'Tip' },
        { h: 'Which account it applies to' },
        { p: 'The editor clearly states which account it affects. For the same limit everywhere use "All"; or "By type" to apply it only to funded accounts, for example.' },
        { warn: 'If the account receives copies (it is a follower), set the limit on the master account. Onyx shows an amber notice when that is the case.' },
      ],
    },
  },
  {
    slug: 'notificaciones-onyx',
    cat: 'alerts', icon: '🔔', updated: true, cover: '/guia/notificaciones.svg',
    title: { es: 'Notificaciones: campana, push y Telegram', en: 'Notifications: bell, push and Telegram' },
    summary: {
      es: 'Las tres formas en que Onyx te avisa, qué llega por cada una y cómo enciendes solo lo que quieres.',
      en: 'The three ways Onyx alerts you, what arrives on each and how to turn on only what you want.',
    },
    cta: { href: '/account', label: { es: 'Configurar mis avisos', en: 'Configure my alerts' } },
    body: {
      es: [
        { p: 'Onyx te avisa por tres canales, y tú decides cuáles enciendes para cada tipo de aviso.' },
        { img: '/guia/notificaciones.svg', alt: 'Campana del panel, notificación push en el móvil y mensaje de Telegram', caption: 'Campana dentro del panel · push en el móvil · Telegram al vincular tu cuenta.' },
        { h: 'La campana' },
        { p: 'Es el icono arriba a la derecha del panel. Guarda tus avisos: check-in del día, respuestas de soporte, recompensas de referidos y avisos del bot. Al pulsar cualquiera te lleva a la pantalla exacta.' },
        { h: 'Push en el móvil' },
        { p: 'Si instalas Onyx como app y aceptas los permisos, recibes notificaciones aunque no tengas la web abierta. Ideal para el recordatorio del check-in o cuando el Guardian te frena.' },
        { h: 'Telegram' },
        { p: 'Al vincular tu cuenta de Telegram, el bot te manda lo importante fuera de la app: límites, EA caído, resumen del día. Cada mensaje lleva la marca Onyx Trading Live.' },
        { tip: 'En Mi cuenta → Avisos tienes un panel de interruptores: enciende la campana y el push por separado, para cada tipo de aviso.', title: 'Tú mandas' },
        { note: 'Push y Telegram pueden depender de tu plan. La campana está siempre disponible.', title: 'Según tu plan' },
      ],
      en: [
        { p: 'Onyx alerts you on three channels, and you decide which you turn on for each type of alert.' },
        { img: '/guia/notificaciones.svg', alt: 'Dashboard bell, mobile push notification and a Telegram message', caption: 'Bell inside the dashboard · push on your phone · Telegram once you link your account.' },
        { h: 'The bell' },
        { p: 'It is the icon at the top right of the dashboard. It keeps your alerts: daily check-in, support replies, referral rewards and bot alerts. Tapping any takes you to the exact screen.' },
        { h: 'Push on your phone' },
        { p: 'If you install Onyx as an app and accept permissions, you get notifications even with the web closed. Great for the check-in reminder or when the Guardian stops you.' },
        { h: 'Telegram' },
        { p: 'Once you link your Telegram account, the bot sends what matters outside the app: limits, EA down, daily summary. Every message carries the Onyx Trading Live brand.' },
        { tip: 'In My account → Alerts there is a switch panel: turn the bell and push on separately, for each type of alert.', title: 'You are in charge' },
        { note: 'Push and Telegram may depend on your plan. The bell is always available.', title: 'Depends on your plan' },
      ],
    },
  },
  {
    slug: 'resincronizar-costes',
    cat: 'numbers', icon: '🔄', updated: true, cover: '/guia/resync.svg',
    title: { es: 'Re-sincronizar: que los costes cuadren', en: 'Re-sync: making costs match' },
    summary: {
      es: 'Si comisiones o swaps no coinciden con tu plataforma, un botón vuelve a leer todo tu historial y lo cuadra.',
      en: 'If commissions or swaps do not match your platform, one button re-reads your whole history and reconciles it.',
    },
    cta: { href: '/dashboard', label: { es: 'Ir a mis cuentas', en: 'Go to my accounts' } },
    body: {
      es: [
        { p: 'Tu neto en Onyx debe ser idéntico al de tu MetaTrader o cTrader, comisiones y swaps incluidos. Si por lo que sea no cuadra, no hay que borrar nada: se vuelve a sincronizar el historial completo.' },
        { img: '/guia/resync.svg', alt: 'Los costes de MetaTrader 5 y de Onyx, lado a lado, cuadrando al céntimo', caption: 'Tras re-sincronizar, comisión, swap y neto coinciden al céntimo con tu plataforma.' },
        { h: 'Cómo se hace' },
        { steps: [
          'En tu panel, abre la cuenta que no cuadra.',
          'Pulsa "Re-sincronizar historial".',
          'Deja tu MetaTrader/cTrader abierto un momento: el EA vuelve a enviar todas las operaciones desde el principio.',
        ] },
        { tip: 'En MetaTrader 5 la comisión de una operación se reparte entre la entrada y la salida. El EA de Onyx suma las dos partes, por eso el total cuadra.', title: 'Por qué antes fallaba' },
        { warn: 'Re-sincronizar no borra tu historial ni tus notas: solo recalcula los costes con los datos frescos de la plataforma.' },
      ],
      en: [
        { p: 'Your net in Onyx should be identical to your MetaTrader or cTrader, commissions and swaps included. If for some reason it does not match, nothing gets deleted: the full history is re-synced.' },
        { img: '/guia/resync.svg', alt: 'MetaTrader 5 and Onyx costs side by side, matching to the cent', caption: 'After re-syncing, commission, swap and net match your platform to the cent.' },
        { h: 'How to do it' },
        { steps: [
          'In your dashboard, open the account that does not match.',
          'Tap "Re-sync history".',
          'Keep your MetaTrader/cTrader open a moment: the EA re-sends every trade from the start.',
        ] },
        { tip: 'On MetaTrader 5 a trade commission is split between entry and exit. The Onyx EA adds both parts, which is why the total matches.', title: 'Why it used to be off' },
        { warn: 'Re-syncing does not delete your history or notes: it only recomputes costs with fresh data from the platform.' },
      ],
    },
  },
  {
    slug: 'reto-lectura-ia',
    cat: 'funded', icon: '📄', updated: true, cover: '/guia/reto-ia.svg',
    title: { es: 'Tu reto, leído por la IA', en: 'Your challenge, read by AI' },
    summary: {
      es: 'Sube el contrato de tu reto (PDF o foto) y Onyx detecta firma, fase y reglas, y te sigue el marcador.',
      en: 'Upload your challenge contract (PDF or photo) and Onyx detects firm, phase and rules, and tracks your scoreboard.',
    },
    cta: { href: '/dashboard?view=reto', label: { es: 'Abrir Mi reto', en: 'Open My challenge' } },
    body: {
      es: [
        { p: 'Cada firma de fondeo tiene sus reglas: objetivo, pérdida diaria, pérdida total, días mínimos… En vez de copiarlas a mano, deja que Onyx las lea por ti.' },
        { img: '/guia/reto-ia.svg', alt: 'Un contrato en PDF que la IA convierte en firma, fase, objetivo y pérdida máxima', caption: 'Subes el contrato y la IA rellena firma, fase y reglas; tú solo confirmas.' },
        { h: 'Leer con IA' },
        { steps: [
          'En Mi reto, pulsa "Leer con IA".',
          'Sube el PDF o una foto del contrato (o pega el texto).',
          'La IA detecta la firma, si es Fase 1, Fase 2 o cuenta fondeada, y todas las reglas. Revisas y guardas.',
        ] },
        { h: 'La fase importa' },
        { p: 'Onyx muestra en tu tarjeta y en los avisos si estás en Fase 1, Fase 2 o ya fondeado, porque las reglas y el objetivo cambian en cada una.' },
        { tip: 'Si el contrato está en otro idioma, la IA igual lo entiende. Y si algo no queda claro, puedes ajustar cualquier regla a mano antes de guardar.', title: 'Sin teclear reglas' },
        { warn: 'La lectura es una ayuda, no un sustituto del reglamento oficial. Ante la duda, manda siempre lo que diga tu firma.' },
      ],
      en: [
        { p: 'Every prop firm has its own rules: target, daily loss, total loss, minimum days… Instead of copying them by hand, let Onyx read them for you.' },
        { img: '/guia/reto-ia.svg', alt: 'A PDF contract the AI turns into firm, phase, target and max loss', caption: 'Upload the contract and the AI fills firm, phase and rules; you just confirm.' },
        { h: 'Read with AI' },
        { steps: [
          'In My challenge, tap "Read with AI".',
          'Upload the PDF or a photo of the contract (or paste the text).',
          'The AI detects the firm, whether it is Phase 1, Phase 2 or funded, and all the rules. You review and save.',
        ] },
        { h: 'The phase matters' },
        { p: 'Onyx shows on your card and in alerts whether you are in Phase 1, Phase 2 or already funded, because the rules and the target change in each.' },
        { tip: 'If the contract is in another language, the AI still understands it. And if anything is unclear, you can adjust any rule by hand before saving.', title: 'No typing rules' },
        { warn: 'The reading is a help, not a replacement for the official rulebook. When in doubt, your firm always has the final word.' },
      ],
    },
  },
  {
    slug: 'instalar-app-avisos',
    cat: 'alerts', icon: '📲', updated: true, cover: '/guia/instalar-app.svg',
    title: { es: 'Instala Onyx como app en tu móvil', en: 'Install Onyx as an app on your phone' },
    summary: {
      es: 'Se abre como una aplicación, va más rápido y puede enviarte notificaciones push.',
      en: 'It opens like an app, runs faster and can send you push notifications.',
    },
    cta: { href: '/dashboard', label: { es: 'Abrir Onyx', en: 'Open Onyx' } },
    body: {
      es: [
        { p: 'Onyx funciona como app sin pasar por ninguna tienda. Se instala desde el propio navegador en unos segundos. Los pasos cambian según tu sistema: busca el tuyo abajo.' },
        { img: '/guia/instalar-app.svg', alt: 'Tres pasos para instalar Onyx como app en el móvil y activar avisos', caption: 'Abre Onyx, pulsa Instalar app y activa las notificaciones. Ya está.' },
        { h: '🍏 En iPhone o iPad (iOS)' },
        { walk: [
          { t: 'Abre Onyx en Safari', d: 'En iOS la instalación solo funciona desde Safari (no desde Chrome ni otro navegador). Entra a onyxtradinglive.com e inicia sesión.' },
          { t: 'Pulsa el botón Compartir', d: 'Es el cuadradito con la flecha hacia arriba, en la barra de abajo (o arriba en iPad).' },
          { t: 'Añadir a pantalla de inicio', d: 'En el menú que se abre, baja y toca "Añadir a pantalla de inicio". Confirma con "Añadir". Aparece el icono de Onyx en tu pantalla.' },
          { t: 'Abre Onyx desde el icono y permite avisos', d: 'Ábrela desde ese icono (no desde Safari). Ve a activar notificaciones y acepta el permiso cuando iOS lo pida.', tip: 'En iPhone los avisos push SOLO llegan si abres Onyx desde el icono de inicio; desde Safari no funcionan. Necesitas iOS 16.4 o superior.' },
        ] },
        { h: '🤖 En Android' },
        { walk: [
          { t: 'Abre Onyx en Chrome', d: 'Entra a onyxtradinglive.com en Chrome e inicia sesión.' },
          { t: 'Pulsa "Instalar app"', d: 'Verás el botón dentro de Onyx, o el aviso "Instalar aplicación" de Chrome (también en el menú de tres puntos → Instalar aplicación / Añadir a pantalla).' },
          { t: 'Acepta las notificaciones', d: 'Abre la app instalada y acepta el permiso de notificaciones para recibir avisos push.' },
        ] },
        { h: '🖥️ En Windows o Mac (ordenador)' },
        { walk: [
          { t: 'Abre Onyx en Chrome o Edge', d: 'Entra a onyxtradinglive.com e inicia sesión.' },
          { t: 'Pulsa el icono de instalar', d: 'En la barra de direcciones, a la derecha, aparece un icono de instalar (una pantallita con una flecha). También está en el botón "Instalar app" dentro de Onyx.' },
          { t: 'Se abre como programa', d: 'Onyx se abre en su propia ventana, como cualquier aplicación, y queda en tu escritorio o menú de inicio. Acepta las notificaciones si quieres avisos.' },
        ] },
        { tip: 'Con la app instalada llega el recordatorio del check-in y los avisos del Guardian aunque no tengas Onyx abierto.', title: 'Por qué merece la pena' },
      ],
      en: [
        { p: 'Onyx works as an app without any store. You install it from the browser itself in seconds. The steps depend on your system: find yours below.' },
        { img: '/guia/instalar-app.svg', alt: 'Three steps to install Onyx as an app on your phone and enable alerts', caption: 'Open Onyx, tap Install app and enable notifications. Done.' },
        { h: '🍏 On iPhone or iPad (iOS)' },
        { walk: [
          { t: 'Open Onyx in Safari', d: 'On iOS installing only works from Safari (not Chrome or another browser). Go to onyxtradinglive.com and sign in.' },
          { t: 'Tap the Share button', d: 'It is the little square with an up arrow, in the bottom bar (or top on iPad).' },
          { t: 'Add to Home Screen', d: 'In the menu that opens, scroll down and tap "Add to Home Screen". Confirm with "Add". The Onyx icon appears on your screen.' },
          { t: 'Open Onyx from the icon and allow alerts', d: 'Open it from that icon (not from Safari). Go to enable notifications and accept the permission when iOS asks.', tip: 'On iPhone push alerts ONLY arrive if you open Onyx from the home-screen icon; from Safari they do not work. You need iOS 16.4 or later.' },
        ] },
        { h: '🤖 On Android' },
        { walk: [
          { t: 'Open Onyx in Chrome', d: 'Go to onyxtradinglive.com in Chrome and sign in.' },
          { t: 'Tap "Install app"', d: 'You will see the button inside Onyx, or Chrome’s "Install app" prompt (also in the three-dot menu → Install app / Add to Home screen).' },
          { t: 'Accept notifications', d: 'Open the installed app and accept the notification permission to get push alerts.' },
        ] },
        { h: '🖥️ On Windows or Mac (desktop)' },
        { walk: [
          { t: 'Open Onyx in Chrome or Edge', d: 'Go to onyxtradinglive.com and sign in.' },
          { t: 'Click the install icon', d: 'In the address bar, on the right, an install icon appears (a small screen with an arrow). It is also in the "Install app" button inside Onyx.' },
          { t: 'It opens as a program', d: 'Onyx opens in its own window, like any app, and stays on your desktop or Start menu. Accept notifications if you want alerts.' },
        ] },
        { tip: 'With the app installed, the check-in reminder and Guardian alerts reach you even with Onyx closed.', title: 'Why it is worth it' },
      ],
    },
  },
  {
    slug: 'vps-que-es',
    cat: 'tools', icon: '🖥️', updated: true, cover: '/guia/vps.svg',
    title: { es: 'Qué es un VPS y qué tipos hay', en: 'What a VPS is and which types exist' },
    summary: {
      es: 'Un ordenador en la nube encendido 24/7 para que tu EA, tu copy y tu Guardian nunca se apaguen. Ventajas y tipos.',
      en: 'A cloud computer on 24/7 so your EA, copy and Guardian never stop. Advantages and types.',
    },
    body: {
      es: [
        { p: 'Onyx (y tu MetaTrader) solo funcionan mientras el ordenador está encendido y con internet. Si lo apagas, cierras la tapa del portátil o se te va la luz, el EA deja de reportar, el copy deja de copiar y el Guardian deja de proteger. Un VPS resuelve eso.' },
        { img: '/guia/vps.svg', alt: 'Tu ordenador apagado mientras un VPS en la nube mantiene MetaTrader encendido y Onyx recibiendo', caption: 'Apagas tu ordenador; el VPS sigue con tu MetaTrader encendido y Onyx recibiendo.' },
        { h: 'Qué es' },
        { p: 'Un VPS (Servidor Virtual Privado) es un ordenador que vive en un centro de datos y está encendido siempre, con internet estable. Te conectas a él desde tu móvil u ordenador, instalas tu MetaTrader y el EA de Onyx dentro, y lo dejas corriendo. Aunque cierres tu equipo, el VPS sigue.' },
        { h: 'Ventajas para ti' },
        { list: [
          '24/7: tu EA, tu copy y tu Guardian nunca se apagan, aunque tu ordenador esté apagado.',
          'Menos latencia: si el VPS está cerca del servidor de tu bróker, tus órdenes (y el copy) entran más rápido.',
          'Estabilidad: internet y luz del centro de datos, no de tu casa. Nada de cortes ni WiFi flojo.',
          'Ahorro de energía y ruido: no dejas tu PC encendido toda la noche.',
          'Independencia: puedes revisar Onyx desde el móvil sin depender de tu ordenador.',
        ] },
        { h: 'Tipos de VPS' },
        { walk: [
          { t: 'VPS Forex (especializado)', d: 'Pensado para trading: viene con Windows, baja latencia hacia los brókers y a veces MetaTrader preinstalado. Es el más fácil para empezar. Ejemplos: ForexVPS, Cloudzy, FXVM.' },
          { t: 'VPS del bróker (a veces gratis)', d: 'Muchos brókers regalan un VPS si operas cierto volumen o mantienes un saldo. Cómodo, pero atado a ese bróker. Pregunta a tu bróker si lo ofrece.' },
          { t: 'VPS en la nube general', d: 'Proveedores como Vultr, DigitalOcean, AWS o Contabo. Más barato y flexible, pero lo configuras tú. Elige uno con Windows si quieres MetaTrader con su ventana de siempre.' },
          { t: 'Windows vs Linux', d: 'Para MetaTrader lo normal es un VPS con Windows (la plataforma es un programa de Windows). En Linux también se puede, pero con un envoltorio, y es más técnico.' },
        ] },
        { tip: 'Para MetaTrader/cTrader con Onyx, un VPS Windows pequeño (1–2 núcleos, 2 GB de RAM) suele bastar. No necesitas uno caro.', title: 'Cuánto VPS necesitas' },
        { h: 'Cómo lo usas con Onyx' },
        { p: 'Es igual que en tu ordenador: te conectas al VPS, instalas MetaTrader y el EA de Onyx (con tu clave API), enciendes AlgoTrading y lo dejas. A partir de ahí Onyx recibe tus operaciones sin parar. Tienes el paso a paso en la guía de instalar el EA.' },
        { warn: 'Un VPS es un ordenador de verdad: mantenlo actualizado y con una contraseña fuerte. Nunca compartas su acceso, igual que no compartes tu MetaTrader.' },
      ],
      en: [
        { p: 'Onyx (and your MetaTrader) only work while the computer is on and online. If you turn it off, close the laptop lid or lose power, the EA stops reporting, copy stops copying and the Guardian stops protecting. A VPS fixes that.' },
        { img: '/guia/vps.svg', alt: 'Your computer off while a cloud VPS keeps MetaTrader on and Onyx receiving', caption: 'You turn your computer off; the VPS keeps your MetaTrader on and Onyx receiving.' },
        { h: 'What it is' },
        { p: 'A VPS (Virtual Private Server) is a computer living in a data center, always on, with stable internet. You connect to it from your phone or computer, install your MetaTrader and the Onyx EA inside, and leave it running. Even if you close your device, the VPS keeps going.' },
        { h: 'Advantages for you' },
        { list: [
          '24/7: your EA, copy and Guardian never stop, even with your computer off.',
          'Lower latency: if the VPS is near your broker’s server, your orders (and copy) land faster.',
          'Stability: the data center’s internet and power, not your home’s. No outages or weak WiFi.',
          'Save energy and noise: you don’t leave your PC on all night.',
          'Independence: check Onyx from your phone without relying on your computer.',
        ] },
        { h: 'Types of VPS' },
        { walk: [
          { t: 'Forex VPS (specialized)', d: 'Built for trading: comes with Windows, low latency to brokers and sometimes MetaTrader preinstalled. Easiest to start. Examples: ForexVPS, Cloudzy, FXVM.' },
          { t: 'Broker VPS (sometimes free)', d: 'Many brokers give you a VPS if you trade a certain volume or keep a balance. Convenient, but tied to that broker. Ask your broker if they offer one.' },
          { t: 'General cloud VPS', d: 'Providers like Vultr, DigitalOcean, AWS or Contabo. Cheaper and flexible, but you configure it. Pick one with Windows if you want MetaTrader with its usual window.' },
          { t: 'Windows vs Linux', d: 'For MetaTrader you normally use a Windows VPS (the platform is a Windows program). Linux works too, but via a wrapper, and it is more technical.' },
        ] },
        { tip: 'For MetaTrader/cTrader with Onyx, a small Windows VPS (1–2 cores, 2 GB RAM) is usually enough. You do not need an expensive one.', title: 'How much VPS you need' },
        { h: 'How you use it with Onyx' },
        { p: 'It is just like on your computer: connect to the VPS, install MetaTrader and the Onyx EA (with your API key), turn on AlgoTrading and leave it. From then on Onyx receives your trades non-stop. The step by step is in the install-the-EA guide.' },
        { warn: 'A VPS is a real computer: keep it updated and with a strong password. Never share its access, just as you don’t share your MetaTrader.' },
      ],
    },
  },
];

// Búsqueda simple sobre título, resumen y texto
export function searchArticles(q: string, lang: Lang): Article[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return ARTICLES.filter((a) => {
    const hay = [
      a.title[lang], a.summary[lang],
      ...a.body[lang].map((b: any) => b.p || b.h || b.note || b.warn || b.tip || b.caption || (b.list || b.steps || []).join(' ') || (b.walk ? b.walk.map((s: any) => (s.t || '') + ' ' + (s.d || '')).join(' ') : '')),
    ].join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

export const bySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug) || null;
export const byCat = (cat: string) => ARTICLES.filter((a) => a.cat === cat);
