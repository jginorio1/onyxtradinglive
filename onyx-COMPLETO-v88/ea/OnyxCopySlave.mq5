//+------------------------------------------------------------------+
//| OnyxCopySlave.mq5  ·  PLANTILLA (Fase 2)                          |
//| Pide comandos a Onyx cada 1 s, resuelve el símbolo local,        |
//| calcula el lote según el modo, aplica los LÍMITES de riesgo del  |
//| enlace (que vienen en el comando) y ejecuta.                     |
//|                                                                  |
//| Whitelist de WebRequest igual que el master.                     |
//| Pega tu CLAVE COPY de esta cuenta (empieza por "onyx_copy_").    |
//|                                                                  |
//| EJECUCION IMPLEMENTADA: parsea los comandos, resuelve el         |
//| símbolo, calcula el lote, aplica límites y abre/cierra.          |
//| IMPORTANTE: pruébala PRIMERO en cuenta DEMO (master+esclava)     |
//| antes de usar dinero real.                                       |
//+------------------------------------------------------------------+
#property strict
#include <Trade/Trade.mqh>
CTrade trade;

input string ApiBase    = "https://www.onyxtradinglive.com";
input string CopyApiKey = "PON_TU_CLAVE_COPY";   // onyx_copy_...  (no hace falta en modo Local)
input int    PollMs     = 1000;                  // En modo Local ponlo bajo (ej. 100) para copiar mas rapido
input string PanelLang  = "EN";                  // Panel: ES=Español, otro=English (web/IA/Telegram en 6 idiomas)
input string SymbolMap  = "";                    // Tabla manual master=esclava. Ej: US100=NAS100;GOLD=XAUUSD.pro;EURUSD=EURUSDm
// ---- Modo LOCAL (mismo VPS): lee el archivo comun que escribe el master ----
input bool   LocalMode      = false;             // Copia LOCAL sin nube (milisegundos)
input string CopyChannel    = "onyx1";           // Mismo nombre que el master del mismo VPS
input string LocalSizing    = "multiplier";      // multiplier | balance
input double LocalMult      = 1.0;               // Multiplicador de lote (o proporcion si balance)
input double LocalMaxLot    = 0;                 // Tope de lote (0 = sin tope)
input double LocalMaxSpread = 0;                 // Spread maximo en puntos (0 = sin limite)
input double LocalDailyLoss = 0;                 // Perdida diaria maxima % (0 = off)
input double LocalMaxDd      = 0;                // Drawdown maximo % (0 = off)

string L(string en, string es){ return (StringFind(PanelLang, "ES") == 0) ? es : en; }

//--- Equity de referencia del día (para la pérdida diaria / drawdown).
double g_dayStartEquity = 0;
int    g_dayStamp       = -1;
int    g_localDone      = 0;      // lineas del archivo local ya procesadas

// Config EFECTIVA en modo Local. Por defecto usa los inputs Local*; si hay clave
// Copy, se sobreescribe con lo que configuraste en la web (una sola vez al iniciar).
string gMode; double gMult, gRisk, gPip, gMaxLot, gMaxSpr, gDLoss, gMDD;

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
   PLabel("t",L("Onyx Copy  SLAVE","Onyx Copy  ESCLAVA")+(LocalMode?" · LOCAL":""),X+12,y,CP_TX,9,true); y+=18;
   string stx = g_state==2?L("Connected","Conectada") : (g_state==0?L("PAUSED","PAUSADA"):L("Waiting for signal","Esperando senal"));
   PLabel("st",stx,X+12,y,bc,8); y+=16;
   PLabel("m",L("Copying from: ","Copia de: ")+g_masterInfo,X+12,y,CP_MUT,8); y+=16;
   PLabel("c",L("Copied: ","Copiadas: ")+(string)g_copied+L("   Skipped ","   Saltadas ")+(string)g_skipped,X+12,y,CP_TX,8); y+=16;
   PLabel("l",L("Delay: ","Retraso: ")+(string)g_lat+" ms",X+12,y,CP_MUT,8);
   ChartRedraw();
}
void DelPanel(){ ObjectsDeleteAll(0,PFX); }

