'use client';
import { useEffect, useState } from 'react';
import { planFacts, trialLine, type PlanFacts } from '@/lib/planFacts';

// Hechos de venta (prueba gratis, ahorro anual) para textos de la GUÍA y otras
// superficies estáticas. Una sola fuente: /api/admin/plans (planes activos con sus
// capabilities). Cachea a nivel de módulo: una petición por carga de página.
// Los textos usan tokens que se sustituyen con los números ACTUALES:
//   [[TRIAL]]        → "7 días gratis en Guardian Pro" (o se borra si no hay prueba)
//   [[ANNUAL_SAVE]]  → "17%" (o se borra si no aplica)

let _cache: PlanFacts | null = null;
let _inflight: Promise<PlanFacts> | null = null;
async function fetchFacts(): Promise<PlanFacts> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch('/api/admin/plans', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => { _cache = planFacts(j?.plans || []); return _cache; })
    .catch(() => { _cache = planFacts([]); return _cache!; });
  return _inflight;
}

export function useTrialInfo(): PlanFacts | null {
  const [f, setF] = useState<PlanFacts | null>(_cache);
  useEffect(() => { let on = true; fetchFacts().then((x) => { if (on) setF(x); }); return () => { on = false; }; }, []);
  return f;
}

// Sustituye los tokens dentro de un texto por los valores actuales. Devuelve string
// (para poder encadenar con renderVps que añade el enlace del VPS). Si no hay datos
// aún, deja frases neutras razonables para que nunca se vea un token crudo.
export function applyTrial(text: string, f: PlanFacts | null, lang: 'es' | 'en'): string {
  if (!text) return text;
  let out = text;
  if (out.indexOf('[[TRIAL]]') >= 0) {
    const t = f && f.hasTrial
      ? (lang === 'es'
          ? `Además, ${trialLine(f, 'es')}: entras con tarjeta y no se te cobra hasta el día ${f.trialDays}; cancela antes y no pagas nada.`
          : `Plus, a ${trialLine(f, 'en')}: you enter with a card and are not charged until day ${f.trialDays}; cancel before then and you pay nothing.`)
      : '';
    out = out.split('[[TRIAL]]').join(t);
  }
  if (out.indexOf('[[ANNUAL_SAVE]]') >= 0) {
    const s = f && f.annualPct > 0 ? `${f.annualPct}%` : (lang === 'es' ? 'menos' : 'less');
    out = out.split('[[ANNUAL_SAVE]]').join(s);
  }
  // Limpia posibles espacios/dobles al borrar un token vacío.
  return out.replace(/\s{2,}/g, ' ').trim();
}
