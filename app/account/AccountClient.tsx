'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import { errMsg, planName } from '@/lib/i18nErrors';
import Ambassador from './Ambassador';
import CancelFlow from './CancelFlow';
import TelegramCard from './TelegramCard';

type Lang = 'es' | 'en';
type Tab = 'plan' | 'perfil' | 'facturas' | 'cuentas' | 'avisos' | 'seguridad' | 'referidos';

const D: any = {
  es: {
    title: 'Mi cuenta', back: 'Ir al panel', save: 'Guardar', saved: 'Guardado', saving: '...',
    nav: { plan: 'Suscripción', perfil: 'Perfil', facturas: 'Facturas', cuentas: 'Cuentas MT', avisos: 'Notificaciones', seguridad: 'Seguridad', referidos: 'Referidos' },
    planCur: 'Tu plan', active: 'Activo', canceling: 'Se cancela al final del periodo', noSub: 'Plan gratuito', renews: 'Se renueva el', ends: 'Termina el',
    perMo: 'mes', perYr: 'año', manage: 'Gestionar pago', manageSub: 'Cambiar tarjeta, ver facturas o cancelar en Stripe',
    usage: 'Cuentas MT usadas', of: 'de', unlimited: 'ilimitadas', usageLeft: 'Te queda', usageLeft2: 'cuenta(s).', usageFull: 'Has llegado a tu límite.',
    upTitle: 'Mejorar a', upBtn: 'Mejorar a', andMore: 'y además:', seePlans: 'Ver todos los planes',
    name: 'Nombre', tz: 'Zona horaria', langL: 'Idioma', email: 'Correo', emailNote: 'El correo no se puede cambiar aquí.',
    invTitle: 'Tus facturas', invTxt: 'Todas tus facturas y recibos están en el portal seguro de Stripe. Desde ahí puedes descargarlas en PDF.', invBtn: 'Abrir mis facturas',
    accTitle: 'Cuentas conectadas', accNone: 'Todavía no has conectado ninguna cuenta MT.', accAdd: 'Conectar una cuenta', apiK: 'Tu clave API', apiTxt: 'Pégala en el conector del MetaTrader.', copy: 'Copiar', copied: 'Copiada',
    lastSync: 'Últ. sync', never: 'nunca',
    nTitle: 'Qué avisos quieres recibir', nEmail: 'Correos de la cuenta y pagos', nWeek: 'Resumen semanal de tu operativa', nFund: 'Alertas de reglas de fondeo', nMkt: 'Novedades y ofertas',
    pwT: 'Cambiar contraseña', pwNew: 'Nueva contraseña', pwRep: 'Repetir contraseña', pwBtn: 'Actualizar contraseña', pwShort: 'Mínimo 8 caracteres.', pwDiff: 'Las contraseñas no coinciden.', pwOk: 'Contraseña actualizada.',
    dTitle: 'Eliminar mi cuenta', dTxt: 'Se borrarán tus cuentas, operaciones y notas para siempre, y se cancelará tu suscripción. Esto no se puede deshacer.', dType: 'Escribe ELIMINAR para confirmar', dBtn: 'Eliminar mi cuenta',
    mtDisc: 'Desconectar', mtDel: 'Eliminar',
    mtDiscQ: '¿Desconectar esta cuenta? Se libera el cupo y podrás usarlo en otra, pero tu historial se conserva.',
    mtDelQ: '¿ELIMINAR esta cuenta y TODAS sus operaciones? Esto no se puede deshacer.',
    mtDiscOk: 'Cuenta desconectada. El cupo ya está libre.', mtDelOk: 'Cuenta eliminada.',
    mtHelp: 'Desconectar libera el cupo y conserva tu historial. Eliminar borra la cuenta y sus operaciones para siempre.',
    addT: '¿Necesitas más cuentas?', addD: 'Añade cuentas sueltas a tu plan por ${p} al mes cada una.',
    addTotal: 'Total', addAcc: 'cuentas', addSave: 'Guardar cambios', addSaved: 'Actualizado',
    refT: 'Programa de referidos', refTxt: 'Muy pronto podrás invitar amigos y ganar créditos, o convertirte en embajador y cobrar una comisión mensual por cada suscriptor que traigas.', soon: 'Próximamente',
  },
  en: {
    title: 'My account', back: 'Go to dashboard', save: 'Save', saved: 'Saved', saving: '...',
    nav: { plan: 'Subscription', perfil: 'Profile', facturas: 'Invoices', cuentas: 'MT accounts', avisos: 'Notifications', seguridad: 'Security', referidos: 'Referrals' },
    planCur: 'Your plan', active: 'Active', canceling: 'Cancels at period end', noSub: 'Free plan', renews: 'Renews on', ends: 'Ends on',
    perMo: 'month', perYr: 'year', manage: 'Manage billing', manageSub: 'Change card, view invoices or cancel on Stripe',
    usage: 'MT accounts used', of: 'of', unlimited: 'unlimited', usageLeft: 'You have', usageLeft2: 'account(s) left.', usageFull: 'You reached your limit.',
    upTitle: 'Upgrade to', upBtn: 'Upgrade to', andMore: 'plus:', seePlans: 'See all plans',
    name: 'Name', tz: 'Time zone', langL: 'Language', email: 'Email', emailNote: 'Email cannot be changed here.',
    invTitle: 'Your invoices', invTxt: 'All your invoices and receipts live in the secure Stripe portal. You can download them as PDF there.', invBtn: 'Open my invoices',
    accTitle: 'Connected accounts', accNone: 'You have not connected any MT account yet.', accAdd: 'Connect an account', apiK: 'Your API key', apiTxt: 'Paste it into the MetaTrader connector.', copy: 'Copy', copied: 'Copied',
    lastSync: 'Last sync', never: 'never',
    nTitle: 'Which alerts you want', nEmail: 'Account and billing emails', nWeek: 'Weekly performance recap', nFund: 'Prop-firm rule alerts', nMkt: 'News and offers',
    pwT: 'Change password', pwNew: 'New password', pwRep: 'Repeat password', pwBtn: 'Update password', pwShort: 'At least 8 characters.', pwDiff: 'Passwords do not match.', pwOk: 'Password updated.',
    dTitle: 'Delete my account', dTxt: 'Your accounts, trades and notes will be erased forever and your subscription will be canceled. This cannot be undone.', dType: 'Type ELIMINAR to confirm', dBtn: 'Delete my account',
    mtDisc: 'Disconnect', mtDel: 'Delete',
    mtDiscQ: 'Disconnect this account? The slot is freed and you can use it elsewhere, but your history is kept.',
    mtDelQ: 'DELETE this account and ALL its trades? This cannot be undone.',
    mtDiscOk: 'Account disconnected. The slot is free now.', mtDelOk: 'Account deleted.',
    mtHelp: 'Disconnect frees the slot and keeps your history. Delete erases the account and its trades forever.',
    addT: 'Need more accounts?', addD: 'Add extra accounts to your plan for ${p}/month each.',
    addTotal: 'Total', addAcc: 'accounts', addSave: 'Save changes', addSaved: 'Updated',
    refT: 'Referral program', refTxt: 'Soon you will be able to invite friends and earn credit, or become an ambassador and earn a monthly commission for every subscriber you bring.', soon: 'Coming soon',
  },
};

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : 'var(--line)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function AccountClient({ email }: { email: string }) {
  const { lang, setLang } = useLang();
  const [tab, setTab] = useState<Tab>('plan');
  const [data, setData] = useState<any>(null);
  const [p, setP] = useState<any>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [extraQty, setExtraQty] = useState(0);
  const setExtra = (n: number) => setExtraQty(Math.max(0, Math.min(50, n)));
  const L = D[lang];

  useEffect(() => {
    load();
  }, []);
  async function load() {
    try { const r = await fetch('/api/account'); const j = await r.json(); setData(j); setP(j.profile || {}); setExtraQty(Number(j.limit?.extra || 0)); } catch {}
  }

  const plans: any[] = data?.plans || [];
  const accounts: any[] = data?.accounts || [];
  const sub = data?.subscription;
  const myPlan = plans.find((x) => x.id === (p.plan || 'free'));
  const limit = data?.limit;
  const maxAcc = limit ? Number(limit.max) : Number(myPlan?.max_accounts || 1);
  const used = accounts.length;
  const isUnlimited = limit ? !!limit.unlimited : maxAcc >= 999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(maxAcc, 1)) * 100));
  const barColor = pct >= 100 ? '#ff6b7d' : pct >= 75 ? '#ffc04d' : '#34e2a0';
  const upgrades = useMemo(() => plans.filter((x) => (x.price_month || 0) > (myPlan?.price_month || 0)), [plans, myPlan]);

  async function saveProfile(extra: any = {}) {
    setBusy('save'); setMsg('');
    const body = { full_name: p.full_name, timezone: p.timezone, lang: p.lang, notify_email: p.notify_email, notify_weekly: p.notify_weekly, notify_funding: p.notify_funding, notify_marketing: p.notify_marketing, ...extra };
    const r = await fetch('/api/account', { method: 'PATCH', body: JSON.stringify(body) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    setMsg(L.saved); setTimeout(() => setMsg(''), 2500);
  }
  function setField(k: string, v: any) { setP({ ...p, [k]: v }); }

  async function mtAction(acc: any, mode: 'disconnect' | 'delete') {
    const q = mode === 'delete' ? L.mtDelQ : L.mtDiscQ;
    if (!confirm(q)) return;
    setBusy('mt' + acc.id);
    const r = await fetch('/api/account/mt', { method: 'POST', body: JSON.stringify({ account_id: acc.id, mode }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    setMsg(mode === 'delete' ? L.mtDelOk : L.mtDiscOk); setTimeout(() => setMsg(''), 3000);
    load();
  }

  async function saveExtra() {
    setBusy('extra');
    const r = await fetch('/api/account/addons', { method: 'POST', body: JSON.stringify({ qty: extraQty }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    setMsg(L.addSaved); setTimeout(() => setMsg(''), 2500); load();
  }

  async function openPortal() {
    setBusy('portal');
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' });
      const txt = await r.text(); let j: any = {};
      try { j = JSON.parse(txt); } catch { j = { code: 'generic' }; }
      if (j.url) { window.location.href = j.url; return; }
      alert(errMsg(j, lang));
    } catch (e: any) { alert(errMsg({ code: 'network' }, lang)); }
    setBusy('');
  }

  const NAV: [Tab, string][] = [['plan', '💳'], ['perfil', '👤'], ['facturas', '🧾'], ['cuentas', '🔌'], ['avisos', '🔔'], ['seguridad', '🔒'], ['referidos', '🎁']];
  const card = { marginBottom: 14 } as any;
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 10, display: 'block' } as any;

  return (
    <>

      <div className="wrap-wide" style={{ padding: '22px 0' }}>
        <div className="adminlayout">
          <div className="adminnav card" style={{ padding: 12 }}>
            <div className="adminnav-items">
              {NAV.map(([k, icon]) => <button key={k} className={'adminnav-item' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{icon} {L.nav[k]}</button>)}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            {!data && <div className="card muted">…</div>}

            {data && tab === 'plan' && (
              <>
                <div className="card" style={card}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 800 }}>{planName(myPlan, lang) || 'Free'}</span>
                        {sub ? (
                          <span className="pill" style={{ color: sub.cancelAtPeriodEnd ? '#ffc04d' : '#34e2a0', background: sub.cancelAtPeriodEnd ? 'rgba(255,192,77,.15)' : 'rgba(52,226,160,.15)' }}>{sub.cancelAtPeriodEnd ? L.canceling : L.active}</span>
                        ) : <span className="pill">{L.noSub}</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {sub ? `${sub.cancelAtPeriodEnd ? L.ends : L.renews} ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '—'} · ${sub.amount} ${sub.currency}/${sub.interval === 'year' ? L.perYr : L.perMo}` : '$0'}
                      </div>
                    </div>
                    <button className="btn btn-ghost" onClick={openPortal} disabled={busy === 'portal'}>{busy === 'portal' ? L.saving : L.manage}</button>
                  </div>

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <div className="row between" style={{ fontSize: 13, marginBottom: 6 }}>
                      <span className="muted">{L.usage}</span>
                      <b>{used} {L.of} {isUnlimited ? L.unlimited : maxAcc}</b>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: (isUnlimited ? 8 : pct) + '%', height: '100%', background: barColor, transition: '.3s' }} />
                    </div>
                    {!isUnlimited && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{used >= maxAcc ? L.usageFull : `${L.usageLeft} ${maxAcc - used} ${L.usageLeft2}`}</div>}
                  </div>
                </div>

                {upgrades.map((u) => (
                  <div key={u.id} className="card" style={{ ...card, border: '1px solid #7c8cff' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{L.upTitle} {planName(u, lang)} · ${u.price_month}/{L.perMo}</div>
                    <div className="muted" style={{ fontSize: 14, marginBottom: 10 }}>{(lang === 'en' ? u.desc_en : u.desc_es) || ''}</div>
                    <div style={{ marginBottom: 12 }}>
                      {((lang === 'en' ? u.features_en : u.features) || []).slice(0, 4).map((f: string, i: number) => (
                        <div key={i} style={{ fontSize: 14, color: '#cfd7e6' }}>✓ {f}</div>
                      ))}
                    </div>
                    <Link className="btn btn-primary" href="/pricing">{L.upBtn} {planName(u, lang)} →</Link>
                  </div>
                ))}
                {data.addons?.extra_account_enabled && data.addons?.extra_account_price_id && sub && !isUnlimited && (
                  <div className="card" style={card}>
                    <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{L.addT}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{L.addD.replace('{p}', String(data.addons.extra_account_price))}</div>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn btn-ghost" style={{ width: 36, padding: '4px 0' }} onClick={() => setExtra(Math.max(0, extraQty - 1))}>−</button>
                        <span style={{ fontSize: 19, fontWeight: 800, minWidth: 28, textAlign: 'center' }}>{extraQty}</span>
                        <button className="btn btn-ghost" style={{ width: 36, padding: '4px 0' }} onClick={() => setExtra(extraQty + 1)}>+</button>
                      </div>
                    </div>
                    <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ fontSize: 14 }}>{L.addTotal}: <b>{(limit?.base || 0) + extraQty} {L.addAcc}</b>{extraQty > 0 ? ` · +$${extraQty * Number(data.addons.extra_account_price)}/${L.perMo}` : ''}</span>
                      {extraQty !== (limit?.extra || 0) && <button className="btn btn-primary" onClick={saveExtra} disabled={busy === 'extra'}>{busy === 'extra' ? L.saving : L.addSave}</button>}
                    </div>
                  </div>
                )}

                {sub && data.retention?.enabled && (
                  <div className="card" style={card}>
                    <CancelFlow lang={lang} canceling={!!sub.cancelAtPeriodEnd} planName={planName(myPlan, lang)} onDone={load} />
                  </div>
                )}

                <Link className="muted" href="/pricing" style={{ fontSize: 13, textDecoration: 'underline' }}>{L.seePlans}</Link>
              </>
            )}

            {data && tab === 'perfil' && (
              <div className="card" style={{ maxWidth: 520 }}>
                <span style={lbl}>{L.email}</span>
                <input value={p.email || email} disabled style={{ margin: '4px 0 0', opacity: .6 }} />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{L.emailNote}</div>
                <span style={lbl}>{L.name}</span>
                <input value={p.full_name || ''} onChange={(e) => setField('full_name', e.target.value)} style={{ margin: '4px 0 0' }} />
                <span style={lbl}>{L.tz}</span>
                <input placeholder="America/New_York" value={p.timezone || ''} onChange={(e) => setField('timezone', e.target.value)} style={{ margin: '4px 0 0' }} />
                <span style={lbl}>{L.langL}</span>
                <select value={p.lang || 'es'} onChange={(e) => setField('lang', e.target.value)} style={{ margin: '4px 0 0' }}><option value="es">Español</option><option value="en">English</option></select>
                <div className="row" style={{ gap: 10, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => saveProfile()} disabled={busy === 'save'}>{busy === 'save' ? L.saving : L.save}</button>
                  {msg && <span style={{ color: 'var(--green)', fontSize: 13 }}>{msg}</span>}
                </div>
              </div>
            )}

            {data && tab === 'facturas' && (
              <div className="card" style={{ maxWidth: 560 }}>
                <h3 style={{ marginBottom: 8 }}>{L.invTitle}</h3>
                <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{L.invTxt}</p>
                <button className="btn btn-primary" onClick={openPortal} disabled={busy === 'portal'}>{busy === 'portal' ? L.saving : L.invBtn}</button>
              </div>
            )}

            {data && tab === 'cuentas' && (
              <>
                <div className="card" style={card}>
                  <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <h3>{L.accTitle} ({used}{isUnlimited ? '' : ' / ' + maxAcc})</h3>
                    <Link className="btn btn-ghost" href="/dashboard">{L.accAdd}</Link>
                  </div>
                  {!accounts.length && <div className="muted" style={{ fontSize: 14 }}>{L.accNone}</div>}
                  {!!accounts.length && <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{L.mtHelp}</div>}
                  {accounts.map((a) => (
                    <div key={a.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '10px 0', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.login} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>{a.broker || a.server || ''}</span></div>
                        <div className="muted" style={{ fontSize: 12 }}>{a.platform || 'MT5'} · {L.lastSync}: {a.last_sync_at ? new Date(a.last_sync_at).toLocaleString() : L.never}</div>
                      </div>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700 }}>{a.balance != null ? '$' + Number(a.balance).toLocaleString() : ''}</div>
                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => mtAction(a, 'disconnect')} disabled={busy === 'mt' + a.id}>{L.mtDisc}</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => mtAction(a, 'delete')} disabled={busy === 'mt' + a.id}>{L.mtDel}</button>
                      </div>
                    </div>
                  ))}
                </div>
                {data.apiKey && (
                  <div className="card">
                    <h3 style={{ marginBottom: 6 }}>{L.apiK}</h3>
                    <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{L.apiTxt}</p>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="code" style={{ flex: 1, minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.apiKey}</span>
                      <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(data.apiKey); setMsg(L.copied); setTimeout(() => setMsg(''), 2000); }}>{msg === L.copied ? L.copied : L.copy}</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {data && tab === 'avisos' && (
              <div className="card" style={{ maxWidth: 560 }}>
                <h3 style={{ marginBottom: 12 }}>{L.nTitle}</h3>
                {([['notify_email', L.nEmail], ['notify_weekly', L.nWeek], ['notify_funding', L.nFund], ['notify_marketing', L.nMkt]] as [string, string][]).map(([k, label]) => (
                  <div key={k} className="row between" style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 14 }}>{label}</span>
                    <Toggle on={!!p[k]} onClick={() => setField(k, !p[k])} />
                  </div>
                ))}
                <div className="row" style={{ gap: 10, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => saveProfile()} disabled={busy === 'save'}>{busy === 'save' ? L.saving : L.save}</button>
                  {msg && <span style={{ color: 'var(--green)', fontSize: 13 }}>{msg}</span>}
                </div>

                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                  <TelegramCard lang={lang} />
                </div>
              </div>
            )}

            {data && tab === 'seguridad' && <Security L={L} lang={lang} />}

            {data && tab === 'referidos' && <Ambassador lang={lang} />}
          </div>
        </div>
      </div>
    </>
  );
}

function Security({ L, lang }: { L: any; lang: Lang }) {
  const [pw1, setPw1] = useState(''); const [pw2, setPw2] = useState('');
  const [conf, setConf] = useState(''); const [busy, setBusy] = useState(''); const [ok, setOk] = useState('');

  async function changePw() {
    if (pw1.length < 8) { alert(L.pwShort); return; }
    if (pw1 !== pw2) { alert(L.pwDiff); return; }
    setBusy('pw');
    const r = await fetch('/api/account/password', { method: 'POST', body: JSON.stringify({ password: pw1 }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    setPw1(''); setPw2(''); setOk(L.pwOk); setTimeout(() => setOk(''), 3000);
  }
  async function delAcc() {
    if (!confirm(L.dTxt)) return;
    setBusy('del');
    const r = await fetch('/api/account/delete', { method: 'POST', body: JSON.stringify({ confirm: conf }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { alert(errMsg(j, lang)); return; }
    window.location.href = '/';
  }
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 10, display: 'block' } as any;

  return (
    <>
      <div className="card" style={{ maxWidth: 480, marginBottom: 14 }}>
        <h3 style={{ marginBottom: 4 }}>{L.pwT}</h3>
        <span style={lbl}>{L.pwNew}</span>
        <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} style={{ margin: '4px 0 0' }} />
        <span style={lbl}>{L.pwRep}</span>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={{ margin: '4px 0 0' }} />
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn btn-primary" onClick={changePw} disabled={busy === 'pw'}>{busy === 'pw' ? '...' : L.pwBtn}</button>
          {ok && <span style={{ color: 'var(--green)', fontSize: 13 }}>{ok}</span>}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, border: '1px solid var(--red)' }}>
        <h3 style={{ marginBottom: 6, color: 'var(--red)' }}>{L.dTitle}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{L.dTxt}</p>
        <input placeholder={L.dType} value={conf} onChange={(e) => setConf(e.target.value)} style={{ margin: 0 }} />
        <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={delAcc} disabled={busy === 'del' || conf.trim().toUpperCase() !== 'ELIMINAR'}>{busy === 'del' ? '...' : L.dBtn}</button>
      </div>
    </>
  );
}
