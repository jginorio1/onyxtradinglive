//+------------------------------------------------------------------+
//| OnyxCopySlave.mq5  ·  PLANTILLA (Fase 2)                          |
//| Pide comandos a Onyx cada 1 s, resuelve el símbolo local,        |
//| calcula el lote según el modo, aplica los LÍMITES de riesgo del  |
//| enlace (que vienen en el comando) y ejecuta.                     |
//|                                                                  |
//| Whitelist de WebRequest igual que el master.                     |
//| Pega tu CLAVE COPY de esta cuenta (empieza por "onyx_copy_").    |
//| Plantilla: falta parseo JSON robusto (usa una lib JSON de MQL),  |
//| reintentos y pruebas. El cálculo de lote, la resolución de       |
//| símbolo y los límites de riesgo están abajo listos para adaptar. |
//+------------------------------------------------------------------+
#property strict
#include <Trade/Trade.mqh>
CTrade trade;

input string ApiBase    = "https://www.onyxtradinglive.com";
input string CopyApiKey = "PON_TU_CLAVE_COPY";   // onyx_copy_...
input int    PollMs     = 1000;

//--- Equity de referencia del día (para la pérdida diaria / drawdown).
double g_dayStartEquity = 0;
int    g_dayStamp       = -1;

//==================== PANEL EN EL GRAFICO ====================
// Tarjeta pegada en la esquina, igual que Onyx Guardian. El borde cambia:
// verde = conectada · ambar = esperando · rojo = pausada.
#define PFX "OnyxCopy_"
color CP_BG=C'15,19,26', CP_TX=C'230,235,242', CP_MUT=C'138,151,165';
color CP_ON=C'52,226,160', CP_AMBER=C'245,158,11', CP_RED=C'224,75,74';
int    g_state=1;               // 0 pausada · 1 esperando · 2 conectada
int    g_copied=0, g_skipped=0, g_lat=0;
string g_masterInfo="-";

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
   ObjectSetInteger(0,bg,OBJPROP_XSIZE,W); ObjectSetInteger(0,bg,OBJPROP_YSIZE,116);
   ObjectSetInteger(0,bg,OBJPROP_BGCOLOR,CP_BG); ObjectSetInteger(0,bg,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,bg,OBJPROP_BACK,false); ObjectSetInteger(0,bg,OBJPROP_SELECTABLE,false);
   color bc = g_state==2?CP_ON : (g_state==0?CP_RED : CP_AMBER);
   ObjectSetInteger(0,bg,OBJPROP_COLOR,bc);
   PLabel("t","Onyx Copy   ESCLAVA",X+12,y,CP_TX,9,true); y+=18;
   string stx = g_state==2?"Conectada" : (g_state==0?"PAUSADA":"Esperando senal");
   PLabel("st",stx,X+12,y,bc,8); y+=16;
   PLabel("m","Copia de: "+g_masterInfo,X+12,y,CP_MUT,8); y+=16;
   PLabel("c","Copiadas: "+(string)g_copied+"   Saltadas: "+(string)g_skipped,X+12,y,CP_TX,8); y+=16;
   PLabel("l","Retraso: "+(string)g_lat+" ms",X+12,y,CP_MUT,8);
   ChartRedraw();
}
void DelPanel(){ ObjectsDeleteAll(0,PFX); }

int OnInit()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayStamp = DayOfYearNow();
   EventSetMillisecondTimer(PollMs);
   DrawPanel();
   return INIT_SUCCEEDED;
}
void OnDeinit(const int r){ EventKillTimer(); DelPanel(); }

int DayOfYearNow(){ MqlDateTime dt; TimeToStruct(TimeCurrent(), dt); return dt.day_of_year; }

