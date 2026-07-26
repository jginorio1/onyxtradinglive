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
extern string PanelLang  = "EN";                  // Panel language: EN or ES

string L(string en, string es){ return (StringFind(PanelLang, "ES") == 0) ? es : en; }

// MQL4 no tiene OnTradeTransaction: llevamos nosotros la lista de tickets
// abiertos y detectamos aperturas y cierres comparando en cada tick del timer.
int    g_open[];        // tickets que ya vimos abiertos
int    g_openCount = 0;

//==================== PANEL EN EL GRAFICO ====================
// Igual que Onyx Guardian. Borde: verde=enviando · ambar=esperando · rojo=pausada.
#define PFX "OnyxCopy_"
color CP_BG=C'15,19,26', CP_TX=C'230,235,242', CP_MUT=C'138,151,165';
color CP_ON=C'52,226,160', CP_AMBER=C'245,158,11', CP_RED=C'224,75,74';
int    g_state=1;               // 0 pausada · 1 esperando · 2 enviando
int    g_sent=0;

void PLabel(string n,string tx,int x,int y,color c,int sz=8,bool bold=false){
   string nm=PFX+n; if(ObjectFind(0,nm)<0) ObjectCreate(0,nm,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,nm,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,nm,OBJPROP_XDISTANCE,x); ObjectSetInteger(0,nm,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,nm,OBJPROP_COLOR,c); ObjectSetInteger(0,nm,OBJPROP_FONTSIZE,sz);
   ObjectSetString(0,nm,OBJPROP_FONT,bold?"Arial Bold":"Arial");
   ObjectSetString(0,nm,OBJPROP_TEXT,tx); ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false);
}
void DrawPanel(){
   int X=12,W=214,y=22;
   string bg=PFX+"bg"; if(ObjectFind(0,bg)<0) ObjectCreate(0,bg,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,bg,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,bg,OBJPROP_XDISTANCE,X); ObjectSetInteger(0,bg,OBJPROP_YDISTANCE,y-10);
   ObjectSetInteger(0,bg,OBJPROP_XSIZE,W); ObjectSetInteger(0,bg,OBJPROP_YSIZE,96);
   ObjectSetInteger(0,bg,OBJPROP_BGCOLOR,CP_BG); ObjectSetInteger(0,bg,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,bg,OBJPROP_BACK,false); ObjectSetInteger(0,bg,OBJPROP_SELECTABLE,false);
   color bc = g_state==2?CP_ON : (g_state==0?CP_RED : CP_AMBER);
   ObjectSetInteger(0,bg,OBJPROP_COLOR,bc);
   PLabel("t","Onyx Copy   MASTER",X+12,y,CP_TX,9,true); y+=18;
   string stx = g_state==2?L("Sending","Enviando") : (g_state==0?L("PAUSED","PAUSADA"):L("Waiting for trades","Esperando operaciones"));
   PLabel("st",stx,X+12,y,bc,8); y+=16;
   PLabel("c",L("Sent: ","Enviadas: ")+(string)g_sent,X+12,y,CP_TX,8); y+=16;
   PLabel("a",L("Account ","Cuenta ")+(string)AccountNumber(),X+12,y,CP_MUT,8);
   ChartRedraw();
}
void DelPanel(){ ObjectsDeleteAll(0,PFX); }

int OnInit()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   EventSetMillisecondTimer(PollMs);
   DrawPanel();
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason){ EventKillTimer(); DelPanel(); }

// POST JSON a Onyx.
int PostJson(string path, string json)
{
   char post[]; StringToCharArray(json, post, 0, StringLen(json));
   char result[]; string rh;
   string headers = "Content-Type: application/json\r\nx-onyx-key: " + CopyApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", ApiBase + path, headers, 5000, post, result, rh);
   if(code == -1){ Print("WebRequest error ", GetLastError(), " (¿URL en la whitelist?)"); g_state=1; return(code); }
   string body = CharArrayToString(result);
   g_state = (StringFind(body, "\"paused\"") >= 0 && StringFind(body, "\"paused\":0") < 0) ? 0 : 2;
   if(code == 200) g_sent++;
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

   DrawPanel();                       // refresca la tarjeta (borde por estado)
}
