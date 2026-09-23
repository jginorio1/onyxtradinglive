'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/lib/lang';
import { toast, toastErr } from '@/lib/toast';

// Formulario de solicitud de servicio (automatiza / instalación / elite).
// Público: funciona con o sin sesión. Al enviar crea un lead que el equipo atiende.
export default function BotLabLead({ defaultService = 'automate' }: { defaultService?: string }) {
  const { lang } = useLang();
  const es = lang === 'es';
  const [service, setService] = useState(defaultService);
  const rootRef = useRef<HTMLDivElement>(null);

  // Los botones de la escalera (Agendar/Solicitar/Hablar) llegan con un hash que
  // preselecciona el servicio correcto y desplaza el formulario a la vista.
  useEffect(() => {
    const apply = () => {
      const h = (window.location.hash || '').replace('#', '');
      const map: Record<string, string> = { 'svc-automate': 'automate', 'svc-install': 'install', 'svc-elite': 'elite' };
      if (map[h]) {
        setService(map[h]);
        setTimeout(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      }
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [platform, setPlatform] = useState('mt5');
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    // Único campo obligatorio: el correo (es como te contactamos). El resto es opcional
    // para que el formulario tenga la menor fricción posible.
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!okEmail) { toastErr(es ? 'Déjanos un correo válido para responderte.' : 'Leave a valid email so we can reach you.'); return; }
    setSending(true);
    try {
      const r = await fetch('/api/botlab/service', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, name, email, platform, budget, message }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      setDone(true); toast(es ? 'Recibido. Te contactamos pronto.' : 'Received. We will reach out soon.');
    } catch (e: any) { toastErr(e?.message || 'error'); } finally { setSending(false); }
  }

  const L = es ? {
    t: 'Solicita tu propuesta gratis', sub: 'Cuéntanos tu estrategia y te preparamos un presupuesto sin compromiso.',
    svc: 'Servicio', automate: 'Automatiza mi estrategia', install: 'Instalación asistida', elite: 'Elite / privado',
    name: 'Tu nombre (opcional)', email: 'Tu correo *', plat: 'Plataforma', bud: 'Presupuesto (opcional)', msg: 'Describe tu estrategia o lo que necesitas (opcional)',
    send: 'Enviar solicitud', okT: '¡Listo!', okS: 'Tu solicitud llegó. Nuestro equipo te escribirá muy pronto.',
  } : {
    t: 'Request your free proposal', sub: 'Tell us your strategy and we prepare a no-commitment quote.',
    svc: 'Service', automate: 'Automate my strategy', install: 'Assisted install', elite: 'Elite / private',
    name: 'Your name (optional)', email: 'Your email *', plat: 'Platform', bud: 'Budget (optional)', msg: 'Describe your strategy or what you need (optional)',
    send: 'Send request', okT: 'Done!', okS: 'Your request is in. Our team will reach out very soon.',
  };

  const inp: any = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 14 };

  if (done) return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 30, textAlign: 'center' }}>
      <div style={{ fontSize: 34 }}>✓</div>
      <h3 style={{ margin: '8px 0 6px' }}>{L.okT}</h3>
      <p className="muted" style={{ fontSize: 14, maxWidth: 420, margin: '0 auto' }}>{L.okS}</p>
    </div>
  );

  return (
    <div ref={rootRef} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}>
      <h3 style={{ margin: 0 }}>{L.t}</h3>
      <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 16px' }}>{L.sub}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
        {([['automate', L.automate], ['install', L.install], ['elite', L.elite]] as [string, string][]).map(([k, lbl]) => (
          <button key={k} onClick={() => setService(k)} style={{ padding: '10px 8px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (service === k ? 'var(--gold)' : 'var(--line)'), background: service === k ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'transparent', color: service === k ? 'var(--gold)' : 'var(--tx)' }}>{lbl}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input style={inp} placeholder={L.name} value={name} onChange={(e) => setName(e.target.value)} />
        <input type="email" style={inp} placeholder={L.email} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <select style={inp} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="mt5">MetaTrader 5</option><option value="mt4">MetaTrader 4</option><option value="ctrader">cTrader</option><option value="any">{es ? 'Otra' : 'Other'}</option>
        </select>
        <input style={inp} placeholder={L.bud} value={budget} onChange={(e) => setBudget(e.target.value)} />
      </div>
      <textarea style={{ ...inp, minHeight: 90, resize: 'vertical', marginBottom: 12 }} placeholder={L.msg} value={message} onChange={(e) => setMessage(e.target.value)} />
      <button onClick={submit} disabled={sending} style={{ width: '100%', padding: 13, borderRadius: 11, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer', background: 'linear-gradient(120deg,var(--gold,#ffd45e),#ffb020)', color: '#3a2a06', opacity: sending ? .6 : 1 }}>
        {sending ? '…' : L.send}
      </button>
    </div>
  );
}
