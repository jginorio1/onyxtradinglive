'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Ambassadors from './Ambassadors';
import Retention from './Retention';
import TestConsole from './TestConsole';
import Firms from './Firms';
import SupportInbox from './SupportInbox';
import Diagnostics from './Diagnostics';
import KbEditor from './KbEditor';
import Backups from './Backups';
import { AREAS, effectivePerms } from '@/lib/perms';
import { useT } from '@/lib/adminText';

type Plan = { id: string; name: string; name_en: string; desc_es: string | null; desc_en: string | null; price_month: number; price_year: number; stripe_price_id: string | null; stripe_price_id_year: string | null; max_accounts: number; features: string[]; features_en: string[]; badge: string | null; badge_en: string | null; active: boolean; sort: number; capabilities: any };
type User = { id: string; email: string; plan: string; subscription_status: string | null; banned: boolean; is_admin: boolean; created_at: string; accounts: number; lastSync: string | null };
type Team = { id: string; email: string; role: string | null; is_admin: boolean; perms?: any; available?: boolean; last_active?: string | null };
type Tab = 'resumen' | 'usuarios' | 'planes' | 'equipo' | 'embajadores' | 'retencion' | 'pruebas' | 'firms' | 'modulos' | 'soporte' | 'kb' | 'diag' | 'backups' | 'ajustes';

