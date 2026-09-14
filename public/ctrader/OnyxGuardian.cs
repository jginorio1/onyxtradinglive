// ===================================================================
//  OnyxGuardian  ·  cTrader cBot (cTrader Automate / cAlgo)
//  Onyx Trading Live — Conector + Guardian para cTrader
//
//  Hace lo mismo que en MetaTrader, en una sola pieza:
//   1) SINCRONIZA la cuenta, las operaciones cerradas y las posiciones
//      abiertas con tu servidor Onyx (POST a /api/v1/sync).
//   2) GUARDIAN: aplica lo que decide el servidor — break even, trailing,
//      TP parciales, cierre por límite/noticia, bloqueo de nuevas
//      operaciones fuera del plan, cierre de fin de semana y comandos.
//
//  Onyx NUNCA abre operaciones por su cuenta. Solo gestiona y protege.
//
//  INSTALAR:
//   1) cTrader → Automate → New cBot → pega este código → Build.
//   2) Añádelo a un gráfico, pega tu API key de Onyx Guardian
//      (NO la de Copy) y ejecútalo.
//   3) Requiere permisos de red (AccessRights.FullAccess), ya declarado.
// ===================================================================
using System;
using System.Globalization;
using System.Net.Http;
using System.Text;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class OnyxGuardian : Robot
    {
        // ---------------- Inputs ----------------
        [Parameter("API key (Onyx Guardian)", DefaultValue = "")]
        public string ApiKey { get; set; }

        [Parameter("Server URL", DefaultValue = "https://www.onyxtradinglive.com")]
        public string ServerUrl { get; set; }

        [Parameter("Sync seconds", DefaultValue = 10, MinValue = 5, MaxValue = 120)]
        public int SyncSeconds { get; set; }

        [Parameter("Language (ES=Español, other=English)", DefaultValue = "EN")]
        public string Lang { get; set; }

        // ---------------- Estado del Guardian ----------------
        private const string Version = "1.00";
        private HttpClient _http;
        private string _url;

        private int _cfgVersion = -1;
        private bool _managerOn = false;
        private string _units = "pips";

        private bool _beOn = false; private double _beTrigger = 15; private string _beMode = "above";
        private double _beOffset = 2; private bool _beCosts = true;

        private bool _trOn = false; private double _trStart = 20; private double _trDistance = 20;

        private bool _ptOn = false; private readonly double[] _ptAt = new double[4]; private readonly double[] _ptClose = new double[4]; private int _ptCount = 0;

        // Veredicto del servidor
        private bool _allowNew = true;
        private bool _forceClose = false;
        private string _blockReason = "";
        private string _blockMsg = "";
        private DateTime _blockSince = DateTime.MinValue;
        private bool _guardOn = false;

        // Fin de semana
        private bool _wkOn = false; private int _wkDay = 5; private int _wkHour = 20; private int _wkMin = 0;
        private DateTime _wkDoneAt = DateTime.MinValue;

        // Buffers de eventos / comandos hechos que se envían en el próximo sync
        private readonly StringBuilder _events = new StringBuilder();
        private readonly StringBuilder _doneCmds = new StringBuilder();

        // Parciales ya ejecutados (por posición) — se pierde al reiniciar, aceptable.
        private readonly System.Collections.Generic.HashSet<string> _partialDone = new System.Collections.Generic.HashSet<string>();

        private string L(string en, string es) { return (Lang != null && Lang.ToUpper().StartsWith("ES")) ? es : en; }
        private static string F(double v, int d = 2) { return v.ToString("F" + d, CultureInfo.InvariantCulture); }

        protected override void OnStart()
        {
            _http = new HttpClient();
            _http.Timeout = TimeSpan.FromSeconds(12);
            _url = (ServerUrl ?? "").TrimEnd('/');
            if (_url.IndexOf("/api/v1/sync", StringComparison.OrdinalIgnoreCase) < 0) _url += "/api/v1/sync";
            if (string.IsNullOrEmpty(ApiKey)) Print("Onyx: falta la API key / API key missing.");
            Timer.Start(Math.Max(5, SyncSeconds));
            Sync();
        }

        protected override void OnTimer()
        {
            Sync();
            EnforceGuard();
            WeekendCheck();
            ManageAll();
        }

        protected override void OnTick()
        {
            // Reacción rápida entre sincronizaciones (bloqueo + gestión).
            EnforceGuard();
            ManageAll();
        }

        protected override void OnStop()
        {
            if (_http != null) _http.Dispose();
        }

        // ---------------- JSON helpers (mínimos) ----------------
        private static string Esc(string s)
        {
            if (s == null) return "";
            return s.Replace("\\", "").Replace("\"", "'").Replace("\n", " ").Replace("\r", "");
        }

        private void LogEvent(string kind, string detail, string symbol = "", long ticket = 0, double amount = 0)
        {
            if (_events.Length > 4000) return;
            if (_events.Length > 0) _events.Append(",");
            _events.Append("{\"kind\":\"").Append(kind).Append("\",\"detail\":\"").Append(Esc(detail))
                   .Append("\",\"symbol\":\"").Append(symbol).Append("\",\"ticket\":").Append(ticket)
                   .Append(",\"amount\":").Append(F(amount)).Append("}");
        }

        // Extrae el bloque { ... } de una clave.
        private static string JSection(string src, string key)
        {
            int p = src.IndexOf("\"" + key + "\"", StringComparison.Ordinal); if (p < 0) return "";
            int b = src.IndexOf('{', p); if (b < 0) return "";
            int depth = 0;
            for (int i = b; i < src.Length; i++) { char c = src[i]; if (c == '{') depth++; if (c == '}') { depth--; if (depth == 0) return src.Substring(b, i - b + 1); } }
            return "";
        }
        private static string JArray(string src, string key)
        {
            int p = src.IndexOf("\"" + key + "\"", StringComparison.Ordinal); if (p < 0) return "";
            int b = src.IndexOf('[', p); if (b < 0) return "";
            int depth = 0;
            for (int i = b; i < src.Length; i++) { char c = src[i]; if (c == '[') depth++; if (c == ']') { depth--; if (depth == 0) return src.Substring(b, i - b + 1); } }
            return "";
        }
        private static string JRaw(string src, string key)
        {
            int p = src.IndexOf("\"" + key + "\"", StringComparison.Ordinal); if (p < 0) return "";
            int c = src.IndexOf(':', p); if (c < 0) return "";
            int i = c + 1; while (i < src.Length && src[i] == ' ') i++;
            int start = i;
            while (i < src.Length) { char ch = src[i]; if (ch == ',' || ch == '}' || ch == ']') break; i++; }
            return src.Substring(start, i - start).Trim();
        }
        private static double JNum(string src, string key, double def)
        {
            string v = JRaw(src, key); if (v == "" || v == "null") return def;
            v = v.Replace("\"", ""); double r; return double.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out r) ? r : def;
        }
        private static bool JBool(string src, string key, bool def)
        {
            string v = JRaw(src, key); if (v == "") return def; return v.IndexOf("true", StringComparison.Ordinal) >= 0;
        }
        private static string JStr(string src, string key, string def)
        {
            string v = JRaw(src, key); if (v == "" || v == "null") return def; return v.Replace("\"", "");
        }

        // ---------------- Cuerpo del POST ----------------
        private string BuildBody()
        {
            var s = new StringBuilder();
            s.Append("{");
            s.Append("\"apiKey\":\"").Append(ApiKey).Append("\",");
            s.Append("\"eaVersion\":\"").Append(Version).Append("\",");
            int offMin = (int)((Server.Time - Server.TimeInUtc).TotalMinutes);
            s.Append("\"serverOffset\":").Append(offMin).Append(",");

            s.Append("\"account\":{");
            s.Append("\"login\":").Append(Account.Number).Append(",");
            s.Append("\"broker\":\"").Append(Esc(Account.BrokerName)).Append("\",");
            s.Append("\"server\":\"").Append(Esc(Account.BrokerName)).Append("\",");
            s.Append("\"name\":\"").Append(Esc(Account.BrokerName)).Append("\",");
            s.Append("\"currency\":\"").Append(Account.Currency ?? "").Append("\",");
            s.Append("\"leverage\":").Append((long)Account.PreciseLeverage).Append(",");
            s.Append("\"platform\":\"cTrader\",");
            s.Append("\"balance\":").Append(F(Account.Balance)).Append(",");
            s.Append("\"equity\":").Append(F(Account.Equity));
            s.Append("},");

            // Posiciones abiertas
            s.Append("\"openPositions\":[");
            bool first = true;
            foreach (var pos in Positions)
            {
                var sym = Symbols.GetSymbol(pos.SymbolName);
                double vol = sym != null ? sym.VolumeInUnitsToQuantity(pos.VolumeInUnits) : pos.VolumeInUnits;
                if (!first) s.Append(","); first = false;
                s.Append("{\"ticket\":").Append(pos.Id)
                 .Append(",\"symbol\":\"").Append(pos.SymbolName).Append("\"")
                 .Append(",\"side\":\"").Append(pos.TradeType == TradeType.Buy ? "buy" : "sell").Append("\"")
                 .Append(",\"volume\":").Append(F(vol))
                 .Append(",\"openTime\":").Append(ToEpoch(pos.EntryTime))
                 .Append(",\"openPrice\":").Append(F(pos.EntryPrice, 5))
                 .Append(",\"sl\":").Append(F(pos.StopLoss ?? 0, 5))
                 .Append(",\"tp\":").Append(F(pos.TakeProfit ?? 0, 5))
                 .Append(",\"profit\":").Append(F(pos.NetProfit))
                 .Append(",\"magic\":0")
                 .Append(",\"comment\":\"").Append(Esc(pos.Comment ?? pos.Label ?? "")).Append("\"}");
            }
            s.Append("],");

            // Operaciones cerradas (últimos 3 días, como el EA)
            s.Append("\"closedTrades\":[");
            bool f2 = true; int count = 0;
            var from = Server.Time.AddDays(-3);
            foreach (var h in History)
            {
                if (h.ClosingTime < from) continue;
                if (count >= 300) break;
                var sym = Symbols.GetSymbol(h.SymbolName);
                double vol = sym != null ? sym.VolumeInUnitsToQuantity(h.VolumeInUnits) : h.VolumeInUnits;
                if (!f2) s.Append(","); f2 = false;
                s.Append("{\"ticket\":").Append(h.PositionId)
                 .Append(",\"symbol\":\"").Append(h.SymbolName).Append("\"")
                 .Append(",\"side\":\"").Append(h.TradeType == TradeType.Buy ? "buy" : "sell").Append("\"")
                 .Append(",\"volume\":").Append(F(vol))
                 .Append(",\"openTime\":").Append(ToEpoch(h.EntryTime))
                 .Append(",\"openPrice\":").Append(F(h.EntryPrice, 5))
                 .Append(",\"closeTime\":").Append(ToEpoch(h.ClosingTime))
                 .Append(",\"closePrice\":").Append(F(h.ClosingPrice, 5))
                 .Append(",\"profit\":").Append(F(h.GrossProfit))
                 .Append(",\"commission\":").Append(F(h.Commissions))
                 .Append(",\"swap\":").Append(F(h.Swap))
                 .Append(",\"netProfit\":").Append(F(h.NetProfit))
                 .Append(",\"magic\":0")
                 .Append(",\"comment\":\"").Append(Esc(h.Comment ?? "")).Append("\"}");
                count++;
            }
            s.Append("]");

            if (_events.Length > 0) s.Append(",\"events\":[").Append(_events).Append("]");
            if (_doneCmds.Length > 0) s.Append(",\"doneCommands\":[").Append(_doneCmds).Append("]");

            s.Append("}");
            return s.ToString();
        }

        private static long ToEpoch(DateTime dt)
        {
            return (long)(dt.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
        }

        // ---------------- Sync ----------------
        private void Sync()
        {
            if (string.IsNullOrEmpty(ApiKey)) return;
            string resp;
            try
            {
                var content = new StringContent(BuildBody(), Encoding.UTF8, "application/json");
                content.Headers.Remove("Content-Type");
                content.Headers.TryAddWithoutValidation("Content-Type", "application/json");
                var req = new HttpRequestMessage(HttpMethod.Post, _url) { Content = content };
                req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + ApiKey);
                var res = _http.SendAsync(req).GetAwaiter().GetResult();
                resp = res.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                if (!res.IsSuccessStatusCode) { Print("Onyx: HTTP " + (int)res.StatusCode + " " + resp); return; }
            }
            catch (Exception e) { Print("Onyx: error de red / network error: ", e.Message); return; }

            _events.Clear();
            ApplyConfig(resp);
            ApplyVerdict(resp);
            HandleCommands(resp);
        }

        // ---------------- Config ----------------
        private void ApplyConfig(string resp)
        {
            if (resp.IndexOf("\"config\":null", StringComparison.Ordinal) >= 0)
            {
                _managerOn = false; _beOn = _trOn = _ptOn = _guardOn = _wkOn = false;
                _allowNew = true; _forceClose = false; _blockReason = ""; _blockMsg = "";
                return;
            }
            string cfg = JSection(resp, "config"); if (cfg == "") return;
            int ver = (int)JNum(cfg, "version", 0);
            if (ver == _cfgVersion) return;
            _cfgVersion = ver; _managerOn = true;
            _units = JStr(cfg, "units", "pips");

            string be = JSection(cfg, "breakeven");
            _beOn = JBool(be, "on", false); _beTrigger = JNum(be, "trigger", 15);
            _beMode = JStr(be, "mode", "above"); _beOffset = JNum(be, "offset", 2); _beCosts = JBool(be, "cover_costs", true);

            string tr = JSection(cfg, "trailing");
            _trOn = JBool(tr, "on", false); _trStart = JNum(tr, "start", 20); _trDistance = JNum(tr, "distance", 20);

            _ptCount = 0; _ptOn = false;
            string arr = JArray(cfg, "partials");
            if (arr.Length > 2)
            {
                int pos = 0;
                while (_ptCount < 4)
                {
                    int b = arr.IndexOf('{', pos); if (b < 0) break;
                    int e = arr.IndexOf('}', b); if (e < 0) break;
                    string it = arr.Substring(b, e - b + 1);
                    double at = JNum(it, "at", 0), cl = JNum(it, "close", 0);
                    if (at > 0 && cl > 0) { _ptAt[_ptCount] = at; _ptClose[_ptCount] = cl; _ptCount++; }
                    pos = e + 1;
                }
                _ptOn = _ptCount > 0;
            }

            string pl = JSection(cfg, "plan");
            _guardOn = JBool(pl, "on", false); _wkOn = false;
            if (pl != "")
            {
                string wk = JSection(pl, "weekend_close");
                if (wk != "")
                {
                    _wkOn = JBool(wk, "on", false); _wkDay = (int)JNum(wk, "day", 5);
                    string hm = JStr(wk, "time", "20:00"); int c = hm.IndexOf(':');
                    if (c > 0) { int.TryParse(hm.Substring(0, c), out _wkHour); int.TryParse(hm.Substring(c + 1), out _wkMin); }
                }
            }
            string li = JSection(cfg, "limits");
            if (JBool(li, "on", false)) _guardOn = true;
        }

        // ---------------- Veredicto ----------------
        private void ApplyVerdict(string resp)
        {
            if (resp.IndexOf("\"verdict\":null", StringComparison.Ordinal) >= 0)
            {
                _allowNew = true; _forceClose = false; _blockReason = ""; _blockMsg = ""; _blockSince = DateTime.MinValue; return;
            }
            string v = JSection(resp, "verdict"); if (v == "") return;
            bool allow = JBool(v, "allow_new", true);
            _forceClose = JBool(v, "close_all", false);
            _blockReason = JStr(v, "reason", "");
            _blockMsg = JStr(v, Lang != null && Lang.ToUpper().StartsWith("ES") ? "message_es" : "message_en", "");
            if (!allow && _allowNew) _blockSince = Server.Time;
            if (allow) _blockSince = DateTime.MinValue;
            _allowNew = allow;
        }

        // ---------------- Comandos ----------------
        private void HandleCommands(string resp)
        {
            string arr = JArray(resp, "commands"); if (arr.Length < 4) return;
            _doneCmds.Clear();
            int pos = 0;
            while (true)
            {
                int b = arr.IndexOf('{', pos); if (b < 0) break;
                int e = arr.IndexOf('}', b); if (e < 0) break;
                string it = arr.Substring(b, e - b + 1);
                string id = JStr(it, "id", ""); string cmd = JStr(it, "command", "");
                if (cmd != "")
                {
                    RunCommand(cmd);
                    if (id != "") { if (_doneCmds.Length > 0) _doneCmds.Append(","); _doneCmds.Append("\"").Append(id).Append("\""); }
                }
                pos = e + 1;
            }
        }

        // ---------------- Enforcement ----------------
        private void EnforceGuard()
        {
            if (!_managerOn) return;
            if (_forceClose)
            {
                if (Positions.Count > 0) { RunCommand("close_all"); LogEvent("limit", _blockMsg != "" ? _blockMsg : L("Closed by limit", "Cierre por límite")); }
                return;
            }
            if (_allowNew || _blockSince == DateTime.MinValue) return;
            foreach (var pos in Positions)
            {
                if (pos.EntryTime < _blockSince) continue; // ya estaba abierta: no se toca
                var r = ClosePosition(pos);
                if (r != null && r.IsSuccessful)
                    LogEvent("blocked", L("Trade outside plan closed: ", "Operación fuera del plan cerrada: ") + (_blockReason != "" ? _blockReason : "?"), pos.SymbolName, pos.Id, 0);
            }
        }

        private void WeekendCheck()
        {
            if (!_managerOn || !_wkOn || Positions.Count == 0) return;
            var now = Server.Time;
            if ((int)now.DayOfWeek != _wkDay) return;
            int mins = now.Hour * 60 + now.Minute;
            if (mins < _wkHour * 60 + _wkMin) return;
            if (_wkDoneAt != DateTime.MinValue && (now - _wkDoneAt).TotalHours < 12) return;
            _wkDoneAt = now;
            RunCommand("close_all");
            LogEvent("close_all", L("Closed before the weekend", "Cierre antes del fin de semana"));
        }

        // ---------------- Gestión (break even / trailing / parciales) ----------------
        private double PipSize(Symbol sym) { return sym.PipSize; }

        private double UnitsToPrice(Symbol sym, double value, double lots, double entry, double sl)
        {
            if (_units == "money")
            {
                double units = sym.QuantityToVolumeInUnits(lots);
                double perUnitPerTick = sym.TickValue; // valor de 1 tick para 1 unidad
                if (perUnitPerTick <= 0 || units <= 0) return 0;
                double ticks = value / (perUnitPerTick * units);
                return ticks * sym.TickSize;
            }
            if (_units == "r")
            {
                if (sl <= 0) return 0;
                return value * Math.Abs(entry - sl);
            }
            return value * PipSize(sym);
        }

        private void ManageAll()
        {
            if (!_managerOn) return;
            foreach (var pos in Positions) ManagePosition(pos);
        }

        private void ManagePosition(Position pos)
        {
            var sym = Symbols.GetSymbol(pos.SymbolName); if (sym == null) return;
            bool isBuy = pos.TradeType == TradeType.Buy;
            double entry = pos.EntryPrice;
            double sl = pos.StopLoss ?? 0;
            double tp = pos.TakeProfit ?? 0;
            double lots = sym.VolumeInUnitsToQuantity(pos.VolumeInUnits);
            double price = isBuy ? sym.Bid : sym.Ask;
            double profitDist = isBuy ? (price - entry) : (entry - price);
            if (profitDist <= 0) return;

            // Break even
            if (_beOn)
            {
                double trigger = UnitsToPrice(sym, _beTrigger, lots, entry, sl);
                if (trigger > 0 && profitDist >= trigger)
                {
                    double offset = UnitsToPrice(sym, _beOffset, lots, entry, sl);
                    double target;
                    if (_beMode == "below") target = isBuy ? entry - offset : entry + offset;
                    else if (_beMode == "at") target = entry;
                    else
                    {
                        double extra = offset;
                        if (_beCosts)
                        {
                            double costs = Math.Abs(pos.Commissions) + Math.Abs(pos.Swap);
                            double perUnitPerTick = sym.TickValue; double units = pos.VolumeInUnits;
                            if (perUnitPerTick > 0 && units > 0) extra += (costs / (perUnitPerTick * units)) * sym.TickSize;
                        }
                        target = isBuy ? entry + extra : entry - extra;
                    }
                    target = Math.Round(target, sym.Digits);
                    bool better = (sl == 0) || (isBuy ? target > sl : target < sl);
                    bool valid = isBuy ? (target < price) : (target > price);
                    if (better && valid)
                    {
                        var r = ModifyPosition(pos, target, pos.TakeProfit);
                        if (r != null && r.IsSuccessful) LogEvent("breakeven", L("Stop moved to break even", "Stop movido a break even"), pos.SymbolName, pos.Id, 0);
                    }
                }
            }

            // Trailing
            if (_trOn)
            {
                double start = UnitsToPrice(sym, _trStart, lots, entry, sl);
                double dist = UnitsToPrice(sym, _trDistance, lots, entry, sl);
                if (start > 0 && dist > 0 && profitDist >= start)
                {
                    double target = isBuy ? price - dist : price + dist;
                    target = Math.Round(target, sym.Digits);
                    bool better = (sl == 0) || (isBuy ? target > sl : target < sl);
                    bool valid = isBuy ? (target < price) : (target > price);
                    if (better && valid)
                    {
                        var r = ModifyPosition(pos, target, pos.TakeProfit);
                        if (r != null && r.IsSuccessful) LogEvent("trailing", L("Stop trailed", "Stop ajustado"), pos.SymbolName, pos.Id, 0);
                    }
                }
            }

            // Parciales
            if (_ptOn && _ptCount > 0)
            {
                for (int i = 0; i < _ptCount; i++)
                {
                    string key = pos.Id + ":" + i;
                    if (_partialDone.Contains(key)) continue;
                    double at = UnitsToPrice(sym, _ptAt[i], lots, entry, sl);
                    if (at <= 0 || profitDist < at) continue;
                    double closeLots = lots * (_ptClose[i] / 100.0);
                    long closeUnits = (long)sym.NormalizeVolumeInUnits(sym.QuantityToVolumeInUnits(closeLots), RoundingMode.Down);
                    if (closeUnits < sym.VolumeInUnitsMin) { _partialDone.Add(key); continue; }
                    if (closeUnits >= pos.VolumeInUnits) closeUnits = (long)pos.VolumeInUnits;
                    var r = ClosePosition(pos, closeUnits);
                    if (r != null && r.IsSuccessful)
                    {
                        _partialDone.Add(key);
                        LogEvent("partial", string.Format(L("Closed {0}% at TP{1}", "Cerrado {0}% en TP{1}"), _ptClose[i].ToString("F0"), i + 1), pos.SymbolName, pos.Id, sym.VolumeInUnitsToQuantity(closeUnits));
                        return;
                    }
                }
            }
        }

        // ---------------- Acciones rápidas ----------------
        private void RunCommand(string cmd)
        {
            int done = 0;
            var snapshot = new System.Collections.Generic.List<Position>(Positions);
            foreach (var pos in snapshot)
            {
                var sym = Symbols.GetSymbol(pos.SymbolName);
                double prof = pos.NetProfit;
                if (cmd == "close_all") { var r = ClosePosition(pos); if (r != null && r.IsSuccessful) done++; }
                else if (cmd == "close_profitable") { if (prof > 0) { var r = ClosePosition(pos); if (r != null && r.IsSuccessful) done++; } }
                else if (cmd == "close_losing") { if (prof < 0) { var r = ClosePosition(pos); if (r != null && r.IsSuccessful) done++; } }
                else if (cmd == "close_half")
                {
                    if (sym != null)
                    {
                        long half = (long)sym.NormalizeVolumeInUnits(pos.VolumeInUnits / 2.0, RoundingMode.Down);
                        if (half >= sym.VolumeInUnitsMin) { var r = ClosePosition(pos, half); if (r != null && r.IsSuccessful) done++; }
                    }
                }
                else if (cmd == "sl_to_be") { var r = ModifyPosition(pos, pos.EntryPrice, pos.TakeProfit); if (r != null && r.IsSuccessful) done++; }
            }
            LogEvent(cmd == "close_all" ? "close_all" : "info", L("Action done: ", "Acción ejecutada: ") + cmd + " (" + done + ")", "", 0, done);
            Print("Onyx: " + cmd + " (" + done + ")");
        }
    }
}
