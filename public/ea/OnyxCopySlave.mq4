//+------------------------------------------------------------------+
//| OnyxCopySlave.mq4  ·  PLANTILLA (Fase 2 · MetaTrader 4)           |
//| Pide comandos a Onyx, resuelve el símbolo local, calcula el      |
//| lote según el modo, aplica los LÍMITES de riesgo del enlace y    |
//| ejecuta.                                                         |
//|                                                                  |
//| Whitelist de WebRequest igual que el master.                     |
//| Pega tu CLAVE COPY de esta cuenta (empieza por "onyx_copy_").    |
//| Plantilla: falta parseo JSON robusto (usa una lib JSON de MQL4). |
//+------------------------------------------------------------------+
#property strict

extern string ApiBase    = "https://www.onyxtradinglive.com";
extern string CopyApiKey = "PON_TU_CLAVE_COPY";   // onyx_copy_...
extern int    PollMs     = 1000;
extern int    Slippage   = 30;

double g_dayStartEquity = 0;
int    g_dayStamp       = -1;

int OnInit()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   g_dayStartEquity = AccountEquity();
   g_dayStamp = DayOfYear();
   EventSetMillisecondTimer(PollMs);
   return(INIT_SUCCEEDED);
}
void OnDeinit(const int reason){ EventKillTimer(); }

// GET de comandos pendientes.
string GetCommands()
{
   char post[]; char result[]; string rh;
   string headers = "x-onyx-key: " + CopyApiKey + "\r\n";
   ResetLastError();
   int code = WebRequest("GET", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
   if(code != 200){ if(code==-1) Print("WebRequest err ", GetLastError()); return(""); }
   return(CharArrayToString(result));
}

// Confirma el resultado de un comando.
void Ack(string commandId, bool ok, string err, int slaveTicket, int latencyMs)
{
   string j = StringFormat("{\"command_id\":\"%s\",\"ok\":%s,\"error\":\"%s\",\"slave_ticket\":\"%d\",\"latency_ms\":%d}",
      commandId, ok?"true":"false", err, slaveTicket, latencyMs);
   char post[]; StringToCharArray(j, post, 0, StringLen(j));
   char result[]; string rh;
   string headers = "Content-Type: application/json\r\nx-onyx-key: " + CopyApiKey + "\r\n";
   WebRequest("POST", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
}

// Resuelve el símbolo local recorriendo el Market Watch.
string NormalizeSym(string s)
{
   string u = s; StringToUpper(u);
   StringReplace(u, ".", ""); StringReplace(u, "_", ""); StringReplace(u, "-", ""); StringReplace(u, "#", "");
   return(u);
}
string ResolveLocalSymbol(string masterSymbol)
{
   if(MarketInfo(masterSymbol, MODE_BID) > 0) return(masterSymbol);   // existe
   string want = NormalizeSym(masterSymbol);
   int total = SymbolsTotal(false);
   for(int i=0;i<total;i++){
      string s = SymbolName(i, false);
      if(NormalizeSym(s) == want) return(s);
   }
   return("");                                                        // no encontrado → no ejecutar
}

// Cálculo de lote según el modo.
double CalcLot(string sym, string mode, double masterVol, double masterBalance, double mult, double riskPct, double slPips)
{
   double bal  = AccountBalance();
   double step = MarketInfo(sym, MODE_LOTSTEP);
   double minL = MarketInfo(sym, MODE_MINLOT);
   double maxL = MarketInfo(sym, MODE_MAXLOT);
   double lot  = masterVol * mult;
   if(mode == "balance" && masterBalance > 0) lot = masterVol * (bal / masterBalance) * mult;
   else if(mode == "risk" && slPips > 0){
      double tickVal = MarketInfo(sym, MODE_TICKVALUE);
      double pipVal  = tickVal * 10.0;             // aprox: 1 pip = 10 ticks en 5 dígitos
      double riskCash= bal * (riskPct/100.0);
      if(pipVal>0) lot = riskCash / (slPips * pipVal);
   }
   if(step>0) lot = MathFloor(lot/step)*step;
   if(lot < minL) lot = minL; if(lot > maxL) lot = maxL;
   return(lot);
}

// LÍMITES DEL ENLACE (llegan en payload.limits): max_lot, max_spread, daily_loss_pct, max_drawdown_pct
double ApplyMaxLot(double lot, double maxLot){ if(maxLot>0 && lot>maxLot) return(maxLot); return(lot); }
bool   SpreadTooHigh(string sym, double maxSpreadPts){ if(maxSpreadPts<=0) return(false); return(MarketInfo(sym, MODE_SPREAD) > maxSpreadPts); }
bool   RiskStop(double dailyLossPct, double maxDdPct)
{
   if(DayOfYear() != g_dayStamp){ g_dayStamp = DayOfYear(); g_dayStartEquity = AccountEquity(); }
   double eq = AccountEquity(), bal = AccountBalance();
   if(dailyLossPct > 0 && g_dayStartEquity > 0){
      double lossPct = (g_dayStartEquity - eq) / g_dayStartEquity * 100.0;
      if(lossPct >= dailyLossPct){ Print("RiskStop: pérdida diaria ", DoubleToStr(lossPct,2), "%"); return(true); }
   }
   if(maxDdPct > 0 && bal > 0){
      double ddPct = (bal - eq) / bal * 100.0;
      if(ddPct >= maxDdPct){ Print("RiskStop: drawdown ", DoubleToStr(ddPct,2), "%"); return(true); }
   }
   return(false);
}

void OnTimer()
{
   string body = GetCommands();
   if(body == "") return;
   // TODO: parsear el JSON (array de comandos) con una librería JSON de MQL4.
   //  Por cada comando { id, action, base_symbol, side, volume_hint, sl, tp, price,
   //                     payload:{ mode, multiplier, risk_pct, pip_risk, masterBalance,
   //                               limits:{ max_lot, max_spread, daily_loss_pct, max_drawdown_pct } } }:
   //
   //  if(action=="open"){
   //     if(RiskStop(limits.daily_loss_pct, limits.max_drawdown_pct)){ Ack(id,false,"risk_stop",0,0); continue; }
   //     string local = ResolveLocalSymbol(base_symbol);
   //     if(local==""){ Ack(id,false,"symbol_not_found",0,0); continue; }
   //     if(SpreadTooHigh(local, limits.max_spread)){ Ack(id,false,"spread_high",0,0); continue; }
   //     double lot = ApplyMaxLot(CalcLot(local, mode, volume_hint, masterBalance, mult, riskPct, slPips), limits.max_lot);
   //     int type = (side=="buy") ? OP_BUY : OP_SELL;
   //     double px = (type==OP_BUY) ? MarketInfo(local,MODE_ASK) : MarketInfo(local,MODE_BID);
   //     int tk = OrderSend(local, type, lot, px, Slippage, sl, tp, "OnyxCopy", 0, 0, clrNONE);
   //     Ack(id, tk>0, tk>0?"":"open_fail", tk, lat);
   //  }
   //  if(action=="close"){ /* cerrar la orden ligada a master_ticket */ }
}
