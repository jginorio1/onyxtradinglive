'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// ─────────────────────────────────────────────────────────────────────────────
// CENTRO DE GUÍAS "Cómo usar Onyx" — estilo universidad por temas.
// Pantalla completa, bilingüe (ES/EN) y pensado para verse en TEMA OSCURO.
//
// Cada guía tiene pasos; cada paso lleva una CAPTURA LIMPIA (se sube por /public
// o por el editor) y las LÍNEAS/CÍRCULOS se dibujan POR ENCIMA con `markers`
// (coordenadas en % sobre la imagen). Así la foto nunca se edita y las marcas
// quedan bilingües y ajustables.
//
// Para añadir las fotos reales: sube los PNG a /public/guia-img/ con el nombre
// `img` de cada paso (p. ej. /public/guia-img/conectar-1.png). Mientras no exista
// la imagen, se muestra un marco con el nombre del archivo que falta.
// ─────────────────────────────────────────────────────────────────────────────

type Marker = { x: number; y: number; w?: number; h?: number; n?: number; es: string; en: string; dir?: 'up' | 'down' | 'left' | 'right' };
type Step = { es: string; en: string; des_es: string; des_en: string; img: string; markers?: Marker[] };
type Guide = { id: string; icon: string; es: string; en: string; mins: number; steps: Step[] };
type Cat = { es: string; en: string; guides: Guide[] };

// Sube este número cada vez que reemplaces una captura en /public/guia-img/
// para forzar que el navegador descargue la versión nueva (evita caché viejo).
const IMG_V = '12';

