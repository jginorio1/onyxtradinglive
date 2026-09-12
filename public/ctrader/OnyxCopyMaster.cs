// ===================================================================
//  OnyxCopyMaster  ·  cTrader cBot (PLANTILLA)
//  Reporta las operaciones de esta cuenta (master) a Onyx para copiarlas.
//
//  Equivalente al OnyxCopyMaster de MetaTrader. Usa tu CLAVE COPY
//  (empieza por "onyx_copy_"), NO la del Guardian.
//
//  INSTALAR: cTrader → Automate → New cBot → pega → Build → añade al
//  gráfico con tu clave Copy. Requiere AccessRights.FullAccess (red).
//  Pruébalo PRIMERO en DEMO antes de dinero real.
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
    public class OnyxCopyMaster : Robot
    {
        [Parameter("API base", DefaultValue = "https://www.onyxtradinglive.com")]
        public string ApiBase { get; set; }

        [Parameter("Copy API key", DefaultValue = "onyx_copy_...")]
        public string CopyApiKey { get; set; }

        private HttpClient _http;

        protected override void OnStart()
        {
            _http = new HttpClient();
            _http.Timeout = TimeSpan.FromSeconds(6);
            if (CopyApiKey == null || !CopyApiKey.StartsWith("onyx_copy_"))
                Print("AVISO: la clave Copy debe empezar por onyx_copy_.");
            Positions.Opened += OnOpened;
            Positions.Closed += OnClosed;
            Print("OnyxCopyMaster listo (cTrader).");
        }

        protected override void OnStop() { if (_http != null) _http.Dispose(); }

        private static string F(double v, int d = 2) { return v.ToString("F" + d, CultureInfo.InvariantCulture); }

        private void OnOpened(PositionOpenedEventArgs a) { Report("open", a.Position); }
        private void OnClosed(PositionClosedEventArgs a) { Report("close", a.Position); }

        private void Report(string ev, Position pos)
        {
            var sym = Symbols.GetSymbol(pos.SymbolName);
            double lots = sym != null ? sym.VolumeInUnitsToQuantity(pos.VolumeInUnits) : pos.VolumeInUnits;
            double price = sym != null ? (pos.TradeType == TradeType.Buy ? sym.Ask : sym.Bid) : pos.EntryPrice;
            string j = "{"
                + "\"event\":\"" + ev + "\","
                + "\"ticket\":\"" + pos.Id + "\","
                + "\"symbol\":\"" + pos.SymbolName + "\","
                + "\"side\":\"" + (pos.TradeType == TradeType.Buy ? "buy" : "sell") + "\","
                + "\"volume\":" + F(lots) + ","
                + "\"sl\":" + F(pos.StopLoss ?? 0, 5) + ","
                + "\"tp\":" + F(pos.TakeProfit ?? 0, 5) + ","
                + "\"price\":" + F(price, 5)
                + "}";
            Post("/api/v1/copy/master", j);
        }

        private void Post(string path, string json)
        {
            try
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var req = new HttpRequestMessage(HttpMethod.Post, ApiBase.TrimEnd('/') + path) { Content = content };
                req.Headers.TryAddWithoutValidation("x-onyx-key", CopyApiKey);
                var res = _http.SendAsync(req).GetAwaiter().GetResult();
                if (!res.IsSuccessStatusCode) Print("Onyx copy master HTTP " + (int)res.StatusCode);
            }
            catch (Exception e) { Print("Onyx copy master net err: ", e.Message); }
        }
    }
}
