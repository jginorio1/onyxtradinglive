'use client';
import { useLang } from '@/lib/lang';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { renderLegal } from '@/app/legalRender';

export default function Terms() {
  const { lang } = useLang();
  const [ov, setOv] = useState<string | null>(null);
  useEffect(() => { fetch('/api/landing-content?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((c) => setOv(c?.legal?.[`terms_${lang}`] || null)).catch(() => {}); }, [lang]);
  const es = (
    <>
      <h1>Términos y Condiciones</h1>
      <p className="muted">Última actualización: septiembre de 2026</p>
      <h3>1. El servicio</h3>
      <p>Onyx Trading Live ("Onyx") es una herramienta de diario y análisis de trading que se conecta a tus cuentas de MetaTrader (MT4/MT5), cTrader, MatchTrader, TradeLocker, DXtrade y otras plataformas compatibles en modo <b>solo lectura</b> para mostrar tu historial y estadísticas. Onyx no ejecuta operaciones ni mueve fondos.</p>
      <h3>2. Cuentas</h3>
      <p>Eres responsable de mantener la confidencialidad de tu cuenta y tu API key. Debes ser mayor de edad para usar el servicio.</p>
      <h3>3. Suscripciones y pagos</h3>
      <p>En iPhone y iPad, las suscripciones se compran mediante la compra dentro de la app de Apple (In-App Purchase) y se cobran a tu Apple ID; se renuevan automáticamente salvo que desactives la renovación al menos 24 horas antes de que termine el periodo, y puedes gestionarlas o cancelarlas en Ajustes → tu nombre → Suscripciones. En la web, los pagos se gestionan a través de Stripe y puedes cancelar desde tu panel. En ambos casos el acceso continúa hasta el final del periodo pagado. Los reembolsos se evalúan caso por caso; los de compras hechas en la App Store los gestiona Apple.</p>
      <h3>4. Uso aceptable</h3>
      <p>No puedes usar Onyx para actividades ilegales, ni intentar vulnerar la seguridad de la plataforma o de otros usuarios.</p>
      <h3>5. Sin asesoramiento financiero</h3>
      <p>Onyx es una herramienta informativa. No constituye asesoramiento financiero ni recomendaciones de inversión. Operar conlleva riesgo de pérdida.</p>
      <h3>6. Limitación de responsabilidad</h3>
      <p>El servicio se ofrece "tal cual". Onyx no se responsabiliza de pérdidas derivadas del uso de la plataforma, de errores en los datos importados o de interrupciones del servicio.</p>
      <h3>7. Cambios</h3>
      <p>Podemos actualizar estos términos. Te avisaremos de cambios importantes.</p>
      <h3>8. Contacto</h3>
      <p>Para cualquier consulta, contáctanos a través del correo indicado en la web.</p>
    </>
  );
  const en = (
    <>
      <h1>Terms & Conditions</h1>
      <p className="muted">Last updated: September 2026</p>
      <h3>1. The service</h3>
      <p>Onyx Trading Live ("Onyx") is a trading journal and analytics tool that connects to your MetaTrader (MT4/MT5), cTrader, MatchTrader, TradeLocker, DXtrade and other supported platform accounts in <b>read-only</b> mode to display your history and statistics. Onyx does not place trades or move funds.</p>
      <h3>2. Accounts</h3>
      <p>You are responsible for keeping your account and API key confidential. You must be of legal age to use the service.</p>
      <h3>3. Subscriptions & payments</h3>
      <p>On iPhone and iPad, subscriptions are purchased through Apple In-App Purchase and charged to your Apple ID; they renew automatically unless you turn off auto-renew at least 24 hours before the end of the period, and you can manage or cancel them in Settings → your name → Subscriptions. On the web, payments are handled through Stripe and you can cancel from your panel. In both cases, access continues until the end of the paid period. Refunds are evaluated case by case; refunds for purchases made in the App Store are handled by Apple.</p>
      <h3>4. Acceptable use</h3>
      <p>You may not use Onyx for illegal activities, nor attempt to breach the security of the platform or other users.</p>
      <h3>5. No financial advice</h3>
      <p>Onyx is an informational tool. It does not constitute financial advice or investment recommendations. Trading involves risk of loss.</p>
      <h3>6. Limitation of liability</h3>
      <p>The service is provided "as is". Onyx is not liable for losses arising from use of the platform, errors in imported data, or service interruptions.</p>
      <h3>7. Changes</h3>
      <p>We may update these terms. We will notify you of significant changes.</p>
      <h3>8. Contact</h3>
      <p>For any questions, contact us via the email listed on the website.</p>
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
