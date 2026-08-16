'use client';
import { mkL } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';
import BrandIcon, { BRAND_COLOR } from '@/app/components/BrandIcon';

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
  const sp = useSearchParams();
  const ref = sp.get('ref') || '';   // afiliado que trajo al prospecto (atribución)
  const { lang } = useLang();
  const L = mkL(lang);
  const [a, setA] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  function reload() {
    // `_` (timestamp) evita cualquier caché del navegador o de intermediarios.
    fetch('/api/academy/public?code=' + encodeURIComponent(String(code)) + '&_=' + Date.now(), { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (j.academy) { setA(j.academy); setState('ok'); } else setState('missing'); })
      .catch(() => setState('missing'));
  }
  useEffect(() => { reload(); }, [code]);
  // Refresca al volver a la pestaña o con atrás/adelante (bfcache), para ver
  // siempre los últimos cambios guardados por el mentor.
  useEffect(() => {
    const onFocus = () => reload();
    const onShow = (e: any) => { if (e.persisted) reload(); };
    const onVis = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('pageshow', onShow); document.removeEventListener('visibilitychange', onVis); };
  }, [code]);

  const money = (cents: number, curr: string) => { const cur = (curr || 'usd').toUpperCase(); const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : ''; const amt = (cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }); return sym ? sym + amt : amt + ' ' + cur; };
  const tierPrice = (p: any) => money(p.price_cents, p.currency) + (p.kind === 'one_time' ? ' · ' + L('pago único', 'one-time') : '/' + (p.interval === 'year' ? L('año', 'yr') : L('mes', 'mo')));
  const join = `/dashboard/academy?join=${code}` + (ref ? `&ref=${encodeURIComponent(ref)}` : '');

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
  const hasYear = (a.membership_year_cents || 0) > 0;
  const yearLabel = hasYear ? money(a.membership_year_cents, a.membership_currency) + '/' + L('año', 'yr') : '';
  const reviews = a.reviews || [];
  const totalFree = (a.modules || []).reduce((s: number, m: any) => s + m.freeCount, 0);
  const Stars = ({ n, size = 15 }: { n: number; size?: number }) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ color: i <= Math.round(n) ? 'var(--gold)' : 'var(--line)', fontSize: size, lineHeight: 1 }}>★</span>)}</span>
  );

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
            <a key={s.key} href={socialUrl(s.key, a.socials[s.key])} target="_blank" rel="noreferrer" title={s.label} style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--card2, rgba(255,255,255,.06))', border: '1px solid var(--line)', color: BRAND_COLOR[s.key] || s.color, textDecoration: 'none' }}><BrandIcon name={s.key} size={18} /></a>
          ))}
        </div>
      )}

      {/* Barra: privada · miembros · precio · mentor */}
      <div className="row" style={{ gap: 20, margin: '16px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="guardian" size={15} /> {L('Privada', 'Private')}</span>
        <span className="muted" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="users" size={15} /> {a.students} {L('miembros', 'members')}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><OnyxIcon name="coins" size={15} /> {priceLabel}</span>
        {hasYear && <span className="sk-chip" style={{ fontSize: 13, background: 'color-mix(in srgb,var(--gold) 14%,transparent)', color: 'var(--gold)' }}>{L('o', 'or')} {yearLabel}{(a.membership_year_save_pct || 0) > 0 && ' · -' + a.membership_year_save_pct + '%'}</span>}
        {(a.reviews_count || 0) > 0 && <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Stars n={a.reviews_avg || 5} /> <b>{a.reviews_avg}</b> <span className="muted">({a.reviews_count})</span></span>}
        <span className="muted" style={{ fontSize: 14 }}>{L('por', 'by')} <b style={{ color: 'var(--tx)' }}>{a.mentor_name}</b></span>
      </div>

      {a.subs_open === false ? (
        <div className="card" style={{ border: '1px solid color-mix(in srgb,var(--gold) 40%,transparent)', textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold)' }}>{L('Inscripciones cerradas', 'Enrollment closed')}</div>
          {a.subs_closed_note && <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{a.subs_closed_note}</div>}
          {a.subs_reopen_at && <div style={{ marginTop: 8, fontSize: 14 }}>{L('Reabre el', 'Reopens on')} <b>{new Date(a.subs_reopen_at).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' })}</b> <span style={{ opacity: .7 }}>({L('tu hora', 'your time')})</span></div>}
          <Link className="btn btn-primary" href={join} style={{ fontSize: 15, padding: '11px 24px', marginTop: 12 }}>{L('Avísame cuando reabra', 'Notify me when it reopens')}</Link>
        </div>
      ) : (<>
        <Link className="btn btn-primary" href={join} style={{ fontSize: 16, padding: '12px 28px' }}>{paid ? L('Unirme por ', 'Join for ') + priceLabel : L('Unirme gratis', 'Join free')}</Link>
        {hasYear && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{L('También disponible el plan anual', 'Annual plan also available')}: <b style={{ color: 'var(--gold)' }}>{yearLabel}</b>{(a.membership_year_save_pct || 0) > 0 && ' (' + L('ahorra', 'save') + ' ' + a.membership_year_save_pct + '%)'}.</div>}
      </>)}

      {/* Texto de ventas */}
      {a.pitch && <div className="card" style={{ marginTop: 24, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65 }}>{a.pitch}</div>}
      {a.about && !a.pitch && <div className="card" style={{ marginTop: 24, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65 }}>{a.about}</div>}

      {/* Reseñas verificadas de alumnos */}
      {reviews.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{L('Lo que dicen los alumnos', 'What students say')}</h2>
            {(a.reviews_count || 0) > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Stars n={a.reviews_avg || 5} size={17} /> <b>{a.reviews_avg}</b> <span className="muted">({a.reviews_count})</span></span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {reviews.map((r: any, i: number) => (
              <div key={i} className="card" style={{ margin: 0 }}>
                <div className="row between" style={{ alignItems: 'center', marginBottom: 6 }}><b style={{ fontSize: 14 }}>{r.name}</b><Stars n={r.rating} /></div>
                {r.body && <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{r.body}</p>}
                <div className="muted" style={{ fontSize: 11, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}><OnyxIcon name="guardian" size={12} /> {L('Alumno verificado', 'Verified student')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 30 }}>
        <Link className="btn btn-primary" href={join} style={{ fontSize: 16, padding: '12px 28px' }}>{paid ? L('Unirme por ', 'Join for ') + priceLabel : L('Unirme gratis', 'Join free')}</Link>
      </div>
    </div>
  );
}
