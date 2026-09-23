import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverLang, localeAlternates, SITE } from '@/lib/locale';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { trackSettings } from '@/lib/settings';
import ShareBar from './ShareBar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STYLE: Record<string, string> = { scalping: 'Scalper', day: 'Day Trader', swing: 'Swing Trader', position: 'Position Trader', algo: 'Algo/Robots' };
const EXP: Record<string, Record<string, string>> = {
  es: { novato: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado', pro: 'Pro' },
  en: { novato: 'Beginner', intermedio: 'Intermediate', avanzado: 'Advanced', pro: 'Pro' },
};
const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => Math.round(n).toLocaleString('en-US');

async function getProfile(id: string) {
  try {
    const { data } = await supabaseAdmin.from('profiles')
      .select('id,full_name,avatar_url,country,trade_style,experience,created_at,public_track')
      .eq('id', id).maybeSingle();
    return data as any;
  } catch { return null; }
}

// Calcula las estadísticas reales del trader a partir de sus operaciones.
async function getStats(id: string) {
  const { data: accs } = await supabaseAdmin.from('trading_accounts').select('id,currency,balance').eq('user_id', id);
  const accIds = (accs || []).map((a: any) => a.id);
  const cur = ((accs || [])[0]?.currency || 'USD').toUpperCase();
  const totalBalance = (accs || []).reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  let trades: any[] = [];
  if (accIds.length) {
    const { data } = await supabaseAdmin.from('trades').select('symbol,net_profit,profit,close_time')
      .in('account_id', accIds).order('close_time', { ascending: true }).limit(10000);
    trades = data || [];
  }
  const net = (t: any) => Number(t.net_profit ?? t.profit ?? 0) || 0;
  let wins = 0, grossWin = 0, grossLoss = 0, netTotal = 0, best = -Infinity, worst = Infinity;
  const bySym: Record<string, { n: number; net: number }> = {};
  let cum = 0, peak = 0, maxDD = 0; const equity: number[] = [0];
  for (const t of trades) {
    const p = net(t); netTotal += p;
    if (p >= 0) { wins++; grossWin += p; } else grossLoss += -p;
    best = Math.max(best, p); worst = Math.min(worst, p);
    const k = t.symbol || '—'; bySym[k] = bySym[k] || { n: 0, net: 0 }; bySym[k].n++; bySym[k].net += p;
    cum += p; equity.push(cum); peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum);
  }
  const total = trades.length;
  const winRate = total ? Math.round((wins / total) * 1000) / 10 : 0;
  const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : (grossWin > 0 ? 99 : 0);
  const accounts = accIds.length;
  const ddPct = totalBalance > 0 ? Math.round((maxDD / totalBalance) * 1000) / 10 : 0;
  const roiPct = totalBalance > 0 ? Math.round((netTotal / totalBalance) * 1000) / 10 : 0;
  const bySymArr = Object.entries(bySym).sort((a, b) => b[1].net - a[1].net).map(([sym, v]) => ({ sym, n: v.n, net: v.net }));
  return { cur, totalBalance, total, wins, losses: total - wins, winRate, pf, netTotal, best, worst, maxDD, ddPct, roiPct, accounts, equity, bySym: bySymArr };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProfile(params.id);
  const cfg = await trackSettings();
  if (!p || !p.public_track || !cfg.enabled) return { title: 'Onyx Trading', robots: { index: false } };
  const name = p.full_name || 'Trader';
  const title = `${name} · Trackrecord · Onyx Trading Live`;
  const description = serverLang() === 'es'
    ? `Historial real de ${name}, verificado por Onyx Trading Live.`
    : `${name}'s real trackrecord, verified by Onyx Trading Live.`;
  return { title, description, alternates: localeAlternates(`/u/${params.id}`), openGraph: { title, description, url: `${SITE}/u/${params.id}`, type: 'profile' } };
}

