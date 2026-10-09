import { loadChallenge } from '@/lib/challenge';

// ============================================================
// GUARDIÁN DE REGLAS DE PROP FIRM (copia entre cuentas) · motor
// ------------------------------------------------------------
// Decide si una cuenta ESCLAVA puede seguir copiando según las reglas de SU
// prop firm. Reutiliza el marcador de "Mi reto" (lib/challenge): si la esclava
// rompe su límite de pérdida diaria o de drawdown total, el veredicto es
// 'breach' y el Guardián pide pausar la copia para esa esclava.
//
// Esto es lo que separa a Onyx de ZuluTrade/eToro/Social Trader Tools: ninguno
// está construido alrededor de las reglas de prop firm. Aquí el copiador
// respeta el límite de CADA esclava por separado.
//
// MODOS:
//  - normal  → pausa solo cuando ya hay 'breach' (límite alcanzado).
//  - strict  → pausa también en 'watch' (cerca del límite), antes de romperlo.
//
// Es SOLO lógica pura + un loader que ya existe. No cambia nada hasta que se
// engancha en el relay (sub-fase siguiente) y el trader lo activa por enlace.
// ============================================================

export type CopyGuardVerdict = 'on_track' | 'watch' | 'breach' | 'na';

export type CopyGuardResult = {
  ok: boolean;        // true = puede copiar
  pause: boolean;     // true = el Guardián pide pausar la copia de esta esclava
  verdict: CopyGuardVerdict;
  firm: string;       // slug/nombre de la firma (o 'custom')
  headroom: number;   // colchón 0..1 hasta el límite de pérdida más ajustado (1 = sin datos/intacto)
  reasonEs: string;
  reasonEn: string;
};

const NA: CopyGuardResult = { ok: true, pause: false, verdict: 'na', firm: '', headroom: 1, reasonEs: '', reasonEn: '' };

// Dimensionado según el reto (#2): convierte el colchón (0..1) en un factor de
// tamaño (0..1). Con colchón ≥ `comfort` copia al 100%; por debajo baja de forma
// proporcional hasta un piso, para no dejar la copia en cero.
export function sizeScaleFromHeadroom(headroom: number, opts: { comfort?: number; floor?: number } = {}): number {
  const comfort = opts.comfort ?? 0.5;   // a partir de este colchón, tamaño pleno
  const floor = opts.floor ?? 0.15;      // nunca por debajo de este factor
  const h = Math.max(0, Math.min(1, Number(headroom)));
  if (h >= comfort) return 1;
  const f = floor + (1 - floor) * (h / comfort);
  return Math.max(floor, Math.min(1, f));
}

// Evalúa una esclava. Nunca lanza: ante cualquier fallo devuelve "sin datos"
// (NA) para no bloquear la copia por un error del guardián.
export async function copyGuardForSlave(
  userId: string,
  slaveAccountId: string,
  opts: { strict?: boolean } = {},
): Promise<CopyGuardResult> {
  try {
    if (!userId || !slaveAccountId) return NA;
    const sb = await loadChallenge(userId, slaveAccountId);
    if (!sb) return NA;
    const firm = sb.firm || 'custom';
    const closest = sb.closest;
    const headroom = typeof sb.headroom === 'number' ? sb.headroom : 1;

    if (sb.verdict === 'breach') {
      return {
        ok: false, pause: true, verdict: 'breach', firm, headroom,
        reasonEs: closest?.es ? `Límite de prop firm alcanzado: ${closest.es}` : 'Se alcanzó un límite de la prop firm.',
        reasonEn: closest?.en ? `Prop-firm limit reached: ${closest.en}` : 'A prop-firm limit was reached.',
      };
    }

    if (opts.strict && sb.verdict === 'watch') {
      return {
        ok: false, pause: true, verdict: 'watch', firm, headroom,
        reasonEs: closest?.es ? `Cerca del límite de prop firm: ${closest.es}` : 'Cerca de un límite de la prop firm.',
        reasonEn: closest?.en ? `Close to a prop-firm limit: ${closest.en}` : 'Close to a prop-firm limit.',
      };
    }

    return { ok: true, pause: false, verdict: (sb.verdict as CopyGuardVerdict) || 'na', firm, headroom, reasonEs: '', reasonEn: '' };
  } catch {
    return NA;
  }
}

// Evalúa varias esclavas de una vez (para el panel y para el relay).
// Devuelve un mapa accountId -> resultado.
export async function copyGuardForSlaves(
  userId: string,
  slaveAccountIds: string[],
  opts: { strict?: boolean } = {},
): Promise<Record<string, CopyGuardResult>> {
  const out: Record<string, CopyGuardResult> = {};
  const ids = Array.from(new Set((slaveAccountIds || []).filter(Boolean)));
  await Promise.all(ids.map(async (id) => { out[id] = await copyGuardForSlave(userId, id, opts); }));
  return out;
}
