// ============================================================
// Marca de Onyx Bot Lab = el anillo "O" de Onyx (igual al icono original)
// pero en versión negra con el punto morado. Reemplaza al ◆ dorado en toda
// la superficie de Bot Lab (cabecera, pie, chat y acentos del landing).
//
//  - <OnyxMark/>  : el logo completo (recuadro negro + anillo blanco + punto morado).
//  - <OnyxGlyph/> : solo el anillo, inline, en el color del texto (currentColor),
//                   para reemplazar los ◆ pequeños en insignias y botones.
// ============================================================

// Logo en recuadro (cabecera / pie / avatar del chat).
export function OnyxMark({ size = 32, radius = 9, ring = '#fff', dot = '#a06bff', box = '#000' }:
  { size?: number; radius?: number; ring?: string; dot?: string; box?: string }) {
  const s = Math.round(size * 0.74);
  return (
    <span style={{ width: size, height: size, borderRadius: radius, background: box, border: '0.5px solid #2a2a2a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="26" r="13" fill="none" stroke={ring} strokeWidth="6" />
        <circle cx="35" cy="16" r="5" fill={dot} />
      </svg>
    </span>
  );
}

// Anillo inline para acentos (reemplaza el ◆). Toma el color del texto salvo
// que se le pase un color de punto distinto.
export function OnyxGlyph({ size = 14, dot }: { size?: number; dot?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none', verticalAlign: '-2px' }}>
      <circle cx="24" cy="26" r="13" fill="none" stroke="currentColor" strokeWidth="7" />
      <circle cx="36" cy="15" r="5" fill={dot || 'currentColor'} />
    </svg>
  );
}
