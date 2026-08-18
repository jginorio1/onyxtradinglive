'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// ============================================================
// Compartir un artículo en redes con copy optimizado por red (social SEO manager),
// en el idioma elegido (ES/EN), tarjetas modernas y programación en modo
// RECORDATORIO. No importa lib/social (server-only): la meta de redes y el
// constructor de enlace viven aquí; las URLs vienen de la API.
// ============================================================

type Net = { id: string; label: string; color: string; icon: string; link: boolean; hint?: string };
const NETS: Record<string, Net> = {
  facebook: { id: 'facebook', label: 'Facebook', color: '#1877f2', icon: 'f', link: true, hint: 'Facebook solo pasa el enlace; pega el copy al publicar.' },
  instagram: { id: 'instagram', label: 'Instagram', color: '#bc1888', icon: '◎', link: false, hint: 'Copia el caption y pega (enlace en bio).' },
  youtube: { id: 'youtube', label: 'YouTube', color: '#ff0000', icon: '▶', link: false, hint: 'Pega en Comunidad o en la descripción (enlace en 1er comentario).' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', icon: '✆', link: true },
  x: { id: 'x', label: 'X / Twitter', color: '#1d9bf0', icon: '𝕏', link: true },
  linkedin: { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: 'in', link: true, hint: 'LinkedIn solo pasa el enlace; pega el copy al publicar.' },
  telegram: { id: 'telegram', label: 'Telegram', color: '#26a5e4', icon: '✈', link: true },
  tiktok: { id: 'tiktok', label: 'TikTok', color: '#111', icon: '♪', link: false, hint: 'Copia el caption.' },
  reddit: { id: 'reddit', label: 'Reddit', color: '#ff4500', icon: 'r', link: true },
  threads: { id: 'threads', label: 'Threads', color: '#111', icon: '@', link: false, hint: 'Copia el texto para pegar.' },
};
const PRIMARY = ['facebook', 'instagram', 'youtube', 'whatsapp'];
const MORE = ['x', 'linkedin', 'telegram', 'tiktok', 'reddit', 'threads'];
const LIMIT: Record<string, number> = { x: 280 };

function shareUrl(id: string, url: string, text: string): string | null {
  const u = encodeURIComponent(url), t = encodeURIComponent(text), tu = encodeURIComponent(`${text}\n\n${url}`);
  switch (id) {
    case 'x': return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'whatsapp': return `https://wa.me/?text=${tu}`;
    case 'reddit': return `https://www.reddit.com/submit?url=${u}&title=${t}`;
    default: return null;
  }
}
const hashtags = (t: string): string[] => (t.match(/#[\p{L}0-9_]+/gu) || []).slice(0, 14);

export default function SocialShare({ post, es }: { post: any; es: boolean }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [busy, setBusy] = useState(false);
  const [one, setOne] = useState('');            // red que se está regenerando
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [url, setUrl] = useState('');
  const [when, setWhen] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [rem, setRem] = useState<any>(null);
  const [remOpen, setRemOpen] = useState(false);

  async function loadSchedule() {
    try { const r = await fetch('/api/admin/blog/social?post=' + post.id); const j = await r.json(); setItems(j.items || []); setRem(j.reminder || null); } catch {}
  }
  useEffect(() => { if (open) loadSchedule(); /* eslint-disable-next-line */ }, [open]);

  async function generate(l = lang, only?: string) {
    if (only) setOne(only); else setBusy(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'social', id: post.id, lang: l, only }) });
      const j = await r.json();
      if (r.ok && j.copy) { setCopy((c) => ({ ...c, ...j.copy })); setUrl(j.url || url); }
      else toast(j.code === 'no_key' ? (es ? 'IA no configurada.' : 'AI not configured.') : (es ? 'La IA no pudo generar.' : 'AI could not generate.'));
    } finally { setOne(''); setBusy(false); }
  }

  const doCopy = (text: string) => { try { navigator.clipboard.writeText(text); toast(es ? 'Copiado.' : 'Copied.'); } catch {} };
  // Abre una red EXTERNA en pestaña/ventana nueva. NUNCA navega la app a la red
  // (eso cargaba Facebook dentro de la app y se quedaba en "Posting"). Devuelve
  // false si no se pudo abrir (p. ej. app instalada que bloquea ventanas nuevas).
  function openExternal(link: string): boolean {
    try { const w = window.open(link, '_blank', 'noopener'); return !!w; } catch { return false; }
  }
  // Redes que NO permiten rellenar el texto por enlace (Facebook y LinkedIn solo
  // aceptan la URL). Para ellas copiamos el texto CON hashtags y abrimos la red
  // para que el usuario solo pegue (Ctrl/Cmd+V).
  const PASTE = new Set(['facebook', 'linkedin']);
  const doShare = (id: string, text: string) => {
    const link = shareUrl(id, url, text);
    if (!link) { doCopy(text); return; }        // instagram/tiktok/threads → copiar caption
    const label = LABEL[id] || id;
    if (PASTE.has(id)) {
      try { navigator.clipboard.writeText(text); } catch {}
      const ok = openExternal(link);
      toast(ok
        ? (es ? `📋 Copiamos el texto con hashtags. Pégalo (Ctrl/Cmd+V) en ${label}.` : `📋 We copied the text with hashtags. Paste it (Ctrl/Cmd+V) in ${label}.`)
        : (es ? `📋 Texto copiado. Abre ${label} y pega (Ctrl/Cmd+V).` : `📋 Text copied. Open ${label} and paste (Ctrl/Cmd+V).`));
      return;
    }
    // x/telegram/whatsapp/reddit → el texto se rellena solo al abrir.
    const ok = openExternal(link);
    if (!ok) { try { navigator.clipboard.writeText(`${text}\n\n${url}`); } catch {} toast(es ? `Texto copiado. Abre ${label} y pega.` : `Text copied. Open ${label} and paste.`); }
  };

  async function schedule(id: string) {
    if (!when) { toast(es ? 'Elige fecha y hora arriba.' : 'Pick date and time above.'); return; }
    const text = copy[id]; if (!text) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/blog/social', { method: 'POST', body: JSON.stringify({ rows: [{ blog_post_id: post.id, slug: post.slug, network: id, lang, copy: text, url, scheduled_at: new Date(when).toISOString() }] }) });
      if (r.ok) { toast(es ? `Programado en ${NETS[id].label}.` : `Scheduled on ${NETS[id].label}.`); await loadSchedule(); }
    } finally { setBusy(false); }
  }
  const cancelItem = async (id: string) => { await fetch('/api/admin/blog/social', { method: 'DELETE', body: JSON.stringify({ id }) }); await loadSchedule(); };
  async function saveRem() { setBusy(true); try { await fetch('/api/admin/blog/social', { method: 'POST', body: JSON.stringify({ reminder: rem }) }); toast(es ? 'Guardado.' : 'Saved.'); } finally { setBusy(false); } }

  const hasCopy = Object.keys(copy).length > 0;
  const pending = items.filter((i) => i.status === 'pending');

  const Card = (id: string) => {
    const n = NETS[id]; const text = copy[id] || '';
    const tags = hashtags(text);
    const over = LIMIT[id] && text.length > LIMIT[id];
    const loading = one === id;
    return (
      <div key={id} style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${n.color}` }}>
        <div className="row between" style={{ alignItems: 'center', padding: '10px 12px 8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: n.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12.5 }}>{n.icon}</span>{n.label}
          </span>
          <span className="row" style={{ gap: 8, alignItems: 'center' }}>
            {LIMIT[id] && text && <span style={{ fontSize: 10.5, color: over ? 'var(--red)' : 'var(--mut)' }}>{text.length}/{LIMIT[id]}</span>}
            {hasCopy && <button title={es ? 'Regenerar esta red' : 'Regenerate this network'} onClick={() => generate(lang, id)} disabled={loading} style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', fontSize: 13 }}>{loading ? '…' : '↻'}</button>}
          </span>
        </div>
        <div style={{ padding: '0 12px' }}>
          {text
            ? <textarea value={text} onChange={(e) => setCopy((c) => ({ ...c, [id]: e.target.value }))} rows={5} style={{ width: '100%', margin: 0, fontSize: 12.5, lineHeight: 1.45, resize: 'vertical' }} />
            : <div style={{ minHeight: 92, borderRadius: 8, border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', color: 'var(--mut)', fontSize: 12, textAlign: 'center', padding: 10 }}>{es ? 'Pulsa “Generar copy” para escribir el texto de esta red.' : 'Press “Generate copy” to write this network’s text.'}</div>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {tags.map((h, i) => <span key={i} style={{ fontSize: 10.5, color: 'var(--brand)', background: 'color-mix(in srgb,var(--brand) 12%,transparent)', border: '1px solid color-mix(in srgb,var(--brand) 30%,transparent)', borderRadius: 999, padding: '1px 7px' }}>{h}</span>)}
            </div>
          )}
          {n.hint && <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{n.hint}</div>}
        </div>
        <div className="row" style={{ gap: 6, padding: '9px 12px 11px', marginTop: 'auto', flexWrap: 'wrap' }}>
          {n.link
            ? <a className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', color: text ? 'var(--brand)' : 'var(--mut)', borderColor: 'color-mix(in srgb,var(--brand) 40%,var(--line))', pointerEvents: text ? 'auto' : 'none', textDecoration: 'none' }}
                href={text ? (shareUrl(id, url, text) || '#') : '#'} target="_blank" rel="noopener noreferrer"
                onClick={() => { if (PASTE.has(id) && text) { try { navigator.clipboard.writeText(text); } catch {} toast(es ? '📋 Copiamos el texto con hashtags. Pégalo (Ctrl/Cmd+V) al abrirse la ventana.' : '📋 We copied the text with hashtags. Paste it (Ctrl/Cmd+V) in the window.'); } }}>{es ? 'Compartir' : 'Share'}</a>
            : <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', color: 'var(--brand)' }} disabled={!text} onClick={() => doCopy(text)}>{es ? 'Copiar caption' : 'Copy caption'}</button>}
          {n.link && <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} disabled={!text} onClick={() => doCopy(text)}>{es ? 'Copiar' : 'Copy'}</button>}
          {tags.length > 0 && <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => doCopy(tags.join(' '))}>{es ? '# Hashtags' : '# Hashtags'}</button>}
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', marginLeft: 'auto' }} disabled={!text || !when} onClick={() => schedule(id)}>⏰ {es ? 'Programar' : 'Schedule'}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div>
          <b style={{ fontSize: 14 }}>🔗 {es ? 'Compartir en redes' : 'Share on social'}</b>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{es ? 'Copy por red pensado como social manager, con hashtags, en tu idioma, y programación con recordatorio.' : 'Per-network copy written like a social manager, with hashtags, in your language, plus reminder scheduling.'}{pending.length ? ` · ${pending.length} ${es ? 'programadas' : 'scheduled'}` : ''}</div>
        </div>
        <span className="btn btn-ghost" style={{ fontSize: 12 }}>{open ? (es ? 'Ocultar' : 'Hide') : (es ? 'Abrir' : 'Open')}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          {!post.slug && <div className="muted" style={{ fontSize: 12.5, marginBottom: 10, color: 'var(--amber)' }}>⚠ {es ? 'Guarda el artículo primero para tener su enlace.' : 'Save the article first to get its link.'}</div>}

          {/* Barra: idioma + generar + programar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg2)', marginBottom: 14 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'Idioma:' : 'Language:'}</span>
              <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
                {(['es', 'en'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => { setLang(l); setCopy({}); }} className="btn" style={{ border: 'none', borderRadius: 0, padding: '5px 14px', fontSize: 12.5, background: lang === l ? 'var(--brand)' : 'transparent', color: lang === l ? '#0a0d14' : 'var(--mut)' }}>{l === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}</button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => generate()} disabled={busy || !post.slug}>{busy && !one ? '…' : (hasCopy ? (es ? '↻ Regenerar todo' : '↻ Regenerate all') : (es ? '✨ Generar copy' : '✨ Generate copy'))}</button>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'Programar a:' : 'Schedule at:'}</span>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ margin: 0, width: 'auto' }} />
            </div>
          </div>

          {/* Redes principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(272px,1fr))', gap: 12 }}>
            {PRIMARY.map(Card)}
          </div>

          {/* Más redes */}
          <button type="button" onClick={() => setShowMore((v) => !v)} className="btn btn-ghost" style={{ fontSize: 12.5, marginTop: 12 }}>{showMore ? (es ? '− Menos redes' : '− Fewer networks') : (es ? '＋ Más redes (X, LinkedIn, Telegram, TikTok, Reddit, Threads)' : '＋ More networks (X, LinkedIn, Telegram, TikTok, Reddit, Threads)')}</button>
          {showMore && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(272px,1fr))', gap: 12, marginTop: 12 }}>{MORE.map(Card)}</div>}

          {/* Programadas */}
          {pending.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>📅 {es ? 'Programadas' : 'Scheduled'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pending.map((it) => (
                  <div key={it.id} className="row between" style={{ alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px' }}>
                    <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, background: (NETS[it.network]?.color || '#888'), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }}>{NETS[it.network]?.icon || '?'}</span>
                      <b>{NETS[it.network]?.label || it.network}</b> <span className="muted">· {String(it.lang).toUpperCase()} · {new Date(it.scheduled_at).toLocaleString(es ? 'es-ES' : 'en-US')}</span>
                    </span>
                    <button className="btn btn-ghost" style={{ fontSize: 11.5, color: 'var(--red)' }} onClick={() => cancelItem(it.id)}>{es ? 'Cancelar' : 'Cancel'}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ajustes del recordatorio (plegable) */}
          {rem && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="row between" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setRemOpen((o) => !o)}>
                <span className="muted" style={{ fontSize: 12 }}>⚙ {es ? '¿A dónde llega el recordatorio con el copy?' : 'Where do reminders arrive?'}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{remOpen ? (es ? 'Ocultar' : 'Hide') : (es ? 'Configurar' : 'Configure')}</span>
              </div>
              {remOpen && (
                <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={!!rem.viaEmail} onChange={(e) => setRem({ ...rem, viaEmail: e.target.checked })} /> Email</label>
                  <input value={rem.email || ''} onChange={(e) => setRem({ ...rem, email: e.target.value })} placeholder={es ? 'tu@correo.com' : 'you@email.com'} style={{ margin: 0, flex: '1 1 200px' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={!!rem.viaTelegram} onChange={(e) => setRem({ ...rem, viaTelegram: e.target.checked })} /> Telegram</label>
                  <input value={rem.telegramChatId || ''} onChange={(e) => setRem({ ...rem, telegramChatId: e.target.value })} placeholder="chat id" style={{ margin: 0, flex: '1 1 130px' }} />
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={saveRem} disabled={busy}>{es ? 'Guardar' : 'Save'}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
