import React from 'react';

// ============================================================
// OnyxIcon · set de iconos propio de Onyx (estilo línea, 24px, 2px).
// - Iconos de marca (ai, guardian) llevan la gema hexagonal facetada.
// - Metáforas de trading, no genéricas.
// - Heredan el color por `currentColor`, así toman el acento de su contenedor.
// Uso: <OnyxIcon name="performance" /> o <OnyxIcon emoji="🎯" /> (mapa emoji→icono).
// Si no hay glifo, cae de vuelta al emoji para no romper nada.
// ============================================================

type Els = React.ReactNode;

const G: Record<string, Els> = {
  // ---- Dashboard ----
  performance: (<><rect x="3" y="4" width="18" height="16" rx="3" /><polyline points="6,15 10,11 13,13 18,7" /><polyline points="15,7 18,7 18,10" /></>),
  calendar: (<><rect x="4" y="5" width="16" height="15" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="8" y1="3" x2="8" y2="6" /><line x1="16" y1="3" x2="16" y2="6" /><circle cx="12" cy="14.5" r="1.5" fill="currentColor" stroke="none" /></>),
  trades: (<><line x1="8" y1="4" x2="8" y2="20" /><rect x="6" y="8" width="4" height="7" rx="1" /><line x1="16" y1="5" x2="16" y2="19" /><rect x="14" y="11" width="4" height="5" rx="1" /></>),
  costs: (<><circle cx="12" cy="12" r="8" /><line x1="8.5" y1="12" x2="15.5" y2="12" /></>),
  accounts: (<><rect x="4" y="8" width="16" height="11" rx="2" /><line x1="4" y1="12" x2="20" y2="12" /><path d="M7 5 h10" /></>),
  challenge: (<><line x1="6" y1="4" x2="6" y2="21" /><path d="M6 5 h11 l-2.5 3.5 L17 12 H6 z" /></>),
  plan: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><polyline points="9,12 11,14 15,9" /></>),
  guardian: (<><path d="M12 3 l7 3 v5 c0 5 -3.4 8 -7 9 c-3.6 -1 -7 -4 -7 -9 V6 z" /><polyline points="9,12 11,14 15,9" /></>),
  ai: (<><path d="M12 3 l7 4 v10 l-7 4 l-7 -4 V7 z" /><path d="M12 8.5 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 z" fill="currentColor" stroke="none" /></>),
  balance: (<><line x1="12" y1="4" x2="12" y2="20" /><line x1="6" y1="8" x2="18" y2="8" /><path d="M6 8 l-2.5 5 h5 z" /><path d="M18 8 l-2.5 5 h5 z" /><line x1="9" y1="20" x2="15" y2="20" /></>),
  coach: (<><path d="M4 6 h16 v9 h-9 l-4 3 v-3 H4 z" /><path d="M12 8 l.8 1.7 1.7 .8 -1.7 .8 -.8 1.7 -.8 -1.7 -1.7 -.8 1.7 -.8 z" fill="currentColor" stroke="none" /></>),
  streak: (<><path d="M13 3 c1 4 5 5 5 9 a6 6 0 0 1 -12 0 c0 -3 2 -4 3 -5 c0 2 1 3 2 3 c-1 -4 1 -6 2 -7 z" /></>),
  sessions: (<><circle cx="12" cy="12" r="8" /><line x1="4" y1="12" x2="20" y2="12" /><path d="M12 4 c3 3 3 13 0 16 c-3 -3 -3 -13 0 -16 z" /></>),
  news: (<><rect x="5" y="4" width="14" height="16" rx="2" /><polyline points="8,12 10,12 11,9 13,15 14,12 16,12" /></>),
  money: (<><circle cx="12" cy="12" r="8" /><path d="M14.5 9.5 c-1.5 -1.5 -5 -1 -5 1 c0 2.5 5 1.5 5 4 c0 2 -3.5 2.5 -5 1 M12 7 v10" /></>),
  winrate: (<><circle cx="12" cy="12" r="8" /><path d="M12 4 a8 8 0 0 1 6 13" strokeWidth="3" /></>),
  scale: (<><line x1="12" y1="4" x2="12" y2="20" /><line x1="6" y1="8" x2="18" y2="8" /><path d="M6 8 l-2.5 5 h5 z" /><path d="M18 8 l-2.5 5 h5 z" /></>),
  ruler: (<><rect x="4" y="8" width="16" height="8" rx="2" transform="rotate(0 12 12)" /><line x1="8" y1="8" x2="8" y2="11" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="16" y1="8" x2="16" y2="11" /></>),
  up: (<><polyline points="5,17 10,11 13,14 19,7" /><polyline points="15,7 19,7 19,11" /></>),
  down: (<><polyline points="5,7 10,13 13,10 19,17" /><polyline points="15,17 19,17 19,13" /></>),
  swap: (<><path d="M5 9 h11 l-3 -3 M19 15 h-11 l3 3" /></>),
  duration: (<><circle cx="12" cy="12" r="8" /><path d="M12 8 v4 l3 2" /></>),
  bars: (<><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="11" /></>),
  trophy: (<><path d="M8 4 h8 v4 a4 4 0 0 1 -8 0 z" /><path d="M8 5 H5 a3 3 0 0 0 3 4 M16 5 h3 a3 3 0 0 1 -3 4" /><line x1="12" y1="12" x2="12" y2="16" /><path d="M9 20 h6 l-1 -4 h-4 z" /></>),
  skull: (<><path d="M6 11 a6 6 0 0 1 12 0 v3 a2 2 0 0 1 -2 2 h-1 v2 h-6 v-2 h-1 a2 2 0 0 1 -2 -2 z" /><circle cx="9.5" cy="11.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="14.5" cy="11.5" r="1.3" fill="currentColor" stroke="none" /></>),
  circle: (<><circle cx="12" cy="12" r="7" /></>),
  lots: (<><path d="M12 3 l8 4 v10 l-8 4 l-8 -4 V7 z" /><path d="M4 7 l8 4 8 -4 M12 11 v10" /></>),
  pair: (<><circle cx="8" cy="10" r="4" /><circle cx="15" cy="14" r="4" /></>),
  // ---- Admin ----
  summary: (<><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="14" /><line x1="4" y1="20" x2="20" y2="20" /></>),
  finance: (<><path d="M4 12 a8 8 0 1 0 8 -8 v8 z" /><path d="M12 4 a8 8 0 0 1 7 5 l-7 3" /></>),
  users: (<><circle cx="9" cy="9" r="3" /><path d="M4 19 a5 5 0 0 1 10 0" /><path d="M16 7 a3 3 0 0 1 0 6 M15 19 a5 5 0 0 1 5 -5" /></>),
  mail: (<><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M4 8 l8 5 8 -5" /></>),
  ticket: (<><path d="M4 8 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 a2 2 0 0 0 0 4 a2 2 0 0 0 0 4 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 a2 2 0 0 0 0 -4 a2 2 0 0 0 0 -4 z" /><line x1="14" y1="6" x2="14" y2="18" stroke-dasharray="2 2" /></>),
  chat: (<><path d="M4 6 h16 v9 h-9 l-4 3 v-3 H4 z" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="13" x2="13" y2="13" /></>),
  card: (<><rect x="3" y="6" width="18" height="12" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="7" y1="14" x2="11" y2="14" /></>),
  modules: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M13 16.5 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0" /></>),
  firms: (<><path d="M4 9 l8 -5 8 5" /><line x1="4" y1="20" x2="20" y2="20" /><line x1="6" y1="9" x2="6" y2="20" /><line x1="10" y1="9" x2="10" y2="20" /><line x1="14" y1="9" x2="14" y2="20" /><line x1="18" y1="9" x2="18" y2="20" /></>),
  megaphone: (<><path d="M4 10 v4 l3 1 l1 4 h2 l-1 -4 l8 3 V6 z" /><path d="M18 9 a3 3 0 0 1 0 6" /></>),
  flag: (<><line x1="6" y1="3" x2="6" y2="21" /><path d="M6 4 h11 l-2 3.5 l2 3.5 H6 z" /></>),
  shield: (<><path d="M12 3 l7 3 v5 c0 4.5 -3 7.5 -7 9 c-4 -1.5 -7 -4.5 -7 -9 V6 z" /><polyline points="9,12 11,14 15,10" /></>),
  gift: (<><rect x="4" y="9" width="16" height="11" rx="1" /><line x1="4" y1="13" x2="20" y2="13" /><line x1="12" y1="9" x2="12" y2="20" /><path d="M12 9 c-1 -4 -6 -4 -5 -1 c.5 1.5 5 1 5 1 z M12 9 c1 -4 6 -4 5 -1 c-.5 1.5 -5 1 -5 1 z" /></>),
  retention: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 4 v4 M12 16 v4 M4 12 h4 M16 12 h4" /></>),
  kb: (<><path d="M5 5 a2 2 0 0 1 2 -2 h11 v18 H7 a2 2 0 0 0 -2 2 z" /><path d="M7 3 v16" /><path d="M10 8 h5 M10 11 h5" /></>),
  diag: (<><circle cx="12" cy="12" r="9" /><polyline points="6,12 9,12 11,8 13,16 15,12 18,12" /></>),
  backups: (<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6 v6 a7 3 0 0 0 14 0 V6 M5 12 v6 a7 3 0 0 0 14 0 v-6" /></>),
  audit: (<><line x1="4" y1="20" x2="20" y2="20" /><line x1="4" y1="20" x2="4" y2="4" /><polyline points="7,15 11,10 14,13 19,6" /></>),
  optim: (<><path d="M6 18 c-1 -6 3 -12 9 -12 c0 6 -6 10 -9 12 z" /><circle cx="13" cy="9" r="1.4" fill="currentColor" stroke="none" /><path d="M6 18 l3 -1 M6 18 l1 -3" /></>),
  tests: (<><path d="M9 3 h6 M10 3 v6 l-4 8 a2 2 0 0 0 2 3 h8 a2 2 0 0 0 2 -3 l-4 -8 V3" /><line x1="8" y1="15" x2="16" y2="15" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3 v3 M12 18 v3 M4.5 7 l2.5 1.5 M17 15.5 l2.5 1.5 M4.5 17 l2.5 -1.5 M17 8.5 l2.5 -1.5" /></>),
  search: (<><circle cx="11" cy="11" r="6" /><line x1="15.5" y1="15.5" x2="20" y2="20" /></>),
  warn: (<><path d="M12 4 L21 19 H3 z" /><line x1="12" y1="10" x2="12" y2="14" /><circle cx="12" cy="16.6" r="0.6" fill="currentColor" stroke="none" /></>),
  print: (<><path d="M7 9 V4 h10 v5" /><rect x="4" y="9" width="16" height="7" rx="2" /><rect x="7" y="14" width="10" height="6" /><circle cx="17" cy="12" r="0.7" fill="currentColor" stroke="none" /></>),
  install: (<><path d="M12 4 v10 M8 11 l4 4 4 -4" /><path d="M5 18 h14" /></>),
  telegram: (<><path d="M21 5 L3 12 l6 2 2 6 3 -4 4 3 z" /><path d="M9 14 l9 -7" /></>),
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14 h3 v3 M20 14 v6 M14 20 h3" /></>),
  bell: (<><path d="M6 16 v-4 a6 6 0 0 1 12 0 v4 l2 2 H4 z" /><path d="M10 20 a2 2 0 0 0 4 0" /></>),
  refer: (<><circle cx="7" cy="8" r="3" /><path d="M2 19 a5 5 0 0 1 10 0" /><path d="M16 8 v6 M13 11 h6" /></>),
  book: (<><path d="M5 5 a2 2 0 0 1 2 -2 h11 v18 H7 a2 2 0 0 0 -2 2 z" /><path d="M7 3 v16" /></>),
  graduation: (<><path d="M2 9 l10 -4 10 4 -10 4 z" /><path d="M6 11 v4 c0 1.5 2.7 2.6 6 2.6 s6 -1.1 6 -2.6 v-4" /><line x1="22" y1="9" x2="22" y2="14" /></>),
  gem: (<><path d="M6 3 h12 l3 6 -9 12 -9 -12 z" /><path d="M3 9 h18 M9 3 l-3 6 6 12 M15 3 l3 6 -6 12" /></>),
  coins: (<><ellipse cx="9" cy="7" rx="5" ry="2.4" /><path d="M4 7 v4 c0 1.3 2.2 2.4 5 2.4 s5 -1.1 5 -2.4 v-4" /><path d="M14 12.6 c2.4 .3 6 -.6 6 -2.6 M10 17 c0 1.3 2.2 2.4 5 2.4 s5 -1.1 5 -2.4 v-8" /></>),
  cart: (<><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" /><circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none" /><path d="M3 4 h2 l2.2 11 h11 l1.8 -8 H6" /></>),
  heart: (<><path d="M12 20 C5 15 3 11 3 8 a4.5 4.5 0 0 1 9 -1 a4.5 4.5 0 0 1 9 1 c0 3 -2 7 -9 12 z" /></>),
  link: (<><path d="M9 15 l6 -6 M8 12 l-2 2 a3 3 0 0 0 4 4 l2 -2 M16 12 l2 -2 a3 3 0 0 0 -4 -4 l-2 2" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><line x1="15.5" y1="15.5" x2="20" y2="20" /></>),
  star: (<><path d="M12 4 l2.3 4.7 5.2 .8 -3.8 3.7 .9 5.1 -4.6 -2.4 -4.6 2.4 .9 -5.1 -3.8 -3.7 5.2 -.8 z" /></>),
  // Llave: cabeza de anillo + espiga con dientes (acceso, claves, inscripción).
  key: (<><circle cx="8" cy="8" r="3.6" /><line x1="10.6" y1="10.6" x2="19.5" y2="19.5" /><line x1="19.5" y1="19.5" x2="17.4" y2="21.6" /><line x1="16.4" y1="16.4" x2="14.3" y2="18.5" /></>),
  // Mano abierta (pausa / detener / saludo). Palma con cuatro dedos y pulgar.
  hand: (<><path d="M8 12 V6.6 a1.2 1.2 0 0 1 2.4 0 V11 M10.4 11 V5 a1.2 1.2 0 0 1 2.4 0 V11 M12.8 11 V5.6 a1.2 1.2 0 0 1 2.4 0 V12 M15.2 12 V8 a1.2 1.2 0 0 1 2.4 0 V15 a5 5 0 0 1 -5 5 h-1 a5 5 0 0 1 -3.6 -1.6 l-2.7 -2.9 a1.3 1.3 0 0 1 1.9 -1.8 L8 13.4 z" /></>),
  // Ojo (ver, vista previa, transparencia).
  eye: (<><path d="M2.5 12 C5 7.5 8.5 5.5 12 5.5 s7 2 9.5 6.5 c-2.5 4.5 -6 6.5 -9.5 6.5 s-7 -2 -9.5 -6.5 z" /><circle cx="12" cy="12" r="2.7" /></>),
  // Tijeras (cierres parciales, recortar).
  scissors: (<><circle cx="6" cy="7" r="2.3" /><circle cx="6" cy="17" r="2.3" /><line x1="8" y1="8.2" x2="20" y2="16" /><line x1="8" y1="15.8" x2="20" y2="8" /></>),
  // Palomita (incluido) y candado (no incluido / desbloquea al subir de plan).
  check: (<><polyline points="5,12.5 10,17.5 19,7" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 v3" /><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" /></>),
  // Luna (tema oscuro) y sol (tema claro).
  moon: (<><path d="M20 14.5 A8.5 8.5 0 0 1 9.5 4 A7 7 0 1 0 20 14.5 z" /></>),
  sun: (<><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5 v2.4 M12 19.1 v2.4 M2.5 12 h2.4 M19.1 12 h2.4 M5.1 5.1 l1.7 1.7 M17.2 17.2 l1.7 1.7 M18.9 5.1 l-1.7 1.7 M6.8 17.2 l-1.7 1.7" /></>),
};

// Emoji → nombre de glifo (se normaliza quitando el selector de variación).
const EMOJI: Record<string, string> = {
  '🎯': 'plan', '📈': 'performance', '🗓': 'calendar', '📅': 'calendar', '📆': 'calendar', '💵': 'money', '🔍': 'search',
  '📋': 'trades', '💸': 'costs', '🗂': 'accounts', '🏁': 'challenge', '🛡': 'guardian',
  '🤖': 'ai', '✨': 'ai', '🧮': 'balance', '🧠': 'coach', '🔥': 'streak', '🌍': 'sessions',
  '📰': 'news', '💰': 'money', '⚖': 'scale', '📐': 'ruler', '🟢': 'up', '🔻': 'down',
  '🔁': 'swap', '⏱': 'duration', '📊': 'bars', '🏆': 'trophy', '💀': 'skull', '⚪': 'circle',
  '📦': 'lots', '💱': 'pair', '💳': 'card', '🧩': 'modules', '🏛': 'firms', '📣': 'megaphone',
  '🎁': 'gift', '🛟': 'retention', '🩺': 'diag', '🗄': 'backups', '🚀': 'optim', '🧪': 'tests',
  '⚙': 'settings', '👥': 'users', '✉': 'mail', '🎫': 'ticket', '💬': 'chat', '🔔': 'bell',
  '📥': 'install', '⬇': 'install', '📖': 'book', '📚': 'book',
  '🎓': 'graduation', '💎': 'gem', '🪙': 'coins', '🛒': 'cart', '🛍': 'cart',
  // Barra superior y varios
  '🔌': 'accounts', '🛠': 'settings', '🔧': 'settings', '💡': 'ai', '🌱': 'up',
  '⚠': 'warn', '⚠️': 'warn', '🖨': 'print', '🖨️': 'print', '🏅': 'trophy', '🖥': 'modules', '🎬': 'trades', '🔒': 'guardian',
  '👤': 'users', '🧾': 'card', '🔐': 'guardian', '⭐': 'trophy', '📝': 'coach', '✍': 'coach',
  '⏳': 'duration', '⏰': 'duration', '💪': 'trophy', '🟢': 'up', '🎁': 'gift',
  '⚡': 'up', '🌊': 'performance', '🏔': 'performance', '✈': 'telegram', '🚧': 'settings',
  '🥧': 'finance', '🎉': 'trophy', '📧': 'mail', '📁': 'accounts', 'ℹ': 'ai',
  '📡': 'sessions', '🕑': 'duration', '🕐': 'duration', '☺': 'users', '🖨': 'install', '〽': 'up',
  // Llave y mano
  '🔑': 'key', '🗝': 'key', '🔓': 'key',
  '✋': 'hand', '🤚': 'hand', '👋': 'hand', '🖐': 'hand', '🖖': 'hand',
  // Landing (metáforas propias, no genéricas)
  '🔗': 'link', '📲': 'telegram', '🏦': 'firms', '👥': 'users', '🏛': 'firms',
  // Guía
  '👁': 'eye', '✂': 'scissors', '📉': 'down',
  // Tema
  '🌙': 'moon', '🌛': 'moon', '☀': 'sun', '🔆': 'sun',
};

const strip = (s: string) => (s || '').replace(/️/g, '').trim();

export default function OnyxIcon({ name, emoji, size = 18, glow = true, className, style }: {
  name?: string; emoji?: string; size?: number; glow?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const key = name || (emoji ? EMOJI[strip(emoji)] : undefined);
  const glyph = key ? G[key] : undefined;
  if (!glyph) return <span className={className} style={style}>{emoji || null}</span>; // fallback seguro
  // Resplandor en su propio color (currentColor), proporcional al tamaño.
  const r = Math.max(2, Math.round(size / 5));
  const filter = glow ? `drop-shadow(0 0 ${r}px currentColor) drop-shadow(0 0 ${r * 2}px currentColor)` : undefined;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={'onyx-ic' + (className ? ' ' + className : '')}
      style={{ display: 'block', filter, transition: 'filter .15s, transform .12s', ...style }} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyph}
    </svg>
  );
}
