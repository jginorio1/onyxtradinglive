'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang';
import OnyxIcon from '@/app/components/OnyxIcon';

// Tarjeta compacta del "Neto real" del mes en el hero del dashboard.
// Solo aparece si el plan tiene la capacidad expenses (si no, la API responde
// locked y no mostramos nada).
export default function NetRealCard() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    fetch('/api/expenses').then((r) => r.json()).then((j) => { if (!j.locked && !j.error) setD(j); }).catch(() => {});
  }, []);

  if (!d) return null;
  const netColor = d.net >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <Link href="/dashboard/expenses" style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card" style={{ margin: '0 auto 14px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', border: '1px solid rgba(124,140,255,.3)', maxWidth: 560 }}>
        <span style={{ display: "inline-flex", color: "var(--brand)" }}><OnyxIcon emoji="🧮" size={22} /></span>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>{L('Neto real este mes', 'True net this month')}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: netColor }}>{d.net >= 0 ? '' : '−'}${Math.abs(d.net).toLocaleString()}</div>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {L('Bruto', 'Gross')} <b style={{ color: 'var(--tx)' }}>${d.gross.toLocaleString()}</b> · {L('Gastos', 'Expenses')} <b style={{ color: 'var(--tx)' }}>−${d.expenses.toLocaleString()}</b>
        </div>
        <span className="pill" style={{ marginLeft: 'auto', color: 'var(--soft-brand)', background: 'rgba(124,140,255,.14)' }}>{L('Balance real', 'True P&L')} →</span>
      </div>
    </Link>
  );
}
