'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang';

// Editor total del chat de soporte (Onyx AI): marca, colores, textos, pestañas,
// temas rápidos, mensaje proactivo y ajustes por dispositivo. Vista previa en vivo.
type Topic = { q_es: string; q_en: string; label_es: string; label_en: string };
type Cfg = any;

const inp: any = { width: '100%', margin: 0, fontSize: 13, padding: '7px 9px' };
const lbl: any = { fontSize: 12, color: 'var(--mut)', display: 'block', marginBottom: 3 };

function Tog({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return <span className="toggle" onClick={() => set(!on)} style={{ background: on ? 'var(--green)' : '#556080', boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.12)' }}><span className="knob" style={{ left: on ? 21 : 3 }} /></span>;
}

export default function ChatWidgetEditor() {
  const { lang } = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [c, setC] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [prev, setPrev] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [openP, setOpenP] = useState(true);

  useEffect(() => { fetch('/api/admin/chat-widget').then((r) => r.json()).then((d) => { if (!d.error) setC(d); }).catch(() => {}); }, []);
  const u = (k: string, v: any) => setC((p: any) => ({ ...p, [k]: v }));

  async function save() {
    if (!c) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/chat-widget', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'Error'); else { setC(d); setMsg(L('Guardado ✓', 'Saved ✓')); }
    } finally { setBusy(false); }
  }

  if (!c) return null;
  const es = lang === 'es';
  const grad = c.gradient ? `linear-gradient(135deg, ${c.c1}, ${c.c2})` : c.c1;
  const hiddenHere = (prev === 'desktop' && c.hideDesktop) || (prev === 'tablet' && c.hideTablet) || (prev === 'mobile' && c.hideMobile);
  const tg = (es ? c.name_es : c.name_en) || 'Onyx AI';

  // Editor de una lista de temas rápidos.
  const TopicList = ({ field }: { field: 'topicsGuest' | 'topicsUser' }) => {
    const list: Topic[] = c[field] || [];
    const setList = (v: Topic[]) => u(field, v);
    const upd = (i: number, k: keyof Topic, val: string) => setList(list.map((t, j) => (j === i ? { ...t, [k]: val } : t)));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((t, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><span style={lbl}>{L('Etiqueta (ES)', 'Label (ES)')}</span><input value={t.label_es} onChange={(e) => upd(i, 'label_es', e.target.value)} style={inp} placeholder="💳 Precios" /></div>
              <div><span style={lbl}>{L('Etiqueta (EN)', 'Label (EN)')}</span><input value={t.label_en} onChange={(e) => upd(i, 'label_en', e.target.value)} style={inp} placeholder="💳 Pricing" /></div>
              <div><span style={lbl}>{L('Pregunta que envía (ES)', 'Question it sends (ES)')}</span><input value={t.q_es} onChange={(e) => upd(i, 'q_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Pregunta que envía (EN)', 'Question it sends (EN)')}</span><input value={t.q_en} onChange={(e) => upd(i, 'q_en', e.target.value)} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} disabled={i === 0} onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setList(a); }}>↑</button>
              <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} disabled={i === list.length - 1} onClick={() => { const a = [...list]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setList(a); }}>↓</button>
              <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--amber)' }} onClick={() => setList(list.filter((_, j) => j !== i))}>🗑</button>
            </div>
          </div>
        ))}
        {list.length < 12 && <button className="btn btn-ghost" style={{ fontSize: 12.5, alignSelf: 'flex-start' }} onClick={() => setList([...list, { q_es: '', q_en: '', label_es: '', label_en: '' }])}>＋ {L('Añadir tema', 'Add topic')}</button>}
      </div>
    );
  };

  const Sec = ({ ic, title, children }: any) => (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}><span>{ic}</span>{title}</div>
      {children}
    </div>
  );
  const two: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="row between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 10 }}><span style={{ fontSize: 20 }}>💬</span><h3>{L('Chat de soporte (widget)', 'Support chat (widget)')}</h3></div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>{L('Mostrar', 'Show')}</span><Tog on={c.enabled} set={(v) => u('enabled', v)} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{L('Edita todo el chat de Onyx AI: avatar, textos, colores, pestañas, temas, mensaje proactivo y cómo se ve en cada dispositivo. Se guarda y se aplica al instante.', 'Edit the whole Onyx AI chat: avatar, texts, colors, tabs, topics, proactive message and how it looks per device. Saved and applied instantly.')}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start', marginTop: 10 }}>
        {/* ---------- FORM ---------- */}
        <div>
          <Sec ic="🪪" title={L('Marca y avatar', 'Brand and avatar')}>
            <div style={two}>
              <div><span style={lbl}>{L('Nombre (ES)', 'Name (ES)')}</span><input value={c.name_es} onChange={(e) => u('name_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Nombre (EN)', 'Name (EN)')}</span><input value={c.name_en} onChange={(e) => u('name_en', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Subtítulo en línea (ES)', 'Online subtitle (ES)')}</span><input value={c.subOn_es} onChange={(e) => u('subOn_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Subtítulo en línea (EN)', 'Online subtitle (EN)')}</span><input value={c.subOn_en} onChange={(e) => u('subOn_en', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Nombre con persona (ES)', 'Name with human (ES)')}</span><input value={c.humanName_es} onChange={(e) => u('humanName_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Nombre con persona (EN)', 'Name with human (EN)')}</span><input value={c.humanName_en} onChange={(e) => u('humanName_en', e.target.value)} style={inp} /></div>
            </div>
            <div style={{ ...two, marginTop: 10, gridTemplateColumns: '1fr 90px 90px' }}>
              <div><span style={lbl}>{L('URL del avatar (opcional)', 'Avatar URL (optional)')}</span><input value={c.avatarUrl} onChange={(e) => u('avatarUrl', e.target.value)} style={inp} placeholder="https://…" /></div>
              <div><span style={lbl}>{L('Emoji avatar', 'Avatar emoji')}</span><input value={c.headerEmoji} onChange={(e) => u('headerEmoji', e.target.value)} style={inp} placeholder="🤖" /></div>
              <div><span style={lbl}>{L('Emoji botón', 'Button emoji')}</span><input value={c.launcher} onChange={(e) => u('launcher', e.target.value)} style={inp} placeholder="💬" /></div>
            </div>
            <div style={{ ...two, marginTop: 10 }}>
              <div><span style={lbl}>{L('Etiqueta junto al botón (ES)', 'Launcher label (ES)')}</span><input value={c.helpLabel_es} onChange={(e) => u('helpLabel_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Etiqueta junto al botón (EN)', 'Launcher label (EN)')}</span><input value={c.helpLabel_en} onChange={(e) => u('helpLabel_en', e.target.value)} style={inp} /></div>
            </div>
          </Sec>

          <Sec ic="🎨" title={L('Colores', 'Colors')}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 8, alignItems: 'center' }}>{L('Color 1', 'Color 1')}<input type="color" value={c.c1} onChange={(e) => u('c1', e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
              <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 8, alignItems: 'center' }}>{L('Color 2', 'Color 2')}<input type="color" value={c.c2} onChange={(e) => u('c2', e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
              <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 8, alignItems: 'center' }}>{L('Degradado', 'Gradient')}<Tog on={c.gradient} set={(v) => u('gradient', v)} /></label>
              <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 8, alignItems: 'center' }}>{L('Texto cabecera', 'Header text')}<input type="color" value={c.fg} onChange={(e) => u('fg', e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
              <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 8, alignItems: 'center' }}>{L('Acento', 'Accent')}<input type="color" value={c.accent} onChange={(e) => u('accent', e.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
            </div>
          </Sec>

          <Sec ic="🔤" title={L('Textos', 'Texts')}>
            <div style={two}>
              <div><span style={lbl}>{L('Saludo (ES)', 'Greeting (ES)')}</span><input value={c.greeting_es} onChange={(e) => u('greeting_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Saludo (EN)', 'Greeting (EN)')}</span><input value={c.greeting_en} onChange={(e) => u('greeting_en', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Placeholder (ES)', 'Placeholder (ES)')}</span><input value={c.placeholder_es} onChange={(e) => u('placeholder_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Placeholder (EN)', 'Placeholder (EN)')}</span><input value={c.placeholder_en} onChange={(e) => u('placeholder_en', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Título de temas (ES)', 'Topics title (ES)')}</span><input value={c.topicsTitle_es} onChange={(e) => u('topicsTitle_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Título de temas (EN)', 'Topics title (EN)')}</span><input value={c.topicsTitle_en} onChange={(e) => u('topicsTitle_en', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Botón "hablar con persona" (ES)', '"Talk to a person" (ES)')}</span><input value={c.humanLabel_es} onChange={(e) => u('humanLabel_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Botón "hablar con persona" (EN)', '"Talk to a person" (EN)')}</span><input value={c.humanLabel_en} onChange={(e) => u('humanLabel_en', e.target.value)} style={inp} /></div>
            </div>
          </Sec>

          <Sec ic="🧩" title={L('Pestañas y acciones', 'Tabs and actions')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['showTopics', L('Mostrar temas rápidos', 'Show quick topics')], ['showHuman', L('Botón hablar con una persona', 'Talk-to-a-person button')], ['showTicket', L('Accesos a ticket / centro de soporte', 'Ticket / support-center links')], ['showPulse', L('Punto verde "en línea"', 'Green "online" dot')]].map(([k, label]: any) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2)', borderRadius: 8, padding: '8px 11px' }}>
                  <span style={{ fontSize: 13 }}>{label}</span><Tog on={!!c[k]} set={(v) => u(k, v)} />
                </div>
              ))}
            </div>
          </Sec>

          <Sec ic="💬" title={L('Temas rápidos · visitante', 'Quick topics · guest')}><TopicList field="topicsGuest" /></Sec>
          <Sec ic="👤" title={L('Temas rápidos · usuario', 'Quick topics · logged-in')}><TopicList field="topicsUser" /></Sec>

          <Sec ic="⚡" title={L('Mensaje proactivo', 'Proactive message')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>{L('Mostrar un globo tras unos segundos', 'Show a bubble after a few seconds')}</span><Tog on={c.proactiveOn} set={(v) => u('proactiveOn', v)} />
            </div>
            <div style={{ ...two, gridTemplateColumns: '1fr 1fr 110px' }}>
              <div><span style={lbl}>{L('Texto (ES)', 'Text (ES)')}</span><input value={c.proactive_es} onChange={(e) => u('proactive_es', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Texto (EN)', 'Text (EN)')}</span><input value={c.proactive_en} onChange={(e) => u('proactive_en', e.target.value)} style={inp} /></div>
              <div><span style={lbl}>{L('Retraso (s)', 'Delay (s)')}</span><input type="number" min={2} max={120} value={c.proactiveDelay} onChange={(e) => u('proactiveDelay', Number(e.target.value))} style={inp} /></div>
            </div>
          </Sec>

          <Sec ic="🧠" title={L('IA consciente del estado (usuarios logueados)', 'State-aware AI (logged-in users)')}>
            <p style={{ fontSize: 12.5, color: 'var(--mut)', margin: '0 0 10px' }}>
              {L('Usa el estado real del usuario (plan, conector, roles) para adivinar su problema y sugerir el siguiente paso con botones. Solo estados, nunca saldos ni datos de terceros.',
                 'Uses the user\'s real state (plan, connector, roles) to guess their problem and suggest the next step with buttons. States only, never balances or third-party data.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2)', borderRadius: 8, padding: '8px 11px' }}>
                <span style={{ fontSize: 13 }}>{L('Sugerencias proactivas (siguiente paso + botones)', 'Proactive suggestions (next step + buttons)')}</span><Tog on={c.aiProactive !== false} set={(v) => u('aiProactive', v)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2)', borderRadius: 8, padding: '8px 11px' }}>
                <span style={{ fontSize: 13 }}>{L('Permitir sugerir subir de plan (medido, solo si es relevante)', 'Allow plan-upgrade nudges (measured, only when relevant)')}</span><Tog on={c.aiUpsell !== false} set={(v) => u('aiUpsell', v)} />
              </div>
            </div>
          </Sec>

          <Sec ic="📱" title={L('Por dispositivo', 'Per device')}>
            <div style={{ ...two, gridTemplateColumns: '1fr 1fr' }}>
              <div><span style={lbl}>{L('Lado', 'Side')}</span>
                <select value={c.side} onChange={(e) => u('side', e.target.value)} style={inp}>
                  <option value="right">{L('Derecha', 'Right')}</option>
                  <option value="left">{L('Izquierda', 'Left')}</option>
                </select>
              </div>
              <div><span style={lbl}>{L('Tamaño del botón (px)', 'Button size (px)')}</span><input type="number" min={40} max={80} value={c.launcherSize} onChange={(e) => u('launcherSize', Number(e.target.value))} style={inp} /></div>
              <div><span style={lbl}>{L('Separación lateral (px)', 'Side offset (px)')}</span><input type="number" min={0} max={80} value={c.offsetX} onChange={(e) => u('offsetX', Number(e.target.value))} style={inp} /></div>
              <div><span style={lbl}>{L('Separación inferior (px)', 'Bottom offset (px)')}</span><input type="number" min={0} max={120} value={c.offsetY} onChange={(e) => u('offsetY', Number(e.target.value))} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {[['hideDesktop', L('Ocultar en escritorio', 'Hide on desktop')], ['hideTablet', L('Ocultar en tablet', 'Hide on tablet')], ['hideMobile', L('Ocultar en móvil', 'Hide on mobile')]].map(([k, label]: any) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2)', borderRadius: 8, padding: '8px 11px' }}>
                  <span style={{ fontSize: 13 }}>{label}</span><Tog on={!!c[k]} set={(v) => u(k, v)} />
                </div>
              ))}
            </div>
          </Sec>

          <div className="row" style={{ gap: 12, marginTop: 18, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : L('Guardar cambios', 'Save changes')}</button>
            {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
          </div>
        </div>

        {/* ---------- PREVIEW ---------- */}
        <div style={{ position: 'sticky', top: 12 }}>
          <div style={{ display: 'inline-flex', gap: 5, background: 'var(--card2)', padding: 4, borderRadius: 20, marginBottom: 10 }}>
            {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
              <button key={d} onClick={() => setPrev(d)} className="btn" style={{ padding: '4px 11px', fontSize: 12, border: 'none', borderRadius: 16, background: prev === d ? 'var(--brand)' : 'transparent', color: prev === d ? '#0a0d14' : 'var(--mut)' }}>{d === 'desktop' ? '🖥' : d === 'tablet' ? '📲' : '📱'} {d === 'desktop' ? L('Escritorio', 'Desktop') : d === 'tablet' ? 'Tablet' : L('Móvil', 'Mobile')}</button>
            ))}
          </div>

          <div style={{ position: 'relative', height: 360, background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
            {hiddenHere ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)', fontSize: 13, gap: 6 }}>
                <span style={{ fontSize: 26 }}>🚫</span>{L('Oculto en este dispositivo', 'Hidden on this device')}
              </div>
            ) : openP ? (
              <div style={{ position: 'absolute', [c.side === 'left' ? 'left' : 'right']: 12, bottom: 12, width: prev === 'mobile' ? 'calc(100% - 24px)' : 240, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 15, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.3)' } as any}>
                <div style={{ background: grad, color: c.fg, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  {c.avatarUrl ? <img src={c.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover' }} /> : <span style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{c.headerEmoji || '🤖'}</span>}
                  <div style={{ lineHeight: 1.25, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tg}</div>
                    <div style={{ fontSize: 10.5, opacity: .9, display: 'flex', alignItems: 'center', gap: 5 }}>{c.showPulse && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34e2a0' }} />}{es ? c.subOn_es : c.subOn_en}</div>
                  </div>
                  <span onClick={() => setOpenP(false)} style={{ cursor: 'pointer', opacity: .9 }}>×</span>
                </div>
                <div style={{ padding: 10, minHeight: 150 }}>
                  <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '11px 11px 11px 3px', padding: '7px 10px', fontSize: 12, maxWidth: '88%' }}>{es ? c.greeting_es : c.greeting_en}</div>
                  {c.showTopics && (
                    <>
                      <div style={{ fontSize: 10, color: 'var(--mut)', margin: '9px 0 5px' }}>{es ? c.topicsTitle_es : c.topicsTitle_en}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {(c.topicsGuest || []).slice(0, 4).map((t: Topic, i: number) => <span key={i} style={{ fontSize: 10.5, padding: '4px 8px', borderRadius: 12, border: '1px solid var(--line)' }}>{(es ? t.label_es : t.label_en) || '—'}</span>)}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--line)', padding: '8px 10px', fontSize: 11.5, color: 'var(--mut)' }}>{es ? c.placeholder_es : c.placeholder_en}</div>
              </div>
            ) : (
              <div style={{ position: 'absolute', [c.side === 'left' ? 'left' : 'right']: c.offsetX, bottom: c.offsetY, display: 'flex', alignItems: 'center', gap: 8, flexDirection: c.side === 'left' ? 'row-reverse' : 'row', cursor: 'pointer' } as any} onClick={() => setOpenP(true)}>
                {(es ? c.helpLabel_es : c.helpLabel_en) && <span style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '6px 11px', fontSize: 12 }}>{es ? c.helpLabel_es : c.helpLabel_en}</span>}
                <span style={{ position: 'relative', width: Math.min(60, c.launcherSize), height: Math.min(60, c.launcherSize), borderRadius: '50%', background: grad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.min(60, c.launcherSize) * 0.46 }}>{c.launcher || '💬'}
                  {c.showPulse && <span style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#34e2a0', border: '2px solid var(--card2)' }} />}
                </span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setOpenP((v) => !v)}>{openP ? L('Ver botón cerrado', 'See closed button') : L('Ver chat abierto', 'See open chat')}</button>
        </div>
      </div>
    </div>
  );
}
