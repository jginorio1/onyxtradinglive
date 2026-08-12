'use client';
import { dictFor } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

type Lang = 'es' | 'en';

const HAB: Record<string, [string, string]> = {
  reviewed_calendar: ['Revisé el calendario económico', 'Reviewed the economic calendar'],
  defined_risk: ['Definí mi riesgo antes de entrar', 'Defined my risk before entering'],
  followed_plan: ['Seguí mi plan de entrada', 'Followed my entry plan'],
  journaled: ['Registré mis operaciones', 'Journaled my trades'],
  stopped_at_limit: ['Cerré al llegar a mi límite', 'Closed at my limit'],
  no_revenge: ['No operé por venganza', 'No revenge trading'],
  respected_sessions: ['Operé solo en mis sesiones', 'Traded only in my sessions'],
};
// Momento por defecto de cada hábito; el trader puede cambiarlo en "Mi plan".
const MOMENT_DEF: Record<string, 'before' | 'during' | 'close'> = {
  reviewed_calendar: 'before', defined_risk: 'before', followed_plan: 'before',
  journaled: 'during', stopped_at_limit: 'during', no_revenge: 'during', respected_sessions: 'during',
};

const T: any = {
  es: {
    title: 'Tu check-in de hoy', sub: 'Márcalo cuando lo hagas — puedes volver durante el día. Así cuidas tu racha.',
    adherence: 'Adherencia', streak: 'Racha', ddl: 'Tu tope de pérdida hoy',
    before: 'Antes de operar', during: 'Durante y después', close: 'Al cerrar el día', auto: 'auto',
    saved: 'Guardado', later: 'Ahora no', done: 'Listo por hoy', allDone: '¡Completo por hoy! 💪',
    seePlan: 'Ver mi plan completo', reminder: 'Recuerda tu regla de oro:', autoHint: 'Onyx premarcó lo que ya detectó. Ajusta lo que quieras.',
  },
  en: {
    title: 'Your check-in today', sub: 'Tick each as you do it — you can come back during the day. That keeps your streak alive.',
    adherence: 'Adherence', streak: 'Streak', ddl: 'Your loss limit today',
    before: 'Before trading', during: 'During and after', close: 'At end of day', auto: 'auto',
    saved: 'Saved', later: 'Not now', done: 'Done for today', allDone: 'All done today! 💪',
    seePlan: 'See my full plan', reminder: 'Remember your golden rule:', autoHint: 'Onyx pre-ticked what it detected. Adjust anything you want.',
  },
};

function todayLocal() { return new Date().toLocaleDateString('en-CA'); }

