'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Ambassadors from './Ambassadors';
import Retention from './Retention';
import TestConsole from './TestConsole';
import Firms from './Firms';

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; stripe_price_id: string | null; stripe_price_id_year: string | null; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null; active: boolean; sort: number; capabilities: any };
type User = { id: string; email: string; plan: string; subscription_status: string | null; banned: boolean; is_admin: boolean; created_at: string; accounts: number; lastSync: string | null };
type Team = { id: string; email: string; role: string | null; is_admin: boolean };
type Tab = 'resumen' | 'usuarios' | 'planes' | 'equipo' | 'embajadores' | 'retencion' | 'pruebas' | 'firms' | 'modulos' | 'ajustes';

const CAPS: [string, string][] = [
  ['journal', 'Diario con fotos y notas'],
  ['compare', 'Comparar cuentas'],
  ['funding', 'Reglas de fondeo y retiros'],
  ['costs', 'Costes (comisión y swap)'],
  ['export', 'Exportar CSV'],
  ['reports', 'Informes automáticos'],
  ['telegram', 'Alertas por Telegram'],
  ['manager', 'Onyx Guardian: break even, trailing, plan y límites'],
  ['manager_advanced', 'Guardian avanzado: TP parciales'],
  ['manager_news', 'Guardian: bloqueo por noticias'],
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}
const roleColor = (r?: string | null) => (r === 'owner' ? '#a9b4ff' : r === 'support' ? '#ffd45e' : '#34e2a0');

