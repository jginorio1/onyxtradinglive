'use client';
import { toast, toastErr } from '@/lib/toast';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';
import { CATALOG_KINDS, CATALOG_LABEL, type CatalogKind } from '@/lib/catalogDefaults';

// Catálogos editables: países, plataformas, tipos de trader y prop firms / brokers.
// Cada uno es una lista simple (código + nombre ES/EN) que alimenta los selectores
// del app. Añade, edita, quita y guarda; "Restablecer" vuelve a los de fábrica.
export default function CatalogAdmin() {
  const { lang } = useLang();
  const es = lang !== 'en';
  const L = (a: string, b: string) => (es ? a : b);
  const [kind, setKind] = useState<CatalogKind>('country');
  const [list, setList] = useState<any[]>([]);
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => { load(kind); /* eslint-disable-next-line */ }, [kind]);
  async function load(k: CatalogKind) {
    setMsg(''); setQ('');
    try {
      const r = await fetch('/api/admin/catalog?kind=' + k);
      const j = await r.json();
      setList(j.items || []); setIsDefault(!!j.isDefault);
    } catch { setList([]); }
  }

  const set = (i: number, key: string, v: any) => setList(list.map((it, ix) => (ix === i ? { ...it, [key]: v } : it)));
  const add = () => setList([{ code: '', es: '', en: '' }, ...list]);
  const remove = (i: number) => setList(list.filter((_, ix) => ix !== i));

  async function save() {
    setBusy('save'); setMsg('');
    const r = await fetch('/api/admin/catalog', { method: 'POST', body: JSON.stringify({ kind, items: list }) });
    const j = await r.json(); setBusy('');
    if (!r.ok) { toastErr(j); return; }
    setList(j.items || []); setIsDefault(false);
    setMsg(L('Guardado ✓', 'Saved ✓')); toast(L('Catálogo guardado', 'Catalog saved')); setTimeout(() => setMsg(''), 2500);
  }
  async function reset() {
    if (!confirm(L('¿Restablecer a los valores de fábrica? Se pierde tu lista personalizada.', 'Reset to factory defaults? Your custom list is lost.'))) return;
    setBusy('reset');
    const r = await fetch('/api/admin/catalog', { method: 'POST', body: JSON.stringify({ kind, action: 'reset' }) });
    const j = await r.json(); setBusy('');
    setList(j.items || []); setIsDefault(true);
  }

  const lbl = { fontSize: 11, color: 'var(--mut)', display: 'block', marginBottom: 3 } as any;
  const inp = { margin: 0, padding: '6px 9px', fontSize: 13 } as any;
  const bad = list.filter((it) => !String(it.es || '').trim()).length;

  const shown = q.trim()
    ? list.map((it, i) => ({ it, i })).filter(({ it }) => (`${it.es} ${it.en} ${it.code}`).toLowerCase().includes(q.toLowerCase()))
    : list.map((it, i) => ({ it, i }));

  return (
    <>
      <div className="tabhead">
        <div className="th-row"><span className="th-ic">🗂️</span><span className="th-t">{L('Catálogos', 'Catalogs')}</span></div>
        <div className="th-s">{L('Añade o quita países, plataformas, tipos de trader y prop firms/brokers. Alimentan los selectores del app.', 'Add or remove countries, platforms, trader types and prop firms/brokers. They feed the app selectors.')}</div>
      </div>

      {/* Selector de catálogo */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {CATALOG_KINDS.map((k) => (
            <button key={k} className={'btn ' + (k === kind ? 'btn-primary' : 'btn-ghost')} style={{ fontSize: 13 }} onClick={() => setKind(k)}>
              {es ? CATALOG_LABEL[k].es : CATALOG_LABEL[k].en}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill gray">{list.length} {L('elementos', 'items')}</span>
          {isDefault && <span className="muted" style={{ fontSize: 12 }}>{L('Mostrando los valores de fábrica (aún no guardaste cambios).', 'Showing factory defaults (no saved changes yet).')}</span>}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Buscar…', 'Search…')} style={{ ...inp, marginLeft: 'auto', minWidth: 180 }} />
        </div>
      </div>

      {/* Filas */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className="btn btn-ghost" onClick={add}>+ {L('Añadir', 'Add')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy === 'save' || bad > 0 || !list.length} style={{ opacity: bad > 0 || !list.length ? .5 : 1 }}>
            {busy === 'save' ? '...' : L('Guardar', 'Save')}
          </button>
          <button className="btn btn-ghost" onClick={reset} disabled={busy === 'reset'}>{L('Restablecer', 'Reset')}</button>
          {msg && <span style={{ color: 'var(--green)', fontSize: 14 }}>{msg}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ ...lbl, width: 130, margin: 0 }}>{L('Código', 'Code')}</span>
            <span style={{ ...lbl, flex: 1, margin: 0 }}>{L('Nombre (ES)', 'Name (ES)')}</span>
            <span style={{ ...lbl, flex: 1, margin: 0 }}>{L('Nombre (EN)', 'Name (EN)')}</span>
            <span style={{ width: 34 }} />
          </div>
          {shown.map(({ it, i }) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input value={it.code} onChange={(e) => set(i, 'code', e.target.value)} placeholder={kind === 'country' ? 'PR' : 'ftmo'} style={{ ...inp, width: 130 }} />
              <input value={it.es} onChange={(e) => set(i, 'es', e.target.value)} placeholder={L('Nombre', 'Name')} style={{ ...inp, flex: 1 }} />
              <input value={it.en} onChange={(e) => set(i, 'en', e.target.value)} placeholder={L('Nombre', 'Name')} style={{ ...inp, flex: 1 }} />
              <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 12, color: 'var(--red)' }} onClick={() => remove(i)} title={L('Quitar', 'Remove')}>✕</button>
            </div>
          ))}
          {!shown.length && <div className="muted" style={{ fontSize: 13, padding: 8 }}>{L('Sin resultados.', 'No results.')}</div>}
        </div>

        {bad > 0 && (
          <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(245,158,11,.08)', border: '1px solid var(--amber)', borderRadius: 10, fontSize: 13 }}>
            {L(`Hay ${bad} fila(s) sin nombre. Complétalas o quítalas antes de guardar.`, `${bad} row(s) missing a name. Fill or remove them before saving.`)}
          </div>
        )}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          {L('El código es el valor interno (para países usa el ISO de 2 letras, ej. PR). Si lo dejas vacío se genera del nombre.', 'The code is the internal value (for countries use the 2-letter ISO, e.g. PR). If left empty it is generated from the name.')}
        </div>
      </div>
    </>
  );
}
