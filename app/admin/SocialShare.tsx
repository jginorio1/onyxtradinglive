'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

// ============================================================
// Compartir un artículo en redes con copy optimizado por red (Onyx AI), en el
// idioma elegido (ES/EN), y programarlo en modo RECORDATORIO: a la hora te llega
// el copy listo para pegar. No importa lib/social (server-only): la lista de redes
// y el constructor de enlace viven aquí, y las URLs vienen de la API.
// ============================================================

type Net = { id: string; label: string; color: string; icon: string; link: boolean; hint?: string };
const NETS: Net[] = [
  { id: 'x', label: 'X / Twitter', color: '#1d9bf0', icon: '𝕏', link: true },
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: 'in', link: true, hint: 'LinkedIn solo pasa el enlace; pega el copy al publicar.' },
  { id: 'facebook', label: 'Facebook', color: '#1877f2', icon: 'f', link: true, hint: 'Facebook solo pasa el enlace; pega el copy al publicar.' },
  { id: 'telegram', label: 'Telegram', color: '#26a5e4', icon: '✈', link: true },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', icon: '✆', link: true },
  { id: 'reddit', label: 'Reddit', color: '#ff4500', icon: 'r', link: true },
  { id: 'instagram', label: 'Instagram', color: '#bc1888', icon: '◎', link: false, hint: 'No comparte enlace: copia el caption (enlace en bio).' },
  { id: 'tiktok', label: 'TikTok', color: '#111', icon: '♪', link: false, hint: 'No comparte enlace: copia el caption.' },
  { id: 'threads', label: 'Threads', color: '#111', icon: '@', link: false, hint: 'Copia el texto para pegar.' },
];
const LABEL: Record<string, string> = Object.fromEntries(NETS.map((n) => [n.id, n.label]));

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
const LIMIT: Record<string, number> = { x: 280 };

