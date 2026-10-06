'use client';
import { useLang } from '@/lib/lang';
import { useEffect, useState } from 'react';
import { renderLegal } from '@/app/legalRender';

export default function Cookies() {
  const { lang } = useLang();
  const [ov, setOv] = useState<string | null>(null);
  useEffect(() => { fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setOv(c?.legal?.[`cookies_${lang}`] || null)).catch(() => {}); }, [lang]);
  const es = (
    <>
      <h1>Política de Cookies</h1>
      <p className="muted">Última actualización: octubre de 2026</p>
      <p>Esta política explica qué cookies y tecnologías similares usa el sitio web y la aplicación de Onyx Trading Live, y para qué.</p>
      <h3>1. Qué son las cookies</h3>
      <p>Las cookies son pequeños archivos de texto que se guardan en tu dispositivo cuando visitas un sitio. Sirven para que la página funcione, para recordar tus preferencias y para medir cómo se usa.</p>
      <h3>2. Qué cookies usamos</h3>
      <p><b>Esenciales (siempre activas).</b> Necesarias para que el sitio funcione: mantener tu sesión iniciada, recordar tu idioma y tu tema (claro/oscuro), y proteger los formularios frente a abusos (por ejemplo, la verificación de Cloudflare Turnstile). Sin ellas el servicio no funciona, por eso no requieren consentimiento.</p>
      <p><b>Analíticas (opcionales).</b> Usamos Google Analytics para entender de forma agregada qué páginas se visitan y cómo mejorar el sitio. No se usan para identificarte personalmente ni para publicidad.</p>
      <h3>3. Cookies de terceros</h3>
      <p>Algunos proveedores que usamos pueden colocar sus propias cookies cuando interactúas con sus funciones: Cloudflare (seguridad), Google Analytics (analítica) y Stripe (pagos en la web). Cada uno tiene su propia política.</p>
      <h3>4. Cómo controlar las cookies</h3>
      <p>Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que si bloqueas las esenciales, partes del sitio (como iniciar sesión) pueden dejar de funcionar. La analítica es opcional y puedes desactivarla con las extensiones o ajustes de tu navegador.</p>
      <h3>5. Publicidad</h3>
      <p>Onyx Trading Live no usa cookies para mostrarte anuncios personalizados ni vende tus datos a anunciantes.</p>
      <h3>6. Contacto</h3>
      <p>Para cualquier consulta sobre esta política, escríbenos a <a href="mailto:support@onyxtradinglive.com">support@onyxtradinglive.com</a>. Consulta también nuestra <a href="/privacy">Política de Privacidad</a>.</p>
    </>
  );
  const en = (
    <>
      <h1>Cookie Policy</h1>
      <p className="muted">Last updated: October 2026</p>
      <p>This policy explains which cookies and similar technologies the Onyx Trading Live website and app use, and why.</p>
      <h3>1. What cookies are</h3>
      <p>Cookies are small text files stored on your device when you visit a site. They make the page work, remember your preferences, and measure how it is used.</p>
      <h3>2. Which cookies we use</h3>
      <p><b>Essential (always on).</b> Needed for the site to work: keeping you logged in, remembering your language and theme (light/dark), and protecting forms against abuse (for example, Cloudflare Turnstile verification). Without them the service doesn't work, so they don't require consent.</p>
      <p><b>Analytics (optional).</b> We use Google Analytics to understand, in aggregate, which pages are visited and how to improve the site. It is not used to identify you personally or for advertising.</p>
      <h3>3. Third-party cookies</h3>
      <p>Some providers we use may set their own cookies when you interact with their features: Cloudflare (security), Google Analytics (analytics) and Stripe (payments on the web). Each has its own policy.</p>
      <h3>4. How to control cookies</h3>
      <p>You can delete or block cookies from your browser settings. Note that if you block essential cookies, parts of the site (such as signing in) may stop working. Analytics is optional and you can disable it with your browser's extensions or settings.</p>
      <h3>5. Advertising</h3>
      <p>Onyx Trading Live does not use cookies to show you personalized ads or sell your data to advertisers.</p>
      <h3>6. Contact</h3>
      <p>For any questions about this policy, email <a href="mailto:support@onyxtradinglive.com">support@onyxtradinglive.com</a>. See also our <a href="/privacy">Privacy Policy</a>.</p>
    </>
  );
  return (
    <>
      <div className="wrap" style={{ maxWidth: 760, padding: '40px 22px' }}>
        <div className="card" style={{ lineHeight: 1.8 }}>{ov ? renderLegal(ov) : (lang === 'es' ? es : en)}</div>
        <p style={{ marginTop: 20 }}><a className="muted" style={{ cursor: 'pointer' }} onClick={(e) => { e.preventDefault(); if (typeof window !== 'undefined' && window.history.length > 1) window.history.back(); else window.location.href = '/'; }}>← {lang === 'es' ? 'Volver' : 'Back'}</a></p>
      </div>
    </>
  );
}
