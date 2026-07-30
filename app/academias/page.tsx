'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';

// Directorio público de academias (Onyx Academy). Sin sesión.
export default function Academias() {
  const { lang } = useLang();
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [list, setList] = useState<any[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { fetch('/api/academy/public').then((r) => r.json()).then((j) => setList(j.academies || [])).catch(() => setList([])); }, []);

  const price = (a: any) => {
    if (a.from_price_cents == null) return L('Gratis', 'Free');
    const cur = (a.currency || 'usd').toUpperCase();
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '';
    const amt = (a.from_price_cents / 100).toLocaleString();
    return L('desde ', 'from ') + (sym ? sym + amt : amt + ' ' + cur);
  };
  const filtered = (list || []).filter((a) => (a.academy_name + ' ' + a.mentor_name + ' ' + (a.tagline || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="wrap" style={{ padding: '52px 22px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ fontSize: 34, letterSpacing: '-1px', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><OnyxIcon name="graduation" size={30} /></span> Onyx Academy
        </h1>
        <p className="muted" style={{ margin: '12px auto 0', maxWidth: 620, fontSize: 17 }}>
          {L('Academias de mentores dentro de Onyx Trading Live. Únete, aprende y sigue tu progreso — con tus operaciones reales auditadas por tu mentor.',
             'Mentor academies inside Onyx Trading Live. Join, learn and track your progress — with your real trades audited by your mentor.')}
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto 26px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Buscar academia o mentor…', 'Search academy or mentor…')} style={{ width: '100%', margin: 0 }} />
      </div>

      {list === null && <p className="muted" style={{ textAlign: 'center' }}>…</p>}
      {list && filtered.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>{L('Aún no hay academias publicadas.', 'No academies published yet.')}</p>}

      <div className="grid g3">
        {filtered.map((a) => (
          <Link key={a.code} href={`/academia/${a.code}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{a.academy_name}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{a.mentor_name}</div>
            {a.tagline && <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{a.tagline}</p>}
            <div className="row between" style={{ marginTop: 12, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}><OnyxIcon name="users" size={13} /> {a.students}</span>
              <span className="pill" style={{ color: 'var(--gold)', background: 'rgba(255,192,77,.14)' }}>{price(a)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
