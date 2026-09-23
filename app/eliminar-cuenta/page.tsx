'use client';
import { mkL } from '@/lib/i18n';
import { useLang } from '@/lib/lang';
import Link from 'next/link';
import OnyxIcon from '@/app/components/OnyxIcon';

// Página pública de solicitud de eliminación de cuenta y datos. Requerida por
// Google Play (Data safety → Delete account URL). Debe estar accesible sin login,
// describir los pasos y detallar qué datos se borran y cuáles se conservan.
export default function EliminarCuenta() {
  const { lang } = useLang();
  const L = mkL(lang);
  const soporte = 'soporte@onyxtradinglive.com';

  return (
    <div className="wrap" style={{ padding: '48px 22px 70px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--brand)' }}>
        <OnyxIcon name="settings" size={24} />
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx)' }}>{L('Eliminar tu cuenta de Onyx Trading Live', 'Delete your Onyx Trading Live account')}</span>
      </div>

      <p className="muted" style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6 }}>
        {L(
          'Puedes solicitar la eliminación de tu cuenta y de los datos asociados en cualquier momento. Sigue estos pasos:',
          'You can request deletion of your account and associated data at any time. Follow these steps:',
        )}
      </p>

      <ol style={{ fontSize: 15, lineHeight: 1.8, paddingLeft: 20, marginTop: 10 }}>
        <li>{L('Inicia sesión en la app o en ', 'Sign in to the app or at ')}<Link href="/dashboard" style={{ color: 'var(--brand)' }}>onyxtradinglive.com</Link>.</li>
        <li>{L('Ve a ', 'Go to ')}<b>{L('Mi cuenta', 'My account')}</b>.</li>
        <li>{L('En la parte inferior, pulsa ', 'At the bottom, tap ')}<b>{L('“Borrar cuenta”', '“Delete account”')}</b>{L(' y confirma.', ' and confirm.')}</li>
      </ol>

      <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 8 }}>
        {L('Si no puedes acceder a tu cuenta, escríbenos a ', 'If you can’t access your account, email us at ')}
        <a href={`mailto:${soporte}?subject=Solicitud%20de%20eliminación%20de%20cuenta`} style={{ color: 'var(--brand)' }}>{soporte}</a>
        {L(' desde el correo de tu cuenta y procesaremos la eliminación.', ' from your account email and we will process the deletion.')}
      </p>

      <div style={{ marginTop: 26, padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--card)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{L('Qué se elimina', 'What gets deleted')}</div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {L(
            'Tu perfil (nombre, correo), las cuentas de trading que hayas conectado, tus claves de API, tu historial de operaciones sincronizado, tus notas, mensajes de soporte y tus preferencias. La eliminación es permanente.',
            'Your profile (name, email), any trading accounts you connected, your API keys, your synced trade history, your notes, support messages and preferences. Deletion is permanent.',
          )}
        </p>
        <div style={{ fontWeight: 700, margin: '14px 0 8px' }}>{L('Qué se conserva', 'What is retained')}</div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {L(
            'Podemos conservar durante un tiempo limitado los registros de facturación y las transacciones de pago cuando la ley (fiscal/contable) nos obliga a ello. Estos registros no se usan para otro fin y se eliminan al vencer el periodo legal de retención.',
            'We may retain billing records and payment transactions for a limited time when required by law (tax/accounting). These records are not used for any other purpose and are deleted once the legal retention period ends.',
          )}
        </p>
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 20 }}>
        {L('Consulta también nuestra ', 'See also our ')}
        <Link href="/privacy" style={{ color: 'var(--brand)' }}>{L('Política de privacidad', 'Privacy Policy')}</Link>.
      </p>
    </div>
  );
}
