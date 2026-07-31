'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Lang = 'es' | 'en';

const N: any = {
  es: {
    hidT: 'Tienes {n} operaciones que no puedes ver',
    hidD: 'Tu plan muestra solo los últimos {d} días. Con {p} ves todo tu historial.',
    hidC: 'Desbloquear mi historial',
    limT: 'Te queda {n} cuenta por conectar',
    limD: '{p} te da {m}. Súbete y conecta todas las que quieras.',
    limFullT: 'Has llegado a tu límite de cuentas',
    limFullD: 'Estás usando las {u} cuentas de {plan}. Con {p} conectas {m}.',
    limC: 'Ver {p}',
    milT: '{n} operaciones registradas',
    milD: 'Ya tienes datos suficientes para que el diario te muestre qué estás repitiendo mal.',
    milC: 'Probar el diario',
    ambT: '¿Tienes comunidad? Gana con Onyx',
    ambD: 'Cobra una comisión recurrente por cada persona que se suscriba con tu enlace.',
    ambC: 'Ver el programa',
    unlimited: 'cuentas ilimitadas',
    hide: 'Ocultar',
  },
  en: {
    hidT: 'You have {n} trades you cannot see',
    hidD: 'Your plan shows only the last {d} days. With {p} you see your full history.',
    hidC: 'Unlock my history',
    limT: 'You have {n} account left to connect',
    limD: '{p} gives you {m}. Upgrade and connect as many as you want.',
    limFullT: 'You reached your account limit',
    limFullD: 'You are using all {u} accounts on {plan}. With {p} you get {m}.',
    limC: 'See {p}',
    milT: '{n} trades logged',
    milD: 'You now have enough data for the journal to show you what you keep repeating.',
    milC: 'Try the journal',
    ambT: 'Got a community? Earn with Onyx',
    ambD: 'Earn a recurring commission for everyone who subscribes through your link.',
    ambC: 'See the program',
    unlimited: 'unlimited accounts',
    hide: 'Hide',
  },
};

const DAYS_HIDDEN = 7;
const fill = (s: string, m: any) => Object.keys(m).reduce((x, k) => x.split(`{${k}}`).join(m[k]), s);

function isHidden(id: string) {
  try {
    const v = localStorage.getItem('onyx_nudge_' + id);
    if (!v) return false;
    return Date.now() - Number(v) < DAYS_HIDDEN * 864e5;
  } catch { return false; }
}
function hide(id: string) { try { localStorage.setItem('onyx_nudge_' + id, String(Date.now())); } catch {} }

export default function Nudge({
  lang, plans, planId, histDays, canJournal, hiddenTrades, totalTrades, used, max, unlimited, planLabel, onGoJournal,
}: {
  lang: Lang; plans: any[]; planId: string; histDays: number; canJournal: boolean;
  hiddenTrades: number; totalTrades: number; used: number; max: number; unlimited: boolean; planLabel: string;
  onGoJournal: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const t = N[lang];
  useEffect(() => { setReady(true); }, []);

  const nameOf = (p: any) => (lang === 'en' ? (p?.name_en || p?.name) : p?.name) || '';
  const cur = plans.find((p) => p.id === planId);
  const curPrice = Number(cur?.price_month || 0);
  const better = plans.filter((p) => Number(p.price_month || 0) > curPrice).sort((a, b) => Number(a.price_month) - Number(b.price_month));
  const withCap = (k: string) => better.find((p) => p.capabilities?.[k]) || better[0];
  const moreAccounts = better.find((p) => Number(p.max_accounts || 0) > max) || better[0];

  if (!ready) return null;

  // Prioridad: lo que más le duele ahora mismo. Solo se muestra uno.
  const list: any[] = [];

  if (histDays > 0 && hiddenTrades > 0) {
    const target = withCap('history') || better.find((p) => !Number(p.capabilities?.history_days)) || better[0];
    if (target) list.push({
      id: 'hidden_history', color: '#7c8cff',
      title: fill(t.hidT, { n: hiddenTrades }),
      desc: fill(t.hidD, { d: histDays, p: nameOf(target) }),
      cta: t.hidC, href: '/pricing',
    });
  }

  if (!unlimited && used >= max && moreAccounts) {
    list.push({
      id: 'limit_full', color: '#ff6b7d',
      title: t.limFullT,
      desc: fill(t.limFullD, { u: used, plan: planLabel, p: nameOf(moreAccounts), m: Number(moreAccounts.max_accounts) >= 999 ? t.unlimited : moreAccounts.max_accounts }),
      cta: fill(t.limC, { p: nameOf(moreAccounts) }), href: '/pricing',
    });
  } else if (!unlimited && max > 1 && used === max - 1 && moreAccounts) {
    list.push({
      id: 'limit_near', color: '#ffc04d',
      title: fill(t.limT, { n: 1 }),
      desc: fill(t.limD, { p: nameOf(moreAccounts), m: Number(moreAccounts.max_accounts) >= 999 ? t.unlimited : moreAccounts.max_accounts }),
      cta: fill(t.limC, { p: nameOf(moreAccounts) }), href: '/pricing',
    });
  }

  if (!canJournal && totalTrades >= 100) {
    list.push({
      id: 'milestone_100', color: '#ffd45e',
      title: fill(t.milT, { n: totalTrades }),
      desc: t.milD, cta: t.milC, action: onGoJournal,
    });
  }

  list.push({
    id: 'ambassador', color: '#a06bff',
    title: t.ambT, desc: t.ambD, cta: t.ambC, href: '/embajadores',
  });

  const n = list.find((x) => !isHidden(x.id));
  if (!n) return null;

  return (
    <div className="card" style={{ border: '1px solid ' + n.color, background: `linear-gradient(135deg,${n.color}1f,transparent)` }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{n.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>{n.desc}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {n.href
            ? <Link className="btn btn-primary" href={n.href}>{n.cta} →</Link>
            : <button className="btn btn-primary" onClick={n.action}>{n.cta} →</button>}
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => { hide(n.id); setTick(tick + 1); }}>{t.hide}</button>
        </div>
      </div>
    </div>
  );
}
