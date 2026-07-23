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
  | { list: string[] }
  | { steps: string[] };

export type Article = {
  slug: string;
  cat: string;
  icon: string;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  body: Record<Lang, Block[]>;
  cta?: { href: string; label: Record<Lang, string> };
};

export const CATEGORIES = [
  { id: 'start',   icon: '🔌', color: 'var(--green)',  name: { es: 'Primeros pasos',        en: 'Getting started' } },
  { id: 'numbers', icon: '📊', color: 'var(--brand)',  name: { es: 'Entender tus números',  en: 'Understanding your numbers' } },
  { id: 'manager', icon: '🛡️', color: 'var(--amber)',  name: { es: 'Onyx Guardian',             en: 'Onyx Guardian' } },
  { id: 'funded',  icon: '🏆', color: 'var(--purple)', name: { es: 'Cuentas de fondeo',     en: 'Funded accounts' } },
  { id: 'account', icon: '⚙️', color: 'var(--cyan)',   name: { es: 'Tu cuenta y tu plan',   en: 'Your account and plan' } },
];

export const ARTICLES: Article[] = [
  // ---------- PRIMEROS PASOS ----------
  {
    slug: 'conectar-cuenta',
    cat: 'start', icon: '🔌',
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
    cat: 'start', icon: '⚙️',
    title: { es: 'Instalar el EA en MetaTrader', en: 'Installing the EA in MetaTrader' },
    summary: {
      es: 'Los siete pasos, y las cuatro cosas que fallan cuando no sincroniza.',
      en: 'The seven steps, and the four things that fail when it does not sync.',
    },
    cta: { href: '/dashboard/keys', label: { es: 'Abrir el asistente', en: 'Open the wizard' } },
    body: {
      es: [
        { p: 'En Cuentas tienes un asistente que te lleva paso a paso y espera hasta confirmar que funcionó. Esto es el resumen por si prefieres ir por tu cuenta.' },
        { steps: [
          'Descarga el archivo de tu plataforma: .mq5 para MT5, .mq4 para MT4.',
          'En MetaTrader: Archivo → Abrir carpeta de datos → carpeta Experts.',
          'Abre MetaEditor (F4), abre el archivo y pulsa Compilar (F7).',
          'Navegador → Asesores Expertos → arrastra Onyx a cualquier gráfico.',
          'Pega tu clave API y deja la URL del servidor como viene.',
          'Herramientas → Opciones → Asesores Expertos → permite la URL de Onyx.',
          'Enciende AlgoTrading. En segundos el panel del gráfico dirá "Conectado".',
        ] },
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
        { p: 'In Accounts there is a wizard that walks you through it and waits until it confirms it worked. This is the summary in case you prefer doing it yourself.' },
        { steps: [
          'Download the file for your platform: .mq5 for MT5, .mq4 for MT4.',
          'In MetaTrader: File → Open Data Folder → Experts folder.',
          'Open MetaEditor (F4), open the file and click Compile (F7).',
          'Navigator → Expert Advisors → drag Onyx onto any chart.',
          'Paste your API key and leave the server URL as it comes.',
          'Tools → Options → Expert Advisors → allow the Onyx URL.',
          'Turn on AlgoTrading. Within seconds the chart panel will say "Connected".',
        ] },
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
    cat: 'start', icon: '👁️',
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
        { p: 'Puedes cerrar tu posición en hasta cuatro tramos según avanza a tu favor. Por ejemplo: el 50% al llegar a 20 pips, el 30% a 40 pips, y dejas correr el resto.' },
        { p: 'La ventaja psicológica es real: aseguras algo pronto, y eso te quita la ansiedad de ver una ganancia evaporarse. La desventaja también: si cierras demasiado pronto, tus operaciones ganadoras se quedan pequeñas y tu expectancy baja.' },
        { warn: 'Si tu operación es de 0,01 lotes, el bróker no deja partirla: no existe media unidad. En ese caso el parcial se salta y Onyx lo apunta en el historial para que sepas por qué no pasó nada.' },
        { h: 'Un detalle solo de MT4' },
        { p: 'En MT4, al cerrar parte de una posición el resto recibe un número de ticket nuevo. Onyx lo tiene en cuenta y sigue la pista por otro camino, pero si ves algo raro en el historial, avísanos.' },
        { p: 'Los cierres parciales están disponibles en el plan Elite.' },
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
        { p: 'If you also turn on limits in Onyx Guardian, it does not just inform you: it stops you. With whatever safety margin you chose, so you never reach the real edge.' },
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
];

// Búsqueda simple sobre título, resumen y texto
export function searchArticles(q: string, lang: Lang): Article[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return ARTICLES.filter((a) => {
    const hay = [
      a.title[lang], a.summary[lang],
      ...a.body[lang].map((b: any) => b.p || b.h || b.note || b.warn || (b.list || b.steps || []).join(' ')),
    ].join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

export const bySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug) || null;
export const byCat = (cat: string) => ARTICLES.filter((a) => a.cat === cat);
