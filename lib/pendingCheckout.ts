// Intención de compra DURADERA. Cuando un invitado elige un plan de pago y tiene
// que registrarse, guardamos aquí el plan (y si es anual). Así sobrevive a la
// confirmación de email y al onboarding — pasos que borran los parámetros de la
// URL — y podemos llevarlo al checkout en cuanto vuelva con sesión, sin perder la
// compra ni el descuento de la barra (que se aplica solo en el checkout).

const KEY = 'onyx_pending_checkout';

export type Pending = { plan: string; annual: boolean; ts: number };

export function setPending(plan: string, annual: boolean) {
  try {
    const clean = String(plan || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    if (!clean || clean === 'free') return;
    localStorage.setItem(KEY, JSON.stringify({ plan: clean, annual: !!annual, ts: Date.now() }));
  } catch {}
}

export function getPending(): Pending | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.plan) return null;
    // Caduca a las 6 h para no reencaminar a alguien que solo estaba mirando.
    if (Date.now() - (p.ts || 0) > 6 * 3600 * 1000) { clearPending(); return null; }
    return p as Pending;
  } catch { return null; }
}

export function clearPending() {
  try { localStorage.removeItem(KEY); } catch {}
}

// URL de /pricing que reabre el checkout de ese plan.
export function pendingPricingUrl(p: Pending): string {
  return '/pricing?plan=' + encodeURIComponent(p.plan) + (p.annual ? '&annual=1' : '');
}