//--- GET de comandos pendientes.
string GetCommands()
{
   char post[]; char result[]; string rh;
   string headers = "x-onyx-key: " + CopyApiKey + "\r\n";
   int code = WebRequest("GET", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
   if(code != 200) { if(code==-1) Print("WebRequest err ", GetLastError()); g_state = 1; return ""; }
   string body = CharArrayToString(result);
   // Estado para el panel: rojo si el servidor dice pausada, verde si responde bien.
   g_state = (StringFind(body, "\"paused\":true") >= 0) ? 0 : 2;
   return body;
}

//--- Confirma el resultado de un comando.
void Ack(string commandId, bool ok, string err, ulong slaveTicket, int latencyMs)
{
   string j = StringFormat("{\"command_id\":\"%s\",\"ok\":%s,\"error\":\"%s\",\"slave_ticket\":\"%I64u\",\"latency_ms\":%d}",
      commandId, ok?"true":"false", err, slaveTicket, latencyMs);
   char post[]; StringToCharArray(j, post, 0, StringLen(j));
   char result[]; string rh; string headers = "Content-Type: application/json\r\nx-onyx-key: " + CopyApiKey + "\r\n";
   WebRequest("POST", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
}

//--- Resuelve el símbolo local recorriendo el Market Watch (mismo criterio que copySymbols.ts).
string NormalizeSym(string s)
{
   string u = s; StringToUpper(u);
   StringReplace(u, ".", ""); StringReplace(u, "_", ""); StringReplace(u, "-", ""); StringReplace(u, "#", "");
   return u;
}
string ResolveLocalSymbol(string masterSymbol)
{
   if(SymbolSelect(masterSymbol, true)) return masterSymbol;      // match exacto
   string want = NormalizeSym(masterSymbol);
   int total = SymbolsTotal(false);
   for(int i=0;i<total;i++){
      string s = SymbolName(i, false);
      if(NormalizeSym(s) == want) return s;                       // por base
   }
   // TODO: tabla de alias (GOLD↔XAUUSD, US100↔NAS100…) igual que en copySymbols.ts
   return "";                                                     // no encontrado → no ejecutar
}

//--- Cálculo de lote según el modo (leyendo datos reales del broker esclavo).
double CalcLot(string sym, string mode, double masterVol, double masterBalance, double mult, double riskPct, double slPips)
{
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   double minL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double lot = masterVol * mult;
   if(mode == "balance" && masterBalance > 0) lot = masterVol * (bal / masterBalance) * mult;
   else if(mode == "risk" && slPips > 0) {
      double tickVal = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickSz  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double point   = SymbolInfoDouble(sym, SYMBOL_POINT);
      double pipVal  = (tickSz>0) ? tickVal * (point*10.0/tickSz) : tickVal; // valor de 1 pip por lote
      double riskCash= bal * (riskPct/100.0);
      if(pipVal>0) lot = riskCash / (slPips * pipVal);
   }
   lot = MathFloor(lot/step)*step;
   if(lot < minL) lot = minL; if(lot > maxL) lot = maxL;
   return lot;
}

//============================================================
// LÍMITES DE RIESGO DEL ENLACE (llegan dentro de payload.limits):
//   max_lot, max_spread (pts), daily_loss_pct, max_drawdown_pct
//============================================================

//--- Tope duro de lote definido en la web.
double ApplyMaxLot(double lot, double maxLot)
{
   if(maxLot > 0 && lot > maxLot) return maxLot;
   return lot;
}

//--- ¿El spread actual supera el máximo permitido? (en puntos)
bool SpreadTooHigh(string sym, double maxSpreadPts)
{
   if(maxSpreadPts <= 0) return false;
   double spread = (double)SymbolInfoInteger(sym, SYMBOL_SPREAD); // en puntos
   return spread > maxSpreadPts;
}

//--- ¿Se alcanzó la pérdida diaria o el drawdown máximos? → no abrir más.
bool RiskStop(double dailyLossPct, double maxDdPct)
{
   // Reinicia la referencia del día si cambió la fecha.
   int today = DayOfYearNow();
   if(today != g_dayStamp) { g_dayStamp = today; g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY); }

   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);

   if(dailyLossPct > 0 && g_dayStartEquity > 0) {
      double lossPct = (g_dayStartEquity - eq) / g_dayStartEquity * 100.0;
      if(lossPct >= dailyLossPct) { Print("RiskStop: pérdida diaria ", DoubleToString(lossPct,2), "%"); return true; }
   }
   if(maxDdPct > 0 && bal > 0) {
      double ddPct = (bal - eq) / bal * 100.0;
      if(ddPct >= maxDdPct) { Print("RiskStop: drawdown ", DoubleToString(ddPct,2), "%"); return true; }
   }
   return false;
}

void OnTimer()
{
   string body = GetCommands();
   DrawPanel();                       // refresca la tarjeta (borde por estado)
   if(body == "") return;
   // Cuando conectes la ejecución, actualiza g_copied / g_skipped / g_lat aquí
   // (y g_masterInfo = master_ticket) para que el panel muestre datos reales.
   // TODO: parsear el JSON (array de comandos) con una librería JSON de MQL5.
   //       Por cada comando { id, action, base_symbol, side, volume_hint, sl, tp, price,
   //                          payload:{ mode, multiplier, risk_pct, pip_risk, masterBalance,
   //                                    limits:{ max_lot, max_spread, daily_loss_pct, max_drawdown_pct } } }:
   //
   //   if(action=="open") {
   //      if(RiskStop(limits.daily_loss_pct, limits.max_drawdown_pct)) { Ack(id,false,"risk_stop",0,0); continue; }
   //      string local = ResolveLocalSymbol(base_symbol);
   //      if(local == "") { Ack(id,false,"symbol_not_found",0,0); continue; }
   //      if(SpreadTooHigh(local, limits.max_spread)) { Ack(id,false,"spread_high",0,0); continue; }
   //      double lot = CalcLot(local, mode, volume_hint, masterBalance, mult, riskPct, slPips);
   //      lot = ApplyMaxLot(lot, limits.max_lot);
   //      bool ok = (side=="buy") ? trade.Buy(lot,local,0,sl,tp) : trade.Sell(lot,local,0,sl,tp);
   //      Ack(id, ok, ok?"":"open_fail", trade.ResultOrder(), lat);
   //   }
   //   if(action=="close") { /* cerrar la posición ligada a master_ticket */ }
   //   if(action=="modify"){ /* ajustar SL/TP */ }
}
