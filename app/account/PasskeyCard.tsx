'use client';
import { dictFor } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { supabaseBrowser, passkeySupported } from '@/lib/supabaseBrowser';

type Lang = 'es' | 'en';
const T: any = {
  es: {
    t: 'Passkey (huella / Face ID)', desc: 'Entra sin escribir contraseña: usa tu huella, Face ID o el llavero de tu dispositivo. Es lo más rápido y seguro.',
    none: 'Aún no tienes ninguna passkey en esta cuenta.', add: 'Añadir passkey', adding: 'Sigue las instrucciones de tu dispositivo…',
    added: 'Passkey añadida ✓', removed: 'Passkey eliminada.', renamed: 'Nombre actualizado.',
    del: 'Eliminar', rename: 'Renombrar', cancel: 'Cancelar', save: 'Guardar', savePh: 'Ej: Mi iPhone',
    used: 'Usada', created: 'Añadida', confirmDel: '¿Eliminar esta passkey? No podrás entrar con ella.',
    errAdd: 'No se pudo añadir. Puede que la cancelaras o tu navegador no la soporte.',
  },
  en: {
    t: 'Passkey (fingerprint / Face ID)', desc: 'Sign in without typing a password: use your fingerprint, Face ID or your device keychain. The fastest and most secure way.',
    none: 'You have no passkey on this account yet.', add: 'Add passkey', adding: 'Follow your device prompts…',
    added: 'Passkey added ✓', removed: 'Passkey removed.', renamed: 'Name updated.',
    del: 'Remove', rename: 'Rename', cancel: 'Cancel', save: 'Save', savePh: 'e.g. My iPhone',
    used: 'Used', created: 'Added', confirmDel: 'Remove this passkey? You will not be able to sign in with it.',
    errAdd: 'Could not add. You may have cancelled or your browser does not support it.',
  },
};

export default function PasskeyCard({ lang }: { lang: Lang }) {
  const L = dictFor(T, lang);
  const [supported, setSupported] = useState(false);
  const [list, setList] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nm, setNm] = useState('');

  useEffect(() => {
    const ok = passkeySupported();
    setSupported(ok);
    if (ok) load();
  }, []);

  async function load() {
    try {
      const sb: any = supabaseBrowser();
      const { data } = await sb.auth.passkey.list();
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); }
  }

  async function add() {
    setBusy(true);
    try {
      const sb: any = supabaseBrowser();
      const { error } = await sb.auth.registerPasskey();
      if (error) { toast(L.errAdd, 'error'); } else { toast(L.added, 'ok'); await load(); }
    } catch { toast(L.errAdd, 'error'); }
    setBusy(false);
  }

  async function del(id: string) {
    if (!window.confirm(L.confirmDel)) return;
    try {
      const sb: any = supabaseBrowser();
      await sb.auth.passkey.delete({ passkeyId: id });
      toast(L.removed, 'ok'); await load();
    } catch {}
  }

  async function saveName(id: string) {
    try {
      const sb: any = supabaseBrowser();
      await sb.auth.passkey.update({ passkeyId: id, friendlyName: nm.slice(0, 120) });
      toast(L.renamed, 'ok'); setRenaming(null); await load();
    } catch {}
  }

  if (!supported) return null;   // navegador o SDK sin soporte: no se muestra nada

  const KeyIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3 19 4" /><path d="m16 6 3 3" /><path d="m14 8 2 2" /></svg>
  );

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="card-ic" style={{ color: 'var(--brand)' }}><KeyIcon /></span>
        <b>{L.t}</b>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>{L.desc}</p>

      {list && list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {list.map((k) => (
            <div key={k.id} className="row between" style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', gap: 8, flexWrap: 'wrap' }}>
              {renaming === k.id ? (
                <div className="row" style={{ gap: 6, flex: 1, minWidth: 180 }}>
                  <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={L.savePh} style={{ margin: 0, flex: 1 }} maxLength={120} />
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => saveName(k.id)}>{L.save}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setRenaming(null)}>{L.cancel}</button>
                </div>
              ) : (
                <>
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: 'var(--brand)', display: 'inline-flex' }}><KeyIcon /></span>{k.friendly_name || 'Passkey'}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {L.created} {k.created_at ? new Date(k.created_at).toLocaleDateString() : ''}{k.last_used_at ? ` · ${L.used} ${new Date(k.last_used_at).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setRenaming(k.id); setNm(k.friendly_name || ''); }}>{L.rename}</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }} onClick={() => del(k.id)}>{L.del}</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {list && list.length === 0 && <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{L.none}</p>}

      <button className="btn btn-primary" disabled={busy} onClick={add}>{busy ? L.adding : '＋ ' + L.add}</button>
    </div>
  );
}