// Config efectiva: arranca con los inputs Local* y, si hay clave, la pide a la web.
void InitLocalCfg()
{
   gMode = LocalSizing; gMult = LocalMult; gRisk = 0; gPip = 0;
   gMaxLot = LocalMaxLot; gMaxSpr = LocalMaxSpread; gDLoss = LocalDailyLoss; gMDD = LocalMaxDd;
}
void FetchLocalConfig()
{
   if(StringFind(CopyApiKey, "onyx_copy_") != 0) return;   // sin clave → usa los inputs
   char post[]; char result[]; string rh;
   string headers = "x-onyx-key: " + CopyApiKey + "\r\n";
   int code = WebRequest("GET", ApiBase + "/api/v1/copy/config", headers, 5000, post, result, rh);
   if(code != 200) return;
   string b = CharArrayToString(result);
   if(StringFind(b, "\"found\":true") < 0) return;
   gMode   = JVal(b, "mode");
   gMult   = JNum(b, "multiplier"); if(gMult <= 0) gMult = 1;
   gRisk   = JNum(b, "risk_pct");
   gPip    = JNum(b, "pip_risk");
   gMaxLot = JNum(b, "max_lot");
   gMaxSpr = JNum(b, "max_spread");
   gDLoss  = JNum(b, "daily_loss_pct");
   gMDD    = JNum(b, "max_drawdown_pct");
   Print("Onyx local: config del enlace cargada desde la web (modo ", gMode, ").");
}