const CATS: Cat[] = [
  {
    es: 'Primeros pasos', en: 'Getting started',
    guides: [
      {
        id: 'crear-cuenta', icon: 'user', es: 'Crear tu cuenta', en: 'Create your account', mins: 2,
        steps: [
          { es: 'Abre la página de registro', en: 'Open the sign-up page', img: 'guia-img/registro-1.png',
            des_es: 'Entra en onyxtradinglive.com y pulsa "Crear cuenta". También puedes hacerlo desde "Empezar gratis" en el inicio o en Precios.',
            des_en: 'Go to onyxtradinglive.com and tap "Create account". You can also start from "Start free" on the home page or Pricing.',
            markers: [{ x: 50, y: 30, n: 1, es: 'Botón Crear cuenta', en: 'Create account button' }] },
          { es: 'Escribe tu nombre, correo y contraseña', en: 'Enter your name, email and password', img: 'guia-img/registro-2.png',
            des_es: 'Rellena nombre, correo y una contraseña segura (la barra te indica la fuerza). Acepta los términos para continuar.',
            des_en: 'Fill in your name, email and a strong password (the bar shows its strength). Accept the terms to continue.',
            markers: [{ x: 50, y: 55, n: 1, es: 'Medidor de contraseña', en: 'Password strength' }, { x: 50, y: 80, n: 2, es: 'Aceptar términos', en: 'Accept terms' }] },
          { es: 'Confirma tu correo', en: 'Confirm your email', img: 'guia-img/registro-3.png',
            des_es: 'Te enviamos un enlace de confirmación. Ábrelo desde tu bandeja y tu cuenta queda activa. Revisa spam si no lo ves.',
            des_en: 'We send a confirmation link. Open it from your inbox and your account is active. Check spam if you don\'t see it.' },
        ],
      },
      {
        id: 'iniciar-sesion', icon: 'lock', es: 'Iniciar sesión', en: 'Log in', mins: 1,
        steps: [
          { es: 'Abre Entrar', en: 'Open Log in', img: 'guia-img/login-1.png',
            des_es: 'Pulsa "Entrar" en la barra superior. Si olvidaste la contraseña, usa "¿Olvidaste tu contraseña?" para restablecerla por correo.',
            des_en: 'Tap "Log in" in the top bar. Forgot your password? Use "Forgot your password?" to reset it by email.',
            markers: [{ x: 50, y: 45, n: 1, es: 'Correo y contraseña', en: 'Email and password' }, { x: 50, y: 72, n: 2, es: '¿Olvidaste tu contraseña?', en: 'Forgot password?' }] },
          { es: 'Entra a tu panel', en: 'Enter your dashboard', img: 'guia-img/login-2.png',
            des_es: 'Al entrar llegas a tu panel. La primera vez verás un pequeño tour y el check-in del día.',
            des_en: 'Once in, you land on your dashboard. The first time you\'ll see a short tour and the daily check-in.' },
        ],
      },
      {
        id: 'conectar-cuenta', icon: 'link', es: 'Conectar tu cuenta', en: 'Connect your account', mins: 8,
        steps: [
          { es: 'Elige tu plataforma', en: 'Pick your platform', img: 'guia-img/conectar-1.png',
            des_es: 'Entra en "Cuentas" y elige dónde operas. Hay dos familias:\n\n• CON conector (instalas un pequeño programa): MetaTrader 5, MetaTrader 4 y cTrader. Esta guía detalla MetaTrader paso a paso (pasos 3 a 8).\n\n• SIN conector, por login del bróker (no instalas nada): MatchTrader, TradeLocker y DXtrade. No instalas nada: eliges tu plataforma y vas directo al último paso ("Plataformas API"), donde entras con tu correo y contraseña.\n\nDa igual si tu cuenta es demo, challenge, fondeada o propia: todas se conectan igual. Elige tu plataforma y pulsa "Siguiente".',
            des_en: 'Open "Accounts" and pick where you trade. There are two families:\n\n• WITH a connector (install a small program): MetaTrader 5, MetaTrader 4 and cTrader. This guide details MetaTrader step by step (steps 3 to 8).\n\n• WITHOUT a connector, via broker login (install nothing): MatchTrader, TradeLocker and DXtrade. You install nothing: pick your platform and jump straight to the last step ("API platforms"), where you log in with your email and password.\n\nIt doesn\'t matter if your account is demo, challenge, funded or your own: they all connect the same way. Pick your platform and press "Next".',
            markers: [{ x: 9, y: 52, n: 1, es: 'Selecciona la plataforma', en: 'Select the platform' }, { x: 87, y: 84, n: 2, es: 'Siguiente', en: 'Next', dir: 'left' }] },
          { es: 'Crea tu clave', en: 'Create your key', img: 'guia-img/conectar-2.png',
            des_es: 'Ponle un apodo a la cuenta (ej. "FTMO 100K"), elige el tipo (challenge, fondeo, propio o demo) y escribe tu prop firm o bróker. El número de cuenta es opcional: si lo dejas vacío, la clave se ata sola en la primera sincronización.\n\n• MetaTrader / cTrader: al pulsar "Crear clave" se genera una CLAVE (ApiKey) que pegarás más adelante.\n\n• MatchTrader / TradeLocker / DXtrade: no uses este paso. Ve directo al último ("Plataformas API"): ahí eliges tu bróker/servidor y entras con correo y contraseña. No hay clave ni descarga.',
            des_en: 'Give the account a nickname (e.g. "FTMO 100K"), choose the type (challenge, funded, own or demo) and type your prop firm or broker. The account number is optional: leave it blank and the key binds itself on first sync.\n\n• MetaTrader / cTrader: pressing "Create key" generates a KEY (ApiKey) you\'ll paste later.\n\n• MatchTrader / TradeLocker / DXtrade: skip this step. Go straight to the last one ("API platforms"): there you pick your broker/server and log in with email and password. No key, no download.',
            markers: [{ x: 25, y: 30, n: 1, es: 'Apodo de la cuenta', en: 'Account nickname' }, { x: 64, y: 30, n: 2, es: 'Tipo de cuenta', en: 'Account type', dir: 'left' }, { x: 7, y: 82, n: 3, es: 'Crear clave', en: 'Create key' }] },
          { es: 'Descarga el conector (MetaTrader)', en: 'Download the connector (MetaTrader)', img: 'guia-img/conectar-3.png',
            des_es: 'Pulsa "Descargar para MT5" (o MT4 si usas MetaTrader 4). El archivo (.ex5 / .ex4) ya viene compilado y con tu servidor configurado: no tienes que compilar nada. Se guarda en tu carpeta de Descargas.\n\nEn Mac funciona igual: descarga MetaTrader para Mac desde tu bróker y sigue estos mismos pasos. Para que el conector no se detenga al apagar tu computadora, considera un VPS (encendido 24/7).',
            des_en: 'Press "Download for MT5" (or MT4 if you use MetaTrader 4). The file (.ex5 / .ex4) comes already compiled and with your server configured: you compile nothing. It saves to your Downloads folder.\n\nOn Mac it works the same: download MetaTrader for Mac from your broker and follow these same steps. So the connector doesn\'t stop when your computer is off, consider a VPS (on 24/7).',
            markers: [{ x: 10, y: 51, n: 1, es: 'Descargar para MT5 / MT4', en: 'Download for MT5 / MT4' }] },
          { es: 'Mételo en la carpeta Experts', en: 'Put it in the Experts folder', img: 'guia-img/conectar-4.png',
            des_es: 'Abre MetaTrader. Arriba: menú Archivo → "Abrir carpeta de datos". Entra en la carpeta MQL5 y luego en Experts (en MT4 es MQL4 → Experts), y pega ahí el archivo Onyx que descargaste.\n\nLuego, en el panel Navegador (izquierda), clic derecho sobre "Asesores Expertos" → "Actualizar": aparecerá "Onyx Connect".',
            des_en: 'Open MetaTrader. Top: File menu → "Open Data Folder". Go into the MQL5 folder, then Experts (on MT4 it\'s MQL4 → Experts), and paste the Onyx file you downloaded there.\n\nThen, in the Navigator panel (left), right-click "Expert Advisors" → "Refresh": "Onyx Connect" will appear.',
            markers: [{ x: 13, y: 63, n: 1, es: 'Archivo → Abrir carpeta de datos → MQL5 → Experts', en: 'File → Open Data Folder → MQL5 → Experts' }] },
          { es: 'Arrástralo a un gráfico', en: 'Drag it onto a chart', img: 'guia-img/conectar-5.png',
            des_es: 'En el panel Navegador (izquierda), abre "Asesores Expertos" y arrastra "Onyx Connect" sobre cualquier gráfico abierto. Con un solo gráfico basta.',
            des_en: 'In the Navigator panel (left), open "Expert Advisors" and drag "Onyx Connect" onto any open chart. One chart is enough.',
            markers: [{ x: 7, y: 73, n: 1, es: 'Arrastra "Onyx Connect"', en: 'Drag "Onyx Connect"' }, { x: 75, y: 68, n: 2, es: 'Suéltalo en un gráfico', en: 'Drop it on a chart', dir: 'left' }] },
          { es: 'Marca la casilla y pega tu clave', en: 'Tick the box and paste your key', img: 'guia-img/conectar-6.png',
            des_es: 'Al soltarlo se abre una ventana. En la pestaña "Común" marca "Permitir Algo Trading". En la pestaña de parámetros/entradas pega tu ApiKey (la clave del paso 2). La dirección del servidor ya viene puesta en el conector: no la toques. Pulsa "OK".',
            des_en: 'A window opens when you drop it. On the "Common" tab tick "Allow Algo Trading". On the parameters/inputs tab paste your ApiKey (the key from step 2). The server address is already set in the connector: don\'t touch it. Press "OK".',
            markers: [{ x: 8, y: 53, n: 1, es: 'Permitir Algo Trading', en: 'Allow Algo Trading' }, { x: 11, y: 59, n: 2, es: 'Pega tu ApiKey', en: 'Paste your ApiKey' }] },
          { es: 'Autoriza la dirección web', en: 'Authorize the web address', img: 'guia-img/conectar-7.png',
            des_es: 'Arriba: menú Herramientas → Opciones → pestaña "Asesores Expertos". Marca "Permitir WebRequest para las siguientes direcciones" y añade esta (escríbela y pulsa Enter):\n\nhttps://www.onyxtradinglive.com\n\nLuego "OK". Sin esto, Onyx no puede comunicarse con tu cuenta.',
            des_en: 'Top: Tools menu → Options → "Expert Advisors" tab. Tick "Allow WebRequest for listed URL" and add this one (type it and press Enter):\n\nhttps://www.onyxtradinglive.com\n\nThen "OK". Without this, Onyx cannot talk to your account.',
            markers: [{ x: 8, y: 59, n: 1, es: 'Permitir WebRequest', en: 'Allow WebRequest' }, { x: 12, y: 66, n: 2, es: 'Añade la dirección y Enter', en: 'Add the address and Enter' }] },
          { es: 'Enciende Algo Trading y verifica', en: 'Turn on Algo Trading and verify', img: 'guia-img/conectar-8.png',
            des_es: 'Pulsa el botón "Algo Trading" (o "AutoTrading") de la barra de arriba: debe quedar en VERDE. Esa es la señal que importa.\n\nNota: en algunas versiones de MT5 NO aparece la carita en el gráfico, o es muy pequeña. No te preocupes por ella. Para confirmar que carga bien, abre la pestaña "Expertos" abajo (o "Diario"): verás un mensaje de que Onyx Connect se inició. La prueba definitiva es Onyx: en unos segundos, en "Estado de tus cuentas" la cuenta pasa de "sin señal" a "Conectado" en verde, con tu balance y operaciones.\n\nSi no conecta: revisa que (1) el botón AutoTrading esté verde, (2) hayas pegado bien la ApiKey, y (3) hayas añadido la dirección web del paso 7 en Herramientas → Opciones → Asesores Expertos.\n\n(Plataformas sin conector —MatchTrader, TradeLocker, DXtrade— llegan aquí directo: la conexión es automática tras guardar el login; solo espera y refresca.)\n\nDesde "Conectar otra cuenta" repites el proceso con todas las que quieras.',
            des_en: 'Press the "Algo Trading" (or "AutoTrading") button in the top toolbar: it must turn GREEN. That\'s the signal that matters.\n\nNote: on some MT5 builds the smiley face does NOT appear on the chart, or is tiny. Don\'t worry about it. To confirm it loaded, open the "Experts" tab at the bottom (or "Journal"): you\'ll see a message that Onyx Connect started. The definitive proof is Onyx itself: in a few seconds, under "Account status" the account goes from "no signal" to green "Connected", with your balance and trades.\n\nIf it won\'t connect: check that (1) the AutoTrading button is green, (2) you pasted the ApiKey correctly, and (3) you added the web address from step 7 under Tools → Options → Expert Advisors.\n\n(No-connector platforms —MatchTrader, TradeLocker, DXtrade— arrive here directly: the connection is automatic after you save the login; just wait and refresh.)\n\nFrom "Connect another account" you repeat this for as many as you want.',
            markers: [{ x: 7, y: 41, n: 1, es: 'Botón Algo Trading (verde)', en: 'Algo Trading button (green)' }, { x: 12, y: 74, n: 2, es: 'Pasará a "Conectado"', en: 'Will show "Connected"' }] },
          { es: 'Plataformas API (MatchTrader · TradeLocker · DXtrade)', en: 'API platforms (MatchTrader · TradeLocker · DXtrade)', img: 'guia-img/conectar-api.png',
            des_es: 'Si elegiste MatchTrader, TradeLocker o DXtrade, este es tu único camino: NO instalas nada, no hay conector ni clave que pegar.\n\n1) Elige tu plataforma y tu bróker/servidor.\n2) Escribe el correo y la contraseña con los que entras a tu bróker.\n3) Pulsa "Conectar cuenta": la conexión es automática. En unos segundos tu cuenta aparece como "Conectado".\n\n✅ Las tres funcionan EXACTAMENTE igual. Lo único que cambia es el bróker/servidor que eliges en el paso 1; el resto (correo, contraseña, conectar) es idéntico.\n\nSeguridad: tu contraseña se guarda cifrada y solo se usa para conectar con tu bróker.',
            des_en: 'If you picked MatchTrader, TradeLocker or DXtrade, this is your only path: you install NOTHING, there is no connector and no key to paste.\n\n1) Pick your platform and your broker/server.\n2) Enter the email and password you use to log in to your broker.\n3) Press "Connect account": the connection is automatic. In a few seconds your account shows as "Connected".\n\n✅ All three work EXACTLY the same. The only thing that changes is the broker/server you pick in step 1; the rest (email, password, connect) is identical.\n\nSecurity: your password is stored encrypted and is only used to connect to your broker.',
            markers: [{ x: 33, y: 24, n: 1, es: 'Elige plataforma y bróker/servidor', en: 'Pick platform and broker/server', w: 58, h: 11 }, { x: 33, y: 52, n: 2, es: 'Correo y contraseña del bróker', en: 'Broker email and password', w: 58, h: 11 }, { x: 14, y: 78, n: 3, es: 'Pulsa "Conectar"', en: 'Press "Connect"', w: 22, h: 10 }] },
        ],
      },
      {
        id: 'tour-panel', icon: 'dashboard', es: 'Tour del panel', en: 'Dashboard tour', mins: 3,
        steps: [
          { es: 'Tu cabecera: saludo, clima y estilo', en: 'Your header: greeting, weather and style', img: 'guia-img/panel-hub-1.png',
            des_es: 'Arriba ves tu saludo, el clima de tu ciudad, tu estilo de trader y el check-in del día. A la derecha: notificaciones, idioma, tema y tu plan.',
            des_en: 'At the top: your greeting, your city weather, your trader style and the daily check-in. On the right: notifications, language, theme and your plan.',
            markers: [{ x: 42, y: 8, n: 1, es: 'Saludo y check-in', en: 'Greeting & check-in' }, { x: 90, y: 4, n: 2, es: 'Notificaciones y tema', en: 'Notifications & theme', dir: 'left' }] },
          { es: 'Anillos de salud de la cuenta', en: 'Account-health rings', img: 'guia-img/panel-hub-2.png',
            des_es: 'Los cuatro anillos resumen tu cuenta de un vistazo: Salud, Win rate, Profit factor y Payoff. Cambian con el filtro de tiempo.',
            des_en: 'The four rings summarise your account at a glance: Health, Win rate, Profit factor and Payoff. They update with the time filter.',
            markers: [{ x: 14, y: 37, n: 1, es: 'Salud de la cuenta', en: 'Account health' }, { x: 86, y: 37, n: 2, es: 'Payoff', en: 'Payoff', dir: 'left' }] },
          { es: 'Mosaicos de cada módulo', en: 'Module tiles', img: 'guia-img/panel-hub-3.png',
            des_es: 'Cada mosaico abre una sección: Rendimiento, Calendario, Operaciones, Costes, Cuentas, Mi reto, Mi plan y Edge. Pulsa uno para entrar.',
            des_en: 'Each tile opens a section: Performance, Calendar, Trades, Costs, Accounts, My challenge, My plan and Edge. Tap one to open it.',
            markers: [{ x: 18, y: 50, n: 1, es: 'Rendimiento', en: 'Performance' }, { x: 50, y: 60, n: 2, es: 'Mi reto (prop firm)', en: 'My challenge' }] },
          { es: 'Filtros de tiempo y acciones', en: 'Time filters and actions', img: 'guia-img/panel-hub-4.png',
            des_es: 'Elige el rango (Hoy, 7d, 30d, Mes, Año, Todo o fechas) y usa Compartir, Demo o Exportar para guardar o mostrar tu progreso.',
            des_en: 'Pick the range (Today, 7d, 30d, Month, Year, All or custom dates) and use Share, Demo or Export to save or show your progress.',
            markers: [{ x: 20, y: 29, n: 1, es: 'Rango de tiempo', en: 'Time range' }, { x: 75, y: 29, n: 2, es: 'Compartir · Demo · Exportar', en: 'Share · Demo · Export', dir: 'left' }] },
        ],
      },
    ],
  },
  {
    es: 'Módulos', en: 'Modules',
    guides: [
      { id: 'mis-robots', icon: 'robot', es: 'Mis robots', en: 'My robots', mins: 8, steps: [
        { es: 'Abre "Mis robots"', en: 'Open "My robots"', img: 'guia-img/robots-1.png',
          des_es: 'Mis robots es tu centro de robots. Cada cuenta que conectaste aparece como una tarjeta (2) con su nombre, el estado del EA (EA en línea), la ganancia neta y cuántos robots tiene; dentro verás su mejor y peor robot, el drawdown máximo y la diversificación.\n\nTus robots aparecen aquí solos en cuanto su EA opera con su magic number en una cuenta conectada: no tienes que registrarlos a mano.\n\n• (1) "Crear robot" abre el constructor paso a paso (los 7 pasos que siguen).\n• (3) "Ver los robots" abre la lista de robots de esa cuenta.\n• (4) "Comparar carteras" combina varios robots y te muestra si diversifican o caen juntos.',
          des_en: 'My robots is your robot hub. Each account you connected shows as a card (2) with its name, EA status (EA online), net profit and how many robots it has; inside you’ll see its best and worst robot, max drawdown and diversification.\n\nYour robots appear here on their own as soon as their EA trades with its magic number on a connected account — you don’t register them by hand.\n\n• (1) "Create robot" opens the step-by-step builder (the 7 steps that follow).\n• (3) "See the robots" opens that account’s robot list.\n• (4) "Compare portfolios" combines several robots and shows whether they diversify or fall together.',
          markers: [{ x: 50, y: 13, n: 1, es: 'Crear robot (abre el constructor)', en: 'Create robot (opens the builder)' }, { x: 8, y: 19, n: 2, es: 'Tarjeta de tu cuenta conectada', en: 'Your connected account card' }, { x: 8, y: 33, n: 3, es: 'Ver los robots de la cuenta', en: 'See the account’s robots' }, { x: 11, y: 39, n: 4, es: 'Comparar carteras', en: 'Compare portfolios' }] },
        { es: 'Paso 1 de 7 · General', en: 'Step 1 of 7 · General', img: 'guia-img/robots-2.png',
          des_es: 'Aquí defines la identidad del robot. Son 6 campos:\n\n1. Nombre del robot — solo para reconocerlo en tu lista (ej. "Mi cazador de Londres").\n2. Plataforma — dónde correrá el robot. Genera el archivo correcto: .mq5 (MT5), .mq4 (MT4) o .cs (cTrader).\n3. Instrumento — el par o activo (metales, índices, divisas, petróleo, cripto). Lo encuentra aunque tu bróker use otro sufijo (GOLD, XAUUSD.m…).\n4. Magic — la identidad del robot. Onyx lo asigna solo y es ÚNICO: no se puede cambiar, sirve para identificar tu robot en toda la plataforma.\n5. Timeframe de entrada — el ritmo de velas que lee para entrar (ej. 5 min).\n6. Idioma del panel — el idioma del panel y los mensajes del robot en el gráfico.\n\nCuando termines, pulsa (7) "Siguiente → Entry".',
          des_en: 'Here you define the robot’s identity. Six fields:\n\n1. Robot name — just to recognize it in your list (e.g. "My London hunter").\n2. Platform — where the robot will run. It generates the right file: .mq5 (MT5), .mq4 (MT4) or .cs (cTrader).\n3. Instrument — the pair or asset (metals, indices, FX, oil, crypto). It finds it even if your broker uses another suffix (GOLD, XAUUSD.m…).\n4. Magic — the robot’s identity. Onyx assigns it automatically and it is UNIQUE: it can’t be changed and identifies your robot across the platform.\n5. Entry timeframe — the candle rhythm it reads to enter (e.g. 5 min).\n6. Panel language — the language of the robot’s on-chart panel and messages.\n\nWhen done, press (7) "Next → Entry".',
          markers: [{ x: 10, y: 44, n: 1, es: 'Nombre del robot', en: 'Robot name' }, { x: 25, y: 44, n: 2, es: 'Plataforma (.mq5 / .mq4 / .cs)', en: 'Platform (.mq5 / .mq4 / .cs)' }, { x: 42, y: 44, n: 3, es: 'Instrumento', en: 'Instrument' }, { x: 58, y: 44, n: 4, es: 'Magic (automático y único)', en: 'Magic (automatic and unique)' }, { x: 74, y: 44, n: 5, es: 'Timeframe de entrada', en: 'Entry timeframe' }, { x: 90, y: 44, n: 6, es: 'Idioma del panel', en: 'Panel language' }, { x: 96, y: 57, n: 7, es: 'Siguiente → Entry', en: 'Next → Entry' }] },
        { es: 'Paso 2 de 7 · Entrada', en: 'Step 2 of 7 · Entry', img: 'guia-img/robots-3.png',
          des_es: 'Define CUÁNDO y en qué dirección entra:\n\n1. Disparador de entrada — la señal que dispara la entrada (el "cuándo entrar"). Al elegirlo aparecen sus parámetros para ajustarlo.\n2. Sesgo / tendencia — cómo lee la dirección (ej. estructura HH/HL). El robot solo opera a favor de esa tendencia.\n3. Timeframe del sesgo — la temporalidad superior con la que lee la tendencia (ej. 1 h).\n4. Máx. operaciones/día — tope de operaciones por día. 0 = sin límite.\n5. Largos y cortos — deja ambos para operar en las dos direcciones, o apaga uno para que solo compre o solo venda.',
          des_en: 'Define WHEN and in which direction it enters:\n\n1. Entry trigger — the signal that fires the entry (the "when to enter"). Picking it reveals its parameters to tune.\n2. Bias / trend — how it reads direction (e.g. structure HH/HL). The robot only trades in favor of that trend.\n3. Bias timeframe — the higher timeframe it uses to read the trend (e.g. 1 h).\n4. Max trades/day — cap of trades per day. 0 = no limit.\n5. Longs and shorts — keep both to trade both ways, or turn one off so it only buys or only sells.',
          markers: [{ x: 8, y: 64, n: 1, es: 'Disparador de entrada', en: 'Entry trigger' }, { x: 22, y: 64, n: 2, es: 'Sesgo / tendencia', en: 'Bias / trend' }, { x: 36, y: 64, n: 3, es: 'Timeframe del sesgo', en: 'Bias timeframe' }, { x: 8, y: 84, n: 4, es: 'Máx. operaciones/día (0 = sin límite)', en: 'Max trades/day (0 = no limit)' }, { x: 21, y: 82, n: 5, es: 'Largos y cortos', en: 'Longs and shorts' }] },
        { es: 'Paso 3 de 7 · Salidas y gestión', en: 'Step 3 of 7 · Exits & management', img: 'guia-img/robots-4.png',
          des_es: 'Define CÓMO cierra cada operación. Todo usa las mismas unidades: pips, R, %, $ o ×ATR, y el bot las convierte a distancia de precio en tiempo real. Son 7 tarjetas (usa el interruptor para activar/desactivar las opcionales):\n\n1. Stop loss — dónde corta la pérdida y cierra para protegerte.\n2. TP1 (parcial) — primer objetivo: cierra una parte y asegura ganancia.\n3. % cerrado en TP1 — qué porcentaje cierra en TP1; el resto sigue como runner.\n4. Runner / TP final — objetivo del resto de la posición para dejar correr la ganancia.\n5. Trailing — arrastra el stop detrás del precio para no devolver ganancia.\n6. Break even — cuando la ganancia llega a este múltiplo de riesgo, mueve el stop a la entrada (0 = justo en la entrada).\n7. Time-stop (barras) — si tras tantas velas la operación no se mueve, la cierra.',
          des_en: 'Define HOW each trade closes. Everything uses the same units: pips, R, %, $ or ×ATR, and the bot converts them to price distance in real time. Seven cards (use the switch to enable/disable the optional ones):\n\n1. Stop loss — where it cuts the loss and closes to protect you.\n2. TP1 (partial) — first target: closes part and locks profit.\n3. % closed at TP1 — what percent closes at TP1; the rest continues as a runner.\n4. Runner / final TP — target for the rest of the position, to let profit run.\n5. Trailing — trails the stop behind price so you don’t give profit back.\n6. Break even — when profit reaches this multiple of risk, moves the stop to entry (0 = exactly at entry).\n7. Time-stop (bars) — if after this many candles the trade isn’t moving, it closes it.',
          markers: [{ x: 8, y: 69, n: 1, es: 'Stop loss', en: 'Stop loss' }, { x: 22, y: 69, n: 2, es: 'TP1 (parcial)', en: 'TP1 (partial)' }, { x: 36, y: 69, n: 3, es: '% cerrado en TP1', en: '% closed at TP1' }, { x: 50, y: 69, n: 4, es: 'Runner / TP final', en: 'Runner / final TP' }, { x: 64, y: 69, n: 5, es: 'Trailing', en: 'Trailing' }, { x: 78, y: 69, n: 6, es: 'Break even', en: 'Break even' }, { x: 92, y: 69, n: 7, es: 'Time-stop (barras)', en: 'Time-stop (bars)' }] },
        { es: 'Paso 4 de 7 · Riesgo', en: 'Step 4 of 7 · Risk', img: 'guia-img/robots-5.png',
          des_es: 'Define cuánto arriesga y sus frenos de dinero. 4 tarjetas:\n\n1. Riesgo por operación — cuánto arriesga por entrada; dimensiona el lote solo. En %, el tope de seguridad es 5% por trade.\n2. Lote máximo — lote máximo permitido como tope de seguridad, aunque el cálculo pida más.\n3. Freno de pérdida diaria — si pierde esto en un día, se detiene hasta el día siguiente (activable con el interruptor).\n4. Meta diaria (opcional) — cuando gana esto en un día, deja de abrir para conservarlo (viene desactivada).\n\n5. Estimación rápida — escribe un balance de referencia y abajo verás en dinero el riesgo por trade, la pérdida máxima diaria y el R:R.',
          des_en: 'Define how much it risks and its money brakes. Four cards:\n\n1. Risk per trade — how much it risks per entry; it sizes the lot automatically. In %, the safety cap is 5% per trade.\n2. Max lots — maximum lot allowed as a safety cap, even if the math asks for more.\n3. Daily loss cap — if it loses this in a day, it stops until the next day (toggle to enable).\n4. Daily target (optional) — when it wins this in a day, it stops opening to keep it (off by default).\n\n5. Quick estimate — type a reference balance and below you’ll see, in money, the risk per trade, the max daily loss and the R:R.',
          markers: [{ x: 13, y: 60, n: 1, es: 'Riesgo por operación (tope 5%)', en: 'Risk per trade (5% cap)' }, { x: 37, y: 60, n: 2, es: 'Lote máximo', en: 'Max lots' }, { x: 61, y: 60, n: 3, es: 'Freno de pérdida diaria', en: 'Daily loss cap' }, { x: 85, y: 60, n: 4, es: 'Meta diaria (opcional)', en: 'Daily target (optional)' }, { x: 13, y: 88, n: 5, es: 'Balance de referencia (estimación)', en: 'Reference balance (estimate)' }] },
        { es: 'Paso 5 de 7 · Firma y frenos', en: 'Step 5 of 7 · Firm & brakes', img: 'guia-img/robots-6.png',
          des_es: 'Si operas una prop firm (cuenta de fondeo), aquí pones sus reglas. Tres bloques:\n\nReglas de la prop firm:\n1. Nombre de la firma — solo para mostrarlo en el panel (ej. FTMO).\n2. Tipo de DD total — cómo mide tu firma la pérdida máxima: desde el pico (trailing) o desde el balance inicial (estático). Revísalo en tu contrato.\n3. Límite diario de la firma — pérdida diaria máxima que permite antes de romper la cuenta.\n4. Límite total de la firma — pérdida total (drawdown) máxima que permite.\n\n5. Frenos del robot (suave · duro · total) — los colchones del propio robot, SIEMPRE por debajo del límite de la firma, para que nunca te acerques al borde. Suave: deja de abrir nuevas; Duro: cierra todo y bloquea hasta mañana; Total: se detiene antes de tocar el límite de la firma.\n\nMeta de la cuenta:\n6. Fase de la cuenta — en qué etapa estás; fija la meta de ganancia donde el robot deja de abrir.\n7. Metas de fase — balance inicial (0 = lo lee solo), objetivo de Fase 1 y de Fase 2. Al alcanzarlo, el robot deja de abrir.',
          des_en: 'If you trade a prop firm (funded account), set its rules here. Three blocks:\n\nProp-firm rules:\n1. Firm name — just to show it on the panel (e.g. FTMO).\n2. Total DD type — how your firm measures max loss: from the peak (trailing) or from the initial balance (static). Check your contract.\n3. Firm daily limit — max daily loss it allows before breaching the account.\n4. Firm total limit — max total loss (drawdown) it allows.\n\n5. Robot brakes (soft · hard · total) — the robot’s own cushions, ALWAYS below the firm limit, so you never get near the edge. Soft: stops opening new trades; Hard: closes everything and locks until tomorrow; Total: halts before hitting the firm limit.\n\nAccount target:\n6. Account phase — what stage you’re in; sets the profit target where the robot stops opening.\n7. Phase targets — initial balance (0 = it reads it automatically), Phase 1 and Phase 2 targets. Once reached, the robot stops opening.',
          markers: [{ x: 13, y: 47, n: 1, es: 'Nombre de la firma', en: 'Firm name' }, { x: 37, y: 47, n: 2, es: 'Tipo de DD total', en: 'Total DD type' }, { x: 61, y: 47, n: 3, es: 'Límite diario de la firma', en: 'Firm daily limit' }, { x: 84, y: 47, n: 4, es: 'Límite total de la firma', en: 'Firm total limit' }, { x: 10, y: 67, n: 5, es: 'Frenos del robot (suave · duro · total)', en: 'Robot brakes (soft · hard · total)' }, { x: 13, y: 86, n: 6, es: 'Fase de la cuenta', en: 'Account phase' }, { x: 60, y: 86, n: 7, es: 'Metas de fase (inicial · F1 · F2)', en: 'Phase targets (initial · P1 · P2)' }] },
        { es: 'Paso 6 de 7 · Horario y noticias', en: 'Step 6 of 7 · Schedule & news', img: 'guia-img/robots-7.png',
          des_es: 'Define CUÁNDO puede operar:\n\n1. Días de operación — marca los días en que busca entradas. El mercado abre el domingo y cierra el viernes; el sábado está cerrado.\n2. Atajos de sesión — botones para añadir rápido Londres, Nueva York, Asia o el solape LDN/NY. Puedes añadir varias sesiones con "Añadir ventana".\n3. Horario de la sesión — hora de inicio y fin (hora del servidor); te muestra el equivalente en tu hora local. El bot busca entradas si la hora cae dentro de CUALQUIER sesión.\n4. GMT del servidor del bróker — la zona horaria del servidor de tu bróker; se usa para tu hora local y el filtro de noticias.\n5. Cierre de sesión y fin de semana — hora en que cierra lo que tenga abierto; "Cerrar al fin de sesión" y "Sin fin de semana" evitan dejar operaciones abiertas.',
          des_en: 'Define WHEN it can trade:\n\n1. Trading days — mark the days it looks for entries. The market opens Sunday and closes Friday; Saturday is closed.\n2. Session shortcuts — buttons to quickly add London, New York, Asia or the LDN/NY overlap. You can add several sessions with "Add window".\n3. Session hours — start and end time (server time); it shows the equivalent in your local time. The bot seeks entries if the time falls inside ANY session.\n4. Broker server GMT — your broker server’s time zone; used for your local time and the news filter.\n5. Session close & weekend — the time it closes anything open; "Close at session end" and "No weekend" avoid leaving trades open.',
          markers: [{ x: 42, y: 48, n: 1, es: 'Días de operación', en: 'Trading days' }, { x: 13, y: 61, n: 2, es: 'Atajos de sesión (Londres/NY/Asia)', en: 'Session shortcuts (London/NY/Asia)' }, { x: 16, y: 67, n: 3, es: 'Horario de la sesión', en: 'Session hours' }, { x: 25, y: 77, n: 4, es: 'GMT del servidor del bróker', en: 'Broker server GMT' }, { x: 16, y: 92, n: 5, es: 'Cierre de sesión y fin de semana', en: 'Session close & weekend' }] },
        { es: 'Paso 7 de 7 (a) · Panel en el gráfico', en: 'Step 7 of 7 (a) · On-chart panel', img: 'guia-img/robots-8.png',
          des_es: 'El último paso es "Vender / permisos" y tiene dos partes. Esta es la apariencia del panel que el robot muestra dentro de MT5, MT4 o cTrader:\n\n1. Mostrar el panel en el gráfico — actívalo para que el comprador vea el panel en su gráfico.\n2. Vista previa del panel — cómo se verá: nombre, estado, firma/cuenta, balance, equity, drawdown, meta y estadísticas (WR, trades, neto).\n3. Tema — oscuro o claro.\n4. Color de acento — el color del panel.\n5. Filas que se muestran — elige qué filas aparecen: firma/cuenta, drawdown, meta y estadísticas.',
          des_en: 'The last step is "Sell / permissions" and has two parts. This is the look of the panel the robot shows inside MT5, MT4 or cTrader:\n\n1. Show the panel on the chart — enable it so the buyer sees the panel on their chart.\n2. Panel preview — how it will look: name, status, firm/account, balance, equity, drawdown, target and stats (WR, trades, net).\n3. Theme — dark or light.\n4. Accent color — the panel color.\n5. Rows shown — choose which rows appear: firm/account, drawdown, target and stats.',
          markers: [{ x: 8, y: 52, n: 1, es: 'Mostrar panel en el gráfico', en: 'Show panel on the chart' }, { x: 49, y: 69, n: 2, es: 'Vista previa del panel', en: 'Panel preview' }, { x: 25, y: 89, n: 3, es: 'Tema (oscuro / claro)', en: 'Theme (dark / light)' }, { x: 54, y: 89, n: 4, es: 'Color de acento', en: 'Accent color' }, { x: 13, y: 97, n: 5, es: 'Filas que se muestran', en: 'Rows shown' }] },
        { es: 'Paso 7 de 7 (b) · Permisos del comprador', en: 'Step 7 of 7 (b) · Buyer permissions', img: 'guia-img/robots-9.png',
          des_es: 'La segunda parte del paso 7: qué puede tocar quien compre tu robot.\n\n1. Esquina y posición del panel — dónde se ancla en el gráfico (esquina + distancias horizontal/vertical).\n2. Permiso Balanceado (recomendado) — hay tres niveles: Abierto (todo editable), Balanceado (tu estrategia fija; su riesgo y firma libres) y Blindado (máxima protección). Balanceado es lo recomendado.\n3. Estrategia bloqueada — entradas, SL/TP, runner y trailing quedan LOCKED para que el robot rinda como lo anuncias.\n4. Lo que el comprador sí edita — como administra su propia cuenta, su riesgo y tamaño, gestión y frenos, cuenta de fondeo y filtros/horas quedan EDITABLES.\n5. Rangos permitidos (opcional) — dale libertad con barandillas: mín/máx de riesgo por trade, lote y operaciones por día (0 = sin límite).\n\nAl terminar pulsa "Finalizar → ver resumen".',
          des_en: 'The second part of step 7: what the buyer of your robot can touch.\n\n1. Panel corner & position — where it anchors on the chart (corner + horizontal/vertical offsets).\n2. Balanced permission (recommended) — three levels: Open (all editable), Balanced (your strategy fixed; their risk and firm free) and Armored (max protection). Balanced is recommended.\n3. Strategy locked — entries, SL/TP, runner and trailing stay LOCKED so the robot performs as advertised.\n4. What the buyer can edit — since they manage their own account, their risk & size, management & brakes, funded account and filters/hours stay EDITABLE.\n5. Allowed ranges (optional) — give freedom with guardrails: min/max for risk per trade, lot and trades per day (0 = no limit).\n\nWhen done, press "Finish → see summary".',
          markers: [{ x: 15, y: 6, n: 1, es: 'Esquina y posición del panel', en: 'Panel corner & position' }, { x: 49, y: 26, n: 2, es: 'Permiso Balanceado (recomendado)', en: 'Balanced permission (recommended)' }, { x: 95, y: 34, n: 3, es: 'Estrategia bloqueada (Locked)', en: 'Strategy locked' }, { x: 95, y: 51, n: 4, es: 'Lo que el comprador sí edita', en: 'What the buyer can edit' }, { x: 10, y: 70, n: 5, es: 'Rangos permitidos (opcional)', en: 'Allowed ranges (optional)' }] },
        { es: 'Tus creaciones: descarga, prueba y vende', en: 'Your creations: download, test and sell', img: 'guia-img/robots-10.png',
          des_es: 'Al crear el robot llegas a "Mis creaciones", donde están todos tus robots como tarjetas.\n\n1. Buscador — busca por nombre.\n2. Filtros — Todos · Trading · Sin probar, y orden (ej. Más nuevos).\n3. Tarjeta del robot — muestra plataforma (MT5), instrumento (XAUUSD), su magic, el estado (Sin probar) y la fecha de creación.\n4. Archivos — Descargar .mq5 (el archivo listo para instalar), Config (.set), Guía (instrucciones del propio robot) y Probar en demo.\n5. Vender — se habilita cuando el robot acumula las operaciones mínimas en demo (ej. 0/50 trades). También puedes Duplicar o Editar cada robot.',
          des_en: 'After creating the robot you land on "My creations", where all your robots appear as cards.\n\n1. Search — find by name.\n2. Filters — All · Trading · Untested, and sorting (e.g. Newest).\n3. Robot card — shows platform (MT5), instrument (XAUUSD), its magic, the status (Untested) and the creation date.\n4. Files — Download .mq5 (the ready-to-install file), Config (.set), Guide (the robot’s own instructions) and Test on demo.\n5. Sell — unlocks once the robot reaches the minimum trades on demo (e.g. 0/50 trades). You can also Duplicate or Edit each robot.',
          markers: [{ x: 18, y: 11, n: 1, es: 'Buscador', en: 'Search' }, { x: 91, y: 11, n: 2, es: 'Filtros (Todos / Trading / Sin probar)', en: 'Filters (All / Trading / Untested)' }, { x: 10, y: 21, n: 3, es: 'Tarjeta del robot', en: 'Robot card' }, { x: 9, y: 35, n: 4, es: 'Archivos (.mq5 · .set · Guía · Demo)', en: 'Files (.mq5 · .set · Guide · Demo)' }, { x: 6, y: 43, n: 5, es: 'Vender (al cumplir las operaciones)', en: 'Sell (once trades are met)' }] },
      ] },
      { id: 'onyx-copy', icon: 'copy', es: 'Onyx Copy', en: 'Onyx Copy', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/copy-1.png',
          des_es: 'Guía de copy trading: elegir proveedor, conectar y seguir.',
          des_en: 'Copy trading guide: pick a provider, connect and follow.' } ] },
      { id: 'guardian', icon: 'shield', es: 'Guardian y plan', en: 'Guardian & plan', mins: 10, steps: [
        { es: 'Activar Guardian (pestaña Trade)', en: 'Activate Guardian (Trade tab)', img: 'guia-img/guardian-1.png',
          des_es: 'Onyx Guardian protege tus operaciones de forma automática. Primero enciéndelo y elige sobre qué cuenta trabaja.\n\n1. Interruptor general — si lo apagas, Onyx no toca nada.\n2. Guardar y ACTIVAR Guardian — el botón verde que deja la protección en marcha.\n3. Cuenta con la que trabaja — muestra la cuenta y si el EA está conectado ("EA connected").\n4. ¿Cómo mido mis niveles? — elige la unidad (Pips, R o Dinero). Esa unidad se aplica a break even, trailing y parciales; al cambiarla, todas las casillas se ajustan.\n5. Las 3 protecciones — Break even, Trailing stop y Parciales, cada una con su interruptor (activas 0 de 6 al inicio).\n6. Guardar y enviar — manda la configuración al EA.\n\nLas pestañas de arriba (Trade · Mi plan · Límites · Noticias · Historial) son las 5 secciones que verás en los pasos siguientes.',
          des_en: 'Onyx Guardian protects your trades automatically. First turn it on and choose which account it works on.\n\n1. Main switch — if you turn it off, Onyx touches nothing.\n2. Save and ACTIVATE Guardian — the green button that keeps protection running.\n3. Working account — shows the account and whether the EA is connected ("EA connected").\n4. How do I measure my levels? — pick the unit (Pips, R or Money). It applies to break even, trailing and partials; change it and every box adjusts.\n5. The 3 protections — Break even, Trailing stop and Partials, each with its switch (0 of 6 active at first).\n6. Save and send — pushes the setup to the EA.\n\nThe tabs on top (Trade · My plan · Limits · News · History) are the 5 sections you’ll see in the next steps.',
          markers: [{ x: 95, y: 6, n: 1, es: 'Interruptor general', en: 'Main switch' }, { x: 50, y: 11, n: 2, es: 'Guardar y ACTIVAR Guardian', en: 'Save and ACTIVATE Guardian' }, { x: 18, y: 21, n: 3, es: 'Cuenta con la que trabaja', en: 'Working account' }, { x: 19, y: 53, n: 4, es: 'Unidad de medida (Pips/R/Dinero)', en: 'Measure unit (Pips/R/Money)' }, { x: 95, y: 78, n: 5, es: 'Las 3 protecciones (interruptores)', en: 'The 3 protections (switches)' }, { x: 7, y: 97, n: 6, es: 'Guardar y enviar', en: 'Save and send' }] },
        { es: 'Protección 1 · Break even', en: 'Protection 1 · Break even', img: 'guia-img/guardian-2.png',
          des_es: 'El break even mueve el stop en cuanto la operación va a tu favor, para que ya no pueda perder.\n\n1. Dispara cuando la ganancia llega a — cuántos pips de ganancia hacen que se active.\n2. Dónde queda el stop — tres opciones: Debajo de la entrada (deja aire, aún puede perder un poco), Justo en la entrada (cero en precio, pero pierdes las comisiones) o Por encima de la entrada cubriendo costos (break even real: sales en cero de verdad).\n3. Colchón extra — pips adicionales de margen.\n4. Cubrir comisión y swap automáticamente — Onyx lee lo que te cobró el bróker en cada operación y lo compensa.',
          des_en: 'Break even moves the stop as soon as the trade goes your way, so it can no longer lose.\n\n1. Triggers when profit reaches — how many pips of profit activate it.\n2. Where the stop lands — three options: Below entry (gives room, can still lose a bit), Exactly at entry (zero on price, but you lose the fees) or Above entry covering costs (real break even: you exit at true zero).\n3. Extra buffer — extra pips of margin.\n4. Cover commission and swap automatically — Onyx reads what the broker charged on each trade and covers it.',
          markers: [{ x: 11, y: 25, n: 1, es: 'Dispara cuando la ganancia llega a', en: 'Triggers when profit reaches' }, { x: 50, y: 65, n: 2, es: 'Dónde queda el stop (opción elegida)', en: 'Where the stop lands (chosen option)' }, { x: 10, y: 79, n: 3, es: 'Colchón extra', en: 'Extra buffer' }, { x: 94, y: 90, n: 4, es: 'Cubrir comisión y swap', en: 'Cover commission and swap' }] },
        { es: 'Protección 2 · Trailing stop', en: 'Protection 2 · Trailing stop', img: 'guia-img/guardian-3.png',
          des_es: 'El trailing sigue al precio para ir asegurando ganancia mientras la operación sigue corriendo.\n\n1. Arranca cuando la ganancia llega a — a partir de cuántos pips empieza a seguir.\n2. Distancia del precio — a cuántos pips por detrás del precio se coloca el stop.\n3. Tipo — por ahora "Distancia fija"; máximos/mínimos, media móvil y ATR llegan en la próxima versión.',
          des_en: 'Trailing follows price to lock in profit while the trade keeps running.\n\n1. Starts when profit reaches — from how many pips it begins to follow.\n2. Distance from price — how many pips behind price the stop sits.\n3. Type — for now "Fixed distance"; highs/lows, moving average and ATR come in the next version.',
          markers: [{ x: 7, y: 66, n: 1, es: 'Arranca cuando la ganancia llega a', en: 'Starts when profit reaches' }, { x: 20, y: 66, n: 2, es: 'Distancia del precio', en: 'Distance from price' }, { x: 38, y: 66, n: 3, es: 'Tipo', en: 'Type' }] },
        { es: 'Protección 3 · Parciales (take profits)', en: 'Protection 3 · Partials (take profits)', img: 'guia-img/guardian-4.png',
          des_es: 'Los parciales cierran la posición por partes a medida que va a tu favor. Los porcentajes son sobre el tamaño original.\n\n1. TP1 — enciéndelo e indica a cuántos pips llega y qué % cierra ahí (ej. a 20 pips cierra 40%).\n2. TP2 y TP3 — objetivos adicionales, apagados por defecto; actívalos si quieres cerrar en más niveles.\n3. Runner — la parte final que dejas correr para atrapar el movimiento grande. Con "Déjalo correr con el trailing" no cierra en un nivel: se queda y lo protege el trailing.\n4. Total de parciales — resume cuánto cierras en parciales y cuánto queda de runner.\n\nAviso: con 0.01 lotes el bróker no deja partir la posición, así que los parciales se omiten.',
          des_en: 'Partials close the position in parts as it moves your way. Percentages are of the original size.\n\n1. TP1 — turn it on and set how many pips it reaches and what % closes there (e.g. at 20 pips closes 40%).\n2. TP2 and TP3 — extra targets, off by default; enable them to close at more levels.\n3. Runner — the final piece you let run to catch the big move. With "Let it run with the trailing" it doesn’t close at a level: it stays and the trailing protects it.\n4. Partials total — sums how much you close in partials and how much runner is left.\n\nHeads up: with 0.01 lots the broker won’t split the position, so partials are skipped.',
          markers: [{ x: 50, y: 26, n: 1, es: 'TP1 (activar · pips · % que cierra)', en: 'TP1 (enable · pips · % closed)' }, { x: 50, y: 47, n: 2, es: 'TP2 y TP3 (opcionales)', en: 'TP2 and TP3 (optional)' }, { x: 50, y: 68, n: 3, es: 'Runner (déjalo correr con el trailing)', en: 'Runner (let it run with trailing)' }, { x: 91, y: 82, n: 4, es: 'Total de parciales', en: 'Partials total' }] },
        { es: 'Acciones rápidas y plantillas (Trade)', en: 'Quick actions and templates (Trade)', img: 'guia-img/guardian-5.png',
          des_es: 'Al final de la pestaña Trade tienes botones de acción inmediata y las plantillas.\n\n1. Acciones rápidas — se ejecutan en tu plataforma (MetaTrader, cTrader, MatchTrader, TradeLocker o DXtrade) en segundos: Mover SL a break even, Cerrar la mitad, Cerrar solo ganadoras.\n2. Cerrar todo — el botón rojo: cierra absolutamente todo. Úsalo con cuidado.\n3. Plantillas — guarda esta configuración con un nombre y aplícala a otras cuentas.\n4. Ten en cuenta — Onyx solo actúa con tu plataforma abierta y el conector corriendo (AlgoTrading encendido en MetaTrader, o el cBot en Play en cTrader) y con conexión. Si tu PC se apaga, no protege: para operar en serio, usa un VPS. Es un ayudante, no una garantía: un hueco de mercado puede saltar cualquier stop.',
          des_en: 'At the bottom of the Trade tab you have instant-action buttons and templates.\n\n1. Quick actions — they run in your platform (MetaTrader, cTrader, MatchTrader, TradeLocker or DXtrade) within seconds: Move SL to break even, Close half, Close winners only.\n2. Close everything — the red button: closes absolutely everything. Use it carefully.\n3. Templates — save this setup with a name and apply it to other accounts.\n4. Keep in mind — Onyx only acts with your platform open and the connector running (AlgoTrading on in MetaTrader, or the cBot on Play in cTrader) and a live connection. If your PC shuts down, it does not protect: to trade seriously, use a VPS. It’s a helper, not a guarantee: a market gap can jump over any stop.',
          markers: [{ x: 50, y: 22, n: 1, es: 'Acciones rápidas', en: 'Quick actions' }, { x: 73, y: 26, n: 2, es: 'Cerrar todo (cuidado)', en: 'Close everything (careful)' }, { x: 20, y: 58, n: 3, es: 'Plantillas', en: 'Templates' }, { x: 50, y: 82, n: 4, es: 'Ten en cuenta (VPS)', en: 'Keep in mind (VPS)' }] },
        { es: 'Mi plan · días y horario', en: 'My plan · days and schedule', img: 'guia-img/guardian-6.png',
          des_es: 'En la pestaña "Mi plan" decides, con la cabeza fría, cuándo tienes permiso para operar. Después Guardian te lo recuerda, aunque no quieras oírlo.\n\n1. Mi plan de trading — interruptor que activa el plan.\n2. Días que opero — marca los días permitidos.\n3. Ventanas de horario — en tu hora local (abajo muestra la del bróker). El bot solo opera dentro de las ventanas encendidas.\n4. Cerrar todo antes del fin de semana — evita el hueco del domingo y el swap del fin de semana (elige día y hora).\n5. Máximo de operaciones por día y Esperar tras una pérdida — el mejor antídoto contra el revenge trading (0 = sin límite).\n6. Freno por racha perdedora — tras varias pérdidas seguidas, Guardian te para un rato (nº de pérdidas y minutos de pausa).',
          des_en: 'In the "My plan" tab you decide, with a clear head, when you’re allowed to trade. Later Guardian reminds you, even when you’d rather not hear it.\n\n1. My trading plan — switch that activates the plan.\n2. Days I trade — mark the allowed days.\n3. Time windows — in your local time (below it shows broker time). The bot only trades inside the windows that are on.\n4. Close everything before the weekend — avoids the Sunday gap and weekend swap (pick day and time).\n5. Maximum trades per day and Wait after a loss — the best antidote to revenge trading (0 = no limit).\n6. Losing-streak brake — after several losses in a row, Guardian stops you for a while (number of losses and pause minutes).',
          markers: [{ x: 20, y: 11, n: 1, es: 'Mi plan de trading', en: 'My trading plan' }, { x: 19, y: 22, n: 2, es: 'Días que opero', en: 'Days I trade' }, { x: 50, y: 34, n: 3, es: 'Ventanas de horario', en: 'Time windows' }, { x: 15, y: 68, n: 4, es: 'Cerrar todo antes del finde', en: 'Close before weekend' }, { x: 15, y: 79, n: 5, es: 'Máx. ops/día + esperar tras pérdida', en: 'Max trades/day + wait after loss' }, { x: 15, y: 95, n: 6, es: 'Freno por racha perdedora', en: 'Losing-streak brake' }] },
        { es: 'Mi plan · si intentas saltártelo', en: 'My plan · if you try to skip it', img: 'guia-img/guardian-7.png',
          des_es: 'Aquí defines qué pasa cuando intentas romper tu propio plan. Tres niveles de dureza:\n\n1. Solo avísame — ves la advertencia y decides; nada se bloquea.\n2. Hazme esperar — puedes saltártelo, pero primero esperas unos minutos. Normalmente es suficiente.\n3. Bloquéame hasta mañana — sin salida; elígelo solo si de verdad vas en serio.\n4. Minutos a esperar — cuántos minutos te hace esperar la opción 2.',
          des_en: 'Here you set what happens when you try to break your own plan. Three levels of strictness:\n\n1. Just warn me — you see the warning and decide; nothing is blocked.\n2. Make me wait — you can skip it, but you wait a few minutes first. Usually that’s enough.\n3. Lock me until tomorrow — no way out; pick it only if you really mean it.\n4. Minutes to wait — how many minutes option 2 makes you wait.',
          markers: [{ x: 50, y: 23, n: 1, es: 'Solo avísame', en: 'Just warn me' }, { x: 50, y: 39, n: 2, es: 'Hazme esperar', en: 'Make me wait' }, { x: 50, y: 56, n: 3, es: 'Bloquéame hasta mañana', en: 'Lock me until tomorrow' }, { x: 8, y: 77, n: 4, es: 'Minutos a esperar', en: 'Minutes to wait' }] },
        { es: 'Límites · base de cálculo', en: 'Limits · calculation base', img: 'guia-img/guardian-8.png',
          des_es: 'La pestaña "Límites" responde las dos preguntas que casi todos fallan: sobre qué se mide el porcentaje y cuándo empieza el día. Confirma ambas con tu firma.\n\n1. Límites de la cuenta — interruptor de la sección.\n2. Empezar desde una plantilla — un punto de partida (FTMO, The5ers, Topstep…), NO la regla oficial: las firmas cambian sus reglas, revisa tu contrato.\n3. Base de cálculo — sobre qué número se calcula el %: Balance al inicio del día (lo más común en fondeo), Equity al inicio del día (cuenta lo que tenías abierto) o Balance inicial de la cuenta (fijo, nunca se mueve).\n4. Hora de reinicio diario — la hora del servidor del bróker en que empieza un nuevo día (muchas firmas no usan medianoche).',
          des_en: 'The "Limits" tab answers the two questions almost everyone gets wrong: what the percentage is measured on, and when the day starts. Confirm both with your firm.\n\n1. Account limits — section switch.\n2. Start from a template — a starting point (FTMO, The5ers, Topstep…), NOT the official rule: firms change their rules, check your contract.\n3. Calculation base — which number the % is calculated on: Balance at day start (most common in funded), Equity at day start (counts what you had open) or Initial account balance (fixed, never moves).\n4. Daily reset hour — the broker server hour when a new day starts (many firms don’t use midnight).',
          markers: [{ x: 20, y: 14, n: 1, es: 'Límites de la cuenta', en: 'Account limits' }, { x: 50, y: 35, n: 2, es: 'Empezar desde una plantilla', en: 'Start from a template' }, { x: 50, y: 55, n: 3, es: 'Base de cálculo', en: 'Calculation base' }, { x: 10, y: 91, n: 4, es: 'Hora de reinicio diario', en: 'Daily reset hour' }] },
        { es: 'Límites · topes y acción', en: 'Limits · caps and action', img: 'guia-img/guardian-9.png',
          des_es: 'La parte de abajo de "Límites": los topes en % o $ y qué hace Guardian al cruzarlos.\n\n1. Pérdida máxima diaria — al alcanzarla, terminaste por hoy. No se puede saltar.\n2. Pérdida máxima total — al alcanzarla, terminaste. Tampoco se puede saltar.\n3. Meta diaria — al llegar, Guardian te invita a parar (esta sí la puedes saltar).\n4. Margen de seguridad — reserva un % del límite; al 20% te detiene al 80% del tope real.\n5. Máx. lotes por trade y Posiciones abiertas a la vez — 0 = sin límite.\n6. Cuando se cruza el límite — Solo avisar, Bloquear nuevas operaciones, o Cerrar todo y bloquear.',
          des_en: 'The bottom of "Limits": the caps in % or $ and what Guardian does when they’re crossed.\n\n1. Maximum daily loss — on reaching it, you’re done for the day. Cannot be overridden.\n2. Maximum total loss — on reaching it, you’re done. Also cannot be overridden.\n3. Daily target — on reaching it, Guardian invites you to stop (this one you can override).\n4. Safety margin — reserve a % of the limit; at 20% it stops you at 80% of the real cap.\n5. Max lots per trade and Open positions at once — 0 = no limit.\n6. When the limit is crossed — Warn only, Block new trades, or Close everything and block.',
          markers: [{ x: 11, y: 9, n: 1, es: 'Pérdida máxima diaria', en: 'Maximum daily loss' }, { x: 11, y: 20, n: 2, es: 'Pérdida máxima total', en: 'Maximum total loss' }, { x: 11, y: 31, n: 3, es: 'Meta diaria', en: 'Daily target' }, { x: 8, y: 44, n: 4, es: 'Margen de seguridad', en: 'Safety margin' }, { x: 15, y: 57, n: 5, es: 'Máx. lotes / posiciones abiertas', en: 'Max lots / open positions' }, { x: 50, y: 87, n: 6, es: 'Acción al cruzar el límite', en: 'Action when crossed' }] },
        { es: 'Noticias · apagón por noticias', en: 'News · news blackout', img: 'guia-img/guardian-10.png',
          des_es: 'La pestaña "Noticias" evita operar alrededor de publicaciones de alto impacto.\n\n1. Apagón por noticias — interruptor de la sección.\n2. Qué noticias — Solo alto impacto, Alto y medio, o Alto, medio y bajo.\n3. Minutos antes y después — cuánto tiempo antes y después de la noticia se bloquea.\n4. Solo si afecta la divisa del par — apágalo para bloquear en cualquier publicación relevante.\n5. Cuando se cruza — Solo avisar, Bloquear nuevas operaciones o Cerrar todo y bloquear.\n\nNota: el calendario viene de un proveedor externo; puede fallar o mover una hora sin avisar, no dependas solo de él.',
          des_en: 'The "News" tab avoids trading around high-impact releases.\n\n1. News blackout — section switch.\n2. Which news — High impact only, High and medium, or High, medium and low.\n3. Minutes before and after — how long before and after the release it blocks.\n4. Only if it affects the pair currency — turn it off to block on any relevant release.\n5. When crossed — Warn only, Block new trades or Close everything and block.\n\nNote: the calendar comes from an external provider; it can fail or shift a time without notice, don’t rely on it alone.',
          markers: [{ x: 15, y: 15, n: 1, es: 'Apagón por noticias', en: 'News blackout' }, { x: 22, y: 27, n: 2, es: 'Qué noticias', en: 'Which news' }, { x: 15, y: 37, n: 3, es: 'Minutos antes y después', en: 'Minutes before and after' }, { x: 95, y: 48, n: 4, es: 'Solo si afecta la divisa del par', en: 'Only if it affects the pair' }, { x: 50, y: 70, n: 5, es: 'Acción al cruzar', en: 'Action when crossed' }] },
        { es: 'Historial y disciplina', en: 'History and discipline', img: 'guia-img/guardian-11.png',
          des_es: 'La pestaña "Historial" es tu espejo: cuánto te frenó Guardian y cuántas veces te lo saltaste.\n\n1. Hoy — si hay bloqueos activos, y tus números del día: operaciones, veces que te detuviste y veces que te saltaste el freno.\n2. Disciplina (30 días) — no es una nota: es un reflejo de cuántas veces te paró y cuántas lo anulaste (100 = perfecto).\n3. Últimas acciones — el registro de lo que Onyx ha hecho en tus cuentas.\n4. Ten en cuenta — el mismo recordatorio: Onyx solo actúa con la plataforma abierta y el conector corriendo; usa un VPS para operar en serio.',
          des_en: 'The "History" tab is your mirror: how often Guardian stopped you and how often you overrode it.\n\n1. Today — whether there are active blocks, and your day’s numbers: trades, times you stopped and times you overrode.\n2. Discipline (30 days) — not a grade: a mirror of how often it stopped you and how often you overrode it (100 = perfect).\n3. Latest actions — the log of what Onyx has done on your accounts.\n4. Keep in mind — the same reminder: Onyx only acts with the platform open and the connector running; use a VPS to trade seriously.',
          markers: [{ x: 18, y: 25, n: 1, es: 'Hoy (bloqueos y números del día)', en: 'Today (blocks and day numbers)' }, { x: 50, y: 49, n: 2, es: 'Disciplina (30 días)', en: 'Discipline (30 days)' }, { x: 50, y: 67, n: 3, es: 'Últimas acciones', en: 'Latest actions' }, { x: 50, y: 84, n: 4, es: 'Ten en cuenta (VPS)', en: 'Keep in mind (VPS)' }] },
      ] },
      { id: 'ganancia-neta', icon: 'coins', es: 'Ganancia neta', en: 'Net profit', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/neta-1.png',
          des_es: 'Resta tus costos de prop firm y gastos para ver tu ganancia real.',
          des_en: 'Subtract prop-firm costs and expenses to see your real profit.' } ] },
    ],
  },
  {
    es: 'Cuenta', en: 'Account',
    guides: [
      { id: 'planes', icon: 'card', es: 'Planes y pago', en: 'Plans & billing', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/planes-1.png',
          des_es: 'Elegir plan, pagar con tarjeta o USDT y cambiar de plan.',
          des_en: 'Pick a plan, pay by card or USDT and change plans.' } ] },
      { id: 'notificaciones', icon: 'bell', es: 'Notificaciones y Telegram', en: 'Notifications & Telegram', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/notif-1.png',
          des_es: 'Activar push y enlazar Telegram para alertas de tus cuentas.',
          des_en: 'Turn on push and link Telegram for account alerts.' } ] },
    ],
  },
];

