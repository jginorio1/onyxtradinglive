'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; stripe_price_id: string | null; stripe_price_id_year: string | null; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null; active: boolean; sort: number };
type User = { id: string; email: string; plan: string; subscription_status: string | null; banned: boolean; is_admin: boolean; created_at: string; accounts: number; lastSync: string | null };

export default function AdminClient({ meEmail, accounts, trades }: { meEmail: string; accounts: number; trades: number }) {
  const [tab, setTab] = useState<'resumen' | 'usuarios' | 'planes'>('resumen');
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  async function loadUsers() { const r = await fetch('/api/admin/users'); const j = await r.json(); setUsers(j.users || []); }
  async function loadPlans() { const r = await fetch('/api/admin/plans'); const j = await r.json(); setPlans(j.plans || []); }
  useEffect(() => { loadUsers(); loadPlans(); }, []);

  const priceOf = useMemo(() => { const m: Record<string, number> = {}; plans.forEach((p) => (m[p.id] = p.price_month)); return m; }, [plans]);
  const paid = users.filter((u) => u.plan && u.plan !== 'free').length;
  const mrr = users.reduce((s, u) => s + (u.plan !== 'free' ? (priceOf[u.plan] || 0) : 0), 0);

  async function userAction(id: string, action: string, value?: any) {
    setBusy(id + action);
    const r = await fetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ id, action, value }) });
    const j = await r.json();
    if (!r.ok) alert(j.error || 'error');
    await loadUsers(); setBusy('');
  }
  async function delUser(u: User) {
    if (!confirm(`¿Borrar a ${u.email} y TODOS sus datos? Esto no se puede deshacer.`)) return;
    setBusy(u.id + 'del');
    const r = await fetch('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ id: u.id }) });
    const j = await r.json();
    if (!r.ok) alert(j.error || 'error');
    await loadUsers(); setBusy('');
  }
  async function resetPass(u: User) {
    setBusy(u.id + 'rst');
    const r = await fetch('/api/admin/reset-password', { method: 'POST', body: JSON.stringify({ email: u.email }) });
    const j = await r.json();
    setBusy('');
    if (!r.ok) { alert(j.error || 'error'); return; }
    if (j.link) { navigator.clipboard.writeText(j.link); alert('Enlace de recuperación copiado al portapapeles. Envíaselo al usuario:\n\n' + j.link); }
    else alert('Email de recuperación enviado.');
  }

  const filtered = users.filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="topbar"><div className="wrap-wide">
        <Link className="logo" href="/dashboard"><span className="mark">◆</span> Onyx · Súper-Admin</Link>
        <div className="row"><span className="muted" style={{ fontSize: 13 }}>{meEmail}</span><Link className="btn btn-ghost" href="/dashboard">Mi cuenta</Link></div>
      </div></div>

      <div className="wrap-wide" style={{ padding: '24px 0' }}>
        <div className="row" style={{ gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          {([['resumen', '📊 Resumen'], ['usuarios', '👥 Usuarios'], ['planes', '💳 Planes']] as const).map(([k, label]) => (
            <button key={k} className={'btn ' + (tab === k ? 'btn-primary' : 'btn-ghost')} onClick={() => setTab(k as any)}>{label}</button>
          ))}
        </div>

        {tab === 'resumen' && (
          <div className="grid g4">
            <div className="card kpi"><div className="lbl">Usuarios</div><div className="val">{users.length}</div></div>
            <div className="card kpi"><div className="lbl">De pago</div><div className="val pos">{paid}</div></div>
            <div className="card kpi"><div className="lbl">MRR estimado</div><div className="val pos">${mrr.toLocaleString()}</div></div>
            <div className="card kpi"><div className="lbl">Conversión</div><div className="val">{users.length ? Math.round((paid / users.length) * 100) : 0}%</div></div>
            <div className="card kpi"><div className="lbl">Cuentas MT</div><div className="val">{accounts}</div></div>
            <div className="card kpi"><div className="lbl">Operaciones</div><div className="val">{trades.toLocaleString()}</div></div>
            <div className="card kpi"><div className="lbl">Baneados</div><div className="val neg">{users.filter((u) => u.banned).length}</div></div>
            <div className="card kpi"><div className="lbl">Admins</div><div className="val">{users.filter((u) => u.is_admin).length}</div></div>
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
                      <td>
                        <select value={u.plan} onChange={(e) => userAction(u.id, 'plan', e.target.value)} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}>
                          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          {!plans.find((p) => p.id === u.plan) && <option value={u.plan}>{u.plan}</option>}
                        </select>
                      </td>
                      <td>{u.banned ? <span className="pill" style={{ color: 'var(--red)', background: 'rgba(255,107,125,.15)' }}>baneado</span> : <span className="muted">{u.subscription_status || 'activo'}</span>}</td>
                      <td className="muted">{u.accounts}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{u.lastSync ? new Date(u.lastSync).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => resetPass(u)} disabled={busy === u.id + 'rst'}>🔑 Contraseña</button>
                          {u.banned
                            ? <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'unban')}>Desbanear</button>
                            : <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'ban')}>🚫 Banear</button>}
                          <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'admin', !u.is_admin)}>{u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
                          {u.email !== meEmail && <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => delUser(u)} disabled={busy === u.id + 'del'}>🗑</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'planes' && <PlansTab plans={plans} reload={loadPlans} />}
      </div>
    </>
  );
}

