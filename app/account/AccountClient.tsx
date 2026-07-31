'use client';
import { toast } from '@/lib/toast';
import { fmtDate, fmtDateTime } from '@/lib/fmtDate';
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';
import CountrySelect from '@/app/components/CountrySelect';
import { useCatalog } from '@/lib/useCatalog';
import { platformLabel } from '@/lib/platforms';
import { errMsg, planName } from '@/lib/i18nErrors';
import Ambassador from './Ambassador';
import ReferralCard from './ReferralCard';
import CancelFlow from './CancelFlow';
import TelegramCard from './TelegramCard';
import BillingCard from './BillingCard';
import EmbeddedCheckoutModal from '@/app/EmbeddedCheckoutModal';
import InstallApp from '@/app/dashboard/InstallApp';
import PushToggle from './PushToggle';
import TwoFactorCard from './TwoFactorCard';

type Lang = 'es' | 'en';
type Tab = 'plan' | 'perfil' | 'facturas' | 'cuentas' | 'avisos' | 'seguridad' | 'referidos';

const D: any = {
  es: {
    title: 'Mi cuenta', back: 'Ir al panel', save: 'Guardar', saved: 'Guardado', saving: '...',
    nav: { plan: 'Suscripción', perfil: 'Perfil', facturas: 'Facturas', cuentas: 'Cuentas', avisos: 'Notificaciones', seguridad: 'Seguridad', referidos: 'Referidos' },
    planSub: 'Tu plan, tu facturación y cómo cambiarlo.', perfilSub: 'Tus datos y tu perfil de trader.', cuentasSub: 'Conecta y administra tus cuentas de trading (MetaTrader, cTrader…).', segSub: 'Contraseña y opciones de tu cuenta.', refSub: 'Invita amigos y gana con Onyx.',
    planCur: 'Tu plan', active: 'Activo', canceling: 'Se cancela al final del periodo', noSub: 'Plan gratuito', renews: 'Se renueva el', ends: 'Termina el',
    perMo: 'mes', perYr: 'año', manage: 'Gestionar pago', manageSub: 'Cambiar tarjeta, ver facturas o cancelar en Stripe',
    changePlanT: 'Cambiar de plan', chUp: 'Subir', chDown: 'Bajar', chCurrent: 'Plan actual', chMo: '/mes',
    chNote: 'Subir es inmediato (se cobra la diferencia prorrateada). Bajar aplica en tu próximo cobro, sin perder nada hasta entonces.',
    chOkUp: '✓ Plan actualizado', chOkDown: '✓ El cambio aplicará en tu próximo cobro',
    chCfUp: 'Vas a subir a', chCfDown: 'Vas a bajar a',
    chCfUpNote: 'El cambio es inmediato y se cobra solo la diferencia prorrateada de lo que queda del mes.',
    chCfDownNote: 'Se aplicará en tu próximo cobro. Conservas tu plan actual hasta entonces.',
    chConfirm: 'Confirmar', chCancel: 'Cancelar',
    chThanksT: 'Bienvenido a', chThanksBody: 'Tu plan ya está activo. ¡Gracias por confiar en Onyx Trading Live!', chThanksBtn: 'Entendido',
    errSame: 'Ya estás en ese plan.', errNoPrice: 'Ese plan aún no tiene precio configurado. Escríbenos.', errChange: 'No se pudo cambiar el plan. Intenta de nuevo.',
    pendT: 'Cambio de plan programado', pendTo: 'Bajarás a', pendOn: 'el', pendKeep: 'Conservas tu plan actual y todas sus funciones hasta esa fecha.',
    pendCancel: 'Cancelar cambio', pendCanceling: 'Cancelando…', pendCanceled: 'Cambio cancelado. Sigues en tu plan actual.',
    pendLoseCopy: 'En esa fecha se pausará tu copy trading (no se borra; vuelve al subir de plan).',
    pendOver: 'Tu plan nuevo permite {n} cuenta(s) y tienes {m}. En la fecha del cambio pausaremos las que sobren.',
    keepT: 'Elige qué cuentas conservar', keepSub: 'Tu plan nuevo permite {n}. Marca las que quieres mantener activas; el resto se pausará (no se borra).',
    keepSave: 'Guardar selección', keepSaved: 'Selección guardada', keepMax: 'Ya elegiste el máximo permitido.',
    accPaused: 'Pausada por plan', pausedNote: 'Pausada por el límite de tu plan. Sube de plan para reactivarla.',
    dgDate: 'Se aplicará el', dgLoseCopy: 'Perderás copy trading (se pausa, no se borra).', dgLoseAcc: 'Se pausarán {n} cuenta(s) que exceden el nuevo límite.',
    usage: 'Cuentas usadas', of: 'de', unlimited: 'ilimitadas', usageLeft: 'Te queda', usageLeft2: 'cuenta(s).', usageFull: 'Has llegado a tu límite.',
    upTitle: 'Mejorar a', upBtn: 'Mejorar a', andMore: 'y además:', seePlans: 'Ver todos los planes',
    name: 'Nombre completo', tz: 'Zona horaria', langL: 'Idioma', email: 'Correo', emailNote: 'El correo no se puede cambiar aquí.',
    tProfTitle: 'Perfil de trader', tCountry: 'País', tExp: 'Experiencia', tStyle: 'Estilo', tPlat: 'Plataforma', tGoal: 'Meta principal', tProp: 'Prop firm', tChoose: 'Elige…',
    tExpO: [['novato', 'Novato'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado'], ['pro', 'Profesional']],
    tStyleO: [['scalping', 'Scalping'], ['day', 'Day trading'], ['swing', 'Swing'], ['position', 'Position'], ['algo', 'Trader algorítmico (bots)']],
    tPlatO: [['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ctrader', 'cTrader'], ['matchtrader', 'MatchTrader'], ['ambas', 'Varias']],
    tGoalO: [['pasar_challenge', 'Pasar mi challenge'], ['consistencia', 'Ser consistente'], ['crecer', 'Hacer crecer mi cuenta'], ['vivir', 'Vivir del trading']],
    invTitle: 'Tus facturas', invTxt: 'Aquí están todas tus facturas y recibos. Descárgalas en PDF.', invBtn: 'Abrir mis facturas',
    invEmpty: 'Todavía no tienes facturas.', invDl: 'PDF', invPaid: 'Pagada', invOpen: 'Pendiente', invVoid: 'Anulada', invPortal: 'Ver en Stripe',
    accTitle: 'Cuentas conectadas', accNone: 'Todavía no has conectado ninguna cuenta.', accAdd: 'Conectar una cuenta', apiK: 'Tu clave API', apiTxt: 'Pégala en el conector de tu plataforma (EA de MetaTrader o cBot de cTrader).', copy: 'Copiar', copied: 'Copiada',
    lastSync: 'Últ. sync', never: 'nunca', mtLive: 'Conectada', mtStale: 'Sin señal', mtNever: 'Sin conectar',
    nTitle: 'Qué avisos quieres recibir', nEmail: 'Correos de la cuenta y pagos', nWeek: 'Resumen semanal de tu operativa', nFund: 'Alertas de reglas de fondeo', nMkt: 'Novedades y ofertas',
    nSub: 'Elige por dónde y de qué quieres enterarte.', nMailT: 'Correo',
    nEmailS: 'Cobros, recibos y cambios de plan', nWeekS: 'Tu semana por email', nFundS: 'Cuando te acercas a un límite', nMktS: 'Promos y lanzamientos',
    pwT: 'Cambiar contraseña', pwNew: 'Nueva contraseña', pwRep: 'Repetir contraseña', pwBtn: 'Actualizar contraseña', pwShort: 'Mínimo 8 caracteres.', pwDiff: 'Las contraseñas no coinciden.', pwOk: 'Contraseña actualizada.',
    dTitle: 'Eliminar mi cuenta', dTxt: 'Se borrarán tus cuentas, operaciones y notas para siempre, y se cancelará tu suscripción. Esto no se puede deshacer.', dType: 'Escribe ELIMINAR para confirmar', dBtn: 'Eliminar mi cuenta',
    dWord: 'ELIMINAR', dHintA: 'Escribe ', dHintB: ' (en mayúsculas) para activar el botón.', dCaps: 'Debe ir TODO en mayúsculas.', dReady: 'Coincide. Ya puedes eliminar.',
    dMTitle: '¿Eliminar tu cuenta?', dMBody: 'Esta acción no se puede deshacer. Se borra todo y se cancela tu suscripción.', dMCancel: 'Cancelar', dMDel: 'Eliminar',
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
    nav: { plan: 'Subscription', perfil: 'Profile', facturas: 'Invoices', cuentas: 'Accounts', avisos: 'Notifications', seguridad: 'Security', referidos: 'Referrals' },
    planSub: 'Your plan, billing and how to change it.', perfilSub: 'Your details and trader profile.', cuentasSub: 'Connect and manage your trading accounts (MetaTrader, cTrader…).', segSub: 'Password and account options.', refSub: 'Invite friends and earn with Onyx.',
    planCur: 'Your plan', active: 'Active', canceling: 'Cancels at period end', noSub: 'Free plan', renews: 'Renews on', ends: 'Ends on',
    perMo: 'month', perYr: 'year', manage: 'Manage billing', manageSub: 'Change card, view invoices or cancel on Stripe',
    changePlanT: 'Change plan', chUp: 'Upgrade', chDown: 'Downgrade', chCurrent: 'Current plan', chMo: '/mo',
    chNote: 'Upgrade is immediate (the prorated difference is charged). Downgrade applies at your next renewal, keeping everything until then.',
    chOkUp: '✓ Plan updated', chOkDown: '✓ Change applies at your next renewal',
    chCfUp: 'You are upgrading to', chCfDown: 'You are downgrading to',
    chCfUpNote: 'The change is immediate and only the prorated difference for the rest of the month is charged.',
    chCfDownNote: 'It will apply at your next renewal. You keep your current plan until then.',
    chConfirm: 'Confirm', chCancel: 'Cancel',
    chThanksT: 'Welcome to', chThanksBody: 'Your plan is now active. Thanks for choosing Onyx Trading Live!', chThanksBtn: 'Got it',
    errSame: 'You are already on that plan.', errNoPrice: 'That plan has no price configured yet. Contact us.', errChange: 'Could not change the plan. Try again.',
    pendT: 'Scheduled plan change', pendTo: 'You will move to', pendOn: 'on', pendKeep: 'You keep your current plan and all its features until that date.',
    pendCancel: 'Cancel change', pendCanceling: 'Canceling…', pendCanceled: 'Change canceled. You stay on your current plan.',
    pendLoseCopy: 'On that date your copy trading will be paused (not deleted; it returns when you upgrade).',
    pendOver: 'Your new plan allows {n} account(s) and you have {m}. On the change date we will pause the extra ones.',
    keepT: 'Choose which accounts to keep', keepSub: 'Your new plan allows {n}. Check the ones you want to keep active; the rest will be paused (not deleted).',
    keepSave: 'Save selection', keepSaved: 'Selection saved', keepMax: 'You already picked the maximum allowed.',
    accPaused: 'Paused by plan', pausedNote: 'Paused by your plan limit. Upgrade to reactivate it.',
    dgDate: 'Applies on', dgLoseCopy: 'You will lose copy trading (paused, not deleted).', dgLoseAcc: 'We will pause {n} account(s) that exceed the new limit.',
    usage: 'Accounts used', of: 'of', unlimited: 'unlimited', usageLeft: 'You have', usageLeft2: 'account(s) left.', usageFull: 'You reached your limit.',
    upTitle: 'Upgrade to', upBtn: 'Upgrade to', andMore: 'plus:', seePlans: 'See all plans',
    name: 'Full name', tz: 'Time zone', langL: 'Language', email: 'Email', emailNote: 'Email cannot be changed here.',
    tProfTitle: 'Trader profile', tCountry: 'Country', tExp: 'Experience', tStyle: 'Style', tPlat: 'Platform', tGoal: 'Main goal', tProp: 'Prop firm', tChoose: 'Choose…',
    tExpO: [['novato', 'Beginner'], ['intermedio', 'Intermediate'], ['avanzado', 'Advanced'], ['pro', 'Professional']],
    tStyleO: [['scalping', 'Scalping'], ['day', 'Day trading'], ['swing', 'Swing'], ['position', 'Position'], ['algo', 'Algo trader (bots)']],
    tPlatO: [['mt5', 'MetaTrader 5'], ['mt4', 'MetaTrader 4'], ['ctrader', 'cTrader'], ['matchtrader', 'MatchTrader'], ['ambas', 'Several']],
    tGoalO: [['pasar_challenge', 'Pass my challenge'], ['consistencia', 'Be consistent'], ['crecer', 'Grow my account'], ['vivir', 'Trade for a living']],
    invTitle: 'Your invoices', invTxt: 'Here are all your invoices and receipts. Download them as PDF.', invBtn: 'Open my invoices',
    invEmpty: 'No invoices yet.', invDl: 'PDF', invPaid: 'Paid', invOpen: 'Due', invVoid: 'Void', invPortal: 'View on Stripe',
    accTitle: 'Connected accounts', accNone: 'You have not connected any account yet.', accAdd: 'Connect an account', apiK: 'Your API key', apiTxt: 'Paste it into your platform connector (MetaTrader EA or cTrader cBot).', copy: 'Copy', copied: 'Copied',
    lastSync: 'Last sync', never: 'never', mtLive: 'Connected', mtStale: 'No signal', mtNever: 'Not connected',
    nTitle: 'Which alerts you want', nEmail: 'Account and billing emails', nWeek: 'Weekly performance recap', nFund: 'Prop-firm rule alerts', nMkt: 'News and offers',
    nSub: 'Choose where and what you want to hear about.', nMailT: 'Email',
    nEmailS: 'Charges, receipts and plan changes', nWeekS: 'Your week by email', nFundS: 'When you get close to a limit', nMktS: 'Promos and launches',
    pwT: 'Change password', pwNew: 'New password', pwRep: 'Repeat password', pwBtn: 'Update password', pwShort: 'At least 8 characters.', pwDiff: 'Passwords do not match.', pwOk: 'Password updated.',
    dTitle: 'Delete my account', dTxt: 'Your accounts, trades and notes will be erased forever and your subscription will be canceled. This cannot be undone.', dType: 'Type DELETE to confirm', dBtn: 'Delete my account',
    dWord: 'DELETE', dHintA: 'Type ', dHintB: ' (uppercase) to enable the button.', dCaps: 'It must be ALL uppercase.', dReady: 'Match. You can delete now.',
    dMTitle: 'Delete your account?', dMBody: 'This cannot be undone. Everything is erased and your subscription is canceled.', dMCancel: 'Cancel', dMDel: 'Delete',
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
  return <span className="toggle" onClick={onClick} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

// Envoltura común de cada tab: misma columna centrada y misma cabecera
// (icono + título + subtítulo) para que TODOS los tabs se vean parejos,
// igual que el de Notificaciones. Un solo estándar, imposible de desincronizar.
function Section({ icon, title, subtitle, children }: { icon: string; title: string; subtitle?: string; children: any }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 13, background: 'rgba(124,140,255,.16)', color: 'var(--brand)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{typeof icon === 'string' ? <OnyxIcon emoji={icon} size={22} /> : icon}</span>
        <h2 style={{ fontSize: 20, marginBottom: 2 }}>{title}</h2>
        {subtitle && <p className="muted" style={{ fontSize: 13, margin: '2px auto 0', maxWidth: 480 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function AccountClient({ email }: { email: string }) {
  const { lang, setLang } = useLang();
  // El tab se guarda en el # de la URL, así al refrescar te quedas donde estabas.
  const TABS = ['plan', 'perfil', 'facturas', 'cuentas', 'avisos', 'seguridad', 'referidos'];
  const [tab, setTabState] = useState<Tab>('plan');
  const setTab = (t: Tab) => { setTabState(t); if (typeof window !== 'undefined') history.replaceState(null, '', '#' + t); };
  useEffect(() => {
    const apply = () => { const h = window.location.hash.replace('#', ''); if (TABS.includes(h)) setTabState(h as Tab); };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  const [data, setData] = useState<any>(null);
  const [p, setP] = useState<any>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [extraQty, setExtraQty] = useState(0);
  const setExtra = (n: number) => setExtraQty(Math.max(0, Math.min(50, n)));
  const [invoices, setInvoices] = useState<any[] | null>(null);
  useEffect(() => {
    if (tab === 'facturas' && invoices === null) {
      fetch('/api/stripe/invoices').then((r) => r.ok ? r.json() : null).then((j) => setInvoices(j?.invoices || [])).catch(() => setInvoices([]));
    }
  }, [tab, invoices]);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  useEffect(() => { fetch('/api/admin/plans').then((r) => r.ok ? r.json() : null).then((j) => setAllPlans(j?.plans || [])).catch(() => {}); }, []);
  const [chTarget, setChTarget] = useState<{ id: string; name: string; up: boolean } | null>(null);   // confirmación
  const [chDone, setChDone] = useState<{ name: string; up: boolean } | null>(null);                    // gracias
  const [coPlan, setCoPlan] = useState<string | null>(null);                                            // checkout embebido (Free → de pago)
  const [chErr, setChErr] = useState('');
  const [cancelTick, setCancelTick] = useState(0);   // abre el flujo de cancelación (bajar a Free)
  async function changePlan(planId: string, up: boolean, name: string) {
    setBusy('plan:' + planId); setChErr('');
    try {
      const r = await fetch('/api/stripe/change-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: planId, annual: false }) });
      const j = await r.json();
      if (!r.ok) { setChErr(j.code === 'same' ? L.errSame : j.code === 'no_price' ? L.errNoPrice : L.errChange); return; }
      if (up) { setChTarget(null); setChDone({ name, up }); }   // subir → bienvenida + reload
      else { setChTarget(null); toast({ es: `Cambio programado. Bajarás a ${name} al final del periodo.`, en: `Change scheduled. You will move to ${name} at period end.` }, 'ok'); load(); }
    } finally { setBusy(''); }
  }
  async function cancelChange() {
    setBusy('cancel');
    try {
      const r = await fetch('/api/stripe/change-plan', { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(errMsg(j, lang)); return; }
      toast(L.pendCanceled, 'ok'); load();
    } finally { setBusy(''); }
  }
  const [keepSel, setKeepSel] = useState<string[]>([]);
  useEffect(() => { const k = data?.pending?.keep; if (Array.isArray(k)) setKeepSel(k.map(String)); }, [data?.pending]);
  async function saveKeep() {
    setBusy('keep');
    const r = await fetch('/api/account', { method: 'PATCH', body: JSON.stringify({ pending_keep: keepSel }) });
    const j = await r.json().catch(() => ({})); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    toast(L.keepSaved, 'ok'); load();
  }
  const L = D[lang];
  const platItems = useCatalog('platform');    // plataformas del catálogo del admin
  const styItems = useCatalog('trader_type');   // tipos de trader del catálogo del admin
  const catLabel = (c: { es: string; en: string }) => (lang === 'en' ? (c.en || c.es) : c.es);
  const pending = data?.pending || null;

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
  const barColor = pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--green)';
  const upgrades = useMemo(() => plans.filter((x) => (x.price_month || 0) > (myPlan?.price_month || 0)), [plans, myPlan]);

  async function saveProfile(extra: any = {}) {
    setBusy('save'); setMsg('');
    const body = { full_name: p.full_name, timezone: p.timezone, lang: p.lang, country: p.country, experience: p.experience, trade_style: p.trade_style, platform: p.platform, prop_firm: p.prop_firm, goal: p.goal, notify_email: p.notify_email, notify_weekly: p.notify_weekly, notify_funding: p.notify_funding, notify_marketing: p.notify_marketing, ...extra };
    const r = await fetch('/api/account', { method: 'PATCH', body: JSON.stringify(body) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    setMsg(L.saved); setTimeout(() => setMsg(''), 2500);
  }
  function setField(k: string, v: any) { setP({ ...p, [k]: v }); }

  async function mtAction(acc: any, mode: 'disconnect' | 'delete') {
    const q = mode === 'delete' ? L.mtDelQ : L.mtDiscQ;
    if (!confirm(q)) return;
    setBusy('mt' + acc.id);
    const r = await fetch('/api/account/mt', { method: 'POST', body: JSON.stringify({ account_id: acc.id, mode }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    setMsg(mode === 'delete' ? L.mtDelOk : L.mtDiscOk); setTimeout(() => setMsg(''), 3000);
    load();
  }

  async function saveExtra() {
    setBusy('extra');
    const r = await fetch('/api/account/addons', { method: 'POST', body: JSON.stringify({ qty: extraQty }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    setMsg(L.addSaved); setTimeout(() => setMsg(''), 2500); load();
  }

  async function openPortal() {
    setBusy('portal');
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' });
      const txt = await r.text(); let j: any = {};
      try { j = JSON.parse(txt); } catch { j = { code: 'generic' }; }
      if (j.url) { window.location.href = j.url; return; }
      toast(errMsg(j, lang));
    } catch (e: any) { toast(errMsg({ code: 'network' }, lang)); }
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
            <div className="row" style={{ gap: 10, alignItems: 'center', padding: '4px 4px 12px', borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{(p.full_name || email || '?').slice(0, 2).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.full_name || (email || '').split('@')[0]}</div>
                <span className="pill" style={{ fontSize: 10.5, background: 'rgba(160,107,255,.16)', color: 'var(--soft-purple)', padding: '1px 8px' }}>{planName(myPlan, lang) || 'Free'}</span>
              </div>
            </div>
            {/* Móvil: selector (se adapta como el menú de arriba) */}
            <select className="adminnav-mobile" value={tab} onChange={(e) => setTab(e.target.value as Tab)} style={{ margin: 0, width: '100%' }}>
              {NAV.map(([k, icon]) => <option key={k} value={k}>{`${icon}  ${L.nav[k]}`}</option>)}
            </select>
            <div className="adminnav-items">
              {NAV.map(([k, icon]) => <button key={k} className={'adminnav-item' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}><OnyxIcon emoji={icon} size={16} /></span><span>{L.nav[k]}</span><span className="navdot" /></button>)}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            {!data && <div className="card muted">…</div>}

            {data && tab === 'plan' && (
              <Section icon="💳" title={L.nav.plan} subtitle={L.planSub}>
                {pending && (
                  <div className="card" style={{ marginBottom: 14, border: '1px solid var(--amber)', background: 'rgba(255,192,77,.06)' }}>
                    <div className="row between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}><OnyxIcon emoji="⏳" size={16} /> {L.pendT}</div>
                        <div style={{ fontSize: 13.5, marginTop: 4 }}>{L.pendTo} <b>{lang === 'es' ? pending.planName : pending.planNameEn}</b> {L.pendOn} <b>{pending.at ? fmtDate(pending.at, lang) : '—'}</b>.</div>
                        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{L.pendKeep}</div>
                        {pending.losesCopy && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--amber)' }}>• {L.pendLoseCopy}</div>}
                        {pending.overBy > 0 && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--amber)' }}>• {L.pendOver.replace('{n}', String(pending.newMax)).replace('{m}', String(used))} <a onClick={() => setTab('cuentas')} style={{ textDecoration: 'underline', cursor: 'pointer' }}>{L.keepT}</a></div>}
                      </div>
                      <button className="btn btn-ghost" onClick={cancelChange} disabled={busy === 'cancel'}>{busy === 'cancel' ? L.pendCanceling : L.pendCancel}</button>
                    </div>
                  </div>
                )}
                <div className="card" style={card}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 800 }}>{planName(myPlan, lang) || 'Free'}</span>
                        {sub ? (
                          <span className="pill" style={{ color: sub.cancelAtPeriodEnd ? 'var(--amber)' : 'var(--green)', background: sub.cancelAtPeriodEnd ? 'rgba(255,192,77,.15)' : 'rgba(52,226,160,.15)' }}>{sub.cancelAtPeriodEnd ? L.canceling : L.active}</span>
                        ) : <span className="pill">{L.noSub}</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {sub ? `${sub.cancelAtPeriodEnd ? L.ends : L.renews} ${sub.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd, lang) : '—'} · ${sub.amount} ${sub.currency}/${sub.interval === 'year' ? L.perYr : L.perMo}` : '$0'}
                      </div>
                    </div>
                  </div>

                  {sub && <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}><BillingCard lang={lang} /></div>}

                  {/* Cambiar de plan (upgrade / downgrade) sobre la misma suscripción */}
                  {sub && allPlans.length > 0 && (() => {
                    const myPlanId = p.plan || 'free';
                    const curPrice = Number(allPlans.find((pl: any) => pl.id === myPlanId)?.price_month ?? 0);
                    // Incluimos Free (bajar a Free = cancelar al final del periodo, vía el flujo con ofertas).
                    const others = allPlans.filter((pl: any) => pl.id !== myPlanId && (pl.id !== 'free' || !!data.retention?.enabled));
                    if (!others.length) return null;
                    return (
                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{L.changePlanT}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                          {others.map((p: any) => {
                            const up = Number(p.price_month) > curPrice;
                            const nm = lang === 'es' ? p.name : (p.name_en || p.name);
                            return (
                              <div key={p.id} style={{ border: '0.5px solid var(--line)', borderRadius: 10, padding: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{nm}</div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>${p.price_month}<span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>{L.chMo}</span></div>
                                <button className={'btn ' + (up ? 'btn-primary' : 'btn-ghost')} style={{ width: '100%', marginTop: 8, fontSize: 12.5, padding: '6px 0' }}
                                  onClick={() => {
                                    if (p.id === 'free') { setCancelTick((x) => x + 1); setTimeout(() => document.getElementById('cancel-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); return; }
                                    setChErr(''); setChTarget({ id: p.id, name: nm, up });
                                  }}>
                                  {up ? '↑ ' + L.chUp : '↓ ' + L.chDown}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}><OnyxIcon emoji="ℹ" size={16} /> {L.chNote}</p>
                      </div>
                    );
                  })()}

                  {/* Usuario Free (sin suscripción): opciones para SUBIR a un plan de pago */}
                  {!sub && allPlans.length > 0 && (() => {
                    const paid = allPlans.filter((pl: any) => pl.id !== 'free' && Number(pl.price_month) > 0);
                    if (!paid.length) return null;
                    return (
                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{lang === 'es' ? 'Mejora tu plan' : 'Upgrade your plan'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                          {paid.map((pl: any) => {
                            const nm = lang === 'es' ? pl.name : (pl.name_en || pl.name);
                            const badge = lang === 'es' ? pl.badge : (pl.badge_en || pl.badge);
                            return (
                              <div key={pl.id} style={{ border: badge ? '2px solid var(--brand)' : '0.5px solid var(--line)', borderRadius: 10, padding: 12 }}>
                                <div className="row between" style={{ gap: 6 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{nm}</div>
                                  {badge && <span className="pill" style={{ fontSize: 10, background: 'rgba(124,140,255,.16)', color: 'var(--soft-brand,var(--brand))' }}>★</span>}
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>${pl.price_month}<span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>{L.chMo}</span></div>
                                <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 12.5, padding: '6px 0' }} onClick={() => setCoPlan(pl.id)}>
                                  ↑ {L.upBtn} {nm}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <a href="/pricing" className="muted" style={{ fontSize: 12, textDecoration: 'underline' }}>{L.seePlans} →</a>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Confirmación de cambio de plan */}
                  {chTarget && (
                    <div onClick={() => setChTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
                      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 420, width: '100%' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{(chTarget.up ? L.chCfUp : L.chCfDown)} <b>{chTarget.name}</b></div>
                        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>{chTarget.up ? L.chCfUpNote : L.chCfDownNote}</p>
                        {!chTarget.up && (() => {
                          const tp: any = allPlans.find((x: any) => x.id === chTarget.id);
                          const tBase = Number(tp?.max_accounts ?? 1); const tUnl = tBase >= 999;
                          const tLosesCopy = !(tp?.capabilities as any)?.copy;
                          const tOver = tUnl ? 0 : Math.max(0, used - tBase);
                          const endD = sub?.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd, lang) : null;
                          return (
                            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.7 }}>
                              {endD && <div><OnyxIcon emoji="📅" size={16} /> {L.dgDate} <b>{endD}</b></div>}
                              {tLosesCopy && <div style={{ color: 'var(--amber)' }}>• {L.dgLoseCopy}</div>}
                              {tOver > 0 && <div style={{ color: 'var(--amber)' }}>• {L.dgLoseAcc.replace('{n}', String(tOver))}</div>}
                            </div>
                          );
                        })()}
                        {chErr && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 10 }}>{chErr}</div>}
                        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" onClick={() => setChTarget(null)}>{L.chCancel}</button>
                          <button className="btn btn-primary" disabled={busy === 'plan:' + chTarget.id} onClick={() => changePlan(chTarget.id, chTarget.up, chTarget.name)}>{busy === 'plan:' + chTarget.id ? '…' : L.chConfirm}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bienvenida al nuevo plan → al cerrar, recarga para reflejar el cambio */}
                  {chDone && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
                      <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
                        <div style={{ fontSize: 34, marginBottom: 6 }}><OnyxIcon emoji="🎉" size={16} /></div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{L.chThanksT} {chDone.name}</div>
                        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 16 }}>{L.chThanksBody}</p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => window.location.reload()}>{L.chThanksBtn}</button>
                      </div>
                    </div>
                  )}

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
                  <div id="cancel-card" className="card" style={card}>
                    <CancelFlow lang={lang} canceling={!!sub.cancelAtPeriodEnd} planName={planName(myPlan, lang)} onDone={load} openTick={cancelTick} />
                  </div>
                )}

                {/* Checkout embebido para crear la suscripción (usuario Free → de pago) */}
                {coPlan && <EmbeddedCheckoutModal plan={coPlan} annual={false} lang={lang} onClose={() => setCoPlan(null)} />}
              </Section>
            )}

            {data && tab === 'perfil' && (
              <Section icon="👤" title={L.nav.perfil} subtitle={L.perfilSub}>
              <div className="card">
                <span style={lbl}>{L.email}</span>
                <input value={p.email || email} disabled style={{ margin: '4px 0 0', opacity: .6 }} />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{L.emailNote}</div>
                <span style={lbl}>{L.name}</span>
                <input value={p.full_name || ''} onChange={(e) => setField('full_name', e.target.value)} style={{ margin: '4px 0 0' }} />
                <span style={lbl}>{L.tz}</span>
                <input placeholder="America/New_York" value={p.timezone || ''} onChange={(e) => setField('timezone', e.target.value)} style={{ margin: '4px 0 0' }} />
                <span style={lbl}>{L.langL}</span>
                <select value={p.lang || 'es'} onChange={(e) => setField('lang', e.target.value)} style={{ margin: '4px 0 0' }}><option value="es">Español</option><option value="en">English</option></select>

                <div style={{ borderTop: '1px solid var(--line)', margin: '20px 0 4px' }} />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{L.tProfTitle}</div>
                <span style={lbl}>{L.tCountry}</span>
                <CountrySelect value={p.country} onChange={(code) => setField('country', code)} placeholder={L.tChoose} style={{ margin: '4px 0 0', width: '100%' }} />
                <span style={lbl}>{L.tExp}</span>
                <select value={p.experience || ''} onChange={(e) => setField('experience', e.target.value)} style={{ margin: '4px 0 0' }}>
                  <option value="">{L.tChoose}</option>{(L as any).tExpO.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span style={lbl}>{L.tStyle}</span>
                <select value={p.trade_style || ''} onChange={(e) => setField('trade_style', e.target.value)} style={{ margin: '4px 0 0' }}>
                  <option value="">{L.tChoose}</option>{styItems.map((c) => <option key={c.code} value={c.code}>{catLabel(c)}</option>)}
                </select>
                <span style={lbl}>{L.tPlat}</span>
                <select value={p.platform || ''} onChange={(e) => setField('platform', e.target.value)} style={{ margin: '4px 0 0' }}>
                  <option value="">{L.tChoose}</option>{platItems.map((c) => <option key={c.code} value={c.code}>{catLabel(c)}</option>)}
                </select>
                <span style={lbl}>{L.tProp}</span>
                <input value={p.prop_firm && p.prop_firm !== 'ninguna' ? p.prop_firm : ''} onChange={(e) => setField('prop_firm', e.target.value)} style={{ margin: '4px 0 0' }} />
                <span style={lbl}>{L.tGoal}</span>
                <select value={p.goal || ''} onChange={(e) => setField('goal', e.target.value)} style={{ margin: '4px 0 0' }}>
                  <option value="">{L.tChoose}</option>{(L as any).tGoalO.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
                </select>

                <div className="row" style={{ gap: 10, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => saveProfile()} disabled={busy === 'save'}>{busy === 'save' ? L.saving : L.save}</button>
                  {msg && <span style={{ color: 'var(--green)', fontSize: 13 }}>{msg}</span>}
                </div>
              </div>
              </Section>
            )}

            {data && tab === 'facturas' && (
              <Section icon="🧾" title={L.invTitle} subtitle={L.invTxt}>
              <div className="card">
                {invoices === null && <div className="muted" style={{ fontSize: 13 }}>…</div>}
                {invoices !== null && !invoices.length && <div className="muted" style={{ fontSize: 13.5 }}>{L.invEmpty}</div>}
                {invoices !== null && invoices.map((inv) => {
                  const stColor = inv.status === 'paid' ? 'var(--green)' : inv.status === 'open' ? 'var(--amber)' : 'var(--mut)';
                  const stTxt = inv.status === 'paid' ? L.invPaid : inv.status === 'open' ? L.invOpen : inv.status === 'void' ? L.invVoid : inv.status;
                  return (
                    <div key={inv.id} className="row between" style={{ borderTop: '1px solid var(--line)', padding: '11px 0', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{inv.currency} {inv.amount.toFixed(2)} <span className="pill" style={{ fontSize: 10, color: stColor, marginLeft: 6 }}>{stTxt}</span></div>
                        <div className="muted" style={{ fontSize: 12 }}>#{inv.number}{inv.created ? ' · ' + fmtDate(inv.created, lang) : ''}</div>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        {inv.pdf && <a className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }} href={inv.pdf} target="_blank" rel="noreferrer"><OnyxIcon emoji="⬇" size={16} /> {L.invDl}</a>}
                        {inv.url && <a className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12.5 }} href={inv.url} target="_blank" rel="noreferrer">{L.invPortal}</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
              </Section>
            )}

            {data && tab === 'cuentas' && (
              <Section icon="🔌" title={L.nav.cuentas} subtitle={L.cuentasSub}>
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
                        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700 }}>{a.login} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>{a.broker || a.server || ''}</span></span>
                          {(() => {
                            const live = a.last_sync_at && (Date.now() - new Date(a.last_sync_at).getTime()) < 120000;
                            const st = !a.last_sync_at ? { txt: L.mtNever, col: 'var(--mut)', bg: 'var(--card2)' }
                              : live ? { txt: L.mtLive, col: 'var(--green)', bg: 'rgba(52,226,160,.15)' }
                              : { txt: L.mtStale, col: 'var(--amber)', bg: 'rgba(255,192,77,.15)' };
                            return <span className="pill" style={{ color: st.col, background: st.bg }}>{st.txt}</span>;
                          })()}
                          {a.plan_paused && <span className="pill" style={{ color: 'var(--amber)', background: 'rgba(255,192,77,.15)' }}>⏸ {L.accPaused}</span>}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>{platformLabel(a.platform, lang) || 'MetaTrader 5'} · {L.lastSync}: {a.last_sync_at ? fmtDateTime(a.last_sync_at, lang) : L.never}</div>
                        {a.plan_paused && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 2 }}>{L.pausedNote}</div>}
                      </div>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700 }}>{a.balance != null ? '$' + Number(a.balance).toLocaleString() : ''}</div>
                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => mtAction(a, 'disconnect')} disabled={busy === 'mt' + a.id}>{L.mtDisc}</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => mtAction(a, 'delete')} disabled={busy === 'mt' + a.id}>{L.mtDel}</button>
                      </div>
                    </div>
                  ))}
                </div>
                {pending && pending.overBy > 0 && pending.newMax != null && (
                  <div className="card" style={{ ...card, border: '1px solid var(--amber)' }}>
                    <h3 style={{ marginBottom: 4 }}>{L.keepT}</h3>
                    <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{L.keepSub.replace('{n}', String(pending.newMax))}</p>
                    {accounts.map((a) => {
                      const checked = keepSel.includes(String(a.id));
                      const atMax = keepSel.length >= pending.newMax;
                      return (
                        <label key={a.id} className="row between" style={{ padding: '9px 0', borderTop: '1px solid var(--line)', cursor: 'pointer', gap: 10 }}>
                          <span style={{ fontSize: 14 }}>{a.login} <span className="muted" style={{ fontSize: 12 }}>{a.broker || a.server || ''}</span></span>
                          <input type="checkbox" checked={checked} disabled={!checked && atMax} onChange={(e) => setKeepSel(e.target.checked ? [...keepSel, String(a.id)] : keepSel.filter((x) => x !== String(a.id)))} style={{ width: 'auto', margin: 0 }} />
                        </label>
                      );
                    })}
                    <div className="row" style={{ gap: 10, marginTop: 14, alignItems: 'center' }}>
                      <button className="btn btn-primary" onClick={saveKeep} disabled={busy === 'keep'}>{busy === 'keep' ? L.saving : L.keepSave}</button>
                      <span className="muted" style={{ fontSize: 12 }}>{keepSel.length}/{pending.newMax}</span>
                    </div>
                  </div>
                )}
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
              </Section>
            )}

            {data && tab === 'avisos' && (
              <Section icon="🔔" title={L.nav.avisos} subtitle={L.nSub}>
                <InstallApp lang={lang} />
                <PushToggle lang={lang} />
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="row" style={{ gap: 9, marginBottom: 8, alignItems: 'center' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}><OnyxIcon emoji="📧" size={16} /></span>
                    <b style={{ fontSize: 15 }}>{L.nMailT}</b>
                  </div>
                  {([['notify_email', L.nEmail, L.nEmailS], ['notify_weekly', L.nWeek, L.nWeekS], ['notify_funding', L.nFund, L.nFundS], ['notify_marketing', L.nMkt, L.nMktS]] as [string, string, string][]).map(([k, label, sub], i) => (
                    <div key={k} className="row between" style={{ padding: '11px 0', borderTop: i ? '1px solid var(--line)' : 'none', gap: 10 }}>
                      <div><div style={{ fontSize: 14 }}>{label}</div><div className="muted" style={{ fontSize: 11.5 }}>{sub}</div></div>
                      {/* "Novedades y ofertas" viene activado por defecto (null => on) y respeta
                          también las bajas hechas desde el pie del correo (marketing_emails). */}
                      {(() => { const cur = k === 'notify_marketing' ? (p.notify_marketing !== false && p.marketing_emails !== false) : !!p[k]; return <Toggle on={cur} onClick={() => setField(k, !cur)} />; })()}
                    </div>
                  ))}
                  <div className="row" style={{ gap: 10, marginTop: 14 }}>
                    <button className="btn btn-primary" onClick={() => saveProfile()} disabled={busy === 'save'}>{busy === 'save' ? L.saving : L.save}</button>
                    {msg && <span style={{ color: 'var(--green)', fontSize: 13 }}>{msg}</span>}
                  </div>
                </div>

                <div className="card">
                  <TelegramCard lang={lang} />
                </div>
              </Section>
            )}

            {data && tab === 'seguridad' && (
              <Section icon="🔒" title={L.nav.seguridad} subtitle={L.segSub}><Security L={L} lang={lang} /></Section>
            )}

            {data && tab === 'referidos' && (
              <Section icon="🎁" title={L.nav.referidos} subtitle={L.refSub}>
                <ReferralCard />
                <Ambassador lang={lang} />
              </Section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Tarjeta de PIN de bloqueo: se muestra solo si el usuario es admin/equipo
// (si la API responde 403, se oculta sola). Aquí el empleado cambia su PIN.
function LockPinCard({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  const [show, setShow] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  useEffect(() => {
    fetch('/api/admin/security').then((r) => r.ok ? r.json() : null).then((d) => { if (d) { setShow(true); setHasPin(!!d.hasPin); } }).catch(() => {});
  }, []);
  async function save(clear = false) {
    setBusy(true); setOk('');
    try {
      const r = await fetch('/api/admin/security', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: clear ? '' : pin }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setPin(''); setHasPin(!clear); setOk(es ? 'PIN actualizado.' : 'PIN updated.'); setTimeout(() => setOk(''), 3000); }
      else toast(d.error || 'Error');
    } finally { setBusy(false); }
  }
  if (!show) return null;
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 10, display: 'block' } as any;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}><OnyxIcon emoji="🔒" size={16} /> {es ? 'PIN de bloqueo del panel' : 'Panel lock PIN'}</h3>
        <span className="pill" style={hasPin ? { color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' } : { color: 'var(--mut)' }}>{hasPin ? (es ? 'Activo' : 'Active') : (es ? 'Sin PIN' : 'No PIN')}</span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{es ? 'Es el PIN de 6 dígitos con el que reentras al panel de administración tras un rato inactivo.' : 'The 6-digit PIN you use to re-enter the admin panel after being idle.'}</p>
      <span style={lbl}>{es ? 'Nuevo PIN (6 dígitos)' : 'New PIN (6 digits)'}</span>
      <input value={pin} inputMode="numeric" maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ margin: '4px 0 0', letterSpacing: 4, maxWidth: 160 }} />
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button className="btn btn-primary" onClick={() => save(false)} disabled={busy || pin.length !== 6}>{busy ? '...' : (es ? 'Guardar PIN' : 'Save PIN')}</button>
        {hasPin && <button className="btn btn-ghost" onClick={() => save(true)} disabled={busy}>{es ? 'Quitar' : 'Remove'}</button>}
        {ok && <span style={{ color: 'var(--green)', fontSize: 13 }}>{ok}</span>}
      </div>
    </div>
  );
}

function Security({ L, lang }: { L: any; lang: Lang }) {
  const [pw1, setPw1] = useState(''); const [pw2, setPw2] = useState('');
  const [conf, setConf] = useState(''); const [busy, setBusy] = useState(''); const [ok, setOk] = useState(''); const [delModal, setDelModal] = useState(false);

  async function changePw() {
    if (pw1.length < 8) { toast(L.pwShort); return; }
    if (pw1 !== pw2) { toast(L.pwDiff); return; }
    setBusy('pw');
    const r = await fetch('/api/account/password', { method: 'POST', body: JSON.stringify({ password: pw1 }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    setPw1(''); setPw2(''); setOk(L.pwOk); setTimeout(() => setOk(''), 3000);
  }
  async function delAcc() {
    if (!confirm(L.dTxt)) return;
    setBusy('del');
    const r = await fetch('/api/account/delete', { method: 'POST', body: JSON.stringify({ confirm: conf }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toast(errMsg(j, lang)); return; }
    window.location.href = '/';
  }
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 10, display: 'block' } as any;

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
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

      {/* Verificación en dos pasos (opcional para el usuario). */}
      <TwoFactorCard lang={lang} />

      {/* Solo para admins/equipo: cambiar su PIN de bloqueo del panel. */}
      <LockPinCard lang={lang} />

      {(() => {
        const word = (L as any).dWord as string;             // ELIMINAR / DELETE
        const v = conf.trim();
        const matched = v === word;                            // exacto, sensible a mayúsculas
        const badCase = !matched && v.toUpperCase() === word;  // escribió la palabra pero mal escrita
        return (
          <div className="card" style={{ border: '1px solid var(--red)' }}>
            <h3 style={{ marginBottom: 6, color: 'var(--red)' }}>{L.dTitle}</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{L.dTxt}</p>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
              {(L as any).dHintA}<code style={{ color: 'var(--red)', fontWeight: 700 }}>{word}</code>{(L as any).dHintB}
            </p>
            <input placeholder={L.dType} value={conf} onChange={(e) => setConf(e.target.value)} style={{ margin: 0 }} />
            <div style={{ fontSize: 12, minHeight: 16, margin: '6px 2px 0', color: matched ? 'var(--green)' : 'var(--amber)' }}>
              {matched ? '✓ ' + (L as any).dReady : (badCase ? (L as any).dCaps : '')}
            </div>
            <button className="btn btn-danger" style={{ marginTop: 10, opacity: matched ? 1 : .45, cursor: matched ? 'pointer' : 'not-allowed' }}
              onClick={() => { if (matched) setDelModal(true); }} disabled={!matched || busy === 'del'}>
              {busy === 'del' ? '...' : L.dBtn}
            </button>
          </div>
        );
      })()}

      {/* Popup de confirmación iluminado (mismo estilo que la academia) */}
      {delModal && (
        <div className="sk-modal-ov" onClick={() => setDelModal(false)}>
          <div className="sk-modal sk-confirm" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
              <span className="sk-confirm-ic"><OnyxIcon emoji="🗑" size={20} /></span>
              <b style={{ fontSize: 16.5 }}>{(L as any).dMTitle}</b>
            </div>
            <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 18px', lineHeight: 1.55 }}>{(L as any).dMBody}</p>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDelModal(false)}>{(L as any).dMCancel}</button>
              <button className="btn sk-btn-danger" onClick={() => { setDelModal(false); delAcc(); }} disabled={busy === 'del'}>{busy === 'del' ? '...' : (L as any).dMDel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