export default function AdminClient({ meEmail, role, accounts, trades }: { meEmail: string; role: string; accounts: number; trades: number }) {
  const [tab, setTab] = useState<Tab>('resumen');
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [team, setTeam] = useState<Team[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  async function loadUsers() { const r = await fetch('/api/admin/users'); const j = await r.json(); setUsers(j.users || []); }
  async function loadPlans() { const r = await fetch('/api/admin/plans'); const j = await r.json(); setPlans(j.plans || []); }
  async function loadTeam() { const r = await fetch('/api/admin/team'); const j = await r.json(); setTeam(j.team || []); }
  useEffect(() => { loadUsers(); loadPlans(); loadTeam(); }, []);

  const priceOf = useMemo(() => { const m: Record<string, number> = {}; plans.forEach((p) => (m[p.id] = p.price_month)); return m; }, [plans]);
  const paid = users.filter((u) => u.plan && u.plan !== 'free').length;
  const mrr = users.reduce((s, u) => s + (u.plan !== 'free' ? (priceOf[u.plan] || 0) : 0), 0);

  async function userAction(id: string, action: string, value?: any) { setBusy(id + action); const r = await fetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ id, action, value }) }); const j = await r.json(); if (!r.ok) alert(j.error || 'error'); await loadUsers(); setBusy(''); }
  async function delUser(u: User) { if (!confirm(`¿Borrar a ${u.email} y TODOS sus datos?`)) return; setBusy(u.id + 'del'); const r = await fetch('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ id: u.id }) }); const j = await r.json(); if (!r.ok) alert(j.error || 'error'); await loadUsers(); setBusy(''); }
  async function resetPass(u: User) { setBusy(u.id + 'rst'); const r = await fetch('/api/admin/reset-password', { method: 'POST', body: JSON.stringify({ email: u.email }) }); const j = await r.json(); setBusy(''); if (!r.ok) { alert(j.error || 'error'); return; } if (j.link) { navigator.clipboard.writeText(j.link); alert('Enlace de recuperación copiado:\n\n' + j.link); } else alert('Email de recuperación enviado.'); }

  const filtered = users.filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()));
  const NAV: [Tab, string][] = [['resumen', '📊 Resumen'], ['usuarios', '👥 Usuarios'], ['planes', '💳 Planes'], ['equipo', '🛡️ Equipo'], ['embajadores', '🎁 Embajadores'], ['retencion', '🛟 Retención'], ['pruebas', '🧪 Pruebas'], ['firms', '🏛️ Prop firms'], ['modulos', '🧩 Módulos'], ['ajustes', '⚙️ Ajustes']];

  return (
    <>

      <div className="wrap-wide" style={{ padding: '22px 0' }}>
        <div className="adminlayout">
          <div className="adminnav card" style={{ padding: 12 }}>
            <div className="adminnav-items">
              {NAV.map(([k, label]) => <button key={k} className={'adminnav-item' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{label}</button>)}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            {tab === 'resumen' && (
              <div className="grid g4">
                <div className="card kpi"><div className="lbl">Usuarios</div><div className="val">{users.length}</div></div>
                <div className="card kpi"><div className="lbl">De pago</div><div className="val pos">{paid}</div></div>
                <div className="card kpi"><div className="lbl">MRR estimado</div><div className="val pos">${mrr.toLocaleString()}</div></div>
                <div className="card kpi"><div className="lbl">Conversión</div><div className="val">{users.length ? Math.round((paid / users.length) * 100) : 0}%</div></div>
                <div className="card kpi"><div className="lbl">Cuentas MT</div><div className="val">{accounts}</div></div>
                <div className="card kpi"><div className="lbl">Operaciones</div><div className="val">{trades.toLocaleString()}</div></div>
                <div className="card kpi"><div className="lbl">Baneados</div><div className="val neg">{users.filter((u) => u.banned).length}</div></div>
                <div className="card kpi"><div className="lbl">Administradores</div><div className="val">{team.length}</div></div>
              </div>
            )}

            {tab === 'usuarios' && (
              <div className="card">
                <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <h3>Usuarios ({filtered.length})</h3>
                  <input placeholder="Buscar por email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, margin: 0 }} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th>Email</th><th>Plan</th><th>Estado</th><th>Cuentas</th><th>Últ. sync</th><th style={{ minWidth: 260 }}>Acciones</th></tr></thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.id}>
                          <td>{u.email}{u.is_admin && <span className="pill green" style={{ marginLeft: 6 }}>admin</span>}</td>
                          <td><select value={u.plan} onChange={(e) => userAction(u.id, 'plan', e.target.value)} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{!plans.find((p) => p.id === u.plan) && <option value={u.plan}>{u.plan}</option>}</select></td>
                          <td>{u.banned ? <span className="pill" style={{ color: 'var(--red)', background: 'rgba(255,107,125,.15)' }}>baneado</span> : <span className="muted">{u.subscription_status || 'activo'}</span>}</td>
                          <td className="muted">{u.accounts}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{u.lastSync ? new Date(u.lastSync).toLocaleDateString() : '—'}</td>
                          <td><div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => resetPass(u)} disabled={busy === u.id + 'rst'}>🔑</button>
                            {u.banned ? <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'unban')}>Desbanear</button> : <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'ban')}>🚫</button>}
                            <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'admin', !u.is_admin)}>{u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
                            {u.email !== meEmail && <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => delUser(u)} disabled={busy === u.id + 'del'}>🗑</button>}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'planes' && <PlansTab plans={plans} reload={loadPlans} />}
            {tab === 'equipo' && <Equipo team={team} role={role} meEmail={meEmail} reload={loadTeam} />}
            {tab === 'embajadores' && <Ambassadors />}
            {tab === 'retencion' && <Retention />}
            {tab === 'pruebas' && <TestConsole meEmail={meEmail} />}
            {tab === 'firms' && <Firms />}

            {tab === 'modulos' && <Modules />}

            {tab === 'ajustes' && (
              <div className="card" style={{ maxWidth: 620 }}>
                <h3 style={{ marginBottom: 12 }}>Ajustes</h3>
                <p style={{ marginBottom: 8 }}>Tu rol: <b style={{ color: roleColor(role) }}>{role}</b></p>
                <p className="muted" style={{ fontSize: 14, marginBottom: 8 }}>El <b>Owner</b> controla planes, usuarios y equipo. Los <b>Admin</b> gestionan usuarios y planes. El <b>Soporte</b> solo consulta y ayuda.</p>
                <p className="muted" style={{ fontSize: 13 }}>Los correos de <span className="code">ADMIN_EMAILS</span> en Vercel siempre entran como Owner. Puedes añadir más administradores desde la pestaña <b>Equipo</b>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Estado real de los módulos, con métricas en vivo de la base de datos.
function Modules() {
  const [m, setM] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/modules').then((r) => r.json()).then(setM).catch(() => setM({})); }, []);

  const Badge = ({ on, txt }: { on: boolean; txt: string }) => (
    <span className="pill" style={on
      ? { color: '#7fe9c0', background: 'rgba(52,226,160,.15)', border: '1px solid #34e2a0' }
      : { color: '#c9a9ff', background: 'rgba(160,107,255,.18)', border: '1px solid #a06bff' }}>{txt}</span>
  );
  const Stat = ({ n, label }: { n: number; label: string }) => (
    <div><div style={{ fontSize: 22, fontWeight: 800 }}>{Number(n || 0).toLocaleString()}</div><div className="muted" style={{ fontSize: 12 }}>{label}</div></div>
  );

  if (!m) return <div className="muted">…</div>;

  return (
    <div className="grid g2">
      <div className="card">
        <div style={{ fontSize: 26, marginBottom: 8 }}>🛡️</div>
        <div className="row between" style={{ marginBottom: 8 }}><h3>Onyx Guardian</h3><Badge on txt="Activo" /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Gestión de riesgo por EA en MT4 y MT5: break even, trailing, plan de trading, límites y noticias.</p>
        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <Stat n={m.guardian?.accounts} label="cuentas con Guardian" />
          <Stat n={m.guardian?.eaLive} label="reportando ahora" />
          <Stat n={m.guardian?.blocks} label="bloqueos ejecutados" />
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 26, marginBottom: 8 }}>📣</div>
        <div className="row between" style={{ marginBottom: 8 }}><h3>Telegram</h3><Badge on={!!m.telegram?.active} txt={m.telegram?.active ? 'Activo' : 'Sin token'} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Alertas del Guardian, límites de fondeo, EA caído y resumen del día. Comando /estado incluido.</p>
        <div className="row" style={{ gap: 24 }}>
          <Stat n={m.telegram?.linked} label="usuarios conectados" />
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 26, marginBottom: 8 }}>📄</div>
        <div className="row between" style={{ marginBottom: 8 }}><h3>Informe semanal</h3><Badge on txt="Activo" /></div>
        <p className="muted" style={{ fontSize: 13 }}>Cada domingo, un informe del rendimiento de la semana por Telegram: resultado, aciertos, mejor par y disciplina.</p>
      </div>
    </div>
  );
}