function PlansTab({ plans, reload }: { plans: Plan[]; reload: () => void }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <h3>Planes ({plans.length})</h3>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nuevo plan</button>
      </div>
      {creating && <PlanCard plan={{ id: '', name: '', name_en: '', desc_es: '', desc_en: '', price_month: 0, price_year: 0, stripe_price_id: '', stripe_price_id_year: '', max_accounts: 1, features: [], features_en: [], badge: '', badge_en: '', active: true, sort: plans.length } as any} isNew reload={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />}
      <div className="grid g3">
        {plans.map((p) => <PlanCard key={p.id} plan={p} reload={reload} />)}
      </div>
    </>
  );
}

function PlanCard({ plan, isNew, reload, onCancel }: { plan: Plan; isNew?: boolean; reload: () => void; onCancel?: () => void }) {
  const [p, setP] = useState<Plan>({ ...plan, features: plan.features || [] });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Plan, v: any) => setP({ ...p, [k]: v });

  const norm = (f: any) => (Array.isArray(f) ? f : String(f || '').split('\n')).map((s) => String(s).trim()).filter(Boolean);
  async function save() {
    setSaving(true);
    const body = { ...p, features: norm(p.features), features_en: norm(p.features_en) };
    const r = await fetch('/api/admin/plans', { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(body) });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) { alert(j.error || 'error'); return; }
    reload();
  }
  async function del() {
    if (!confirm(`¿Borrar el plan "${p.name}"?`)) return;
    const r = await fetch('/api/admin/plans', { method: 'DELETE', body: JSON.stringify({ id: p.id }) });
    const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload();
  }

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
        <div style={{ width: 76 }}><span style={lbl}>Cuentas</span><input type="number" value={p.max_accounts} onChange={(e) => set('max_accounts', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
      </div>

      <span style={flag}>🇪🇸 ESPAÑOL</span>
      <input placeholder="Nombre" value={p.name} onChange={(e) => set('name', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder="Descripción corta" value={p.desc_es || ''} onChange={(e) => set('desc_es', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder="Etiqueta (ej. Más popular)" value={p.badge || ''} onChange={(e) => set('badge', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>Funciones (una por línea)</span>
      <textarea value={featES} onChange={(e) => set('features', e.target.value.split('\n') as any)} rows={5} style={ta} />

      <span style={flag}>🇬🇧 ENGLISH</span>
      <input placeholder="Name" value={p.name_en || ''} onChange={(e) => set('name_en', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder="Short description" value={p.desc_en || ''} onChange={(e) => set('desc_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder="Badge (e.g. Most popular)" value={p.badge_en || ''} onChange={(e) => set('badge_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>Features (one per line)</span>
      <textarea value={featEN} onChange={(e) => set('features_en', e.target.value.split('\n') as any)} rows={5} style={ta} />

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
