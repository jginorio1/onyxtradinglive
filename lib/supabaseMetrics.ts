// ============================================================
// Métricas reales de la instancia de Supabase (CPU / RAM / disco).
// Lee el endpoint privilegiado de métricas (formato Prometheus) que expone cada
// proyecto: https://<ref>.supabase.co/customer/v1/privileged/metrics
// Auth: HTTP Basic con usuario "service_role" y la SERVICE_ROLE_KEY (que la app
// ya tiene). Defensivo: ante cualquier fallo devuelve { ok:false } y el panel
// vuelve a mostrar solo el enlace. Se cachea 15 s para no golpear en cada carga.
// ============================================================

export type SupabaseInstance = {
  ok: boolean;
  cpuPct: number | null; cores: number | null; load1: number | null;
  memUsed: number | null; memTotal: number | null; memPct: number | null;
  diskUsed: number | null; diskTotal: number | null; diskPct: number | null;
  at: number;
};

type Series = { labels: Record<string, string>; value: number };

// Extrae todas las series de una métrica del texto Prometheus.
function series(text: string, metric: string): Series[] {
  const out: Series[] = [];
  const re = new RegExp('^' + metric.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\{[^}]*\\})?\\s+([\\d.eE+-]+)\\s*$');
  for (const line of text.split('\n')) {
    if (!line || line[0] === '#') continue;
    if (!line.startsWith(metric)) continue;
    const m = line.match(re);
    if (!m) continue;
    const labels: Record<string, string> = {};
    if (m[1]) {
      const inner = m[1].slice(1, -1);
      for (const pair of inner.split(',')) {
        const eq = pair.indexOf('=');
        if (eq > 0) labels[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim().replace(/^"|"$/g, '');
      }
    }
    const v = Number(m[2]);
    if (Number.isFinite(v)) out.push({ labels, value: v });
  }
  return out;
}
const one = (s: Series[]) => (s.length ? s[0].value : null);

let cache: SupabaseInstance | null = null;

export async function supabaseInstanceMetrics(): Promise<SupabaseInstance> {
  const now = Date.now();
  if (cache && now - cache.at < 15000) return cache;

  const empty: SupabaseInstance = { ok: false, cpuPct: null, cores: null, load1: null, memUsed: null, memTotal: null, memPct: null, diskUsed: null, diskTotal: null, diskPct: null, at: now };

  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const m = base.match(/https?:\/\/[a-z0-9]+\.supabase\.co/i);
  if (!m || !key) { cache = empty; return empty; }

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4500);
    const auth = Buffer.from(`service_role:${key}`).toString('base64');
    const res = await fetch(`${m[0]}/customer/v1/privileged/metrics`, {
      headers: { Authorization: `Basic ${auth}` }, signal: ctrl.signal, cache: 'no-store',
    });
    clearTimeout(to);
    if (!res.ok) { cache = empty; return empty; }
    const text = await res.text();

    // --- CPU: usamos load1 normalizado por nº de núcleos como indicador. ---
    const idle = series(text, 'node_cpu_seconds_total').filter((s) => s.labels.mode === 'idle');
    const cores = new Set(idle.map((s) => s.labels.cpu)).size || null;
    const load1 = one(series(text, 'node_load1'));
    const cpuPct = (load1 != null && cores) ? Math.min(100, Math.round((load1 / cores) * 1000) / 10) : null;

    // --- RAM: total - disponible. ---
    const memTotal = one(series(text, 'node_memory_MemTotal_bytes'));
    const memAvail = one(series(text, 'node_memory_MemAvailable_bytes'));
    const memUsed = (memTotal != null && memAvail != null) ? memTotal - memAvail : null;
    const memPct = (memUsed != null && memTotal) ? Math.round((memUsed / memTotal) * 1000) / 10 : null;

    // --- Disco: el sistema de archivos real más grande (excluye tmpfs/overlay). ---
    const skip = /tmpfs|overlay|devtmpfs|squashfs/;
    const sizes = series(text, 'node_filesystem_size_bytes').filter((s) => !skip.test(s.labels.fstype || '') && !/^\/(dev|proc|sys|run)/.test(s.labels.mountpoint || ''));
    let diskTotal: number | null = null, diskUsed: number | null = null, diskPct: number | null = null;
    if (sizes.length) {
      const biggest = sizes.reduce((a, b) => (b.value > a.value ? b : a));
      const avail = series(text, 'node_filesystem_avail_bytes').find((s) => s.labels.mountpoint === biggest.labels.mountpoint);
      diskTotal = biggest.value;
      if (avail) { diskUsed = diskTotal - avail.value; diskPct = Math.round((diskUsed / diskTotal) * 1000) / 10; }
    }

    const ok = memTotal != null || diskTotal != null || cpuPct != null;
    cache = { ok, cpuPct, cores, load1, memUsed, memTotal, memPct, diskUsed, diskTotal, diskPct, at: now };
    return cache;
  } catch { cache = empty; return empty; }
}
