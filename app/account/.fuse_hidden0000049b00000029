'use client';
import { toast } from '@/lib/toast';
import OnyxIcon from '@/app/components/OnyxIcon';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import TwoFactor from '@/app/TwoFactor';

type Lang = 'es' | 'en';
const T: any = {
  es: {
    t: 'Verificación en dos pasos (2FA)', desc: 'Capa extra de seguridad: al entrar pedimos un código de tu app (Google Authenticator, Authy…).',
    on: 'Activada', off: 'Desactivada', enable: 'Activar', disable: 'Desactivar', cancel: 'Cancelar',
    okOn: 'Verificación en dos pasos activada.', okOff: 'Verificación desactivada.',
  },
  en: {
    t: 'Two-step verification (2FA)', desc: 'Extra security layer: on sign-in we ask for a code from your app (Google Authenticator, Authy…).',
    on: 'On', off: 'Off', enable: 'Turn on', disable: 'Turn off', cancel: 'Cancel',
    okOn: 'Two-step verification enabled.', okOff: 'Two-step verification disabled.',
  },
};

export default function TwoFactorCard({ lang }: { lang: Lang }) {
  const L = T[lang];
  const sb = supabaseBrowser();
  const [has, setHas] = useState<boolean | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    try { const { data } = await sb.auth.mfa.listFactors(); setHas((data?.totp || []).some((f: any) => f.status === 'verified')); }
    catch { setHas(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      const { data } = await sb.auth.mfa.listFactors();
      for (const f of (data?.all || [])) { try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch {} }
      toast(L.okOff, 'ok'); await load();
    } finally { setBusy(false); }
  }

  if (has === null) return null;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}><OnyxIcon emoji="🔐" size={16} /> {L.t}</h3>
        <span className="pill" style={has ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--mut)' }}>{has ? L.on : L.off}</span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{L.desc}</p>

      {enrolling ? (
        <div style={{ marginTop: 12 }}>
          <TwoFactor mode="enroll" lang={lang} onDone={() => { setEnrolling(false); toast(L.okOn, 'ok'); load(); }} />
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => setEnrolling(false)}>{L.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 12 }}>
          {has
            ? <button className="btn btn-ghost" onClick={disable} disabled={busy}>{L.disable}</button>
            : <button className="btn btn-primary" onClick={() => setEnrolling(true)}>{L.enable}</button>}
        </div>
      )}
    </div>
  );
}