export default function DailyCheckinPopup({ lang, onState }: { lang: Lang; onState?: (s: { pending: boolean; open: () => void; done?: number; total?: number }) => void }) {
  const t = dictFor(T, lang); const i = lang === 'en' ? 1 : 0;
  const [d, setD] = useState<any>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'hidden' | 'popup' | 'bar'>('hidden');
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/plan'); const j = await r.json();
        if (!j || !j.hasPlan || !j.plan) return; // solo a quien usa el plan
        const it: Record<string, boolean> = { ...(j.checkin?.items || {}) };
        // Auto-marcado: premarca lo detectado que aún no estaba puesto.
        const auto = j.auto || {};
        for (const k of Object.keys(auto)) if (auto[k] && it[k] === undefined) it[k] = true;
        setD(j); setItems(it); setNote(j.checkin?.note || '');
        // Primera vez del día → popup; si ya lo cerró hoy → solo la píldora.
        setPhase(localStorage.getItem('onyx_checkin_skip') === todayLocal() ? 'bar' : 'popup');
      } catch { /* silencioso */ }
    })();
  }, []);

  // Momento de un hábito: lo elegido en el plan, o el defecto (propios → durante).
  const momentOf = (id: string): 'before' | 'during' | 'close' => {
    const m = d?.plan?.habit_moments?.[id];
    return m === 'before' || m === 'during' || m === 'close' ? m : (MOMENT_DEF[id] || 'during');
  };
  // Lista de hábitos activos del trader, con su momento.
  const allHabits: { id: string; label: string; moment: 'before' | 'during' | 'close'; auto: boolean }[] = d?.plan ? [
    ...((d.plan.habits || []) as string[]).map((k) => ({ id: k, label: HAB[k]?.[i] || k, moment: momentOf(k), auto: !!d.auto?.[k] })),
    ...((d.plan.custom_habits || []) as any[]).map((h) => ({ id: h.id, label: h.label, moment: momentOf(h.id), auto: false })),
  ] : [];
  const total = allHabits.length;
  const done = allHabits.filter((h) => items[h.id]).length;
  const allDone = total > 0 && done === total;

  // Avisamos al dashboard: pendiente mientras falte algo; con progreso X/Y.
  useEffect(() => {
    onState?.({ pending: !!d?.plan && !allDone, open: () => setPhase('popup'), done, total });
  }, [d, done, total, allDone]);

  // Guarda (con pequeño debounce) sin cerrar el popup.
  function persist(next: Record<string, boolean>, nt: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await fetch('/api/plan', { method: 'POST', body: JSON.stringify({ items: next, note: nt }) }); setSaved(true); setTimeout(() => setSaved(false), 1300); } catch {}
    }, 350);
  }
  function toggle(id: string) {
    const next = { ...items, [id]: !items[id] };
    setItems(next); persist(next, note);
  }
  function closeForNow(markDone: boolean) {
    if (markDone) { try { localStorage.setItem('onyx_checkin_skip', todayLocal()); } catch {} }
    else { try { localStorage.setItem('onyx_checkin_skip', todayLocal()); } catch {} }
    setPhase('bar');
  }

  if (phase !== 'popup' || !d || !d.plan) return null;
  const p = d.plan; const s = d.stats || {}; const g = d.guardian || {};
  const adColor = s.adherence >= 75 ? 'var(--green)' : s.adherence >= 50 ? 'var(--amber)' : 'var(--red)';
  const goldenRule = (p.rules && p.rules[0]) ? p.rules[0] : '';
  const hasAuto = allHabits.some((h) => h.auto);

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 };
  const modal: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--brand)', borderRadius: 18, maxWidth: 448, width: '100%', padding: 22, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 0 0 1px rgba(124,140,255,.5), 0 0 40px rgba(124,140,255,.35)' };

  const Row = (h: { id: string; label: string; auto: boolean }) => (
    <button key={h.id} onClick={() => toggle(h.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, border: '1px solid', borderColor: items[h.id] ? 'var(--green)' : 'var(--line)', background: items[h.id] ? 'color-mix(in srgb,var(--green) 12%,transparent)' : 'var(--bg2)', color: 'var(--tx)' }}>
      <span style={{ color: items[h.id] ? 'var(--green)' : 'var(--mut)', fontSize: 15 }}>{items[h.id] ? '✓' : '○'}</span>
      <span style={{ flex: 1 }}>{h.label}</span>
      {h.auto && <span className="pill" style={{ fontSize: 9.5, color: 'var(--soft-brand)', background: 'rgba(124,140,255,.16)' }}>{t.auto}</span>}
    </button>
  );

  return (
    <div style={overlay} onClick={() => closeForNow(false)}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ display: 'inline-flex', color: 'var(--brand)' }}><OnyxIcon emoji="🎯" size={20} /></span> {t.title}</div>
          <span className="pill" style={{ fontSize: 12, background: allDone ? 'rgba(52,226,160,.15)' : 'rgba(124,140,255,.15)', color: allDone ? 'var(--green)' : 'var(--soft-brand)' }}>{done}/{total}</span>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 14px' }}>{allDone ? t.allDone : t.sub}</p>

        {/* Mini resumen del plan */}
        <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 90, textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, padding: '10px 6px' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', margin: '0 auto 6px', background: `conic-gradient(${adColor} 0 ${s.adherence || 0}%, var(--line) ${s.adherence || 0}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{s.adherence || 0}%</div>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{t.adherence}</div>
          </div>
          <div style={{ flex: 1, minWidth: 90, textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, padding: '10px 6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--amber)' }}><OnyxIcon emoji="🔥" size={24} /></div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.streak || 0}</div>
            <div className="muted" style={{ fontSize: 11 }}>{t.streak}</div>
          </div>
          {g.daily_loss_pct != null && (
            <div style={{ flex: 1, minWidth: 90, textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, padding: '10px 6px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--soft-green)' }}><OnyxIcon emoji="🛡️" size={22} /></div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--soft-green)' }}>-{g.daily_loss_pct}%</div>
              <div className="muted" style={{ fontSize: 11 }}>{t.ddl}</div>
            </div>
          )}
        </div>

        {goldenRule && (
          <div style={{ background: 'rgba(124,140,255,.10)', border: '1px solid var(--brand)', borderRadius: 10, padding: '9px 11px', marginBottom: 12, fontSize: 12.5 }}>
            <span className="muted">{t.reminder}</span> <b>{goldenRule}</b>
          </div>
        )}

        {/* Tres momentos: antes / durante-después / al cerrar */}
        {([['before', '☀️ ' + t.before], ['during', '🕒 ' + t.during], ['close', '🌙 ' + t.close]] as const).map(([mk, label]) => (
          allHabits.some((h) => h.moment === mk) ? (
            <div key={mk}>
              <div style={{ fontSize: 10.5, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '2px 0 6px' }}>{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>{allHabits.filter((h) => h.moment === mk).map(Row)}</div>
            </div>
          ) : null
        ))}

        {hasAuto && <p className="muted" style={{ fontSize: 11, margin: '0 0 10px' }}>✨ {t.autoHint}</p>}

        <div style={{ position: 'relative', height: 8, marginBottom: 12 }}>
          {saved && <span style={{ position: 'absolute', right: 0, top: -2, color: 'var(--green)', fontSize: 11.5 }}>✓ {t.saved}</span>}
        </div>

        <button className="btn btn-primary" onClick={() => closeForNow(true)} style={{ width: '100%', marginBottom: 8 }}>{allDone ? t.allDone : t.done}</button>
        <div className="row between" style={{ alignItems: 'center' }}>
          <a href="/dashboard?view=plan" className="muted" style={{ fontSize: 12.5, textDecoration: 'underline' }}>{t.seePlan}</a>
          <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '5px 12px' }} onClick={() => closeForNow(false)}>{t.later}</button>
        </div>
      </div>
    </div>
  );
}
