//+------------------------------------------------------------------+
//| OnyxCopyMaster.mq5  ·  PLANTILLA (Fase 2)                         |
//| Reporta las operaciones del master a Onyx para copiarlas.        |
//|                                                                  |
//| Antes de usar:                                                   |
//|  1) MT5 → Herramientas → Opciones → Expert Advisors →            |
//|     "Permitir WebRequest para las URL siguientes" → añade:       |
//|     https://www.onyxtradinglive.com                              |
//|  2) Pega tu CLAVE COPY de esta cuenta (empieza por "onyx_copy_"). |
//|     OJO: no es la clave del Guardian; las de copy van aparte.     |
//|     La generas en la web → Copy trading → Claves Copy → Instalar. |
//|  Plantilla: tu desarrollador MQL añade reintentos, manejo de     |
//|  errores y pruebas en demo antes de producción.                  |
//+------------------------------------------------------------------+
#property strict

input string ApiBase     = "https://www.onyxtradinglive.com";
input string CopyApiKey  = "PON_TU_CLAVE_COPY";   // onyx_copy_...  (deja en blanco si SOLO usas modo Local)
input string PanelLang   = "EN";                  // Panel: ES=Español, otro=English (web/IA/Telegram en 6 idiomas)
input bool   LocalMode   = false;                 // Copia LOCAL (mismo VPS): escribe a archivo comun, sin nube (milisegundos)
input string CopyChannel = "onyx1";               // Mismo nombre en master y esclavas del mismo VPS

string L(string en, string es){ return (StringFind(PanelLang, "ES") == 0) ? es : en; }

//==================== PANEL EN EL GRAFICO ====================
// Tarjeta pegada en la esquina, igual que Onyx Guardian. El borde cambia:
// verde = enviando · ambar = esperando/primer envio · rojo = pausada.
#define PFX "OnyxCopy_"
color CP_BG=C'15,19,26', CP_TX=C'230,235,242', CP_MUT=C'138,151,165';
color CP_ON=C'52,226,160', CP_AMBER=C'245,158,11', CP_RED=C'224,75,74';
int   g_state=1;                // 0 pausada · 1 esperando · 2 enviando
int   g_sent=0;

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
   PLabel("t",LocalMode?"Onyx Copy  MASTER · LOCAL":"Onyx Copy  MASTER",X+12,y,CP_TX,9,true); y+=18;
   string stx = g_state==2?L("Sending","Enviando") : (g_state==0?L("PAUSED","PAUSADA"):L("Waiting for trades","Esperando operaciones"));
   PLabel("st",stx,X+12,y,bc,8); y+=16;
   PLabel("c",L("Sent: ","Enviadas: ")+(string)g_sent,X+12,y,CP_TX,8); y+=16;
   PLabel("a",L("Account ","Cuenta ")+(string)AccountInfoInteger(ACCOUNT_LOGIN),X+12,y,CP_MUT,8);
   ChartRedraw();
}
void DelPanel(){ ObjectsDeleteAll(0,PFX); }

//--- POST JSON a Onyx. Devuelve el código HTTP.
int PostJson(string path, string json)
{
   char post[]; StringToCharArray(json, post, 0, StringLen(json));
   char result[]; string headers = "Content-Type: application/json\r\nx-onyx-key: " + CopyApiKey + "\r\n";
   string rh;
   int code = WebRequest("POST", ApiBase + path, headers, 5000, post, result, rh);
   if(code == -1) { Print("WebRequest error ", GetLastError(), " (¿URL en la whitelist?)"); g_state = 1; return code; }
   // Estado para el panel: rojo si el relay dice pausada, verde si aceptó el envio.
   string body = CharArrayToString(result);
   g_state = (StringFind(body, "\"paused\"") >= 0 && StringFind(body, "\"paused\":0") < 0) ? 0 : 2;
   if(code == 200) g_sent++;
   DrawPanel();
   return code;
}

//--- Modo Local: escribe el evento en la carpeta comun de MetaTrader (mismo VPS).
//    Todos los terminales del mismo PC comparten esta carpeta (FILE_COMMON),
//    asi que la esclava lo lee al instante sin pasar por internet.
void WriteLocal(string ev, ulong ticket, string sym, string side, double vol, double sl, double tp, double price, double mbal)
{
   string fn = "onyx_local_" + CopyChannel + ".jsonl";
   int h = FileOpen(fn, FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE) { Print("Onyx local: no pude abrir ", fn, " err ", GetLastError()); return; }
   FileSeek(h, 0, SEEK_END);
   string line = StringFormat(
      "{\"ev\":\"%s\",\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"vol\":%.2f,\"sl\":%.5f,\"tp\":%.5f,\"price\":%.5f,\"mbal\":%.2f}",
      ev, ticket, sym, side, vol, sl, tp, price, mbal);
   FileWriteString(h, line + "\r\n");
   FileClose(h);
   g_state = 2; g_sent++;
}

//--- Envía un evento de trade (local, nube o ambos según la configuración).
void ReportEvent(string ev, ulong ticket, string sym, string side, double vol, double sl, double tp, double price)
{
   double mbal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(LocalMode) WriteLocal(ev, ticket, sym, side, vol, sl, tp, price, mbal);
   if(StringFind(CopyApiKey, "onyx_copy_") == 0) {
      string j = StringFormat(
         "{\"event\":\"%s\",\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"sl\":%.5f,\"tp\":%.5f,\"price\":%.5f}",
         ev, ticket, sym, side, vol, sl, tp, price);
      PostJson("/api/v1/copy/master", j);
   }
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

int OnInit()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   Print("OnyxCopyMaster listo. Recuerda la whitelist de WebRequest.");
   EventSetTimer(3);                  // solo para refrescar el panel
   DrawPanel();
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){ EventKillTimer(); DelPanel(); }
void OnTimer(){ DrawPanel(); }
