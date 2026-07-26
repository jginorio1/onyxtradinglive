//+------------------------------------------------------------------+
//| OnyxCopySlave.mq5  ·  PLANTILLA (Fase 1)                          |
//| Pide comandos a Onyx cada 1 s, resuelve el símbolo local,        |
//| calcula el lote según el modo y ejecuta.                         |
//|                                                                  |
//| Whitelist de WebRequest igual que el master. Pon tu API key.     |
//| Plantilla: falta parseo JSON robusto (usa una lib JSON de MQL),  |
//| reintentos y pruebas. El cálculo de lote y la resolución de      |
//| símbolo están abajo listos para adaptar.                         |
//+------------------------------------------------------------------+
#property strict
#include <Trade/Trade.mqh>
CTrade trade;

input string ApiBase = "https://www.onyxtradinglive.com";
input string ApiKey  = "PON_TU_API_KEY_DE_CUENTA";
input int    PollMs  = 1000;

int OnInit(){ EventSetMillisecondTimer(PollMs); return INIT_SUCCEEDED; }
void OnDeinit(const int r){ EventKillTimer(); }

//--- GET de comandos pendientes.
string GetCommands()
{
   char post[]; char result[]; string rh;
   string headers = "x-onyx-key: " + ApiKey + "\r\n";
   int code = WebRequest("GET", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
   if(code != 200) { if(code==-1) Print("WebRequest err ", GetLastError()); return ""; }
   return CharArrayToString(result);
}

//--- Confirma el resultado de un comando.
void Ack(string commandId, bool ok, string err, ulong slaveTicket, int latencyMs)
{
   string j = StringFormat("{\"command_id\":\"%s\",\"ok\":%s,\"error\":\"%s\",\"slave_ticket\":\"%I64u\",\"latency_ms\":%d}",
      commandId, ok?"true":"false", err, slaveTicket, latencyMs);
   char post[]; StringToCharArray(j, post, 0, StringLen(j));
   char result[]; string rh; string headers = "Content-Type: application/json\r\nx-onyx-key: " + ApiKey + "\r\n";
   WebRequest("POST", ApiBase + "/api/v1/copy/slave", headers, 5000, post, result, rh);
}

//--- Resuelve el símbolo local recorriendo el Market Watch (mismo criterio que copySymbols.ts).
string NormalizeSym(string s)
{
   string u = s; StringToUpper(u);
   // quita prefijos # . _ - y separadores; los sufijos se resuelven por comparación de base
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

void OnTimer()
{
   string body = GetCommands();
   if(body == "") return;
   // TODO: parsear el JSON (array de comandos) con una librería JSON de MQL5.
   //       Por cada comando { id, action, base_symbol, side, volume_hint, sl, tp, price, mode, ... }:
   //   string local = ResolveLocalSymbol(base_symbol);
   //   if(local == "") { Ack(id,false,"symbol_not_found",0,0); continue; }
   //   double lot = CalcLot(local, mode, volume_hint, masterBalance, mult, riskPct, slPips);
   //   if(action=="open"){ bool ok = (side=="buy") ? trade.Buy(lot,local,0,sl,tp) : trade.Sell(lot,local,0,sl,tp); Ack(id,ok,ok?"":"open_fail",trade.ResultOrder(),lat); }
   //   if(action=="close"){ /* cerrar la posición ligada a master_ticket */ }
}
