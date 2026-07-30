'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';

// Página pública de VENTAS de una academia (Onyx Academy), estilo Skool.
const SOCIAL: { key: string; label: string; abbr: string; color: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', abbr: 'WA', color: '#25D366' },
  { key: 'instagram', label: 'Instagram', abbr: 'IG', color: '#E1306C' },
  { key: 'facebook', label: 'Facebook', abbr: 'FB', color: '#1877F2' },
  { key: 'youtube', label: 'YouTube', abbr: 'YT', color: '#FF0000' },
  { key: 'tiktok', label: 'TikTok', abbr: 'TT', color: '#000000' },
  { key: 'telegram', label: 'Telegram', abbr: 'TG', color: '#229ED9' },
  { key: 'x', label: 'X', abbr: 'X', color: '#000000' },
];
function socialUrl(key: string, val: string): string {
  const v = String(val || '').trim(); if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, '');
  const map: Record<string, string> = { whatsapp: 'https://wa.me/' + v.replace(/[^\d]/g, ''), instagram: 'https://instagram.com/' + h, facebook: 'https://facebook.com/' + h, youtube: 'https://youtube.com/@' + h, tiktok: 'https://tiktok.com/@' + h, telegram: 'https://t.me/' + h, x: 'https://x.com/' + h };
  return map[key] || v;
}
function embed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return 'https://www.youtube.com/embed/' + yt[1];
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return 'https://player.vimeo.com/video/' + vi[1];
  return null;
}

