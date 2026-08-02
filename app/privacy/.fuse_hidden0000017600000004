'use client';
import { useLang } from '@/lib/lang';
import Link from 'next/link';

export default function Privacy() {
  const { lang } = useLang();
  const es = (
    <>
      <h1>Política de Privacidad</h1>
      <p className="muted">Última actualización: 2026</p>
      <h3>1. Qué datos recogemos</h3>
      <p>Recogemos tu email (para tu cuenta), los datos de tu historial de trading que envía el connector (operaciones, balance, cuenta) y datos de pago gestionados por Stripe (no almacenamos números de tarjeta).</p>
      <h3>2. Para qué los usamos</h3>
      <p>Usamos tus datos para mostrarte tus estadísticas, gestionar tu suscripción y mejorar el servicio. No vendemos tus datos a terceros.</p>
      <h3>3. Dónde se guardan</h3>
      <p>Los datos se almacenan de forma segura en nuestra base de datos (Supabase). Los pagos se procesan a través de Stripe.</p>
      <h3>4. Terceros</h3>
      <p>Usamos proveedores de confianza: Supabase (base de datos), Vercel (hosting) y Stripe (pagos). Cada uno tiene sus propias políticas de privacidad.</p>
      <h3>5. Seguridad</h3>
      <p>La conexión con MetaTrader es de solo lectura. Aplicamos medidas para proteger tu información, aunque ningún sistema es 100% infalible.</p>
      <h3>6. Tus derechos</h3>
      <p>Puedes acceder, corregir o eliminar tus datos y tu cuenta en cualquier momento contactándonos.</p>
      <h3>7. Cookies</h3>
      <p>Usamos cookies esenciales para mantener tu sesión iniciada.</p>
      <h3>8. Contacto</h3>
      <p>Para ejercer tus derechos o cualquier consulta, contáctanos a través del correo indicado en la web.</p>
    </>
  );
  const en = (
    <>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 2026</p>
      <h3>1. What data we collect</h3>
      <p>We collect your email (for your account), the trading history data sent by the connector (trades, balance, account) and payment data handled by Stripe (we do not store card numbers).</p>
      <h3>2. How we use it</h3>
      <p>We use your data to show your statistics, manage your subscription and improve the service. We do not sell your data to third parties.</p>
      <h3>3. Where it is stored</h3>
      <p>Data is stored securely in our database (Supabase). Payments are processed through Stripe.</p>
      <h3>4. Third parties</h3>
      <p>We use trusted providers: Supabase (database), Vercel (hosting) and Stripe (payments). Each has its own privacy policy.</p>
      <h3>5. Security</h3>
      <p>The MetaTrader connection is read-only. We apply measures to protect your information, although no system is 100% foolproof.</p>
      <h3>6. Your rights</h3>
      <p>You can access, correct or delete your data and account at any time by contacting us.</p>
      <h3>7. Cookies</h3>
      <p>We use essential cookies to keep your session logged in.</p>
      <h3>8. Contact</h3>
      <p>To exercise your rights or for any questions, contact us via the email listed on the website.</p>
    </>
  );
  return (
    <>
      <div className="wrap" style={{ maxWidth: 760, padding: '40px 22px' }}>
        <div className="card" style={{ lineHeight: 1.8 }}>{lang === 'es' ? es : en}</div>
        <p style={{ marginTop: 20 }}><Link href="/" className="muted">← {lang === 'es' ? 'Volver al inicio' : 'Back home'}</Link></p>
      </div>
    </>
  );
}