function Equipo({ team, role, meEmail, reload }: { team: Team[]; role: string; meEmail: string; reload: () => void }) {
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [busy, setBusy] = useState(false);
  const isOwner = role === 'owner';

  async function add() { if (!email) return; setBusy(true); const r = await fetch('/api/admin/team', { method: 'POST', body: JSON.stringify({ email, role: newRole }) }); const j = await r.json(); setBusy(false); if (!r.ok) { alert(j.error || 'error'); return; } setEmail(''); reload(); }
  async function changeRole(id: string, r2: string) { const r = await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ id, role: r2 }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }
  async function remove(id: string) { if (!confirm('¿Quitar acceso de administrador a esta persona?')) return; const r = await fetch('/api/admin/team', { method: 'DELETE', body: JSON.stringify({ id }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>🛡️ Equipo</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Administradores con acceso al panel. {isOwner ? 'Como Owner, puedes añadir, cambiar rol y quitar.' : 'Solo el Owner puede gestionar el equipo.'}</p>

      <table style={{ marginBottom: 18 }}>
        <thead><tr><th>Email</th><th>Rol</th><th></th></tr></thead>
        <tbody>{team.map((m) => (
          <tr key={m.id}>
            <td>{m.email}{m.email === meEmail && <span className="muted" style={{ fontSize: 12 }}> (tú)</span>}</td>
            <td>{isOwner && m.role !== 'owner' ? (
              <select value={m.role || 'admin'} onChange={(e) => changeRole(m.id, e.target.value)} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}><option value="admin">Admin</option><option value="support">Soporte</option></select>
            ) : <span className="pill" style={{ color: roleColor(m.role) }}>{m.role || 'admin'}</span>}</td>
            <td style={{ textAlign: 'right' }}>{isOwner && m.role !== 'owner' && m.email !== meEmail && <button className="btn btn-danger" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => remove(m.id)}>Quitar</button>}</td>
          </tr>
        ))}</tbody>
      </table>

      {isOwner && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Añadir administrador (debe estar registrado en la app)</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="email@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ margin: 0, maxWidth: 260 }} />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ margin: 0, width: 'auto' }}><option value="admin">Admin</option><option value="support">Soporte</option></select>
            <button className="btn btn-primary" onClick={add} disabled={busy || !email}>{busy ? '...' : '+ Añadir'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlansTab({ plans, reload }: { plans: Plan[]; reload: () => void }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}><h3>Planes ({plans.length})</h3><button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nuevo plan</button></div>
      {creating && <PlanCard plan={{ id: '', name: '', name_en: '', desc_es: '', desc_en: '', price_month: 0, price_year: 0, stripe_price_id: '', stripe_price_id_year: '', max_accounts: 1, features: [], features_en: [], badge: '', badge_en: '', active: true, sort: plans.length, capabilities: {} } as any} isNew reload={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />}
      <div className="grid g3">{plans.map((p) => <PlanCard key={p.id} plan={p} reload={reload} />)}</div>
    </>
  );
}

function PlanCard({ plan, isNew, reload, onCancel }: { plan: Plan; isNew?: boolean; reload: () => void; onCancel?: () => void }) {
  const [p, setP] = useState<Plan>({ ...plan, features: plan.features || [], features_en: plan.features_en || [], capabilities: plan.capabilities || {} });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Plan, v: any) => setP({ ...p, [k]: v });
  const cap = (k: string) => p.capabilities?.[k] !== false && p.capabilities?.[k] !== undefined ? p.capabilities[k] : (p.capabilities?.[k] ?? false);
  const setCap = (k: string, v: any) => setP({ ...p, capabilities: { ...p.capabilities, [k]: v } });
  const norm = (f: any) => (Array.isArray(f) ? f : String(f || '').split('\n')).map((s: any) => String(s).trim()).filter(Boolean);

  async function save() {
    setSaving(true);
    const caps = { ...p.capabilities, history_days: Number(p.capabilities?.history_days) || 0 };
    const body = { ...p, features: norm(p.features), features_en: norm(p.features_en), capabilities: caps };
    const r = await fetch('/api/admin/plans', { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(body) });
    const j = await r.json(); setSaving(false);
    if (!r.ok) { alert(j.error || 'error'); return; } reload();
  }
  async function del() { if (!confirm(`¿Borrar el plan "${p.name}"?`)) return; const r = await fetch('/api/admin/plans', { method: 'DELETE', body: JSON.stringify({ id: p.id }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }

  const featES = Array.isArray(p.features) ? p.features.join('\n') : (p.features as any);
  const featEN = Array.isArray(p.features_en) ? p.features_en.join('\n') : (p.features_en as any);
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 8, display: 'block' } as any;
  const ta = { width: '100%', marginTop: 4, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' } as any;
  const flag = { fontSize: 12, fontWeight: 700, letterSpacing: '.5px', color: 'var(--brand)', margin: '14px 0 2px', display: 'block' } as any;

  return (
    <div className="card" style={p.active ? {} : { opacity: .6 }}>
      <div className="row" style={{ gap: 8 }}>
        <input placeholder="id (pro)" value={p.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} style={{ margin: 0, width: 90 }} />
        <div style={{ flex: 1 }}><span style={lbl}>$ / mes</span><input type="number" value={p.price_month} onChange={(e) => set('price_month', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
        <div style={{ flex: 1 }}><span style={lbl}>$ / año</span><input type="number" value={p.price_year} onChange={(e) => set('price_year', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
      </div>

      <span style={flag}>🇪🇸 ESPAÑOL</span>
      <input placeholder="Nombre" value={p.name} onChange={(e) => set('name', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder="Descripción corta" value={p.desc_es || ''} onChange={(e) => set('desc_es', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder="Etiqueta (ej. Más popular)" value={p.badge || ''} onChange={(e) => set('badge', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>Funciones (una por línea)</span>
      <textarea value={featES} onChange={(e) => set('features', e.target.value.split('\n') as any)} rows={4} style={ta} />

      <span style={flag}>🇬🇧 ENGLISH</span>
      <input placeholder="Name" value={p.name_en || ''} onChange={(e) => set('name_en', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder="Short description" value={p.desc_en || ''} onChange={(e) => set('desc_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder="Badge (e.g. Most popular)" value={p.badge_en || ''} onChange={(e) => set('badge_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>Features (one per line)</span>
      <textarea value={featEN} onChange={(e) => set('features_en', e.target.value.split('\n') as any)} rows={4} style={ta} />

      <span style={flag}>🎛️ CAPACIDADES (control real)</span>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '6px 0 8px' }}>
        <span style={{ fontSize: 13, flex: 1 }}>Cuentas MT</span>
        <input type="number" value={p.max_accounts} onChange={(e) => set('max_accounts', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
      </div>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '0 0 10px' }}>
        <span style={{ fontSize: 13, flex: 1 }}>Días de historial <span className="muted">(0 = ilimitado)</span></span>
        <input type="number" value={p.capabilities?.history_days ?? 0} onChange={(e) => setCap('history_days', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
      </div>
      {CAPS.map(([k, label]) => (
        <div key={k} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 13 }}>{label}</span>
          <Toggle on={!!p.capabilities?.[k]} onClick={() => setCap(k, !p.capabilities?.[k])} />
        </div>
      ))}

      <span style={flag}>💳 STRIPE</span>
      <input placeholder="Price ID mensual (price_...)" value={p.stripe_price_id || ''} onChange={(e) => set('stripe_price_id', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder="Price ID anual (price_...)" value={p.stripe_price_id_year || ''} onChange={(e) => set('stripe_price_id_year', e.target.value)} style={{ margin: '8px 0 0' }} />

      <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}><input type="checkbox" checked={p.active} onChange={(e) => set('active', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> Activo (visible en el landing y /pricing)</label>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : (isNew ? 'Crear plan' : 'Guardar')}</button>
        {isNew ? <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button> : (p.id !== 'free' && <button className="btn btn-danger" onClick={del}>Borrar</button>)}
      </div>
    </div>
  );
}
