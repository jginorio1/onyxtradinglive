//+------------------------------------------------------------------+
//| OnyxCopyMaster.mq5  ·  PLANTILLA (Fase 1)                         |
//| Reporta las operaciones del master a Onyx para copiarlas.        |
//|                                                                  |
//| Antes de usar:                                                   |
//|  1) MT5 → Herramientas → Opciones → Expert Advisors →            |
//|     "Permitir WebRequest para las URL siguientes" → añade:       |
//|     https://www.onyxtradinglive.com                              |
//|  2) Pon tu API key de cuenta (la misma del sync de Onyx).        |
//|  Esto es una plantilla: tu desarrollador MQL añade reintentos,   |
//|  manejo de errores y pruebas antes de producción.                |
//+------------------------------------------------------------------+
#property strict

input string ApiBase = "https://www.onyxtradinglive.com";
input string ApiKey  = "PON_TU_API_KEY_DE_CUENTA";

//--- POST JSON a Onyx. Devuelve el código HTTP.
int PostJson(string path, string json)
{
   char post[]; StringToCharArray(json, post, 0, StringLen(json));
   char result[]; string headers = "Content-Type: application/json\r\nx-onyx-key: " + ApiKey + "\r\n";
   string rh;
   int code = WebRequest("POST", ApiBase + path, headers, 5000, post, result, rh);
   if(code == -1) Print("WebRequest error ", GetLastError(), " (¿URL en la whitelist?)");
   return code;
}

//--- Envía un evento de trade al relay.
void ReportEvent(string ev, ulong ticket, string sym, string side, double vol, double sl, double tp, double price)
{
   string j = StringFormat(
      "{\"event\":\"%s\",\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"sl\":%.5f,\"tp\":%.5f,\"price\":%.5f}",
      ev, ticket, sym, side, vol, sl, tp, price);
   PostJson("/api/v1/copy/master", j);
}

//--- Detecta aperturas/cierres/modificaciones.
void OnTradeTransaction(const MqlTradeTransaction& trans, const MqlTradeRequest& request, const MqlTradeResult& result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;

   long   entry  = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);      // IN / OUT
   string sym    = HistoryDealGetString (trans.deal, DEAL_SYMBOL);
   double vol    = HistoryDealGetDouble (trans.deal, DEAL_VOLUME);
   double price  = HistoryDealGetDouble (trans.deal, DEAL_PRICE);
   long   type   = HistoryDealGetInteger(trans.deal, DEAL_TYPE);
   string side   = (type == DEAL_TYPE_BUY) ? "buy" : "sell";
   ulong  pos    = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);

   double sl = 0, tp = 0;
   if(PositionSelectByTicket(pos)) { sl = PositionGetDouble(POSITION_SL); tp = PositionGetDouble(POSITION_TP); }

   if(entry == DEAL_ENTRY_IN)       ReportEvent("open",  pos, sym, side, vol, sl, tp, price);
   else if(entry == DEAL_ENTRY_OUT) ReportEvent("close", pos, sym, side, vol, sl, tp, price);
   // TODO: modify (SL/TP) vía OnTradeTransaction TRADE_TRANSACTION_POSITION.
}

int OnInit(){ Print("OnyxCopyMaster listo. Recuerda la whitelist de WebRequest."); return INIT_SUCCEEDED; }
