'use client';
import { useState } from 'react';
import OnyxIcon from '@/app/components/OnyxIcon';

// Botones de compartir la tarjeta verificada: Web Share nativo (móvil/app),
// copiar el link, y compartir en X con texto pre-armado. El link lleva OpenGraph
// (lo pone la página), así que al pegarlo se ve la tarjeta.
export default function ShareCert({
  url, name, tier, score, lang,
}: { url: string; name: string; tier: string; score: number; lang: 'es' | 'en' }) {
  const es = lang === 'es';
  const [copied, setCopied] = useState(false);
  const L = (a: string, b: string) => (es ? a : b);

  // Texto de presumir (el gancho). Sin cifras de la cuenta, solo score + tier.
  const shareText = es
    ? `Soy ${tier} certificado por Onyx AI (Onyx Score ${score}/100). Verifica mi track record:`
    : `I'm an Onyx AI-certified ${tier} (Onyx Score ${score}/100). Verify my track record:`;

  const canNativeShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  async function nativeShare() {
    try { await (navigator as any).share({ title: `${name} · Onyx`, text: shareText, url }); } catch {}
  }
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;

  const btn: React.CSSProperties = { fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' };

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
      {canNativeShare && (
        <button className="btn btn-primary" onClick={nativeShare} style={btn}>
          <OnyxIcon emoji="📤" size={14} /> {L('Compartir', 'Share')}
        </button>
      )}
      <button className="btn btn-ghost" onClick={copy} style={btn}>
        <OnyxIcon emoji={copied ? '✅' : '🔗'} size={14} /> {copied ? L('¡Copiado!', 'Copied!') : L('Copiar link', 'Copy link')}
      </button>
      <a className="btn btn-ghost" href={xHref} target="_blank" rel="noopener noreferrer" style={btn}>
        <OnyxIcon emoji="𝕏" size={14} /> {L('Compartir en X', 'Share on X')}
      </a>
    </div>
  );
}