export default async function PublicTrackrecord({ params }: { params: { id: string } }) {
  const es = serverLang() === 'es';
  const p = await getProfile(params.id);
  const cfg = await trackSettings();
  if (!p || !p.public_track || !cfg.enabled) notFound();

  const s = await getStats(params.id);
  const url = `${SITE}/u/${params.id}`;
  const money = cfg.show_money;
  const name = p.full_name || 'Trader';
  const styleLbl = STYLE[p.trade_style] || '';
  const expLbl = (EXP[es ? 'es' : 'en'] as any)[p.experience] || '';
  const since = p.created_at ? new Date(p.created_at).toLocaleDateString(es ? 'es' : 'en', { month: 'short', year: 'numeric' }) : '';
  const initials = (name || '?').trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  // Curva SVG (normalizada; sin ejes en $).
  const eq = s.equity.length > 1 ? s.equity : [0, 0];
  const min = Math.min(...eq), max = Math.max(...eq), rng = (max - min) || 1;
  const W = 760, H = 150;
  const pts = eq.map((v, i) => `${(i / (eq.length - 1)) * W},${H - ((v - min) / rng) * (H - 10) - 5}`);
  const linePath = 'M' + pts.join(' L');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const up = s.netTotal >= 0;

  const kpis: { label: string; value: string; tone?: 'good' | 'bad' }[] = [];
  kpis.push(money
    ? { label: es ? 'Resultado neto' : 'Net result', value: s.cur + ' ' + num(s.netTotal), tone: up ? 'good' : 'bad' }
    : { label: es ? 'Rentabilidad' : 'Return', value: (s.roiPct >= 0 ? '+' : '') + s.roiPct + '%', tone: s.roiPct >= 0 ? 'good' : 'bad' });
  if (cfg.show_winrate) kpis.push({ label: es ? 'Aciertos' : 'Win rate', value: s.winRate + '%', tone: s.winRate >= 50 ? 'good' : undefined });
  if (cfg.show_pf) kpis.push({ label: es ? 'Factor de beneficio' : 'Profit factor', value: String(s.pf), tone: s.pf >= 1.3 ? 'good' : s.pf < 1 ? 'bad' : undefined });
  if (cfg.show_dd) kpis.push({ label: es ? 'Drawdown máx.' : 'Max drawdown', value: money ? ('-' + s.cur + ' ' + num(s.maxDD)) : ('-' + s.ddPct + '%'), tone: 'bad' });

  const belowMin = s.total < cfg.min_trades;

  return (
    <div className="wrap" style={{ padding: '26px 0 40px', maxWidth: 860 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: 8, background: 'linear-gradient(90deg,#7c6cff,#22c55e)' }} />
        <div style={{ padding: '20px 22px' }}>
          {/* Cabecera */}
          <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {cfg.show_avatar && (p.avatar_url
              ? <img src={p.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', objectPosition: '50% 30%', flex: 'none', border: '1px solid var(--line)' }} />
              : <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flex: 'none' }}>{initials}</div>)}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22 }}>{name}</h1>
                {cfg.verified_badge && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, background: 'rgba(34,197,94,.14)', color: 'var(--green)', padding: '3px 10px', borderRadius: 999 }}>✔ {es ? 'Verificado por Onyx' : 'Verified by Onyx'}</span>}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {[styleLbl, expLbl, cfg.show_accounts ? (s.accounts + (es ? ' cuentas' : ' accounts')) : '', p.country || '', since && ((es ? 'desde ' : 'since ') + since)].filter(Boolean).join(' · ')}
              </div>
            </div>
            <ShareBar url={url} es={es} />
          </div>

          {belowMin ? (
            <div className="muted" style={{ marginTop: 18, fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
              {es ? `Este trader aún no tiene suficientes operaciones para mostrar un historial (mínimo ${cfg.min_trades}).` : `This trader doesn't have enough trades yet to show a trackrecord (minimum ${cfg.min_trades}).`}
            </div>
          ) : (<>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 16 }}>
              {kpis.map((k, i) => (
                <div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.tone === 'good' ? 'var(--green)' : k.tone === 'bad' ? 'var(--red)' : 'var(--tx)' }}>{k.value}</div>
                </div>
              ))}
              {cfg.show_trades && (
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 12 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{es ? 'Operaciones' : 'Trades'}</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{int(s.total)}</div>
                </div>
              )}
            </div>

            {/* Curva */}
            {cfg.show_equity && (
              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, marginTop: 14 }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{es ? 'Curva de resultados' : 'Equity curve'}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{int(s.total)} {es ? 'operaciones' : 'trades'}</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
                  <defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={up ? '#7c6cff' : '#dc2626'} stopOpacity="0.28" /><stop offset="1" stopColor={up ? '#7c6cff' : '#dc2626'} stopOpacity="0" /></linearGradient></defs>
                  <path d={areaPath} fill="url(#eqg)" />
                  <path d={linePath} fill="none" stroke={up ? '#7c6cff' : '#dc2626'} strokeWidth="2.4" />
                </svg>
              </div>
            )}

            {/* Por instrumento */}
            {cfg.show_bysym && s.bySym.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{es ? 'Por instrumento' : 'By instrument'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {s.bySym.slice(0, 8).map((r) => (
                    <span key={r.sym} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 11px', fontSize: 12.5 }}>
                      <b>{r.sym}</b>
                      <span style={{ color: r.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{money ? ((r.net >= 0 ? '+' : '') + s.cur + ' ' + int(r.net)) : `${r.n}`}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {/* Pie: QR + marca */}
          <div className="row" style={{ gap: 14, alignItems: 'center', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
            <img src={`/api/qr?data=${encodeURIComponent(url)}&size=180&fg=0b1020&bg=ffffff`} alt="QR" width={70} height={70} style={{ borderRadius: 10, background: '#fff', padding: 5, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="muted" style={{ fontSize: 12.5 }}>{es ? 'Historial real, en vivo, verificado por' : 'Real, live trackrecord, verified by'}</div>
              <Link href="/" className="logo" style={{ fontSize: 15, gap: 8 }}><img src="/onyx-symbol.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> Onyx Trading Live</Link>
            </div>
            <Link className="btn btn-primary" href="/login?mode=signup">{es ? 'Crear mi trackrecord' : 'Create my trackrecord'}</Link>
          </div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 12, textAlign: 'center', lineHeight: 1.6 }}>
        {es ? 'Los resultados pasados no garantizan resultados futuros. El trading conlleva riesgo de pérdida.' : 'Past results do not guarantee future results. Trading involves risk of loss.'}
      </p>
    </div>
  );
}
