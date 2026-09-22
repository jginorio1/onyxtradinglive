'use client';
// Barra superior (no se imprime) con botón para guardar/imprimir en PDF.
export default function PrintButton({ es }: { es: boolean }) {
  return (
    <div className="mk-toolbar no-print" style={{
      position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 10, justifyContent: 'center',
      alignItems: 'center', padding: '12px 16px', background: '#0b0f1e', color: '#fff',
      borderBottom: '1px solid #232b40', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, opacity: .85 }}>
        {es ? 'Propuesta lista. Guárdala como PDF (destino: “Guardar como PDF”).' : 'Proposal ready. Save it as PDF (destination: “Save as PDF”).'}
      </span>
      <button onClick={() => window.print()} style={{
        background: '#e8b64c', color: '#0b0f1e', fontWeight: 800, fontSize: 14,
        border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer',
      }}>{es ? '⬇ Descargar / Imprimir PDF' : '⬇ Download / Print PDF'}</button>
    </div>
  );
}
