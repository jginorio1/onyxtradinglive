//+------------------------------------------------------------------+
//| OnyxCopyMaster.mq4  ·  PLANTILLA (Fase 2 · MetaTrader 4)          |
//| Reporta las operaciones del master a Onyx para copiarlas.        |
//|                                                                  |
//| Antes de usar:                                                   |
//|  1) MT4 → Herramientas → Opciones → Asesores Expertos →          |
//|     "Permitir WebRequest para las URL siguientes" → añade:       |
//|     https://www.onyxtradinglive.com                              |
//|  2) Pega tu CLAVE COPY de esta cuenta (empieza por "onyx_copy_"). |
//|     No es la clave del Guardian; las de copy van aparte.          |
//|  Plantilla: tu desarrollador MQL añade reintentos y pruebas.     |
//+------------------------------------------------------------------+
#property strict

extern string ApiBase    = "https://www.onyxtradinglive.com";
extern string CopyApiKey = "PON_TU_CLAVE_COPY";   // onyx_copy_...
extern int    PollMs     = 800;

// MQL4 no tiene OnTradeTransaction: llevamos nosotros la lista de tickets
// abiertos y detectamos aperturas y cierres comparando en cada tick del timer.
int    g_open[];        // tickets que ya vimos abiertos
int    g_openCount = 0;

int OnInit()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   EventSetMillisecondTimer(PollMs);
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason){ EventKillTimer(); }

// POST JSON a Onyx.
int PostJson(string path, string json)
{
   char post[]; StringToCharArray(json, post, 0, StringLen(json));
   char result[]; string rh;
   string headers = "Content-Type: application/json\r\nx-onyx-key: " + CopyApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", ApiBase + path, headers, 5000, post, result, rh);
   if(code == -1) Print("WebRequest error ", GetLastError(), " (¿URL en la whitelist?)");
   return(code);
}

void ReportEvent(string ev, int ticket, string sym, string side, double vol, double sl, double tp, double price)
{
   string j = StringFormat(
      "{\"event\":\"%s\",\"ticket\":\"%d\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"sl\":%.5f,\"tp\":%.5f,\"price\":%.5f}",
      ev, ticket, sym, side, vol, sl, tp, price);
   PostJson("/api/v1/copy/master", j);
}

bool WasOpen(int ticket)
{
   for(int i=0;i<g_openCount;i++) if(g_open[i]==ticket) return(true);
   return(false);
}

void OnTimer()
{
   int nowTickets[]; int nowCount = 0;
   ArrayResize(nowTickets, OrdersTotal());

   // 1) recorre las órdenes abiertas; reporta las nuevas
   for(int i=0;i<OrdersTotal();i++){
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;                 // solo market buy/sell
      int tk = OrderTicket();
      nowTickets[nowCount++] = tk;
      if(!WasOpen(tk)){
         string side = (OrderType()==OP_BUY) ? "buy" : "sell";
         ReportEvent("open", tk, OrderSymbol(), side, OrderLots(), OrderStopLoss(), OrderTakeProfit(), OrderOpenPrice());
      }
   }

   // 2) las que estaban y ya no están → cerradas
   for(int j=0;j<g_openCount;j++){
      int old = g_open[j]; bool still=false;
      for(int k=0;k<nowCount;k++) if(nowTickets[k]==old){ still=true; break; }
      if(!still){
         string sym=""; string side="";
         if(OrderSelect(old, SELECT_BY_TICKET)){ sym=OrderSymbol(); side=(OrderType()==OP_BUY)?"buy":"sell"; }
         ReportEvent("close", old, sym, side, 0, 0, 0, 0);
      }
   }

   // 3) guarda el estado actual
   ArrayResize(g_open, nowCount);
   for(int m=0;m<nowCount;m++) g_open[m]=nowTickets[m];
   g_openCount = nowCount;
}
