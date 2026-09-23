'use client';
import { useEffect, useState, Fragment } from 'react';
import SalesPerf from './SalesPerf';
import { HintPop } from '@/app/components/HintPop';
import GuidePanel, { type GuideStep } from '@/app/components/GuidePanel';

// Panel ADMIN de la red de ventas · rediseño moderno:
// tarjetas de color por nivel, arrastrar y soltar para mover vendedores en el
// árbol, nombres de posición personalizados, CV adjunto y pagos.

const LV = {
  l2: { bg: 'rgba(229,181,103,.14)', bd: 'rgba(229,181,103,.45)', fg: '#e5b567' },
  l1: { bg: 'rgba(139,147,255,.15)', bd: 'rgba(139,147,255,.5)', fg: '#a9b0ff' },
  vendedor: { bg: 'rgba(94,214,160,.13)', bd: 'rgba(94,214,160,.5)', fg: '#5ed6a0' },
} as const;

export default function SalesAdmin({ canManage = true }: { canManage?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [sub, setSub] = useState<'solicitudes' | 'red' | 'desempeno' | 'metas' | 'crecimiento' | 'kit' | 'ajustes' | 'pagos'>('red');
  const [msg, setMsg] = useState('');
  const [dragId, setDragId] = useState<string>('');

  useEffect(() => { load(); }, []);
  async function load() { try { const r = await fetch('/api/admin/sales', { cache: 'no-store' }); setD(await r.json()); } catch {} }
  async function act(body: any) {
    setMsg('');
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.error) setMsg('⚠ ' + j.error); else setMsg('Hecho ✓');
    await load(); return j;
  }

  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--bg,#0e1220)', color: 'var(--tx,#e8ecf5)', fontSize: 13 };
  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 };
  const btnP: React.CSSProperties = { ...btn, background: 'var(--accent,#8b93ff)', color: '#fff', border: 'none', fontWeight: 600 };

  if (!d) return <div className="muted">Cargando…</div>;
  const s = d.settings || {};
  const names = s.level_names || { l2: 'Supervisor N2', l1: 'Supervisor N1', vendedor: 'Vendedor' };
  const reps: any[] = d.reps || [];
  const apps: any[] = (d.applications || []).filter((a: any) => a.status === 'pending');
  const recruitLink = (typeof window !== 'undefined' ? window.location.origin : 'https://www.onyxtradinglive.com') + '/unete-ventas';
  const lvName = (l: string) => (l === 'l2' ? names.l2 : l === 'l1' ? names.l1 : names.vendedor);

  const subBtn = (id: any, label: string, n?: number) => (
    <button onClick={() => setSub(id)} style={{ ...btn, background: sub === id ? 'var(--accent,#8b93ff)' : btn.background, color: sub === id ? '#fff' : btn.color, border: sub === id ? 'none' : btn.border }}>{label}{n ? ` · ${n}` : ''}</button>
  );

  async function drop(targetParentId: string | null) {
    if (!dragId) return;
    if (targetParentId === dragId) { setDragId(''); return; }
    await act({ action: 'set_rep', rep_id: dragId, parent_id: targetParentId });
    setDragId('');
  }

  // ===== GUÍA flotante (igual que la de Anuncios): pasos con dibujo + ejemplo.
  // Cada paso apunta a una sección real por data-guide; al tocarlo cambia de
  // pestaña y la ilumina con una flecha. Contenido en español (este panel es ES).
  const GD = '#d9b661', GRN = '#5ed6a0', BLU = '#a9b0ff', MUT = '#8b93a7', LN = '#2a3350';
  const gsvg: Record<string, string> = {
    // Motor: vendedor → cliente → % (cadena de override)
    motor: `<svg viewBox="0 0 250 120" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Motor de ventas">
      <circle cx="34" cy="60" r="16" fill="rgba(94,214,160,.18)" stroke="${GRN}"/><text x="34" y="63" fill="${GRN}" font-size="8" text-anchor="middle" font-family="sans-serif">Vend.</text>
      <path d="M52 60 H92" stroke="${MUT}" stroke-width="2" marker-end="url(#a)"/>
      <rect x="94" y="44" width="46" height="32" rx="6" fill="#fff"/><text x="117" y="63" fill="#0b0f1e" font-size="8" text-anchor="middle" font-family="sans-serif">Cliente</text>
      <path d="M142 60 H182" stroke="${GD}" stroke-width="2" marker-end="url(#a)"/>
      <rect x="184" y="42" width="52" height="36" rx="6" fill="rgba(212,175,90,.16)" stroke="${GD}"/><text x="210" y="58" fill="${GD}" font-size="8" text-anchor="middle" font-family="sans-serif">comisión</text><text x="210" y="70" fill="${GD}" font-size="10" font-weight="700" text-anchor="middle" font-family="sans-serif">%</text>
      <defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${MUT}"/></marker></defs></svg>`,
    // Impulso: barra alta 1er mes, baja después
    impulso: `<svg viewBox="0 0 250 120" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Impulso primer mes">
      <line x1="20" y1="100" x2="240" y2="100" stroke="${LN}"/>
      <rect x="30" y="24" width="34" height="76" rx="4" fill="rgba(212,175,90,.85)"/><text x="47" y="18" fill="${GD}" font-size="9" text-anchor="middle" font-family="sans-serif">1.er mes</text><text x="47" y="118" fill="${MUT}" font-size="8" text-anchor="middle" font-family="sans-serif">alto</text>
      ${[1,2,3,4,5].map((i)=>`<rect x="${78+i*28}" y="76" width="20" height="24" rx="3" fill="rgba(94,214,160,.75)"/>`).join('')}
      <text x="150" y="70" fill="${GRN}" font-size="9" text-anchor="middle" font-family="sans-serif">residual bajo →</text></svg>`,
    // Retención: escalera de mecanismos
    reten: `<svg viewBox="0 0 250 120" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Retencion">
      ${['Bono','Ascenso','Residual','Metas'].map((t,i)=>`<rect x="${18+i*56}" y="${92-i*20}" width="48" height="${20+i*20}" rx="4" fill="rgba(139,147,255,${.25+i*.12})" stroke="${BLU}"/><text x="${42+i*56}" y="108" fill="${BLU}" font-size="7.5" text-anchor="middle" font-family="sans-serif">${t}</text>`).join('')}</svg>`,
    // Árbol de la red (3 niveles)
    red: `<svg viewBox="0 0 250 120" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="La red">
      <rect x="100" y="10" width="50" height="22" rx="6" fill="rgba(212,175,90,.16)" stroke="${GD}"/><text x="125" y="25" fill="${GD}" font-size="8" text-anchor="middle" font-family="sans-serif">Director</text>
      <path d="M125 32 V46 M125 46 H70 M125 46 H180 M70 46 V56 M180 46 V56" stroke="${MUT}"/>
      <rect x="46" y="56" width="48" height="20" rx="5" fill="rgba(139,147,255,.16)" stroke="${BLU}"/><text x="70" y="70" fill="${BLU}" font-size="7.5" text-anchor="middle" font-family="sans-serif">Líder</text>
      <rect x="156" y="56" width="48" height="20" rx="5" fill="rgba(139,147,255,.16)" stroke="${BLU}"/><text x="180" y="70" fill="${BLU}" font-size="7.5" text-anchor="middle" font-family="sans-serif">Líder</text>
      <path d="M70 76 V88 M180 76 V88" stroke="${MUT}"/>
      <rect x="46" y="88" width="48" height="20" rx="5" fill="rgba(94,214,160,.16)" stroke="${GRN}"/><text x="70" y="102" fill="${GRN}" font-size="7.5" text-anchor="middle" font-family="sans-serif">Vend.</text>
      <rect x="156" y="88" width="48" height="20" rx="5" fill="rgba(94,214,160,.16)" stroke="${GRN}"/><text x="180" y="102" fill="${GRN}" font-size="7.5" text-anchor="middle" font-family="sans-serif">Vend.</text></svg>`,
    // Pagos: candado madura → $
    pagos: `<svg viewBox="0 0 250 120" width="230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pagos">
      <rect x="26" y="46" width="40" height="34" rx="5" fill="none" stroke="${MUT}"/><path d="M34 46 v-6 a6 6 0 0112 0 v6" fill="none" stroke="${MUT}"/><text x="46" y="96" fill="${MUT}" font-size="7.5" text-anchor="middle" font-family="sans-serif">madura</text>
      <path d="M78 63 H118" stroke="${GRN}" stroke-width="2" marker-end="url(#b)"/>
      <circle cx="150" cy="63" r="20" fill="rgba(94,214,160,.18)" stroke="${GRN}"/><text x="150" y="67" fill="${GRN}" font-size="14" font-weight="700" text-anchor="middle" font-family="sans-serif">$</text>
      <text x="150" y="96" fill="${MUT}" font-size="7.5" text-anchor="middle" font-family="sans-serif">disponible</text>
      <defs><marker id="b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${GRN}"/></marker></defs></svg>`,
  };
  // Mapea el data-guide del paso a la sub-pestaña que hay que abrir.
  const guideSub = (t: string): typeof sub => {
    if (t.includes('impulso') || t.includes('comisiones') || t.includes('ajustes')) return 'ajustes';
    if (t.includes('red')) return 'red';
    if (t.includes('metas')) return 'metas';
    if (t.includes('crecimiento')) return 'crecimiento';
    if (t.includes('kit')) return 'kit';
    if (t.includes('pagos')) return 'pagos';
    return sub;
  };
  const guideSteps: GuideStep[] = [
    { target: '[data-guide="subtabs"]', title: '1 · Cómo funciona (empieza aquí)',
      body: 'Esta área es tu FUERZA DE VENTAS: personas que venden tus planes a cambio de comisión. La idea es que sean el motor del negocio.\n\nCada vendedor tiene un enlace único. Cuando alguien compra por ese enlace, se vuelve SU cliente y el vendedor cobra un % de cada pago mensual mientras el cliente siga pagando.\n\nHay 3 niveles (Vendedor, Líder, Director). Cuando un Vendedor cierra, su Líder y su Director de arriba también cobran un pequeño "override". Así los buenos vendedores quieren armar equipo.\n\nLas pestañas de arriba controlan cada parte: La red (el árbol), Metas, Crecimiento, Kit, Solicitudes, Ajustes (las reglas) y Pagos.',
      svg: gsvg.motor,
      example: 'Un vendedor comparte su enlace en su grupo de Telegram. 3 traders compran el plan Pro de $79. Esos 3 quedan como sus clientes y cobra su % de los $79 cada mes que sigan pagando.' },
    { target: '[data-guide="impulso"]', title: '2 · Impulso 1.er mes + residual (el corazón)',
      body: 'Este es el modelo que elegiste para motivar a vender SIN destruir tu margen.\n\n• Primer mes: pagas un % ALTO (ej. 40-50%) del primer pago de cada cliente nuevo. Es el "golpe" que emociona al vendedor y lo hace salir a vender hoy.\n• A partir del 2.º mes: pagas un % MENOR recurrente (ej. 15%). Es el residual que cuida tu margen a largo plazo.\n\nActívalo con el interruptor y pon los tres % del primer mes (directo y overrides). Los % normales de la sección Comisiones se usan del segundo mes en adelante.',
      svg: gsvg.impulso,
      example: 'Cliente de $100/mes con 45% primer mes y 15% residual: el vendedor gana $45 el primer mes y $15 cada mes siguiente. En un año son $210 por ESE cliente — más que un embajador el primer mes, pero sin cargar 30% para siempre.' },
    { target: '[data-guide="impulso"]', title: '3 · Bono primeras ventas',
      body: 'Dentro de la misma tarjeta de Impulso está el "Bono primeras ventas": un premio ÚNICO (una sola vez por vendedor) cuando llega a X clientes que ya pagaron.\n\nSirve para el arranque: le das una meta clara y una recompensa por despegar rápido, que es cuando más gente se rinde.\n\nPon "Al llegar a (clientes)" y el "Bono" en $. Con 0 en cualquiera de los dos, se desactiva.',
      svg: gsvg.reten,
      example: 'Bono = $100 al llegar a 5 clientes. Un vendedor nuevo cierra su 5.º cliente que paga → se le acredita $100 extra una sola vez, además de sus comisiones normales. Es el empujón para que no abandone en las primeras semanas.' },
    { target: '[data-guide="comisiones"]', title: '4 · Comisiones y overrides (el residual)',
      body: 'Aquí pones los % NORMALES (recurrentes) y cuántos meses se pagan:\n\n• Vendedor directo: el % de quien cerró la venta.\n• Override 1 y 2: el % para los dos niveles arriba de él en el árbol.\n• Meses (0 = ∞): cuántos meses en total se paga por cada cliente. 0 = para siempre mientras pague.\n\nLa tabla de abajo te muestra, con un cliente de $100, exactamente cuánto gana cada quién según quién cierra. Cambia solo si editas los %.',
      svg: gsvg.motor,
      example: 'Directo 15%, Override1 5%, Override2 3%. Si un Vendedor cierra un cliente de $100: él gana $15, su Líder $5 y su Director $3 cada mes. Si el Líder cierra directo, él gana los $15 y su Director el override.' },
    { target: '[data-guide="red"]', title: '5 · La red (tu árbol de vendedores)',
      body: 'Aquí está tu equipo en 3 niveles. Puedes ARRASTRAR una tarjeta y soltarla sobre un supervisor para moverla de rama, o soltarla en el tope para quitarle supervisor.\n\nAñade gente de dos formas: aprobando una Solicitud, o "Añadir representante" por su correo (debe tener cuenta). Cada tarjeta abre sus permisos, nivel, supervisor y saldos.',
      svg: gsvg.red,
      example: 'Contratas un Director con experiencia. Arrastras 4 vendedores nuevos bajo él para que los entrene. Ahora cada venta de esos 4 le paga un override al Director, así que le conviene que su gente venda.' },
    { target: '[data-guide="metas"]', title: '6 · Metas y leaderboard',
      body: 'Pon objetivos con recompensa (ej. "5 ventas este mes = $X") y una tabla de posiciones. La competencia sana y las metas cortas son de las cosas que más retienen vendedores a mediano plazo.\n\nEl leaderboard muestra quién va ganando y motiva al resto a alcanzarlo.',
      svg: gsvg.reten,
      example: 'Meta del mes: "8 clientes nuevos = bono $150". El leaderboard muestra a María en 6 y a Luis en 5. Los dos empujan la última semana para llegar a 8. Tú ganas 8+ clientes nuevos por vendedor.' },
    { target: '[data-guide="crecimiento"]', title: '7 · Crecimiento (ascensos y leads)',
      body: 'Dos motores de largo plazo:\n\n• Ascensos automáticos: cuando un vendedor cumple X (ventas/equipo), sube de nivel solo (Vendedor → Líder → Director) y gana overrides. Es la "carrera" que los mantiene años.\n• Embudo y leads sin dueño: repartes prospectos y ves en qué etapa va cada uno.',
      svg: gsvg.red,
      example: 'Regla: "20 clientes activos → asciende a Líder". Un vendedor los alcanza y sube solo; ahora puede reclutar y cobra override de su equipo. Tiene motivo para quedarse y crecer en vez de irse.' },
    { target: '[data-guide="pagos"]', title: '8 · Pagos (cómo cobran)',
      body: 'Cada comisión primero "madura" (retención en días, por si hay reembolso). Cuando madura y pasa el mínimo, queda DISPONIBLE.\n\n• Con Stripe conectado: el pago sale solo (si activaste pago automático en Ajustes).\n• Con USDT/manual: pagas fuera y marcas la referencia.\n\nEn Ajustes controlas retención, mínimo, freno global "revisar antes de pagar" y los candados anti-abuso.',
      svg: gsvg.pagos,
      example: 'Retención 14 días, mínimo $50. Un vendedor junta $80 el día 1; el día 15 maduran y, como supera $50, Stripe le transfiere solo. Si el cliente pidió reembolso antes del día 15, esa comisión se anula sin que nadie haya cobrado.' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>{ic('users-group', 22, 'var(--accent,#8b93ff)')} Red de ventas<Hint text="Tu equipo de comisionistas en 3 niveles (Advisor, Lead, Director). Cada pestaña de arriba controla una parte: La red = el árbol, Desempeño = puntajes, Metas = objetivos, Crecimiento = embudo y leads, Kit = materiales, Solicitudes = quienes aplican, Ajustes = todas las reglas, Pagos = pagarles." /></h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <GuidePanel storageKey="sales" title="Guía de Ventas" steps={guideSteps} es={true} onStep={(t) => setSub(guideSub(t))} />
          <span className="muted" style={{ fontSize: 12 }}>Reclutamiento:</span>
          <input readOnly value={recruitLink} style={{ ...inp, width: 230 }} />
          <button style={btn} onClick={() => { navigator.clipboard.writeText(recruitLink); setMsg('Enlace copiado ✓'); }}>{ic('copy', 15)}</button>
        </div>
      </div>

      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div data-guide="subtabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {subBtn('red', 'La red', reps.length)}
        {subBtn('desempeno', 'Desempeño')}
        {subBtn('metas', 'Metas')}
        {subBtn('crecimiento', 'Crecimiento')}
        {subBtn('kit', 'Kit')}
        {subBtn('solicitudes', 'Solicitudes', apps.length)}
        {subBtn('ajustes', 'Ajustes')}
        {subBtn('pagos', 'Pagos')}
      </div>

      {/* ===== LA RED (árbol con drag & drop) ===== */}
      {sub === 'red' && <div data-guide="red">
        {canManage && <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>Añadir representante manualmente<Hint text="Da de alta a un vendedor por su correo (debe tener cuenta en la app). Eliges su nivel y quién es su supervisor. También puedes arrastrar tarjetas para moverlo de rama, o darle de alta aprobando una Solicitud." /></b>
          <CreateRep reps={reps} act={act} inp={inp} btnP={btnP} lvName={lvName} />
        </div>}

        {reps.length === 0 ? <div className="muted">Aún no hay representantes. Aprueba una solicitud o añade uno manualmente.</div> : <>
          <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>{ic('drag-drop', 15)} Arrastra un vendedor y suéltalo sobre un supervisor para moverlo de rama.</div>
          {/* Zona: hacer tope (sin supervisor) */}
          {dragId && <div onDragOver={(e) => e.preventDefault()} onDrop={() => drop(null)}
            style={{ border: '1.5px dashed var(--accent,#8b93ff)', borderRadius: 10, padding: 10, textAlign: 'center', color: 'var(--accent,#8b93ff)', marginBottom: 10, fontSize: 12.5 }}>
            ⬆ Soltar aquí = quitar supervisor (dejar en el tope)
          </div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {(['l2', 'l1', 'vendedor'] as const).map((lvl) => {
              const group = reps.filter((r) => r.level === lvl);
              const c = LV[lvl];
              return (
                <div key={lvl}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: c.fg, fontWeight: 700, marginBottom: 8 }}>{lvName(lvl)} <span style={{ opacity: .55 }}>({group.length})</span></div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {group.map((r) => (
                      <RepCard key={r.id} r={r} c={c} names={names} reps={reps} act={act} canManage={canManage}
                        dragId={dragId} setDragId={setDragId} onDropOn={drop} inp={inp} btn={btn} btnP={btnP} lvName={lvName} />
                    ))}
                    {group.length === 0 && <div className="muted" style={{ fontSize: 12, padding: '6px 2px' }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>}
      </div>}

      {/* ===== DESEMPEÑO ===== */}
      {sub === 'desempeno' && <div>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>Puntaje y calificación de cada vendedor<Hint text="Tablero de rendimiento del equipo. Cada vendedor tiene un puntaje (0-100) que mezcla reseñas de clientes, conversión, actividad, atención y retención, y cae en Estrella / Sólido / En riesgo. Aquí ves reseñas, evaluaciones 360 y consejos de la IA." /></div>
        <SalesPerf canManage={canManage} names={names} />
      </div>}

      {/* ===== SOLICITUDES ===== */}
      {sub === 'solicitudes' && <div>
        <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 8, display: 'flex', alignItems: 'center' }}>Personas que aplicaron para vender<Hint text="Quienes se postularon desde la página pública de reclutamiento. Revisa su CV, elige nivel y supervisor, y Aprueba (queda de alta como vendedor) o Rechaza." /></div>
        {apps.length === 0 && <div className="muted">No hay solicitudes pendientes.</div>}
        {apps.map((a) => <AppRow key={a.id} a={a} reps={reps} act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} />)}
      </div>}

      {/* ===== METAS ===== */}
      {sub === 'metas' && <div data-guide="metas"><MetasBox act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} LV={LV} /></div>}

      {/* ===== CRECIMIENTO ===== */}
      {sub === 'crecimiento' && <div data-guide="crecimiento"><CrecimientoBox inp={inp} btn={btn} btnP={btnP} canManage={canManage} lvName={lvName} /></div>}

      {/* ===== KIT ===== */}
      {sub === 'kit' && <div data-guide="kit"><KitBox inp={inp} btn={btn} btnP={btnP} canManage={canManage} /></div>}

      {/* ===== AJUSTES ===== */}
      {sub === 'ajustes' && <SettingsBox s={s} names={names} act={act} inp={inp} btnP={btnP} canManage={canManage} />}

      {/* ===== PAGOS ===== */}
      {sub === 'pagos' && <div data-guide="pagos">
        <div className="muted" style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center' }}>Paga el saldo disponible (madurado). Stripe = automático · USDT/manual = marcas con referencia.<Hint text="Solo aparecen aquí los vendedores con saldo DISPONIBLE (ya maduró y pasó la retención). Con Stripe el dinero sale solo al conectar su cuenta; con USDT/manual pagas fuera del sistema y marcas la referencia. Si tienes el pago automático activo, esto se hace solo." /></div>
        {reps.filter((r) => (r.balances?.available || 0) > 0).length === 0 && <div className="muted">Nadie tiene saldo disponible ahora mismo.</div>}
        {reps.filter((r) => (r.balances?.available || 0) > 0).map((r) => <PayRow key={r.id} r={r} act={act} inp={inp} btn={btn} btnP={btnP} canManage={canManage} />)}
      </div>}
    </div>
  );
}

// Icono de línea inline (moderno, sin dependencias). Set reducido.
function ic(name: string, size = 16, color = 'currentColor') {
  const p: Record<string, string> = {
    'users-group': 'M10 13a4 4 0 100-8 4 4 0 000 8zM2 21v-1a5 5 0 015-5h6a5 5 0 015 5v1M17 11a3 3 0 100-6M22 21v-1a4 4 0 00-3-3.8',
    'copy': 'M9 9h10v10H9zM5 15H4V5a1 1 0 011-1h10v1',
    'drag-drop': 'M8 6h.01M8 12h.01M8 18h.01M14 6h.01M14 12h.01M14 18h.01',
    'grip': 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
    'file': 'M14 3v5h5M8 3h6l5 5v11a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z',
    'cash': 'M3 6h18v12H3zM12 15a3 3 0 100-6 3 3 0 000 6z',
    'pencil': 'M4 20h4L18 10l-4-4L4 16v4zM13 5l4 4',
    'plus': 'M12 5v14M5 12h14',
    'rocket': 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.7a1.9 1.9 0 00-3 0M12 15l-3-3a22 22 0 016-11 8.5 8.5 0 018 8 22 22 0 01-11 6M9 12H4s.5-2.8 2-4c1.7-1.4 5-1 5-1M12 15v5s2.8-.5 4-2c1.4-1.4 1-5 1-5',
    'gift': 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
    'target': 'M12 3a9 9 0 100 18 9 9 0 000-18M12 8a4 4 0 100 8 4 4 0 000-8M12 12h.01',
    'stairs': 'M4 20h4v-4h4v-4h4v-4h4',
    'crown': 'M4 17h16l-1-8-4 4-3-6-3 6-4-4z',
    'user': 'M12 12a4 4 0 100-8 4 4 0 000 8M4 21v-1a5 5 0 015-5h6a5 5 0 015 5v1',
    'school': 'M12 4L2 9l10 5 10-5-10-5zM6 12v4c0 1.5 3 3 6 3s6-1.5 6-3v-4',
    'robot': 'M9 2h6M12 2v3M6 8h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V9a1 1 0 011-1zM9 13h.01M15 13h.01',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', flex: 'none' }}><path d={p[name] || ''} /></svg>;
}

function RepCard({ r, c, names, reps, act, canManage, dragId, setDragId, onDropOn, inp, btn, btnP, lvName }: any) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(r.level);
  const [parent, setParent] = useState(r.parent_id || '');
  const [rate, setRate] = useState(r.rate_override ?? '');
  const [workEmail, setWorkEmail] = useState(r.work_email || '');
  const [assign, setAssign] = useState('');
  const dfl = r.level === 'vendedor'
    ? { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: false, can_team: false }
    : { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: true, can_team: true };
  const [perms, setPerms] = useState<any>(r.perms ? { ...dfl, ...r.perms } : { ...dfl });
  const [customPerms, setCustomPerms] = useState<boolean>(!!r.perms);
  const b = r.balances || {};
  const PERM_LABELS: [string, string][] = [['can_trial', 'Dar pruebas'], ['can_discount', 'Dar descuentos'], ['can_clients', 'Gestionar clientes'], ['can_tickets', 'Atender tickets'], ['can_recruit', 'Reclutar equipo'], ['can_team', 'Ver equipo']];
  const isDragging = dragId === r.id;
  return (
    <div
      draggable={canManage}
      onDragStart={() => setDragId(r.id)}
      onDragEnd={() => setDragId('')}
      onDragOver={(e) => { if (dragId && dragId !== r.id) e.preventDefault(); }}
      onDrop={() => onDropOn(r.id)}
      style={{ background: c.bg, border: `1px solid ${dragId && dragId !== r.id ? 'var(--accent,#8b93ff)' : c.bd}`, borderRadius: 12, padding: '10px 12px', opacity: isDragging ? .5 : 1, cursor: canManage ? 'grab' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {canManage && <span style={{ color: c.fg, cursor: 'grab' }}>{ic('grip', 16, c.fg)}</span>}
        <b style={{ color: c.fg, fontSize: 13.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name || r.email || r.code}</b>
        {r.on_hold && <span title="pagos pausados" style={{ color: 'var(--amber,#f0b74e)', fontSize: 12 }}>⏸</span>}
      </div>
      <div style={{ fontSize: 11.5, color: c.fg, opacity: .85, marginTop: 3 }}>{r.clients} clientes · disp ${b.available || 0}</div>
      {r.email && <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>}
      {canManage && <button onClick={() => setOpen(!open)} style={{ ...btn, marginTop: 8, padding: '4px 10px', fontSize: 11.5 }}>{open ? 'Cerrar' : 'Editar'}</button>}
      {open && canManage && <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">{lvName('vendedor')}</option><option value="l1">{lvName('l1')}</option><option value="l2">{lvName('l2')}</option></select>
        <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">— sin supervisor —</option>{reps.filter((x: any) => x.id !== r.id && x.level !== 'vendedor').map((x: any) => <option key={x.id} value={x.id}>{x.display_name || x.email}</option>)}</select>
        <input type="number" placeholder="% propio (auto)" value={rate} onChange={(e) => setRate(e.target.value)} style={inp} />
        <input placeholder="correo de trabajo (ej. juan@onyxtradinglive.com)" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} style={inp} />
        <button style={btnP} onClick={() => act({ action: 'set_rep', rep_id: r.id, level, parent_id: parent || null, rate_override: rate, work_email: workEmail })}>Guardar</button>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={{ ...btn, flex: 1 }} onClick={() => act({ action: 'set_rep', rep_id: r.id, on_hold: !r.on_hold })}>{r.on_hold ? '▶ Reanudar' : '⏸ Pausar'}</button>
          <button style={{ ...btn, flex: 1 }} onClick={() => act({ action: 'set_rep', rep_id: r.id, status: r.status === 'active' ? 'paused' : 'active' })}>{r.status === 'active' ? 'Desactivar' : 'Activar'}</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="asignar cliente (correo)" value={assign} onChange={(e) => setAssign(e.target.value)} style={{ ...inp, flex: 1 }} />
          <button style={btn} onClick={() => assign && act({ action: 'assign_client', rep_id: r.id, email: assign })}>+</button>
        </div>
        {/* Permisos del representante */}
        <div style={{ borderTop: '1px solid var(--line,#2a3350)', paddingTop: 8, marginTop: 2 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)' }}>
            <input type="checkbox" checked={customPerms} onChange={(e) => setCustomPerms(e.target.checked)} style={{ width: 15, height: 15, flex: 'none', margin: 0 }} />
            <span>Permisos personalizados (si no, hereda del nivel)</span>
          </label>
          {customPerms && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
            {PERM_LABELS.map(([k, lab]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: 'var(--mut,#9aa6bd)' }}>
                <input type="checkbox" checked={!!perms[k]} onChange={(e) => setPerms((p: any) => ({ ...p, [k]: e.target.checked }))} style={{ width: 14, height: 14, flex: 'none', margin: 0 }} />
                <span>{lab}</span>
              </label>
            ))}
          </div>}
          <button style={{ ...btnP, marginTop: 8, width: '100%', padding: '5px' }} onClick={() => act({ action: 'set_perms', rep_id: r.id, perms: customPerms ? perms : null })}>Guardar permisos</button>
        </div>
      </div>}
    </div>
  );
}

function CreateRep({ reps, act, inp, btnP, lvName }: any) {
  const [email, setEmail] = useState(''); const [level, setLevel] = useState('vendedor'); const [parent, setParent] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <input placeholder="correo (ya con cuenta en la app)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inp, minWidth: 240 }} />
      <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">{lvName('vendedor')}</option><option value="l1">{lvName('l1')}</option><option value="l2">{lvName('l2')}</option></select>
      <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">sin supervisor</option>{reps.filter((r: any) => r.level !== 'vendedor').map((r: any) => <option key={r.id} value={r.id}>{r.display_name || r.email}</option>)}</select>
      <button style={btnP} onClick={() => email && act({ action: 'create_rep', email, level, parent_id: parent || null })}>Añadir</button>
    </div>
  );
}

function AppRow({ a, reps, act, inp, btn, btnP, canManage, lvName }: any) {
  const [level, setLevel] = useState(a.desired_role === 'supervisor' ? 'l1' : 'vendedor');
  const [propLang, setPropLang] = useState<'es' | 'en'>('es');    // idioma de la propuesta
  const [parent, setParent] = useState(a.sponsor_rep_id || '');   // pre-lleno con quien lo trajo
  return (
    <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div><b>{a.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.email} · {a.country || '—'} · pide: {a.desired_role}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {a.resume_signed ? <a href={a.resume_signed} target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{ic('file', 14)} Ver CV</a> : <span className="muted" style={{ fontSize: 11 }}>sin CV</span>}
          <span className="muted" style={{ fontSize: 11 }}>{new Date(a.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {a.sponsor_name && <div style={{ fontSize: 12, marginTop: 6, color: '#e5b567' }}>↳ Traído por <b>{a.sponsor_name}</b> · se colgará en su rama</div>}
      {(a.experience || a.audience || a.note) && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{[a.experience, a.audience, a.note].filter(Boolean).join(' · ')}</div>}
      {canManage && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={inp}><option value="vendedor">{lvName('vendedor')}</option><option value="l1">{lvName('l1')}</option><option value="l2">{lvName('l2')}</option></select>
        <select value={parent} onChange={(e) => setParent(e.target.value)} style={inp}><option value="">Sin supervisor</option>{reps.filter((r: any) => r.level !== 'vendedor').map((r: any) => <option key={r.id} value={r.id}>{r.display_name || r.email}</option>)}</select>
        <button style={btnP} onClick={() => act({ action: 'approve', app_id: a.id, email: a.email, level, parent_id: parent || null, display_name: a.name })}>Aprobar</button>
        <button style={btn} onClick={() => act({ action: 'reject', app_id: a.id })}>Rechazar</button>
        {a.email && <><select value={propLang} onChange={(e) => setPropLang(e.target.value as any)} style={{ ...inp, width: 'auto' }} title="Idioma de la propuesta"><option value="es">ES</option><option value="en">EN</option></select><button style={btn} title="Envía el PDF de la propuesta (con tus parámetros actuales, para el nivel e idioma seleccionados) al correo del candidato" onClick={() => act({ action: 'proposal_email', email: a.email, name: a.name, level, lang: propLang })}>✉ Enviar propuesta ({lvName(level)})</button></>}
      </div>}
    </div>
  );
}

function PayRow({ r, act, inp, btn, btnP, canManage }: any) {
  const [ref, setRef] = useState('');
  const b = r.balances || {};
  return (
    <div style={{ background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div><b>{r.display_name || r.email}</b> <span className="muted" style={{ fontSize: 12 }}>· disponible <b style={{ color: 'var(--green,#5ed6a0)' }}>${b.available}</b> · {r.payout_method || 'stripe'}</span></div>
        {canManage && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btnP} onClick={() => act({ action: 'pay_stripe', rep_id: r.id })}>Pagar por Stripe</button>
          <input placeholder="txid (USDT)" value={ref} onChange={(e) => setRef(e.target.value)} style={{ ...inp, width: 150 }} />
          <button style={btn} onClick={() => act({ action: 'pay_manual', rep_id: r.id, method: 'usdt', ref })}>Marcar pagado</button>
        </div>}
      </div>
    </div>
  );
}

// Icono "?" con explicación en un globo. Usa el popup robusto compartido
// (cierra al tocar fuera, con la X o Escape, y no se corta en el borde).
function Hint({ text }: { text: string }) { return <HintPop text={text} glyph="?" />; }

// ===== KIT: gestión de materiales de venta =====
function KitBox({ inp, btn, btnP, canManage }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ed, setEd] = useState<any>(null);   // asset en edición (o nuevo)
  async function post(body: any) { const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
  async function load() { setBusy(true); try { const j = await post({ action: 'assets_list' }); setItems(j.assets || []); } catch {} setBusy(false); }
  useEffect(() => { load(); }, []);
  const card: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16, marginBottom: 12 };
  const blank = { kind: 'script', title: '', body: '', url: '', lang: 'es', sort: 0, active: true };
  if (busy) return <div className="muted">Cargando kit…</div>;
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--mut,#9aa6bd)', marginBottom: 10, display: 'flex', alignItems: 'center' }}>Materiales para que tu equipo venda mejor<Hint text="Guiones, plantillas de WhatsApp, banners, PDFs o videos que creas aquí y aparecen en la pestaña 'Kit' del panel de cada vendedor (con botón de copiar/abrir). Elige idioma y si está activo (visible) o no." /></div>
      {canManage && <button style={{ ...btnP, marginBottom: 12 }} onClick={() => setEd({ ...blank })}>+ Nuevo material</button>}
      {ed && <div style={card}>
        <b>{ed.id ? 'Editar material' : 'Nuevo material'}</b>
        <div style={{ display: 'grid', gap: 8, marginTop: 10, maxWidth: 560 }}>
          <input value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} placeholder="Título" style={inp} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={ed.kind} onChange={(e) => setEd({ ...ed, kind: e.target.value })} style={inp}>
              <option value="script">Guion / plantilla</option><option value="link">Enlace</option><option value="image">Imagen</option><option value="pdf">PDF</option><option value="video">Video</option>
            </select>
            <select value={ed.lang} onChange={(e) => setEd({ ...ed, lang: e.target.value })} style={inp}><option value="es">Español</option><option value="en">English</option><option value="all">Ambos</option></select>
            <input type="number" value={ed.sort} onChange={(e) => setEd({ ...ed, sort: Number(e.target.value) })} placeholder="Orden" style={{ ...inp, width: 90 }} />
          </div>
          <textarea value={ed.body || ''} onChange={(e) => setEd({ ...ed, body: e.target.value })} placeholder="Texto (guion / plantilla)" style={{ ...inp, minHeight: 90, resize: 'vertical' }} />
          <input value={ed.url || ''} onChange={(e) => setEd({ ...ed, url: e.target.value })} placeholder="URL (enlace / imagen / pdf / video)" style={inp} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}><input type="checkbox" checked={ed.active !== false} onChange={(e) => setEd({ ...ed, active: e.target.checked })} /> Activo (visible para vendedores)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnP} onClick={async () => { if (ed.title.trim()) { await post({ action: 'save_asset', asset: ed }); setEd(null); load(); } }}>Guardar</button>
            <button style={btn} onClick={() => setEd(null)}>Cancelar</button>
          </div>
        </div>
      </div>}
      {items.length === 0 && <div className="muted">Aún no hay materiales. Crea guiones, banners, PDFs o videos para el equipo.</div>}
      {items.map((a) => (
        <div key={a.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div><b style={{ color: 'var(--tx,#e8ecf5)' }}>{a.title}</b> <span className="muted" style={{ fontSize: 11.5 }}>· {a.kind} · {a.lang}{a.active === false ? ' · oculto' : ''}</span></div>
            {canManage && <div style={{ display: 'flex', gap: 6 }}>
              <button style={btn} onClick={() => setEd({ ...a })}>Editar</button>
              <button style={btn} onClick={async () => { await post({ action: 'del_asset', id: a.id }); load(); }}>Borrar</button>
            </div>}
          </div>
          {a.body && <div className="muted" style={{ fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{a.body}</div>}
        </div>
      ))}
    </div>
  );
}

// ===== CRECIMIENTO: embudo + leads sin dueño + ascensos =====
function CrecimientoBox({ inp, btn, btnP, canManage, lvName }: any) {
  const [funnel, setFunnel] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');
  async function post(body: any) {
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  async function load() {
    setBusy(true);
    try { const [f, l] = await Promise.all([post({ action: 'funnel' }), post({ action: 'leads' })]); setFunnel(f); setLeads(l.leads || []); } catch {}
    setBusy(false);
  }
  useEffect(() => { load(); }, []);
  if (busy) return <div className="muted">Cargando…</div>;
  const t = funnel?.totals || { clicks: 0, signups: 0, trials: 0, paid: 0 };
  const stage = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, minWidth: 110, background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>{label}</div>
    </div>
  );
  const card: React.CSSProperties = { background: 'var(--panel,#161c2e)', border: '1px solid var(--line,#2a3350)', borderRadius: 14, padding: 16, marginBottom: 14 };
  return (
    <div>
      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      <div style={card}>
        <b>Embudo de conversión (global)<Hint text="El recorrido del cliente en 4 pasos: Clics en enlaces de vendedores → Registros → Pruebas dadas → Pagados. La caída entre pasos te dice dónde se pierde la gente. Abajo lo ves por cada vendedor para saber quién convierte de verdad." /></b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {stage('Clics', t.clicks, 'var(--tx,#e8ecf5)')}<span className="muted">→</span>
          {stage('Registros', t.signups, '#8b93ff')}<span className="muted">→</span>
          {stage('Pruebas', t.trials, '#e5b567')}<span className="muted">→</span>
          {stage('Pagados', t.paid, '#5ed6a0')}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Conversión registro→pagado: <b style={{ color: 'var(--tx,#e8ecf5)' }}>{t.signups > 0 ? Math.round((t.paid / t.signups) * 100) : 0}%</b></div>
      </div>

      <div style={card}>
        <b>Por vendedor</b>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460, fontSize: 13 }}>
            <thead><tr style={{ color: 'var(--mut,#9aa6bd)', fontSize: 11.5, textAlign: 'right' }}>
              <th style={{ padding: '6px', textAlign: 'left' }}>Vendedor</th><th style={{ padding: '6px' }}>Clics</th><th style={{ padding: '6px' }}>Registros</th><th style={{ padding: '6px' }}>Pruebas</th><th style={{ padding: '6px' }}>Pagados</th><th style={{ padding: '6px' }}>Conv.</th>
            </tr></thead>
            <tbody>
              {(funnel?.rows || []).map((r: any) => (
                <tr key={r.rep_id} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                  <td style={{ padding: '7px 6px', color: 'var(--tx,#e8ecf5)' }}>{r.name} <span className="muted" style={{ fontSize: 11 }}>· {lvName(r.level)}</span></td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: 'var(--mut,#9aa6bd)' }}>{r.clicks}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#8b93ff' }}>{r.signups}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#e5b567' }}>{r.trials}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#5ed6a0' }}>{r.paid}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{r.conv}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <b>Leads sin dueño ({leads.length})<Hint text="Usuarios registrados que NO llegaron por el enlace de ningún vendedor, así que no tienen comisionista asignado. 'Repartir ahora' los distribuye entre los vendedores (el de menos clientes primero). 'Ascender ahora' revisa quién cumple umbral y sube de nivel." /></b>
          {canManage && <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnP} onClick={async () => { const j = await post({ action: 'assign_leads' }); setMsg(`Repartidos ${j.assigned || 0} leads ✓`); load(); }}>Repartir ahora</button>
            <button style={btn} onClick={async () => { const j = await post({ action: 'promote_now' }); setMsg(`Ascendidos ${j.promoted || 0} ✓`); load(); }}>Ascender ahora</button>
          </div>}
        </div>
        <div className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>Usuarios registrados sin vendedor asignado. «Repartir» los balancea entre los vendedores (menos cargados primero).</div>
        {!leads.length ? <div className="muted">Todos los usuarios ya tienen vendedor. 🎉</div> :
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {leads.slice(0, 50).map((l: any) => (
                  <tr key={l.user_id} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                    <td style={{ padding: '7px 6px', color: 'var(--tx,#e8ecf5)' }}>{l.email || l.name || l.user_id.slice(0, 8)}</td>
                    <td style={{ padding: '7px 6px', color: 'var(--mut,#9aa6bd)' }}>{l.plan}</td>
                    <td style={{ padding: '7px 6px', color: 'var(--mut,#9aa6bd)', fontSize: 12, textAlign: 'right' }}>{l.since ? new Date(l.since).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length > 50 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>… y {leads.length - 50} más.</div>}
          </div>}
      </div>
    </div>
  );
}

// ===== METAS: progreso + editor por vendedor =====
function MetasBox({ inp, btn, btnP, canManage, lvName, LV }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState('');
  async function post(body: any) {
    const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  async function load() {
    setBusy(true);
    try { const j = await post({ action: 'goals' }); setRows(j.rows || []); setPeriod(j.period || ''); } catch {}
    setBusy(false);
  }
  useEffect(() => { load(); }, []);
  if (busy) return <div className="muted">Cargando metas…</div>;
  return (
    <div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}><span>Metas del mes <b style={{ color: 'var(--tx,#e8ecf5)' }}>{period}</b>. En blanco = usa la meta global (Ajustes). El bono se paga solo como comisión al cumplir.</span><Hint text="El objetivo mensual de cada vendedor y su avance en vivo (clientes nuevos y comisión generada). Fija una meta propia a alguien o deja los campos en blanco para usar la meta global de Ajustes. Al cumplir, el bono se acredita solo." /></div>
      {msg && <div style={{ border: '1px solid var(--accent,#8b93ff)', color: 'var(--accent,#8b93ff)', borderRadius: 10, padding: '7px 12px', marginBottom: 10, fontSize: 13 }}>{msg}</div>}
      {!rows.length && <div className="muted">No hay vendedores activos.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((r) => <RepGoalRow key={r.rep_id} r={r} period={period} lvName={lvName} LV={LV} inp={inp} btn={btn} btnP={btnP} canManage={canManage} post={post} onSaved={(m: string) => { setMsg(m); load(); }} />)}
      </div>
    </div>
  );
}

function RepGoalRow({ r, period, lvName, LV, inp, btn, btnP, canManage, post, onSaved }: any) {
  const [tc, setTc] = useState(String(r.goal?.target_clients ?? ''));
  const [ta, setTa] = useState(String(r.goal?.target_amount ?? ''));
  const [bo, setBo] = useState(String(r.goal?.bonus_amount ?? ''));
  const p = r.progress || {};
  const c = (LV as any)[r.level] || (LV as any).vendedor;
  const bar = (cur: number, tgt: number) => {
    const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    return <div style={{ height: 7, borderRadius: 5, background: 'var(--bg,#0e1220)', overflow: 'hidden', minWidth: 90, flex: 1 }}><div style={{ width: pct + '%', height: '100%', background: pct >= 100 ? 'var(--green,#5ed6a0)' : 'var(--accent,#8b93ff)' }} /></div>;
  };
  return (
    <div style={{ background: 'var(--card,#1b2338)', border: `1px solid ${c.bd}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ color: c.fg, fontSize: 14 }}>{r.name}</b>
        <span className="muted" style={{ fontSize: 11.5 }}>· {lvName(r.level)}</span>
        {p.met && <span style={{ fontSize: 11.5, color: 'var(--green,#5ed6a0)', fontWeight: 700 }}>✓ cumplió</span>}
        {r.goal?.custom && <span style={{ fontSize: 11, color: '#e5b567' }}>meta propia</span>}
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
          <span className="muted" style={{ fontSize: 12 }}>Clientes {p.clients}/{p.target_clients || '—'}</span>{bar(p.clients || 0, p.target_clients || 0)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
          <span className="muted" style={{ fontSize: 12 }}>Comisión ${p.amount}/${p.target_amount || '—'}</span>{bar(p.amount || 0, p.target_amount || 0)}
        </div>
      </div>
      {canManage && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--line,#2a3350)', paddingTop: 10 }}>
        <label style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Clientes<input type="number" value={tc} onChange={(e) => setTc(e.target.value)} style={{ ...inp, width: 70, display: 'block', marginTop: 3 }} /></label>
        <label style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Comisión $<input type="number" value={ta} onChange={(e) => setTa(e.target.value)} style={{ ...inp, width: 80, display: 'block', marginTop: 3 }} /></label>
        <label style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Bono $<input type="number" value={bo} onChange={(e) => setBo(e.target.value)} style={{ ...inp, width: 80, display: 'block', marginTop: 3 }} /></label>
        <button style={{ ...btnP, alignSelf: 'flex-end' }} onClick={async () => { await post({ action: 'set_goal', rep_id: r.rep_id, period, target_clients: Number(tc) || 0, target_amount: Number(ta) || 0, bonus_amount: Number(bo) || 0 }); onSaved('Meta guardada ✓'); }}>Guardar meta</button>
        {r.goal?.custom && <button style={{ ...btn, alignSelf: 'flex-end' }} onClick={async () => { await post({ action: 'del_goal', rep_id: r.rep_id, period }); onSaved('Volvió a la meta global ✓'); }}>Usar global</button>}
      </div>}
    </div>
  );
}

function SettingsBox({ s, names, act, inp, btnP, canManage }: any) {
  const [f, setF] = useState({ ...s, level_names: names });
  useEffect(() => { setF({ ...s, level_names: names }); }, [s]);
  const u = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const un = (k: string, v: any) => setF((x: any) => ({ ...x, level_names: { ...x.level_names, [k]: v } }));
  const uscope = (k: string, v: any) => setF((x: any) => ({ ...x, commission_scope: { ...(x.commission_scope || {}), [k]: v } }));
  const uth = (k: string, v: any) => setF((x: any) => ({ ...x, tier_thresholds: { ...(x.tier_thresholds || {}), [k]: Number(v) } }));
  const urev = (k: string, v: any) => setF((x: any) => ({ ...x, review: { ...(x.review || {}), [k]: v } }));
  const scope = f.commission_scope || {};
  const th = f.tier_thresholds || { star: 75, risk: 45 };
  const rev = f.review || { enabled: true, after_days: 20, email: false };
  const scopeTog = (k: string, label: string, hint?: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)', padding: '2px 0' }}>
      <input type="checkbox" checked={!!scope[k]} onChange={(e) => uscope(k, e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
      <span>{label}{hint && <span className="muted" style={{ fontSize: 11.5 }}> · {hint}</span>}</span>
    </label>
  );
  const card: React.CSSProperties = { background: 'var(--card,#1b2338)', border: '1px solid var(--line,#2a3350)', borderRadius: 12, padding: 16, marginBottom: 12 };
  const num = (k: string, label: string, suf = '', hint = '') => (
    <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', display: 'block' }}><span>{label}{hint && <Hint text={hint} />}</span><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><input type="number" value={f[k] ?? 0} onChange={(e) => u(k, Number(e.target.value))} style={{ ...inp, width: 90 }} />{suf && <span className="muted">{suf}</span>}</div></label>
  );
  const tog = (k: string, label: string, hint = '') => (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)', padding: '2px 0' }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => u(k, e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
      <span>{label}{hint && <Hint text={hint} />}</span>
    </label>
  );
  return (
    <div>
      <div style={card}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{ic('pencil', 15)} Nombres de las posiciones</b>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ fontSize: 12.5, color: LV.l2.fg }}>Nivel 2 (arriba)<input value={f.level_names?.l2 || ''} onChange={(e) => un('l2', e.target.value)} placeholder="Director" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
          <label style={{ fontSize: 12.5, color: LV.l1.fg }}>Nivel 1<input value={f.level_names?.l1 || ''} onChange={(e) => un('l1', e.target.value)} placeholder="Líder" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
          <label style={{ fontSize: 12.5, color: LV.vendedor.fg }}>Vendedor<input value={f.level_names?.vendedor || ''} onChange={(e) => un('vendedor', e.target.value)} placeholder="Asesor" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
        </div>
      </div>
      <div data-guide="comisiones" style={card}>
        <b>Comisiones (% del pago mensual)<Hint text="El % que gana la red por cada pago del cliente. Directo = quien cerró la venta. Override 1 y 2 = los dos niveles arriba de él en el árbol. Se cobra cada mes que el cliente siga pagando." /></b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('direct_rate', 'Vendedor directo', '%')}
          {num('override1_rate', 'Override Nivel 1', '%')}
          {num('override2_rate', 'Override Nivel 2', '%')}
          {num('commission_months', 'Meses (0 = ∞)')}
        </div>
        {(() => {
          const dr = Number(f.direct_rate) || 0, o1 = Number(f.override1_rate) || 0, o2 = Number(f.override2_rate) || 0;
          const nm2 = f.level_names?.l2 || 'Director', nm1 = f.level_names?.l1 || 'Lead', nmv = f.level_names?.vendedor || 'Advisor';
          const m = (pct: number) => pct > 0 ? '$' + pct.toFixed(0) : '—';   // sobre $100
          const months = Number(f.commission_months) || 0;
          const th: React.CSSProperties = { textAlign: 'right', padding: '6px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)', fontWeight: 600, borderBottom: '1px solid var(--line,#2a3350)' };
          const td: React.CSSProperties = { textAlign: 'right', padding: '7px 8px', fontSize: 12.5, borderBottom: '1px solid var(--line,#2a3350)' };
          const first: React.CSSProperties = { ...td, textAlign: 'left', color: 'var(--tx,#e8ecf5)', fontWeight: 500 };
          const rows = [
            { who: nm2, adv: 0, lead: 0, dir: dr },   // Director cierra: cobra directo, nadie arriba
            { who: nm1, adv: 0, lead: dr, dir: o1 },   // Lead cierra: directo + Director (override1)
            { who: nmv, adv: dr, lead: o1, dir: o2 },  // Advisor cierra: cadena completa
          ];
          return (
            <div style={{ marginTop: 14, background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)', lineHeight: 1.55, marginBottom: 10 }}>
                <b style={{ color: 'var(--tx,#e8ecf5)' }}>Reparto por venta</b> · el % lo gana <b>quien cierra</b> (su enlace); los overrides son para quienes están arriba. Ejemplo con un cliente de <b>$100/mes</b>:
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 380 }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left' }}>Quién cierra</th>
                    <th style={th}>{nmv}</th><th style={th}>{nm1}</th><th style={th}>{nm2}</th><th style={{ ...th, color: 'var(--tx,#e8ecf5)' }}>Total</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={first}>{r.who}</td>
                        <td style={{ ...td, color: r.adv ? '#5ed6a0' : 'var(--mut,#9aa6bd)' }}>{m(r.adv)}</td>
                        <td style={{ ...td, color: r.lead ? '#5ed6a0' : 'var(--mut,#9aa6bd)' }}>{m(r.lead)}</td>
                        <td style={{ ...td, color: r.dir ? '#e5b567' : 'var(--mut,#9aa6bd)' }}>{m(r.dir)}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>${(r.adv + r.lead + r.dir).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 10 }}>Se repite {months === 0 ? 'cada mes que el cliente siga pagando (Meses = ∞)' : `durante los primeros ${months} meses de cada cliente`}. Los valores cambian solos si editas los % de arriba.</div>
            </div>
          );
        })()}
      </div>

      {/* IMPULSO 1.er MES + RESIDUAL · paga fuerte el primer mes para motivar al
          vendedor y un % menor recurrente para cuidar el margen. */}
      <div data-guide="impulso" style={{ ...card, borderColor: f.boost_first_month ? '#e5b567' : 'var(--line,#2a3350)' }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{ic('rocket', 15)} Impulso 1.er mes + residual
          <Hint text="El motor de tu equipo. Pagas un % ALTO el primer pago de cada cliente nuevo (motiva a vender) y un % MENOR cada mes siguiente (cuida tu margen a largo plazo). Con esto un vendedor gana más que un embajador el primer mes, pero tú no arrastras 30% para siempre." />
        </b>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>
          Front-load: un golpe fuerte el primer mes atrae y retiene vendedores; el residual bajo mantiene sano el margen. Apagado, se usan los % normales de arriba todos los meses.
        </div>
        <div style={{ marginTop: 12 }}>{tog('boost_first_month', 'Activar impulso del primer mes', 'Si está apagado, cada mes (incluido el primero) usa los % normales de la sección Comisiones.')}</div>
        {f.boost_first_month && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e5b567', margin: '14px 0 6px' }}>% SOLO del primer pago de cada cliente</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {num('first_direct_rate', 'Directo 1.er mes', '%', 'El % que gana quien cerró la venta, solo en el primer pago del cliente. Suele ser alto (ej. 40–50%) para motivar.')}
              {num('first_override1_rate', 'Override 1 · 1.er mes', '%', 'Override del nivel de arriba, solo el primer pago.')}
              {num('first_override2_rate', 'Override 2 · 1.er mes', '%', 'Override del segundo nivel arriba, solo el primer pago.')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 8, lineHeight: 1.5 }}>
              A partir del 2.º mes se usan los % normales de la sección <b>Comisiones</b> (el residual). Los <b>Meses (0 = ∞)</b> de esa sección siguen mandando cuántos meses en total se paga.
            </div>

            {/* BONO PRIMERAS VENTAS */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line,#2a3350)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', display: 'flex', alignItems: 'center', gap: 6 }}>{ic('gift', 14)} Bono primeras ventas
                <Hint text="Un premio único (una sola vez por vendedor) cuando el vendedor llega a X clientes que ya pagaron. Acelera el arranque: le da una meta clara y una recompensa por despegar. Pon 0 en cualquiera para desactivarlo." />
              </div>
              <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', margin: '3px 0 10px', lineHeight: 1.5 }}>
                Extra único al llegar a X clientes de pago. Se paga una sola vez por vendedor. 0 = desactivado.
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {num('first_sales_count', 'Al llegar a (clientes)', '', 'Cuántos clientes que ya pagaron necesita el vendedor para ganar el bono. Ej. 5.')}
                {num('first_sales_bonus', 'Bono', '$', 'Monto fijo del premio único cuando alcanza la meta. Se acredita como comisión y se paga con su siguiente pago.')}
              </div>
            </div>

            {/* EJEMPLO 1.er mes vs recurrente */}
            {(() => {
              const fd = Number(f.first_direct_rate) || 0, nd = Number(f.direct_rate) || 0;
              const price = 100;
              const box: React.CSSProperties = { flex: '1 1 150px', background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '12px 14px' };
              const big: React.CSSProperties = { fontSize: 22, fontWeight: 800, lineHeight: 1 };
              return (
                <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ ...box, borderColor: '#e5b567' }}>
                    <div style={{ fontSize: 11.5, color: '#e5b567', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Primer mes</div>
                    <div style={{ ...big, color: '#e5b567', marginTop: 8 }}>${(price * fd / 100).toFixed(0)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 4 }}>{fd}% de un cliente de ${price}</div>
                  </div>
                  <div style={box}>
                    <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Cada mes después</div>
                    <div style={{ ...big, color: '#5ed6a0', marginTop: 8 }}>${(price * nd / 100).toFixed(0)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginTop: 4 }}>{nd}% recurrente</div>
                  </div>
                  <div style={{ ...box, flex: '1 1 100%' }}>
                    <div style={{ fontSize: 12, color: 'var(--tx,#e8ecf5)', lineHeight: 1.55 }}>
                      Un vendedor que cierra un cliente de <b>${price}/mes</b> gana <b style={{ color: '#e5b567' }}>${(price * fd / 100).toFixed(0)}</b> el primer mes y luego <b style={{ color: '#5ed6a0' }}>${(price * nd / 100).toFixed(0)}</b> cada mes que siga pagando. En un año son <b>${(price * fd / 100 + price * nd / 100 * 11).toFixed(0)}</b> por ese solo cliente — más que un embajador el primer mes, pero sin cargar tu margen para siempre.
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      <div style={card}>
        <b>Topes, pagos y frenos</b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
          {num('trial_max_days', 'Máx. días de prueba', '', 'Cuántos días de acceso gratis puede dar un vendedor a un cliente en UNA prueba. Si pide más, el sistema lo recorta a este tope.')}
          {num('discount_max_pct', 'Máx. descuento', '%', 'El % de descuento máximo que un vendedor puede generar en un cupón. Aunque escriba más, se recorta a este valor.')}
          {num('hold_days', 'Retención (días)', '', 'Días que una comisión queda "madurando" antes de estar disponible para pagar. Protege ante reembolsos: si el cliente pide devolución en este plazo, la comisión se anula sin haberse pagado.')}
          {num('min_payout', 'Mínimo para pagar', '$', 'Saldo mínimo que un vendedor debe acumular para que el pago automático se dispare. Debajo de esto, el saldo se sigue juntando pero no se paga aún.')}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line,#2a3350)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>Candados anti-abuso</div>
          <div style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)', margin: '3px 0 10px', lineHeight: 1.5 }}>
            Evita que un vendedor deje a un cliente gratis para siempre o inunde de cupones. <b>0 = sin límite.</b> Se aplican en el servidor, no solo en la pantalla.
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {num('trial_max_per_client', 'Máx. pruebas por cliente', '', 'Cuántas veces (de cualquier vendedor) un mismo cliente puede recibir prueba gratis. Con 1, evita que le den prueba tras prueba y quede gratis para siempre. 0 = sin límite.')}
            {num('trial_max_total_days', 'Máx. días gratis por cliente', '', 'Tope de días gratis ACUMULADOS por cliente, sumando todas sus pruebas. Al llegar, no se le dan más; si pide más de los que quedan, se recorta. 0 = sin límite.')}
            {num('trial_daily_cap', 'Máx. pruebas por día (vendedor)', '', 'Cuántas pruebas puede dar UN vendedor en 24 horas. Frena que inunde de pruebas a muchos de golpe. 0 = sin límite.')}
            {num('discount_daily_cap', 'Máx. cupones por día (vendedor)', '', 'Cuántos cupones de descuento puede generar UN vendedor en 24 horas. 0 = sin límite.')}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 6, marginTop: 14, maxWidth: 460 }}>
          {tog('enabled', 'Programa activo', 'Interruptor maestro de toda la red de ventas. Apagado, no se acredita ninguna comisión ni se paga nada.')}
          {tog('auto_payout', 'Pago automático cuando el saldo madura', 'Si está activo, el sistema paga solo a cada vendedor cuando su saldo maduró y supera el mínimo. Apagado, tienes que pagar tú a mano en la pestaña Pagos.')}
          {tog('review_before_pay', 'Freno global: revisar antes de pagar', 'Pausa TODOS los pagos automáticos. Las comisiones se siguen acumulando, pero nadie cobra hasta que tú lo revises y pagues a mano. Útil si sospechas de algo.')}
          {tog('allow_recruit', 'Los supervisores pueden reclutar su equipo', 'Permite que Leads y Directores añadan/inviten vendedores a su propia rama. Apagado, solo tú (admin) puedes mover gente en la red.')}
        </div>
      </div>
      <div style={card}>
        <b>Permisos por nivel<Hint text="Define qué puede hacer cada posición (Advisor/Lead/Director) por defecto: dar pruebas, descuentos, gestionar clientes, atender tickets, reclutar y ver su equipo. Puedes anularlo persona por persona en su tarjeta." /></b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Lo que cada posición puede hacer por defecto. Puedes anularlo persona por persona en su tarjeta (La red → Editar → Permisos personalizados).
        </div>
        {(() => {
          const PD = f.perms_defaults || {};
          const DEF_ALL = { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: true, can_team: true };
          const DEF_SELLER = { can_trial: true, can_discount: true, can_clients: true, can_tickets: true, can_recruit: false, can_team: false };
          const rowDef = (lv: string) => ({ ...(lv === 'vendedor' ? DEF_SELLER : DEF_ALL), ...((PD as any)[lv] || {}) });
          const setp = (lv: string, k: string, v: boolean) => setF((x: any) => ({ ...x, perms_defaults: { ...(x.perms_defaults || {}), [lv]: { ...rowDef(lv), [k]: v } } }));
          const PERMS: [string, string][] = [['can_trial', 'Dar pruebas'], ['can_discount', 'Dar descuentos'], ['can_clients', 'Gestionar clientes'], ['can_tickets', 'Atender tickets'], ['can_recruit', 'Reclutar equipo'], ['can_team', 'Ver equipo']];
          const cols: [string, string, string][] = [['vendedor', f.level_names?.vendedor || 'Advisor', LV.vendedor.fg], ['l1', f.level_names?.l1 || 'Lead', LV.l1.fg], ['l2', f.level_names?.l2 || 'Director', LV.l2.fg]];
          return (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 420, width: '100%' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Permiso</th>
                  {cols.map(([lv, label, fg]) => <th key={lv} style={{ padding: '4px 8px', fontSize: 11.5, color: fg, fontWeight: 700 }}>{label}</th>)}
                </tr></thead>
                <tbody>
                  {PERMS.map(([k, label]) => (
                    <tr key={k} style={{ borderTop: '1px solid var(--line,#2a3350)' }}>
                      <td style={{ padding: '6px 8px', fontSize: 13, color: 'var(--tx,#e8ecf5)' }}>{label}</td>
                      {cols.map(([lv]) => (
                        <td key={lv} style={{ textAlign: 'center', padding: '6px 8px' }}>
                          <input type="checkbox" checked={!!(rowDef(lv) as any)[k]} onChange={(e) => setp(lv, k, e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>«Reclutar» y «Ver equipo» solo aplican a Lead/Director. Un vendedor con permiso personalizado ignora esta tabla.</div>
      </div>
      <div style={card}>
        <b>Sobre qué servicios se paga comisión<Hint text="Enciende las líneas de ingreso por las que SÍ se paga comisión de ventas. Academia y Bot Lab vienen apagadas porque ya pagan al mentor/creador; si las enciendes, usa la 'Comisión por línea' de abajo para no doblar el pago." /></b>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          {scopeTog('subscriptions', 'Suscripciones y planes', 'recomendado')}
          {scopeTog('addons', 'Add-ons y cuentas extra')}
          {scopeTog('guardian', 'Onyx Guardian')}
          {scopeTog('academy', 'Academia', 'ya paga a los mentores')}
          {scopeTog('botlab', 'Bot Lab', 'ya paga a los creadores')}
          {scopeTog('copy', 'Comisiones de Copy')}
        </div>
      </div>
      <div style={{ ...card, borderLeft: '4px solid #a679ff' }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{ic('cash', 16, '#a679ff')} Comisión por línea (opcional)<Hint text="Un % propio (más bajo) solo para Academia, Bot Lab o Copy, que ya pagan al mentor/creador. Así el vendedor cobra un incentivo sin doblar el pago. En blanco = usa el % global de arriba. Recuerda encender la línea en 'Sobre qué servicios se paga comisión'." /></b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Academia y Bot Lab <b>ya pagan</b> al mentor/creador. Si activas su comisión de ventas, pon aquí un <b>% propio más bajo</b> (sale de la parte de Onyx) para no doblar el pago. En blanco = usa el % global de arriba.
        </div>

        {/* Mini-diagrama: cómo se reparte una venta (explica qué es el override). */}
        <div style={{ background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '10px 12px', margin: '12px 0' }}>
          <div style={{ fontSize: 11.5, color: 'var(--mut,#9aa6bd)', marginBottom: 8 }}>Cuando alguien vende, la comisión sube por la red:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[{ ic: 'user', c: '#5ed6a0', t: names.vendedor || 'Vendedor', s: 'cerró la venta', tag: 'Directo' },
              { ic: 'users-group', c: '#a9b0ff', t: names.l1 || 'Líder', s: 'jefe de arriba', tag: 'Override 1' },
              { ic: 'crown', c: '#e5b567', t: names.l2 || 'Director', s: 'jefe de más arriba', tag: 'Override 2' }].map((p, i) => (
              <Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--mut,#9aa6bd)' }}>→</span>}
                <div style={{ flex: 1, minWidth: 92, textAlign: 'center', border: `1px solid ${p.c}55`, borderRadius: 9, padding: '8px 6px' }}>
                  <span style={{ color: p.c }}>{ic(p.ic, 17, p.c)}</span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: p.c }}>{p.t}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)' }}>{p.s}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: p.c, marginTop: 2 }}>{p.tag}</div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        {(() => {
          const lr = f.line_rates || {};
          const ulr = (line: string, slot: string, v: string) => setF((x: any) => ({ ...x, line_rates: { ...(x.line_rates || {}), [line]: { ...((x.line_rates || {})[line] || {}), [slot]: v === '' ? null : Number(v) } } }));
          const val = (line: string, slot: string) => { const v = (lr as any)[line]?.[slot]; return v == null ? '' : v; };
          const inpS: React.CSSProperties = { ...inp, width: 72, textAlign: 'right' };
          const lines: [string, string, string, string][] = [['academy', 'Academia', 'school', '#a679ff'], ['botlab', 'Bot Lab', 'robot', '#e5b567'], ['copy', 'Copy', 'copy', '#4f9dff']];
          const gl = { direct: f.direct_rate, override1: f.override1_rate, override2: f.override2_rate };
          const cols: [string, string][] = [['direct', names.vendedor || 'El vendedor'], ['override1', names.l1 || 'Su líder'], ['override2', names.l2 || 'Su director']];
          return (
            <div style={{ overflowX: 'auto', marginTop: 4 }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 400, width: '100%' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>Línea</th>
                  {cols.map(([slot, label]) => (
                    <th key={slot} style={{ textAlign: 'center', padding: '4px 8px', fontSize: 11.5, color: 'var(--mut,#9aa6bd)' }}>{label}<div style={{ fontSize: 10, opacity: .7 }}>{slot === 'direct' ? 'Directo %' : slot === 'override1' ? 'Override 1 %' : 'Override 2 %'}</div></th>
                  ))}
                </tr></thead>
                <tbody>
                  {lines.map(([k, label, icn, col]) => (
                    <tr key={k}>
                      <td style={{ padding: '6px 8px', fontSize: 13, color: 'var(--tx,#e8ecf5)', borderLeft: `3px solid ${col}` }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{ic(icn, 16, col)} {label}</span></td>
                      {(['direct', 'override1', 'override2'] as const).map((slot) => (
                        <td key={slot} style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <input type="number" value={val(k, slot)} onChange={(e) => ulr(k, slot, e.target.value)} placeholder={String((gl as any)[slot] ?? 0)} style={inpS} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Recuerda activar la línea arriba para que se pague; aquí solo defines el %.</div>
      </div>
      <div style={card}>
        <b>Umbrales del plan de manejo (puntaje 0-100)<Hint text="El puntaje del vendedor (mezcla reseñas, conversión, actividad, atención y retención) lo clasifica en tres estados. Estrella = igual o mayor al primer número. En riesgo = menor al segundo. Entre ambos = Sólido." /></b>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12.5, color: '#e5b567' }}>Estrella ≥<input type="number" value={th.star} onChange={(e) => uth('star', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <label style={{ fontSize: 12.5, color: '#f0736f' }}>En riesgo &lt;<input type="number" value={th.risk} onChange={(e) => uth('risk', e.target.value)} style={{ ...inp, display: 'block', marginTop: 4, width: 90 }} /></label>
          <span className="muted" style={{ fontSize: 12 }}>Entre ambos = Sólido.</span>
        </div>
      </div>
      <div style={card}>
        <b>Criterios de evaluación 360<Hint text="Los aspectos que se califican cuando un supervisor evalúa a su equipo y viceversa (comunicación, conocimiento, puntualidad, etc.). Uno por línea; puedes cambiarlos." /></b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Uno por línea. Se usan en las evaluaciones supervisor↔vendedor.</div>
        <textarea value={(f.eval_criteria || []).join('\n')} onChange={(e) => u('eval_criteria', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12))}
          style={{ ...inp, marginTop: 8, width: '100%', minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>
      <div style={card}>
        <b>Reseñas de clientes<Hint text="Pide automáticamente al cliente que califique a su vendedor después de X días de ser cliente. Las reseñas alimentan el puntaje del vendedor." /></b>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', color: 'var(--tx,#e8ecf5)' }}>
            <input type="checkbox" checked={!!rev.enabled} onChange={(e) => urev('enabled', e.target.checked)} style={{ width: 16, height: 16, flex: 'none', margin: 0 }} />
            <span>Pedir reseña al cliente automáticamente</span>
          </label>
          <label style={{ fontSize: 12.5, color: 'var(--mut,#9aa6bd)' }}>Pedirla después de<input type="number" value={rev.after_days} onChange={(e) => urev('after_days', Number(e.target.value))} style={{ ...inp, width: 90, margin: '0 8px' }} />días de ser cliente</label>
        </div>
      </div>
      <div style={{ ...card, borderLeft: '4px solid #5ed6a0' }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{ic('target', 16, '#5ed6a0')} Metas por defecto (mensuales)</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Lo que cada vendedor debe lograr al mes. Al cumplir, gana el bono. Puedes fijar una meta propia por persona en la pestaña «Metas».
        </div>
        {/* Fórmula visual: (clientes o comisión) → bono */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch', marginTop: 12 }}>
          <div style={{ flex: '1 1 130px', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>Trae … clientes nuevos</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><input type="number" value={f.goal_clients ?? 0} onChange={(e) => u('goal_clients', Number(e.target.value))} style={{ ...inp, width: 80 }} /><span className="muted" style={{ fontSize: 12 }}>clientes</span></div>
          </div>
          <div style={{ alignSelf: 'center', color: 'var(--mut,#9aa6bd)', fontSize: 12, fontWeight: 700 }}>o</div>
          <div style={{ flex: '1 1 130px', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--mut,#9aa6bd)' }}>… o genera de comisión</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><span className="muted">$</span><input type="number" value={f.goal_amount ?? 0} onChange={(e) => u('goal_amount', Number(e.target.value))} style={{ ...inp, width: 90 }} /></div>
          </div>
          <div style={{ alignSelf: 'center' }}>{ic('plus', 16, '#5ed6a0')}<span style={{ display: 'block', height: 0 }} /></div>
          <div style={{ flex: '1 1 130px', border: '1px solid #e5b56766', borderRadius: 10, padding: '10px 12px', background: 'rgba(229,181,103,.06)' }}>
            <div style={{ fontSize: 11, color: '#e5b567', display: 'flex', alignItems: 'center', gap: 5 }}>{ic('gift', 13, '#e5b567')} Bono al cumplir</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><span style={{ color: '#e5b567' }}>$</span><input type="number" value={f.goal_bonus ?? 0} onChange={(e) => u('goal_bonus', Number(e.target.value))} style={{ ...inp, width: 90 }} /></div>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>Pon 0 en clientes o en comisión si no quieres medir por ese lado. El bono se paga como comisión extra al cumplir.</div>
      </div>
      <div style={card}>
        <b>Notificaciones al vendedor</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Avísale por app, correo y Telegram cuando pasa algo importante.</div>
        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 460 }}>
          {tog('notify_new_client', 'Cliente nuevo con su enlace', 'Avisa al vendedor cuando alguien se registra usando su enlace de invitación.')}
          {tog('notify_first_paid', 'Primer pago de un cliente', 'Avisa cuando uno de sus clientes hace su primer pago (empieza a generar comisión).')}
          {tog('notify_commission', 'Comisión ganada', 'Avisa cada vez que se le acredita una comisión.')}
          {tog('notify_payout', 'Pago enviado', 'Avisa cuando le pagas su saldo (por Stripe, USDT o manual).')}
        </div>
      </div>
      <div style={{ ...card, borderLeft: '4px solid #4f9dff' }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{ic('stairs', 16, '#4f9dff')} Ascensos y reparto automáticos</b>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          Suben solos de nivel al llegar al umbral. Reversible: puedes degradar a alguien a mano y apagar esto cuando quieras.
        </div>

        {/* Escalera visual Vendedor → Líder → Director con su umbral */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: '14px 0 4px' }}>
          <div style={{ flex: 1, textAlign: 'center', border: '1px solid #5ed6a066', borderRadius: 10, padding: '8px 4px' }}>
            {ic('user', 17, '#5ed6a0')}<div style={{ fontSize: 12.5, fontWeight: 600, color: '#5ed6a0' }}>{names.vendedor || 'Advisor'}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 'none' }}>
            <input type="number" value={f.promote_to_l1_clients ?? 0} onChange={(e) => u('promote_to_l1_clients', Number(e.target.value))} style={{ ...inp, width: 56, textAlign: 'center', padding: '5px 4px' }} />
            <div style={{ fontSize: 10, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>clientes →</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', border: '1px solid #a9b0ff66', borderRadius: 10, padding: '15px 4px' }}>
            {ic('users-group', 17, '#a9b0ff')}<div style={{ fontSize: 12.5, fontWeight: 600, color: '#a9b0ff' }}>{names.l1 || 'Lead'}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 'none' }}>
            <input type="number" value={f.promote_to_l2_team ?? 0} onChange={(e) => u('promote_to_l2_team', Number(e.target.value))} style={{ ...inp, width: 56, textAlign: 'center', padding: '5px 4px' }} />
            <div style={{ fontSize: 10, color: 'var(--mut,#9aa6bd)', marginTop: 2 }}>en equipo →</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', border: '1px solid #e5b56766', borderRadius: 10, padding: '22px 4px' }}>
            {ic('crown', 17, '#e5b567')}<div style={{ fontSize: 12.5, fontWeight: 600, color: '#e5b567' }}>{names.l2 || 'Director'}</div>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Escribe el umbral en cada flecha. 0 = desactiva ese ascenso.</div>

        <div style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 520 }}>
          {tog('auto_promote', 'Ascender de nivel automáticamente al llegar al umbral', 'Sube solo a un vendedor cuando alcanza los umbrales de arriba. El descenso NO es automático: lo haces tú a mano en la tarjeta de la persona. Apagado, no sube nadie solo.')}
          {tog('auto_assign_leads', 'Repartir leads sin dueño entre vendedores (round-robin)', 'Cuando alguien se registra SIN el enlace de un vendedor, el sistema lo asigna solo al vendedor con menos clientes. Apagado, esos leads quedan sin dueño hasta que los repartas a mano en Crecimiento.')}
          {tog('recruit_auto_approve', 'Reclutamiento en cascada: aprobar solo a quien entra por el enlace de un supervisor', 'Cada supervisor tiene su enlace personal de reclutamiento (aparece en su panel). Con esto ENCENDIDO, si el candidato ya tiene cuenta en la app, se cuelga solo en la rama de quien lo trajo. Apagado (recomendado al inicio): la solicitud llega a Solicitudes ya marcada con quién lo trajo, y tú la apruebas.')}
        </div>
      </div>

      <ProposalCard f={f} names={names} inp={inp} btnP={btnP} card={card} />

      {canManage && <button style={btnP} onClick={() => act({ action: 'save_settings', settings: f })}>Guardar ajustes</button>}
    </div>
  );
}

// Propuesta para vendedores: vista previa en vivo (usa los ajustes en pantalla),
// descargar PDF y enviar por email. Todo se recalcula al cambiar cualquier %.
function ProposalCard({ f, names, inp, btnP, card }: any) {
  const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line,#2a3350)', background: 'var(--panel,#161c2e)', color: 'var(--tx,#e8ecf5)', cursor: 'pointer', fontSize: 12.5 };
  const [price, setPrice] = useState(100);
  const [cpm, setCpm] = useState(3);           // clientes nuevos por mes (escenario ajustable)
  const [level, setLevel] = useState<'vendedor' | 'l1' | 'l2'>('vendedor');  // tier de la plaza
  const [lang, setLang] = useState<'es' | 'en'>('es');   // idioma del PDF/email
  const [team, setTeam] = useState(5);         // vendedores en su equipo directo
  const [network, setNetwork] = useState(15);  // red total en niveles inferiores (solo Director)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const num = (v: any, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const p = Math.max(1, num(price, 100));
  const perM = Math.max(1, Math.round(num(cpm, 3)));
  const boost = !!f.boost_first_month;
  const fd = boost ? num(f.first_direct_rate, num(f.direct_rate)) : num(f.direct_rate);
  const rd = num(f.direct_rate);
  const cm = num(f.commission_months, 0);
  const monthsPaid = Math.max(1, cm > 0 ? Math.min(cm, 12) : 12);
  const perFirst = Math.round(p * fd / 100), perMonthly = Math.round(p * rd / 100), perYear = perFirst + perMonthly * (monthsPaid - 1);
  const rows = [5, 10, 20].map((c) => ({ c, first: perFirst * c, monthly: perMonthly * c, year: perYear * c }));
  const money = (v: number) => '$' + Math.round(v).toLocaleString('en-US');

  const hasTeam = level === 'l1' || level === 'l2';
  const levelName = level === 'l2' ? (names.l2 || 'Director') : level === 'l1' ? (names.l1 || 'Lead') : (names.vendedor || 'Advisor');
  const teamN = hasTeam ? Math.max(1, Math.round(num(team, 5))) : 0;
  const netN = level === 'l2' ? Math.max(0, Math.round(num(network, 15))) : 0;
  const ov1First = Math.round(p * (boost ? num(f.first_override1_rate, num(f.override1_rate)) : num(f.override1_rate)) / 100);
  const ov1Res = Math.round(p * num(f.override1_rate) / 100);
  const ov2First = Math.round(p * (boost ? num(f.first_override2_rate, num(f.override2_rate)) : num(f.override2_rate)) / 100);
  const ov2Res = Math.round(p * num(f.override2_rate) / 100);

  // --- Bola de nieve: cierras perM clientes cada mes; cada uno paga 1.er mes y
  // luego residual mientras siga en su ventana de comisión (∞ = todo el año). ---
  const residualCap = cm > 0 ? Math.max(0, cm - 1) : 12;
  const snow = (count: number, first: number, res: number) => {
    const arr: number[] = [];
    for (let m = 1; m <= 12; m++) { let inc = count * perM * first; for (let k = 1; k < m; k++) { if ((m - k) <= residualCap) inc += count * perM * res; } arr.push(inc); }
    return arr;
  };
  const monthly = snow(1, perFirst, perMonthly);                                   // directo
  const overrideMonthly = hasTeam ? snow(teamN, ov1First, ov1Res).map((v, i) => v + (netN > 0 ? snow(netN, ov2First, ov2Res)[i] : 0)) : new Array(12).fill(0);
  const combined = monthly.map((v, i) => v + overrideMonthly[i]);
  const totalYear1 = monthly.reduce((a, b) => a + b, 0);
  const overrideTotal = overrideMonthly.reduce((a, b) => a + b, 0);
  const combinedTotal = totalYear1 + overrideTotal;
  const potentialMonthly = monthly[11];
  const overridePotential = overrideMonthly[11];
  const combinedPotential = combined[11];
  const mixFirst = 12 * perM * perFirst;
  const mixResidual = Math.max(0, totalYear1 - mixFirst);
  // Mezcla de la dona: recurrente directo / 1.er mes directo / equipo (si aplica).
  const total3 = Math.max(1, mixFirst + mixResidual + (hasTeam ? overrideTotal : 0));
  const pResid = Math.round(mixResidual / total3 * 100), pFirst = Math.round(mixFirst / total3 * 100), pTeam = Math.round(overrideTotal / total3 * 100);
  const resPct = totalYear1 > 0 ? Math.round((mixResidual / totalYear1) * 100) : 0;

  // Geometría de la curva (usa la serie combinada si hay equipo).
  const series = hasTeam ? combined : monthly;
  const maxV = Math.max(...series, 1);
  const pts = series.map((v, i) => `${8 + (196) * (i / 11)},${86 - 72 * (v / maxV)}`).join(' ');
  const areaPts = `8,86 ${pts} 204,86`;
  // Dona por segmentos (stroke-dasharray sobre un aro).
  const C = 2 * Math.PI * 34;
  const donutSegs = hasTeam
    ? [{ pct: pResid, c: '#5ed6a0' }, { pct: pFirst, c: '#e5b567' }, { pct: pTeam, c: '#a679ff' }]
    : [{ pct: pResid, c: '#5ed6a0' }, { pct: pFirst, c: '#e5b567' }];

  async function call(action: string, extra: any = {}) {
    setBusy(action); setMsg('');
    try {
      const r = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, settings: f, price: p, name, include_overrides: true, clients_per_month: perM, level, team_size: teamN, network_size: netN, lang, ...extra }) });
      const j = await r.json();
      if (j.error) { setMsg('⚠ ' + j.error); return null; }
      return j;
    } catch { setMsg('⚠ Error de red'); return null; } finally { setBusy(''); }
  }
  async function download() {
    const j = await call('proposal_pdf');
    if (j?.pdf) { const a = document.createElement('a'); a.href = 'data:application/pdf;base64,' + j.pdf; a.download = j.filename || 'propuesta.pdf'; a.click(); }
  }
  async function sendMail() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg('⚠ Escribe un correo válido.'); return; }
    const j = await call('proposal_email', { email });
    if (j?.sent) setMsg('Propuesta enviada ✓');
  }

  const why = [
    { i: 'cash', c: '#5ed6a0', t: 'Ingreso que se repite', s: 'No arrancas de cero: cobras cada mes que el cliente sigue.' },
    hasTeam
      ? { i: 'users-group', c: '#a679ff', t: 'Ganas de tu equipo', s: `Tu override entra aunque no cierres tú esa venta.` }
      : { i: 'stairs', c: '#4f9dff', t: 'Subes de nivel solo', s: `${names.vendedor || 'Advisor'} → ${names.l1 || 'Lead'} → ${names.l2 || 'Director'}, y ganas de tu equipo.` },
    { i: 'gift', c: '#e5b567', t: 'Bonos de arranque', s: 'Tus primeras ventas y las metas del mes suman extra.' },
  ];

  return (
    <div style={{ ...card, borderLeft: '4px solid #a9b0ff' }}>
      <b style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{ic('file', 16, '#a9b0ff')} Propuesta para vendedores<Hint text="Genera un PDF de reclutamiento persuasivo con TUS parámetros actuales (impulso 1.er mes, residual, overrides, metas, bono, ascensos). Elige el escenario de clientes/mes y verás el potencial, la mezcla recurrente y la bola de nieve. Si cambias un %, todo se recalcula. Descárgalo o envíalo por correo. También puedes enviarlo desde cada Solicitud." /></b>
      <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
        Todo se calcula en vivo con los ajustes de esta pantalla. Cambia un número arriba (o el escenario) y esto se actualiza solo.
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Plaza / nivel<Hint text="Nivel de la vacante, con los nombres de tus tiers. Un vendedor ve sus ventas directas; un Lead o Director ven además lo que ganan de su equipo (overrides), y el potencial combina ambas fuentes." /><div style={{ marginTop: 4 }}><select value={level} onChange={(e) => setLevel(e.target.value as any)} style={inp}><option value="vendedor">{names.vendedor || 'Advisor'}</option><option value="l1">{names.l1 || 'Lead'}</option><option value="l2">{names.l2 || 'Director'}</option></select></div></label>
        <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Idioma<Hint text="Idioma en el que se genera el PDF y el correo de la propuesta. La vista previa de abajo siempre está en español; el documento que se envía sale en el idioma elegido." /><div style={{ marginTop: 4 }}><select value={lang} onChange={(e) => setLang(e.target.value as any)} style={inp}><option value="es">Español</option><option value="en">English</option></select></div></label>
        <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Cliente de ejemplo<div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}><span className="muted">$</span><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ ...inp, width: 90 }} /><span className="muted">/mes</span></div></label>
        <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Escenario<Hint text="Cuántos clientes nuevos cierra cada vendedor al mes (tú y cada persona de tu equipo). Con esto se calcula el titular, la bola de nieve y el potencial a 12 meses." /><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}><input type="number" min={1} max={30} value={cpm} onChange={(e) => setCpm(Number(e.target.value))} style={{ ...inp, width: 70 }} /><span className="muted">clientes/mes</span></div></label>
        {hasTeam && <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Tu equipo<Hint text="Cuántos vendedores tienes en tu equipo directo. Ganas tu override sobre todo lo que ellos vendan." /><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}><input type="number" min={1} max={100} value={team} onChange={(e) => setTeam(Number(e.target.value))} style={{ ...inp, width: 70 }} /><span className="muted">vendedores</span></div></label>}
        {level === 'l2' && <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Red debajo<Hint text="Vendedores en los niveles inferiores (los equipos de tus Leads). Ganas el segundo override sobre sus ventas." /><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}><input type="number" min={0} max={500} value={network} onChange={(e) => setNetwork(Number(e.target.value))} style={{ ...inp, width: 70 }} /><span className="muted">en la red</span></div></label>}
        <label style={{ fontSize: 12, color: 'var(--mut,#9aa6bd)' }}>Nombre del candidato (opcional)<input value={name} onChange={(e) => setName(e.target.value)} placeholder="María" style={{ ...inp, display: 'block', marginTop: 4, width: 160 }} /></label>
      </div>

      {/* Vista previa en vivo */}
      <div style={{ background: 'var(--bg,#0e1220)', border: '1px solid var(--line,#2a3350)', borderRadius: 10, padding: 14 }}>
        {/* Titular */}
        <div style={{ background: '#0b0f1c', border: '1px solid var(--line,#2a3350)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#0b0f1c', background: '#a9b0ff', borderRadius: 6, padding: '2px 8px', marginBottom: 6 }}>PLAZA: {levelName.toUpperCase()}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Vende una vez. Cobra cada mes.</div>
          <div style={{ fontSize: 12.5, color: '#c3c2b7' }}>{hasTeam
            ? <>Tu venta directa <span style={{ color: '#a679ff' }}>+ un equipo de {teamN}</span>: en 12 meses llegas a <span style={{ color: '#5ed6a0', fontWeight: 700 }}>{money(combinedPotential)}/mes</span>.</>
            : <>Con <span style={{ color: '#5ed6a0' }}>{perM} clientes nuevos al mes</span>, en 12 meses llegas a <span style={{ color: '#5ed6a0', fontWeight: 700 }}>{money(potentialMonthly)}/mes</span> recurrente.</>}</div>
        </div>

        {/* Tarjetas por cliente */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ t: 'Tu 1.er mes', v: money(perFirst), s: `${fd}% del 1.er pago`, c: '#e5b567' },
            { t: 'Cada mes después', v: money(perMonthly), s: `${rd}% recurrente`, c: '#5ed6a0' },
            { t: 'Ese cliente en 1 año', v: money(perYear), s: 'de un solo cliente', c: 'var(--tx,#e8ecf5)' }].map((x, i) => (
            <div key={i} style={{ flex: '1 1 120px', border: '1px solid var(--line,#2a3350)', borderRadius: 9, padding: '8px 10px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)', textTransform: 'uppercase', letterSpacing: .3 }}>{x.t}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: x.c }}>{x.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--mut,#9aa6bd)' }}>{x.s}</div>
            </div>
          ))}
        </div>

        {/* Gráficas: dona + bola de nieve */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div style={{ border: '1px solid var(--line,#2a3350)', borderRadius: 9, padding: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>De dónde viene tu dinero</div>
            <div className="muted" style={{ fontSize: 10, marginBottom: 6 }}>{hasTeam ? 'Año 1 · directo + equipo' : `Año 1 · ${perM * 12} clientes`}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="86" height="86" viewBox="0 0 86 86">
                <circle cx="43" cy="43" r="34" fill="none" stroke="var(--line,#2a3350)" strokeWidth="14" />
                {(() => { let off = 0; return donutSegs.map((sg, i) => { const len = (sg.pct / 100) * C; const el = <circle key={i} cx="43" cy="43" r="34" fill="none" stroke={sg.c} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off + C / 4} transform="rotate(-90 43 43)" />; off += len; return el; }); })()}
                <text x="43" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill={hasTeam ? '#a679ff' : '#5ed6a0'}>{hasTeam ? `${pTeam}%` : `${resPct}%`}</text>
                <text x="43" y="52" textAnchor="middle" fontSize="7" fill="#9aa6bd">{hasTeam ? 'de tu equipo' : 'recurrente'}</text>
              </svg>
              <div style={{ fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#5ed6a0', display: 'inline-block' }} /><span style={{ color: 'var(--tx,#e8ecf5)' }}>Recurrente {pResid}%</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#e5b567', display: 'inline-block' }} /><span style={{ color: 'var(--tx,#e8ecf5)' }}>1.er mes {pFirst}%</span></div>
                {hasTeam && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#a679ff', display: 'inline-block' }} /><span style={{ color: 'var(--tx,#e8ecf5)' }}>Equipo {pTeam}%</span></div>}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx,#e8ecf5)', marginTop: 2 }}>{money(hasTeam ? combinedTotal : totalYear1)}</div>
                <div className="muted" style={{ fontSize: 9.5 }}>total año 1</div>
              </div>
            </div>
          </div>
          <div style={{ border: '1px solid var(--line,#2a3350)', borderRadius: 9, padding: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>El efecto bola de nieve</div>
            <div className="muted" style={{ fontSize: 10, marginBottom: 6 }}>{hasTeam ? 'Directo + equipo, mes 1 → 12' : 'Ingreso mensual, mes 1 → 12'}</div>
            <svg width="100%" height="86" viewBox="0 0 212 92" preserveAspectRatio="none">
              <polygon points={areaPts} fill="#4f9dff" opacity="0.14" />
              <polyline points={pts} fill="none" stroke="#4f9dff" strokeWidth="2" />
              <circle cx="204" cy={86 - 72 * (series[11] / maxV)} r="3" fill="#4f9dff" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4f9dff' }}>{money(series[11])}<span className="muted" style={{ fontSize: 9.5, fontWeight: 400 }}> /mes al mes 12</span></div>
          </div>
        </div>

        {/* Bloque de override de equipo (Lead / Director) */}
        {hasTeam && (
          <div style={{ marginTop: 10, border: '1px solid rgba(166,121,255,.4)', background: 'rgba(166,121,255,.10)', borderRadius: 9, padding: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>{ic('users-group', 15, '#a679ff')}<span style={{ fontSize: 11.5, fontWeight: 700, color: '#c9b3ff' }}>Lo que ganas de tu equipo</span></div>
            <div style={{ fontSize: 11.5, color: 'var(--tx,#e8ecf5)', lineHeight: 1.5 }}>
              {level === 'l2'
                ? <>Como {levelName}: <b>+{num(f.override1_rate)}%</b> de tu equipo directo ({teamN}) y <b>+{num(f.override2_rate)}%</b> de la red ({netN}).</>
                : <>Como {levelName}: <b>+{num(f.override1_rate)}%</b> de todo lo que venda tu equipo ({teamN} vendedores).</>}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Eso suma <b style={{ color: '#a679ff' }}>{money(overridePotential)}/mes</b> al mes 12 · <b style={{ color: '#a679ff' }}>{money(overrideTotal)}</b> extra en el año 1, sin venderlos tú.</div>
          </div>
        )}

        {/* Tabla por clientes */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 12.5 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: 10.5, color: 'var(--mut,#9aa6bd)' }}>Clientes</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: 10.5, color: '#e5b567' }}>1.er mes</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: 10.5, color: '#5ed6a0' }}>Cada mes</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', fontSize: 10.5, color: 'var(--tx,#e8ecf5)' }}>Año 1</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c}>
                <td style={{ padding: '4px 6px', color: 'var(--tx,#e8ecf5)' }}>{r.c} clientes</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: '#e5b567' }}>{money(r.first)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: '#5ed6a0' }}>{money(r.monthly)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--tx,#e8ecf5)' }}>{money(r.year)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Por qué Onyx */}
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', margin: '12px 0 6px' }}>Por qué Onyx es tu mejor opción</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {why.map((w, i) => (
            <div key={i} style={{ border: '1px solid var(--line,#2a3350)', borderRadius: 9, padding: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{ic(w.i, 15, w.c)}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx,#e8ecf5)' }}>{w.t}</span></div>
              <div className="muted" style={{ fontSize: 10.5, marginTop: 4, lineHeight: 1.4 }}>{w.s}</div>
            </div>
          ))}
        </div>

        {/* Escalera de carrera (resalta el tier de entrada) */}
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx,#e8ecf5)', margin: '12px 0 6px' }}>{level === 'vendedor' ? 'Tu carrera y lo que ganas de tu equipo' : `Entras como ${levelName}`}</div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
          {[{ k: 'vendedor', t: names.vendedor || 'Advisor', s: 'Tus ventas directas' },
            { k: 'l1', t: names.l1 || 'Lead', s: `+${num(f.override1_rate)}% de tu equipo` },
            { k: 'l2', t: names.l2 || 'Director', s: `+${num(f.override2_rate)}% de la red` }].map((s, i, arr) => {
            const here = s.k === level;
            return (
            <Fragment key={i}>
              <div style={{ flex: 1, position: 'relative', background: here ? 'rgba(166,121,255,.18)' : 'rgba(79,157,255,.10)', border: here ? '1.5px solid #a679ff' : '1px solid rgba(79,157,255,.30)', borderRadius: 8, padding: '8px 9px' }}>
                {here && <span style={{ position: 'absolute', top: -8, right: 6, fontSize: 8.5, fontWeight: 700, color: '#0b0f1c', background: '#a679ff', borderRadius: 5, padding: '1px 6px' }}>TU PLAZA</span>}
                <div style={{ fontSize: 11, fontWeight: 700, color: here ? '#c9b3ff' : '#8fc0ff' }}>{s.t}</div>
                <div style={{ fontSize: 10, color: here ? '#c9b3ff' : '#8fc0ff' }}>{s.s}</div>
              </div>
              {i < arr.length - 1 && <span style={{ alignSelf: 'center', color: 'var(--mut,#9aa6bd)', fontSize: 12 }}>→</span>}
            </Fragment>
          ); })}
        </div>

        <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          El PDF lleva todo esto (titular, gráficas, tabla, carrera con overrides, metas y bono) calculado con estos mismos parámetros.
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <button style={btn} disabled={!!busy} onClick={download}>{busy === 'proposal_pdf' ? '…' : '⬇ Descargar PDF'}</button>
        <span className="muted" style={{ fontSize: 12 }}>o enviar a:</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidato@correo.com" style={{ ...inp, width: 220 }} />
        <button style={btnP} disabled={!!busy} onClick={sendMail}>{busy === 'proposal_email' ? 'Enviando…' : 'Enviar por email'}</button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: msg.startsWith('⚠') ? 'var(--red,#f0736f)' : 'var(--accent,#8b93ff)' }}>{msg}</div>}
    </div>
  );
}