const CAPS: string[] = ['journal', 'compare', 'funding', 'costs', 'export', 'reports', 'telegram', 'manager', 'manager_advanced', 'manager_news'];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <span className="toggle" onClick={onClick} style={{ background: on ? '#34e2a0' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}
const roleColor = (r?: string | null) => (r === 'owner' ? '#a9b4ff' : r === 'support' ? '#ffd45e' : '#34e2a0');

// Cabecera común de cada pestaña: icono + título + subtítulo.
function Head({ ic, t, s }: { ic: string; t: string; s: string }) {
  return <div className="tabhead"><div className="th-row"><span className="th-ic">{ic}</span><span className="th-t">{t}</span></div><div className="th-s">{s}</div></div>;
}
const initials = (email: string) => (email || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();

export default function AdminClient({ meEmail, role, perms = {}, accounts, trades }: { meEmail: string; role: string; perms?: Record<string, string>; accounts: number; trades: number }) {
  const t = useT();
  // Qué áreas puede ver este admin (owner ve todo). Mapa tab → área de permiso.
  const areaOf: Record<string, string> = { resumen: 'resumen', usuarios: 'usuarios', planes: 'planes', equipo: 'equipo', embajadores: 'embajadores', retencion: 'retencion', pruebas: 'diag', firms: 'firms', modulos: 'modulos', soporte: 'soporte', kb: 'soporte', diag: 'diag', backups: 'ajustes', ajustes: 'ajustes' };
  const canSee = (k: string) => role === 'owner' || (perms[areaOf[k]] && perms[areaOf[k]] !== 'none');
  const [available, setAvailable] = useState(false);
  async function toggleAvail() { const next = !available; setAvailable(next); await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ available: next }) }); }
  // El tab vive en la URL (#soporte) para que el refresh te deje donde estabas.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') { const h = window.location.hash.replace('#', ''); if (h) return h as Tab; }
    return 'resumen';
  });
  useEffect(() => { try { window.history.replaceState(null, '', '#' + tab); } catch {} }, [tab]);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [team, setTeam] = useState<Team[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  const [diag, setDiag] = useState<any>(null);
  const [supCounts, setSupCounts] = useState<any>(null);
  async function loadUsers() { const r = await fetch('/api/admin/users'); const j = await r.json(); setUsers(j.users || []); }
  async function loadPlans() { const r = await fetch('/api/admin/plans'); const j = await r.json(); setPlans(j.plans || []); }
  async function loadTeam() { const r = await fetch('/api/admin/team'); const j = await r.json(); setTeam(j.team || []); const mine = (j.team || []).find((t: Team) => t.email === meEmail); if (mine) setAvailable(!!mine.available); }
  useEffect(() => { loadUsers(); loadPlans(); loadTeam(); }, []);
  // Datos para el bloque "Necesita tu atención" del Resumen (silencioso si no hay permiso)
  useEffect(() => {
    fetch('/api/admin/diag').then((r) => r.ok ? r.json() : null).then((j) => j && setDiag(j)).catch(() => {});
    fetch('/api/admin/support').then((r) => r.ok ? r.json() : null).then((j) => j && setSupCounts(j.counts || {})).catch(() => {});
  }, []);

  const priceOf = useMemo(() => { const m: Record<string, number> = {}; plans.forEach((p) => (m[p.id] = p.price_month)); return m; }, [plans]);
  const paid = users.filter((u) => u.plan && u.plan !== 'free').length;
  const mrr = users.reduce((s, u) => s + (u.plan !== 'free' ? (priceOf[u.plan] || 0) : 0), 0);
  const availableCount = team.filter((m) => m.available).length;
  const bannedCount = users.filter((u) => u.banned).length;

  async function userAction(id: string, action: string, value?: any) { setBusy(id + action); const r = await fetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ id, action, value }) }); const j = await r.json(); if (!r.ok) alert(j.error || 'error'); await loadUsers(); setBusy(''); }
  async function delUser(u: User) { if (!confirm(`¿Borrar a ${u.email} y TODOS sus datos?`)) return; setBusy(u.id + 'del'); const r = await fetch('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ id: u.id }) }); const j = await r.json(); if (!r.ok) alert(j.error || 'error'); await loadUsers(); setBusy(''); }
  async function resetPass(u: User) { setBusy(u.id + 'rst'); const r = await fetch('/api/admin/reset-password', { method: 'POST', body: JSON.stringify({ email: u.email }) }); const j = await r.json(); setBusy(''); if (!r.ok) { alert(j.error || 'error'); return; } if (j.link) { navigator.clipboard.writeText(j.link); alert('Enlace de recuperación copiado:\n\n' + j.link); } else alert('Email de recuperación enviado.'); }

  const filtered = users.filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()));
  const NAV_GROUPS: { g: string; items: [Tab, string, string][] }[] = [
    { g: t.g_op, items: [['resumen', '📊', t.nav_resumen], ['usuarios', '👥', t.nav_usuarios], ['soporte', '🎫', t.nav_soporte], ['equipo', '🛡️', t.nav_equipo]] },
    { g: t.g_prod, items: [['planes', '💳', t.nav_planes], ['modulos', '🧩', t.nav_modulos], ['firms', '🏛️', t.nav_firms]] },
    { g: t.g_growth, items: [['embajadores', '🎁', t.nav_embajadores], ['retencion', '🛟', t.nav_retencion]] },
    { g: t.g_sys, items: [['kb', '🧠', t.nav_kb], ['diag', '🩺', t.nav_diag], ['backups', '🗄️', t.nav_backups], ['pruebas', '🧪', t.nav_pruebas], ['ajustes', '⚙️', t.nav_ajustes]] },
  ];
  const groups = NAV_GROUPS.map((gr) => ({ ...gr, items: gr.items.filter(([k]) => canSee(k)) })).filter((gr) => gr.items.length);
  const flatNav = groups.flatMap((gr) => gr.items);
  useEffect(() => { if (flatNav.length && !flatNav.some(([k]) => k === tab)) setTab(flatNav[0][0]); }, []);

  return (
    <>

      <div className="wrap-wide" style={{ padding: '22px 0' }}>
        <div className="adminlayout">
          <div className="adminnav card" style={{ padding: 12 }}>
            <div className="adminnav-items">
              {groups.map((gr) => (
                <div key={gr.g}>
                  <div className="adminnav-group">{gr.g}</div>
                  {gr.items.map(([k, ic, label]) => (
                    <button key={k} className={'adminnav-item' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
                      <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{ic}</span><span>{label}</span><span className="navdot" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10 }}>
              <button className={'availpill ' + (available ? 'on' : 'off')} onClick={toggleAvail}>
                <span className="avdot" />
                <span>{available ? t.avail_on : t.avail_off}</span>
                <span className="toggle" style={{ marginLeft: 'auto', background: available ? '#34e2a0' : '#556080' }}><span className="knob" style={{ left: available ? 21 : 3 }} /></span>
              </button>
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            {tab === 'resumen' && (
              <>
              <Head ic="📊" t={t.h_resumen_t} s={t.h_resumen_s} />
              <div className="grid g3" style={{ marginBottom: 12 }}>
                <div className="card kpi"><div className="lbl">{t.r_mrr}</div><div className="val pos">${mrr.toLocaleString()}</div><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{paid} {t.r_paying} · {users.length ? Math.round((paid / users.length) * 100) : 0}% {t.r_conversion}</div></div>
                <div className="card kpi"><div className="lbl">{t.r_users}</div><div className="val">{users.length}</div><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{accounts} {t.r_mtAccounts} · {trades.toLocaleString()} {t.r_trades}</div></div>
                <div className="card kpi"><div className="lbl">{t.r_team}</div><div className="val">{team.length}</div><div style={{ fontSize: 12, marginTop: 4, color: availableCount ? 'var(--green)' : 'var(--mut)' }}>● {availableCount} {availableCount === 1 ? t.r_availableNow1 : t.r_availableNow}</div></div>
              </div>

              <div className="grid g4" style={{ marginBottom: 12 }}>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_mtAccounts}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{accounts}</div></div>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_trades}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{trades.toLocaleString()}</div></div>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_paying}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: 'var(--green)' }}>{paid}</div></div>
                <div className="tile"><div className="muted" style={{ fontSize: 12 }}>{t.r_banned}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: bannedCount ? 'var(--red)' : 'var(--tx)' }}>{bannedCount}</div></div>
              </div>

              {(() => {
                const missing = (diag?.migrations || []).filter((m: any) => !m.ok);
                const svc = (diag?.services || []).filter((s: any) => !s.ok);
                const openT = supCounts?.open ?? null;
                const items: { txt: string; go?: Tab; cta?: string }[] = [];
                if (missing.length) items.push({ txt: `${missing.length} ${t.r_sqlMissing}`, go: 'diag', cta: t.r_seeDiag });
                if (openT) items.push({ txt: `${openT} ${t.r_ticketsOpen}`, go: 'soporte', cta: t.r_openQueue });
                if (svc.length) items.push({ txt: `${svc.length} ${t.r_svcConfig} (${svc.map((s: any) => s.name).slice(0, 3).join(', ')})`, go: 'diag', cta: t.r_review });
                if (bannedCount) items.push({ txt: `${bannedCount} ${t.r_bannedUsers}`, go: 'usuarios', cta: t.r_seeUsers });
                if (!diag && !supCounts) return null;
                if (!items.length) return (
                  <div className="card" style={{ border: '1px solid rgba(52,226,160,.4)', background: 'rgba(52,226,160,.06)' }}>
                    <b style={{ color: 'var(--green)' }}>✓ {t.r_allGood}</b>
                    <span className="muted" style={{ fontSize: 13 }}>{t.r_noPending}</span>
                  </div>
                );
                return (
                  <div className="card" style={{ border: '1px solid var(--amber)', background: 'rgba(255,192,77,.06)' }}>
                    <div className="row between" style={{ marginBottom: 8 }}>
                      <b style={{ color: 'var(--amber)' }}>{t.r_needs}</b>
                      <span className="pill amber">{items.length}</span>
                    </div>
                    {items.map((it, i) => (
                      <div key={i} className="row between" style={{ padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5 }}>{it.txt}</span>
                        {it.go && <button className="btn btn-ghost" style={{ padding: '4px 11px', fontSize: 12 }} onClick={() => setTab(it.go!)}>{it.cta} →</button>}
                      </div>
                    ))}
                  </div>
                );
              })()}
              </>
            )}

            {tab === 'usuarios' && (
              <>
              <Head ic="👥" t={t.h_usuarios_t} s={`${filtered.length} ${t.h_usuarios_registered}`} />
              <div className="card">
                <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <input placeholder={t.u_search} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, margin: 0, marginLeft: 'auto' }} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th>Email</th><th>Plan</th><th>Estado</th><th>Cuentas</th><th>Últ. sync</th><th style={{ minWidth: 260 }}>Acciones</th></tr></thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.id}>
                          <td><div className="row" style={{ gap: 9 }}><span className="avatar-init" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(u.email)}</span><span>{u.email}{u.is_admin && <span className="pill brand" style={{ marginLeft: 6 }}>{t.u_admin}</span>}</span></div></td>
                          <td><select value={u.plan} onChange={(e) => userAction(u.id, 'plan', e.target.value)} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{!plans.find((p) => p.id === u.plan) && <option value={u.plan}>{u.plan}</option>}</select></td>
                          <td>{u.banned ? <span className="pill red">● {t.u_banned}</span> : <span className="pill" style={{ color: 'var(--green)', background: 'rgba(52,226,160,.15)' }}>● {u.subscription_status || t.u_active}</span>}</td>
                          <td className="muted">{u.accounts}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{u.lastSync ? new Date(u.lastSync).toLocaleDateString() : '—'}</td>
                          <td><div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => resetPass(u)} disabled={busy === u.id + 'rst'}>🔑</button>
                            {u.banned ? <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'unban')}>{t.u_unban}</button> : <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'ban')}>🚫</button>}
                            <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => userAction(u.id, 'admin', !u.is_admin)}>{u.is_admin ? t.u_removeAdmin : t.u_makeAdmin}</button>
                            {u.email !== meEmail && <button className="btn btn-danger" style={{ padding: '5px 9px', fontSize: 12 }} onClick={() => delUser(u)} disabled={busy === u.id + 'del'}>🗑</button>}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}

            {tab === 'planes' && <PlansTab plans={plans} reload={loadPlans} />}
            {tab === 'equipo' && <Equipo team={team} role={role} meEmail={meEmail} reload={loadTeam} canManage={role === 'owner' || perms.equipo === 'manage'} />}
            {tab === 'embajadores' && <Ambassadors />}
            {tab === 'retencion' && <Retention />}
            {tab === 'pruebas' && <TestConsole meEmail={meEmail} />}
            {tab === 'firms' && <Firms />}

            {tab === 'modulos' && <Modules />}

            {tab === 'soporte' && <SupportInbox />}

            {tab === 'kb' && <KbEditor />}

            {tab === 'diag' && <Diagnostics />}

            {tab === 'backups' && <Backups />}

            {tab === 'ajustes' && (
              <div style={{ maxWidth: 640 }}>
                <Head ic="⚙️" t={t.h_ajustes_t} s={t.h_ajustes_s} />
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <span>{t.a_yourRole}</span>
                    <span className="pill" style={{ color: roleColor(role), background: 'rgba(124,140,255,.12)' }}>{(t as any)['role_' + role] || role}</span>
                  </div>
                </div>
                <div className="card">
                  <h3 style={{ marginBottom: 6 }}>{t.a_rolesTitle}</h3>
                  <p className="muted" style={{ fontSize: 13.5, marginBottom: 8 }}>{t.a_rolesBody}</p>
                  <p className="muted" style={{ fontSize: 13 }}>{t.a_rolesEnv}</p>
                </div>
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
  const t = useT();
  const [m, setM] = useState<any>(null);
  // Auto-refresco en vivo: los contadores suben solos sin pulsar Refrescar.
  useEffect(() => {
    const load = () => fetch('/api/admin/modules').then((r) => r.json()).then(setM).catch(() => setM((v: any) => v || {}));
    load(); const iv = setInterval(load, 20000); return () => clearInterval(iv);
  }, []);
  const LiveBadge = () => <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7fe9c0', background: 'rgba(52,226,160,.15)' }}><span className="livedot" />{t.mo_liveBadge}</span>;

  const StatusPill = ({ on, txt }: { on: boolean; txt: string }) => (
    <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...(on ? { color: '#7fe9c0', background: 'rgba(52,226,160,.15)' } : { color: '#c9a9ff', background: 'rgba(160,107,255,.18)' }) }}>
      {on ? <span className="livedot" /> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c9a9ff' }} />}{txt}
    </span>
  );
  const Tile = ({ label, value, live, color }: { label: string; value: any; live?: boolean; color?: string }) => (
    <div className="tile" style={live ? { boxShadow: 'inset 0 0 0 1px rgba(52,226,160,.35)' } : undefined}>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div className="row" style={{ gap: 7, marginTop: 3 }}>
        <span style={{ fontSize: typeof value === 'number' ? 24 : 15, fontWeight: 800, lineHeight: 1, color: color || 'var(--tx)' }}>{typeof value === 'number' ? Number(value).toLocaleString() : value}</span>
        {live && <span className="livedot" />}
      </div>
    </div>
  );
  const Ic = ({ e }: { e: string }) => <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124,140,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{e}</span>;

  if (!m) return <div className="muted">…</div>;
  const tiles = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(92px,1fr))', gap: 10 } as any;
  const gLive = (m.guardian?.liveNow ?? 0) > 0;
  const tgLive = (m.telegram?.linked ?? 0) > 0;

  return (
    <>
    <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
      <Head ic="🧩" t={t.h_modulos_t} s={t.h_modulos_s} />
      <LiveBadge />
    </div>
    <div className="grid g2">
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><div className="row" style={{ gap: 10 }}><Ic e="🛡️" /><h3>Onyx Guardian</h3></div><StatusPill on txt={t.mo_active} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.mo_guardian_desc}</p>
        <div style={tiles}>
          <Tile label={t.mo_connected} value={m.guardian?.connected ?? 0} />
          <Tile label={t.mo_liveNow} value={m.guardian?.liveNow ?? 0} live={gLive} color={gLive ? 'var(--green)' : undefined} />
          <Tile label={t.mo_withGuardian} value={m.guardian?.accounts ?? 0} color="#c3ccff" />
          <Tile label={t.mo_blocks} value={m.guardian?.blocks ?? 0} />
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><div className="row" style={{ gap: 10 }}><Ic e="📣" /><h3>Telegram</h3></div><StatusPill on={!!m.telegram?.active} txt={m.telegram?.active ? t.mo_active : t.mo_notoken} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.mo_tg_desc}</p>
        <div style={tiles}>
          <Tile label={t.mo_tg_connected} value={m.telegram?.linked ?? 0} live={tgLive} color={tgLive ? 'var(--green)' : undefined} />
          <Tile label={t.mo_tg_sent7d} value={m.telegram?.sent7d ?? 0} />
          <Tile label={t.mo_tg_status} value={m.telegram?.status ?? 0} />
          <Tile label={t.mo_tg_failed} value={m.telegram?.failed7d ?? 0} color={(m.telegram?.failed7d ?? 0) > 0 ? 'var(--amber)' : undefined} />
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><div className="row" style={{ gap: 10 }}><Ic e="📄" /><h3>{t.mo_weekly_t}</h3></div><StatusPill on txt={t.mo_active} /></div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t.mo_weekly_desc}</p>
        <div style={tiles}>
          <Tile label={t.mo_rep_sent} value={m.reports?.sent ?? 0} />
          <Tile label={t.mo_rep_eligible} value={m.reports?.eligible ?? 0} color="#c3ccff" />
          <Tile label={t.mo_rep_next} value={nextSunday()} />
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, gridColumn: '1 / -1' }}>{t.mo_needLog}</div>
    </div>
    </>
  );
}