export default function AcademiaPublic() {
  const { code } = useParams<{ code: string }>();
  const { lang } = useLang();
  const L = (a: string, b: string) => (lang === 'en' ? b : a);
  const [a, setA] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  function reload() {
    fetch('/api/academy/public?code=' + encodeURIComponent(String(code)), { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (j.academy) { setA(j.academy); setState('ok'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }
  useEffect(() => { reload(); }, [code]);
  // Refresca al volver a la pestaña (para ver cambios recién guardados).
  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [code]);

  const money = (cents: number, curr: string) => { const cur = (curr || 'usd').toUpperCase(); const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : ''; const amt = (cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }); return sym ? sym + amt : amt + ' ' + cur; };
  const tierPrice = (p: any) => money(p.price_cents, p.currency) + (p.kind === 'one_time' ? ' · ' + L('pago único', 'one-time') : '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo')));
  const join = `/dashboard/academy?join=${code}`;

  if (state === 'loading') return <div className="wrap" style={{ padding: '60px 22px' }}><p className="muted">…</p></div>;
  if (state === 'missing') return (
    <div className="wrap" style={{ padding: '60px 22px', textAlign: 'center' }}>
      <h1>{L('Academia no encontrada', 'Academy not found')}</h1>
      <Link className="btn btn-primary" href="/dashboard/academy" style={{ marginTop: 16 }}>Onyx Academy</Link>
    </div>
  );

  const emb = embed(a.intro_video_url || '');
  const paid = (a.membership_price_cents || 0) > 0;
  const priceLabel = paid ? money(a.membership_price_cents, a.membership_currency) + '/' + (a.membership_interval === 'year' ? L('año', 'yr') : L('mes', 'mo')) : L('Gratis', 'Free');
  const totalFree = (a.modules || []).reduce((s: number, m: any) => s + m.freeCount, 0);

  return (
    <div className="wrap" style={{ padding: '40px 22px 70px', maxWidth: 900, margin: '0 auto' }}>
      {/* Video / portada */}
      {emb
        ? <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}><iframe src={emb} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
        : <div style={{ height: 200, borderRadius: 16, marginBottom: 18, backgroundSize: 'cover', backgroundPosition: 'center', ...(a.cover_url ? { backgroundImage: `url(${a.cover_url})` } : { background: 'var(--grad)' }) }} />}

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {a.logo_url && <img src={a.logo_url} alt="" style={{ width: 60, height: 60, borderRadius: 14, objectFit: 'cover', flex: 'none' }} />}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 30, letterSpacing: '-.5px', margin: 0 }}>{a.academy_name}</h1>
          {a.tagline && <p className="muted" style={{ fontSize: 16, marginTop: 4 }}>{a.tagline}</p>}
        </div>
      </div>
      {a.socials && SOCIAL.some((s) => a.socials[s.key]) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {SOCIAL.filter((s) => a.socials[s.key]).map((s) => (
            <a key={s.key} href={socialUrl(s.key, a.socials[s.key])} target="_blank" rel="noreferrer" title={s.label} style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--card2, rgba(255,255,255,.06))', border: '1px solid var(--line)', color: s.color, fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>{s.abbr}</a>
          ))}
        </div>
      )}

      {/* Barra: privada · miembros · precio · mentor */}
      <div className="row" style={{ gap: 20, margin: '16px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="guardian" size={15} /> {L('Privada', 'Private')}</span>
        <span className="muted" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="users" size={15} /> {a.students} {L('miembros', 'members')}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="coins" size={15} /> {priceLabel}</span>
        <span className="muted" style={{ fontSize: 14 }}>{L('por', 'by')} <b style={{ color: 'var(--tx)' }}>{a.mentor_name}</b></span>
      </div>

      <Link className="btn btn-primary" href={join} style={{ fontSize: 16, padding: '12px 28px' }}>{paid ? L('Unirme por ', 'Join for ') + priceLabel : L('Unirme gratis', 'Join free')}</Link>

      {/* Texto de ventas */}
      {a.pitch && <div className="card" style={{ marginTop: 24, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65 }}>{a.pitch}</div>}
      {a.about && !a.pitch && <div className="card" style={{ marginTop: 24, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65 }}>{a.about}</div>}

      {/* Niveles / upsells */}
      {(a.products || []).length > 0 && (
        <>
          <h2 style={{ margin: '28px 0 12px', display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: 'var(--gold)', display: 'inline-flex' }}><OnyxIcon name="gem" size={20} /></span> {L('Elige tu nivel', 'Choose your tier')}</h2>
          <div className="grid g3">
            {a.products.map((p: any) => (
              <div key={p.id} className="card">
                <div style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</div>
                {p.description && <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{p.description}</p>}
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', margin: '8px 0 12px' }}>{tierPrice(p)}</div>
                {(p.perks?.copy || p.perks?.guardian) && <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>{p.perks?.copy && <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ Copy trading</span>}{p.perks?.guardian && <span style={{ fontSize: 12, color: 'var(--soft-green)' }}>✓ Onyx Guardian</span>}</div>}
                <Link className="btn btn-primary" href={join} style={{ width: '100%', textAlign: 'center' }}>{L('Empezar', 'Get started')}</Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Vitrina de contenido */}
      {(a.modules || []).length > 0 && (
        <>
          <h2 style={{ margin: '28px 0 4px' }}>{L('Contenido', 'Content')}{totalFree > 0 && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> · {totalFree} {L('lecciones gratis', 'free lessons')}</span>}</h2>
          {a.modules.map((m: any) => (
            <div key={m.id} className="card" style={{ marginTop: 12 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: m.description ? 4 : 10 }}><span className="card-ic"><OnyxIcon name="modules" size={16} /></span> {m.title}</h3>
              {m.description && <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{m.description}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {m.lessons.map((l: any) => (
                  <div key={l.id} className="row" style={{ gap: 10, alignItems: 'center', fontSize: 13.5 }}>
                    <span style={{ color: l.is_free ? 'var(--green)' : 'var(--mut)', display: 'inline-flex' }}>{l.is_free ? '▷' : <OnyxIcon name="guardian" size={13} />}</span>
                    <span style={{ flex: 1 }}>{l.title}</span>
                    {l.is_free && <span className="pill" style={{ fontSize: 10, color: 'var(--soft-green)', background: 'rgba(52,226,160,.15)' }}>{L('gratis', 'free')}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 30 }}>
        <Link className="btn btn-primary" href={join} style={{ fontSize: 16, padding: '12px 28px' }}>{paid ? L('Unirme por ', 'Join for ') + priceLabel : L('Unirme gratis', 'Join free')}</Link>
      </div>
    </div>
  );
}