export default function ComoUsar() {
  const { lang } = useLang();
  const es = lang === 'es';
  const L = (a: string, b: string) => (es ? a : b);
  const [guideId, setGuideId] = useState('conectar-cuenta');
  const [step, setStep] = useState(0);
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState(false);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const allGuides = CATS.flatMap((c) => c.guides);
  const guide = allGuides.find((g) => g.id === guideId) || allGuides[0];
  const total = guide.steps.length;
  const st = guide.steps[Math.min(step, total - 1)];

  function open(id: string) { setGuideId(id); setStep(0); setZoom(false); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function go(i: number) { setStep(Math.max(0, Math.min(total - 1, i))); setZoom(false); }

  // Flechas del teclado ← → para avanzar/retroceder
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (zoom) { if (e.key === 'Escape') setZoom(false); return; }
      if (e.key === 'ArrowRight') setStep((s) => Math.min(total - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [total, zoom]);

  const ql = q.trim().toLowerCase();
  const match = (g: Guide) => !ql || (es ? g.es : g.en).toLowerCase().includes(ql);

  return (
    <div className="onyx-guias">
      <style>{`
        .onyx-guias{min-height:100vh}
        .onyx-guias .inner{max-width:1720px;margin:0 auto;padding:26px 30px 70px}
        .onyx-guias .gcat{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);margin:16px 0 6px;font-weight:700}
        .onyx-guias .glink{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;border:none;cursor:pointer;color:var(--mut);font-size:14px;padding:9px 11px;border-radius:10px;transition:.15s;line-height:1.3}
        .onyx-guias .glink:hover{color:var(--tx);background:var(--card2)}
        .onyx-guias .glink.on{color:var(--tx);background:color-mix(in srgb,var(--brand) 16%,transparent);font-weight:600}
        .onyx-guias .glink .gi{display:inline-flex;color:var(--brand)}
        .onyx-guias .gwrap{display:grid;grid-template-columns:270px minmax(0,1fr) 236px;gap:28px;align-items:start;width:100%;max-width:none}
        @media(max-width:1200px){.onyx-guias .gwrap{grid-template-columns:250px minmax(0,1fr)}.onyx-guias .toc{display:none}}
        @media(max-width:900px){.onyx-guias .gwrap{grid-template-columns:1fr}.onyx-guias .side{position:static!important;max-height:none!important}.onyx-guias .inner{padding:22px 15px 60px}}
        .onyx-guias .stepnum{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:20px;display:grid;place-items:center;flex:none;box-shadow:0 8px 20px -6px rgba(255,120,40,.6)}
        .onyx-guias .shot{position:relative;border-radius:16px;border:1px solid var(--line);overflow:hidden;background:#0c0e15;cursor:zoom-in;box-shadow:0 24px 60px -26px rgba(0,0,0,.75)}
        .onyx-guias .shot img{display:block;width:100%;height:auto}
        /* Indicador = recuadro resaltado translúcido (no tapa el contenido) + numerito en el borde */
        .onyx-guias .mk{position:absolute;transform:translate(-50%,-50%);z-index:2;border:2px solid var(--brand);border-radius:9px;background:color-mix(in srgb,var(--brand) 12%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 20%,transparent);animation:mkpulse 1.9s ease-in-out infinite;pointer-events:none}
        @keyframes mkpulse{0%,100%{box-shadow:0 0 0 2px color-mix(in srgb,var(--brand) 16%,transparent)}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--brand) 7%,transparent)}}
        .onyx-guias .mk .badge{position:absolute;top:-11px;left:-11px;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:12px;display:grid;place-items:center;box-shadow:0 2px 7px rgba(0,0,0,.55)}
        .onyx-guias .legend{display:flex;flex-wrap:wrap;gap:14px 20px;margin-top:12px;padding:12px 15px;background:var(--card2);border:1px solid var(--line);border-radius:12px}
        .onyx-guias .leg{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--tx)}
        .onyx-guias .leg .ld{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:12px;display:grid;place-items:center;flex:none}
        .onyx-guias .bc{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut);margin-bottom:12px;flex-wrap:wrap}
        .onyx-guias .bc a{color:var(--brand);text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:5px;background:color-mix(in srgb,var(--brand) 12%,transparent);padding:5px 11px;border-radius:9px}
        .onyx-guias .bc .sep{opacity:.5}
        .onyx-guias .toc{position:sticky;top:20px;align-self:start}
        .onyx-guias .tocl{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:800;margin-bottom:12px}
        .onyx-guias .tocrow{display:flex;gap:11px;align-items:center;width:100%;text-align:left;background:transparent;border:none;cursor:pointer;padding:9px 0 9px 13px;color:var(--mut);transition:.15s;border-left:2px solid var(--line);line-height:1.35}
        .onyx-guias .tocrow:hover{color:var(--tx)}
        .onyx-guias .tocrow.on{color:var(--tx);border-left-color:var(--brand)}
        .onyx-guias .tocrow.done .tdot{background:var(--brand);border-color:var(--brand)}
        .onyx-guias .tdot{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);flex:none;font-size:9px;font-weight:800;display:grid;place-items:center;color:var(--bg);transition:.15s}
        .onyx-guias .tocrow.on .tdot{border-color:var(--brand);background:transparent;color:var(--brand)}
        .onyx-guias .tocrow .tt{font-size:12.5px;font-weight:600}
        .onyx-guias .zoomwrap{position:fixed;inset:0;z-index:70;background:rgba(3,4,8,.92);display:flex;align-items:center;justify-content:center;padding:28px;cursor:zoom-out;backdrop-filter:blur(4px)}
        .onyx-guias .zoomwrap .zbox{position:relative;max-width:1500px;width:100%;max-height:92vh}
        .onyx-guias .zoomwrap img{display:block;width:100%;height:auto;max-height:92vh;object-fit:contain;border-radius:12px;border:1px solid rgba(255,255,255,.12)}
        /* Botón cerrar circular, siempre visible */
        .onyx-guias .zclose{position:absolute;top:calc(16px + env(safe-area-inset-top));right:16px;width:50px;height:50px;border-radius:50%;background:rgba(10,12,18,.92);border:1.5px solid rgba(255,255,255,.38);color:#fff;font-size:23px;line-height:1;display:grid;place-items:center;cursor:pointer;z-index:10;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 10px 26px -6px rgba(0,0,0,.7);transition:.15s}
        .onyx-guias .zclose:hover{background:linear-gradient(135deg,#ffcf5c,#ff6a2b);border-color:transparent;color:#241002}
        .onyx-guias .zhint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-size:11.5px;color:rgba(255,255,255,.7);background:rgba(10,12,18,.7);padding:5px 12px;border-radius:20px;z-index:8}
        /* Barra de navegación móvil fija */
        .onyx-guias .mnav{display:none}
        @media(max-width:900px){
          .onyx-guias .inner{padding-bottom:86px!important}
          .onyx-guias .mnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(14,17,23,.97);border-top:1px solid var(--line);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
          .onyx-guias .mnav .mb{flex:1;max-width:130px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer}
          .onyx-guias .mnav .mb.ghost{background:#1a1f2b;color:var(--tx);border:1px solid var(--line)}
          .onyx-guias .mnav .mb.prim{background:linear-gradient(100deg,#ffcf5c,#ff6a2b);color:#241002;border:none}
          .onyx-guias .mnav .mb:disabled{opacity:.4}
          .onyx-guias .mnav .mc{font-size:13px;color:var(--mut);font-weight:800;min-width:50px;text-align:center}
          /* En la guía (móvil) ocultamos el chat y la flechita "subir":
             estorbaban los botones Atrás/Sig. de la barra inferior. Este
             <style> solo existe mientras la guía está montada, así que la
             regla no afecta a otras páginas. */
          .onyx-support-root,.onyx-backtotop{display:none!important}
        }
      `}</style>

      <div className="inner">
        <div className="gwrap">
          {/* ───── Columna 1: temas ───── */}
          <aside className="side card" style={{ padding: 14, alignSelf: 'start', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 34px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--tx)', padding: '2px 4px 12px' }}>
              <span style={{ color: 'var(--brand)' }}><OnyxIcon name="book" size={18} glow={false} /></span> {L('Centro de guías', 'Guide center')}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Buscar guía…', 'Search guide…')} style={{ width: '100%', fontSize: 13.5, marginBottom: 6 }} />
            {CATS.map((c) => {
              const gs = c.guides.filter(match);
              if (!gs.length) return null;
              return (
                <div key={c.es}>
                  <div className="gcat">{L(c.es, c.en)}</div>
                  {gs.map((g) => (
                    <button key={g.id} className={'glink' + (g.id === guideId ? ' on' : '')} onClick={() => open(g.id)}>
                      <span className="gi"><OnyxIcon name={g.icon} size={17} glow={false} /></span>{L(g.es, g.en)}
                    </button>
                  ))}
                </div>
              );
            })}
            <Link href="/guia" className="btn btn-ghost" style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: 13 }}>{L('Ver la guía completa', 'See full guide')}</Link>
          </aside>

          {/* ───── Columna 2: un paso a la vez ───── */}
          <main style={{ minWidth: 0 }}
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              if (touchX.current == null || touchY.current == null || zoom) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              const dy = e.changedTouches[0].clientY - touchY.current;
              if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0) go(step + 1); else go(step - 1); }
              touchX.current = null; touchY.current = null;
            }}>
            {/* Miga de pan: volver a la Guía desde cualquier paso */}
            <div className="bc">
              <Link href="/guia">← {L('Guía', 'Guide')}</Link>
              <span className="sep">/</span><span>{L('Cómo usar', 'How to use')}</span>
              <span className="sep">/</span><span style={{ color: 'var(--tx)', fontWeight: 600 }}>{L(guide.es, guide.en)}</span>
            </div>

            {/* Cabecera del paso */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
              <span className="stepnum">{step + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 2 }}>{L('Paso', 'Step')} {step + 1} {L('de', 'of')} {total} · ~{guide.mins} min</div>
                <h1 style={{ margin: 0, fontSize: 27, letterSpacing: '-.4px' }}>{L(st.es, st.en)}</h1>
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {guide.steps.map((_, i) => (
                <span key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i <= step ? 'var(--brand)' : 'var(--line)', transition: '.2s' }} />
              ))}
            </div>

            {/* Imagen grande (clic para ampliar) */}
            <div className="shot" onClick={() => setZoom(true)} title={L('Pulsa para ampliar', 'Click to enlarge')}>
              <img src={'/' + st.img + '?v=' + IMG_V} alt={L(st.es, st.en)}
                   onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; (t.nextElementSibling as HTMLElement).style.display = 'flex'; }} />
              <div style={{ display: 'none', minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--mut)', fontSize: 14, padding: 24, textAlign: 'center' }}>
                <span><OnyxIcon emoji="🖼️" size={24} glow={false} /> {L('Falta la captura', 'Screenshot pending')}: <code className="code">/public/{st.img}</code></span>
              </div>
              {/* Los marcadores van horneados en la propia imagen (alineación perfecta). La leyenda numerada va debajo. */}
            </div>
            {/* Leyenda numerada DEBAJO de la foto: nunca tapa el contenido */}
            {st.markers && st.markers.length > 0 && (
              <div className="legend">
                {st.markers.map((m, j) => (
                  <span key={j} className="leg"><span className="ld">{m.n ?? j + 1}</span> {L(m.es, m.en)}</span>
                ))}
              </div>
            )}
            <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>{L('Pulsa la imagen para ampliarla · usa ← → para navegar', 'Click the image to enlarge · use ← → to navigate')}</div>

            {/* Descripción */}
            <p style={{ fontSize: 16.5, lineHeight: 1.75, color: 'var(--tx)', marginTop: 18, maxWidth: 940, whiteSpace: 'pre-line' }}>{L(st.des_es, st.des_en)}</p>

            {/* Navegación */}
            <div className="row between" style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)', alignItems: 'center' }}>
              <button className="btn btn-ghost" disabled={step === 0} onClick={() => go(step - 1)} style={{ fontSize: 13.5 }}>← {L('Anterior', 'Previous')}</button>
              <Link href="/guia" className="muted" style={{ fontSize: 11.5, textDecoration: 'none' }}>{L('¿Dudas? Lee los artículos o pregúntale a Onyx →', 'Questions? Read the articles or ask Onyx →')}</Link>
              {step < total - 1
                ? <button className="btn btn-primary" onClick={() => go(step + 1)} style={{ fontSize: 13.5 }}>{L('Siguiente', 'Next')} →</button>
                : <Link href="/dashboard" className="btn btn-primary" style={{ fontSize: 13.5 }}>{L('Ir a mi panel', 'Go to my panel')} →</Link>}
            </div>
          </main>

          {/* ───── Columna 3: riel de pasos (cambia el paso al instante) ───── */}
          <nav className="toc">
            <div className="tocl">{L('Pasos', 'Steps')} · {step + 1}/{total}</div>
            {guide.steps.map((s, i) => (
              <button key={i} className={'tocrow' + (i === step ? ' on' : '') + (i < step ? ' done' : '')} onClick={() => go(i)}>
                <span className="tdot">{i < step ? '✓' : i + 1}</span>
                <span className="tt">{L(s.es, s.en)}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Barra de navegación fija (solo móvil): botones grandes + contador */}
      <div className="mnav">
        <button className="mb ghost" disabled={step === 0} onClick={() => go(step - 1)}>‹ {L('Atrás', 'Back')}</button>
        <span className="mc">{step + 1} / {total}</span>
        {step < total - 1
          ? <button className="mb prim" onClick={() => go(step + 1)}>{L('Sig.', 'Next')} ›</button>
          : <Link href="/dashboard" className="mb prim" style={{ textDecoration: 'none' }}>{L('Panel', 'Panel')} ›</Link>}
      </div>

      {/* Lightbox a tamaño completo */}
      {zoom && (
        <div className="zoomwrap" onClick={() => setZoom(false)}>
          <div className="zbox" onClick={(e) => e.stopPropagation()}>
            <img src={'/' + st.img + '?v=' + IMG_V} alt={L(st.es, st.en)} />
          </div>
          <button className="zclose" aria-label={L('Cerrar', 'Close')} onClick={(e) => { e.stopPropagation(); setZoom(false); }}>✕</button>
          <div className="zhint">{L('Toca fuera o pulsa Esc para cerrar', 'Tap outside or press Esc to close')}</div>
        </div>
      )}
    </div>
  );
}
