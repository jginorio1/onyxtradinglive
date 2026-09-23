'use client';
import { useLang } from '@/lib/lang';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { renderLegal } from '@/app/legalRender';

export default function Privacy() {
  const { lang } = useLang();
  const [ov, setOv] = useState<string | null>(null);
  useEffect(() => { fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setOv(c?.legal?.[`privacy_${lang}`] || null)).catch(() => {}); }, [lang]);
  const es = (
    <>
      <h1>Política de Privacidad</h1>
      <p className="muted">Última actualización: septiembre de 2026</p>
      <p>Esta política aplica al sitio web y a la aplicación móvil de Onyx Trading Live.</p>
      <h3>1. Qué datos recogemos</h3>
      <p>Recogemos: (a) datos de tu cuenta (nombre, correo electrónico y país); (b) los datos de tu historial de trading que envía el connector en modo solo lectura (operaciones, balance, número de cuenta); (c) datos de pago gestionados por Stripe (no almacenamos números de tarjeta); (d) datos de uso y analítica de la app y el sitio (páginas vistas, eventos), mediante Google Analytics; (e) si activas las notificaciones, un identificador de dispositivo (token de Firebase Cloud Messaging, de Google) para poder enviártelas; y (f) las fotos o imágenes que tú decidas adjuntar (por ejemplo, capturas de operaciones o comprobantes en soporte) usando la cámara o tu galería. La cámara y la galería solo se usan cuando tú eliges adjuntar una imagen.</p>
      <h3>2. Para qué los usamos</h3>
      <p>Usamos tus datos para crear y mantener tu cuenta, mostrarte tus estadísticas, gestionar tu suscripción, enviarte avisos que hayas activado y mejorar el servicio. <b>No vendemos tus datos a terceros.</b></p>
      <h3>3. Dónde se guardan y con quién los compartimos</h3>
      <p>Los datos se almacenan de forma segura en nuestra base de datos (Supabase). Solo los compartimos con proveedores que los procesan en nuestro nombre: Supabase (base de datos y almacenamiento), Vercel (hosting), Stripe (pagos), Google Analytics (analítica), Google Firebase Cloud Messaging (notificaciones push), Anthropic (el asistente de IA procesa el texto que le escribes para responderte) y Resend (correos). Cada uno tiene su propia política de privacidad. No compartimos tus datos con terceros para su propio marketing.</p>
      <h3>4. Cifrado y seguridad</h3>
      <p>Todos los datos viajan cifrados (HTTPS). La conexión con tu plataforma (MetaTrader, cTrader…) es de solo lectura: nunca tenemos tu contraseña del bróker ni podemos operar ni mover tu dinero. Aplicamos medidas para proteger tu información, aunque ningún sistema es 100% infalible.</p>
      <h3>5. Cuánto tiempo guardamos tus datos</h3>
      <p>Conservamos tus datos mientras tengas una cuenta activa. Si eliminas tu cuenta, borramos tus datos personales en un plazo máximo de 30 días, salvo lo que la ley nos obligue a conservar (por ejemplo, registros de facturación).</p>
      <h3>6. Tus derechos y cómo borrar tus datos</h3>
      <p>Puedes acceder, corregir o eliminar tus datos y tu cuenta en cualquier momento. Para solicitar la eliminación de tu cuenta y tus datos, escríbenos a <a href="mailto:support@onyxtradinglive.com">support@onyxtradinglive.com</a> desde el correo de tu cuenta, o contáctanos desde la app. Procesamos tu solicitud sin coste.</p>
      <h3>7. Menores</h3>
      <p>Onyx Trading Live no está dirigido a menores de 18 años y no recogemos a sabiendas datos de menores.</p>
      <h3>8. Cookies</h3>
      <p>Usamos cookies esenciales para mantener tu sesión iniciada y tu idioma. La analítica es opcional.</p>
      <h3>9. Contacto</h3>
      <p>Para ejercer tus derechos o cualquier consulta, escríbenos a <a href="mailto:support@onyxtradinglive.com">support@onyxtradinglive.com</a>.</p>
    </>
  );
  const en = (
    <>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: September 2026</p>
      <p>This policy applies to the Onyx Trading Live website and mobile app.</p>
      <h3>1. What data we collect</h3>
      <p>We collect: (a) account data (name, email and country); (b) the trading history data sent by the connector in read-only mode (trades, balance, account number); (c) payment data handled by Stripe (we do not store card numbers); (d) usage and analytics data from the app and website (page views, events) via Google Analytics; (e) if you enable notifications, a device identifier (Firebase Cloud Messaging token, from Google) so we can deliver them; and (f) the photos or images you choose to attach (for example, trade screenshots or receipts in support) using your camera or gallery. The camera and gallery are used only when you choose to attach an image.</p>
      <h3>2. How we use it</h3>
      <p>We use your data to create and maintain your account, show your statistics, manage your subscription, send the alerts you enable, and improve the service. <b>We do not sell your data to third parties.</b></p>
      <h3>3. Where it is stored and who we share it with</h3>
      <p>Data is stored securely in our database (Supabase). We only share it with providers that process it on our behalf: Supabase (database and storage), Vercel (hosting), Stripe (payments), Google Analytics (analytics), Google Firebase Cloud Messaging (push notifications), Anthropic (the AI assistant processes the text you send it to answer you) and Resend (emails). Each has its own privacy policy. We do not share your data with third parties for their own marketing.</p>
      <h3>4. Encryption and security</h3>
      <p>All data travels encrypted (HTTPS). The connection to your platform (MetaTrader, cTrader…) is read-only: we never have your broker password and can never trade or move your money. We apply measures to protect your information, although no system is 100% foolproof.</p>
      <h3>5. How long we keep your data</h3>
      <p>We keep your data while your account is active. If you delete your account, we erase your personal data within 30 days, except where the law requires us to keep it (for example, billing records).</p>
      <h3>6. Your rights and how to delete your data</h3>
      <p>You can access, correct or delete your data and account at any time. To request deletion of your account and data, email <a href="mailto:support@onyxtradinglive.com">support@onyxtradinglive.com</a> from your account email, or contact us from the app. We process your request at no cost.</p>
      <h3>7. Children</h3>
      <p>Onyx Trading Live is not directed to anyone under 18, and we do not knowingly collect data from minors.</p>
      <h3>8. Cookies</h3>
      <p>We use essential cookies to keep your session logged in and remember your language. Analytics is optional.</p>
      <h3>9. Contact</h3>
      <p>To exercise your rights or for any questions, email <a href="mailto:support@onyxtradinglive.com">support@onyxtradinglive.com</a>.</p>
    </>
  );
  return (
    <>
      <div className="wrap" style={{ maxWidth: 760, padding: '40px 22px' }}>
        <div className="card" style={{ lineHeight: 1.8 }}>{ov ? renderLegal(ov) : (lang === 'es' ? es : en)}</div>
        <p style={{ marginTop: 20 }}><Link href="/" className="muted">← {lang === 'es' ? 'Volver al inicio' : 'Back home'}</Link></p>
      </div>
    </>
  );
}
