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
  gift: (<><rect x="4" y="9" width="16" height="11" rx="1" /><line x1="4" y1="13" x2="20" y2="13" /><line x1="12" y1="9" x2="12" y2="20" /><path d="M12 9 c-1 -4 -6 -4 -5 -1 c.5 1.5 5 1 5 1 z M12 9 c1 -4 6 -4 5 -1 c-.5 1.5 -5 1 -5 1 z" /></>),
  retention: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 4 v4 M12 16 v4 M4 12 h4 M16 12 h4" /></>),
  kb: (<><path d="M5 5 a2 2 0 0 1 2 -2 h11 v18 H7 a2 2 0 0 0 -2 2 z" /><path d="M7 3 v16" /><path d="M10 8 h5 M10 11 h5" /></>),
  diag: (<><circle cx="12" cy="12" r="9" /><polyline points="6,12 9,12 11,8 13,16 15,12 18,12" /></>),
  backups: (<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6 v6 a7 3 0 0 0 14 0 V6 M5 12 v6 a7 3 0 0 0 14 0 v-6" /></>),
  audit: (<><line x1="4" y1="20" x2="20" y2="20" /><line x1="4" y1="20" x2="4" y2="4" /><polyline points="7,15 11,10 14,13 19,6" /></>),
  optim: (<><path d="M6 18 c-1 -6 3 -12 9 -12 c0 6 -6 10 -9 12 z" /><circle cx="13" cy="9" r="1.4" fill="currentColor" stroke="none" /><path d="M6 18 l3 -1 M6 18 l1 -3" /></>),
  tests: (<><path d="M9 3 h6 M10 3 v6 l-4 8 a2 2 0 0 0 2 3 h8 a2 2 0 0 0 2 -3 l-4 -8 V3" /><line x1="8" y1="15" x2="16" y2="15" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3 v3 M12 18 v3 M4.5 7 l2.5 1.5 M17 15.5 l2.5 1.5 M4.5 17 l2.5 -1.5 M17 8.5 l2.5 -1.5" /></>),
  install: (<><path d="M12 4 v10 M8 11 l4 4 4 -4" /><path d="M5 18 h14" /></>),
  telegram: (<><path d="M21 5 L3 12 l6 2 2 6 3 -4 4 3 z" /><path d="M9 14 l9 -7" /></>),
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14 h3 v3 M20 14 v6 M14 20 h3" /></>),
  bell: (<><path d="M6 16 v-4 a6 6 0 0 1 12 0 v4 l2 2 H4 z" /><path d="M10 20 a2 2 0 0 0 4 0" /></>),
  refer: (<><circle cx="7" cy="8" r="3" /><path d="M2 19 a5 5 0 0 1 10 0" /><path d="M16 8 v6 M13 11 h6" /></>),
  book: (<><path d="M5 5 a2 2 0 0 1 2 -2 h11 v18 H7 a2 2 0 0 0 -2 2 z" /><path d="M7 3 v16" /></>),
};

// Emoji → nombre de glifo (se normaliza quitando el selector de variación).
const EMOJI: Record<string, string> = {
  '🎯': 'plan', '📈': 'performance', '🗓': 'calendar', '📅': 'calendar', '📆': 'calendar',
  '📋': 'trades', '💸': 'costs', '🗂': 'accounts', '🏁': 'challenge', '🛡': 'guardian',
  '🤖': 'ai', '✨': 'ai', '🧮': 'balance', '🧠': 'coach', '🔥': 'streak', '🌍': 'sessions',
  '📰': 'news', '💰': 'money', '⚖': 'scale', '📐': 'ruler', '🟢': 'up', '🔻': 'down',
  '🔁': 'swap', '⏱': 'duration', '📊': 'bars', '🏆': 'trophy', '💀': 'skull', '⚪': 'circle',
  '📦': 'lots', '💱': 'pair', '💳': 'card', '🧩': 'modules', '🏛': 'firms', '📣': 'megaphone',
  '🎁': 'gift', '🛟': 'retention', '🩺': 'diag', '🗄': 'backups', '🚀': 'optim', '🧪': 'tests',
  '⚙': 'settings', '👥': 'users', '✉': 'mail', '🎫': 'ticket', '💬': 'chat', '🔔': 'bell',
  '📥': 'install', '⬇': 'install', '📖': 'book', '📚': 'book',
  // Barra superior y varios
  '🔌': 'accounts', '🛠': 'settings', '🔧': 'settings', '💡': 'ai', '🌱': 'up',
  '⚠': 'bell', '🏅': 'trophy', '🖥': 'modules', '🎬': 'trades', '🔒': 'guardian',
  '👤': 'users', '🧾': 'card', '🔐': 'guardian', '⭐': 'trophy', '📝': 'coach', '✍': 'coach',
  '⏳': 'duration', '⏰': 'duration', '💪': 'trophy', '🟢': 'up', '🎁': 'gift',
  '⚡': 'up', '🌊': 'performance', '🏔': 'performance', '✈': 'telegram', '🚧': 'settings',
  '🥧': 'finance', '🎉': 'trophy', '📧': 'mail', '📁': 'accounts', 'ℹ': 'ai', '✋': 'guardian',
  '📡': 'sessions', '🕑': 'duration', '🕐': 'duration', '☺': 'users', '🖨': 'install', '〽': 'up',
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
