'use client';
import { useState, useEffect } from 'react';
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

type Marker = { x: number; y: number; n?: number; es: string; en: string; dir?: 'up' | 'down' | 'left' | 'right' };
type Step = { es: string; en: string; des_es: string; des_en: string; img: string; markers?: Marker[] };
type Guide = { id: string; icon: string; es: string; en: string; mins: number; steps: Step[] };
type Cat = { es: string; en: string; guides: Guide[] };

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
        id: 'conectar-cuenta', icon: 'link', es: 'Conectar tu cuenta', en: 'Connect your account', mins: 3,
        steps: [
          { es: 'Paso 1 · Elige tu plataforma', en: 'Step 1 · Pick your platform', img: 'guia-img/conectar-1.png',
            des_es: 'Entra en "Cuentas" y elige dónde operas. Hay dos familias y el resto de la guía cambia según la tuya:\n\n• CON conector (instalas un pequeño programa): MetaTrader 5, MetaTrader 4 y cTrader. Funciona con cualquier bróker o prop firm que use esas plataformas.\n\n• SIN conector, por acceso del bróker (no instalas nada): MatchTrader, TradeLocker y DXtrade. Te conectas con el correo/usuario y contraseña de tu bróker.\n\nNo importa si tu cuenta es demo, de challenge, fondeada o tu capital propio: todas se conectan igual. Elige tu plataforma y pulsa "Siguiente".',
            des_en: 'Open "Accounts" and pick where you trade. There are two families and the rest of the guide changes with yours:\n\n• WITH a connector (you install a small program): MetaTrader 5, MetaTrader 4 and cTrader. Works with any broker or prop firm on those platforms.\n\n• WITHOUT a connector, via broker login (you install nothing): MatchTrader, TradeLocker and DXtrade. You connect with your broker email/username and password.\n\nIt doesn\'t matter if your account is demo, a challenge, funded or your own capital: they all connect the same way. Pick your platform and press "Next".',
            markers: [{ x: 9, y: 41, n: 1, es: 'Selecciona la plataforma', en: 'Select the platform' }, { x: 95, y: 46, n: 2, es: 'Siguiente', en: 'Next', dir: 'left' }] },
          { es: 'Paso 2 · Crea tu clave / cuenta', en: 'Step 2 · Create your key / account', img: 'guia-img/conectar-2.png',
            des_es: 'Ponle un apodo a la cuenta (ej. "FTMO 100K"), elige el tipo (challenge, fondeo, propio o demo) y escribe tu prop firm o bróker. El número de cuenta es opcional en las plataformas con conector: si lo dejas vacío, la clave se ata sola en la primera sincronización.\n\n• MetaTrader / cTrader (con conector): al guardar se genera una CLAVE que pegarás en el conector en el paso 3.\n\n• MatchTrader / TradeLocker / DXtrade (sin conector): aquí mismo eliges tu servidor/bróker de la lista y escribes tu correo y contraseña; no hay clave ni descarga.\n\nPulsa "Crear clave" (o "Conectar", según tu plataforma).',
            des_en: 'Give the account a nickname (e.g. "FTMO 100K"), choose the type (challenge, funded, own or demo) and type your prop firm or broker. The account number is optional on connector platforms: leave it blank and the key binds itself on the first sync.\n\n• MetaTrader / cTrader (with connector): saving generates a KEY you\'ll paste into the connector in step 3.\n\n• MatchTrader / TradeLocker / DXtrade (no connector): right here you pick your server/broker from the list and enter your email and password; no key, no download.\n\nPress "Create key" (or "Connect", depending on your platform).',
            markers: [{ x: 27, y: 42, n: 1, es: 'Apodo de la cuenta', en: 'Account nickname' }, { x: 75, y: 42, n: 2, es: 'Tipo de cuenta', en: 'Account type', dir: 'left' }, { x: 12, y: 63, n: 3, es: 'Crear clave', en: 'Create key' }] },
          { es: 'Paso 3 · Conecta (según tu plataforma)', en: 'Step 3 · Connect (depending on your platform)', img: 'guia-img/conectar-3.png',
            des_es: 'Aquí se separan los dos caminos. Mira solo el que corresponde a tu plataforma.\n\n━━ A) MetaTrader 5 o MetaTrader 4 (con conector) ━━\n1. En Onyx pulsa "Descargar conector" (archivo .ex5 para MT5 o .ex4 para MT4). Ya viene con tu servidor configurado.\n2. Abre MetaTrader → menú Archivo → "Abrir carpeta de datos".\n3. Entra en la carpeta MQL5\\Experts (en MT4 es MQL4\\Experts) y pega ahí el archivo del conector.\n4. Vuelve a MetaTrader, clic derecho en el Navegador → "Actualizar". El conector "Onyx Connect" aparece en Asesores Expertos.\n5. Abre un gráfico de cualquier par y arrastra "Onyx Connect" sobre el gráfico.\n6. En la ventana que sale: pestaña "Común" → marca "Permitir Algo Trading"; pestaña "Entradas" → pega tu CLAVE del paso 2 si te la pide.\n7. Pulsa el botón "AutoTrading" de la barra superior para que quede en verde.\n8. Si ves una carita sonriente arriba del gráfico, el conector está activo.\n\n━━ B) cTrader (con conector) ━━\n1. Descarga el cBot "Onyx Connect" desde Onyx.\n2. Ábrelo en cTrader → sección "Automate" → añade el cBot a un gráfico.\n3. Pega tu clave en los parámetros y pulsa "Play".\n\n━━ C) MatchTrader, TradeLocker o DXtrade (SIN conector) ━━\nNo descargas nada. Elige tu bróker/servidor de la lista y escribe el MISMO correo (o usuario) y contraseña con los que entras a la plataforma de tu bróker. En TradeLocker además eliges entorno demo o real. Pulsa "Conectar" y Onyx inicia sesión por la API del bróker. Pasas directo al paso 4.\n\n(La foto muestra el caso de MetaTrader; en las plataformas por login no verás este paso de descarga.)',
            des_en: 'The two paths split here. Read only the one for your platform.\n\n━━ A) MetaTrader 5 or MetaTrader 4 (with connector) ━━\n1. In Onyx press "Download connector" (.ex5 file for MT5 or .ex4 for MT4). It already has your server configured.\n2. Open MetaTrader → File menu → "Open Data Folder".\n3. Go into the MQL5\\Experts folder (on MT4 it\'s MQL4\\Experts) and paste the connector file there.\n4. Back in MetaTrader, right-click the Navigator → "Refresh". "Onyx Connect" shows up under Expert Advisors.\n5. Open a chart of any pair and drag "Onyx Connect" onto the chart.\n6. In the window that opens: "Common" tab → tick "Allow Algo Trading"; "Inputs" tab → paste your KEY from step 2 if asked.\n7. Press the "AutoTrading" button in the top toolbar so it turns green.\n8. A smiley face above the chart means the connector is live.\n\n━━ B) cTrader (with connector) ━━\n1. Download the "Onyx Connect" cBot from Onyx.\n2. Open it in cTrader → "Automate" section → add the cBot to a chart.\n3. Paste your key in the parameters and press "Play".\n\n━━ C) MatchTrader, TradeLocker or DXtrade (NO connector) ━━\nYou download nothing. Pick your broker/server from the list and enter the SAME email (or username) and password you use to log into your broker\'s platform. On TradeLocker you also choose demo or live environment. Press "Connect" and Onyx signs in through the broker API. You go straight to step 4.\n\n(The photo shows the MetaTrader case; on login platforms you won\'t see this download step.)',
            markers: [{ x: 13, y: 51, n: 1, es: 'Descargar el conector', en: 'Download the connector' }, { x: 95, y: 73, n: 2, es: 'Siguiente', en: 'Next', dir: 'left' }] },
          { es: 'Paso 4 · Verifica la conexión', en: 'Step 4 · Verify the connection', img: 'guia-img/conectar-4.png',
            des_es: 'El último paso es confirmar que la cuenta aparece conectada en Onyx.\n\n• MetaTrader / cTrader (con conector): con el conector puesto en el gráfico y el AutoTrading en verde, en unos segundos la cuenta pasa de "sin señal" a "Conectada" en verde. Si sigue en "sin señal": revisa que el AutoTrading esté activado, que la carita sonría y que la clave pegada sea la correcta. Para que no se corte al apagar tu computadora, usa un VPS (lo dejas encendido 24/7).\n\n• MatchTrader / TradeLocker / DXtrade (sin conector): la conexión es automática en cuanto guardas el login; solo espera unos segundos y refresca. Si no conecta, revisa que el correo, la contraseña y el servidor/bróker sean exactamente los de tu plataforma.\n\nEn ambos casos verás tu balance y tus operaciones, y el panel se llena solo con tus datos reales. Desde "Conectar otra cuenta" repites el proceso con todas las cuentas que quieras (demo, challenge, fondeadas o propias).',
            des_en: 'The last step is confirming the account shows as connected in Onyx.\n\n• MetaTrader / cTrader (with connector): with the connector on the chart and AutoTrading green, in a few seconds the account goes from "no signal" to green "Connected". If it stays "no signal": check AutoTrading is on, the smiley is showing, and the pasted key is correct. To avoid it cutting off when your computer is off, use a VPS (kept on 24/7).\n\n• MatchTrader / TradeLocker / DXtrade (no connector): the connection is automatic as soon as you save the login; just wait a few seconds and refresh. If it won\'t connect, check the email, password and server/broker are exactly those of your platform.\n\nEither way you\'ll see your balance and trades, and the dashboard fills with your real data. From "Connect another account" you repeat this for as many accounts as you want (demo, challenge, funded or your own).',
            markers: [{ x: 10, y: 40, n: 1, es: 'Estado de la cuenta', en: 'Account status' }, { x: 88, y: 40, n: 2, es: 'Conectar otra cuenta', en: 'Connect another', dir: 'left' }] },
        ],
      },
      {
        id: 'tour-panel', icon: 'dashboard', es: 'Tour del panel', en: 'Dashboard tour', mins: 3,
        steps: [
          { es: 'Tu cabecera: saludo, clima y estilo', en: 'Your header: greeting, weather and style', img: 'guia-img/panel-1-hub.png',
            des_es: 'Arriba ves tu saludo, el clima de tu ciudad, tu estilo de trader y el check-in del día. A la derecha: notificaciones, idioma, tema y tu plan.',
            des_en: 'At the top: your greeting, your city weather, your trader style and the daily check-in. On the right: notifications, language, theme and your plan.',
            markers: [{ x: 42, y: 8, n: 1, es: 'Saludo y check-in', en: 'Greeting & check-in' }, { x: 90, y: 4, n: 2, es: 'Notificaciones y tema', en: 'Notifications & theme', dir: 'left' }] },
          { es: 'Anillos de salud de la cuenta', en: 'Account-health rings', img: 'guia-img/panel-1-hub.png',
            des_es: 'Los cuatro anillos resumen tu cuenta de un vistazo: Salud, Win rate, Profit factor y Payoff. Cambian con el filtro de tiempo.',
            des_en: 'The four rings summarise your account at a glance: Health, Win rate, Profit factor and Payoff. They update with the time filter.',
            markers: [{ x: 14, y: 37, n: 1, es: 'Salud de la cuenta', en: 'Account health' }, { x: 86, y: 37, n: 2, es: 'Payoff', en: 'Payoff', dir: 'left' }] },
          { es: 'Mosaicos de cada módulo', en: 'Module tiles', img: 'guia-img/panel-1-hub.png',
            des_es: 'Cada mosaico abre una sección: Rendimiento, Calendario, Operaciones, Costes, Cuentas, Mi reto, Mi plan y Edge. Pulsa uno para entrar.',
            des_en: 'Each tile opens a section: Performance, Calendar, Trades, Costs, Accounts, My challenge, My plan and Edge. Tap one to open it.',
            markers: [{ x: 18, y: 50, n: 1, es: 'Rendimiento', en: 'Performance' }, { x: 50, y: 60, n: 2, es: 'Mi reto (prop firm)', en: 'My challenge' }] },
          { es: 'Filtros de tiempo y acciones', en: 'Time filters and actions', img: 'guia-img/panel-1-hub.png',
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
      { id: 'mis-robots', icon: 'robot', es: 'Mis robots', en: 'My robots', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/robots-1.png',
          des_es: 'Esta guía se completará con las capturas de tu módulo de robots (estados en vivo, por cuenta y magic).',
          des_en: 'This guide will be completed with screenshots of your robots module (live states, by account and magic).' } ] },
      { id: 'onyx-copy', icon: 'copy', es: 'Onyx Copy', en: 'Onyx Copy', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/copy-1.png',
          des_es: 'Guía de copy trading: elegir proveedor, conectar y seguir.',
          des_en: 'Copy trading guide: pick a provider, connect and follow.' } ] },
      { id: 'guardian', icon: 'shield', es: 'Guardian y plan', en: 'Guardian & plan', mins: 2, steps: [
        { es: 'Próximamente', en: 'Coming soon', img: 'guia-img/guardian-1.png',
          des_es: 'Tu plan de trading, hábitos y el check-in diario con Guardian.',
          des_en: 'Your trading plan, habits and the daily Guardian check-in.' } ] },
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
        .onyx-guias .mk{position:absolute;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:8px;z-index:2}
        .onyx-guias .mk .dot{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#ffcf5c,#ff6a2b);color:#241002;font-weight:800;font-size:15px;display:grid;place-items:center;box-shadow:0 0 0 5px rgba(255,157,61,.28),0 6px 16px rgba(0,0,0,.45);flex:none}
        .onyx-guias .mk .lbl{font-size:13px;font-weight:700;color:#241002;background:linear-gradient(100deg,#ffe08a,#e8b923);padding:4px 11px;border-radius:8px;white-space:nowrap;box-shadow:0 6px 16px -4px rgba(0,0,0,.55)}
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
          <main style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--brand)', marginBottom: 6 }}>
              {L('Cómo usar Onyx', 'How to use Onyx')} · {L(guide.es, guide.en)}
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
              <img src={'/' + st.img} alt={L(st.es, st.en)}
                   onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; (t.nextElementSibling as HTMLElement).style.display = 'flex'; }} />
              <div style={{ display: 'none', minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--mut)', fontSize: 14, padding: 24, textAlign: 'center' }}>
                <span><OnyxIcon emoji="🖼️" size={24} glow={false} /> {L('Falta la captura', 'Screenshot pending')}: <code className="code">/public/{st.img}</code></span>
              </div>
              {st.markers?.map((m, j) => (
                <span key={j} className="mk" style={{ left: m.x + '%', top: m.y + '%', flexDirection: m.dir === 'left' ? 'row-reverse' : 'row' }}>
                  {m.n != null && <span className="dot">{m.n}</span>}
                  <span className="lbl">{L(m.es, m.en)}</span>
                </span>
              ))}
            </div>
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

      {/* Lightbox a tamaño completo */}
      {zoom && (
        <div className="zoomwrap" onClick={() => setZoom(false)}>
          <div className="zbox" onClick={(e) => e.stopPropagation()}>
            <img src={'/' + st.img} alt={L(st.es, st.en)} />
            {st.markers?.map((m, i) => (
              <span key={i} className="mk" style={{ left: m.x + '%', top: m.y + '%', flexDirection: m.dir === 'left' ? 'row-reverse' : 'row' }}>
                {m.n != null && <span className="dot">{m.n}</span>}
                <span className="lbl">{L(m.es, m.en)}</span>
              </span>
            ))}
            <button className="btn btn-ghost" onClick={() => setZoom(false)} style={{ position: 'absolute', top: 10, right: 10, fontSize: 13 }}>✕ {L('Cerrar', 'Close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
