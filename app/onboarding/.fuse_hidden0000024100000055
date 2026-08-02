'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/lib/lang';

const T = {
  es: {
    title: 'Cuéntanos cómo operas',
    sub: 'Personaliza tu panel y el Onyx Guardian. Puedes saltarlo y llenarlo después en Mi cuenta.',
    name: 'Nombre', namePh: 'Jerry',
    country: 'País', countryPh: 'Colombia',
    experience: 'Experiencia',
    style: 'Estilo de trading',
    platform: 'Plataforma',
    funded: '¿Operas cuentas de fondeo?',
    propFirm: '¿Qué prop firm?', propFirmPh: 'FTMO, FundedNext…',
    goal: 'Tu meta principal',
    skip: 'Saltar por ahora', save: 'Guardar y entrar',
    saving: 'Guardando…',
    exp: [['novato', 'Novato'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado'], ['pro', 'Profesional']],
    sty: [['scalping', 'Scalping'], ['day', 'Day trading'], ['swing', 'Swing'], ['position', 'Position']],
    plat: [['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ambas', 'Ambas']],
    fund: [['no', 'No, cuenta propia'], ['si', 'Sí']],
    goals: [['pasar_challenge', 'Pasar mi challenge de fondeo'], ['consistencia', 'Ser consistente'], ['crecer', 'Hacer crecer mi cuenta'], ['vivir', 'Vivir del trading']],
    choose: 'Elige…',
  },
  en: {
    title: 'Tell us how you trade',
    sub: 'Personalize your dashboard and Onyx Guardian. You can skip and fill it later in My account.',
    name: 'Name', namePh: 'Jerry',
    country: 'Country', countryPh: 'United States',
    experience: 'Experience',
    style: 'Trading style',
    platform: 'Platform',
    funded: 'Do you trade funded accounts?',
    propFirm: 'Which prop firm?', propFirmPh: 'FTMO, FundedNext…',
    goal: 'Your main goal',
    skip: 'Skip for now', save: 'Save and continue',
    saving: 'Saving…',
    exp: [['novato', 'Beginner'], ['intermedio', 'Intermediate'], ['avanzado', 'Advanced'], ['pro', 'Professional']],
    sty: [['scalping', 'Scalping'], ['day', 'Day trading'], ['swing', 'Swing'], ['position', 'Position']],
    plat: [['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ambas', 'Both']],
    fund: [['no', 'No, my own account'], ['si', 'Yes']],
    goals: [['pasar_challenge', 'Pass my funding challenge'], ['consistencia', 'Be consistent'], ['crecer', 'Grow my account'], ['vivir', 'Trade for a living']],
    choose: 'Choose…',
  },
};

export default function Onboarding() {
  const router = useRouter();
  const { lang } = useLang();
  const t = T[lang];

  const [full_name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [experience, setExp] = useState('');
  const [trade_style, setStyle] = useState('');
  const [platform, setPlatform] = useState('');
  const [funded, setFunded] = useState('');
  const [prop_firm, setProp] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  async function finish(skip: boolean) {
    setBusy(true);
    try {
      const body = skip ? { skip: true } : {
        full_name, country, experience, trade_style, platform, goal,
        prop_firm: funded === 'si' ? prop_firm : 'ninguna',
      };
      await fetch('/api/onboarding', { method: 'POST', body: JSON.stringify(body) });
    } catch { /* aunque falle, no bloqueamos al usuario */ }
    router.push('/dashboard'); router.refresh();
  }

  const field: React.CSSProperties = { marginBottom: 4, display: 'block', fontSize: 13, color: 'var(--mut)' };

  return (
    <div className="wrap" style={{ maxWidth: 620, padding: '48px 22px 60px' }}>
      <Link className="logo" href="/" style={{ justifyContent: 'center', marginBottom: 20 }}>
        <img src="/onyx-symbol.png" alt="Onyx" style={{ width: 28, height: 28, objectFit: 'contain' }} /> Onyx Trading Live
      </Link>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t.title}</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>{t.sub}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          <div>
            <label style={field}>{t.name}</label>
            <input value={full_name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={field}>{t.country}</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t.countryPh} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={field}>{t.experience}</label>
            <select value={experience} onChange={(e) => setExp(e.target.value)} style={{ width: '100%' }}>
              <option value="">{t.choose}</option>
              {t.exp.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={field}>{t.style}</label>
            <select value={trade_style} onChange={(e) => setStyle(e.target.value)} style={{ width: '100%' }}>
              <option value="">{t.choose}</option>
              {t.sty.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={field}>{t.platform}</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ width: '100%' }}>
              <option value="">{t.choose}</option>
              {t.plat.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={field}>{t.funded}</label>
            <select value={funded} onChange={(e) => setFunded(e.target.value)} style={{ width: '100%' }}>
              <option value="">{t.choose}</option>
              {t.fund.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {funded === 'si' && (
          <div style={{ marginTop: 16 }}>
            <label style={field}>{t.propFirm}</label>
            <input value={prop_firm} onChange={(e) => setProp(e.target.value)} placeholder={t.propFirmPh} style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={field}>{t.goal}</label>
          <select value={goal} onChange={(e) => setGoal(e.target.value)} style={{ width: '100%' }}>
            <option value="">{t.choose}</option>
            {t.goals.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => finish(true)} disabled={busy}>{t.skip}</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => finish(false)} disabled={busy}>{busy ? t.saving : t.save}</button>
        </div>
      </div>
    </div>
  );
}