// Agrupa las acciones del registro por tema, para filtrarlo con botones.
const LOG_TOPICS: [string, string, string][] = [['all', 'Todos', '🗂️'], ['equipo', 'Equipo', '🛡️'], ['soporte', 'Soporte', '🎫'], ['baseia', 'Base IA', '🧠'], ['usuarios', 'Usuarios', '👥'], ['planes', 'Planes', '💳']];
function topicOf(action: string): string {
  const a = String(action || '').toLowerCase();
  if (a.startsWith('team')) return 'equipo';
  if (a.startsWith('support') || a.startsWith('ticket')) return 'soporte';
  if (a.startsWith('kb')) return 'baseia';
  if (a.includes('plan')) return 'planes';
  if (['ban', 'admin', 'reset', 'user', 'delete'].some((x) => a.includes(x))) return 'usuarios';
  return 'otros';
}
const topicIcon: any = { equipo: '🛡️', soporte: '🎫', baseia: '🧠', usuarios: '👥', planes: '💳', otros: '•' };

// Fecha del próximo domingo (el informe semanal sale los domingos a las 06:00).
function nextSunday(): string {
  const d = new Date();
  const add = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) + ' · 06:00';
}

function Equipo({ team, role, meEmail, reload, canManage }: { team: Team[]; role: string; meEmail: string; reload: () => void; canManage: boolean }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('support');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState('');
  const [log, setLog] = useState<any[]>([]);
  const [logMember, setLogMember] = useState('');
  const [logTopic, setLogTopic] = useState('all');

  async function add() { if (!email) return; setBusy(true); const r = await fetch('/api/admin/team', { method: 'POST', body: JSON.stringify({ email, role: newRole }) }); const j = await r.json(); setBusy(false); if (!r.ok) { alert(j.error || 'error'); return; } setEmail(''); reload(); }
  async function changeRole(id: string, r2: string) { const r = await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ id, role: r2 }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }
  async function savePerm(id: string, area: string, level: string, current: any) { const perms = { ...(current || {}), [area]: level }; const r = await fetch('/api/admin/team', { method: 'PATCH', body: JSON.stringify({ id, perms }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }
  async function remove(id: string) { if (!confirm('¿Quitar acceso de administrador a esta persona?')) return; const r = await fetch('/api/admin/team', { method: 'DELETE', body: JSON.stringify({ id }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }
  async function loadLog(member = '') { setLogMember(member); const r = await fetch('/api/admin/activity' + (member ? '?member=' + encodeURIComponent(member) : '')); const j = await r.json(); setLog(j.log || []); }
  useEffect(() => { loadLog(); }, []);

  return (
    <>
      <Head ic="🛡️" t={t.h_equipo_t} s={canManage ? t.h_equipo_s : t.h_equipo_s_ro} />
      <div className="card" style={{ marginBottom: 14 }}>
        {team.map((m, i) => (
          <div key={m.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '13px 0' }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 11, alignItems: 'center' }}>
                <span style={{ position: 'relative' }}>
                  <span className="avatar-init">{initials(m.email)}</span>
                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--card)', background: m.available ? '#34e2a0' : 'var(--line)' }} title={m.available ? 'Disponible' : 'Ausente'} />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{m.email}{m.email === meEmail && <span className="muted" style={{ fontSize: 12 }}>{t.t_you}</span>}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{m.last_active ? t.t_lastActivity + new Date(m.last_active).toLocaleString() : t.t_noActivity}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {canManage && m.role !== 'owner' ? (
                  <select value={m.role || 'support'} onChange={(e) => changeRole(m.id, e.target.value)} style={{ margin: 0, padding: '5px 8px', width: 'auto' }}>
                    <option value="admin">{t.role_admin}</option><option value="support">{t.role_support}</option><option value="marketing">{t.role_marketing}</option><option value="custom">{t.role_custom}</option>
                  </select>
                ) : <span className="pill" style={{ color: roleColor(m.role), background: 'rgba(124,140,255,.12)' }}>{(t as any)['role_' + (m.role || 'admin')]}</span>}
                {canManage && m.role !== 'owner' && <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setEditId(editId === m.id ? '' : m.id)}>{editId === m.id ? t.t_close : t.t_perms}</button>}
                {canManage && m.role !== 'owner' && m.email !== meEmail && <button className="btn btn-danger" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => remove(m.id)}>{t.t_remove}</button>}
              </div>
            </div>

            {editId === m.id && canManage && (
              <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t.t_permsByArea} <span style={{ opacity: .7 }}>{t.t_permsHint}</span></div>
                {AREAS.map((a) => {
                  const eff = effectivePerms(m.role || 'support', m.perms || {});
                  const cur = (eff[a.id] as string) || 'none';
                  const dcol = cur === 'manage' ? '#34e2a0' : cur === 'view' ? '#7c8cff' : 'var(--line)';
                  return (
                    <div key={a.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dcol, flex: 'none' }} />
                      <span style={{ fontSize: 13, flex: 1, minWidth: 120 }}>{(t as any)['nav_' + a.id] || a.label}</span>
                      <div className="seg">
                        {(['none', 'view', 'manage'] as const).map((lv) => (
                          <button key={lv} className={'segbtn' + (cur === lv ? ' on-' + lv : '')} onClick={() => savePerm(m.id, a.id, lv, m.perms)}>{(t as any)['lvl_' + lv]}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {canManage && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 6 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t.t_invite}</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input placeholder={t.t_invitePh} value={email} onChange={(e) => setEmail(e.target.value)} style={{ margin: 0, maxWidth: 240 }} />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ margin: 0, width: 'auto' }}>
                <option value="admin">{t.role_admin}</option><option value="support">{t.role_support}</option><option value="marketing">{t.role_marketing}</option><option value="custom">{t.role_custom}</option>
              </select>
              <button className="btn btn-primary" onClick={add} disabled={busy || !email}>{busy ? '...' : t.t_inviteBtn}</button>
            </div>
          </div>
        )}
      </div>

      {/* Registro de actividad: filtro por tema y por miembro */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>🕘 {t.t_activity}</h3>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {LOG_TOPICS.map(([k, label, ic]) => {
            const n = k === 'all' ? log.length : log.filter((e) => topicOf(e.action) === k).length;
            if (k !== 'all' && !n) return null;
            return <button key={k} className={'segbtn' + (logTopic === k ? ' on-view' : '')} style={{ background: logTopic === k ? undefined : 'var(--card2)', padding: '5px 11px', fontSize: 12 }} onClick={() => setLogTopic(k)}>{ic} {(t as any)['lt_' + k] || label}{k !== 'all' ? ` ${n}` : ''}</button>;
          })}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>{t.t_member}</span>
          <button className={'segbtn' + (!logMember ? ' on-view' : '')} style={{ background: !logMember ? undefined : 'var(--card2)', padding: '4px 10px', fontSize: 12 }} onClick={() => loadLog('')}>{t.t_all}</button>
          {team.map((m) => <button key={m.id} className={'segbtn' + (logMember === m.email ? ' on-view' : '')} style={{ background: logMember === m.email ? undefined : 'var(--card2)', padding: '4px 10px', fontSize: 12 }} onClick={() => loadLog(m.email)}>{m.email.split('@')[0]}</button>)}
        </div>
        {(() => {
          const shown = log.filter((e) => logTopic === 'all' || topicOf(e.action) === logTopic);
          if (!shown.length) return <p className="muted" style={{ fontSize: 14 }}>{t.t_noActivityTopic}</p>;
          return shown.map((e, i) => {
            const tp = topicOf(e.action);
            return (
              <div key={i} className="row between" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '8px 0', fontSize: 13, flexWrap: 'wrap', gap: 6 }}>
                <span className="row" style={{ gap: 8 }}><span style={{ width: 18, textAlign: 'center' }}>{topicIcon[tp]}</span><span><b>{e.admin_email?.split('@')[0]}</b> · {e.action} <span className="muted">{e.target ? String(e.target).slice(0, 24) : ''}</span></span></span>
                <span className="muted" style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleString()}</span>
              </div>
            );
          });
        })()}
      </div>
    </>
  );
}

function PlansTab({ plans, reload }: { plans: Plan[]; reload: () => void }) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Head ic="💳" t={t.h_planes_t} s={t.h_planes_s} />
        <button className="btn btn-primary" onClick={() => setCreating(true)}>{t.pl_new}</button>
      </div>
      {creating && <PlanCard plan={{ id: '', name: '', name_en: '', desc_es: '', desc_en: '', price_month: 0, price_year: 0, stripe_price_id: '', stripe_price_id_year: '', max_accounts: 1, features: [], features_en: [], badge: '', badge_en: '', active: true, sort: plans.length, capabilities: {} } as any} isNew reload={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />}
      <div className="grid g3">{plans.map((p) => <PlanCard key={p.id} plan={p} reload={reload} />)}</div>
    </>
  );
}

function PlanCard({ plan, isNew, reload, onCancel }: { plan: Plan; isNew?: boolean; reload: () => void; onCancel?: () => void }) {
  const t = useT();
  const [p, setP] = useState<Plan>({ ...plan, features: plan.features || [], features_en: plan.features_en || [], capabilities: plan.capabilities || {} });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Plan, v: any) => setP({ ...p, [k]: v });
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
  async function del() { if (!confirm(`${t.pl_confirmDel} "${p.name}"?`)) return; const r = await fetch('/api/admin/plans', { method: 'DELETE', body: JSON.stringify({ id: p.id }) }); const j = await r.json(); if (!r.ok) { alert(j.error || 'error'); return; } reload(); }

  const featES = Array.isArray(p.features) ? p.features.join('\n') : (p.features as any);
  const featEN = Array.isArray(p.features_en) ? p.features_en.join('\n') : (p.features_en as any);
  const lbl = { fontSize: 12, color: 'var(--mut)', marginTop: 8, display: 'block' } as any;
  const ta = { width: '100%', marginTop: 4, padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)', fontSize: 14, fontFamily: 'inherit' } as any;
  const flag = { fontSize: 12, fontWeight: 700, letterSpacing: '.5px', color: 'var(--brand)', margin: '14px 0 2px', display: 'block' } as any;

  const popular = !!(p.badge && p.badge.trim());
  return (
    <div className="card" style={{ ...(p.active ? {} : { opacity: .6 }), ...(popular ? { border: '2px solid var(--brand)' } : {}), position: 'relative' }}>
      {popular && <span className="pill brand" style={{ position: 'absolute', top: -11, left: 16 }}>★ {p.badge}</span>}
      <div className="row" style={{ gap: 8 }}>
        <input placeholder={t.pl_id} value={p.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} style={{ margin: 0, width: 90 }} />
        <div style={{ flex: 1 }}><span style={lbl}>{t.pl_month}</span><input type="number" value={p.price_month} onChange={(e) => set('price_month', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
        <div style={{ flex: 1 }}><span style={lbl}>{t.pl_year}</span><input type="number" value={p.price_year} onChange={(e) => set('price_year', e.target.value)} style={{ margin: '4px 0 0' }} /></div>
      </div>

      <span style={flag}>{t.pl_es}</span>
      <input placeholder={t.pl_name} value={p.name} onChange={(e) => set('name', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder={t.pl_desc} value={p.desc_es || ''} onChange={(e) => set('desc_es', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder={t.pl_badge} value={p.badge || ''} onChange={(e) => set('badge', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>{t.pl_features}</span>
      <textarea value={featES} onChange={(e) => set('features', e.target.value.split('\n') as any)} rows={4} style={ta} />

      <span style={flag}>{t.pl_en}</span>
      <input placeholder={t.pl_nameEn} value={p.name_en || ''} onChange={(e) => set('name_en', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder={t.pl_descEn} value={p.desc_en || ''} onChange={(e) => set('desc_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <input placeholder={t.pl_badgeEn} value={p.badge_en || ''} onChange={(e) => set('badge_en', e.target.value)} style={{ margin: '8px 0 0' }} />
      <span style={lbl}>{t.pl_featuresEn}</span>
      <textarea value={featEN} onChange={(e) => set('features_en', e.target.value.split('\n') as any)} rows={4} style={ta} />

      <span style={flag}>{t.pl_caps}</span>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '6px 0 8px' }}>
        <span style={{ fontSize: 13, flex: 1 }}>{t.pl_mtAccounts}</span>
        <input type="number" value={p.max_accounts} onChange={(e) => set('max_accounts', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
      </div>
      <div className="row" style={{ gap: 10, alignItems: 'center', margin: '0 0 10px' }}>
        <span style={{ fontSize: 13, flex: 1 }}>{t.pl_historyDays} <span className="muted">{t.pl_unlimited}</span></span>
        <input type="number" value={p.capabilities?.history_days ?? 0} onChange={(e) => setCap('history_days', Number(e.target.value) || 0)} style={{ margin: 0, width: 80, padding: '6px 8px' }} />
      </div>
      {CAPS.map((k) => (
        <div key={k} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 13 }}>{(t as any)['cap_' + k]}</span>
          <Toggle on={!!p.capabilities?.[k]} onClick={() => setCap(k, !p.capabilities?.[k])} />
        </div>
      ))}

      <span style={flag}>{t.pl_stripe}</span>
      <input placeholder={t.pl_priceIdM} value={p.stripe_price_id || ''} onChange={(e) => set('stripe_price_id', e.target.value)} style={{ margin: '4px 0 0' }} />
      <input placeholder={t.pl_priceIdY} value={p.stripe_price_id_year || ''} onChange={(e) => set('stripe_price_id_year', e.target.value)} style={{ margin: '8px 0 0' }} />

      <label className="row" style={{ gap: 8, marginTop: 12, cursor: 'pointer' }}><input type="checkbox" checked={p.active} onChange={(e) => set('active', e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {t.pl_activeChk}</label>
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : (isNew ? t.pl_create : t.pl_save)}</button>
        {isNew ? <button className="btn btn-ghost" onClick={onCancel}>{t.pl_cancel}</button> : (p.id !== 'free' && <button className="btn btn-danger" onClick={del}>{t.pl_delete}</button>)}
      </div>
    </div>
  );
}
