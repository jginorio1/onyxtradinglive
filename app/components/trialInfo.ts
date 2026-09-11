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

// ============================================================
// Términos de dinero de Bot Lab y Academia (reparto, mínimo de retiro, comisión).
// Una sola fuente: /api/botlab/terms (editable en admin). Las guías usan tokens:
//   [[BL_SELLER]] → % del creador · [[BL_ONYX]] → % de Onyx
//   [[BL_MIN]] → $ mínimo de retiro · [[ACADEMY_FEE]] → % comisión academia
// ============================================================
export type MoneyTerms = { bl_seller_pct: number; bl_onyx_pct: number; bl_payout_min: number; academy_fee_pct: number };
const MT_DEF: MoneyTerms = { bl_seller_pct: 80, bl_onyx_pct: 20, bl_payout_min: 10, academy_fee_pct: 10 };

let _mt: MoneyTerms | null = null;
let _mtInflight: Promise<MoneyTerms> | null = null;
async function fetchTerms(): Promise<MoneyTerms> {
  if (_mt) return _mt;
  if (_mtInflight) return _mtInflight;
  _mtInflight = fetch('/api/botlab/terms', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => { _mt = { ...MT_DEF, ...(j || {}) }; return _mt!; })
    .catch(() => { _mt = MT_DEF; return _mt!; });
  return _mtInflight;
}

export function useMoneyTerms(): MoneyTerms | null {
  const [t, setT] = useState<MoneyTerms | null>(_mt);
  useEffect(() => { let on = true; fetchTerms().then((x) => { if (on) setT(x); }); return () => { on = false; }; }, []);
  return t;
}

// Sustituye los tokens de dinero por los valores actuales. String → string.
export function applyMoney(text: string, m: MoneyTerms | null): string {
  if (!text) return text;
  const t = m || MT_DEF;
  return text
    .split('[[BL_SELLER]]').join(String(t.bl_seller_pct) + '%')
    .split('[[BL_ONYX]]').join(String(t.bl_onyx_pct) + '%')
    .split('[[BL_MIN]]').join('$' + String(t.bl_payout_min))
    .split('[[ACADEMY_FEE]]').join(String(t.academy_fee_pct) + '%');
}