export default function SocialShare({ post, es }: { post: any; es: boolean }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<'es' | 'en'>(es ? 'es' : 'en');
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [url, setUrl] = useState('');
  const [when, setWhen] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [rem, setRem] = useState<any>(null);

  async function loadSchedule() {
    try {
      const r = await fetch('/api/admin/blog/social?post=' + post.id);
      const j = await r.json(); setItems(j.items || []); setRem(j.reminder || null);
    } catch {}
  }
  useEffect(() => { if (open) loadSchedule(); /* eslint-disable-next-line */ }, [open]);

  async function generate(l = lang) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/blog/ai', { method: 'POST', body: JSON.stringify({ mode: 'social', id: post.id, lang: l }) });
      const j = await r.json();
      if (r.ok && j.copy) { setCopy(j.copy); setUrl(j.url || ''); }
      else toast(j.code === 'no_key' ? (es ? 'IA no configurada.' : 'AI not configured.') : (es ? 'La IA no pudo generar.' : 'AI could not generate.'));
    } finally { setBusy(false); }
  }

  const doCopy = (text: string) => { try { navigator.clipboard.writeText(text); toast(es ? 'Copiado.' : 'Copied.'); } catch {} };
  const doShare = (id: string, text: string) => {
    const link = shareUrl(id, url, text);
    if (link) window.open(link, '_blank', 'noopener');
    else doCopy(text);
  };

  async function schedule(id: string) {
    if (!when) { toast(es ? 'Elige fecha y hora.' : 'Pick date and time.'); return; }
    const text = copy[id]; if (!text) { toast(es ? 'Genera el copy primero.' : 'Generate copy first.'); return; }
    const scheduled_at = new Date(when).toISOString();
    setBusy(true);
    try {
      const r = await fetch('/api/admin/blog/social', { method: 'POST', body: JSON.stringify({ rows: [{ blog_post_id: post.id, slug: post.slug, network: id, lang, copy: text, url, scheduled_at }] }) });
      if (r.ok) { toast(es ? `Programado en ${LABEL[id]}.` : `Scheduled on ${LABEL[id]}.`); await loadSchedule(); }
      else toast(es ? 'No se pudo programar.' : 'Could not schedule.');
    } finally { setBusy(false); }
  }
  async function cancelItem(id: string) {
    await fetch('/api/admin/blog/social', { method: 'DELETE', body: JSON.stringify({ id }) }); await loadSchedule();
  }
  async function saveRem() {
    setBusy(true);
    try { await fetch('/api/admin/blog/social', { method: 'POST', body: JSON.stringify({ reminder: rem }) }); toast(es ? 'Guardado.' : 'Saved.'); }
    finally { setBusy(false); }
  }

  const hasCopy = Object.keys(copy).length > 0;
  const pending = items.filter((i) => i.status === 'pending');

  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div>
          <b style={{ fontSize: 14 }}>🔗 {es ? 'Compartir en redes' : 'Share on social'}</b>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{es ? 'Copy optimizado por red, en el idioma que elijas, y programación con recordatorio.' : 'Per-network optimized copy, in your chosen language, plus reminder scheduling.'}{pending.length ? ` · ${pending.length} ${es ? 'programadas' : 'scheduled'}` : ''}</div>
        </div>
        <span className="btn btn-ghost" style={{ fontSize: 12 }}>{open ? (es ? 'Ocultar' : 'Hide') : (es ? 'Abrir' : 'Open')}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {!post.slug && <div className="muted" style={{ fontSize: 12.5, marginBottom: 8, color: 'var(--amber)' }}>⚠ {es ? 'Guarda el artículo primero para tener su enlace.' : 'Save the article first to get its link.'}</div>}

          {/* Idioma + generar */}
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>{es ? 'Idioma de la publicación:' : 'Publish language:'}</span>
            <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
              {(['es', 'en'] as const).map((l) => (
                <button key={l} type="button" onClick={() => { setLang(l); setCopy({}); }} className="btn" style={{ border: 'none', borderRadius: 0, padding: '5px 14px', fontSize: 12.5, background: lang === l ? 'var(--brand)' : 'transparent', color: lang === l ? '#0a0d14' : 'var(--mut)' }}>{l === 'es' ? 'Español' : 'English'}</button>
              ))}
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => generate()} disabled={busy || !post.slug}>{busy ? '…' : (hasCopy ? (es ? '↻ Regenerar' : '↻ Regenerate') : (es ? '✨ Generar copy' : '✨ Generate copy'))}</button>
            {url && <a href={url} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 11.5 }}>{url}</a>}
          </div>

          {/* Programación: fecha/hora compartida */}
          {hasCopy && (
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>{es ? 'Programar a:' : 'Schedule at:'}</span>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ margin: 0, width: 'auto' }} />
              <span className="muted" style={{ fontSize: 11.5 }}>{es ? 'A esa hora te llega el copy listo para pegar.' : 'You get the ready copy at that time.'}</span>
            </div>
          )}

          {/* Tarjetas por red */}
          {hasCopy && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
              {NETS.filter((n) => copy[n.id]).map((n) => {
                const text = copy[n.id];
                const over = LIMIT[n.id] && text.length > LIMIT[n.id];
                return (
                  <div key={n.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 11, background: 'var(--bg2)' }}>
                    <div className="row between" style={{ alignItems: 'center', marginBottom: 7 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 12.5 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 5, background: n.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 }}>{n.icon}</span>{n.label}
                      </span>
                      {LIMIT[n.id] && <span style={{ fontSize: 10.5, color: over ? 'var(--red)' : 'var(--mut)' }}>{text.length}/{LIMIT[n.id]}</span>}
                    </div>
                    <textarea value={text} onChange={(e) => setCopy((c) => ({ ...c, [n.id]: e.target.value }))} rows={4} style={{ width: '100%', margin: 0, fontSize: 12.5 }} />
                    {n.hint && <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>{n.hint}</div>}
                    <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', color: 'var(--brand)' }} onClick={() => doShare(n.id, text)}>{n.link ? (es ? 'Compartir' : 'Share') : (es ? 'Copiar caption' : 'Copy caption')}</button>
                      {n.link && <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => doCopy(text)}>{es ? 'Copiar' : 'Copy'}</button>}
                      <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px', marginLeft: 'auto' }} onClick={() => schedule(n.id)} disabled={!when}>⏰ {es ? 'Programar' : 'Schedule'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Próximas programadas */}
          {pending.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{es ? 'Programadas' : 'Scheduled'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pending.map((it) => (
                  <div key={it.id} className="row between" style={{ alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px' }}>
                    <span style={{ fontSize: 12 }}><b>{LABEL[it.network] || it.network}</b> <span className="muted">· {it.lang?.toUpperCase()} · {new Date(it.scheduled_at).toLocaleString(es ? 'es-ES' : 'en-US')}</span></span>
                    <button className="btn btn-ghost" style={{ fontSize: 11.5, color: 'var(--red)' }} onClick={() => cancelItem(it.id)}>{es ? 'Cancelar' : 'Cancel'}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ajustes del recordatorio */}
          {rem && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{es ? '¿A dónde te llega el recordatorio con el copy?' : 'Where do reminders with the copy arrive?'}</div>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input type="checkbox" checked={!!rem.viaEmail} onChange={(e) => setRem({ ...rem, viaEmail: e.target.checked })} /> Email
                </label>
                <input value={rem.email || ''} onChange={(e) => setRem({ ...rem, email: e.target.value })} placeholder={es ? 'tu@correo.com' : 'you@email.com'} style={{ margin: 0, flex: '1 1 200px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  <input type="checkbox" checked={!!rem.viaTelegram} onChange={(e) => setRem({ ...rem, viaTelegram: e.target.checked })} /> Telegram
                </label>
                <input value={rem.telegramChatId || ''} onChange={(e) => setRem({ ...rem, telegramChatId: e.target.value })} placeholder="chat id" style={{ margin: 0, flex: '1 1 140px' }} />
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={saveRem} disabled={busy}>{es ? 'Guardar' : 'Save'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
