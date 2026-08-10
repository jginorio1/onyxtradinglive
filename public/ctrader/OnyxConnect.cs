// ===================================================================
//  OnyxConnect  ·  cTrader cBot (cTrader Automate / cAlgo)
//  Onyx Trading Live — un solo cBot: Conector + Guardian + panel.
//
//  Hace lo mismo que en MetaTrader:
//   1) SINCRONIZA cuenta, operaciones cerradas y posiciones abiertas
//      con tu servidor Onyx (POST a /api/v1/sync).
//   2) GUARDIAN: aplica lo que decide el servidor (break even, trailing,
//      TP parciales, bloqueo fuera del plan, cierre de fin de semana).
//   3) PANEL en el gráfico con pastillas de color, datos en vivo
//      (AutoTrading, spread, sesión), límites del plan, contador de
//      reanudación cuando bloquea, y las noticias de alto impacto
//      dibujadas como líneas verticales.
//
//  Onyx NUNCA abre operaciones por su cuenta. Solo gestiona y protege.
//
//  INSTALAR:
//   1) cTrader -> Automate -> New cBot -> pega este codigo -> Build.
//   2) Anadelo a un grafico, pega tu API key de Onyx Guardian y ejecutalo.
//   3) Requiere permisos de red (FullAccess), ya declarado.
// ===================================================================
using System;
using System.Globalization;
using System.Net.Http;
using System.Text;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class OnyxConnect : Robot
    {
        // ---------------- Inputs ----------------
        [Parameter("API key (Onyx Guardian)", DefaultValue = "")]
        public string ApiKey { get; set; }

        [Parameter("Server URL", DefaultValue = "https://www.onyxtradinglive.com")]
        public string ServerUrl { get; set; }

        [Parameter("Sync seconds", DefaultValue = 10, MinValue = 5, MaxValue = 120)]
        public int SyncSeconds { get; set; }

        [Parameter("Language (ES=Espanol, other=English)", DefaultValue = "EN")]
        public string Lang { get; set; }

        // ---------------- Estado ----------------
        private const string Version = "2.00";
        private HttpClient _http;
        private string _url;

        private int _cfgVersion = -1;
        private bool _managerOn = false;
        private string _units = "pips";

        private bool _beOn = false; private double _beTrigger = 15; private string _beMode = "above";
        private double _beOffset = 2; private bool _beCosts = true;
        private bool _trOn = false; private double _trStart = 20; private double _trDistance = 20;
        private bool _ptOn = false; private readonly double[] _ptAt = new double[4]; private readonly double[] _ptClose = new double[4]; private int _ptCount = 0;

        private bool _allowNew = true;
        private bool _forceClose = false;
        private string _blockReason = "";
        private string _blockMsg = "";
        private DateTime _blockSince = DateTime.MinValue;
        private bool _guardOn = false;

        private bool _wkOn = false; private int _wkDay = 5; private int _wkHour = 20; private int _wkMin = 0;
        private DateTime _wkDoneAt = DateTime.MinValue;

        // Onyx Connect: funciones del plan
        private string _featPlan = "";
        private bool _featG = false, _featC = false, _featT = false, _featMaster = false;

        // Onyx Connect: limites y metas
        private double _limDLoss = 0; private bool _limDLossPct = true;
        private double _limDTarget = 0; private bool _limDTgtPct = true;
        private double _limTLoss = 0; private bool _limTLossPct = true;
        private int _maxTrades = 0;

        // Onyx Connect: noticias
        private string _newsTitle = ""; private string _newsCur = ""; private int _newsMin = -1;
        private bool _newsWillBlock = false; private int _newsBlockIn = -1;
        private readonly List<long> _newsEpoch = new List<long>();

        // Onyx Connect: contador de reanudacion
        private DateTime _resumeAt = DateTime.MinValue;

        private readonly StringBuilder _events = new StringBuilder();
        private readonly StringBuilder _doneCmds = new StringBuilder();
        private readonly HashSet<string> _partialDone = new HashSet<string>();

        private string L(string en, string es) { return (Lang != null && Lang.ToUpper().StartsWith("ES")) ? es : en; }
        private static string F(double v, int d = 2) { return v.ToString("F" + d, CultureInfo.InvariantCulture); }

        // ---------------- Colores (paleta de la web) ----------------
        private static readonly Color C_BG   = Color.FromHex("#FF1A2133");
        private static readonly Color C_LINE = Color.FromHex("#FF38455F");
        private static readonly Color C_TX   = Color.FromHex("#FFF2F5FB");
        private static readonly Color C_MUT  = Color.FromHex("#FF9AA6BD");
        private static readonly Color C_CARD = Color.FromHex("#FF232C42");
        private static readonly Color TB = Color.FromHex("#FF2A3256"), TBt = Color.FromHex("#FFB9C2FF");
        private static readonly Color TG = Color.FromHex("#FF123A2C"), TGt = Color.FromHex("#FF5EEAB9");
        private static readonly Color TC = Color.FromHex("#FF10323E"), TCt = Color.FromHex("#FF7FDFFF");
        private static readonly Color TA = Color.FromHex("#FF3A3416"), TAt = Color.FromHex("#FFFFDC7A");
        private static readonly Color TR = Color.FromHex("#FF401E28"), TRt = Color.FromHex("#FFFF8B9A");
        private static readonly Color C_GREEN = Color.FromHex("#FF34E2A0");
        private static readonly Color C_RED   = Color.FromHex("#FFFF6B7D");
        private static readonly Color C_AMBER = Color.FromHex("#FFFFC04D");

        // ---------------- Referencias del panel ----------------
        private Border _planPill; private TextBlock _planTxt;
        private Border _chG, _chC, _chT;
        private TextBlock _txState;
        private TextBlock _pAutoTxt; private Border _pAuto;
        private TextBlock _pSpreadTxt; private TextBlock _pSessTxt;
        private TextBlock _pMktTxt; private StackPanel _pMktWrap;
        private StackPanel _guardWrap;
        private Border _statusPill; private TextBlock _statusTxt;
        private Border _blockBox; private TextBlock _blockTop, _blockMsgL, _blockNum;
        private TextBlock _sdlV, _sdtV, _stlV, _smxV;
        private StackPanel _newsWrap; private TextBlock _newsTxt;
        private TextBlock _mBe, _mTr, _mPt;
        private Border _mBeB, _mTrB, _mPtB;

        protected override void OnStart()
        {
            _http = new HttpClient();
            _http.Timeout = TimeSpan.FromSeconds(12);
            _url = (ServerUrl ?? "").TrimEnd('/');
            if (_url.IndexOf("/api/v1/sync", StringComparison.OrdinalIgnoreCase) < 0) _url += "/api/v1/sync";
            if (string.IsNullOrEmpty(ApiKey)) Print("Onyx: falta la API key / API key missing.");
            BuildPanel();
            Timer.Start(1);   // 1s: el panel y el contador laten cada segundo
            Sync();
            UpdatePanel();
        }

        private int _tick = 0;
        protected override void OnTimer()
        {
            _tick++;
            int every = _featMaster ? 3 : Math.Max(5, SyncSeconds);  // master de copy → 3s
            if (_tick % every == 0)
            {
                Sync();
                EnforceGuard();
                WeekendCheck();
                ManageAll();
            }
            UpdatePanel();
        }

        protected override void OnTick()
        {
            EnforceGuard();
            ManageAll();
        }

        protected override void OnStop()
        {
            if (_http != null) _http.Dispose();
        }

        // ================= JSON helpers =================
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

        // ================= Cuerpo del POST =================
        private string BuildBody()
        {
            var s = new StringBuilder();
            s.Append("{");
            s.Append("\"apiKey\":\"").Append(ApiKey).Append("\",");
            s.Append("\"eaVersion\":\"").Append(Version).Append("\",");
            int offMin = (int)((Server.Time - Server.TimeInUtc).TotalMinutes);
            s.Append("\"serverOffset\":").Append(offMin).Append(",");
            // Onyx Connect: el cBot corriendo = AutoTrading permitido + spread en vivo (pips)
            s.Append("\"tradeAllowed\":true,");
            int spreadPts = (int)Math.Round(Symbol.Spread / Symbol.TickSize);
            s.Append("\"spread\":").Append(spreadPts).Append(",");

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

            s.Append("\"closedTrades\":[");
            bool f2 = true; int count = 0;
            var from = Server.Time.AddDays(-3);
            foreach (var h in History)
            {
                if (h.ClosingTime < from) continue;
                if (count >= 300) break;
                var sym = Symbols.GetSymbol(h.SymbolName);
                double vol = sym != null ? sym.VolumeInUnitsToQuantity(h.VolumeInUnits) : h.VolumeInUnits;
                // Ganancias parciales: cada cierre parcial es un HistoricalTrade con
                // el MISMO PositionId. Usamos ClosingDealId como ticket unico (asi no
                // se pisan en la nube) y PositionId para agruparlos (TP1/TP2/runner).
                if (!f2) s.Append(","); f2 = false;
                s.Append("{\"ticket\":").Append(h.ClosingDealId)
                 .Append(",\"positionId\":\"").Append(h.PositionId).Append("\"")
                 .Append(",\"symbol\":\"").Append(h.SymbolName).Append("\"")
                 .Append(",\"side\":\"").Append(h.TradeType == TradeType.Buy ? "buy" : "sell").Append("\"")
                 .Append(",\"volume\":").Append(F(vol))
                 .Append(",\"closedVolume\":").Append(F(vol))
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

        // ================= Sync =================
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
            ParseFeatures(resp);
            ParseNews(resp);
            ParseNewsTimes(resp);
            DrawNewsLines();
            HandleCommands(resp);
        }

        private void ParseFeatures(string resp)
        {
            string f = JSection(resp, "features"); if (f == "") return;
            _featPlan = JStr(f, "plan", "");
            _featG = JBool(f, "guardian", false);
            _featC = JBool(f, "copy", false);
            _featT = JBool(f, "tv", false);
            _featMaster = JBool(f, "copyMaster", false);
        }

        private void ParseNews(string resp)
        {
            if (resp.IndexOf("\"news\":null", StringComparison.Ordinal) >= 0)
            { _newsTitle = ""; _newsCur = ""; _newsMin = -1; _newsWillBlock = false; _newsBlockIn = -1; return; }
            string ns = JSection(resp, "news");
            if (ns == "") { _newsTitle = ""; _newsCur = ""; _newsMin = -1; _newsWillBlock = false; _newsBlockIn = -1; return; }
            _newsTitle = JStr(ns, "title", "");
            _newsCur = JStr(ns, "currency", "");
            _newsMin = (int)JNum(ns, "minutes", -1);
            _newsWillBlock = JBool(ns, "willBlock", false);
            _newsBlockIn = (int)JNum(ns, "blockInMin", -1);
        }

        private void ParseNewsTimes(string resp)
        {
            _newsEpoch.Clear();
            string arr = JArray(resp, "newsTimes"); if (arr.Length < 3) return;
            int i = 1;
            while (_newsEpoch.Count < 16 && i < arr.Length)
            {
                while (i < arr.Length && (arr[i] < '0' || arr[i] > '9')) i++;
                if (i >= arr.Length) break;
                int start = i;
                while (i < arr.Length && arr[i] >= '0' && arr[i] <= '9') i++;
                long ep; if (long.TryParse(arr.Substring(start, i - start), out ep)) _newsEpoch.Add(ep);
            }
        }

        private void DrawNewsLines()
        {
            for (int i = 0; i < 16; i++) Chart.RemoveObject("onyx_nl_" + i);
            for (int i = 0; i < _newsEpoch.Count; i++)
            {
                // El robot corre en zona UTC, asi que el tiempo del grafico es UTC.
                DateTime t = DateTimeOffset.FromUnixTimeSeconds(_newsEpoch[i]).UtcDateTime;
                var line = Chart.DrawVerticalLine("onyx_nl_" + i, t, C_AMBER);
                line.LineStyle = LineStyle.Dots;
                line.Thickness = 1;
                line.IsInteractive = false;
            }
        }

        // ================= Config =================
        private void ApplyConfig(string resp)
        {
            if (resp.IndexOf("\"config\":null", StringComparison.Ordinal) >= 0)
            {
                _managerOn = false; _beOn = _trOn = _ptOn = _guardOn = _wkOn = false;
                _allowNew = true; _forceClose = false; _blockReason = ""; _blockMsg = "";
                _limDLoss = _limDTarget = _limTLoss = 0; _maxTrades = 0;
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
                _maxTrades = (int)JNum(pl, "max_trades_day", 0);
            }
            else _maxTrades = 0;

            string li = JSection(cfg, "limits");
            if (JBool(li, "on", false))
            {
                _guardOn = true;
                _limDLoss = JNum(li, "daily_loss", 0); _limDLossPct = JBool(li, "daily_loss_pct", true);
                _limDTarget = JNum(li, "daily_target", 0); _limDTgtPct = JBool(li, "daily_target_pct", true);
                _limTLoss = JNum(li, "total_loss", 0); _limTLossPct = JBool(li, "total_loss_pct", true);
            }
            else { _limDLoss = _limDTarget = _limTLoss = 0; }
        }

        // ================= Veredicto =================
        private void ApplyVerdict(string resp)
        {
            if (resp.IndexOf("\"verdict\":null", StringComparison.Ordinal) >= 0)
            {
                _allowNew = true; _forceClose = false; _blockReason = ""; _blockMsg = ""; _blockSince = DateTime.MinValue; _resumeAt = DateTime.MinValue; return;
            }
            string v = JSection(resp, "verdict"); if (v == "") return;
            bool allow = JBool(v, "allow_new", true);
            _forceClose = JBool(v, "close_all", false);
            _blockReason = JStr(v, "reason", "");
            _blockMsg = JStr(v, Lang != null && Lang.ToUpper().StartsWith("ES") ? "message_es" : "message_en", "");
            int rsec = (int)JNum(v, "resume_in_sec", -1);
            _resumeAt = (!allow && rsec > 0) ? Server.TimeInUtc.AddSeconds(rsec) : DateTime.MinValue;
            if (!allow && _allowNew) _blockSince = Server.Time;
            if (allow) _blockSince = DateTime.MinValue;
            _allowNew = allow;
        }

        // ================= Comandos =================
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

        // ================= Enforcement / gestion =================
        private void EnforceGuard()
        {
            if (!_managerOn) return;
            if (_forceClose)
            {
                if (Positions.Count > 0) { RunCommand("close_all"); LogEvent("limit", _blockMsg != "" ? _blockMsg : L("Closed by limit", "Cierre por limite")); }
                return;
            }
            if (_allowNew || _blockSince == DateTime.MinValue) return;
            foreach (var pos in Positions)
            {
                if (pos.EntryTime < _blockSince) continue;
                var r = ClosePosition(pos);
                if (r != null && r.IsSuccessful)
                    LogEvent("blocked", L("Trade outside plan closed: ", "Operacion fuera del plan cerrada: ") + (_blockReason != "" ? _blockReason : "?"), pos.SymbolName, pos.Id, 0);
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

        private double PipSize(Symbol sym) { return sym.PipSize; }
        private double UnitsToPrice(Symbol sym, double value, double lots, double entry, double sl)
        {
            if (_units == "money")
            {
                double units = sym.QuantityToVolumeInUnits(lots);
                double perUnitPerTick = sym.TickValue;
                if (perUnitPerTick <= 0 || units <= 0) return 0;
                double ticks = value / (perUnitPerTick * units);
                return ticks * sym.TickSize;
            }
            if (_units == "r") { if (sl <= 0) return 0; return value * Math.Abs(entry - sl); }
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
            double lots = sym.VolumeInUnitsToQuantity(pos.VolumeInUnits);
            double price = isBuy ? sym.Bid : sym.Ask;
            double profitDist = isBuy ? (price - entry) : (entry - price);
            if (profitDist <= 0) return;

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

        private void RunCommand(string cmd)
        {
            int done = 0;
            var snapshot = new List<Position>(Positions);
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
            LogEvent(cmd == "close_all" ? "close_all" : "info", L("Action done: ", "Accion ejecutada: ") + cmd + " (" + done + ")", "", 0, done);
            Print("Onyx: " + cmd + " (" + done + ")");
        }

        // ================= PANEL =================
        private static TextBlock Txt(string s, Color c, int size, bool bold = false)
        {
            return new TextBlock { Text = s, ForegroundColor = c, FontSize = size, FontWeight = bold ? FontWeight.Bold : FontWeight.Normal };
        }
        private static Border Pill(TextBlock child, Color bg)
        {
            return new Border { BackgroundColor = bg, CornerRadius = 8, Padding = new Thickness(8, 2, 8, 3), Margin = new Thickness(0, 0, 4, 0), Child = child, HorizontalAlignment = HorizontalAlignment.Left };
        }
        private Border StatCard(string label, out TextBlock valueRef, Color bg, Color valColor)
        {
            var sp = new StackPanel { Orientation = Orientation.Vertical };
            sp.AddChild(Txt(label, C_MUT, 9));
            valueRef = Txt("—", valColor, 14, true);
            sp.AddChild(valueRef);
            return new Border { BackgroundColor = bg, CornerRadius = 8, Padding = new Thickness(9, 6, 9, 6), Margin = new Thickness(0, 0, 6, 6), Width = 108, Child = sp };
        }
        private void ModuleRow(StackPanel parent, string name, out TextBlock pillRef, out Border pillBorder)
        {
            var g = new Grid(1, 2) { Margin = new Thickness(0, 0, 0, 6) };
            g.AddChild(Txt(name, C_TX, 11), 0, 0);
            pillRef = Txt("OFF", Color.FromHex("#FF0D1220"), 10, true);
            pillBorder = new Border { BackgroundColor = Color.FromHex("#FF5A6478"), CornerRadius = 9, Padding = new Thickness(12, 2, 12, 3), Child = pillRef, HorizontalAlignment = HorizontalAlignment.Right };
            g.AddChild(pillBorder, 0, 1);
            parent.AddChild(g);
        }
        private Button Qa(string text, string cmd, Color bg)
        {
            var b = new Button { Text = text, BackgroundColor = bg, ForegroundColor = C_TX, Margin = new Thickness(0, 0, 6, 6), Width = 108, FontSize = 11 };
            b.Click += args => RunCommand(cmd);
            return b;
        }

        private void BuildPanel()
        {
            var root = new StackPanel { Orientation = Orientation.Vertical };

            // Cabecera
            var head = new Grid(1, 2) { Margin = new Thickness(0, 0, 0, 8) };
            head.AddChild(Txt("Onyx Connect", C_TX, 15, true), 0, 0);
            _planTxt = Txt("", TBt, 11);
            _planPill = new Border { BackgroundColor = TB, CornerRadius = 10, Padding = new Thickness(9, 2, 9, 3), Child = _planTxt, HorizontalAlignment = HorizontalAlignment.Right, IsVisible = false };
            head.AddChild(_planPill, 0, 1);
            root.AddChild(head);

            // Chips de funciones
            var chips = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 8) };
            chips.AddChild(Pill(Txt(L("Journal", "Diario"), TBt, 10), TB));
            _chG = Pill(Txt("Guardian", TGt, 10), TG); _chG.IsVisible = false; chips.AddChild(_chG);
            _chC = Pill(Txt("Copy", TCt, 10), TC); _chC.IsVisible = false; chips.AddChild(_chC);
            _chT = Pill(Txt("TradingView", TAt, 10), TA); _chT.IsVisible = false; chips.AddChild(_chT);
            root.AddChild(chips);

            _txState = Txt("", C_GREEN, 11); _txState.Margin = new Thickness(0, 0, 0, 8);
            root.AddChild(_txState);

            // Live
            root.AddChild(Txt(L("LIVE", "EN VIVO"), C_MUT, 9));
            var live = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 4, 0, 4) };
            _pAutoTxt = Txt("AutoTrading ON", TGt, 10);
            _pAuto = Pill(_pAutoTxt, TG); live.AddChild(_pAuto);
            _pSpreadTxt = Txt("—", TCt, 10);
            live.AddChild(Pill(_pSpreadTxt, TC));
            root.AddChild(live);
            _pSessTxt = Txt("—", TBt, 10);
            var sessWrap = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 8) };
            sessWrap.AddChild(Pill(_pSessTxt, TB));
            root.AddChild(sessWrap);

            // Estado del mercado (cerrado + cuenta atras a la apertura)
            _pMktTxt = Txt("", TRt, 10);
            _pMktWrap = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 8), IsVisible = false };
            _pMktWrap.AddChild(Pill(_pMktTxt, TR));
            root.AddChild(_pMktWrap);

            // Guardian
            _guardWrap = new StackPanel { Orientation = Orientation.Vertical, IsVisible = false };
            _guardWrap.AddChild(Txt(L("GUARDIAN · MY PLAN", "GUARDIAN · MI PLAN"), C_MUT, 9));

            _statusTxt = Txt(L("You may trade", "Puedes operar"), TGt, 12, true);
            _statusPill = new Border { BackgroundColor = TG, CornerRadius = 8, Padding = new Thickness(10, 3, 10, 4), Margin = new Thickness(0, 4, 0, 6), Child = _statusTxt, HorizontalAlignment = HorizontalAlignment.Left };
            _guardWrap.AddChild(_statusPill);

            // Caja de bloqueo
            var bxSp = new StackPanel { Orientation = Orientation.Vertical };
            _blockTop = Txt(L("BLOCKED", "BLOQUEADO"), TRt, 12, true);
            _blockMsgL = Txt("", C_TX, 9);
            _blockNum = Txt("", C_AMBER, 15, true);
            bxSp.AddChild(_blockTop); bxSp.AddChild(_blockMsgL); bxSp.AddChild(_blockNum);
            _blockBox = new Border { BackgroundColor = TR, CornerRadius = 8, Padding = new Thickness(10, 7, 10, 8), Margin = new Thickness(0, 0, 0, 6), Child = bxSp, IsVisible = false };
            _guardWrap.AddChild(_blockBox);

            // Limites 2x2
            var row1 = new StackPanel { Orientation = Orientation.Horizontal };
            row1.AddChild(StatCard(L("Daily loss", "Perdida dia"), out _sdlV, TR, TRt));
            row1.AddChild(StatCard(L("Daily target", "Meta dia"), out _sdtV, TG, TGt));
            _guardWrap.AddChild(row1);
            var row2 = new StackPanel { Orientation = Orientation.Horizontal };
            row2.AddChild(StatCard(L("Total loss", "Perdida total"), out _stlV, TA, TAt));
            row2.AddChild(StatCard(L("Trades/day", "Ops por dia"), out _smxV, TB, TBt));
            _guardWrap.AddChild(row2);

            // Noticia
            _newsWrap = new StackPanel { Orientation = Orientation.Vertical, Margin = new Thickness(0, 2, 0, 6), IsVisible = false };
            _newsTxt = Txt("", C_AMBER, 10, true);
            _newsWrap.AddChild(_newsTxt);
            _guardWrap.AddChild(_newsWrap);

            root.AddChild(_guardWrap);

            // Modulos
            root.AddChild(Txt(L("MODULES", "MODULOS"), C_MUT, 9));
            var modSp = new StackPanel { Orientation = Orientation.Vertical, Margin = new Thickness(0, 4, 0, 6) };
            ModuleRow(modSp, "Break even", out _mBe, out _mBeB);
            ModuleRow(modSp, "Trailing stop", out _mTr, out _mTrB);
            ModuleRow(modSp, L("Partial TPs", "TP parciales"), out _mPt, out _mPtB);
            root.AddChild(modSp);

            // Acciones rapidas (solo protegen)
            root.AddChild(Txt(L("QUICK ACTIONS · PROTECT ONLY", "ACCIONES RAPIDAS · SOLO PROTEGEN"), C_MUT, 8));
            var qa1 = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 4, 0, 0) };
            qa1.AddChild(Qa(L("SL to BE", "SL a BE"), "sl_to_be", C_CARD));
            qa1.AddChild(Qa(L("Close 50%", "Cerrar 50%"), "close_half", C_CARD));
            root.AddChild(qa1);
            var qa2 = new StackPanel { Orientation = Orientation.Horizontal };
            qa2.AddChild(Qa(L("Winners", "Ganadoras"), "close_profitable", C_CARD));
            qa2.AddChild(Qa(L("Close all", "Cerrar todo"), "close_all", Color.FromHex("#FF8C2837")));
            root.AddChild(qa2);

            root.AddChild(Txt(L("Onyx never opens trades", "Onyx no abre operaciones"), C_MUT, 8));

            var outer = new Border
            {
                BackgroundColor = C_BG,
                BorderColor = C_LINE,
                BorderThickness = new Thickness(1),
                CornerRadius = 12,
                Padding = new Thickness(12),
                Margin = new Thickness(10, 10, 0, 0),
                HorizontalAlignment = HorizontalAlignment.Left,
                VerticalAlignment = VerticalAlignment.Top,
                Width = 280,
                Child = root
            };
            Chart.AddControl(outer);
        }

        private string SessionName()
        {
            int h = Server.TimeInUtc.Hour;
            bool ldn = (h >= 7 && h < 16);
            bool ny = (h >= 12 && h < 21);
            bool tok = (h >= 23 || h < 8);
            bool syd = (h >= 21 || h < 6);
            if (ldn && ny) return "London+NY";
            if (ldn) return "London";
            if (ny) return "New York";
            if (tok) return L("Tokyo", "Tokio");
            if (syd) return L("Sydney", "Sidney");
            return L("Off-session", "Fuera de sesion");
        }
        private string LimTxt(double v, bool pct)
        {
            if (v <= 0) return "—";
            if (pct) return (v == Math.Floor(v) ? v.ToString("F0") : v.ToString("F1", CultureInfo.InvariantCulture)) + "%";
            return "$" + v.ToString("F0", CultureInfo.InvariantCulture);
        }
        private static string MMSS(int secs)
        {
            if (secs < 0) secs = 0;
            return (secs / 60).ToString("00") + ":" + (secs % 60).ToString("00");
        }

        private void UpdatePanel()
        {
            if (_planTxt == null) return;

            // plan + funciones
            _planPill.IsVisible = _featPlan != "";
            _planTxt.Text = _featPlan;
            _chG.IsVisible = _featG; _chC.IsVisible = _featC; _chT.IsVisible = _featT;

            // estado
            bool alive = !string.IsNullOrEmpty(ApiKey);
            _txState.Text = alive ? L("Connected · account ", "Conectado · cuenta ") + Account.Number : L("Connecting...", "Conectando...");

            // live
            int spreadPips = (int)Math.Round(Symbol.Spread / Symbol.PipSize);
            _pSpreadTxt.Text = spreadPips + " pips";
            _pSessTxt.Text = SessionName() + " · " + Server.TimeInUtc.ToString("HH:mm") + " · " + Symbol.Name;

            // Estado del mercado: cerrado + cuenta atras a la apertura (cTrader lo da exacto).
            try
            {
                var mh = Symbol.MarketHours;
                bool open = mh.IsOpened();
                if (!open)
                {
                    var tt = mh.TimeTillOpen();
                    string cd = (tt.Days > 0 ? tt.Days + "d " : "") + tt.ToString(@"hh\:mm\:ss");
                    _pMktTxt.Text = L("Market closed · opens in ", "Mercado cerrado · abre en ") + cd;
                    _pMktWrap.IsVisible = true;
                }
                else _pMktWrap.IsVisible = false;
            }
            catch { _pMktWrap.IsVisible = false; }

            // guardian
            _guardWrap.IsVisible = _guardOn;
            if (_guardOn)
            {
                bool blocked = !_allowNew;
                _statusPill.IsVisible = !blocked;
                _blockBox.IsVisible = blocked;
                if (blocked)
                {
                    _blockMsgL.Text = _blockMsg;
                    if (_resumeAt != DateTime.MinValue)
                    {
                        int left = (int)(_resumeAt - Server.TimeInUtc).TotalSeconds;
                        _blockNum.Text = L("Resumes in ", "Reanuda en ") + MMSS(left);
                        _blockNum.IsVisible = true;
                    }
                    else _blockNum.IsVisible = false;
                }
                _sdlV.Text = LimTxt(_limDLoss, _limDLossPct);
                _sdtV.Text = LimTxt(_limDTarget, _limDTgtPct);
                _stlV.Text = LimTxt(_limTLoss, _limTLossPct);
                _smxV.Text = _maxTrades > 0 ? _maxTrades.ToString() : "—";

                if (_newsTitle != "")
                {
                    _newsWrap.IsVisible = true;
                    string nt = _newsCur != "" ? _newsCur + " · " + _newsTitle : _newsTitle;
                    if (_newsWillBlock && _newsBlockIn >= 0)
                        _newsTxt.Text = L("News block in ", "Bloqueo por noticia en ") + _newsBlockIn + "m · " + nt;
                    else
                        _newsTxt.Text = L("Next news: ", "Proxima noticia: ") + nt + (_newsMin >= 0 ? " (" + _newsMin + "m)" : "");
                }
                else _newsWrap.IsVisible = false;
            }

            // modulos
            SetModule(_mBe, _mBeB, _beOn);
            SetModule(_mTr, _mTrB, _trOn);
            SetModule(_mPt, _mPtB, _ptOn);
        }

        private void SetModule(TextBlock pill, Border box, bool on)
        {
            pill.Text = on ? "ON" : "OFF";
            pill.ForegroundColor = on ? Color.FromHex("#FF06231A") : Color.FromHex("#FF0D1220");
            box.BackgroundColor = on ? C_GREEN : Color.FromHex("#FF5A6478");
        }
    }
}
