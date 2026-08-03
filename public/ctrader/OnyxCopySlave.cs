// ===================================================================
//  OnyxCopySlave  ·  cTrader cBot (PLANTILLA)
//  Pide comandos a Onyx cada segundo, resuelve el símbolo local, calcula
//  el lote según el modo, aplica los LÍMITES de riesgo del enlace y
//  ejecuta (abre/cierra) en esta cuenta esclava.
//
//  Equivalente al OnyxCopySlave de MetaTrader. Usa tu CLAVE COPY.
//  Pruébalo PRIMERO en DEMO (master + esclava) antes de dinero real.
//  Requiere AccessRights.FullAccess (red).
// ===================================================================
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Text;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class OnyxCopySlave : Robot
    {
        [Parameter("API base", DefaultValue = "https://www.onyxtradinglive.com")]
        public string ApiBase { get; set; }

        [Parameter("Copy API key", DefaultValue = "onyx_copy_...")]
        public string CopyApiKey { get; set; }

        [Parameter("Poll seconds", DefaultValue = 1, MinValue = 1, MaxValue = 10)]
        public int PollSeconds { get; set; }

        private const string OnyxLabel = "OnyxCopy";
        private HttpClient _http;
        private double _dayStartEquity;
        private int _dayStamp = -1;
        private readonly Dictionary<long, long> _map = new Dictionary<long, long>(); // masterTicket -> slave position Id

        protected override void OnStart()
        {
            _http = new HttpClient();
            _http.Timeout = TimeSpan.FromSeconds(6);
            if (CopyApiKey == null || !CopyApiKey.StartsWith("onyx_copy_"))
                Print("AVISO: la clave Copy debe empezar por onyx_copy_.");
            _dayStartEquity = Account.Equity; _dayStamp = Server.Time.DayOfYear;
            Timer.Start(Math.Max(1, PollSeconds));
        }
        protected override void OnStop() { if (_http != null) _http.Dispose(); }

        protected override void OnTimer()
        {
            string body = GetCommands();
            if (string.IsNullOrEmpty(body)) return;
            string arr = JVal(body, "commands");
            if (arr == "" || arr == "[]") return;
            foreach (var o in JSplit(arr))
            {
                string id = JVal(o, "id");
                string action = JVal(o, "action");
                string bsym = JVal(o, "base_symbol");
                string side = JVal(o, "side");
                string mtk = JVal(o, "master_ticket");
                double vol = JNum(o, "volume_hint");
                double sl = JNum(o, "sl");
                double tp = JNum(o, "tp");
                string pl = JVal(o, "payload");
                string lim = JVal(pl, "limits");
                string mode = JVal(pl, "mode");
                double mult = JNum(pl, "multiplier"); if (mult <= 0) mult = 1;
                double riskPct = JNum(pl, "risk_pct");
                double pip = JNum(pl, "pip_risk");
                double mBal = JNum(pl, "masterBalance");
                double maxLot = JNum(lim, "max_lot");
                double maxSpr = JNum(lim, "max_spread");
                double dLoss = JNum(lim, "daily_loss_pct");
                double mDD = JNum(lim, "max_drawdown_pct");
                double mPrice = JNum(o, "price");
                double ageMs = JNum(o, "age_ms");
                double maxDev = JNum(lim, "max_deviation_pts");
                double maxAge = JNum(lim, "max_signal_age_s");
                double reqSL = JNum(lim, "require_sl");
                double maxPos = JNum(lim, "max_positions");
                double symCap = JNum(lim, "per_symbol_lot_cap");
                long mt = 0; long.TryParse(mtk, out mt);
                var t0 = DateTime.UtcNow;

                if (action == "open")
                {
                    if (RiskStop(dLoss, mDD)) { Ack(id, false, "risk_stop", 0, 0); continue; }
                    var sym = ResolveLocalSymbol(bsym);
                    if (sym == null) { Ack(id, false, "symbol_not_found", 0, 0); continue; }
                    if (SpreadTooHigh(sym, maxSpr)) { Ack(id, false, "spread_high", 0, 0); continue; }
                    if (maxAge > 0 && ageMs > maxAge * 1000.0) { Ack(id, false, "signal_old", 0, 0); continue; }
                    if (reqSL >= 1 && sl <= 0) { Ack(id, false, "no_sl", 0, 0); continue; }
                    if (maxPos > 0 && CountMyPositions() >= (int)maxPos) { Ack(id, false, "max_positions", 0, 0); continue; }
                    if (maxDev > 0 && mPrice > 0)
                    {
                        double cur = side == "buy" ? sym.Ask : sym.Bid;
                        if (sym.TickSize > 0 && Math.Abs(cur - mPrice) / sym.TickSize > maxDev) { Ack(id, false, "deviation", 0, 0); continue; }
                    }
                    double lots = ApplyMaxLot(CalcLot(sym, mode, vol, mBal, mult, riskPct, pip), maxLot);
                    if (symCap > 0 && SumMyLots(sym) + lots > symCap) { Ack(id, false, "symbol_cap", 0, 0); continue; }
                    long units = (long)sym.NormalizeVolumeInUnits(sym.QuantityToVolumeInUnits(lots), RoundingMode.Down);
                    if (units < sym.VolumeInUnitsMin) units = (long)sym.VolumeInUnitsMin;
                    var tt = side == "buy" ? TradeType.Buy : TradeType.Sell;
                    var r = ExecuteMarketOrder(tt, sym.Name, units, OnyxLabel + mtk);
                    int lat = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
                    if (r != null && r.IsSuccessful && r.Position != null)
                    {
                        // SL/TP de la master vienen como PRECIOS del mismo instrumento.
                        if (sl > 0 || tp > 0) ModifyPosition(r.Position, sl > 0 ? (double?)sl : null, tp > 0 ? (double?)tp : null);
                        _map[mt] = r.Position.Id;
                        Ack(id, true, "", r.Position.Id, lat);
                    }
                    else Ack(id, false, "open_fail", 0, lat);
                }
                else if (action == "close")
                {
                    int lat = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
                    bool done = CloseByMaster(mt);
                    Ack(id, done, done ? "" : "close_fail", _map.ContainsKey(mt) ? _map[mt] : 0, lat);
                }
            }
        }

        // ---------- Símbolo local ----------
        private static string Norm(string s)
        {
            return (s ?? "").ToUpper().Replace(".", "").Replace("_", "").Replace("-", "").Replace("#", "");
        }
        private Symbol ResolveLocalSymbol(string masterSymbol)
        {
            var exact = Symbols.GetSymbol(masterSymbol);
            if (exact != null) return exact;
            string want = Norm(masterSymbol);
            foreach (var name in Symbols)          // lista de símbolos disponibles
            {
                if (Norm(name) == want) return Symbols.GetSymbol(name);
            }
            // TODO: tabla de alias (GOLD↔XAUUSD, US100↔NAS100…) como en copySymbols.ts
            return null;
        }

        private double CalcLot(Symbol sym, string mode, double masterVol, double masterBalance, double mult, double riskPct, double slPips)
        {
            double bal = Account.Balance;
            double lot = masterVol * mult;
            if (mode == "balance" && masterBalance > 0) lot = masterVol * (bal / masterBalance) * mult;
            else if (mode == "risk" && slPips > 0)
            {
                double pipValuePerLot = sym.PipValue * sym.QuantityToVolumeInUnits(1); // valor de 1 pip por 1 lote
                double riskCash = bal * (riskPct / 100.0);
                if (pipValuePerLot > 0) lot = riskCash / (slPips * pipValuePerLot);
            }
            return lot;
        }
        private static double ApplyMaxLot(double lot, double maxLot) { return (maxLot > 0 && lot > maxLot) ? maxLot : lot; }
        private int CountMyPositions() { int c = 0; foreach (var p in Positions) if ((p.Label ?? "").StartsWith(OnyxLabel)) c++; return c; }
        private double SumMyLots(Symbol sym) { double v = 0; foreach (var p in Positions) if ((p.Label ?? "").StartsWith(OnyxLabel) && p.SymbolName == sym.Name) v += sym.VolumeInUnitsToQuantity(p.VolumeInUnits); return v; }
        private bool SpreadTooHigh(Symbol sym, double maxSpreadPts)
        {
            if (maxSpreadPts <= 0) return false;
            double spreadPts = (sym.Ask - sym.Bid) / sym.TickSize;
            return spreadPts > maxSpreadPts;
        }
        private bool RiskStop(double dailyLossPct, double maxDdPct)
        {
            int today = Server.Time.DayOfYear;
            if (today != _dayStamp) { _dayStamp = today; _dayStartEquity = Account.Equity; }
            double eq = Account.Equity, bal = Account.Balance;
            if (dailyLossPct > 0 && _dayStartEquity > 0)
            {
                double lossPct = (_dayStartEquity - eq) / _dayStartEquity * 100.0;
                if (lossPct >= dailyLossPct) return true;
            }
            if (maxDdPct > 0 && bal > 0)
            {
                double ddPct = (bal - eq) / bal * 100.0;
                if (ddPct >= maxDdPct) return true;
            }
            return false;
        }
        private bool CloseByMaster(long mt)
        {
            long slaveId;
            if (_map.TryGetValue(mt, out slaveId))
            {
                foreach (var p in Positions) if (p.Id == slaveId) { var r = ClosePosition(p); return r != null && r.IsSuccessful; }
            }
            // respaldo por label
            string want = OnyxLabel + mt;
            foreach (var p in Positions) if ((p.Label ?? "") == want) { var r = ClosePosition(p); return r != null && r.IsSuccessful; }
            return false;
        }

        // ---------- Red ----------
        private string GetCommands()
        {
            try
            {
                var req = new HttpRequestMessage(HttpMethod.Get, ApiBase.TrimEnd('/') + "/api/v1/copy/slave");
                req.Headers.TryAddWithoutValidation("x-onyx-key", CopyApiKey);
                var res = _http.SendAsync(req).GetAwaiter().GetResult();
                if (!res.IsSuccessStatusCode) return "";
                return res.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            }
            catch { return ""; }
        }
        private void Ack(string commandId, bool ok, string err, long slaveTicket, int latencyMs)
        {
            try
            {
                string j = "{\"command_id\":\"" + commandId + "\",\"ok\":" + (ok ? "true" : "false")
                    + ",\"error\":\"" + err + "\",\"slave_ticket\":\"" + slaveTicket + "\",\"latency_ms\":" + latencyMs + "}";
                var content = new StringContent(j, Encoding.UTF8, "application/json");
                var req = new HttpRequestMessage(HttpMethod.Post, ApiBase.TrimEnd('/') + "/api/v1/copy/slave") { Content = content };
                req.Headers.TryAddWithoutValidation("x-onyx-key", CopyApiKey);
                _http.SendAsync(req).GetAwaiter().GetResult();
            }
            catch { }
        }

        // ---------- Mini-parser JSON ----------
        private static string JVal(string obj, string key)
        {
            string pat = "\"" + key + "\"";
            int p = obj.IndexOf(pat, StringComparison.Ordinal); if (p < 0) return "";
            p = obj.IndexOf(':', p + pat.Length); if (p < 0) return ""; p++;
            int n = obj.Length; while (p < n && obj[p] == ' ') p++; if (p >= n) return "";
            char c = obj[p];
            if (c == '"') { int e = obj.IndexOf('"', p + 1); if (e < 0) return ""; return obj.Substring(p + 1, e - (p + 1)); }
            if (c == '{' || c == '[')
            {
                char op = c, cl = c == '{' ? '}' : ']'; int depth = 0;
                for (int i = p; i < n; i++) { char ch = obj[i]; if (ch == op) depth++; else if (ch == cl) { depth--; if (depth == 0) return obj.Substring(p, i - p + 1); } }
                return "";
            }
            int e2 = p; while (e2 < n) { char ch = obj[e2]; if (ch == ',' || ch == '}' || ch == ']') break; e2++; }
            return obj.Substring(p, e2 - p).Trim();
        }
        private static double JNum(string obj, string key)
        {
            string v = JVal(obj, key); if (v == "" || v == "null") return 0;
            double r; return double.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out r) ? r : 0;
        }
        private static List<string> JSplit(string arr)
        {
            var outl = new List<string>(); int depth = 0, start = -1;
            for (int i = 0; i < arr.Length; i++)
            {
                char ch = arr[i];
                if (ch == '{') { if (depth == 0) start = i; depth++; }
                else if (ch == '}') { depth--; if (depth == 0 && start >= 0) { outl.Add(arr.Substring(start, i - start + 1)); start = -1; } }
            }
            return outl;
        }
    }
}