int OnInit()
{
   if(!LocalMode && StringFind(CopyApiKey, "onyx_copy_") != 0)
      Print("AVISO: CopyApiKey no parece una clave Copy (debe empezar por onyx_copy_).");
   g_dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayStamp = DayOfYearNow();
   InitLocalCfg();
   if(LocalMode)
   {
      g_localDone = CountLocalLines();   // solo copia eventos nuevos
      FetchLocalConfig();                // trae tu config de la web (si hay clave)
   }
   // En modo Local leemos el archivo muy seguido (100 ms) para copiar casi al instante.
   EventSetMillisecondTimer(LocalMode ? 100 : PollMs);
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
//--- ¿Dos símbolos normalizados son el mismo par, admitiendo un sufijo de letras (.sim, m, .pro, ecn…)?
bool SymMatch(string a, string b)
{
   if(a == b) return true;
   string lng = (StringLen(a) >= StringLen(b)) ? a : b;          // el más largo
   string sht = (StringLen(a) >= StringLen(b)) ? b : a;          // el más corto
   int ls = StringLen(sht), ll = StringLen(lng);
   if(ll > ls && (ll - ls) <= 5 && StringSubstr(lng,0,ls) == sht){
      string rest = StringSubstr(lng, ls);                       // p.ej. "M", "PRO", "ECN", "SIM"
      for(int k=0;k<StringLen(rest);k++){ ushort c = StringGetCharacter(rest,k); if(c < 'A' || c > 'Z') return false; }
      return true;
   }
   return false;
}
//--- Grupos de alias para índices/metales cuyo nombre cambia entre brokers.
string AliasList(string want)
{
   string g[] = {
      "NAS100,US100,USTEC,USTECH,NASDAQ,NDX,USNAS100,US100CASH,NAS100CASH,USTEC100",
      "US30,DJ30,WS30,DOW,DJIA,US30CASH,USA30,DJI,WALLST30",
      "SPX500,US500,SP500,SPX,USA500,US500CASH,SPX500USD",
      "GER40,DE40,GER30,DE30,DAX40,DAX30,DAX,GERMANY40,GER40CASH",
      "UK100,FTSE100,FTSE,UK100CASH,GB100,BRITAIN100",
      "US2000,RUSSELL2000,US2000CASH,RUT",
      "JP225,JPN225,NIKKEI,NIK225,JAPAN225,JP225CASH",
      "XAUUSD,GOLD,GOLDUSD",
      "XAGUSD,SILVER,SILVERUSD",
      "USOIL,WTI,WTIUSD,CRUDE,OILUSD,USCRUDE,XTIUSD,USOUSD",
      "UKOIL,BRENT,BRENTUSD,XBRUSD,UKOUSD"
   };
   for(int i=0;i<ArraySize(g);i++){
      string mem[]; int nm = StringSplit(g[i], ',', mem);
      for(int j=0;j<nm;j++) if(SymMatch(want, mem[j])) return g[i];
   }
   return "";
}
string ResolveLocalSymbol(string masterSymbol)
{
   string ov = MapOverride(masterSymbol);
   if(ov != "") return ov;                                       // 0) tabla manual (máxima prioridad)
   if(SymbolSelect(masterSymbol, true)) return masterSymbol;     // 1) match exacto directo
   string want = NormalizeSym(masterSymbol);
   int total = SymbolsTotal(false);
   // Pase 1: mismo par con o sin sufijo de broker (EURUSDm, EURUSD.pro, XAUUSDecn…)
   for(int i=0;i<total;i++){
      string s = SymbolName(i, false);
      if(SymMatch(NormalizeSym(s), want)){ SymbolSelect(s, true); return s; }
   }
   // Pase 2: alias de índices/metales (GOLD↔XAUUSD, US100↔NAS100, GER40↔DE40…)
   string alias = AliasList(want);
   if(alias != ""){
      string mem[]; int n = StringSplit(alias, ',', mem);
      for(int m=0;m<n;m++)
         for(int i=0;i<total;i++){
            string s = SymbolName(i, false);
            if(SymMatch(NormalizeSym(s), mem[m])){ SymbolSelect(s, true); return s; }
         }
   }
   return "";                                                    // no encontrado → no ejecutar (falla seguro)
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

//============================================================
// Mini-parser JSON para la forma conocida de nuestros comandos.
//============================================================
string JVal(string obj, string key)
{
   string pat = "\"" + key + "\"";
   int p = StringFind(obj, pat); if(p < 0) return "";
   p = StringFind(obj, ":", p + StringLen(pat)); if(p < 0) return "";
   p++;
   int n = StringLen(obj);
   while(p < n && StringGetCharacter(obj, p) == ' ') p++;
   if(p >= n) return "";
   ushort c = StringGetCharacter(obj, p);
   if(c == '"'){ int e = StringFind(obj, "\"", p + 1); if(e < 0) return ""; return StringSubstr(obj, p + 1, e - (p + 1)); }
   if(c == '{' || c == '['){
      ushort op = c, cl = (c == '{') ? '}' : ']'; int depth = 0;
      for(int i = p; i < n; i++){ ushort ch = StringGetCharacter(obj, i); if(ch == op) depth++; else if(ch == cl){ depth--; if(depth == 0) return StringSubstr(obj, p, i - p + 1); } }
      return "";
   }
   int e2 = p; while(e2 < n){ ushort ch = StringGetCharacter(obj, e2); if(ch == ',' || ch == '}' || ch == ']') break; e2++; }
   string v = StringSubstr(obj, p, e2 - p); StringTrimLeft(v); StringTrimRight(v); return v;
}
double JNum(string obj, string key){ string v = JVal(obj, key); return (v == "" || v == "null") ? 0.0 : StringToDouble(v); }

// Separa "[{..},{..}]" en objetos individuales.
int JSplit(string arr, string &out[])
{
   int cnt = 0, depth = 0, start = -1, n = StringLen(arr);
   for(int i = 0; i < n; i++){
      ushort ch = StringGetCharacter(arr, i);
      if(ch == '{'){ if(depth == 0) start = i; depth++; }
      else if(ch == '}'){ depth--; if(depth == 0 && start >= 0){ ArrayResize(out, cnt + 1); out[cnt] = StringSubstr(arr, start, i - start + 1); cnt++; start = -1; } }
   }
   return cnt;
}

//--- Mapa master_ticket -> posicion esclava (para poder cerrar lo que abrimos).
long  g_mMaster[]; ulong g_mSlave[]; int g_mN = 0;
void  MapAdd(long mt, ulong st){ ArrayResize(g_mMaster, g_mN + 1); ArrayResize(g_mSlave, g_mN + 1); g_mMaster[g_mN] = mt; g_mSlave[g_mN] = st; g_mN++; }
ulong MapGet(long mt){ for(int i = 0; i < g_mN; i++) if(g_mMaster[i] == mt) return g_mSlave[i]; return 0; }

#define ONYX_MAGIC 990201

//--- Ultima posicion nuestra de un simbolo (respaldo si ResultOrder devuelve 0).
ulong PositionLastTicket(string sym){
   for(int i = PositionsTotal() - 1; i >= 0; i--){ ulong tk = PositionGetTicket(i);
      if(PositionSelectByTicket(tk) && PositionGetString(POSITION_SYMBOL) == sym && PositionGetInteger(POSITION_MAGIC) == ONYX_MAGIC) return tk; }
   return 0;
}
//--- Cierra la posicion ligada al ticket de la master.
bool CloseByMaster(long mt){
   ulong st = MapGet(mt);
   if(st != 0 && PositionSelectByTicket(st)){ trade.SetExpertMagicNumber(ONYX_MAGIC); return trade.PositionClose(st); }
   string want = "OC" + (string)mt;   // respaldo por comentario
   for(int i = PositionsTotal() - 1; i >= 0; i--){ ulong tk = PositionGetTicket(i);
      if(PositionSelectByTicket(tk) && PositionGetInteger(POSITION_MAGIC) == ONYX_MAGIC && StringFind(PositionGetString(POSITION_COMMENT), want) >= 0){ trade.SetExpertMagicNumber(ONYX_MAGIC); return trade.PositionClose(tk); } }
   return false;
}

//============================================================
// MODO LOCAL (mismo VPS): lee el archivo comun del master.
//============================================================
int CountLocalLines()
{
   string fn = "onyx_local_" + CopyChannel + ".jsonl";
   int h = FileOpen(fn, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE) return 0;
   int c = 0;
   while(!FileIsEnding(h)) { string ln = FileReadString(h); if(StringLen(ln) > 0) c++; }
   FileClose(h);
   return c;
}

void HandleLocalEvent(string o)
{
   string ev  = JVal(o, "ev");
   string sym = JVal(o, "symbol");
   string side= JVal(o, "side");
   string mtk = JVal(o, "ticket");
   double vol = JNum(o, "vol");
   double sl  = JNum(o, "sl");
   double tp  = JNum(o, "tp");
   double mbal= JNum(o, "mbal");
   long   mt  = (long)StringToInteger(mtk);
   uint   t0  = GetTickCount();

   if(ev == "open")
   {
      if(RiskStop(gDLoss, gMDD)) { g_skipped++; return; }
      string local = ResolveLocalSymbol(sym);
      if(local == "") { g_skipped++; return; }
      if(SpreadTooHigh(local, gMaxSpr)) { g_skipped++; return; }
      double lot = ApplyMaxLot(CalcLot(local, gMode, vol, mbal, gMult, gRisk, gPip), gMaxLot);
      trade.SetExpertMagicNumber(ONYX_MAGIC);
      trade.SetDeviationInPoints(20);
      bool ok = (side == "buy") ? trade.Buy(lot, local, 0.0, sl, tp, "OC" + mtk)
                                : trade.Sell(lot, local, 0.0, sl, tp, "OC" + mtk);
      int lat = (int)(GetTickCount() - t0);
      if(ok) { ulong st = trade.ResultOrder(); if(st == 0) st = PositionLastTicket(local);
               MapAdd(mt, st); g_copied++; g_lat = lat; g_masterInfo = "#" + mtk; }
      else   g_skipped++;
   }
   else if(ev == "close") CloseByMaster(mt);
}

void ProcessLocal()
{
   string fn = "onyx_local_" + CopyChannel + ".jsonl";
   int h = FileOpen(fn, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE) { g_state = 1; return; }
   g_state = 2;
   string lines[]; int cnt = 0;
   while(!FileIsEnding(h)) { string ln = FileReadString(h); if(StringLen(ln) > 0) { ArrayResize(lines, cnt + 1); lines[cnt] = ln; cnt++; } }
   FileClose(h);
   for(int i = g_localDone; i < cnt; i++) HandleLocalEvent(lines[i]);
   if(cnt > g_localDone) g_localDone = cnt;
}

void OnTimer()
{
   // Modo Local: leer el archivo comun (milisegundos, sin nube).
   if(LocalMode) { ProcessLocal(); DrawPanel(); return; }

   string body = GetCommands();
   DrawPanel();                       // refresca la tarjeta (borde por estado)
   if(body == "") return;

   string arr = JVal(body, "commands");
   if(arr == "" || arr == "[]") return;
   string objs[]; int n = JSplit(arr, objs);

   for(int i = 0; i < n; i++){
      string o = objs[i];
      string id     = JVal(o, "id");
      string action = JVal(o, "action");
      string bsym   = JVal(o, "base_symbol");
      string side   = JVal(o, "side");
      string mtk    = JVal(o, "master_ticket");
      double vol    = JNum(o, "volume_hint");
      double sl     = JNum(o, "sl");
      double tp     = JNum(o, "tp");
      string pl     = JVal(o, "payload");
      string lim    = JVal(pl, "limits");
      string mode   = JVal(pl, "mode");
      double mult   = JNum(pl, "multiplier");
      double riskPct= JNum(pl, "risk_pct");
      double pip    = JNum(pl, "pip_risk");
      double mBal   = JNum(pl, "masterBalance");
      double maxLot = JNum(lim, "max_lot");
      double maxSpr = JNum(lim, "max_spread");
      double dLoss  = JNum(lim, "daily_loss_pct");
      double mDD    = JNum(lim, "max_drawdown_pct");
      long   mt     = (long)StringToInteger(mtk);
      uint   t0     = GetTickCount();

      if(action == "open"){
         if(RiskStop(dLoss, mDD)){ Ack(id, false, "risk_stop", 0, 0); g_skipped++; continue; }
         string local = ResolveLocalSymbol(bsym);
         if(local == ""){ Ack(id, false, "symbol_not_found", 0, 0); g_skipped++; continue; }
         if(SpreadTooHigh(local, maxSpr)){ Ack(id, false, "spread_high", 0, 0); g_skipped++; continue; }
         double lot = ApplyMaxLot(CalcLot(local, mode, vol, mBal, mult, riskPct, pip), maxLot);
         trade.SetExpertMagicNumber(ONYX_MAGIC);
         trade.SetDeviationInPoints(20);
         // SL/TP llegan como precios de la master (validos para el mismo instrumento).
         bool ok = (side == "buy") ? trade.Buy(lot, local, 0.0, sl, tp, "OC" + mtk)
                                   : trade.Sell(lot, local, 0.0, sl, tp, "OC" + mtk);
         int lat = (int)(GetTickCount() - t0);
         if(ok){ ulong st = trade.ResultOrder(); if(st == 0) st = PositionLastTicket(local);
                 MapAdd(mt, st); g_copied++; g_lat = lat; g_masterInfo = "#" + mtk; Ack(id, true, "", st, lat); }
         else  { g_skipped++; Ack(id, false, "open_fail", 0, lat); }
      }
      else if(action == "close"){
         int lat = (int)(GetTickCount() - t0);
         bool done = CloseByMaster(mt);
         Ack(id, done, done ? "" : "close_fail", MapGet(mt), lat);
      }
      // "modify" (ajustar SL/TP) se puede añadir aquí igual que "open".
   }
}
