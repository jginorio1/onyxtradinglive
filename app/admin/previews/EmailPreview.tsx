'use client';
// Vista previa reutilizable de un CORREO tal como le llega al destinatario:
// remitente, asunto, cuerpo y pie de marca. La usan Campañas, correos de
// academia y las plantillas del dueño para "ver en vivo" lo que se enviará.
export default function EmailPreview({
  subject, body, footer, brand = 'Onyx Trading Live', es = true,
}: { subject: string; body: string; footer?: string; brand?: string; es?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--brand)', color: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flex: 'none' }}>O</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand}</div>
          <div style={{ fontSize: 11, color: 'var(--mut)' }}>{es ? 'para ti' : 'to you'}</div>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{subject || (es ? '(sin asunto)' : '(no subject)')}</div>
        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.55, color: 'var(--tx)' }}>{body || '—'}</div>
        {footer && <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--mut)', whiteSpace: 'pre-wrap' }}>{footer}</div>}
        <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--mut)' }}>{es ? 'Si no quieres estos correos, puedes darte de baja.' : 'If you no longer want these emails, you can unsubscribe.'}</div>
      </div>
    </div>
  );
}
