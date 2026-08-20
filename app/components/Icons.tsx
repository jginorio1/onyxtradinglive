'use client';
// Iconos de línea (trazo) modernos para toda la app de chat/soporte.
// Reemplazan los emojis de interfaz (🔍 ＋ 📎 😊 📅 …) por SVG limpios que
// heredan el color (currentColor) y el tamaño. Uso: <Icon name="send" size={18} />
import type { CSSProperties } from 'react';

export type IconName =
  | 'search' | 'plus' | 'send' | 'paperclip' | 'smile' | 'calendar' | 'users'
  | 'userPlus' | 'window' | 'back' | 'sparkles' | 'hash' | 'info' | 'check'
  | 'refresh' | 'hand' | 'lock' | 'trash' | 'x' | 'bulb' | 'image' | 'file'
  | 'clock' | 'ticket' | 'shield' | 'user' | 'dots' | 'chevronDown' | 'bell'
  | 'message' | 'flag';

const P: Record<IconName, JSX.Element> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>,
  paperclip: <path d="M21 8.5l-9.2 9.2a4 4 0 0 1-5.7-5.7l9-9a2.6 2.6 0 0 1 3.7 3.7l-9 9a1.2 1.2 0 0 1-1.7-1.7l8.3-8.3" />,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4 4 0 0 0 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-3-4.9" /></>,
  userPlus: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 10.5-2.3" /><path d="M18 13v6M15 16h6" /></>,
  window: <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="M3 9h18" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  sparkles: <><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" /><path d="M19 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" /></>,
  hash: <path d="M9 3L7 21M17 3l-2 18M4 8.5h16M3.5 15.5h16" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></>,
  check: <path d="M4 12.5l5 5 11-11" />,
  refresh: <><path d="M20 11a8 8 0 1 0-.9 4.5" /><path d="M20 5v6h-6" /></>,
  hand: <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-1V6a1.5 1.5 0 0 1 3 0v6.5a6.5 6.5 0 0 1-13 0V12a1.5 1.5 0 0 1 3-.5" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  trash: <><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" /></>,
  image: <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="M4 17l5-4.5 4 3.5 3-2.5 4 4" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  ticket: <><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v1a2 2 0 0 0 0 4v1a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 14.5v-1a2 2 0 0 0 0-4z" /><path d="M14 6v12" /></>,
  shield: <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" />,
  user: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  dots: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" /></>,
  message: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 4V5.5z" />,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
};

export default function Icon({ name, size = 18, stroke = 1.8, style, className }: {
  name: IconName; size?: number; stroke?: number; style?: CSSProperties; className?: string;
}) {
  const filled = name === 'shield' || name === 'sparkles';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
      fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', ...style }} aria-hidden="true">
      {P[name]}
    </svg>
  );
}
