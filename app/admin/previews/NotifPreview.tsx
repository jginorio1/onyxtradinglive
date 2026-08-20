'use client';
// Vista previa reutilizable de una NOTIFICACIÓN en sus tres canales a la vez:
// campana (dentro de la app), push (toast del móvil) y Telegram (burbuja).
// Muestra solo los canales activos. La usa Admin → Notificaciones.
export default function NotifPreview({
  title, body, bell = true, push = true, telegram = true, es = true,
}: { title: string; body: string; bell?: boolean; push?: boolean; telegram?: boolean; es?: boolean }) {
  const t = title || (es ? '(sin título)' : '(no title)');
  const b = body || '';
  const label = { color: 'var(--mut)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 } as any;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
      {bell && (
        <div>
          <div style={label}>🔔 {es ? 'Campana' : 'Bell'}</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: 'var(--bg2)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{b}</div>
          </div>
        </div>
      )}
      {push && (
        <div>
          <div style={label}>📱 Push</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: 'var(--card)', display: 'flex', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand)', color: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flex: 'none' }}>O</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div>
              <div style={{ fontSize: 11, color: 'var(--mut)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b}</div>
            </div>
          </div>
        </div>
      )}
      {telegram && (
        <div>
          <div style={label}>✈️ Telegram</div>
          <div style={{ background: 'rgba(124,140,255,.12)', border: '1px solid rgba(124,140,255,.3)', borderRadius: 10, borderTopLeftRadius: 2, padding: '8px 10px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t}</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{b}</div>
          </div>
        </div>
      )}
    </div>
  );
}
